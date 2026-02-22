import base64
import hashlib
import json
import os
import tempfile
import time
import structlog
import httpx
from typing import Optional

from models.whisper_model import whisper_model
from services.cache_service import cache_get, cache_set
from utils.metrics import (
    transcription_total,
    transcription_duration,
    cache_hits,
    cache_misses,
)

logger = structlog.get_logger(service="stt")

async def transcribe(
    audio: Optional[str] = None,
    audio_url: Optional[str] = None,
    language: Optional[str] = None,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> dict:
    if not whisper_model.is_loaded:
        raise RuntimeError("STT model not available")

    if not audio and not audio_url:
        raise ValueError("Either 'audio' (base64) or 'audio_url' must be provided")

    log = logger.bind(tenant_id=tenant_id, request_id=request_id)

    # Get audio bytes
    if audio:
        audio_bytes = base64.b64decode(audio)
    else:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            audio_bytes = resp.content

    # Check cache
    audio_hash = hashlib.sha256(audio_bytes).hexdigest()
    cache_key = f"stt:transcription:{audio_hash}:{language or 'auto'}"

    cached = await cache_get(cache_key)
    if cached:
        cache_hits.inc()
        log.info("Cache hit for transcription", cache_key=cache_key)
        return json.loads(cached)

    cache_misses.inc()

    # Write to temp file for Whisper
    start_time = time.time()
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        result = whisper_model.transcribe(tmp_path, language=language)
        duration = time.time() - start_time

        detected_lang = result.get("language", language or "unknown")
        transcription_total.labels(status="success", language=detected_lang).inc()
        transcription_duration.labels(language=detected_lang).observe(duration)

        log.info(
            "Transcription completed",
            duration=round(duration, 2),
            language=detected_lang,
            text_length=len(result.get("text", "")),
        )

        # Cache result
        await cache_set(cache_key, json.dumps(result))

        return result
    except Exception as e:
        duration = time.time() - start_time
        transcription_total.labels(status="error", language=language or "unknown").inc()
        log.error("Transcription failed", error=str(e), duration=round(duration, 2))
        raise
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
