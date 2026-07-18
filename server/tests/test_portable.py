from __future__ import annotations

import json
from pathlib import Path

import pytest

from caos_vtt import portable
from caos_vtt.portable import (
    DEMO_MODE_MARKER,
    FIREBASE_PROJECT_FILE_NAME,
    FIREBASE_PROJECT_PLACEHOLDER,
    PUBLIC_ORIGIN_PLACEHOLDER,
    build_portable_settings,
    load_portable_catalog,
    read_firebase_project_file,
    read_public_origin_file,
    resolve_campaign_paths,
    resolve_firebase_project_id,
)


def test_portable_settings_are_loopback_only_and_ephemeral() -> None:
    first = build_portable_settings(8765)
    second = build_portable_settings(8765)

    assert first.bind_host == "127.0.0.1"
    assert first.bind_port == 8765
    assert first.allowed_origins == (
        "http://127.0.0.1:8765",
        "http://localhost:8765",
    )
    assert first.host_token != second.host_token
    assert len(first.host_token) >= 32
    assert first.firebase_project_id is None


def test_portable_settings_accept_only_explicit_tunnel_origins() -> None:
    settings = build_portable_settings(8765, ("https://mesa.example.com",))
    assert settings.allowed_origins[-1] == "https://mesa.example.com"

    with pytest.raises(ValueError, match="Origem invalida"):
        build_portable_settings(8765, ("https://mesa.example.com/path",))

    with pytest.raises(ValueError, match="HTTPS"):
        build_portable_settings(8765, ("http://mesa.example.com",))


def test_public_origin_file_is_read_inside_the_executable(tmp_path: Path) -> None:
    origin_file = tmp_path / "ORIGEM-WEB.txt"
    origin_file.write_text("https://mesa.example.com\n", encoding="utf-8")
    assert read_public_origin_file(origin_file) == ("https://mesa.example.com",)

    origin_file.write_text(PUBLIC_ORIGIN_PLACEHOLDER, encoding="utf-8")
    assert read_public_origin_file(origin_file) == ()

    origin_file.write_text("https://mesa.example.com\nhttps://outra.example.com", encoding="utf-8")
    with pytest.raises(ValueError, match="somente uma URL"):
        read_public_origin_file(origin_file)

    origin_file.write_text("https://mesa.example.com/caminho", encoding="utf-8")
    with pytest.raises(ValueError, match="Origem invalida"):
        read_public_origin_file(origin_file)


def test_portable_settings_receive_validated_firebase_project_id() -> None:
    settings = build_portable_settings(
        8765,
        firebase_project_id="caos-rpg-prod",
    )
    assert settings.firebase_project_id == "caos-rpg-prod"

    with pytest.raises(ValueError, match="FIREBASE_PROJECT_ID invalido"):
        build_portable_settings(8765, firebase_project_id="invalido.com")


def test_firebase_project_file_contains_only_public_project_id(tmp_path: Path) -> None:
    project_file = tmp_path / FIREBASE_PROJECT_FILE_NAME
    project_file.write_text("caos-rpg-prod\n", encoding="utf-8")
    assert read_firebase_project_file(project_file) == "caos-rpg-prod"

    project_file.write_text(FIREBASE_PROJECT_PLACEHOLDER, encoding="utf-8")
    assert read_firebase_project_file(project_file) is None

    project_file.write_text("caos-rpg-prod\noutro-projeto", encoding="utf-8")
    with pytest.raises(ValueError, match="somente um project ID"):
        read_firebase_project_file(project_file)

    project_file.write_text("VITE_APP_PROJECT_ID=caos-rpg-prod", encoding="utf-8")
    with pytest.raises(ValueError, match="FIREBASE_PROJECT_ID invalido"):
        read_firebase_project_file(project_file)


def test_frozen_portable_discovers_adjacent_firebase_project_file(
    tmp_path: Path,
) -> None:
    executable = tmp_path / "CAOS-VTT.exe"
    executable.write_bytes(b"")
    project_file = tmp_path / FIREBASE_PROJECT_FILE_NAME
    project_file.write_text("caos-rpg-prod\n", encoding="utf-8")

    assert resolve_firebase_project_id(
        None,
        None,
        frozen=True,
        executable=executable,
    ) == "caos-rpg-prod"
    assert (
        resolve_firebase_project_id(
            None,
            None,
            frozen=False,
            executable=executable,
        )
        is None
    )
    assert resolve_firebase_project_id("outro-projeto", None) == "outro-projeto"

    with pytest.raises(ValueError, match="nunca os dois"):
        resolve_firebase_project_id("outro-projeto", project_file)


def test_portable_cli_accepts_project_id_or_file_but_not_both(tmp_path: Path) -> None:
    project_file = tmp_path / FIREBASE_PROJECT_FILE_NAME
    by_id = portable._parser().parse_args(
        ["--firebase-project-id", "caos-rpg-prod"]
    )
    by_file = portable._parser().parse_args(
        ["--firebase-project-file", str(project_file)]
    )

    assert by_id.firebase_project_id == "caos-rpg-prod"
    assert by_file.firebase_project_file == project_file
    with pytest.raises(SystemExit):
        portable._parser().parse_args(
            [
                "--firebase-project-id",
                "caos-rpg-prod",
                "--firebase-project-file",
                str(project_file),
            ]
        )


