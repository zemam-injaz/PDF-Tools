from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from services.gumroad_service import gumroad_service

router = APIRouter(prefix="/api/payment/gumroad", tags=["Payment"])


class GumroadStartRequest(BaseModel):
    user_id: str
    plan_id: str


class GumroadActivateRequest(BaseModel):
    user_id: str
    license_key: str
    plan_id: Optional[str] = None
    email: Optional[str] = None


@router.post("/start")
def gumroad_start(request: GumroadStartRequest):
    """Return the Gumroad product URL for the requested plan.

    The plan_id only selects WHICH Gumroad product to open. The final plan is
    determined server-side from the verified Gumroad purchase, never from the
    client.
    """
    if not gumroad_service.is_configured():
        raise HTTPException(status_code=503, detail="Gumroad is not configured on the server")
    try:
        return {"status": "success", "data": gumroad_service.get_product_url(request.plan_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activate")
def gumroad_activate(request: GumroadActivateRequest):
    """Bind a verified Gumroad license to the Warraq user and activate the plan.

    The server verifies the license against Gumroad using the server-side token
    (the desktop never sees Gumroad secrets). Idempotent per user + license.
    """
    try:
        result = gumroad_service.activate(
            request.user_id,
            request.license_key,
            request.plan_id,
            request.email,
        )
        return {"status": "success", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def gumroad_webhook(request: Request):
    """Gumroad event signal (sale/refund/cancellation).

    This endpoint NEVER fulfills an order. It only triggers a server-side
    re-verification against the Gumroad License API, so a spoofed webhook
    cannot grant anything — the signed entitlement is always driven by the
    real Gumroad response.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        return gumroad_service.handle_webhook(data)
    except Exception as e:
        print(f"[GUMROAD][WEBHOOK] error: {e}", flush=True)
        return {"status": "error", "detail": str(e)}