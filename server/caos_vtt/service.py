from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
import string
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import WebSocket

from .campaign import AssetNotAvailableError, CampaignCatalog, SceneView
from .models import (
    MoveCommand,
    OverlaySetCommand,
    Role,
    SceneSelectCommand,
    TokenRemoveCommand,
    TokenSpawnCommand,
)


PROTOCOL_VERSION = 1
DEMO_TOKEN_ID = "demo-token"
ROOM_ALPHABET = string.ascii_uppercase + string.digits
MEDIA_TOKEN_TTL_SECONDS = 12 * 60 * 60
MAX_ROOM_TOKENS = 256
PROCESSED_COMMAND_LIMIT = 256
CLIENT_SEND_TIMEOUT_SECONDS = 5.0

CatalogCommand = (
    MoveCommand
    | SceneSelectCommand
    | OverlaySetCommand
    | TokenSpawnCommand
    | TokenRemoveCommand
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
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload: dict[str, Any]) -> None:
        async with self.send_lock:
            await self.websocket.send_json(payload)


@dataclass(frozen=True, slots=True)
class TicketGrant:
    room_id: str
    role: Role
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class MediaGrant:
    room_id: str
    role: Role
    expires_at: datetime


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
class Room:
    room_id: str
    name: str
    master_invite_digest: bytes
    player_invite_digest: bytes
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
    scene_overlays: dict[str, dict[str, bool]] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    broadcast_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class VTTService:
    def __init__(
        self,
        *,
        ticket_ttl_seconds: int,
        catalog: CampaignCatalog | None = None,
    ) -> None:
        self.ticket_ttl_seconds = ticket_ttl_seconds
        self.media_ttl_seconds = MEDIA_TOKEN_TTL_SECONDS
        self.catalog = catalog
        self._rooms: dict[str, Room] = {}
        self._tickets: dict[str, TicketGrant] = {}
        self._media_grants: dict[bytes, MediaGrant] = {}
        self._rooms_lock = asyncio.Lock()
        self._access_lock = asyncio.Lock()

    @property
    def has_catalog(self) -> bool:
        return self.catalog is not None

    async def create_room(self, name: str) -> tuple[Room, str, str]:
        master_invite = secrets.token_urlsafe(32)
        player_invite = secrets.token_urlsafe(32)
        async with self._rooms_lock:
            room_id = self._new_room_id()
            room = Room(
                room_id=room_id,
                name=name.strip(),
                master_invite_digest=_token_digest(master_invite),
                player_invite_digest=_token_digest(player_invite),
            )
            if self.catalog is not None:
                self._initialize_catalog_room(room)
            self._rooms[room_id] = room
        return room, master_invite, player_invite

    def _initialize_catalog_room(self, room: Room) -> None:
        assert self.catalog is not None
        scenes = self.catalog.list_scenes("master")
        for scene in scenes:
            room.scene_tokens[scene.scene_id] = {}
            room.scene_overlays[scene.scene_id] = {
                overlay.asset_id: False for overlay in scene.overlays
            }
        room.active_scene_id = scenes[0].scene_id if scenes else None

    async def issue_ticket(self, room_id: str, invite_token: str) -> IssuedAccess | None:
        room = self._rooms.get(room_id)
        if room is None:
            return None

        supplied = _token_digest(invite_token)
        if secrets.compare_digest(supplied, room.master_invite_digest):
            role: Role = "master"
        elif secrets.compare_digest(supplied, room.player_invite_digest):
            role = "player"
        else:
            return None

        ticket = secrets.token_urlsafe(24)
        media_token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        ticket_grant = TicketGrant(
            room_id=room_id,
            role=role,
            expires_at=now + timedelta(seconds=self.ticket_ttl_seconds),
        )
        media_grant = MediaGrant(
            room_id=room_id,
            role=role,
            expires_at=now + timedelta(seconds=self.media_ttl_seconds),
        )
        async with self._access_lock:
            self._purge_expired_access(now)
            self._tickets[ticket] = ticket_grant
            self._media_grants[_token_digest(media_token)] = media_grant
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
        if grant is None or grant.room_id != room_id or grant.expires_at <= now:
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
            or room_id not in self._rooms
        ):
            return None
        return grant

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
            if scene.active_player_map == asset_id:
                return True

            overlay_states = room.scene_overlays.get(active_scene_id, {})
            if any(
                overlay.asset_id == asset_id
                and overlay_states.get(overlay.asset_id, False)
                for overlay in scene.overlays
            ):
                return True

            return any(
                token.visible and token.asset_id == asset_id
                for token in room.scene_tokens.get(active_scene_id, {}).values()
            )

    async def connect(
        self, room_id: str, websocket: WebSocket, role: Role
    ) -> ClientConnection | None:
        room = self._rooms.get(room_id)
        if room is None:
            return None
        connection = ClientConnection(websocket=websocket, role=role)
        async with room.broadcast_lock:
            async with room.lock:
                snapshot = self._snapshot(room, role)
            await connection.send(snapshot)
            async with room.lock:
                room.clients.add(connection)
        return connection

    async def disconnect(self, room_id: str, connection: ClientConnection) -> None:
        room = self._rooms.get(room_id)
        if room is None:
            return
        async with room.lock:
            room.clients.discard(connection)

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

            await self._send_to_clients(room, payloads)
        return None

    def _apply_catalog_mutation(
        self,
        room: Room,
        role: Role,
        command: CatalogCommand,
    ) -> CatalogCommandFailure | None:
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
                if not token.visible or not token.movable:
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

    def room_exists(self, room_id: str) -> bool:
        return room_id in self._rooms

    def _new_room_id(self) -> str:
        while True:
            room_id = "".join(secrets.choice(ROOM_ALPHABET) for _ in range(8))
            if room_id not in self._rooms:
                return room_id

    def _purge_expired_access(self, now: datetime) -> None:
        expired_tickets = [
            token for token, grant in self._tickets.items() if grant.expires_at <= now
        ]
        for token in expired_tickets:
            self._tickets.pop(token, None)
        expired_media = [
            token for token, grant in self._media_grants.items() if grant.expires_at <= now
        ]
        for token in expired_media:
            self._media_grants.pop(token, None)

    @staticmethod
    async def _send_to_clients(
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
        if active_scene is not None:
            for token in room.scene_tokens.get(active_scene.scene_id, {}).values():
                if role == "player" and not token.visible:
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

        state: dict[str, Any] = {
            "scene": (
                self._active_scene_payload(room, active_scene, role)
                if active_scene is not None
                else None
            ),
            "tokens": tokens,
        }
        if role == "master":
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
        return {
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

    def _master_scenes(self) -> tuple[SceneView, ...]:
        assert self.catalog is not None
        return self.catalog.list_scenes("master")

    @staticmethod
    def _token_count(room: Room) -> int:
        return sum(len(tokens) for tokens in room.scene_tokens.values())

    @staticmethod
    def _generated_token_id(command_id: str) -> str:
        digest = hashlib.sha256(command_id.encode("utf-8")).hexdigest()[:20]
        return f"token-{digest}"

    @staticmethod
    def _humanize(value: str) -> str:
        words = value.replace("_", " ").replace("-", " ").split()
        return " ".join(word[:1].upper() + word[1:] for word in words)

    @classmethod
    def _asset_label(cls, asset_id: str) -> str:
        filename = asset_id.rsplit("/", 1)[-1]
        stem = filename.rsplit(".", 1)[0]
        return cls._humanize(stem)
