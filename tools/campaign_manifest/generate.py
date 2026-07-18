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
GENERATOR_VERSION = "1.3.0"
CAMPAIGN_ID = "mnemosyne"
CAMPAIGN_TITLE = "Projeto Mnemosyne"
CAMPAIGN_SOURCE_REF = "mnemosyne"
CLASSIFICATION_CONFIG_SCHEMA_VERSION = 2
DEFAULT_CLASSIFICATION_CONFIG = (
    Path(__file__).resolve().parent / "config" / "mnemosyne.asset-overrides.json"
)
VALID_ASSET_KINDS = frozenset(
    {"map", "overlay", "token", "prop", "handout", "symbol", "concept", "other"}
)
VALID_AUDIENCES = frozenset({"gm", "players", "unspecified"})
VALID_CONTROLLERS = frozenset({"gm", "players"})
VALID_FAMILY_EXTENSIONS = frozenset({"png", "svg", "webp"})
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
WEBP_RIFF_SIGNATURE = b"RIFF"
WEBP_FORMAT_SIGNATURE = b"WEBP"
HASH_CHUNK_SIZE = 1024 * 1024
MAX_WEBP_CHUNK_SIZE = 256 * 1024 * 1024
KNOWN_OVERLAY_NAMES = (
    "eletrificacao",
    "fragmento-removido",
    "inundacao",
    "telas-quebradas",
)
_SCENE_LAYER_KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
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


def _webp_metadata(path: Path) -> dict[str, Any]:
    """Extrai dimensoes WebP sem decodificar pixels nem confiar em offsets externos."""

    file_size = path.stat().st_size
    with path.open("rb") as stream:
        def read_exact(length: int, label: str) -> bytes:
            data = stream.read(length)
            if len(data) != length:
                raise ManifestError(f"{label} truncado")
            return data

        header = read_exact(12, "cabecalho WebP")
        if header[:4] != WEBP_RIFF_SIGNATURE or header[8:] != WEBP_FORMAT_SIGNATURE:
            raise ManifestError("assinatura WebP invalida")

        riff_size = struct.unpack("<I", header[4:8])[0]
        declared_end = 8 + riff_size
        if riff_size < 4 or declared_end != file_size:
            raise ManifestError("tamanho RIFF WebP inconsistente")

        vp8x: dict[str, Any] | None = None
        vp8: dict[str, Any] | None = None
        vp8l: dict[str, Any] | None = None
        has_alpha_chunk = False

        while stream.tell() < declared_end:
            remaining = declared_end - stream.tell()
            if remaining < 8:
                raise ManifestError("cabecalho de chunk WebP truncado")
            chunk_header = read_exact(8, "cabecalho de chunk WebP")
            chunk_type = chunk_header[:4]
            chunk_size = struct.unpack("<I", chunk_header[4:])[0]
            if chunk_size > MAX_WEBP_CHUNK_SIZE:
                raise ManifestError("chunk WebP excede o limite de seguranca")

            chunk_start = stream.tell()
            chunk_end = chunk_start + chunk_size
            padded_end = chunk_end + (chunk_size & 1)
            if chunk_end < chunk_start or padded_end > declared_end:
                raise ManifestError("chunk WebP excede os limites do RIFF")

            if chunk_type == b"VP8X":
                if chunk_size != 10:
                    raise ManifestError("chunk VP8X invalido")
                data = read_exact(10, "chunk VP8X WebP")
                width = 1 + int.from_bytes(data[4:7], "little")
                height = 1 + int.from_bytes(data[7:10], "little")
                vp8x = {
                    "format": "webp",
                    "width": width,
                    "height": height,
                    "hasAlpha": bool(data[0] & 0x10),
                    "webpVariant": "VP8X",
                }
            elif chunk_type == b"VP8 ":
                if chunk_size < 10:
                    raise ManifestError("chunk VP8 WebP truncado")
                data = read_exact(10, "chunk VP8 WebP")
                if data[0] & 0x01 or data[3:6] != b"\x9d\x01\x2a":
                    raise ManifestError("cabecalho VP8 WebP invalido")
                width = int.from_bytes(data[6:8], "little") & 0x3FFF
                height = int.from_bytes(data[8:10], "little") & 0x3FFF
                if not width or not height:
                    raise ManifestError("dimensoes VP8 WebP invalidas")
                vp8 = {
                    "format": "webp",
                    "width": width,
                    "height": height,
                    "hasAlpha": False,
                    "webpVariant": "VP8",
                }
            elif chunk_type == b"VP8L":
                if chunk_size < 5:
                    raise ManifestError("chunk VP8L WebP truncado")
                data = read_exact(5, "chunk VP8L WebP")
                if data[0] != 0x2F:
                    raise ManifestError("assinatura VP8L WebP invalida")
                packed = int.from_bytes(data[1:5], "little")
                if packed >> 29:
                    raise ManifestError("versao VP8L WebP nao suportada")
                vp8l = {
                    "format": "webp",
                    "width": (packed & 0x3FFF) + 1,
                    "height": ((packed >> 14) & 0x3FFF) + 1,
                    "hasAlpha": bool((packed >> 28) & 0x01),
                    "webpVariant": "VP8L",
                }
            elif chunk_type == b"ALPH":
                has_alpha_chunk = True

            stream.seek(padded_end)

    metadata = vp8x or vp8l or vp8
    if metadata is None:
        raise ManifestError("WebP sem chunk de imagem reconhecido")
    metadata["hasAlpha"] = bool(metadata["hasAlpha"] or has_alpha_chunk)
    return metadata


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
    parts = tuple(part.casefold() for part in PurePosixPath(relative_path).parts)
    lowered = relative_path.casefold()

    if "handouts" in parts:
        return "handout", "gm", "gm"
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


