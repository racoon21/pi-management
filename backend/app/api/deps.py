from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.security import decode_token, is_token_blacklisted
from app.models import User

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> User:
    """JWT payload에서 유저 정보를 복원 (DB 조회 없음).

    access token에 user 정보가 포함되어 있으므로 DB 왕복 불필요.
    토큰 만료(15분)로 role/active 변경이 자동 반영됨.
    """
    token = credentials.credentials

    if is_token_blacklisted(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # JWT payload에 유저 정보가 있으면 DB 조회 없이 User 객체 생성
    if "role" in payload:
        user = User(
            id=UUID(user_id),
            employee_id=payload.get("employee_id", ""),
            password_hash="",
            name=payload.get("name", ""),
            organization=payload.get("organization", ""),
            role=payload.get("role", "viewer"),
            is_active=True,
        )
        return user

    # Fallback: 기존 토큰(유저 정보 미포함)은 401 → 재로그인 유도
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token upgrade required")


async def get_active_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """role='none' 사용자 차단 — /me 이외의 보호 엔드포인트에서 사용"""
    if user.role == "none":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending approval")
    return user


def require_role(required_roles: list[str]):
    """역할 기반 권한 검사 의존성"""
    async def role_checker(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {required_roles}. Your role: {current_user.role}"
            )
        return current_user
    return role_checker


CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_active_user)]
AdminUser = Annotated[User, Depends(require_role(["admin"]))]
EditorUser = Annotated[User, Depends(require_role(["admin", "editor"]))]
DbSession = Annotated[AsyncSession, Depends(get_db)]
