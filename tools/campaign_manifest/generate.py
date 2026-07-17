"""Gera um inventario leve e deterministico do Projeto Mnemosyne.

O gerador nunca altera a campanha de origem e nao copia seus assets. O JSON
resultante contem apenas metadados, hashes, uma referencia logica e caminhos relativos.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import stat
import struct
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any, Iterable
from xml.etree import ElementTree


SCHEMA_VERSION = 2
GENERATOR_VERSION = "1.1.0"
CAMPAIGN_ID = "mnemosyne"
CAMPAIGN_TITLE = "Projeto Mnemosyne"
CAMPAIGN_SOURCE_REF = "mnemosyne"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
HASH_CHUNK_SIZE = 1024 * 1024
KNOWN_OVERLAY_NAMES = (
    "eletrificacao",
    "fragmento-removido",
    "inundacao",
    "telas-quebradas",
)
STATE_ALIASES = {
    "ativo": "ativo",
    "ativa": "ativo",
    "desativado": "desativado",
    "desativada": "desativado",
    "ritual": "ritual",
    "recuperado": "recuperado",
}
GM_DOCUMENT_PATHS = frozenset(
    {
        "CONTEXTO_CODEX.md",
        "docs/arcos-futuros.md",
        "docs/biblia-da-campanha.md",
        "docs/faccoes.md",
        "docs/one-shot-01-criaturas-e-encontros.md",
        "docs/one-shot-01-memoria-corrompida.md",
        "docs/one-shot-01-npcs-e-locais.md",
        "docs/one-shot-01-pistas-e-handouts.md",
        "docs/personagens.md",
    }
)
GM_DOCUMENT_PREFIXES = ("docs/prompts/",)


class ManifestError(RuntimeError):
    """Erro esperado e apresentavel ao usuario da ferramenta."""


class UnsafeSourceError(ManifestError):
    """A entrada deixou de estar confinada a campanha durante a leitura."""


class SourceChangedError(ManifestError):
    """A origem foi alterada enquanto o inventario estava sendo produzido."""


def _is_link_or_junction(path: Path) -> bool:
    """Detecta links e reparse points sem depender de Path.is_junction (3.12+)."""

    try:
        if path.is_symlink():
            return True
        attributes = getattr(path.lstat(), "st_file_attributes", 0)
    except OSError:
        return False
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)
    return bool(attributes & reparse_flag)


def _assert_source_file(path: Path, source_root: Path, relative_path: str) -> Path:
    """Retorna o caminho resolvido somente quando ele continua dentro da campanha."""

    if _is_link_or_junction(path):
        raise UnsafeSourceError("link simbolico ou junction nao pode ser lido")
    try:
        resolved = path.resolve(strict=True)
        resolved.relative_to(source_root)
    except (OSError, ValueError) as error:
        raise UnsafeSourceError(f"caminho resolve fora da campanha: {relative_path}") from error
    if not resolved.is_file():
        raise UnsafeSourceError(f"entrada nao e arquivo regular: {relative_path}")
    return resolved


def _assert_source_directory(path: Path, source_root: Path, label: str) -> Path:
    if _is_link_or_junction(path):
        raise UnsafeSourceError(f"{label} nao pode ser link simbolico ou junction")
    try:
        resolved = path.resolve(strict=True)
        resolved.relative_to(source_root)
    except (OSError, ValueError) as error:
        raise UnsafeSourceError(f"{label} resolve fora da campanha") from error
    if not resolved.is_dir():
        raise UnsafeSourceError(f"{label} nao e um diretorio")
    return resolved


def _stat_signature(result: os.stat_result) -> tuple[int, int, int, int, int]:
    return (
        result.st_size,
        result.st_mtime_ns,
        result.st_ctime_ns,
        getattr(result, "st_dev", 0),
        getattr(result, "st_ino", 0),
    )


def _assert_file_unchanged(path: Path, before: os.stat_result) -> None:
    after = path.stat()
    if _stat_signature(before) != _stat_signature(after):
        raise SourceChangedError("arquivo alterado durante a leitura; execute novamente")


def _safe_diagnostic(error: Exception) -> str:
    """Evita gravar caminhos absolutos que OSError inclui em sua representacao."""

    if isinstance(error, OSError):
        return f"{type(error).__name__}: {error.strerror or 'falha de E/S'}"
    return str(error)


def _relative_posix(path: Path, root: Path) -> str:
    return PurePosixPath(path.relative_to(root)).as_posix()


def _asset_id(relative_path: str) -> str:
    # A extensao faz parte do ID porque a campanha pode manter PNG e SVG com o
    # mesmo nome-base como variantes legitimas do mesmo simbolo.
    return f"asset:{PurePosixPath(relative_path).as_posix()}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(HASH_CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def _png_metadata(path: Path) -> dict[str, Any]:
    width = height = color_type = None
    has_transparency_chunk = False

    with path.open("rb") as stream:
        if stream.read(8) != PNG_SIGNATURE:
            raise ManifestError("assinatura PNG invalida")

        while True:
            length_bytes = stream.read(4)
            if not length_bytes:
                break
            if len(length_bytes) != 4:
                raise ManifestError("chunk PNG truncado")

            chunk_length = struct.unpack(">I", length_bytes)[0]
            if chunk_length > 64 * 1024 * 1024:
                raise ManifestError("chunk PNG excede o limite de seguranca")

            chunk_type = stream.read(4)
            chunk_data = stream.read(chunk_length)
            chunk_crc = stream.read(4)
            if len(chunk_type) != 4 or len(chunk_data) != chunk_length or len(chunk_crc) != 4:
                raise ManifestError("chunk PNG incompleto")

            if chunk_type == b"IHDR":
                if chunk_length != 13:
                    raise ManifestError("IHDR PNG invalido")
                width, height, _depth, color_type, _compression, _filter, _interlace = struct.unpack(
                    ">IIBBBBB", chunk_data
                )
            elif chunk_type == b"tRNS":
                has_transparency_chunk = True
            elif chunk_type == b"IEND":
                break

    if width is None or height is None or color_type is None:
        raise ManifestError("PNG sem IHDR")

    return {
        "format": "png",
        "width": width,
        "height": height,
        "hasAlpha": color_type in (4, 6) or has_transparency_chunk,
        "pngColorType": color_type,
    }


def _svg_metadata(path: Path) -> dict[str, Any]:
    root = ElementTree.fromstring(path.read_text(encoding="utf-8-sig"))
    view_box = root.attrib.get("viewBox")
    title = root.findtext("{http://www.w3.org/2000/svg}title") or root.findtext("title")
    description = root.findtext("{http://www.w3.org/2000/svg}desc") or root.findtext("desc")
    return {
        "format": "svg",
        "viewBox": view_box,
        "title": title,
        "description": description,
        "hasAlpha": True,
    }


def _classify_asset(relative_path: str) -> tuple[str, str, str]:
    parts = PurePosixPath(relative_path).parts
    lowered = relative_path.casefold()

    if "mapas" in parts:
        if "guia-mestre" in parts:
            return "map", "gm", "gm"
        if "overlays" in parts or "-overlay-vtt-" in lowered:
            return "overlay", "players", "gm"
        return "map", "players", "gm"
    if "tokens" in parts:
        return "token", "players", "gm"
    if "objetos" in parts:
        return "prop", "players", "gm"
    if "simbolos" in parts:
        return "symbol", "unspecified", "gm"
    if "conceitos-visuais" in parts:
        return "concept", "gm", "gm"
    return "other", "unspecified", "gm"


def _image_metadata(path: Path) -> dict[str, Any] | None:
    suffix = path.suffix.casefold()
    if suffix == ".png":
        return _png_metadata(path)
    if suffix == ".svg":
        return _svg_metadata(path)
    return None


def _iter_source_files(directory: Path) -> Iterable[Path]:
    if not directory.exists():
        return ()
    if _is_link_or_junction(directory):
        return (directory,)

    def walk() -> Iterable[Path]:
        def raise_walk_error(error: OSError) -> None:
            raise error

        for current_root, directory_names, file_names in os.walk(
            directory,
            topdown=True,
            onerror=raise_walk_error,
            followlinks=False,
        ):
            current = Path(current_root)
            retained_directories: list[str] = []
            for name in directory_names:
                candidate = current / name
                if _is_link_or_junction(candidate):
                    yield candidate
                else:
                    retained_directories.append(name)
            directory_names[:] = retained_directories
            for name in file_names:
                yield current / name

    return walk()


def _document_audience(relative_path: str, text: str) -> str:
    if relative_path in GM_DOCUMENT_PATHS:
        return "gm"
    if any(relative_path.startswith(prefix) for prefix in GM_DOCUMENT_PREFIXES):
        return "gm"
    if "documento do mestre" in text[:1500].casefold():
        return "gm"
    return "unspecified"


def _document_metadata(path: Path, source_root: Path) -> dict[str, Any]:
    relative_path = _relative_posix(path, source_root)
    path = _assert_source_file(path, source_root, relative_path)
    before = path.stat()
    text = path.read_text(encoding="utf-8-sig")
    title = next(
        (line.lstrip("#").strip() for line in text.splitlines() if line.startswith("#")),
        path.stem,
    )
    metadata = {
        "id": f"document:{PurePosixPath(relative_path).with_suffix('').as_posix()}",
        "relativePath": relative_path,
        "title": title,
        "audienceHint": _document_audience(relative_path, text),
        "bytes": before.st_size,
        "sha256": _sha256(path),
        "encoding": "utf-8",
    }
    _assert_file_unchanged(path, before)
    return metadata


def _asset_metadata(path: Path, source_root: Path) -> dict[str, Any]:
    relative_path = _relative_posix(path, source_root)
    path = _assert_source_file(path, source_root, relative_path)
    before = path.stat()
    kind, audience, controlled_by = _classify_asset(relative_path)
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    metadata = {
        "id": _asset_id(relative_path),
        "relativePath": relative_path,
        "kind": kind,
        "audience": audience,
        "controlledBy": controlled_by,
        "bytes": before.st_size,
        "sha256": _sha256(path),
        "mediaType": media_type,
        "image": _image_metadata(path),
    }
    _assert_file_unchanged(path, before)
    return metadata


def _scene_key_and_role(
    asset: dict[str, Any],
) -> tuple[str | None, str | None, str | None, int | None]:
    stem = PurePosixPath(asset["relativePath"]).stem.casefold()

    match = re.match(r"^(?P<scene>.+)-battlemap-vtt-v(?P<version>\d+)$", stem)
    if match:
        return match.group("scene"), "playerMaps", None, int(match.group("version"))

    match = re.match(r"^(?P<scene>.+)-guia-mestre-v(?P<version>\d+)$", stem)
    if match:
        return match.group("scene"), "gmGuideMaps", None, int(match.group("version"))

    for overlay_name in KNOWN_OVERLAY_NAMES:
        match = re.match(
            rf"^(?P<scene>.+)-{re.escape(overlay_name)}-overlay-vtt-v(?P<version>\d+)$",
            stem,
        )
        if match:
            return match.group("scene"), "overlays", overlay_name, int(match.group("version"))

    return None, None, None, None


def _active_variant(
    variants: list[dict[str, Any]],
    warnings: list[dict[str, str]],
    scene_key: str,
    role: str,
) -> str | None:
    if not variants:
        return None
    highest_version = max(item["version"] for item in variants)
    candidates = [item for item in variants if item["version"] == highest_version]
    if len(candidates) != 1:
        warnings.append(
            {
                "code": f"scene-{role}-ambiguous",
                "path": scene_key,
                "message": (
                    f"Ha {len(candidates)} assets na versao ativa v{highest_version}; "
                    "defina a variante manualmente."
                ),
            }
        )
        return None
    return candidates[0]["assetId"]


def _build_scenes(assets: list[dict[str, Any]], warnings: list[dict[str, str]]) -> list[dict[str, Any]]:
    scenes: dict[str, dict[str, Any]] = {}
    assets_by_id = {asset["id"]: asset for asset in assets}

    for asset in assets:
        if asset["kind"] not in {"map", "overlay"}:
            continue
        scene_key, role, layer_name, version = _scene_key_and_role(asset)
        if not scene_key or not role or version is None:
            warnings.append(
                {
                    "code": "map-unmatched",
                    "path": asset["relativePath"],
                    "message": "O mapa nao foi associado automaticamente a uma cena.",
                }
            )
            continue

        scene = scenes.setdefault(
            scene_key,
            {
                "id": f"scene:{scene_key}",
                "key": scene_key,
                "playerMaps": [],
                "gmGuideMaps": [],
                "overlays": [],
                "activePlayerMap": None,
                "activeGmGuideMap": None,
                "gridHint": None,
            },
        )
        if role == "overlays":
            scene[role].append(
                {"assetId": asset["id"], "name": layer_name, "version": version}
            )
        else:
            scene[role].append({"assetId": asset["id"], "version": version})

    for scene_key, scene in scenes.items():
        scene["playerMaps"].sort(key=lambda item: (item["version"], item["assetId"]))
        scene["gmGuideMaps"].sort(key=lambda item: (item["version"], item["assetId"]))
        scene["overlays"].sort(
            key=lambda item: (item["name"], item["version"], item["assetId"])
        )
        scene["activePlayerMap"] = _active_variant(
            scene["playerMaps"], warnings, scene_key, "player-map"
        )
        scene["activeGmGuideMap"] = _active_variant(
            scene["gmGuideMaps"], warnings, scene_key, "gm-guide-map"
        )

        if scene_key == "salao-vazio":
            scene["gridHint"] = {
                "type": "square",
                "columns": 28,
                "rows": 28,
                "source": "campaign-documentation",
            }
        else:
            warnings.append(
                {
                    "code": "scene-grid-unknown",
                    "path": scene_key,
                    "message": "A campanha nao informa escala/origem de grade para esta cena.",
                }
            )

        base_id = scene["activePlayerMap"] or scene["activeGmGuideMap"]
        base_size = None
        if base_id:
            base_image = assets_by_id[base_id].get("image") or {}
            base_size = (base_image.get("width"), base_image.get("height"))

        for overlay in scene["overlays"]:
            image = assets_by_id[overlay["assetId"]].get("image") or {}
            overlay_size = (image.get("width"), image.get("height"))
            if base_size and overlay_size != base_size:
                warnings.append(
                    {
                        "code": "overlay-size-mismatch",
                        "path": assets_by_id[overlay["assetId"]]["relativePath"],
                        "message": f"Overlay {overlay_size} difere do mapa base {base_size}.",
                    }
                )

    return sorted(scenes.values(), key=lambda item: item["key"])


def _build_state_groups(
    assets: list[dict[str, Any]], warnings: list[dict[str, str]]
) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, list[dict[str, Any]]]] = {}
    state_pattern = "|".join(re.escape(state) for state in STATE_ALIASES)
    pattern = re.compile(
        rf"^(?P<base>.+)-(?P<state>{state_pattern})-objeto-vtt-v(?P<version>\d+)$"
    )

    for asset in assets:
        if asset["kind"] != "prop":
            continue
        stem = PurePosixPath(asset["relativePath"]).stem.casefold()
        match = pattern.match(stem)
        if not match:
            continue
        normalized_state = STATE_ALIASES[match.group("state")]
        groups.setdefault(match.group("base"), {}).setdefault(normalized_state, []).append(
            {"assetId": asset["id"], "version": int(match.group("version"))}
        )

    result: list[dict[str, Any]] = []
    for key, grouped_states in sorted(groups.items()):
        states: dict[str, dict[str, Any]] = {}
        for state_name, variants in sorted(grouped_states.items()):
            variants.sort(key=lambda item: (item["version"], item["assetId"]))
            highest_version = max(item["version"] for item in variants)
            candidates = [item for item in variants if item["version"] == highest_version]
            selected = candidates[-1]
            if len(variants) > 1:
                warnings.append(
                    {
                        "code": "state-duplicate",
                        "path": f"{key}/{state_name}",
                        "message": (
                            f"Estado possui {len(variants)} variantes; selecionada v{highest_version}."
                        ),
                    }
                )
            if len(candidates) > 1:
                warnings.append(
                    {
                        "code": "state-version-ambiguous",
                        "path": f"{key}/{state_name}",
                        "message": (
                            f"Ha {len(candidates)} assets na versao v{highest_version}; "
                            "a selecao por ID e apenas deterministica."
                        ),
                    }
                )
            states[state_name] = {
                "assetId": selected["assetId"],
                "version": selected["version"],
                "variants": variants,
            }
        result.append({"id": f"state-group:{key}", "key": key, "states": states})
    return result


def _source_fingerprint(assets: list[dict[str, Any]], documents: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for item in sorted([*assets, *documents], key=lambda entry: entry["relativePath"]):
        digest.update(item["relativePath"].encode("utf-8"))
        digest.update(b"\0")
        digest.update(item["sha256"].encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def build_manifest(source: Path) -> dict[str, Any]:
    """Constroi o manifesto em memoria sem escrever na campanha ou no destino."""

    source_root = source.expanduser().resolve()
    if not source_root.is_dir():
        raise ManifestError(f"Pasta de campanha inexistente: {source_root}")

    assets_root = source_root / "assets"
    if not assets_root.is_dir():
        raise ManifestError(f"Pasta assets nao encontrada em: {assets_root}")
    _assert_source_directory(assets_root, source_root, "Pasta assets")

    warnings: list[dict[str, str]] = []
    assets: list[dict[str, Any]] = []
    for path in sorted(_iter_source_files(assets_root), key=lambda item: _relative_posix(item, source_root).casefold()):
        relative_path = _relative_posix(path, source_root)
        if _is_link_or_junction(path):
            warnings.append(
                {
                    "code": "link-skipped",
                    "path": relative_path,
                    "message": "Link simbolico ou junction ignorado para manter a leitura dentro da campanha.",
                }
            )
            continue
        try:
            asset = _asset_metadata(path, source_root)
            assets.append(asset)
            if asset["kind"] in {"token", "prop"} and (
                asset["bytes"] > 1024 * 1024
                or (asset.get("image") or {}).get("width", 0) > 1024
            ):
                warnings.append(
                    {
                        "code": "runtime-derivative-recommended",
                        "path": relative_path,
                        "message": "Asset grande para uso em token/objeto; gere derivado WebP sem alterar o original.",
                    }
                )
        except (UnsafeSourceError, SourceChangedError):
            raise
        except (OSError, UnicodeError, ElementTree.ParseError, ManifestError) as error:
            warnings.append(
                {
                    "code": "asset-metadata-error",
                    "path": relative_path,
                    "message": _safe_diagnostic(error),
                }
            )

    document_paths: list[Path] = []
    for root_name in ("README.md", "CONTEXTO_CODEX.md"):
        candidate = source_root / root_name
        if candidate.is_file():
            document_paths.append(candidate)
    for directory_name in ("docs", "templates"):
        directory = source_root / directory_name
        if directory.is_dir():
            document_paths.extend(
                path
                for path in _iter_source_files(directory)
                if _is_link_or_junction(path) or path.suffix.casefold() == ".md"
            )

    documents: list[dict[str, Any]] = []
    for path in sorted(set(document_paths), key=lambda item: _relative_posix(item, source_root).casefold()):
        relative_path = _relative_posix(path, source_root)
        if _is_link_or_junction(path):
            warnings.append(
                {
                    "code": "link-skipped",
                    "path": relative_path,
                    "message": "Link simbolico ou junction de documento ignorado.",
                }
            )
            continue
        try:
            documents.append(_document_metadata(path, source_root))
        except (UnsafeSourceError, SourceChangedError):
            raise
        except (OSError, UnicodeError) as error:
            warnings.append(
                {
                    "code": "document-metadata-error",
                    "path": relative_path,
                    "message": _safe_diagnostic(error),
                }
            )

    assets.sort(key=lambda item: item["relativePath"])
    documents.sort(key=lambda item: item["relativePath"])
    scenes = _build_scenes(assets, warnings)
    state_groups = _build_state_groups(assets, warnings)
    warnings.sort(key=lambda item: (item["code"], item["path"], item["message"]))

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generator": {
            "name": "caos-campaign-manifest",
            "version": GENERATOR_VERSION,
        },
        "campaign": {
            "id": CAMPAIGN_ID,
            "title": CAMPAIGN_TITLE,
            "sourceRef": CAMPAIGN_SOURCE_REF,
            "sourceMode": "external-read-only",
        },
        "summary": {
            "assetCount": len(assets),
            "documentCount": len(documents),
            "sceneCount": len(scenes),
            "stateGroupCount": len(state_groups),
            "totalAssetBytes": sum(asset["bytes"] for asset in assets),
            "warningCount": len(warnings),
            "sourceFingerprint": _source_fingerprint(assets, documents),
        },
        "assets": assets,
        "documents": documents,
        "collections": {
            "scenes": scenes,
            "stateGroups": state_groups,
            "tokenAssetIds": [asset["id"] for asset in assets if asset["kind"] == "token"],
        },
        "warnings": warnings,
    }
    validate_manifest(manifest)
    return manifest


def validate_manifest(manifest: dict[str, Any]) -> None:
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise ManifestError("schemaVersion inesperada")

    campaign = manifest.get("campaign")
    if not isinstance(campaign, dict) or not isinstance(campaign.get("sourceRef"), str):
        raise ManifestError("campaign.sourceRef ausente")
    if "sourceRoot" in campaign:
        raise ManifestError("campaign.sourceRoot absoluto nao pode integrar o manifesto")

    assets = manifest.get("assets")
    documents = manifest.get("documents")
    if not isinstance(assets, list) or not isinstance(documents, list):
        raise ManifestError("assets/documents devem ser listas")

    asset_ids = [asset.get("id") for asset in assets]
    paths = [asset.get("relativePath") for asset in assets]
    if len(asset_ids) != len(set(asset_ids)):
        raise ManifestError("IDs de assets duplicados")
    if len(paths) != len(set(paths)):
        raise ManifestError("caminhos de assets duplicados")

    for relative_path in [*paths, *(document.get("relativePath") for document in documents)]:
        if not isinstance(relative_path, str) or not relative_path:
            raise ManifestError("caminho relativo ausente")
        path = PurePosixPath(relative_path)
        if path.is_absolute() or ".." in path.parts or "\\" in relative_path:
            raise ManifestError(f"caminho relativo inseguro: {relative_path}")

    referenced_ids: set[str] = set()
    for scene in manifest["collections"]["scenes"]:
        for collection_name in ("playerMaps", "gmGuideMaps", "overlays"):
            variants = scene[collection_name]
            for variant in variants:
                if not isinstance(variant.get("version"), int) or variant["version"] < 0:
                    raise ManifestError(f"versao de cena invalida: {scene['id']}")
                referenced_ids.add(variant["assetId"])
        for active_name, collection_name in (
            ("activePlayerMap", "playerMaps"),
            ("activeGmGuideMap", "gmGuideMaps"),
        ):
            active_id = scene.get(active_name)
            if active_id is None:
                continue
            available = {variant["assetId"] for variant in scene[collection_name]}
            if active_id not in available:
                raise ManifestError(f"{active_name} nao integra as variantes de {scene['id']}")
            referenced_ids.add(active_id)
    for group in manifest["collections"]["stateGroups"]:
        for state in group["states"].values():
            if not isinstance(state.get("version"), int) or state["version"] < 0:
                raise ManifestError(f"versao de estado invalida: {group['id']}")
            referenced_ids.add(state["assetId"])
            for variant in state.get("variants", []):
                if not isinstance(variant.get("version"), int) or variant["version"] < 0:
                    raise ManifestError(f"versao de variante invalida: {group['id']}")
                referenced_ids.add(variant["assetId"])
    referenced_ids.update(manifest["collections"]["tokenAssetIds"])

    unknown_ids = referenced_ids.difference(asset_ids)
    if unknown_ids:
        raise ManifestError(f"colecoes referenciam assets ausentes: {sorted(unknown_ids)}")


def render_manifest(manifest: dict[str, Any]) -> str:
    validate_manifest(manifest)
    return json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def _assert_output_outside_source(output: Path, source_root: Path) -> None:
    output_resolved = output.expanduser().resolve(strict=False)
    source_resolved = source_root.expanduser().resolve()
    try:
        common = os.path.commonpath(
            [os.path.normcase(str(output_resolved)), os.path.normcase(str(source_resolved))]
        )
    except ValueError:
        return
    if common == os.path.normcase(str(source_resolved)):
        raise ManifestError("A saida nao pode ficar dentro da campanha de origem.")


def write_manifest(manifest: dict[str, Any], output: Path, source_root: Path) -> None:
    """Grava o JSON atomicamente, sempre fora da campanha de origem."""

    _assert_output_outside_source(output, source_root)
    output = output.expanduser().resolve(strict=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    _assert_output_outside_source(output, source_root)
    output_parent = output.parent.resolve(strict=True)
    if _is_link_or_junction(output_parent):
        raise ManifestError("O diretorio de saida nao pode ser link simbolico ou junction.")
    parent_identity = output_parent.stat()
    rendered = render_manifest(manifest)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=output.parent,
        prefix=f".{output.name}.",
        suffix=".tmp",
        text=True,
    )
    temporary = Path(temporary_name)
    temporary_identity = os.fstat(descriptor)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            descriptor = -1
            stream.write(rendered)
            stream.flush()
            os.fsync(stream.fileno())
        current_parent = output.parent.resolve(strict=True)
        if not os.path.samestat(parent_identity, current_parent.stat()):
            raise ManifestError("O diretorio de saida mudou durante a gravacao.")
        _assert_output_outside_source(output, source_root)
        temporary_current = temporary.lstat()
        if _is_link_or_junction(temporary) or not os.path.samestat(
            temporary_identity, temporary_current
        ):
            raise ManifestError("O arquivo temporario mudou durante a gravacao.")
        os.replace(temporary, output)
    finally:
        if descriptor >= 0:
            os.close(descriptor)
        try:
            temporary_current = temporary.lstat()
        except FileNotFoundError:
            pass
        else:
            if os.path.samestat(temporary_identity, temporary_current):
                temporary.unlink()


def _default_output() -> Path:
    return Path(__file__).resolve().parent / "generated" / "mnemosyne.manifest.json"


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera metadados leves da campanha Mnemosyne sem copiar ou alterar seus assets."
    )
    parser.add_argument("--source", required=True, type=Path, help="Raiz do repositorio Mnemosyne.")
    parser.add_argument("--output", type=Path, default=_default_output(), help="Arquivo JSON de destino.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Nao grava; falha se o manifesto existente estiver ausente ou desatualizado.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Retorna erro quando o inventario produzir avisos.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        source_root = args.source.expanduser().resolve()
        manifest = build_manifest(source_root)
        rendered = render_manifest(manifest)

        if args.check:
            _assert_output_outside_source(args.output, source_root)
            if _is_link_or_junction(args.output.expanduser()):
                raise ManifestError("Manifesto de --check nao pode ser link simbolico ou junction.")
            if not args.output.is_file():
                raise ManifestError(f"Manifesto nao encontrado para --check: {args.output}")
            existing = args.output.read_text(encoding="utf-8")
            if existing != rendered:
                raise ManifestError("Manifesto desatualizado. Execute novamente sem --check.")
            action = "validado"
        else:
            write_manifest(manifest, args.output, source_root)
            action = "gerado"

        summary = manifest["summary"]
        print(
            f"Manifesto {action}: {args.output.resolve()}\n"
            f"Assets: {summary['assetCount']} | Documentos: {summary['documentCount']} | "
            f"Cenas: {summary['sceneCount']} | Avisos: {summary['warningCount']}"
        )
        if args.strict and summary["warningCount"]:
            print("Modo estrito: o manifesto contem avisos.", file=sys.stderr)
            return 2
        return 0
    except (ManifestError, OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"Erro ao gerar manifesto: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
