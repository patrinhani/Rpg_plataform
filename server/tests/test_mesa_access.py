from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import caos_vtt.api as api_module
from caos_vtt.firestore_auth import (
    FirestoreUnavailableError,
    MesaAccessForbiddenError,
    VerifiedMesaMember,
)
from caos_vtt import create_app
from caos_vtt.config import Settings
from conftest import HOST_TOKEN, ORIGIN
from test_campaign import _catalog_app


@dataclass
class _FakeVerifier:
    member: VerifiedMesaMember | None = None
    error: Exception | None = None
    calls: list[tuple[str, str]] | None = None

    def verify(self, id_token: str, mesa_id: str) -> VerifiedMesaMember:
        if self.calls is not None:
            self.calls.append((id_token, mesa_id))
        if self.error is not None:
            raise self.error
        assert self.member is not None
        return self.member


def _member(
    role: Literal["master", "player"], *, mesa_id: str = "mesa-integrada"
) -> VerifiedMesaMember:
    return VerifiedMesaMember(
        mesa_id=mesa_id,
        uid="uid-mestre" if role == "master" else "uid-jogador",
        role=role,
        room_name="Mnemosyne",
        campaign_id="memoria",
        linked_room_id=None,
        server_origin=None,
    )


def _request(client: TestClient, *, payload: dict[str, str] | None = None):
    return client.post(
        "/api/vtt/mesa-access",
        headers={"Authorization": "Bearer firebase-id-token"},
        json=payload or {"mesaId": "mesa-integrada"},
    )


def test_mesa_access_derives_role_and_reuses_room_with_legacy_invites_invalidated(
    tmp_path: Path,
) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    calls: list[tuple[str, str]] = []
    verifier = _FakeVerifier(member=_member("master"), calls=calls)
    app.state.mesa_verifier = verifier

    with TestClient(app) as client:
        first = _request(client)
        assert first.status_code == 200
        first_payload = first.json()
        assert first_payload["role"] == "master"
        room = app.state.vtt._rooms[first_payload["roomId"]]
        invite_digests = (room.master_invite_digest, room.player_invite_digest)

        second = _request(client)
        assert second.status_code == 200
        assert second.json()["roomId"] == first_payload["roomId"]
        assert (room.master_invite_digest, room.player_invite_digest) != invite_digests

        verifier.member = _member("player")
        player = _request(client)
        assert player.status_code == 200
        assert player.json()["role"] == "player"
        assert player.json()["roomId"] == first_payload["roomId"]

        # O papel nunca e aceito do navegador; somente o verificador o determina.
        forged = _request(
            client,
            payload={"mesaId": "mesa-integrada", "role": "master"},
        )
        assert forged.status_code == 422

    assert calls == [
        ("firebase-id-token", "mesa-integrada"),
        ("firebase-id-token", "mesa-integrada"),
        ("firebase-id-token", "mesa-integrada"),
    ]


def test_player_cannot_create_a_mesa_room_before_master(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_verifier = _FakeVerifier(member=_member("player"))
    with TestClient(app) as client:
        response = _request(client)
    assert response.status_code == 409
    assert app.state.vtt.room_for_external_mesa("mesa-integrada") is None


@pytest.mark.parametrize(
    ("verifier", "expected_status"),
    (
        (_FakeVerifier(error=MesaAccessForbiddenError()), 403),
        (_FakeVerifier(error=FirestoreUnavailableError()), 503),
    ),
)
def test_mesa_access_maps_trust_failures_without_network(
    tmp_path: Path,
    verifier: _FakeVerifier,
    expected_status: int,
) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    app.state.mesa_verifier = verifier
    with TestClient(app) as client:
        assert _request(client).status_code == expected_status


def test_mesa_access_requires_bearer_and_configured_verifier(tmp_path: Path) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    with TestClient(app) as client:
        missing_bearer = client.post(
            "/api/vtt/mesa-access",
            json={"mesaId": "mesa-integrada"},
        )
        assert missing_bearer.status_code == 401
        assert _request(client).status_code == 503


def test_integrated_room_rejects_legacy_invites_and_secure_reuse_keeps_mesa_grants(
    tmp_path: Path,
) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    verifier = _FakeVerifier(member=_member("master"))
    app.state.mesa_verifier = verifier

    with TestClient(app) as client:
        first = _request(client)
        assert first.status_code == 200
        access = first.json()
        room = app.state.vtt._rooms[access["roomId"]]
        session = app.state.vtt._tickets[access["ticket"]].mesa_session
        assert session is not None
        original_digests = (room.master_invite_digest, room.player_invite_digest)

        reused = _request(client)
        assert reused.status_code == 200
        assert reused.json()["roomId"] == room.room_id
        assert (room.master_invite_digest, room.player_invite_digest) != original_digests

        legacy = client.post(
            f"/api/vtt/rooms/{room.room_id}/tickets",
            headers={"Authorization": "Bearer convite-legado-ainda-conhecido"},
        )
        assert legacy.status_code == 403
        assert legacy.json()["detail"] == "Esta sala usa autenticacao pela Mesa"

        # Revalidar a sala nao remove um ticket emitido pela propria Mesa.
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room.room_id}?ticket={access['ticket']}",
            headers={"Origin": "http://localhost:5173"},
        ) as socket:
            assert socket.receive_json()["role"] == "master"
        assert session.id_token == ""


