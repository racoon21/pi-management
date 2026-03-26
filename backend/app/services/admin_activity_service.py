from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models import AdminAuditLog, TaskHistory, User
from app.schemas import (
    AdminActivityActionCounts,
    AdminActivityFeedResponse,
    AdminActivityLogItem,
    AdminActivitySourceCounts,
)

ActivitySource = Literal['all', 'task_history', 'user_signup', 'admin_audit']
ActivityAction = Literal[
    'all',
    'TASK_CREATE',
    'TASK_UPDATE',
    'TASK_DELETE',
    'USER_REGISTERED',
    'USER_APPROVED',
    'USER_REJECTED',
    'USER_ROLE_CHANGED',
    'USER_ACTIVATED',
    'USER_DEACTIVATED',
]

TASK_ACTIVITY_META = {
    'CREATE': ('TASK_CREATE', '업무 생성', '업무 변경'),
    'UPDATE': ('TASK_UPDATE', '업무 수정', '업무 변경'),
    'DELETE': ('TASK_DELETE', '업무 삭제', '업무 변경'),
}

ADMIN_AUDIT_META = {
    'USER_APPROVED': '가입 승인',
    'USER_REJECTED': '가입 거절',
    'USER_ROLE_CHANGED': '역할 변경',
    'USER_ACTIVATED': '계정 활성',
    'USER_DEACTIVATED': '계정 비활성',
}


async def ensure_admin_audit_log_table(db: AsyncSession) -> None:
    await db.run_sync(
        lambda sync_session: AdminAuditLog.__table__.create(
            sync_session.connection(),
            checkfirst=True,
        )
    )


async def create_admin_audit_log(
    db: AsyncSession,
    *,
    actor: User,
    action: Literal[
        'USER_APPROVED',
        'USER_REJECTED',
        'USER_ROLE_CHANGED',
        'USER_ACTIVATED',
        'USER_DEACTIVATED',
    ],
    description: str,
    subject_user: User,
    metadata: dict[str, Any] | None = None,
) -> AdminAuditLog:
    await ensure_admin_audit_log_table(db)

    log = AdminAuditLog(
        action=action,
        action_label=ADMIN_AUDIT_META[action],
        description=description,
        actor_user_id=actor.id,
        actor_name=actor.name,
        actor_employee_id=actor.employee_id,
        subject_type='user',
        subject_id=str(subject_user.id),
        subject_label=subject_user.name,
        subject_secondary=subject_user.employee_id,
        organization=subject_user.organization,
        payload=metadata or {},
    )
    db.add(log)
    await db.flush()
    return log


def _build_task_activity(
    history: TaskHistory,
    actor_name: str | None,
    actor_employee_id: str | None,
) -> AdminActivityLogItem:
    snapshot = history.snapshot or {}
    task_name = snapshot.get('name') or '이름 없는 업무'
    task_level = snapshot.get('level')
    organization = snapshot.get('organization')
    action, action_label, source_label = TASK_ACTIVITY_META.get(
        history.change_type,
        ('TASK_UPDATE', '업무 수정', '업무 변경'),
    )

    if history.change_type == 'CREATE':
        description = f'"{task_name}" 업무가 생성되었습니다.'
    elif history.change_type == 'DELETE':
        description = f'"{task_name}" 업무가 삭제되었습니다.'
    else:
        description = f'"{task_name}" 업무 정보가 수정되었습니다.'

    return AdminActivityLogItem(
        id=f'task-history:{history.id}',
        source='task_history',
        source_label=source_label,
        action=action,
        action_label=action_label,
        description=description,
        actor_name=actor_name,
        actor_employee_id=actor_employee_id,
        subject_type='task',
        subject_id=str(history.task_id),
        subject_label=task_name,
        subject_secondary=task_level,
        organization=organization,
        occurred_at=history.changed_at,
        metadata={
            'version': history.version,
            'change_type': history.change_type,
            'level': task_level,
        },
    )


