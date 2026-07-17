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
from .tunnel import (
    DEFAULT_TUNNEL_TIMEOUT_SECONDS,
    QuickTunnel,
    find_cloudflared_executable,
)


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
    parser.add_argument(
        "--tunnel",
        action="store_true",
        help="criar um Cloudflare Quick Tunnel temporario e gratuito",
    )
    parser.add_argument(
        "--tunnel-timeout",
        type=float,
        default=DEFAULT_TUNNEL_TIMEOUT_SECONDS,
        metavar="SEGUNDOS",
        help=f"tempo para obter a URL publica (padrao: {DEFAULT_TUNNEL_TIMEOUT_SECONDS:g})",
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

    if args.tunnel and not 5 <= args.tunnel_timeout <= 180:
        raise ValueError("--tunnel-timeout deve estar entre 5 e 180 segundos")

    frontend_dir = find_frontend_dir()
    browser_url = f"http://127.0.0.1:{args.port}/vtt-lab"
    health_url = f"http://127.0.0.1:{args.port}/api/vtt/health"
    tunnel: QuickTunnel | None = None
    tunnel_origin: str | None = None
    tunnel_monitor: threading.Thread | None = None

    try:
        public_origins = list(args.public_origin)
        if args.tunnel:
            print("\nCriando Cloudflare Quick Tunnel...", flush=True)
            tunnel = QuickTunnel(find_cloudflared_executable())
            tunnel_origin = tunnel.start(
                f"http://127.0.0.1:{args.port}",
                timeout=args.tunnel_timeout,
            )
            public_origins.append(tunnel_origin)

        # The public origin is known and canonical before the app/WS routes exist.
        settings = build_portable_settings(args.port, public_origins)

        print("\nC.A.O.S. VTT PORTATIL")
        print("=" * 64)
        print(f"Endereco local: {browser_url}")
        if tunnel_origin:
            print(f"URL PARA COMPARTILHAR: {tunnel_origin}/vtt-lab")
            print("O endereco online e temporario e muda a cada execucao.")
        print(f"Host token temporario: {settings.host_token}")
        if args.public_origin:
            print(f"Origens publicas adicionais: {', '.join(args.public_origin)}")
        print("Copie o token acima para o campo 'Host token' ao criar a sala.")
        print("O token nao foi salvo em disco e muda a cada execucao.")
        print("Fechar esta janela encerra o servidor, o tunel e o estado em memoria.")
        print("Pressione Ctrl+C para encerrar.\n", flush=True)

        if not args.no_browser:
            threading.Thread(
                target=_open_browser_when_ready,
                args=(browser_url, health_url),
                daemon=True,
                name="caos-vtt-browser",
            ).start()

        config = uvicorn.Config(
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
        server = uvicorn.Server(config)
        server_finished = threading.Event()
        tunnel_failure: list[str] = []

        if tunnel is not None:
            def stop_server_if_tunnel_exits() -> None:
                exit_code = tunnel.wait_for_exit()
                if tunnel.is_stopping or server_finished.is_set():
                    return
                message = (
                    "O cloudflared encerrou durante a sessao online "
                    f"(codigo {exit_code}). Verifique a rede e inicie a mesa novamente."
                )
                tunnel_failure.append(message)
                print(f"\n{message}", file=sys.stderr, flush=True)
                server.should_exit = True

            tunnel_monitor = threading.Thread(
                target=stop_server_if_tunnel_exits,
                daemon=True,
                name="caos-vtt-cloudflared-monitor",
            )
            tunnel_monitor.start()

        try:
            server.run()
        finally:
            server_finished.set()
        if tunnel_failure:
            raise RuntimeError(tunnel_failure[0])
        return 0
    finally:
        if tunnel is not None:
            tunnel.stop()
        if tunnel_monitor is not None and tunnel_monitor.is_alive():
            tunnel_monitor.join(timeout=1.0)


def main() -> None:
    try:
        raise SystemExit(run())
    except KeyboardInterrupt:
        raise SystemExit(0) from None
    except (RuntimeError, ValueError) as exc:
        print(f"\nNao foi possivel iniciar o VTT: {exc}", file=sys.stderr)
        raise SystemExit(1) from None
