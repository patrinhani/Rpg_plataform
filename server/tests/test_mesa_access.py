from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from caos_vtt import create_app
from caos_vtt.config import Settings
from caos_vtt.firestore_auth import (
    FirestoreUnavailableError,
    InvalidGrantError,
    VerifiedMesaGrant,
)
from conftest import HOST_TOKEN, ORIGIN
from test_campaign import _catalog_app


@dataclass
class _FakeVerifier:
    member: VerifiedMesaGrant | None = None
    error: Exception | None = None
    calls: list[tuple[str, str]] | None = None

    def verify(self, challenge: str, mesa_id: str) -> VerifiedMesaGrant:
        if self.calls is not None:
            self.calls.append((challenge, mesa_id))
        if self.error is not None:
            raise self.error
        assert self.member is not None
        return self.member


def _member(
    role: Literal["master", "player"],
    *,
    mesa_id: str = "mesa-integrada",
    expires_in: float = 300,
    campaign_id: str = "memoria",
) -> VerifiedMesaGrant:
    now = datetime.now(UTC)
    return VerifiedMesaGrant(
        mesa_id=mesa_id,
        uid="uid-mestre" if role == "master" else "uid-jogador",
        role=role,
        room_name="Mnemosyne",
        campaign_id=campaign_id,
        issued_at=now,
        expires_at=now + timedelta(seconds=expires_in),
    )


def _new_challenge(client: TestClient, mesa_id: str = "mesa-integrada") -> str:
    response = client.post("/api/vtt/mesa-challenges", json={"mesaId": mesa_id})
    assert response.status_code == 200
    return response.json()["challenge"]


def _request(
    client: TestClient,
    *,
    mesa_id: str = "mesa-integrada",
    payload: dict[str, str] | None = None,
):
    challenge = _new_challenge(client, mesa_id)
    return client.post(
        "/api/vtt/mesa-access",
        json=payload or {"mesaId": mesa_id, "challenge": challenge},
    )


def test_mesa_access_derives_role_and_reuses_room_without_receiving_firebase_token(
    tmp_path: Path,
) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    calls: list[tuple[str, str]] = []
    verifier = _FakeVerifier(member=_member("master"), calls=calls)
    app.state.mesa_grant_verifier = verifier

    with TestClient(app) as client:
        first = _request(client)
        assert first.status_code == 200
        first_payload = first.json()
        assert first_payload["role"] == "master"
        assert first_payload["mediaExpiresIn"] <= 300

        verifier.member = _member("player")
        player = _request(client)
        assert player.status_code == 200
        assert player.json()["role"] == "player"
        assert player.json()["roomId"] == first_payload["roomId"]

        forged_challenge = _new_challenge(client)
        forged = client.post(
            "/api/vtt/mesa-access",
            json={
                "mesaId": "mesa-integrada",
                "challenge": forged_challenge,
                "role": "master",
            },
        )
        assert forged.status_code == 422

    assert len(calls) == 2
    assert all(mesa_id == "mesa-integrada" for _challenge, mesa_id in calls)
    assert calls[0][0] != calls[1][0]


def test_integrated_mesa_can_use_generic_empty_workspace() -> None:
    app = create_app(
        Settings(
            host_token=HOST_TOKEN,
            allowed_origins=(ORIGIN,),
            ticket_ttl_seconds=60,
        )
    )
    app.state.mesa_grant_verifier = _FakeVerifier(
        member=_member("master", campaign_id="caos-empty")
    )

    with TestClient(app) as client:
        access = _request(client)
        assert access.status_code == 200
        payload = access.json()
        assert payload["role"] == "master"
        with client.websocket_connect(
            f"/ws/vtt/rooms/{payload['roomId']}?ticket={payload['ticket']}",
            headers={"Origin": ORIGIN},
        ) as socket:
            snapshot = socket.receive_json()
            assert snapshot["role"] == "master"
            assert snapshot["roomId"] == payload["roomId"]
            assert snapshot["state"]["tokens"]["demo-token"]["label"] == "Agente de teste"


def test_catalog_is_isolated_to_the_linked_integrated_mesa(tmp_path: Path) -> None:
    app, _catalog, ids = _catalog_app(tmp_path)
    verifier = _FakeVerifier(
        member=_member(
            "master",
            mesa_id="mesa-generica",
            campaign_id="caos-empty",
        )
    )
    app.state.mesa_grant_verifier = verifier

    with TestClient(app) as client:
        generic_access = _request(client, mesa_id="mesa-generica")
        assert generic_access.status_code == 200
        generic = generic_access.json()
        with client.websocket_connect(
            f"/ws/vtt/rooms/{generic['roomId']}?ticket={generic['ticket']}",
            headers={"Origin": ORIGIN},
        ) as socket:
            snapshot = socket.receive_json()
            assert "catalog" not in snapshot["state"]
            assert snapshot["state"]["tokens"]["demo-token"]["label"] == "Agente de teste"

        leaked_asset = client.get(
            f"/api/vtt/rooms/{generic['roomId']}/assets",
            params={
                "assetId": ids["map_v2"],
                "access": generic["mediaToken"],
            },
        )
        assert leaked_asset.status_code == 404

        verifier.member = _member(
            "master",
            mesa_id="mesa-mnemosyne",
            campaign_id="memoria",
        )
        campaign_access = _request(client, mesa_id="mesa-mnemosyne")
        assert campaign_access.status_code == 200
        campaign = campaign_access.json()
        with client.websocket_connect(
            f"/ws/vtt/rooms/{campaign['roomId']}?ticket={campaign['ticket']}",
            headers={"Origin": ORIGIN},
        ) as socket:
            snapshot = socket.receive_json()
            assert snapshot["state"]["table"]["campaignId"] == "memoria"
            assert "catalog" in snapshot["state"]


