from __future__ import annotations

import json
import sqlite3
import threading
import warnings
import zlib
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol


DATABASE_SCHEMA_VERSION = 1
FIRESTORE_STORAGE_ENCODING = "zlib-json-v1"
MAX_FIRESTORE_COMPRESSED_BYTES = 900_000
MAX_FIRESTORE_DECOMPRESSED_BYTES = 8 * 1024 * 1024


class RoomStateStoreBackend(Protocol):
    """Persistence contract used by the VTT independently of its provider."""

    def load_all(self) -> tuple[tuple[str, dict[str, Any]], ...]: ...

    def save(self, payload: dict[str, Any]) -> None: ...

    def quarantine(self, room_id: str, payload: dict[str, Any] | str, reason: str) -> None: ...


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
        with self._schema_lock, closing(self._connect()) as connection, connection:
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
            with closing(self._connect()) as connection:
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
        with closing(self._connect()) as connection, connection:
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
        with closing(self._connect()) as connection, connection:
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


def _encode_firestore_payload(payload: dict[str, Any]) -> bytes:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    compressed = zlib.compress(encoded, level=9)
    if len(compressed) > MAX_FIRESTORE_COMPRESSED_BYTES:
        raise ValueError("Estado da sala excede o limite seguro de um documento Firestore")
    return compressed


def _decode_firestore_payload(raw: Any) -> dict[str, Any]:
    if isinstance(raw, memoryview):
        raw = raw.tobytes()
    if not isinstance(raw, bytes) or len(raw) > MAX_FIRESTORE_COMPRESSED_BYTES:
        raise ValueError("Payload Firestore invalido")

    decompressor = zlib.decompressobj()
    decoded = decompressor.decompress(raw, MAX_FIRESTORE_DECOMPRESSED_BYTES + 1)
    if (
        len(decoded) > MAX_FIRESTORE_DECOMPRESSED_BYTES
        or decompressor.unconsumed_tail
        or not decompressor.eof
    ):
        raise ValueError("Payload Firestore excede o limite descompactado")
    try:
        payload = json.loads(decoded.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Payload Firestore nao contem JSON valido") from error
    if not isinstance(payload, dict):
        raise ValueError("Payload Firestore nao e um objeto")
    return payload


class FirestoreRoomStateStore:
    """Durable room snapshots for ephemeral cloud runtimes such as Render."""

    def __init__(
        self,
        project_id: str,
        collection_name: str = "vttRoomStates",
        *,
        client: Any | None = None,
    ) -> None:
        if client is None:
            try:
                from google.cloud import firestore
            except ImportError as error:  # pragma: no cover - installation failure
                raise RuntimeError(
                    "Instale google-cloud-firestore para usar persistencia Firestore"
                ) from error
            client = firestore.Client(project=project_id)
        self._rooms = client.collection(collection_name)
        self._quarantine = client.collection(f"{collection_name}Quarantine")

    def load_all(self) -> tuple[tuple[str, dict[str, Any]], ...]:
        payloads: list[tuple[str, dict[str, Any]]] = []
        for snapshot in self._rooms.stream():
            room_id = str(snapshot.id)
            document = snapshot.to_dict()
            try:
                if not isinstance(document, dict):
                    raise ValueError("Documento Firestore invalido")
                if document.get("encoding") != FIRESTORE_STORAGE_ENCODING:
                    raise ValueError("Codificacao Firestore desconhecida")
                if document.get("roomId") != room_id:
                    raise ValueError("roomId diverge do documento Firestore")
                payload = _decode_firestore_payload(document.get("payload"))
            except (TypeError, ValueError, zlib.error) as error:
                warnings.warn(
                    f"Uma sala Firestore invalida foi ignorada: {error}",
                    RuntimeWarning,
                    stacklevel=2,
                )
                self.quarantine(room_id, str(document), str(error))
                continue
            payloads.append((room_id, payload))
        payloads.sort(key=lambda item: item[0])
        return tuple(payloads)

    def save(self, payload: dict[str, Any]) -> None:
        room_id = str(payload["roomId"])
        self._rooms.document(room_id).set(
            {
                "encoding": FIRESTORE_STORAGE_ENCODING,
                "roomId": room_id,
                "externalMesaId": payload.get("externalMesaId"),
                "payload": _encode_firestore_payload(payload),
                "updatedAt": datetime.now(UTC),
            }
        )

    def quarantine(self, room_id: str, payload: dict[str, Any] | str, reason: str) -> None:
        encoded = (
            payload
            if isinstance(payload, str)
            else json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        )
        self._quarantine.document().set(
            {
                "roomId": room_id,
                "payloadPreview": encoded[:32_000],
                "reason": str(reason)[:1_000],
                "quarantinedAt": datetime.now(UTC),
            }
        )
        self._rooms.document(room_id).delete()


__all__ = [
    "FirestoreRoomStateStore",
    "RoomStateStore",
    "RoomStateStoreBackend",
]
