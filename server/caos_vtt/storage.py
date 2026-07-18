from __future__ import annotations

import json
import sqlite3
import threading
import warnings
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


DATABASE_SCHEMA_VERSION = 1


class RoomStateStore:
    """Small SQLite repository for restart-safe room state.

    Connections are intentionally short-lived. This keeps the implementation
    safe when rendering and websocket work use background threads, while WAL
    makes each replacement atomic even if the process is interrupted.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self._schema_lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            self._ensure_schema()
        except sqlite3.DatabaseError as error:
            quarantined = self._quarantine_corrupt_database()
            warnings.warn(
                f"Banco VTT corrompido foi isolado em '{quarantined}': {error}",
                RuntimeWarning,
                stacklevel=2,
            )
            self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5.0)
        try:
            connection.execute("PRAGMA busy_timeout = 5000")
            connection.execute("PRAGMA journal_mode = WAL")
            connection.execute("PRAGMA synchronous = NORMAL")
            return connection
        except Exception:
            connection.close()
            raise

    def _ensure_schema(self) -> None:
        with self._schema_lock, self._connect() as connection:
            version = int(connection.execute("PRAGMA user_version").fetchone()[0])
            if version > DATABASE_SCHEMA_VERSION:
                raise RuntimeError(
                    "O banco de estado foi criado por uma versao mais nova do C.A.O.S. VTT"
                )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS room_state (
                    room_id TEXT PRIMARY KEY,
                    external_mesa_id TEXT UNIQUE,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS invalid_room_state (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    quarantined_at TEXT NOT NULL
                )
                """
            )
            if version < DATABASE_SCHEMA_VERSION:
                connection.execute(f"PRAGMA user_version = {DATABASE_SCHEMA_VERSION}")

    def load_all(self) -> tuple[tuple[str, dict[str, Any]], ...]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    "SELECT room_id, payload_json FROM room_state ORDER BY updated_at, room_id"
                ).fetchall()
        except sqlite3.DatabaseError as error:
            warnings.warn(
                f"Nao foi possivel ler o estado persistido do VTT: {error}",
                RuntimeWarning,
                stacklevel=2,
            )
            return ()

        payloads: list[tuple[str, dict[str, Any]]] = []
        for room_id, raw_payload in rows:
            try:
                payload = json.loads(raw_payload)
            except (TypeError, json.JSONDecodeError) as error:
                warnings.warn(
                    f"Uma sala persistida invalida foi ignorada: {error}",
                    RuntimeWarning,
                    stacklevel=2,
                )
                self.quarantine(room_id, str(raw_payload), str(error))
                continue
            if not isinstance(payload, dict):
                warnings.warn(
                    "Uma sala persistida que nao era objeto foi ignorada",
                    RuntimeWarning,
                    stacklevel=2,
                )
                self.quarantine(room_id, str(raw_payload), "payload nao era objeto")
                continue
            payloads.append((room_id, payload))
        return tuple(payloads)

    def save(self, payload: dict[str, Any]) -> None:
        room_id = str(payload["roomId"])
        external_mesa_id = payload.get("externalMesaId")
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        updated_at = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO room_state(room_id, external_mesa_id, payload_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(room_id) DO UPDATE SET
                    external_mesa_id = excluded.external_mesa_id,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                """,
                (room_id, external_mesa_id, encoded, updated_at),
            )

    def quarantine(self, room_id: str, payload: dict[str, Any] | str, reason: str) -> None:
        encoded = (
            payload
            if isinstance(payload, str)
            else json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        )
        timestamp = datetime.now(UTC).isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO invalid_room_state(
                    room_id, payload_json, reason, quarantined_at
                ) VALUES (?, ?, ?, ?)
                """,
                (room_id, encoded, reason[:1000], timestamp),
            )
            connection.execute("DELETE FROM room_state WHERE room_id = ?", (room_id,))

    def _quarantine_corrupt_database(self) -> Path:
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        quarantined = self.path.with_name(f"{self.path.name}.corrupt-{timestamp}")
        suffix = 1
        while quarantined.exists():
            quarantined = self.path.with_name(
                f"{self.path.name}.corrupt-{timestamp}-{suffix}"
            )
            suffix += 1
        if self.path.exists():
            self.path.replace(quarantined)
        for sidecar_suffix in ("-wal", "-shm"):
            sidecar = Path(f"{self.path}{sidecar_suffix}")
            if sidecar.exists():
                sidecar.replace(Path(f"{quarantined}{sidecar_suffix}"))
        return quarantined


__all__ = ["RoomStateStore"]
