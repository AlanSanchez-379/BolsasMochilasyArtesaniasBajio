"""add shipping colonia to orders

Skydropx exige la colonia (area_level3) además de calle/ciudad/estado para cotizar y
generar guías reales, tanto del destino del pedido como de la dirección de origen
(Settings). Este pedido guarda la colonia capturada en el checkout.

Revision ID: 118abeaf59cc
Revises: a38444df2f8d
Create Date: 2026-08-21 22:54:37.908789

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '118abeaf59cc'
down_revision = 'a38444df2f8d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('shipping_colonia', sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column('orders', 'shipping_colonia')
