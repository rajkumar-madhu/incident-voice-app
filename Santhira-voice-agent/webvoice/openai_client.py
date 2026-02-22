"""OpenAI Whisper STT and TTS wrappers for the webvoice pipeline."""

from __future__ import annotations

import base64
import io
import re
import time
from collections.abc import AsyncIterator

import structlog
from openai import AsyncOpenAI

from config import settings

logger = structlog.get_logger()

# Split on sentence boundaries: . ! ? followed by whitespace
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


async def transcribe(client: AsyncOpenAI, audio_bytes: bytes) -> str:
    """Send audio to OpenAI Whisper and return the transcript text."""
    start = time.monotonic()

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.webm"

    response = await client.audio.transcriptions.create(
        model=settings.openai_stt_model,
        file=audio_file,
        language="en",
    )

    latency_ms = int((time.monotonic() - start) * 1000)
    logger.info("stt_complete", latency_ms=latency_ms, chars=len(response.text))
    return response.text


async def synthesize_chunked(client: AsyncOpenAI, text: str) -> AsyncIterator[str]:
    """Split text into sentences and yield base64 mp3 for each.

    The caller receives the first chunk as soon as the first sentence is
    synthesized, dramatically reducing time-to-first-audio.
    """
    sentences = [s.strip() for s in _SENTENCE_RE.split(text) if s.strip()]

    # If only one sentence (or unsplittable), synthesize as a single chunk
    if not sentences:
        sentences = [text]

    for i, sentence in enumerate(sentences):
        start = time.monotonic()

        response = await client.audio.speech.create(
            model=settings.openai_tts_model,
            voice=settings.openai_tts_voice,
            input=sentence,
            response_format="mp3",
        )

        audio_bytes = response.content
        latency_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "tts_chunk",
            chunk=i + 1,
            total=len(sentences),
            latency_ms=latency_ms,
            bytes=len(audio_bytes),
        )
        yield base64.b64encode(audio_bytes).decode("ascii")
