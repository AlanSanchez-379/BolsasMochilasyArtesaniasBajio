from flask import jsonify, request

from app.extensions import db
from app.models import Category, Product, ProductVariant, SUBCATEGORIES
from app.utils.serializers import serialize_product

from . import catalog_bp


@catalog_bp.get("/categories")
def list_categories():
    categories = Category.query.order_by(Category.name).all()
    return jsonify(
        {
            "categories": [{"id": str(c.id), "name": c.name, "slug": c.slug} for c in categories],
            "subcategories": SUBCATEGORIES,
        }
    )


@catalog_bp.get("/products")
def list_products():
    query = Product.query

    category = request.args.get("category")
    if category and category != "Todos":
        query = query.join(Category).filter(Category.name == category)

    subcategory = request.args.get("subcategory")
    if subcategory and subcategory != "Todas":
        query = query.filter(Product.subcategory == subcategory)

    is_bundle = request.args.get("is_bundle")
    if is_bundle is not None:
        query = query.filter(Product.is_bundle == (is_bundle.lower() == "true"))

    color = request.args.get("color")
    if color and color != "Todos":
        query = query.join(ProductVariant).filter(ProductVariant.color == color)

    search = request.args.get("search")
    if search:
        like = f"%{search}%"
        query = query.outerjoin(ProductVariant).filter(
            db.or_(
                Product.name.ilike(like),
                ProductVariant.sku.ilike(like),
                ProductVariant.color.ilike(like),
            )
        )

    products = query.distinct().all()
    return jsonify({"products": [serialize_product(p) for p in products]})


@catalog_bp.get("/products/<slug>")
def get_product(slug):
    product = Product.query.filter_by(slug=slug).first_or_404()
    return jsonify({"product": serialize_product(product, include_eligible_ids=True)})
