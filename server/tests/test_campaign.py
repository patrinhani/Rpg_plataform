from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import caos_vtt.campaign as campaign_module
from caos_vtt import create_app
from caos_vtt.campaign import (
    AssetIntegrityError,
    AssetNotAvailableError,
    CampaignCatalog,
    ManifestValidationError,
    SourceConfigurationError,
    UnsafeAssetPathError,
)
from caos_vtt.config import Settings
from caos_vtt.service import CatalogToken
from conftest import HOST_TOKEN, ORIGIN


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _asset(
    source_root: Path,
    relative_path: str,
    data: bytes,
    *,
    kind: str,
    audience: str,
) -> dict[str, Any]:
    path = source_root.joinpath(*relative_path.split("/"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {
        "id": f"asset:{relative_path}",
        "relativePath": relative_path,
        "kind": kind,
        "audience": audience,
        "controlledBy": "gm",
        "bytes": len(data),
        "sha256": _sha256(data),
        "mediaType": "application/octet-stream",
        "image": None,
    }


def _write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def _campaign_fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, Any], dict[str, str]]:
    source_root = tmp_path / "Campanha Memória"
    source_root.mkdir()

    definitions = (
        ("map_v1", "assets/mapas/salão-vazio-battlemap-vtt-v1.bin", b"mapa-v1", "map", "players"),
        ("map_v2", "assets/mapas/salão-vazio-battlemap-vtt-v2.bin", b"mapa-v2", "map", "players"),
        ("gm_map", "assets/mapas/guia-mestre/salão-vazio-guia-mestre-v1.bin", b"mapa-gm", "map", "gm"),
        ("overlay", "assets/mapas/overlays/salão-vazio-névoa-overlay-vtt-v1.bin", b"overlay", "overlay", "players"),
        ("token_player", "assets/tokens/agente-é-v1.bin", b"token-player", "token", "players"),
        (
            "token_public_gm",
            "assets/tokens/testemunha-controlada-v1.bin",
            b"token-public-gm",
            "token",
            "players",
        ),
        ("token_gm", "assets/tokens/ameaça-v1.bin", b"token-gm", "token", "gm"),
        ("token_unspecified", "assets/tokens/incógnita-v1.bin", b"token-unknown", "token", "unspecified"),
        ("prop", "assets/objetos/âncora-ativa-objeto-vtt-v1.bin", b"prop", "prop", "players"),
        (
            "handout",
            "assets/handouts/pista-publicada-por-engano-v1.bin",
            b"segredo",
            "handout",
            "players",
        ),
        (
            "master_reference",
            "assets/conceitos/circuitos-sobrepostos-referencia-mestre-v1.bin",
            b"referencia-mestre",
            "concept",
            # A colecao privada deve prevalecer mesmo se o audience vier errado.
            "players",
        ),
    )
    assets: list[dict[str, Any]] = []
    ids: dict[str, str] = {}
    for name, relative_path, data, kind, audience in definitions:
        item = _asset(
            source_root,
            relative_path,
            data,
            kind=kind,
            audience=audience,
        )
        if name == "token_player":
            item["controlledBy"] = "players"
        assets.append(item)
        ids[name] = item["id"]

    manifest: dict[str, Any] = {
        "schemaVersion": 2,
        "generator": {"name": "test", "version": "2.0"},
        "campaign": {
            "id": "memoria",
            "title": "Campanha Memória",
            "sourceRef": "memoria",
            "sourceMode": "external-read-only",
        },
        "assets": assets,
        "documents": [],
        "collections": {
            "scenes": [
                {
                    "id": "scene:salao-vazio",
                    "key": "salao-vazio",
                    "playerMaps": [
                        {"assetId": ids["map_v1"], "version": 1},
                        {"assetId": ids["map_v2"], "version": 2},
                    ],
                    "gmGuideMaps": [{"assetId": ids["gm_map"], "version": 1}],
                    "overlays": [
                        {"assetId": ids["overlay"], "name": "névoa", "version": 1}
                    ],
                    "activePlayerMap": ids["map_v2"],
                    "activeGmGuideMap": ids["gm_map"],
                    "gridHint": {"type": "square", "columns": 28, "rows": 28},
                }
            ],
            "stateGroups": [
                {
                    "id": "state-group:ancora",
                    "key": "ancora",
                    "states": {
                        "ativo": {
                            "assetId": ids["prop"],
                            "version": 1,
                            "variants": [{"assetId": ids["prop"], "version": 1}],
                        }
                    },
                }
            ],
            "tokenAssetIds": [
                ids["token_player"],
                ids["token_public_gm"],
                ids["token_gm"],
                ids["token_unspecified"],
            ],
            "propAssetIds": [ids["prop"]],
            "handoutAssetIds": [ids["handout"]],
            "masterReferenceAssetIds": [ids["master_reference"]],
        },
        "warnings": [],
    }
    manifest_path = tmp_path / "manifesto-memória.json"
    _write_manifest(manifest_path, manifest)
    return manifest_path, source_root, manifest, ids


def _load(manifest_path: Path, source_root: Path) -> CampaignCatalog:
    return CampaignCatalog.load(manifest_path, {"memoria": source_root})


def _add_prop_state_assets(
    source_root: Path,
    manifest: dict[str, Any],
    ids: dict[str, str],
) -> None:
    for name, relative_path, data in (
        (
            "prop_alt",
            "assets/objetos/ancora-desativada-objeto-vtt-v1.bin",
            b"prop-alt",
        ),
        (
            "prop_ungrouped",
            "assets/objetos/corpo-conectado-objeto-vtt-v1.bin",
            b"prop-ungrouped",
        ),
    ):
        asset = _asset(
            source_root,
            relative_path,
            data,
            kind="prop",
            audience="players",
        )
        manifest["assets"].append(asset)
        manifest["collections"]["propAssetIds"].append(asset["id"])
        ids[name] = asset["id"]
    manifest["collections"]["stateGroups"][0]["states"]["desativado"] = {
        "assetId": ids["prop_alt"],
        "version": 1,
        "variants": [{"assetId": ids["prop_alt"], "version": 1}],
    }


