from app.extensions import db
from app.models import Order, OrderItem, OrderChannel, OrderStatus, PaymentMethod, ProductVariant
from sqlalchemy.exc import IntegrityError


class PosSaleError(Exception):
    pass


def execute_pos_sale(items_payload, payment_method, customer_name):
    """Punto de Venta: venta de mostrador en tienda física. Sin envío, sin cuenta de
    cliente; el stock se descuenta al instante y el pedido nace como 'Entregado'.
    Compartido entre el POS del admin completo y la liga con PIN de venta local."""
    customer_name = (customer_name or "").strip() or None

    if payment_method not in (PaymentMethod.CARD.value, PaymentMethod.CASH.value):
        raise PosSaleError("Método de pago inválido. Usa 'cash' o 'card'.")
    if not items_payload:
        raise PosSaleError("Agrega al menos un producto a la venta.")

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

    order = Order(
        user_id=None,
        channel=OrderChannel.IN_STORE,
        shipping_full_name=customer_name,
        payment_method=PaymentMethod(payment_method),
        status=OrderStatus.DELIVERED,
        subtotal=subtotal,
        total=subtotal,
        items=order_items,
    )
    db.session.add(order)
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        raise PosSaleError(f"Error al registrar la venta: {e.orig}")

    return order
