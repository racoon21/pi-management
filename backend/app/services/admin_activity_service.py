from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import TaskHistory, User
from app.schemas import (
    AdminActivityActionCounts,
    AdminActivityFeedResponse,
    AdminActivityLogItem,
    AdminActivitySourceCounts,
)

ActivitySource = Literal["all", "task_history", "user_signup"]
ActivityAction = Literal["all", "TASK_CREATE", "TASK_UPDATE", "TASK_DELETE", "USER_REGISTERED"]

TASK_ACTIVITY_META = {
    "CREATE": ("TASK_CREATE", "업무 생성", "업무 변경"),
    "UPDATE": ("TASK_UPDATE", "업무 수정", "업무 변경"),
    "DELETE": ("TASK_DELETE", "업무 삭제", "업무 변경"),
}


def _build_task_activity(
    history: TaskHistory,
    actor_name: str | None,
    actor_employee_id: str | None,
) -> AdminActivityLogItem:
    snapshot = history.snapshot or {}
    task_name = snapshot.get("name") or "이름 없는 업무"
    task_level = snapshot.get("level")
    organization = snapshot.get("organization")
    action, action_label, source_label = TASK_ACTIVITY_META.get(
        history.change_type,
        ("TASK_UPDATE", "업무 변경", "업무 변경"),
    )

    if history.change_type == "CREATE":
        description = f'"{task_name}" 업무가 생성되었습니다.'
    elif history.change_type == "DELETE":
        description = f'"{task_name}" 업무가 삭제 처리되었습니다.'
    else:
        description = f'"{task_name}" 업무 정보가 수정되었습니다.'

    return AdminActivityLogItem(
        id=f"task-history:{history.id}",
        source="task_history",
        source_label=source_label,
        action=action,
        action_label=action_label,
        description=description,
        actor_name=actor_name,
        actor_employee_id=actor_employee_id,
        subject_type="task",
        subject_id=str(history.task_id),
        subject_label=task_name,
        subject_secondary=task_level,
        organization=organization,
        occurred_at=history.changed_at,
        metadata={
            "version": history.version,
            "change_type": history.change_type,
            "level": task_level,
        },
    )


def _build_signup_activity(user: User) -> AdminActivityLogItem:
    return AdminActivityLogItem(
        id=f"user-signup:{user.id}",
        source="user_signup",
        source_label="계정 등록",
        action="USER_REGISTERED",
        action_label="계정 등록",
        description=f'"{user.name}" 계정이 등록되었습니다.',
        actor_name=None,
        actor_employee_id=None,
        subject_type="user",
        subject_id=str(user.id),
        subject_label=user.name,
        subject_secondary=user.employee_id,
        organization=user.organization,
        occurred_at=user.created_at,
        metadata={
            "role": user.role,
            "is_active": user.is_active,
        },
    )


def _matches_query(item: AdminActivityLogItem, normalized_query: str) -> bool:
    search_targets = [
        item.description,
        item.actor_name or "",
        item.actor_employee_id or "",
        item.subject_label,
        item.subject_secondary or "",
        item.organization or "",
        str(item.metadata.get("level", "")),
        str(item.metadata.get("role", "")),
    ]
    return any(normalized_query in target.lower() for target in search_targets)


def _build_action_counts(activities: list[AdminActivityLogItem]) -> AdminActivityActionCounts:
    return AdminActivityActionCounts(
        task_create=sum(item.action == "TASK_CREATE" for item in activities),
        task_update=sum(item.action == "TASK_UPDATE" for item in activities),
        task_delete=sum(item.action == "TASK_DELETE" for item in activities),
        user_registered=sum(item.action == "USER_REGISTERED" for item in activities),
    )


async def get_admin_activity_feed(
    db: AsyncSession,
    source: ActivitySource = "all",
    action: ActivityAction = "all",
    query: str | None = None,
    limit: int = 100,
) -> AdminActivityFeedResponse:
    safe_limit = max(1, min(limit, 100))
    fetch_limit = max(safe_limit * 10, 200)

    task_history_count = await db.scalar(select(func.count(TaskHistory.id))) or 0
    user_signup_count = await db.scalar(select(func.count(User.id))) or 0

    activities: list[AdminActivityLogItem] = []

    if source in ("all", "task_history"):
        actor_user = aliased(User)
        task_history_rows = (
            await db.execute(
                select(TaskHistory, actor_user.name, actor_user.employee_id)
                .outerjoin(actor_user, actor_user.id == TaskHistory.changed_by)
                .order_by(TaskHistory.changed_at.desc())
                .limit(fetch_limit)
            )
        ).all()

        activities.extend(
            _build_task_activity(
                history=history,
                actor_name=actor_name,
                actor_employee_id=actor_employee_id,
            )
            for history, actor_name, actor_employee_id in task_history_rows
        )

    if source in ("all", "user_signup"):
        recent_signups = (
            await db.execute(select(User).order_by(User.created_at.desc()).limit(fetch_limit))
        ).scalars().all()
        activities.extend(_build_signup_activity(user) for user in recent_signups)

    activities.sort(key=lambda item: item.occurred_at, reverse=True)

    normalized_query = (query or "").strip().lower()
    if normalized_query:
        activities = [item for item in activities if _matches_query(item, normalized_query)]

    action_counts = _build_action_counts(activities)

    if action != "all":
        activities = [item for item in activities if item.action == action]

    return AdminActivityFeedResponse(
        source_counts=AdminActivitySourceCounts(
            total=task_history_count + user_signup_count,
            task_history=task_history_count,
            user_signup=user_signup_count,
        ),
        action_counts=action_counts,
        filtered_count=len(activities),
        activities=activities[:safe_limit],
    )

