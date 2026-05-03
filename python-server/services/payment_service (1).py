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
        Handle PayMob Webhook
        """
        # Verify HMAC signature here...
        
        success = data.get("success", False)
        if success:
            # Extract info
            order_id = data.get("order_id")
            # In a real webhook, we might pass user_id in 'merchant_order_id' or 'billing_data'
            # Here we assume we can map order_id to user or we get it from metadata
            
            # For this mock, let's assume 'data' contains 'user_id' and 'plan_id' directly
            # which we will inject in our mock gateway
            user_id = data.get("user_id")
            plan_id = data.get("plan_id")
            
            if user_id and plan_id:
                self._fulfill_order(user_id, plan_id)
                return True
        
        return False

    def _fulfill_order(self, user_id: str, plan_id: str):
        print(f"Fulfilling order for {user_id} - {plan_id}")
        # Map plan_id to PlanType
        plan_map = {
            "monthly": PlanType.MONTHLY,
            "yearly": PlanType.YEARLY,
            "lifetime": PlanType.LIFETIME
        }
        
        plan_type = plan_map.get(plan_id)
        if not plan_type:
            print(f"Unknown plan: {plan_id}")
            return

        # Update subscription logic
        # For simplify, just update status. 
        # In real world: Calculate expiry based on plan_type.
        
        # update Status to ACTIVE and Plan to NEW PLAN
        # and set expiry
        
        # For now, simplistic update via sql directly or service method?
        # SubscriptionService should have a method "upgrade_subscription"
        
        # We'll update the subscription directly for now using private method valid here as we are on backend
        conn = subscription_service._get_conn()
        cursor = conn.cursor()
        
        now = datetime.now()
        paid_until = None
        if plan_type == PlanType.MONTHLY:
            paid_until = now + datetime.timedelta(days=30)
        elif plan_type == PlanType.YEARLY:
            paid_until = now + datetime.timedelta(days=365)
        # Lifetime: paid_until = None or very far future
        
        cursor.execute(
            '''UPDATE subscriptions 
               SET plan_type = ?, status = ?, paid_until = ?, updated_at = ? 
               WHERE user_id = ?''',
            (plan_type.value, SubscriptionStatus.ACTIVE.value, paid_until, now, user_id)
        )
        conn.commit()
        conn.close()

payment_service = PaymentService()
