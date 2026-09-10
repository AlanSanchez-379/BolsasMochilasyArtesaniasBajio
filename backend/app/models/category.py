from app.extensions import db
from .mixins import UUIDPrimaryKeyMixin

PRINT_TYPES = ["YUTE", "ANIMADO"]

SUBCATEGORIES_BY_CATEGORY = {
    "Mochilas": ["Mini Mochila"],
    "Monederos": ["Cuadrado", "Redondo"],
}

# Flat list for any generic dropdowns
SUBCATEGORIES = ["Mini Mochila", "Cuadrado", "Redondo"]

BUNDLE_SUBCATEGORIES = ["YUTE", "ANIMADO", "MIXTO"]


class Category(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "categories"

    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)

    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def __repr__(self):
        return f"<Category {self.name}>"
