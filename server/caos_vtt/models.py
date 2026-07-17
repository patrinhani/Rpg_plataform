from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
