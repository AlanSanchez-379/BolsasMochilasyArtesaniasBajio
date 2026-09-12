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
    PRINT_TYPES,
    MAX_VARIANT_IMAGES,
)
from app.utils.decorators import role_required, pos_admin_required, pos_access_required
from app.utils.serializers import serialize_product
from app.utils.slugify import unique_slug
from app.utils.supabase_client import get_supabase_admin
from app.utils.shipping_estimate import SHIPPING_SETTING_KEYS
from app.utils.uploads import SITE_ASSETS_BUCKET, upload_image_file as _upload_image_file

from . import admin_bp

BRANDING_FOLDER = "branding"
PRODUCT_IMAGES_FOLDER = "products"
ALLOWED_SETTING_TYPES = {"logo": "logo_url", "banner": "banner_url"}
PAYMENT_SETTING_KEYS = {"paypal_receiving_email", "spei_clabe"}
TICKET_SETTING_KEYS = {"ticket_logo_url", "ticket_store_name", "ticket_footer_message", "ticket_qr_url"}


def _public_asset_url_is_valid(url):
    return bool(url) and f"/storage/v1/object/public/{SITE_ASSETS_BUCKET}/" in url


@admin_bp.get("/settings")
@pos_admin_required
def get_admin_settings():
    settings = {s.key: s.value for s in Setting.query.all()}
    return jsonify({"logo_url": settings.get("logo_url"), "banner_url": settings.get("banner_url")})


@admin_bp.post("/settings/upload")
@pos_admin_required
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
@pos_admin_required
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
@pos_admin_required
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
@pos_admin_required
def get_shipping_settings():
    rows = Setting.query.filter(Setting.key.in_(SHIPPING_SETTING_KEYS)).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.patch("/shipping-settings")
@pos_admin_required
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

    if "shipping_extended_zone_postal_prefixes" in data:
        raw = data["shipping_extended_zone_postal_prefixes"]
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
            if not isinstance(parsed, list) or not all(isinstance(p, str) for p in parsed):
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"message": "shipping_extended_zone_postal_prefixes debe ser una lista JSON de texto."}), 400
        data["shipping_extended_zone_postal_prefixes"] = json.dumps(parsed)

    for key, value in data.items():
        setting = Setting.query.get(key) or Setting(key=key)
        setting.value = str(value) if value is not None else None
        db.session.add(setting)
    db.session.commit()

    rows = Setting.query.filter(Setting.key.in_(data.keys())).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.get("/payment-settings")
@pos_admin_required
def get_payment_settings():
    rows = Setting.query.filter(Setting.key.in_(PAYMENT_SETTING_KEYS)).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.patch("/payment-settings")
@pos_admin_required
def update_payment_settings():
    """Body: { <key>: <value>, ... } — uno o varios de PAYMENT_SETTING_KEYS a la vez.
    paypal_receiving_email: la cuenta de PayPal a la que el cliente transfiere
    manualmente (no hay integración con la API de PayPal). spei_clabe: la CLABE que
    se le muestra al elegir SPEI en el checkout."""
    data = request.get_json() or {}
    invalid = set(data) - PAYMENT_SETTING_KEYS
    if invalid:
        return jsonify({"message": f"Claves inválidas: {', '.join(invalid)}"}), 400

    for key, value in data.items():
        setting = Setting.query.get(key) or Setting(key=key)
        setting.value = str(value) if value is not None else None
        db.session.add(setting)
    db.session.commit()

    rows = Setting.query.filter(Setting.key.in_(data.keys())).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.get("/ticket-settings")
@pos_access_required
def get_ticket_settings():
    # Lectura disponible para ambos roles -- un cajero (empleado) también imprime
    # tickets y necesita el logo/mensaje personalizados, aunque no pueda editarlos.
    rows = Setting.query.filter(Setting.key.in_(TICKET_SETTING_KEYS)).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.patch("/ticket-settings")
