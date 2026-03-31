import asyncio
import uuid
from sqlalchemy import select, func
from app.db.session import async_session, engine, Base
from app.models import User, Task
from app.core.security import get_password_hash


async def seed_database():
    """DB 초기 데이터 삽입. 테이블이 비어있을 때만 실행."""
    # 테이블 생성 (없으면 생성, 있으면 무시)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # 이미 데이터가 있으면 skip
        result = await db.execute(select(func.count()).select_from(User))
        user_count = result.scalar()
        if user_count > 0:
            print("Seed skipped: data already exists")
            return

        # 사용자 계정 생성
        admin = User(
            employee_id="admin",
            password_hash=get_password_hash("admin123"),
            name="관리자",
            organization="SK브로드밴드",
            role="admin",
        )
        viewer = User(
            employee_id="viewer",
            password_hash=get_password_hash("viewer123"),
            name="뷰어",
            organization="SK브로드밴드",
            role="viewer",
        )
        editor = User(
            employee_id="editor",
            password_hash=get_password_hash("editor123"),
            name="편집자",
            organization="SK브로드밴드",
            role="editor",
        )
        pending = User(
            employee_id="pending",
            password_hash=get_password_hash("pending123"),
            name="대기자",
            organization="SK브로드밴드",
            role="none",
        )
        db.add_all([admin, viewer, editor, pending])
        await db.flush()

        # Root 노드
        root = Task(
            id=uuid.uuid4(),
            parent_id=None,
            level="Root",
            name="SKB",
            organization="SK브로드밴드",
            organization_name="전사",
            manager_name="대표이사",
            manager_id="CEO001",
            keywords=["SKB", "통신", "브로드밴드"],
            is_ai_utilized=False,
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(root)
        await db.flush()

        # L1: 유선사업본부
        l1 = Task(
            id=uuid.uuid4(),
            parent_id=root.id,
            level="L1",
            name="유선사업본부",
            organization="유선사업본부",
            keywords=[],
            is_ai_utilized=False,
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(l1)

        await db.commit()
        print("Seed completed: Root(SKB) + L1(유선사업본부)")


if __name__ == "__main__":
    asyncio.run(seed_database())
