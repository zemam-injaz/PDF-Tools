from pydantic import BaseModel

class DeviceAuthRequest(BaseModel):
    device_id: str
    platform: str = "unknown"

class UpgradeRequest(BaseModel):
    user_id: str
    plan_ids: str
