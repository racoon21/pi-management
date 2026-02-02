from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Task, TaskHistory, User
from app.schemas import TaskCreate, TaskUpdate
from dataclasses import dataclass


@dataclass
class TaskHistoryWithUser:
    """히스토리와 수정자 이름을 함께 담는 클래스"""
    id: UUID
    task_id: UUID
    snapshot: dict
    version: int
    change_type: str
    changed_by: UUID | None
    changed_by_name: str | None
    changed_at: datetime

# 레벨 매핑
LEVEL_MAP = {"Root": "L1", "L1": "L2", "L2": "L3", "L3": "L4"}


async def get_all_tasks(db: AsyncSession) -> list[Task]:
    result = await db.execute(
        select(Task).where(Task.deleted_at.is_(None)).order_by(Task.level, Task.name)
    )
    return list(result.scalars().all())


async def get_task_by_id(db: AsyncSession, task_id: UUID) -> Task | None:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_task(db: AsyncSession, data: TaskCreate, user_id: UUID | None) -> Task:
    # 부모가 있으면 레벨 자동 결정
    if data.parent_id:
        parent = await get_task_by_id(db, data.parent_id)
        if not parent:
            raise ValueError("Parent task not found")
        level = LEVEL_MAP.get(parent.level)
        if not level:
            raise ValueError("Cannot create child under L4")
    else:
        level = "Root"

    task = Task(
        parent_id=data.parent_id,
        level=level,
        name=data.name,
        organization=data.organization,
        team=data.team,
        manager_name=data.manager_name,
        manager_id=data.manager_id,
        keywords=data.keywords or [],
        is_ai_utilized=data.is_ai_utilized,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(task)

    # 이력 저장
    history = TaskHistory(
        task_id=task.id,
        snapshot=_task_to_snapshot(task),
        version=1,
        change_type="CREATE",
        changed_by=user_id,
    )
    db.add(history)

    await db.commit()
    await db.refresh(task)
    return task


async def update_task(db: AsyncSession, task_id: UUID, data: TaskUpdate, user_id: UUID | None) -> Task:
    task = await get_task_by_id(db, task_id)
    if not task:
        raise ValueError("Task not found")

    # 현재 상태를 히스토리에 저장
    history = TaskHistory(
        task_id=task.id,
        snapshot=_task_to_snapshot(task),
        version=task.version,
        change_type="UPDATE",
        changed_by=user_id,
    )
    db.add(history)

    # 업데이트
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    task.version += 1
    task.updated_by = user_id
    task.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, task_id: UUID, user_id: UUID | None) -> bool:
    task = await get_task_by_id(db, task_id)
    if not task:
        raise ValueError("Task not found")

    # 자식 노드 확인
    result = await db.execute(
        select(Task).where(Task.parent_id == task_id, Task.deleted_at.is_(None))
    )
    children = result.scalars().all()
    if children:
        raise ValueError("Cannot delete task with children")

    # 히스토리 저장
    history = TaskHistory(
        task_id=task.id,
        snapshot=_task_to_snapshot(task),
        version=task.version,
        change_type="DELETE",
        changed_by=user_id,
    )
    db.add(history)

    # Soft delete
    task.deleted_at = datetime.utcnow()
    await db.commit()
    return True


async def get_task_histories(db: AsyncSession, task_id: UUID) -> list[TaskHistoryWithUser]:
    result = await db.execute(
        select(TaskHistory)
        .where(TaskHistory.task_id == task_id)
        .order_by(TaskHistory.changed_at.desc())
    )
    histories = list(result.scalars().all())

    # 모든 changed_by ID 수집 후 User 정보 조회
    user_ids = [h.changed_by for h in histories if h.changed_by]
    user_map = {}
    if user_ids:
        user_result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users = user_result.scalars().all()
        user_map = {u.id: u.name for u in users}

    # 히스토리에 사용자 이름 매핑
    return [
        TaskHistoryWithUser(
            id=h.id,
            task_id=h.task_id,
            snapshot=h.snapshot,
            version=h.version,
            change_type=h.change_type,
            changed_by=h.changed_by,
            changed_by_name=user_map.get(h.changed_by) if h.changed_by else None,
            changed_at=h.changed_at,
        )
        for h in histories
    ]


def _task_to_snapshot(task: Task) -> dict:
    return {
        "parent_id": str(task.parent_id) if task.parent_id else None,
        "level": task.level,
        "name": task.name,
        "organization": task.organization,
        "team": task.team,
        "manager_name": task.manager_name,
        "manager_id": task.manager_id,
        "keywords": task.keywords,
        "is_ai_utilized": task.is_ai_utilized,
    }
