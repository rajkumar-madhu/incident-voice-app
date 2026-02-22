from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger(service="rag")

async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = request.headers.get("x-request-id")
    if exc.status_code >= 500:
        logger.error("Request error", status_code=exc.status_code, detail=exc.detail, request_id=request_id)
    else:
        logger.warning("Request error", status_code=exc.status_code, detail=exc.detail, request_id=request_id)

    body = {"error": exc.detail if isinstance(exc.detail, dict) else {"code": "ERROR", "message": str(exc.detail)}}
    if request_id:
        body["requestId"] = request_id
    return JSONResponse(status_code=exc.status_code, content=body)

async def generic_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id")
    logger.error("Unhandled exception", error=str(exc), request_id=request_id)
    body = {"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}}
    if request_id:
        body["requestId"] = request_id
    return JSONResponse(status_code=500, content=body)
