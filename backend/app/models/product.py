from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.extensions import db
from .mixins import UUIDPrimaryKeyMixin, TimestampMixin
from .category import SUBCATEGORIES

MAX_VARIANT_IMAGES = 3


class Product(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        db.CheckConstraint(f"subcategory IN {tuple(SUBCATEGORIES)}", name="ck_products_subcategory"),
        db.CheckConstraint(
            "(is_bundle = false) OR (bundle_limit IS NOT NULL AND bundle_limit > 0)",
            name="ck_products_bundle_limit",
        ),
        db.CheckConstraint(
            "(is_on_sale = false) OR (sale_price IS NOT NULL AND sale_price > 0)",
            name="ck_products_sale_price",
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

    # Página de Ofertas (etiqueta de descuento manual del dueño de la tienda).
    is_on_sale = db.Column(db.Boolean, nullable=False, default=False)
    sale_price = db.Column(db.Numeric(10, 2), nullable=True)

    # Paquete Emprendedor (Documento de Requerimientos secc. 3)
    is_bundle = db.Column(db.Boolean, nullable=False, default=False)
    bundle_limit = db.Column(db.Integer, nullable=True)  # suma de bundle_category_limits
    # Límite exacto de piezas por categoría, ej. {"Bolsas": 5, "Mochilas": 2}. Solo categorías > 0.
    bundle_category_limits = db.Column(JSONB, nullable=True)

    category = db.relationship("Category", back_populates="products", lazy="selectin")
    variants = db.relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan", lazy="selectin"
    )

    def price_for_quantity(self, quantity: int):
        if quantity >= self.super_wholesale_min_qty:
            return self.price_super_wholesale
        if quantity >= self.wholesale_min_qty:
            return self.price_wholesale
        if self.is_on_sale and self.sale_price is not None:
            return self.sale_price
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
    # Rutas públicas en Supabase Storage, en orden; la primera es la foto de portada
    # (la que se muestra en tienda/carrito/POS). Máximo 3 (MAX_VARIANT_IMAGES).
    image_paths = db.Column(JSONB, nullable=True)

    product = db.relationship("Product", back_populates="variants")

    def __repr__(self):
        return f"<ProductVariant {self.sku}>"
