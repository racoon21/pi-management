from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

# PgBouncer 호환성을 위해 prepared statements 비활성화
# Render PostgreSQL은 PgBouncer를 사용하므로 필요
engine = create_async_engine(
    settings.database_url,
    echo=settings.DEBUG,
    # PgBouncer transaction mode에서 prepared statements 비활성화
    connect_args={
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
    },
    # Connection pooling은 PgBouncer가 담당하므로 NullPool 사용
    poolclass=NullPool,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
