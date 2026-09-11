"""Gumroad License/Purchase integration for Warraq.

Architecture:
    Warraq Desktop → Warraq Remote API → Gumroad (server-side verify)
                                   ↓
                       Subscription (SQLite)
                                   ↓
               Signed Ed25519 Entitlement → Desktop

Rules enforced here:
  - The DESKTOP never holds Gumroad secrets (access token lives in server env).
  - The Gumroad license is NOT the final entitlement — it is a purchase proof
    used by the Warraq remote API to drive the subscription.
  - Gumroad is consulted server-side on activation and periodically on
    re-verification, so refunds/cancellations revoke the entitlement.
  - License binding is idempotent per user and unique per license.
"""
import os
import uuid
import sqlite3
from datetime import datetime, timedelta

import requests
from fastapi import HTTPException

from services.subscription_service import subscription_service
from models.subscription import PlanType, SubscriptionStatus


def _verify_url() -> str:
    return os.environ.get(
        "GUMROAD_VERIFY_URL", "https://api.gumroad.com/v2/licenses/verify"
    )


def _token() -> str:
    return os.environ.get("GUMROAD_ACCESS_TOKEN", "").strip()


def _products() -> dict:
    return {
        "monthly":  os.environ.get("GUMROAD_PRODUCT_MONTHLY", "warraq-monthly"),
        "annual":   os.environ.get("GUMROAD_PRODUCT_ANNUAL", "warraq-annual"),
        "lifetime": os.environ.get("GUMROAD_PRODUCT_LIFETIME", "warraq-lifetime"),
    }


def _reverify_cooldown_seconds() -> int:
    return int(os.environ.get("GUMROAD_REVERIFY_COOLDOWN_SECONDS", "43200"))


# Plan durations (days) — must stay in sync with payment_service.PLAN_PRICING.
_PLAN_DURATION_DAYS = {
    "monthly": 30,
    "annual": 365,
    "lifetime": 36500,
}


