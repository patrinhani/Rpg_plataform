from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import HOST_TOKEN


def test_public_api_documentation_is_disabled(client) -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_health(client: TestClient) -> None:
    response = client.get("/api/vtt/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "protocolVersion": 1}


def test_room_creation_requires_host_token(client: TestClient) -> None:
    assert client.post("/api/vtt/rooms", json={"name": "Mesa"}).status_code == 401
    assert (
        client.post(
            "/api/vtt/rooms",
            headers={"Authorization": "Bearer errado-errado-errado"},
            json={"name": "Mesa"},
        ).status_code
        == 401
    )

    blank_name = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": "   "},
    )
    assert blank_name.status_code == 422

    unavailable_campaign = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={
            "name": "Mesa vinculada",
            "campaignId": "mnemosyne",
            "externalMesaId": "mesa-firebase-01",
        },
    )
    assert unavailable_campaign.status_code == 409

    invalid_external_id = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": "Mesa", "externalMesaId": "../segredo"},
    )
    assert invalid_external_id.status_code == 422


def test_room_and_invite_ticket_contract(client: TestClient, room: dict[str, object]) -> None:
    assert set(room) == {
        "roomId",
        "masterInviteToken",
        "playerInviteToken",
        "revision",
    }
    assert room["revision"] == 0

    room_id = room["roomId"]
    master = client.post(
        f"/api/vtt/rooms/{room_id}/tickets",
        headers={"Authorization": f"Bearer {room['masterInviteToken']}"},
    )
    player = client.post(
        f"/api/vtt/rooms/{room_id}/tickets",
        headers={"Authorization": f"Bearer {room['playerInviteToken']}"},
    )
    assert master.status_code == 200
    assert master.json()["role"] == "master"
    assert master.json()["expiresIn"] == 60
    assert player.status_code == 200
    assert player.json()["role"] == "player"


def test_invalid_invite_is_rejected(client: TestClient, room: dict[str, object]) -> None:
    response = client.post(
        f"/api/vtt/rooms/{room['roomId']}/tickets",
        headers={"Authorization": "Bearer convite-invalido"},
    )
    assert response.status_code == 401
