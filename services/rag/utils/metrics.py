from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

registry = CollectorRegistry()

retrieval_total = Counter(
    "rag_retrieval_total", "Total retrieval requests",
    ["status"], registry=registry,
)

retrieval_duration = Histogram(
    "rag_retrieval_duration_seconds", "Retrieval duration",
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registry=registry,
)

documents_ingested = Counter(
    "rag_documents_ingested_total", "Documents ingested",
    ["tenant_id"], registry=registry,
)

chunks_created = Counter(
    "rag_chunks_created_total", "Chunks created during ingestion",
    registry=registry,
)

embedding_model_loaded = Gauge(
    "rag_embedding_model_loaded", "Whether embedding model is loaded",
    registry=registry,
)

http_requests_total = Counter(
    "http_requests_total", "Total HTTP requests",
    ["method", "path", "status"], registry=registry,
)

def get_metrics() -> bytes:
    return generate_latest(registry)

def get_content_type() -> str:
    return CONTENT_TYPE_LATEST
