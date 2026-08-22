from __future__ import annotations

import hashlib
import io
import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from caos_vtt import create_app
from caos_vtt.campaign import CampaignCatalog
from caos_vtt.config import Settings
from caos_vtt.firestore_auth import VerifiedMesaGrant
from caos_vtt.service import CatalogToken, FogRegion, FogState, Room, VTTService
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


def _fog_app(
    tmp_path: Path,
    *,
    state_db_path: Path | None = None,
    with_preset: bool = False,
):
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    if with_preset:
        manifest["collections"]["scenes"][0]["fogPreset"] = {
            "revision": 1,
            "regions": [
                {
                    "regionId": "preset:entrada",
                    "label": "Entrada oficial",
                    "points": [
                        {"x": 0.1, "y": 0.1},
                        {"x": 0.4, "y": 0.1},
                        {"x": 0.4, "y": 0.4},
                        {"x": 0.1, "y": 0.4},
                    ],
                }
            ],
        }
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


def test_token_requires_its_visual_footprint_to_be_revealed() -> None:
    room = Room(
        room_id="room-footprint",
        name="Pegada visual",
        master_invite_digest=b"master",
        player_invite_digest=b"player",
    )
    fog = FogState(
        regions={
            "narrow": FogRegion(
                region_id="narrow",
                label="Fresta revelada",
                points=((0.47, 0.47), (0.53, 0.47), (0.53, 0.53), (0.47, 0.53)),
                revealed=True,
            )
        }
    )
    room.scene_fog["scene"] = fog
    token = CatalogToken(
        token_id="token",
        asset_id="asset",
        x=0.5,
        y=0.5,
        label="Nome protegido",
        size=0.08,
        movable=False,
        visible=True,
    )

    assert VTTService._fog_reveals_point(fog, token.x, token.y) is True
    assert VTTService._token_visible_to_player(room, "scene", token) is False

    fog.regions["narrow"] = FogRegion(
        region_id="narrow",
        label="Sala revelada",
        points=((0.35, 0.35), (0.65, 0.35), (0.65, 0.65), (0.35, 0.65)),
        revealed=True,
    )
    assert VTTService._token_visible_to_player(room, "scene", token) is True

    token.visible = False
    fog.reveal_all = True
    assert VTTService._token_visible_to_player(room, "scene", token) is False


def test_campaign_fog_presets_seed_rooms_and_can_be_restored_safely(tmp_path: Path) -> None:
    app, _ids = _fog_app(tmp_path, with_preset=True)
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
            assert master_initial["state"]["scene"]["fogPreset"] == {
                "revision": 1,
                "regionCount": 1,
            }
            assert master_initial["state"]["fog"]["regions"][0]["label"] == "Entrada oficial"
            assert player_initial["state"]["fog"]["regions"] == []
            assert "fogPreset" not in player_initial["state"]["scene"]

            master.send_json(
                {
                    "type": "fog.region.remove",
                    "commandId": "remove-official-region",
                    "payload": {"regionId": "preset:entrada"},
                }
            )
            master.receive_json()
            player.receive_json()
            master.send_json({"type": "fog.preset.apply", "commandId": "restore-scene"})
            restored = master.receive_json()
            player.receive_json()
            assert [item["regionId"] for item in restored["state"]["fog"]["regions"]] == [
                "preset:entrada"
            ]

            player.send_json({"type": "fog.presets.apply_all", "commandId": "player-restore-all"})
            assert player.receive_json()["error"]["code"] == "forbidden"
            master.send_json({"type": "fog.presets.apply_all", "commandId": "master-restore-all"})
            reapplied = master.receive_json()
            player.receive_json()
            assert reapplied["state"]["fog"]["regions"][0]["revealed"] is False