def test_lists_sanitized_scenes_tokens_versions_and_unicode(tmp_path: Path) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)

    assert catalog.hash_cache_size == 0
    player_scenes = catalog.list_scenes("player")
    assert len(player_scenes) == 1
    assert [item.version for item in player_scenes[0].player_maps] == [1, 2]
    assert player_scenes[0].active_player_map == ids["map_v2"]
    assert player_scenes[0].gm_guide_maps == ()
    assert player_scenes[0].active_gm_guide_map is None
    assert player_scenes[0].overlays[0].asset_id == ids["overlay"]

    master_scene = catalog.list_scenes("master")[0]
    assert master_scene.gm_guide_maps[0].asset_id == ids["gm_map"]
    assert master_scene.active_gm_guide_map == ids["gm_map"]
    assert [item.asset_id for item in catalog.list_tokens("player")] == [
        ids["token_player"],
        ids["token_public_gm"],
    ]
    assert {item.asset_id for item in catalog.list_tokens("master")} == {
        ids["token_player"], ids["token_public_gm"], ids["token_gm"], ids["token_unspecified"],
    }
    assert catalog.get_asset(ids["token_player"], "player").controlled_by == "players"
    assert catalog.get_asset(ids["token_public_gm"], "player").controlled_by == "gm"
    assert [item.asset_id for item in catalog.list_props("master")] == [ids["prop"]]
    assert [item.asset_id for item in catalog.list_props("player")] == [ids["prop"]]
    assert [item.asset_id for item in catalog.list_handouts("master")] == [ids["handout"]]
    assert catalog.list_handouts("player") == ()
    assert [item.asset_id for item in catalog.list_master_references("master")] == [
        ids["master_reference"]
    ]
    assert catalog.list_master_references("player") == ()
    with pytest.raises(AssetNotAvailableError):
        catalog.get_asset(ids["handout"], "player")
    with pytest.raises(AssetNotAvailableError):
        catalog.get_asset(ids["master_reference"], "player")
    assert str(source_root) not in repr(player_scenes)
    assert str(source_root) not in repr(catalog.list_tokens("master"))
    assert catalog.hash_cache_size == 0


def test_scene_layers_are_typed_public_and_keep_normalized_placements(tmp_path: Path) -> None:
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    prop = next(asset for asset in manifest["assets"] if asset["id"] == ids["prop"])
    prop["image"] = {"format": "png", "width": 128, "height": 128, "hasAlpha": True}
    manifest["collections"]["propAssetIds"] = []
    manifest["collections"]["stateGroups"] = []
    manifest["collections"]["scenes"][0]["layers"] = [
        {
            "id": "scene-layer:ancora",
            "key": "ancora",
            "label": "Âncora",
            "defaultState": None,
            "states": {
                "ativo": {
                    "label": "Ativa",
                    "assetId": ids["prop"],
                    "placements": [
                        {"x": 0.4, "y": 0.3, "width": 0.2, "height": 0.25, "rotation": -45},
                        {"x": 0.6, "y": 0.7, "width": 0.1, "height": 0.1, "rotation": 135},
                    ],
                }
            },
        }
    ]
    _write_manifest(manifest_path, manifest)

    catalog = _load(manifest_path, source_root)
    master_layer = catalog.list_scenes("master")[0].layers[0]
    player_layer = catalog.list_scenes("player")[0].layers[0]

    assert master_layer == player_layer
    assert master_layer.layer_id == "scene-layer:ancora"
    assert master_layer.default_state is None
    assert master_layer.states[0].key == "ativo"
    assert master_layer.states[0].asset_id == ids["prop"]
    assert master_layer.states[0].placements[0].rotation == -45.0
    assert master_layer.states[0].placements[1].x == 0.6
    assert catalog.get_asset(ids["prop"], "player").image is not None


@pytest.mark.parametrize(
    ("mutation", "message"),
    (
        ("gm-audience", "publica"),
        ("no-image", "publica"),
        ("bad-default", "defaultState"),
        ("bad-width", "limites"),
        ("duplicate-asset", "exclusiva"),
    ),
)
def test_rejects_invalid_scene_layer_catalog_data(
    tmp_path: Path, mutation: str, message: str
) -> None:
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    prop = next(asset for asset in manifest["assets"] if asset["id"] == ids["prop"])
    prop["image"] = {"format": "png", "width": 128, "height": 128, "hasAlpha": True}
    manifest["collections"]["propAssetIds"] = []
    manifest["collections"]["stateGroups"] = []
    layer = {
        "id": "scene-layer:ancora",
        "key": "ancora",
        "label": "Âncora",
        "defaultState": None,
        "states": {
            "ativo": {
                "label": "Ativa",
                "assetId": ids["prop"],
                "placements": [
                    {"x": 0.4, "y": 0.3, "width": 0.2, "height": 0.2, "rotation": 0}
                ],
            }
        },
    }
    manifest["collections"]["scenes"][0]["layers"] = [layer]
    if mutation == "gm-audience":
        prop["audience"] = "gm"
    elif mutation == "no-image":
        prop["image"] = None
    elif mutation == "bad-default":
        layer["defaultState"] = "ausente"
    elif mutation == "bad-width":
        layer["states"]["ativo"]["placements"][0]["width"] = 0
    else:
        layer["states"]["duplicado"] = {
            "label": "Duplicada",
            "assetId": ids["prop"],
            "placements": [
                {"x": 0.5, "y": 0.5, "width": 0.2, "height": 0.2, "rotation": 0}
            ],
        }
    _write_manifest(manifest_path, manifest)

    with pytest.raises(ManifestValidationError, match=message):
        _load(manifest_path, source_root)
