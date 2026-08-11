from flask import jsonify, request

from app.extensions import db
from app.models import (
    Category,
    Product,
    ProductVariant,
    OrderItem,
    Order,
    Setting,
    SUBCATEGORIES,
    BUNDLE_SUBCATEGORIES,
    SUCCESSFUL_ORDER_STATUSES,
)
from app.utils.serializers import serialize_product

from . import catalog_bp


@catalog_bp.get("/settings")
def get_settings():
    settings = {s.key: s.value for s in Setting.query.all()}
    return jsonify({"logo_url": settings.get("logo_url"), "banner_url": settings.get("banner_url")})


@catalog_bp.get("/categories")
def list_categories():
    categories = Category.query.order_by(Category.name).all()
    return jsonify(
        {
            "categories": [{"id": str(c.id), "name": c.name, "slug": c.slug} for c in categories],
            "subcategories": SUBCATEGORIES,
            "bundle_subcategories": BUNDLE_SUBCATEGORIES,
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
    return jsonify({"product": serialize_product(product)})


@catalog_bp.get("/products/bestsellers")
def bestsellers():
    limit = min(int(request.args.get("limit", 4)), 20)

    ranked = (
        db.session.query(OrderItem.product_id, db.func.sum(OrderItem.quantity).label("sold"))
        .join(Order, OrderItem.order_id == Order.id)
        .join(Product, OrderItem.product_id == Product.id)
        .filter(Order.status.in_(SUCCESSFUL_ORDER_STATUSES), Product.is_bundle.is_(False))
        .group_by(OrderItem.product_id)
        .order_by(db.desc("sold"))
        .limit(limit)
        .all()
    )

    products = [Product.query.get(row.product_id) for row in ranked]

    if len(products) < limit:
        # Sin suficiente historial de ventas: completa con productos normales al azar.
        existing_ids = {p.id for p in products}
        fallback = (
            Product.query.filter_by(is_bundle=False)
            .filter(~Product.id.in_(existing_ids) if existing_ids else True)
            .limit(limit - len(products))
            .all()
        )
        products += fallback

    return jsonify({"products": [serialize_product(p) for p in products]})