def _classification_config_ref(path: Path) -> str:
    """Referencia versionavel sem vazar a raiz absoluta local do aplicativo."""

    if path.name == DEFAULT_CLASSIFICATION_CONFIG.name:
        return f"config/{path.name}"
    return path.name


def _empty_classification_rules() -> dict[str, Any]:
    return {"exact": {}, "families": {}, "sceneLayers": []}


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _normalized_scene_layer_placement(
    value: object, context: str
) -> dict[str, float] | None:
    if not isinstance(value, dict) or set(value) != {
        "x",
        "y",
        "width",
        "height",
        "rotation",
    }:
        return None
    if not all(_is_number(value[field]) for field in value):
        return None
    x = float(value["x"])
    y = float(value["y"])
    width = float(value["width"])
    height = float(value["height"])
    rotation = float(value["rotation"])
    if not (
        0.0 <= x <= 1.0
        and 0.0 <= y <= 1.0
        and 0.0 < width <= 1.0
        and 0.0 < height <= 1.0
        and -360.0 <= rotation <= 360.0
    ):
        return None
    return {
        "x": x,
        "y": y,
        "width": width,
        "height": height,
        "rotation": rotation,
    }


def _normalized_scene_layers(value: object) -> list[dict[str, Any]] | None:
    """Valida a curadoria de camadas antes de qualquer asset ser consumido."""

    if not isinstance(value, list):
        return None
    result: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for layer_index, value_layer in enumerate(value):
        if not isinstance(value_layer, dict) or set(value_layer) != {
            "key",
            "sceneKey",
            "label",
            "defaultState",
            "states",
        }:
            return None
        key = value_layer.get("key")
        scene_key = value_layer.get("sceneKey")
        label = value_layer.get("label")
        default_state = value_layer.get("defaultState")
        raw_states = value_layer.get("states")
        if (
            not isinstance(key, str)
            or not _SCENE_LAYER_KEY_PATTERN.fullmatch(key)
            or key in seen_keys
            or not isinstance(scene_key, str)
            or not _SCENE_LAYER_KEY_PATTERN.fullmatch(scene_key)
            or not isinstance(label, str)
            or not label
            or any(character in label for character in "\x00\r\n")
            or not isinstance(raw_states, dict)
            or not raw_states
        ):
            return None
        seen_keys.add(key)
        states: dict[str, dict[str, Any]] = {}
        for state_key, value_state in raw_states.items():
            if (
                not isinstance(state_key, str)
                or not _SCENE_LAYER_KEY_PATTERN.fullmatch(state_key)
                or not isinstance(value_state, dict)
                or set(value_state) != {"label", "assetPath", "placements"}
            ):
                return None
            state_label = value_state.get("label")
            asset_path = value_state.get("assetPath")
            raw_placements = value_state.get("placements")
            if (
                not isinstance(state_label, str)
                or not state_label
                or any(character in state_label for character in "\x00\r\n")
                or not _is_safe_asset_rule_path(asset_path)
                or not isinstance(raw_placements, list)
                or not raw_placements
            ):
                return None
            placements: list[dict[str, float]] = []
            for placement_index, raw_placement in enumerate(raw_placements):
                placement = _normalized_scene_layer_placement(
                    raw_placement,
                    (
                        f"sceneLayers[{layer_index}].states[{state_key}]"
                        f".placements[{placement_index}]"
                    ),
                )
                if placement is None:
                    return None
                placements.append(placement)
            states[state_key] = {
                "label": state_label,
                "assetPath": PurePosixPath(asset_path).as_posix(),
                "placements": placements,
            }
        if default_state is not None and (
            not isinstance(default_state, str) or default_state not in states
        ):
            return None
        result.append(
            {
                "key": key,
                "sceneKey": scene_key,
                "label": label,
                "defaultState": default_state,
                "states": states,
            }
        )
    return sorted(result, key=lambda item: item["key"])


