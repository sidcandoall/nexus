import logging
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.database import get_db
from app.services.sentiment_service import analyze_sentiment, get_suggestion

logger = logging.getLogger(__name__)

_memory_store: list[dict] = []
_db_unavailable_until: float = 0.0
_FALLBACK_FILE = Path(__file__).resolve().parents[2] / "data" / "checkins_fallback.json"


def _ensure_fallback_dir() -> None:
    _FALLBACK_FILE.parent.mkdir(parents=True, exist_ok=True)


def _serialize_entry(entry: dict) -> dict:
    created_at = entry.get("created_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    payload = dict(entry)
    payload["created_at"] = created_at
    return payload


def _deserialize_entry(entry: dict) -> dict:
    payload = dict(entry)
    created_at = payload.get("created_at")
    if isinstance(created_at, str):
        try:
            payload["created_at"] = datetime.fromisoformat(created_at)
        except ValueError:
            payload["created_at"] = datetime.now(timezone.utc)
    elif created_at is None:
        payload["created_at"] = datetime.now(timezone.utc)
    return payload


def _read_fallback_entries() -> list[dict]:
    _ensure_fallback_dir()
    if not _FALLBACK_FILE.exists():
        return []

    try:
        raw = json.loads(_FALLBACK_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    if not isinstance(raw, list):
        return []
    return [_deserialize_entry(item) for item in raw if isinstance(item, dict)]


def _write_fallback_entries(entries: list[dict]) -> None:
    _ensure_fallback_dir()
    serializable = [_serialize_entry(item) for item in entries]
    _FALLBACK_FILE.write_text(json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8")


def _append_fallback_entry(entry: dict) -> None:
    entries = _read_fallback_entries()
    entries.insert(0, dict(entry))
    _write_fallback_entries(entries)


def _db_cooldown_seconds() -> float:
    raw = os.getenv("MONGODB_UNAVAILABLE_COOLDOWN_SECONDS", "30").strip()
    try:
        value = float(raw)
    except ValueError:
        value = 30.0
    return max(0.0, value)


def _should_try_db() -> bool:
    return time.monotonic() >= _db_unavailable_until


def _mark_db_unavailable() -> None:
    global _db_unavailable_until
    _db_unavailable_until = time.monotonic() + _db_cooldown_seconds()


def _predict_mood_score(sentiment: str, confidence: float) -> float:
    if sentiment == "POSITIVE":
        score = 3.5 + confidence * 1.5
    elif sentiment == "NEGATIVE":
        score = 2.0 - confidence * 1.5
    else:
        score = 2.5
    return round(max(0.0, min(5.0, score)), 1)


def _normalize_confidence(confidence: float) -> float:
    return round(max(0.0, min(1.0, float(confidence))), 4)

async def create_checkin(
        mood: int, 
        reflection: Optional[str] = None
) -> dict:
    reflection_text = (reflection or "").strip()
    sentiment, confidence = analyze_sentiment(reflection_text)
    confidence = _normalize_confidence(confidence)
    suggestion = get_suggestion(reflection_text, sentiment, mood)
    predicted_mood = _predict_mood_score(sentiment, confidence)

    db = get_db()
    checkin_data = {
        "mood": mood,
        "reflection": reflection_text,
        "sentiment": sentiment,
        "confidence": confidence,
        "suggestion": suggestion,
        "predicted_mood": predicted_mood,
        "created_at": datetime.now(timezone.utc)
    }

    if db is not None and _should_try_db():
        try:
            result = await db.checkins.insert_one(checkin_data)
            checkin_data["id"] = str(result.inserted_id)
            return checkin_data
        except Exception:
            _mark_db_unavailable()

    checkin_data["id"] = str(uuid.uuid4())
    checkin_data["_id"] = checkin_data["id"]
    _memory_store.append(checkin_data)
    _append_fallback_entry(checkin_data)
    return checkin_data


async def get_sentiment_summary() -> tuple[int, dict[str, int]]:
    db = get_db()
    if db is not None and _should_try_db():
        try:
            docs = await db.checkins.find({}, {"sentiment": 1}).to_list(length=None)
            counts: dict[str, int] = {}
            for doc in docs:
                sentiment = str(doc.get("sentiment", "UNKNOWN"))
                counts[sentiment] = counts.get(sentiment, 0) + 1

            total_entries = len(docs)
            return total_entries, counts
        except Exception:
            _mark_db_unavailable()

    fallback_entries = _read_fallback_entries() or _memory_store

    counts: dict[str, int] = {}
    for item in fallback_entries:
        sentiment = str(item.get("sentiment", "UNKNOWN"))
        counts[sentiment] = counts.get(sentiment, 0) + 1
    total_entries = int(sum(counts.values()))
    return total_entries, counts


async def get_past_entries(limit: int = 200) -> list[dict]:
    db = get_db()
    if db is not None and _should_try_db():
        try:
            docs = await db.checkins.find({}, sort=[("created_at", -1)]).limit(limit).to_list(length=limit)
            entries: list[dict] = []
            for doc in docs:
                entries.append(
                    {
                        "id": str(doc.get("_id", "")),
                        "mood": int(doc.get("mood", 0)),
                        "reflection": str(doc.get("reflection", "") or ""),
                        "sentiment": str(doc.get("sentiment", "NEUTRAL")),
                        "confidence": float(doc.get("confidence", 0.0)),
                        "suggestion": str(doc.get("suggestion", "") or ""),
                        "predicted_mood": float(doc.get("predicted_mood", 0.0)),
                        "created_at": doc.get("created_at"),
                    }
                )
            return entries
        except Exception:
            _mark_db_unavailable()

    fallback_source = _read_fallback_entries() or _memory_store
    fallback = sorted(
        fallback_source,
        key=lambda item: item.get("created_at", datetime.now(timezone.utc)),
        reverse=True,
    )[:limit]
    return [
        {
            "id": str(item.get("_id") or item.get("id") or ""),
            "mood": int(item.get("mood", 0)),
            "reflection": str(item.get("reflection", "") or ""),
            "sentiment": str(item.get("sentiment", "NEUTRAL")),
            "confidence": float(item.get("confidence", 0.0)),
            "suggestion": str(item.get("suggestion", "") or ""),
            "predicted_mood": float(item.get("predicted_mood", 0.0)),
            "created_at": item.get("created_at"),
        }
        for item in fallback
    ]

