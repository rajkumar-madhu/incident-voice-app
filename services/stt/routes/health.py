from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from services.cache_service import check_redis
from models.whisper_model import whisper_model
from utils.metrics import get_metrics, get_content_type, model_loaded

router = APIRouter()

@router.get("/health")
async def health():
    redis_ok = await check_redis()
    model_ok = whisper_model.is_loaded
    model_loaded.set(1 if model_ok else 0)

    status = "healthy" if redis_ok and model_ok else "degraded"
    status_code = 200 if status == "healthy" else 503

    return JSONResponse(
        content={"status": status, "checks": {"redis": redis_ok, "model": model_ok}},
        status_code=status_code,
    )

@router.get("/health/live")
async def liveness():
    return {"status": "alive"}

@router.get("/health/ready")
async def readiness():
    redis_ok = await check_redis()
    model_ok = whisper_model.is_loaded

    if redis_ok and model_ok:
        return {"status": "ready"}
    return JSONResponse(
        content={"status": "not ready", "redis": redis_ok, "model": model_ok},
        status_code=503,
    )

@router.get("/metrics")
async def metrics():
    return Response(
        content=get_metrics(),
        media_type=get_content_type(),
    )
