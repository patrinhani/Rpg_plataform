from __future__ import annotations

import asyncio
import hashlib
import secrets
import string
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import WebSocket

from .models import MoveCommand, Role


PROTOCOL_VERSION = 1
DEMO_TOKEN_ID = "demo-token"
ROOM_ALPHABET = string.ascii_uppercase + string.digits


def _token_digest(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


@dataclass(eq=False, slots=True)
class ClientConnection:
    websocket: WebSocket
    role: Role
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload: dict[str, Any]) -> None:
        async with self.send_lock:
            await self.websocket.send_json(payload)


@dataclass(slots=True)
class TicketGrant:
    room_id: str
    role: Role
    expires_at: datetime


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
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    broadcast_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class VTTService:
    def __init__(self, *, ticket_ttl_seconds: int) -> None:
        self.ticket_ttl_seconds = ticket_ttl_seconds
        self._rooms: dict[str, Room] = {}
        self._tickets: dict[str, TicketGrant] = {}
        self._rooms_lock = asyncio.Lock()
        self._tickets_lock = asyncio.Lock()

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
            self._rooms[room_id] = room
        return room, master_invite, player_invite

    async def issue_ticket(self, room_id: str, invite_token: str) -> tuple[str, Role] | None:
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
        grant = TicketGrant(
            room_id=room_id,
            role=role,
            expires_at=datetime.now(UTC) + timedelta(seconds=self.ticket_ttl_seconds),
        )
        async with self._tickets_lock:
            self._purge_expired_tickets()
            self._tickets[ticket] = grant
        return ticket, role

    async def consume_ticket(self, room_id: str, ticket: str) -> TicketGrant | None:
        async with self._tickets_lock:
            self._purge_expired_tickets()
            grant = self._tickets.pop(ticket, None)
        if grant is None or grant.room_id != room_id or grant.expires_at <= datetime.now(UTC):
            return None
        return grant

    async def connect(self, room_id: str, websocket: WebSocket, role: Role) -> ClientConnection | None:
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
        room = self._rooms.get(room_id)
        if room is None:
            return None

        async with room.broadcast_lock:
            async with room.lock:
                previous = room.processed_commands.get(command.commandId)
                if previous is not None:
                    event = previous
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
                    while len(room.processed_commands) > 256:
                        room.processed_commands.popitem(last=False)
                    clients = tuple(room.clients)

            stale: list[ClientConnection] = []
            for client in clients:
                try:
                    await client.send(event)
                except Exception:
                    stale.append(client)
            if stale:
                async with room.lock:
                    for client in stale:
                        room.clients.discard(client)
            return event

    def room_exists(self, room_id: str) -> bool:
        return room_id in self._rooms

    def _new_room_id(self) -> str:
        while True:
            room_id = "".join(secrets.choice(ROOM_ALPHABET) for _ in range(8))
            if room_id not in self._rooms:
                return room_id

    def _purge_expired_tickets(self) -> None:
        now = datetime.now(UTC)
        expired = [ticket for ticket, grant in self._tickets.items() if grant.expires_at <= now]
        for ticket in expired:
            self._tickets.pop(ticket, None)

    @staticmethod
    def _snapshot(room: Room, role: Role) -> dict[str, Any]:
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
