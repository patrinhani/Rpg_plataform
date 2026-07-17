from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


def _normalise_origin(value: str) -> str:
    origin = value.strip().rstrip("/")
    parsed = urlsplit(origin)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise ValueError(f"Origem invalida: {value!r}")
    return origin


@dataclass(frozen=True, slots=True)
class Settings:
    host_token: str
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    ticket_ttl_seconds: int = 60
    bind_host: str = "127.0.0.1"
    bind_port: int = 8765

    def __post_init__(self) -> None:
        token = self.host_token.strip()
        if len(token) < 16:
            raise ValueError("CAOS_VTT_HOST_TOKEN deve ter pelo menos 16 caracteres")

        origins = tuple(dict.fromkeys(_normalise_origin(item) for item in self.allowed_origins))
        if not origins or "*" in origins:
            raise ValueError("CAOS_VTT_ALLOWED_ORIGINS deve listar origens explicitas")
        if not 10 <= self.ticket_ttl_seconds <= 600:
            raise ValueError("CAOS_VTT_TICKET_TTL deve estar entre 10 e 600 segundos")
        if not 1 <= self.bind_port <= 65535:
            raise ValueError("CAOS_VTT_PORT invalida")
        if self.bind_host not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("CAOS_VTT_HOST deve permanecer restrito ao loopback")

        object.__setattr__(self, "host_token", token)
        object.__setattr__(self, "allowed_origins", origins)

    @classmethod
    def from_env(cls) -> "Settings":
        host_token = os.getenv("CAOS_VTT_HOST_TOKEN", "").strip()
        if not host_token:
            raise RuntimeError("Defina CAOS_VTT_HOST_TOKEN antes de iniciar o servidor")

        raw_origins = os.getenv(
            "CAOS_VTT_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
        origins = tuple(item for item in raw_origins.split(",") if item.strip())
        return cls(
            host_token=host_token,
            allowed_origins=origins,
            ticket_ttl_seconds=int(os.getenv("CAOS_VTT_TICKET_TTL", "60")),
            bind_host=os.getenv("CAOS_VTT_HOST", "127.0.0.1"),
            bind_port=int(os.getenv("CAOS_VTT_PORT", "8765")),
        )

    def allows_origin(self, origin: str | None) -> bool:
        if not origin:
            return False
        return origin.rstrip("/") in self.allowed_origins
