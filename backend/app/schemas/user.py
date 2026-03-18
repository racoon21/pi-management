from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field
from uuid import UUID


class UserBase(BaseModel):
    employee_id: str
    name: str
    organization: str
    role: str = "viewer"


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: UUID

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    employee_id: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class RegisterRequest(BaseModel):
    employee_id: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=50)
    organization: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6, max_length=72)


class UserListResponse(BaseModel):
    id: UUID
    employee_id: str
    name: str
    organization: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RoleUpdateRequest(BaseModel):
    role: Literal["viewer", "editor", "admin"]


class ActiveUpdateRequest(BaseModel):
    is_active: bool