@pos_admin_required
def update_ticket_settings():
    """Body: { <key>: <value>, ... } — uno o varios de TICKET_SETTING_KEYS a la vez.
    Personalización del ticket de venta impreso (Cobrar): logo, nombre de tienda que se
    muestra, y mensaje de pie de página."""
    data = request.get_json() or {}
    invalid = set(data) - TICKET_SETTING_KEYS
    if invalid:
        return jsonify({"message": f"Claves inválidas: {', '.join(invalid)}"}), 400

    if "ticket_logo_url" in data and data["ticket_logo_url"] and not _public_asset_url_is_valid(data["ticket_logo_url"]):
        return jsonify({"message": "ticket_logo_url debe ser una imagen ya subida a este sitio."}), 400
    if "ticket_qr_url" in data and data["ticket_qr_url"] and not _public_asset_url_is_valid(data["ticket_qr_url"]):
        return jsonify({"message": "ticket_qr_url debe ser una imagen ya subida a este sitio."}), 400

    for key, value in data.items():
        setting = Setting.query.get(key) or Setting(key=key)
        setting.value = str(value) if value is not None else None
        db.session.add(setting)
    db.session.commit()

    rows = Setting.query.filter(Setting.key.in_(data.keys())).all()
    return jsonify({s.key: s.value for s in rows})


@admin_bp.get("/pos-access-settings")
@pos_admin_required
def get_pos_access_settings():
    setting = Setting.query.get("pos_access_pin_hash")
    emp_setting = Setting.query.get("pos_access_employee_pin_hash")
    return jsonify({
        "pin_configured": bool(setting and setting.value),
        "emp_pin_configured": bool(emp_setting and emp_setting.value)
    })


@admin_bp.patch("/pos-access-settings")
@pos_admin_required
def update_pos_access_settings():
    """Body: {pin, emp_pin}. Cambia los PINs compartidos de la liga de venta local."""
    data = request.get_json() or {}
    
    pin = (data.get("pin") or "").strip()
    if pin:
        if len(pin) < 4:
            return jsonify({"message": "El PIN de Admin debe tener al menos 4 caracteres."}), 400
        setting = Setting.query.get("pos_access_pin_hash") or Setting(key="pos_access_pin_hash")
        setting.value = generate_password_hash(pin)
        db.session.add(setting)

    emp_pin = (data.get("emp_pin") or "").strip()
    if emp_pin:
        if len(emp_pin) < 4:
            return jsonify({"message": "El PIN de Empleado debe tener al menos 4 caracteres."}), 400
        setting_emp = Setting.query.get("pos_access_employee_pin_hash") or Setting(key="pos_access_employee_pin_hash")
        setting_emp.value = generate_password_hash(emp_pin)
        db.session.add(setting_emp)

    db.session.commit()
    return jsonify({"ok": True})


@admin_bp.get("/products/image-history")
@pos_admin_required
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
@pos_admin_required
def upload_generic_image():
    """Sube una imagen suelta (ej. variantes de un producto todavía no guardado) y
    devuelve su URL pública, sin asociarla todavía a ningún registro."""
    public_url, error = _upload_image_file(request.files.get("file"), PRODUCT_IMAGES_FOLDER)
    if error:
        return error
    return jsonify({"url": public_url})


