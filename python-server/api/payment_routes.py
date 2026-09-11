from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from services.payment_service import payment_service
import os
import hmac
import hashlib

router = APIRouter(prefix="/api/payment", tags=["Payment"])

class CheckoutRequest(BaseModel):
    user_id: str
    plan_id: str
    currency: str = "EGP"

@router.post("/checkout")
def create_checkout(request: CheckoutRequest):
    """Create a payment link.

    The server derives the amount from plan_id (see payment_service.PLAN_PRICING);
    the client never supplies a price.
    """
    try:
        result = payment_service.create_checkout_session(
            request.user_id, request.plan_id, request.currency
        )
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def payment_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle webhook from payment gateway with HMAC-SHA512 signature validation.

    FAIL CLOSED: in production (ENVIRONMENT=production), a missing PAYMOB_HMAC_SECRET
    rejects every webhook. There is no mock/bypass path in production.
    """
    environment = os.environ.get("ENVIRONMENT", "").strip().lower()
    hmac_secret = os.environ.get("PAYMOB_HMAC_SECRET", "")

    if not hmac_secret and environment == "production":
        print("[WEBHOOK] PRODUCTION + missing PAYMOB_HMAC_SECRET — rejecting webhook (fail closed).", flush=True)
        raise HTTPException(status_code=403, detail="Webhook rejected: PAYMOB_HMAC_SECRET not configured")

    if hmac_secret:
        # PayMob sends HMAC-SHA512 hash in the HTTP_HMAC header
        incoming_hmac = request.headers.get("HTTP_HMAC", "")
        raw_body = await request.body()

        expected = hmac.new(
            hmac_secret.encode("utf-8"),
            raw_body,
            hashlib.sha512
        ).hexdigest()

        if not hmac.compare_digest(expected, incoming_hmac):
            print("[WEBHOOK] HMAC signature mismatch — rejecting request.", flush=True)
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

        try:
            import json
            data = json.loads(raw_body)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
    else:
        # No secret configured and NOT production — dev/mock mode only.
        print("[WEBHOOK] WARNING: PAYMOB_HMAC_SECRET not set (non-production). Skipping signature check (mock mode).", flush=True)
        try:
            data = await request.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        # Process in background
        background_tasks.add_task(payment_service.process_webhook, data)
        return {"status": "success"}
    except Exception as e:
        # PayMob expects 200 OK on success
        print(f"Webhook Error: {e}")
        return {"status": "error", "detail": str(e)}


# Mock Gateway Endpoint — development/test only. Never reachable in production.
@router.get("/mock-gateway", response_class=HTMLResponse)
def mock_gateway(user_id: str, plan_id: str):
    """
    Simulates a payment page.

    In production this route returns 404: the mock gateway can never fulfill a
    subscription. (The real PayMob webhook is additionally HMAC-protected.)
    """
    if os.environ.get("ENVIRONMENT", "").strip().lower() == "production":
        raise HTTPException(status_code=404, detail="Not found")
    html_content = f"""
    <html>
        <head>
            <title>Mock Payment Gateway</title>
            <style>
                body {{ font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0; }}
                .card {{ background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }}
                button {{ background: #4F46E5; color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer; font-size: 1rem; margin-top: 1rem; }}
                button:hover {{ background: #4338ca; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Mock Payment</h2>
                <p>User: {user_id}</p>
                <p>Plan: {plan_id}</p>
                <button onclick="confirmPayment()">Confirm Payment (Success)</button>
            </div>
            <script>
                function confirmPayment() {{
                    // Call webhook locally (unique event_id + transaction_id for idempotency)
                    var evtId = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                    var txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                    fetch('/api/payment/webhook', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{
                            success: true,
                            obj: {{ id: txnId }},
                            event_id: evtId,
                            transaction_id: txnId,
                            order_id: 'mock_order_' + Date.now(),
                            user_id: '{user_id}',
                            plan_id: '{plan_id}'
                        }})
                    }}).then(() => {{
                        alert('Payment Successful! You can close this window.');
                        window.close();
                    }});
                }}
            </script>
        </body>
    </html>
    """
    return html_content
