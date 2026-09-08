from datetime import datetime, timedelta, timezone

import stripe
from flask import jsonify, request, g, current_app

from app.extensions import db
from app.models import (
    Product,
    ProductVariant,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    TRES_GUERRAS_CARRIER_CODE,
    INTERNATIONAL_PENDING_CARRIER_CODE,
)
from app.utils.decorators import login_required
from app.utils.serializers import serialize_order
from app.utils.stock import adjust_stock
from app.utils.shipping_estimate import (
    get_shipping_settings_dict,
    estimate_package_weight_kg,
    get_origin_address,
    carrier_is_allowed,
    is_light_shipment,
    zone_shipping_cost,
)
from app.utils.skydropx_client import get_rates, SkydropxError
from app.utils.online_pricing import apply_online_markup

from . import checkout_bp


class CheckoutError(Exception):
    pass


# Métodos de pago "manuales": el cliente paga fuera de la app (transferencia/PayPal) y
# el pedido queda Pendiente de pago con una ventana antes de liberar inventario --
# a diferencia de tarjeta, que se valida al instante vía Stripe.
MANUAL_PAYMENT_METHODS = (PaymentMethod.SPEI.value, PaymentMethod.PAYPAL.value)

# Código fijo para la tarifa única por zona (ver ZONE_SHIPPING_COSTS en
# shipping_estimate.py) -- reemplaza la distinción por paquetería en pedidos que no
# califican para el tier "light" (ver is_light_shipment).
ZONE_SHIPPING_CARRIER_PREFIX = "zone_shipping"


def _valid_postal_code(postal_code):
    return bool(postal_code) and postal_code.isdigit() and len(postal_code) == 5


_DOMESTIC_COUNTRY_NAMES = {"", "mexico", "méxico", "mx"}


def _is_domestic(country):
    """Skydropx solo cotiza dentro de México -- cualquier otro país entra al flujo de
    envío internacional (sin costo automático, se cotiza a mano después)."""
    return (country or "").strip().lower() in _DOMESTIC_COUNTRY_NAMES


def _international_option():
    return {
        "carrier": INTERNATIONAL_PENDING_CARRIER_CODE,
        "label": "Envío internacional",
        "cost": 0,
        "eta": "Te contactaremos para confirmar el costo real de envío",
    }


BUNDLE_FIXED_SHIPPING_CARRIER = "bundle_fixed_shipping"


def _cart_has_fixed_bundle(items_payload):
    return any(item.get("type") == "bundle_fixed" for item in items_payload)


def _bundle_fixed_shipping_option(settings):
    """Los paquetes de contenido fijo nunca se cotizan con Skydropx/tarifa por zona --
    la dueña definió un precio manual propio para esos envíos."""
    return {
        "carrier": BUNDLE_FIXED_SHIPPING_CARRIER,
        "label": "Envío de paquete",
        "cost": settings["bundle_fixed_shipping_cost"],
        "eta": "3-5 días hábiles",
    }


def _cost_price(product):
    return float(product.cost_price) if product.cost_price is not None else None


def _estimate_cart_weight_kg(items_payload):
    """Estima el peso del carrito sumando quantity * peso-por-categoría, resolviendo
    también las piezas elegidas dentro de paquetes "Elegir mis diseños"."""
    product_ids = set()
    variant_ids = set()
    for item in items_payload:
        if item.get("product_id"):
            product_ids.add(item["product_id"])
        if item.get("type") == "bundle_custom":
            for sel in item.get("selections", []):
                if sel.get("variant_id"):
                    variant_ids.add(sel["variant_id"])

    variants = {str(v.id): v for v in ProductVariant.query.filter(ProductVariant.id.in_(variant_ids)).all()}
    product_ids.update(str(v.product_id) for v in variants.values())
    products = {str(p.id): p for p in Product.query.filter(Product.id.in_(product_ids)).all()}

    cart_items = []
    for item in items_payload:
        item_type = item.get("type")
        if item_type == "simple":
            cart_items.append({"product_id": item.get("product_id"), "quantity": item.get("quantity")})
        elif item_type == "bundle_random":
            cart_items.append({"product_id": item.get("product_id"), "quantity": item.get("quantity") or 1})
        elif item_type == "bundle_custom":
            for sel in item.get("selections", []):
                variant = variants.get(sel.get("variant_id"))
                if variant is not None:
                    cart_items.append({"product_id": str(variant.product_id), "quantity": sel.get("quantity")})

    return estimate_package_weight_kg(cart_items, products)


