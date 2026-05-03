from fastapi import APIRouter, HTTPException, Header
from models.user import User
from models.subscription import Subscription
from models.requests import DeviceAuthRequest
from services.subscription_service import subscription_service

router = APIRouter(prefix="/api/subscription", tags=["Subscription"])

@router.post("/auth/device")
def device_auth(request: DeviceAuthRequest):
    """Authenticate or register a device"""
    try:
        user = subscription_service.get_or_create_user(request.device_id)
        sub = subscription_service.get_subscription(user.user_id)
        return {
            "status": "success",
            "data": {
                "user": user,
                "subscription": sub
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_status(x_device_id: str = Header(None)):
    """Get subscription status for current device"""
    if not x_device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-ID header")
    
    try:
        user = subscription_service.get_or_create_user(x_device_id) 
        sub = subscription_service.get_subscription(user.user_id)
        return {"status": "success", "data": sub}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