def _is_safe_asset_rule_path(relative_path: object) -> bool:
    if not isinstance(relative_path, str) or not relative_path or "\\" in relative_path:
        return False
    parsed_path = PurePosixPath(relative_path)
    return bool(
        not parsed_path.is_absolute()
        and ".." not in parsed_path.parts
        and parsed_path.parts
        and parsed_path.parts[0].casefold() == "assets"
        and parsed_path.as_posix() == relative_path
    )


def _semantic_override(override: object) -> dict[str, str] | None:
    if not isinstance(override, dict) or not override:
        return None
    validators = {
        "kind": VALID_ASSET_KINDS,
        "audience": VALID_AUDIENCES,
        "controlledBy": VALID_CONTROLLERS,
    }
    if set(override).difference(validators):
        return None
    if not all(
        isinstance(value, str) and value in validators[field]
        for field, value in override.items()
    ):
        return None
    return dict(override)


def _family_override_matches(
    relative_path: str,
    family_path: str,
    extensions: tuple[str, ...],
) -> bool:
    """Casa apenas `<familia>-vN.ext`, sem regex configuravel nem prefixos frouxos."""

    path = PurePosixPath(relative_path)
    extension = path.suffix.removeprefix(".").casefold()
    if extension not in extensions:
        return False
    stem_path = path.with_suffix("").as_posix()
    prefix = f"{family_path}-v"
    if not stem_path.startswith(prefix):
        return False
    version = stem_path[len(prefix) :]
    return bool(
        version
        and version.isascii()
        and version.isdigit()
        and version[0] != "0"
    )


def _classification_override_for(
    relative_path: str,
    rules: dict[str, Any] | None,
) -> dict[str, str]:
    if not rules:
        return {}
    exact = rules.get("exact", {})
    if relative_path in exact:
        return exact[relative_path]
    families = rules.get("families", {})
    for family_path in sorted(families, key=lambda item: (-len(item), item)):
        rule = families[family_path]
        if _family_override_matches(relative_path, family_path, rule["extensions"]):
            return rule["override"]
    return {}


