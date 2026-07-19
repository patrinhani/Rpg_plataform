from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator


Role = Literal["master", "player"]


class CreateRoomRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    campaignId: str | None = Field(
        default=None,
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$",
    )
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


class MesaAccessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mesaId: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9_-]{1,128}$",
    )


class MesaAccessResponse(TicketResponse):
    roomId: str
    revision: int = Field(ge=0)


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


class SceneLayerSetPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    layerId: str = Field(min_length=13, max_length=160)
    state: str | None = Field(default=None, min_length=1, max_length=80)

    @field_validator("layerId")
    @classmethod
    def validate_layer_id(cls, value: str) -> str:
        if not value.startswith("scene-layer:") or any(ord(character) < 32 for character in value):
            raise ValueError("layerId invalido")
        return value

    @field_validator("state")
    @classmethod
    def validate_state(cls, value: str | None) -> str | None:
        if value is not None and any(ord(character) < 32 for character in value):
            raise ValueError("state invalido")
        return value


class SceneLayerSetCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["layer.set"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: SceneLayerSetPayload


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


class PropSpawnPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    propId: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$",
    )
    assetId: str = Field(min_length=7, max_length=2048)
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    label: str = Field(min_length=1, max_length=80)
    width: float = Field(default=0.18, ge=0.01, le=0.8)
    height: float = Field(default=0.18, ge=0.01, le=0.8)
    rotation: float = Field(default=0, ge=-360, le=360)
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


class PropSpawnCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["prop.spawn"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: PropSpawnPayload


class PropUpdatePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    propId: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$",
    )
    assetId: str | None = Field(default=None, min_length=7, max_length=2048)
    label: str | None = Field(default=None, min_length=1, max_length=80)
    x: float | None = Field(default=None, ge=0, le=1)
    y: float | None = Field(default=None, ge=0, le=1)
    width: float | None = Field(default=None, ge=0.01, le=0.8)
    height: float | None = Field(default=None, ge=0.01, le=0.8)
    rotation: float | None = Field(default=None, ge=-360, le=360)
    visible: StrictBool | None = None

    @field_validator("assetId")
    @classmethod
    def validate_asset_id(cls, value: str | None) -> str | None:
        if value is not None and (
            not value.startswith("asset:") or any(character in value for character in "\x00\r\n")
        ):
            raise ValueError("assetId invalido")
        return value

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str | None) -> str | None:
        if value is None:
            return None
        label = value.strip()
        if not label or any(ord(character) < 32 for character in label):
            raise ValueError("label invalido")
        return label

    @model_validator(mode="after")
    def require_change(self) -> "PropUpdatePayload":
        if all(
            value is None
            for value in (
                self.assetId,
                self.label,
                self.x,
                self.y,
                self.width,
                self.height,
                self.rotation,
                self.visible,
            )
        ):
            raise ValueError("prop.update precisa alterar ao menos um campo")
        return self


class PropUpdateCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["prop.update"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: PropUpdatePayload


class PropRemovePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    propId: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$",
    )


class PropRemoveCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["prop.remove"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: PropRemovePayload


class FogPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class FogStrokePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    points: list[FogPoint] = Field(min_length=1, max_length=256)
    radius: float = Field(ge=0.002, le=0.25)
    reveal: StrictBool = True


class FogStrokeCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["fog.stroke"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: FogStrokePayload


class FogSetEnabledPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: StrictBool


class FogSetEnabledCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["fog.set_enabled"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: FogSetEnabledPayload


class FogResetCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["fog.reset"]
    commandId: str = Field(min_length=1, max_length=100)


class FogRevealAllCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["fog.reveal_all"]
    commandId: str = Field(min_length=1, max_length=100)


class HandoutPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assetId: str = Field(min_length=7, max_length=2048)

    @field_validator("assetId")
    @classmethod
    def validate_asset_id(cls, value: str) -> str:
        if not value.startswith("asset:") or any(character in value for character in "\x00\r\n"):
            raise ValueError("assetId invalido")
        return value


class HandoutDeliverCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["handout.deliver"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: HandoutPayload


class HandoutRevokeCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["handout.revoke"]
    commandId: str = Field(min_length=1, max_length=100)
    payload: HandoutPayload
