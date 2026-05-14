from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

class CheckinRequest(BaseModel):
    mood: int = Field(..., ge=0, le=5, description="Mood score from 0 (worst) to 5 (best)")
    reflection: Optional[str] = Field(
        None,
        max_length=5000,
        description="Optional free-text reflection about how you feel",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "mood": 4,
                    "reflection": "Had a productive day and enjoyed a walk outside.",
                }
            ]
        }
    }

class CheckinResponse(BaseModel):
    id: str
    mood: int
    reflection: Optional[str] = None
    sentiment: str
    confidence: float
    suggestion: str
    predicted_mood: float
    created_at: datetime

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "id": "64b8f0c2e1a2b3c4d5e6f7g",
                    "mood": 4,
                    "reflection": "Had a productive day and enjoyed a walk outside.",
                    "sentiment": "POSITIVE",
                    "confidence": 0.9987,
                    "suggestion": "Your reflection shows a positive mindset. Keep nurturing these patterns—they matter.",
                    "predicted_mood": 4.8,
                    "created_at": "2024-06-19T12:34:56Z"
                }
            ]
        }
    }


class SentimentCount(BaseModel):
    sentiment: str
    count: int


class SentimentSummaryResponse(BaseModel):
    total_entries: int
    counts: list[SentimentCount]


class PastEntryResponse(BaseModel):
    id: str
    mood: int
    reflection: str
    sentiment: str
    confidence: float
    suggestion: str
    predicted_mood: float
    created_at: datetime


class PastEntriesResponse(BaseModel):
    entries: list[PastEntryResponse]