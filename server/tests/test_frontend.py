from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from caos_vtt import create_app
from caos_vtt.config import Settings

from conftest import HOST_TOKEN, ORIGIN


def _app_with_frontend(frontend_dir: Path):
    return create_app(
        Settings(host_token=HOST_TOKEN, allowed_origins=(ORIGIN,)),
        frontend_dir=frontend_dir,
    )


def test_frontend_and_spa_routes_are_served(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<h1>C.A.O.S.</h1>", encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("export {};", encoding="utf-8")

    with TestClient(_app_with_frontend(tmp_path)) as client:
        assert client.get("/").text == "<h1>C.A.O.S.</h1>"
        assert client.get("/vtt-lab").text == "<h1>C.A.O.S.</h1>"
        assert client.get("/ficha/codex-demo").text == "<h1>C.A.O.S.</h1>"
        assert client.get("/assets/app.js").text == "export {};"
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/vtt/health").json()["status"] == "ok"
        assert client.get("/api/vtt/inexistente").status_code == 404


def test_frontend_requires_a_built_index(tmp_path: Path) -> None:
    try:
        _app_with_frontend(tmp_path)
    except RuntimeError as exc:
        assert "index.html" in str(exc)
    else:
        raise AssertionError("create_app deveria rejeitar um frontend sem index.html")
