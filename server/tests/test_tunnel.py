from __future__ import annotations

import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from caos_vtt import portable
from caos_vtt.tunnel import (
    QuickTunnel,
    extract_quick_tunnel_origin,
    find_cloudflared_executable,
)


class FakeStream:
    def __init__(self, lines: list[str]) -> None:
        self._lines = lines
        self.closed = False

    def __iter__(self):
        return iter(self._lines)

    def close(self) -> None:
        self.closed = True


class FakeProcess:
    def __init__(self, lines: list[str], *, returncode: int | None = None) -> None:
        self.stdout = FakeStream(lines)
        self.returncode = returncode
        self.terminated = False
        self.killed = False

    def poll(self) -> int | None:
        return self.returncode

    def terminate(self) -> None:
        self.terminated = True
        self.returncode = -15

    def kill(self) -> None:
        self.killed = True
        self.returncode = -9

    def wait(self, timeout: float | None = None) -> int:
        del timeout
        return self.returncode or 0


class StubbornFakeProcess(FakeProcess):
    def wait(self, timeout: float | None = None) -> int:
        if not self.killed:
            raise subprocess.TimeoutExpired("cloudflared", timeout)
        return self.returncode or 0


class RecordingPopen:
    def __init__(self, process: FakeProcess) -> None:
        self.process = process
        self.command: list[str] | None = None
        self.kwargs: dict[str, object] | None = None

    def __call__(self, command: list[str], **kwargs):
        self.command = command
        self.kwargs = kwargs
        return self.process


def _fake_executable(tmp_path: Path) -> Path:
    executable = tmp_path / "cloudflared.exe"
    executable.write_bytes(b"fake")
    return executable


def test_quick_tunnel_origin_parser_is_exact() -> None:
    line = "INF Your quick Tunnel has been created! Visit HTTPS://Mesa-Teste.TryCloudflare.Com"
    assert extract_quick_tunnel_origin(line) == "https://mesa-teste.trycloudflare.com"
    assert extract_quick_tunnel_origin("https://trycloudflare.com") is None
    assert extract_quick_tunnel_origin("https://sub.mesa.trycloudflare.com") is None
    assert extract_quick_tunnel_origin("https://mesa.trycloudflare.com.evil.example") is None
    assert extract_quick_tunnel_origin("evilhttps://mesa.trycloudflare.com") is None
    assert extract_quick_tunnel_origin("http://mesa.trycloudflare.com") is None


def test_frozen_runtime_finds_cloudflared_next_to_executable(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app_executable = tmp_path / "CAOS-VTT.exe"
    cloudflared = tmp_path / "cloudflared.exe"
    app_executable.write_bytes(b"app")
    cloudflared.write_bytes(b"cloudflared")

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "executable", str(app_executable))
    assert find_cloudflared_executable() == cloudflared


def test_quick_tunnel_uses_no_shell_and_cleans_up(tmp_path: Path) -> None:
    process = FakeProcess([
        "INF https://mesa-teste.trycloudflare.com\n",
        "ERR GET /ws/vtt/rooms/room?ticket=segredo-que-nao-pode-ser-logado\n",
    ])
    popen = RecordingPopen(process)
    tunnel = QuickTunnel(_fake_executable(tmp_path), popen_factory=popen)

    origin = tunnel.start("http://127.0.0.1:8765", timeout=1)
    assert origin == "https://mesa-teste.trycloudflare.com"
    assert popen.command == [
        str((tmp_path / "cloudflared.exe").resolve()),
        "tunnel",
        "--no-autoupdate",
        "--url",
        "http://127.0.0.1:8765",
    ]
    assert popen.kwargs is not None
    assert popen.kwargs["shell"] is False
    assert popen.kwargs["stdin"] is subprocess.DEVNULL
    assert popen.kwargs["stderr"] is subprocess.STDOUT
    assert "segredo-que-nao-pode-ser-logado" not in "\n".join(tunnel._startup_lines)

    tunnel.stop()
    assert process.terminated is True
    assert process.stdout.closed is True


def test_quick_tunnel_kills_a_process_that_ignores_terminate(tmp_path: Path) -> None:
    process = StubbornFakeProcess(["INF https://mesa-teste.trycloudflare.com\n"])
    tunnel = QuickTunnel(
        _fake_executable(tmp_path),
        popen_factory=RecordingPopen(process),
    )

    tunnel.start("http://127.0.0.1:8765", timeout=1)
    tunnel.stop(timeout=0.01)
    assert process.terminated is True
    assert process.killed is True


