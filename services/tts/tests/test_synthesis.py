import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_live():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "alive"

def test_list_personas():
    response = client.get("/v1/personas")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)

def test_list_personas_filter_language():
    response = client.get("/v1/personas?language=en")
    assert response.status_code == 200
    data = response.json()
    for p in data["data"]:
        assert p["language"] == "en"

def test_synthesize_empty_text():
    response = client.post(
        "/v1/synthesize",
        json={"text": ""},
        headers={"x-tenant-id": "test-tenant"},
    )
    assert response.status_code == 422  # Pydantic validation

def test_metrics():
    response = client.get("/metrics")
    assert response.status_code == 200
