"""add bundle model limits and exclusive products

Revision ID: f2a7c9e4b1d6
Revises: 9c1e6a4d7f2b
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f2a7c9e4b1d6"
down_revision = "9c1e6a4d7f2b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "products",
        sa.Column("is_bundle_exclusive", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("products", sa.Column("bundle_eligible_products", postgresql.JSONB(), nullable=True))
    op.add_column("products", sa.Column("bundle_model_limits", postgresql.JSONB(), nullable=True))
    op.alter_column("products", "is_bundle_exclusive", server_default=None)


def downgrade():
    op.drop_column("products", "bundle_model_limits")
    op.drop_column("products", "bundle_eligible_products")
    op.drop_column("products", "is_bundle_exclusive")
