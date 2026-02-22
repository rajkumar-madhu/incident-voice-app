from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse
from services.cache_service import check_redis
from db.postgres import check_connection
from models.embedding_model import embedding_model
from utils.metrics import get_metrics, get_content_type, embedding_model_loaded

router = APIRouter()

@router.get("/health")
async def health():
    redis_ok = await check_redis()
    db_ok = await check_connection()
    model_ok = embedding_model.is_loaded
    embedding_model_loaded.set(1 if model_ok else 0)

    all_ok = redis_ok and db_ok and model_ok
    status = "healthy" if all_ok else "degraded"

    return JSONResponse(
        content={"status": status, "checks": {"database": db_ok, "redis": redis_ok, "embedding_model": model_ok}},
        status_code=200 if all_ok else 503,
    )

@router.get("/health/live")
async def liveness():
    return {"status": "alive"}

@router.get("/health/ready")
async def readiness():
    redis_ok = await check_redis()
    db_ok = await check_connection()
    model_ok = embedding_model.is_loaded

    if redis_ok and db_ok and model_ok:
        return {"status": "ready"}
    return JSONResponse(
        content={"status": "not ready", "database": db_ok, "redis": redis_ok, "model": model_ok},
        status_code=503,
    )

@router.get("/metrics")
async def metrics():
    return Response(content=get_metrics(), media_type=get_content_type())
