import hashlib
import json
import time
import structlog
from typing import Optional

from models.indicf5_model import indicf5_model
from models.piper_model import piper_model
from services.persona_service import get_persona
from services.cache_service import cache_get, cache_set
from utils.metrics import synthesis_total, synthesis_duration, cache_hits, cache_misses

logger = structlog.get_logger(service="tts")

async def synthesize(
    text: str,
    language: str = "en",
    persona_id: Optional[str] = None,
    speed: float = 1.0,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> dict:
    log = logger.bind(tenant_id=tenant_id, request_id=request_id)

    # Resolve persona
    persona = None
    if persona_id:
        persona = get_persona(persona_id)
        if persona:
            language = persona.get("language", language)

    # Check cache
    cache_key = f"tts:synthesis:{hashlib.sha256(f'{text}:{language}:{persona_id}:{speed}'.encode()).hexdigest()}"
    cached = await cache_get(cache_key)
    if cached:
        cache_hits.inc()
        log.info("Cache hit for synthesis")
        return json.loads(cached)

    cache_misses.inc()

    # Select engine
    engine = None
    preferred_engine = persona.get("engine", "piper") if persona else "piper"

    start_time = time.time()

    try:
        # Try IndicF5 first if preferred and available
        if preferred_engine == "indicf5" and indicf5_model.is_loaded:
            voice_id = persona.get("indicf5_voice_id", "default") if persona else "default"
            result = indicf5_model.synthesize(text, language, voice_id, speed)
            engine = "indicf5"
        elif piper_model.is_loaded:
            voice_id = persona.get("piper_voice_id", "default") if persona else "default"
            result = piper_model.synthesize(text, language, voice_id, speed)
            engine = "piper"
        elif indicf5_model.is_loaded:
            # Fallback to IndicF5 if Piper not available
            result = indicf5_model.synthesize(text, language, "default", speed)
            engine = "indicf5"
        else:
            raise RuntimeError("No TTS engine available")

        duration = time.time() - start_time
        result["language"] = language

        synthesis_total.labels(status="success", engine=engine, language=language).inc()
        synthesis_duration.labels(engine=engine, language=language).observe(duration)

        log.info(
            "Synthesis completed",
            engine=engine,
            language=language,
            text_length=len(text),
            duration=round(duration, 3),
            audio_duration_ms=result.get("duration_ms"),
        )

        # Cache result
        await cache_set(cache_key, json.dumps(result))

        return result
    except Exception as e:
        duration = time.time() - start_time
        synthesis_total.labels(status="error", engine=engine or "none", language=language).inc()
        log.error("Synthesis failed", error=str(e), duration=round(duration, 3))
        raise
