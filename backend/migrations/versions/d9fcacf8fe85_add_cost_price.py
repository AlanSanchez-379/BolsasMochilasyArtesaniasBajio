"""add cost price

Campo de costo del producto (cuánto le costó a la tienda adquirirlo), para calcular
margen/ganancia. Se guarda en products (costo actual) y en order_items (costo
congelado al momento de cada venta, igual que unit_price, para que el margen histórico
no cambie si el costo del producto se actualiza después).

Revision ID: d9fcacf8fe85
Revises: 118abeaf59cc
Create Date: 2026-08-21 23:46:34.923688

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9fcacf8fe85'
down_revision = '118abeaf59cc'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('cost_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('order_items', sa.Column('cost_price', sa.Numeric(10, 2), nullable=True))


def downgrade():
    op.drop_column('order_items', 'cost_price')
    op.drop_column('products', 'cost_price')
