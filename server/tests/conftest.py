from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from caos_vtt import create_app
from caos_vtt.config import Settings


HOST_TOKEN = "host-token-for-tests-123456"
ORIGIN = "http://localhost:5173"


@pytest.fixture
def client() -> TestClient:
    app = create_app(Settings(host_token=HOST_TOKEN, allowed_origins=(ORIGIN,), ticket_ttl_seconds=60))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def room(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": "Mesa de teste"},
    )
    assert response.status_code == 201
    return response.json()
