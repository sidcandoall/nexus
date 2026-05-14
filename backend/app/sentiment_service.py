"""
Sentiment analysis service using Hugging Face transformers.
Analyzes journal reflection text and returns sentiment label and confidence score.
"""

import os
import importlib
import zipfile
from pathlib import Path
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")

from typing import Any

import httpx


# Lazy-load pipeline to avoid loading model at import time
_sentiment_pipeline = None
_zip_model_bundle = None
_zip_model_load_error: str | None = None

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_LOCAL_MODEL_ZIP = str(BACKEND_DIR / "models" / "mood_model.zip")
DEFAULT_LOCAL_MODEL_EXTRACT_DIR = str(BACKEND_DIR / "models" / ".extracted")


def _normalize_label(raw_label: str | None) -> str:
    """Normalize model labels into POSITIVE/NEGATIVE/NEUTRAL."""
    if not raw_label:
        return "NEUTRAL"
    label = raw_label.upper().strip()
    if label in ("POSITIVE", "POS"):
        return "POSITIVE"
    if label in ("NEGATIVE", "NEG"):
        return "NEGATIVE"
    if label in ("NEUTRAL",):
        return "NEUTRAL"
    if "POS" in label:
        return "POSITIVE"
    if "NEG" in label:
        return "NEGATIVE"
    return "NEUTRAL"


def _parse_remote_result(payload: Any) -> tuple[str, float]:
    """Parse common remote inference payload shapes into label + score."""
    if isinstance(payload, dict):
        if "label" in payload and "score" in payload:
            return _normalize_label(payload.get("label")), float(payload.get("score", 0.0))
        if "results" in payload:
            return _parse_remote_result(payload["results"])

    if isinstance(payload, list) and payload:
        first = payload[0]
        if isinstance(first, dict) and "label" in first and "score" in first:
            best = max(payload, key=lambda item: float(item.get("score", 0.0)))
            return _normalize_label(best.get("label")), float(best.get("score", 0.0))
        if isinstance(first, list):
            return _parse_remote_result(first)

    return "NEUTRAL", 0.0


def _analyze_remote(text: str) -> tuple[str, float]:
    """Call remote hosted model endpoint for sentiment inference."""
    remote_url = os.getenv("SENTIMENT_REMOTE_URL", "").strip()
    if not remote_url:
        raise RuntimeError("SENTIMENT_REMOTE_URL is not set")

    api_key = os.getenv("SENTIMENT_REMOTE_API_KEY", "").strip()
    timeout_seconds = float(os.getenv("SENTIMENT_REMOTE_TIMEOUT", "20"))
    text_field = os.getenv("SENTIMENT_REMOTE_TEXT_FIELD", "inputs").strip() or "inputs"
    payload = {text_field: text}

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(remote_url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    return _parse_remote_result(data)


def _resolve_zip_model_dir() -> Path | None:
    """Resolve and (if needed) extract a local zipped model, returning model dir path."""
    zip_path_raw = os.getenv("SENTIMENT_LOCAL_MODEL_ZIP", DEFAULT_LOCAL_MODEL_ZIP).strip()
    if not zip_path_raw:
        return None

    zip_path = Path(zip_path_raw).expanduser()
    if not zip_path.is_absolute():
        zip_path = (BACKEND_DIR / zip_path).resolve()
    if not zip_path.exists() or not zip_path.is_file():
        return None

    extract_root = Path(
        os.getenv("SENTIMENT_LOCAL_MODEL_EXTRACT_DIR", DEFAULT_LOCAL_MODEL_EXTRACT_DIR).strip()
        or DEFAULT_LOCAL_MODEL_EXTRACT_DIR
    ).expanduser()
    if not extract_root.is_absolute():
        extract_root = (BACKEND_DIR / extract_root).resolve()
    extract_root.mkdir(parents=True, exist_ok=True)

    expected_dir = extract_root / "mood_regression_model"
    expected_config = expected_dir / "config.json"
    if expected_config.exists():
        return expected_dir

    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(extract_root)

    if expected_config.exists():
        return expected_dir

    candidate_dirs = [item for item in extract_root.iterdir() if item.is_dir() and (item / "config.json").exists()]
    if candidate_dirs:
        return candidate_dirs[0]
    return None


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _get_max_length() -> int:
    """Token max length for inference (lower = faster, with less context)."""
    raw = os.getenv("SENTIMENT_MAX_LENGTH", "256").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 256
    return max(32, min(512, value))


def _get_zip_model_bundle():
    """Load local zipped mood model tokenizer + model once."""
    global _zip_model_bundle, _zip_model_load_error
    if _zip_model_bundle is not None:
        return _zip_model_bundle

    if _zip_model_load_error is not None:
        return None

    model_dir = _resolve_zip_model_dir()
    if model_dir is None:
        _zip_model_load_error = "Model directory unavailable"
        return None

    try:
        transformers = importlib.import_module("transformers")
        torch = importlib.import_module("torch")
        tokenizer = transformers.AutoTokenizer.from_pretrained(str(model_dir), local_files_only=True)
        model = transformers.AutoModelForSequenceClassification.from_pretrained(
            str(model_dir),
            local_files_only=True,
        )
        model.eval()
        _zip_model_bundle = {
            "tokenizer": tokenizer,
            "model": model,
            "torch": torch,
        }
        return _zip_model_bundle
    except Exception as error:
        _zip_model_load_error = str(error)
        return None


def _analyze_zip_model(text: str) -> tuple[str, float]:
    """Infer sentiment from zipped regression or classification model."""
    bundle = _get_zip_model_bundle()
    if bundle is None:
        raise RuntimeError("Local zipped model unavailable")

    tokenizer = bundle["tokenizer"]
    model = bundle["model"]
    torch = bundle["torch"]

    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=_get_max_length())
    with torch.no_grad():
        outputs = model(**inputs)

    logits = outputs.logits

    if logits.shape[-1] == 1:
        raw_score = float(logits.squeeze().item())
        mood_score = _clamp(raw_score, 0.0, 5.0)

        if mood_score >= 3.0:
            label = "POSITIVE"
        elif mood_score <= 2.0:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"

        confidence = _clamp(abs(mood_score - 2.5) / 2.5, 0.0, 1.0)
        return label, confidence

    probabilities = torch.softmax(logits, dim=-1).squeeze(0)
    predicted_index = int(torch.argmax(probabilities).item())
    confidence = float(probabilities[predicted_index].item())
    raw_label = model.config.id2label.get(predicted_index, str(predicted_index))
    label = _normalize_label(raw_label)
    if label == "NEUTRAL" and raw_label == str(predicted_index):
        index_to_label = {0: "NEGATIVE", 1: "NEUTRAL", 2: "POSITIVE"}
        label = index_to_label.get(predicted_index, "NEUTRAL")
    return label, _clamp(confidence, 0.0, 1.0)


