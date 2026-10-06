import sqlite3
import uuid
from datetime import datetime, timedelta
import os
from typing import Optional, Tuple
from models.user import User
from models.subscription import Subscription, PlanType, SubscriptionStatus, EntitlementType

DB_DIR = os.path.join(os.path.expanduser("~"), ".pdf-tools")
DB_PATH = os.path.join(DB_DIR, "app_data.db")

def _env_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")

def _env_dt(name: str, default: Optional[str]) -> Optional[datetime]:
    val = os.getenv(name, default)
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        return None

class SubscriptionService:
    def __init__(self):
        self.grace_days = int(os.getenv("OFFLINE_GRACE_DAYS", "7"))
        self._init_db()

    def _get_conn(self):
        os.makedirs(DB_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_column(self, cursor, table: str, column: str, ddl: str):
        cols = [r[1] for r in cursor.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in cols:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

    def _init_db(self):
        conn = self._get_conn()
        cursor = conn.cursor()

        # Users Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                device_id TEXT UNIQUE,
                email TEXT,
                created_at TIMESTAMP,
                last_seen TIMESTAMP,
                last_verified_at TIMESTAMP
            )
        ''')
        self._ensure_column(cursor, "users", "last_verified_at", "TIMESTAMP")

        # Subscriptions Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscriptions (
                subscription_id TEXT PRIMARY KEY,
                user_id TEXT,
                plan_type TEXT,
                trial_started_at TIMESTAMP,
                trial_ends_at TIMESTAMP,
                paid_until TIMESTAMP,
                status TEXT,
                updated_at TIMESTAMP,
                access_until TIMESTAMP,
                last_verified_at TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
        ''')
        self._ensure_column(cursor, "subscriptions", "access_until", "TIMESTAMP")
        self._ensure_column(cursor, "subscriptions", "last_verified_at", "TIMESTAMP")

        # Payment Events Table (idempotency + archive)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS payment_events (
                id TEXT PRIMARY KEY,
                provider TEXT,
                provider_event_id TEXT,
                event_type TEXT,
                user_id TEXT,
                transaction_id TEXT,
                payload_hash TEXT,
                created_at TIMESTAMP,
                processed_at TIMESTAMP,
                UNIQUE(provider, provider_event_id),
                UNIQUE(provider, transaction_id)
            )
        ''')

        conn.commit()
        conn.close()

    # --- Launch period (server-controlled, no app release needed) ---

    def _launch_until(self) -> Optional[datetime]:
        return _env_dt("LAUNCH_ACCESS_UNTIL", "2027-03-01T00:00:00")

    def _launch_active(self) -> bool:
        # Production must opt into a launch giveaway explicitly. A missing
        # variable must never unlock every feature after deployment.
        default_enabled = os.environ.get("ENVIRONMENT", "").strip().lower() != "production"
        if not _env_bool("LAUNCH_ACCESS_ENABLED", default_enabled):
            return False
        until = self._launch_until()
        if until is None:
            return False
        return datetime.now() < until

    # --- Users ---

    def get_or_create_user(self, device_id: str) -> User:
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE device_id = ?", (device_id,))
        row = cursor.fetchone()

        now = datetime.now()

        if row:
            user_id = row['user_id']
            # Update last_seen only — last_verified_at is renewed ONLY by an
            # actual entitlement verification (see verify_access), never by
            # arbitrary successful API requests.
            cursor.execute(
                "UPDATE users SET last_seen = ? WHERE user_id = ?",
                (now, user_id)
            )
            conn.commit()

            user = User(
                user_id=row['user_id'],
                device_id=row['device_id'],
                email=row['email'],
                created_at=row['created_at'],
                last_seen=now
            )
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO users (user_id, device_id, created_at, last_seen, last_verified_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, device_id, now, now, now)
            )
            # Create default Trial subscription
            self._create_trial_subscription(cursor, user_id)
            conn.commit()

            user = User(
                user_id=user_id,
                device_id=device_id,
                created_at=now,
                last_seen=now
            )

        conn.close()
        return user

    def _create_trial_subscription(self, cursor, user_id: str):
        sub_id = str(uuid.uuid4())
        now = datetime.now()
        trial_days = 30
        ends_at = now + timedelta(days=trial_days)

        cursor.execute(
            '''INSERT INTO subscriptions 
               (subscription_id, user_id, plan_type, trial_started_at, trial_ends_at, status, updated_at, last_verified_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (sub_id, user_id, PlanType.TRIAL.value, now, ends_at, SubscriptionStatus.ACTIVE.value, now, now)
        )

    def get_subscription(self, user_id: str) -> Subscription:
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM subscriptions WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return self._create_fallback_sub(user_id)

        status = SubscriptionStatus(row['status'])
        plan_type = PlanType(row['plan_type'])
        trial_ends = self._parse_dt(row['trial_ends_at'])
        paid_until = self._parse_dt(row['paid_until'])
        last_verified = self._parse_dt(row['last_verified_at'])

        # Expiry Check Logic (server is source of truth, never device clock)
        now = datetime.now()
        if status == SubscriptionStatus.ACTIVE:
            if plan_type == PlanType.TRIAL and trial_ends and now > trial_ends:
                status = SubscriptionStatus.EXPIRED
                self._update_status(user_id, SubscriptionStatus.EXPIRED)
            elif plan_type in [PlanType.MONTHLY, PlanType.YEARLY] and paid_until and now > paid_until:
                status = SubscriptionStatus.EXPIRED
                self._update_status(user_id, SubscriptionStatus.EXPIRED)

        entitlement, access_until = self._compute_entitlement(plan_type, status, trial_ends, paid_until)
        grace_until = (last_verified + timedelta(days=self.grace_days)) if last_verified else None

        return Subscription(
            subscription_id=row['subscription_id'],
            user_id=row['user_id'],
            plan_type=plan_type,
            trial_started_at=self._parse_dt(row['trial_started_at']),
            trial_ends_at=trial_ends,
            paid_until=paid_until,
            status=status,
            entitlement=entitlement,
            access_until=access_until,
            last_verified_at=last_verified,
            grace_until=grace_until,
            features_enabled=self._get_features(plan_type, status, entitlement)
        )

    def verify_access(self, user_id: str) -> Subscription:
        """POST /api/subscription/verify — the ONLY place that renews the offline
        grace window. A successful entitlement verification updates last_verified_at;
        any other API request must never silently extend grace."""
        now = datetime.now()
        conn = self._get_conn()
        conn.execute("UPDATE subscriptions SET last_verified_at = ? WHERE user_id = ?", (now, user_id))
        conn.execute("UPDATE users SET last_verified_at = ? WHERE user_id = ?", (now, user_id))
        conn.commit()
        conn.close()
        return self.get_subscription(user_id)

    def _compute_entitlement(
        self,
        plan_type: PlanType,
        status: SubscriptionStatus,
        trial_ends: Optional[datetime],
        paid_until: Optional[datetime],
    ) -> Tuple[EntitlementType, Optional[datetime]]:
        candidates = [c for c in (trial_ends, paid_until) if c]
        base_access = max(candidates) if candidates else None

        # Launch period overrides every entitlement: everyone gets full access
        if status == SubscriptionStatus.ACTIVE and self._launch_active():
            return EntitlementType.LAUNCH_FREE, self._launch_until()

        if status != SubscriptionStatus.ACTIVE:
            return EntitlementType.EXPIRED, base_access

        if plan_type == PlanType.LIFETIME:
            return EntitlementType.LIFETIME, base_access or (datetime.now() + timedelta(days=36500))
        if plan_type in (PlanType.TRIAL, PlanType.MONTHLY, PlanType.YEARLY):
            return EntitlementType.SUBSCRIPTION, base_access
        return EntitlementType.EXPIRED, base_access

    def _parse_dt(self, dt_val) -> Optional[datetime]:
        if not dt_val: return None
        if isinstance(dt_val, datetime): return dt_val
        try:
            return datetime.fromisoformat(str(dt_val))
        except ValueError:
            return None

    def _update_status(self, user_id: str, status: SubscriptionStatus):
        conn = self._get_conn()
        conn.execute("UPDATE subscriptions SET status = ? WHERE user_id = ?", (status.value, user_id))
        conn.commit()
        conn.close()

    def _create_fallback_sub(self, user_id: str) -> Subscription:
        return Subscription(
            subscription_id="fallback",
            user_id=user_id,
            plan_type=PlanType.FREE,
            status=SubscriptionStatus.ACTIVE,
            entitlement=EntitlementType.LAUNCH_FREE if self._launch_active() else EntitlementType.EXPIRED,
            access_until=self._launch_until() if self._launch_active() else None,
            features_enabled=self._get_features(PlanType.FREE, SubscriptionStatus.ACTIVE,
                                                EntitlementType.LAUNCH_FREE if self._launch_active() else EntitlementType.EXPIRED)
        )

    def _get_features(self, plan: PlanType, status: SubscriptionStatus, entitlement: EntitlementType) -> list[str]:
        all_features = [
            "basic_reading", "pdf_merge", "pdf_split", "pdf_compress",
            "pdf_extract_images", "fast_reading", "text_extract", "tahweel",
            "watermark_edit", "remove_security", "pro_stats", "sync",
            "bookmark_insert", "md_to_pdf_advanced",
            "batch_processing", "priority_support", "beta_access"
        ]

        # When DEV_MODE is set, unlock everything (never honored in production)
        if os.getenv('DEV_MODE') and os.environ.get("ENVIRONMENT", "").strip().lower() != "production":
            return all_features

        base_features = ["basic_reading", "pdf_merge", "pdf_split", "pdf_compress", "pdf_extract_images"]

        if status != SubscriptionStatus.ACTIVE:
            return base_features

        if entitlement == EntitlementType.LAUNCH_FREE:
            return all_features

        if plan == PlanType.FREE:
            return base_features
        elif plan in (PlanType.TRIAL, PlanType.MONTHLY, PlanType.YEARLY):
            premium = ["fast_reading", "text_extract", "tahweel", "watermark_edit", "remove_security", "pro_stats", "sync", "bookmark_insert", "md_to_pdf_advanced", "batch_processing"]
            return base_features + premium
        elif plan == PlanType.LIFETIME:
            premium = ["fast_reading", "text_extract", "tahweel", "watermark_edit", "remove_security", "pro_stats", "sync", "bookmark_insert", "md_to_pdf_advanced", "batch_processing"]
            return base_features + premium + ["priority_support", "beta_access"]

        return base_features

    # --- Payment events (idempotency) ---

    def record_payment_event(
        self,
        provider: str,
        provider_event_id: str,
        event_type: str,
        user_id: Optional[str],
        transaction_id: Optional[str],
        payload_hash: Optional[str],
    ) -> bool:
        """
        Records a payment event atomically. Returns False when the event (or the
        underlying PayMob transaction) has already been processed — the caller
        must treat that as a duplicate and NOT re-fulfill the order.
        """
        conn = self._get_conn()
        try:
            now = datetime.now()
            conn.execute(
                '''INSERT INTO payment_events
                   (id, provider, provider_event_id, event_type, user_id, transaction_id, payload_hash, created_at, processed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (str(uuid.uuid4()), provider, provider_event_id, event_type, user_id, transaction_id, payload_hash, now, now)
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

subscription_service = SubscriptionService()
