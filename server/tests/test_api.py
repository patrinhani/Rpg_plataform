from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import UTC, datetime, timedelta

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
        },
    )
    assert unavailable_campaign.status_code == 409

    manual_external_id = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": "Mesa", "externalMesaId": "mesa-firebase-01"},
    )
    assert manual_external_id.status_code == 422


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


def test_access_capacity_is_per_room_and_expired_ticket_releases_its_media_grant(
    client: TestClient,
    room: dict[str, object],
) -> None:
    service = client.app.state.vtt
    service.max_pending_tickets_per_room = 2
    service.max_media_grants_per_room = 2
    path = f"/api/vtt/rooms/{room['roomId']}/tickets"
    headers = {"Authorization": f"Bearer {room['playerInviteToken']}"}

    first = client.post(path, headers=headers)
    second = client.post(path, headers=headers)
    assert first.status_code == 200
    assert second.status_code == 200

    full = client.post(path, headers=headers)
    assert full.status_code == 429
    assert full.json() == {
        "detail": "Limite temporario de acessos da sala atingido"
    }

    invalid = client.post(
        path,
        headers={"Authorization": "Bearer convite-invalido"},
    )
    assert invalid.status_code == 401

    other_room = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": "Outra mesa"},
    ).json()
    other_access = client.post(
        f"/api/vtt/rooms/{other_room['roomId']}/tickets",
        headers={"Authorization": f"Bearer {other_room['playerInviteToken']}"},
    )
    assert other_access.status_code == 200

    first_access = first.json()
    ticket = first_access["ticket"]
    media_digest = hashlib.sha256(
        first_access["mediaToken"].encode("utf-8")
    ).digest()
    service._tickets[ticket] = replace(
        service._tickets[ticket],
        expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    assert media_digest in service._media_grants

    recovered = client.post(path, headers=headers)
    assert recovered.status_code == 200
    assert ticket not in service._tickets
    assert media_digest not in service._media_grants
