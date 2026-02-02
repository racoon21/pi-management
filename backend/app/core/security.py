from datetime import datetime, timedelta
from typing import Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from .config import settings
import hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 토큰 블랙리스트 (프로덕션에서는 Redis 사용 권장)
# 메모리 기반 블랙리스트 (서버 재시작 시 초기화됨)
_token_blacklist: set[str] = set()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password[:72], hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password[:72])


def create_access_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def _hash_token(token: str) -> str:
    """토큰을 해시하여 저장 (메모리 절약)"""
    return hashlib.sha256(token.encode()).hexdigest()


def add_token_to_blacklist(token: str) -> None:
    """토큰을 블랙리스트에 추가"""
    _token_blacklist.add(_hash_token(token))


def is_token_blacklisted(token: str) -> bool:
    """토큰이 블랙리스트에 있는지 확인"""
    return _hash_token(token) in _token_blacklist


def clear_expired_tokens() -> None:
    """만료된 토큰 정리 (주기적으로 호출 권장)"""
    # 프로덕션에서는 Redis TTL 사용 권장
    pass
