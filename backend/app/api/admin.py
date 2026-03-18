from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select
from app.api.deps import DbSession, AdminUser
from app.models import User
from app.schemas import ApiResponse, UserResponse, UserListResponse, RoleUpdateRequest, ActiveUpdateRequest

router = APIRouter(prefix="/admin", tags=["admin"])


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
        select(User).where(User.role == "none", User.is_active == True).order_by(User.created_at.desc())
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
