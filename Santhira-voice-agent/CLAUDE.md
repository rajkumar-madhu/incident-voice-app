# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Santhira Voice Agent — a Python FastAPI + Socket.IO real-time voice agent for IT incident management. Uses OpenAI for STT (Whisper), LLM (GPT-4.1 with function calling), and TTS. Integrates with an ITSM backend and RAG service for runbook search.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run web voice interface (default port 5000)
python run_webvoice.py

# Run CLI agent (interactive multi-turn)
python main.py

# Run CLI agent (single query)
python main.py "What is incident INC-001?"

# Test OpenAI connectivity
python test_run.py
```

## Architecture

```
Browser (MediaRecorder audio)
  ↕ Socket.IO (bidirectional)
webvoice/server.py (FastAPI + ASGI)
  → webvoice/socket_handler.py (event pipeline)
    → openai_client.py: Whisper STT (audio → text)
    → main.py: agent_loop() — GPT-4.1 with function calling (max 5 tool rounds)
      → tools.py: ITSM API calls + RAG search (httpx async, 10-15s timeouts)
    → openai_client.py: TTS (sentence-by-sentence streaming, base64 MP3 chunks)
  ↕ Socket.IO events back to browser
```

**Key files:**
- `config.py` — Pydantic Settings, validates env vars on startup (exits on failure)
- `main.py` — System prompt, agent loop with OpenAI function calling, message history
- `tools.py` — 5 ITSM/RAG tool definitions + async HTTP handlers
- `webvoice/socket_handler.py` — Voice pipeline: audio buffer → STT → LLM → TTS → stream
- `webvoice/openai_client.py` — Whisper transcription + sentence-chunked TTS synthesis
- `webvoice/session_manager.py` — In-memory session storage (ephemeral, no persistence)
- `webvoice/static/index.html` — Browser UI (vanilla JS, Socket.IO client, MediaRecorder)

## Voice Pipeline Events (Socket.IO)

1. `start-session` → creates session with system prompt
2. `audio-chunk` → buffers incoming audio bytes
3. `finalize-audio` → triggers full pipeline (STT → LLM → TTS)
4. Server emits: `transcript`, `response-text`, `audio-response` (base64 chunks), `audio-done`, `error`

## Function-Calling Tools (tools.py)

| Tool | ITSM Endpoint | Purpose |
|------|---------------|---------|
| `lookup_incident` | `GET /api/incidents/{id}` or `?q=` | Search by ID or keyword |
| `create_incident` | `POST /api/incidents` | Create with priority P1-P4 |
| `escalate_incident` | `POST /api/incidents/{id}/escalate` | Raise priority with reason |
| `get_incident_history` | `GET /api/incidents/{id}/history` | Activity timeline |
| `search_runbooks` | `POST /api/v1/search` (RAG) | Similarity search, threshold 0.75 |

## Configuration

All config via environment variables (`.env` file), validated by Pydantic Settings in `config.py`:

- `OPENAI_API_KEY` — Required, no default
- `OPENAI_CHAT_MODEL` — default `gpt-4.1`
- `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` — Whisper/TTS settings
- `ITSM_API_URL` — ITSM backend (default `http://localhost:9000`)
- `RAG_SERVICE_URL` — RAG search (default `http://localhost:8003`)
- `DEFAULT_TENANT_ID` — Multi-tenant header propagation
- `WEBVOICE_PORT` — Web server port (default `5000`)

## Key Conventions

- **Async-first**: All I/O uses `AsyncOpenAI`, `httpx.AsyncClient`, `socketio.AsyncServer`
- **Structured logging only**: `structlog` throughout, never `print()` — fields include `latency_ms`, `session_id`, `tool_invoked`
- **Tenant isolation**: `X-Tenant-ID` and `X-API-Key` headers propagated on all downstream HTTP calls
- **Sentence-level TTS streaming**: Text split on `[.!?]\s+` boundaries, each sentence synthesized and streamed independently for low latency
- **Tool round cap**: Agent loop limited to 5 function-calling rounds per query to prevent infinite loops
- **Fail-open on service errors**: HTTP timeouts and connection errors are caught and logged, not re-raised
