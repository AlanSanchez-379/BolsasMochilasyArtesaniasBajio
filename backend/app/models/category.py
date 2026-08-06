from app.extensions import db
from .mixins import UUIDPrimaryKeyMixin

# Fijas y compartidas por todas las categorías (Documento de Requerimientos secc. 2)
SUBCATEGORIES = [
    "Lisas",
    "Estampado animado",
    "Estampado animado 3D",
    "Estampado en yute",
    "Tricombo",
]


class Category(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "categories"

    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)

    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def __repr__(self):
        return f"<Category {self.name}>"
