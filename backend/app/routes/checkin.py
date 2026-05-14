import logging

from fastapi import APIRouter, status

from app.schemas.checkin import (
    CheckinRequest,
    CheckinResponse,
    PastEntriesResponse,
    PastEntryResponse,
    SentimentCount,
    SentimentSummaryResponse,
)
from app.services.checkin import create_checkin, get_past_entries, get_sentiment_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["checkin"])

@router.post(
    "/checkin", 
    response_model=CheckinResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Create a new check-in",
)
async def submit_checkin(
    checkin: CheckinRequest,
):
    doc = await create_checkin(
        mood=checkin.mood,
        reflection=checkin.reflection,
    )

    return CheckinResponse(
        id=doc["id"],
        mood=doc["mood"],
        reflection=doc.get("reflection"),
        sentiment=doc["sentiment"],
        confidence=doc["confidence"],
        suggestion=doc["suggestion"],
        predicted_mood=doc["predicted_mood"],
        created_at=doc["created_at"],
    )


@router.get(
    "/sentiment-summary",
    response_model=SentimentSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get sentiment summary",
)
async def sentiment_summary():
    total_entries, counts_map = await get_sentiment_summary()
    counts = [
        SentimentCount(sentiment=sentiment, count=count)
        for sentiment, count in sorted(counts_map.items(), key=lambda item: item[0])
    ]
    return SentimentSummaryResponse(total_entries=total_entries, counts=counts)


@router.get(
    "/checkins",
    response_model=PastEntriesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get past check-ins",
)
async def past_checkins():
    entries = await get_past_entries()
    return PastEntriesResponse(
        entries=[
            PastEntryResponse(
                id=entry["id"],
                mood=entry["mood"],
                reflection=entry["reflection"],
                sentiment=entry["sentiment"],
                confidence=entry["confidence"],
                suggestion=entry["suggestion"],
                predicted_mood=entry["predicted_mood"],
                created_at=entry["created_at"],
            )
            for entry in entries
        ]
    )

