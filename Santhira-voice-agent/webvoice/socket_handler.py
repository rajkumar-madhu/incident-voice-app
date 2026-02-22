"""Socket.IO event handlers for the webvoice pipeline."""

from __future__ import annotations

import structlog
from openai import AsyncOpenAI

from config import settings
from main import SYSTEM_PROMPT, run_agent_loop
from webvoice import openai_client
from webvoice.session_manager import SessionManager

logger = structlog.get_logger()

sessions = SessionManager()


def register_handlers(sio) -> None:  # noqa: ANN001 — socketio.AsyncServer
    """Attach Socket.IO event handlers to the server."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    @sio.event
    async def connect(sid: str, environ: dict) -> None:
        logger.info("ws_connect", sid=sid)

    @sio.on("start-session")
    async def on_start_session(sid: str, data: dict | None = None) -> None:
        session = sessions.create(sid)
        session.messages.append({"role": "system", "content": SYSTEM_PROMPT})
        logger.info("session_started", sid=sid, session_id=session.session_id)
        await sio.emit("session-ready", {"session_id": session.session_id}, to=sid)

    @sio.on("audio-chunk")
    async def on_audio_chunk(sid: str, data: bytes) -> None:
        session = sessions.get(sid)
        if not session:
            await sio.emit("error", {"code": "NO_SESSION", "message": "Call start-session first"}, to=sid)
            return
        session.audio_buffer.append(data)

    @sio.on("finalize-audio")
    async def on_finalize_audio(sid: str, data: dict | None = None) -> None:
        session = sessions.get(sid)
        if not session:
            await sio.emit("error", {"code": "NO_SESSION", "message": "Call start-session first"}, to=sid)
            return

        audio_bytes = session.audio_buffer.get_audio()
        session.audio_buffer.clear()

        if len(audio_bytes) < 1000:
            await sio.emit("error", {"code": "AUDIO_TOO_SHORT", "message": "Recording too short"}, to=sid)
            return

        try:
            # 1. STT — transcribe audio
            transcript = await openai_client.transcribe(client, audio_bytes)
            await sio.emit("transcript", {"text": transcript}, to=sid)

            if not transcript.strip():
                return

            # 2. GPT agent loop — get response
            session.messages.append({"role": "user", "content": transcript})
            response_text = await run_agent_loop(client, session.messages)
            session.messages.append({"role": "assistant", "content": response_text})
            await sio.emit("response-text", {"text": response_text}, to=sid)

            # 3. TTS — stream sentence-by-sentence
            chunk_idx = 0
            async for audio_b64 in openai_client.synthesize_chunked(client, response_text):
                await sio.emit("audio-response", {"audio": audio_b64, "chunk": chunk_idx}, to=sid)
                chunk_idx += 1
            await sio.emit("audio-done", {}, to=sid)

        except Exception as exc:
            logger.error("pipeline_error", sid=sid, error=str(exc))
            await sio.emit("error", {"code": "PIPELINE_ERROR", "message": str(exc)}, to=sid)

    @sio.on("text-message")
    async def on_text_message(sid: str, data: dict) -> None:
        session = sessions.get(sid)
        if not session:
            await sio.emit("error", {"code": "NO_SESSION", "message": "Call start-session first"}, to=sid)
            return

        text = (data.get("text") or "").strip()
        if not text:
            return

        try:
            session.messages.append({"role": "user", "content": text})
            response_text = await run_agent_loop(client, session.messages)
            session.messages.append({"role": "assistant", "content": response_text})
            await sio.emit("response-text", {"text": response_text}, to=sid)

            # TTS — stream sentence-by-sentence
            chunk_idx = 0
            async for audio_b64 in openai_client.synthesize_chunked(client, response_text):
                await sio.emit("audio-response", {"audio": audio_b64, "chunk": chunk_idx}, to=sid)
                chunk_idx += 1
            await sio.emit("audio-done", {}, to=sid)

        except Exception as exc:
            logger.error("text_pipeline_error", sid=sid, error=str(exc))
            await sio.emit("error", {"code": "PIPELINE_ERROR", "message": str(exc)}, to=sid)

    @sio.on("end-session")
    async def on_end_session(sid: str, data: dict | None = None) -> None:
        logger.info("session_ended", sid=sid)
        sessions.remove(sid)

    @sio.event
    async def disconnect(sid: str) -> None:
        logger.info("ws_disconnect", sid=sid)
        sessions.remove(sid)
