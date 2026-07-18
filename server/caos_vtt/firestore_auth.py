from __future__ import annotations

import base64
import binascii
import json
import math
import re
import time
from dataclasses import dataclass
from http.client import HTTPException
from typing import Callable, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


_MAX_TOKEN_BYTES = 16 * 1024
_MAX_HEADER_BYTES = 2 * 1024
_MAX_CLAIMS_BYTES = 12 * 1024
_MAX_SIGNATURE_BYTES = 4 * 1024
_MAX_RESPONSE_BYTES = 1024 * 1024
# A freshly issued Firebase token can be a few seconds ahead of a Windows host
# whose clock has not synchronized yet. Keep this tolerance narrow: Firestore
# remains the authoritative signature check and expired tokens are still
# rejected locally without any grace period.
_CLOCK_SKEW_SECONDS = 60

_BASE64URL_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_PROJECT_ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
_MESA_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_CAMPAIGN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
_ROOM_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class FirestoreAuthError(Exception):
    """Base class for failures while authenticating access to a Mesa."""


class InvalidTokenError(FirestoreAuthError):
    """The supplied Firebase ID token is malformed, expired, or rejected."""


class MesaAccessForbiddenError(FirestoreAuthError):
    """The authenticated Firebase user is not a member of the Mesa."""


class MesaNotFoundError(FirestoreAuthError):
    """The requested Mesa does not exist or is no longer visible."""


class FirestoreUnavailableError(FirestoreAuthError):
    """Firestore could not provide a trustworthy membership decision."""


@dataclass(frozen=True, slots=True)
class VerifiedMesaMember:
    mesa_id: str
    uid: str
    role: Literal["master", "player"]
    room_name: str
    campaign_id: str | None
    linked_room_id: str | None
    server_origin: str | None


Opener = Callable[..., object]