def _build_signup_activity(user: User) -> AdminActivityLogItem:
    return AdminActivityLogItem(
        id=f'user-signup:{user.id}',
        source='user_signup',
        source_label='계정 등록',
        action='USER_REGISTERED',
        action_label='계정 등록',
        description=f'"{user.name}" 계정이 등록되었습니다.',
        actor_name=None,
        actor_employee_id=None,
        subject_type='user',
        subject_id=str(user.id),
        subject_label=user.name,
        subject_secondary=user.employee_id,
        organization=user.organization,
        occurred_at=user.created_at,
        metadata={
            'role': user.role,
            'is_active': user.is_active,
        },
    )


def _build_admin_audit_activity(log: AdminAuditLog) -> AdminActivityLogItem:
    return AdminActivityLogItem(
        id=f'admin-audit:{log.id}',
        source='admin_audit',
        source_label='관리자 감사',
        action=log.action,
        action_label=log.action_label,
        description=log.description,
        actor_name=log.actor_name,
        actor_employee_id=log.actor_employee_id,
        subject_type='user',
        subject_id=log.subject_id,
        subject_label=log.subject_label,
        subject_secondary=log.subject_secondary,
        organization=log.organization,
        occurred_at=log.created_at,
        metadata=log.payload or {},
    )


def _matches_query(item: AdminActivityLogItem, normalized_query: str) -> bool:
    search_targets = [
        item.description,
        item.action_label,
        item.source_label,
        item.actor_name or '',
        item.actor_employee_id or '',
        item.subject_label,
        item.subject_secondary or '',
        item.organization or '',
    ]
    search_targets.extend(str(value) for value in item.metadata.values() if value is not None)
    return any(normalized_query in target.lower() for target in search_targets)


def _build_action_counts(activities: list[AdminActivityLogItem]) -> AdminActivityActionCounts:
    return AdminActivityActionCounts(
        task_create=sum(item.action == 'TASK_CREATE' for item in activities),
        task_update=sum(item.action == 'TASK_UPDATE' for item in activities),
        task_delete=sum(item.action == 'TASK_DELETE' for item in activities),
        user_registered=sum(item.action == 'USER_REGISTERED' for item in activities),
        user_approved=sum(item.action == 'USER_APPROVED' for item in activities),
        user_rejected=sum(item.action == 'USER_REJECTED' for item in activities),
        user_role_changed=sum(item.action == 'USER_ROLE_CHANGED' for item in activities),
        user_activated=sum(item.action == 'USER_ACTIVATED' for item in activities),
        user_deactivated=sum(item.action == 'USER_DEACTIVATED' for item in activities),
    )


async def get_admin_activity_feed(
    db: AsyncSession,
    source: ActivitySource = 'all',
    action: ActivityAction = 'all',
    query: str | None = None,
    limit: int = 100,
) -> AdminActivityFeedResponse:
    safe_limit = max(1, min(limit, 100))
    fetch_limit = max(safe_limit * 10, 200)

    await ensure_admin_audit_log_table(db)

    task_history_count = await db.scalar(select(func.count(TaskHistory.id))) or 0
    user_signup_count = await db.scalar(select(func.count(User.id))) or 0
    admin_audit_count = await db.scalar(select(func.count(AdminAuditLog.id))) or 0

    activities: list[AdminActivityLogItem] = []

    if source in ('all', 'task_history'):
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

    if source in ('all', 'user_signup'):
        recent_signups = (
            await db.execute(select(User).order_by(User.created_at.desc()).limit(fetch_limit))
        ).scalars().all()
        activities.extend(_build_signup_activity(user) for user in recent_signups)

    if source in ('all', 'admin_audit'):
        audit_logs = (
            await db.execute(
                select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(fetch_limit)
            )
        ).scalars().all()
        activities.extend(_build_admin_audit_activity(log) for log in audit_logs)

    activities.sort(key=lambda item: item.occurred_at, reverse=True)

    normalized_query = (query or '').strip().lower()
    if normalized_query:
        activities = [item for item in activities if _matches_query(item, normalized_query)]

    action_counts = _build_action_counts(activities)

    if action != 'all':
        activities = [item for item in activities if item.action == action]

    return AdminActivityFeedResponse(
        source_counts=AdminActivitySourceCounts(
            total=task_history_count + user_signup_count + admin_audit_count,
            task_history=task_history_count,
            user_signup=user_signup_count,
            admin_audit=admin_audit_count,
        ),
        action_counts=action_counts,
        filtered_count=len(activities),
        activities=activities[:safe_limit],
    )
