from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from conftest import ORIGIN


def _ticket(client: TestClient, room: dict[str, object], token_key: str) -> str:
    response = client.post(
        f"/api/vtt/rooms/{room['roomId']}/tickets",
        headers={"Authorization": f"Bearer {room[token_key]}"},
    )
    assert response.status_code == 200
    return response.json()["ticket"]


def test_snapshot_ping_and_token_sync(client: TestClient, room: dict[str, object]) -> None:
    master_ticket = _ticket(client, room, "masterInviteToken")
    player_ticket = _ticket(client, room, "playerInviteToken")
    path = f"/ws/vtt/rooms/{room['roomId']}"

    with client.websocket_connect(
        f"{path}?ticket={master_ticket}", headers={"Origin": ORIGIN}
    ) as master, client.websocket_connect(
        f"{path}?ticket={player_ticket}", headers={"Origin": ORIGIN}
    ) as player:
        master_snapshot = master.receive_json()
        player_snapshot = player.receive_json()
        assert master_snapshot["type"] == "room.snapshot"
        assert master_snapshot["role"] == "master"
        assert master_snapshot["state"]["tokens"]["demo-token"]["x"] == 0.5
        assert player_snapshot["role"] == "player"

        master.send_json({"type": "ping", "commandId": "ping-1"})
        assert master.receive_json() == {
            "type": "pong",
            "protocolVersion": 1,
            "commandId": "ping-1",
        }

        master.send_json(
            {
                "type": "token.move",
                "commandId": "move-1",
                "payload": {"tokenId": "demo-token", "x": 0.25, "y": 0.75},
            }
        )
        expected = {
            "type": "token.moved",
            "revision": 1,
            "payload": {"tokenId": "demo-token", "x": 0.25, "y": 0.75},
        }
        assert master.receive_json() == expected
        assert player.receive_json() == expected


def test_invalid_move_returns_structured_error(client: TestClient, room: dict[str, object]) -> None:
    ticket = _ticket(client, room, "playerInviteToken")
    with client.websocket_connect(
        f"/ws/vtt/rooms/{room['roomId']}?ticket={ticket}", headers={"Origin": ORIGIN}
    ) as socket:
        socket.receive_json()
        socket.send_json(
            {
                "type": "token.move",
                "commandId": "bad-move",
                "payload": {"tokenId": "demo-token", "x": 2, "y": 0.5},
            }
        )
        error = socket.receive_json()
        assert error["type"] == "error"
        assert error["commandId"] == "bad-move"
        assert error["error"]["code"] == "invalid_token_move"


def test_websocket_rejects_unknown_origin_without_consuming_ticket(
    client: TestClient, room: dict[str, object]
) -> None:
    ticket = _ticket(client, room, "playerInviteToken")
    path = f"/ws/vtt/rooms/{room['roomId']}?ticket={ticket}"
    with pytest.raises(WebSocketDisconnect) as rejected:
        with client.websocket_connect(path, headers={"Origin": "https://malicious.example"}):
            pass
    assert rejected.value.code == 4403

    with client.websocket_connect(path, headers={"Origin": ORIGIN}) as socket:
        assert socket.receive_json()["type"] == "room.snapshot"


def test_websocket_ticket_is_single_use(client: TestClient, room: dict[str, object]) -> None:
    ticket = _ticket(client, room, "playerInviteToken")
    path = f"/ws/vtt/rooms/{room['roomId']}?ticket={ticket}"
    with client.websocket_connect(path, headers={"Origin": ORIGIN}) as socket:
        assert socket.receive_json()["type"] == "room.snapshot"

    with pytest.raises(WebSocketDisconnect) as reused:
        with client.websocket_connect(path, headers={"Origin": ORIGIN}):
            pass
    assert reused.value.code == 4401
