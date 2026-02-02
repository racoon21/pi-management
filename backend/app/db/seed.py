import asyncio
import uuid
import random
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session, engine, Base
from app.models import User, Task, TaskHistory
from app.core.security import get_password_hash

# L1 조직 정의
L1_ORGANIZATIONS = [
    {"name": "네트워크인프라", "team": "인프라운영팀", "keywords": ["네트워크", "인프라", "운영"]},
    {"name": "AI/빅데이터", "team": "AI플랫폼팀", "keywords": ["AI", "빅데이터", "분석"]},
    {"name": "클라우드서비스", "team": "클라우드팀", "keywords": ["클라우드", "AWS", "Azure"]},
    {"name": "보안관제", "team": "보안팀", "keywords": ["보안", "관제", "침해대응"]},
    {"name": "고객서비스", "team": "고객지원팀", "keywords": ["고객", "CS", "서비스"]},
    {"name": "미디어플랫폼", "team": "미디어팀", "keywords": ["미디어", "OTT", "콘텐츠"]},
    {"name": "기업솔루션", "team": "B2B팀", "keywords": ["기업", "B2B", "솔루션"]},
    {"name": "디지털혁신", "team": "DX팀", "keywords": ["DX", "혁신", "디지털"]},
    {"name": "데이터센터", "team": "IDC팀", "keywords": ["IDC", "데이터센터", "호스팅"]},
    {"name": "품질관리", "team": "QA팀", "keywords": ["품질", "QA", "테스트"]},
]

L2_CATEGORIES = ["기획", "개발", "운영", "분석"]
L3_SUBCATEGORIES = ["설계", "구현", "검증", "배포"]
L4_TASKS = ["데이터 수집", "모델 학습", "시스템 연동", "보고서 작성", "성능 최적화", "모니터링 구축", "자동화 스크립트"]

MANAGERS = [
    {"name": "김철수", "id": "EMP001"},
    {"name": "이영희", "id": "EMP002"},
    {"name": "박지민", "id": "EMP003"},
    {"name": "최수현", "id": "EMP004"},
    {"name": "정민우", "id": "EMP005"},
]


async def seed_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Admin 유저 생성
        admin = User(
            employee_id="admin",
            password_hash=get_password_hash("admin123"),
            name="관리자",
            organization="SK브로드밴드",
            role="admin",
        )
        db.add(admin)
        await db.flush()

        # Root 노드
        root = Task(
            id=uuid.uuid4(),
            parent_id=None,
            level="Root",
            name="SKB",
            organization="SK브로드밴드",
            team="전사",
            manager_name="대표이사",
            manager_id="CEO001",
            keywords=["SKB", "통신", "브로드밴드"],
            is_ai_utilized=False,
            created_by=admin.id,
            updated_by=admin.id,
        )
        db.add(root)

        # L1 노드
        l1_nodes = []
        for org in L1_ORGANIZATIONS:
            manager = random.choice(MANAGERS)
            l1 = Task(
                id=uuid.uuid4(),
                parent_id=root.id,
                level="L1",
                name=org["name"],
                organization=org["name"],
                team=org["team"],
                manager_name=manager["name"],
                manager_id=manager["id"],
                keywords=org["keywords"],
                is_ai_utilized=random.random() > 0.7,
                created_by=admin.id,
                updated_by=admin.id,
            )
            db.add(l1)
            l1_nodes.append((l1, org))

        await db.flush()

        # L2, L3, L4 노드 생성
        l4_count = 0
        target_l4 = 1000

        for l1, org in l1_nodes:
            for l2_cat in L2_CATEGORIES:
                manager = random.choice(MANAGERS)
                l2 = Task(
                    id=uuid.uuid4(),
                    parent_id=l1.id,
                    level="L2",
                    name=f"{org['name']} {l2_cat}",
                    organization=org["name"],
                    team=org["team"],
                    manager_name=manager["name"],
                    manager_id=manager["id"],
                    keywords=org["keywords"] + [l2_cat],
                    is_ai_utilized=random.random() > 0.6,
                    created_by=admin.id,
                    updated_by=admin.id,
                )
                db.add(l2)
                await db.flush()

                for l3_sub in L3_SUBCATEGORIES:
                    manager = random.choice(MANAGERS)
                    l3 = Task(
                        id=uuid.uuid4(),
                        parent_id=l2.id,
                        level="L3",
                        name=f"{l2_cat} {l3_sub}",
                        organization=org["name"],
                        team=org["team"],
                        manager_name=manager["name"],
                        manager_id=manager["id"],
                        keywords=org["keywords"] + [l2_cat, l3_sub],
                        is_ai_utilized=random.random() > 0.5,
                        created_by=admin.id,
                        updated_by=admin.id,
                    )
                    db.add(l3)
                    await db.flush()

                    # L4 노드
                    l4_per_l3 = min(7, (target_l4 - l4_count) // max(1, (len(L1_ORGANIZATIONS) * len(L2_CATEGORIES) * len(L3_SUBCATEGORIES) - l4_count // 7)))
                    for i, l4_name in enumerate(L4_TASKS[:l4_per_l3]):
                        if l4_count >= target_l4:
                            break
                        manager = random.choice(MANAGERS)
                        l4 = Task(
                            id=uuid.uuid4(),
                            parent_id=l3.id,
                            level="L4",
                            name=f"{l3_sub} - {l4_name}",
                            organization=org["name"],
                            team=org["team"],
                            manager_name=manager["name"],
                            manager_id=manager["id"],
                            keywords=org["keywords"] + [l2_cat, l3_sub, l4_name],
                            is_ai_utilized=random.random() > 0.4,
                            created_by=admin.id,
                            updated_by=admin.id,
                        )
                        db.add(l4)
                        l4_count += 1

        await db.commit()
        print(f"Seed completed: 1 user, {l4_count} L4 tasks created")


if __name__ == "__main__":
    asyncio.run(seed_database())
