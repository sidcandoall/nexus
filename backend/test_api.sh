#!/bin/bash
# Quick test script for Mind Mirror backend
# Run: ./test_api.sh (while server is running)

BASE="http://127.0.0.1:8000"

echo "1. Testing root endpoint..."
curl -s "$BASE/" && echo "" || echo "FAILED"

echo ""
echo "2. Testing POST /journal (may take 15-30s on first run - model loading)..."
curl -s -X POST "$BASE/journal" \
  -H "Content-Type: application/json" \
  -d '{"mood": 4, "reflection": "I had a great day today!"}' | python3 -m json.tool 2>/dev/null || echo "Check if server is running: uvicorn app.main:app --port 8000"
