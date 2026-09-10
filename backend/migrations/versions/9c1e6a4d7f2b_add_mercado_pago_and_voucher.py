"""add mercado pago payment method and payment voucher

Se quita Stripe del checkout en línea y se agrega Mercado Pago como método de pago
manual (la dueña manda el link de cobro por WhatsApp, fuera de la API de Mercado
Pago -- mismo patrón que SPEI/PayPal, pero sin ventana fija de pago porque no hay
una cuenta fija que mostrarle al cliente).

También se agrega payment_voucher_url para que el cliente pueda subir su
comprobante de depósito SPEI desde "Mis Pedidos", y la dueña lo revise y confirme
el pago manualmente desde el panel.

Revision ID: 9c1e6a4d7f2b
Revises: 7a2f4c9e1b3d
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9c1e6a4d7f2b'
down_revision = '7a2f4c9e1b3d'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'MERCADO_PAGO'")
    op.add_column('orders', sa.Column('payment_voucher_url', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('orders', 'payment_voucher_url')
    # Postgres no permite quitar un valor de un ENUM fácilmente; 'MERCADO_PAGO' se queda en el tipo.
