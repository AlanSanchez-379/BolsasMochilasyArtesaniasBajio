from app.extensions import db
from .mixins import UUIDPrimaryKeyMixin

# Fijas y compartidas por todas las categorías (Documento de Requerimientos secc. 2)
SUBCATEGORIES = [
    "Estampado animado",
    "Estampado en yute",
    "Tricombo",
]

# "Categoría de paquete": qué tipo de productos puede elegir el cliente dentro de un
# Paquete Emprendedor. Reutiliza dos valores de SUBCATEGORIES (así un paquete de "yute"
# solo admite productos con subcategory="Estampado en yute") más "Mixto", que admite
# cualquier producto sin importar su subcategoría.
BUNDLE_SUBCATEGORIES = ["Estampado en yute", "Estampado animado 3D", "Mixto"]


class Category(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "categories"

    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)

    products = db.relationship("Product", back_populates="category", lazy="dynamic")

    def __repr__(self):
        return f"<Category {self.name}>"
