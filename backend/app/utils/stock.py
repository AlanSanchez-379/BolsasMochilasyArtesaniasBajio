from app.models import ProductVariant


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
