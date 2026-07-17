from __future__ import annotations

import json
import secrets
from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    Header,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse

from .campaign import CampaignCatalogError, OpenedAsset
from .config import Settings
from .models import (
    CreateRoomRequest,
    CreateRoomResponse,
    MoveCommand,
    OverlaySetCommand,
    PingCommand,
    SceneSelectCommand,
    TicketResponse,
    TokenRemoveCommand,
    TokenSpawnCommand,
)
from .service import PROTOCOL_VERSION, ClientConnection, VTTService


MAX_WS_MESSAGE_BYTES = 16 * 1024
ASSET_STREAM_CHUNK_BYTES = 64 * 1024
SAFE_ASSET_MEDIA_TYPES = frozenset(
    {
        "image/avif",
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/svg+xml",
        "image/webp",
    }
)


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, separator, value = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not value.strip():
        return None
    return value.strip()


def _host_is_authorized(provided: str | None, expected: str) -> bool:
    token = _bearer_token(provided)
    if token is None:
        return False
    return secrets.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))


def _error(code: str, message: str, *, command_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "error",
        "protocolVersion": PROTOCOL_VERSION,
        "message": message,
        "error": {"code": code, "message": message},
    }
    if command_id is not None:
        payload["commandId"] = command_id
    return payload


def _asset_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset nao encontrado")


def _stream_asset(opened: OpenedAsset) -> Iterator[bytes]:
    try:
        while chunk := opened.stream.read(ASSET_STREAM_CHUNK_BYTES):
            yield chunk
    finally:
        opened.close()


