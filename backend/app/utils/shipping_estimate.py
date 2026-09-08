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
    "shipping_bulk_promo_active",
    "shipping_extended_zone_postal_prefixes",
    "shipping_bundle_fixed_cost",
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
# Costo de envío fijo para pedidos que incluyen un paquete de contenido fijo (tercer
# tipo de Paquete Emprendedor) -- nunca se cotiza con Skydropx/tarifa por zona, la
# dueña define aquí el precio manual que quiere para esos envíos.
DEFAULT_BUNDLE_FIXED_SHIPPING_COST = 380.0

# Pedidos que no califican para tier "light" (ver shipping_route_for_weight) ya no se
# cotizan por paquetería individual -- una sola tarifa fija según la zona del código
# postal de destino, configurable en Ajustes.
ZONE_SHIPPING_COSTS = {"normal": 380.0, "extended": 480.0}

# Asignación automática de caja según el peso estimado del pedido (referencia de
# ~0.45 kg por bolsa para traducir los umbrales de piezas del negocio a kg -- el peso
# real que se usa siempre viene de estimate_package_weight_kg, que ya pesa por
# categoría). "route" define cómo se cotiza el envío:
#   light      -- solo Skydropx en vivo + Tres Guerras a su costo configurable (1 a 3
#                 piezas).
#   medium/voluminous -- se bloquea la llamada a Skydropx, una sola tarifa fija por
#                 zona (ZONE_SHIPPING_COSTS) sin distinguir paquetería (4+ piezas).
# Ajustable moviendo max_kg si cambia cómo se acomoda el producto en bodega.
_WEIGHT_PER_PIECE_REFERENCE_KG = 0.45
BOX_TIERS = [
    {
        "key": "individual",
        "label": "Caja individual",
        "dimensions_cm": "44x34x12",
        "max_kg": round(3 * _WEIGHT_PER_PIECE_REFERENCE_KG, 2),
        "route": "light",
    },
    {
        "key": "6-m",
        "label": "Caja 6-M",
        "dimensions_cm": "36x35x36",
        "max_kg": round(6 * _WEIGHT_PER_PIECE_REFERENCE_KG, 2),
        "route": "medium",
    },
    {
        "key": "12-m",
        "label": "Caja 12-M",
        "dimensions_cm": "36x34x64",
        "max_kg": round(12 * _WEIGHT_PER_PIECE_REFERENCE_KG, 2),
        "route": "medium",
    },
    {
        "key": "consolidada",
        "label": "Caja consolidada (24z/36z)",
        "dimensions_cm": None,
        "max_kg": None,
        "route": "voluminous",
    },
]


def assign_box_tier(weight_kg):
    """Devuelve el tier de caja (dict con key/label/dimensions_cm/max_kg/route) que le
    corresponde a un peso estimado."""
    for tier in BOX_TIERS:
        if tier["max_kg"] is None or weight_kg <= tier["max_kg"]:
            return tier
    return BOX_TIERS[-1]


def shipping_route_for_weight(weight_kg):
    """"light" | "medium" | "voluminous" según el peso estimado del pedido."""
    if weight_kg is None:
        return "light"
    return assign_box_tier(weight_kg)["route"]


def is_light_shipment(weight_kg, bulk_promo_forced=False):
    """El tier "light" es el único que sigue cotizando con Skydropx en vivo -- la promo
    de mayoreo desde 1 pieza fuerza a que un pedido se trate como no-light aunque pese
    poco (bypass a la tarifa fija por zona)."""
    if bulk_promo_forced:
        return False
    return weight_kg is None or shipping_route_for_weight(weight_kg) == "light"


def shipping_zone_for_postal_code(postal_code, settings):
    """"extended" si el código postal empieza con alguno de los prefijos configurados
    en Ajustes (shipping_extended_zone_postal_prefixes), si no "normal"."""
    prefixes = settings.get("extended_zone_postal_prefixes") or []
    postal_code = (postal_code or "").strip()
    if any(postal_code.startswith(prefix) for prefix in prefixes):
        return "extended"
    return "normal"


def zone_shipping_cost(postal_code, settings):
    return ZONE_SHIPPING_COSTS[shipping_zone_for_postal_code(postal_code, settings)]


def carrier_is_allowed(carrier_name):
    """La dueña solo quiere gestionar Tres Guerras/Estafeta/DHL -- cualquier otra
    paquetería que Skydropx llegue a cotizar (FedEx, Redpack, Paquetexpress, etc.) se
    descarta de las opciones que ve el cliente en el checkout (tier light)."""
    name = (carrier_name or "").lower()
    return any(key in name for key in ("estafeta", "dhl"))


def get_shipping_settings_dict():
    """Lee y parsea todas las SHIPPING_SETTING_KEYS de una vez, con defaults sanos."""
    rows = {s.key: s.value for s in Setting.query.filter(Setting.key.in_(SHIPPING_SETTING_KEYS)).all()}

    try:
        weight_per_category = json.loads(rows.get("shipping_weight_per_category_kg") or "{}")
    except (TypeError, ValueError):
        weight_per_category = {}

    try:
        extended_zone_prefixes = json.loads(rows.get("shipping_extended_zone_postal_prefixes") or "[]")
        if not isinstance(extended_zone_prefixes, list):
            extended_zone_prefixes = []
    except (TypeError, ValueError):
        extended_zone_prefixes = []

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
        "bundle_fixed_shipping_cost": _float("shipping_bundle_fixed_cost", DEFAULT_BUNDLE_FIXED_SHIPPING_COST),
        "bulk_promo_active": (rows.get("shipping_bulk_promo_active") or "false").lower() == "true",
        "extended_zone_postal_prefixes": extended_zone_prefixes,
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