def test_fog_regions_are_role_safe_and_filter_tokens_without_server_rendering(
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
            assert master_initial["state"]["fog"]["mode"] == "regions"
            assert master_initial["state"]["fog"]["regions"] == []
            assert player_initial["state"]["fog"]["enabled"] is True
            assert player_initial["state"]["fog"]["regions"] == []

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

            player.send_json(
                {
                    "type": "fog.set_enabled",
                    "commandId": "player-cannot-enable",
                    "payload": {"enabled": True},
                }
            )
            assert player.receive_json()["error"]["code"] == "forbidden"

            # A névoa é desenhada no navegador; o servidor não compõe cópias do mapa.
            assert _asset(
                client,
                room["roomId"],
                ids["map_v2"],
                player_access["mediaToken"],
            ).status_code == 200
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

            master.send_json(
                {
                    "type": "fog.region.create",
                    "commandId": "create-center-room",
                    "payload": {
                        "regionId": "center-room",
                        "label": "Sala central",
                        "points": [
                            {"x": 0.4, "y": 0.4},
                            {"x": 0.6, "y": 0.4},
                            {"x": 0.6, "y": 0.6},
                            {"x": 0.4, "y": 0.6},
                        ],
                    },
                }
            )
            master_created = master.receive_json()
            player_created = player.receive_json()
            assert player_created["state"]["tokens"] == {}
            assert player_created["state"]["fog"]["regions"] == []
            assert master_created["state"]["fog"]["regions"][0]["revealed"] is False

            master.send_json(
                {
                    "type": "fog.region.set_revealed",
                    "commandId": "reveal-center-room",
                    "payload": {"regionIds": ["center-room"], "revealed": True},
                }
            )
            master_revealed = master.receive_json()
            player_revealed = player.receive_json()
            assert master_revealed["state"]["fog"]["revision"] == 2
            assert master_revealed["state"]["fog"]["revealAll"] is False
            assert token_id in player_revealed["state"]["tokens"]
            assert "label" not in player_revealed["state"]["fog"]["regions"][0]

            master.send_json(
                {
                    "type": "fog.region.update",
                    "commandId": "move-center-room-away",
                    "payload": {
                        "regionId": "center-room",
                        "label": "Sala central ajustada",
                        "points": [
                            {"x": 0.05, "y": 0.05},
                            {"x": 0.2, "y": 0.05},
                            {"x": 0.2, "y": 0.2},
                            {"x": 0.05, "y": 0.2},
                        ],
                    },
                }
            )
            master_updated = master.receive_json()
            player_updated = player.receive_json()
            assert master_updated["state"]["fog"]["regions"][0]["revealed"] is True
            assert player_updated["state"]["tokens"] == {}

            master.send_json(
                {
                    "type": "fog.region.update",
                    "commandId": "restore-center-room",
                    "payload": {
                        "regionId": "center-room",
                        "label": "Sala central",
                        "points": [
                            {"x": 0.4, "y": 0.4},
                            {"x": 0.6, "y": 0.4},
                            {"x": 0.6, "y": 0.6},
                            {"x": 0.4, "y": 0.6},
                        ],
                    },
                }
            )
            master.receive_json()
            assert token_id in player.receive_json()["state"]["tokens"]

            master.send_json(
                {
                    "type": "fog.region.set_revealed",
                    "commandId": "hide-center-room",
                    "payload": {"regionIds": ["center-room"], "revealed": False},
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
            player_overlay = player.receive_json()
            assert master_overlay["state"]["scene"]["overlays"]
            assert player_overlay["state"]["scene"]["overlays"]
            master.send_json(
                {"type": "fog.reveal_all", "commandId": "reveal-everything"}
            )
            master_all = master.receive_json()
            player_all = player.receive_json()
            assert token_id in player_all["state"]["tokens"]
            assert player_all["state"]["fog"]["revealAll"] is True
            assert master_all["state"]["fog"]["regions"][0]["revealed"] is True

            master.send_json({"type": "fog.reset", "commandId": "hide-everything"})
            master_reset = master.receive_json()
            player_reset = player.receive_json()
            assert master_reset["state"]["fog"]["revealAll"] is False
            assert master_reset["state"]["fog"]["regions"][0]["revealed"] is False
            assert player_reset["state"]["tokens"] == {}

            master.send_json(
                {
                    "type": "fog.region.remove",
                    "commandId": "remove-center-room",
                    "payload": {"regionId": "center-room"},
                }
            )
            assert master.receive_json()["state"]["fog"]["regions"] == []
            assert player.receive_json()["state"]["fog"]["regions"] == []

            # O endpoint pesado de composição deixou de existir.
            assert client.get(
                f"/api/vtt/rooms/{room['roomId']}/fog-map",
                params={"access": player_access["mediaToken"]},
            ).status_code == 404


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
            master.send_json(
                {
                    "type": "fog.stroke",
                    "commandId": "legacy-valid-brush",
                    "payload": {
                        "points": [{"x": 0.5, "y": 0.5}],
                        "radius": 0.1,
                        "reveal": True,
                    },
                }
            )
            assert master.receive_json()["error"]["code"] == "fog_regions_required"
            assert app.state.vtt._rooms[room["roomId"]].revision == 0


def test_props_are_region_filtered_and_persisted(tmp_path: Path) -> None:
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
                    "type": "fog.region.create",
                    "commandId": "create-prop-room",
                    "payload": {
                        "regionId": "prop-room",
                        "label": "Sala do objeto",
                        "points": [
                            {"x": 0.35, "y": 0.35},
                            {"x": 0.65, "y": 0.35},
                            {"x": 0.65, "y": 0.65},
                            {"x": 0.35, "y": 0.65},
                        ],
                    },
                }
            )
            master.receive_json()
            assert player.receive_json()["state"]["props"] == {}
            master.send_json(
                {
                    "type": "fog.region.set_revealed",
                    "commandId": "reveal-prop-room",
                    "payload": {"regionIds": ["prop-room"], "revealed": True},
                }
            )
            master.receive_json()
            player_revealed = player.receive_json()
            assert prop_id in player_revealed["state"]["props"]
            assert _asset(
                client,
                room["roomId"],
                ids["prop"],
                player_access["mediaToken"],
            ).status_code == 200

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


def test_integrated_room_and_fog_survive_restart_without_persisting_access_grants(
    tmp_path: Path,
) -> None:
    class RoleVerifier:
        def __init__(self, room_name: str) -> None:
            self.room_name = room_name
            self.role = "master"
            self.challenges: list[str] = []

        def verify(self, challenge: str, mesa_id: str) -> VerifiedMesaGrant:
            now = datetime.now(UTC)
            self.challenges.append(challenge)
            return VerifiedMesaGrant(
                mesa_id=mesa_id,
                uid="uid-mestre" if self.role == "master" else "uid-jogador",
                role=self.role,
                room_name=self.room_name,
                campaign_id="memoria",
                issued_at=now,
                expires_at=now + timedelta(minutes=5),
            )

    def integrated_access(client: TestClient, verifier: RoleVerifier, role: str):
        verifier.role = role
        challenge_response = client.post(
            "/api/vtt/mesa-challenges",
            json={"mesaId": "mesa-firebase-persistente"},
        )
        assert challenge_response.status_code == 200
        return client.post(
            "/api/vtt/mesa-access",
            json={
                "mesaId": "mesa-firebase-persistente",
                "challenge": challenge_response.json()["challenge"],
            },
        )

    state_db = tmp_path / "state" / "sessions.sqlite3"
    first_app, ids = _fog_app(tmp_path, state_db_path=state_db)
    first_verifier = RoleVerifier("Mnemosyne persistente")
    first_app.state.mesa_grant_verifier = first_verifier
    with TestClient(first_app) as client:
        response = integrated_access(client, first_verifier, "master")
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
                    "type": "fog.region.create",
                    "commandId": "persisted-region",
                    "payload": {
                        "regionId": "persisted-room",
                        "label": "Sala persistida",
                        "points": [
                            {"x": 0.4, "y": 0.4},
                            {"x": 0.6, "y": 0.4},
                            {"x": 0.6, "y": 0.6},
                            {"x": 0.4, "y": 0.6},
                        ],
                    },
                },
                {
                    "type": "fog.region.set_revealed",
                    "commandId": "persisted-region-revealed",
                    "payload": {"regionIds": ["persisted-room"], "revealed": True},
                },
            ):
                master.send_json(command)
                persisted_snapshot = master.receive_json()
        persisted_revision = persisted_snapshot["revision"]
        persisted_fog_revision = persisted_snapshot["state"]["fog"]["revision"]

    raw_database = state_db.read_bytes()
    assert all(challenge.encode("utf-8") not in raw_database for challenge in first_verifier.challenges)

    restarted_app = create_app(
        first_app.state.settings,
        catalog=first_app.state.catalog,
    )
    restarted_verifier = RoleVerifier("Mnemosyne recuperada")
    restarted_app.state.mesa_grant_verifier = restarted_verifier
    with TestClient(restarted_app) as client:
        assert restarted_app.state.vtt.room_exists(room_id)
        legacy_invite = client.post(
            f"/api/vtt/rooms/{room_id}/tickets",
            headers={"Authorization": "Bearer qualquer-convite-antigo"},
        )
        assert legacy_invite.status_code == 403

        recovered = integrated_access(client, restarted_verifier, "master")
        assert recovered.status_code == 200
        fresh_master = recovered.json()
        fresh_player_response = integrated_access(client, restarted_verifier, "player")
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
            assert master_snapshot["state"]["fog"]["regions"] == [
                {
                    "regionId": "persisted-room",
                    "label": "Sala persistida",
                    "points": [
                        {"x": 0.4, "y": 0.4},
                        {"x": 0.6, "y": 0.4},
                        {"x": 0.6, "y": 0.6},
                        {"x": 0.4, "y": 0.6},
                    ],
                    "revealed": True,
                }
            ]
            assert player_snapshot["state"]["fog"]["regions"][0]["revealed"] is True
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
                    "type": "fog.region.create",
                    "commandId": "region-before-map-change",
                    "payload": {
                        "regionId": "stale-room",
                        "label": "Sala ligada ao mapa",
                        "points": [
                            {"x": 0.4, "y": 0.4},
                            {"x": 0.6, "y": 0.4},
                            {"x": 0.6, "y": 0.6},
                            {"x": 0.4, "y": 0.6},
                        ],
                    },
                }
            )
            revealed = master.receive_json()
            assert revealed["state"]["fog"]["revision"] == 1
            assert len(revealed["state"]["fog"]["regions"]) == 1

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
            assert restored["state"]["fog"]["regions"] == []

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
