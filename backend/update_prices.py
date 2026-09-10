import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import db
from app.models.product import Product

app = create_app()

def update_prices():
    with app.app_context():
        products = Product.query.all()
        for p in products:
            name_lower = p.name.lower()
            sub_lower = (p.subcategory or "").lower()

            if "yute" in name_lower and "animado" not in name_lower and "tri" not in name_lower and "cartera" not in name_lower:
                # Bolsas de yute
                p.price_normal = 145
                p.price_medio = 125
                p.medio_min_qty = 6
                p.price_wholesale = 118
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 110
                p.super_wholesale_min_qty = 50

            elif "animado" in name_lower and "yute" in name_lower:
                # Animado Yute
                p.price_normal = 185
                p.price_medio = 175
                p.medio_min_qty = 6
                p.price_wholesale = 165
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 150
                p.super_wholesale_min_qty = 50

            elif "tri" in name_lower or "combo" in name_lower:
                # Tri combo
                p.price_normal = 195
                p.price_medio = 185
                p.medio_min_qty = 6
                p.price_wholesale = 175
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 165
                p.super_wholesale_min_qty = 50

            elif "mochila" in name_lower and "animado" in name_lower:
                # Mochilas Animado
                p.price_normal = 180
                p.price_medio = 165
                p.medio_min_qty = 6
                p.price_wholesale = 150
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 145
                p.super_wholesale_min_qty = 50

            elif "cosmetiquera" in name_lower or "portacelular" in name_lower or "cartera" in name_lower:
                # Cosmetiqueras - Portacelular sencillo - Cartera Yute
                p.price_normal = 70
                p.price_medio = 70
                p.medio_min_qty = 6
                p.price_wholesale = 55
                p.wholesale_min_qty = 12
                p.price_super_wholesale = 50
                p.super_wholesale_min_qty = 50

            elif "monedero" in name_lower and "redondo" in name_lower:
                # Monedero Redondo
                p.price_normal = 25
                p.price_medio = 20
                p.medio_min_qty = 10
                p.price_wholesale = 18
                p.wholesale_min_qty = 30
                p.price_super_wholesale = 15
                p.super_wholesale_min_qty = 100

        db.session.commit()
        print("Precios actualizados.")

if __name__ == "__main__":
    update_prices()
