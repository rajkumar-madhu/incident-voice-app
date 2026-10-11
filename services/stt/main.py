from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from middleware.error_handler import http_exception_handler, generic_exception_handler
from middleware.logging_middleware import LoggingMiddleware
from routes.health import router as health_router
from routes.transcription import router as transcription_router
from models.whisper_model import whisper_model
from services.cache_service import close_redis
from utils.metrics import model_loaded
from config import settings
import structlog
import uvicorn

logger = structlog.get_logger(service="stt")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting STT service", port=settings.port, device=settings.stt_whisper_device)

    loaded = await whisper_model.load()
    model_loaded.set(1 if loaded else 0)

    if not loaded:
        logger.warning("STT service started without model - transcription will return 503")

    yield

    # Shutdown
    logger.info("Shutting down STT service")
    await close_redis()
    logger.info("STT service shutdown complete")

app = FastAPI(
    title="WeCrew STT Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# Middleware
app.add_middleware(LoggingMiddleware)

# Routes
app.include_router(health_router)
app.include_router(transcription_router)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        log_level=settings.log_level,
    )
