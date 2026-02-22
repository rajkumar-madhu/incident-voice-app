from fastapi import APIRouter, Header
from typing import Optional
from services.persona_service import get_personas

router = APIRouter()

@router.get("/v1/personas")
async def list_personas(
    language: Optional[str] = None,
    x_tenant_id: Optional[str] = Header(None),
):
    personas = get_personas(language=language)
    return {"success": True, "data": personas}
