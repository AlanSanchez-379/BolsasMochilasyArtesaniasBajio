"""add skydropx shipping fields

Integración de Skydropx para cotizar y comprar guías de envío reales. El campo
shipping_carrier deja de ser un enum fijo de Postgres (dhl/estafeta/3guerras) porque
Skydropx cotiza combinaciones dinámicas de paquetería/nivel de servicio; se convierte a
texto libre ("3guerras" para el manual, o "skydropx:<rate_id>" para lo cotizado). Se
agregan columnas para el peso/dimensiones REALES capturados por el admin al empacar, y
el resultado de comprar la guía (tracking, PDF, costo real) para reconciliación manual
contra el estimado que pagó el cliente en el checkout.

Revision ID: a38444df2f8d
Revises: 4ab98a630f53
Create Date: 2026-08-21 22:26:35.297016

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a38444df2f8d'
down_revision = '4ab98a630f53'
branch_labels = None
depends_on = None

_shipping_carrier_enum = postgresql.ENUM('dhl', 'estafeta', '3guerras', name='shipping_carrier')


def upgrade():
    op.alter_column(
        'orders',
        'shipping_carrier',
        type_=sa.String(length=50),
        existing_type=_shipping_carrier_enum,
        postgresql_using='shipping_carrier::text',
    )
    op.execute('DROP TYPE IF EXISTS shipping_carrier')

    op.add_column('orders', sa.Column('package_weight_kg', sa.Numeric(6, 2), nullable=True))
    op.add_column('orders', sa.Column('package_length_cm', sa.Numeric(6, 2), nullable=True))
    op.add_column('orders', sa.Column('package_width_cm', sa.Numeric(6, 2), nullable=True))
    op.add_column('orders', sa.Column('package_height_cm', sa.Numeric(6, 2), nullable=True))

    op.add_column('orders', sa.Column('skydropx_real_cost', sa.Numeric(10, 2), nullable=True))
    op.add_column('orders', sa.Column('skydropx_carrier_name', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('skydropx_service_level', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('skydropx_quotation_id', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('skydropx_rate_id', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('skydropx_shipment_id', sa.String(length=100), nullable=True))

    op.add_column('orders', sa.Column('tracking_number', sa.String(length=100), nullable=True))
    op.add_column('orders', sa.Column('label_url', sa.String(length=500), nullable=True))
    op.add_column('orders', sa.Column('tracking_url_provider', sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column('orders', 'tracking_url_provider')
    op.drop_column('orders', 'label_url')
    op.drop_column('orders', 'tracking_number')

    op.drop_column('orders', 'skydropx_shipment_id')
    op.drop_column('orders', 'skydropx_rate_id')
    op.drop_column('orders', 'skydropx_quotation_id')
    op.drop_column('orders', 'skydropx_service_level')
    op.drop_column('orders', 'skydropx_carrier_name')
    op.drop_column('orders', 'skydropx_real_cost')

    op.drop_column('orders', 'package_height_cm')
    op.drop_column('orders', 'package_width_cm')
    op.drop_column('orders', 'package_length_cm')
    op.drop_column('orders', 'package_weight_kg')

    _shipping_carrier_enum.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        'orders',
        'shipping_carrier',
        type_=_shipping_carrier_enum,
        existing_type=sa.String(length=50),
        postgresql_using='shipping_carrier::shipping_carrier',
    )
