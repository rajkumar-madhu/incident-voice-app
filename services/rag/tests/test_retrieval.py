from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

def test_health_live():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "alive"

def test_retrieve_missing_tenant():
    response = client.post(
        "/v1/retrieve",
        json={"query": "test query"},
    )
    assert response.status_code == 422  # missing tenant_id in body

def test_create_document_missing_tenant():
    response = client.post(
        "/v1/documents",
        json={"title": "Test", "content": "Test content"},
    )
    assert response.status_code == 400

def test_metrics():
    response = client.get("/metrics")
    assert response.status_code == 200
