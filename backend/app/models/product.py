from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.extensions import db
from .mixins import UUIDPrimaryKeyMixin, TimestampMixin
from .category import SUBCATEGORIES


class Product(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        db.CheckConstraint(f"subcategory IN {tuple(SUBCATEGORIES)}", name="ck_products_subcategory"),
        db.CheckConstraint(
            "(is_bundle = false) OR (bundle_limit IS NOT NULL AND bundle_limit > 0)",
            name="ck_products_bundle_limit",
        ),
    )

    category_id = db.Column(UUID(as_uuid=True), db.ForeignKey("categories.id"), nullable=False)
    subcategory = db.Column(db.String(50), nullable=False)

    name = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text)

    # Precios por volumen (Documento de Requerimientos secc. 2)
    price_normal = db.Column(db.Numeric(10, 2), nullable=False)
    price_wholesale = db.Column(db.Numeric(10, 2), nullable=False)
    price_super_wholesale = db.Column(db.Numeric(10, 2), nullable=False)
    wholesale_min_qty = db.Column(db.Integer, nullable=False, default=6)
    super_wholesale_min_qty = db.Column(db.Integer, nullable=False, default=50)

    # Paquete Emprendedor (Documento de Requerimientos secc. 3)
    is_bundle = db.Column(db.Boolean, nullable=False, default=False)
    bundle_limit = db.Column(db.Integer, nullable=True)  # suma de bundle_category_limits
    # Límite exacto de piezas por categoría, ej. {"Bolsas": 5, "Mochilas": 2}. Solo categorías > 0.
    bundle_category_limits = db.Column(JSONB, nullable=True)

    category = db.relationship("Category", back_populates="products")
    variants = db.relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )

    def price_for_quantity(self, quantity: int):
        if quantity >= self.super_wholesale_min_qty:
            return self.price_super_wholesale
        if quantity >= self.wholesale_min_qty:
            return self.price_wholesale
        return self.price_normal

    def __repr__(self):
        return f"<Product {self.name}>"


class ProductVariant(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "product_variants"

    product_id = db.Column(UUID(as_uuid=True), db.ForeignKey("products.id"), nullable=False)
    color = db.Column(db.String(100), nullable=False)
    sku = db.Column(db.String(100), unique=True, nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=5)
    image_path = db.Column(db.String(500))  # Supabase Storage object path

    product = db.relationship("Product", back_populates="variants")

    def __repr__(self):
        return f"<ProductVariant {self.sku}>"
