import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from utils.metrics import http_requests_total

logger = structlog.get_logger(service="stt")

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Skip logging for health/metrics
        skip_logging = request.url.path in ("/health", "/health/live", "/health/ready", "/metrics")

        response: Response = await call_next(request)

        duration = time.time() - start_time

        if not skip_logging:
            logger.info(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration=round(duration, 4),
                tenant_id=request.headers.get("x-tenant-id"),
                request_id=request.headers.get("x-request-id"),
            )
            http_requests_total.labels(
                method=request.method,
                path=request.url.path,
                status=str(response.status_code),
            ).inc()

        # Add request ID to response
        request_id = request.headers.get("x-request-id")
        if request_id:
            response.headers["x-request-id"] = request_id

        return response
