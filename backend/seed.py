"""Populate Supabase with demo catalog data (categories, products, variants, bundles).

Usage: .venv/Scripts/python.exe seed.py
"""
import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import db
from app.models import Category, Product, ProductVariant
from app.models.category import SUBCATEGORIES

CATEGORY_NAMES = ["Bolsas", "Mochilas", "Carteras", "Cosmetiqueras"]

COLOR_HEX = {
    "Rojo": "FFB6A6",
    "Azul": "67A2C5",
    "Verde": "9BCEC1",
    "Negro": "333333",
    "Crema": "FFEBD3",
    "Surtido": "9BCEC1",
}


def variant_image(text, bg):
    return f"https://placehold.co/400x400/{bg}/ffffff?text={text.replace(' ', '+')}"


def make_variants(sku_prefix, stocks):
    return [
        ProductVariant(
            color=color,
            sku=f"{sku_prefix}-{color[:3].upper()}",
            stock=stock,
            image_path=variant_image(color, COLOR_HEX.get(color, "9BCEC1")),
        )
        for color, stock in stocks.items()
    ]


def run():
    app = create_app()
    with app.app_context():
        if Category.query.first():
            print("Ya hay datos, no se vuelve a sembrar. Borra las tablas si quieres reiniciar.")
            return

        categories = {name: Category(name=name, slug=name.lower()) for name in CATEGORY_NAMES}
        db.session.add_all(categories.values())
        db.session.flush()

        products = [
            Product(
                category=categories["Bolsas"],
                subcategory="Estampado en yute",
                name="Bolsa Yute Premium",
                slug="bolsa-yute-premium",
                description="Bolsa de yute de alta calidad con estampados duraderos. Ideal para el día a día.",
                price_normal=250,
                price_wholesale=190,
                price_super_wholesale=150,
                wholesale_min_qty=6,
                super_wholesale_min_qty=50,
                variants=make_variants("BYP", {"Rojo": 15, "Azul": 0, "Verde": 50, "Negro": 20, "Crema": 5}),
            ),
            Product(
                category=categories["Mochilas"],
                subcategory="Estampado animado 3D",
                name="Mochila 3D Kids",
                slug="mochila-3d-kids",
                description="Mochila escolar con divertidos diseños en 3D.",
                price_normal=350,
                price_wholesale=280,
                price_super_wholesale=220,
                wholesale_min_qty=6,
                super_wholesale_min_qty=50,
                variants=make_variants("M3D", {"Rojo": 12, "Azul": 8, "Verde": 30, "Negro": 18, "Crema": 5}),
            ),
            Product(
                category=categories["Carteras"],
                subcategory="Lisas",
                name="Cartera Clásica",
                slug="cartera-clasica",
                description="Cartera elegante y espaciosa.",
                price_normal=150,
                price_wholesale=100,
                price_super_wholesale=80,
                wholesale_min_qty=10,
                super_wholesale_min_qty=100,
                variants=make_variants("CCL", {"Rojo": 20, "Azul": 15, "Verde": 40, "Negro": 25, "Crema": 5}),
            ),
            Product(
                category=categories["Cosmetiqueras"],
                subcategory="Tricombo",
                name="Cosmetiquera Tricombo",
                slug="cosmetiquera-tricombo",
                description="Cosmetiquera práctica y resistente con diseño tricombo.",
                price_normal=120,
                price_wholesale=85,
                price_super_wholesale=70,
                wholesale_min_qty=12,
                super_wholesale_min_qty=100,
                variants=make_variants("COS", {"Rojo": 18, "Azul": 22, "Verde": 35, "Negro": 20, "Crema": 6}),
            ),
        ]
        db.session.add_all(products)
        db.session.flush()

        bundles = [
            Product(
                category=categories["Bolsas"],
                subcategory="Mixto",
                name="Paquete Emprendedor Básico",
                slug="paquete-emprendedor-basico",
                description="Inicia tu negocio con este paquete. Incluye 10 piezas a elegir de nuestros mejores modelos.",
                price_normal=1800,
                price_wholesale=1800,
                price_super_wholesale=1800,
                wholesale_min_qty=1,
                super_wholesale_min_qty=1,
                is_bundle=True,
                bundle_limit=10,
                variants=make_variants("BUN-BAS", {"Surtido": 50}),
            ),
            Product(
                category=categories["Mochilas"],
                subcategory="Mixto",
                name="Paquete Emprendedor Medio",
                slug="paquete-emprendedor-medio",
                description="Expande tu negocio. Incluye 25 piezas a elegir con un mejor margen de ganancia.",
                price_normal=4200,
                price_wholesale=4200,
                price_super_wholesale=4200,
                wholesale_min_qty=1,
                super_wholesale_min_qty=1,
                is_bundle=True,
                bundle_limit=25,
                variants=make_variants("BUN-MED", {"Surtido": 30}),
            ),
            Product(
                category=categories["Bolsas"],
                subcategory="Mixto",
                name="Súper Paquete Emprendedor",
                slug="super-paquete-emprendedor",
                description="Para mayoristas consolidados. Incluye 50 piezas a elegir con el máximo descuento.",
                price_normal=8000,
                price_wholesale=8000,
                price_super_wholesale=8000,
                wholesale_min_qty=1,
                super_wholesale_min_qty=1,
                is_bundle=True,
                bundle_limit=50,
                variants=make_variants("BUN-MAX", {"Surtido": 15}),
            ),
        ]
        db.session.add_all(bundles)
        db.session.commit()
        print(f"Sembrado: {len(categories)} categorías, {len(products)} productos, {len(bundles)} paquetes.")


if __name__ == "__main__":
    run()
