from __future__ import annotations

import copy
import io
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from caos_vtt import create_app
from caos_vtt.campaign import CampaignCatalog
from caos_vtt.config import Settings
from conftest import HOST_TOKEN, ORIGIN
from test_campaign import _asset, _campaign_fixture, _write_manifest
from test_fog import (
    _access,
    _asset as fetch_asset,
    _create_room,
    _fog_map,
    _read_persisted_room,
    _replace_image_asset,
    _write_persisted_room,
)


def _layer_app(
    tmp_path: Path,
    *,
    state_db_path: Path | None = None,
    second_scene: bool = False,
):
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    inactive = _asset(
        source_root,
        "assets/objetos/ancora-desativada-v1.png",
        b"placeholder",
        kind="prop",
        audience="players",
    )
    movable_prop = _asset(
        source_root,
        "assets/objetos/helena-cadeira-v1.png",
        b"placeholder",
        kind="prop",
        audience="players",
    )
    manifest["assets"].extend((inactive, movable_prop))
    ids["layer_active"] = ids["prop"]
    ids["layer_inactive"] = inactive["id"]
    ids["movable_prop"] = movable_prop["id"]

    _replace_image_asset(
        source_root,
        manifest,
        ids["map_v2"],
        Image.new("RGB", (64, 64), (210, 30, 15)),
    )
    _replace_image_asset(
        source_root,
        manifest,
        ids["layer_active"],
        Image.new("RGBA", (32, 32), (15, 230, 45, 255)),
    )
    _replace_image_asset(
        source_root,
        manifest,
        ids["layer_inactive"],
        Image.new("RGBA", (32, 32), (230, 210, 15, 255)),
    )
    _replace_image_asset(
        source_root,
        manifest,
        ids["movable_prop"],
        Image.new("RGBA", (32, 32), (230, 15, 200, 255)),
    )
    manifest["collections"]["propAssetIds"] = [ids["movable_prop"]]
    manifest["collections"]["stateGroups"] = []
    manifest["collections"]["scenes"][0]["layers"] = [
        {
            "id": "scene-layer:ancora",
            "key": "ancora",
            "label": "Ancora",
            "defaultState": None,
            "states": {
                "ativo": {
                    "label": "Ativa",
                    "assetId": ids["layer_active"],
                    "placements": [
                        {
                            "x": 0.5,
                            "y": 0.5,
                            "width": 0.25,
                            "height": 0.25,
                            "rotation": 0,
                        }
                    ],
                },
                "desativado": {
                    "label": "Desativada",
                    "assetId": ids["layer_inactive"],
                    "placements": [
                        {
                            "x": 0.5,
                            "y": 0.5,
                            "width": 0.25,
                            "height": 0.25,
                            "rotation": 0,
                        }
                    ],
                },
            },
        }
    ]
    if second_scene:
        other_scene = copy.deepcopy(manifest["collections"]["scenes"][0])
        other_scene["id"] = "scene:z-arquivo"
        other_scene["key"] = "z-arquivo"
        other_scene["layers"] = []
        manifest["collections"]["scenes"].append(other_scene)
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


