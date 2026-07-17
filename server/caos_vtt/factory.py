from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import create_router
from .config import Settings
from .service import VTTService


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or Settings.from_env()
    app = FastAPI(title="C.A.O.S. VTT Server", version="0.1.0")
    app.state.settings = resolved
    app.state.vtt = VTTService(ticket_ttl_seconds=resolved.ticket_ttl_seconds)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(create_router())
    return app