def _write_empty_campaign_manifest(root: Path, *, source_ref: str = "mnemosyne") -> Path:
    root.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schemaVersion": 2,
        "campaign": {
            "id": "mnemosyne",
            "title": "Projeto Mnemosyne",
            "sourceRef": source_ref,
            "sourceMode": "runtime-pack-read-only",
        },
        "assets": [],
        "documents": [],
        "collections": {
            "scenes": [],
            "stateGroups": [],
            "tokenAssetIds": [],
        },
    }
    manifest_path = root / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def test_explicit_campaign_arguments_must_be_supplied_as_a_pair(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.json"
    root = tmp_path / "campaign"

    with pytest.raises(ValueError, match="precisam ser informados juntos"):
        resolve_campaign_paths(manifest, None, frozen=False)
    with pytest.raises(ValueError, match="precisam ser informados juntos"):
        resolve_campaign_paths(None, root, frozen=False)

    assert resolve_campaign_paths(manifest, root, frozen=False) == (manifest, root)
    arguments = portable._parser().parse_args(
        [
            "--campaign-manifest",
            str(manifest),
            "--campaign-root",
            str(root),
        ]
    )
    assert arguments.campaign_manifest == manifest
    assert arguments.campaign_root == root


def test_source_execution_never_autodiscovers_a_campaign(tmp_path: Path) -> None:
    executable = tmp_path / "CAOS-VTT.exe"
    executable.write_bytes(b"")
    _write_empty_campaign_manifest(tmp_path / "campaigns" / "mnemosyne")

    assert (
        resolve_campaign_paths(None, None, frozen=False, executable=executable)
        is None
    )


def test_frozen_executable_discovers_only_adjacent_runtime_pack(tmp_path: Path) -> None:
    executable = tmp_path / "CAOS-VTT.exe"
    executable.write_bytes(b"")
    campaign_root = tmp_path / "campaigns" / "mnemosyne"
    manifest = _write_empty_campaign_manifest(campaign_root)

    assert resolve_campaign_paths(
        None,
        None,
        frozen=True,
        executable=executable,
    ) == (manifest, campaign_root)


def test_frozen_demo_requires_explicit_build_marker(tmp_path: Path) -> None:
    executable = tmp_path / "CAOS-VTT.exe"
    executable.write_bytes(b"")

    with pytest.raises(RuntimeError, match="pack de campanha empacotado nao foi encontrado"):
        resolve_campaign_paths(None, None, frozen=True, executable=executable)

    (tmp_path / DEMO_MODE_MARKER).write_text(
        "Build demo criado com -SkipCampaign.\n",
        encoding="utf-8",
    )
    assert resolve_campaign_paths(None, None, frozen=True, executable=executable) is None

    incomplete = tmp_path / "campaigns" / "mnemosyne"
    incomplete.mkdir(parents=True)
    with pytest.raises(RuntimeError, match="esta incompleto"):
        resolve_campaign_paths(None, None, frozen=True, executable=executable)


def test_loads_catalog_with_mnemosyne_source_ref_mapping(tmp_path: Path) -> None:
    campaign_root = tmp_path / "campaigns" / "mnemosyne"
    manifest = _write_empty_campaign_manifest(campaign_root)

    catalog = load_portable_catalog((manifest, campaign_root))

    assert catalog is not None
    assert catalog.campaign_title == "Projeto Mnemosyne"
    assert catalog.source_ref == "mnemosyne"
    assert catalog.list_scenes("master") == ()
    assert load_portable_catalog(None) is None


def test_catalog_errors_are_clear_and_happen_before_starting_tunnel(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    campaign_root = tmp_path / "campaign"
    manifest = _write_empty_campaign_manifest(campaign_root, source_ref="outra-campanha")
    with pytest.raises(RuntimeError, match="Falha ao carregar o pack de campanha"):
        load_portable_catalog((manifest, campaign_root))

    monkeypatch.setattr(portable, "_port_is_available", lambda _port: True)
    monkeypatch.setattr(
        portable,
        "resolve_campaign_paths",
        lambda *_args, **_kwargs: (manifest, campaign_root),
    )
    monkeypatch.setattr(
        portable,
        "load_portable_catalog",
        lambda _paths: (_ for _ in ()).throw(RuntimeError("pack invalido")),
    )
    monkeypatch.setattr(
        portable,
        "find_cloudflared_executable",
        lambda: (_ for _ in ()).throw(AssertionError("tunel nao deveria iniciar")),
    )

    with pytest.raises(RuntimeError, match="pack invalido"):
        portable.run(["--tunnel", "--no-browser"])


def test_invalid_manual_origin_is_rejected_before_tunnel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(portable, "_port_is_available", lambda _port: True)
    monkeypatch.setattr(
        portable,
        "find_cloudflared_executable",
        lambda: (_ for _ in ()).throw(AssertionError("tunel nao deveria iniciar")),
    )

    with pytest.raises(ValueError, match="Origem invalida"):
        portable.run(
            [
                "--tunnel",
                "--no-browser",
                "--public-origin",
                "https://mesa.example.com/caminho",
            ]
        )
