from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


_FIREBASE_PROJECT_ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
_FIRESTORE_COLLECTION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
_STATE_BACKENDS = frozenset({"firestore", "memory", "sqlite"})


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
    try:
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as error:
        raise ValueError(f"Origem invalida: {value!r}") from error
    if not hostname:
        raise ValueError(f"Origem invalida: {value!r}")

    scheme = parsed.scheme.lower()
    ascii_hostname = hostname.encode("idna").decode("ascii").lower()
    rendered_host = f"[{ascii_hostname}]" if ":" in ascii_hostname else ascii_hostname
    default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    rendered_port = "" if port is None or default_port else f":{port}"
    return f"{scheme}://{rendered_host}{rendered_port}"


@dataclass(frozen=True, slots=True)
class Settings:
    host_token: str
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    ticket_ttl_seconds: int = 60
    max_pending_tickets_per_room: int = 32
    max_media_grants_per_room: int = 64
    bind_host: str = "127.0.0.1"
    bind_port: int = 8765
    allow_public_bind: bool = False
    state_backend: str = "sqlite"
    state_db_path: Path | None = None
    firebase_project_id: str | None = None
    firestore_state_collection: str = "vttRoomStates"

    def __post_init__(self) -> None:
        token = self.host_token.strip()
        if len(token) < 16:
            raise ValueError("CAOS_VTT_HOST_TOKEN deve ter pelo menos 16 caracteres")

        origins = tuple(dict.fromkeys(_normalise_origin(item) for item in self.allowed_origins))
        if not origins or "*" in origins:
            raise ValueError("CAOS_VTT_ALLOWED_ORIGINS deve listar origens explicitas")
        if not 10 <= self.ticket_ttl_seconds <= 600:
            raise ValueError("CAOS_VTT_TICKET_TTL deve estar entre 10 e 600 segundos")
        if not 1 <= self.max_pending_tickets_per_room <= 4096:
            raise ValueError(
                "CAOS_VTT_MAX_PENDING_TICKETS_PER_ROOM deve estar entre 1 e 4096"
            )
        if not 1 <= self.max_media_grants_per_room <= 4096:
            raise ValueError(
                "CAOS_VTT_MAX_MEDIA_GRANTS_PER_ROOM deve estar entre 1 e 4096"
            )
        if not 1 <= self.bind_port <= 65535:
            raise ValueError("CAOS_VTT_PORT invalida")
        allowed_bind_hosts = {"127.0.0.1", "localhost", "::1"}
        if self.allow_public_bind:
            allowed_bind_hosts.add("0.0.0.0")
        if self.bind_host not in allowed_bind_hosts:
            raise ValueError("CAOS_VTT_HOST deve permanecer restrito ao loopback")

        state_backend = self.state_backend.strip().lower()
        if state_backend not in _STATE_BACKENDS:
            raise ValueError("CAOS_VTT_STATE_BACKEND deve ser firestore, memory ou sqlite")

        state_db_path = self.state_db_path
        if state_backend != "sqlite" and state_db_path is not None:
            raise ValueError("CAOS_VTT_STATE_DB so pode ser usado com backend sqlite")
        if state_db_path is not None:
            state_db_path = state_db_path.expanduser().resolve(strict=False)
            if state_db_path.exists() and not state_db_path.is_file():
                raise ValueError("CAOS_VTT_STATE_DB precisa apontar para um arquivo")

        firebase_project_id = self.firebase_project_id
        if firebase_project_id is not None:
            firebase_project_id = firebase_project_id.strip()
            if not _FIREBASE_PROJECT_ID_PATTERN.fullmatch(firebase_project_id):
                raise ValueError("CAOS_VTT_FIREBASE_PROJECT_ID invalido")
        if state_backend == "firestore" and firebase_project_id is None:
            raise ValueError(
                "CAOS_VTT_FIREBASE_PROJECT_ID e obrigatorio com persistencia Firestore"
            )

        firestore_state_collection = self.firestore_state_collection.strip()
        if not _FIRESTORE_COLLECTION_PATTERN.fullmatch(firestore_state_collection):
            raise ValueError("CAOS_VTT_FIRESTORE_STATE_COLLECTION invalida")

        object.__setattr__(self, "state_backend", state_backend)
        object.__setattr__(self, "host_token", token)
        object.__setattr__(self, "allowed_origins", origins)
        object.__setattr__(self, "state_db_path", state_db_path)
        object.__setattr__(self, "firebase_project_id", firebase_project_id)
        object.__setattr__(
            self,
            "firestore_state_collection",
            firestore_state_collection,
        )

    @classmethod
    def from_env(cls) -> "Settings":
        render_mode = os.getenv("RENDER", "").strip().lower() == "true"
        host_token = os.getenv("CAOS_VTT_HOST_TOKEN", "").strip()
        if not host_token:
            raise RuntimeError("Defina CAOS_VTT_HOST_TOKEN antes de iniciar o servidor")

        raw_origins = os.getenv("CAOS_VTT_ALLOWED_ORIGINS", "").strip()
        if not raw_origins:
            if render_mode:
                raise RuntimeError(
                    "Defina CAOS_VTT_ALLOWED_ORIGINS com a origem HTTPS da aplicacao"
                )
            raw_origins = "http://localhost:5173,http://127.0.0.1:5173"
        origins = tuple(item for item in raw_origins.split(",") if item.strip())
        state_backend = os.getenv(
            "CAOS_VTT_STATE_BACKEND",
            "firestore" if render_mode else "sqlite",
        ).strip().lower()
        raw_state_db = os.getenv("CAOS_VTT_STATE_DB", "").strip()
        state_db_path = None
        if state_backend == "sqlite":
            state_db_path = (
                Path(raw_state_db)
                if raw_state_db
                else Path(".artifacts") / "caos-vtt-state.sqlite3"
            )
        elif raw_state_db:
            raise RuntimeError("CAOS_VTT_STATE_DB nao pode ser usado fora do backend sqlite")

        firebase_project_id = os.getenv(
            "CAOS_VTT_FIREBASE_PROJECT_ID",
            "",
        ).strip() or None
        raw_port = os.getenv("CAOS_VTT_PORT", "").strip()
        if not raw_port:
            raw_port = os.getenv("PORT", "10000" if render_mode else "8765").strip()
        return cls(
            host_token=host_token,
            allowed_origins=origins,
            ticket_ttl_seconds=int(os.getenv("CAOS_VTT_TICKET_TTL", "60")),
            max_pending_tickets_per_room=int(
                os.getenv("CAOS_VTT_MAX_PENDING_TICKETS_PER_ROOM", "32")
            ),
            max_media_grants_per_room=int(
                os.getenv("CAOS_VTT_MAX_MEDIA_GRANTS_PER_ROOM", "64")
            ),
            bind_host=os.getenv(
                "CAOS_VTT_HOST",
                "0.0.0.0" if render_mode else "127.0.0.1",
            ),
            bind_port=int(raw_port),
            allow_public_bind=render_mode,
            state_backend=state_backend,
            state_db_path=state_db_path,
            firebase_project_id=firebase_project_id,
            firestore_state_collection=os.getenv(
                "CAOS_VTT_FIRESTORE_STATE_COLLECTION",
                "vttRoomStates",
            ),
        )

    def allows_origin(self, origin: str | None) -> bool:
        if not origin:
            return False
        try:
            return _normalise_origin(origin) in self.allowed_origins
        except ValueError:
            return False
