from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Literal


TaskLevel = Literal["Root", "L1", "L2", "L3", "L4"]


class TaskGraphItem(BaseModel):
    id: UUID
    parent_id: UUID | None
    level: TaskLevel
    name: str
    organization: str
    is_ai_utilized: bool
    keywords: list[str] | None = None

    class Config:
        from_attributes = True


class TaskDetail(TaskGraphItem):
    team: str | None
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
    team: str | None = None
    manager_name: str | None = None
    manager_id: str | None = None
    keywords: list[str] | None = None
    is_ai_utilized: bool = False


class TaskUpdate(BaseModel):
    name: str | None = None
    organization: str | None = None
    team: str | None = None
    manager_name: str | None = None
    manager_id: str | None = None
    keywords: list[str] | None = None
    is_ai_utilized: bool | None = None


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
