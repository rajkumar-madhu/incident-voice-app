import uuid
import structlog
from typing import List, Optional, Dict, Any

from db.postgres import get_pool
from models.embedding_model import embedding_model
from utils.metrics import documents_ingested, chunks_created
from config import settings

logger = structlog.get_logger(service="rag")

def chunk_text(text: str, chunk_size: Optional[int] = None, overlap: Optional[int] = None) -> List[str]:
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        # Try to break at sentence boundary
        if end < len(text):
            last_period = chunk.rfind('. ')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point > chunk_size * 0.5:
                chunk = text[start:start + break_point + 1]
                end = start + break_point + 1

        chunks.append(chunk.strip())
        start = end - overlap

    return [c for c in chunks if c]

async def ingest_document(
    tenant_id: str,
    title: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    if not embedding_model.is_loaded:
        raise RuntimeError("Embedding model not available")

    parent_id = str(uuid.uuid4())
    chunks = chunk_text(content)

    logger.info("Ingesting document", tenant_id=tenant_id, title=title, chunks=len(chunks))

    # Batch embed all chunks
    embeddings = embedding_model.embed(chunks)

    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                emb_str = "[" + ",".join(str(x) for x in emb) + "]"
                await conn.execute(
                    """INSERT INTO knowledge_documents
                       (id, tenant_id, title, content, embedding, metadata, chunk_index, parent_document_id)
                       VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8)""",
                    str(uuid.uuid4()), tenant_id, title, chunk,
                    emb_str, metadata or {}, i, parent_id,
                )

    documents_ingested.labels(tenant_id=tenant_id).inc()
    chunks_created.inc(len(chunks))

    logger.info("Document ingested", parent_id=parent_id, chunks=len(chunks))

    return {
        "document_id": parent_id,
        "title": title,
        "chunks_created": len(chunks),
        "tenant_id": tenant_id,
    }

async def list_documents(tenant_id: str, limit: int = 50, offset: int = 0) -> List[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT DISTINCT ON (parent_document_id)
                   parent_document_id as id, title, metadata,
                   COUNT(*) OVER (PARTITION BY parent_document_id) as chunk_count,
                   MIN(created_at) OVER (PARTITION BY parent_document_id) as created_at
               FROM knowledge_documents
               WHERE tenant_id = $1
               ORDER BY parent_document_id, chunk_index
               LIMIT $2 OFFSET $3""",
            tenant_id, limit, offset,
        )

    return [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "metadata": dict(row["metadata"]) if row["metadata"] else {},
            "chunk_count": row["chunk_count"],
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]

async def delete_document(tenant_id: str, document_id: str) -> bool:
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM knowledge_documents WHERE parent_document_id = $1 AND tenant_id = $2",
            document_id, tenant_id,
        )

    deleted = result.split()[-1] != "0"
    if deleted:
        logger.info("Document deleted", document_id=document_id, tenant_id=tenant_id)
    return deleted