def test_prop_state_groups_are_typed_private_and_unambiguous(tmp_path: Path) -> None:
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    _add_prop_state_assets(source_root, manifest, ids)
    _write_manifest(manifest_path, manifest)

    catalog = _load(manifest_path, source_root)
    groups = catalog.list_prop_state_groups("master")

    assert catalog.list_prop_state_groups("player") == ()
    assert len(groups) == 1
    assert groups[0].group_id == "state-group:ancora"
    assert [state.name for state in groups[0].states] == ["ativo", "desativado"]
    assert catalog.can_swap_prop_asset(ids["prop"], ids["prop_alt"])
    assert catalog.can_swap_prop_asset(ids["prop_alt"], ids["prop"])
    assert not catalog.can_swap_prop_asset(ids["prop"], ids["prop_ungrouped"])
    assert not catalog.can_swap_prop_asset(ids["prop_ungrouped"], ids["prop"])

    manifest["collections"]["stateGroups"].append(
        {
            "id": "state-group:duplicado",
            "key": "duplicado",
            "states": {
                "ativo": {
                    "assetId": ids["prop_alt"],
                    "version": 1,
                    "variants": [{"assetId": ids["prop_alt"], "version": 1}],
                }
            },
        }
    )
    _write_manifest(manifest_path, manifest)
    with pytest.raises(ManifestValidationError, match="outro estado"):
        _load(manifest_path, source_root)


def test_new_asset_collections_are_optional_for_older_manifests(tmp_path: Path) -> None:
    manifest_path, source_root, manifest, _ids = _campaign_fixture(tmp_path)
    manifest["collections"].pop("propAssetIds")
    manifest["collections"].pop("handoutAssetIds")
    manifest["collections"].pop("masterReferenceAssetIds")
    _write_manifest(manifest_path, manifest)

    catalog = _load(manifest_path, source_root)

    assert catalog.list_props("master") == ()
    assert catalog.list_handouts("master") == ()
    assert catalog.list_master_references("master") == ()


@pytest.mark.parametrize(
    ("collection_name", "asset_key", "expected_kind"),
    (
        ("propAssetIds", "token_player", "prop"),
        ("handoutAssetIds", "prop", "handout"),
        ("masterReferenceAssetIds", "handout", "concept"),
    ),
)
def test_rejects_collection_ids_with_wrong_asset_kind(
    tmp_path: Path,
    collection_name: str,
    asset_key: str,
    expected_kind: str,
) -> None:
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    manifest["collections"][collection_name] = [ids[asset_key]]
    _write_manifest(manifest_path, manifest)

    with pytest.raises(ManifestValidationError, match=expected_kind):
        _load(manifest_path, source_root)


def test_player_denies_gm_and_unspecified_before_path_resolution(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)

    def fail_if_resolved(*_args: object, **_kwargs: object) -> Path:
        raise AssertionError("asset proibido nao pode tocar o filesystem")

    monkeypatch.setattr(catalog, "_resolve_confined_path", fail_if_resolved)
    with pytest.raises(AssetNotAvailableError):
        catalog.resolve_asset(ids["token_gm"], "player")
    with pytest.raises(AssetNotAvailableError):
        catalog.resolve_asset(ids["token_unspecified"], "player")
    assert catalog.hash_cache_size == 0


def test_master_resolves_all_audiences_and_player_resolves_public_unicode(tmp_path: Path) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)

    player_asset = catalog.resolve_asset(ids["token_player"], "player")
    assert player_asset.path.name == "agente-é-v1.bin"
    assert player_asset.path.is_relative_to(source_root.resolve())
    assert catalog.resolve_asset(ids["token_gm"], "master").asset.audience == "gm"
    assert (
        catalog.resolve_asset(ids["token_unspecified"], "master").asset.audience
        == "unspecified"
    )


def test_hash_is_lazy_cached_and_reused(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)
    original = campaign_module._sha256_fd
    calls = 0

    def counted(descriptor: int) -> str:
        nonlocal calls
        calls += 1
        return original(descriptor)

    monkeypatch.setattr(campaign_module, "_sha256_fd", counted)
    assert catalog.hash_cache_size == 0
    catalog.resolve_asset(ids["token_player"], "player")
    catalog.resolve_asset(ids["token_player"], "player")
    assert calls == 1
    assert catalog.hash_cache_size == 1


def test_verify_all_assets_preflights_entire_runtime_pack(tmp_path: Path) -> None:
    manifest_path, source_root, manifest, _ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)

    count, total_bytes = catalog.verify_all_assets()

    assert count == len(manifest["assets"])
    assert total_bytes == sum(int(item["bytes"]) for item in manifest["assets"])
    assert catalog.hash_cache_size == count


def test_open_asset_returns_validated_stream_at_offset_zero(tmp_path: Path) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)

    with catalog.open_asset(ids["token_player"], "player") as opened:
        assert opened.stream.tell() == 0
        assert opened.stream.read() == b"token-player"
        assert opened.size == len(b"token-player")
        assert opened.asset.asset_id == ids["token_player"]

    assert opened.stream.closed


def test_changed_content_with_same_size_fails_sha_and_is_not_cached(tmp_path: Path) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)
    token = source_root / "assets" / "tokens" / "agente-é-v1.bin"
    original = token.read_bytes()
    token.write_bytes(b"X" * len(original))

    with pytest.raises(AssetIntegrityError, match="SHA-256"):
        catalog.resolve_asset(ids["token_player"], "player")
    assert catalog.hash_cache_size == 0


@pytest.mark.parametrize(
    "unsafe_path",
    (
        "../fora.bin",
        "/fora.bin",
        "C:/fora.bin",
        "assets\\fora.bin",
        "assets/../fora.bin",
        "assets/fora.bin\x00oculto",
        "assets/CON/fora.bin",
        "assets/pasta./fora.bin",
    ),
)
def test_rejects_manifest_path_traversal(tmp_path: Path, unsafe_path: str) -> None:
    manifest_path, source_root, manifest, _ids = _campaign_fixture(tmp_path)
    manifest["assets"][0]["relativePath"] = unsafe_path
    manifest["assets"][0]["id"] = f"asset:{unsafe_path}"
    _write_manifest(manifest_path, manifest)

    with pytest.raises(ManifestValidationError):
        _load(manifest_path, source_root)


