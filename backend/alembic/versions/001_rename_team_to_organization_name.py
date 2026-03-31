"""rename team column to organization_name in tasks

Revision ID: 001
Revises:
Create Date: 2026-03-30

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("tasks", "team", new_column_name="organization_name")


def downgrade() -> None:
    op.alter_column("tasks", "organization_name", new_column_name="team")
