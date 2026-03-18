from uuid import UUID
from fastapi import APIRouter, HTTPException, status, Request
from sqlalchemy import select
from app.api.deps import DbSession, CurrentUser
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, add_token_to_blacklist, is_token_blacklisted,
    get_password_hash,
)
from app.core.rate_limit import limiter
from app.models import User
from app.schemas import ApiResponse, LoginRequest, TokenResponse, RefreshRequest, UserResponse, RegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_token_data(user: User) -> dict:
    """JWT access token에 포함할 유저 정보 (DB 조회 없이 인증 가능)."""
    return {
        "sub": str(user.id),
        "employee_id": user.employee_id,
        "name": user.name,
        "organization": user.organization,
        "role": user.role,
    }


@router.post("/login", response_model=ApiResponse[TokenResponse])
@limiter.limit("5/minute")  # 분당 5회 로그인 시도 제한
async def login(request: Request, login_data: LoginRequest, db: DbSession):
    result = await db.execute(select(User).where(User.employee_id == login_data.employee_id))
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")

    token_data = _user_token_data(user)
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return ApiResponse(
        success=True,
        data=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
@limiter.limit("10/minute")  # 분당 10회 토큰 갱신 제한
async def refresh(request: Request, refresh_data: RefreshRequest, db: DbSession):
    # 블랙리스트 확인
    if is_token_blacklisted(refresh_data.refresh_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    payload = decode_token(refresh_data.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # 기존 refresh token 블랙리스트에 추가
    add_token_to_blacklist(refresh_data.refresh_token)

    token_data = _user_token_data(user)
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return ApiResponse(
        success=True,
        data=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@router.post("/logout", response_model=ApiResponse[bool])
async def logout(request: Request, current_user: CurrentUser):
    """로그아웃 - 현재 토큰 무효화"""
    # Authorization 헤더에서 토큰 추출
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        add_token_to_blacklist(token)

    return ApiResponse(success=True, data=True, message="Successfully logged out")


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_me(current_user: CurrentUser):
    return ApiResponse(success=True, data=UserResponse.model_validate(current_user))


@router.post("/register", response_model=ApiResponse[UserResponse])
@limiter.limit("3/minute")
async def register(request: Request, register_data: RegisterRequest, db: DbSession):
    """회원가입 - role='none'으로 생성, 관리자 승인 필요"""
    result = await db.execute(select(User).where(User.employee_id == register_data.employee_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 등록된 사번입니다")

    user = User(
        employee_id=register_data.employee_id,
        password_hash=get_password_hash(register_data.password),
        name=register_data.name,
        organization=register_data.organization,
        role="none",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return ApiResponse(success=True, data=UserResponse.model_validate(user), message="가입 완료. 관리자 승인 후 이용 가능합니다.")
