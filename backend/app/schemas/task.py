from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime
from typing import Literal


TaskLevel = Literal["Root", "L1", "L2", "L3", "L4"]
VALID_ORG_TYPES = ["본부", "실", "담당", "팀"]


class TaskGraphItem(BaseModel):
    id: UUID
    parent_id: UUID | None
    level: TaskLevel
    name: str
    organization: str
    organization_type: str | None = None
    is_ai_utilized: bool
    keywords: list[str] | None = None
    related_team: list[str] | None = None

    class Config:
        from_attributes = True


class TaskDetail(TaskGraphItem):
    organization_name: str | None
    manager_name: str | None
    manager_id: str | None
    version: int
    created_by: UUID | None
    updated_by: UUID | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    parent_id: UUID | None = None
    name: str
    organization: str
    organization_type: str | None = None
    organization_name: str | None = None
    manager_name: str | None = None
    manager_id: str | None = None
    related_team: list[str] | None = None
    keywords: list[str] | None = None
    is_ai_utilized: bool = False

    @field_validator("organization_type")
    @classmethod
    def validate_org_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_ORG_TYPES:
            raise ValueError(f"organization_type must be one of {VALID_ORG_TYPES}")
        return v


class TaskUpdate(BaseModel):
    name: str | None = None
    organization: str | None = None
    organization_type: str | None = None
    organization_name: str | None = None
    manager_name: str | None = None
    manager_id: str | None = None
    related_team: list[str] | None = None
    keywords: list[str] | None = None
    is_ai_utilized: bool | None = None

    @field_validator("organization_type")
    @classmethod
    def validate_org_type(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_ORG_TYPES:
            raise ValueError(f"organization_type must be one of {VALID_ORG_TYPES}")
        return v


class TaskHistoryResponse(BaseModel):
    id: UUID
    task_id: UUID
    snapshot: dict
    version: int
    change_type: str
    changed_by: UUID | None
    changed_by_name: str | None = None  # 수정자 이름 추가
    changed_at: datetime

    class Config:
        from_attributes = True
