from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from middleware.error_handler import http_exception_handler, generic_exception_handler
from middleware.logging_middleware import LoggingMiddleware
from routes.health import router as health_router
from routes.retrieval import router as retrieval_router
from routes.documents import router as documents_router
from models.embedding_model import embedding_model
from db.postgres import get_pool, close_pool
from services.cache_service import close_redis
from utils.metrics import embedding_model_loaded
from config import settings
import structlog
import uvicorn

logger = structlog.get_logger(service="rag")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting RAG service", port=settings.port)

    # Initialize database pool and run migrations
    pool = await get_pool()
    async with pool.acquire() as conn:
        import os
        migration_path = os.path.join(os.path.dirname(__file__), "db", "migrations", "001_rag_schema.sql")
        if os.path.exists(migration_path):
            with open(migration_path) as f:
                await conn.execute(f.read())
            logger.info("Database migration applied")

    # Load embedding model
    loaded = await embedding_model.load()
    embedding_model_loaded.set(1 if loaded else 0)

    if not loaded:
        logger.warning("RAG service started without embedding model")

    yield

    logger.info("Shutting down RAG service")
    await close_pool()
    await close_redis()
    logger.info("RAG service shutdown complete")

app = FastAPI(title="LinkedEye RAG Service", version="1.0.0", lifespan=lifespan)

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_middleware(LoggingMiddleware)

app.include_router(health_router)
app.include_router(retrieval_router)
app.include_router(documents_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, log_level=settings.log_level)
