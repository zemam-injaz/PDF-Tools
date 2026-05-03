from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    user_id: str
    device_id: str
    created_at: datetime
    last_seen: datetime
    email: Optional[str] = None
