import json
import os
import structlog
from typing import List, Optional

logger = structlog.get_logger(service="tts")

_personas: List[dict] = []

def load_personas():
    global _personas
    personas_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "personas.json")

    try:
        with open(personas_path, "r") as f:
            _personas = json.load(f)
        logger.info("Loaded personas", count=len(_personas))
    except FileNotFoundError:
        logger.warning("personas.json not found, using defaults")
        _personas = [
            {"id": "en-default", "name": "Default English", "language": "en", "gender": "female", "engine": "piper", "description": "Default English voice"},
            {"id": "hi-default", "name": "Default Hindi", "language": "hi", "gender": "female", "engine": "piper", "description": "Default Hindi voice"},
            {"id": "en-male", "name": "English Male", "language": "en", "gender": "male", "engine": "piper", "description": "Male English voice"},
            {"id": "hi-indicf5", "name": "Hindi IndicF5", "language": "hi", "gender": "female", "engine": "indicf5", "description": "High-quality Hindi voice (GPU)"},
        ]

def get_personas(language: Optional[str] = None) -> List[dict]:
    if not _personas:
        load_personas()

    if language:
        return [p for p in _personas if p["language"] == language]
    return _personas

def get_persona(persona_id: str) -> Optional[dict]:
    if not _personas:
        load_personas()

    for p in _personas:
        if p["id"] == persona_id:
            return p
    return None
