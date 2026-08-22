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
)
from app.utils.decorators import login_required
from app.utils.serializers import serialize_order
from app.utils.stock import adjust_stock
from app.utils.shipping_estimate import get_shipping_settings_dict, estimate_package_weight_kg, get_origin_address
from app.utils.skydropx_client import get_rates, SkydropxError

from . import checkout_bp


class CheckoutError(Exception):
    pass


def _valid_postal_code(postal_code):
    return bool(postal_code) and postal_code.isdigit() and len(postal_code) == 5


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


def _tres_guerras_option(settings=None):
    settings = settings or get_shipping_settings_dict()
    return {
        "carrier": TRES_GUERRAS_CARRIER_CODE,
        "label": "Tres Guerras",
        "cost": settings["tres_guerras_fixed_cost"],
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


def _skydropx_options(items_payload, shipping, settings):
    """Cotiza con Skydropx usando un peso estimado del carrito. Si falta la dirección
    de origen/destino o la llamada falla, degrada devolviendo lista vacía en vez de
    tronar la cotización completa (Tres Guerras sigue disponible como respaldo)."""
    try:
        origin = get_origin_address(settings)
    except ValueError:
        return [], True

    destination = _destination_address(shipping)
    if not all(destination.get(f) for f in ("street", "colonia", "city", "state", "postal_code")):
        return [], True

    weight_kg = _estimate_cart_weight_kg(items_payload)
    try:
        rates = get_rates(origin, destination, weight_kg)
    except SkydropxError:
        return [], True

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
    postal_code = (data.get("postal_code") or "").strip()
    items_payload = data.get("items") or []
    if not _valid_postal_code(postal_code):
        return jsonify({"message": "Código postal inválido. Debe tener 5 dígitos."}), 400

    settings = get_shipping_settings_dict()
    skydropx_options, skydropx_unavailable = _skydropx_options(items_payload, data, settings)
    options = skydropx_options + [_tres_guerras_option(settings)]
    return jsonify({"options": options, "skydropx_unavailable": skydropx_unavailable})


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
        elif item_type in ("bundle_random", "bundle_custom"):
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
    # piezas de productos normales en el carrito, sin importar si son del mismo producto.
    # Los paquetes tienen precio fijo y no participan en esta suma.
    combined_qty = sum(
        int(item.get("quantity") or 0) for item in items_payload if item.get("type") == "simple"
    )

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
            unit_price = float(product.price_for_quantity(combined_qty))
            variant.stock -= quantity
            order_items.append(
                OrderItem(product_id=product.id, variant_id=variant.id, quantity=quantity, unit_price=unit_price)
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
            unit_price = float(product.price_for_quantity(1))
            bundle_variant.stock -= quantity
            order_items.append(
                OrderItem(
                    product_id=product.id, variant_id=bundle_variant.id, quantity=quantity, unit_price=unit_price
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
                # Un producto solo entra en el paquete si coincide con su "categoría de
                # paquete" (yute/animado 3D) o si el paquete es "Mixto" (cualquiera).
                if variant.product.is_bundle:
                    raise CheckoutError(f"Un paquete no puede contener otro paquete ({product.name}).")
                if product.subcategory != "Mixto" and variant.product.subcategory != product.subcategory:
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

            unit_price = float(product.price_for_quantity(1))
            bundle_variant.stock -= 1
            parent_item = OrderItem(product_id=product.id, variant_id=bundle_variant.id, quantity=1, unit_price=unit_price)
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
                        bundle_parent=parent_item,
                    )
                )

    if not order_items:
        raise CheckoutError("El carrito está vacío.")

    carrier_code = shipping.get("carrier") or ""
    if not _valid_postal_code(shipping.get("postal_code", "")):
        raise CheckoutError("Código postal inválido.")

    settings = get_shipping_settings_dict()
    if carrier_code == TRES_GUERRAS_CARRIER_CODE:
        shipping_cost = settings["tres_guerras_fixed_cost"]
    elif carrier_code.startswith("skydropx:"):
        # Nunca confiar en un precio mandado por el cliente: se vuelve a cotizar en el
        # servidor con el mismo rate_id antes de cobrar/crear la orden.
        rate_id = carrier_code.split(":", 1)[1]
        try:
            origin = get_origin_address(settings)
            rates = get_rates(origin, _destination_address(shipping), _estimate_cart_weight_kg(items_payload))
        except (ValueError, SkydropxError):
            raise CheckoutError("No se pudo confirmar el costo de envío. Cotiza de nuevo.")
        matching_rate = next((r for r in rates if r["rate_id"] == rate_id), None)
        if matching_rate is None:
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
        shipping_postal_code=shipping["postal_code"],
        shipping_carrier=carrier_code,
        shipping_cost=shipping_cost,
        payment_method=PaymentMethod(payment_method),
        status=OrderStatus.PENDING_PAYMENT if payment_method == PaymentMethod.SPEI.value else OrderStatus.PAYMENT_IN_VALIDATION,
        subtotal=subtotal,
        total=total,
        items=order_items,
    )
    if payment_method == PaymentMethod.SPEI.value:
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

    if payment_method not in (PaymentMethod.CARD.value, PaymentMethod.SPEI.value):
        return jsonify({"message": "Método de pago inválido."}), 400

    required_shipping_fields = ["full_name", "phone", "street", "city", "state", "postal_code", "carrier"]
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
