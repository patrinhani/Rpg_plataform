from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .models import Role


GRANT_TTL_SECONDS = 5 * 60
MAX_CLOCK_SKEW_SECONDS = 60
MAX_FIRESTORE_RESPONSE_BYTES = 64 * 1024
PROJECT_ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]{4,61}[a-z0-9]$")
CHALLENGE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{32,128}$")
MESA_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
CAMPAIGN_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")


class FirestoreGrantError(Exception):
    """Base error for short-lived Firestore VTT grants."""


class InvalidGrantError(FirestoreGrantError):
    """The capability is missing, expired, malformed, or belongs elsewhere."""


class FirestoreUnavailableError(FirestoreGrantError):
    """Firestore could not be consulted safely right now."""


@dataclass(frozen=True, slots=True)
class VerifiedMesaGrant:
    mesa_id: str
    uid: str
    role: Role
    room_name: str
    campaign_id: str
    issued_at: datetime
    expires_at: datetime


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _string_field(fields: dict[str, Any], name: str) -> str:
    value = fields.get(name)
    if not isinstance(value, dict) or set(value) != {"stringValue"}:
        raise InvalidGrantError("Campo obrigatorio ausente no grant")
    text = value.get("stringValue")
    if not isinstance(text, str):
        raise InvalidGrantError("Campo textual invalido no grant")
    return text


def _timestamp_field(fields: dict[str, Any], name: str) -> datetime:
    value = fields.get(name)
    if not isinstance(value, dict) or set(value) != {"timestampValue"}:
        raise InvalidGrantError("Data obrigatoria ausente no grant")
    encoded = value.get("timestampValue")
    if not isinstance(encoded, str):
        raise InvalidGrantError("Data invalida no grant")
    try:
        parsed = datetime.fromisoformat(encoded.replace("Z", "+00:00"))
    except ValueError as error:
        raise InvalidGrantError("Data invalida no grant") from error
    if parsed.tzinfo is None:
        raise InvalidGrantError("Data sem fuso horario no grant")
    return parsed.astimezone(UTC)


class FirestoreMesaGrantVerifier:
    """Reads one unguessable, rules-validated capability without Firebase tokens."""

    def __init__(
        self,
        project_id: str,
        *,
        timeout_seconds: float = 5.0,
        opener: Callable[..., Any] = urlopen,
        now_factory: Callable[[], datetime] = _utc_now,
    ) -> None:
        normalized_project_id = str(project_id or "").strip()
        if not PROJECT_ID_PATTERN.fullmatch(normalized_project_id):
            raise ValueError("firebase_project_id invalido")
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds deve ser positivo")
        self.project_id = normalized_project_id
        self.timeout_seconds = timeout_seconds
        self._opener = opener
        self._now_factory = now_factory

    def verify(self, challenge: str, mesa_id: str) -> VerifiedMesaGrant:
        normalized_challenge = str(challenge or "").strip()
        normalized_mesa_id = str(mesa_id or "").strip()
        if not CHALLENGE_PATTERN.fullmatch(normalized_challenge):
            raise InvalidGrantError("Desafio VTT invalido")
        if not MESA_ID_PATTERN.fullmatch(normalized_mesa_id):
            raise InvalidGrantError("Mesa invalida")

        url = (
            "https://firestore.googleapis.com/v1/projects/"
            f"{self.project_id}/databases/(default)/documents/"
            f"vttAccessGrants/{normalized_challenge}"
        )
        request = Request(
            url,
            method="GET",
            headers={
                "Accept": "application/json",
                "User-Agent": "CAOS-VTT/1",
            },
        )
        try:
            with self._opener(request, timeout=self.timeout_seconds) as response:
                raw = response.read(MAX_FIRESTORE_RESPONSE_BYTES + 1)
        except HTTPError as error:
            if error.code in {400, 401, 403, 404}:
                raise InvalidGrantError("Grant VTT ausente ou invalido") from None
            if error.code == 429 or 500 <= error.code <= 599:
                raise FirestoreUnavailableError("Firestore indisponivel") from None
            raise FirestoreUnavailableError("Falha inesperada do Firestore") from None
        except (URLError, TimeoutError, OSError):
            raise FirestoreUnavailableError("Firestore indisponivel") from None

        if len(raw) > MAX_FIRESTORE_RESPONSE_BYTES:
            raise FirestoreUnavailableError("Resposta do Firestore excedeu o limite")
        try:
            document = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise FirestoreUnavailableError("Resposta invalida do Firestore") from None
        if not isinstance(document, dict):
            raise FirestoreUnavailableError("Resposta invalida do Firestore")

        expected_name = (
            f"projects/{self.project_id}/databases/(default)/documents/"
            f"vttAccessGrants/{normalized_challenge}"
        )
        if document.get("name") != expected_name:
            raise InvalidGrantError("Documento inesperado no Firestore")
        fields = document.get("fields")
        if not isinstance(fields, dict) or set(fields) != {
            "challenge",
            "mesaId",
            "uid",
            "role",
            "roomName",
            "campaignId",
            "issuedAt",
        }:
            raise InvalidGrantError("Estrutura invalida do grant VTT")

        document_challenge = _string_field(fields, "challenge")
        document_mesa_id = _string_field(fields, "mesaId")
        uid = _string_field(fields, "uid")
        role = _string_field(fields, "role")
        room_name = _string_field(fields, "roomName").strip()
        campaign_id = _string_field(fields, "campaignId")
        issued_at = _timestamp_field(fields, "issuedAt")
        now = self._now_factory().astimezone(UTC)
        expires_at = issued_at + timedelta(seconds=GRANT_TTL_SECONDS)

        if document_challenge != normalized_challenge:
            raise InvalidGrantError("Grant pertence a outro desafio")
        if document_mesa_id != normalized_mesa_id:
            raise InvalidGrantError("Grant pertence a outra Mesa")
        if not uid or len(uid) > 128 or any(ord(character) < 32 for character in uid):
            raise InvalidGrantError("Usuario invalido no grant")
        if role not in {"master", "player"}:
            raise InvalidGrantError("Papel invalido no grant")
        if not room_name or len(room_name) > 80 or any(
            ord(character) < 32 for character in room_name
        ):
            raise InvalidGrantError("Nome de Mesa invalido no grant")
        if not CAMPAIGN_ID_PATTERN.fullmatch(campaign_id):
            raise InvalidGrantError("Campanha invalida no grant")
        if issued_at > now + timedelta(seconds=MAX_CLOCK_SKEW_SECONDS):
            raise InvalidGrantError("Grant emitido no futuro")
        if expires_at <= now:
            raise InvalidGrantError("Grant VTT expirado")

        return VerifiedMesaGrant(
            mesa_id=document_mesa_id,
            uid=uid,
            role=role,  # type: ignore[arg-type]
            room_name=room_name,
            campaign_id=campaign_id,
            issued_at=issued_at,
            expires_at=expires_at,
        )


__all__ = [
    "GRANT_TTL_SECONDS",
    "FirestoreGrantError",
    "FirestoreMesaGrantVerifier",
    "FirestoreUnavailableError",
    "InvalidGrantError",
    "VerifiedMesaGrant",
]
