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

HEAVY_SHIPMENT_TRES_GUERRAS_COST = 350.0
HEAVY_SHIPMENT_CARRIER_COSTS = {
    "estafeta": 380.0,
    "dhl": 380.0,
}

# Asignación automática de caja según el peso estimado del pedido (referencia de
# ~0.45 kg por bolsa para traducir los umbrales de piezas del negocio a kg -- el peso
# real que se usa siempre viene de estimate_package_weight_kg, que ya pesa por
# categoría). "route" define cómo se cotiza el envío en cada tier:
#   light      -- solo Skydropx en vivo, sin tarifa fija forzada (1 a 3 piezas).
#   medium     -- se cotiza con Skydropx pero Estafeta/DHL se fuerzan al precio fijo
#                 (4 a 12 piezas, cajas 6-M/12-M).
#   voluminous -- se bloquea la llamada a Skydropx por completo, solo tarifas fijas
#                 (13+ piezas, cajas consolidadas 24z/36z).
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


def tres_guerras_cost_for_weight(settings, weight_kg, force_fixed=False):
    """Costo de Tres Guerras: fijo configurado en Ajustes, o el precio fijo de paquete
    pesado si el pedido cae en tier medium/voluminous (o se fuerza por la promo de
    mayoreo desde 1 pieza)."""
    if force_fixed or (weight_kg is not None and shipping_route_for_weight(weight_kg) != "light"):
        return HEAVY_SHIPMENT_TRES_GUERRAS_COST
    return settings["tres_guerras_fixed_cost"]


def override_heavy_shipment_cost(carrier_name, cost, weight_kg):
    """Para cotizaciones reales de Skydropx en el tier medium: si la paquetería es
    Estafeta o DHL, se cobra el precio fijo en vez del cotizado."""
    if weight_kg is None or shipping_route_for_weight(weight_kg) == "light":
        return cost
    name = (carrier_name or "").lower()
    for key, fixed_cost in HEAVY_SHIPMENT_CARRIER_COSTS.items():
        if key in name:
            return fixed_cost
    return cost


def carrier_is_allowed(carrier_name):
    """La dueña solo quiere gestionar Tres Guerras/Estafeta/DHL -- cualquier otra
    paquetería que Skydropx llegue a cotizar (FedEx, Redpack, Paquetexpress, etc.) se
    descarta de las opciones que ve el cliente en el checkout."""
    name = (carrier_name or "").lower()
    return any(key in name for key in HEAVY_SHIPMENT_CARRIER_COSTS)


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
        "bulk_promo_active": (rows.get("shipping_bulk_promo_active") or "false").lower() == "true",
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