def _bulk_promo_forced(shipping, settings):
    """La promo "mayoreo desde 1 pieza" es un interruptor de Ajustes -- el cliente solo
    puede activar el bypass si la dueña la dejó prendida; nunca se confía en el flag
    del cliente por sí solo."""
    return bool(shipping.get("use_bulk_promo")) and settings["bulk_promo_active"]


def _tres_guerras_option(settings):
    """Solo se ofrece en el tier "light" -- a partir de ahí se reemplaza por la tarifa
    única por zona (_zone_shipping_option)."""
    return {
        "carrier": TRES_GUERRAS_CARRIER_CODE,
        "label": "Tres Guerras",
        "cost": settings["tres_guerras_fixed_cost"],
        "eta": "3-5 días hábiles",
    }


def _zone_shipping_option(postal_code, settings):
    """Tarifa fija única (sin distinguir paquetería) para pedidos que no califican
    para el tier "light" -- $380/$480 según si el código postal cae en zona extendida
    (configurable en Ajustes)."""
    return {
        "carrier": ZONE_SHIPPING_CARRIER_PREFIX,
        "label": "Envío",
        "cost": zone_shipping_cost(postal_code, settings),
        "eta": "3-5 días hábiles",
    }


def _destination_address(shipping):
    """Arma el dict de dirección {name, phone, street, colonia, city, state,
    postal_code} que espera skydropx_client a partir del payload de envío (mismos
    nombres de campo que llenó el cliente en el formulario de checkout)."""
    return {
        "name": shipping.get("full_name"),
        "phone": shipping.get("phone"),
        "street": shipping.get("street"),
        "colonia": shipping.get("colonia"),
        "city": shipping.get("city"),
        "state": shipping.get("state"),
        "postal_code": shipping.get("postal_code"),
    }


def _skydropx_options(items_payload, shipping, settings, weight_kg):
    """Cotiza con Skydropx usando un peso estimado del carrito -- solo se llama para el
    tier "light" (ver is_light_shipment). Si falta la dirección de origen/destino o la
    llamada falla, degrada devolviendo lista vacía en vez de tronar la cotización
    completa (Tres Guerras sigue disponible como respaldo)."""
    try:
        origin = get_origin_address(settings)
    except ValueError:
        return [], True

    destination = _destination_address(shipping)
    if not all(destination.get(f) for f in ("street", "colonia", "city", "state", "postal_code")):
        return [], True

    try:
        rates = get_rates(origin, destination, weight_kg)
    except SkydropxError:
        return [], True

    # Solo se gestionan Estafeta y DHL (Tres Guerras es la opción fija aparte) --
    # cualquier otra paquetería que Skydropx cotice se descarta.
    rates = [r for r in rates if carrier_is_allowed(r["carrier_name"])]

    return [
        {
            "carrier": f"skydropx:{rate['rate_id']}",
            "label": f"{rate['carrier_name']} · {rate['service_level']}",
            "cost": rate["cost"],
            "eta": f"{rate['eta_days']} días hábiles" if rate.get("eta_days") else "Tiempo estimado por confirmar",
            "rate_id": rate["rate_id"],
            "quotation_id": rate["quotation_id"],
        }
        for rate in rates
    ], False


@checkout_bp.post("/quote")
def quote():
    data = request.get_json() or {}
    items_payload = data.get("items") or []

    if not _is_domestic(data.get("country")):
        return jsonify({"options": [_international_option()], "skydropx_unavailable": False, "international": True})

    postal_code = (data.get("postal_code") or "").strip()
    if not _valid_postal_code(postal_code):
        return jsonify({"message": "Código postal inválido. Debe tener 5 dígitos."}), 400

    settings = get_shipping_settings_dict()

    if _cart_has_fixed_bundle(items_payload):
        return jsonify(
            {
                "options": [_bundle_fixed_shipping_option(settings)],
                "skydropx_unavailable": False,
                "bulk_promo_available": settings["bulk_promo_active"],
                "international": False,
            }
        )

    weight_kg = _estimate_cart_weight_kg(items_payload)
    bulk_promo_forced = _bulk_promo_forced(data, settings)

    if is_light_shipment(weight_kg, bulk_promo_forced):
        skydropx_options, skydropx_unavailable = _skydropx_options(items_payload, data, settings, weight_kg)
        options = skydropx_options + [_tres_guerras_option(settings)]
    else:
        skydropx_unavailable = False
        options = [_zone_shipping_option(postal_code, settings)]

    return jsonify(
        {
            "options": options,
            "skydropx_unavailable": skydropx_unavailable,
            "bulk_promo_available": settings["bulk_promo_active"],
            "international": False,
        }
    )


