import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import base64
import json

# Mock whisper model before importing
with patch("models.whisper_model.WhisperModel") as MockWhisper:
    mock_instance = MagicMock()
    mock_instance.is_loaded = True
    mock_instance.transcribe.return_value = {
        "text": "Hello world",
        "language": "en",
        "confidence": 0.95,
        "duration_seconds": 2.5,
        "segments": [],
    }
    MockWhisper.return_value = mock_instance

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_live():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "alive"

def test_transcribe_no_audio():
    response = client.post(
        "/v1/transcribe",
        json={},
        headers={"x-tenant-id": "test-tenant"},
    )
    assert response.status_code == 400

def test_transcribe_with_base64_audio():
    audio_data = base64.b64encode(b"fake audio data").decode()

    with patch("services.transcription_service.whisper_model") as mock_model:
        mock_model.is_loaded = True
        mock_model.transcribe.return_value = {
            "text": "Hello world",
            "language": "en",
            "confidence": 0.95,
            "duration_seconds": 2.5,
            "segments": [],
        }
        with patch("services.transcription_service.cache_get", new_callable=AsyncMock, return_value=None):
            with patch("services.transcription_service.cache_set", new_callable=AsyncMock, return_value=True):
                response = client.post(
                    "/v1/transcribe",
                    json={"audio": audio_data, "language": "en"},
                    headers={"x-tenant-id": "test-tenant", "x-request-id": "test-123"},
                )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

def test_metrics():
    response = client.get("/metrics")
    assert response.status_code == 200
