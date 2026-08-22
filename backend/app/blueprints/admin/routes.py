import json
import uuid

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models import (
    Product,
    ProductVariant,
    Category,
    User,
    UserRole,
    Setting,
    SUBCATEGORIES,
    BUNDLE_SUBCATEGORIES,
    MAX_VARIANT_IMAGES,
)
from app.utils.decorators import role_required
from app.utils.serializers import serialize_product, serialize_order
from app.utils.slugify import unique_slug
from app.utils.supabase_client import get_supabase_admin
from app.utils.shipping_estimate import SHIPPING_SETTING_KEYS
from app.utils.pos_sale import execute_pos_sale, PosSaleError
from app.utils.stats import get_admin_stats_data

from . import admin_bp

STORE_ROLES = (UserRole.ADMIN_STORE.value, UserRole.ADMIN_TECH.value)
SITE_ASSETS_BUCKET = "site-assets"
BRANDING_FOLDER = "branding"
PRODUCT_IMAGES_FOLDER = "products"
ALLOWED_SETTING_TYPES = {"logo": "logo_url", "banner": "banner_url"}
ALLOWED_IMAGE_MIMETYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _public_asset_url_is_valid(url):
    return bool(url) and f"/storage/v1/object/public/{SITE_ASSETS_BUCKET}/" in url


@admin_bp.get("/settings")
@role_required(UserRole.ADMIN_TECH.value)
def get_admin_settings():
    settings = {s.key: s.value for s in Setting.query.all()}
    return jsonify({"logo_url": settings.get("logo_url"), "banner_url": settings.get("banner_url")})


def _upload_image_file(file, folder):
    """Sube un archivo a Storage (dentro de `folder`) y devuelve (public_url, None)
    o (None, (json, status))."""
    if not file or not file.filename:
        return None, (jsonify({"message": "Falta el archivo."}), 400)

    ext = ALLOWED_IMAGE_MIMETYPES.get(file.mimetype)
    if not ext:
        return None, (jsonify({"message": "Formato no soportado. Usa JPG, PNG o WEBP."}), 400)

    path = f"{folder}/{uuid.uuid4().hex}.{ext}"
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

    public_url, error = _upload_image_file(request.files.get("file"), f"{BRANDING_FOLDER}/{asset_type}")
    if error:
        return error

    setting = Setting.query.get(setting_key) or Setting(key=setting_key)
    setting.value = public_url
    db.session.add(setting)
    db.session.commit()

    return jsonify({"key": setting_key, "value": public_url})


def _list_folder_images(folder, limit=None):
    """Lista las imágenes de una carpeta del bucket, más nuevas primero."""
    options = {"sortBy": {"column": "created_at", "order": "desc"}}
    if limit:
        options["limit"] = limit

    client = get_supabase_admin()
    files = client.storage.from_(SITE_ASSETS_BUCKET).list(folder, options)

    return [
        {
            "name": f["name"],
            "url": client.storage.from_(SITE_ASSETS_BUCKET).get_public_url(f"{folder}/{f['name']}"),
            "created_at": (f.get("created_at") or (f.get("metadata") or {}).get("lastModified")),
        }
        for f in files
        if f.get("id")  # descarta el placeholder de carpeta vacía, que no trae id
    ]


@admin_bp.get("/settings/history")
@role_required(UserRole.ADMIN_TECH.value)
def settings_history():
    asset_type = request.args.get("type")
    if asset_type not in ALLOWED_SETTING_TYPES:
        return jsonify({"message": "type debe ser 'logo' o 'banner'."}), 400

    try:
        images = _list_folder_images(f"{BRANDING_FOLDER}/{asset_type}")
    except RuntimeError as e:
        return jsonify({"message": str(e)}), 500
    except Exception as e:
        return jsonify({"message": f"Error al listar el historial: {e}"}), 500
    return jsonify({"images": images})


@admin_bp.patch("/settings")
@role_required(UserRole.ADMIN_TECH.value)
def set_setting_value():
    """Reactiva una imagen ya subida (del historial) como logo/banner actual, sin
    volver a subir el archivo."""
    data = request.get_json() or {}
    key = data.get("key")
    value = data.get("value")

    if key not in ALLOWED_SETTING_TYPES.values():
        return jsonify({"message": "key debe ser 'logo_url' o 'banner_url'."}), 400
    if not _public_asset_url_is_valid(value):
        return jsonify({"message": "value debe ser una URL de una imagen ya subida a este sitio."}), 400

    setting = Setting.query.get(key) or Setting(key=key)
    setting.value = value
    db.session.add(setting)
    db.session.commit()
    return jsonify({"key": key, "value": value})


