# Journal Sentiment Fine-Tuning

This folder contains a minimal training pipeline to adapt DistilBERT to your journal sentiment data.

## Input format

Use `.jsonl`, `.json`, or `.csv` with:

- `reflection`: journal text
- `sentiment`: one of `POSITIVE`, `NEUTRAL`, `NEGATIVE`

A tiny starter dataset is included at `tests/pipeline/sample_journal_data.jsonl`.

## Quick run

```bash
cd backend
source ../.venv/bin/activate
python tests/pipeline/fine_tune_journal_sentiment.py \
  --train-file tests/pipeline/sample_journal_data.jsonl \
  --output-dir tests/pipeline/mood_sentiment_model \
  --zip-output tests/pipeline/mood_sentiment_model.zip
```

## Use in backend

Set these values in `backend/.env`:

```bash
SENTIMENT_USE_REMOTE_MODEL=false
SENTIMENT_USE_LOCAL_ZIP_MODEL=true
SENTIMENT_LOCAL_MODEL_ZIP=/absolute/path/to/mood_sentiment_model.zip
SENTIMENT_USE_REMOTE_FALLBACK=true
```

The backend will try your zip model first, then built-in local model, then remote fallback.
