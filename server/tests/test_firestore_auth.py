from __future__ import annotations

import base64
import json
import time
from urllib.error import HTTPError, URLError

import pytest

from caos_vtt.firestore_auth import (
    FirestoreMesaVerifier,
    FirestoreUnavailableError,
    InvalidTokenError,
    MesaAccessForbiddenError,
    MesaNotFoundError,
    VerifiedMesaMember,
)


PROJECT_ID = "caos-test-project"
MESA_ID = "mesa-mnemosyne"


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _token(uid: str = "uid-master", **claim_overrides: object) -> str:
    now = int(time.time())
    header = {"alg": "RS256", "kid": "firebase-test-key", "typ": "JWT"}
    claims: dict[str, object] = {
        "aud": PROJECT_ID,
        "iss": f"https://securetoken.google.com/{PROJECT_ID}",
        "sub": uid,
        "iat": now - 30,
        "exp": now + 300,
    }
    header_overrides = claim_overrides.pop("_header", None)
    claims.update(claim_overrides)
    if header_overrides is not None:
        header.update(header_overrides)  # type: ignore[arg-type]
    return ".".join(
        (
            _base64url(json.dumps(header, separators=(",", ":")).encode()),
            _base64url(json.dumps(claims, separators=(",", ":")).encode()),
            _base64url(b"not-a-real-signature"),
        )
    )


def _string(value: str) -> dict[str, str]:
    return {"stringValue": value}


def _array(*values: str) -> dict[str, object]:
    return {"arrayValue": {"values": [_string(value) for value in values]}}


def _map(**fields: object) -> dict[str, object]:
    return {"mapValue": {"fields": fields}}


def _document(
    *,
    master: str = "uid-master",
    members: tuple[str, ...] = ("uid-master", "uid-player"),
    include_members: bool = True,
    vtt: object | None = None,
) -> dict[str, object]:
    fields: dict[str, object] = {
        "mestre": _string(master),
        "nome": _string("Operacao Mnemosyne"),
    }
    if include_members:
        fields["membroUids"] = _array(*members)
    if vtt is not None:
        fields["vtt"] = vtt
    return {
        "name": (
            f"projects/{PROJECT_ID}/databases/(default)/documents/mesas/{MESA_ID}"
        ),
        "fields": fields,
    }


class FakeResponse:
    def __init__(
        self,
        body: bytes,
        *,
        status: int = 200,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.body = body
        self.status = status
        self.headers = headers or {}
        self.closed = False
        self.read_limit: int | None = None

    def read(self, amount: int) -> bytes:
        self.read_limit = amount
        return self.body[:amount]

    def close(self) -> None:
        self.closed = True


class RecordingOpener:
    def __init__(self, document: dict[str, object]) -> None:
        body = json.dumps(document, separators=(",", ":")).encode()
        self.response = FakeResponse(body)
        self.request = None
        self.timeout = None

    def __call__(self, request, *, timeout: float):
        self.request = request
        self.timeout = timeout
        return self.response


def test_verifies_master_through_fixed_firestore_document_read() -> None:
    opener = RecordingOpener(
        _document(
            vtt=_map(
                campaignId=_string("mnemosyne"),
                roomId=_string("room-42"),
                serverOrigin=_string("HTTPS://VTT.Example.COM:443"),
            )
        )
    )
    token = _token()

    verified = FirestoreMesaVerifier(
        PROJECT_ID,
        timeout_seconds=3,
        opener=opener,
    ).verify(token, MESA_ID)

    assert verified == VerifiedMesaMember(
        mesa_id=MESA_ID,
        uid="uid-master",
        role="master",
        room_name="Operacao Mnemosyne",
        campaign_id="mnemosyne",
        linked_room_id="room-42",
        server_origin="https://vtt.example.com",
    )
    assert opener.request.full_url == (
        "https://firestore.googleapis.com/v1/projects/caos-test-project/"
        "databases/(default)/documents/mesas/mesa-mnemosyne"
    )
    assert opener.request.get_method() == "GET"
    assert opener.request.get_header("Authorization") == f"Bearer {token}"
    assert opener.timeout == 3
    assert opener.response.closed


def test_verifies_player_only_from_required_member_uid_array() -> None:
    verified = FirestoreMesaVerifier(
        PROJECT_ID,
        opener=RecordingOpener(_document()),
    ).verify(_token("uid-player"), MESA_ID)

    assert verified.role == "player"
    assert verified.uid == "uid-player"
    assert verified.campaign_id is None
    assert verified.linked_room_id is None
    assert verified.server_origin is None


def test_ignores_spoofed_role_and_room_claims() -> None:
    opener = RecordingOpener(
        _document(
            vtt=_map(
                campaignId=_string("mnemosyne"),
                roomId=_string("trusted-room"),
            )
        )
    )
    token = _token(
        "uid-player",
        role="master",
        roomId="attacker-room",
        campaignId="attacker-campaign",
    )

    verified = FirestoreMesaVerifier(PROJECT_ID, opener=opener).verify(token, MESA_ID)

    assert verified.role == "player"
    assert verified.linked_room_id == "trusted-room"
    assert verified.campaign_id == "mnemosyne"


def test_rejects_authenticated_user_outside_mesa() -> None:
    token = _token("uid-outsider")

    with pytest.raises(MesaAccessForbiddenError) as raised:
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(_document()),
        ).verify(token, MESA_ID)

    assert token not in str(raised.value)


