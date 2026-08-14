"""drop lisas subcategory

Las subcategorías de producto ahora son fijas y universales para todas las
categorías: Estampado animado, Estampado en yute, Tricombo. "Lisas" deja de
ser una opción (el único producto que la usaba, "Bolsa Broche Ale", ya fue
reasignado a "Estampado en yute"). "Estampado animado 3D" y "Mixto" se
conservan en el constraint porque siguen siendo valores válidos de
BUNDLE_SUBCATEGORIES (columna compartida con la "categoría de paquete").

Revision ID: a8894647647e
Revises: b7e21f3a9c05
Create Date: 2026-08-13 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a8894647647e'
down_revision = 'b7e21f3a9c05'
branch_labels = None
depends_on = None


OLD_SUBCATEGORIES = ("Lisas", "Estampado animado", "Estampado animado 3D", "Estampado en yute", "Tricombo", "Mixto")
NEW_SUBCATEGORIES = ("Estampado animado", "Estampado animado 3D", "Estampado en yute", "Tricombo", "Mixto")


def upgrade():
    op.execute("UPDATE products SET subcategory = 'Estampado en yute' WHERE subcategory = 'Lisas'")
    op.drop_constraint("ck_products_subcategory", "products", type_="check")
    op.create_check_constraint("ck_products_subcategory", "products", f"subcategory IN {NEW_SUBCATEGORIES}")


def downgrade():
    op.drop_constraint("ck_products_subcategory", "products", type_="check")
    op.create_check_constraint("ck_products_subcategory", "products", f"subcategory IN {OLD_SUBCATEGORIES}")
