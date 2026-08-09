from __future__ import annotations

import asyncio
import json
import secrets
from collections.abc import Iterator
from contextlib import suppress
from datetime import UTC, datetime
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
from starlette.responses import Response, StreamingResponse

from .campaign import CampaignCatalogError, OpenedAsset
from .config import Settings
from .firestore_auth import (
    FirestoreMesaGrantVerifier,
    FirestoreUnavailableError,
    InvalidGrantError,
)
from .models import (
    CreateRoomRequest,
    CreateRoomResponse,
    FogResetCommand,
    FogRevealAllCommand,
    FogSetEnabledCommand,
    FogStrokeCommand,
    HandoutDeliverCommand,
    HandoutRevokeCommand,
    MoveCommand,
    MesaAccessRequest,
    MesaAccessResponse,
    MesaChallengeRequest,
    MesaChallengeResponse,
    OverlaySetCommand,
    PingCommand,
    PropRemoveCommand,
    PropSpawnCommand,
    PropUpdateCommand,
    SceneLayerSetCommand,
    SceneSelectCommand,
    TicketResponse,
    TokenAssignCommand,
    TokenRemoveCommand,
    TokenSpawnCommand,
)
from .service import (
    PROTOCOL_VERSION,
    AccessCapacityError,
    ClientConnection,
    MediaGrant,
    MesaSession,
    VTTService,
)


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


async def _validate_integrated_media_grant(
    service: VTTService,
    grant: MediaGrant,
) -> bool:
    session = grant.mesa_session
    if session is None:
        return True
    if not session.revoked and session.expires_at > datetime.now(UTC):
        return True
    await service.revoke_mesa_session(session)
    return False


