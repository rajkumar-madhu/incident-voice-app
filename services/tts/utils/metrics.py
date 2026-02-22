from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

registry = CollectorRegistry()

synthesis_total = Counter(
    "tts_synthesis_total",
    "Total synthesis requests",
    ["status", "engine", "language"],
    registry=registry,
)

synthesis_duration = Histogram(
    "tts_synthesis_duration_seconds",
    "Synthesis processing duration",
    ["engine", "language"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30],
    registry=registry,
)

engine_available = Gauge(
    "tts_engine_available",
    "Whether a TTS engine is available",
    ["engine"],
    registry=registry,
)

cache_hits = Counter("tts_cache_hits_total", "Cache hits", registry=registry)
cache_misses = Counter("tts_cache_misses_total", "Cache misses", registry=registry)

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
