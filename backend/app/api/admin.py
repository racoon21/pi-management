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
    ApiResponse,
    RoleUpdateRequest,
    UserListResponse,
    UserResponse,
)
from app.services.admin_activity_service import get_admin_activity_feed

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard/summary", response_model=ApiResponse[AdminDashboardSummaryResponse])
async def get_dashboard_summary(db: DbSession, current_user: AdminUser):
    """관리자 대시보드 요약 지표 조회"""
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    inactive_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(False))) or 0
    pending_users = (
        await db.scalar(
            select(func.count(User.id)).where(User.role == "none", User.is_active.is_(True))
        )
        or 0
    )

    recent_cutoff = datetime.utcnow() - timedelta(days=7)
    recent_signups_7d = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= recent_cutoff)
    ) or 0

    role_rows = (await db.execute(select(User.role, func.count(User.id)).group_by(User.role))).all()
    role_counts = {
        "admin": 0,
        "editor": 0,
        "viewer": 0,
        "pending": 0,
    }
    for role, count in role_rows:
        if role == "none":
            role_counts["pending"] = count
        elif role in role_counts:
            role_counts[role] = count

    organization_rows = (
        await db.execute(
            select(User.organization, func.count(User.id).label("user_count"))
            .group_by(User.organization)
            .order_by(func.count(User.id).desc(), User.organization.asc())
            .limit(5)
        )
    ).all()

    recent_signups = (await db.execute(select(User).order_by(User.created_at.desc()).limit(5))).scalars().all()

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


@router.get("/logs/activities", response_model=ApiResponse[AdminActivityFeedResponse])
async def get_admin_logs_activities(
    db: DbSession,
    current_user: AdminUser,
    source: Literal["all", "task_history", "user_signup"] = Query("all"),
    action: Literal["all", "TASK_CREATE", "TASK_UPDATE", "TASK_DELETE", "USER_REGISTERED"] = Query("all"),
    query: str | None = Query(None, min_length=1, max_length=100),
    limit: int = Query(100, ge=1, le=100),
):
    """관리자 활동 로그 원천 데이터 조회"""
    activity_feed = await get_admin_activity_feed(
        db=db,
        source=source,
        action=action,
        query=query,
        limit=limit,
    )
    return ApiResponse(success=True, data=activity_feed)


@router.get("/users", response_model=ApiResponse[list[UserListResponse]])
async def list_users(
    db: DbSession,
    current_user: AdminUser,
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
):
    """전체 사용자 목록 조회"""
    query = select(User).order_by(User.created_at.desc())
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    result = await db.execute(query)
    users = result.scalars().all()
    return ApiResponse(success=True, data=[UserListResponse.model_validate(u) for u in users])


@router.get("/users/pending", response_model=ApiResponse[list[UserListResponse]])
async def list_pending_users(db: DbSession, current_user: AdminUser):
    """승인 대기 중인 사용자 목록"""
    result = await db.execute(
        select(User)
        .where(User.role == "none", User.is_active.is_(True))
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return ApiResponse(
        success=True,
        data=[UserListResponse.model_validate(u) for u in users],
        message=f"대기 중 {len(users)}명",
    )


@router.put("/users/{user_id}/role", response_model=ApiResponse[UserResponse])
async def update_user_role(user_id: UUID, data: RoleUpdateRequest, db: DbSession, current_user: AdminUser):
    """사용자 역할 변경"""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자신의 역할은 변경할 수 없습니다")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    user.role = data.role
    await db.commit()
    await db.refresh(user)
    return ApiResponse(success=True, data=UserResponse.model_validate(user))


@router.put("/users/{user_id}/active", response_model=ApiResponse[UserResponse])
async def update_user_active(user_id: UUID, data: ActiveUpdateRequest, db: DbSession, current_user: AdminUser):
    """사용자 활성 상태 변경"""
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자신의 상태는 변경할 수 없습니다")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다")

    user.is_active = data.is_active
    await db.commit()
    await db.refresh(user)
    return ApiResponse(success=True, data=UserResponse.model_validate(user))
