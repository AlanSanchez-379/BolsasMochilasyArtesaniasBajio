"""add shipping_country to orders

Envíos internacionales: Skydropx no cotiza fuera de México, así que un
pedido con shipping_country distinto de México se crea con costo de envío
en $0 y shipping_carrier="international_pending" -- el pago del producto
se procesa normal, y la dueña cotiza el envío real después a mano (fuera
de la app) y actualiza el costo con PATCH /orders/<id>/shipping-cost.

Revision ID: cf36510ffc63
Revises: a3ff582942da
Create Date: 2026-09-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'cf36510ffc63'
down_revision = 'a3ff582942da'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'orders',
        sa.Column('shipping_country', sa.String(length=100), nullable=True, server_default='México'),
    )
    op.alter_column('orders', 'shipping_country', server_default=None)


def downgrade():
    op.drop_column('orders', 'shipping_country')