def test_rejects_absolute_source_root_from_json_and_missing_source_mapping(tmp_path: Path) -> None:
    manifest_path, source_root, manifest, _ids = _campaign_fixture(tmp_path)
    manifest["campaign"]["sourceRoot"] = str(source_root)
    _write_manifest(manifest_path, manifest)

    with pytest.raises(ManifestValidationError, match="sourceRoot"):
        _load(manifest_path, source_root)

    manifest["campaign"].pop("sourceRoot")
    _write_manifest(manifest_path, manifest)
    with pytest.raises(SourceConfigurationError, match="sourceRef"):
        CampaignCatalog.load(manifest_path, {})


def test_rejects_unknown_ids_and_incorrect_active_version(tmp_path: Path) -> None:
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    manifest["collections"]["scenes"][0]["activePlayerMap"] = ids["map_v1"]
    _write_manifest(manifest_path, manifest)
    with pytest.raises(ManifestValidationError, match="maior versao"):
        _load(manifest_path, source_root)

    manifest["collections"]["scenes"][0]["activePlayerMap"] = ids["map_v2"]
    manifest["collections"]["tokenAssetIds"].append("asset:assets/tokens/inexistente.bin")
    _write_manifest(manifest_path, manifest)
    with pytest.raises(ManifestValidationError, match="tokenAssetIds"):
        _load(manifest_path, source_root)


def test_rejects_symlink_asset_even_when_target_is_readable(tmp_path: Path) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)
    asset = source_root / "assets" / "tokens" / "agente-é-v1.bin"
    external = tmp_path / "external.bin"
    external.write_bytes(asset.read_bytes())
    asset.unlink()
    try:
        asset.symlink_to(external)
    except OSError as error:
        pytest.skip(f"symlink indisponivel: {error}")

    with pytest.raises(UnsafeAssetPathError, match="link"):
        catalog.resolve_asset(ids["token_player"], "player")


def test_rejects_source_root_replaced_after_catalog_load(tmp_path: Path) -> None:
    manifest_path, source_root, _manifest, ids = _campaign_fixture(tmp_path)
    catalog = _load(manifest_path, source_root)
    original_root = tmp_path / "Campanha Memória original"
    source_root.rename(original_root)
    source_root.mkdir()

    with pytest.raises(UnsafeAssetPathError, match="raiz configurada mudou"):
        catalog.resolve_asset(ids["token_player"], "player")


def test_windows_reparse_point_is_treated_as_unsafe() -> None:
    fake = type("FakeStat", (), {"st_mode": 0, "st_file_attributes": 0x0400})()
    assert campaign_module._stat_is_link_or_junction(fake)


def _catalog_app(
    tmp_path: Path,
    *,
    two_scenes: bool = False,
    prop_states: bool = False,
    state_db_path: Path | None = None,
) -> tuple[Any, CampaignCatalog, dict[str, str]]:
    manifest_path, source_root, manifest, ids = _campaign_fixture(tmp_path)
    if prop_states:
        _add_prop_state_assets(source_root, manifest, ids)
    if two_scenes:
        second_scene = copy.deepcopy(manifest["collections"]["scenes"][0])
        second_scene["id"] = "scene:salão-memória"
        second_scene["key"] = "salão-memória"
        manifest["collections"]["scenes"].append(second_scene)
    if two_scenes or prop_states:
        _write_manifest(manifest_path, manifest)
    catalog = _load(manifest_path, source_root)
    app = create_app(
        Settings(
            host_token=HOST_TOKEN,
            allowed_origins=(ORIGIN,),
            ticket_ttl_seconds=60,
            state_db_path=state_db_path,
        ),
        catalog=catalog,
    )
    return app, catalog, ids


def _create_room(
    client: TestClient,
    name: str = "Mesa de catálogo",
    **context: Any,
) -> dict[str, Any]:
    response = client.post(
        "/api/vtt/rooms",
        headers={"Authorization": f"Bearer {HOST_TOKEN}"},
        json={"name": name, **context},
    )
    assert response.status_code == 201
    room = response.json()
    # Estes testes validam catálogo/comandos sem fog. A produção começa fechada
    # por segurança; a suíte específica test_fog cobre esse comportamento.
    persisted_room = client.app.state.vtt._rooms[room["roomId"]]
    for fog in persisted_room.scene_fog.values():
        fog.enabled = False
    return room


def _issue_access(
    client: TestClient,
    room: dict[str, Any],
    invite_key: str,
) -> dict[str, Any]:
    response = client.post(
        f"/api/vtt/rooms/{room['roomId']}/tickets",
        headers={"Authorization": f"Bearer {room[invite_key]}"},
    )
    assert response.status_code == 200
    return response.json()


def _asset_request(
    client: TestClient,
    room_id: str,
    asset_id: str,
    access: str,
):
    return client.get(
        f"/api/vtt/rooms/{room_id}/assets",
        params={"assetId": asset_id, "access": access},
    )