@pytest.mark.parametrize(
    "token",
    (
        "not-a-jwt",
        "a.b.c.d",
        "=.e30.c2ln",
        f"{_base64url(b'[]')}.{_base64url(b'{}')}.c2ln",
        f"{_base64url(b'{bad json')}.{_base64url(b'{}')}.c2ln",
    ),
)
def test_rejects_malformed_jwt_before_network(token: str) -> None:
    called = False

    def opener(*_args, **_kwargs):
        nonlocal called
        called = True
        raise AssertionError("network must not be called")

    with pytest.raises(InvalidTokenError):
        FirestoreMesaVerifier(PROJECT_ID, opener=opener).verify(token, MESA_ID)

    assert not called


@pytest.mark.parametrize(
    "overrides",
    (
        {"aud": "other-project"},
        {"aud": [PROJECT_ID]},
        {"iss": "https://securetoken.google.com/other-project"},
        {"sub": ""},
        {"sub": " uid-player"},
        {"sub": "uid\nplayer"},
        {"sub": "x" * 129},
        {"iat": int(time.time()) + 61},
        {"iat": "yesterday"},
        {"exp": int(time.time()) - 1},
        {"exp": True},
        {"iat": int(time.time()) + 10, "exp": int(time.time()) + 5},
        {"_header": {"alg": "none"}},
        {"_header": {"kid": ""}},
    ),
)
def test_rejects_invalid_firebase_claims_before_network(
    overrides: dict[str, object],
) -> None:
    def opener(*_args, **_kwargs):
        raise AssertionError("network must not be called")

    with pytest.raises(InvalidTokenError):
        FirestoreMesaVerifier(PROJECT_ID, opener=opener).verify(
            _token(**overrides),
            MESA_ID,
        )


def test_allows_narrow_clock_skew_for_fresh_token() -> None:
    opener = RecordingOpener(_document())
    now = int(time.time())

    verified = FirestoreMesaVerifier(PROJECT_ID, opener=opener).verify(
        _token(iat=now + 59, exp=now + 3600),
        MESA_ID,
    )

    assert verified.uid == "uid-master"
    assert opener.request is not None


def test_rejects_oversized_token_and_invalid_mesa_id_before_network() -> None:
    verifier = FirestoreMesaVerifier(
        PROJECT_ID,
        opener=lambda *_args, **_kwargs: pytest.fail("network must not be called"),
    )

    with pytest.raises(InvalidTokenError):
        verifier.verify("x" * (16 * 1024 + 1), MESA_ID)
    with pytest.raises(MesaNotFoundError):
        verifier.verify(_token(), "../private")


@pytest.mark.parametrize(
    ("status", "expected_error"),
    (
        (400, FirestoreUnavailableError),
        (401, InvalidTokenError),
        (403, MesaAccessForbiddenError),
        (404, MesaNotFoundError),
        (429, FirestoreUnavailableError),
        (500, FirestoreUnavailableError),
        (503, FirestoreUnavailableError),
    ),
)
def test_maps_firestore_http_errors(status: int, expected_error: type[Exception]) -> None:
    def opener(request, *, timeout: float):
        del timeout
        raise HTTPError(request.full_url, status, "failed", {}, None)

    token = _token()
    with pytest.raises(expected_error) as raised:
        FirestoreMesaVerifier(PROJECT_ID, opener=opener).verify(token, MESA_ID)

    assert token not in str(raised.value)


def test_maps_non_exception_http_status_and_network_failure_fail_closed() -> None:
    response = FakeResponse(b"{}", status=403)
    with pytest.raises(MesaAccessForbiddenError):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=lambda *_args, **_kwargs: response,
        ).verify(_token(), MESA_ID)
    assert response.closed

    def unavailable(*_args, **_kwargs):
        raise URLError("offline")

    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaVerifier(PROJECT_ID, opener=unavailable).verify(_token(), MESA_ID)


