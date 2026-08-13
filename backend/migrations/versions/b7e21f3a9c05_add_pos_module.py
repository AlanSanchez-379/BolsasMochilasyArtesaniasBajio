"""add pos module: order channel, cash payment, nullable shipping/user

Punto de Venta (POS): las ventas hechas en tienda física no tienen cuenta de
cliente asociada ni datos de envío, así que esas columnas dejan de ser
obligatorias. Se agrega el canal de la venta (online / in_store) y el método
de pago "cash" (efectivo), exclusivo del POS.

Revision ID: b7e21f3a9c05
Revises: a3f271bd44c1
Create Date: 2026-08-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b7e21f3a9c05'
down_revision = 'a3f271bd44c1'
branch_labels = None
depends_on = None

# SQLAlchemy guarda los Enum de Python por su .name (identificador), no por su .value
# — así ya estaban CARD/SPEI/PENDING_PAYMENT/etc. en el esquema original — así que los
# nuevos valores nativos de Postgres deben seguir esa misma convención (mayúsculas).
order_channel_enum = postgresql.ENUM('ONLINE', 'IN_STORE', name='order_channel')


def upgrade():
    order_channel_enum.create(op.get_bind())
    op.add_column(
        'orders',
        sa.Column('channel', order_channel_enum, nullable=False, server_default=sa.text("'ONLINE'::order_channel")),
    )
    op.alter_column('orders', 'channel', server_default=None)

    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'CASH'")

    op.alter_column('orders', 'user_id', existing_type=postgresql.UUID(), nullable=True)
    op.alter_column('orders', 'shipping_full_name', existing_type=sa.String(length=255), nullable=True)
    op.alter_column('orders', 'shipping_phone', existing_type=sa.String(length=20), nullable=True)
    op.alter_column('orders', 'shipping_street', existing_type=sa.String(length=255), nullable=True)
    op.alter_column('orders', 'shipping_city', existing_type=sa.String(length=100), nullable=True)
    op.alter_column('orders', 'shipping_state', existing_type=sa.String(length=100), nullable=True)
    op.alter_column('orders', 'shipping_postal_code', existing_type=sa.String(length=10), nullable=True)


def downgrade():
    op.alter_column('orders', 'shipping_postal_code', existing_type=sa.String(length=10), nullable=False)
    op.alter_column('orders', 'shipping_state', existing_type=sa.String(length=100), nullable=False)
    op.alter_column('orders', 'shipping_city', existing_type=sa.String(length=100), nullable=False)
    op.alter_column('orders', 'shipping_street', existing_type=sa.String(length=255), nullable=False)
    op.alter_column('orders', 'shipping_phone', existing_type=sa.String(length=20), nullable=False)
    op.alter_column('orders', 'shipping_full_name', existing_type=sa.String(length=255), nullable=False)
    op.alter_column('orders', 'user_id', existing_type=postgresql.UUID(), nullable=False)

    # Postgres no permite quitar un valor de un ENUM fácilmente; 'CASH' se queda en el tipo.

    op.drop_column('orders', 'channel')
    order_channel_enum.drop(op.get_bind())