def _receive_broadcast(master: Any, player: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    return master.receive_json(), player.receive_json()


def test_scene_layer_commands_are_master_only_role_safe_and_composited_in_fog(
    tmp_path: Path,
) -> None:
    app, ids = _layer_app(tmp_path)
    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _access(client, room, "masterInviteToken")
        player_access = _access(client, room, "playerInviteToken")
        socket_path = f"/ws/vtt/rooms/{room['roomId']}"
        with client.websocket_connect(
            f"{socket_path}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master, client.websocket_connect(
            f"{socket_path}?ticket={player_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as player:
            master_initial = master.receive_json()
            player_initial = player.receive_json()
            master_layer = master_initial["state"]["scene"]["layers"][0]
            assert master_layer["state"] is None
            assert master_layer["assetId"] is None
            assert master_layer["placements"] == []
            assert master_layer["options"] == [
                {"key": "ativo", "label": "Ativa"},
                {"key": "desativado", "label": "Desativada"},
            ]
            assert player_initial["state"]["scene"]["layers"] == []

            player.send_json(
                {
                    "type": "layer.set",
                    "commandId": "player-cannot-change-layer",
                    "payload": {"layerId": "scene-layer:ancora", "state": "ativo"},
                }
            )
            assert player.receive_json()["error"]["code"] == "forbidden"

            master.send_json(
                {
                    "type": "layer.set",
                    "commandId": "invalid-layer-state",
                    "payload": {"layerId": "scene-layer:ancora", "state": "inventado"},
                }
            )
            assert master.receive_json()["error"]["code"] == "layer_state_not_found"

            master.send_json(
                {
                    "type": "layer.set",
                    "commandId": "activate-layer",
                    "payload": {"layerId": "scene-layer:ancora", "state": "ativo"},
                }
            )
            master_active, player_active = _receive_broadcast(master, player)
            selected = master_active["state"]["scene"]["layers"][0]
            assert selected["assetId"] == ids["layer_active"]
            assert selected["placements"] == [
                {
                    "x": 0.5,
                    "y": 0.5,
                    "width": 0.25,
                    "height": 0.25,
                    "rotation": 0.0,
                }
            ]
            assert player_active["state"]["scene"]["layers"] == []
            assert (
                fetch_asset(
                    client,
                    room["roomId"],
                    ids["layer_active"],
                    player_access["mediaToken"],
                ).status_code
                == 404
            )

            master.send_json(
                {
                    "type": "prop.spawn",
                    "commandId": "prop-above-anchored-layer",
                    "payload": {
                        "propId": "helena",
                        "assetId": ids["movable_prop"],
                        "x": 0.5,
                        "y": 0.5,
                        "label": "Helena",
                        "width": 0.1,
                        "height": 0.1,
                        "rotation": 0,
                        "visible": True,
                    },
                }
            )
            _receive_broadcast(master, player)

            master.send_json(
                {
                    "type": "fog.reveal_all",
                    "commandId": "reveal-layer-through-fog",
                }
            )
            master_revealed, _player_revealed = _receive_broadcast(master, player)
            rendered = _fog_map(
                client,
                room["roomId"],
                player_access["mediaToken"],
                master_revealed["state"]["fog"]["renderRevision"],
            )
            assert rendered.status_code == 200
            with Image.open(io.BytesIO(rendered.content)) as image:
                rendered_rgb = image.convert("RGB")
                center = rendered_rgb.getpixel((32, 32))
                layer_edge = rendered_rgb.getpixel((26, 32))
            # O prop movel fica sobre o layer ancorado; ambos ficam sobre o mapa.
            assert center[0] > center[1] and center[2] > center[1]
            assert layer_edge[1] > layer_edge[0] and layer_edge[1] > layer_edge[2]

            master.send_json(
                {
                    "type": "fog.set_enabled",
                    "commandId": "disable-fog-for-direct-layer",
                    "payload": {"enabled": False},
                }
            )
            _master_direct, player_direct = _receive_broadcast(master, player)
            player_layer = player_direct["state"]["scene"]["layers"][0]
            assert player_layer["assetId"] == ids["layer_active"]
            assert "options" not in player_layer
            assert (
                fetch_asset(
                    client,
                    room["roomId"],
                    ids["layer_active"],
                    player_access["mediaToken"],
                ).status_code
                == 200
            )
            assert (
                fetch_asset(
                    client,
                    room["roomId"],
                    ids["layer_inactive"],
                    player_access["mediaToken"],
                ).status_code
                == 404
            )


def test_scene_layer_persists_in_schema_one_and_migrates_legacy_props(
    tmp_path: Path,
) -> None:
    state_db = tmp_path / "scene-layers.sqlite3"
    app, ids = _layer_app(tmp_path, state_db_path=state_db, second_scene=True)
    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            master.send_json(
                {
                    "type": "layer.set",
                    "commandId": "persist-active-layer",
                    "payload": {"layerId": "scene-layer:ancora", "state": "ativo"},
                }
            )
            master.receive_json()

    persisted = _read_persisted_room(state_db, room["roomId"])
    assert persisted["schemaVersion"] == 1
    scene = persisted["scenes"]["scene:salao-vazio"]
    assert scene["layers"] == {"scene-layer:ancora": "ativo"}

    # Simula uma sala da versao anterior, quando o mesmo asset era um prop livre.
    scene.pop("layers")
    scene["props"] = [
        {
            "propId": "legacy-anchor",
            "assetId": ids["layer_active"],
            "x": 0.1,
            "y": 0.9,
            "label": "Ancora antiga",
            "width": 0.8,
            "height": 0.8,
            "rotation": 123,
            "visible": True,
        }
    ]
    persisted["scenes"]["scene:z-arquivo"]["props"] = [
        {
            "propId": "legacy-anchor-wrong-scene",
            "assetId": ids["layer_active"],
            "x": 0.5,
            "y": 0.5,
            "label": "Ancora na cena errada",
            "width": 0.18,
            "height": 0.18,
            "rotation": 0,
            "visible": True,
        }
    ]
    _write_persisted_room(state_db, room["roomId"], persisted)

    restored_campaign = tmp_path / "restored-campaign"
    restored_campaign.mkdir()
    with pytest.warns(RuntimeWarning, match="layer em cena incorreta"):
        restored_app, _restored_ids = _layer_app(
            restored_campaign,
            state_db_path=state_db,
            second_scene=True,
        )
    with TestClient(restored_app) as client:
        restored_room = restored_app.state.vtt._rooms[room["roomId"]]
        assert restored_room.scene_layers["scene:salao-vazio"] == {
            "scene-layer:ancora": "ativo"
        }
        assert restored_room.scene_props["scene:salao-vazio"] == {}
        assert restored_room.scene_props["scene:z-arquivo"] == {}