def test_catalog_asset_endpoint_grants_are_role_room_bound_reusable_and_close_streams(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app, catalog, ids = _catalog_app(tmp_path)
    original_open_asset = catalog.open_asset
    opened_assets: list[Any] = []

    def tracked_open_asset(asset_id: str, role: str):
        opened = original_open_asset(asset_id, role)
        opened_assets.append(opened)
        return opened

    def forbidden_resolve(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("O endpoint deve transmitir o descritor de open_asset")

    monkeypatch.setattr(catalog, "open_asset", tracked_open_asset)
    monkeypatch.setattr(catalog, "resolve_asset", forbidden_resolve)

    with TestClient(app) as client:
        room = _create_room(client)
        other_room = _create_room(client, "Outra mesa")
        master = _issue_access(client, room, "masterInviteToken")
        player = _issue_access(client, room, "playerInviteToken")

        assert master["mediaExpiresIn"] == 43_200
        assert player["mediaExpiresIn"] == 43_200
        assert master["mediaToken"] != master["ticket"]

        first = _asset_request(
            client,
            room["roomId"],
            ids["map_v2"],
            player["mediaToken"],
        )
        assert first.status_code == 200
        assert first.content == b"mapa-v2"
        assert first.headers["content-type"] == "application/octet-stream"
        assert first.headers["content-length"] == str(len(b"mapa-v2"))
        assert first.headers["cache-control"] == "no-store, private"
        assert first.headers["x-content-type-options"] == "nosniff"

        reused = _asset_request(
            client,
            room["roomId"],
            ids["map_v2"],
            player["mediaToken"],
        )
        assert reused.status_code == 200

        denied_responses = [
            _asset_request(
                client,
                room["roomId"],
                ids["token_player"],
                player["mediaToken"],
            ),
            _asset_request(
                client,
                room["roomId"],
                ids["overlay"],
                player["mediaToken"],
            ),
            _asset_request(
                client,
                room["roomId"],
                ids["map_v1"],
                player["mediaToken"],
            ),
            _asset_request(
                client,
                room["roomId"],
                ids["token_gm"],
                player["mediaToken"],
            ),
            _asset_request(
                client,
                room["roomId"],
                ids["token_unspecified"],
                player["mediaToken"],
            ),
            _asset_request(
                client,
                room["roomId"],
                "asset:assets/tokens/inexistente.bin",
                player["mediaToken"],
            ),
            _asset_request(
                client,
                other_room["roomId"],
                ids["token_player"],
                player["mediaToken"],
            ),
            _asset_request(
                client,
                room["roomId"],
                ids["token_player"],
                player["ticket"],
            ),
        ]
        assert {response.status_code for response in denied_responses} == {404}
        assert {json.dumps(response.json(), sort_keys=True) for response in denied_responses} == {
            json.dumps({"detail": "Asset nao encontrado"}, sort_keys=True)
        }

        master_asset = _asset_request(
            client,
            room["roomId"],
            ids["token_gm"],
            master["mediaToken"],
        )
        assert master_asset.status_code == 200
        assert master_asset.content == b"token-gm"

        player_grant_digest = hashlib.sha256(player["mediaToken"].encode("utf-8")).digest()
        stored_grant = app.state.vtt._media_grants[player_grant_digest]
        app.state.vtt._media_grants[player_grant_digest] = replace(
            stored_grant,
            expires_at=datetime.now(UTC) - timedelta(seconds=1),
        )
        expired = _asset_request(
            client,
            room["roomId"],
            ids["map_v2"],
            player["mediaToken"],
        )
        assert expired.status_code == 404
        assert player_grant_digest not in app.state.vtt._media_grants

        with pytest.raises(WebSocketDisconnect) as wrong_credential:
            with client.websocket_connect(
                f"/ws/vtt/rooms/{room['roomId']}?ticket={player['mediaToken']}",
                headers={"Origin": ORIGIN},
            ):
                pass
        assert wrong_credential.value.code == 4401

    assert opened_assets
    assert all(opened.stream.closed for opened in opened_assets)


def test_handout_delivery_is_master_only_room_global_and_revocable(tmp_path: Path) -> None:
    app, _catalog, ids = _catalog_app(tmp_path, two_scenes=True)
    handout_id = ids["handout"]

    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _issue_access(client, room, "masterInviteToken")
        player_access = _issue_access(client, room, "playerInviteToken")
        socket_path = f"/ws/vtt/rooms/{room['roomId']}"

        denied_before_delivery = _asset_request(
            client,
            room["roomId"],
            handout_id,
            player_access["mediaToken"],
        )
        assert denied_before_delivery.status_code == 404
        assert denied_before_delivery.json() == {"detail": "Asset nao encontrado"}

        with client.websocket_connect(
            f"{socket_path}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master, client.websocket_connect(
            f"{socket_path}?ticket={player_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as player:
            master_initial = master.receive_json()
            player_initial = player.receive_json()
            assert [
                item["assetId"]
                for item in master_initial["state"]["catalog"]["handoutAssets"]
            ] == [handout_id]
            assert (
                master_initial["state"]["catalog"]["handoutAssets"][0]["label"]
                == "Pista Publicada Por Engano"
            )
            assert master_initial["state"]["deliveredHandouts"] == []
            assert player_initial["state"]["deliveredHandouts"] == []
            assert handout_id not in json.dumps(player_initial, ensure_ascii=False)

            for index, probed_asset_id in enumerate(
                (handout_id, "asset:assets/handouts/inexistente.bin")
            ):
                player.send_json(
                    {
                        "type": "handout.deliver",
                        "commandId": f"player-handout-probe-{index}",
                        "payload": {"assetId": probed_asset_id},
                    }
                )
                assert player.receive_json()["error"]["code"] == "master_required"

            master.send_json(
                {
                    "type": "handout.deliver",
                    "commandId": "deliver-handout",
                    "payload": {"assetId": handout_id},
                }
            )
            master_delivered = master.receive_json()
            player_delivered = player.receive_json()
            assert master_delivered["revision"] == player_delivered["revision"] == 1
            assert player_delivered["state"]["deliveredHandouts"][0]["assetId"] == handout_id
            assert player_delivered["state"]["deliveredHandouts"][0]["deliveredAt"]
            assert "catalog" not in player_delivered["state"]

            delivered_asset = _asset_request(
                client,
                room["roomId"],
                handout_id,
                player_access["mediaToken"],
            )
            assert delivered_asset.status_code == 200
            assert delivered_asset.content == b"segredo"
            assert delivered_asset.headers["cache-control"] == "no-store, private"

            master.send_json(
                {
                    "type": "fog.set_enabled",
                    "commandId": "enable-fog-after-handout",
                    "payload": {"enabled": True},
                }
            )
            master.receive_json()
            player_with_fog = player.receive_json()
            assert player_with_fog["state"]["deliveredHandouts"][0]["assetId"] == handout_id
            assert _asset_request(
                client,
                room["roomId"],
                handout_id,
                player_access["mediaToken"],
            ).status_code == 200

            master.send_json(
                {
                    "type": "handout.revoke",
                    "commandId": "revoke-handout",
                    "payload": {"assetId": handout_id},
                }
            )
            master_revoked = master.receive_json()
            player_revoked = player.receive_json()
            assert master_revoked["state"]["deliveredHandouts"] == []
            assert player_revoked["state"]["deliveredHandouts"] == []
            assert _asset_request(
                client,
                room["roomId"],
                handout_id,
                player_access["mediaToken"],
            ).status_code == 404


def test_master_references_are_private_openable_by_master_and_never_deliverable(
    tmp_path: Path,
) -> None:
    app, catalog, ids = _catalog_app(tmp_path)
    reference_id = ids["master_reference"]

    assert [item.asset_id for item in catalog.list_master_references("master")] == [
        reference_id
    ]
    assert catalog.list_master_references("player") == ()

    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _issue_access(client, room, "masterInviteToken")
        player_access = _issue_access(client, room, "playerInviteToken")
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
            assert master_initial["state"]["catalog"]["masterReferenceAssets"] == [
                {
                    "assetId": reference_id,
                    "label": "Circuitos Sobrepostos Referencia Mestre",
                    "mediaType": "application/octet-stream",
                }
            ]
            assert reference_id not in json.dumps(player_initial, ensure_ascii=False)

            master_asset = _asset_request(
                client,
                room["roomId"],
                reference_id,
                master_access["mediaToken"],
            )
            assert master_asset.status_code == 200
            assert master_asset.content == b"referencia-mestre"
            assert _asset_request(
                client,
                room["roomId"],
                reference_id,
                player_access["mediaToken"],
            ).status_code == 404

            master.send_json(
                {
                    "type": "handout.deliver",
                    "commandId": "do-not-deliver-master-reference",
                    "payload": {"assetId": reference_id},
                }
            )
            denied = master.receive_json()
            assert denied["error"]["code"] == "handout_not_found"
            assert app.state.vtt._rooms[room["roomId"]].delivered_handouts == {}
            assert _asset_request(
                client,
                room["roomId"],
                reference_id,
                player_access["mediaToken"],
            ).status_code == 404


def test_delivered_handout_survives_restart_for_future_players(tmp_path: Path) -> None:
    state_db = tmp_path / "state" / "sessions.sqlite3"
    app, catalog, ids = _catalog_app(tmp_path, state_db_path=state_db)
    handout_id = ids["handout"]

    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _issue_access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            master.send_json(
                {
                    "type": "handout.deliver",
                    "commandId": "persist-handout",
                    "payload": {"assetId": handout_id},
                }
            )
            assert master.receive_json()["state"]["deliveredHandouts"][0]["assetId"] == handout_id

    restarted = create_app(app.state.settings, catalog=catalog)
    with TestClient(restarted) as client:
        player_access = _issue_access(client, room, "playerInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={player_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as player:
            restored = player.receive_json()
            assert restored["state"]["deliveredHandouts"][0]["assetId"] == handout_id
            assert _asset_request(
                client,
                room["roomId"],
                handout_id,
                player_access["mediaToken"],
            ).content == b"segredo"


def test_catalog_snapshots_commands_permissions_scene_state_and_idempotency(
    tmp_path: Path,
) -> None:
    app, _catalog, ids = _catalog_app(tmp_path, two_scenes=True)
    with TestClient(app) as client:
        room = _create_room(
            client,
            campaignId="memoria",
        )
        master_access = _issue_access(client, room, "masterInviteToken")
        player_access = _issue_access(client, room, "playerInviteToken")
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
            assert master_initial["state"]["table"] == {
                "name": "Mesa de catálogo",
                "campaignId": "memoria",
                "externalMesaId": None,
            }
            assert "table" not in player_initial["state"]
            assert master_initial["state"]["scene"] == {
                "id": "scene:salao-vazio",
                "key": "salao-vazio",
                "label": "Salao Vazio",
                "map": {"assetId": ids["map_v2"], "width": None, "height": None},
                "gmGuideMap": {
                    "assetId": ids["gm_map"],
                    "width": None,
                    "height": None,
                },
                "overlays": [
                    {
                        "assetId": ids["overlay"],
                        "name": "névoa",
                        "label": "Névoa",
                        "enabled": False,
                    }
                ],
                "gridHint": {"type": "square", "columns": 28, "rows": 28},
            }
            assert set(master_initial["state"]["catalog"]) == {
                "scenes",
                "tokenAssets",
                "propAssets",
                "propStateGroups",
                "masterReferenceAssets",
                "handoutAssets",
            }
            assert [
                item["assetId"]
                for item in master_initial["state"]["catalog"]["propAssets"]
            ] == [ids["prop"]]
            assert master_initial["state"]["catalog"]["propAssets"][0]["label"] == "Âncora Ativa"
            assert {
                item["assetId"] for item in master_initial["state"]["catalog"]["tokenAssets"]
            } == {
                ids["token_player"],
                ids["token_public_gm"],
                ids["token_gm"],
                ids["token_unspecified"],
            }
            assert "catalog" not in player_initial["state"]
            assert "gmGuideMap" not in player_initial["state"]["scene"]
            assert player_initial["state"]["scene"]["overlays"] == []
            player_serialized = json.dumps(player_initial, ensure_ascii=False)
            assert ids["overlay"] not in player_serialized
            assert ids["gm_map"] not in player_serialized
            assert ids["token_gm"] not in player_serialized
            assert ids["token_unspecified"] not in player_serialized
            assert ids["master_reference"] not in player_serialized

            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "spawn-public",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Agente",
                        "x": 0.4,
                        "y": 0.6,
                        "size": 0.08,
                    },
                }
            )
            master_public = master.receive_json()
            player_public = player.receive_json()
            assert master_public["revision"] == player_public["revision"] == 1
            public_token_id = next(iter(master_public["state"]["tokens"]))
            assert player_public["state"]["tokens"][public_token_id]["label"] == "Agente"
            assert _asset_request(
                client,
                room["roomId"],
                ids["token_player"],
                player_access["mediaToken"],
            ).status_code == 200

            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "spawn-gm",
                    "payload": {
                        "assetId": ids["token_gm"],
                        "label": "Ameaça oculta",
                        "x": 0.2,
                        "y": 0.3,
                    },
                }
            )
            master_gm = master.receive_json()
            player_after_gm = player.receive_json()
            gm_token_id = next(
                token_id
                for token_id, token in master_gm["state"]["tokens"].items()
                if token["assetId"] == ids["token_gm"]
            )
            assert gm_token_id not in player_after_gm["state"]["tokens"]
            assert ids["token_gm"] not in json.dumps(player_after_gm, ensure_ascii=False)

            forbidden_commands = (
                {
                    "type": "token.spawn",
                    "commandId": "player-spawn",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Proibido",
                        "x": 0.5,
                        "y": 0.5,
                    },
                },
                {
                    "type": "scene.select",
                    "commandId": "player-scene",
                    "payload": {"sceneId": "scene:salão-memória"},
                },
                {
                    "type": "overlay.set",
                    "commandId": "player-overlay",
                    "payload": {"assetId": ids["overlay"], "enabled": True},
                },
                {
                    "type": "token.remove",
                    "commandId": "player-remove",
                    "payload": {"tokenId": public_token_id},
                },
            )
            for command in forbidden_commands:
                player.send_json(command)
                assert player.receive_json()["error"]["code"] == "forbidden"
            assert app.state.vtt._rooms[room["roomId"]].revision == 2

            master.send_json(
                {
                    "type": "overlay.set",
                    "commandId": "overlay-on",
                    "payload": {"assetId": ids["overlay"], "enabled": True},
                }
            )
            master_overlay = master.receive_json()
            player_overlay = player.receive_json()
            assert master_overlay["revision"] == player_overlay["revision"] == 3
            assert player_overlay["state"]["scene"]["overlays"][0]["enabled"] is True
            assert _asset_request(
                client,
                room["roomId"],
                ids["overlay"],
                player_access["mediaToken"],
            ).status_code == 200

            move = {
                "type": "token.move",
                "commandId": "move-idempotent",
                "payload": {"tokenId": public_token_id, "x": 0.7, "y": 0.8},
            }
            player.send_json(move)
            player_move = player.receive_json()
            master_move = master.receive_json()
            assert player_move["revision"] == master_move["revision"] == 4
            assert player_move["state"]["tokens"][public_token_id]["x"] == 0.7

            player.send_json(
                {
                    "type": "token.move",
                    "commandId": "move-after-first",
                    "payload": {"tokenId": public_token_id, "x": 0.9, "y": 0.2},
                }
            )
            assert player.receive_json()["revision"] == 5
            assert master.receive_json()["revision"] == 5

            player.send_json(move)
            replay = player.receive_json()
            assert replay["revision"] == 5
            assert replay["state"]["tokens"][public_token_id]["x"] == 0.9
            assert replay["state"]["tokens"][public_token_id]["y"] == 0.2
            master.send_json({"type": "ping", "commandId": "after-retry"})
            assert master.receive_json()["type"] == "pong"

            conflicting_move = copy.deepcopy(move)
            conflicting_move["payload"]["x"] = 0.1
            player.send_json(conflicting_move)
            conflict = player.receive_json()
            assert conflict["error"]["code"] == "command_id_conflict"
            assert app.state.vtt._rooms[room["roomId"]].revision == 5

            master.send_json(move)
            role_conflict = master.receive_json()
            assert role_conflict["error"]["code"] == "command_id_conflict"

            for command_id, label, visible, movable in (
                ("spawn-hidden", "Oculto", False, True),
                ("spawn-locked", "Imóvel", True, False),
            ):
                master.send_json(
                    {
                        "type": "token.spawn",
                        "commandId": command_id,
                        "payload": {
                            "assetId": ids["token_player"],
                            "label": label,
                            "x": 0.5,
                            "y": 0.5,
                            "visible": visible,
                            "movable": movable,
                        },
                    }
                )
                master_spawn = master.receive_json()
                player_spawn = player.receive_json()
                spawned_id = next(
                    token_id
                    for token_id, token in master_spawn["state"]["tokens"].items()
                    if token["label"] == label
                )
                if visible:
                    assert spawned_id in player_spawn["state"]["tokens"]
                else:
                    assert spawned_id not in player_spawn["state"]["tokens"]
                player.send_json(
                    {
                        "type": "token.move",
                        "commandId": f"move-{command_id}",
                        "payload": {"tokenId": spawned_id, "x": 0.1, "y": 0.1},
                    }
                )
                assert player.receive_json()["error"]["code"] == "token_forbidden"

            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "invalid-size",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Grande demais",
                        "x": 0.5,
                        "y": 0.5,
                        "size": 1,
                    },
                }
            )
            assert master.receive_json()["error"]["code"] == "invalid_token_spawn"

            master.send_json(
                {
                    "type": "scene.select",
                    "commandId": "scene-unicode",
                    "payload": {"sceneId": "scene:salão-memória"},
                }
            )
            master_second = master.receive_json()
            player_second = player.receive_json()
            assert master_second["state"]["scene"]["id"] == "scene:salão-memória"
            assert player_second["state"]["tokens"] == {}
            assert _asset_request(
                client,
                room["roomId"],
                ids["overlay"],
                player_access["mediaToken"],
            ).status_code == 404

            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "spawn-second-scene",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Na memória",
                        "x": 0.5,
                        "y": 0.5,
                    },
                }
            )
            master_second_token = master.receive_json()
            player_second_token = player.receive_json()
            second_token_id = next(iter(player_second_token["state"]["tokens"]))

            master.send_json(
                {
                    "type": "scene.select",
                    "commandId": "scene-return",
                    "payload": {"sceneId": "scene:salao-vazio"},
                }
            )
            master_return = master.receive_json()
            player_return = player.receive_json()
            assert public_token_id in player_return["state"]["tokens"]
            assert second_token_id not in master_return["state"]["tokens"]

            master.send_json(
                {
                    "type": "scene.select",
                    "commandId": "scene-second-again",
                    "payload": {"sceneId": "scene:salão-memória"},
                }
            )
            assert second_token_id in master.receive_json()["state"]["tokens"]
            assert second_token_id in player.receive_json()["state"]["tokens"]

            master.send_json(
                {
                    "type": "token.remove",
                    "commandId": "remove-second",
                    "payload": {"tokenId": second_token_id},
                }
            )
            assert second_token_id not in master.receive_json()["state"]["tokens"]
            assert second_token_id not in player.receive_json()["state"]["tokens"]


