"""add product sale price

Página de Ofertas: el dueño de la tienda puede marcar un producto (no un
paquete) como "en oferta" y fijarle un precio de oferta, que reemplaza al
precio normal para compras por debajo del mínimo de mayoreo.

Revision ID: edbe56a0120c
Revises: e2bff856889b
Create Date: 2026-08-13 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'edbe56a0120c'
down_revision = 'e2bff856889b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('is_on_sale', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.alter_column('products', 'is_on_sale', server_default=None)
    op.add_column('products', sa.Column('sale_price', sa.Numeric(10, 2), nullable=True))
    op.create_check_constraint(
        "ck_products_sale_price",
        "products",
        "(is_on_sale = false) OR (sale_price IS NOT NULL AND sale_price > 0)",
    )


def downgrade():
    op.drop_constraint("ck_products_sale_price", "products", type_="check")
    op.drop_column('products', 'sale_price')
    op.drop_column('products', 'is_on_sale')
