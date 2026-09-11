import requests
import json
import os
import hashlib
from datetime import datetime, timedelta
from fastapi import HTTPException
from services.subscription_service import subscription_service
from models.subscription import SubscriptionStatus, PlanType

# PayMob Configuration (Load from env in real app)
PAYMOB_API_KEY = os.environ.get("PAYMOB_API_KEY", "mock_key")
PAYMOB_INTEGRATION_ID_EGYPT = os.environ.get("PAYMOB_INTEGRATION_ID_EGYPT", "123")
PAYMOB_INTEGRATION_ID_SA = os.environ.get("PAYMOB_INTEGRATION_ID_SA", "456")

# Server-controlled pricing: the amount is ALWAYS derived here, never trusted
# from the client. plan_id → (plan_type, duration_days, price_by_currency).
# "annual" is the canonical id; "yearly" is accepted as an alias.
_PLAN_DEFS = {
    "monthly":  {"plan": PlanType.MONTHLY, "days": 30,    "prices": {"EGP": 49, "SAR": 12}},
    "annual":   {"plan": PlanType.YEARLY,  "days": 365,   "prices": {"EGP": 299, "SAR": 72}},
    "lifetime": {"plan": PlanType.LIFETIME, "days": 36500, "prices": {"EGP": 899, "SAR": 220}},
}
PLAN_PRICING = {**_PLAN_DEFS, "yearly": _PLAN_DEFS["annual"]}


def _is_production() -> bool:
    return os.environ.get("ENVIRONMENT", "").strip().lower() == "production"


def _paymob_configured() -> bool:
    key = os.environ.get("PAYMOB_API_KEY", "").strip()
    return bool(key) and key != "mock_key"


class PaymentService:
    def get_plan_price(self, plan_id: str, currency: str = "EGP") -> dict:
        """Returns the server-side plan definition for a plan_id, or None if unknown."""
        plan = PLAN_PRICING.get(plan_id)
        if plan is None:
            raise HTTPException(status_code=400, detail=f"Unknown plan_id: {plan_id}")
        amount = plan["prices"].get(currency.upper())
        if amount is None:
            raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")
        return {"plan_id": plan_id, "amount": amount, "currency": currency.upper(),
                "plan_type": plan["plan"], "days": plan["days"]}

    def create_checkout_session(self, user_id: str, plan_id: str, currency: str = "EGP"):
        """
        Creates a payment link via PayMob (Mocked for now).

        Amount is derived server-side from PLAN_PRICING — the client never
        supplies a price. In production the mock gateway is never reachable and
        checkout fails closed until the real PayMob integration is configured.
        """
        plan = self.get_plan_price(plan_id, currency)
        amount = plan["amount"]

        if _is_production():
            if not _paymob_configured():
                raise HTTPException(status_code=501, detail="Payment gateway is not configured yet")
            # TODO(PayMob): real flow — auth token → order → payment_key → iframe
            payment_url = f"https://accept.paymob.com/api/acceptance/iframes/{plan_id}"
        else:
            port = os.environ.get("PORT", "8002")
            payment_url = f"http://localhost:{port}/api/payment/mock-gateway?user_id={user_id}&plan={plan_id}"

        return {
            "payment_url": payment_url,
            "amount": amount,
            "currency": plan["currency"],
            "order_id": f"ord_{int(datetime.now().timestamp())}"
        }

    def process_webhook(self, data: dict):
        """
        Handle Payment Webhook (e.g. PayMob, Stripe).

        Idempotency: the same webhook event (provider_event_id) OR the same
        PayMob transaction (transaction_id) is processed exactly once.
        """
        provider = "paymob"
        obj = data.get("obj") or {}

        # 1. Extract event identity — never rely on a single absent field
        event_id = str(
            obj.get("id")
            or data.get("event_id")
            or data.get("order_id")
            or obj.get("order", {}).get("id")
            or "unknown"
        )
        transaction_id = str(
            data.get("transaction_id")
            or obj.get("id")
            or obj.get("order", {}).get("id")
            or event_id
        )

        success = bool(data.get("success") or obj.get("success"))
        user_id = data.get("user_id") or obj.get("metadata", {}).get("user_id")
        plan_id = data.get("plan_id") or obj.get("metadata", {}).get("plan_id")
        event_type = "payment_success" if success else "payment_failed"
        payload_hash = hashlib.sha256(
            json.dumps(data, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()

        # 2. Record event atomically — duplicate → no re-fulfillment
        recorded = subscription_service.record_payment_event(
            provider, event_id, event_type, user_id, transaction_id, payload_hash
        )
        if not recorded:
            print(f"[PAYMENT][DUP] [PAYMENT] Duplicate event/transaction ignored: event={event_id}, txn={transaction_id}")
            return {"handled": True, "duplicate": True}

        # 3. Only activate the entitlement on a successful, non-duplicate payment
        if success:
            if user_id and plan_id:
                return self._fulfill_order(user_id, plan_id)
            print(f"[PAYMENT][WARN] [PAYMENT] Success event without user/plan metadata: {event_id}")
            return {"handled": True, "event": event_type}

        # 4. Failed payment → record only, never activate
        print(f"[PAYMENT][WARN] [PAYMENT] Payment failed (recorded, not activated): {event_id}")
        return {"handled": True, "event": event_type}

    def _fulfill_order(self, user_id: str, plan_id: str):
        """
        Finalizes the subscription update in the database
        """
        print(f"[PAYMENT] [PAYMENT] Fulfilling order: User={user_id}, Plan={plan_id}")

        plan = PLAN_PRICING.get(plan_id)
        if plan is None:
            print(f"[PAYMENT][ERROR] [PAYMENT] Unknown plan ID: {plan_id}")
            return False

        plan_type, days = plan["plan"], plan["days"]

        conn = subscription_service._get_conn()
        try:
            cursor = conn.cursor()
            now = datetime.now()

            paid_until = now + timedelta(days=days)

            cursor.execute(
                '''UPDATE subscriptions
                   SET plan_type = ?, status = ?, paid_until = ?, access_until = ?, updated_at = ?, last_verified_at = ?
                   WHERE user_id = ?''',
                (plan_type.value, SubscriptionStatus.ACTIVE.value, paid_until, paid_until, now, now, user_id)
            )
            conn.commit()
            print(f"[PAYMENT][OK] [PAYMENT] Subscription activated until {paid_until}")
            return {"handled": True, "fulfilled": True}
        except Exception as e:
            print(f"[PAYMENT][ERROR] [PAYMENT] Database error during fulfillment: {e}")
            return False
        finally:
            conn.close()

payment_service = PaymentService()