def test_prop_visual_updates_are_restricted_to_states_of_the_same_group(
    tmp_path: Path,
) -> None:
    app, _catalog, ids = _catalog_app(tmp_path, prop_states=True)
    with TestClient(app) as client:
        room = _create_room(client, campaignId="memoria")
        master_access = _issue_access(client, room, "masterInviteToken")
        player_access = _issue_access(client, room, "playerInviteToken")
        socket_path = f"/ws/vtt/rooms/{room['roomId']}"

        with client.websocket_connect(
            f"{socket_path}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master, client.websocket_connect(
            f"{socket_path}?ticket={player_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as player:
            master_initial = master.receive_json()
            player.receive_json()
            groups = master_initial["state"]["catalog"]["propStateGroups"]
            assert groups[0]["id"] == "state-group:ancora"
            assert [state["assetId"] for state in groups[0]["states"]] == [
                ids["prop"],
                ids["prop_alt"],
            ]

            master.send_json(
                {
                    "type": "prop.spawn",
                    "commandId": "spawn-stateful-prop",
                    "payload": {
                        "assetId": ids["prop"],
                        "label": "Ancora",
                        "x": 0.5,
                        "y": 0.5,
                    },
                }
            )
            spawned_master = master.receive_json()
            player.receive_json()
            prop_id = next(iter(spawned_master["state"]["props"]))

            master.send_json(
                {
                    "type": "prop.update",
                    "commandId": "swap-valid-state",
                    "payload": {"propId": prop_id, "assetId": ids["prop_alt"]},
                }
            )
            swapped_master = master.receive_json()
            player.receive_json()
            assert swapped_master["state"]["props"][prop_id]["assetId"] == ids["prop_alt"]
            revision = swapped_master["revision"]

            master.send_json(
                {
                    "type": "prop.update",
                    "commandId": "swap-unrelated-prop",
                    "payload": {
                        "propId": prop_id,
                        "assetId": ids["prop_ungrouped"],
                    },
                }
            )
            rejected = master.receive_json()
            assert rejected["error"]["code"] == "prop_state_mismatch"
            runtime_room = app.state.vtt._rooms[room["roomId"]]
            assert runtime_room.revision == revision
            assert runtime_room.scene_props[runtime_room.active_scene_id][prop_id].asset_id == ids[
                "prop_alt"
            ]


def test_catalog_room_enforces_global_token_limit(tmp_path: Path) -> None:
    app, _catalog, ids = _catalog_app(tmp_path)
    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _issue_access(client, room, "masterInviteToken")
        with client.websocket_connect(
            f"/ws/vtt/rooms/{room['roomId']}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master:
            master.receive_json()
            runtime_room = app.state.vtt._rooms[room["roomId"]]
            scene_tokens = runtime_room.scene_tokens[runtime_room.active_scene_id]
            for index in range(256):
                token_id = f"limit-{index}"
                scene_tokens[token_id] = CatalogToken(
                    token_id=token_id,
                    asset_id=ids["token_player"],
                    x=0.5,
                    y=0.5,
                    label=token_id,
                    size=0.08,
                    movable=True,
                    visible=True,
                )

            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "over-limit",
                    "payload": {
                        "assetId": ids["token_player"],
                        "label": "Excedente",
                        "x": 0.5,
                        "y": 0.5,
                    },
                }
            )
            error = master.receive_json()
            assert error["error"]["code"] == "token_limit"
            assert runtime_room.revision == 0
            assert len(scene_tokens) == 256


