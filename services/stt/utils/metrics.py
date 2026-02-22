from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

registry = CollectorRegistry()

transcription_total = Counter(
    "stt_transcription_total",
    "Total transcription requests",
    ["status", "language"],
    registry=registry,
)

transcription_duration = Histogram(
    "stt_transcription_duration_seconds",
    "Transcription processing duration",
    ["language"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registry=registry,
)

model_loaded = Gauge(
    "stt_model_loaded",
    "Whether the Whisper model is loaded (1=yes, 0=no)",
    registry=registry,
)

cache_hits = Counter(
    "stt_cache_hits_total",
    "Cache hit count",
    registry=registry,
)

cache_misses = Counter(
    "stt_cache_misses_total",
    "Cache miss count",
    registry=registry,
)

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
    registry=registry,
)

def get_metrics() -> bytes:
    return generate_latest(registry)

def get_content_type() -> str:
    return CONTENT_TYPE_LATEST
