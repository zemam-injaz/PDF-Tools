from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import uuid4

class Annotation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    book_id: str
    page: int
    type: str  # 'text' | 'dot' | 'timestamp'
    x: float  # Normalized (0.0-1.0)
    y: float  # Normalized (0.0-1.0)
    data: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
