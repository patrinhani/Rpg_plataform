from __future__ import annotations

import hashlib
import json
import stat
from pathlib import Path

import pytest

from server.caos_vtt.campaign import CampaignCatalog
from tools.campaign_pack import build as pack_module
from tools.campaign_pack.build import (
    AssetIntegrityError,
    OutputSafetyError,
    PackManifestError,
    SourceChangedError,
    UnsafePathError,
    build_pack,
    check_pack,
    main,
)


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _asset(
    source: Path,
    relative_path: str,
    payload: bytes,
    *,
    kind: str,
    audience: str = "players",
) -> dict[str, object]:
    path = source.joinpath(*relative_path.split("/"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return {
        "id": f"asset:{relative_path}",
        "relativePath": relative_path,
        "kind": kind,
        "audience": audience,
        "controlledBy": "gm" if audience == "gm" else "players",
        "bytes": len(payload),
        "sha256": _sha256(payload),
        "mediaType": "application/octet-stream",
        "image": None,
    }


def _fixture(tmp_path: Path) -> tuple[Path, Path, dict[str, object], dict[str, str]]:
    source = tmp_path / "Campanha fonte"
    source.mkdir()
    definitions = (
        ("player_old", "assets/mapas/cena-player-v1.bin", b"player-map-old", "map", "players"),
        ("player", "assets/mapas/cena-player-v2.bin", b"player-map-v1", "map", "players"),
        ("gm", "assets/mapas/cena-gm-v1.bin", b"gm-guide-v1", "map", "gm"),
        ("overlay", "assets/mapas/cena-nevoa-v1.bin", b"overlay-nevoa", "overlay", "players"),
        ("token", "assets/tokens/agente-e-v1.bin", b"token-agente", "token", "players"),
        ("unused_token", "assets/tokens/nao-listado-v1.bin", b"unused-token", "token", "players"),
        ("prop", "assets/objetos/ancora-v1.bin", b"prop-ancora", "prop", "players"),
        (
            "handout",
            "assets/handouts/segredo-v1.bin",
            b"handout-secreto",
            "handout",
            "players",
        ),
    )
    assets: list[dict[str, object]] = []
    ids: dict[str, str] = {}
    for name, path, payload, kind, audience in definitions:
        item = _asset(source, path, payload, kind=kind, audience=audience)
        assets.append(item)
        ids[name] = str(item["id"])

    document_path = source / "docs" / "segredo.md"
    document_path.parent.mkdir()
    document_path.write_text("# Segredo do mestre\n", encoding="utf-8")
    manifest: dict[str, object] = {
        "schemaVersion": 2,
        "generator": {"name": "fixture", "version": "2.0"},
        "campaign": {
            "id": "fixture",
            "title": "Campanha Memoria",
            "sourceRef": "fixture",
            "sourceMode": "external-read-only",
        },
        "summary": {},
        "assets": assets,
        "documents": [
            {
                "id": "document:docs/segredo",
                "relativePath": "docs/segredo.md",
                "title": "Segredo",
                "audienceHint": "gm",
                "bytes": document_path.stat().st_size,
                "sha256": hashlib.sha256(document_path.read_bytes()).hexdigest(),
                "encoding": "utf-8",
            }
        ],
        "collections": {
            "scenes": [
                {
                    "id": "scene:cena",
                    "key": "cena",
                    "playerMaps": [
                        {"assetId": ids["player_old"], "version": 1},
                        {"assetId": ids["player"], "version": 2},
                    ],
                    "gmGuideMaps": [{"assetId": ids["gm"], "version": 1}],
                    "overlays": [
                        {"assetId": ids["overlay"], "name": "nevoa", "version": 1}
                    ],
                    "activePlayerMap": ids["player"],
                    "activeGmGuideMap": ids["gm"],
                    "gridHint": {"type": "square", "columns": 20, "rows": 20},
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
            "tokenAssetIds": [ids["token"]],
            "propAssetIds": [ids["prop"]],
            "handoutAssetIds": [ids["handout"]],
        },
        "warnings": [
            {"code": "fixture", "path": "docs/segredo.md", "message": "x"},
            {
                "code": "runtime-derivative-recommended",
                "path": "assets/tokens/agente-e-v1.bin",
                "message": "Token grande",
            },
        ],
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest_path, source, manifest, ids


def _tree_snapshot(root: Path) -> dict[str, tuple[str, int, int]]:
    result: dict[str, tuple[str, int, int]] = {}
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        info = path.stat()
        result[path.relative_to(root).as_posix()] = (
            hashlib.sha256(path.read_bytes()).hexdigest(),
            info.st_size,
            info.st_mtime_ns,
        )
    return result


def _pack_tree(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(item for item in root.rglob("*") if item.is_file())
    }


def test_selects_scene_tokens_and_props_but_excludes_handouts(tmp_path: Path) -> None:
    manifest_path, source, _manifest, ids = _fixture(tmp_path)
    output = tmp_path / "runtime-pack"

    result = build_pack(manifest_path, source, output)
    runtime = json.loads((output / "manifest.json").read_text(encoding="utf-8"))

    assert result.asset_count == 5
    assert result.total_bytes == sum(
        len(value)
        for value in (
            b"player-map-v1",
            b"gm-guide-v1",
            b"overlay-nevoa",
            b"token-agente",
            b"prop-ancora",
        )
    )
    assert runtime["campaign"]["sourceRef"] == "fixture"
    assert runtime["documents"] == []
    assert runtime["collections"]["stateGroups"] == [
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
    ]
    assert runtime["summary"]["stateGroupCount"] == 1
    assert runtime["collections"]["propAssetIds"] == [ids["prop"]]
    assert runtime["collections"]["handoutAssetIds"] == []
    assert runtime["warnings"] == [
        {
            "code": "runtime-derivative-recommended",
            "message": "Token grande",
            "path": "assets/tokens/agente-e-v1.bin",
        }
    ]
    assert runtime["summary"]["warningCount"] == 1
    assert {item["id"] for item in runtime["assets"]} == {
        ids["player"],
        ids["gm"],
        ids["overlay"],
        ids["token"],
        ids["prop"],
    }
    assert not (output / "assets" / "tokens" / "nao-listado-v1.bin").exists()
    assert not (output / "assets" / "mapas" / "cena-player-v1.bin").exists()
    assert (output / "assets" / "objetos" / "ancora-v1.bin").read_bytes() == b"prop-ancora"
    assert not (output / "assets" / "handouts" / "segredo-v1.bin").exists()
    assert not (output / "docs").exists()
    assert str(source.resolve()) not in (output / "manifest.json").read_text(encoding="utf-8")

    catalog = CampaignCatalog.load(output / "manifest.json", {"fixture": output})
    assert catalog.list_scenes("master")[0].active_player_map == ids["player"]
    assert catalog.list_scenes("player")[0].gm_guide_maps == ()
    assert [item.asset_id for item in catalog.list_tokens("player")] == [ids["token"]]
    assert [item.asset_id for item in catalog.list_props("master")] == [ids["prop"]]
    assert catalog.list_handouts("master") == ()
    assert catalog.resolve_asset(ids["token"], "player").path.read_bytes() == b"token-agente"


def test_builds_older_manifest_without_new_asset_collections(tmp_path: Path) -> None:
    manifest_path, source, manifest, ids = _fixture(tmp_path)
    collections = manifest["collections"]  # type: ignore[assignment]
    collections.pop("propAssetIds")  # type: ignore[union-attr]
    collections.pop("handoutAssetIds")  # type: ignore[union-attr]
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    output = tmp_path / "runtime-pack"
    result = build_pack(manifest_path, source, output)
    runtime = json.loads((output / "manifest.json").read_text(encoding="utf-8"))

    assert result.asset_count == 4
    assert runtime["collections"]["propAssetIds"] == []
    assert runtime["collections"]["handoutAssetIds"] == []
    assert ids["prop"] not in {item["id"] for item in runtime["assets"]}
    assert ids["handout"] not in {item["id"] for item in runtime["assets"]}


@pytest.mark.parametrize(
    ("collection_name", "asset_key", "expected_kind"),
    (
        ("propAssetIds", "token", "prop"),
        ("handoutAssetIds", "prop", "handout"),
    ),
)
def test_rejects_new_collection_ids_with_wrong_kind(
    tmp_path: Path,
    collection_name: str,
    asset_key: str,
    expected_kind: str,
) -> None:
    manifest_path, source, manifest, ids = _fixture(tmp_path)
    manifest["collections"][collection_name] = [ids[asset_key]]  # type: ignore[index]
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(PackManifestError, match=expected_kind):
        check_pack(manifest_path, source)


@pytest.mark.parametrize(
    "unsafe_path",
    (
        "../escape.bin",
        "/escape.bin",
        "C:/escape.bin",
        "assets\\escape.bin",
        "assets/../escape.bin",
        "assets/escape.bin\x00hidden",
        "assets/CON/escape.bin",
        "assets/folder./escape.bin",
    ),
)
def test_rejects_path_traversal_and_nonportable_paths(
    tmp_path: Path, unsafe_path: str
) -> None:
    manifest_path, source, manifest, ids = _fixture(tmp_path)
    asset = manifest["assets"][0]  # type: ignore[index]
    old_id = ids["player"]
    new_id = f"asset:{unsafe_path}"
    asset["relativePath"] = unsafe_path  # type: ignore[index]
    asset["id"] = new_id  # type: ignore[index]
    scene = manifest["collections"]["scenes"][0]  # type: ignore[index]
    scene["playerMaps"][0]["assetId"] = new_id  # type: ignore[index]
    scene["activePlayerMap"] = new_id  # type: ignore[index]
    assert old_id != new_id
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(PackManifestError):
        check_pack(manifest_path, source)


def test_rejects_hash_mismatch_without_creating_output(tmp_path: Path) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    target = source / "assets" / "tokens" / "agente-e-v1.bin"
    target.write_bytes(b"X" * target.stat().st_size)
    output = tmp_path / "runtime-pack"

    with pytest.raises(AssetIntegrityError, match="SHA-256"):
        build_pack(manifest_path, source, output)

    assert not output.exists()
    assert not list(tmp_path.glob(".runtime-pack.*.tmp"))


def test_output_is_deterministic_and_managed_pack_can_be_replaced(tmp_path: Path) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    first = tmp_path / "first-pack"
    second = tmp_path / "second-pack"

    build_pack(manifest_path, source, first)
    first_tree = _pack_tree(first)
    build_pack(manifest_path, source, second)
    assert _pack_tree(second) == first_tree
    assert (first / "manifest.json").read_bytes().endswith(b"\n")
    assert b"\r\n" not in (first / "manifest.json").read_bytes()

    # Rebuilding the same managed directory exercises the transactional swap.
    build_pack(manifest_path, source, first)
    assert _pack_tree(first) == first_tree
    assert not list(tmp_path.glob(".first-pack.*.old"))
    assert not list(tmp_path.glob(".first-pack.*.tmp"))


def test_source_tree_is_unchanged_after_build_and_check(tmp_path: Path) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    before = _tree_snapshot(source)

    checked = check_pack(manifest_path, source)
    built = build_pack(manifest_path, source, tmp_path / "runtime-pack")

    assert checked.asset_count == built.asset_count == 5
    assert _tree_snapshot(source) == before


def test_detects_source_changed_between_preflight_and_copy(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    output = tmp_path / "runtime-pack"
    original = pack_module._copy_verified_asset
    changed = False

    def copy_then_mutate(*args: object, **kwargs: object) -> None:
        nonlocal changed
        original(*args, **kwargs)
        if not changed:
            target = source / "assets" / "tokens" / "agente-e-v1.bin"
            target.write_bytes(b"Y" * target.stat().st_size)
            changed = True

    monkeypatch.setattr(pack_module, "_copy_verified_asset", copy_then_mutate)
    with pytest.raises((SourceChangedError, AssetIntegrityError)):
        build_pack(manifest_path, source, output)

    assert not output.exists()
    assert not list(tmp_path.glob(".runtime-pack.*.tmp"))


def test_rejects_symlink_asset_even_if_target_matches(tmp_path: Path) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    asset = source / "assets" / "tokens" / "agente-e-v1.bin"
    external = tmp_path / "external.bin"
    external.write_bytes(asset.read_bytes())
    asset.unlink()
    try:
        asset.symlink_to(external)
    except OSError as error:
        pytest.skip(f"symlink indisponivel: {error}")

    with pytest.raises(UnsafePathError, match="link"):
        check_pack(manifest_path, source)


def test_refuses_output_overlap_and_unmanaged_existing_directory(tmp_path: Path) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    with pytest.raises(OutputSafetyError, match="sobrepor"):
        build_pack(manifest_path, source, source / "runtime")

    unmanaged = tmp_path / "existing"
    unmanaged.mkdir()
    (unmanaged / "keep.txt").write_text("do not delete", encoding="utf-8")
    with pytest.raises(OutputSafetyError, match="nao esta vazio"):
        build_pack(manifest_path, source, unmanaged)
    assert (unmanaged / "keep.txt").read_text(encoding="utf-8") == "do not delete"


def test_check_cli_writes_nothing_and_output_is_optional(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    exit_code = main(
        ["--manifest", str(manifest_path), "--source-root", str(source), "--check"]
    )

    assert exit_code == 0
    assert capsys.readouterr().out.startswith("OK: 5 assets")
    assert {path.name for path in tmp_path.iterdir()} == {
        "Campanha fonte",
        "manifest.json",
    }


def test_pack_size_budget_is_enforced_before_writing(tmp_path: Path) -> None:
    manifest_path, source, _manifest, _ids = _fixture(tmp_path)
    output = tmp_path / "runtime-pack"

    with pytest.raises(PackManifestError, match="excede o limite"):
        build_pack(manifest_path, source, output, max_bytes=1)

    assert not output.exists()


def test_windows_reparse_flag_is_unsafe() -> None:
    fake = type("FakeStat", (), {"st_mode": stat.S_IFDIR, "st_file_attributes": 0x0400})()
    assert pack_module._stat_is_link_or_junction(fake)
