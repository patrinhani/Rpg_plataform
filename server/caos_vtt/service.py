from __future__ import annotations

import asyncio
import binascii
import hashlib
import json
import math
import re
import secrets
import string
import warnings
from collections import OrderedDict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import WebSocket
from .campaign import (
    AssetNotAvailableError,
    AssetView,
    CampaignCatalog,
    CampaignCatalogError,
    OpenedAsset,
    SceneView,
)
from .models import (
    FogPresetApplyCommand,
    FogPresetsApplyAllCommand,
    FogResetCommand,
    FogRegionCreateCommand,
    FogRegionRemoveCommand,
    FogRegionSetRevealedCommand,
    FogRegionUpdateCommand,
    FogRevealAllCommand,
    FogSetEnabledCommand,
    FogStrokeCommand,
    HandoutDeliverCommand,
    HandoutRevokeCommand,
    MoveCommand,
    OverlaySetCommand,
    OverlayUpdateCommand,
    PropRemoveCommand,
    PropSpawnCommand,
    PropUpdateCommand,
    Role,
    SceneLayerSetCommand,
    SceneLayerUpdateCommand,
    SceneSelectCommand,
    TokenAssignCommand,
    TokenRemoveCommand,
    TokenSpawnCommand,
)
from .storage import RoomStateStore, RoomStateStoreBackend


PROTOCOL_VERSION = 1
DEMO_TOKEN_ID = "demo-token"
EMPTY_CAMPAIGN_ID = "caos-empty"
ROOM_ALPHABET = string.ascii_uppercase + string.digits
MEDIA_TOKEN_TTL_SECONDS = 12 * 60 * 60
MESA_CHALLENGE_TTL_SECONDS = 2 * 60
DEFAULT_MAX_PENDING_MESA_CHALLENGES = 256
DEFAULT_MAX_PENDING_TICKETS_PER_ROOM = 32
DEFAULT_MAX_MEDIA_GRANTS_PER_ROOM = 64
MAX_ROOM_TOKENS = 256
MAX_ROOM_PROPS = 128
PROCESSED_COMMAND_LIMIT = 256
CLIENT_SEND_TIMEOUT_SECONDS = 5.0
MAX_FOG_REGIONS_PER_SCENE = 128

CatalogCommand = (
    MoveCommand
    | SceneSelectCommand
    | OverlaySetCommand
    | OverlayUpdateCommand
    | SceneLayerSetCommand
    | SceneLayerUpdateCommand
    | TokenSpawnCommand
    | TokenAssignCommand
    | TokenRemoveCommand
    | PropSpawnCommand
    | PropUpdateCommand
    | PropRemoveCommand
    | FogStrokeCommand
    | FogRegionCreateCommand
    | FogRegionUpdateCommand
    | FogRegionSetRevealedCommand
    | FogRegionRemoveCommand
    | FogSetEnabledCommand
    | FogPresetApplyCommand
    | FogPresetsApplyAllCommand
    | FogResetCommand
    | FogRevealAllCommand
    | HandoutDeliverCommand
    | HandoutRevokeCommand
)


def _token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def _command_fingerprint(command: CatalogCommand) -> str:
    encoded = json.dumps(
        command.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@dataclass(eq=False, slots=True)
class ClientConnection:
    websocket: WebSocket
    role: Role
    media_digest: bytes
    mesa_session: MesaSession | None = None
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload: dict[str, Any]) -> None:
        async with self.send_lock:
            await self.websocket.send_json(payload)


@dataclass(eq=False, slots=True)
class MesaSession:
    """Ephemeral VTT session derived from a rules-validated Firestore grant."""

    room_id: str
    mesa_id: str
    uid: str
    role: Role
    expires_at: datetime
    revoked: bool = False


@dataclass(frozen=True, slots=True)
class PendingMesaChallenge:
    mesa_id: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class TicketGrant:
    room_id: str
    role: Role
    expires_at: datetime
    media_digest: bytes
    mesa_session: MesaSession | None = None


@dataclass(frozen=True, slots=True)
class MediaGrant:
    room_id: str
    role: Role
    expires_at: datetime
    mesa_session: MesaSession | None = None


@dataclass(frozen=True, slots=True)
class IssuedAccess:
    ticket: str
    role: Role
    ticket_expires_in: int
    media_token: str
    media_expires_in: int


@dataclass(frozen=True, slots=True)
class CatalogCommandFailure:
    code: str
    message: str


class AccessCapacityError(Exception):
    """A sala atingiu o limite temporario de credenciais efemeras."""


class PersistedAssetObsoleteError(Exception):
    """Uma entidade válida referencia um asset que mudou de função no catálogo."""


@dataclass(frozen=True, slots=True)
class ProcessedCatalogCommand:
    role: Role
    message_type: str
    fingerprint: str


@dataclass(slots=True)
class CatalogToken:
    token_id: str
    asset_id: str
    x: float
    y: float
    label: str
    size: float
    movable: bool
    visible: bool
    controller_uid: str | None = None


@dataclass(slots=True)
class CatalogProp:
    prop_id: str
    asset_id: str
    x: float
    y: float
    label: str
    width: float
    height: float
    rotation: float
    visible: bool
    locked: bool = True


@dataclass(slots=True)
class CatalogLayerPlacement:
    x: float
    y: float
    width: float
    height: float
    rotation: float
    locked: bool = True


@dataclass(slots=True)
class CatalogOverlayPlacement:
    x: float = 0.5
    y: float = 0.5
    width: float = 1.0
    height: float = 1.0
    rotation: float = 0.0
    locked: bool = True


@dataclass(slots=True)
class FogRegion:
    region_id: str
    label: str
    points: tuple[tuple[float, float], ...]
    revealed: bool = False


@dataclass(slots=True)
class FogState:
    enabled: bool = True
    revision: int = 0
    map_asset_id: str | None = None
    map_fingerprint: str | None = None
    reveal_all: bool = False
    regions: dict[str, FogRegion] = field(default_factory=dict)