PRODUCT_FIELDS = [
    "name",
    "description",
    "category_id",
    "subcategory",
    "print_type",
    "price_normal",
    "price_medio",
    "medio_min_qty",
    "price_wholesale",
    "price_super_wholesale",
    "wholesale_min_qty",
    "super_wholesale_min_qty",
    "cost_price",
    "is_on_sale",
    "sale_price",
    "is_bundle_exclusive",
    "is_bundle",
    "material",
    "medidas",
    "caracteristicas",
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

    # Restricción adicional de subcategorías para "Elegir mis diseños", POR categoría
    # -- se guarda aparte de bundle_category_limits, no afecta bundle_limit.
    # {"Bolsas": ["Estampado en yute"], ...}; categoría con lista vacía se descarta.
    if "bundle_eligible_subcategories" in data:
        per_category = {}
        for category_name, subs in (data["bundle_eligible_subcategories"] or {}).items():
            clean = [s for s in (subs or []) if s in SUBCATEGORIES]
            if clean:
                per_category[category_name] = clean
        product.bundle_eligible_subcategories = per_category or None

    if "bundle_eligible_products" in data:
        product.bundle_eligible_products = [str(product_id) for product_id in (data["bundle_eligible_products"] or [])] or None

    if "bundle_model_limits" in data:
        model_limits = {
            str(product_id): int(limit)
            for product_id, limit in (data["bundle_model_limits"] or {}).items()
            if int(limit or 0) > 0
        }
        product.bundle_model_limits = model_limits or None

    if "bundle_mandatory_models" in data:
        product.bundle_mandatory_models = [str(product_id) for product_id in (data["bundle_mandatory_models"] or [])] or None

    # Paquete de contenido fijo (tercer tipo): producto + cantidad exactas que la
    # dueña arma al crear el paquete -- el cliente elige la variante/color al comprar.
    # bundle_limit se deriva de la suma de piezas, igual que con bundle_category_limits.
    if "bundle_fixed_items" in data:
        items = []
        for item in data["bundle_fixed_items"] or []:
            fixed_product_id = item.get("product_id")
            quantity = int(item.get("quantity") or 0)
            if fixed_product_id and quantity > 0:
                items.append({"product_id": str(fixed_product_id), "quantity": quantity})
        product.bundle_fixed_items = items or None
        if items:
            product.bundle_limit = sum(i["quantity"] for i in items)


def _clean_image_urls(raw):
    """Normaliza la lista de fotos de una variante: descarta vacíos y aplica el
    máximo de MAX_VARIANT_IMAGES."""
    urls = [u for u in (raw or []) if u]
    return urls[:MAX_VARIANT_IMAGES]


def _friendly_variant_integrity_error(e):
    """Traduce el error crudo de Postgres al guardar una variante a un mensaje
    entendible -- el más común es SKU duplicado (columna unique)."""
    if "product_variants_sku_key" in str(e.orig) or "sku" in str(e.orig).lower():
        return "Ese SKU ya está en uso por otra variante. Prueba con otro."
    return "No se pudo guardar la variante. Revisa los datos e intenta de nuevo."


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


def _validate_bundle_fixed_items(data):
    """Cada producto del contenido fijo de un paquete debe existir y ser un producto
    normal (no se puede meter otro paquete dentro de un paquete). El admin solo fija
    el producto y la cantidad -- el cliente elige la variante/color al comprar."""
    if "bundle_fixed_items" not in data or not data["bundle_fixed_items"]:
        return None
    product_ids = [item.get("product_id") for item in data["bundle_fixed_items"] if item.get("product_id")]
    if not product_ids:
        return "El paquete de contenido fijo necesita al menos un producto."
    for product_id in product_ids:
        try:
            uuid.UUID(str(product_id))
        except ValueError:
            return f"Producto inválido en el contenido del paquete: {product_id}."
    products = {str(p.id): p for p in Product.query.filter(Product.id.in_(product_ids)).all()}
    for product_id in product_ids:
        fixed_product = products.get(str(product_id))
        if fixed_product is None:
            return f"Producto inválido en el contenido del paquete: {product_id}."
        if fixed_product.is_bundle:
            return "Un paquete no puede contener otro paquete."
    return None


def _validate_bundle_product_selection(data):
    if "bundle_eligible_products" not in data and "bundle_model_limits" not in data and "bundle_mandatory_models" not in data:
        return None
    product_ids = set(str(product_id) for product_id in (data.get("bundle_eligible_products") or []))
    model_limits = data.get("bundle_model_limits") or {}
    product_ids.update(str(product_id) for product_id in model_limits)
    product_ids.update(str(product_id) for product_id in (data.get("bundle_mandatory_models") or []))
    if not product_ids:
        return None
    for product_id in product_ids:
        try:
            uuid.UUID(product_id)
        except (ValueError, AttributeError):
            return "Hay un producto inválido en la configuración del paquete."
    products = Product.query.filter(Product.id.in_(product_ids)).all()
    found = {str(product.id): product for product in products}
    if len(found) != len(product_ids):
        return "Hay un producto inválido en la configuración del paquete."
    if any(product.is_bundle for product in found.values()):
        return "Un paquete no puede contener otro paquete."
    return None


def _validate_subcategory(data):
    if "subcategory" not in data or not data["subcategory"]:
        return None
    is_bundle = data.get("is_bundle", False)
    allowed = BUNDLE_SUBCATEGORIES if is_bundle else SUBCATEGORIES
    if data["subcategory"] not in allowed:
        kind = "de paquete" if is_bundle else ""
        return f"Subcategoría {kind} inválida. Válidas: {', '.join(allowed)}"
    return None


def _validate_print_type(data):
    if "print_type" not in data or not data["print_type"]:
        return None
    if data["print_type"] not in PRINT_TYPES:
        return f"Tipo de estampado inválido. Válidos: {', '.join(PRINT_TYPES)}"
    return None


@admin_bp.get("/products")
@pos_admin_required
def list_products():
    products = Product.query.order_by(Product.name).all()
    return jsonify({"products": [serialize_product(p, include_cost_price=True) for p in products]})


@admin_bp.post("/products")
@pos_admin_required
def create_product():
    data = request.get_json() or {}
    required = ["name", "category_id", "price_normal", "price_medio", "price_wholesale", "price_super_wholesale"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"message": f"Faltan campos: {', '.join(missing)}"}), 400

    if not Category.query.get(data["category_id"]):
        return jsonify({"message": "Categoría inválida."}), 400

    subcategory_error = _validate_subcategory(data)
    if subcategory_error:
        return jsonify({"message": subcategory_error}), 400

    print_type_error = _validate_print_type(data)
    if print_type_error:
        return jsonify({"message": print_type_error}), 400

    sale_price_error = _validate_sale_price(data)
    if sale_price_error:
        return jsonify({"message": sale_price_error}), 400

    bundle_fixed_items_error = _validate_bundle_fixed_items(data)
    if bundle_fixed_items_error:
        return jsonify({"message": bundle_fixed_items_error}), 400

    bundle_product_selection_error = _validate_bundle_product_selection(data)
    if bundle_product_selection_error:
        return jsonify({"message": bundle_product_selection_error}), 400

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

    return jsonify({"product": serialize_product(product, include_cost_price=True)}), 201