def test_public_gm_controlled_token_is_visible_but_not_player_movable(
    tmp_path: Path,
) -> None:
    app, _catalog, ids = _catalog_app(tmp_path)
    with TestClient(app) as client:
        room = _create_room(client)
        master_access = _issue_access(client, room, "masterInviteToken")
        player_access = _issue_access(client, room, "playerInviteToken")
        socket_path = f"/ws/vtt/rooms/{room['roomId']}"

        with client.websocket_connect(
            f"{socket_path}?ticket={master_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as master, client.websocket_connect(
            f"{socket_path}?ticket={player_access['ticket']}",
            headers={"Origin": ORIGIN},
        ) as player:
            master.receive_json()
            player.receive_json()
            master.send_json(
                {
                    "type": "token.spawn",
                    "commandId": "spawn-public-gm-controlled",
                    "payload": {
                        "assetId": ids["token_public_gm"],
                        "label": "Testemunha",
                        "x": 0.5,
                        "y": 0.5,
                    },
                }
            )
            master_snapshot = master.receive_json()
            player_snapshot = player.receive_json()
            token_id = next(iter(player_snapshot["state"]["tokens"]))
            assert master_snapshot["state"]["tokens"][token_id]["movable"] is False
            assert player_snapshot["state"]["tokens"][token_id]["movable"] is False

            player.send_json(
                {
                    "type": "token.move",
                    "commandId": "move-public-gm-controlled",
                    "payload": {"tokenId": token_id, "x": 0.6, "y": 0.6},
                }
            )
            assert player.receive_json()["error"]["code"] == "token_forbidden"
