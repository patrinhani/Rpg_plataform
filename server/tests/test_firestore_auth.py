from __future__ import annotations

import io
import json
from datetime import UTC, datetime, timedelta
from urllib.error import HTTPError, URLError

import pytest

from caos_vtt.firestore_auth import (
    FirestoreMesaGrantVerifier,
    FirestoreUnavailableError,
    InvalidGrantError,
)


PROJECT_ID = "caos-test-project"
MESA_ID = "mesa-integrada"
CHALLENGE = "a" * 43
NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


class _Response:
    def __init__(self, payload: bytes) -> None:
        self._stream = io.BytesIO(payload)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self, size: int = -1) -> bytes:
        return self._stream.read(size)


def _document(**overrides):
    values = {
        "challenge": CHALLENGE,
        "mesaId": MESA_ID,
        "uid": "uid-mestre",
        "role": "master",
        "roomName": "Mnemosyne",
        "campaignId": "memoria",
        "issuedAt": NOW.isoformat().replace("+00:00", "Z"),
    }
    values.update(overrides)
    fields = {
        key: ({"timestampValue": value} if key == "issuedAt" else {"stringValue": value})
        for key, value in values.items()
    }
    return {
        "name": (
            f"projects/{PROJECT_ID}/databases/(default)/documents/"
            f"vttAccessGrants/{CHALLENGE}"
        ),
        "fields": fields,
    }


def _opener_for(document, calls: list | None = None):
    payload = json.dumps(document).encode("utf-8")

    def opener(request, *, timeout):
        if calls is not None:
            calls.append((request, timeout))
        return _Response(payload)

    return opener


def _verifier(document=None, **kwargs):
    return FirestoreMesaGrantVerifier(
        PROJECT_ID,
        opener=_opener_for(document or _document()),
        now_factory=lambda: NOW,
        **kwargs,
    )


def test_verifier_reads_anonymous_short_grant_and_derives_role() -> None:
    calls: list = []
    verifier = FirestoreMesaGrantVerifier(
        PROJECT_ID,
        opener=_opener_for(_document(), calls),
        now_factory=lambda: NOW,
    )

    grant = verifier.verify(CHALLENGE, MESA_ID)

    assert grant.uid == "uid-mestre"
    assert grant.role == "master"
    assert grant.room_name == "Mnemosyne"
    assert grant.campaign_id == "memoria"
    assert grant.expires_at == NOW + timedelta(minutes=5)
    request, timeout = calls[0]
    assert timeout == 5.0
    assert request.full_url.endswith(f"/vttAccessGrants/{CHALLENGE}")
    assert request.get_header("Authorization") is None


@pytest.mark.parametrize(
    "overrides",
    (
        {"challenge": "b" * 43},
        {"mesaId": "outra-mesa"},
        {"role": "admin"},
        {"uid": ""},
        {"roomName": ""},
        {"campaignId": "campanha/invalida"},
        {"issuedAt": (NOW - timedelta(minutes=5)).isoformat()},
        {"issuedAt": (NOW + timedelta(seconds=61)).isoformat()},
    ),
)
def test_verifier_rejects_forged_expired_or_future_grants(overrides) -> None:
    with pytest.raises(InvalidGrantError):
        _verifier(_document(**overrides)).verify(CHALLENGE, MESA_ID)


def test_verifier_rejects_extra_fields_and_unexpected_document_name() -> None:
    extra = _document()
    extra["fields"]["serverOrigin"] = {"stringValue": "https://example.com"}
    with pytest.raises(InvalidGrantError):
        _verifier(extra).verify(CHALLENGE, MESA_ID)

    wrong_name = _document()
    wrong_name["name"] += "-copiado"
    with pytest.raises(InvalidGrantError):
        _verifier(wrong_name).verify(CHALLENGE, MESA_ID)


@pytest.mark.parametrize("status", (400, 401, 403, 404))
def test_missing_or_denied_grants_are_invalid(status: int) -> None:
    def opener(request, *, timeout):
        raise HTTPError(request.full_url, status, "denied", {}, None)

    verifier = FirestoreMesaGrantVerifier(PROJECT_ID, opener=opener)
    with pytest.raises(InvalidGrantError):
        verifier.verify(CHALLENGE, MESA_ID)


@pytest.mark.parametrize("status", (429, 500, 503))
def test_transient_firestore_errors_are_unavailable(status: int) -> None:
    def opener(request, *, timeout):
        raise HTTPError(request.full_url, status, "unavailable", {}, None)

    verifier = FirestoreMesaGrantVerifier(PROJECT_ID, opener=opener)
    with pytest.raises(FirestoreUnavailableError):
        verifier.verify(CHALLENGE, MESA_ID)


def test_network_and_oversized_responses_fail_closed() -> None:
    def network_error(_request, *, timeout):
        raise URLError("offline")

    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaGrantVerifier(PROJECT_ID, opener=network_error).verify(
            CHALLENGE, MESA_ID
        )

    def oversized(_request, *, timeout):
        return _Response(b"x" * (64 * 1024 + 1))

    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaGrantVerifier(PROJECT_ID, opener=oversized).verify(
            CHALLENGE, MESA_ID
        )


@pytest.mark.parametrize(
    ("project_id", "challenge", "mesa_id", "error_type"),
    (
        ("INVALID", CHALLENGE, MESA_ID, ValueError),
        (PROJECT_ID, "short", MESA_ID, InvalidGrantError),
        (PROJECT_ID, CHALLENGE, "mesa/invalida", InvalidGrantError),
    ),
)
def test_identifiers_are_strictly_validated(project_id, challenge, mesa_id, error_type) -> None:
    with pytest.raises(error_type):
        FirestoreMesaGrantVerifier(
            project_id,
            opener=_opener_for(_document()),
        ).verify(challenge, mesa_id)