def test_legacy_schema_without_member_uids_fails_closed() -> None:
    with pytest.raises(FirestoreUnavailableError, match="Schema"):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(_document(include_members=False)),
        ).verify(_token(), MESA_ID)


@pytest.mark.parametrize(
    "members",
    (
        ("uid-player",),
        ("uid-master", "uid-player", "uid-player"),
    ),
)
def test_rejects_membership_without_master_or_with_duplicate_uid(
    members: tuple[str, ...],
) -> None:
    with pytest.raises(FirestoreUnavailableError, match="Schema"):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(_document(members=members)),
        ).verify(_token(), MESA_ID)


@pytest.mark.parametrize(
    "members_field",
    (
        {"stringValue": "uid-player"},
        {"arrayValue": {"values": [{"integerValue": "1"}]}},
        {"arrayValue": {"values": "uid-player"}},
    ),
)
def test_rejects_ambiguous_typed_member_schema(members_field: object) -> None:
    document = _document()
    document["fields"]["membroUids"] = members_field  # type: ignore[index]

    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(document),
        ).verify(_token("uid-player"), MESA_ID)


def test_rejects_oversized_firestore_response_without_unbounded_read() -> None:
    response = FakeResponse(b"x" * (1024 * 1024 + 1))

    with pytest.raises(FirestoreUnavailableError, match="excessiva"):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=lambda *_args, **_kwargs: response,
        ).verify(_token(), MESA_ID)

    assert response.read_limit == 1024 * 1024 + 1
    assert response.closed


def test_rejects_declared_oversized_and_duplicate_json_response() -> None:
    oversized = FakeResponse(b"{}", headers={"Content-Length": str(1024 * 1024 + 1)})
    with pytest.raises(FirestoreUnavailableError, match="excessiva"):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=lambda *_args, **_kwargs: oversized,
        ).verify(_token(), MESA_ID)
    assert oversized.read_limit is None

    duplicate = FakeResponse(b'{"fields":{},"fields":{}}')
    with pytest.raises(FirestoreUnavailableError, match="Resposta invalida"):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=lambda *_args, **_kwargs: duplicate,
        ).verify(_token(), MESA_ID)


@pytest.mark.parametrize(
    "vtt",
    (
        {"stringValue": "not-a-map"},
        _map(campaignId={"integerValue": "42"}),
        _map(campaignId=_string("../campaign")),
        _map(roomId=_string("../room")),
        _map(serverOrigin=_string("https://trusted.example/path")),
        _map(serverOrigin=_string("https://user:pass@trusted.example")),
    ),
)
def test_rejects_invalid_vtt_document_values(vtt: object) -> None:
    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(_document(vtt=vtt)),
        ).verify(_token(), MESA_ID)


def test_accepts_master_only_member_array_and_null_optional_vtt_fields() -> None:
    verified = FirestoreMesaVerifier(
        PROJECT_ID,
        opener=RecordingOpener(
            _document(
                members=("uid-master",),
                vtt=_map(
                    roomId={"nullValue": "NULL_VALUE"},
                    serverOrigin={"nullValue": None},
                ),
            )
        ),
    ).verify(_token(), MESA_ID)

    assert verified.role == "master"
    assert verified.linked_room_id is None
    assert verified.server_origin is None


def test_accepts_legacy_empty_linked_room_but_rejects_malformed_null_value() -> None:
    verified = FirestoreMesaVerifier(
        PROJECT_ID,
        opener=RecordingOpener(_document(vtt=_map(roomId=_string("")))),
    ).verify(_token(), MESA_ID)
    assert verified.linked_room_id is None

    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(
                _document(vtt=_map(roomId={"nullValue": {"spoof": True}}))
            ),
        ).verify(_token(), MESA_ID)


@pytest.mark.parametrize(
    "origin",
    (
        "https://[broken",
        "http://localhost:0",
    ),
)
def test_malformed_server_origin_always_uses_typed_failure(origin: str) -> None:
    with pytest.raises(FirestoreUnavailableError):
        FirestoreMesaVerifier(
            PROJECT_ID,
            opener=RecordingOpener(
                _document(vtt=_map(serverOrigin=_string(origin)))
            ),
        ).verify(_token(), MESA_ID)


@pytest.mark.parametrize(
    ("project_id", "timeout"),
    (
        ("../project", 5),
        (PROJECT_ID, 0),
        (PROJECT_ID, 31),
        (PROJECT_ID, float("inf")),
    ),
)
def test_constructor_rejects_unsafe_configuration(
    project_id: str,
    timeout: float,
) -> None:
    with pytest.raises(ValueError):
        FirestoreMesaVerifier(project_id, timeout_seconds=timeout)
