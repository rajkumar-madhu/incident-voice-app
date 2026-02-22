import asyncpg
import structlog
from typing import Optional
from config import settings

logger = structlog.get_logger(service="rag")

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=20,
            command_timeout=30,
        )
        # Register pgvector extension
        async with _pool.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await conn.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        logger.info("PostgreSQL pool created")
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL pool closed")

async def check_connection() -> bool:
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception:
        return False
