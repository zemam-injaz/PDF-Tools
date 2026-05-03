from datetime import datetime
from enum import Enum
from pydantic import BaseModel
from typing import Optional

class PlanType(str, Enum):
    FREE = "free"
    TRIAL = "trial"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    LIFETIME = "lifetime"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class Subscription(BaseModel):
    subscription_id: str
    user_id: str
    plan_type: PlanType
    trial_started_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    paid_until: Optional[datetime] = None
    payment_method: Optional[str] = None
    status: SubscriptionStatus
    features_enabled: list[str] = []
