import json

from app.models import Setting

SHIPPING_SETTING_KEYS = {
    "shipping_weight_per_category_kg",
    "shipping_default_weight_per_piece_kg",
    "shipping_packaging_weight_kg",
    "shipping_origin_name",
    "shipping_origin_phone",
    "shipping_origin_street",
    "shipping_origin_colonia",
    "shipping_origin_city",
    "shipping_origin_state",
    "shipping_origin_postal_code",
    "shipping_tres_guerras_fixed_cost",
}

_ORIGIN_KEYS = {
    "shipping_origin_name": "name",
    "shipping_origin_phone": "phone",
    "shipping_origin_street": "street",
    "shipping_origin_colonia": "colonia",
    "shipping_origin_city": "city",
    "shipping_origin_state": "state",
    "shipping_origin_postal_code": "postal_code",
}

DEFAULT_WEIGHT_PER_PIECE_KG = 0.3
DEFAULT_PACKAGING_WEIGHT_KG = 0.5
DEFAULT_TRES_GUERRAS_COST = 110.0


def get_shipping_settings_dict():
    """Lee y parsea todas las SHIPPING_SETTING_KEYS de una vez, con defaults sanos."""
    rows = {s.key: s.value for s in Setting.query.filter(Setting.key.in_(SHIPPING_SETTING_KEYS)).all()}

    try:
        weight_per_category = json.loads(rows.get("shipping_weight_per_category_kg") or "{}")
    except (TypeError, ValueError):
        weight_per_category = {}

    def _float(key, default):
        raw = rows.get(key)
        try:
            return float(raw) if raw not in (None, "") else default
        except (TypeError, ValueError):
            return default

    return {
        "weight_per_category_kg": weight_per_category,
        "default_weight_per_piece_kg": _float("shipping_default_weight_per_piece_kg", DEFAULT_WEIGHT_PER_PIECE_KG),
        "packaging_weight_kg": _float("shipping_packaging_weight_kg", DEFAULT_PACKAGING_WEIGHT_KG),
        "tres_guerras_fixed_cost": _float("shipping_tres_guerras_fixed_cost", DEFAULT_TRES_GUERRAS_COST),
        "origin_name": rows.get("shipping_origin_name"),
        "origin_phone": rows.get("shipping_origin_phone"),
        "origin_street": rows.get("shipping_origin_street"),
        "origin_colonia": rows.get("shipping_origin_colonia"),
        "origin_city": rows.get("shipping_origin_city"),
        "origin_state": rows.get("shipping_origin_state"),
        "origin_postal_code": rows.get("shipping_origin_postal_code"),
    }


def estimate_package_weight_kg(cart_items, products_by_id, settings=None):
    """Suma quantity * peso_por_categoria(product.category.name) sobre las lineas del
    carrito (usando default_weight_per_piece_kg si la categoria no esta configurada) +
    packaging_weight_kg una sola vez. `cart_items` son los items ya resueltos del
    carrito (dicts con product_id/quantity, mismo shape que usa checkout). Devuelve kg
    (float)."""
    settings = settings or get_shipping_settings_dict()
    weight_per_category = settings["weight_per_category_kg"]
    default_weight = settings["default_weight_per_piece_kg"]

    total_kg = settings["packaging_weight_kg"]
    for item in cart_items:
        product = products_by_id.get(item.get("product_id"))
        if product is None:
            continue
        quantity = int(item.get("quantity") or 0)
        category_name = product.category.name if product.category else None
        weight_per_piece = weight_per_category.get(category_name, default_weight)
        total_kg += quantity * weight_per_piece

    return round(total_kg, 2)


def get_origin_address(settings=None):
    """Devuelve dict {name, phone, street, colonia, city, state, postal_code} desde
    Settings. Lanza ValueError si falta algun campo."""
    settings = settings or get_shipping_settings_dict()
    origin = {short: settings[f"origin_{short}"] for short in _ORIGIN_KEYS.values()}
    missing = [short for short, value in origin.items() if not value]
    if missing:
        raise ValueError(
            "Falta configurar la dirección de origen en Ajustes de envío: " + ", ".join(missing)
        )
    return origin
