from __future__ import annotations

import base64
import hashlib
import io
import json
import sqlite3
import zlib
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from caos_vtt import create_app
from caos_vtt.campaign import CampaignCatalog
from caos_vtt.config import Settings
from caos_vtt.firestore_auth import VerifiedMesaMember
from conftest import HOST_TOKEN, ORIGIN
from test_campaign import _campaign_fixture, _write_manifest


def _replace_image_asset(
    source_root: Path,
    manifest: dict[str, Any],
    asset_id: str,
    image: Image.Image,
) -> None:
    item = next(asset for asset in manifest["assets"] if asset["id"] == asset_id)
    path = source_root.joinpath(*item["relativePath"].split("/"))
    output = io.BytesIO()
    image.save(output, format="PNG")
    data = output.getvalue()
    path.write_bytes(data)
    item.update(
        {
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "mediaType": "image/png",
            "image": {
                "format": "PNG",
                "width": image.width,
                "height": image.height,
                "hasAlpha": image.mode == "RGBA",
                "viewBox": None,
            },
        }
    )


def _fog_app(tmp_path: Path, *, state_db_path: Path | None = None):
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    _replace_image_asset(
        source_root,
        manifest,
        ids["map_v2"],
        Image.new("RGB", (64, 64), (210, 30, 15)),
    )
    _replace_image_asset(
        source_root,
        manifest,
        ids["overlay"],
        Image.new("RGBA", (64, 64), (10, 40, 230, 128)),
    )
    _replace_image_asset(
        source_root,
        manifest,
        ids["prop"],
        Image.new("RGBA", (64, 64), (15, 230, 45, 255)),
    )
    _write_manifest(manifest_path, manifest)
    catalog = CampaignCatalog.load(manifest_path, {"memoria": source_root})
    app = create_app(
        Settings(
            host_token=HOST_TOKEN,
            allowed_origins=(ORIGIN,),
            ticket_ttl_seconds=60,
            state_db_path=state_db_path,
        ),
        catalog=catalog,
    )
    return app, ids


def _create_room(client: TestClient) -> dict[str, Any]:
    response = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": "Mesa com nevoa", "campaignId": "memoria"},
    )
    assert response.status_code == 201
    return response.json()


def _access(client: TestClient, room: dict[str, Any], invite_key: str) -> dict[str, Any]:
    response = client.post(
        f"/api/vtt/rooms/{room['roomId']}/tickets",
        headers={"Authorization": f"Bearer {room[invite_key]}"},
    )
    assert response.status_code == 200
    return response.json()


def _asset(client: TestClient, room_id: str, asset_id: str, access: str):
    return client.get(
        f"/api/vtt/rooms/{room_id}/assets",
        params={"assetId": asset_id, "access": access},
    )


def _fog_map(client: TestClient, room_id: str, access: str, revision: int):
    return client.get(
        f"/api/vtt/rooms/{room_id}/fog-map",
        params={"access": access, "revision": revision},
    )


def _decoded_mask(snapshot: dict[str, Any]) -> bytes:
    fog = snapshot["state"]["fog"]
    assert fog["encoding"] == "zlib-base64"
    return zlib.decompress(base64.b64decode(fog["data"], validate=True))


def _read_persisted_room(state_db: Path, room_id: str) -> dict[str, Any]:
    with sqlite3.connect(state_db) as connection:
        row = connection.execute(
            "SELECT payload_json FROM room_state WHERE room_id = ?", (room_id,)
        ).fetchone()
    assert row is not None
    return json.loads(row[0])


def _write_persisted_room(
    state_db: Path, room_id: str, payload: dict[str, Any]
) -> None:
    with sqlite3.connect(state_db) as connection:
        connection.execute(
            "UPDATE room_state SET payload_json = ? WHERE room_id = ?",
            (json.dumps(payload), room_id),
        )


