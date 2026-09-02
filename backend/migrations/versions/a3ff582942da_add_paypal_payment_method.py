"""add paypal payment method

Nuevo método de pago manual para el checkout en línea: el cliente transfiere a
la cuenta de PayPal de la dueña (fuera de la app, sin integrar la API de
PayPal) y el pedido queda "Pendiente de pago" -- mismo flujo que SPEI,
reutilizando spei_payment_deadline como ventana genérica de pago manual.

Revision ID: a3ff582942da
Revises: d9fcacf8fe85
Create Date: 2026-09-01 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a3ff582942da'
down_revision = 'd9fcacf8fe85'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'PAYPAL'")


def downgrade():
    # Postgres no permite quitar un valor de un ENUM fácilmente; 'PAYPAL' se queda en el tipo.
    pass
