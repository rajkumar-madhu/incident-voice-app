from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from models.schemas import TranscribeRequest
from services.transcription_service import transcribe

router = APIRouter()

@router.post("/v1/transcribe")
async def transcribe_audio(
    request: TranscribeRequest,
    x_tenant_id: Optional[str] = Header(None),
    x_request_id: Optional[str] = Header(None),
):
    if not request.audio and not request.audio_url:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Either 'audio' or 'audio_url' is required"},
        )

    try:
        result = await transcribe(
            audio=request.audio,
            audio_url=request.audio_url,
            language=request.language,
            tenant_id=x_tenant_id,
            request_id=x_request_id,
        )
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail={"code": "SERVICE_UNAVAILABLE", "message": str(e)})
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": str(e)})
    except Exception as e:
        import structlog
        structlog.get_logger(service="stt").error("Transcription failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Transcription failed"})