@dataclass(slots=True)
class Room:
    room_id: str
    name: str
    master_invite_digest: bytes
    player_invite_digest: bytes
    campaign_id: str | None = None
    external_mesa_id: str | None = None
    revision: int = 0
    token_x: float = 0.5
    token_y: float = 0.5
    clients: set[ClientConnection] = field(default_factory=set)
    processed_commands: OrderedDict[str, dict[str, Any]] = field(default_factory=OrderedDict)
    catalog_commands: OrderedDict[str, ProcessedCatalogCommand] = field(
        default_factory=OrderedDict
    )
    active_scene_id: str | None = None
    scene_tokens: dict[str, dict[str, CatalogToken]] = field(default_factory=dict)
    scene_props: dict[str, dict[str, CatalogProp]] = field(default_factory=dict)
    scene_overlays: dict[str, dict[str, bool]] = field(default_factory=dict)
    scene_overlay_placements: dict[str, dict[str, CatalogOverlayPlacement]] = field(
        default_factory=dict
    )
    scene_layers: dict[str, dict[str, str | None]] = field(default_factory=dict)
    scene_layer_placements: dict[
        str, dict[str, dict[int, CatalogLayerPlacement]]
    ] = field(default_factory=dict)
    scene_fog: dict[str, FogState] = field(default_factory=dict)
    delivered_handouts: dict[str, str] = field(default_factory=dict)
    persistence_warning: str | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    broadcast_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class VTTService:
    def __init__(
        self,
        *,
        ticket_ttl_seconds: int,
        max_pending_tickets_per_room: int = DEFAULT_MAX_PENDING_TICKETS_PER_ROOM,
        max_media_grants_per_room: int = DEFAULT_MAX_MEDIA_GRANTS_PER_ROOM,
        catalog: CampaignCatalog | None = None,
        state_db_path: Path | None = None,
        state_store: RoomStateStoreBackend | None = None,
    ) -> None:
        if state_db_path is not None and state_store is not None:
            raise ValueError("Informe state_db_path ou state_store, nunca ambos")
        self.ticket_ttl_seconds = ticket_ttl_seconds
        self.media_ttl_seconds = MEDIA_TOKEN_TTL_SECONDS
        self.max_pending_tickets_per_room = max_pending_tickets_per_room
        self.max_media_grants_per_room = max_media_grants_per_room
        self.catalog = catalog
        self._rooms: dict[str, Room] = {}
        self._external_rooms: dict[str, str] = {}
        self._tickets: dict[str, TicketGrant] = {}
        self._media_grants: dict[bytes, MediaGrant] = {}
        self._mesa_challenges: dict[str, PendingMesaChallenge] = {}
        self._map_fingerprint_cache: dict[str, str] = {}
        self._rooms_lock = asyncio.Lock()
        self._access_lock = asyncio.Lock()
        self._store = state_store
        if self._store is None and state_db_path is not None:
            self._store = RoomStateStore(state_db_path)
        if self._store is not None:
            self._restore_rooms()

    @property
    def has_catalog(self) -> bool:
        return self.catalog is not None

    @property
    def active_campaign_id(self) -> str:
        """Campanha padrao da API manual protegida pelo token do host."""

        return self.catalog.campaign_id if self.catalog is not None else EMPTY_CAMPAIGN_ID

    def supports_campaign(self, campaign_id: str) -> bool:
        return campaign_id == EMPTY_CAMPAIGN_ID or (
            self.catalog is not None and campaign_id == self.catalog.campaign_id
        )

    def _room_uses_catalog(self, room: Room) -> bool:
        return self.catalog is not None and room.campaign_id == self.catalog.campaign_id

    async def create_room(
        self,
        name: str,
        *,
        campaign_id: str | None = None,
        external_mesa_id: str | None = None,
    ) -> tuple[Room, str, str]:
        requested_campaign_id = campaign_id or self.active_campaign_id
        if not self.supports_campaign(requested_campaign_id):
            raise ValueError("A campanha solicitada nao esta carregada neste servidor")
        # Invite secrets are generated even for integrated rooms so persisted
        # legacy digests are overwritten with values that were never disclosed.
        master_invite = secrets.token_urlsafe(32)
        player_invite = secrets.token_urlsafe(32)
        room: Room
        created = False
        async with self._rooms_lock:
            if external_mesa_id is not None:
                existing_id = self._external_rooms.get(external_mesa_id)
                existing = self._rooms.get(existing_id or "")
                if existing is not None:
                    if existing.campaign_id != requested_campaign_id:
                        raise ValueError("A Mesa ja possui uma sala de outra campanha")
                    async with existing.broadcast_lock:
                        async with existing.lock:
                            existing.name = name.strip()
                            # Integrated rooms never authenticate with legacy
                            # invites. Rotate on every secure reuse so values
                            # persisted by older releases become useless too.
                            existing.master_invite_digest = _token_digest(master_invite)
                            existing.player_invite_digest = _token_digest(player_invite)
                        await self._persist_room(existing)
                    room = existing
                else:
                    created = True
            else:
                created = True

            if created:
                room_id = self._new_room_id()
                room = Room(
                    room_id=room_id,
                    name=name.strip(),
                    master_invite_digest=_token_digest(master_invite),
                    player_invite_digest=_token_digest(player_invite),
                    campaign_id=requested_campaign_id,
                    external_mesa_id=external_mesa_id,
                )
                if self._room_uses_catalog(room):
                    self._initialize_catalog_room(room)
                self._rooms[room_id] = room
                if external_mesa_id is not None:
                    self._external_rooms[external_mesa_id] = room_id
                await self._persist_room(room)

        if external_mesa_id is not None:
            # This also evicts grants/sockets produced by an older process path
            # before the room was converted or securely reused.
            await self._revoke_manual_room_access(room)
            return room, "", ""
        return room, master_invite, player_invite

    async def ensure_room_for_mesa(
        self,
        name: str,
        *,
        campaign_id: str | None,
        external_mesa_id: str,
    ) -> Room:
        room, _, _ = await self.create_room(
            name,
            campaign_id=campaign_id,
            external_mesa_id=external_mesa_id,
        )
        return room

    def room_for_external_mesa(self, external_mesa_id: str) -> Room | None:
        room_id = self._external_rooms.get(external_mesa_id)
        return self._rooms.get(room_id or "")

    def _initialize_catalog_room(self, room: Room) -> None:
        assert self._room_uses_catalog(room)
        scenes = self.catalog.list_scenes("master")
        for scene in scenes:
            room.scene_tokens[scene.scene_id] = {}
            room.scene_props[scene.scene_id] = {}
            room.scene_overlays[scene.scene_id] = {
                overlay.asset_id: False for overlay in scene.overlays
            }
            room.scene_overlay_placements[scene.scene_id] = {}
            room.scene_layers[scene.scene_id] = {
                layer.layer_id: layer.default_state for layer in scene.layers
            }
            room.scene_layer_placements[scene.scene_id] = {}
            room.scene_fog[scene.scene_id] = self._fog_state_from_scene(scene)
        room.active_scene_id = scenes[0].scene_id if scenes else None

    def _fog_state_from_scene(
        self,
        scene: SceneView,
        *,
        revision: int = 0,
        enabled: bool = True,
    ) -> FogState:
        regions = {
            region.region_id: FogRegion(
                region.region_id,
                region.label,
                region.points,
                False,
            )
            for region in (scene.fog_preset.regions if scene.fog_preset is not None else ())
        }
        return FogState(
            enabled=enabled,
            revision=revision,
            map_asset_id=scene.active_player_map,
            map_fingerprint=self._map_fingerprint(scene.active_player_map),
            regions=regions,
        )

    def _map_fingerprint(self, asset_id: str | None) -> str | None:
        if asset_id is None:
            return None
        cached = self._map_fingerprint_cache.get(asset_id)
        if cached is not None:
            return cached
        assert self.catalog is not None
        fingerprint = self.catalog.get_asset_fingerprint(asset_id, "master")
        self._map_fingerprint_cache[asset_id] = fingerprint
        return fingerprint

    async def issue_ticket(self, room_id: str, invite_token: str) -> IssuedAccess | None:
        room = self._rooms.get(room_id)
        if room is None or room.external_mesa_id is not None:
            return None

        supplied = _token_digest(invite_token)
        if secrets.compare_digest(supplied, room.master_invite_digest):
            role: Role = "master"
        elif secrets.compare_digest(supplied, room.player_invite_digest):
            role = "player"
        else:
            return None

        return await self.issue_role_access(room_id, role)

    async def issue_role_access(self, room_id: str, role: Role) -> IssuedAccess | None:
        room = self._rooms.get(room_id)
        if room is None or room.external_mesa_id is not None:
            return None

        return await self._issue_access(room, role, mesa_session=None)

    async def issue_mesa_access(
        self,
        room_id: str,
        role: Role,
        *,
        mesa_id: str,
        uid: str,
        expires_at: datetime,
    ) -> IssuedAccess | None:
        room = self._rooms.get(room_id)
        if room is None or room.external_mesa_id != mesa_id:
            return None
        mesa_session = MesaSession(
            room_id=room_id,
            mesa_id=mesa_id,
            uid=uid,
            role=role,
            expires_at=expires_at.astimezone(UTC),
        )
        return await self._issue_access(room, role, mesa_session=mesa_session)

    async def issue_mesa_challenge(self, mesa_id: str) -> tuple[str, int]:
        now = datetime.now(UTC)
        async with self._access_lock:
            self._purge_expired_access(now)
            if len(self._mesa_challenges) >= DEFAULT_MAX_PENDING_MESA_CHALLENGES:
                raise AccessCapacityError
            while True:
                challenge = secrets.token_urlsafe(32)
                if challenge not in self._mesa_challenges:
                    break
            self._mesa_challenges[challenge] = PendingMesaChallenge(
                mesa_id=mesa_id,
                expires_at=now + timedelta(seconds=MESA_CHALLENGE_TTL_SECONDS),
            )
        return challenge, MESA_CHALLENGE_TTL_SECONDS

    async def consume_mesa_challenge(self, mesa_id: str, challenge: str) -> bool:
        now = datetime.now(UTC)
        async with self._access_lock:
            self._purge_expired_access(now)
            pending = self._mesa_challenges.pop(challenge, None)
        return bool(
            pending is not None
            and pending.mesa_id == mesa_id
            and pending.expires_at > now
        )

    async def _issue_access(
        self,
        room: Room,
        role: Role,
        *,
        mesa_session: MesaSession | None,
    ) -> IssuedAccess:
        if (room.external_mesa_id is None) != (mesa_session is None):
            raise ValueError("modo de acesso incompativel com a sala")

        ticket = secrets.token_urlsafe(24)
        media_token = secrets.token_urlsafe(32)
        media_digest = _token_digest(media_token)
        now = datetime.now(UTC)
        if mesa_session is not None and mesa_session.expires_at <= now:
            raise ValueError("grant integrado expirado")
        ticket_expires_at = now + timedelta(seconds=self.ticket_ttl_seconds)
        media_expires_at = now + timedelta(seconds=self.media_ttl_seconds)
        if mesa_session is not None:
            ticket_expires_at = min(ticket_expires_at, mesa_session.expires_at)
            media_expires_at = min(media_expires_at, mesa_session.expires_at)
        ticket_grant = TicketGrant(
            room_id=room.room_id,
            role=role,
            expires_at=ticket_expires_at,
            media_digest=media_digest,
            mesa_session=mesa_session,
        )
        media_grant = MediaGrant(
            room_id=room.room_id,
            role=role,
            expires_at=media_expires_at,
            mesa_session=mesa_session,
        )
        async with self._access_lock:
            self._purge_expired_access(now)
            pending_tickets = sum(
                grant.room_id == room.room_id for grant in self._tickets.values()
            )
            media_grants = sum(
                grant.room_id == room.room_id for grant in self._media_grants.values()
            )
            if (
                pending_tickets >= self.max_pending_tickets_per_room
                or media_grants >= self.max_media_grants_per_room
            ):
                raise AccessCapacityError
            self._tickets[ticket] = ticket_grant
            self._media_grants[media_digest] = media_grant
        return IssuedAccess(
            ticket=ticket,
            role=role,
            ticket_expires_in=max(1, int((ticket_expires_at - now).total_seconds())),
            media_token=media_token,
            media_expires_in=max(1, int((media_expires_at - now).total_seconds())),
        )

    async def consume_ticket(self, room_id: str, ticket: str) -> TicketGrant | None:
        async with self._access_lock:
            now = datetime.now(UTC)
            self._purge_expired_access(now)
            grant = self._tickets.pop(ticket, None)
            if grant is not None and (
                grant.room_id != room_id
                or grant.expires_at <= now
                or self._mesa_session_inactive(grant.mesa_session, now)
            ):
                self._media_grants.pop(grant.media_digest, None)
        if (
            grant is None
            or grant.room_id != room_id
            or grant.expires_at <= now
            or self._mesa_session_inactive(grant.mesa_session, now)
        ):
            return None
        return grant

    async def validate_media_grant(self, room_id: str, token: str) -> MediaGrant | None:
        async with self._access_lock:
            now = datetime.now(UTC)
            self._purge_expired_access(now)
            grant = self._media_grants.get(_token_digest(token))
        if (
            grant is None
            or grant.room_id != room_id
            or grant.expires_at <= now
            or self._mesa_session_inactive(grant.mesa_session, now)
            or room_id not in self._rooms
        ):
            return None
        return grant

    async def revoke_mesa_session(self, session: MesaSession) -> None:
        """Revoke every ephemeral credential/socket backed by one Mesa grant."""

        session.revoked = True
        async with self._access_lock:
            expired_tickets = [
                token
                for token, grant in self._tickets.items()
                if grant.mesa_session is session
            ]
            expired_media = [
                digest
                for digest, grant in self._media_grants.items()
                if grant.mesa_session is session
            ]
            for token in expired_tickets:
                self._tickets.pop(token, None)
            for digest in expired_media:
                self._media_grants.pop(digest, None)

        room = self._rooms.get(session.room_id)
        if room is None:
            return
        async with room.lock:
            clients = tuple(
                client
                for client in room.clients
                if client.mesa_session is session
            )
            for client in clients:
                room.clients.discard(client)
        for client in clients:
            try:
                await client.websocket.close(
                    code=4403,
                    reason="Mesa membership changed",
                )
            except Exception:
                pass

    async def _revoke_manual_room_access(self, room: Room) -> None:
        """Remove legacy invite-derived access after a room becomes integrated."""

        async with self._access_lock:
            legacy_tickets = [
                token
                for token, grant in self._tickets.items()
                if grant.room_id == room.room_id and grant.mesa_session is None
            ]
            legacy_media = [
                digest
                for digest, grant in self._media_grants.items()
                if grant.room_id == room.room_id and grant.mesa_session is None
            ]
            for token in legacy_tickets:
                self._tickets.pop(token, None)
            for digest in legacy_media:
                self._media_grants.pop(digest, None)

        async with room.lock:
            clients = tuple(
                client
                for client in room.clients
                if client.mesa_session is None
            )
            for client in clients:
                room.clients.discard(client)
        for client in clients:
            try:
                await client.websocket.close(
                    code=4403,
                    reason="Room now uses Mesa authentication",
                )
            except Exception:
                pass

    async def can_access_asset(self, room_id: str, role: Role, asset_id: str) -> bool:
        """Authorize only media needed by the player's current client-side scene."""
        catalog = self.catalog
        room = self._rooms.get(room_id)
        if catalog is None or room is None or not self._room_uses_catalog(room):
            return False
        if role == "master":
            return True

        async with room.lock:
            # Handouts sao estado global da sala: entrega e revogacao nao
            # dependem de cena ativa, nevoa ou troca de mapa.
            if catalog.is_handout(asset_id):
                return asset_id in room.delivered_handouts
            active_scene_id = room.active_scene_id
            if active_scene_id is None:
                return False
            scene = next(
                (
                    item
                    for item in catalog.list_scenes("player")
                    if item.scene_id == active_scene_id
                ),
                None,
            )
            if scene is None:
                return False
            fog = room.scene_fog.get(active_scene_id)
            layer_asset_ids = {
                state.asset_id for layer in scene.layers for state in layer.states
            }
            if asset_id in layer_asset_ids:
                selected_layers = room.scene_layers.get(active_scene_id, {})
                return any(
                    selected_layers.get(layer.layer_id) == state.key
                    and state.asset_id == asset_id
                    for layer in scene.layers
                    for state in layer.states
                )
            if scene.active_player_map == asset_id:
                return True

            overlay_states = room.scene_overlays.get(active_scene_id, {})
            if any(
                overlay.asset_id == asset_id
                and overlay_states.get(overlay.asset_id, False)
                for overlay in scene.overlays
            ):
                return True

            if any(
                token.asset_id == asset_id
                and self._token_visible_to_player(room, active_scene_id, token)
                for token in room.scene_tokens.get(active_scene_id, {}).values()
            ):
                return True
            return any(
                prop.asset_id == asset_id
                and self._prop_visible_to_player(room, active_scene_id, prop)
                for prop in room.scene_props.get(active_scene_id, {}).values()
            )

    async def open_authorized_asset(
        self,
        room_id: str,
        role: Role,
        asset_id: str,
    ) -> OpenedAsset:
        """Autoriza no estado da sala antes de abrir um descritor validado.

        Handouts usam um caminho explicito que exige simultaneamente pertencer
        ao catalogo privado e constar na fotografia de entregas desta sala.
        """

        catalog = self.catalog
        room = self._rooms.get(room_id)
        if catalog is None or room is None or not self._room_uses_catalog(room):
            raise AssetNotAvailableError("Asset indisponivel")
        if not await self.can_access_asset(room_id, role, asset_id):
            raise AssetNotAvailableError("Asset indisponivel")

        if role == "player" and catalog.is_handout(asset_id):
            async with room.lock:
                delivered = frozenset(room.delivered_handouts)
            return await asyncio.to_thread(
                catalog.open_delivered_handout,
                asset_id,
                delivered,
            )
        return await asyncio.to_thread(catalog.open_asset, asset_id, role)

    async def connect(
        self,
        room_id: str,
        websocket: WebSocket,
        role: Role,
        media_digest: bytes,
        mesa_session: MesaSession | None = None,
    ) -> ClientConnection | None:
        room = self._rooms.get(room_id)
        if (
            room is None
            or (room.external_mesa_id is None) != (mesa_session is None)
            or (mesa_session is not None and mesa_session.revoked)
        ):
            await self._revoke_media_digests((media_digest,))
            return None
        connection = ClientConnection(
            websocket=websocket,
            role=role,
            media_digest=media_digest,
            mesa_session=mesa_session,
        )
        try:
            async with room.broadcast_lock:
                async with room.lock:
                    snapshot = self._snapshot(
                        room,
                        role,
                        mesa_session.uid if mesa_session is not None else None,
                    )
                await connection.send(snapshot)
                async with room.lock:
                    room.clients.add(connection)
        except BaseException:
            await self._revoke_media_digests((media_digest,))
            raise
        return connection

    async def disconnect(self, room_id: str, connection: ClientConnection) -> None:
        room = self._rooms.get(room_id)
        if room is not None:
            async with room.lock:
                room.clients.discard(connection)
        if connection.mesa_session is not None:
            await self.revoke_mesa_session(connection.mesa_session)
        else:
            await self._revoke_media_digests((connection.media_digest,))

    async def move_token(
        self,
        room_id: str,
        sender: ClientConnection,
        command: MoveCommand,
    ) -> dict[str, Any] | None:
        """Mantem o contrato demo legado; catalog mode usa execute_catalog_command."""

        room = self._rooms.get(room_id)
        if room is None or self._room_uses_catalog(room):
            return None

        async with room.broadcast_lock:
            async with room.lock:
                if command.commandId in room.processed_commands:
                    event = room.processed_commands[command.commandId]
                    clients = (sender,)
                else:
                    if command.payload.tokenId != DEMO_TOKEN_ID:
                        return None

                    room.token_x = command.payload.x
                    room.token_y = command.payload.y
                    room.revision += 1
                    event = {
                        "type": "token.moved",
                        "revision": room.revision,
                        "payload": {
                            "tokenId": DEMO_TOKEN_ID,
                            "x": room.token_x,
                            "y": room.token_y,
                        },
                    }
                    room.processed_commands[command.commandId] = event
                    while len(room.processed_commands) > PROCESSED_COMMAND_LIMIT:
                        room.processed_commands.popitem(last=False)
                    clients = tuple(room.clients)

            await self._persist_room(room)
            await self._send_to_clients(room, ((client, event) for client in clients))
            return event

    async def execute_catalog_command(
        self,
        room_id: str,
        sender: ClientConnection,
        command: CatalogCommand,
    ) -> CatalogCommandFailure | None:
        catalog = self.catalog
        room = self._rooms.get(room_id)
        if catalog is None or room is None or not self._room_uses_catalog(room):
            return CatalogCommandFailure("catalog_unavailable", "Catalogo indisponivel")

        message_type = command.type
        fingerprint = _command_fingerprint(command)
        async with room.broadcast_lock:
            async with room.lock:
                previous = room.catalog_commands.get(command.commandId)
                if previous is not None:
                    if (
                        previous.role != sender.role
                        or previous.message_type != message_type
                        or previous.fingerprint != fingerprint
                    ):
                        return CatalogCommandFailure(
                            "command_id_conflict",
                            "commandId ja foi usado por outro comando",
                        )
                    replay = self._catalog_snapshot(
                        room,
                        sender.role,
                        self._connection_uid(sender),
                    )
                    payloads = ((sender, replay),)
                else:
                    failure = self._apply_catalog_mutation(room, sender, command)
                    if failure is not None:
                        return failure
                    room.revision += 1
                    payload_list = [
                        (
                            client,
                            self._catalog_snapshot(
                                room,
                                client.role,
                                self._connection_uid(client),
                            ),
                        )
                        for client in room.clients
                    ]
                    room.catalog_commands[command.commandId] = ProcessedCatalogCommand(
                        role=sender.role,
                        message_type=message_type,
                        fingerprint=fingerprint,
                    )
                    while len(room.catalog_commands) > PROCESSED_COMMAND_LIMIT:
                        room.catalog_commands.popitem(last=False)
                    payloads = tuple(payload_list)

            if previous is None:
                await self._persist_room(room)
                for client, payload in payloads:
                    state = payload.get("state")
                    if client.role != "master" or not isinstance(state, dict):
                        continue
                    if room.persistence_warning is None:
                        state.pop("persistence", None)
                    else:
                        state["persistence"] = {
                            "saved": False,
                            "message": room.persistence_warning,
                        }
            await self._send_to_clients(room, payloads)
        return None

    def _apply_catalog_mutation(
        self,
        room: Room,
        sender: ClientConnection,
        command: CatalogCommand,
    ) -> CatalogCommandFailure | None:
        role = sender.role
        sender_uid = self._connection_uid(sender)
        if isinstance(command, (HandoutDeliverCommand, HandoutRevokeCommand)):
            # A funcao do asset so e consultada depois do papel para impedir
            # que jogadores usem respostas diferentes para sondar o catalogo.
            if role != "master":
                return CatalogCommandFailure(
                    "master_required",
                    "Somente o mestre entrega ou revoga handouts",
                )
            assert self.catalog is not None
            try:
                self.catalog.get_handout_for_delivery(command.payload.assetId)
            except AssetNotAvailableError:
                return CatalogCommandFailure(
                    "handout_not_found",
                    "Handout nao encontrado",
                )
            if isinstance(command, HandoutDeliverCommand):
                room.delivered_handouts.setdefault(
                    command.payload.assetId,
                    datetime.now(UTC).isoformat(),
                )
            else:
                room.delivered_handouts.pop(command.payload.assetId, None)
            return None

        if isinstance(command, FogPresetsApplyAllCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre altera a nevoa")
            applied = 0
            for scene in self._master_scenes():
                if scene.fog_preset is None:
                    continue
                current = room.scene_fog.get(scene.scene_id)
                room.scene_fog[scene.scene_id] = self._fog_state_from_scene(
                    scene,
                    revision=(current.revision + 1 if current is not None else 1),
                    enabled=(current.enabled if current is not None else True),
                )
                applied += 1
            if applied == 0:
                return CatalogCommandFailure(
                    "fog_preset_not_found",
                    "A campanha nao possui setores oficiais de nevoa",
                )
            return None

        if isinstance(command, FogPresetApplyCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre altera a nevoa")
            scene_id = room.active_scene_id or ""
            scene = next(
                (item for item in self._master_scenes() if item.scene_id == scene_id),
                None,
            )
            if scene is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            if scene.fog_preset is None:
                return CatalogCommandFailure(
                    "fog_preset_not_found",
                    "A cena nao possui setores oficiais de nevoa",
                )
            current = room.scene_fog.get(scene_id)
            room.scene_fog[scene_id] = self._fog_state_from_scene(
                scene,
                revision=(current.revision + 1 if current is not None else 1),
                enabled=(current.enabled if current is not None else True),
            )
            return None

        if isinstance(
            command,
            (
                FogStrokeCommand,
                FogSetEnabledCommand,
                FogResetCommand,
                FogRevealAllCommand,
                FogRegionCreateCommand,
                FogRegionUpdateCommand,
                FogRegionSetRevealedCommand,
                FogRegionRemoveCommand,
            ),
        ):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre altera a nevoa")
            scene_id = room.active_scene_id or ""
            fog = room.scene_fog.get(scene_id)
            if fog is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            if isinstance(command, FogSetEnabledCommand):
                fog.enabled = command.payload.enabled
            elif isinstance(command, FogResetCommand):
                fog.reveal_all = False
                for region in fog.regions.values():
                    region.revealed = False
            elif isinstance(command, FogRevealAllCommand):
                fog.reveal_all = True
                for region in fog.regions.values():
                    region.revealed = True
            elif isinstance(command, FogStrokeCommand):
                return CatalogCommandFailure(
                    "fog_regions_required",
                    "O pincel foi substituido por salas e setores",
                )
            elif isinstance(command, (FogRegionCreateCommand, FogRegionUpdateCommand)):
                existing = fog.regions.get(command.payload.regionId)
                if isinstance(command, FogRegionCreateCommand) and existing is not None:
                    return CatalogCommandFailure("fog_region_exists", "A regiao ja existe")
                if isinstance(command, FogRegionUpdateCommand) and existing is None:
                    return CatalogCommandFailure("fog_region_not_found", "Regiao nao encontrada")
                if existing is None and len(fog.regions) >= MAX_FOG_REGIONS_PER_SCENE:
                    return CatalogCommandFailure("fog_region_limit", "Limite de regioes atingido")
                fog.regions[command.payload.regionId] = FogRegion(
                    region_id=command.payload.regionId,
                    label=command.payload.label,
                    points=tuple((point.x, point.y) for point in command.payload.points),
                    revealed=existing.revealed if existing is not None else fog.reveal_all,
                )
            elif isinstance(command, FogRegionSetRevealedCommand):
                if any(region_id not in fog.regions for region_id in command.payload.regionIds):
                    return CatalogCommandFailure("fog_region_not_found", "Regiao nao encontrada")
                for region_id in command.payload.regionIds:
                    fog.regions[region_id].revealed = command.payload.revealed
                # Uma seleção manual nunca deve revelar o espaço fora das regiões.
                # Somente o comando explícito fog.reveal_all abre o mapa inteiro.
                fog.reveal_all = False
            elif isinstance(command, FogRegionRemoveCommand):
                if fog.regions.pop(command.payload.regionId, None) is None:
                    return CatalogCommandFailure("fog_region_not_found", "Regiao nao encontrada")
            fog.revision += 1
            return None

        if isinstance(command, SceneSelectCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre seleciona cenas")
            scene_ids = {scene.scene_id for scene in self._master_scenes()}
            if command.payload.sceneId not in scene_ids:
                return CatalogCommandFailure("scene_not_found", "Cena nao encontrada")
            room.active_scene_id = command.payload.sceneId
            return None

        if isinstance(command, OverlaySetCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre altera overlays")
            overlays = room.scene_overlays.get(room.active_scene_id or "")
            if overlays is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            if command.payload.assetId not in overlays:
                return CatalogCommandFailure("overlay_not_found", "Overlay nao encontrado")
            overlays[command.payload.assetId] = command.payload.enabled
            return None

        if isinstance(command, OverlayUpdateCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre ajusta overlays")
            scene_id = room.active_scene_id or ""
            overlays = room.scene_overlays.get(scene_id)
            if overlays is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            if command.payload.assetId not in overlays:
                return CatalogCommandFailure("overlay_not_found", "Overlay nao encontrado")
            placements = room.scene_overlay_placements.setdefault(scene_id, {})
            placement = placements.setdefault(
                command.payload.assetId,
                CatalogOverlayPlacement(),
            )
            transform_fields = ("x", "y", "width", "height", "rotation")
            if placement.locked and any(
                getattr(command.payload, field_name) is not None
                for field_name in transform_fields
            ):
                return CatalogCommandFailure("overlay_locked", "Destrave o efeito antes de ajustar sua posicao")
            for field_name in transform_fields:
                value = getattr(command.payload, field_name)
                if value is not None:
                    setattr(placement, field_name, value)
            if command.payload.locked is not None:
                placement.locked = command.payload.locked
            return None

        if isinstance(command, SceneLayerSetCommand):
            if role != "master":
                return CatalogCommandFailure(
                    "forbidden", "Somente o mestre altera objetos ancorados"
                )
            scene_id = room.active_scene_id or ""
            layer_states = room.scene_layers.get(scene_id)
            if layer_states is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            scene = next(
                (item for item in self._master_scenes() if item.scene_id == scene_id),
                None,
            )
            layer = next(
                (
                    item
                    for item in (scene.layers if scene is not None else ())
                    if item.layer_id == command.payload.layerId
                ),
                None,
            )
            if layer is None or command.payload.layerId not in layer_states:
                return CatalogCommandFailure(
                    "layer_not_found", "Objeto ancorado nao encontrado nesta cena"
                )
            valid_states = {state.key for state in layer.states}
            if command.payload.state is not None and command.payload.state not in valid_states:
                return CatalogCommandFailure(
                    "layer_state_not_found", "Estado do objeto ancorado nao encontrado"
                )
            layer_states[layer.layer_id] = command.payload.state
            return None

        if isinstance(command, SceneLayerUpdateCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre ajusta objetos ancorados")
            active_scene_id = room.active_scene_id or ""
            scene = next(
                (item for item in self._master_scenes() if item.scene_id == active_scene_id),
                None,
            )
            if scene is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            layer = next(
                (item for item in scene.layers if item.layer_id == command.payload.layerId),
                None,
            )
            selected_key = room.scene_layers.get(active_scene_id, {}).get(command.payload.layerId)
            selected_state = next(
                (state for state in (layer.states if layer is not None else ()) if state.key == selected_key),
                None,
            )
            if selected_state is None:
                return CatalogCommandFailure("layer_state_not_found", "O objeto ancorado nao esta ativo")
            if command.payload.placementIndex >= len(selected_state.placements):
                return CatalogCommandFailure("layer_placement_not_found", "Posicao do objeto ancorado nao existe")

            base = selected_state.placements[command.payload.placementIndex]
            placements = room.scene_layer_placements.setdefault(active_scene_id, {}).setdefault(
                command.payload.layerId,
                {},
            )
            placement = placements.get(command.payload.placementIndex)
            if placement is None:
                placement = CatalogLayerPlacement(
                    x=base.x,
                    y=base.y,
                    width=base.width,
                    height=base.height,
                    rotation=base.rotation,
                )
                placements[command.payload.placementIndex] = placement

            transform_fields = ("x", "y", "width", "height", "rotation")
            changes_transform = any(
                getattr(command.payload, field_name) is not None
                for field_name in transform_fields
            )
            if placement.locked and changes_transform:
                return CatalogCommandFailure("layer_locked", "Destrave o objeto antes de ajustar sua posicao")
            for field_name in transform_fields:
                value = getattr(command.payload, field_name)
                if value is not None:
                    setattr(placement, field_name, value)
            if command.payload.locked is not None:
                placement.locked = command.payload.locked
            return None

        if isinstance(command, TokenSpawnCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre cria tokens")
            if command.payload.controllerUid is not None and room.external_mesa_id is None:
                return CatalogCommandFailure(
                    "integrated_mesa_required",
                    "Controlador individual exige acesso por uma Mesa",
                )
            tokens = room.scene_tokens.get(room.active_scene_id or "")
            if tokens is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            if self._token_count(room) >= MAX_ROOM_TOKENS:
                return CatalogCommandFailure("token_limit", "A sala atingiu o limite de tokens")
            token_id = command.payload.tokenId or self._generated_token_id(command.commandId)
            if any(token_id in scene for scene in room.scene_tokens.values()):
                return CatalogCommandFailure("token_id_conflict", "tokenId ja existe na sala")
            assert self.catalog is not None
            try:
                asset = self.catalog.get_asset(command.payload.assetId, "master")
            except AssetNotAvailableError:
                return CatalogCommandFailure("asset_not_found", "Asset de token indisponivel")
            if asset.kind != "token":
                return CatalogCommandFailure("asset_not_token", "Asset nao e um token")
            tokens[token_id] = CatalogToken(
                token_id=token_id,
                asset_id=command.payload.assetId,
                x=command.payload.x,
                y=command.payload.y,
                label=command.payload.label,
                size=command.payload.size,
                movable=(
                    command.payload.movable
                    and (
                        asset.controlled_by == "players"
                        or command.payload.controllerUid is not None
                    )
                ),
                visible=command.payload.visible,
                controller_uid=command.payload.controllerUid,
            )
            return None

        if isinstance(command, TokenAssignCommand):
            if role != "master":
                return CatalogCommandFailure(
                    "master_required",
                    "Somente o mestre atribui tokens",
                )
            if room.external_mesa_id is None:
                return CatalogCommandFailure(
                    "integrated_mesa_required",
                    "Controlador individual exige acesso por uma Mesa",
                )
            tokens = room.scene_tokens.get(room.active_scene_id or "")
            if tokens is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            token = tokens.get(command.payload.tokenId)
            if token is None:
                return CatalogCommandFailure("token_not_found", "Token nao encontrado")
            assert self.catalog is not None
            asset = self.catalog.get_asset(token.asset_id, "master")
            token.controller_uid = command.payload.controllerUid
            token.movable = bool(command.payload.controllerUid) or asset.controlled_by == "players"
            return None

        if isinstance(command, PropSpawnCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre cria objetos")
            props = room.scene_props.get(room.active_scene_id or "")
            if props is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            if self._prop_count(room) >= MAX_ROOM_PROPS:
                return CatalogCommandFailure("prop_limit", "A sala atingiu o limite de objetos")
            prop_id = command.payload.propId or self._generated_prop_id(command.commandId)
            if any(prop_id in scene for scene in room.scene_props.values()):
                return CatalogCommandFailure("prop_id_conflict", "propId ja existe na sala")
            assert self.catalog is not None
            try:
                asset = self.catalog.get_asset(command.payload.assetId, "master")
            except AssetNotAvailableError:
                return CatalogCommandFailure("asset_not_found", "Objeto de cenario indisponivel")
            if asset.kind != "prop":
                return CatalogCommandFailure("asset_not_prop", "Asset nao e objeto de cenario")
            props[prop_id] = CatalogProp(
                prop_id=prop_id,
                asset_id=command.payload.assetId,
                x=command.payload.x,
                y=command.payload.y,
                label=command.payload.label,
                width=command.payload.width,
                height=command.payload.height,
                rotation=command.payload.rotation,
                visible=command.payload.visible,
                locked=command.payload.locked,
            )
            return None

        if isinstance(command, (PropUpdateCommand, PropRemoveCommand)):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre altera objetos")
            props = room.scene_props.get(room.active_scene_id or "")
            if props is None:
                return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")
            prop = props.get(command.payload.propId)
            if prop is None:
                return CatalogCommandFailure("prop_not_found", "Objeto nao encontrado")
            if isinstance(command, PropRemoveCommand):
                props.pop(prop.prop_id)
                return None

            assert isinstance(command, PropUpdateCommand)
            transform_fields = ("x", "y", "width", "height", "rotation")
            if prop.locked and any(
                getattr(command.payload, field_name) is not None
                for field_name in transform_fields
            ):
                return CatalogCommandFailure("prop_locked", "Destrave o objeto antes de ajustar sua posicao")
            if command.payload.assetId is not None:
                assert self.catalog is not None
                try:
                    asset = self.catalog.get_asset(command.payload.assetId, "master")
                except AssetNotAvailableError:
                    return CatalogCommandFailure("asset_not_found", "Objeto de cenario indisponivel")
                if asset.kind != "prop":
                    return CatalogCommandFailure("asset_not_prop", "Asset nao e objeto de cenario")
                if not self.catalog.can_swap_prop_asset(
                    prop.asset_id,
                    command.payload.assetId,
                ):
                    return CatalogCommandFailure(
                        "prop_state_mismatch",
                        "O visual escolhido nao pertence aos estados deste objeto",
                    )
                prop.asset_id = command.payload.assetId
            for field_name in ("label", "x", "y", "width", "height", "rotation", "visible", "locked"):
                value = getattr(command.payload, field_name)
                if value is not None:
                    setattr(prop, field_name, value)
            return None

        tokens = room.scene_tokens.get(room.active_scene_id or "")
        if tokens is None:
            return CatalogCommandFailure("no_active_scene", "Nao ha cena ativa")

        if isinstance(command, TokenRemoveCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre remove tokens")
            if command.payload.tokenId not in tokens:
                return CatalogCommandFailure("token_not_found", "Token nao encontrado")
            tokens.pop(command.payload.tokenId)
            return None

        if isinstance(command, MoveCommand):
            token = tokens.get(command.payload.tokenId)
            if token is None:
                return CatalogCommandFailure("token_not_found", "Token nao encontrado")
            if role == "player":
                active_scene_id = room.active_scene_id or ""
                if (
                    not token.movable
                    or not self._token_visible_to_player(room, active_scene_id, token)
                ):
                    return CatalogCommandFailure("token_forbidden", "Token nao pode ser movido")
                assert self.catalog is not None
                try:
                    self.catalog.get_asset(token.asset_id, "player")
                except AssetNotAvailableError:
                    return CatalogCommandFailure("token_forbidden", "Token nao pode ser movido")
                if room.external_mesa_id is not None and (
                    sender_uid is None or token.controller_uid != sender_uid
                ):
                    return CatalogCommandFailure("token_forbidden", "Token nao pode ser movido")
            token.x = command.payload.x
            token.y = command.payload.y
            return None

        return CatalogCommandFailure("unknown_message_type", "Comando desconhecido")

    async def _persist_room(self, room: Room) -> bool:
        if self._store is None:
            room.persistence_warning = None
            return True
        payload = self._serialize_room(room)
        try:
            await asyncio.to_thread(self._store.save, payload)
        except Exception as error:
            room.persistence_warning = (
                "A sessao continua ativa, mas a ultima alteracao nao foi salva no armazenamento."
            )
            warnings.warn(
                f"Nao foi possivel persistir a sala {room.room_id}: {error}",
                RuntimeWarning,
                stacklevel=2,
            )
            return False
        room.persistence_warning = None
        return True

    @staticmethod
    def _serialize_room(room: Room) -> dict[str, Any]:
        scene_ids = (
            set(room.scene_tokens)
            | set(room.scene_props)
            | set(room.scene_overlays)
            | set(room.scene_overlay_placements)
            | set(room.scene_layers)
            | set(room.scene_layer_placements)
            | set(room.scene_fog)
        )
        scenes: dict[str, Any] = {}
        for scene_id in sorted(scene_ids):
            fog = room.scene_fog.get(scene_id, FogState())
            scenes[scene_id] = {
                "tokens": [
                    {
                        "tokenId": token.token_id,
                        "assetId": token.asset_id,
                        "x": token.x,
                        "y": token.y,
                        "label": token.label,
                        "size": token.size,
                        "movable": token.movable,
                        "visible": token.visible,
                        "controllerUid": token.controller_uid,
                    }
                    for token in sorted(
                        room.scene_tokens.get(scene_id, {}).values(),
                        key=lambda item: item.token_id,
                    )
                ],
                "props": [
                    {
                        "propId": prop.prop_id,
                        "assetId": prop.asset_id,
                        "x": prop.x,
                        "y": prop.y,
                        "label": prop.label,
                        "width": prop.width,
                        "height": prop.height,
                        "rotation": prop.rotation,
                        "visible": prop.visible,
                        "locked": prop.locked,
                    }
                    for prop in sorted(
                        room.scene_props.get(scene_id, {}).values(),
                        key=lambda item: item.prop_id,
                    )
                ],
                "overlays": dict(sorted(room.scene_overlays.get(scene_id, {}).items())),
                "overlayPlacements": {
                    asset_id: {
                        "x": placement.x,
                        "y": placement.y,
                        "width": placement.width,
                        "height": placement.height,
                        "rotation": placement.rotation,
                        "locked": placement.locked,
                    }
                    for asset_id, placement in sorted(
                        room.scene_overlay_placements.get(scene_id, {}).items()
                    )
                },
                "layers": dict(sorted(room.scene_layers.get(scene_id, {}).items())),
                "layerPlacements": {
                    layer_id: [
                        {
                            "placementIndex": placement_index,
                            "x": placement.x,
                            "y": placement.y,
                            "width": placement.width,
                            "height": placement.height,
                            "rotation": placement.rotation,
                            "locked": placement.locked,
                        }
                        for placement_index, placement in sorted(placements.items())
                    ]
                    for layer_id, placements in sorted(
                        room.scene_layer_placements.get(scene_id, {}).items()
                    )
                },
                "fog": {
                    "enabled": fog.enabled,
                    "revision": fog.revision,
                    "mapAssetId": fog.map_asset_id,
                    "mapFingerprint": fog.map_fingerprint,
                    "revealAll": fog.reveal_all,
                    "regions": [
                        {
                            "regionId": region.region_id,
                            "label": region.label,
                            "points": [
                                {"x": x, "y": y} for x, y in region.points
                            ],
                            "revealed": region.revealed,
                        }
                        for region in sorted(
                            fog.regions.values(), key=lambda item: item.region_id
                        )
                    ],
                },
            }
        return {
            "schemaVersion": 1,
            "roomId": room.room_id,
            "name": room.name,
            "campaignId": room.campaign_id,
            "externalMesaId": room.external_mesa_id,
            "masterInviteDigest": room.master_invite_digest.hex(),
            "playerInviteDigest": room.player_invite_digest.hex(),
            "revision": room.revision,
            "demo": {"tokenX": room.token_x, "tokenY": room.token_y},
            "activeSceneId": room.active_scene_id,
            "deliveredHandouts": [
                {"assetId": asset_id, "deliveredAt": delivered_at}
                for asset_id, delivered_at in sorted(room.delivered_handouts.items())
            ],
            "scenes": scenes,
            "catalogCommands": [
                {
                    "commandId": command_id,
                    "role": processed.role,
                    "messageType": processed.message_type,
                    "fingerprint": processed.fingerprint,
                }
                for command_id, processed in room.catalog_commands.items()
            ],
        }

    def _restore_rooms(self) -> None:
        assert self._store is not None
        for stored_room_id, payload in self._store.load_all():
            if not self.supports_campaign(payload.get("campaignId")):
                # Keep rooms from another campaign intact for a later matching launch.
                continue
            try:
                if payload.get("roomId") != stored_room_id:
                    raise ValueError("roomId diverge da chave persistida")
                room = self._deserialize_room(payload)
            except (TypeError, ValueError, binascii.Error, CampaignCatalogError) as error:
                warnings.warn(
                    f"Sala persistida invalida foi ignorada: {error}",
                    RuntimeWarning,
                    stacklevel=2,
                )
                self._store.quarantine(stored_room_id, payload, str(error))
                continue
            if room.room_id in self._rooms:
                warnings.warn(
                    f"Sala persistida duplicada foi ignorada: {room.room_id}",
                    RuntimeWarning,
                    stacklevel=2,
                )
                self._store.quarantine(stored_room_id, payload, "roomId duplicado")
                continue
            external_id = room.external_mesa_id
            if external_id is not None and external_id in self._external_rooms:
                warnings.warn(
                    f"externalMesaId persistido duplicado foi ignorado: {external_id}",
                    RuntimeWarning,
                    stacklevel=2,
                )
                self._store.quarantine(
                    stored_room_id, payload, "externalMesaId duplicado"
                )
                continue
            self._rooms[room.room_id] = room
            if external_id is not None:
                self._external_rooms[external_id] = room.room_id

    def _deserialize_room(self, payload: dict[str, Any]) -> Room:
        if payload.get("schemaVersion") != 1:
            raise ValueError("schemaVersion de sala desconhecido")
        room_id = payload.get("roomId")
        if (
            not isinstance(room_id, str)
            or len(room_id) != 8
            or any(character not in ROOM_ALPHABET for character in room_id)
        ):
            raise ValueError("roomId invalido")
        name = payload.get("name")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
            raise ValueError("nome de sala invalido")

        campaign_id = payload.get("campaignId")
        if campaign_id is not None and not isinstance(campaign_id, str):
            raise ValueError("campaignId invalido")
        if not self.supports_campaign(campaign_id):
            raise ValueError("sala pertence a outra campanha")

        external_id = payload.get("externalMesaId")
        if external_id is not None:
            if (
                not isinstance(external_id, str)
                or not 1 <= len(external_id) <= 128
                or any(
                    not (character.isascii() and (character.isalnum() or character in "_-"))
                    for character in external_id
                )
            ):
                raise ValueError("externalMesaId invalido")

        master_digest = self._decode_invite_digest(payload.get("masterInviteDigest"))
        player_digest = self._decode_invite_digest(payload.get("playerInviteDigest"))
        revision = self._nonnegative_int(payload.get("revision"), "revision")
        room = Room(
            room_id=room_id,
            name=name.strip(),
            master_invite_digest=master_digest,
            player_invite_digest=player_digest,
            campaign_id=campaign_id,
            external_mesa_id=external_id,
            revision=revision,
        )

        demo = payload.get("demo", {})
        if not isinstance(demo, dict):
            raise ValueError("estado demo invalido")
        room.token_x = self._normalised_float(demo.get("tokenX", 0.5), "tokenX")
        room.token_y = self._normalised_float(demo.get("tokenY", 0.5), "tokenY")

        if not self._room_uses_catalog(room):
            return room

        self._initialize_catalog_room(room)
        room.delivered_handouts = self._deserialize_delivered_handouts(
            payload.get("deliveredHandouts", [])
        )
        scenes_payload = payload.get("scenes", {})
        if not isinstance(scenes_payload, dict):
            raise ValueError("cenas persistidas invalidas")
        total_tokens = 0
        total_props = 0
        scene_by_id = {scene.scene_id: scene for scene in self._master_scenes()}
        scene_maps = {
            scene_id: (
                scene.active_player_map,
                self._map_fingerprint(scene.active_player_map),
            )
            for scene_id, scene in scene_by_id.items()
        }
        layer_target_by_asset = {
            state.asset_id: (scene.scene_id, layer.layer_id, state.key)
            for scene in scene_by_id.values()
            for layer in scene.layers
            for state in layer.states
        }
        for scene_id in tuple(room.scene_tokens):
            raw_scene = scenes_payload.get(scene_id, {})
            if not isinstance(raw_scene, dict):
                raise ValueError("estado de cena invalido")

            raw_overlays = raw_scene.get("overlays", {})
            if not isinstance(raw_overlays, dict):
                raise ValueError("overlays persistidos invalidos")
            for asset_id in tuple(room.scene_overlays[scene_id]):
                enabled = raw_overlays.get(asset_id, False)
                if not isinstance(enabled, bool):
                    raise ValueError("estado de overlay invalido")
                room.scene_overlays[scene_id][asset_id] = enabled

            raw_overlay_placements = raw_scene.get("overlayPlacements", {})
            if not isinstance(raw_overlay_placements, dict):
                raise ValueError("ajustes de overlays persistidos invalidos")
            for asset_id, raw_placement in raw_overlay_placements.items():
                if asset_id not in room.scene_overlays[scene_id]:
                    continue
                room.scene_overlay_placements[scene_id][asset_id] = (
                    self._deserialize_overlay_placement(raw_placement)
                )

            raw_layers = raw_scene.get("layers", {})
            if not isinstance(raw_layers, dict):
                raise ValueError("layers persistidos invalidos")
            scene = scene_by_id[scene_id]
            layer_by_id = {layer.layer_id: layer for layer in scene.layers}
            for layer_id, layer in layer_by_id.items():
                if layer_id not in raw_layers:
                    continue
                selected_state = raw_layers[layer_id]
                if selected_state is not None and (
                    not isinstance(selected_state, str)
                    or selected_state not in {state.key for state in layer.states}
                ):
                    raise ValueError("estado de layer persistido invalido")
                room.scene_layers[scene_id][layer_id] = selected_state

            raw_layer_placements = raw_scene.get("layerPlacements", {})
            if not isinstance(raw_layer_placements, dict):
                raise ValueError("ajustes de layers persistidos invalidos")
            for layer_id, raw_placements in raw_layer_placements.items():
                if layer_id not in layer_by_id or not isinstance(raw_placements, list):
                    continue
                restored: dict[int, CatalogLayerPlacement] = {}
                for raw_placement in raw_placements:
                    placement_index, placement = self._deserialize_layer_placement(raw_placement)
                    restored[placement_index] = placement
                if restored:
                    room.scene_layer_placements[scene_id][layer_id] = restored

            raw_tokens = raw_scene.get("tokens", [])
            if not isinstance(raw_tokens, list):
                raise ValueError("tokens persistidos invalidos")
            for raw_token in raw_tokens:
                try:
                    token = self._deserialize_token(raw_token)
                except (AssetNotAvailableError, PersistedAssetObsoleteError):
                    warnings.warn(
                        "Token persistido com asset obsoleto foi ignorado",
                        RuntimeWarning,
                        stacklevel=2,
                    )
                    continue
                if token.token_id in room.scene_tokens[scene_id]:
                    raise ValueError("tokenId persistido duplicado")
                total_tokens += 1
                if total_tokens > MAX_ROOM_TOKENS:
                    raise ValueError("limite de tokens persistidos excedido")
                room.scene_tokens[scene_id][token.token_id] = token

            raw_props = raw_scene.get("props", [])
            if not isinstance(raw_props, list):
                raise ValueError("objetos persistidos invalidos")
            migrated_layer_ids: set[str] = set()
            for raw_prop in raw_props:
                raw_asset_id = (
                    raw_prop.get("assetId") if isinstance(raw_prop, dict) else None
                )
                layer_target = layer_target_by_asset.get(raw_asset_id or "")
                if layer_target is not None:
                    target_scene_id, layer_id, state_key = layer_target
                    if target_scene_id == scene_id:
                        if (
                            layer_id not in raw_layers
                            and layer_id not in migrated_layer_ids
                        ):
                            room.scene_layers[scene_id][layer_id] = (
                                None if raw_prop.get("visible") is False else state_key
                            )
                            migrated_layer_ids.add(layer_id)
                    else:
                        warnings.warn(
                            "Objeto persistido de layer em cena incorreta foi ignorado",
                            RuntimeWarning,
                            stacklevel=2,
                        )
                    # Assets promovidos a layers deixam de existir como props livres.
                    continue
                try:
                    prop = self._deserialize_prop(raw_prop)
                except (AssetNotAvailableError, PersistedAssetObsoleteError):
                    warnings.warn(
                        "Objeto persistido com asset obsoleto foi ignorado",
                        RuntimeWarning,
                        stacklevel=2,
                    )
                    continue
                if prop.prop_id in room.scene_props[scene_id]:
                    raise ValueError("propId persistido duplicado")
                total_props += 1
                if total_props > MAX_ROOM_PROPS:
                    raise ValueError("limite de objetos persistidos excedido")
                room.scene_props[scene_id][prop.prop_id] = prop

            raw_fog = raw_scene.get("fog")
            if raw_fog is not None:
                room.scene_fog[scene_id] = self._deserialize_fog(
                    raw_fog,
                    *(scene_maps.get(scene_id) or (None, None)),
                    scene_by_id[scene_id],
                )

        active_scene_id = payload.get("activeSceneId")
        if active_scene_id is not None:
            if isinstance(active_scene_id, str) and active_scene_id in room.scene_tokens:
                room.active_scene_id = active_scene_id
            else:
                warnings.warn(
                    "Cena ativa persistida nao existe mais; primeira cena atual foi usada",
                    RuntimeWarning,
                    stacklevel=2,
                )

        raw_commands = payload.get("catalogCommands", [])
        if not isinstance(raw_commands, list):
            raise ValueError("historico de comandos invalido")
        for item in raw_commands[-PROCESSED_COMMAND_LIMIT:]:
            if not isinstance(item, dict):
                raise ValueError("comando persistido invalido")
            command_id = item.get("commandId")
            role = item.get("role")
            message_type = item.get("messageType")
            fingerprint = item.get("fingerprint")
            if (
                not isinstance(command_id, str)
                or not 1 <= len(command_id) <= 100
                or role not in {"master", "player"}
                or not isinstance(message_type, str)
                or not isinstance(fingerprint, str)
                or len(fingerprint) != 64
                or any(character not in string.hexdigits for character in fingerprint)
            ):
                raise ValueError("historico de comandos invalido")
            room.catalog_commands[command_id] = ProcessedCatalogCommand(
                role=role,
                message_type=message_type,
                fingerprint=fingerprint.lower(),
            )
        return room

    def _deserialize_delivered_handouts(self, payload: Any) -> dict[str, str]:
        if not isinstance(payload, list):
            raise ValueError("handouts entregues persistidos invalidos")
        assert self.catalog is not None
        available = {
            asset.asset_id for asset in self.catalog.list_handouts("master")
        }
        if len(payload) > max(1024, len(available)):
            raise ValueError("limite de handouts entregues persistidos excedido")
        delivered: dict[str, str] = {}
        for item in payload:
            if not isinstance(item, dict) or set(item) != {"assetId", "deliveredAt"}:
                raise ValueError("handout entregue persistido invalido")
            asset_id = item.get("assetId")
            delivered_at = item.get("deliveredAt")
            if (
                not isinstance(asset_id, str)
                or not 7 <= len(asset_id) <= 2048
                or not asset_id.startswith("asset:")
                or any(character in asset_id for character in "\x00\r\n")
                or not isinstance(delivered_at, str)
                or not 1 <= len(delivered_at) <= 64
            ):
                raise ValueError("handout entregue persistido invalido")
            try:
                timestamp = datetime.fromisoformat(delivered_at)
            except ValueError as error:
                raise ValueError("data de entrega persistida invalida") from error
            if timestamp.tzinfo is None:
                raise ValueError("data de entrega persistida sem fuso horario")
            if asset_id not in available:
                warnings.warn(
                    "Handout entregue com asset obsoleto foi ignorado",
                    RuntimeWarning,
                    stacklevel=2,
                )
                continue
            # Duplicatas nao ampliam acesso. A primeira entrega valida vence.
            delivered.setdefault(
                asset_id,
                timestamp.astimezone(UTC).isoformat(),
            )
        return delivered

    def _deserialize_token(self, payload: Any) -> CatalogToken:
        if not isinstance(payload, dict):
            raise ValueError("token persistido invalido")
        token_id = payload.get("tokenId")
        asset_id = payload.get("assetId")
        label = payload.get("label")
        size = payload.get("size")
        movable = payload.get("movable")
        visible = payload.get("visible")
        controller_uid = payload.get("controllerUid")
        if (
            not isinstance(token_id, str)
            or not 1 <= len(token_id) <= 64
            or not token_id[0].isalnum()
            or any(not (character.isalnum() or character in "._:-") for character in token_id)
            or not isinstance(asset_id, str)
            or not isinstance(label, str)
            or not 1 <= len(label.strip()) <= 80
            or any(ord(character) < 32 for character in label)
            or not isinstance(movable, bool)
            or not isinstance(visible, bool)
            or (
                controller_uid is not None
                and (
                    not isinstance(controller_uid, str)
                    or not 1 <= len(controller_uid.strip()) <= 128
                    or any(ord(character) < 32 for character in controller_uid)
                )
            )
        ):
            raise ValueError("token persistido invalido")
        if isinstance(size, bool) or not isinstance(size, (int, float)):
            raise ValueError("tamanho de token invalido")
        size_float = float(size)
        if not math.isfinite(size_float) or not 0.01 <= size_float <= 0.25:
            raise ValueError("tamanho de token invalido")
        assert self.catalog is not None
        asset = self.catalog.get_asset(asset_id, "master")
        if asset.kind != "token":
            raise PersistedAssetObsoleteError("asset persistido nao e mais token")
        return CatalogToken(
            token_id=token_id,
            asset_id=asset_id,
            x=self._normalised_float(payload.get("x"), "token.x"),
            y=self._normalised_float(payload.get("y"), "token.y"),
            label=label.strip(),
            size=size_float,
            movable=movable and (
                asset.controlled_by == "players" or controller_uid is not None
            ),
            visible=visible,
            controller_uid=(
                controller_uid.strip() if isinstance(controller_uid, str) else None
            ),
        )

    def _deserialize_prop(self, payload: Any) -> CatalogProp:
        if not isinstance(payload, dict):
            raise ValueError("objeto persistido invalido")
        prop_id = payload.get("propId")
        asset_id = payload.get("assetId")
        label = payload.get("label")
        visible = payload.get("visible")
        locked = payload.get("locked", True)
        if (
            not isinstance(prop_id, str)
            or not 1 <= len(prop_id) <= 64
            or not prop_id[0].isalnum()
            or any(not (character.isalnum() or character in "._:-") for character in prop_id)
            or not isinstance(asset_id, str)
            or not isinstance(label, str)
            or not 1 <= len(label.strip()) <= 80
            or any(ord(character) < 32 for character in label)
            or not isinstance(visible, bool)
            or not isinstance(locked, bool)
        ):
            raise ValueError("objeto persistido invalido")
        assert self.catalog is not None
        asset = self.catalog.get_asset(asset_id, "master")
        if asset.kind != "prop":
            raise PersistedAssetObsoleteError(
                "asset persistido nao e mais objeto de cenario"
            )
        return CatalogProp(
            prop_id=prop_id,
            asset_id=asset_id,
            x=self._normalised_float(payload.get("x"), "prop.x"),
            y=self._normalised_float(payload.get("y"), "prop.y"),
            label=label.strip(),
            width=self._bounded_float(payload.get("width"), 0.01, 0.8, "prop.width"),
            height=self._bounded_float(payload.get("height"), 0.01, 0.8, "prop.height"),
            rotation=self._bounded_float(
                payload.get("rotation"), -360, 360, "prop.rotation"
            ),
            visible=visible,
            locked=locked,
        )

    def _deserialize_layer_placement(
        self,
        payload: Any,
    ) -> tuple[int, CatalogLayerPlacement]:
        if not isinstance(payload, dict):
            raise ValueError("ajuste de layer persistido invalido")
        placement_index = payload.get("placementIndex")
        locked = payload.get("locked", True)
        if not isinstance(placement_index, int) or not 0 <= placement_index <= 63 or not isinstance(locked, bool):
            raise ValueError("ajuste de layer persistido invalido")
        return placement_index, CatalogLayerPlacement(
            x=self._normalised_float(payload.get("x"), "layer.x"),
            y=self._normalised_float(payload.get("y"), "layer.y"),
            width=self._bounded_float(payload.get("width"), 0.01, 1, "layer.width"),
            height=self._bounded_float(payload.get("height"), 0.01, 1, "layer.height"),
            rotation=self._bounded_float(payload.get("rotation"), -360, 360, "layer.rotation"),
            locked=locked,
        )

    def _deserialize_overlay_placement(self, payload: Any) -> CatalogOverlayPlacement:
        if not isinstance(payload, dict):
            raise ValueError("ajuste de overlay persistido invalido")
        locked = payload.get("locked", True)
        if not isinstance(locked, bool):
            raise ValueError("ajuste de overlay persistido invalido")
        return CatalogOverlayPlacement(
            x=self._normalised_float(payload.get("x"), "overlay.x"),
            y=self._normalised_float(payload.get("y"), "overlay.y"),
            width=self._bounded_float(payload.get("width"), 0.01, 1, "overlay.width"),
            height=self._bounded_float(payload.get("height"), 0.01, 1, "overlay.height"),
            rotation=self._bounded_float(payload.get("rotation"), -360, 360, "overlay.rotation"),
            locked=locked,
        )

    def _deserialize_fog(
        self,
        payload: Any,
        expected_map_asset_id: str | None,
        expected_map_fingerprint: str | None,
        scene: SceneView,
    ) -> FogState:
        if not isinstance(payload, dict):
            raise ValueError("fog persistido invalido")
        enabled = payload.get("enabled")
        if not isinstance(enabled, bool):
            raise ValueError("fog.enabled invalido")
        revision = VTTService._nonnegative_int(payload.get("revision"), "fog.revision")
        persisted_map_asset_id = payload.get("mapAssetId")
        persisted_map_fingerprint = payload.get("mapFingerprint")
        if (
            persisted_map_asset_id != expected_map_asset_id
            or persisted_map_fingerprint != expected_map_fingerprint
        ):
            warnings.warn(
                "Mapa da cena mudou; a nevoa foi fechada e reiniciada por seguranca",
                RuntimeWarning,
                stacklevel=2,
            )
            replacement = self._fog_state_from_scene(
                scene,
                revision=0,
                enabled=enabled,
            )
            replacement.map_asset_id = expected_map_asset_id
            replacement.map_fingerprint = expected_map_fingerprint
            return replacement
        raw_regions = payload.get("regions")
        if raw_regions is None:
            if "maskBase64" in payload:
                warnings.warn(
                    "Mascara antiga de nevoa foi migrada para tudo oculto",
                    RuntimeWarning,
                    stacklevel=2,
                )
            raw_regions = []
        if not isinstance(raw_regions, list) or len(raw_regions) > MAX_FOG_REGIONS_PER_SCENE:
            raise ValueError("regioes de fog invalidas")
        regions: dict[str, FogRegion] = {}
        for raw_region in raw_regions:
            if not isinstance(raw_region, dict):
                raise ValueError("regiao de fog invalida")
            region_id = raw_region.get("regionId")
            label = raw_region.get("label")
            revealed = raw_region.get("revealed", False)
            raw_points = raw_region.get("points")
            if (
                not isinstance(region_id, str)
                or not 1 <= len(region_id) <= 64
                or not region_id[0].isalnum()
                or any(not (character.isalnum() or character in "._:-") for character in region_id)
                or region_id in regions
                or not isinstance(label, str)
                or not 1 <= len(label.strip()) <= 80
                or any(ord(character) < 32 for character in label)
                or not isinstance(revealed, bool)
                or not isinstance(raw_points, list)
                or not 3 <= len(raw_points) <= 64
            ):
                raise ValueError("regiao de fog invalida")
            points = tuple(
                (
                    VTTService._normalised_float(point.get("x"), "fog.region.x"),
                    VTTService._normalised_float(point.get("y"), "fog.region.y"),
                )
                for point in raw_points
                if isinstance(point, dict)
            )
            if len(points) != len(raw_points) or len(set(points)) < 3:
                raise ValueError("pontos da regiao de fog invalidos")
            regions[region_id] = FogRegion(region_id, label.strip(), points, revealed)
        reveal_all = payload.get("revealAll", False)
        if not isinstance(reveal_all, bool):
            raise ValueError("fog.revealAll invalido")
        return FogState(
            enabled=enabled,
            revision=revision,
            map_asset_id=expected_map_asset_id,
            map_fingerprint=expected_map_fingerprint,
            reveal_all=reveal_all,
            regions=regions,
        )

    @staticmethod
    def _decode_invite_digest(value: Any) -> bytes:
        if not isinstance(value, str) or len(value) != 64:
            raise ValueError("digest de convite invalido")
        digest = bytes.fromhex(value)
        if len(digest) != 32:
            raise ValueError("digest de convite invalido")
        return digest

    @staticmethod
    def _nonnegative_int(value: Any, label: str) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"{label} invalido")
        return value

    @staticmethod
    def _normalised_float(value: Any, label: str) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{label} invalido")
        result = float(value)
        if not math.isfinite(result) or not 0 <= result <= 1:
            raise ValueError(f"{label} invalido")
        return result

    @staticmethod
    def _bounded_float(value: Any, minimum: float, maximum: float, label: str) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{label} invalido")
        result = float(value)
        if not math.isfinite(result) or not minimum <= result <= maximum:
            raise ValueError(f"{label} invalido")
        return result

    def room_exists(self, room_id: str) -> bool:
        return room_id in self._rooms

    def room_uses_integrated_access(self, room_id: str) -> bool:
        room = self._rooms.get(room_id)
        return room is not None and room.external_mesa_id is not None

    def _new_room_id(self) -> str:
        while True:
            room_id = "".join(secrets.choice(ROOM_ALPHABET) for _ in range(8))
            if room_id not in self._rooms:
                return room_id

    def _purge_expired_access(self, now: datetime) -> None:
        expired_challenges = [
            challenge
            for challenge, pending in self._mesa_challenges.items()
            if pending.expires_at <= now
        ]
        for challenge in expired_challenges:
            self._mesa_challenges.pop(challenge, None)
        expired_tickets = [
            (token, grant.media_digest)
            for token, grant in self._tickets.items()
            if grant.expires_at <= now
            or self._mesa_session_inactive(grant.mesa_session, now)
        ]
        for token, media_digest in expired_tickets:
            self._tickets.pop(token, None)
            self._media_grants.pop(media_digest, None)
        expired_media = [
            token
            for token, grant in self._media_grants.items()
            if grant.expires_at <= now
            or self._mesa_session_inactive(grant.mesa_session, now)
        ]
        for token in expired_media:
            self._media_grants.pop(token, None)

    @staticmethod
    def _mesa_session_inactive(
        session: MesaSession | None,
        now: datetime,
    ) -> bool:
        return bool(session is not None and (session.revoked or session.expires_at <= now))

    @staticmethod
    def _connection_uid(connection: ClientConnection) -> str | None:
        session = connection.mesa_session
        return session.uid if session is not None else None

    async def _revoke_media_digests(self, digests: Iterable[bytes]) -> None:
        async with self._access_lock:
            for digest in digests:
                self._media_grants.pop(digest, None)

    async def _send_to_clients(
        self,
        room: Room,
        payloads: Any,
    ) -> None:
        deliveries = tuple(payloads)

        async def deliver(
            client: ClientConnection,
            payload: dict[str, Any],
        ) -> ClientConnection | None:
            try:
                await asyncio.wait_for(
                    client.send(payload),
                    timeout=CLIENT_SEND_TIMEOUT_SECONDS,
                )
            except Exception:
                return client
            return None

        stale = [
            client
            for client in await asyncio.gather(
                *(deliver(client, payload) for client, payload in deliveries)
            )
            if client is not None
        ]
        if stale:
            async with room.lock:
                for client in stale:
                    room.clients.discard(client)
            await self._revoke_media_digests(
                client.media_digest for client in stale
            )

    def _snapshot(
        self,
        room: Room,
        role: Role,
        uid: str | None = None,
    ) -> dict[str, Any]:
        if not self._room_uses_catalog(room):
            return self._demo_snapshot(room, role)
        return self._catalog_snapshot(room, role, uid)

    @staticmethod
    def _demo_snapshot(room: Room, role: Role) -> dict[str, Any]:
        return {
            "type": "room.snapshot",
            "protocolVersion": PROTOCOL_VERSION,
            "roomId": room.room_id,
            "role": role,
            "revision": room.revision,
            "state": {
                "tokens": {
                    DEMO_TOKEN_ID: {
                        "id": DEMO_TOKEN_ID,
                        "x": room.token_x,
                        "y": room.token_y,
                        "label": "Agente de teste",
                    }
                }
            },
        }

    def _catalog_snapshot(
        self,
        room: Room,
        role: Role,
        uid: str | None = None,
    ) -> dict[str, Any]:
        assert self._room_uses_catalog(room)
        scenes = self.catalog.list_scenes(role)
        scene_by_id = {scene.scene_id: scene for scene in scenes}
        active_scene = scene_by_id.get(room.active_scene_id or "")
        tokens: dict[str, dict[str, Any]] = {}
        props: dict[str, dict[str, Any]] = {}
        if active_scene is not None:
            for token in room.scene_tokens.get(active_scene.scene_id, {}).values():
                if role == "player" and not self._token_visible_to_player(
                    room, active_scene.scene_id, token
                ):
                    continue
                try:
                    asset = self.catalog.get_asset(token.asset_id, role)
                except AssetNotAvailableError:
                    continue
                tokens[token.token_id] = {
                    "id": token.token_id,
                    "assetId": token.asset_id,
                    "x": token.x,
                    "y": token.y,
                    "label": token.label,
                    "size": token.size,
                    "movable": (
                        token.movable
                        and (
                            role == "master"
                            or room.external_mesa_id is None
                            or token.controller_uid == uid
                        )
                    ),
                    "visible": token.visible,
                }
                if role == "master":
                    tokens[token.token_id]["controllerUid"] = token.controller_uid
            active_fog = room.scene_fog.get(active_scene.scene_id)
            for prop in room.scene_props.get(active_scene.scene_id, {}).values():
                if role == "player" and not self._prop_visible_to_player(
                    room, active_scene.scene_id, prop
                ):
                    continue
                try:
                    self.catalog.get_asset(prop.asset_id, role)
                except AssetNotAvailableError:
                    continue
                props[prop.prop_id] = {
                    "id": prop.prop_id,
                    "assetId": prop.asset_id,
                    "x": prop.x,
                    "y": prop.y,
                    "label": prop.label,
                    "width": prop.width,
                    "height": prop.height,
                    "rotation": prop.rotation,
                    "visible": prop.visible,
                    "locked": prop.locked,
                }

        delivered_handouts: list[dict[str, Any]] = []
        for asset_id, delivered_at in sorted(room.delivered_handouts.items()):
            try:
                asset = self.catalog.get_handout_for_delivery(asset_id)
            except AssetNotAvailableError:
                continue
            delivered_handouts.append(
                self._handout_payload(asset, delivered_at=delivered_at)
            )

        state: dict[str, Any] = {
            "scene": (
                self._active_scene_payload(room, active_scene, role)
                if active_scene is not None
                else None
            ),
            "tokens": tokens,
            "props": props,
            "fog": self._fog_payload(room, active_scene, role),
            "deliveredHandouts": delivered_handouts,
        }
        if role == "master":
            state["table"] = {
                "name": room.name,
                "campaignId": room.campaign_id,
                "externalMesaId": room.external_mesa_id,
            }
            state["catalog"] = {
                "scenes": [
                    {
                        "id": scene.scene_id,
                        "key": scene.key,
                        "label": self._humanize(scene.key),
                    }
                    for scene in scenes
                ],
                "tokenAssets": [
                    {
                        "assetId": asset.asset_id,
                        "label": self._asset_label(asset.asset_id),
                    }
                    for asset in self.catalog.list_tokens("master")
                ],
                "propAssets": [
                    {
                        "assetId": asset.asset_id,
                        "label": self._asset_label(asset.asset_id),
                    }
                    for asset in self.catalog.list_props("master")
                ],
                "propStateGroups": [
                    {
                        "id": group.group_id,
                        "key": group.key,
                        "label": self._humanize(group.key),
                        "states": [
                            {
                                "name": state.name,
                                "label": self._humanize(state.name),
                                "assetId": state.asset_id,
                                "version": state.version,
                                "variants": [
                                    {
                                        "assetId": variant.asset_id,
                                        "version": variant.version,
                                    }
                                    for variant in state.variants
                                ],
                            }
                            for state in group.states
                        ],
                    }
                    for group in self.catalog.list_prop_state_groups("master")
                ],
                "masterReferenceAssets": [
                    self._master_reference_payload(asset)
                    for asset in self.catalog.list_master_references("master")
                ],
                "handoutAssets": [
                    self._handout_payload(
                        asset,
                        delivered_at=room.delivered_handouts.get(asset.asset_id),
                    )
                    for asset in self.catalog.list_handouts("master")
                ],
            }
            if room.persistence_warning is not None:
                state["persistence"] = {
                    "saved": False,
                    "message": room.persistence_warning,
                }

        return {
            "type": "room.snapshot",
            "protocolVersion": PROTOCOL_VERSION,
            "roomId": room.room_id,
            "role": role,
            "revision": room.revision,
            "state": state,
        }

    def _handout_payload(
        self,
        asset: AssetView,
        *,
        delivered_at: str | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "assetId": asset.asset_id,
            "label": self._asset_label(asset.asset_id),
            "mediaType": asset.media_type,
            "deliveredAt": delivered_at,
        }
        if asset.image is not None:
            payload["image"] = {
                "width": asset.image.width,
                "height": asset.image.height,
            }
        return payload

    def _master_reference_payload(self, asset: AssetView) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "assetId": asset.asset_id,
            "label": self._asset_label(asset.asset_id),
            "mediaType": asset.media_type,
        }
        if asset.image is not None:
            payload["image"] = {
                "width": asset.image.width,
                "height": asset.image.height,
            }
        return payload

    def _active_scene_payload(
        self,
        room: Room,
        scene: SceneView,
        role: Role,
    ) -> dict[str, Any]:
        assert self._room_uses_catalog(room)
        states = room.scene_overlays.get(scene.scene_id, {})
        overlay_placements = room.scene_overlay_placements.get(scene.scene_id, {})
        selected_layers = room.scene_layers.get(scene.scene_id, {})
        placement_overrides = room.scene_layer_placements.get(scene.scene_id, {})
        fog = room.scene_fog.get(scene.scene_id)
        map_id = scene.active_player_map
        if map_id is None and role == "master":
            map_id = scene.active_gm_guide_map
        map_payload: dict[str, Any] | None = None
        if map_id is not None:
            map_asset = self.catalog.get_asset(map_id, role)
            map_payload = {
                "assetId": map_id,
                "width": map_asset.image.width if map_asset.image is not None else None,
                "height": map_asset.image.height if map_asset.image is not None else None,
            }
        layers_payload: list[dict[str, Any]] = []
        for layer in scene.layers:
            selected_key = selected_layers.get(layer.layer_id)
            selected_state = next(
                (state for state in layer.states if state.key == selected_key),
                None,
            )
            if role == "player" and selected_state is None:
                continue
            layer_payload: dict[str, Any] = {
                "id": layer.layer_id,
                "key": layer.key,
                "label": layer.label,
                "state": selected_state.key if selected_state is not None else None,
                "assetId": selected_state.asset_id if selected_state is not None else None,
                "placements": [
                    {
                        "x": override.x if override is not None else placement.x,
                        "y": override.y if override is not None else placement.y,
                        "width": override.width if override is not None else placement.width,
                        "height": override.height if override is not None else placement.height,
                        "rotation": override.rotation if override is not None else placement.rotation,
                        **(
                            {"locked": override.locked if override is not None else True}
                            if role == "master"
                            else {}
                        ),
                    }
                    for placement_index, placement in enumerate(
                        selected_state.placements if selected_state is not None else ()
                    )
                    for override in (
                        placement_overrides.get(layer.layer_id, {}).get(placement_index),
                    )
                ],
            }
            if role == "master":
                layer_payload["options"] = [
                    {"key": state.key, "label": state.label}
                    for state in layer.states
                ]
            layers_payload.append(layer_payload)

        payload = {
            "id": scene.scene_id,
            "key": scene.key,
            "label": self._humanize(scene.key),
            "map": map_payload,
            "overlays": [
                {
                    "assetId": item.asset_id,
                    "name": item.name,
                    "label": self._humanize(item.name),
                    "enabled": states.get(item.asset_id, False),
                    "placement": {
                        "x": overlay_placements.get(item.asset_id, CatalogOverlayPlacement()).x,
                        "y": overlay_placements.get(item.asset_id, CatalogOverlayPlacement()).y,
                        "width": overlay_placements.get(item.asset_id, CatalogOverlayPlacement()).width,
                        "height": overlay_placements.get(item.asset_id, CatalogOverlayPlacement()).height,
                        "rotation": overlay_placements.get(item.asset_id, CatalogOverlayPlacement()).rotation,
                        **(
                            {"locked": overlay_placements.get(item.asset_id, CatalogOverlayPlacement()).locked}
                            if role == "master"
                            else {}
                        ),
                    },
                }
                for item in scene.overlays
                if role == "master" or states.get(item.asset_id, False)
            ],
            "gridHint": (
                {
                    "type": scene.grid_hint.grid_type,
                    "columns": scene.grid_hint.columns,
                    "rows": scene.grid_hint.rows,
                }
                if scene.grid_hint is not None
                else None
            ),
        }
        if role == "master" and scene.fog_preset is not None:
            payload["fogPreset"] = {
                "revision": scene.fog_preset.revision,
                "regionCount": len(scene.fog_preset.regions),
            }
        if scene.layers:
            payload["layers"] = layers_payload
        if role == "master":
            guide_id = scene.active_gm_guide_map
            guide_payload: dict[str, Any] | None = None
            if guide_id is not None:
                guide_asset = self.catalog.get_asset(guide_id, "master")
                guide_payload = {
                    "assetId": guide_id,
                    "width": (
                        guide_asset.image.width
                        if guide_asset.image is not None
                        else None
                    ),
                    "height": (
                        guide_asset.image.height
                        if guide_asset.image is not None
                        else None
                    ),
                }
            payload["gmGuideMap"] = guide_payload
        return payload

    @staticmethod
    def _fog_payload(
        room: Room,
        scene: SceneView | None,
        role: Role,
    ) -> dict[str, Any] | None:
        if scene is None:
            return None
        fog = room.scene_fog.get(scene.scene_id)
        if fog is None:
            return None
        payload: dict[str, Any] = {
            "enabled": fog.enabled,
            "revision": fog.revision,
            "mode": "regions",
            "revealAll": fog.reveal_all,
            "regions": [
                ({
                    "regionId": region.region_id,
                    "points": [{"x": x, "y": y} for x, y in region.points],
                    "revealed": region.revealed,
                } | ({"label": region.label} if role == "master" else {}))
                for region in sorted(fog.regions.values(), key=lambda item: item.region_id)
                if role == "master" or region.revealed
            ],
        }
        return payload

    @staticmethod
    def _fog_reveals_point(fog: FogState, x: float, y: float) -> bool:
        if not fog.enabled:
            return True
        if fog.reveal_all:
            return True
        return any(
            region.revealed
            and VTTService._point_in_polygon(x, y, region.points)
            for region in fog.regions.values()
        )

    @staticmethod
    def _point_in_polygon(
        x: float,
        y: float,
        points: tuple[tuple[float, float], ...],
    ) -> bool:
        inside = False
        previous_x, previous_y = points[-1]
        for current_x, current_y in points:
            if (current_y > y) != (previous_y > y):
                crossing_x = (
                    ((previous_x - current_x) * (y - current_y))
                    / (previous_y - current_y)
                ) + current_x
                if x < crossing_x:
                    inside = not inside
            previous_x, previous_y = current_x, current_y
        return inside

    @classmethod
    def _token_visible_to_player(
        cls,
        room: Room,
        scene_id: str,
        token: CatalogToken,
    ) -> bool:
        if not token.visible:
            return False
        fog = room.scene_fog.get(scene_id)
        if fog is None:
            return True

        # A visibilidade não pode depender apenas do centro da peça: o retrato e
        # principalmente a etiqueta ficam fora desse ponto e poderiam denunciar
        # um token ainda coberto pela névoa. Exigimos que toda a pegada visual
        # essencial esteja em uma região revelada antes de enviá-la ao jogador.
        half_size = max(0.0, token.size / 2)
        label_drop = max(token.size, half_size)
        footprint = (
            (token.x, token.y),
            (token.x - half_size, token.y - half_size),
            (token.x + half_size, token.y - half_size),
            (token.x - half_size, token.y + half_size),
            (token.x + half_size, token.y + half_size),
            (token.x - token.size, token.y + label_drop),
            (token.x, token.y + label_drop),
            (token.x + token.size, token.y + label_drop),
        )
        return all(cls._fog_reveals_point(fog, x, y) for x, y in footprint)

    @classmethod
    def _prop_visible_to_player(
        cls,
        room: Room,
        scene_id: str,
        prop: CatalogProp,
    ) -> bool:
        if not prop.visible:
            return False
        fog = room.scene_fog.get(scene_id)
        return fog is None or cls._fog_reveals_point(fog, prop.x, prop.y)

    def _master_scenes(self) -> tuple[SceneView, ...]:
        assert self.catalog is not None
        return self.catalog.list_scenes("master")

    @staticmethod
    def _token_count(room: Room) -> int:
        return sum(len(tokens) for tokens in room.scene_tokens.values())

    @staticmethod
    def _prop_count(room: Room) -> int:
        return sum(len(props) for props in room.scene_props.values())

    @staticmethod
    def _generated_token_id(command_id: str) -> str:
        digest = hashlib.sha256(command_id.encode("utf-8")).hexdigest()[:20]
        return f"token-{digest}"

    @staticmethod
    def _generated_prop_id(command_id: str) -> str:
        digest = hashlib.sha256(command_id.encode("utf-8")).hexdigest()[:20]
        return f"prop-{digest}"

    @staticmethod
    def _humanize(value: str) -> str:
        words = value.replace("_", " ").replace("-", " ").split()
        return " ".join(word[:1].upper() + word[1:] for word in words)

    @classmethod
    def _asset_label(cls, asset_id: str) -> str:
        filename = asset_id.rsplit("/", 1)[-1]
        stem = filename.rsplit(".", 1)[0]
        stem = re.sub(
            r"-(?:(?:token|objeto)-vtt|handout)-v\d+$",
            "",
            stem,
            flags=re.IGNORECASE,
        )
        stem = re.sub(r"-v\d+$", "", stem, flags=re.IGNORECASE)
        return cls._humanize(stem)
