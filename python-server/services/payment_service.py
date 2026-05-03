import requests
import json
from datetime import datetime, timedelta
from services.subscription_service import subscription_service
from models.subscription import SubscriptionStatus, PlanType

# PayMob Configuration (Load from env in real app)
PAYMOB_API_KEY = "mock_key"
PAYMOB_INTEGRATION_ID_EGYPT = "123"
PAYMOB_INTEGRATION_ID_SA = "456"

class PaymentService:
    def create_checkout_session(self, user_id: str, plan_id: str, price_amount: float, currency: str = "EGP"):
        """
        Creates a payment link via PayMob (Mocked for now).
        In real implementation:
        1. Auth tokens
        2. Order registration
        3. Payment Key request
        4. Return iframe URL
        """
        mock_payment_url = f"http://localhost:8002/api/payment/mock-gateway?user_id={user_id}&plan={plan_id}"
        
        return {
            "payment_url": mock_payment_url,
            "order_id": f"ord_{int(datetime.now().timestamp())}"
        }

    def process_webhook(self, data: dict):
        """
        Handle Payment Webhook (e.g. PayMob, Stripe)
        """
        # 1. Signature Verification (Essential for Production)
        # 2. Extract Status
        
        # PayMob style: success key in data
        success = data.get("success") or data.get("obj", {}).get("success")
        
        if success:
            # Extract User and Plan (In real PayMob, use 'extra_step_company_id' or custom metadata)
            user_id = data.get("user_id") or data.get("obj", {}).get("metadata", {}).get("user_id")
            plan_id = data.get("plan_id") or data.get("obj", {}).get("metadata", {}).get("plan_id")
            
            if user_id and plan_id:
                return self._fulfill_order(user_id, plan_id)
        
        return False

    def _fulfill_order(self, user_id: str, plan_id: str):
        """
        Finalizes the subscription update in the database
        """
        print(f"💰 [PAYMENT] Fulfilling order: User={user_id}, Plan={plan_id}")
        
        plan_map = {
            "monthly": (PlanType.MONTHLY, 30),
            "yearly": (PlanType.YEARLY, 365),
            "lifetime": (PlanType.LIFETIME, 36500) # ~100 years
        }
        
        if plan_id not in plan_map:
            print(f"❌ [PAYMENT] Unknown plan ID: {plan_id}")
            return False

        plan_type, days = plan_map[plan_id]
        
        conn = subscription_service._get_conn()
        try:
            cursor = conn.cursor()
            now = datetime.now()
            
            plan_type, days = plan_map[plan_id]
            paid_until = now + timedelta(days=days)
            
            cursor.execute(
                '''UPDATE subscriptions 
                   SET plan_type = ?, status = ?, paid_until = ?, updated_at = ? 
                   WHERE user_id = ?''',
                (plan_type.value, SubscriptionStatus.ACTIVE.value, paid_until, now, user_id)
            )
            conn.commit()
            print(f"✅ [PAYMENT] Subscription activated until {paid_until}")
            return True
        except Exception as e:
            print(f"❌ [PAYMENT] Database error during fulfillment: {e}")
            return False
        finally:
            conn.close()

payment_service = PaymentService()
