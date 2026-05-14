# Backend Pre-Push Checklist

Use this checklist before pushing backend changes.

## 1) Activate environment

```bash
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend
source ../.venv/bin/activate
```

## 2) Run tests

```bash
python -m unittest -v tests/test_model_integration.py tests/test_finetune_pipeline.py
```

## 3) API smoke test (start + test + stop in one command)

```bash
PYTHONPATH="/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend" \
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >/tmp/mind_mirror_uvicorn.log 2>&1 & SERVER_PID=$!; \
sleep 3; \
curl -s http://127.0.0.1:8000/; echo; \
curl -s -X POST http://127.0.0.1:8000/api/checkin -H "Content-Type: application/json" -d '{"mood":4,"reflection":"I had a productive and calm day"}'; echo; \
curl -s http://127.0.0.1:8000/api/sentiment-summary; echo; \
kill $SERVER_PID; wait $SERVER_PID 2>/dev/null || true
```

## 4) Model file checks (Git LFS)

```bash
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1
git lfs install
git lfs track "backend/models/*.zip"
git add .gitattributes
git lfs ls-files
```

Expected tracked model path:

- `backend/models/mood_model.zip`

## 5) Commit and push

```bash
find . -type d -name "__pycache__" -prune -exec rm -rf {} +
find . -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete
git add .
git commit -m "Your commit message"
git push
```
