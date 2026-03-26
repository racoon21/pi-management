from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import AdminUser, DbSession
from app.models import User
from app.schemas import (
    ActiveUpdateRequest,
    AdminActivityFeedResponse,
    AdminDashboardOrganizationCount,
    AdminDashboardRoleCounts,
    AdminDashboardSummaryResponse,
    AdminUserActionResponse,
    ApiResponse,
    RoleUpdateRequest,
    UserListResponse,
)
from app.services.admin_activity_service import create_admin_audit_log, get_admin_activity_feed

router = APIRouter(prefix='/admin', tags=['admin'])

ROLE_LABELS = {
    'admin': '관리자',
    'editor': '편집자',
    'viewer': '조회자',
    'none': '승인 대기',
}


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role)


async def get_user_or_404(db: DbSession, user_id: UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='사용자를 찾을 수 없습니다.')
    return user


def build_audit_metadata(
    *,
    previous_role: str,
    new_role: str,
    previous_is_active: bool,
    new_is_active: bool,
) -> dict[str, str | bool]:
    return {
        'previous_role': previous_role,
        'previous_role_label': role_label(previous_role),
        'new_role': new_role,
        'new_role_label': role_label(new_role),
        'previous_is_active': previous_is_active,
        'new_is_active': new_is_active,
    }


@router.get('/dashboard/summary', response_model=ApiResponse[AdminDashboardSummaryResponse])
async def get_dashboard_summary(db: DbSession, current_user: AdminUser):
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    inactive_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(False))) or 0
    pending_users = (
        await db.scalar(select(func.count(User.id)).where(User.role == 'none', User.is_active.is_(True)))
        or 0
    )

    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    recent_signups_7d = (
        await db.scalar(select(func.count(User.id)).where(User.created_at >= recent_cutoff)) or 0
    )

    role_rows = (await db.execute(select(User.role, func.count(User.id)).group_by(User.role))).all()
    role_counts = {
        'admin': 0,
        'editor': 0,
        'viewer': 0,
        'pending': 0,
    }
    for role, count in role_rows:
        if role == 'none':
            role_counts['pending'] = count
        elif role in role_counts:
            role_counts[role] = count

    organization_rows = (
        await db.execute(
            select(User.organization, func.count(User.id).label('user_count'))
            .group_by(User.organization)
            .order_by(func.count(User.id).desc(), User.organization.asc())
            .limit(5)
        )
    ).all()

    recent_signups = (
        await db.execute(select(User).order_by(User.created_at.desc()).limit(5))
    ).scalars().all()

    summary = AdminDashboardSummaryResponse(
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        pending_users=pending_users,
        recent_signups_7d=recent_signups_7d,
        role_counts=AdminDashboardRoleCounts(**role_counts),
        organization_counts=[
            AdminDashboardOrganizationCount(organization=organization, user_count=user_count)
            for organization, user_count in organization_rows
        ],
        recent_signups=[UserListResponse.model_validate(user) for user in recent_signups],
    )
    return ApiResponse(success=True, data=summary)


@router.get('/logs/activities', response_model=ApiResponse[AdminActivityFeedResponse])
async def get_admin_logs_activities(
    db: DbSession,
    current_user: AdminUser,
    source: Literal['all', 'task_history', 'user_signup', 'admin_audit'] = Query('all'),
    action: Literal[
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
    ] = Query('all'),
    query: str | None = Query(None, min_length=1, max_length=100),
    limit: int = Query(100, ge=1, le=100),
):
    activity_feed = await get_admin_activity_feed(
        db=db,
        source=source,
        action=action,
        query=query,
        limit=limit,
    )
    return ApiResponse(success=True, data=activity_feed)


@router.get('/users', response_model=ApiResponse[list[UserListResponse]])
async def list_users(
    db: DbSession,
    current_user: AdminUser,
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
):
    query = select(User).order_by(User.created_at.desc())
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    result = await db.execute(query)
    users = result.scalars().all()
    return ApiResponse(success=True, data=[UserListResponse.model_validate(u) for u in users])