def _get_pipeline():
    """Get or create the sentiment-analysis pipeline (lazy loading)."""
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        pipeline = importlib.import_module("transformers").pipeline

        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
        )
    return _sentiment_pipeline


def _analyze_local(text: str) -> tuple[str, float]:
    """Run sentiment inference using the local Hugging Face model."""
    prefer_zip = os.getenv("SENTIMENT_USE_LOCAL_ZIP_MODEL", "true").lower() == "true"
    if prefer_zip:
        try:
            return _analyze_zip_model(text)
        except Exception:
            pass

    pipe = _get_pipeline()
    result = pipe(text)
    if not result:
        raise RuntimeError("Local sentiment model returned no result")
    label = _normalize_label(result[0].get("label"))
    score = float(result[0].get("score", 0.0))
    return label, score


def warmup_sentiment_model() -> None:
    """Warm up configured sentiment model so first user request is faster."""
    warmup_text = os.getenv("SENTIMENT_WARMUP_TEXT", "Today was okay")
    analyze_sentiment(warmup_text)


def analyze_sentiment(text: str) -> tuple[str, float]:
    """
    Analyze sentiment of input text using a pretrained NLP model.

    Args:
        text: The journal reflection text to analyze.

    Returns:
        Tuple of (sentiment_label, confidence_score).
        - sentiment_label: "POSITIVE" or "NEGATIVE"
        - confidence_score: Float between 0 and 1
    """
    if not text or not text.strip():
        return "NEUTRAL", 0.0

    # Character trim to avoid excessively large payloads
    text_truncated = text.strip()[:2000]
    use_remote_primary = os.getenv("SENTIMENT_USE_REMOTE_MODEL", "false").lower() == "true"
    use_remote_fallback = os.getenv("SENTIMENT_USE_REMOTE_FALLBACK", "true").lower() == "true"

    if use_remote_primary:
        try:
            label, score = _analyze_remote(text_truncated)
        except Exception:
            try:
                label, score = _analyze_local(text_truncated)
            except Exception:
                label, score = "NEUTRAL", 0.0
    else:
        try:
            label, score = _analyze_local(text_truncated)
        except Exception:
            if use_remote_fallback:
                try:
                    label, score = _analyze_remote(text_truncated)
                except Exception:
                    label, score = "NEUTRAL", 0.0
            else:
                label, score = "NEUTRAL", 0.0

    label = _normalize_label(label)

    # Fix: model often misses negations (e.g. "didn't have a good day" → wrong POSITIVE)
    negation_patterns = [
        "don't feel", "didn't feel", "don't think", "didn't think",
        "not happy", "not good", "not great", "not well",
        "didn't have a good", "didn't have a great", "don't have a good",
        "nothing good", "nothing great", "nothing positive",
        "can't feel", "cannot feel", "won't feel",
        "isn't good", "isn't great", "aren't good",
        "wasn't good", "wasn't great", "weren't good",
        "never feel", "never felt", "no longer",
        "not as good", "not feeling", "not doing well",
        "bad day", "terrible day", "awful day", "horrible day",
        "feel bad", "feeling bad", "felt bad",
    ]
    text_lower_check = text_truncated.lower()
    if label == "POSITIVE" and any(np in text_lower_check for np in negation_patterns):
        label = "NEGATIVE"
        score = max(0.6, 1 - score)

    return label, score


