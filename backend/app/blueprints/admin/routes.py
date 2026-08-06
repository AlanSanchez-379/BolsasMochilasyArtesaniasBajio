import uuid

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Product,
    ProductVariant,
    BundleEligibleProduct,
    Category,
    User,
    UserRole,
    Order,
    Setting,
    SUCCESSFUL_ORDER_STATUSES,
    PENDING_ORDER_STATUSES,
)
from app.utils.decorators import role_required
from app.utils.serializers import serialize_product
from app.utils.slugify import unique_slug
from app.utils.supabase_client import get_supabase_admin

from . import admin_bp

STORE_ROLES = (UserRole.ADMIN_STORE.value, UserRole.ADMIN_TECH.value)
SITE_ASSETS_BUCKET = "site-assets"
ALLOWED_SETTING_TYPES = {"logo": "logo_url", "banner": "banner_url"}
ALLOWED_IMAGE_MIMETYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@admin_bp.get("/settings")
@role_required(UserRole.ADMIN_TECH.value)
def get_admin_settings():
    settings = {s.key: s.value for s in Setting.query.all()}
    return jsonify({"logo_url": settings.get("logo_url"), "banner_url": settings.get("banner_url")})


def _upload_image_file(file, path_prefix):
    """Sube un archivo a Storage y devuelve (public_url, None) o (None, (json, status))."""
    if not file or not file.filename:
        return None, (jsonify({"message": "Falta el archivo."}), 400)

    ext = ALLOWED_IMAGE_MIMETYPES.get(file.mimetype)
    if not ext:
        return None, (jsonify({"message": "Formato no soportado. Usa JPG, PNG o WEBP."}), 400)

    path = f"{path_prefix}-{uuid.uuid4().hex}.{ext}"
    file_bytes = file.read()

    try:
        client = get_supabase_admin()
        client.storage.from_(SITE_ASSETS_BUCKET).upload(
            path, file_bytes, file_options={"content-type": file.mimetype, "upsert": "true"}
        )
        return client.storage.from_(SITE_ASSETS_BUCKET).get_public_url(path), None
    except RuntimeError as e:
        return None, (jsonify({"message": str(e)}), 500)
    except Exception as e:
        return None, (jsonify({"message": f"Error al subir la imagen: {e}"}), 500)


@admin_bp.post("/settings/upload")
@role_required(UserRole.ADMIN_TECH.value)
def upload_setting_image():
    asset_type = request.form.get("type")
    setting_key = ALLOWED_SETTING_TYPES.get(asset_type)
    if not setting_key:
        return jsonify({"message": "type debe ser 'logo' o 'banner'."}), 400

    public_url, error = _upload_image_file(request.files.get("file"), setting_key)
    if error:
        return error

    setting = Setting.query.get(setting_key) or Setting(key=setting_key)
    setting.value = public_url
    db.session.add(setting)
    db.session.commit()

    return jsonify({"key": setting_key, "value": public_url})


@admin_bp.post("/upload-image")
@role_required(*STORE_ROLES)
def upload_generic_image():
    """Sube una imagen suelta (ej. variantes de un producto todavía no guardado) y
    devuelve su URL pública, sin asociarla todavía a ningún registro."""
    public_url, error = _upload_image_file(request.files.get("file"), "products/new")
    if error:
        return error
    return jsonify({"url": public_url})


@admin_bp.get("/stats")
@role_required(*STORE_ROLES)
def stats():
    successful = Order.query.filter(Order.status.in_(SUCCESSFUL_ORDER_STATUSES))
    total_earnings = successful.with_entities(db.func.coalesce(db.func.sum(Order.total), 0)).scalar()
    total_sales = successful.count()
    pending_orders = Order.query.filter(Order.status.in_(PENDING_ORDER_STATUSES)).count()

    return jsonify(
        {
            "total_earnings": float(total_earnings),
            "total_sales": total_sales,
            "pending_orders": pending_orders,
        }
    )

PRODUCT_FIELDS = [
    "name",
    "description",
    "category_id",
    "subcategory",
    "price_normal",
    "price_wholesale",
    "price_super_wholesale",
    "wholesale_min_qty",
    "super_wholesale_min_qty",
    "is_bundle",
]


def _apply_product_fields(product, data):
    for field in PRODUCT_FIELDS:
        if field in data:
            setattr(product, field, data[field])

    # Los paquetes definen límite exacto de piezas POR categoría (Bolsas, Mochilas, ...);
    # el total (bundle_limit) se deriva automáticamente para no desincronizarse.
    if "bundle_category_limits" in data:
        limits = {k: int(v) for k, v in (data["bundle_category_limits"] or {}).items() if int(v or 0) > 0}
        product.bundle_category_limits = limits or None
        product.bundle_limit = sum(limits.values()) if limits else data.get("bundle_limit")
    elif "bundle_limit" in data:
        product.bundle_limit = data["bundle_limit"]


@admin_bp.get("/products")
@role_required(*STORE_ROLES)
def list_products():
    products = Product.query.order_by(Product.name).all()
    return jsonify({"products": [serialize_product(p, include_eligible_ids=True) for p in products]})