@admin_bp.patch("/products/<product_id>")
@pos_admin_required
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json() or {}

    if "name" in data and data["name"] != product.name:
        product.slug = unique_slug(Product, data["name"], exclude_id=product.id)

    subcategory_error = _validate_subcategory({**data, "is_bundle": data.get("is_bundle", product.is_bundle)})
    if subcategory_error:
        return jsonify({"message": subcategory_error}), 400

    print_type_error = _validate_print_type(data)
    if print_type_error:
        return jsonify({"message": print_type_error}), 400

    sale_price_error = _validate_sale_price(data, product=product)
    if sale_price_error:
        return jsonify({"message": sale_price_error}), 400

    bundle_fixed_items_error = _validate_bundle_fixed_items(data)
    if bundle_fixed_items_error:
        return jsonify({"message": bundle_fixed_items_error}), 400

    bundle_product_selection_error = _validate_bundle_product_selection(data)
    if bundle_product_selection_error:
        return jsonify({"message": bundle_product_selection_error}), 400

    _apply_product_fields(product, data)

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": f"Error al actualizar: {e.orig}"}), 400

    return jsonify({"product": serialize_product(product, include_cost_price=True)})


@admin_bp.delete("/products/<product_id>")
@pos_admin_required
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
@pos_admin_required
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
        return jsonify({"message": _friendly_variant_integrity_error(e)}), 400

    return jsonify({"product": serialize_product(product, include_cost_price=True)}), 201


@admin_bp.patch("/variants/<variant_id>")
@pos_admin_required
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
        return jsonify({"message": _friendly_variant_integrity_error(e)}), 400

    return jsonify({"product": serialize_product(variant.product, include_cost_price=True)})


@admin_bp.post("/variants/<variant_id>/image")
@pos_admin_required
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
    return jsonify({"product": serialize_product(variant.product, include_cost_price=True)})


@admin_bp.delete("/variants/<variant_id>")
@pos_admin_required
def delete_variant(variant_id):
    variant = ProductVariant.query.get_or_404(variant_id)
    product = variant.product
    db.session.delete(variant)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "No se puede eliminar: la variante tiene pedidos asociados."}), 400
    return jsonify({"product": serialize_product(product, include_cost_price=True)})


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