class FirestoreMesaVerifier:
    """Verifies Mesa membership using Firebase Auth and Firestore rules.

    JWT claims are decoded locally only for early, defensive validation. The
    authoritative token/signature decision is made by Firestore when the token
    is used to read the fixed ``mesas/{mesa_id}`` document through its REST API.
    """

    def __init__(
        self,
        project_id: str,
        timeout_seconds: float = 5,
        opener: Opener | None = None,
    ) -> None:
        normalized_project_id = str(project_id).strip()
        if not _PROJECT_ID_PATTERN.fullmatch(normalized_project_id):
            raise ValueError("project_id do Firebase invalido")
        if (
            isinstance(timeout_seconds, bool)
            or not isinstance(timeout_seconds, (int, float))
            or not math.isfinite(timeout_seconds)
            or not 0 < timeout_seconds <= 30
        ):
            raise ValueError("timeout_seconds deve estar entre 0 e 30")

        self.project_id = normalized_project_id
        self.timeout_seconds = float(timeout_seconds)
        self._opener = opener or urlopen

    def verify(self, id_token: str, mesa_id: str) -> VerifiedMesaMember:
        token = _normalize_token(id_token)
        normalized_mesa_id = _normalize_mesa_id(mesa_id)
        claims = _decode_and_validate_claims(token, self.project_id)
        uid = claims["sub"]

        document = self._read_mesa_document(token, normalized_mesa_id)
        return _verified_member(document, normalized_mesa_id, uid)

    def _read_mesa_document(self, token: str, mesa_id: str) -> dict[str, object]:
        url = (
            "https://firestore.googleapis.com/v1/projects/"
            f"{self.project_id}/databases/(default)/documents/mesas/{mesa_id}"
        )
        request = Request(
            url,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="GET",
        )

        response: object | None = None
        try:
            response = self._opener(request, timeout=self.timeout_seconds)
            status = _response_status(response)
            if status != 200:
                _raise_for_status(status)
            payload = _read_bounded_response(response)
        except HTTPError as error:
            _raise_for_status(error.code)
        except (InvalidTokenError, MesaAccessForbiddenError, MesaNotFoundError):
            raise
        except FirestoreUnavailableError:
            raise
        except (TimeoutError, URLError, OSError, HTTPException, ValueError):
            raise FirestoreUnavailableError("Firestore indisponivel") from None
        finally:
            if response is not None:
                close = getattr(response, "close", None)
                if callable(close):
                    close()

        try:
            parsed = json.loads(
                payload.decode("utf-8"),
                object_pairs_hook=_unique_object,
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            raise FirestoreUnavailableError("Resposta invalida do Firestore") from None
        if not isinstance(parsed, dict):
            raise FirestoreUnavailableError("Resposta invalida do Firestore")
        return parsed


def _normalize_token(id_token: str) -> str:
    if not isinstance(id_token, str):
        raise InvalidTokenError("Token Firebase invalido")
    token = id_token.strip()
    if not token or token != id_token or len(token.encode("utf-8")) > _MAX_TOKEN_BYTES:
        raise InvalidTokenError("Token Firebase invalido")
    return token


def _normalize_mesa_id(mesa_id: str) -> str:
    if not isinstance(mesa_id, str):
        raise MesaNotFoundError("Mesa invalida")
    normalized = mesa_id.strip()
    if normalized != mesa_id or not _MESA_ID_PATTERN.fullmatch(normalized):
        raise MesaNotFoundError("Mesa invalida")
    return normalized


def _decode_and_validate_claims(token: str, project_id: str) -> dict[str, object]:
    parts = token.split(".")
    if len(parts) != 3:
        raise InvalidTokenError("Token Firebase invalido")

    header = _decode_json_segment(parts[0], _MAX_HEADER_BYTES)
    claims = _decode_json_segment(parts[1], _MAX_CLAIMS_BYTES)
    signature = _decode_base64url(parts[2], _MAX_SIGNATURE_BYTES)
    if not signature:
        raise InvalidTokenError("Token Firebase invalido")

    if header.get("alg") != "RS256":
        raise InvalidTokenError("Token Firebase invalido")
    kid = header.get("kid")
    if not _safe_text(kid, maximum=512):
        raise InvalidTokenError("Token Firebase invalido")

    expected_issuer = f"https://securetoken.google.com/{project_id}"
    if claims.get("aud") != project_id or claims.get("iss") != expected_issuer:
        raise InvalidTokenError("Token Firebase invalido")

    subject = claims.get("sub")
    if not _safe_text(subject, maximum=128):
        raise InvalidTokenError("Token Firebase invalido")

    issued_at = _numeric_date(claims.get("iat"))
    expires_at = _numeric_date(claims.get("exp"))
    now = time.time()
    if (
        issued_at is None
        or expires_at is None
        or issued_at > now + _CLOCK_SKEW_SECONDS
        or expires_at <= now
        or expires_at <= issued_at
    ):
        raise InvalidTokenError("Token Firebase invalido")
    return claims


def _decode_json_segment(segment: str, maximum: int) -> dict[str, object]:
    decoded = _decode_base64url(segment, maximum)
    try:
        value = json.loads(decoded.decode("utf-8"), object_pairs_hook=_unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        raise InvalidTokenError("Token Firebase invalido") from None
    if not isinstance(value, dict):
        raise InvalidTokenError("Token Firebase invalido")
    return value


def _decode_base64url(segment: str, maximum: int) -> bytes:
    if not segment or not _BASE64URL_PATTERN.fullmatch(segment):
        raise InvalidTokenError("Token Firebase invalido")
    if len(segment) > ((maximum + 2) // 3) * 4:
        raise InvalidTokenError("Token Firebase invalido")
    padding = "=" * (-len(segment) % 4)
    try:
        decoded = base64.b64decode(
            (segment + padding).encode("ascii"),
            altchars=b"-_",
            validate=True,
        )
    except (ValueError, binascii.Error):
        raise InvalidTokenError("Token Firebase invalido") from None
    if len(decoded) > maximum:
        raise InvalidTokenError("Token Firebase invalido")
    return decoded


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value: dict[str, object] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def _numeric_date(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    return numeric if math.isfinite(numeric) and numeric >= 0 else None


def _safe_text(value: object, *, maximum: int, allow_empty: bool = False) -> bool:
    if not isinstance(value, str) or len(value) > maximum:
        return False
    if not value:
        return allow_empty
    return value == value.strip() and all(character.isprintable() for character in value)


def _response_status(response: object) -> int:
    status = getattr(response, "status", None)
    if status is None:
        getcode = getattr(response, "getcode", None)
        status = getcode() if callable(getcode) else None
    if isinstance(status, bool) or not isinstance(status, int):
        raise FirestoreUnavailableError("Resposta invalida do Firestore")
    return status


def _raise_for_status(status: int) -> None:
    if status == 401:
        raise InvalidTokenError("Token Firebase rejeitado")
    if status == 403:
        raise MesaAccessForbiddenError("Acesso a Mesa negado")
    if status == 404:
        raise MesaNotFoundError("Mesa nao encontrada")
    raise FirestoreUnavailableError("Firestore indisponivel")


def _read_bounded_response(response: object) -> bytes:
    headers = getattr(response, "headers", None)
    if headers is None:
        content_length = None
    else:
        get_header = getattr(headers, "get", None)
        if not callable(get_header):
            raise FirestoreUnavailableError("Resposta invalida do Firestore")
        content_length = get_header("Content-Length")
    if content_length is not None:
        try:
            declared_length = int(content_length)
        except (TypeError, ValueError):
            raise FirestoreUnavailableError("Resposta invalida do Firestore") from None
        if declared_length < 0 or declared_length > _MAX_RESPONSE_BYTES:
            raise FirestoreUnavailableError("Resposta excessiva do Firestore")

    read = getattr(response, "read", None)
    if not callable(read):
        raise FirestoreUnavailableError("Resposta invalida do Firestore")
    payload = read(_MAX_RESPONSE_BYTES + 1)
    if not isinstance(payload, bytes) or len(payload) > _MAX_RESPONSE_BYTES:
        raise FirestoreUnavailableError("Resposta excessiva do Firestore")
    return payload


def _verified_member(
    document: dict[str, object],
    mesa_id: str,
    uid: str,
) -> VerifiedMesaMember:
    fields = document.get("fields")
    if not isinstance(fields, dict):
        raise FirestoreUnavailableError("Schema da Mesa invalido")

    master_uid = _required_firestore_string(fields, "mestre", maximum=128)
    room_name = _required_firestore_string(fields, "nome", maximum=80)
    member_uids = _required_firestore_string_array(
        fields,
        "membroUids",
        maximum_items=1024,
        maximum_string=128,
    )
    if master_uid not in member_uids:
        raise FirestoreUnavailableError("Schema da Mesa invalido")

    if uid == master_uid:
        role: Literal["master", "player"] = "master"
    elif uid in member_uids:
        role = "player"
    else:
        raise MesaAccessForbiddenError("Usuario nao pertence a Mesa")

    campaign_id: str | None = None
    linked_room_id: str | None = None
    server_origin: str | None = None
    vtt_value = fields.get("vtt")
    if vtt_value is not None:
        vtt_fields = _firestore_map_fields(vtt_value, "vtt")
        campaign_id = _optional_firestore_string(vtt_fields, "campaignId", maximum=80)
        linked_room_id = _optional_firestore_string(
            vtt_fields,
            "roomId",
            maximum=128,
            allow_empty=True,
        )
        server_origin = _optional_firestore_string(vtt_fields, "serverOrigin", maximum=2048)

        if campaign_id is not None and not _CAMPAIGN_ID_PATTERN.fullmatch(campaign_id):
            raise FirestoreUnavailableError("Schema VTT da Mesa invalido")
        if linked_room_id == "":
            linked_room_id = None
        if linked_room_id is not None and not _ROOM_ID_PATTERN.fullmatch(linked_room_id):
            raise FirestoreUnavailableError("Schema VTT da Mesa invalido")
        if server_origin is not None:
            server_origin = _normalize_server_origin(server_origin)

    return VerifiedMesaMember(
        mesa_id=mesa_id,
        uid=uid,
        role=role,
        room_name=room_name,
        campaign_id=campaign_id,
        linked_room_id=linked_room_id,
        server_origin=server_origin,
    )


def _required_firestore_string(
    fields: dict[str, object],
    name: str,
    *,
    maximum: int,
) -> str:
    value = _optional_firestore_string(fields, name, maximum=maximum, required=True)
    assert value is not None
    return value


def _optional_firestore_string(
    fields: dict[str, object],
    name: str,
    *,
    maximum: int,
    required: bool = False,
    allow_empty: bool = False,
) -> str | None:
    raw = fields.get(name)
    if raw is None:
        if required:
            raise FirestoreUnavailableError("Schema da Mesa invalido")
        return None
    if not isinstance(raw, dict):
        raise FirestoreUnavailableError("Schema da Mesa invalido")
    if set(raw) == {"nullValue"}:
        null_value = raw["nullValue"]
        if null_value is None or null_value == "NULL_VALUE":
            if required:
                raise FirestoreUnavailableError("Schema da Mesa invalido")
            return None
        raise FirestoreUnavailableError("Schema da Mesa invalido")
    if set(raw) != {"stringValue"}:
        raise FirestoreUnavailableError("Schema da Mesa invalido")
    value = raw["stringValue"]
    if not _safe_text(value, maximum=maximum, allow_empty=allow_empty):
        raise FirestoreUnavailableError("Schema da Mesa invalido")
    return value


def _required_firestore_string_array(
    fields: dict[str, object],
    name: str,
    *,
    maximum_items: int,
    maximum_string: int,
) -> frozenset[str]:
    raw = fields.get(name)
    if not isinstance(raw, dict) or set(raw) != {"arrayValue"}:
        raise FirestoreUnavailableError("Schema da Mesa invalido")
    array_value = raw["arrayValue"]
    if not isinstance(array_value, dict) or not set(array_value).issubset({"values"}):
        raise FirestoreUnavailableError("Schema da Mesa invalido")
    values = array_value.get("values", [])
    if not isinstance(values, list) or len(values) > maximum_items:
        raise FirestoreUnavailableError("Schema da Mesa invalido")

    members: set[str] = set()
    for item in values:
        if not isinstance(item, dict) or set(item) != {"stringValue"}:
            raise FirestoreUnavailableError("Schema da Mesa invalido")
        member_uid = item["stringValue"]
        if not _safe_text(member_uid, maximum=maximum_string):
            raise FirestoreUnavailableError("Schema da Mesa invalido")
        if member_uid in members:
            raise FirestoreUnavailableError("Schema da Mesa invalido")
        members.add(member_uid)
    return frozenset(members)


def _firestore_map_fields(value: object, field_name: str) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != {"mapValue"}:
        raise FirestoreUnavailableError(f"Schema {field_name} da Mesa invalido")
    map_value = value["mapValue"]
    if not isinstance(map_value, dict) or not set(map_value).issubset({"fields"}):
        raise FirestoreUnavailableError(f"Schema {field_name} da Mesa invalido")
    fields = map_value.get("fields", {})
    if not isinstance(fields, dict):
        raise FirestoreUnavailableError(f"Schema {field_name} da Mesa invalido")
    return fields


def _normalize_server_origin(value: str) -> str:
    try:
        parsed = urlsplit(value)
    except ValueError:
        raise FirestoreUnavailableError("serverOrigin da Mesa invalida") from None
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise FirestoreUnavailableError("serverOrigin da Mesa invalida")
    try:
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        raise FirestoreUnavailableError("serverOrigin da Mesa invalida") from None
    if not hostname or port == 0:
        raise FirestoreUnavailableError("serverOrigin da Mesa invalida")

    scheme = parsed.scheme.lower()
    try:
        ascii_hostname = hostname.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise FirestoreUnavailableError("serverOrigin da Mesa invalida") from None
    rendered_host = f"[{ascii_hostname}]" if ":" in ascii_hostname else ascii_hostname
    default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    rendered_port = "" if port is None or default_port else f":{port}"
    return f"{scheme}://{rendered_host}{rendered_port}"


__all__ = [
    "FirestoreAuthError",
    "FirestoreMesaVerifier",
    "FirestoreUnavailableError",
    "InvalidTokenError",
    "MesaAccessForbiddenError",
    "MesaNotFoundError",
    "VerifiedMesaMember",
]
