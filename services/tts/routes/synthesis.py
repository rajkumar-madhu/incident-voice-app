from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from models.schemas import SynthesizeRequest
from services.synthesis_service import synthesize

router = APIRouter()

@router.post("/v1/synthesize")
async def synthesize_text(
    request: SynthesizeRequest,
    x_tenant_id: Optional[str] = Header(None),
    x_request_id: Optional[str] = Header(None),
):
    try:
        result = await synthesize(
            text=request.text,
            language=request.language,
            persona_id=request.persona_id,
            speed=request.speed,
            tenant_id=x_tenant_id,
            request_id=x_request_id,
        )
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail={"code": "SERVICE_UNAVAILABLE", "message": str(e)})
    except Exception as e:
        import structlog
        structlog.get_logger(service="tts").error("Synthesis failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Synthesis failed"})
