"""add estampado animado subcategory

Revision ID: 8bd5acbc96de
Revises: 12159d93d383
Create Date: 2026-08-06 00:11:55.083125

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8bd5acbc96de'
down_revision = '12159d93d383'
branch_labels = None
depends_on = None


OLD_SUBCATEGORIES = ("Lisas", "Estampado en yute", "Estampado animado 3D", "Tricombo")
NEW_SUBCATEGORIES = ("Lisas", "Estampado animado", "Estampado animado 3D", "Estampado en yute", "Tricombo")


def upgrade():
    op.drop_constraint("ck_products_subcategory", "products", type_="check")
    op.create_check_constraint("ck_products_subcategory", "products", f"subcategory IN {NEW_SUBCATEGORIES}")


def downgrade():
    op.drop_constraint("ck_products_subcategory", "products", type_="check")
    op.create_check_constraint("ck_products_subcategory", "products", f"subcategory IN {OLD_SUBCATEGORIES}")
