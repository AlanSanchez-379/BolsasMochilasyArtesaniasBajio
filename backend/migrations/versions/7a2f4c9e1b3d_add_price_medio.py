"""add price medio

Nuevo nivel de precio intermedio entre "normal" y "mayoreo" (price_medio +
medio_min_qty), para que la dueña pueda dar de alta un cuarto nivel de precio por
volumen además de normal/mayoreo/súper mayoreo.

Se agregan primero como nullable para poder rellenar los productos existentes sin
romper nada (price_medio = price_normal, medio_min_qty = wholesale_min_qty -- el
nivel queda "inactivo" hasta que la dueña lo edite producto por producto), y luego
se pasan a NOT NULL.

Revision ID: 7a2f4c9e1b3d
Revises: 1ef362df8baa
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a2f4c9e1b3d'
down_revision = '1ef362df8baa'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('price_medio', sa.Numeric(10, 2), nullable=True))
    op.add_column('products', sa.Column('medio_min_qty', sa.Integer(), nullable=True))

    products = sa.table(
        'products',
        sa.column('price_medio', sa.Numeric(10, 2)),
        sa.column('medio_min_qty', sa.Integer()),
        sa.column('price_normal', sa.Numeric(10, 2)),
        sa.column('wholesale_min_qty', sa.Integer()),
    )
    op.execute(products.update().values(price_medio=products.c.price_normal, medio_min_qty=products.c.wholesale_min_qty))

    op.alter_column('products', 'price_medio', nullable=False)
    op.alter_column('products', 'medio_min_qty', nullable=False, server_default='3')
    op.alter_column('products', 'medio_min_qty', server_default=None)


def downgrade():
    op.drop_column('products', 'medio_min_qty')
    op.drop_column('products', 'price_medio')
