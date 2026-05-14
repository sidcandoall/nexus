from pymongo import AsyncMongoClient
from app.config import settings

try:
    import certifi
except ImportError:
    certifi = None

client: AsyncMongoClient = None
db = None


def _int_env(name: str, default: int) -> int:
    raw = __import__("os").getenv(name, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        return default

async def connect_to_mongo():
    global client, db
    client_kwargs = {
        "serverSelectionTimeoutMS": _int_env("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 10000),
        "connectTimeoutMS": _int_env("MONGODB_CONNECT_TIMEOUT_MS", 10000),
        "socketTimeoutMS": _int_env("MONGODB_SOCKET_TIMEOUT_MS", 12000),
        "retryWrites": False,
    }

    if certifi is not None:
        client_kwargs["tlsCAFile"] = certifi.where()

    client = AsyncMongoClient(
        settings.MONGODB_URL,
        **client_kwargs,
    )
    db = client[settings.DATABASE_NAME]
    try:
        await client.admin.command("ping")
    except Exception:
        db = None

async def close_mongo_connection():
    global client
    if client:
        await client.close()

def get_db():
    return db