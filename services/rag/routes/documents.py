from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from models.schemas import DocumentCreate
from services.document_service import ingest_document, list_documents, delete_document

router = APIRouter()

@router.post("/v1/documents")
async def create_document(
    request: DocumentCreate,
    x_tenant_id: Optional[str] = Header(None),
    x_request_id: Optional[str] = Header(None),
):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "X-Tenant-ID header required"})

    try:
        result = await ingest_document(
            tenant_id=x_tenant_id,
            title=request.title,
            content=request.content,
            metadata=request.metadata,
        )
        return {"success": True, "data": result}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail={"code": "SERVICE_UNAVAILABLE", "message": str(e)})
    except Exception as e:
        import structlog
        structlog.get_logger(service="rag").error("Document ingestion failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Document ingestion failed"})

@router.get("/v1/documents")
async def get_documents(
    limit: int = 50,
    offset: int = 0,
    x_tenant_id: Optional[str] = Header(None),
):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "X-Tenant-ID header required"})

    docs = await list_documents(tenant_id=x_tenant_id, limit=limit, offset=offset)
    return {"success": True, "data": docs}

@router.delete("/v1/documents/{document_id}")
async def remove_document(
    document_id: str,
    x_tenant_id: Optional[str] = Header(None),
):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "X-Tenant-ID header required"})

    deleted = await delete_document(tenant_id=x_tenant_id, document_id=document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Document not found"})
    return {"success": True, "data": {"deleted": True}}
