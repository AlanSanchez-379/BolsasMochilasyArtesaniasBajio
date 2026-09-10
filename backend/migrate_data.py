import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import db
from app.models.category import Category
from app.models.product import Product
def slugify(text):
    return text.lower().replace(" ", "-")

app = create_app()

def migrate_data():
    with app.app_context():
        # Ensure 'Tri Combo' category exists
        tri_combo_cat = Category.query.filter_by(name="Tri Combo").first()
        if not tri_combo_cat:
            tri_combo_cat = Category(name="Tri Combo", slug=slugify("Tri Combo"))
            db.session.add(tri_combo_cat)
            db.session.commit()

        products = Product.query.all()
        for p in products:
            sub_lower = (p.subcategory or "").lower()
            name_lower = p.name.lower()

            # Assign print_type
            if "yute" in sub_lower or "yute" in name_lower:
                p.print_type = "YUTE"
            elif "animado" in sub_lower or "animado" in name_lower:
                p.print_type = "ANIMADO"
            else:
                p.print_type = "YUTE"

            # Move Tricombo products to Tri Combo category
            if "tricombo" in sub_lower or "tri combo" in name_lower:
                p.category_id = tri_combo_cat.id
                p.subcategory = None

            # Clear old subcategories that are now print_types
            if p.subcategory in ["Estampado en yute", "Estampado animado", "Estampado animado 3D"]:
                p.subcategory = None
            
            # Map subcategories based on name if applicable
            if "mini mochila" in name_lower:
                p.subcategory = "Mini Mochila"
            elif "cuadrado" in name_lower:
                p.subcategory = "Cuadrado"
            elif "redondo" in name_lower:
                p.subcategory = "Redondo"

        db.session.commit()
        print("Data migration complete.")

if __name__ == "__main__":
    migrate_data()
