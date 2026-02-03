from pydantic_settings import BaseSettings
from functools import lru_cache
import json
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PI Management API"
    DEBUG: bool = False  # 프로덕션에서는 기본 False
    ENVIRONMENT: str = "production"  # development, staging, production

    # Database (환경변수에서 읽음)
    DATABASE_URL: str = ""

    # DB 개별 설정 (DATABASE_URL이 없을 때 사용)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "pi_user"
    DB_PASSWORD: str = ""
    DB_NAME: str = "pi_management"

    # JWT (프로덕션에서는 반드시 환경변수로 설정)
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # CORS - 환경변수에서 문자열로 받아서 파싱
    CORS_ORIGINS_STR: str = ""

    @property
    def database_url(self) -> str:
        """데이터베이스 URL 반환"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def secret_key(self) -> str:
        """시크릿 키 반환 (없으면 랜덤 생성 - 개발용)"""
        if self.SECRET_KEY:
            return self.SECRET_KEY
        if self.ENVIRONMENT == "development":
            # 개발 환경에서만 임시 키 사용
            return "dev-secret-key-not-for-production"
        raise ValueError("SECRET_KEY must be set in production environment")

    @property
    def CORS_ORIGINS(self) -> list[str]:
        if self.CORS_ORIGINS_STR:
            try:
                # JSON 배열 형식으로 파싱 시도
                return json.loads(self.CORS_ORIGINS_STR)
            except json.JSONDecodeError:
                # 콤마 구분 문자열로 파싱
                return [origin.strip() for origin in self.CORS_ORIGINS_STR.split(",")]

        # 개발 환경 기본값
        if self.ENVIRONMENT == "development":
            return [
                "http://localhost:5173",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:3000",
            ]

        # 프로덕션에서 같은 도메인 서빙 시 CORS 불필요
        # 빈 배열 반환 (same-origin 요청은 CORS 검사 안함)
        return []

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