def test_quick_tunnel_timeout_terminates_process(tmp_path: Path) -> None:
    process = FakeProcess([])
    tunnel = QuickTunnel(
        _fake_executable(tmp_path),
        popen_factory=RecordingPopen(process),
    )

    with pytest.raises(RuntimeError, match="nao publicou uma URL"):
        tunnel.start("http://127.0.0.1:8765", timeout=0.02)
    assert process.terminated is True


def test_quick_tunnel_early_exit_is_clear_and_clean(tmp_path: Path) -> None:
    process = FakeProcess(["ERR outbound connection blocked\n"], returncode=23)
    tunnel = QuickTunnel(
        _fake_executable(tmp_path),
        popen_factory=RecordingPopen(process),
    )

    with pytest.raises(RuntimeError, match=r"codigo 23"):
        tunnel.start("http://127.0.0.1:8765", timeout=1)
    assert process.stdout.closed is True


def test_portable_run_stops_tunnel_when_server_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    (tmp_path / "index.html").write_text("<h1>VTT</h1>", encoding="utf-8")
    executable = _fake_executable(tmp_path)

    class FakeTunnel:
        instance = None

        def __init__(self, path: Path) -> None:
            assert path == executable
            self.stopped = False
            self._exited = threading.Event()
            FakeTunnel.instance = self

        def start(self, local_url: str, *, timeout: float) -> str:
            assert local_url == "http://127.0.0.1:8765"
            assert timeout == 30
            return "https://mesa-teste.trycloudflare.com"

        def stop(self) -> None:
            self.stopped = True
            self._exited.set()

        @property
        def is_stopping(self) -> bool:
            return self.stopped

        def wait_for_exit(self) -> int:
            self._exited.wait(timeout=2)
            return -15

    class FakeConfig:
        def __init__(self, app, **kwargs) -> None:
            self.app = app
            self.kwargs = kwargs

    class FailingServer:
        def __init__(self, config: FakeConfig) -> None:
            self.config = config
            self.should_exit = False

        def run(self) -> None:
            assert self.config.app.state.settings.bind_host == "127.0.0.1"
            assert self.config.kwargs["access_log"] is False
            assert self.config.app.state.settings.allows_origin(
                "https://mesa-teste.trycloudflare.com"
            )
            raise RuntimeError("uvicorn falhou")

    monkeypatch.setattr(portable, "find_frontend_dir", lambda: tmp_path)
    monkeypatch.setattr(portable, "_port_is_available", lambda port: port == 8765)
    monkeypatch.setattr(portable, "find_cloudflared_executable", lambda: executable)
    monkeypatch.setattr(portable, "QuickTunnel", FakeTunnel)
    monkeypatch.setattr(portable.uvicorn, "Config", FakeConfig)
    monkeypatch.setattr(portable.uvicorn, "Server", FailingServer)

    with pytest.raises(RuntimeError, match="uvicorn falhou"):
        portable.run(["--tunnel", "--no-browser"])
    assert FakeTunnel.instance is not None
    assert FakeTunnel.instance.stopped is True


def test_portable_stops_server_when_tunnel_dies_mid_session(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    (tmp_path / "index.html").write_text("<h1>VTT</h1>", encoding="utf-8")
    executable = _fake_executable(tmp_path)

    class ExitingTunnel:
        def __init__(self, path: Path) -> None:
            assert path == executable
            self.stopped = False

        def start(self, local_url: str, *, timeout: float) -> str:
            del local_url, timeout
            return "https://mesa-teste.trycloudflare.com"

        @property
        def is_stopping(self) -> bool:
            return self.stopped

        def wait_for_exit(self) -> int:
            return 17

        def stop(self) -> None:
            self.stopped = True

    class FakeConfig:
        def __init__(self, app, **kwargs) -> None:
            self.app = app
            self.kwargs = kwargs

    class WaitingServer:
        def __init__(self, config: FakeConfig) -> None:
            self.config = config
            self.should_exit = False

        def run(self) -> None:
            assert self.config.kwargs["access_log"] is False
            deadline = time.monotonic() + 2
            while not self.should_exit and time.monotonic() < deadline:
                time.sleep(0.01)
            assert self.should_exit is True

    monkeypatch.setattr(portable, "find_frontend_dir", lambda: tmp_path)
    monkeypatch.setattr(portable, "_port_is_available", lambda port: port == 8765)
    monkeypatch.setattr(portable, "find_cloudflared_executable", lambda: executable)
    monkeypatch.setattr(portable, "QuickTunnel", ExitingTunnel)
    monkeypatch.setattr(portable.uvicorn, "Config", FakeConfig)
    monkeypatch.setattr(portable.uvicorn, "Server", WaitingServer)

    with pytest.raises(RuntimeError, match="encerrou durante a sessao online"):
        portable.run(["--tunnel", "--no-browser"])
