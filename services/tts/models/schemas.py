from pydantic import BaseModel, Field
from typing import Optional, List

class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    language: str = Field(default="en", description="Language code")
    persona_id: Optional[str] = Field(None, description="Voice persona ID")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)

class SynthesizeResponse(BaseModel):
    success: bool = True
    data: dict

class SynthesisData(BaseModel):
    audio_base64: str
    duration_ms: int
    engine: str
    language: str
    sample_rate: int = 22050

class Persona(BaseModel):
    id: str
    name: str
    language: str
    gender: str
    engine: str
    description: Optional[str] = None

class PersonaListResponse(BaseModel):
    success: bool = True
    data: List[Persona]
