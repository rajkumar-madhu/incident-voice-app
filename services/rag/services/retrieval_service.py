import hashlib
import json
import time
import structlog
from typing import List, Optional, Dict, Any

from db.postgres import get_pool
from models.embedding_model import embedding_model
from services.cache_service import cache_get, cache_set
from utils.metrics import retrieval_total, retrieval_duration
from config import settings

logger = structlog.get_logger(service="rag")

async def retrieve(
    query: str,
    tenant_id: str,
    top_k: int = None,
    threshold: float = None,
    metadata_filter: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
) -> List[dict]:
    if not embedding_model.is_loaded:
        raise RuntimeError("Embedding model not available")

    top_k = top_k or settings.default_top_k
    threshold = threshold if threshold is not None else settings.similarity_threshold

    log = logger.bind(tenant_id=tenant_id, request_id=request_id)

    # Check cache
    cache_key = f"rag:retrieve:{hashlib.sha256(f'{query}:{tenant_id}:{top_k}:{threshold}'.encode()).hexdigest()}"
    cached = await cache_get(cache_key)
    if cached:
        log.info("Cache hit for retrieval")
        return json.loads(cached)

    start_time = time.time()

    try:
        # Embed query
        query_embedding = embedding_model.embed_single(query)
        emb_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        # Search via pgvector cosine similarity
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, title, content, metadata, chunk_index,
                          1 - (embedding <=> $1::vector) as similarity
                   FROM knowledge_documents
                   WHERE tenant_id = $2
                     AND 1 - (embedding <=> $1::vector) >= $3
                   ORDER BY embedding <=> $1::vector
                   LIMIT $4""",
                emb_str, tenant_id, threshold, top_k,
            )

        results = [
            {
                "id": str(row["id"]),
                "title": row["title"],
                "content": row["content"],
                "similarity": round(float(row["similarity"]), 4),
                "metadata": dict(row["metadata"]) if row["metadata"] else {},
                "chunk_index": row["chunk_index"],
            }
            for row in rows
        ]

        duration = time.time() - start_time
        retrieval_total.labels(status="success").inc()
        retrieval_duration.observe(duration)

        log.info(
            "Retrieval completed",
            results=len(results),
            duration=round(duration, 3),
            top_k=top_k,
            threshold=threshold,
        )

        # Cache results
        await cache_set(cache_key, json.dumps(results))

        return results
    except Exception as e:
        retrieval_total.labels(status="error").inc()
        log.error("Retrieval failed", error=str(e))
        raise
