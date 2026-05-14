#!/usr/bin/env python3
"""Test MongoDB connection - run: python tests/test_mongodb.py"""
import os
from dotenv import load_dotenv

load_dotenv()

uri = (os.getenv("MONGODB_URI") or os.getenv("MONGODB_URL") or "").strip()
database_name = (os.getenv("MONGODB_DATABASE") or os.getenv("DATABASE_NAME") or "mind_mirror").strip()
collection_name = "checkins"

if not uri:
    print("ERROR: MONGODB_URI (or MONGODB_URL) not set in .env")
    exit(1)

display_uri = uri
if "@" in uri:
    parts = uri.split("@")
    user_part = parts[0].split("//")[-1]
    if ":" in user_part:
        user = user_part.split(":")[0]
        display_uri = f"mongodb+srv://{user}:****@..." + parts[1].split("/")[-1].split("?")[0]
print(f"Testing: {display_uri}\n")

try:
    import certifi
    from pymongo import MongoClient

    client_kwargs = {
        "serverSelectionTimeoutMS": int(os.getenv("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000")),
    }
    client_kwargs["tlsCAFile"] = certifi.where()

    client = MongoClient(uri, **client_kwargs)
    client.admin.command("ping")
    db = client[database_name]
    coll = db[collection_name]
    count = coll.count_documents({})

    print("SUCCESS: Connected to team MongoDB!")
    print(f"Database: {database_name}, Collection: {collection_name}")
    print(f"Existing entries: {count}")
except Exception as e:
    print(f"FAILED: {e}")
    print("\nTo fix:")
    print("1. Copy .env.example to .env and set MONGODB_URI + MONGODB_DATABASE")
    print("2. Ensure Atlas IP Access List allows your network")
    print("3. Ensure Atlas username/password are correct")
    print("4. If password has @, URL-encode it as %40")
    exit(1)