@admin_bp.get("/shipping-settings")
@role_required(UserRole.ADMIN_TECH.value)
def get_shipping_settings():
    rows = Setting.query.filter(Setting.key.in_(SHIPPING_SETTING_KEYS)).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.patch("/shipping-settings")
@role_required(UserRole.ADMIN_TECH.value)
def update_shipping_settings():
    """Body: { <key>: <value>, ... } — uno o varios de SHIPPING_SETTING_KEYS a la vez.
    Guarda pesos por categoría, peso de empaque, dirección de origen y el costo fijo de
    Tres Guerras, usados para estimar/cotizar envíos con Skydropx."""
    data = request.get_json() or {}
    invalid = set(data) - SHIPPING_SETTING_KEYS
    if invalid:
        return jsonify({"message": f"Claves inválidas: {', '.join(invalid)}"}), 400

    if "shipping_weight_per_category_kg" in data:
        raw = data["shipping_weight_per_category_kg"]
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(parsed, dict):
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"message": "shipping_weight_per_category_kg debe ser un objeto JSON."}), 400
        data["shipping_weight_per_category_kg"] = json.dumps(parsed)

    for key, value in data.items():
        setting = Setting.query.get(key) or Setting(key=key)
        setting.value = str(value) if value is not None else None
        db.session.add(setting)
    db.session.commit()

    rows = Setting.query.filter(Setting.key.in_(data.keys())).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.get("/pos-access-settings")
@role_required(UserRole.ADMIN_TECH.value)
def get_pos_access_settings():
    setting = Setting.query.get("pos_access_pin_hash")
    return jsonify({"pin_configured": bool(setting and setting.value)})


@admin_bp.patch("/pos-access-settings")
@role_required(UserRole.ADMIN_TECH.value)
def update_pos_access_settings():
    """Body: {pin}. Cambia el PIN compartido de la liga de venta local (/venta-local).
    Se guarda hasheado, nunca se expone en texto plano ni el hash a ningún cliente."""
    pin = ((request.get_json() or {}).get("pin") or "").strip()
    if len(pin) < 4:
        return jsonify({"message": "El PIN debe tener al menos 4 caracteres."}), 400
    setting = Setting.query.get("pos_access_pin_hash") or Setting(key="pos_access_pin_hash")
    setting.value = generate_password_hash(pin)
    db.session.add(setting)
    db.session.commit()
    return jsonify({"pin_configured": True})


@admin_bp.get("/products/image-history")
@role_required(*STORE_ROLES)
def product_image_history():
    """Últimas imágenes de producto subidas (de cualquier producto/variante), para
    reutilizarlas sin volver a subir el archivo."""
    try:
        images = _list_folder_images(PRODUCT_IMAGES_FOLDER, limit=60)
    except RuntimeError as e:
        return jsonify({"message": str(e)}), 500
    except Exception as e:
        return jsonify({"message": f"Error al listar el historial: {e}"}), 500
    return jsonify({"images": images})


@admin_bp.post("/upload-image")
@role_required(*STORE_ROLES)
def upload_generic_image():
    """Sube una imagen suelta (ej. variantes de un producto todavía no guardado) y
    devuelve su URL pública, sin asociarla todavía a ningún registro."""
    public_url, error = _upload_image_file(request.files.get("file"), PRODUCT_IMAGES_FOLDER)
    if error:
        return error
    return jsonify({"url": public_url})


@admin_bp.get("/stats")
@role_required(*STORE_ROLES)
def stats():
    return jsonify(get_admin_stats_data())


@admin_bp.post("/pos/sale")
@role_required(*STORE_ROLES)
def pos_sale():
    data = request.get_json() or {}
    try:
        order = execute_pos_sale(
            data.get("items") or [],
            data.get("payment_method"),
            data.get("customer_name"),
            shipping=data.get("shipping"),
            shipping_cost=data.get("shipping_cost"),
        )
    except PosSaleError as e:
        return jsonify({"message": str(e)}), 400
    return jsonify({"order": serialize_order(order)}), 201

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
    "cost_price",
    "is_on_sale",
    "sale_price",
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