def _load_classification_config(
    path: Path,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, str]]]:
    """Le overrides exatos/familiares; curadoria invalida nunca vira heuristica."""

    warnings: list[dict[str, str]] = []
    config_ref = _classification_config_ref(path)
    descriptor: dict[str, Any] = {
        "configRef": config_ref,
        "schemaVersion": None,
        "fingerprint": None,
    }
    try:
        raw = path.read_bytes()
    except FileNotFoundError:
        warnings.append(
            {
                "code": "classification-config-missing",
                "path": config_ref,
                "message": "Configuracao semantica versionada nao encontrada; apenas regras por pasta foram usadas.",
            }
        )
        return _empty_classification_rules(), descriptor, warnings
    except OSError as error:
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": _safe_diagnostic(error),
            }
        )
        return _empty_classification_rules(), descriptor, warnings

    descriptor["fingerprint"] = f"sha256:{hashlib.sha256(raw).hexdigest()}"
    try:
        config = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeError, json.JSONDecodeError) as error:
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": f"JSON de configuracao invalido: {error}",
            }
        )
        return _empty_classification_rules(), descriptor, warnings

    if not isinstance(config, dict):
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": "A raiz da configuracao deve ser um objeto JSON.",
            }
        )
        return _empty_classification_rules(), descriptor, warnings

    descriptor["schemaVersion"] = config.get("schemaVersion")
    if config.get("schemaVersion") != CLASSIFICATION_CONFIG_SCHEMA_VERSION:
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": (
                    "schemaVersion da configuracao semantica e incompatível; "
                    f"esperado {CLASSIFICATION_CONFIG_SCHEMA_VERSION}."
                ),
            }
        )
        return _empty_classification_rules(), descriptor, warnings
    if config.get("campaignId") != CAMPAIGN_ID:
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": f"campaignId deve ser {CAMPAIGN_ID!r}.",
            }
        )
        return _empty_classification_rules(), descriptor, warnings

    scene_layers = _normalized_scene_layers(config.get("sceneLayers", []))
    if scene_layers is None:
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": "sceneLayers deve seguir o schema semantico de camadas de cena.",
            }
        )
        return _empty_classification_rules(), descriptor, warnings

    raw_overrides = config.get("assetOverrides")
    if not isinstance(raw_overrides, dict):
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": "assetOverrides deve ser um objeto indexado por caminho relativo exato.",
            }
        )
        return _empty_classification_rules(), descriptor, warnings

    overrides: dict[str, dict[str, str]] = {}
    for relative_path, override in sorted(raw_overrides.items(), key=lambda item: str(item[0])):
        diagnostic_path = relative_path if isinstance(relative_path, str) else repr(relative_path)
        semantic_override = _semantic_override(override)
        if not _is_safe_asset_rule_path(relative_path) or semantic_override is None:
            warnings.append(
                {
                    "code": "classification-override-invalid",
                    "path": diagnostic_path,
                    "message": "Override ignorado: caminho ou campos semanticos invalidos.",
                }
            )
            continue
        normalized_path = PurePosixPath(relative_path).as_posix()
        overrides[normalized_path] = semantic_override

    raw_families = config.get("assetFamilyOverrides")
    if not isinstance(raw_families, dict):
        warnings.append(
            {
                "code": "classification-config-invalid",
                "path": config_ref,
                "message": "assetFamilyOverrides deve ser um objeto indexado por familia versionada.",
            }
        )
        return {
            "exact": overrides,
            "families": {},
            "sceneLayers": scene_layers,
        }, descriptor, warnings

    families: dict[str, dict[str, Any]] = {}
    for family_path, raw_rule in sorted(raw_families.items(), key=lambda item: str(item[0])):
        diagnostic_path = family_path if isinstance(family_path, str) else repr(family_path)
        semantic_fields = (
            {key: value for key, value in raw_rule.items() if key != "extensions"}
            if isinstance(raw_rule, dict)
            else None
        )
        semantic_override = _semantic_override(semantic_fields)
        raw_extensions = raw_rule.get("extensions") if isinstance(raw_rule, dict) else None
        extensions_are_valid = bool(
            isinstance(raw_extensions, list)
            and raw_extensions
            and all(
                isinstance(extension, str)
                and extension == extension.casefold()
                and extension in VALID_FAMILY_EXTENSIONS
                for extension in raw_extensions
            )
            and len(raw_extensions) == len(set(raw_extensions))
        )
        family_path_is_valid = bool(
            _is_safe_asset_rule_path(family_path)
            and not PurePosixPath(family_path).suffix
            and not re.search(r"-v\d+$", family_path, flags=re.IGNORECASE)
        )
        if not family_path_is_valid or not extensions_are_valid or semantic_override is None:
            warnings.append(
                {
                    "code": "classification-override-invalid",
                    "path": diagnostic_path,
                    "message": "Familia ignorada: caminho, extensoes ou campos semanticos invalidos.",
                }
            )
            continue
        normalized_family = PurePosixPath(family_path).as_posix()
        families[normalized_family] = {
            "extensions": tuple(raw_extensions),
            "override": semantic_override,
        }

    return {
        "exact": overrides,
        "families": families,
        "sceneLayers": scene_layers,
    }, descriptor, warnings


def _image_metadata(path: Path) -> dict[str, Any] | None:
    suffix = path.suffix.casefold()
    if suffix == ".png":
        return _png_metadata(path)
    if suffix == ".svg":
        return _svg_metadata(path)
    if suffix == ".webp":
        return _webp_metadata(path)
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