def test_fog_is_server_composited_role_safe_and_hides_tokens(
    tmp_path: Path,
) -> None:
    app, ids = _fog_app(tmp_path)
    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _access(client, room, "masterInviteToken")
        player_access = _access(client, room, "playerInviteToken")
        path = f"/ws/vtt/rooms/{room['roomId']}"

        with client.websocket_connect(
            f"{path}?ticket={master_access['ticket']}", headers={"Origin": ORIGIN}
        ) as master, client.websocket_connect(
            f"{path}?ticket={player_access['ticket']}", headers={"Origin": ORIGIN}
        ) as player:
            master_initial = master.receive_json()
            player_initial = player.receive_json()
            assert len(_decoded_mask(master_initial)) == 256 * 256
            assert _decoded_mask(master_initial) == bytes(256 * 256)
            assert "data" not in player_initial["state"]["fog"]
            assert player_initial["state"]["fog"]["enabled"] is True

            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "spawn-center",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Agente no centro",
                        "x": 0.5,
                        "y": 0.5,
                    },
                }
            )
            master_spawn = master.receive_json()
            player_spawn = player.receive_json()
            token_id = next(iter(master_spawn["state"]["tokens"]))
            assert token_id in master_spawn["state"]["tokens"]
            assert player_spawn["state"]["tokens"] == {}
            assert master_spawn["state"]["fog"]["renderRevision"] == 0

            player.send_json(
                {
                    "type": "fog.set_enabled",
                    "commandId": "player-cannot-enable",
                    "payload": {"enabled": True},
                }
            )
            assert player.receive_json()["error"]["code"] == "forbidden"

            assert (
                _asset(
                    client,
                    room["roomId"],
                    ids["map_v2"],
                    player_access["mediaToken"],
                ).status_code
                == 404
            )
            assert (
                _asset(
                    client,
                    room["roomId"],
                    ids["overlay"],
                    player_access["mediaToken"],
                ).status_code
                == 404
            )
            assert (
                _asset(
                    client,
                    room["roomId"],
                    ids["map_v2"],
                    master_access["mediaToken"],
                ).status_code
                == 200
            )

            hidden_map = _fog_map(
                client,
                room["roomId"],
                player_access["mediaToken"],
                master_spawn["state"]["fog"]["renderRevision"],
            )
            assert hidden_map.status_code == 200
            assert hidden_map.headers["content-type"] == "image/webp"
            with Image.open(io.BytesIO(hidden_map.content)) as image:
                pixel = image.convert("RGB").getpixel((32, 32))
                assert max(pixel) < 15

            master.send_json(
                {
                    "type": "fog.stroke",
                    "commandId": "reveal-center",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.1,
                        "reveal": True,
                    },
                }
            )
            master_revealed = master.receive_json()
            player_revealed = player.receive_json()
            assert master_revealed["state"]["fog"]["revision"] == 1
            assert master_revealed["state"]["fog"]["renderRevision"] == 1
            assert token_id in player_revealed["state"]["tokens"]
            assert _decoded_mask(master_revealed)[128 * 256 + 128] == 255

            revealed_map = _fog_map(
                client,
                room["roomId"],
                player_access["mediaToken"],
                master_revealed["state"]["fog"]["renderRevision"],
            )
            assert revealed_map.status_code == 200
            with Image.open(io.BytesIO(revealed_map.content)) as image:
                rgb = image.convert("RGB")
                center = rgb.getpixel((32, 32))
                corner = rgb.getpixel((0, 0))
                assert center[0] > 150 and center[1] < 70
                assert max(corner) < 15

            master.send_json(
                {
                    "type": "fog.stroke",
                    "commandId": "hide-center",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.1,
                        "reveal": False,
                    },
                }
            )
            master.receive_json()
            assert token_id not in player.receive_json()["state"]["tokens"]
            player.send_json(
                {
                    "type": "token.move",
                    "commandId": "move-through-fog",
                    "payload": {"tokenId": token_id, "x": 0.6, "y": 0.6},
                }
            )
            assert player.receive_json()["error"]["code"] == "token_forbidden"

            master.send_json(
                {
                    "type": "overlay.set",
                    "commandId": "overlay-under-fog",
                    "payload": {"assetId": ids["overlay"], "enabled": True},
                }
            )
            master_overlay = master.receive_json()
            player.receive_json()
            assert master_overlay["state"]["fog"]["renderRevision"] == 3
            master.send_json(
                {"type": "fog.reveal_all", "commandId": "reveal-everything"}
            )
            master_all = master.receive_json()
            player_all = player.receive_json()
            assert token_id in player_all["state"]["tokens"]
            assert player_all["state"]["scene"]["overlays"] == []
            all_map = _fog_map(
                client,
                room["roomId"],
                player_access["mediaToken"],
                master_all["state"]["fog"]["renderRevision"],
            )
            assert all_map.status_code == 200
            with Image.open(io.BytesIO(all_map.content)) as image:
                red, _green, blue = image.convert("RGB").getpixel((32, 32))
                assert red > 70 and blue > 70

            master.send_json({"type": "fog.reset", "commandId": "hide-everything"})
            master_reset = master.receive_json()
            player_reset = player.receive_json()
            assert _decoded_mask(master_reset) == bytes(256 * 256)
            assert player_reset["state"]["tokens"] == {}