async def _watch_mesa_session(
    service: VTTService,
    session: MesaSession,
) -> None:
    delay = max(0.0, (session.expires_at - datetime.now(UTC)).total_seconds())
    await asyncio.sleep(delay)
    if not session.revoked:
        await service.revoke_mesa_session(session)


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
        "/api/vtt/mesa-challenges",
        response_model=MesaChallengeResponse,
    )
    async def mesa_challenge(
        payload: MesaChallengeRequest,
        request: Request,
    ) -> MesaChallengeResponse:
        if request.app.state.mesa_grant_verifier is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A entrada integrada pela Mesa nao esta configurada neste servidor",
            )
        service: VTTService = request.app.state.vtt
        try:
            challenge, expires_in = await service.issue_mesa_challenge(payload.mesaId)
        except AccessCapacityError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite temporario de desafios de acesso atingido",
            ) from None
        return MesaChallengeResponse(challenge=challenge, expiresIn=expires_in)

    @router.post("/api/vtt/mesa-access", response_model=MesaAccessResponse)
    async def mesa_access(
        payload: MesaAccessRequest,
        request: Request,
    ) -> MesaAccessResponse:
        verifier: FirestoreMesaGrantVerifier | None = request.app.state.mesa_grant_verifier
        if verifier is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="A entrada integrada pela Mesa nao esta configurada neste servidor",
            )
        service: VTTService = request.app.state.vtt
        if not await service.consume_mesa_challenge(payload.mesaId, payload.challenge):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Desafio VTT invalido, expirado ou ja utilizado",
            )
        try:
            member = await run_in_threadpool(
                verifier.verify,
                payload.challenge,
                payload.mesaId,
            )
        except InvalidGrantError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="A Mesa nao autorizou este acesso VTT",
            ) from None
        except FirestoreUnavailableError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Nao foi possivel validar a Mesa no Firestore agora",
            ) from None

        if not service.supports_campaign(member.campaign_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A campanha desta Mesa nao esta carregada neste servidor",
            )
        if member.role == "master":
            try:
                room = await service.ensure_room_for_mesa(
                    member.room_name,
                    campaign_id=member.campaign_id,
                    external_mesa_id=member.mesa_id,
                )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A sala vinculada pertence a outra campanha",
                ) from None
        else:
            room = service.room_for_external_mesa(member.mesa_id)
            if room is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="O mestre ainda precisa abrir o VTT desta Mesa neste servidor",
                )
            if room.campaign_id != member.campaign_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A sala vinculada pertence a outra campanha",
                )

        try:
            access = await service.issue_mesa_access(
                room.room_id,
                member.role,
                mesa_id=member.mesa_id,
                uid=member.uid,
                expires_at=member.expires_at,
            )
        except AccessCapacityError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite temporario de acessos da sala atingido",
            ) from None
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A autorizacao VTT expirou antes de concluir o acesso",
            ) from None
        if access is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A sala vinculada a esta Mesa nao esta disponivel",
            )
        return MesaAccessResponse(
            roomId=room.room_id,
            revision=room.revision,
            ticket=access.ticket,
            role=access.role,
            expiresIn=access.ticket_expires_in,
            mediaToken=access.media_token,
            mediaExpiresIn=access.media_expires_in,
        )

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
        if payload.campaignId:
            if not service.supports_campaign(payload.campaignId):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A campanha solicitada nao esta carregada neste servidor",
                )
        room, master_invite, player_invite = await service.create_room(
            payload.name,
            campaign_id=payload.campaignId,
        )
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
        if service.room_uses_integrated_access(room_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta sala usa autenticacao pela Mesa",
            )
        try:
            result = await service.issue_ticket(room_id, invite_token)
        except AccessCapacityError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Limite temporario de acessos da sala atingido",
            ) from None
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
        if not await _validate_integrated_media_grant(service, grant):
            raise _asset_not_found()
        try:
            opened = await service.open_authorized_asset(
                room_id,
                grant.role,
                asset_id,
            )
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

    @router.get("/api/vtt/rooms/{room_id}/fog-map")
    async def get_fog_map(
        room_id: str,
        request: Request,
        access: Annotated[str, Query(min_length=16, max_length=256)],
        revision: Annotated[int | None, Query(ge=0)] = None,
    ) -> Response:
        service: VTTService = request.app.state.vtt
        grant = await service.validate_media_grant(room_id, access)
        if grant is None:
            raise _asset_not_found()
        if not await _validate_integrated_media_grant(service, grant):
            raise _asset_not_found()
        rendered = await service.render_player_fog_map(room_id, grant.role)
        if rendered is None:
            raise _asset_not_found()
        if revision is not None and revision != rendered.revision:
            # A revisao e usada somente como cache-buster; nunca permite ler estado antigo.
            raise _asset_not_found()
        return Response(
            content=rendered.content,
            media_type=rendered.media_type,
            headers={
                "Cache-Control": "no-store, private",
                "Content-Length": str(len(rendered.content)),
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

        mesa_watchdog: asyncio.Task[None] | None = None
        await websocket.accept()
        connection = await service.connect(
            room_id,
            websocket,
            grant.role,
            grant.media_digest,
            grant.mesa_session,
        )
        if connection is None:
            await websocket.close(code=4404, reason="Room not found")
            return

        if grant.mesa_session is not None:
            mesa_watchdog = asyncio.create_task(
                _watch_mesa_session(service, grant.mesa_session)
            )

        try:
            while True:
                raw = await websocket.receive_text()
                await _handle_socket_message(service, room_id, connection, raw)
        except WebSocketDisconnect:
            pass
        finally:
            if mesa_watchdog is not None:
                mesa_watchdog.cancel()
                with suppress(asyncio.CancelledError):
                    await mesa_watchdog
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
        "layer.set": (SceneLayerSetCommand, "invalid_layer_set"),
        "token.spawn": (TokenSpawnCommand, "invalid_token_spawn"),
        "token.assign": (TokenAssignCommand, "invalid_token_assign"),
        "token.remove": (TokenRemoveCommand, "invalid_token_remove"),
        "prop.spawn": (PropSpawnCommand, "invalid_prop_spawn"),
        "prop.update": (PropUpdateCommand, "invalid_prop_update"),
        "prop.remove": (PropRemoveCommand, "invalid_prop_remove"),
        "fog.stroke": (FogStrokeCommand, "invalid_fog_stroke"),
        "fog.set_enabled": (FogSetEnabledCommand, "invalid_fog_set_enabled"),
        "fog.reset": (FogResetCommand, "invalid_fog_reset"),
        "fog.reveal_all": (FogRevealAllCommand, "invalid_fog_reveal_all"),
        "handout.deliver": (HandoutDeliverCommand, "invalid_handout_deliver"),
        "handout.revoke": (HandoutRevokeCommand, "invalid_handout_revoke"),
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
