# Mind Mirror Backend

AI-powered emotional check-in API with sentiment analysis and MongoDB storage.

For full local run/push steps, see: `../LOCAL_DEPLOYMENT_MANUAL.md`.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and set your MongoDB URI:

```bash
cp .env.example .env
# Edit .env with your team MongoDB credentials
```

Verify MongoDB connectivity before starting the API:

```bash
python tests/test_mongodb.py
```

By default, startup enforces Atlas usage (`MONGODB_REQUIRE_ATLAS=true`).
If `MONGODB_URI` is missing or not `mongodb+srv://...`, backend startup fails fast with a clear error.
For temporary local-only development, set `MONGODB_REQUIRE_ATLAS=false` in `.env`.

### Use your local `mood_model.zip` (primary local model)

The backend can load your zipped local model first, then fall back to the built-in local model, then optional remote endpoint.

```bash
SENTIMENT_USE_REMOTE_MODEL=false
SENTIMENT_USE_LOCAL_ZIP_MODEL=true
SENTIMENT_LOCAL_MODEL_ZIP=models/mood_model.zip
SENTIMENT_LOCAL_MODEL_EXTRACT_DIR=models/.extracted
SENTIMENT_USE_REMOTE_FALLBACK=true
```

For GitHub pushes, track `backend/models/mood_model.zip` with Git LFS (required for large model files).

```bash
git lfs install
git lfs track "backend/models/*.zip"
git add .gitattributes
```

Before committing, remove Python runtime cache files if they were generated locally:

```bash
find . -type d -name "__pycache__" -prune -exec rm -rf {} +
find . -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete
```

### Improve response speed

If first response feels slow, enable preload and reduce token length:

```bash
SENTIMENT_PRELOAD_ON_STARTUP=true
SENTIMENT_MAX_LENGTH=256
```

You can lower `SENTIMENT_MAX_LENGTH` further (e.g. `192`) for faster inference.
Tradeoff: less text context for sentiment prediction.

If each request is slow when MongoDB is unavailable, use fast DB-fallback settings:

```bash
MONGODB_SERVER_SELECTION_TIMEOUT_MS=1200
MONGODB_CONNECT_TIMEOUT_MS=1200
MONGODB_SOCKET_TIMEOUT_MS=2000
MONGODB_UNAVAILABLE_COOLDOWN_SECONDS=30
```

This avoids repeated long DB waits on every request and quickly uses in-memory fallback.

### Use a remotely hosted sentiment model (optional)

By default, the backend uses the local model `distilbert-base-uncased-finetuned-sst-2-english`.
You can also enable automatic remote fallback when local inference fails.

Local primary + remote fallback:

```bash
SENTIMENT_USE_REMOTE_MODEL=false
SENTIMENT_USE_REMOTE_FALLBACK=true
SENTIMENT_REMOTE_URL=https://your-model-endpoint.example.com/infer
SENTIMENT_REMOTE_API_KEY=your_optional_token
SENTIMENT_REMOTE_TIMEOUT=20
SENTIMENT_REMOTE_TEXT_FIELD=inputs
```

Remote primary (optional):

```bash
SENTIMENT_USE_REMOTE_MODEL=true
SENTIMENT_USE_REMOTE_FALLBACK=true
SENTIMENT_REMOTE_URL=https://your-model-endpoint.example.com/infer
SENTIMENT_REMOTE_API_KEY=your_optional_token
SENTIMENT_REMOTE_TIMEOUT=20
SENTIMENT_REMOTE_TEXT_FIELD=inputs
```

Expected response shape from remote endpoint should include sentiment label and score, such as:

```json
{"label": "POSITIVE", "score": 0.98}
```

or:

```json
[{"label": "POSITIVE", "score": 0.98}, {"label": "NEGATIVE", "score": 0.02}]
```

## Run

```bash
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## API Endpoints

### POST /journal

Create a journal entry with mood rating and optional reflection. Sentiment analysis runs automatically.

**Request:**
```json
{
  "mood": 4,
  "reflection": "I had a great day at work today!"
}
```

**Response:**
```json
{
  "id": "...",
  "mood": 4,
  "reflection": "I had a great day at work today!",
  "sentiment": "POSITIVE",
  "confidence": 0.998,
  "created_at": "2026-03-18T..."
}
```

### GET /api/sentiment-summary

Returns aggregated sentiment counts across saved entries.

**Response:**
```json
{
  "total_entries": 3,
  "counts": [
    {"sentiment": "NEGATIVE", "count": 1},
    {"sentiment": "POSITIVE", "count": 2}
  ]
}
```

## Tests

Run model integration + fallback tests:

```bash
python -m unittest -v tests/test_model_integration.py
```

Run fine-tuning pipeline utility tests:

```bash
python -m unittest -v tests/test_finetune_pipeline.py
```

## Fine-Tune on Journal Data

Train a sentiment model on your own journal dataset and export a zip model:

```bash
python tests/pipeline/fine_tune_journal_sentiment.py \
  --train-file tests/pipeline/sample_journal_data.jsonl \
  --output-dir tests/pipeline/mood_sentiment_model \
  --zip-output tests/pipeline/mood_sentiment_model.zip
```

Then set `SENTIMENT_LOCAL_MODEL_ZIP` in `backend/.env` to the generated zip path.
More details: `tests/pipeline/README.md`.

## Sprint 1 Tasks (Sanket - AI Generalist)

- [x] Install Hugging Face transformers
- [x] Implement sentiment service function
- [x] Integrate model in POST/journal flow
- [x] Store sentiment + confidence in DB
