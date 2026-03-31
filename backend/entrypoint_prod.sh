#!/bin/bash
set -e

echo "=== PI Management Backend Production Entrypoint ==="

# [1/3] Alembic 마이그레이션 실행
echo "[1/3] Running Alembic migrations..."
alembic upgrade head || echo "Alembic migration skipped (may not be initialized)"

# [2/3] 시드 데이터 삽입 (비어있을 때만)
echo "[2/3] Checking seed data..."
python -c "
import asyncio
from app.db.seed import seed_database

async def init():
    try:
        await seed_database()
    except Exception as e:
        print(f'Seed skipped or failed: {e}')

asyncio.run(init())
"

# [3/3] 프로덕션 서버 시작
echo "[3/3] Starting production server..."
exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers ${WORKERS:-2} \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --graceful-timeout 30 \
    --access-logfile -