class GumroadService:
    def __init__(self):
        self._init_table()

    # ── DB ───────────────────────────────────────────────────────────────────

    def _conn(self):
        return subscription_service._get_conn()

    def _init_table(self):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS gumroad_licenses (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                license_key TEXT UNIQUE,
                sale_id TEXT,
                product_id TEXT,
                product_permalink TEXT,
                plan_type TEXT,
                currency TEXT,
                amount INTEGER,
                status TEXT,
                activated_at TIMESTAMP,
                last_verified_at TIMESTAMP,
                updated_at TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    # ── Public helpers ──────────────────────────────────────────────────────

    def is_configured(self) -> bool:
        return bool(_token())

    def canonical_plan(self, plan_id: str) -> str:
        if plan_id in _products():
            return plan_id
        if plan_id == "yearly":
            return "annual"
        raise HTTPException(status_code=400, detail=f"Unknown plan_id: {plan_id}")

    def get_product_url(self, plan_id: str) -> dict:
        plan = self.canonical_plan(plan_id)
        permalink = _products()[plan]
        return {
            "plan_id": plan,
            "product_permalink": permalink,
            "payment_url": f"https://gumroad.com/l/{permalink}",
        }

    # ── Gumroad calls (server-side, token never leaves the server) ──────────

    def _verify_license(self, permalink: str, license_key: str) -> dict:
        resp = requests.post(
            _verify_url(),
            data={
                "access_token": _token(),
                "product_permalink": permalink,
                "license_key": license_key,
                "increment_uses_count": "false",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    def _find_license(self, license_key: str, prefer_plan: str | None = None):
        """Tries each configured product until the license verifies.
        Returns (permalink, plan_id, purchase) or None."""
        products = _products()
        order = products.keys()
        if prefer_plan is not None:
            try:
                preferred = self.canonical_plan(prefer_plan)
                order = [preferred, *[p for p in order if p != preferred]]
            except HTTPException:
                order = products.keys()

        for plan in order:
            permalink = products[plan]
            result = self._verify_license(permalink, license_key)
            if result.get("success") and result.get("purchase"):
                return permalink, plan, result["purchase"]
        return None

    # ── Revocation conditions from a Gumroad purchase ───────────────────────

    def _purchase_revoked(self, purchase: dict) -> bool:
        if purchase.get("refunded"):
            return True
        if purchase.get("disputed") and not purchase.get("dispute_won"):
            return True
        for field in ("subscription_ended_at", "subscription_cancelled_at", "subscription_failed_at"):
            if purchase.get(field):
                return True
        return False

    # ── Activation ──────────────────────────────────────────────────────────

    def activate(self, user_id: str, license_key: str, plan_id: str | None = None, email: str | None = None) -> dict:
        if not self.is_configured():
            raise HTTPException(status_code=503, detail="Gumroad is not configured on the server")

        license_key = (license_key or "").strip()
        if not license_key:
            raise HTTPException(status_code=400, detail="license_key is required")

        found = self._find_license(license_key, plan_id)
        if found is None:
            raise HTTPException(status_code=400, detail="Invalid Gumroad license key")

        permalink, plan, purchase = found

        if self._purchase_revoked(purchase):
            raise HTTPException(status_code=402, detail="This purchase has been refunded or cancelled")

        if email and email.strip().lower() != str(purchase.get("email", "")).strip().lower():
            raise HTTPException(status_code=403, detail="Email does not match the Gumroad purchase")

        sale_id = str(purchase.get("id") or purchase.get("sale_id") or "")
        product_id = str(purchase.get("product_id") or "")
        amount = int(purchase.get("price") or 0)
        currency = str(purchase.get("currency") or "").upper()

        # Idempotent binding: a license key can be bound to exactly one Warraq user.
        existing = self._get_license_by_key(license_key)
        if existing is not None:
            if existing["user_id"] != user_id:
                raise HTTPException(status_code=409, detail="This license is already activated on another device")
            # Same user → idempotent re-activation: refresh the subscription below.
        else:
            self._insert_license(user_id, license_key, sale_id, product_id, permalink, plan, currency, amount)
            # Re-check after insert (guards the rare concurrent-activation race).
            bound = self._get_license_by_key(license_key)
            if bound is None or bound["user_id"] != user_id:
                raise HTTPException(status_code=409, detail="This license is already activated on another device")

        self._set_subscription_plan(user_id, plan)

        self._touch_license(license_key, user_id)

        return {
            "status": "success",
            "activated": True,
            "plan_id": plan,
            "sale_id": sale_id,
            "user_id": user_id,
        }

    # ── Periodic re-verification (drives refund/cancellation revocation) ────

    def maybe_reverify(self, user_id: str, force: bool = False):
        if not self.is_configured():
            return
        license = self._get_active_license_for_user(user_id)
        if license is None:
            return

        if not force:
            last = license["last_verified_at"]
            if last:
                last_dt = self._parse_dt(last)
                if last_dt and (datetime.now() - last_dt).total_seconds() < _reverify_cooldown_seconds():
                    return

        try:
            result = self._verify_license(license["product_permalink"], license["license_key"])
        except requests.RequestException:
            # Transient network failure — keep current entitlement, retry later.
            return

        if not result.get("success") or self._purchase_revoked(result.get("purchase", {})):
            self._revoke(user_id, license["license_key"])
            return

        self._touch_license(license["license_key"], user_id)

    # ── Webhook signal (never fulfills — always re-verifies against Gumroad) ─

    def handle_webhook(self, data: dict):
        if not self.is_configured():
            return {"status": "ignored"}

        license_key = str(data.get("license_key") or "")
        sale_id = str(data.get("sale_id") or data.get("sale") and data["sale"].get("id") or "")

        row = None
        if license_key:
            row = self._get_license_by_key(license_key)
        elif sale_id:
            row = self._get_license_by_sale(sale_id)

        if row is None:
            return {"status": "ignored"}

        self.maybe_reverify(row["user_id"], force=True)
        return {"status": "ok"}

    # ── DB helpers ──────────────────────────────────────────────────────────

    def _get_license_by_key(self, license_key: str):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM gumroad_licenses WHERE license_key = ?", (license_key,))
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None

    def _get_license_by_sale(self, sale_id: str):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM gumroad_licenses WHERE sale_id = ?", (sale_id,))
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None

    def _get_active_license_for_user(self, user_id: str):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM gumroad_licenses WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
            (user_id,),
        )
        row = cur.fetchone()
        conn.close()
        return dict(row) if row else None

    def _insert_license(self, user_id, license_key, sale_id, product_id, permalink, plan, currency, amount):
        now = datetime.now()
        conn = self._conn()
        cur = conn.cursor()
        try:
            cur.execute(
                """INSERT INTO gumroad_licenses
                   (id, user_id, license_key, sale_id, product_id, product_permalink,
                    plan_type, currency, amount, status, activated_at, last_verified_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
                (str(uuid.uuid4()), user_id, license_key, sale_id, product_id, permalink,
                 plan, currency, amount, now, now, now),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            conn.rollback()
        finally:
            conn.close()

    def _touch_license(self, license_key, user_id):
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE gumroad_licenses SET last_verified_at = ?, updated_at = ? WHERE license_key = ? AND user_id = ?",
            (datetime.now(), datetime.now(), license_key, user_id),
        )
        conn.commit()
        conn.close()

    def _set_subscription_plan(self, user_id: str, plan: str):
        days = _PLAN_DURATION_DAYS[plan]
        plan_type = {
            "monthly": PlanType.MONTHLY,
            "annual": PlanType.YEARLY,
            "lifetime": PlanType.LIFETIME,
        }[plan]
        now = datetime.now()
        paid_until = now + timedelta(days=days)

        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            """UPDATE subscriptions
               SET plan_type = ?, status = ?, paid_until = ?, access_until = ?, updated_at = ?, last_verified_at = ?
               WHERE user_id = ?""",
            (plan_type.value, SubscriptionStatus.ACTIVE.value, paid_until, paid_until, now, now, user_id),
        )
        if cur.rowcount == 0:
            cur.execute(
                """INSERT INTO subscriptions
                   (subscription_id, user_id, plan_type, status, paid_until, access_until, updated_at, last_verified_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (str(uuid.uuid4()), user_id, plan_type.value, SubscriptionStatus.ACTIVE.value,
                 paid_until, paid_until, now, now),
            )
        conn.commit()
        conn.close()

    def _revoke(self, user_id: str, license_key: str):
        now = datetime.now()
        conn = self._conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE gumroad_licenses SET status = 'revoked', updated_at = ? WHERE license_key = ?",
            (now, license_key),
        )
        cur.execute(
            "UPDATE subscriptions SET status = ?, access_until = ?, paid_until = ?, updated_at = ? WHERE user_id = ?",
            (SubscriptionStatus.EXPIRED.value, now, now, now, user_id),
        )
        conn.commit()
        conn.close()

    def _parse_dt(self, val):
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(str(val))
        except ValueError:
            return None


gumroad_service = GumroadService()