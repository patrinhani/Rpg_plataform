from __future__ import annotations

import re
import subprocess
import sys
import threading
import time
from collections import deque
from pathlib import Path
from typing import Callable, TextIO
from urllib.parse import urlsplit


CLOUDFLARED_VERSION = "2026.7.2"
DEFAULT_TUNNEL_TIMEOUT_SECONDS = 30.0
_QUICK_TUNNEL_URL = re.compile(
    r"(?<![a-z0-9])https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.trycloudflare\.com(?=[/\s|]|$)",
    re.IGNORECASE,
)
_DNS_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", re.IGNORECASE)
_ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def extract_quick_tunnel_origin(line: str) -> str | None:
    """Return a canonical Cloudflare Quick Tunnel origin from one log line."""

    for match in _QUICK_TUNNEL_URL.finditer(line):
        candidate = match.group(0)
        parsed = urlsplit(candidate)
        hostname = (parsed.hostname or "").lower()
        suffix = ".trycloudflare.com"
        prefix = hostname[: -len(suffix)] if hostname.endswith(suffix) else ""
        labels = prefix.split(".") if prefix else []
        if (
            parsed.scheme.lower() == "https"
            and parsed.port is None
            and not parsed.username
            and not parsed.password
            and len(labels) == 1
            and all(_DNS_LABEL.fullmatch(label) for label in labels)
        ):
            return f"https://{hostname}"
    return None


def find_cloudflared_executable() -> Path:
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        candidates.append(Path(sys.executable).resolve().parent / "cloudflared.exe")
    else:
        server_dir = Path(__file__).resolve().parents[1]
        candidates.append(
            server_dir
            / ".cache"
            / "cloudflared"
            / CLOUDFLARED_VERSION
            / "cloudflared.exe"
        )

    for candidate in candidates:
        if candidate.is_file():
            return candidate
    expected = candidates[0]
    raise RuntimeError(
        "cloudflared.exe nao foi encontrado. Este parece ser o pacote local menor, "
        "sem suporte online. Gere o pacote padrao ou execute sem --tunnel. "
        f"Caminho esperado: {expected}"
    )


class QuickTunnel:
    """Own a cloudflared Quick Tunnel process without exposing its request logs."""

    def __init__(
        self,
        executable: str | Path,
        *,
        popen_factory: Callable[..., subprocess.Popen[str]] | None = None,
    ) -> None:
        self.executable = Path(executable).resolve()
        self._popen_factory = popen_factory or subprocess.Popen
        self._process: subprocess.Popen[str] | None = None
        self._reader_thread: threading.Thread | None = None
        self._origin_ready = threading.Event()
        self._reader_finished = threading.Event()
        self._lock = threading.Lock()
        self._startup_lines: deque[str] = deque(maxlen=8)
        self._public_origin: str | None = None
        self._stopping = False

    @property
    def public_origin(self) -> str | None:
        with self._lock:
            return self._public_origin

    @property
    def is_stopping(self) -> bool:
        with self._lock:
            return self._stopping

    def wait_for_exit(self) -> int:
        process = self._process
        if process is None:
            raise RuntimeError("O Quick Tunnel ainda nao foi iniciado")
        return process.wait()

    def start(self, local_url: str, *, timeout: float = DEFAULT_TUNNEL_TIMEOUT_SECONDS) -> str:
        if timeout <= 0:
            raise ValueError("O timeout do tunel precisa ser positivo")
        if self._process is not None:
            raise RuntimeError("O Quick Tunnel ja foi iniciado")
        if not self.executable.is_file():
            raise RuntimeError(f"cloudflared.exe nao encontrado em {self.executable}")

        command = [
            str(self.executable),
            "tunnel",
            "--no-autoupdate",
            "--url",
            local_url,
        ]
        try:
            self._process = self._popen_factory(
                command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                shell=False,
            )
        except OSError as exc:
            raise RuntimeError(f"Nao foi possivel iniciar cloudflared.exe: {exc}") from exc

        self._reader_thread = threading.Thread(
            target=self._read_output,
            daemon=True,
            name="caos-vtt-cloudflared-output",
        )
        self._reader_thread.start()

        deadline = time.monotonic() + timeout
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise RuntimeError(
                        "O cloudflared nao publicou uma URL do Quick Tunnel dentro de "
                        f"{timeout:g} segundos. Verifique DNS, acesso HTTPS de saida e a "
                        "politica de rede deste computador."
                    )
                if self._origin_ready.wait(min(0.1, remaining)):
                    origin = self.public_origin
                    if origin is None:
                        continue
                    exit_code = self._process.poll()
                    if exit_code is not None:
                        raise RuntimeError(self._early_exit_message(exit_code))
                    return origin

                exit_code = self._process.poll()
                if exit_code is not None:
                    raise RuntimeError(self._early_exit_message(exit_code))
        except BaseException:
            self.stop()
            raise

    def stop(self, *, timeout: float = 5.0) -> None:
        process = self._process
        if process is None:
            return
        with self._lock:
            self._stopping = True

        try:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=timeout)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=timeout)
        except (OSError, ProcessLookupError, subprocess.TimeoutExpired):
            # The process may already have been torn down by Windows during console shutdown.
            pass
        finally:
            stream = process.stdout
            if stream is not None:
                try:
                    stream.close()
                except OSError:
                    pass
            if self._reader_thread is not None and self._reader_thread.is_alive():
                self._reader_thread.join(timeout=1.0)

    def _read_output(self) -> None:
        process = self._process
        stream: TextIO | None = process.stdout if process is not None else None
        if stream is None:
            self._reader_finished.set()
            return

        try:
            for raw_line in stream:
                origin = extract_quick_tunnel_origin(raw_line)
                with self._lock:
                    # Keep only bounded startup diagnostics. Once online, every subsequent
                    # cloudflared line is drained and discarded so request URLs (including
                    # one-use WebSocket tickets) are never retained or echoed by this launcher.
                    if self._public_origin is None:
                        cleaned = _ANSI_ESCAPE.sub("", raw_line).strip()
                        if cleaned:
                            self._startup_lines.append(cleaned[:400])
                    if origin is not None and self._public_origin is None:
                        self._public_origin = origin
                        self._origin_ready.set()
        except (OSError, ValueError):
            pass
        finally:
            self._reader_finished.set()

    def _early_exit_message(self, exit_code: int) -> str:
        with self._lock:
            detail = self._startup_lines[-1] if self._startup_lines else "sem diagnostico adicional"
        return (
            "O cloudflared encerrou antes de disponibilizar o Quick Tunnel "
            f"(codigo {exit_code}; {detail}). Verifique a politica de rede e tente novamente."
        )
