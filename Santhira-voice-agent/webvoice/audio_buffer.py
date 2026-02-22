"""Accumulate audio chunks from the browser until finalize is called."""

from __future__ import annotations

import io


class AudioBuffer:
    """Collects binary audio chunks and returns a single bytes blob."""

    def __init__(self) -> None:
        self._buf = io.BytesIO()

    def append(self, chunk: bytes) -> None:
        self._buf.write(chunk)

    def get_audio(self) -> bytes:
        """Return accumulated audio bytes."""
        return self._buf.getvalue()

    @property
    def size(self) -> int:
        return self._buf.tell()

    def clear(self) -> None:
        self._buf = io.BytesIO()
