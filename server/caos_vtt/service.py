from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import io
import json
import math
import re
import secrets
import string
import time
import warnings
import zlib
from collections import OrderedDict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import WebSocket
from PIL import Image, ImageDraw

from .campaign import (
    AssetNotAvailableError,
    CampaignCatalog,
    CampaignCatalogError,
    SceneView,
)
from .models import (
    FogResetCommand,
    FogRevealAllCommand,
    FogSetEnabledCommand,
    FogStrokeCommand,
    MoveCommand,
    OverlaySetCommand,
    PropRemoveCommand,
    PropSpawnCommand,
    PropUpdateCommand,
    Role,
    SceneLayerSetCommand,
    SceneSelectCommand,
    TokenRemoveCommand,
    TokenSpawnCommand,
)
from .storage import RoomStateStore


PROTOCOL_VERSION = 1
DEMO_TOKEN_ID = "demo-token"
ROOM_ALPHABET = string.ascii_uppercase + string.digits
MEDIA_TOKEN_TTL_SECONDS = 12 * 60 * 60
DEFAULT_MAX_PENDING_TICKETS_PER_ROOM = 32
DEFAULT_MAX_MEDIA_GRANTS_PER_ROOM = 64
MAX_ROOM_TOKENS = 256
MAX_ROOM_PROPS = 128
PROCESSED_COMMAND_LIMIT = 256
CLIENT_SEND_TIMEOUT_SECONDS = 5.0
FOG_MASK_SIZE = 256
FOG_RENDER_CACHE_LIMIT = 8
MAX_FOG_RENDER_PIXELS = 40_000_000

