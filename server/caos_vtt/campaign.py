"""Catalogo runtime seguro para campanhas externas do C.A.O.S. VTT.

O modulo e independente de FastAPI. A integracao futura deve criar o catalogo
com ``CampaignCatalog.load`` e transformar as dataclasses publicas em respostas
HTTP somente depois da autorizacao feita aqui.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import stat
import threading
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, Mapping


MANIFEST_SCHEMA_VERSION = 2
MAX_MANIFEST_BYTES = 32 * 1024 * 1024
HASH_CHUNK_SIZE = 1024 * 1024
_SOURCE_REF_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_ROLES = frozenset({"master", "player"})
_AUDIENCES = frozenset({"gm", "players", "unspecified"})
_ASSET_KINDS = frozenset({"map", "overlay", "token", "prop", "symbol", "concept", "other"})
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


class CampaignCatalogError(RuntimeError):
    """Erro base apresentavel pela camada que integrar o catalogo."""


class ManifestValidationError(CampaignCatalogError):
    """O manifesto nao satisfaz o schema runtime esperado."""


class SourceConfigurationError(CampaignCatalogError):
    """Uma sourceRef nao possui uma raiz externa valida e explicita."""


class AssetNotAvailableError(CampaignCatalogError):
    """O asset nao existe ou nao pode ser conhecido pelo papel solicitado."""


class UnsafeAssetPathError(CampaignCatalogError):
    """O caminho do asset deixou a raiz ou atravessou link/junction."""


class AssetIntegrityError(CampaignCatalogError):
    """O arquivo externo nao corresponde aos metadados do manifesto."""


@dataclass(frozen=True, slots=True)
class ImageView:
    format: str | None
    width: int | None
    height: int | None
    has_alpha: bool | None
    view_box: str | None


@dataclass(frozen=True, slots=True)
class AssetView:
    """Metadados seguros para serializacao; nunca contem path ou hash."""

    asset_id: str
    kind: str
    audience: str
    media_type: str
    bytes: int
    image: ImageView | None


@dataclass(frozen=True, slots=True)
class SceneVariantView:
    asset_id: str
    version: int


@dataclass(frozen=True, slots=True)
class OverlayView:
    asset_id: str
    name: str
    version: int


@dataclass(frozen=True, slots=True)
class GridHintView:
    grid_type: str
    columns: int
    rows: int


@dataclass(frozen=True, slots=True)
class SceneView:
    scene_id: str
    key: str
    player_maps: tuple[SceneVariantView, ...]
    gm_guide_maps: tuple[SceneVariantView, ...]
    overlays: tuple[OverlayView, ...]
    active_player_map: str | None
    active_gm_guide_map: str | None
    grid_hint: GridHintView | None


@dataclass(frozen=True, slots=True)
class ResolvedAsset:
    """Resultado interno autorizado e validado para um endpoint de arquivo."""

    asset: AssetView
    path: Path
    sha256: str
    size: int
    mtime_ns: int


@dataclass(slots=True)
class OpenedAsset:
    """Stream ja autorizado e validado; evita reabrir o path apos a verificacao."""

    asset: AssetView
    stream: BinaryIO
    sha256: str
    size: int
    mtime_ns: int

    def close(self) -> None:
        self.stream.close()

    def __enter__(self) -> "OpenedAsset":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


@dataclass(frozen=True, slots=True)
class _AssetRecord:
    view: AssetView
    relative_path: PurePosixPath
    expected_bytes: int
    expected_sha256: str


@dataclass(frozen=True, slots=True)
class _FileSignature:
    size: int
    mtime_ns: int
    ctime_ns: int
    device: int
    inode: int


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _expect_object(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ManifestValidationError(f"{context} deve ser um objeto")
    return value


def _expect_list(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise ManifestValidationError(f"{context} deve ser uma lista")
    return value


def _expect_string(value: Any, context: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or (not allow_empty and not value):
        raise ManifestValidationError(f"{context} deve ser texto nao vazio")
    if "\x00" in value or "\r" in value or "\n" in value:
        raise ManifestValidationError(f"{context} contem caractere de controle")
    return value


def _expect_nonnegative_int(value: Any, context: str) -> int:
    if not _is_int(value) or value < 0:
        raise ManifestValidationError(f"{context} deve ser inteiro nao negativo")
    return value


def _expect_positive_int(value: Any, context: str) -> int:
    if not _is_int(value) or value <= 0:
        raise ManifestValidationError(f"{context} deve ser inteiro positivo")
    return value


def _normalize_relative_path(value: Any, context: str, *, assets_only: bool) -> PurePosixPath:
    text = _expect_string(value, context)
    if "\\" in text or ":" in text or any(ord(character) < 32 for character in text):
        raise ManifestValidationError(f"{context} nao e um caminho relativo portavel")
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise ManifestValidationError(f"{context} nao e um caminho relativo seguro")
    if path.as_posix() != text:
        raise ManifestValidationError(f"{context} nao esta normalizado")
    for part in path.parts:
        if part.rstrip(" .") != part or part.split(".", 1)[0].casefold() in _WINDOWS_RESERVED_NAMES:
            raise ManifestValidationError(f"{context} usa nome reservado ou ambiguo no Windows")
    if assets_only and path.parts[0] != "assets":
        raise ManifestValidationError(f"{context} precisa ficar abaixo de assets/")
    return path


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


def _file_signature(result: os.stat_result) -> _FileSignature:
    return _FileSignature(
        size=result.st_size,
        mtime_ns=result.st_mtime_ns,
        ctime_ns=result.st_ctime_ns,
        device=getattr(result, "st_dev", 0),
        inode=getattr(result, "st_ino", 0),
    )


def _sha256_fd(descriptor: int) -> str:
    digest = hashlib.sha256()
    os.lseek(descriptor, 0, os.SEEK_SET)
    while True:
        chunk = os.read(descriptor, HASH_CHUNK_SIZE)
        if not chunk:
            break
        digest.update(chunk)
    return digest.hexdigest()


def _read_manifest(path: str | os.PathLike[str]) -> dict[str, Any]:
    candidate = Path(path).expanduser()
    if _path_is_link_or_junction(candidate):
        raise ManifestValidationError("manifest_path nao pode ser link simbolico ou junction")
    try:
        resolved = candidate.resolve(strict=True)
        before = resolved.stat()
    except OSError as error:
        raise ManifestValidationError("manifest_path nao aponta para um arquivo legivel") from error
    if not stat.S_ISREG(before.st_mode):
        raise ManifestValidationError("manifest_path precisa ser um arquivo regular")
    if before.st_size > MAX_MANIFEST_BYTES:
        raise ManifestValidationError("manifesto excede o limite de tamanho")
    try:
        payload = resolved.read_bytes()
        after = resolved.stat()
    except OSError as error:
        raise ManifestValidationError("nao foi possivel ler o manifesto") from error
    if _file_signature(before) != _file_signature(after) or len(payload) != before.st_size:
        raise ManifestValidationError("manifesto mudou durante a leitura")
    try:
        decoded = json.loads(payload.decode("utf-8-sig"))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ManifestValidationError("manifesto nao contem JSON UTF-8 valido") from error
    return _expect_object(decoded, "manifesto")


def _resolve_source_root(source_ref: str, source_roots: Mapping[str, str | os.PathLike[str]]) -> Path:
    if source_ref not in source_roots:
        raise SourceConfigurationError(f"sourceRef sem raiz configurada: {source_ref}")
    candidate = Path(source_roots[source_ref]).expanduser()
    if _path_is_link_or_junction(candidate):
        raise SourceConfigurationError("A raiz configurada nao pode ser link simbolico ou junction")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError as error:
        raise SourceConfigurationError("A raiz configurada nao existe") from error
    if not resolved.is_dir():
        raise SourceConfigurationError("A raiz configurada precisa ser um diretorio")
    return resolved


def _parse_image(value: Any, context: str) -> ImageView | None:
    if value is None:
        return None
    image = _expect_object(value, context)
    format_value = image.get("format")
    if format_value is not None:
        format_value = _expect_string(format_value, f"{context}.format")
    width = image.get("width")
    if width is not None:
        width = _expect_positive_int(width, f"{context}.width")
    height = image.get("height")
    if height is not None:
        height = _expect_positive_int(height, f"{context}.height")
    has_alpha = image.get("hasAlpha")
    if has_alpha is not None and not isinstance(has_alpha, bool):
        raise ManifestValidationError(f"{context}.hasAlpha deve ser booleano")
    view_box = image.get("viewBox")
    if view_box is not None:
        view_box = _expect_string(view_box, f"{context}.viewBox")
    return ImageView(format_value, width, height, has_alpha, view_box)


def _parse_assets(manifest: dict[str, Any]) -> dict[str, _AssetRecord]:
    raw_assets = _expect_list(manifest.get("assets"), "assets")
    records: dict[str, _AssetRecord] = {}
    normalized_paths: set[str] = set()
    for index, raw_asset in enumerate(raw_assets):
        context = f"assets[{index}]"
        asset = _expect_object(raw_asset, context)
        relative_path = _normalize_relative_path(
            asset.get("relativePath"), f"{context}.relativePath", assets_only=True
        )
        asset_id = _expect_string(asset.get("id"), f"{context}.id")
        if asset_id != f"asset:{relative_path.as_posix()}":
            raise ManifestValidationError(f"{context}.id nao corresponde ao relativePath")
        if asset_id in records:
            raise ManifestValidationError(f"ID de asset duplicado: {asset_id}")
        portable_key = relative_path.as_posix().casefold()
        if portable_key in normalized_paths:
            raise ManifestValidationError(f"Caminho de asset colide por caixa: {relative_path}")
        normalized_paths.add(portable_key)

        kind = _expect_string(asset.get("kind"), f"{context}.kind")
        if kind not in _ASSET_KINDS:
            raise ManifestValidationError(f"{context}.kind desconhecido")
        audience = _expect_string(asset.get("audience"), f"{context}.audience")
        if audience not in _AUDIENCES:
            raise ManifestValidationError(f"{context}.audience desconhecida")
        controlled_by = _expect_string(asset.get("controlledBy"), f"{context}.controlledBy")
        if controlled_by not in {"gm", "players"}:
            raise ManifestValidationError(f"{context}.controlledBy desconhecido")
        expected_bytes = _expect_nonnegative_int(asset.get("bytes"), f"{context}.bytes")
        expected_hash = _expect_string(asset.get("sha256"), f"{context}.sha256")
        if not _SHA256_PATTERN.fullmatch(expected_hash):
            raise ManifestValidationError(f"{context}.sha256 invalido")
        media_type = _expect_string(asset.get("mediaType"), f"{context}.mediaType")
        image = _parse_image(asset.get("image"), f"{context}.image")
        view = AssetView(asset_id, kind, audience, media_type, expected_bytes, image)
        records[asset_id] = _AssetRecord(view, relative_path, expected_bytes, expected_hash)
    return records


def _validate_documents(manifest: dict[str, Any]) -> None:
    raw_documents = _expect_list(manifest.get("documents"), "documents")
    document_ids: set[str] = set()
    document_paths: set[str] = set()
    for index, raw_document in enumerate(raw_documents):
        context = f"documents[{index}]"
        document = _expect_object(raw_document, context)
        document_id = _expect_string(document.get("id"), f"{context}.id")
        if not document_id.startswith("document:") or document_id in document_ids:
            raise ManifestValidationError(f"{context}.id invalido ou duplicado")
        document_ids.add(document_id)
        path = _normalize_relative_path(
            document.get("relativePath"), f"{context}.relativePath", assets_only=False
        )
        portable_key = path.as_posix().casefold()
        if portable_key in document_paths:
            raise ManifestValidationError(f"Caminho de documento duplicado: {path}")
        document_paths.add(portable_key)
        audience = _expect_string(document.get("audienceHint"), f"{context}.audienceHint")
        if audience not in _AUDIENCES:
            raise ManifestValidationError(f"{context}.audienceHint desconhecida")
        _expect_nonnegative_int(document.get("bytes"), f"{context}.bytes")
        digest = _expect_string(document.get("sha256"), f"{context}.sha256")
        if not _SHA256_PATTERN.fullmatch(digest):
            raise ManifestValidationError(f"{context}.sha256 invalido")


def _parse_scene_variant(
    value: Any,
    context: str,
    assets: Mapping[str, _AssetRecord],
    expected_kind: str,
) -> SceneVariantView:
    variant = _expect_object(value, context)
    asset_id = _expect_string(variant.get("assetId"), f"{context}.assetId")
    version = _expect_nonnegative_int(variant.get("version"), f"{context}.version")
    record = assets.get(asset_id)
    if record is None or record.view.kind != expected_kind:
        raise ManifestValidationError(f"{context}.assetId nao referencia {expected_kind}")
    return SceneVariantView(asset_id, version)


def _validate_active_variant(
    active_value: Any,
    variants: tuple[SceneVariantView, ...],
    context: str,
) -> str | None:
    active = None if active_value is None else _expect_string(active_value, context)
    if not variants:
        if active is not None:
            raise ManifestValidationError(f"{context} precisa ser nulo sem variantes")
        return None
    highest_version = max(variant.version for variant in variants)
    candidates = [variant.asset_id for variant in variants if variant.version == highest_version]
    expected_active = candidates[0] if len(candidates) == 1 else None
    if active != expected_active:
        raise ManifestValidationError(f"{context} nao corresponde a maior versao unica")
    return active


def _parse_grid_hint(value: Any, context: str) -> GridHintView | None:
    if value is None:
        return None
    grid = _expect_object(value, context)
    grid_type = _expect_string(grid.get("type"), f"{context}.type")
    columns = _expect_positive_int(grid.get("columns"), f"{context}.columns")
    rows = _expect_positive_int(grid.get("rows"), f"{context}.rows")
    return GridHintView(grid_type, columns, rows)


def _parse_scenes(
    collections: dict[str, Any], assets: Mapping[str, _AssetRecord]
) -> tuple[SceneView, ...]:
    raw_scenes = _expect_list(collections.get("scenes"), "collections.scenes")
    scene_ids: set[str] = set()
    scenes: list[SceneView] = []
    for index, raw_scene in enumerate(raw_scenes):
        context = f"collections.scenes[{index}]"
        scene = _expect_object(raw_scene, context)
        key = _expect_string(scene.get("key"), f"{context}.key")
        scene_id = _expect_string(scene.get("id"), f"{context}.id")
        if scene_id != f"scene:{key}" or scene_id in scene_ids:
            raise ManifestValidationError(f"{context}.id invalido ou duplicado")
        scene_ids.add(scene_id)

        player_maps = tuple(
            sorted(
                (
                    _parse_scene_variant(item, f"{context}.playerMaps[{item_index}]", assets, "map")
                    for item_index, item in enumerate(
                        _expect_list(scene.get("playerMaps"), f"{context}.playerMaps")
                    )
                ),
                key=lambda item: (item.version, item.asset_id),
            )
        )
        gm_maps = tuple(
            sorted(
                (
                    _parse_scene_variant(item, f"{context}.gmGuideMaps[{item_index}]", assets, "map")
                    for item_index, item in enumerate(
                        _expect_list(scene.get("gmGuideMaps"), f"{context}.gmGuideMaps")
                    )
                ),
                key=lambda item: (item.version, item.asset_id),
            )
        )
        if len({item.asset_id for item in player_maps}) != len(player_maps):
            raise ManifestValidationError(f"{context}.playerMaps contem asset duplicado")
        if len({item.asset_id for item in gm_maps}) != len(gm_maps):
            raise ManifestValidationError(f"{context}.gmGuideMaps contem asset duplicado")

        overlays: list[OverlayView] = []
        for overlay_index, raw_overlay in enumerate(
            _expect_list(scene.get("overlays"), f"{context}.overlays")
        ):
            overlay_context = f"{context}.overlays[{overlay_index}]"
            overlay = _expect_object(raw_overlay, overlay_context)
            asset_id = _expect_string(overlay.get("assetId"), f"{overlay_context}.assetId")
            record = assets.get(asset_id)
            if record is None or record.view.kind != "overlay":
                raise ManifestValidationError(f"{overlay_context}.assetId nao referencia overlay")
            overlays.append(
                OverlayView(
                    asset_id,
                    _expect_string(overlay.get("name"), f"{overlay_context}.name"),
                    _expect_nonnegative_int(overlay.get("version"), f"{overlay_context}.version"),
                )
            )
        if len({item.asset_id for item in overlays}) != len(overlays):
            raise ManifestValidationError(f"{context}.overlays contem asset duplicado")
        overlays.sort(key=lambda item: (item.name, item.version, item.asset_id))

        active_player = _validate_active_variant(
            scene.get("activePlayerMap"), player_maps, f"{context}.activePlayerMap"
        )
        active_gm = _validate_active_variant(
            scene.get("activeGmGuideMap"), gm_maps, f"{context}.activeGmGuideMap"
        )
        scenes.append(
            SceneView(
                scene_id=scene_id,
                key=key,
                player_maps=player_maps,
                gm_guide_maps=gm_maps,
                overlays=tuple(overlays),
                active_player_map=active_player,
                active_gm_guide_map=active_gm,
                grid_hint=_parse_grid_hint(scene.get("gridHint"), f"{context}.gridHint"),
            )
        )
    return tuple(sorted(scenes, key=lambda item: item.key))


def _validate_state_groups(collections: dict[str, Any], assets: Mapping[str, _AssetRecord]) -> None:
    raw_groups = _expect_list(collections.get("stateGroups"), "collections.stateGroups")
    group_ids: set[str] = set()
    for group_index, raw_group in enumerate(raw_groups):
        context = f"collections.stateGroups[{group_index}]"
        group = _expect_object(raw_group, context)
        key = _expect_string(group.get("key"), f"{context}.key")
        group_id = _expect_string(group.get("id"), f"{context}.id")
        if group_id != f"state-group:{key}" or group_id in group_ids:
            raise ManifestValidationError(f"{context}.id invalido ou duplicado")
        group_ids.add(group_id)
        states = _expect_object(group.get("states"), f"{context}.states")
        for state_name, raw_state in states.items():
            _expect_string(state_name, f"{context}.states key")
            state_context = f"{context}.states[{state_name}]"
            state = _expect_object(raw_state, state_context)
            selected_id = _expect_string(state.get("assetId"), f"{state_context}.assetId")
            selected_version = _expect_nonnegative_int(
                state.get("version"), f"{state_context}.version"
            )
            variants = tuple(
                _parse_scene_variant(
                    raw_variant,
                    f"{state_context}.variants[{variant_index}]",
                    assets,
                    "prop",
                )
                for variant_index, raw_variant in enumerate(
                    _expect_list(state.get("variants"), f"{state_context}.variants")
                )
            )
            if not variants or len({item.asset_id for item in variants}) != len(variants):
                raise ManifestValidationError(f"{state_context}.variants vazio ou duplicado")
            if (selected_id, selected_version) not in {
                (item.asset_id, item.version) for item in variants
            }:
                raise ManifestValidationError(f"{state_context} seleciona variante ausente")
            if selected_version != max(item.version for item in variants):
                raise ManifestValidationError(f"{state_context} nao seleciona a maior versao")


def _parse_token_ids(
    collections: dict[str, Any], assets: Mapping[str, _AssetRecord]
) -> tuple[str, ...]:
    values = _expect_list(collections.get("tokenAssetIds"), "collections.tokenAssetIds")
    token_ids: list[str] = []
    for index, value in enumerate(values):
        asset_id = _expect_string(value, f"collections.tokenAssetIds[{index}]")
        record = assets.get(asset_id)
        if record is None or record.view.kind != "token":
            raise ManifestValidationError("tokenAssetIds referencia asset que nao e token")
        token_ids.append(asset_id)
    if len(token_ids) != len(set(token_ids)):
        raise ManifestValidationError("tokenAssetIds contem duplicata")
    return tuple(token_ids)


class CampaignCatalog:
    """Catalogo imutavel de metadados com resolucao autorizada e hash lazy.

    ``role`` e uma informacao confiavel produzida pela autenticacao do servidor;
    nunca deve ser copiada diretamente de query, header livre ou JSON do cliente.
    Endpoints de bytes devem preferir ``open_asset`` para conservar o descritor
    validado, em vez de entregar o path a uma API que o reabra depois.
    """

    def __init__(
        self,
        *,
        campaign_id: str,
        campaign_title: str,
        source_ref: str,
        source_root: Path,
        assets: dict[str, _AssetRecord],
        scenes: tuple[SceneView, ...],
        token_ids: tuple[str, ...],
    ) -> None:
        self.campaign_id = campaign_id
        self.campaign_title = campaign_title
        self.source_ref = source_ref
        self._source_root = source_root
        self._source_root_identity = source_root.stat()
        self._assets = assets
        self._scenes = scenes
        self._token_ids = token_ids
        self._hash_cache: dict[str, _FileSignature] = {}
        self._hash_cache_lock = threading.Lock()

    @classmethod
    def load(
        cls,
        manifest_path: str | os.PathLike[str],
        source_roots: Mapping[str, str | os.PathLike[str]],
    ) -> "CampaignCatalog":
        """Carrega schema 2 usando somente a raiz explicitamente mapeada por sourceRef."""

        manifest = _read_manifest(manifest_path)
        if manifest.get("schemaVersion") != MANIFEST_SCHEMA_VERSION:
            raise ManifestValidationError(
                f"schemaVersion precisa ser {MANIFEST_SCHEMA_VERSION}"
            )
        campaign = _expect_object(manifest.get("campaign"), "campaign")
        if "sourceRoot" in campaign:
            raise ManifestValidationError("campaign.sourceRoot absoluto nao e aceito em runtime")
        source_ref = _expect_string(campaign.get("sourceRef"), "campaign.sourceRef")
        if not _SOURCE_REF_PATTERN.fullmatch(source_ref):
            raise ManifestValidationError("campaign.sourceRef nao e uma referencia logica valida")
        source_root = _resolve_source_root(source_ref, source_roots)
        campaign_id = _expect_string(campaign.get("id"), "campaign.id")
        campaign_title = _expect_string(campaign.get("title"), "campaign.title")

        assets = _parse_assets(manifest)
        _validate_documents(manifest)
        collections = _expect_object(manifest.get("collections"), "collections")
        scenes = _parse_scenes(collections, assets)
        _validate_state_groups(collections, assets)
        token_ids = _parse_token_ids(collections, assets)
        return cls(
            campaign_id=campaign_id,
            campaign_title=campaign_title,
            source_ref=source_ref,
            source_root=source_root,
            assets=assets,
            scenes=scenes,
            token_ids=token_ids,
        )

    @property
    def hash_cache_size(self) -> int:
        with self._hash_cache_lock:
            return len(self._hash_cache)

    def clear_hash_cache(self) -> None:
        with self._hash_cache_lock:
            self._hash_cache.clear()

    @staticmethod
    def _validate_role(role: str) -> str:
        if role not in _ROLES:
            raise AssetNotAvailableError("Papel sem acesso ao catalogo")
        return role

    @staticmethod
    def _is_authorized(record: _AssetRecord, role: str) -> bool:
        return role == "master" or record.view.audience == "players"

    def _asset_for_role(self, asset_id: str, role: str) -> _AssetRecord:
        role = self._validate_role(role)
        record = self._assets.get(asset_id)
        if record is None or not self._is_authorized(record, role):
            raise AssetNotAvailableError("Asset indisponivel para este papel")
        return record

    def get_asset(self, asset_id: str, role: str) -> AssetView:
        """Retorna apenas metadados sanitizados quando o papel pode conhecer o asset."""

        return self._asset_for_role(asset_id, role).view

    def list_tokens(self, role: str) -> tuple[AssetView, ...]:
        """Lista tokens autorizados sem expor relativePath, hash ou raiz local."""

        role = self._validate_role(role)
        return tuple(
            record.view
            for asset_id in self._token_ids
            if (record := self._assets[asset_id]) and self._is_authorized(record, role)
        )

    def list_scenes(self, role: str) -> tuple[SceneView, ...]:
        """Lista cenas filtradas; jogadores nunca recebem mapas-guia do mestre."""

        role = self._validate_role(role)
        if role == "master":
            return self._scenes

        result: list[SceneView] = []
        for scene in self._scenes:
            player_maps = tuple(
                item
                for item in scene.player_maps
                if self._is_authorized(self._assets[item.asset_id], role)
            )
            if not player_maps:
                continue
            available_player_ids = {item.asset_id for item in player_maps}
            overlays = tuple(
                item
                for item in scene.overlays
                if self._is_authorized(self._assets[item.asset_id], role)
            )
            result.append(
                SceneView(
                    scene_id=scene.scene_id,
                    key=scene.key,
                    player_maps=player_maps,
                    gm_guide_maps=(),
                    overlays=overlays,
                    active_player_map=(
                        scene.active_player_map
                        if scene.active_player_map in available_player_ids
                        else None
                    ),
                    active_gm_guide_map=None,
                    grid_hint=scene.grid_hint,
                )
            )
        return tuple(result)

    def _resolve_confined_path(self, record: _AssetRecord) -> Path:
        self._assert_source_root_stable()
        current = self._source_root
        parts = record.relative_path.parts
        for index, part in enumerate(parts):
            current = current / part
            try:
                info = current.lstat()
            except OSError as error:
                raise UnsafeAssetPathError("Asset externo ausente ou inacessivel") from error
            if _stat_is_link_or_junction(info):
                raise UnsafeAssetPathError("Asset atravessa link simbolico ou junction")
            if index < len(parts) - 1 and not stat.S_ISDIR(info.st_mode):
                raise UnsafeAssetPathError("Componente intermediario do asset nao e diretorio")
            if index == len(parts) - 1 and not stat.S_ISREG(info.st_mode):
                raise UnsafeAssetPathError("Asset nao e arquivo regular")
        try:
            resolved = current.resolve(strict=True)
            resolved.relative_to(self._source_root)
        except (OSError, ValueError) as error:
            raise UnsafeAssetPathError("Asset resolve fora da raiz configurada") from error
        self._assert_source_root_stable()
        return resolved

    def _assert_source_root_stable(self) -> None:
        try:
            current = self._source_root.lstat()
        except OSError as error:
            raise UnsafeAssetPathError("A raiz configurada deixou de existir") from error
        if (
            _stat_is_link_or_junction(current)
            or not stat.S_ISDIR(current.st_mode)
            or not os.path.samestat(self._source_root_identity, current)
        ):
            raise UnsafeAssetPathError("A raiz configurada mudou desde a carga do catalogo")

    def _open_verified(self, record: _AssetRecord, path: Path) -> tuple[int, _FileSignature]:
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_CLOEXEC", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        try:
            descriptor = os.open(path, flags)
        except OSError as error:
            raise UnsafeAssetPathError("Nao foi possivel abrir o asset com seguranca") from error
        try:
            before = os.fstat(descriptor)
            if self._resolve_confined_path(record) != path:
                raise UnsafeAssetPathError("Asset mudou entre a resolucao e a abertura")
            try:
                current = path.lstat()
            except OSError as error:
                raise UnsafeAssetPathError("Asset mudou antes da validacao") from error
            if (
                not stat.S_ISREG(before.st_mode)
                or _stat_is_link_or_junction(current)
                or not os.path.samestat(before, current)
            ):
                raise UnsafeAssetPathError("Asset mudou ou deixou de ser arquivo regular")
            signature = _file_signature(before)
            if signature.size != record.expected_bytes:
                raise AssetIntegrityError("Tamanho do asset diverge do manifesto")

            with self._hash_cache_lock:
                cached = self._hash_cache.get(record.view.asset_id)
            if cached == signature:
                if self._resolve_confined_path(record) != path:
                    raise UnsafeAssetPathError("Asset mudou durante a validacao em cache")
                try:
                    cached_after = os.fstat(descriptor)
                    current_cached = path.lstat()
                except OSError as error:
                    raise AssetIntegrityError("Asset sumiu durante a validacao em cache") from error
                if (
                    _file_signature(cached_after) != signature
                    or _stat_is_link_or_junction(current_cached)
                    or not os.path.samestat(cached_after, current_cached)
                ):
                    raise AssetIntegrityError("Asset mudou durante a validacao em cache")
                os.lseek(descriptor, 0, os.SEEK_SET)
                return descriptor, signature

            digest = _sha256_fd(descriptor)
            after = os.fstat(descriptor)
            try:
                current_after = path.lstat()
            except OSError as error:
                raise AssetIntegrityError("Asset mudou durante o hash") from error
            if (
                _file_signature(after) != signature
                or _stat_is_link_or_junction(current_after)
                or not os.path.samestat(after, current_after)
            ):
                raise AssetIntegrityError("Asset mudou durante o hash")
            if not hmac.compare_digest(digest, record.expected_sha256):
                raise AssetIntegrityError("SHA-256 do asset diverge do manifesto")
            if self._resolve_confined_path(record) != path:
                raise UnsafeAssetPathError("Asset mudou durante o hash")
            try:
                final_stat = os.fstat(descriptor)
                final_path_stat = path.lstat()
            except OSError as error:
                raise AssetIntegrityError("Asset sumiu depois do hash") from error
            if (
                _file_signature(final_stat) != signature
                or _stat_is_link_or_junction(final_path_stat)
                or not os.path.samestat(final_stat, final_path_stat)
            ):
                raise AssetIntegrityError("Asset mudou depois do hash")
            with self._hash_cache_lock:
                self._hash_cache[record.view.asset_id] = signature
            os.lseek(descriptor, 0, os.SEEK_SET)
            return descriptor, signature
        except Exception:
            os.close(descriptor)
            raise

    def resolve_asset(self, asset_id: str, role: str) -> ResolvedAsset:
        """Autoriza, confina e valida SHA-256 antes de devolver um caminho local."""

        record = self._asset_for_role(asset_id, role)
        path = self._resolve_confined_path(record)
        descriptor, signature = self._open_verified(record, path)
        os.close(descriptor)
        return ResolvedAsset(
            asset=record.view,
            path=path,
            sha256=record.expected_sha256,
            size=signature.size,
            mtime_ns=signature.mtime_ns,
        )

    def open_asset(self, asset_id: str, role: str) -> OpenedAsset:
        """Abre um stream no mesmo descritor autorizado, confinado e validado."""

        record = self._asset_for_role(asset_id, role)
        path = self._resolve_confined_path(record)
        descriptor, signature = self._open_verified(record, path)
        try:
            stream = os.fdopen(descriptor, "rb")
        except Exception:
            os.close(descriptor)
            raise
        return OpenedAsset(
            asset=record.view,
            stream=stream,
            sha256=record.expected_sha256,
            size=signature.size,
            mtime_ns=signature.mtime_ns,
        )


def load_campaign_catalog(
    manifest_path: str | os.PathLike[str],
    source_roots: Mapping[str, str | os.PathLike[str]],
) -> CampaignCatalog:
    """Atalho funcional para integracoes que nao desejam chamar o classmethod."""

    return CampaignCatalog.load(manifest_path, source_roots)


__all__ = [
    "AssetIntegrityError",
    "AssetNotAvailableError",
    "AssetView",
    "CampaignCatalog",
    "CampaignCatalogError",
    "GridHintView",
    "ImageView",
    "ManifestValidationError",
    "OpenedAsset",
    "OverlayView",
    "ResolvedAsset",
    "SceneVariantView",
    "SceneView",
    "SourceConfigurationError",
    "UnsafeAssetPathError",
    "load_campaign_catalog",
]