def _asset_metadata(
    path: Path,
    source_root: Path,
    classification_rules: dict[str, Any] | None = None,
) -> dict[str, Any]:
    relative_path = _relative_posix(path, source_root)
    path = _assert_source_file(path, source_root, relative_path)
    before = path.stat()
    kind, audience, controlled_by = _classify_asset(relative_path)
    override = _classification_override_for(relative_path, classification_rules)
    kind = override.get("kind", kind)
    audience = override.get("audience", audience)
    controlled_by = override.get("controlledBy", controlled_by)
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
        selected_overlays: list[dict[str, Any]] = []
        overlay_names = sorted({item["name"] for item in scene["overlays"]})
        for overlay_name in overlay_names:
            variants = [
                item for item in scene["overlays"] if item["name"] == overlay_name
            ]
            highest_version = max(item["version"] for item in variants)
            candidates = [
                item for item in variants if item["version"] == highest_version
            ]
            if len(candidates) != 1:
                warnings.append(
                    {
                        "code": "scene-overlay-ambiguous",
                        "path": f"{scene_key}/{overlay_name}",
                        "message": (
                            f"Ha {len(candidates)} overlays na versao ativa v{highest_version}; "
                            "nenhuma variante foi selecionada."
                        ),
                    }
                )
                continue
            selected_overlays.append(candidates[0])
        scene["overlays"] = selected_overlays
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


def _build_scene_layers(
    assets: list[dict[str, Any]],
    scenes: list[dict[str, Any]],
    configured_layers: list[dict[str, Any]],
) -> set[str]:
    """Anexa camadas curadas e devolve os assets retirados das colecoes globais."""

    assets_by_path = {asset["relativePath"]: asset for asset in assets}
    scenes_by_key = {scene["key"]: scene for scene in scenes}
    consumed_ids: set[str] = set()
    for scene in scenes:
        scene["layers"] = []

    for configured in configured_layers:
        scene = scenes_by_key.get(configured["sceneKey"])
        if scene is None:
            raise ManifestError(
                f"sceneLayers referencia cena ausente: {configured['sceneKey']}"
            )
        states: dict[str, dict[str, Any]] = {}
        for state_key, configured_state in configured["states"].items():
            asset_path = configured_state["assetPath"]
            asset = assets_by_path.get(asset_path)
            if asset is None:
                raise ManifestError(f"sceneLayers referencia asset ausente: {asset_path}")
            if asset.get("kind") not in {"prop", "overlay"}:
                raise ManifestError(
                    f"sceneLayers exige asset prop ou overlay: {asset_path}"
                )
            if asset.get("audience") != "players":
                raise ManifestError(
                    f"sceneLayers exige asset visivel para players: {asset_path}"
                )
            if not isinstance(asset.get("image"), dict):
                raise ManifestError(f"sceneLayers exige asset de imagem: {asset_path}")
            asset_id = asset["id"]
            if asset_id in consumed_ids:
                raise ManifestError(
                    f"sceneLayers reutiliza asset em mais de um estado: {asset_path}"
                )
            consumed_ids.add(asset_id)
            states[state_key] = {
                "label": configured_state["label"],
                "assetId": asset_id,
                "placements": configured_state["placements"],
            }
        scene["layers"].append(
            {
                "id": f"scene-layer:{configured['key']}",
                "key": configured["key"],
                "label": configured["label"],
                "defaultState": configured["defaultState"],
                "states": states,
            }
        )

    for scene in scenes:
        scene["overlays"] = [
            overlay
            for overlay in scene["overlays"]
            if overlay["assetId"] not in consumed_ids
        ]
        scene["layers"].sort(key=lambda item: item["key"])
    return consumed_ids


