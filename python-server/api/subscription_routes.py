from fastapi import APIRouter, HTTPException, Header
from models.user import User
from models.subscription import Subscription
from models.requests import DeviceAuthRequest
from services.subscription_service import subscription_service
from services.entitlement_signing import entitlement_signer
from services.gumroad_service import gumroad_service

router = APIRouter(prefix="/api/subscription", tags=["Subscription"])

def _iso(dt):
    return dt.isoformat() if dt else None

def _entitlement_payload(user: User, sub: Subscription) -> dict:
    payload = {
        "user_id": user.user_id,
        "entitlement": sub.entitlement,
        "plan_type": sub.plan_type,
        "status": sub.status,
        "access_until": _iso(sub.access_until),
        "last_verified_at": _iso(sub.last_verified_at),
        "grace_until": _iso(sub.grace_until),
        "features_enabled": sub.features_enabled,
    }
    payload["signature"] = entitlement_signer.sign(payload)
    return payload


def _sub_with_gumroad_reverify(user_id: str) -> Subscription:
    """Return the user's subscription, re-checking Gumroad status if they have
    an active Gumroad license (refunds/cancellations revoke within the cooldown
    window)."""
    gumroad_service.maybe_reverify(user_id)
    return subscription_service.get_subscription(user_id)

@router.post("/auth/device")
def device_auth(request: DeviceAuthRequest):
    """Authenticate or register a device (an entitlement read → renews grace)."""
    try:
        user = subscription_service.get_or_create_user(request.device_id)
        subscription_service.verify_access(user.user_id)
        sub = _sub_with_gumroad_reverify(user.user_id)
        return {
            "status": "success",
            "data": {
                "user": user,
                "subscription": _entitlement_payload(user, sub)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_status(x_device_id: str = Header(None)):
    """Get subscription status for current device (an entitlement read → renews grace)."""
    if not x_device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-ID header")

    try:
        user = subscription_service.get_or_create_user(x_device_id)
        subscription_service.verify_access(user.user_id)
        sub = _sub_with_gumroad_reverify(user.user_id)
        return {"status": "success", "data": _entitlement_payload(user, sub)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify")
def verify_entitlement(x_device_id: str = Header(None)):
    """Verify entitlement — the explicit verification call that renews the offline
    grace window and returns a signed entitlement for the offline cache."""
    if not x_device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-ID header")

    try:
        user = subscription_service.get_or_create_user(x_device_id)
        subscription_service.verify_access(user.user_id)
        sub = _sub_with_gumroad_reverify(user.user_id)
        return {"status": "success", "data": _entitlement_payload(user, sub)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/public-key")
def public_key():
    """Exposes the entitlement signing public key (dev/bootstrap only)."""
    return {"status": "success", "data": {"public_key": entitlement_signer.public_key_b64}}