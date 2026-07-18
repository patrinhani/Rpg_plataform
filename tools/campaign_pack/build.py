"""Build a small, self-contained runtime pack from a schema-2 campaign manifest.

Only assets referenced by scenes, ``tokenAssetIds`` or ``propAssetIds`` are
copied. Handouts are validated but deliberately left out until an explicit
reveal flow exists. The source campaign is treated as immutable and every
copied byte is checked against the size and SHA-256 recorded in the manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import stat
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Mapping, Sequence


SCHEMA_VERSION = 2
PACK_GENERATOR_NAME = "caos-campaign-pack"
PACK_GENERATOR_VERSION = "1.0.0"
MAX_MANIFEST_BYTES = 32 * 1024 * 1024
DEFAULT_MAX_PACK_BYTES = 128 * 1024 * 1024
HASH_CHUNK_SIZE = 1024 * 1024
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_SOURCE_REF_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_ASSET_KINDS = frozenset(
    {"map", "overlay", "token", "prop", "handout", "symbol", "concept", "other"}
)
_AUDIENCES = frozenset({"gm", "players", "unspecified"})
_CONTROLLERS = frozenset({"gm", "players"})
_WINDOWS_RESERVED_NAMES = frozenset(
    {
        "con",
        "prn",
        "aux",
        "nul",
        *(f"com{index}" for index in range(1, 10)),
        *(f"lpt{index}" for index in range(1, 10)),
    }
)


class CampaignPackError(RuntimeError):
    """Base error suitable for display by the command-line interface."""


class PackManifestError(CampaignPackError):
    """The input manifest is invalid or unsafe."""


class UnsafePathError(CampaignPackError):
    """A source or output path is not confined to the expected directory."""


class AssetIntegrityError(CampaignPackError):
    """An asset no longer matches its manifest metadata."""


class SourceChangedError(CampaignPackError):
    """The source changed while the pack was being generated."""


class OutputSafetyError(CampaignPackError):
    """The requested destination cannot be replaced safely."""


@dataclass(frozen=True, slots=True)
class FileSignature:
    size: int
    mtime_ns: int
    ctime_ns: int
    device: int
    inode: int


@dataclass(frozen=True, slots=True)
class AssetRecord:
    asset_id: str
    relative_path: PurePosixPath
    expected_bytes: int
    expected_sha256: str
    payload: dict[str, Any]


@dataclass(frozen=True, slots=True)
class SourceContext:
    root: Path
    identity: os.stat_result


@dataclass(frozen=True, slots=True)
class PreparedPack:
    manifest: dict[str, Any]
    assets: tuple[AssetRecord, ...]
    source: SourceContext


@dataclass(frozen=True, slots=True)
class PackResult:
    asset_count: int
    total_bytes: int
    source_ref: str
    output: Path | None


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _expect_object(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PackManifestError(f"{context} deve ser um objeto")
    return value


def _expect_list(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise PackManifestError(f"{context} deve ser uma lista")
    return value


def _expect_string(value: Any, context: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value):
        raise PackManifestError(f"{context} deve ser texto nao vazio")
    if "\x00" in value or "\r" in value or "\n" in value:
        raise PackManifestError(f"{context} contem caractere de controle")
    return value


def _expect_nonnegative_int(value: Any, context: str) -> int:
    if not _is_int(value) or value < 0:
        raise PackManifestError(f"{context} deve ser inteiro nao negativo")
    return value


def _expect_positive_int(value: Any, context: str) -> int:
    if not _is_int(value) or value <= 0:
        raise PackManifestError(f"{context} deve ser inteiro positivo")
    return value


def _stat_is_link_or_junction(result: os.stat_result) -> bool:
    if stat.S_ISLNK(result.st_mode):
        return True
    attributes = getattr(result, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)
    return bool(attributes & reparse_flag)


def _path_is_link_or_junction(path: Path) -> bool:
    try:
        return _stat_is_link_or_junction(path.lstat())
    except OSError:
        return False


def _signature(result: os.stat_result) -> FileSignature:
    return FileSignature(
        size=result.st_size,
        mtime_ns=result.st_mtime_ns,
        ctime_ns=result.st_ctime_ns,
        device=getattr(result, "st_dev", 0),
        inode=getattr(result, "st_ino", 0),
    )


def _read_manifest(path: str | os.PathLike[str]) -> tuple[dict[str, Any], Path]:
    candidate = Path(path).expanduser()
    if _path_is_link_or_junction(candidate):
        raise PackManifestError("O manifesto nao pode ser link simbolico ou junction")
    try:
        resolved = candidate.resolve(strict=True)
        before = resolved.lstat()
    except OSError as error:
        raise PackManifestError("O manifesto nao aponta para um arquivo legivel") from error
    if _stat_is_link_or_junction(before) or not stat.S_ISREG(before.st_mode):
        raise PackManifestError("O manifesto precisa ser um arquivo regular")
    if before.st_size > MAX_MANIFEST_BYTES:
        raise PackManifestError("O manifesto excede o limite de tamanho")
    try:
        payload = resolved.read_bytes()
        after = resolved.lstat()
    except OSError as error:
        raise PackManifestError("Nao foi possivel ler o manifesto") from error
    if _signature(before) != _signature(after) or len(payload) != before.st_size:
        raise PackManifestError("O manifesto mudou durante a leitura")
    try:
        decoded = json.loads(payload.decode("utf-8-sig"))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise PackManifestError("O manifesto nao contem JSON UTF-8 valido") from error
    return _expect_object(decoded, "manifesto"), resolved


def _normalize_relative_path(value: Any, context: str) -> PurePosixPath:
    text = _expect_string(value, context)
    if "\\" in text or ":" in text or any(ord(character) < 32 for character in text):
        raise PackManifestError(f"{context} nao e um caminho relativo portavel")
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise PackManifestError(f"{context} nao e um caminho relativo seguro")
    if path.as_posix() != text or path.parts[0] != "assets":
        raise PackManifestError(f"{context} precisa estar normalizado abaixo de assets/")
    for part in path.parts:
        portable_stem = part.split(".", 1)[0].casefold()
        if part.rstrip(" .") != part or portable_stem in _WINDOWS_RESERVED_NAMES:
            raise PackManifestError(f"{context} usa nome reservado ou ambiguo no Windows")
    return path


def _sanitize_image(value: Any, context: str) -> dict[str, Any] | None:
    if value is None:
        return None
    image = _expect_object(value, context)
    result: dict[str, Any] = {}
    if "format" in image and image["format"] is not None:
        result["format"] = _expect_string(image["format"], f"{context}.format")
    if "width" in image and image["width"] is not None:
        result["width"] = _expect_positive_int(image["width"], f"{context}.width")
    if "height" in image and image["height"] is not None:
        result["height"] = _expect_positive_int(image["height"], f"{context}.height")
    if "hasAlpha" in image and image["hasAlpha"] is not None:
        if not isinstance(image["hasAlpha"], bool):
            raise PackManifestError(f"{context}.hasAlpha deve ser booleano")
        result["hasAlpha"] = image["hasAlpha"]
    if "pngColorType" in image and image["pngColorType"] is not None:
        result["pngColorType"] = _expect_nonnegative_int(
            image["pngColorType"], f"{context}.pngColorType"
        )
    for key in ("viewBox", "title", "description"):
        if key in image and image[key] is not None:
            result[key] = _expect_string(image[key], f"{context}.{key}", allow_empty=True)
    return result


def _parse_assets(manifest: Mapping[str, Any]) -> dict[str, AssetRecord]:
    records: dict[str, AssetRecord] = {}
    portable_paths: set[str] = set()
    for index, raw_value in enumerate(_expect_list(manifest.get("assets"), "assets")):
        context = f"assets[{index}]"
        raw = _expect_object(raw_value, context)
        relative_path = _normalize_relative_path(raw.get("relativePath"), f"{context}.relativePath")
        asset_id = _expect_string(raw.get("id"), f"{context}.id")
        if asset_id != f"asset:{relative_path.as_posix()}":
            raise PackManifestError(f"{context}.id nao corresponde ao relativePath")
        if asset_id in records:
            raise PackManifestError(f"ID de asset duplicado: {asset_id}")
        portable_key = relative_path.as_posix().casefold()
        if portable_key in portable_paths:
            raise PackManifestError(f"Caminho de asset colide por caixa: {relative_path}")
        portable_paths.add(portable_key)

        kind = _expect_string(raw.get("kind"), f"{context}.kind")
        if kind not in _ASSET_KINDS:
            raise PackManifestError(f"{context}.kind desconhecido")
        audience = _expect_string(raw.get("audience"), f"{context}.audience")
        if audience not in _AUDIENCES:
            raise PackManifestError(f"{context}.audience desconhecida")
        controlled_by = _expect_string(raw.get("controlledBy"), f"{context}.controlledBy")
        if controlled_by not in _CONTROLLERS:
            raise PackManifestError(f"{context}.controlledBy desconhecido")
        expected_bytes = _expect_nonnegative_int(raw.get("bytes"), f"{context}.bytes")
        expected_sha256 = _expect_string(raw.get("sha256"), f"{context}.sha256")
        if not _SHA256_PATTERN.fullmatch(expected_sha256):
            raise PackManifestError(f"{context}.sha256 invalido")
        media_type = _expect_string(raw.get("mediaType"), f"{context}.mediaType")
        payload = {
            "id": asset_id,
            "relativePath": relative_path.as_posix(),
            "kind": kind,
            "audience": audience,
            "controlledBy": controlled_by,
            "bytes": expected_bytes,
            "sha256": expected_sha256,
            "mediaType": media_type,
            "image": _sanitize_image(raw.get("image"), f"{context}.image"),
        }
        records[asset_id] = AssetRecord(
            asset_id=asset_id,
            relative_path=relative_path,
            expected_bytes=expected_bytes,
            expected_sha256=expected_sha256,
            payload=payload,
        )
    return records


def _parse_variant_list(
    value: Any,
    context: str,
    records: Mapping[str, AssetRecord],
    expected_kind: str,
) -> list[dict[str, Any]]:
    variants: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw_value in enumerate(_expect_list(value, context)):
        item_context = f"{context}[{index}]"
        raw = _expect_object(raw_value, item_context)
        asset_id = _expect_string(raw.get("assetId"), f"{item_context}.assetId")
        record = records.get(asset_id)
        if record is None or record.payload["kind"] != expected_kind:
            raise PackManifestError(
                f"{item_context}.assetId nao referencia asset do tipo {expected_kind}"
            )
        if asset_id in seen:
            raise PackManifestError(f"{context} contem asset duplicado")
        seen.add(asset_id)
        variants.append(
            {
                "assetId": asset_id,
                "version": _expect_nonnegative_int(raw.get("version"), f"{item_context}.version"),
            }
        )
    variants.sort(key=lambda item: (item["version"], item["assetId"]))
    return variants


def _validate_active(value: Any, variants: Sequence[Mapping[str, Any]], context: str) -> str | None:
    active = None if value is None else _expect_string(value, context)
    if not variants:
        if active is not None:
            raise PackManifestError(f"{context} precisa ser nulo sem variantes")
        return None
    highest_version = max(item["version"] for item in variants)
    candidates = [
        item["assetId"] for item in variants if item["version"] == highest_version
    ]
    expected = candidates[0] if len(candidates) == 1 else None
    if active != expected:
        raise PackManifestError(f"{context} nao corresponde a maior versao unica")
    return active


def _sanitize_grid_hint(value: Any, context: str) -> dict[str, Any] | None:
    if value is None:
        return None
    raw = _expect_object(value, context)
    result: dict[str, Any] = {
        "type": _expect_string(raw.get("type"), f"{context}.type"),
        "columns": _expect_positive_int(raw.get("columns"), f"{context}.columns"),
        "rows": _expect_positive_int(raw.get("rows"), f"{context}.rows"),
    }
    if raw.get("source") is not None:
        result["source"] = _expect_string(raw["source"], f"{context}.source")
    return result


def _parse_scenes(
    collections: Mapping[str, Any], records: Mapping[str, AssetRecord]
) -> tuple[list[dict[str, Any]], set[str]]:
    scenes: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    scene_ids: set[str] = set()
    for index, raw_value in enumerate(
        _expect_list(collections.get("scenes"), "collections.scenes")
    ):
        context = f"collections.scenes[{index}]"
        raw = _expect_object(raw_value, context)
        key = _expect_string(raw.get("key"), f"{context}.key")
        scene_id = _expect_string(raw.get("id"), f"{context}.id")
        if scene_id != f"scene:{key}" or scene_id in scene_ids:
            raise PackManifestError(f"{context}.id invalido ou duplicado")
        scene_ids.add(scene_id)
        player_maps = _parse_variant_list(
            raw.get("playerMaps"), f"{context}.playerMaps", records, "map"
        )
        gm_maps = _parse_variant_list(
            raw.get("gmGuideMaps"), f"{context}.gmGuideMaps", records, "map"
        )

        overlays: list[dict[str, Any]] = []
        overlay_ids: set[str] = set()
        for overlay_index, overlay_value in enumerate(
            _expect_list(raw.get("overlays"), f"{context}.overlays")
        ):
            overlay_context = f"{context}.overlays[{overlay_index}]"
            overlay = _expect_object(overlay_value, overlay_context)
            asset_id = _expect_string(
                overlay.get("assetId"), f"{overlay_context}.assetId"
            )
            record = records.get(asset_id)
            if record is None or record.payload["kind"] != "overlay":
                raise PackManifestError(
                    f"{overlay_context}.assetId nao referencia asset do tipo overlay"
                )
            if asset_id in overlay_ids:
                raise PackManifestError(f"{context}.overlays contem asset duplicado")
            overlay_ids.add(asset_id)
            overlays.append(
                {
                    "assetId": asset_id,
                    "name": _expect_string(overlay.get("name"), f"{overlay_context}.name"),
                    "version": _expect_nonnegative_int(
                        overlay.get("version"), f"{overlay_context}.version"
                    ),
                }
            )
        overlays.sort(key=lambda item: (item["name"], item["version"], item["assetId"]))
        active_player = _validate_active(
            raw.get("activePlayerMap"), player_maps, f"{context}.activePlayerMap"
        )
        active_gm = _validate_active(
            raw.get("activeGmGuideMap"), gm_maps, f"{context}.activeGmGuideMap"
        )
        # Runtime has no variant selector. Shipping inactive revisions only adds
        # weight and can expose material that the session cannot display.
        player_maps = [
            item for item in player_maps if item["assetId"] == active_player
        ]
        gm_maps = [item for item in gm_maps if item["assetId"] == active_gm]
        scene = {
            "id": scene_id,
            "key": key,
            "playerMaps": player_maps,
            "gmGuideMaps": gm_maps,
            "overlays": overlays,
            "activePlayerMap": active_player,
            "activeGmGuideMap": active_gm,
            "gridHint": _sanitize_grid_hint(raw.get("gridHint"), f"{context}.gridHint"),
        }
        scenes.append(scene)
        selected_ids.update(item["assetId"] for item in player_maps)
        selected_ids.update(item["assetId"] for item in gm_maps)
        selected_ids.update(item["assetId"] for item in overlays)
    scenes.sort(key=lambda item: item["key"])
    return scenes, selected_ids


def _sanitize_runtime_warnings(
    value: Any,
    selected_records: Sequence[AssetRecord],
    scenes: Sequence[Mapping[str, Any]],
) -> list[dict[str, str]]:
    selected_paths = {
        record.relative_path.as_posix() for record in selected_records
    }
    scene_keys = {str(scene["key"]) for scene in scenes}
    result: list[dict[str, str]] = []
    for index, raw_value in enumerate(_expect_list(value, "warnings")):
        context = f"warnings[{index}]"
        raw = _expect_object(raw_value, context)
        warning = {
            "code": _expect_string(raw.get("code"), f"{context}.code"),
            "path": _expect_string(raw.get("path"), f"{context}.path"),
            "message": _expect_string(raw.get("message"), f"{context}.message"),
        }
        if warning["path"] in selected_paths or warning["path"] in scene_keys:
            result.append(warning)
    return result


def _parse_asset_ids(
    collections: Mapping[str, Any],
    records: Mapping[str, AssetRecord],
    *,
    collection_name: str,
    expected_kind: str,
    optional: bool = False,
) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    raw_values = collections.get(collection_name)
    if raw_values is None and optional:
        raw_values = []
    context = f"collections.{collection_name}"
    for index, raw_value in enumerate(
        _expect_list(raw_values, context)
    ):
        asset_id = _expect_string(raw_value, f"{context}[{index}]")
        record = records.get(asset_id)
        if record is None or record.payload["kind"] != expected_kind:
            raise PackManifestError(
                f"{context} referencia asset que nao e {expected_kind}"
            )
        if asset_id in seen:
            raise PackManifestError(f"{context} contem duplicata")
        seen.add(asset_id)
        result.append(asset_id)
    return result


def _parse_state_groups(
    collections: Mapping[str, Any],
    records: Mapping[str, AssetRecord],
    included_prop_ids: set[str],
) -> list[dict[str, Any]]:
    """Keep only validated prop state metadata whose bytes ship in the pack."""

    result: list[dict[str, Any]] = []
    seen_group_ids: set[str] = set()
    for group_index, raw_group in enumerate(
        _expect_list(collections.get("stateGroups"), "collections.stateGroups")
    ):
        context = f"collections.stateGroups[{group_index}]"
        group = _expect_object(raw_group, context)
        key = _expect_string(group.get("key"), f"{context}.key")
        group_id = _expect_string(group.get("id"), f"{context}.id")
        if group_id != f"state-group:{key}" or group_id in seen_group_ids:
            raise PackManifestError(f"{context}.id invalido ou duplicado")
        seen_group_ids.add(group_id)

        raw_states = _expect_object(group.get("states"), f"{context}.states")
        states: dict[str, dict[str, Any]] = {}
        include_group = True
        for state_name, raw_state in raw_states.items():
            state_context = f"{context}.states[{state_name}]"
            if not isinstance(state_name, str) or not state_name:
                raise PackManifestError(f"{context}.states contem nome invalido")
            state = _expect_object(raw_state, state_context)
            asset_id = _expect_string(state.get("assetId"), f"{state_context}.assetId")
            version = _expect_nonnegative_int(state.get("version"), f"{state_context}.version")
            variants = _parse_variant_list(
                state.get("variants"), f"{state_context}.variants", records, "prop"
            )
            if not variants:
                raise PackManifestError(f"{state_context}.variants nao pode ser vazio")
            if (asset_id, version) not in {
                (variant["assetId"], variant["version"]) for variant in variants
            }:
                raise PackManifestError(f"{state_context} seleciona variante ausente")
            if version != max(variant["version"] for variant in variants):
                raise PackManifestError(f"{state_context} nao seleciona a maior versao")
            referenced_ids = {variant["assetId"] for variant in variants}
            if asset_id not in included_prop_ids or not referenced_ids <= included_prop_ids:
                # Manifests from before propAssetIds remain valid: their state
                # metadata is omitted together with the prop bytes.
                include_group = False
            states[state_name] = {
                "assetId": asset_id,
                "version": version,
                "variants": variants,
            }
        if include_group:
            result.append({"id": group_id, "key": key, "states": states})
    return result


def _source_fingerprint(records: Sequence[AssetRecord]) -> str:
    digest = hashlib.sha256()
    for record in sorted(records, key=lambda item: item.relative_path.as_posix()):
        digest.update(record.relative_path.as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(record.expected_sha256.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def _assert_no_absolute_paths(value: Any, context: str = "manifesto") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            _assert_no_absolute_paths(nested, f"{context}.{key}")
        return
    if isinstance(value, list):
        for index, nested in enumerate(value):
            _assert_no_absolute_paths(nested, f"{context}[{index}]")
        return
    if isinstance(value, str) and (
        PurePosixPath(value).is_absolute() or PureWindowsPath(value).is_absolute()
    ):
        raise PackManifestError(f"{context} contem caminho absoluto")


def _build_runtime_manifest(raw: dict[str, Any]) -> tuple[dict[str, Any], tuple[AssetRecord, ...]]:
    if raw.get("schemaVersion") != SCHEMA_VERSION:
        raise PackManifestError(f"schemaVersion precisa ser {SCHEMA_VERSION}")
    campaign = _expect_object(raw.get("campaign"), "campaign")
    if "sourceRoot" in campaign:
        raise PackManifestError("campaign.sourceRoot absoluto nao e aceito")
    campaign_id = _expect_string(campaign.get("id"), "campaign.id")
    campaign_title = _expect_string(campaign.get("title"), "campaign.title")
    source_ref = _expect_string(campaign.get("sourceRef"), "campaign.sourceRef")
    if not _SOURCE_REF_PATTERN.fullmatch(source_ref):
        raise PackManifestError("campaign.sourceRef nao e uma referencia logica valida")

    records = _parse_assets(raw)
    collections = _expect_object(raw.get("collections"), "collections")
    scenes, selected_ids = _parse_scenes(collections, records)
    token_ids = _parse_asset_ids(
        collections,
        records,
        collection_name="tokenAssetIds",
        expected_kind="token",
    )
    prop_ids = _parse_asset_ids(
        collections,
        records,
        collection_name="propAssetIds",
        expected_kind="prop",
        optional=True,
    )
    state_groups = _parse_state_groups(collections, records, set(prop_ids))
    # Validar IDs e tipos agora evita que um manifesto defeituoso passe pelo
    # builder, mas os bytes/IDs nao entram no runtime antes de haver revelacao.
    _parse_asset_ids(
        collections,
        records,
        collection_name="handoutAssetIds",
        expected_kind="handout",
        optional=True,
    )
    selected_ids.update(token_ids)
    selected_ids.update(prop_ids)
    selected_records = tuple(
        sorted(
            (records[asset_id] for asset_id in selected_ids),
            key=lambda item: item.relative_path.as_posix(),
        )
    )

    sanitized_campaign: dict[str, Any] = {
        "id": campaign_id,
        "title": campaign_title,
        "sourceRef": source_ref,
    }
    if campaign.get("sourceMode") is not None:
        sanitized_campaign["sourceMode"] = _expect_string(
            campaign["sourceMode"], "campaign.sourceMode"
        )

    total_bytes = sum(record.expected_bytes for record in selected_records)
    warnings = _sanitize_runtime_warnings(raw.get("warnings"), selected_records, scenes)
    runtime = {
        "schemaVersion": SCHEMA_VERSION,
        "generator": {
            "name": PACK_GENERATOR_NAME,
            "version": PACK_GENERATOR_VERSION,
        },
        "campaign": sanitized_campaign,
        "summary": {
            "assetCount": len(selected_records),
            "documentCount": 0,
            "sceneCount": len(scenes),
            "stateGroupCount": len(state_groups),
            "totalAssetBytes": total_bytes,
            "warningCount": len(warnings),
            "sourceFingerprint": _source_fingerprint(selected_records),
        },
        "assets": [record.payload for record in selected_records],
        # Documents and unrevealed handouts stay outside the runtime pack. Prop
        # state groups are safe metadata and are required to switch scenery
        # variants such as the connected body without treating it as a token.
        "documents": [],
        "collections": {
            "scenes": scenes,
            "stateGroups": state_groups,
            "tokenAssetIds": token_ids,
            "propAssetIds": prop_ids,
            "handoutAssetIds": [],
        },
        "warnings": warnings,
    }
    _assert_no_absolute_paths(runtime)
    return runtime, selected_records


def _resolve_source_root(path: str | os.PathLike[str]) -> SourceContext:
    candidate = Path(path).expanduser()
    if _path_is_link_or_junction(candidate):
        raise UnsafePathError("A raiz da campanha nao pode ser link simbolico ou junction")
    try:
        resolved = candidate.resolve(strict=True)
        identity = resolved.lstat()
    except OSError as error:
        raise UnsafePathError("A raiz da campanha nao existe") from error
    if _stat_is_link_or_junction(identity) or not stat.S_ISDIR(identity.st_mode):
        raise UnsafePathError("A raiz da campanha precisa ser um diretorio regular")
    return SourceContext(root=resolved, identity=identity)


def _assert_source_root_stable(source: SourceContext) -> None:
    try:
        current = source.root.lstat()
    except OSError as error:
        raise SourceChangedError("A raiz da campanha deixou de existir") from error
    if (
        _stat_is_link_or_junction(current)
        or not stat.S_ISDIR(current.st_mode)
        or not os.path.samestat(source.identity, current)
    ):
        raise SourceChangedError("A raiz da campanha mudou durante a geracao")


def _resolve_confined_asset(source: SourceContext, relative_path: PurePosixPath) -> Path:
    _assert_source_root_stable(source)
    current = source.root
    for index, part in enumerate(relative_path.parts):
        current = current / part
        try:
            info = current.lstat()
        except OSError as error:
            raise UnsafePathError(f"Asset ausente: {relative_path.as_posix()}") from error
        if _stat_is_link_or_junction(info):
            raise UnsafePathError(
                f"Asset atravessa link simbolico ou junction: {relative_path.as_posix()}"
            )
        if index < len(relative_path.parts) - 1 and not stat.S_ISDIR(info.st_mode):
            raise UnsafePathError(
                f"Componente intermediario nao e diretorio: {relative_path.as_posix()}"
            )
        if index == len(relative_path.parts) - 1 and not stat.S_ISREG(info.st_mode):
            raise UnsafePathError(f"Asset nao e arquivo regular: {relative_path.as_posix()}")
    try:
        resolved = current.resolve(strict=True)
        resolved.relative_to(source.root)
    except (OSError, ValueError) as error:
        raise UnsafePathError(
            f"Asset resolve fora da campanha: {relative_path.as_posix()}"
        ) from error
    _assert_source_root_stable(source)
    return resolved


def _open_confined_asset(
    source: SourceContext, record: AssetRecord
) -> tuple[int, Path, FileSignature]:
    path = _resolve_confined_asset(source, record.relative_path)
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        raise UnsafePathError(f"Nao foi possivel abrir {record.relative_path}") from error
    try:
        opened = os.fstat(descriptor)
        current = path.lstat()
        if (
            not stat.S_ISREG(opened.st_mode)
            or _stat_is_link_or_junction(current)
            or not os.path.samestat(opened, current)
            or _resolve_confined_asset(source, record.relative_path) != path
        ):
            raise UnsafePathError(f"Asset mudou durante a abertura: {record.relative_path}")
        return descriptor, path, _signature(opened)
    except Exception:
        os.close(descriptor)
        raise


def _hash_descriptor(descriptor: int) -> str:
    digest = hashlib.sha256()
    os.lseek(descriptor, 0, os.SEEK_SET)
    while True:
        chunk = os.read(descriptor, HASH_CHUNK_SIZE)
        if not chunk:
            break
        digest.update(chunk)
    return digest.hexdigest()


def _assert_open_asset_stable(
    descriptor: int,
    path: Path,
    expected_signature: FileSignature,
    record: AssetRecord,
) -> None:
    try:
        opened = os.fstat(descriptor)
        current = path.lstat()
    except OSError as error:
        raise SourceChangedError(f"Asset sumiu durante a leitura: {record.relative_path}") from error
    if (
        _signature(opened) != expected_signature
        or _stat_is_link_or_junction(current)
        or not os.path.samestat(opened, current)
    ):
        raise SourceChangedError(f"Asset mudou durante a leitura: {record.relative_path}")


def _verify_source_asset(
    source: SourceContext,
    record: AssetRecord,
    expected_signature: FileSignature | None = None,
) -> FileSignature:
    descriptor, path, signature = _open_confined_asset(source, record)
    try:
        if expected_signature is not None and signature != expected_signature:
            raise SourceChangedError(f"Asset mudou entre verificacoes: {record.relative_path}")
        if signature.size != record.expected_bytes:
            raise AssetIntegrityError(f"Tamanho diverge do manifesto: {record.relative_path}")
        digest = _hash_descriptor(descriptor)
        _assert_open_asset_stable(descriptor, path, signature, record)
        if not hmac.compare_digest(digest, record.expected_sha256):
            raise AssetIntegrityError(f"SHA-256 diverge do manifesto: {record.relative_path}")
        if _resolve_confined_asset(source, record.relative_path) != path:
            raise SourceChangedError(f"Asset mudou depois do hash: {record.relative_path}")
        return signature
    finally:
        os.close(descriptor)


def _write_all(descriptor: int, payload: bytes) -> None:
    view = memoryview(payload)
    while view:
        written = os.write(descriptor, view)
        if written <= 0:
            raise OSError("escrita interrompida")
        view = view[written:]


def _verify_destination(path: Path, record: AssetRecord) -> None:
    try:
        info = path.lstat()
    except OSError as error:
        raise AssetIntegrityError(f"Copia ausente: {record.relative_path}") from error
    if _stat_is_link_or_junction(info) or not stat.S_ISREG(info.st_mode):
        raise AssetIntegrityError(f"Copia nao e arquivo regular: {record.relative_path}")
    if info.st_size != record.expected_bytes:
        raise AssetIntegrityError(f"Tamanho da copia diverge: {record.relative_path}")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while True:
            chunk = stream.read(HASH_CHUNK_SIZE)
            if not chunk:
                break
            digest.update(chunk)
    if not hmac.compare_digest(digest.hexdigest(), record.expected_sha256):
        raise AssetIntegrityError(f"SHA-256 da copia diverge: {record.relative_path}")


def _copy_verified_asset(
    source: SourceContext,
    record: AssetRecord,
    destination_root: Path,
    preflight_signature: FileSignature,
) -> None:
    descriptor, path, signature = _open_confined_asset(source, record)
    if signature != preflight_signature:
        os.close(descriptor)
        raise SourceChangedError(f"Asset mudou depois da pre-verificacao: {record.relative_path}")
    if signature.size != record.expected_bytes:
        os.close(descriptor)
        raise AssetIntegrityError(f"Tamanho diverge do manifesto: {record.relative_path}")

    destination = destination_root.joinpath(*record.relative_path.parts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    write_flags = (
        os.O_WRONLY
        | os.O_CREAT
        | os.O_EXCL
        | getattr(os, "O_BINARY", 0)
        | getattr(os, "O_CLOEXEC", 0)
    )
    destination_descriptor = -1
    try:
        destination_descriptor = os.open(destination, write_flags, 0o600)
        digest = hashlib.sha256()
        os.lseek(descriptor, 0, os.SEEK_SET)
        while True:
            chunk = os.read(descriptor, HASH_CHUNK_SIZE)
            if not chunk:
                break
            digest.update(chunk)
            _write_all(destination_descriptor, chunk)
        os.fsync(destination_descriptor)
        _assert_open_asset_stable(descriptor, path, signature, record)
        if not hmac.compare_digest(digest.hexdigest(), record.expected_sha256):
            raise AssetIntegrityError(f"SHA-256 mudou durante a copia: {record.relative_path}")
        if _resolve_confined_asset(source, record.relative_path) != path:
            raise SourceChangedError(f"Asset mudou depois da copia: {record.relative_path}")
    finally:
        os.close(descriptor)
        if destination_descriptor >= 0:
            os.close(destination_descriptor)
    _verify_destination(destination, record)


def render_manifest(manifest: Mapping[str, Any]) -> bytes:
    """Return deterministic UTF-8 JSON using LF line endings."""

    text = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True)
    return (text + "\n").encode("utf-8")


def _write_runtime_manifest(root: Path, manifest: Mapping[str, Any]) -> None:
    destination = root / "manifest.json"
    descriptor = os.open(
        destination,
        os.O_WRONLY
        | os.O_CREAT
        | os.O_EXCL
        | getattr(os, "O_BINARY", 0)
        | getattr(os, "O_CLOEXEC", 0),
        0o600,
    )
    try:
        _write_all(descriptor, render_manifest(manifest))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _assert_existing_chain_no_reparse(path: Path) -> Path:
    absolute = path.absolute()
    anchor = Path(absolute.anchor)
    current = anchor
    parts = absolute.parts[1:] if absolute.anchor else absolute.parts
    for part in parts:
        current = current / part
        try:
            info = current.lstat()
        except OSError as error:
            raise OutputSafetyError("A pasta pai do destino precisa existir") from error
        if _stat_is_link_or_junction(info):
            raise OutputSafetyError("O destino nao pode atravessar link simbolico ou junction")
    try:
        resolved = absolute.resolve(strict=True)
    except OSError as error:
        raise OutputSafetyError("A pasta pai do destino precisa existir") from error
    if not resolved.is_dir():
        raise OutputSafetyError("A pasta pai do destino precisa ser um diretorio")
    return resolved


def _assert_tree_regular(root: Path) -> None:
    try:
        root_info = root.lstat()
    except OSError as error:
        raise OutputSafetyError("Nao foi possivel inspecionar o destino existente") from error
    if _stat_is_link_or_junction(root_info) or not stat.S_ISDIR(root_info.st_mode):
        raise OutputSafetyError("O destino existente precisa ser um diretorio sem links")
    with os.scandir(root) as entries:
        for entry in entries:
            try:
                info = entry.stat(follow_symlinks=False)
            except OSError as error:
                raise OutputSafetyError("Nao foi possivel inspecionar o destino existente") from error
            if _stat_is_link_or_junction(info):
                raise OutputSafetyError("O destino existente contem link simbolico ou junction")
            child = Path(entry.path)
            if stat.S_ISDIR(info.st_mode):
                _assert_tree_regular(child)
            elif not stat.S_ISREG(info.st_mode):
                raise OutputSafetyError("O destino existente contem entrada especial")


def _existing_output_is_managed(output: Path) -> bool:
    try:
        entries = list(output.iterdir())
    except OSError as error:
        raise OutputSafetyError("Nao foi possivel ler o destino existente") from error
    if not entries:
        return True
    manifest_path = output / "manifest.json"
    if not manifest_path.is_file() or _path_is_link_or_junction(manifest_path):
        return False
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return False
    generator = payload.get("generator") if isinstance(payload, dict) else None
    return isinstance(generator, dict) and generator.get("name") == PACK_GENERATOR_NAME


def _paths_overlap(first: Path, second: Path) -> bool:
    try:
        first.relative_to(second)
        return True
    except ValueError:
        pass
    try:
        second.relative_to(first)
        return True
    except ValueError:
        return False


def _prepare_output(
    path: str | os.PathLike[str], source_root: Path, manifest_path: Path
) -> Path:
    raw = Path(path).expanduser()
    if raw.name in {"", ".", ".."}:
        raise OutputSafetyError("O destino precisa nomear uma pasta especifica")
    output_name = raw.name
    if (
        output_name.rstrip(" .") != output_name
        or output_name.split(".", 1)[0].casefold() in _WINDOWS_RESERVED_NAMES
        or any(character in '<>:"/\\|?*' or ord(character) < 32 for character in output_name)
    ):
        raise OutputSafetyError("O nome do destino nao e portavel no Windows")
    parent = _assert_existing_chain_no_reparse(raw.parent)
    output = parent / output_name
    if _paths_overlap(output, source_root):
        raise OutputSafetyError("O destino nao pode sobrepor a campanha de origem")
    try:
        manifest_path.relative_to(output)
    except ValueError:
        pass
    else:
        raise OutputSafetyError("O manifesto de entrada nao pode ficar dentro do destino")
    if output.exists() or _path_is_link_or_junction(output):
        _assert_tree_regular(output)
        if not _existing_output_is_managed(output):
            raise OutputSafetyError(
                "O destino existente nao esta vazio nem foi criado por esta ferramenta"
            )
    return output


def _remove_tree_no_follow(root: Path) -> None:
    info = root.lstat()
    if _stat_is_link_or_junction(info) or not stat.S_ISDIR(info.st_mode):
        raise OutputSafetyError("Recusando remover arvore que nao e diretorio regular")
    with os.scandir(root) as entries:
        for entry in entries:
            child = Path(entry.path)
            child_info = entry.stat(follow_symlinks=False)
            if _stat_is_link_or_junction(child_info):
                raise OutputSafetyError("Recusando seguir link durante a limpeza")
            if stat.S_ISDIR(child_info.st_mode):
                _remove_tree_no_follow(child)
            elif stat.S_ISREG(child_info.st_mode):
                child.unlink()
            else:
                raise OutputSafetyError("Recusando remover entrada especial")
    root.rmdir()


def _unique_backup_path(output: Path) -> Path:
    for _ in range(32):
        candidate = output.with_name(f".{output.name}.{secrets.token_hex(8)}.old")
        if not candidate.exists() and not _path_is_link_or_junction(candidate):
            return candidate
    raise OutputSafetyError("Nao foi possivel reservar backup atomico do destino")


def _replace_with_retry(source: Path, destination: Path) -> None:
    """Tolerate short-lived Windows/antivirus handles without hiding real failures."""

    for attempt in range(8):
        try:
            os.replace(source, destination)
            return
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(0.05 * (2**attempt))


def _install_atomically(temporary: Path, output: Path) -> None:
    if not output.exists():
        _replace_with_retry(temporary, output)
        return
    _assert_tree_regular(output)
    if not _existing_output_is_managed(output):
        raise OutputSafetyError("O destino deixou de ser um pack gerenciado")
    backup = _unique_backup_path(output)
    _replace_with_retry(output, backup)
    try:
        _replace_with_retry(temporary, output)
    except Exception:
        try:
            _replace_with_retry(backup, output)
        except Exception as rollback_error:
            raise OutputSafetyError(
                "Falha ao instalar e ao restaurar o destino; backup preservado"
            ) from rollback_error
        raise
    _remove_tree_no_follow(backup)


def _prepare_pack(
    manifest_path: str | os.PathLike[str],
    source_root: str | os.PathLike[str],
    max_bytes: int,
) -> tuple[PreparedPack, Path]:
    if not _is_int(max_bytes) or max_bytes <= 0:
        raise PackManifestError("O limite do pack precisa ser um inteiro positivo")
    raw, resolved_manifest = _read_manifest(manifest_path)
    runtime, records = _build_runtime_manifest(raw)
    total_bytes = sum(record.expected_bytes for record in records)
    if total_bytes > max_bytes:
        raise PackManifestError(
            f"O pack selecionado possui {total_bytes} bytes e excede o limite de {max_bytes}"
        )
    source = _resolve_source_root(source_root)
    return PreparedPack(runtime, records, source), resolved_manifest


def _preflight(prepared: PreparedPack) -> dict[str, FileSignature]:
    signatures: dict[str, FileSignature] = {}
    for record in prepared.assets:
        signatures[record.asset_id] = _verify_source_asset(prepared.source, record)
    _assert_source_root_stable(prepared.source)
    return signatures


def check_pack(
    manifest_path: str | os.PathLike[str],
    source_root: str | os.PathLike[str],
    output: str | os.PathLike[str] | None = None,
    *,
    max_bytes: int = DEFAULT_MAX_PACK_BYTES,
) -> PackResult:
    """Validate selection, confinement and every source hash without writing."""

    prepared, resolved_manifest = _prepare_pack(manifest_path, source_root, max_bytes)
    resolved_output = None
    if output is not None:
        resolved_output = _prepare_output(
            output, prepared.source.root, resolved_manifest
        )
    signatures = _preflight(prepared)
    # A second full hash makes --check detect changes that occurred during the
    # complete validation pass, including same-size replacements.
    for record in prepared.assets:
        _verify_source_asset(prepared.source, record, signatures[record.asset_id])
    return PackResult(
        asset_count=len(prepared.assets),
        total_bytes=sum(item.expected_bytes for item in prepared.assets),
        source_ref=prepared.manifest["campaign"]["sourceRef"],
        output=resolved_output,
    )


def build_pack(
    manifest_path: str | os.PathLike[str],
    source_root: str | os.PathLike[str],
    output: str | os.PathLike[str],
    *,
    max_bytes: int = DEFAULT_MAX_PACK_BYTES,
) -> PackResult:
    """Create a verified runtime pack and replace a managed destination safely."""

    prepared, resolved_manifest = _prepare_pack(manifest_path, source_root, max_bytes)
    resolved_output = _prepare_output(output, prepared.source.root, resolved_manifest)
    signatures = _preflight(prepared)
    temporary = Path(
        tempfile.mkdtemp(
            prefix=f".{resolved_output.name}.",
            suffix=".tmp",
            dir=resolved_output.parent,
        )
    )
    installed = False
    try:
        if _path_is_link_or_junction(temporary):
            raise OutputSafetyError("A pasta temporaria nao pode ser link ou junction")
        for record in prepared.assets:
            _copy_verified_asset(
                prepared.source,
                record,
                temporary,
                signatures[record.asset_id],
            )
        _write_runtime_manifest(temporary, prepared.manifest)
        # Final source verification occurs only after every destination byte is
        # fsynced and before the atomic directory swap.
        for record in prepared.assets:
            _verify_source_asset(
                prepared.source, record, signatures[record.asset_id]
            )
        _assert_tree_regular(temporary)
        _install_atomically(temporary, resolved_output)
        installed = True
    finally:
        if not installed and temporary.exists() and not _path_is_link_or_junction(temporary):
            _remove_tree_no_follow(temporary)
    return PackResult(
        asset_count=len(prepared.assets),
        total_bytes=sum(item.expected_bytes for item in prepared.assets),
        source_ref=prepared.manifest["campaign"]["sourceRef"],
        output=resolved_output,
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m tools.campaign_pack",
        description="Gera um pack runtime leve e verificado para o C.A.O.S. VTT.",
    )
    parser.add_argument("--manifest", required=True, type=Path, help="Manifesto schema 2")
    parser.add_argument(
        "--source-root", required=True, type=Path, help="Raiz explicita da campanha"
    )
    parser.add_argument("--output", type=Path, help="Diretorio final do pack")
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=DEFAULT_MAX_PACK_BYTES,
        help=f"limite total dos assets selecionados (padrao: {DEFAULT_MAX_PACK_BYTES})",
    )
    parser.add_argument(
        "--check",
        "--dry-run",
        dest="check",
        action="store_true",
        help="Valida selecao, seguranca e hashes sem escrever",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    arguments = parser.parse_args(argv)
    if not arguments.check and arguments.output is None:
        parser.error("--output e obrigatorio fora do modo --check")
    try:
        if arguments.check:
            result = check_pack(
                arguments.manifest,
                arguments.source_root,
                arguments.output,
                max_bytes=arguments.max_bytes,
            )
            print(
                f"OK: {result.asset_count} assets, {result.total_bytes} bytes, "
                f"sourceRef={result.source_ref}"
            )
        else:
            result = build_pack(
                arguments.manifest,
                arguments.source_root,
                arguments.output,
                max_bytes=arguments.max_bytes,
            )
            print(
                f"Pack criado: {result.asset_count} assets, {result.total_bytes} bytes "
                f"em {result.output}"
            )
    except CampaignPackError as error:
        print(f"ERRO: {error}", file=sys.stderr)
        return 2
    return 0


__all__ = [
    "AssetIntegrityError",
    "DEFAULT_MAX_PACK_BYTES",
    "CampaignPackError",
    "OutputSafetyError",
    "PackManifestError",
    "PackResult",
    "SourceChangedError",
    "UnsafePathError",
    "build_pack",
    "check_pack",
    "main",
    "render_manifest",
]
