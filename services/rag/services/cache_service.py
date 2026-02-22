import redis.asyncio as redis
import structlog
from typing import Optional
from config import settings

logger = structlog.get_logger(service="rag")

_redis_client: Optional[redis.Redis] = None

async def get_redis_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client

async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection closed")

async def check_redis() -> bool:
    try:
        client = await get_redis_client()
        await client.ping()
        return True
    except Exception:
        return False

async def cache_get(key: str) -> Optional[str]:
    try:
        client = await get_redis_client()
        return await client.get(key)
    except Exception as e:
        logger.error("Redis cache get error", error=str(e))
        return None

async def cache_set(key: str, value: str, ttl: Optional[int] = None) -> bool:
    try:
        client = await get_redis_client()
        await client.setex(key, ttl or settings.cache_ttl_seconds, value)
        return True
    except Exception as e:
        logger.error("Redis cache set error", error=str(e))
        return False
