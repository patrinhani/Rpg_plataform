from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class SPAStaticFiles(StaticFiles):
    """Serve Vite assets and fall back to index.html for client-side routes."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            route_path = path.replace("\\", "/").lstrip("/")
            is_spa_navigation = (
                exc.status_code == 404
                and scope.get("method") in {"GET", "HEAD"}
                and not route_path.startswith(("api/", "ws/"))
                and not Path(route_path).suffix
            )
            if not is_spa_navigation:
                raise
            return await super().get_response("index.html", scope)


def mount_frontend(app: FastAPI, directory: str | Path) -> None:
    frontend_dir = Path(directory).resolve()
    index_file = frontend_dir / "index.html"
    if not index_file.is_file():
        raise RuntimeError(f"Frontend Vite invalido: index.html nao encontrado em {frontend_dir}")

    # Mount last: declared API and WebSocket routes keep precedence over the SPA.
    app.mount("/", SPAStaticFiles(directory=frontend_dir, html=True), name="frontend")
