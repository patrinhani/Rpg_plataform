from __future__ import annotations

import argparse
import secrets
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from typing import Sequence
from urllib.parse import urlsplit

import uvicorn

from .config import Settings
from .factory import create_app


DEFAULT_PORT = 8765


def find_frontend_dir() -> Path:
    module_path = Path(__file__).resolve()
    candidates = (
        # PyInstaller onedir stores bundled data below its internal directory.
        module_path.parents[1] / "frontend_dist",
        # Source checkout fallback, useful for exercising the launcher before packaging.
        module_path.parents[2] / "dist",
    )
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    searched = ", ".join(str(candidate) for candidate in candidates)
    raise RuntimeError(f"Frontend empacotado nao encontrado. Caminhos verificados: {searched}")


def build_portable_settings(
    port: int,
    public_origins: Sequence[str] = (),
) -> Settings:
    for origin in public_origins:
        if urlsplit(origin.strip()).scheme.lower() != "https":
            raise ValueError("--public-origin deve usar HTTPS")

    token = secrets.token_urlsafe(32)
    return Settings(
        host_token=token,
        allowed_origins=(
            f"http://127.0.0.1:{port}",
            f"http://localhost:{port}",
            *public_origins,
        ),
        ticket_ttl_seconds=60,
        bind_host="127.0.0.1",
        bind_port=port,
    )


def _port_is_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def _open_browser_when_ready(url: str, health_url: str) -> None:
    for _ in range(120):
        try:
            with urllib.request.urlopen(health_url, timeout=0.4) as response:
                if response.status == 200:
                    webbrowser.open(url, new=2)
                    return
        except (OSError, urllib.error.URLError):
            time.sleep(0.1)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="CAOS-VTT",
        description="Servidor portatil local do VTT C.A.O.S.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"porta local do servidor (padrao: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="nao abrir o navegador automaticamente",
    )
    parser.add_argument(
        "--public-origin",
        action="append",
        default=[],
        metavar="URL",
        help="origem HTTPS explicita do tunel; pode ser repetida e nunca aceita wildcard",
    )
    return parser


def run(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if not 1 <= args.port <= 65535:
        raise ValueError("A porta precisa estar entre 1 e 65535")
    if not _port_is_available(args.port):
        raise RuntimeError(
            f"A porta {args.port} ja esta em uso. Feche o outro servidor ou escolha "
            "outra porta com CAOS-VTT.exe --port PORTA."
        )

    frontend_dir = find_frontend_dir()
    settings = build_portable_settings(args.port, args.public_origin)
    browser_url = f"http://127.0.0.1:{args.port}/vtt-lab"
    health_url = f"http://127.0.0.1:{args.port}/api/vtt/health"

    print("\nC.A.O.S. VTT PORTATIL")
    print("=" * 64)
    print(f"Endereco:  {browser_url}")
    print(f"Host token temporario: {settings.host_token}")
    if args.public_origin:
        print(f"Origens publicas liberadas: {', '.join(args.public_origin)}")
    print("Copie o token acima para o campo 'Host token' ao criar a sala.")
    print("O token nao foi salvo em disco e muda a cada execucao.")
    print("Fechar esta janela encerra o servidor e apaga o estado em memoria.")
    print("Pressione Ctrl+C para encerrar.\n", flush=True)

    if not args.no_browser:
        threading.Thread(
            target=_open_browser_when_ready,
            args=(browser_url, health_url),
            daemon=True,
            name="caos-vtt-browser",
        ).start()

    uvicorn.run(
        create_app(settings, frontend_dir=frontend_dir),
        host=settings.bind_host,
        port=settings.bind_port,
        loop="asyncio",
        http="h11",
        ws="auto",
        ws_max_size=16 * 1024,
        workers=1,
        log_level="warning",
    )
    return 0


def main() -> None:
    try:
        raise SystemExit(run())
    except KeyboardInterrupt:
        raise SystemExit(0) from None
    except (RuntimeError, ValueError) as exc:
        print(f"\nNao foi possivel iniciar o VTT: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