@admin_bp.post("/products")
@role_required(*STORE_ROLES)
def create_product():
    data = request.get_json() or {}
    required = ["name", "category_id", "subcategory", "price_normal", "price_wholesale", "price_super_wholesale"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"message": f"Faltan campos: {', '.join(missing)}"}), 400

    if not Category.query.get(data["category_id"]):
        return jsonify({"message": "Categoría inválida."}), 400

    product = Product(slug=unique_slug(Product, data["name"]))
    _apply_product_fields(product, data)

    for variant_data in data.get("variants", []):
        product.variants.append(
            ProductVariant(
                color=variant_data["color"],
                sku=variant_data["sku"],
                stock=variant_data.get("stock", 0),
                image_path=variant_data.get("image_url"),
            )
        )

    db.session.add(product)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al crear el producto: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product, include_eligible_ids=True)}), 201


@admin_bp.patch("/products/<product_id>")
@role_required(*STORE_ROLES)
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json() or {}

    if "name" in data and data["name"] != product.name:
        product.slug = unique_slug(Product, data["name"], exclude_id=product.id)

    _apply_product_fields(product, data)

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al actualizar: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product, include_eligible_ids=True)})


@admin_bp.delete("/products/<product_id>")
@role_required(*STORE_ROLES)
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "No se puede eliminar: el producto tiene pedidos asociados."}), 400
    return jsonify({"message": "Producto eliminado."})


@admin_bp.put("/products/<product_id>/eligible-products")
@role_required(*STORE_ROLES)
def set_eligible_products(product_id):
    bundle = Product.query.get_or_404(product_id)
    if not bundle.is_bundle:
        return jsonify({"message": "El producto no es un paquete."}), 400

    data = request.get_json() or {}
    eligible_ids = data.get("eligible_product_ids", [])

    if bundle.bundle_category_limits:
        allowed_categories = set(bundle.bundle_category_limits.keys())
        candidates = Product.query.filter(Product.id.in_(eligible_ids)).all()
        invalid = [p.name for p in candidates if p.category.name not in allowed_categories]
        if invalid:
            return jsonify(
                {"message": f"Estos productos no pertenecen a categorías con límite asignado: {', '.join(invalid)}"}
            ), 400

    BundleEligibleProduct.query.filter_by(bundle_product_id=bundle.id).delete()
    for pid in eligible_ids:
        db.session.add(BundleEligibleProduct(bundle_product_id=bundle.id, eligible_product_id=pid))

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error: {e.orig}"}), 400

    return jsonify({"product": serialize_product(bundle, include_eligible_ids=True)})


@admin_bp.post("/products/<product_id>/variants")
@role_required(*STORE_ROLES)
def create_variant(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json() or {}
    if not data.get("color") or not data.get("sku"):
        return jsonify({"message": "color y sku son requeridos."}), 400

    variant = ProductVariant(
        product_id=product.id,
        color=data["color"],
        sku=data["sku"],
        stock=data.get("stock", 0),
        low_stock_threshold=data.get("low_stock_threshold", 5),
        image_path=data.get("image_url"),
    )
    db.session.add(variant)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al crear variante: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product, include_eligible_ids=True)}), 201


@admin_bp.patch("/variants/<variant_id>")
@role_required(*STORE_ROLES)
def update_variant(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)
    data = request.get_json() or {}
    for field in ["color", "sku", "stock", "low_stock_threshold"]:
        if field in data:
            setattr(variant, field, data[field])
    if "image_url" in data:
        variant.image_path = data["image_url"]

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error: {e.orig}"}), 400

    return jsonify({"product": serialize_product(variant.product, include_eligible_ids=True)})


@admin_bp.post("/variants/<variant_id>/image")
@role_required(*STORE_ROLES)
def upload_variant_image(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)

    public_url, error = _upload_image_file(request.files.get("file"), f"products/{variant.sku}")
    if error:
        return error

    variant.image_path = public_url
    db.session.commit()
    return jsonify({"product": serialize_product(variant.product, include_eligible_ids=True)})


@admin_bp.delete("/variants/<variant_id>")
@role_required(*STORE_ROLES)
def delete_variant(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)
    product = variant.product
    db.session.delete(variant)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "No se puede eliminar: la variante tiene pedidos asociados."}), 400
    return jsonify({"product": serialize_product(product, include_eligible_ids=True)})


@admin_bp.get("/users")
@role_required(UserRole.ADMIN_TECH.value)
def list_users():
    users = User.query.order_by(User.email).all()
    return jsonify(
        {
            "users": [
                {"id": str(u.id), "email": u.email, "full_name": u.full_name, "role": u.role.value} for u in users
            ]
        }
    )


@admin_bp.patch("/users/<user_id>/role")
@role_required(UserRole.ADMIN_TECH.value)
def update_user_role(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    try:
        user.role = UserRole(data.get("role"))
    except ValueError:
        return jsonify({"message": f"Rol inválido. Válidos: {[r.value for r in UserRole]}"}), 400
    db.session.commit()
    return jsonify({"user": {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role.value}})
