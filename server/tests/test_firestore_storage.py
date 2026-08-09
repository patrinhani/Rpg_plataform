from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from caos_vtt.storage import FirestoreRoomStateStore


@dataclass
class _Snapshot:
    id: str
    payload: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return dict(self.payload)


class _Document:
    def __init__(self, collection: "_Collection", document_id: str) -> None:
        self.collection = collection
        self.document_id = document_id

    def set(self, payload: dict[str, Any]) -> None:
        self.collection.documents[self.document_id] = dict(payload)

    def delete(self) -> None:
        self.collection.documents.pop(self.document_id, None)


class _Collection:
    def __init__(self) -> None:
        self.documents: dict[str, dict[str, Any]] = {}
        self.generated = 0

    def document(self, document_id: str | None = None) -> _Document:
        if document_id is None:
            self.generated += 1
            document_id = f"generated-{self.generated}"
        return _Document(self, document_id)

    def stream(self):
        return tuple(
            _Snapshot(document_id, payload)
            for document_id, payload in self.documents.items()
        )


class _Client:
    def __init__(self) -> None:
        self.collections: dict[str, _Collection] = {}

    def collection(self, name: str) -> _Collection:
        return self.collections.setdefault(name, _Collection())


def _room_payload(room_id: str = "ABCDEFGH") -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "roomId": room_id,
        "externalMesaId": "mesa-1",
        "name": "Mesa cloud",
        "campaignId": "caos-empty",
        "fog": "A" * 120_000,
    }


def test_firestore_store_round_trips_compressed_room_state() -> None:
    client = _Client()
    store = FirestoreRoomStateStore(
        "sistemarpg-14d7d",
        "vttRoomStatesTest",
        client=client,
    )
    payload = _room_payload()

    store.save(payload)

    document = client.collection("vttRoomStatesTest").documents["ABCDEFGH"]
    assert document["encoding"] == "zlib-json-v1"
    assert isinstance(document["payload"], bytes)
    assert len(document["payload"]) < len(payload["fog"])
    assert store.load_all() == (("ABCDEFGH", payload),)


def test_firestore_store_quarantines_corrupt_document() -> None:
    client = _Client()
    rooms = client.collection("vttRoomStatesTest")
    rooms.documents["ABCDEFGH"] = {
        "encoding": "zlib-json-v1",
        "roomId": "ABCDEFGH",
        "payload": b"not-zlib",
    }
    store = FirestoreRoomStateStore(
        "sistemarpg-14d7d",
        "vttRoomStatesTest",
        client=client,
    )

    assert store.load_all() == ()
    assert "ABCDEFGH" not in rooms.documents
    quarantine = client.collection("vttRoomStatesTestQuarantine").documents
    assert len(quarantine) == 1
    assert next(iter(quarantine.values()))["roomId"] == "ABCDEFGH"
