from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.api import api_router
import os

# Swagger UI 접근 제한 (프로덕션에서는 비활성화)
docs_url = "/docs" if settings.DEBUG else None
redoc_url = "/redoc" if settings.DEBUG else None

app = FastAPI(
    title=settings.APP_NAME,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Rate Limiter 설정
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Trusted Host 미들웨어 (프로덕션에서 호스트 검증)
if settings.ENVIRONMENT == "production" and settings.CORS_ORIGINS:
    from urllib.parse import urlparse
    allowed_hosts = [urlparse(origin).netloc for origin in settings.CORS_ORIGINS]
    allowed_hosts.append("localhost")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# CORS 설정
if settings.DEBUG:
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"CORS Origins: {settings.CORS_ORIGINS}")

# CORS 헤더 제한 (프로덕션용)
allowed_headers = ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"]
expose_headers = ["Content-Length", "X-Request-Id"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=allowed_headers if settings.ENVIRONMENT == "production" else ["*"],
    expose_headers=expose_headers if settings.ENVIRONMENT == "production" else ["*"],
)

# API Routes (먼저 등록)
app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# Frontend 정적 파일 서빙 (프로덕션)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")

if os.path.exists(STATIC_DIR):
    # 정적 에셋 서빙 (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
    
    # SPA fallback - 모든 비-API 경로를 index.html로
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API 경로는 제외
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}
        
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))