def create_router() -> APIRouter:
    router = APIRouter()

    @router.get("/api/vtt/health")
    async def health() -> dict[str, Any]:
        return {"status": "ok", "protocolVersion": PROTOCOL_VERSION}

    @router.post(
        "/api/vtt/rooms",
        response_model=CreateRoomResponse,
        status_code=status.HTTP_201_CREATED,
    )
    async def create_room(
        payload: CreateRoomRequest,
        request: Request,
        authorization: Annotated[str | None, Header()] = None,
    ) -> CreateRoomResponse:
        settings: Settings = request.app.state.settings
        if not _host_is_authorized(authorization, settings.host_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Host token invalido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        service: VTTService = request.app.state.vtt
        room, master_invite, player_invite = await service.create_room(payload.name)
        return CreateRoomResponse(
            roomId=room.room_id,
            masterInviteToken=master_invite,
            playerInviteToken=player_invite,
            revision=room.revision,
        )

    @router.post("/api/vtt/rooms/{room_id}/tickets", response_model=TicketResponse)
    async def issue_ticket(
        room_id: str,
        request: Request,
        authorization: Annotated[str | None, Header()] = None,
    ) -> TicketResponse:
        invite_token = _bearer_token(authorization)
        if invite_token is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invite token ausente",
                headers={"WWW-Authenticate": "Bearer"},
            )
        service: VTTService = request.app.state.vtt
        result = await service.issue_ticket(room_id, invite_token)
        if result is None:
            if not service.room_exists(room_id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Sala nao encontrada",
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invite token invalido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TicketResponse(
            ticket=result.ticket,
            role=result.role,
            expiresIn=result.ticket_expires_in,
            mediaToken=result.media_token,
            mediaExpiresIn=result.media_expires_in,
        )

    @router.get("/api/vtt/rooms/{room_id}/assets")
    async def get_asset(
        room_id: str,
        request: Request,
        asset_id: Annotated[
            str,
            Query(alias="assetId", min_length=7, max_length=2048),
        ],
        access: Annotated[str, Query(min_length=16, max_length=256)],
    ) -> StreamingResponse:
        service: VTTService = request.app.state.vtt
        catalog = service.catalog
        grant = await service.validate_media_grant(room_id, access)
        if catalog is None or grant is None:
            raise _asset_not_found()
        try:
            opened = await run_in_threadpool(catalog.open_asset, asset_id, grant.role)
        except CampaignCatalogError:
            raise _asset_not_found() from None

        declared_media_type = opened.asset.media_type.lower()
        media_type = (
            declared_media_type
            if declared_media_type in SAFE_ASSET_MEDIA_TYPES
            else "application/octet-stream"
        )
        return StreamingResponse(
            _stream_asset(opened),
            media_type=media_type,
            headers={
                "Cache-Control": "no-store, private",
                "Content-Length": str(opened.size),
                "Content-Security-Policy": "default-src 'none'; sandbox",
                "X-Content-Type-Options": "nosniff",
            },
        )

    @router.websocket("/ws/vtt/rooms/{room_id}")
    async def room_socket(
        websocket: WebSocket,
        room_id: str,
        ticket: Annotated[str | None, Query()] = None,
    ) -> None:
        settings: Settings = websocket.app.state.settings
        service: VTTService = websocket.app.state.vtt
        if not settings.allows_origin(websocket.headers.get("origin")):
            await websocket.close(code=4403, reason="Origin not allowed")
            return
        if not ticket:
            await websocket.close(code=4401, reason="Ticket required")
            return
        grant = await service.consume_ticket(room_id, ticket)
        if grant is None:
            await websocket.close(code=4401, reason="Invalid or expired ticket")
            return

        await websocket.accept()
        connection = await service.connect(room_id, websocket, grant.role)
        if connection is None:
            await websocket.close(code=4404, reason="Room not found")
            return

        try:
            while True:
                raw = await websocket.receive_text()
                await _handle_socket_message(service, room_id, connection, raw)
        except WebSocketDisconnect:
            pass
        finally:
            await service.disconnect(room_id, connection)

    return router


async def _handle_socket_message(
    service: VTTService,
    room_id: str,
    connection: ClientConnection,
    raw: str,
) -> None:
    if len(raw.encode("utf-8")) > MAX_WS_MESSAGE_BYTES:
        await connection.send(
            _error("message_too_large", "Mensagem excede o limite de 16 KiB")
        )
        return
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        await connection.send(_error("invalid_json", "Mensagem JSON invalida"))
        return
    if not isinstance(data, dict):
        await connection.send(_error("invalid_message", "A mensagem deve ser um objeto"))
        return

    message_type = data.get("type")
    command_id = data.get("commandId") if isinstance(data.get("commandId"), str) else None
    if message_type == "ping":
        try:
            ping = PingCommand.model_validate(data)
        except ValidationError:
            await connection.send(_error("invalid_ping", "Ping invalido", command_id=command_id))
            return
        await connection.send(
            {"type": "pong", "protocolVersion": PROTOCOL_VERSION, "commandId": ping.commandId}
        )
        return

    if message_type == "token.move":
        try:
            command = MoveCommand.model_validate(data)
        except ValidationError:
            await connection.send(
                _error("invalid_token_move", "Comando token.move invalido", command_id=command_id)
            )
            return
        if service.has_catalog:
            failure = await service.execute_catalog_command(room_id, connection, command)
            if failure is not None:
                await connection.send(
                    _error(failure.code, failure.message, command_id=command.commandId)
                )
        else:
            event = await service.move_token(room_id, connection, command)
            if event is None:
                await connection.send(
                    _error(
                        "token_not_found",
                        "Token nao encontrado",
                        command_id=command.commandId,
                    )
                )
        return

    catalog_commands = {
        "scene.select": (SceneSelectCommand, "invalid_scene_select"),
        "overlay.set": (OverlaySetCommand, "invalid_overlay_set"),
        "token.spawn": (TokenSpawnCommand, "invalid_token_spawn"),
        "token.remove": (TokenRemoveCommand, "invalid_token_remove"),
    }
    command_definition = catalog_commands.get(message_type)
    if command_definition is not None and service.has_catalog:
        command_model, invalid_code = command_definition
        try:
            command = command_model.model_validate(data)
        except ValidationError:
            await connection.send(
                _error(invalid_code, f"Comando {message_type} invalido", command_id=command_id)
            )
            return
        failure = await service.execute_catalog_command(room_id, connection, command)
        if failure is not None:
            await connection.send(
                _error(failure.code, failure.message, command_id=command.commandId)
            )
        return

    await connection.send(
        _error(
            "unknown_message_type",
            "Tipo de mensagem desconhecido",
            command_id=command_id,
        )
    )