def _build_order(items_payload, shipping, payment_method):
    variant_ids = set()
    product_ids = set()
    for item in items_payload:
        item_type = item.get("type")
        if item_type == "simple":
            if item.get("variant_id"):
                variant_ids.add(item["variant_id"])
            if item.get("product_id"):
                product_ids.add(item["product_id"])
        elif item_type in ("bundle_random", "bundle_custom", "bundle_fixed"):
            if item.get("product_id"):
                product_ids.add(item["product_id"])
            for sel in item.get("selections", []):
                if sel.get("variant_id"):
                    variant_ids.add(sel["variant_id"])
        else:
            raise CheckoutError("Tipo de artículo inválido en el carrito.")

    products = {str(p.id): p for p in Product.query.filter(Product.id.in_(product_ids)).all()}
    variants = {
        str(v.id): v
        for v in ProductVariant.query.filter(ProductVariant.id.in_(variant_ids)).with_for_update().all()
    }

    def lock_variant(variant_id):
        key = str(variant_id)
        if key not in variants:
            v = ProductVariant.query.with_for_update().get(variant_id)
            if v is not None:
                variants[key] = v
        return variants.get(key)

    # Mayoreo combinado (mix & match): el precio por volumen se decide por el total de
    # piezas de productos normales de la MISMA línea (subcategory) en el carrito -- no
    # se puede combinar, por ejemplo, animado con yute para alcanzar el mínimo de
    # mayoreo. Los paquetes tienen precio fijo y no participan en esta suma.
    combined_qty_by_subcategory = {}
    for item in items_payload:
        if item.get("type") != "simple":
            continue
        p = products.get(item.get("product_id"))
        if p is None:
            continue
        combined_qty_by_subcategory[p.subcategory] = combined_qty_by_subcategory.get(
            p.subcategory, 0
        ) + int(item.get("quantity") or 0)

    order_items = []
    subtotal = 0.0

    for item in items_payload:
        item_type = item["type"]
        product = products.get(item.get("product_id"))
        if product is None:
            raise CheckoutError("Producto no encontrado.")

        if item_type == "simple":
            variant = variants.get(item.get("variant_id"))
            quantity = int(item.get("quantity") or 0)
            if variant is None or str(variant.product_id) != str(product.id):
                raise CheckoutError(f"Variante inválida para {product.name}.")
            if quantity < 1:
                raise CheckoutError(f"Cantidad inválida para {product.name}.")
            if variant.stock < quantity:
                raise CheckoutError(
                    f"Stock insuficiente para {product.name} ({variant.color}). Disponible: {variant.stock}."
                )
            combined_qty = combined_qty_by_subcategory.get(product.subcategory, quantity)
            unit_price = apply_online_markup(float(product.price_for_quantity(combined_qty)))
            variant.stock -= quantity
            order_items.append(
                OrderItem(
                    product_id=product.id,
                    variant_id=variant.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    cost_price=_cost_price(product),
                )
            )
            subtotal += unit_price * quantity

        elif item_type == "bundle_random":
            if not product.is_bundle:
                raise CheckoutError(f"{product.name} no es un paquete.")
            quantity = int(item.get("quantity") or 1)
            bundle_variant = lock_variant(product.variants[0].id) if product.variants else None
            if bundle_variant is None:
                raise CheckoutError(f"Paquete sin variante configurada: {product.name}.")
            if bundle_variant.stock < quantity:
                raise CheckoutError(f"No hay suficientes paquetes disponibles de {product.name}.")
            unit_price = apply_online_markup(float(product.price_for_quantity(1)))
            bundle_variant.stock -= quantity
            order_items.append(
                OrderItem(
                    product_id=product.id,
                    variant_id=bundle_variant.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    cost_price=_cost_price(product),
                )
            )
            subtotal += unit_price * quantity

        elif item_type == "bundle_custom":
            if not product.is_bundle:
                raise CheckoutError(f"{product.name} no es un paquete.")
            selections = item.get("selections") or []
            category_limits = product.bundle_category_limits or {}

            resolved = []  # (variant, sel_qty, category_name)
            category_totals = {}
            for sel in selections:
                variant = variants.get(sel.get("variant_id"))
                sel_qty = int(sel.get("quantity") or 0)
                if variant is None or sel_qty < 1:
                    raise CheckoutError(f"Selección inválida en el paquete {product.name}.")
                # Un producto solo entra en el paquete si su subcategoría está en la
                # lista de elegibles de SU categoría (vacía/ausente = cualquier
                # subcategoría permitida en esa categoría).
                if variant.product.is_bundle:
                    raise CheckoutError(f"Un paquete no puede contener otro paquete ({product.name}).")
                eligible_subs = (product.bundle_eligible_subcategories or {}).get(variant.product.category.name)
                if eligible_subs and variant.product.subcategory not in eligible_subs:
                    raise CheckoutError(f"Un producto elegido no pertenece al paquete {product.name}.")
                if variant.stock < sel_qty:
                    raise CheckoutError(
                        f"Stock insuficiente para completar el paquete {product.name} "
                        f"({variant.color}). Disponible: {variant.stock}."
                    )
                category_name = variant.product.category.name
                category_totals[category_name] = category_totals.get(category_name, 0) + sel_qty
                resolved.append((variant, sel_qty))

            if category_limits:
                for category_name, limit in category_limits.items():
                    if limit and category_totals.get(category_name, 0) != limit:
                        raise CheckoutError(
                            f"El paquete {product.name} requiere exactamente {limit} piezas de "
                            f"{category_name} ({category_totals.get(category_name, 0)} enviadas)."
                        )
                extra_categories = set(category_totals) - {c for c, l in category_limits.items() if l}
                if extra_categories:
                    raise CheckoutError(
                        f"El paquete {product.name} no acepta piezas de: {', '.join(extra_categories)}."
                    )
            else:
                total_pieces = sum(q for _, q in resolved)
                if product.bundle_limit and total_pieces != product.bundle_limit:
                    raise CheckoutError(
                        f"El paquete {product.name} requiere exactamente {product.bundle_limit} piezas "
                        f"({total_pieces} enviadas)."
                    )

            bundle_variant = lock_variant(product.variants[0].id) if product.variants else None
            if bundle_variant is None:
                raise CheckoutError(f"Paquete sin variante configurada: {product.name}.")
            if bundle_variant.stock < 1:
                raise CheckoutError(f"No hay más paquetes disponibles de {product.name}.")

            unit_price = apply_online_markup(float(product.price_for_quantity(1)))
            bundle_variant.stock -= 1
            parent_item = OrderItem(
                product_id=product.id,
                variant_id=bundle_variant.id,
                quantity=1,
                unit_price=unit_price,
                cost_price=_cost_price(product),
            )
            order_items.append(parent_item)
            subtotal += unit_price

            for variant, sel_qty in resolved:
                variant.stock -= sel_qty
                order_items.append(
                    OrderItem(
                        product_id=variant.product_id,
                        variant_id=variant.id,
                        quantity=sel_qty,
                        unit_price=0,
                        cost_price=_cost_price(variant.product),
                        bundle_parent=parent_item,
                    )
                )

        elif item_type == "bundle_fixed":
            if not product.is_bundle or not product.bundle_fixed_items:
                raise CheckoutError(f"{product.name} no es un paquete de contenido fijo.")
            package_qty = int(item.get("quantity") or 1)
            if package_qty < 1:
                raise CheckoutError(f"Cantidad inválida para {product.name}.")

            # El admin solo fija QUÉ PRODUCTO y CUÁNTAS piezas -- el cliente elige la
            # variante/color exacta al comprar, igual que en "Elegir mis diseños".
            fixed_by_product = {fi["product_id"]: fi["quantity"] for fi in product.bundle_fixed_items}
            selections = item.get("selections") or []

            resolved = []  # (variant, sel_qty)
            selected_by_product = {}
            for sel in selections:
                variant = lock_variant(sel.get("variant_id"))
                sel_qty = int(sel.get("quantity") or 0)
                if variant is None or sel_qty < 1:
                    raise CheckoutError(f"Selección inválida en el paquete {product.name}.")
                if str(variant.product_id) not in fixed_by_product:
                    raise CheckoutError(f"Un producto elegido no pertenece al paquete {product.name}.")
                if variant.stock < sel_qty:
                    raise CheckoutError(
                        f"Stock insuficiente para completar el paquete {product.name} "
                        f"({variant.color}). Disponible: {variant.stock}."
                    )
                selected_by_product[str(variant.product_id)] = selected_by_product.get(str(variant.product_id), 0) + sel_qty
                resolved.append((variant, sel_qty))

            for fixed_product_id, qty_per_package in fixed_by_product.items():
                required = qty_per_package * package_qty
                got = selected_by_product.get(fixed_product_id, 0)
                if got != required:
                    raise CheckoutError(
                        f"El paquete {product.name} requiere exactamente {required} piezas de cada "
                        f"producto incluido ({got} enviadas de uno de ellos)."
                    )

            bundle_variant = lock_variant(product.variants[0].id) if product.variants else None
            if bundle_variant is None:
                raise CheckoutError(f"Paquete sin variante configurada: {product.name}.")
            if bundle_variant.stock < package_qty:
                raise CheckoutError(f"No hay suficientes paquetes disponibles de {product.name}.")

            unit_price = apply_online_markup(float(product.price_for_quantity(1)))
            bundle_variant.stock -= package_qty
            parent_item = OrderItem(
                product_id=product.id,
                variant_id=bundle_variant.id,
                quantity=package_qty,
                unit_price=unit_price,
                cost_price=_cost_price(product),
            )
            order_items.append(parent_item)
            subtotal += unit_price * package_qty

            for variant, sel_qty in resolved:
                variant.stock -= sel_qty
                order_items.append(
                    OrderItem(
                        product_id=variant.product_id,
                        variant_id=variant.id,
                        quantity=sel_qty,
                        unit_price=0,
                        cost_price=_cost_price(variant.product),
                        bundle_parent=parent_item,
                    )
                )

    if not order_items:
        raise CheckoutError("El carrito está vacío.")

    carrier_code = shipping.get("carrier") or ""
    domestic = _is_domestic(shipping.get("country"))

    if not domestic:
        # Skydropx no cotiza fuera de México -- el pedido se crea sin costo de envío;
        # la dueña lo cotiza a mano y lo cobra aparte después de confirmar el pago del
        # producto.
        carrier_code = INTERNATIONAL_PENDING_CARRIER_CODE
        shipping_cost = 0.0
    else:
        if not _valid_postal_code(shipping.get("postal_code", "")):
            raise CheckoutError("Código postal inválido.")

        settings = get_shipping_settings_dict()

        if _cart_has_fixed_bundle(items_payload):
            # Los paquetes de contenido fijo nunca se cotizan con Skydropx/zona --
            # tarifa manual propia, sin importar peso ni destino.
            if carrier_code != BUNDLE_FIXED_SHIPPING_CARRIER:
                raise CheckoutError("Esa opción de envío no está disponible para este pedido. Cotiza de nuevo.")
            shipping_cost = settings["bundle_fixed_shipping_cost"]
            weight_kg = None
        else:
            weight_kg = _estimate_cart_weight_kg(items_payload)
            bulk_promo_forced = _bulk_promo_forced(shipping, settings)
            light = is_light_shipment(weight_kg, bulk_promo_forced)

            if not light:
                # Ya no se distingue paquetería en pedidos que no califican para "light" --
                # una sola tarifa fija por zona, recalculada en el servidor (nunca confiar en
                # el costo que mandó el cliente).
                if carrier_code != ZONE_SHIPPING_CARRIER_PREFIX:
                    raise CheckoutError("Esa opción de envío no está disponible para este pedido. Cotiza de nuevo.")
                shipping_cost = zone_shipping_cost(shipping.get("postal_code"), settings)
            elif carrier_code == TRES_GUERRAS_CARRIER_CODE:
                shipping_cost = settings["tres_guerras_fixed_cost"]
            elif carrier_code.startswith("skydropx:"):
                # Nunca confiar en un precio mandado por el cliente: se vuelve a cotizar en el
                # servidor con el mismo rate_id antes de cobrar/crear la orden.
                rate_id = carrier_code.split(":", 1)[1]
                try:
                    origin = get_origin_address(settings)
                    rates = get_rates(origin, _destination_address(shipping), weight_kg)
                except (ValueError, SkydropxError):
                    raise CheckoutError("No se pudo confirmar el costo de envío. Cotiza de nuevo.")
                matching_rate = next((r for r in rates if r["rate_id"] == rate_id), None)
                if matching_rate is None or not carrier_is_allowed(matching_rate["carrier_name"]):
                    raise CheckoutError("La tarifa de envío elegida ya no está disponible. Cotiza de nuevo.")
                shipping_cost = matching_rate["cost"]
            else:
                raise CheckoutError("Paquetería inválida.")

    total = subtotal + shipping_cost

    order = Order(
        user_id=g.user.id,
        shipping_full_name=shipping["full_name"],
        shipping_phone=shipping["phone"],
        shipping_street=shipping["street"],
        shipping_colonia=shipping.get("colonia"),
        shipping_city=shipping["city"],
        shipping_state=shipping["state"],
        shipping_postal_code=shipping.get("postal_code"),
        shipping_country=shipping.get("country") or "México",
        shipping_carrier=carrier_code,
        shipping_cost=shipping_cost,
        payment_method=PaymentMethod(payment_method),
        status=OrderStatus.PENDING_PAYMENT if payment_method in MANUAL_PAYMENT_METHODS else OrderStatus.PAYMENT_IN_VALIDATION,
        subtotal=subtotal,
        total=total,
        items=order_items,
    )
    if payment_method in MANUAL_PAYMENT_METHODS:
        window = current_app.config["SPEI_PAYMENT_WINDOW_HOURS"]
        order.spei_payment_deadline = datetime.now(timezone.utc) + timedelta(hours=window)

    db.session.add(order)
    db.session.flush()  # asigna order.id / order_number antes de crear el PaymentIntent

    client_secret = None
    if payment_method == PaymentMethod.CARD.value:
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(round(total * 100)),
                currency="mxn",
                payment_method_types=["card"],
                metadata={"order_id": str(order.id), "order_number": order.order_number},
            )
        except stripe.StripeError:
            db.session.rollback()
            raise CheckoutError("No se pudo iniciar el pago con tarjeta. Intenta de nuevo.")
        order.stripe_payment_intent_id = intent.id
        client_secret = intent.client_secret

    db.session.commit()
    return order, client_secret