def test_invalid_fog_commands_are_rejected_before_mutation(tmp_path: Path) -> None:
    app, _ids = _fog_app(tmp_path)
    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            invalid_commands = (
                {
                    "type": "fog.stroke",
                    "commandId": "no-points",
                    "payload": {"points": [], "radius": 0.1, "reveal": True},
                },
                {
                    "type": "fog.stroke",
                    "commandId": "radius-too-large",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.9,
                        "reveal": True,
                    },
                },
                {
                    "type": "fog.reset",
                    "commandId": "reset-with-extra",
                    "payload": {},
                },
            )
            for command in invalid_commands:
                master.send_text(json.dumps(command))
                error = master.receive_json()
                assert error["type"] == "error"
                assert error["error"]["code"].startswith("invalid_fog_")
            assert app.state.vtt._rooms[room["roomId"]].revision == 0


def test_props_are_separate_server_composited_and_persisted(tmp_path: Path) -> None:
    state_db = tmp_path / "props-state.sqlite3"
    app, ids = _fog_app(tmp_path, state_db_path=state_db)
    with TestClient(app) as client:
        response = client.post(
            "/api/vtt/rooms",
            headers={"Authorization": f"Bearer {HOST_TOKEN}"},
            json={
                "name": "Mesa com objetos",
                "campaignId": "memoria",
            },
        )
        assert response.status_code == 201
        room = response.json()
        master_access = _access(client, room, "masterInviteToken")
        player_access = _access(client, room, "playerInviteToken")
        path = f"/ws/vtt/rooms/{room['roomId']}"
        with client.websocket_connect(
            f"{path}?ticket={master_access['ticket']}", headers={"Origin": ORIGIN}
        ) as master, client.websocket_connect(
            f"{path}?ticket={player_access['ticket']}", headers={"Origin": ORIGIN}
        ) as player:
            master_initial = master.receive_json()
            player.receive_json()
            assert [
                item["assetId"]
                for item in master_initial["state"]["catalog"]["propAssets"]
            ] == [ids["prop"]]

            player.send_json(
                {
                    "type": "prop.spawn",
                    "commandId": "player-cannot-spawn-prop",
                    "payload": {
                        "assetId": ids["prop"],
                        "label": "Nao autorizado",
                        "x": 0.5,
                        "y": 0.5,
                    },
                }
            )
            assert player.receive_json()["error"]["code"] == "forbidden"

            master.send_json(
                {
                    "type": "prop.spawn",
                    "commandId": "spawn-corpo-conectado",
                    "payload": {
                        "assetId": ids["prop"],
                        "label": "Corpo conectado",
                        "x": 0.5,
                        "y": 0.5,
                        "width": 0.5,
                        "height": 0.5,
                        "rotation": 15,
                    },
                }
            )
            master_spawn = master.receive_json()
            player_spawn = player.receive_json()
            prop_id = next(iter(master_spawn["state"]["props"]))
            assert player_spawn["state"]["props"] == {}
            assert (
                _asset(
                    client,
                    room["roomId"],
                    ids["prop"],
                    player_access["mediaToken"],
                ).status_code
                == 404
            )

            master.send_json(
                {
                    "type": "fog.stroke",
                    "commandId": "reveal-prop-center",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.12,
                        "reveal": True,
                    },
                }
            )
            master_revealed = master.receive_json()
            player_revealed = player.receive_json()
            assert player_revealed["state"]["props"] == {}
            rendered = _fog_map(
                client,
                room["roomId"],
                player_access["mediaToken"],
                master_revealed["state"]["fog"]["renderRevision"],
            )
            assert rendered.status_code == 200
            with Image.open(io.BytesIO(rendered.content)) as image:
                red, green, blue = image.convert("RGB").getpixel((32, 32))
                assert green > 150 and green > red * 2 and green > blue * 2

            master.send_json(
                {
                    "type": "prop.update",
                    "commandId": "move-corpo-conectado",
                    "payload": {
                        "propId": prop_id,
                        "label": "Corpo reposicionado",
                        "x": 0.65,
                        "rotation": -30,
                        "width": 0.35,
                        "height": 0.35,
                    },
                }
            )
            updated = master.receive_json()
            player.receive_json()
            assert updated["state"]["props"][prop_id]["x"] == 0.65
            assert updated["state"]["props"][prop_id]["rotation"] == -30
            assert updated["state"]["props"][prop_id]["label"] == "Corpo reposicionado"

    restarted = create_app(app.state.settings, catalog=app.state.catalog)
    with TestClient(restarted) as client:
        assert restarted.state.vtt.room_exists(room["roomId"])
        access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            restored = master.receive_json()
            assert restored["state"]["props"][prop_id]["x"] == 0.65
            assert restored["state"]["props"][prop_id]["label"] == "Corpo reposicionado"
            master.send_json(
                {
                    "type": "prop.remove",
                    "commandId": "remove-corpo-conectado",
                    "payload": {"propId": prop_id},
                }
            )
            assert master.receive_json()["state"]["props"] == {}


