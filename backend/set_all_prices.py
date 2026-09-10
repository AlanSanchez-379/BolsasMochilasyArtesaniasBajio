import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import db
from app.models.product import Product

app = create_app()

def update_all_prices():
    with app.app_context():
        products = Product.query.all()
        count = 0
        for p in products:
            cat = p.category.name if p.category else ""
            ptype = p.print_type or ""
            subcat = p.subcategory or ""
            
            if cat == "Bolsas" and ptype == "YUTE":
                p.price_normal = 145
                p.price_medio = 125
                p.medio_min_qty = 6
                p.price_wholesale = 118
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 110
                p.super_wholesale_min_qty = 50
                p.cost_price = 90
                count += 1
            
            elif cat == "Bolsas" and ptype == "ANIMADO":
                p.price_normal = 185
                p.price_medio = 175
                p.medio_min_qty = 6
                p.price_wholesale = 165
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 150
                p.super_wholesale_min_qty = 50
                count += 1
                
            elif cat == "Tri Combo":
                p.price_normal = 195
                p.price_medio = 185
                p.medio_min_qty = 6
                p.price_wholesale = 175
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 165
                p.super_wholesale_min_qty = 50
                count += 1
                
            elif cat == "Mochilas" and ptype == "ANIMADO":
                p.price_normal = 180
                p.price_medio = 165
                p.medio_min_qty = 6
                p.price_wholesale = 150
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 145
                p.super_wholesale_min_qty = 50
                count += 1
                
            elif cat in ["Cosmetiqueras", "Porta Celular", "Carteras"]:
                p.price_normal = 70
                p.price_medio = 70
                p.medio_min_qty = 6
                p.price_wholesale = 55
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 50
                p.super_wholesale_min_qty = 50
                count += 1
                
            elif cat == "Monederos" and subcat == "Redondo":
                p.price_normal = 25
                p.price_medio = 20
                p.medio_min_qty = 10
                p.price_wholesale = 18
                p.wholesale_min_qty = 30
                p.price_super_wholesale = 15
                p.super_wholesale_min_qty = 100
                count += 1

        db.session.commit()
        print(f"Precios y minimos actualizados exitosamente para {count} productos.")

if __name__ == "__main__":
    update_all_prices()