def test_player_cannot_create_a_mesa_room_before_master(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_grant_verifier = _FakeVerifier(member=_member("player"))
    with TestClient(app) as client:
        response = _request(client)
    assert response.status_code == 409
    assert app.state.vtt.room_for_external_mesa("mesa-integrada") is None


def test_mesa_cannot_open_a_server_loaded_with_another_campaign(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_grant_verifier = _FakeVerifier(
        member=_member("master", campaign_id="outra-campanha")
    )
    with TestClient(app) as client:
        response = _request(client)
    assert response.status_code == 409
    assert app.state.vtt.room_for_external_mesa("mesa-integrada") is None


@pytest.mark.parametrize(
    ("error", "expected_status"),
    (
        (InvalidGrantError(), 403),
        (FirestoreUnavailableError(), 503),
    ),
)
def test_mesa_access_maps_grant_failures(
    tmp_path: Path,
    error: Exception,
    expected_status: int,
) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_grant_verifier = _FakeVerifier(error=error)
    with TestClient(app) as client:
        assert _request(client).status_code == expected_status


def test_challenge_is_required_one_time_and_bound_to_mesa(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    calls: list[tuple[str, str]] = []
    app.state.mesa_grant_verifier = _FakeVerifier(
        member=_member("master"),
        calls=calls,
    )
    with TestClient(app) as client:
        challenge = _new_challenge(client)
        payload = {"mesaId": "mesa-integrada", "challenge": challenge}
        assert client.post("/api/vtt/mesa-access", json=payload).status_code == 200
        assert client.post("/api/vtt/mesa-access", json=payload).status_code == 401

        other = _new_challenge(client, "outra-mesa")
        wrong = client.post(
            "/api/vtt/mesa-access",
            json={"mesaId": "mesa-integrada", "challenge": other},
        )
        assert wrong.status_code == 401
    assert calls == [(challenge, "mesa-integrada")]


def test_integrated_access_requires_configured_grant_verifier(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    with TestClient(app) as client:
        assert client.post(
            "/api/vtt/mesa-challenges",
            json={"mesaId": "mesa-integrada"},
        ).status_code == 503
        assert client.post(
            "/api/vtt/mesa-access",
            json={"mesaId": "mesa-integrada", "challenge": "a" * 43},
        ).status_code == 503


def test_integrated_room_rejects_legacy_invites(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_grant_verifier = _FakeVerifier(member=_member("master"))
    with TestClient(app) as client:
        access = _request(client).json()
        legacy = client.post(
            f"/api/vtt/rooms/{access['roomId']}/tickets",
            headers={"Authorization": "Bearer convite-legado-ainda-conhecido"},
        )
        assert legacy.status_code == 403


def test_expired_grant_revokes_media_and_pending_ticket(tmp_path: Path) -> None:
    app, _catalog, ids = _catalog_app(tmp_path)
    app.state.mesa_grant_verifier = _FakeVerifier(member=_member("master"))
    with TestClient(app) as client:
        access = _request(client).json()
        service = app.state.vtt
        session = service._tickets[access["ticket"]].mesa_session
        assert session is not None
        assert "challenge" not in repr(session).lower()
        session.expires_at = datetime.now(UTC) - timedelta(seconds=1)

        denied = client.get(
            f"/api/vtt/rooms/{access['roomId']}/assets",
            params={"assetId": ids["map_v2"], "access": access["mediaToken"]},
        )
        assert denied.status_code == 404
        assert access["ticket"] not in service._tickets
        assert not any(item.mesa_session is session for item in service._media_grants.values())


def test_websocket_watchdog_closes_when_short_grant_expires(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_grant_verifier = _FakeVerifier(member=_member("master"))
    with TestClient(app) as client:
        access = _request(client).json()
        session = app.state.vtt._tickets[access["ticket"]].mesa_session
        assert session is not None
        session.expires_at = datetime.now(UTC) + timedelta(milliseconds=50)
        with client.websocket_connect(
            f"/ws/vtt/rooms/{access['roomId']}?ticket={access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as socket:
            assert socket.receive_json()["role"] == "master"
            with pytest.raises(WebSocketDisconnect) as closed:
                socket.receive_json()
            assert closed.value.code == 4403
        assert session.revoked is True


def test_challenge_and_grant_are_never_persisted_with_integrated_room(
    tmp_path: Path,
) -> None:
    base_app, catalog, _ids = _catalog_app(tmp_path)
    state_db = tmp_path / "state" / "sessions.sqlite3"
    app = create_app(
        Settings(
            host_token=HOST_TOKEN,
            allowed_origins=(ORIGIN,),
            ticket_ttl_seconds=60,
            state_db_path=state_db,
        ),
        catalog=catalog,
    )
    del base_app
    calls: list[tuple[str, str]] = []
    app.state.mesa_grant_verifier = _FakeVerifier(
        member=_member("master"),
        calls=calls,
    )

    with TestClient(app) as client:
        assert _request(client).status_code == 200
        assert state_db.exists()

    challenge = calls[0][0]
    assert challenge.encode("utf-8") not in state_db.read_bytes()
