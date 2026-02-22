from pydantic import BaseModel, Field
from typing import Optional

class TranscribeRequest(BaseModel):
    audio: Optional[str] = Field(None, description="Base64 encoded audio data")
    audio_url: Optional[str] = Field(None, description="URL to download audio from")
    language: Optional[str] = Field(None, description="Language code (e.g., 'en', 'hi')")

class TranscribeResponse(BaseModel):
    success: bool = True
    data: dict

class TranscriptionData(BaseModel):
    text: str
    language: str
    confidence: float
    duration_seconds: Optional[float] = None
    segments: Optional[list] = None
