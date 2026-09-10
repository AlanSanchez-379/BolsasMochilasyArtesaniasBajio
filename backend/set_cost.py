import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import db
from app.models.product import Product
from app.models.category import Category

app = create_app()

def set_cost_yute():
    with app.app_context():
        # Get category Bolsas
        bolsas_cat = Category.query.filter_by(name="Bolsas").first()
        if not bolsas_cat:
            print("Categoria Bolsas no encontrada")
            return

        products = Product.query.filter_by(category_id=bolsas_cat.id, print_type="YUTE").all()
        count = 0
        for p in products:
            p.cost_price = 90
            count += 1
        
        db.session.commit()
        print(f"Costo actualizado a 90 para {count} bolsas de yute.")

if __name__ == "__main__":
    set_cost_yute()
