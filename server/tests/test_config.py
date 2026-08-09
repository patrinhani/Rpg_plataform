from __future__ import annotations

import pytest

from caos_vtt.config import Settings


def test_server_is_restricted_to_loopback() -> None:
    with pytest.raises(ValueError, match="loopback"):
        Settings(host_token="host-token-for-tests-123456", bind_host="0.0.0.0")


def test_render_environment_uses_public_port_and_firestore(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("PORT", "10000")
    monkeypatch.setenv("CAOS_VTT_HOST_TOKEN", "host-token-for-tests-123456")
    monkeypatch.setenv("CAOS_VTT_ALLOWED_ORIGINS", "https://caos.example.test")
    monkeypatch.setenv("CAOS_VTT_FIREBASE_PROJECT_ID", "sistemarpg-14d7d")
    monkeypatch.delenv("CAOS_VTT_STATE_BACKEND", raising=False)
    monkeypatch.delenv("CAOS_VTT_STATE_DB", raising=False)

    settings = Settings.from_env()

    assert settings.bind_host == "0.0.0.0"
    assert settings.bind_port == 10000
    assert settings.allow_public_bind is True
    assert settings.state_backend == "firestore"
    assert settings.state_db_path is None


def test_render_requires_explicit_browser_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("CAOS_VTT_HOST_TOKEN", "host-token-for-tests-123456")
    monkeypatch.delenv("CAOS_VTT_ALLOWED_ORIGINS", raising=False)

    with pytest.raises(RuntimeError, match="CAOS_VTT_ALLOWED_ORIGINS"):
        Settings.from_env()


def test_firestore_state_requires_project_id() -> None:
    with pytest.raises(ValueError, match="CAOS_VTT_FIREBASE_PROJECT_ID"):
        Settings(
            host_token="host-token-for-tests-123456",
            state_backend="firestore",
        )


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


@pytest.mark.parametrize(
    ("field", "message"),
    (
        (
            "max_pending_tickets_per_room",
            "CAOS_VTT_MAX_PENDING_TICKETS_PER_ROOM",
        ),
        ("max_media_grants_per_room", "CAOS_VTT_MAX_MEDIA_GRANTS_PER_ROOM"),
    ),
)
def test_access_limits_must_be_bounded(field: str, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        Settings(
            host_token="host-token-for-tests-123456",
            **{field: 0},
        )
