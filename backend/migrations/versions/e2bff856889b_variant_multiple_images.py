"""variant multiple images

Cada variante admite hasta 3 fotos en vez de una sola. Reemplaza la columna
`image_path` (string) por `image_paths` (lista JSON ordenada, la primera es
la foto de portada que se sigue mostrando en tienda/carrito/POS).

Revision ID: e2bff856889b
Revises: a8894647647e
Create Date: 2026-08-13 00:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e2bff856889b'
down_revision = 'a8894647647e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('product_variants', sa.Column('image_paths', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.execute(
        """
        UPDATE product_variants
        SET image_paths = jsonb_build_array(image_path)
        WHERE image_path IS NOT NULL
        """
    )
    op.drop_column('product_variants', 'image_path')


def downgrade():
    op.add_column('product_variants', sa.Column('image_path', sa.String(length=500), nullable=True))
    op.execute(
        """
        UPDATE product_variants
        SET image_path = image_paths ->> 0
        WHERE image_paths IS NOT NULL AND jsonb_array_length(image_paths) > 0
        """
    )
    op.drop_column('product_variants', 'image_paths')
