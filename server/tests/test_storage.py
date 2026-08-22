from __future__ import annotations

import sqlite3
from pathlib import Path

from caos_vtt import storage
from caos_vtt.storage import RoomStateStore


class _TrackedConnection(sqlite3.Connection):
    was_closed = False

    def close(self) -> None:
        self.was_closed = True
        super().close()


def test_sqlite_connections_are_closed_after_each_operation(
    tmp_path: Path,
    monkeypatch,
) -> None:
    original_connect = storage.sqlite3.connect
    connections: list[_TrackedConnection] = []

    def tracked_connect(*args, **kwargs):
        connection = original_connect(*args, factory=_TrackedConnection, **kwargs)
        connections.append(connection)
        return connection

    monkeypatch.setattr(storage.sqlite3, "connect", tracked_connect)
    store = RoomStateStore(tmp_path / "rooms.sqlite3")
    payload = {"roomId": "room-1", "externalMesaId": None, "revision": 0}

    store.save(payload)
    assert store.load_all() == (("room-1", payload),)
    store.quarantine("room-1", payload, "teste")

    assert connections
    assert all(connection.was_closed for connection in connections)
