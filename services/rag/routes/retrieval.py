from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from models.schemas import RetrieveRequest
from services.retrieval_service import retrieve

router = APIRouter()

@router.post("/v1/retrieve")
async def retrieve_documents(
    request: RetrieveRequest,
    x_tenant_id: Optional[str] = Header(None),
    x_request_id: Optional[str] = Header(None),
):
    tenant_id = request.tenant_id or x_tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "tenant_id is required"})

    try:
        results = await retrieve(
            query=request.query,
            tenant_id=tenant_id,
            top_k=request.top_k,
            threshold=request.threshold,
            metadata_filter=request.metadata_filter,
            request_id=x_request_id,
        )
        return {"success": True, "data": {"documents": results, "count": len(results)}}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail={"code": "SERVICE_UNAVAILABLE", "message": str(e)})
    except Exception as e:
        import structlog
        structlog.get_logger(service="rag").error("Retrieval failed", error=str(e))
        raise HTTPException(status_code=500, detail={"code": "INTERNAL_ERROR", "message": "Retrieval failed"})
