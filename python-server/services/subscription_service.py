import sqlite3
import uuid
from datetime import datetime, timedelta
import os
from typing import Optional, Tuple
from models.user import User
from models.subscription import Subscription, PlanType, SubscriptionStatus

DB_DIR = os.path.join(os.path.expanduser("~"), ".pdf-tools")
DB_PATH = os.path.join(DB_DIR, "app_data.db")
class SubscriptionService:
    def __init__(self):
        self._init_db()

    def _get_conn(self):
        os.makedirs(DB_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

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
                last_seen TIMESTAMP
            )
        ''')

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
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
        ''')
        
        conn.commit()
        conn.close()

    def get_or_create_user(self, device_id: str) -> User:
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE device_id = ?", (device_id,))
        row = cursor.fetchone()
        
        now = datetime.now()
        
        if row:
            user_id = row['user_id']
            # Update last_seen
            cursor.execute("UPDATE users SET last_seen = ? WHERE user_id = ?", (now, user_id))
            conn.commit()
            
            user = User(
                user_id=row['user_id'],
                device_id=row['device_id'],
                email=row['email'],
                created_at=row['created_at'],
                last_seen=now  # Updated
            )
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO users (user_id, device_id, created_at, last_seen) VALUES (?, ?, ?, ?)",
                (user_id, device_id, now, now)
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
               (subscription_id, user_id, plan_type, trial_started_at, trial_ends_at, status, updated_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (sub_id, user_id, PlanType.TRIAL.value, now, ends_at, SubscriptionStatus.ACTIVE.value, now)
        )

    def get_subscription(self, user_id: str) -> Subscription:
        conn = self._get_conn()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM subscriptions WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            # Should not happen if user created correctly, but create fallback
            return self._create_fallback_sub(user_id)

        # Check for expiry
        status = SubscriptionStatus(row['status'])
        plan_type = PlanType(row['plan_type'])
        trial_ends = self._parse_dt(row['trial_ends_at'])
        paid_until = self._parse_dt(row['paid_until'])
        
        # Expiry Check Logic
        now = datetime.now()
        if status == SubscriptionStatus.ACTIVE:
            if plan_type == PlanType.TRIAL and trial_ends and now > trial_ends:
                status = SubscriptionStatus.EXPIRED
                self._update_status(user_id, SubscriptionStatus.EXPIRED)
            elif plan_type in [PlanType.MONTHLY, PlanType.YEARLY] and paid_until and now > paid_until:
                 status = SubscriptionStatus.EXPIRED
                 self._update_status(user_id, SubscriptionStatus.EXPIRED)

        return Subscription(
            subscription_id=row['subscription_id'],
            user_id=row['user_id'],
            plan_type=plan_type,
            trial_started_at=self._parse_dt(row['trial_started_at']),
            trial_ends_at=trial_ends,
            paid_until=paid_until,
            status=status,
            features_enabled=self._get_features(plan_type, status)
        )

    def _parse_dt(self, dt_val) -> Optional[datetime]:
        if not dt_val: return None
        if isinstance(dt_val, datetime): return dt_val
        try:
             return datetime.fromisoformat(str(dt_val)) 
        except:
            return None

    def _update_status(self, user_id: str, status: SubscriptionStatus):
        conn = self._get_conn()
        conn.execute("UPDATE subscriptions SET status = ? WHERE user_id = ?", (status.value, user_id))
        conn.commit()
        conn.close()

    def _create_fallback_sub(self, user_id: str) -> Subscription:
        # Return a dummy expired/free subscription
        return Subscription(
            subscription_id="fallback",
            user_id=user_id,
            plan_type=PlanType.FREE,
            status=SubscriptionStatus.ACTIVE,
            features_enabled=self._get_features(PlanType.FREE, SubscriptionStatus.ACTIVE)
        )

    def _get_features(self, plan: PlanType, status: SubscriptionStatus) -> list[str]:
        # Basic features available to everyone (Free or Expired)
        base_features = ["basic_reading", "pdf_merge", "pdf_split", "pdf_compress", "pdf_extract_images"]
        
        if status != SubscriptionStatus.ACTIVE:
            return base_features
        
        if plan == PlanType.FREE:
            return base_features
        elif plan == PlanType.TRIAL:
            # Trial gets everything for 30 days
            return base_features + ["fast_reading", "text_extract", "tahweel", "watermark_edit", "remove_security", "pro_stats", "sync", "batch_processing"]
        elif plan == PlanType.MONTHLY or plan == PlanType.YEARLY:
            return base_features + ["fast_reading", "text_extract", "tahweel", "watermark_edit", "remove_security", "pro_stats", "sync", "batch_processing"]
        elif plan == PlanType.LIFETIME:
            return base_features + ["fast_reading", "text_extract", "tahweel", "watermark_edit", "remove_security", "pro_stats", "sync", "batch_processing", "priority_support", "beta_access"]
        
        return base_features

subscription_service = SubscriptionService()
