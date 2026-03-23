from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


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


class AdminDashboardRoleCounts(BaseModel):
    admin: int
    editor: int
    viewer: int
    pending: int


class AdminDashboardOrganizationCount(BaseModel):
    organization: str
    user_count: int


class AdminDashboardSummaryResponse(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    pending_users: int
    recent_signups_7d: int
    role_counts: AdminDashboardRoleCounts
    organization_counts: list[AdminDashboardOrganizationCount]
    recent_signups: list[UserListResponse]


class AdminActivitySourceCounts(BaseModel):
    total: int
    task_history: int
    user_signup: int


class AdminActivityLogItem(BaseModel):
    id: str
    source: Literal["task_history", "user_signup"]
    source_label: str
    action: Literal["TASK_CREATE", "TASK_UPDATE", "TASK_DELETE", "USER_REGISTERED"]
    action_label: str
    description: str
    actor_name: str | None = None
    actor_employee_id: str | None = None
    subject_type: Literal["task", "user"]
    subject_id: str
    subject_label: str
    subject_secondary: str | None = None
    organization: str | None = None
    occurred_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class AdminActivityFeedResponse(BaseModel):
    source_counts: AdminActivitySourceCounts
    activities: list[AdminActivityLogItem]
