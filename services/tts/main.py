from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from middleware.error_handler import http_exception_handler, generic_exception_handler
from middleware.logging_middleware import LoggingMiddleware
from routes.health import router as health_router
from routes.synthesis import router as synthesis_router
from routes.personas import router as personas_router
from models.indicf5_model import indicf5_model
from models.piper_model import piper_model
from services.persona_service import load_personas
from services.cache_service import close_redis
from utils.metrics import engine_available
from config import settings
import structlog
import uvicorn

logger = structlog.get_logger(service="tts")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TTS service", port=settings.port)

    # Load personas
    load_personas()

    # Load TTS engines
    indicf5_loaded = await indicf5_model.load()
    piper_loaded = await piper_model.load()

    engine_available.labels(engine="indicf5").set(1 if indicf5_loaded else 0)
    engine_available.labels(engine="piper").set(1 if piper_loaded else 0)

    if not indicf5_loaded and not piper_loaded:
        logger.warning("No TTS engines available - synthesis will return 503")

    yield

    logger.info("Shutting down TTS service")
    await close_redis()
    logger.info("TTS service shutdown complete")

app = FastAPI(title="WeCrew TTS Service", version="1.0.0", lifespan=lifespan)

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)
app.add_middleware(LoggingMiddleware)

app.include_router(health_router)
app.include_router(synthesis_router)
app.include_router(personas_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, log_level=settings.log_level)
