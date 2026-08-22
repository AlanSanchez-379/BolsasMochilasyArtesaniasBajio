from app.extensions import db
from app.models import ProductVariant, OrderStatus


def adjust_stock(order, sign):
    """sign=+1 repone inventario (cancelación/pago fallido), sign=-1 lo vuelve a
    descontar (reactivación de un pedido cancelado)."""
    variant_ids = [item.variant_id for item in order.items]
    variants = {
        v.id: v for v in ProductVariant.query.filter(ProductVariant.id.in_(variant_ids)).with_for_update().all()
    }
    for item in order.items:
        variant = variants.get(item.variant_id)
        if variant is not None:
            variant.stock = max(0, variant.stock + sign * item.quantity)


def set_order_status(order, new_status):
    """Cambia el estatus de un pedido, liberando/recomprometiendo inventario si entra o
    sale de 'Cancelado'. Compartido entre el cambio de estatus del admin completo y el
    de la liga de venta local (limitado ahí a sus propios pedidos de mostrador)."""
    was_cancelled = order.status == OrderStatus.CANCELLED
    will_be_cancelled = new_status == OrderStatus.CANCELLED

    if will_be_cancelled and not was_cancelled:
        adjust_stock(order, sign=1)  # libera inventario reservado
    elif was_cancelled and not will_be_cancelled:
        adjust_stock(order, sign=-1)  # se reactiva el pedido, se vuelve a comprometer el stock

    order.status = new_status
    db.session.commit()
