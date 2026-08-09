from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import create_router
from .campaign import CampaignCatalog
from .config import Settings
from .frontend import mount_frontend
from .firestore_auth import FirestoreMesaGrantVerifier
from .service import VTTService
from .storage import FirestoreRoomStateStore, RoomStateStoreBackend


def _state_store(settings: Settings) -> RoomStateStoreBackend | None:
    if settings.state_backend != "firestore":
        return None
    assert settings.firebase_project_id is not None
    return FirestoreRoomStateStore(
        settings.firebase_project_id,
        settings.firestore_state_collection,
    )


def create_app(
    settings: Settings | None = None,
    *,
    frontend_dir: str | Path | None = None,
    catalog: CampaignCatalog | None = None,
) -> FastAPI:
    resolved = settings or Settings.from_env()
    app = FastAPI(
        title="C.A.O.S. VTT Server",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = resolved
    app.state.catalog = catalog
    app.state.persistence_backend = resolved.state_backend
    app.state.mesa_grant_verifier = (
        FirestoreMesaGrantVerifier(resolved.firebase_project_id)
        if resolved.firebase_project_id is not None
        else None
    )
    app.state.vtt = VTTService(
        ticket_ttl_seconds=resolved.ticket_ttl_seconds,
        max_pending_tickets_per_room=resolved.max_pending_tickets_per_room,
        max_media_grants_per_room=resolved.max_media_grants_per_room,
        catalog=catalog,
        state_db_path=(
            resolved.state_db_path if resolved.state_backend == "sqlite" else None
        ),
        state_store=_state_store(resolved),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(create_router())
    if frontend_dir is not None:
        mount_frontend(app, frontend_dir)
    return app