def _exclude_consumed_state_groups(
    state_groups: list[dict[str, Any]], consumed_ids: set[str]
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for group in state_groups:
        group_asset_ids = {
            variant["assetId"]
            for state in group["states"].values()
            for variant in state.get("variants", [])
        }
        consumed_group_ids = group_asset_ids.intersection(consumed_ids)
        if not consumed_group_ids:
            result.append(group)
            continue
        if consumed_group_ids != group_asset_ids:
            raise ManifestError(
                f"sceneLayers consome apenas parte do grupo de estados: {group['id']}"
            )
    return result


def _source_fingerprint(assets: list[dict[str, Any]], documents: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for item in sorted([*assets, *documents], key=lambda entry: entry["relativePath"]):
        digest.update(item["relativePath"].encode("utf-8"))
        digest.update(b"\0")
        digest.update(item["sha256"].encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def build_manifest(
    source: Path,
    classification_config: Path | None = None,
) -> dict[str, Any]:
    """Constroi o manifesto em memoria sem escrever na campanha ou no destino."""

    source_root = source.expanduser().resolve()
    if not source_root.is_dir():
        raise ManifestError(f"Pasta de campanha inexistente: {source_root}")

    assets_root = source_root / "assets"
    if not assets_root.is_dir():
        raise ManifestError(f"Pasta assets nao encontrada em: {assets_root}")
    _assert_source_directory(assets_root, source_root, "Pasta assets")

    config_path = classification_config or DEFAULT_CLASSIFICATION_CONFIG
    classification_rules, classification_descriptor, warnings = (
        _load_classification_config(config_path)
    )
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
            asset = _asset_metadata(path, source_root, classification_rules)
            assets.append(asset)
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
    asset_paths = {asset["relativePath"] for asset in assets}
    for override_path in sorted(classification_rules["exact"]):
        if override_path not in asset_paths:
            warnings.append(
                {
                    "code": "classification-override-missing",
                    "path": override_path,
                    "message": "Override exato nao corresponde a nenhum asset atual da campanha.",
                }
            )
    for family_path, rule in sorted(classification_rules["families"].items()):
        if not any(
            _family_override_matches(asset_path, family_path, rule["extensions"])
            for asset_path in asset_paths
        ):
            warnings.append(
                {
                    "code": "classification-override-missing",
                    "path": family_path,
                    "message": "Familia versionada nao corresponde a nenhum asset atual da campanha.",
                }
            )
    documents.sort(key=lambda item: item["relativePath"])
    scenes = _build_scenes(assets, warnings)
    state_groups = _build_state_groups(assets, warnings)
    consumed_scene_layer_ids = _build_scene_layers(
        assets,
        scenes,
        classification_rules.get("sceneLayers", []),
    )
    state_groups = _exclude_consumed_state_groups(
        state_groups, consumed_scene_layer_ids
    )
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
        "classification": classification_descriptor,
        "summary": {
            "assetCount": len(assets),
            "documentCount": len(documents),
            "sceneCount": len(scenes),
            "sceneLayerCount": sum(len(scene["layers"]) for scene in scenes),
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
            "tokenAssetIds": [
                asset["id"]
                for asset in assets
                if asset["kind"] == "token"
                and asset["id"] not in consumed_scene_layer_ids
            ],
            "propAssetIds": [
                asset["id"]
                for asset in assets
                if asset["kind"] == "prop"
                and asset["id"] not in consumed_scene_layer_ids
            ],
            "handoutAssetIds": [asset["id"] for asset in assets if asset["kind"] == "handout"],
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

    classification = manifest.get("classification")
    if not isinstance(classification, dict):
        raise ManifestError("classification ausente")
    config_ref = classification.get("configRef")
    if (
        not isinstance(config_ref, str)
        or not config_ref
        or PurePosixPath(config_ref).is_absolute()
        or ".." in PurePosixPath(config_ref).parts
        or "\\" in config_ref
    ):
        raise ManifestError("classification.configRef inseguro")
    config_fingerprint = classification.get("fingerprint")
    if config_fingerprint is not None and not re.fullmatch(
        r"sha256:[0-9a-f]{64}", config_fingerprint
    ):
        raise ManifestError("classification.fingerprint invalido")

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

    assets_by_id = {asset["id"]: asset for asset in assets}
    referenced_ids: set[str] = set()
    consumed_layer_ids: set[str] = set()
    scene_ids: set[str] = set()
    scene_keys: set[str] = set()
    layer_ids: set[str] = set()
    for scene in manifest["collections"]["scenes"]:
        scene_id = scene.get("id")
        scene_key = scene.get("key")
        if (
            not isinstance(scene_key, str)
            or scene_id != f"scene:{scene_key}"
            or scene_id in scene_ids
            or scene_key in scene_keys
        ):
            raise ManifestError("ID ou key de cena invalido/duplicado")
        scene_ids.add(scene_id)
        scene_keys.add(scene_key)
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
        for layer in scene.get("layers", []):
            if not isinstance(layer, dict):
                raise ManifestError(f"layer invalida em {scene_id}")
            layer_key = layer.get("key")
            layer_id = layer.get("id")
            if (
                not isinstance(layer_key, str)
                or not _SCENE_LAYER_KEY_PATTERN.fullmatch(layer_key)
                or layer_id != f"scene-layer:{layer_key}"
                or layer_id in layer_ids
                or not isinstance(layer.get("label"), str)
                or not layer["label"]
            ):
                raise ManifestError(f"ID ou metadados de layer invalidos em {scene_id}")
            layer_ids.add(layer_id)
            states = layer.get("states")
            if not isinstance(states, dict) or not states:
                raise ManifestError(f"states de layer vazio/invalido: {layer_id}")
            default_state = layer.get("defaultState")
            if default_state is not None and default_state not in states:
                raise ManifestError(f"defaultState invalido: {layer_id}")
            for state_key, state in states.items():
                if (
                    not isinstance(state_key, str)
                    or not _SCENE_LAYER_KEY_PATTERN.fullmatch(state_key)
                    or not isinstance(state, dict)
                    or not isinstance(state.get("label"), str)
                    or not state["label"]
                ):
                    raise ManifestError(f"estado de layer invalido: {layer_id}")
                asset_id = state.get("assetId")
                asset = assets_by_id.get(asset_id)
                if (
                    asset is None
                    or asset.get("kind") not in {"prop", "overlay"}
                    or asset.get("audience") != "players"
                    or not isinstance(asset.get("image"), dict)
                    or asset_id in consumed_layer_ids
                ):
                    raise ManifestError(f"asset de layer invalido/duplicado: {layer_id}")
                placements = state.get("placements")
                if not isinstance(placements, list) or not placements:
                    raise ManifestError(f"placements de layer vazio/invalido: {layer_id}")
                for placement in placements:
                    if _normalized_scene_layer_placement(placement, layer_id) is None:
                        raise ManifestError(f"placement de layer invalido: {layer_id}")
                consumed_layer_ids.add(asset_id)
                referenced_ids.add(asset_id)
    for group in manifest["collections"]["stateGroups"]:
        for state in group["states"].values():
            if not isinstance(state.get("version"), int) or state["version"] < 0:
                raise ManifestError(f"versao de estado invalida: {group['id']}")
            referenced_ids.add(state["assetId"])
            for variant in state.get("variants", []):
                if not isinstance(variant.get("version"), int) or variant["version"] < 0:
                    raise ManifestError(f"versao de variante invalida: {group['id']}")
                referenced_ids.add(variant["assetId"])
    for collection_name, expected_kind in (
        ("tokenAssetIds", "token"),
        ("propAssetIds", "prop"),
        ("handoutAssetIds", "handout"),
    ):
        collection_ids = manifest["collections"].get(collection_name)
        if not isinstance(collection_ids, list) or not all(
            isinstance(asset_id, str) for asset_id in collection_ids
        ):
            raise ManifestError(f"collections.{collection_name} deve ser lista de IDs")
        if len(collection_ids) != len(set(collection_ids)):
            raise ManifestError(f"collections.{collection_name} contem IDs duplicados")
        referenced_ids.update(collection_ids)
        if consumed_layer_ids.intersection(collection_ids):
            raise ManifestError(
                f"collections.{collection_name} reutiliza asset consumido por layer"
            )
        for asset_id in collection_ids:
            asset = assets_by_id.get(asset_id)
            if asset is not None and asset.get("kind") != expected_kind:
                raise ManifestError(
                    f"{collection_name} referencia kind diferente de {expected_kind}: {asset_id}"
                )

    for scene in manifest["collections"]["scenes"]:
        if consumed_layer_ids.intersection(
            overlay["assetId"] for overlay in scene["overlays"]
        ):
            raise ManifestError("overlay simples reutiliza asset consumido por layer")
    for group in manifest["collections"]["stateGroups"]:
        group_ids = {
            variant["assetId"]
            for state in group["states"].values()
            for variant in state.get("variants", [])
        }
        if consumed_layer_ids.intersection(group_ids):
            raise ManifestError("stateGroup reutiliza asset consumido por layer")

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
        "--classification-config",
        type=Path,
        default=DEFAULT_CLASSIFICATION_CONFIG,
        help="Overrides semanticos exatos, versionados junto ao aplicativo.",
    )
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
        manifest = build_manifest(source_root, args.classification_config)
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
