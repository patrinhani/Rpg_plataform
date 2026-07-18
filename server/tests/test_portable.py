from __future__ import annotations

import json
from pathlib import Path

import pytest

from caos_vtt import portable
from caos_vtt.portable import (
    DEMO_MODE_MARKER,
    build_portable_settings,
    load_portable_catalog,
    resolve_campaign_paths,
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


def test_portable_settings_accept_only_explicit_tunnel_origins() -> None:
    settings = build_portable_settings(8765, ("https://mesa.example.com",))
    assert settings.allowed_origins[-1] == "https://mesa.example.com"

    with pytest.raises(ValueError, match="Origem invalida"):
        build_portable_settings(8765, ("https://mesa.example.com/path",))

    with pytest.raises(ValueError, match="HTTPS"):
        build_portable_settings(8765, ("http://mesa.example.com",))


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