def _clean_image_urls(raw):
    """Normaliza la lista de fotos de una variante: descarta vacíos y aplica el
    máximo de MAX_VARIANT_IMAGES."""
    urls = [u for u in (raw or []) if u]
    return urls[:MAX_VARIANT_IMAGES]


def _validate_sale_price(data, product=None):
    """La oferta solo aplica a productos normales (no paquetes) y su precio debe
    ser positivo y menor al precio normal vigente."""
    is_on_sale = data.get("is_on_sale", product.is_on_sale if product else False)
    if not is_on_sale:
        return None

    is_bundle = data.get("is_bundle", product.is_bundle if product else False)
    if is_bundle:
        return "Un paquete no puede marcarse en oferta."

    sale_price = data.get("sale_price", float(product.sale_price) if product and product.sale_price else None)
    if sale_price is None:
        return "Falta el precio de oferta."

    price_normal = data.get("price_normal", float(product.price_normal) if product else None)
    if price_normal is not None and not (0 < float(sale_price) < float(price_normal)):
        return "El precio de oferta debe ser mayor a 0 y menor al precio normal."
    return None


def _validate_subcategory(data):
    """La 'categoría de paquete' (yute / animado 3D / mixto) y la subcategoría de un
    producto normal comparten columna pero son listas de valores distintas."""
    if "subcategory" not in data:
        return None
    is_bundle = data.get("is_bundle", False)
    allowed = BUNDLE_SUBCATEGORIES if is_bundle else SUBCATEGORIES
    if data["subcategory"] not in allowed:
        kind = "de paquete" if is_bundle else ""
        return f"Categoría {kind} inválida. Válidas: {', '.join(allowed)}"
    return None


@admin_bp.get("/products")
@role_required(*STORE_ROLES)
def list_products():
    products = Product.query.order_by(Product.name).all()
    return jsonify({"products": [serialize_product(p) for p in products]})


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

    subcategory_error = _validate_subcategory(data)
    if subcategory_error:
        return jsonify({"message": subcategory_error}), 400

    sale_price_error = _validate_sale_price(data)
    if sale_price_error:
        return jsonify({"message": sale_price_error}), 400

    product = Product(slug=unique_slug(Product, data["name"]))
    _apply_product_fields(product, data)

    for variant_data in data.get("variants", []):
        product.variants.append(
            ProductVariant(
                color=variant_data["color"],
                sku=variant_data["sku"],
                stock=variant_data.get("stock", 0),
                image_paths=_clean_image_urls(variant_data.get("image_urls")),
            )
        )

    db.session.add(product)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al crear el producto: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product)}), 201


@admin_bp.patch("/products/<product_id>")
@role_required(*STORE_ROLES)
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json() or {}

    if "name" in data and data["name"] != product.name:
        product.slug = unique_slug(Product, data["name"], exclude_id=product.id)

    subcategory_error = _validate_subcategory({**data, "is_bundle": data.get("is_bundle", product.is_bundle)})
    if subcategory_error:
        return jsonify({"message": subcategory_error}), 400

    sale_price_error = _validate_sale_price(data, product=product)
    if sale_price_error:
        return jsonify({"message": sale_price_error}), 400

    _apply_product_fields(product, data)

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al actualizar: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product)})


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
        image_paths=_clean_image_urls(data.get("image_urls")),
    )
    db.session.add(variant)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al crear variante: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product)}), 201


@admin_bp.patch("/variants/<variant_id>")
@role_required(*STORE_ROLES)
def update_variant(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)
    data = request.get_json() or {}
    for field in ["color", "sku", "stock", "low_stock_threshold"]:
        if field in data:
            setattr(variant, field, data[field])
    if "image_urls" in data:
        variant.image_paths = _clean_image_urls(data["image_urls"])

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error: {e.orig}"}), 400

    return jsonify({"product": serialize_product(variant.product)})


@admin_bp.post("/variants/<variant_id>/image")
@role_required(*STORE_ROLES)
def upload_variant_image(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)

    existing = variant.image_paths or []
    if len(existing) >= MAX_VARIANT_IMAGES:
        return jsonify({"message": f"Esta variante ya tiene el máximo de {MAX_VARIANT_IMAGES} fotos."}), 400

    public_url, error = _upload_image_file(request.files.get("file"), PRODUCT_IMAGES_FOLDER)
    if error:
        return error

    variant.image_paths = existing + [public_url]
    db.session.commit()
    return jsonify({"product": serialize_product(variant.product)})


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
    return jsonify({"product": serialize_product(product)})


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
