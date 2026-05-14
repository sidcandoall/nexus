# Local Deployment Manual (Mind Mirror)

This guide helps you run the project locally on macOS/zsh before pushing to Git.

## 1) Prerequisites

- macOS with `zsh`
- Python 3.11+ (you are currently using a project venv)
- Node.js 18+
- npm
- (Optional, recommended) Git LFS for large model files

## 2) Project Paths

Workspace root used in this guide:

- `/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1`

Backend:

- `backend/`

Frontend:

- `frontend/`

Model zip (repo-local):

- `backend/models/mood_model.zip`

## 3) One-time Setup

### 3.1 Python environment + backend deps

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3.2 Frontend deps

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/frontend
npm install
```

### 3.3 Environment file

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend
cp .env.example .env
```

Ensure these values exist in `backend/.env`:

```dotenv
SENTIMENT_USE_REMOTE_MODEL=false
SENTIMENT_USE_LOCAL_ZIP_MODEL=true
SENTIMENT_LOCAL_MODEL_ZIP=models/mood_model.zip
SENTIMENT_LOCAL_MODEL_EXTRACT_DIR=models/.extracted
SENTIMENT_PRELOAD_ON_STARTUP=true
SENTIMENT_MAX_LENGTH=256
MONGODB_SERVER_SELECTION_TIMEOUT_MS=1200
MONGODB_CONNECT_TIMEOUT_MS=1200
MONGODB_SOCKET_TIMEOUT_MS=2000
MONGODB_UNAVAILABLE_COOLDOWN_SECONDS=30
```

## 4) Start Locally

## 4.1 Backend

From workspace root:

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1
source .venv/bin/activate
PYTHONPATH="/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend" \
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Backend URLs:

- Health: `http://127.0.0.1:8000/`
- API docs: `http://127.0.0.1:8000/docs`

## 4.2 Frontend (new terminal)

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:

- `http://127.0.0.1:5173/`

## 5) Quick Validation Before Push

## 5.1 Run tests

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend
/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/.venv/bin/python -m unittest -v tests/test_model_integration.py tests/test_finetune_pipeline.py
```

## 5.2 API smoke check (single command)

```zsh
PYTHONPATH="/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend" \
"/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >/tmp/mind_mirror_uvicorn.log 2>&1 & SERVER_PID=$!; \
sleep 3; \
echo "GET /"; curl -s http://127.0.0.1:8000/; echo; \
echo "POST /api/checkin"; curl -s -X POST http://127.0.0.1:8000/api/checkin -H "Content-Type: application/json" -d '{"mood":4,"reflection":"I had a productive and calm day"}'; echo; \
echo "GET /api/sentiment-summary"; curl -s http://127.0.0.1:8000/api/sentiment-summary; echo; \
kill $SERVER_PID; wait $SERVER_PID 2>/dev/null || true
```

## 5.3 Team sync check (confirm data is in shared Atlas cluster)

If a teammate cannot see entries in Atlas, run this checklist on their machine:

1. Confirm backend startup log contains `Connected to MongoDB` (not fallback warning).
2. Confirm `backend/.env` has the same `MONGODB_URI` cluster host and same `MONGODB_DATABASE` as the team.
3. Confirm teammate IP is allowed in Atlas Network Access.

Quick connection check:

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1
PYTHONPATH="/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend" \
"/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/.venv/bin/python" backend/tests/test_mongodb.py
```

Write a uniquely tagged entry through API:

```zsh
TAG="TEAM_SYNC_$(date +%s)"; echo "$TAG"
curl -s -X POST http://127.0.0.1:8000/api/checkin \
	-H "Content-Type: application/json" \
	-d "{\"mood\":4,\"reflection\":\"$TAG atlas verification entry\"}"
```

Then search the same `TAG` string in Atlas `mind_mirror.checkins` to verify both teammates are writing/reading the same shared cluster.

## 6) Model + Git Notes

Your model is configured to be repo-local:

- `backend/models/mood_model.zip`

Because model files are large, use Git LFS:

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1
git lfs install
git lfs track "backend/models/*.zip"
git add .gitattributes
git lfs ls-files
```

Expected tracked entry should include:

- `backend/models/mood_model.zip`

## 7) Common Issues

## Issue A: `ModuleNotFoundError: No module named 'app'`

Use `PYTHONPATH` when starting backend:

```zsh
PYTHONPATH="/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend" python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Issue B: Port already in use

```zsh
lsof -ti tcp:8000 | xargs -r kill -9
lsof -ti tcp:5173 | xargs -r kill -9
```

## Issue C: First prediction is slower

Expected due to model warmup. Subsequent requests should be much faster.

## Issue D: Every request is slow

Usually DB connectivity delay. Keep these low-timeout settings in `backend/.env`:

```dotenv
MONGODB_SERVER_SELECTION_TIMEOUT_MS=1200
MONGODB_CONNECT_TIMEOUT_MS=1200
MONGODB_SOCKET_TIMEOUT_MS=2000
MONGODB_UNAVAILABLE_COOLDOWN_SECONDS=30
```

## 8) Stop Local Servers

```zsh
pkill -f "uvicorn app.main:app --host 127.0.0.1 --port 8000"
pkill -f "vite --host 127.0.0.1 --port 5173"
```

## 9) Pre-push Suggested Flow

```zsh
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/backend
/Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1/.venv/bin/python -m unittest -v tests/test_model_integration.py tests/test_finetune_pipeline.py
cd /Users/krishnasiddharth/Downloads/2026S-Nexus-feature-sentiment-sprint1
find . -type d -name "__pycache__" -prune -exec rm -rf {} +
find . -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete
git status
git add .
git commit -m "your message"
git push
```
