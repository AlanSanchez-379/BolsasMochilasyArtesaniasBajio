"""add mixto subcategory, drop bundle_eligible_products

La elegibilidad de productos dentro de un Paquete Emprendedor ya no se guarda como
una lista manual (checkboxes) por paquete: ahora se calcula automáticamente a partir
de la "categoría de paquete" (subcategory del propio paquete: yute / animado 3D /
mixto) comparada contra la subcategoría de cada producto candidato.

Revision ID: a3f271bd44c1
Revises: c5fae9c93a2b
Create Date: 2026-08-11 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a3f271bd44c1'
down_revision = 'c5fae9c93a2b'
branch_labels = None
depends_on = None


OLD_SUBCATEGORIES = ("Lisas", "Estampado animado", "Estampado animado 3D", "Estampado en yute", "Tricombo")
NEW_SUBCATEGORIES = ("Lisas", "Estampado animado", "Estampado animado 3D", "Estampado en yute", "Tricombo", "Mixto")


def upgrade():
    op.drop_constraint("ck_products_subcategory", "products", type_="check")
    op.create_check_constraint("ck_products_subcategory", "products", f"subcategory IN {NEW_SUBCATEGORIES}")

    op.drop_table("bundle_eligible_products")


def downgrade():
    op.create_table(
        "bundle_eligible_products",
        sa.Column("bundle_product_id", sa.UUID(), nullable=False),
        sa.Column("eligible_product_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["bundle_product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["eligible_product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("bundle_product_id", "eligible_product_id"),
    )

    op.drop_constraint("ck_products_subcategory", "products", type_="check")
    op.create_check_constraint("ck_products_subcategory", "products", f"subcategory IN {OLD_SUBCATEGORIES}")
