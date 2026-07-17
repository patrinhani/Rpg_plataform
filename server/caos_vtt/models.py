from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


Role = Literal["master", "player"]


class CreateRoomRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("O nome da sala nao pode ser vazio")
        return name


class CreateRoomResponse(BaseModel):
    roomId: str
    masterInviteToken: str
    playerInviteToken: str
    revision: int


class TicketResponse(BaseModel):
    ticket: str
    role: Role
    expiresIn: int
    mediaToken: str
    mediaExpiresIn: int


class MovePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tokenId: str = Field(min_length=1, max_length=80)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class MoveCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["token.move"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: MovePayload


class PingCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["ping"]
    commandId: str | None = Field(default=None, max_length=100)


class SceneSelectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sceneId: str = Field(min_length=7, max_length=160)

    @field_validator("sceneId")
    @classmethod
    def validate_scene_id(cls, value: str) -> str:
        if not value.startswith("scene:") or any(ord(character) < 32 for character in value):
            raise ValueError("sceneId invalido")
        return value


class SceneSelectCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["scene.select"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: SceneSelectPayload


class OverlaySetPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assetId: str = Field(min_length=7, max_length=2048)
    enabled: StrictBool

    @field_validator("assetId")
    @classmethod
    def validate_asset_id(cls, value: str) -> str:
        if not value.startswith("asset:") or any(character in value for character in "\x00\r\n"):
            raise ValueError("assetId invalido")
        return value


class OverlaySetCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["overlay.set"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: OverlaySetPayload


class TokenSpawnPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tokenId: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$",
    )
    assetId: str = Field(min_length=7, max_length=2048)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    label: str = Field(min_length=1, max_length=80)
    size: float = Field(default=0.08, ge=0.01, le=0.25)
    movable: StrictBool = True
    visible: StrictBool = True

    @field_validator("assetId")
    @classmethod
    def validate_asset_id(cls, value: str) -> str:
        if not value.startswith("asset:") or any(character in value for character in "\x00\r\n"):
            raise ValueError("assetId invalido")
        return value

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        label = value.strip()
        if not label or any(ord(character) < 32 for character in label):
            raise ValueError("label invalido")
        return label


class TokenSpawnCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["token.spawn"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: TokenSpawnPayload


class TokenRemovePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tokenId: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$",
    )


class TokenRemoveCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["token.remove"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: TokenRemovePayload