@router.get('/users/pending', response_model=ApiResponse[list[UserListResponse]])
async def list_pending_users(db: DbSession, current_user: AdminUser):
    result = await db.execute(
        select(User)
        .where(User.role == 'none', User.is_active.is_(True))
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return ApiResponse(
        success=True,
        data=[UserListResponse.model_validate(u) for u in users],
        message=f'승인 대기 {len(users)}명',
    )


@router.put('/users/{user_id}/role', response_model=ApiResponse[AdminUserActionResponse])
async def update_user_role(user_id: UUID, data: RoleUpdateRequest, db: DbSession, current_user: AdminUser):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='자기 자신의 역할은 변경할 수 없습니다.',
        )

    user = await get_user_or_404(db, user_id)
    previous_role = user.role
    if previous_role == data.role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='이미 같은 역할입니다.')

    user.role = data.role

    if previous_role == 'none':
        action = 'USER_APPROVED'
        message = f'"{user.name}" 계정을 {role_label(data.role)} 권한으로 승인했습니다.'
    else:
        action = 'USER_ROLE_CHANGED'
        message = f'"{user.name}" 역할을 {role_label(previous_role)}에서 {role_label(data.role)}로 변경했습니다.'

    audit_log = await create_admin_audit_log(
        db,
        actor=current_user,
        action=action,
        description=message,
        subject_user=user,
        metadata=build_audit_metadata(
            previous_role=previous_role,
            new_role=data.role,
            previous_is_active=user.is_active,
            new_is_active=user.is_active,
        ),
    )

    await db.commit()
    await db.refresh(user)
    return ApiResponse(
        success=True,
        data=AdminUserActionResponse(
            user=UserListResponse.model_validate(user),
            action=action,
            audit_log_id=f'admin-audit:{audit_log.id}',
        ),
        message=message,
    )


@router.put('/users/{user_id}/active', response_model=ApiResponse[AdminUserActionResponse])
async def update_user_active(user_id: UUID, data: ActiveUpdateRequest, db: DbSession, current_user: AdminUser):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='자기 자신의 상태는 변경할 수 없습니다.',
        )

    user = await get_user_or_404(db, user_id)
    if user.is_active == data.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='이미 같은 상태입니다.')

    previous_is_active = user.is_active
    user.is_active = data.is_active

    action = 'USER_ACTIVATED' if data.is_active else 'USER_DEACTIVATED'
    message = (
        f'"{user.name}" 계정을 활성화했습니다.'
        if data.is_active
        else f'"{user.name}" 계정을 비활성화했습니다.'
    )
    audit_log = await create_admin_audit_log(
        db,
        actor=current_user,
        action=action,
        description=message,
        subject_user=user,
        metadata=build_audit_metadata(
            previous_role=user.role,
            new_role=user.role,
            previous_is_active=previous_is_active,
            new_is_active=data.is_active,
        ),
    )

    await db.commit()
    await db.refresh(user)
    return ApiResponse(
        success=True,
        data=AdminUserActionResponse(
            user=UserListResponse.model_validate(user),
            action=action,
            audit_log_id=f'admin-audit:{audit_log.id}',
        ),
        message=message,
    )


@router.post('/users/{user_id}/approve', response_model=ApiResponse[AdminUserActionResponse])
async def approve_pending_user(user_id: UUID, data: RoleUpdateRequest, db: DbSession, current_user: AdminUser):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='자기 자신의 계정은 승인할 수 없습니다.',
        )

    user = await get_user_or_404(db, user_id)
    if user.role != 'none':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='승인 대기 상태의 계정만 승인할 수 있습니다.',
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='비활성화된 계정은 승인할 수 없습니다.',
        )

    previous_role = user.role
    user.role = data.role
    message = f'"{user.name}" 계정을 {role_label(data.role)} 권한으로 승인했습니다.'
    audit_log = await create_admin_audit_log(
        db,
        actor=current_user,
        action='USER_APPROVED',
        description=message,
        subject_user=user,
        metadata=build_audit_metadata(
            previous_role=previous_role,
            new_role=data.role,
            previous_is_active=True,
            new_is_active=True,
        ),
    )

    await db.commit()
    await db.refresh(user)
    return ApiResponse(
        success=True,
        data=AdminUserActionResponse(
            user=UserListResponse.model_validate(user),
            action='USER_APPROVED',
            audit_log_id=f'admin-audit:{audit_log.id}',
        ),
        message=message,
    )


@router.post('/users/{user_id}/reject', response_model=ApiResponse[AdminUserActionResponse])
async def reject_pending_user(user_id: UUID, db: DbSession, current_user: AdminUser):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='자기 자신의 계정은 거절할 수 없습니다.',
        )

    user = await get_user_or_404(db, user_id)
    if user.role != 'none':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='승인 대기 상태의 계정만 거절할 수 있습니다.',
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='이미 비활성화된 계정입니다.')

    previous_is_active = user.is_active
    user.is_active = False
    message = f'"{user.name}" 가입 요청을 거절하고 계정을 비활성화했습니다.'
    audit_log = await create_admin_audit_log(
        db,
        actor=current_user,
        action='USER_REJECTED',
        description=message,
        subject_user=user,
        metadata=build_audit_metadata(
            previous_role=user.role,
            new_role=user.role,
            previous_is_active=previous_is_active,
            new_is_active=False,
        ),
    )

    await db.commit()
    await db.refresh(user)
    return ApiResponse(
        success=True,
        data=AdminUserActionResponse(
            user=UserListResponse.model_validate(user),
            action='USER_REJECTED',
            audit_log_id=f'admin-audit:{audit_log.id}',
        ),
        message=message,
    )
