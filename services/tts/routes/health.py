from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from services.cache_service import check_redis
from models.indicf5_model import indicf5_model
from models.piper_model import piper_model
from utils.metrics import get_metrics, get_content_type, engine_available

router = APIRouter()

@router.get("/health")
async def health():
    redis_ok = await check_redis()
    indicf5_ok = indicf5_model.is_loaded
    piper_ok = piper_model.is_loaded
    any_engine = indicf5_ok or piper_ok

    engine_available.labels(engine="indicf5").set(1 if indicf5_ok else 0)
    engine_available.labels(engine="piper").set(1 if piper_ok else 0)

    status = "healthy" if redis_ok and any_engine else "degraded"
    status_code = 200 if status == "healthy" else 503

    return JSONResponse(
        content={"status": status, "checks": {"redis": redis_ok, "indicf5": indicf5_ok, "piper": piper_ok}},
        status_code=status_code,
    )

@router.get("/health/live")
async def liveness():
    return {"status": "alive"}

@router.get("/health/ready")
async def readiness():
    redis_ok = await check_redis()
    any_engine = indicf5_model.is_loaded or piper_model.is_loaded

    if redis_ok and any_engine:
        return {"status": "ready"}
    return JSONResponse(
        content={"status": "not ready", "redis": redis_ok, "engines": any_engine},
        status_code=503,
    )

@router.get("/metrics")
async def metrics():
    return Response(content=get_metrics(), media_type=get_content_type())
