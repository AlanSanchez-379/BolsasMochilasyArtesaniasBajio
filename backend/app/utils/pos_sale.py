from datetime import datetime, timedelta, timezone

from flask import current_app
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Order, OrderItem, OrderChannel, OrderStatus, PaymentMethod, ProductVariant


class PosSaleError(Exception):
    pass


def execute_pos_sale(items_payload, payment_method, customer_name, shipping=None, shipping_cost=None):
    """Punto de Venta: venta de mostrador en tienda física. El stock se descuenta al
    instante. Compartido entre el POS del admin completo y la liga con PIN de venta
    local (/venta-local).

    shipping/shipping_cost son opcionales: si se da shipping_cost, el pedido necesita
    enviarse (costo y dirección tecleados a mano por el cajero, sin cotizar con
    Skydropx) en vez de entregarse ahí mismo en el mostrador.
    """
    customer_name = (customer_name or "").strip() or None
    shipping = shipping or {}
    needs_shipping = shipping_cost is not None

    if payment_method not in (PaymentMethod.CARD.value, PaymentMethod.CASH.value, PaymentMethod.SPEI.value):
        raise PosSaleError("Método de pago inválido.")
    if not items_payload:
        raise PosSaleError("Agrega al menos un producto a la venta.")
    if needs_shipping:
        try:
            shipping_cost = float(shipping_cost)
        except (TypeError, ValueError):
            raise PosSaleError("Costo de envío inválido.")
        if shipping_cost < 0:
            raise PosSaleError("Costo de envío inválido.")
        if not shipping.get("street"):
            raise PosSaleError("Captura al menos la calle del envío.")
    else:
        shipping_cost = 0.0

    variant_ids = [item.get("variant_id") for item in items_payload if item.get("variant_id")]
    variants = {
        str(v.id): v
        for v in ProductVariant.query.filter(ProductVariant.id.in_(variant_ids)).with_for_update().all()
    }

    # Mayoreo combinado: igual que en la web, el precio por volumen se decide sumando
    # las piezas de productos normales en esta venta. Los paquetes tienen precio fijo
    # (igual que "Surtido al azar" en la web) y no participan en esa suma.
    combined_qty = sum(
        int(item.get("quantity") or 0)
        for item in items_payload
        if (v := variants.get(item.get("variant_id"))) and not v.product.is_bundle
    )

    order_items = []
    subtotal = 0.0
    for item in items_payload:
        variant = variants.get(item.get("variant_id"))
        quantity = int(item.get("quantity") or 0)
        if variant is None:
            raise PosSaleError("Uno de los productos seleccionados ya no existe.")
        if quantity < 1:
            raise PosSaleError(f"Cantidad inválida para {variant.product.name}.")
        if variant.stock < quantity:
            raise PosSaleError(
                f"Stock insuficiente para {variant.product.name} ({variant.color}). "
                f"Disponible: {variant.stock}."
            )

        if variant.product.is_bundle:
            unit_price = float(variant.product.price_for_quantity(1))
        else:
            unit_price = float(variant.product.price_for_quantity(combined_qty))
        cost_price = float(variant.product.cost_price) if variant.product.cost_price is not None else None
        variant.stock -= quantity
        order_items.append(
            OrderItem(
                product_id=variant.product_id,
                variant_id=variant.id,
                quantity=quantity,
                unit_price=unit_price,
                cost_price=cost_price,
            )
        )
        subtotal += unit_price * quantity

    total = subtotal + shipping_cost

    # Transferencia (SPEI) queda pendiente hasta confirmar el depósito, igual que en la
    # web. Pagos ya recibidos (efectivo/tarjeta): se cierran de inmediato si el cliente
    # se lleva el producto ahí mismo, o quedan "Pago confirmado" (listo para preparar/
    # enviar) si el pedido todavía necesita envío.
    if payment_method == PaymentMethod.SPEI.value:
        status = OrderStatus.PENDING_PAYMENT
    elif needs_shipping:
        status = OrderStatus.PAYMENT_CONFIRMED
    else:
        status = OrderStatus.DELIVERED

    order = Order(
        user_id=None,
        channel=OrderChannel.IN_STORE,
        shipping_full_name=shipping.get("full_name") or customer_name,
        shipping_phone=shipping.get("phone"),
        shipping_street=shipping.get("street"),
        shipping_colonia=shipping.get("colonia"),
        shipping_city=shipping.get("city"),
        shipping_state=shipping.get("state"),
        shipping_postal_code=shipping.get("postal_code"),
        shipping_carrier=(shipping.get("carrier") or "Envío") if needs_shipping else None,
        shipping_cost=shipping_cost,
        payment_method=PaymentMethod(payment_method),
        status=status,
        subtotal=subtotal,
        total=total,
        items=order_items,
    )
    if payment_method == PaymentMethod.SPEI.value:
        window = current_app.config["SPEI_PAYMENT_WINDOW_HOURS"]
        order.spei_payment_deadline = datetime.now(timezone.utc) + timedelta(hours=window)

    db.session.add(order)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        raise PosSaleError(f"Error al registrar la venta: {e.orig}")

    return order
