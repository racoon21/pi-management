#!/bin/bash
set -e

echo "=== PI Management Backend Dev Entrypoint ==="

# DB 테이블 생성 및 시드 데이터 삽입
echo "[1/2] Initializing database tables and seed data..."
python -c "
import asyncio
from app.db.seed import seed_database

async def init():
    try:
        await seed_database()
        print('Database initialized with seed data.')
    except Exception as e:
        print(f'Seed skipped or failed (may already exist): {e}')

asyncio.run(init())
"

# 개발 서버 시작 (hot-reload 활성화)
echo "[2/2] Starting development server with hot-reload..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
