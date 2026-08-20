"""add stripe payment intent id to orders

Pagos con tarjeta reales vía Stripe (Payment Element embebido): cada Order con
payment_method=card guarda el ID del PaymentIntent creado en el checkout, para
poder relacionar los eventos del webhook (payment_intent.succeeded /
payment_intent.payment_failed) con el pedido correspondiente.

Revision ID: 4ab98a630f53
Revises: edbe56a0120c
Create Date: 2026-08-19 23:37:51.651553

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4ab98a630f53'
down_revision = 'edbe56a0120c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('stripe_payment_intent_id', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_orders_stripe_payment_intent_id', 'orders', ['stripe_payment_intent_id'])


def downgrade():
    op.drop_constraint('uq_orders_stripe_payment_intent_id', 'orders', type_='unique')
    op.drop_column('orders', 'stripe_payment_intent_id')
