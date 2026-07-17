from __future__ import annotations

import pytest

from caos_vtt.config import Settings


def test_server_is_restricted_to_loopback() -> None:
    with pytest.raises(ValueError, match="loopback"):
        Settings(host_token="host-token-for-tests-123456", bind_host="0.0.0.0")


def test_origins_reject_query_and_fragment() -> None:
    with pytest.raises(ValueError, match="Origem invalida"):
        Settings(
            host_token="host-token-for-tests-123456",
            allowed_origins=("https://example.com?unsafe=1",),
        )

    with pytest.raises(ValueError, match="Origem invalida"):
        Settings(
            host_token="host-token-for-tests-123456",
            allowed_origins=("https://example.com/#unsafe",),
        )


def test_origins_are_canonical_and_reject_invalid_ports() -> None:
    settings = Settings(
        host_token="host-token-for-tests-123456",
        allowed_origins=("HTTPS://MESA.Example.COM:443/",),
    )

    assert settings.allowed_origins == ("https://mesa.example.com",)
    assert settings.allows_origin("https://MESA.example.com/")
    assert not settings.allows_origin("https://mesa.example.com.evil.test")

    with pytest.raises(ValueError, match="Origem invalida"):
        Settings(
            host_token="host-token-for-tests-123456",
            allowed_origins=("https://example.com:not-a-port",),
        )
