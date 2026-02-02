FROM python:3.11-slim

# 보안: 비-루트 사용자 생성
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# 의존성 먼저 설치 (캐싱 최적화)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Backend 소스 복사
COPY . .

# Frontend 빌드 파일 복사 (빌드 시 추가됨)
COPY static ./static

# 소유권 변경
RUN chown -R appuser:appgroup /app

# 비-루트 사용자로 전환
USER appuser

# 환경변수 (기본값)
ENV ENVIRONMENT=production
ENV DEBUG=false

# 포트 노출
EXPOSE 8000

# Render는 $PORT 환경변수 사용
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}