def test_secure_reuse_evicts_pending_legacy_access_from_an_old_room(
    tmp_path: Path,
) -> None:
    app, _catalog, _ids = _catalog_app(tmp_path)
    with TestClient(app) as client:
        created = client.post(
            "/api/vtt/rooms",
            headers={"Authorization": "Bearer host-token-for-tests-123456"},
            json={"name": "Sala criada por versao antiga", "campaignId": "memoria"},
        ).json()
        issued = client.post(
            f"/api/vtt/rooms/{created['roomId']}/tickets",
            headers={"Authorization": f"Bearer {created['playerInviteToken']}"},
        ).json()
        pending = client.post(
            f"/api/vtt/rooms/{created['roomId']}/tickets",
            headers={"Authorization": f"Bearer {created['playerInviteToken']}"},
        ).json()
        service = app.state.vtt
        room = service._rooms[created["roomId"]]
        assert issued["ticket"] in service._tickets
        assert pending["ticket"] in service._tickets
        assert any(grant.room_id == room.room_id for grant in service._media_grants.values())

        async def convert_like_a_legacy_integrated_room():
            room.external_mesa_id = "mesa-integrada"
            service._external_rooms["mesa-integrada"] = room.room_id
            return await service.ensure_room_for_mesa(
                "Sala integrada",
                campaign_id="memoria",
                external_mesa_id="mesa-integrada",
            )

        with client.websocket_connect(
            f"/ws/vtt/rooms/{room.room_id}?ticket={issued['ticket']}",
            headers={"Origin": "http://localhost:5173"},
        ) as socket:
            socket.receive_json()
            secured = client.portal.call(convert_like_a_legacy_integrated_room)
            with pytest.raises(WebSocketDisconnect) as closed:
                socket.receive_json()
            assert closed.value.code == 4403
        assert secured.room_id == room.room_id
        assert pending["ticket"] not in service._tickets
        assert not any(
            grant.room_id == room.room_id for grant in service._media_grants.values()
        )
        assert (
            client.post(
                f"/api/vtt/rooms/{room.room_id}/tickets",
                headers={"Authorization": f"Bearer {created['playerInviteToken']}"},
            ).status_code
            == 403
        )


def test_removed_member_loses_media_and_pending_ticket_on_revalidation(
    tmp_path: Path,
) -> None:
    app, _catalog, ids = _catalog_app(tmp_path)
    verifier = _FakeVerifier(member=_member("master"))
    app.state.mesa_verifier = verifier

    with TestClient(app) as client:
        response = _request(client)
        access = response.json()
        service = app.state.vtt
        grant = service._tickets[access["ticket"]]
        session = grant.mesa_session
        assert session is not None
        assert "firebase-id-token" not in repr(session)

        session.last_verified_at = 0
        verifier.error = MesaAccessForbiddenError()
        denied = client.get(
            f"/api/vtt/rooms/{access['roomId']}/assets",
            params={"assetId": ids["map_v2"], "access": access["mediaToken"]},
        )
        assert denied.status_code == 404
        assert session.revoked is True
        assert session.id_token == ""
        assert access["ticket"] not in service._tickets
        assert not any(item.mesa_session is session for item in service._media_grants.values())


def test_firestore_outage_has_bounded_grace_before_integrated_session_is_revoked(
    tmp_path: Path,
) -> None:
    app, _catalog, ids = _catalog_app(tmp_path)
    verifier = _FakeVerifier(member=_member("master"))
    app.state.mesa_verifier = verifier

    with TestClient(app) as client:
        access = _request(client).json()
        session = app.state.vtt._tickets[access["ticket"]].mesa_session
        assert session is not None
        verifier.error = FirestoreUnavailableError()
        url = f"/api/vtt/rooms/{access['roomId']}/assets"
        params = {"assetId": ids["map_v2"], "access": access["mediaToken"]}

        for expected_status in (200, 200, 404):
            session.last_verified_at = 0
            assert client.get(url, params=params).status_code == expected_status
        assert session.transient_failures == 3
        assert session.revoked is True


def test_websocket_watchdog_closes_session_after_membership_revocation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(api_module, "INTEGRATED_SESSION_REVALIDATE_SECONDS", 0.02)
    app, _catalog, _ids = _catalog_app(tmp_path)
    verifier = _FakeVerifier(member=_member("master"))
    app.state.mesa_verifier = verifier

    with TestClient(app) as client:
        access = _request(client).json()
        grant = app.state.vtt._tickets[access["ticket"]]
        session = grant.mesa_session
        assert session is not None
        with client.websocket_connect(
            f"/ws/vtt/rooms/{access['roomId']}?ticket={access['ticket']}",
            headers={"Origin": "http://localhost:5173"},
        ) as socket:
            assert socket.receive_json()["role"] == "master"
            verifier.error = MesaAccessForbiddenError()
            with pytest.raises(WebSocketDisconnect) as closed:
                socket.receive_json()
            assert closed.value.code == 4403
        assert session.revoked is True
        assert session.id_token == ""


def test_firebase_id_token_is_never_persisted_with_integrated_room(
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
    verifier = _FakeVerifier(member=_member("master"))
    app.state.mesa_verifier = verifier
    firebase_token = "firebase-id-token-que-nao-pode-ir-ao-disco"

    with TestClient(app) as client:
        response = client.post(
            "/api/vtt/mesa-access",
            headers={"Authorization": f"Bearer {firebase_token}"},
            json={"mesaId": "mesa-integrada"},
        )
        assert response.status_code == 200
        assert state_db.exists()

    assert firebase_token.encode("utf-8") not in state_db.read_bytes()
