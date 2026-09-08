"""add bundle_fixed_items to products

Tercer tipo de Paquete Emprendedor: contenido fijo definido por la dueña al
crear el paquete (variantes + cantidades exactas, ej. [{"variant_id": "...",
"quantity": 2}, ...]) en vez de que el cliente elija (bundle_custom) o le
toque al azar (bundle_random). Convive con los dos tipos existentes -- un
producto solo entra en modo "fijo" si este campo no está vacío.

Revision ID: bead902fcec4
Revises: cf36510ffc63
Create Date: 2026-09-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'bead902fcec4'
down_revision = 'cf36510ffc63'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('bundle_fixed_items', postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('products', 'bundle_fixed_items')
