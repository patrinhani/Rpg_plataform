from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import create_router
from .campaign import CampaignCatalog
from .config import Settings
from .frontend import mount_frontend
from .service import VTTService


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
    app.state.vtt = VTTService(
        ticket_ttl_seconds=resolved.ticket_ttl_seconds,
        catalog=catalog,
        state_db_path=resolved.state_db_path,
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
