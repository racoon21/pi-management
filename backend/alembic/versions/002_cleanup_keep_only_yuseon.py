"""Clean up tasks: keep only Root(SKB) + L1(유선사업본부)

Revision ID: 002
Revises: 001
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # L4 → L3 → L2 → L1 순서로 삭제 (FK 제약 준수)
    for level in ["L4", "L3", "L2"]:
        conn.execute(
            sa.text(
                f"DELETE FROM task_histories WHERE task_id IN "
                f"(SELECT id FROM tasks WHERE level = :level)"
            ),
            {"level": level},
        )
        conn.execute(
            sa.text(f"DELETE FROM tasks WHERE level = :level"),
            {"level": level},
        )

    # L1 중 유선사업본부 외 삭제
    conn.execute(
        sa.text(
            "DELETE FROM task_histories WHERE task_id IN "
            "(SELECT id FROM tasks WHERE level = 'L1' AND name != '유선사업본부')"
        )
    )
    conn.execute(
        sa.text(
            "DELETE FROM tasks WHERE level = 'L1' AND name != '유선사업본부'"
        )
    )


def downgrade() -> None:
    # 데이터 마이그레이션은 롤백 불가
    pass
