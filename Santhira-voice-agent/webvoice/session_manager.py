"""In-memory session storage for webvoice conversations."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from webvoice.audio_buffer import AudioBuffer


@dataclass
class Session:
    session_id: str
    language: str = "en"
    messages: list[dict] = field(default_factory=list)
    audio_buffer: AudioBuffer = field(default_factory=AudioBuffer)


class SessionManager:
    """Thread-safe (single-process) session store."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self, sid: str) -> Session:
        """Create a new session linked to a Socket.IO connection id."""
        session_id = uuid.uuid4().hex[:12]
        session = Session(session_id=session_id)
        self._sessions[sid] = session
        return session

    def get(self, sid: str) -> Session | None:
        return self._sessions.get(sid)

    def remove(self, sid: str) -> None:
        self._sessions.pop(sid, None)
