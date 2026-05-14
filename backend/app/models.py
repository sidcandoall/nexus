"""
Pydantic models for journal entries and API schemas.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class JournalEntryCreate(BaseModel):
    """Request body for creating a journal entry."""

    mood: int = Field(..., ge=0, le=5, description="Mood rating from 0 (low) to 5 (high)")
    reflection: Optional[str] = Field(default="", description="Optional short reflection text")


class JournalEntryResponse(BaseModel):
    """Response model for a journal entry with sentiment analysis."""

    id: str
    mood: int
    reflection: str
    sentiment: str
    confidence: float
    suggestion: str
    predicted_mood: float
    created_at: datetime


class SentimentCount(BaseModel):
    """Count for one sentiment label."""

    sentiment: str
    count: int


class SentimentSummaryResponse(BaseModel):
    """Aggregated sentiment summary across journal entries."""

    total_entries: int
    counts: list[SentimentCount]
