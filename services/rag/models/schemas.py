from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    tenant_id: str
    top_k: int = Field(default=5, ge=1, le=50)
    threshold: float = Field(default=0.3, ge=0.0, le=1.0)
    metadata_filter: Optional[Dict[str, Any]] = None

class RetrievedDocument(BaseModel):
    id: str
    title: Optional[str] = None
    content: str
    similarity: float
    metadata: Optional[Dict[str, Any]] = None
    chunk_index: int = 0

class RetrieveResponse(BaseModel):
    success: bool = True
    data: dict

class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    metadata: Optional[Dict[str, Any]] = None

class DocumentResponse(BaseModel):
    success: bool = True
    data: dict

class DocumentListResponse(BaseModel):
    success: bool = True
    data: List[dict]