# Themes for NEGATIVE sentiment only (avoid matching "good" in "not good")
_NEGATIVE_THEMES = [
    (["stress", "stressed", "overwhelm", "overwhelmed", "pressure", "pressured"], "stress", "feeling stressed or overwhelmed"),
    (["anxious", "anxiety", "worry", "worried", "nervous"], "anxiety", "feeling anxious or worried"),
    (["sad", "sadness", "down", "low", "depressed", "hopeless"], "low_mood", "feeling low or down"),
    (["tired", "exhausted", "drained", "burnout", "burned out"], "tired", "feeling tired or exhausted"),
    (["lonely", "alone", "isolated", "miss", "missing"], "loneliness", "feeling lonely or missing someone"),
    (["work", "job", "deadline", "project", "boss", "colleague", "meeting"], "work", "work-related pressures"),
    (["sleep", "slept", "insomnia"], "sleep", "sleep or rest"),
    (["family", "parent", "kids", "husband", "wife", "relationship"], "relationships", "relationships or family"),
    (["confused", "uncertain", "unsure", "stuck", "lost"], "uncertainty", "feeling uncertain or stuck"),
    (["angry", "frustrated", "annoyed", "irritated"], "frustration", "frustration or irritation"),
]
# Themes for POSITIVE sentiment only
_POSITIVE_THEMES = [
    (["grateful", "gratitude", "thankful", "blessed", "lucky"], "gratitude", "gratitude"),
    (["accomplish", "achieved", "progress", "finished", "completed"], "accomplishment", "what you accomplished"),
    (["excited", "happy", "amazing", "wonderful"], "positive", "positive moments"),
]


def _extract_theme(text_lower: str, sentiment: str) -> tuple[str | None, str | None]:
    """
    Analyze text for themes. Only returns themes that match the sentiment.
    E.g. for NEGATIVE text, never return "positive" theme (avoids "good" in "not good").
    """
    themes = _NEGATIVE_THEMES if sentiment in ("NEGATIVE", "NEUTRAL") else _POSITIVE_THEMES
    for keywords, theme_key, phrase in themes:
        if any(kw in text_lower for kw in keywords):
            return theme_key, phrase
    return None, None


def get_suggestion(text: str, sentiment: str, mood: int) -> str:
    """
    Analyze the reflection text and generate feedback directly based on what was written.
    Uses themes, sentiment, and content to give meaningful, text-specific suggestions.
    """
    text_lower = (text or "").lower().strip()
    if not text_lower:
        return "Your reflection still matters. Take a moment to write when you're ready."

    theme_key, detected_phrase = _extract_theme(text_lower, sentiment)

    # Build feedback that references what they wrote
    if sentiment == "POSITIVE":
        if theme_key == "gratitude":
            return "Noting what you're grateful for can strengthen positive patterns. Consider revisiting this list on harder days."
        if theme_key == "accomplishment":
            return "Celebrating progress helps. Keep building on what's working—you're making real strides."
        if theme_key == "positive":
            return "Sounds like a good day. Remembering moments like this can help during tougher times."
        return "Your reflection shows a positive mindset. Keep nurturing these patterns—they matter."

    elif sentiment == "NEGATIVE":
        if theme_key == "stress" or theme_key == "anxiety":
            return "You sound stressed or anxious. Try one small grounding activity—a few deep breaths, a short walk, or a quick check-in with someone you trust—and see how you feel after."
        if theme_key == "low_mood":
            return "It sounds like you're going through a low moment. Reaching out to someone you trust or doing one gentle thing you enjoy can help. Be kind to yourself."
        if theme_key == "tired":
            return "You mention feeling tired or drained. Rest matters—even short breaks or an early night can help. Consider what one small step would support you right now."
        if theme_key == "loneliness":
            return "You wrote about feeling lonely or missing someone. A quick message, call, or plan with a friend can help. Small connections often matter more than we expect."
        if theme_key == "work":
            return "Work pressure can be heavy. Try picking one small priority, taking a short break, and breaking tasks into manageable steps. Progress adds up."
        if theme_key == "sleep":
            return "Sleep and rest affect everything. A wind-down routine, less screen time before bed, or an earlier night might help. Small changes can make a difference."
        if theme_key == "relationships":
            return "Relationships can be tricky. Writing helps. Consider sharing a bit of what you feel with someone you trust, or give yourself space to process first."
        if theme_key == "uncertainty":
            return "Feeling uncertain or stuck is normal. Focus on one small next step, or talk it through with someone. Clarity often comes in smaller pieces."
        if theme_key == "frustration":
            return "Frustration and irritation are valid. A short walk, some quiet time, or naming what's bothering you can help ease the tension."
        if detected_phrase:
            return f"You wrote about {detected_phrase}. It's okay to feel this way. Try one small thing that usually helps—a walk, a talk, or something you enjoy—and check in with yourself again."
        return "You sound a bit low right now. Try one small grounding activity and check in again later. Your reflection matters."

    else:
        if detected_phrase:
            return f"Your reflection touches on {detected_phrase}. Adding a bit more about how you feel can help surface useful insights next time."
        return "Every reflection counts. Writing a bit more when you're ready can deepen the insights and suggestions."
