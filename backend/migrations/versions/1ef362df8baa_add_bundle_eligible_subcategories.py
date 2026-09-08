"""add bundle_eligible_subcategories to products

Restriccion adicional para paquetes "Elegir mis disenos": ademas del limite
exacto de piezas por categoria (bundle_category_limits), la duena puede
limitar aun mas a subcategorias especificas (Estampado animado / Estampado
en yute / Tricombo). Lista vacia o nula = cualquier subcategoria (igual
que "Mixto" se comportaba antes).

Revision ID: 1ef362df8baa
Revises: bead902fcec4
Create Date: 2026-09-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1ef362df8baa'
down_revision = 'bead902fcec4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('bundle_eligible_subcategories', postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('products', 'bundle_eligible_subcategories')