@checkout_bp.post("")
@login_required
def create_order():
    data = request.get_json() or {}
    items_payload = data.get("items") or []
    shipping = data.get("shipping") or {}
    payment_method = data.get("payment_method")

    if payment_method not in (PaymentMethod.CARD.value, *MANUAL_PAYMENT_METHODS):
        return jsonify({"message": "Método de pago inválido."}), 400

    required_shipping_fields = ["full_name", "phone", "street", "city", "state"]
    if _is_domestic(shipping.get("country")):
        required_shipping_fields += ["postal_code", "carrier"]
    missing = [f for f in required_shipping_fields if not shipping.get(f)]
    if missing:
        return jsonify({"message": f"Faltan datos de envío: {', '.join(missing)}"}), 400

    try:
        order, client_secret = _build_order(items_payload, shipping, payment_method)
    except CheckoutError as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 400

    return jsonify({"order": serialize_order(order), "client_secret": client_secret}), 201


@checkout_bp.post("/webhook")
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, current_app.config["STRIPE_WEBHOOK_SECRET"])
    except (ValueError, stripe.SignatureVerificationError):
        return jsonify({"message": "Firma inválida."}), 400

    intent = event["data"]["object"]
    order = Order.query.filter_by(stripe_payment_intent_id=intent.id).first()

    if order and order.status == OrderStatus.PAYMENT_IN_VALIDATION:
        if event["type"] == "payment_intent.succeeded":
            order.status = OrderStatus.PAYMENT_CONFIRMED
            db.session.commit()
        elif event["type"] == "payment_intent.payment_failed":
            adjust_stock(order, sign=1)  # libera inventario reservado
            order.status = OrderStatus.CANCELLED
            db.session.commit()

    return jsonify({"received": True}), 200