def test_integrated_room_and_fog_survive_restart_without_persisting_firebase_tokens(
    tmp_path: Path,
) -> None:
    class RoleVerifier:
        def __init__(self, room_name: str) -> None:
            self.room_name = room_name

        def verify(self, id_token: str, mesa_id: str) -> VerifiedMesaMember:
            role = "master" if id_token == "firebase-master-token" else "player"
            return VerifiedMesaMember(
                mesa_id=mesa_id,
                uid="uid-mestre" if role == "master" else "uid-jogador",
                role=role,
                room_name=self.room_name,
                campaign_id="memoria",
                linked_room_id=None,
                server_origin=None,
            )

    def integrated_access(client: TestClient, id_token: str):
        return client.post(
            "/api/vtt/mesa-access",
            headers={"Authorization": f"Bearer {id_token}"},
            json={"mesaId": "mesa-firebase-persistente"},
        )

    state_db = tmp_path / "state" / "sessions.sqlite3"
    first_app, ids = _fog_app(tmp_path, state_db_path=state_db)
    first_app.state.mesa_verifier = RoleVerifier("Mnemosyne persistente")
    with TestClient(first_app) as client:
        response = integrated_access(client, "firebase-master-token")
        assert response.status_code == 200
        master_access = response.json()
        room_id = master_access["roomId"]
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room_id}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            for command in (
                {
                    "type": "token.spawn",
                    "commandId": "persisted-token",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Agente persistido",
                        "x": 0.5,
                        "y": 0.5,
                    },
                },
                {
                    "type": "fog.set_enabled",
                    "commandId": "persisted-enable",
                    "payload": {"enabled": True},
                },
                {
                    "type": "fog.stroke",
                    "commandId": "persisted-stroke",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.08,
                        "reveal": True,
                    },
                },
            ):
                master.send_json(command)
                persisted_snapshot = master.receive_json()
        persisted_revision = persisted_snapshot["revision"]
        persisted_fog_revision = persisted_snapshot["state"]["fog"]["revision"]

    raw_database = state_db.read_bytes()
    assert b"firebase-master-token" not in raw_database

    restarted_app = create_app(
        first_app.state.settings,
        catalog=first_app.state.catalog,
    )
    restarted_app.state.mesa_verifier = RoleVerifier("Mnemosyne recuperada")
    with TestClient(restarted_app) as client:
        assert restarted_app.state.vtt.room_exists(room_id)
        legacy_invite = client.post(
            f"/api/vtt/rooms/{room_id}/tickets",
            headers={"Authorization": "Bearer qualquer-convite-antigo"},
        )
        assert legacy_invite.status_code == 403

        recovered = integrated_access(client, "firebase-master-token")
        assert recovered.status_code == 200
        fresh_master = recovered.json()
        fresh_player_response = integrated_access(client, "firebase-player-token")
        assert fresh_player_response.status_code == 200
        fresh_player = fresh_player_response.json()
        assert fresh_master["roomId"] == room_id
        assert fresh_master["revision"] == persisted_revision
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room_id}?ticket={fresh_master['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master, client.websocket_connect(
            f"/ws/vtt/rooms/{room_id}?ticket={fresh_player['ticket']}",
            headers={"Origin": ORIGIN},
        ) as player:
            master_snapshot = master.receive_json()
            player_snapshot = player.receive_json()
            assert master_snapshot["revision"] == persisted_revision
            assert master_snapshot["state"]["table"]["name"] == "Mnemosyne recuperada"
            assert master_snapshot["state"]["fog"]["revision"] == persisted_fog_revision
            assert _decoded_mask(master_snapshot)[128 * 256 + 128] == 255
            assert "data" not in player_snapshot["state"]["fog"]
            assert any(
                token["label"] == "Agente persistido"
                for token in player_snapshot["state"]["tokens"].values()
            )


def test_storage_tolerates_legacy_missing_fog_and_corrupt_rows(tmp_path: Path) -> None:
    state_db = tmp_path / "sessions.sqlite3"
    app, _ids = _fog_app(tmp_path, state_db_path=state_db)
    with TestClient(app) as client:
        room = client.post(
            "/api/vtt/rooms",
            headers={"Authorization": f"Bearer {HOST_TOKEN}"},
            json={
                "name": "Sala migrada",
                "campaignId": "memoria",
            },
        ).json()

    with sqlite3.connect(state_db) as connection:
        raw = connection.execute(
            "SELECT payload_json FROM room_state WHERE room_id = ?", (room["roomId"],)
        ).fetchone()[0]
        payload = json.loads(raw)
        for scene in payload["scenes"].values():
            scene.pop("fog", None)
        connection.execute(
            "UPDATE room_state SET payload_json = ? WHERE room_id = ?",
            (json.dumps(payload), room["roomId"]),
        )

    migrated = create_app(app.state.settings, catalog=app.state.catalog)
    restored = migrated.state.vtt._rooms[room["roomId"]]
    assert all(fog.enabled and fog.revision == 0 for fog in restored.scene_fog.values())

    with sqlite3.connect(state_db) as connection:
        connection.execute(
            "UPDATE room_state SET payload_json = '{not-json' WHERE room_id = ?",
            (room["roomId"],),
        )
    with pytest.warns(RuntimeWarning, match="sala persistida invalida"):
        ignored = create_app(app.state.settings, catalog=app.state.catalog)
    assert not ignored.state.vtt.room_exists(room["roomId"])


@pytest.mark.parametrize("fingerprint_state", ("missing", "divergent"))
def test_persisted_fog_resets_closed_when_map_fingerprint_is_stale(
    tmp_path: Path,
    fingerprint_state: str,
) -> None:
    state_db = tmp_path / f"fog-fingerprint-{fingerprint_state}.sqlite3"
    app, ids = _fog_app(tmp_path, state_db_path=state_db)
    with TestClient(app) as client:
        response = client.post(
            "/api/vtt/rooms",
            headers={"Authorization": f"Bearer {HOST_TOKEN}"},
            json={
                "name": "Mesa vinculada ao mapa",
                "campaignId": "memoria",
            },
        )
        assert response.status_code == 201
        room = response.json()
        access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            master.send_json(
                {
                    "type": "fog.stroke",
                    "commandId": "reveal-before-map-change",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.1,
                        "reveal": True,
                    },
                }
            )
            revealed = master.receive_json()
            assert revealed["state"]["fog"]["revision"] == 1
            assert _decoded_mask(revealed)[128 * 256 + 128] == 255

    payload = _read_persisted_room(state_db, room["roomId"])
    scene = payload["scenes"]["scene:salao-vazio"]
    assert scene["fog"]["mapAssetId"] == ids["map_v2"]
    if fingerprint_state == "missing":
        scene["fog"].pop("mapFingerprint")
    else:
        scene["fog"]["mapFingerprint"] = "sha256:outro;bytes:1;image:1x1"
    _write_persisted_room(state_db, room["roomId"], payload)

    with pytest.warns(RuntimeWarning, match="Mapa da cena mudou"):
        restarted = create_app(app.state.settings, catalog=app.state.catalog)
    assert restarted.state.vtt.room_exists(room["roomId"])

    with TestClient(restarted) as client:
        access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            restored = master.receive_json()
            assert restored["state"]["fog"]["enabled"] is True
            assert restored["state"]["fog"]["revision"] == 0
            assert restored["state"]["fog"]["renderRevision"] == 0
            assert _decoded_mask(restored) == bytes(256 * 256)

    with sqlite3.connect(state_db) as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM room_state WHERE room_id = ?", (room["roomId"],)
        ).fetchone()[0] == 1
        assert connection.execute(
            "SELECT COUNT(*) FROM invalid_room_state WHERE room_id = ?",
            (room["roomId"],),
        ).fetchone()[0] == 0