CatalogCommand = (
    MoveCommand
    | SceneSelectCommand
    | OverlaySetCommand
    | SceneLayerSetCommand
    | TokenSpawnCommand
    | TokenRemoveCommand
    | PropSpawnCommand
    | PropUpdateCommand
    | PropRemoveCommand
    | FogStrokeCommand
    | FogSetEnabledCommand
    | FogResetCommand
    | FogRevealAllCommand
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
    """Ephemeral proof tying an integrated VTT grant to one Mesa member.

    The Firebase token intentionally lives only in memory. It is never included
    in room snapshots or persistence and is discarded as soon as the session is
    revoked.
    """

    room_id: str
    mesa_id: str
    uid: str
    role: Role
    id_token: str = field(repr=False)
    last_verified_at: float = field(default_factory=time.monotonic)
    transient_failures: int = 0
    revoked: bool = False
    verification_lock: asyncio.Lock = field(
        default_factory=asyncio.Lock,
        repr=False,
    )


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


@dataclass(slots=True)
class FogState:
    enabled: bool = True
    revision: int = 0
    render_revision: int = 0
    map_asset_id: str | None = None
    map_fingerprint: str | None = None
    mask: bytearray = field(
        default_factory=lambda: bytearray(FOG_MASK_SIZE * FOG_MASK_SIZE)
    )


@dataclass(frozen=True, slots=True)
class RenderedFogMap:
    content: bytes
    media_type: str
    revision: int


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
    scene_layers: dict[str, dict[str, str | None]] = field(default_factory=dict)
    scene_fog: dict[str, FogState] = field(default_factory=dict)
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
    ) -> None:
        self.ticket_ttl_seconds = ticket_ttl_seconds
        self.media_ttl_seconds = MEDIA_TOKEN_TTL_SECONDS
        self.max_pending_tickets_per_room = max_pending_tickets_per_room
        self.max_media_grants_per_room = max_media_grants_per_room
        self.catalog = catalog
        self._rooms: dict[str, Room] = {}
        self._external_rooms: dict[str, str] = {}
        self._tickets: dict[str, TicketGrant] = {}
        self._media_grants: dict[bytes, MediaGrant] = {}
        self._map_fingerprint_cache: dict[str, str] = {}
        self._fog_render_cache: OrderedDict[tuple[Any, ...], RenderedFogMap] = OrderedDict()
        self._fog_render_inflight: dict[
            tuple[Any, ...], asyncio.Task[RenderedFogMap]
        ] = {}
        self._fog_cache_lock = asyncio.Lock()
        self._rooms_lock = asyncio.Lock()
        self._access_lock = asyncio.Lock()
        self._store = RoomStateStore(state_db_path) if state_db_path is not None else None
        if self._store is not None:
            self._restore_rooms()

    @property
    def has_catalog(self) -> bool:
        return self.catalog is not None

    async def create_room(
        self,
        name: str,
        *,
        campaign_id: str | None = None,
        external_mesa_id: str | None = None,
    ) -> tuple[Room, str, str]:
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
                    campaign_id=campaign_id
                    or (self.catalog.campaign_id if self.catalog else None),
                    external_mesa_id=external_mesa_id,
                )
                if self.catalog is not None:
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
        assert self.catalog is not None
        scenes = self.catalog.list_scenes("master")
        for scene in scenes:
            room.scene_tokens[scene.scene_id] = {}
            room.scene_props[scene.scene_id] = {}
            room.scene_overlays[scene.scene_id] = {
                overlay.asset_id: False for overlay in scene.overlays
            }
            room.scene_layers[scene.scene_id] = {
                layer.layer_id: layer.default_state for layer in scene.layers
            }
            room.scene_fog[scene.scene_id] = FogState(
                map_asset_id=scene.active_player_map,
                map_fingerprint=self._map_fingerprint(scene.active_player_map),
            )
        room.active_scene_id = scenes[0].scene_id if scenes else None

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
        id_token: str,
    ) -> IssuedAccess | None:
        room = self._rooms.get(room_id)
        if room is None or room.external_mesa_id != mesa_id:
            return None
        mesa_session = MesaSession(
            room_id=room_id,
            mesa_id=mesa_id,
            uid=uid,
            role=role,
            id_token=id_token,
        )
        return await self._issue_access(room, role, mesa_session=mesa_session)

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
        ticket_grant = TicketGrant(
            room_id=room.room_id,
            role=role,
            expires_at=now + timedelta(seconds=self.ticket_ttl_seconds),
            media_digest=media_digest,
            mesa_session=mesa_session,
        )
        media_grant = MediaGrant(
            room_id=room.room_id,
            role=role,
            expires_at=now + timedelta(seconds=self.media_ttl_seconds),
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
            ticket_expires_in=self.ticket_ttl_seconds,
            media_token=media_token,
            media_expires_in=self.media_ttl_seconds,
        )

    async def consume_ticket(self, room_id: str, ticket: str) -> TicketGrant | None:
        async with self._access_lock:
            now = datetime.now(UTC)
            self._purge_expired_access(now)
            grant = self._tickets.pop(ticket, None)
            if grant is not None and (
                grant.room_id != room_id
                or grant.expires_at <= now
                or (grant.mesa_session is not None and grant.mesa_session.revoked)
            ):
                self._media_grants.pop(grant.media_digest, None)
        if (
            grant is None
            or grant.room_id != room_id
            or grant.expires_at <= now
            or (grant.mesa_session is not None and grant.mesa_session.revoked)
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
            or (grant.mesa_session is not None and grant.mesa_session.revoked)
            or room_id not in self._rooms
        ):
            return None
        return grant

    async def revoke_mesa_session(self, session: MesaSession) -> None:
        """Revoke every ephemeral credential/socket backed by one Firebase proof."""

        session.revoked = True
        session.id_token = ""
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
        """Restrict player media to assets currently revealed in the active scene."""
        catalog = self.catalog
        room = self._rooms.get(room_id)
        if catalog is None or room is None:
            return False
        if role == "master":
            return True

        async with room.lock:
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
                if fog is not None and fog.enabled:
                    return False
                selected_layers = room.scene_layers.get(active_scene_id, {})
                return any(
                    selected_layers.get(layer.layer_id) == state.key
                    and state.asset_id == asset_id
                    for layer in scene.layers
                    for state in layer.states
                )
            if fog is not None and fog.enabled:
                if scene.active_player_map == asset_id:
                    return False
                if any(overlay.asset_id == asset_id for overlay in scene.overlays):
                    return False
                if any(
                    prop.asset_id == asset_id
                    for prop in room.scene_props.get(active_scene_id, {}).values()
                ):
                    return False
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

    async def render_player_fog_map(
        self,
        room_id: str,
        role: Role,
    ) -> RenderedFogMap | None:
        """Render the active player map server-side without exposing raw layers."""

        catalog = self.catalog
        room = self._rooms.get(room_id)
        if catalog is None or room is None or role != "player":
            return None

        async with room.lock:
            scene_id = room.active_scene_id
            fog = room.scene_fog.get(scene_id or "")
            if scene_id is None or fog is None or not fog.enabled:
                return None
            scene = next(
                (item for item in catalog.list_scenes("player") if item.scene_id == scene_id),
                None,
            )
            if scene is None or scene.active_player_map is None:
                return None
            overlay_states = room.scene_overlays.get(scene_id, {})
            overlay_ids = tuple(
                overlay.asset_id
                for overlay in scene.overlays
                if overlay_states.get(overlay.asset_id, False)
            )
            prop_layers: list[tuple[str, float, float, float, float, float]] = []
            for prop in room.scene_props.get(scene_id, {}).values():
                if not prop.visible:
                    continue
                try:
                    catalog.get_asset(prop.asset_id, "player")
                except AssetNotAvailableError:
                    continue
                prop_layers.append(
                    (
                        prop.asset_id,
                        prop.x,
                        prop.y,
                        prop.width,
                        prop.height,
                        prop.rotation,
                    )
                )
            scene_layer_items: list[tuple[str, float, float, float, float, float]] = []
            selected_layers = room.scene_layers.get(scene_id, {})
            for layer in scene.layers:
                selected_state = selected_layers.get(layer.layer_id)
                state = next(
                    (item for item in layer.states if item.key == selected_state),
                    None,
                )
                if state is None:
                    continue
                for placement in state.placements:
                    scene_layer_items.append(
                        (
                            state.asset_id,
                            placement.x,
                            placement.y,
                            placement.width,
                            placement.height,
                            placement.rotation,
                        )
                    )
            mask = bytes(fog.mask)
            render_revision = fog.render_revision
            map_id = scene.active_player_map

        prop_signature = tuple(prop_layers)
        scene_layer_signature = tuple(scene_layer_items)
        cache_key = (
            room_id,
            scene_id,
            render_revision,
            map_id,
            overlay_ids,
            prop_signature,
            scene_layer_signature,
        )
        async with self._fog_cache_lock:
            cached = self._fog_render_cache.get(cache_key)
            if cached is not None:
                self._fog_render_cache.move_to_end(cache_key)
                return cached
            task = self._fog_render_inflight.get(cache_key)
            if task is None:
                task = asyncio.create_task(
                    asyncio.to_thread(
                        self._render_player_fog_map_sync,
                        map_id,
                        overlay_ids,
                        prop_signature,
                        scene_layer_signature,
                        mask,
                        render_revision,
                    )
                )
                self._fog_render_inflight[cache_key] = task
                task.add_done_callback(
                    lambda completed, key=cache_key: asyncio.create_task(
                        self._finish_fog_render(key, completed)
                    )
                )
        try:
            rendered = await asyncio.shield(task)
        except (CampaignCatalogError, OSError, ValueError):
            return None
        async with room.lock:
            current_fog = room.scene_fog.get(scene_id)
            if (
                room.active_scene_id != scene_id
                or current_fog is None
                or not current_fog.enabled
                or current_fog.render_revision != rendered.revision
            ):
                return None
        return rendered

    async def _finish_fog_render(
        self,
        cache_key: tuple[Any, ...],
        task: asyncio.Task[RenderedFogMap],
    ) -> None:
        try:
            rendered = task.result()
        except (CampaignCatalogError, OSError, ValueError, asyncio.CancelledError):
            rendered = None
        async with self._fog_cache_lock:
            if self._fog_render_inflight.get(cache_key) is task:
                self._fog_render_inflight.pop(cache_key, None)
            if rendered is not None:
                self._fog_render_cache[cache_key] = rendered
                self._fog_render_cache.move_to_end(cache_key)
                while len(self._fog_render_cache) > FOG_RENDER_CACHE_LIMIT:
                    self._fog_render_cache.popitem(last=False)

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
                    snapshot = self._snapshot(room, role)
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

        if self.catalog is not None:
            return None
        room = self._rooms.get(room_id)
        if room is None:
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
        if catalog is None or room is None:
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
                    replay = self._catalog_snapshot(room, sender.role)
                    payloads = ((sender, replay),)
                else:
                    failure = self._apply_catalog_mutation(room, sender.role, command)
                    if failure is not None:
                        return failure
                    room.revision += 1
                    payload_list = [
                        (client, self._catalog_snapshot(room, client.role))
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
        role: Role,
        command: CatalogCommand,
    ) -> CatalogCommandFailure | None:
        if isinstance(
            command,
            (FogStrokeCommand, FogSetEnabledCommand, FogResetCommand, FogRevealAllCommand),
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
                fog.mask[:] = b"\x00" * len(fog.mask)
            elif isinstance(command, FogRevealAllCommand):
                fog.mask[:] = b"\xff" * len(fog.mask)
            else:
                self._apply_fog_stroke(fog, command)
            fog.revision += 1
            self._mark_scene_render_dirty(room, scene_id)
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
            self._mark_scene_render_dirty(room, room.active_scene_id or "")
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
            self._mark_scene_render_dirty(room, scene_id)
            return None

        if isinstance(command, TokenSpawnCommand):
            if role != "master":
                return CatalogCommandFailure("forbidden", "Somente o mestre cria tokens")
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
                    and asset.controlled_by == "players"
                ),
                visible=command.payload.visible,
            )
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
            )
            self._mark_scene_render_dirty(room, room.active_scene_id or "")
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
                self._mark_scene_render_dirty(room, room.active_scene_id or "")
                return None

            assert isinstance(command, PropUpdateCommand)
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
            for field_name in ("label", "x", "y", "width", "height", "rotation", "visible"):
                value = getattr(command.payload, field_name)
                if value is not None:
                    setattr(prop, field_name, value)
            self._mark_scene_render_dirty(room, room.active_scene_id or "")
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
                "A sessao continua ativa, mas a ultima alteracao nao foi salva no disco."
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
            | set(room.scene_layers)
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
                    }
                    for prop in sorted(
                        room.scene_props.get(scene_id, {}).values(),
                        key=lambda item: item.prop_id,
                    )
                ],
                "overlays": dict(sorted(room.scene_overlays.get(scene_id, {}).items())),
                "layers": dict(sorted(room.scene_layers.get(scene_id, {}).items())),
                "fog": {
                    "enabled": fog.enabled,
                    "revision": fog.revision,
                    "renderRevision": fog.render_revision,
                    "mapAssetId": fog.map_asset_id,
                    "mapFingerprint": fog.map_fingerprint,
                    "maskBase64": base64.b64encode(bytes(fog.mask)).decode("ascii"),
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
            expected_campaign = self.catalog.campaign_id if self.catalog is not None else None
            if payload.get("campaignId") != expected_campaign:
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
        expected_campaign = self.catalog.campaign_id if self.catalog is not None else None
        if campaign_id != expected_campaign:
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

        if self.catalog is None:
            return room

        self._initialize_catalog_room(room)
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

    def _deserialize_token(self, payload: Any) -> CatalogToken:
        if not isinstance(payload, dict):
            raise ValueError("token persistido invalido")
        token_id = payload.get("tokenId")
        asset_id = payload.get("assetId")
        label = payload.get("label")
        size = payload.get("size")
        movable = payload.get("movable")
        visible = payload.get("visible")
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
            movable=movable and asset.controlled_by == "players",
            visible=visible,
        )

    def _deserialize_prop(self, payload: Any) -> CatalogProp:
        if not isinstance(payload, dict):
            raise ValueError("objeto persistido invalido")
        prop_id = payload.get("propId")
        asset_id = payload.get("assetId")
        label = payload.get("label")
        visible = payload.get("visible")
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
        )

    @staticmethod
    def _deserialize_fog(
        payload: Any,
        expected_map_asset_id: str | None,
        expected_map_fingerprint: str | None,
    ) -> FogState:
        if not isinstance(payload, dict):
            raise ValueError("fog persistido invalido")
        enabled = payload.get("enabled")
        if not isinstance(enabled, bool):
            raise ValueError("fog.enabled invalido")
        revision = VTTService._nonnegative_int(payload.get("revision"), "fog.revision")
        render_revision = VTTService._nonnegative_int(
            payload.get("renderRevision", revision), "fog.renderRevision"
        )
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
            return FogState(
                map_asset_id=expected_map_asset_id,
                map_fingerprint=expected_map_fingerprint,
            )
        encoded = payload.get("maskBase64")
        if not isinstance(encoded, str) or len(encoded) > 100_000:
            raise ValueError("mascara de fog invalida")
        mask = base64.b64decode(encoded, validate=True)
        if len(mask) != FOG_MASK_SIZE * FOG_MASK_SIZE:
            raise ValueError("dimensoes da mascara de fog invalidas")
        return FogState(
            enabled=enabled,
            revision=revision,
            render_revision=render_revision,
            map_asset_id=expected_map_asset_id,
            map_fingerprint=expected_map_fingerprint,
            mask=bytearray(mask),
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
        expired_tickets = [
            (token, grant.media_digest)
            for token, grant in self._tickets.items()
            if grant.expires_at <= now
        ]
        for token, media_digest in expired_tickets:
            self._tickets.pop(token, None)
            self._media_grants.pop(media_digest, None)
        expired_media = [
            token for token, grant in self._media_grants.items() if grant.expires_at <= now
        ]
        for token in expired_media:
            self._media_grants.pop(token, None)

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

    def _snapshot(self, room: Room, role: Role) -> dict[str, Any]:
        if self.catalog is None:
            return self._demo_snapshot(room, role)
        return self._catalog_snapshot(room, role)

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

    def _catalog_snapshot(self, room: Room, role: Role) -> dict[str, Any]:
        assert self.catalog is not None
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
                    "movable": token.movable,
                    "visible": token.visible,
                }
            active_fog = room.scene_fog.get(active_scene.scene_id)
            compose_props_for_player = (
                role == "player" and active_fog is not None and active_fog.enabled
            )
            if not compose_props_for_player:
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
                    }

        state: dict[str, Any] = {
            "scene": (
                self._active_scene_payload(room, active_scene, role)
                if active_scene is not None
                else None
            ),
            "tokens": tokens,
            "props": props,
            "fog": self._fog_payload(room, active_scene, role),
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

    def _active_scene_payload(
        self,
        room: Room,
        scene: SceneView,
        role: Role,
    ) -> dict[str, Any]:
        assert self.catalog is not None
        states = room.scene_overlays.get(scene.scene_id, {})
        selected_layers = room.scene_layers.get(scene.scene_id, {})
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
        compose_layers_for_player = (
            role == "player" and fog is not None and fog.enabled
        )
        if not compose_layers_for_player:
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
                    "assetId": (
                        selected_state.asset_id if selected_state is not None else None
                    ),
                    "placements": [
                        {
                            "x": placement.x,
                            "y": placement.y,
                            "width": placement.width,
                            "height": placement.height,
                            "rotation": placement.rotation,
                        }
                        for placement in (
                            selected_state.placements if selected_state is not None else ()
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
                }
                for item in scene.overlays
                if role == "master"
                or (
                    states.get(item.asset_id, False)
                    and not (fog is not None and fog.enabled)
                )
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
    def _apply_fog_stroke(fog: FogState, command: FogStrokeCommand) -> None:
        image = Image.frombytes("L", (FOG_MASK_SIZE, FOG_MASK_SIZE), bytes(fog.mask))
        draw = ImageDraw.Draw(image)
        points = [
            (
                round(point.x * (FOG_MASK_SIZE - 1)),
                round(point.y * (FOG_MASK_SIZE - 1)),
            )
            for point in command.payload.points
        ]
        radius = max(1, round(command.payload.radius * (FOG_MASK_SIZE - 1)))
        fill = 255 if command.payload.reveal else 0
        if len(points) > 1:
            draw.line(points, fill=fill, width=(radius * 2) + 1, joint="curve")
        for x, y in points:
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)
        fog.mask[:] = image.tobytes()

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
            "renderRevision": fog.render_revision,
            "width": FOG_MASK_SIZE,
            "height": FOG_MASK_SIZE,
        }
        if role == "master":
            compressed = zlib.compress(bytes(fog.mask), level=6)
            payload.update(
                {
                    "encoding": "zlib-base64",
                    "data": base64.b64encode(compressed).decode("ascii"),
                }
            )
        return payload

    @staticmethod
    def _fog_reveals_point(fog: FogState, x: float, y: float) -> bool:
        if not fog.enabled:
            return True
        pixel_x = min(FOG_MASK_SIZE - 1, max(0, round(x * (FOG_MASK_SIZE - 1))))
        pixel_y = min(FOG_MASK_SIZE - 1, max(0, round(y * (FOG_MASK_SIZE - 1))))
        return fog.mask[(pixel_y * FOG_MASK_SIZE) + pixel_x] >= 128

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
        return fog is None or cls._fog_reveals_point(fog, token.x, token.y)

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

    def _discard_fog_cache(self, room_id: str, scene_id: str) -> None:
        for key in tuple(self._fog_render_cache):
            if key[0] == room_id and key[1] == scene_id:
                self._fog_render_cache.pop(key, None)

    def _mark_scene_render_dirty(self, room: Room, scene_id: str) -> None:
        fog = room.scene_fog.get(scene_id)
        if fog is None:
            return
        fog.render_revision += 1
        self._discard_fog_cache(room.room_id, scene_id)

    def _render_player_fog_map_sync(
        self,
        map_id: str,
        overlay_ids: tuple[str, ...],
        prop_layers: tuple[tuple[str, float, float, float, float, float], ...],
        scene_layers: tuple[tuple[str, float, float, float, float, float], ...],
        mask: bytes,
        render_revision: int,
    ) -> RenderedFogMap:
        assert self.catalog is not None
        with self.catalog.open_asset(map_id, "player") as opened:
            with Image.open(opened.stream) as source:
                source.load()
                width, height = source.size
                if width <= 0 or height <= 0 or width * height > MAX_FOG_RENDER_PIXELS:
                    raise ValueError("Dimensoes do mapa excedem o limite de renderizacao")
                composed = source.convert("RGBA")

        for asset_id, x, y, relative_width, relative_height, rotation in (
            scene_layers + prop_layers
        ):
            with self.catalog.open_asset(asset_id, "player") as opened:
                with Image.open(opened.stream) as prop_source:
                    prop_source.load()
                    prop_image = prop_source.convert("RGBA")
            target_size = (
                max(1, round(width * relative_width)),
                max(1, round(height * relative_height)),
            )
            prop_image = prop_image.resize(target_size, Image.Resampling.LANCZOS)
            if rotation:
                prop_image = prop_image.rotate(
                    -rotation,
                    resample=Image.Resampling.BICUBIC,
                    expand=True,
                )
            composed.alpha_composite(
                prop_image,
                dest=(
                    round((x * width) - (prop_image.width / 2)),
                    round((y * height) - (prop_image.height / 2)),
                ),
            )

        for overlay_id in overlay_ids:
            with self.catalog.open_asset(overlay_id, "player") as opened:
                with Image.open(opened.stream) as overlay_source:
                    overlay_source.load()
                    overlay = overlay_source.convert("RGBA")
            if overlay.size != composed.size:
                overlay = overlay.resize(composed.size, Image.Resampling.LANCZOS)
            composed.alpha_composite(overlay)

        reveal_mask = Image.frombytes(
            "L", (FOG_MASK_SIZE, FOG_MASK_SIZE), mask
        ).resize(composed.size, Image.Resampling.NEAREST)
        background = Image.new("RGB", composed.size, (3, 5, 7))
        flattened = Image.new("RGB", composed.size, (3, 5, 7))
        flattened.paste(composed, mask=composed.getchannel("A"))
        rendered_image = Image.composite(flattened, background, reveal_mask)
        output = io.BytesIO()
        rendered_image.save(output, format="WEBP", quality=90, method=2)
        return RenderedFogMap(
            content=output.getvalue(),
            media_type="image/webp",
            revision=render_revision,
        )

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
        stem = re.sub(r"-(?:token|objeto)-vtt-v\d+$", "", stem, flags=re.IGNORECASE)
        return cls._humanize(stem)
