from __future__ import annotations

import pytest

from caos_vtt.portable import build_portable_settings


def test_portable_settings_are_loopback_only_and_ephemeral() -> None:
    first = build_portable_settings(8765)
    second = build_portable_settings(8765)

    assert first.bind_host == "127.0.0.1"
    assert first.bind_port == 8765
    assert first.allowed_origins == (
        "http://127.0.0.1:8765",
        "http://localhost:8765",
    )
    assert first.host_token != second.host_token
    assert len(first.host_token) >= 32


def test_portable_settings_accept_only_explicit_tunnel_origins() -> None:
    settings = build_portable_settings(8765, ("https://mesa.example.com",))
    assert settings.allowed_origins[-1] == "https://mesa.example.com"

    with pytest.raises(ValueError, match="Origem invalida"):
        build_portable_settings(8765, ("https://mesa.example.com/path",))

    with pytest.raises(ValueError, match="HTTPS"):
        build_portable_settings(8765, ("http://mesa.example.com",))