def test_restore_ignores_entities_whose_asset_kind_changed_without_quarantine(
    tmp_path: Path,
) -> None:
    state_db = tmp_path / "changed-asset-kind.sqlite3"
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)

    original_prop = next(
        asset for asset in manifest["assets"] if asset["id"] == ids["prop"]
    )
    valid_prop_id = "asset:assets/objetos/ancora-estavel-objeto-vtt-v1.bin"
    valid_prop_path = source_root.joinpath(
        *"assets/objetos/ancora-estavel-objeto-vtt-v1.bin".split("/")
    )
    valid_prop_path.parent.mkdir(parents=True, exist_ok=True)
    valid_prop_data = b"prop-estavel"
    valid_prop_path.write_bytes(valid_prop_data)
    valid_prop = dict(original_prop)
    valid_prop.update(
        {
            "id": valid_prop_id,
            "relativePath": "assets/objetos/ancora-estavel-objeto-vtt-v1.bin",
            "bytes": len(valid_prop_data),
            "sha256": hashlib.sha256(valid_prop_data).hexdigest(),
        }
    )
    manifest["assets"].append(valid_prop)
    manifest["collections"]["propAssetIds"].append(valid_prop_id)
    _write_manifest(manifest_path, manifest)

    initial_catalog = CampaignCatalog.load(manifest_path, {"memoria": source_root})
    settings = Settings(
        host_token=HOST_TOKEN,
        allowed_origins=(ORIGIN,),
        ticket_ttl_seconds=60,
        state_db_path=state_db,
    )
    initial_app = create_app(settings, catalog=initial_catalog)
    with TestClient(initial_app) as client:
        response = client.post(
            "/api/vtt/rooms",
            headers={"Authorization": f"Bearer {HOST_TOKEN}"},
            json={
                "name": "Mesa antes da evolucao do catalogo",
                "campaignId": "memoria",
            },
        )
        assert response.status_code == 201
        room = response.json()
        access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            commands = (
                {
                    "type": "token.spawn",
                    "commandId": "spawn-token-kind-obsoleto",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Token com kind alterado",
                        "x": 0.3,
                        "y": 0.3,
                    },
                },
                {
                    "type": "token.spawn",
                    "commandId": "spawn-token-ainda-valido",
                    "payload": {
                        "assetId": ids["token_public_gm"],
                        "label": "Token ainda valido",
                        "x": 0.7,
                        "y": 0.7,
                    },
                },
                {
                    "type": "prop.spawn",
                    "commandId": "spawn-prop-kind-obsoleto",
                    "payload": {
                        "assetId": ids["prop"],
                        "label": "Objeto com kind alterado",
                        "x": 0.35,
                        "y": 0.35,
                    },
                },
                {
                    "type": "prop.spawn",
                    "commandId": "spawn-prop-ainda-valido",
                    "payload": {
                        "assetId": valid_prop_id,
                        "label": "Objeto ainda valido",
                        "x": 0.65,
                        "y": 0.65,
                    },
                },
            )
            snapshots = []
            for command in commands:
                master.send_json(command)
                snapshots.append(master.receive_json())

    last_state = snapshots[-1]["state"]
    stale_token_id = next(
        token_id
        for token_id, token in last_state["tokens"].items()
        if token["label"] == "Token com kind alterado"
    )
    valid_token_id = next(
        token_id
        for token_id, token in last_state["tokens"].items()
        if token["label"] == "Token ainda valido"
    )
    stale_prop_id = next(
        prop_id
        for prop_id, prop in last_state["props"].items()
        if prop["label"] == "Objeto com kind alterado"
    )
    valid_prop_runtime_id = next(
        prop_id
        for prop_id, prop in last_state["props"].items()
        if prop["label"] == "Objeto ainda valido"
    )

    assets_by_id = {asset["id"]: asset for asset in manifest["assets"]}
    assets_by_id[ids["token_player"]]["kind"] = "prop"
    assets_by_id[ids["prop"]]["kind"] = "token"
    manifest["collections"]["tokenAssetIds"] = [
        asset_id
        for asset_id in manifest["collections"]["tokenAssetIds"]
        if asset_id != ids["token_player"]
    ] + [ids["prop"]]
    manifest["collections"]["propAssetIds"] = [
        asset_id
        for asset_id in manifest["collections"]["propAssetIds"]
        if asset_id != ids["prop"]
    ] + [ids["token_player"]]
    manifest["collections"]["stateGroups"] = []
    _write_manifest(manifest_path, manifest)
    evolved_catalog = CampaignCatalog.load(manifest_path, {"memoria": source_root})

    with pytest.warns(RuntimeWarning) as warnings_seen:
        evolved_app = create_app(settings, catalog=evolved_catalog)
    warning_messages = [str(item.message) for item in warnings_seen]
    assert any("Token persistido com asset obsoleto" in item for item in warning_messages)
    assert any("Objeto persistido com asset obsoleto" in item for item in warning_messages)
    assert evolved_app.state.vtt.room_exists(room["roomId"])

    with TestClient(evolved_app) as client:
        access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            restored = master.receive_json()["state"]
            assert stale_token_id not in restored["tokens"]
            assert stale_prop_id not in restored["props"]
            assert restored["tokens"][valid_token_id]["label"] == "Token ainda valido"
            assert (
                restored["props"][valid_prop_runtime_id]["label"]
                == "Objeto ainda valido"
            )

    with sqlite3.connect(state_db) as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM room_state WHERE room_id = ?", (room["roomId"],)
        ).fetchone()[0] == 1
        assert connection.execute(
            "SELECT COUNT(*) FROM invalid_room_state WHERE room_id = ?",
            (room["roomId"],),
        ).fetchone()[0] == 0


def test_file_level_corruption_is_quarantined_and_recreated(tmp_path: Path) -> None:
    state_db = tmp_path / "broken.sqlite3"
    state_db.write_bytes(b"not-a-sqlite-database")
    campaign_tmp = tmp_path / "campaign"
    campaign_tmp.mkdir()
    manifest_app, _ids = _fog_app(campaign_tmp, state_db_path=None)
    settings = Settings(
        host_token=HOST_TOKEN,
        allowed_origins=(ORIGIN,),
        state_db_path=state_db,
    )
    with pytest.warns(RuntimeWarning, match="corrompido foi isolado"):
        app = create_app(settings, catalog=manifest_app.state.catalog)
    assert state_db.is_file()
    assert list(tmp_path.glob("broken.sqlite3.corrupt-*"))
    with TestClient(app) as client:
        assert _create_room(client)["revision"] == 0
