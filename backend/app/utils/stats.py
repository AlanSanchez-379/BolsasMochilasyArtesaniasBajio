from app.extensions import db
from app.models import (
    Order,
    OrderItem,
    OrderChannel,
    Product,
    ProductVariant,
    SUCCESSFUL_ORDER_STATUSES,
    PENDING_ORDER_STATUSES,
)


def _profit_sum(order_query):
    """Utilidad estimada = sum((precio_venta - costo) * cantidad) sobre las líneas de
    las órdenes de order_query. Líneas sin costo capturado (ventas de antes de esta
    función, o productos sin costo registrado) cuentan como costo $0."""
    order_ids = order_query.with_entities(Order.id)
    return (
        db.session.query(
            db.func.coalesce(
                db.func.sum((OrderItem.unit_price - db.func.coalesce(OrderItem.cost_price, 0)) * OrderItem.quantity), 0
            )
        )
        .filter(OrderItem.order_id.in_(order_ids))
        .scalar()
    )


def get_admin_stats_data():
    """Estadísticas del negocio: ganancias/utilidad totales y por canal, alertas de
    stock bajo, pedidos pendientes de validar, y pedidos recientes. Compartido entre
    el panel de admin completo y el dashboard de la liga de venta local (/venta-local)."""
    successful = Order.query.filter(Order.status.in_(SUCCESSFUL_ORDER_STATUSES))
    total_earnings = successful.with_entities(db.func.coalesce(db.func.sum(Order.total), 0)).scalar()
    total_sales = successful.count()
    total_profit = _profit_sum(successful)

    online_q = successful.filter(Order.channel == OrderChannel.ONLINE)
    in_store_q = successful.filter(Order.channel == OrderChannel.IN_STORE)
    online_earnings = online_q.with_entities(db.func.coalesce(db.func.sum(Order.total), 0)).scalar()
    in_store_earnings = in_store_q.with_entities(db.func.coalesce(db.func.sum(Order.total), 0)).scalar()
    online_profit = _profit_sum(online_q)
    in_store_profit = _profit_sum(in_store_q)

    pending_orders = Order.query.filter(Order.status.in_(PENDING_ORDER_STATUSES)).order_by(Order.created_at.asc()).all()

    # Alertas de inventario: variantes en o por debajo de su umbral de stock bajo,
    # las más urgentes (menos stock) primero.
    low_stock_variants = (
        ProductVariant.query.join(Product)
        .filter(ProductVariant.stock <= ProductVariant.low_stock_threshold)
        .order_by(ProductVariant.stock.asc())
        .limit(15)
        .all()
    )

    recent_orders = Order.query.order_by(Order.created_at.desc()).limit(8).all()

    return {
        "total_earnings": float(total_earnings),
        "total_profit": float(total_profit),
        "total_sales": total_sales,
        "pending_orders": len(pending_orders),
        "online": {"earnings": float(online_earnings), "profit": float(online_profit), "sales": online_q.count()},
        "in_store": {
            "earnings": float(in_store_earnings),
            "profit": float(in_store_profit),
            "sales": in_store_q.count(),
        },
        "low_stock": [
            {
                "variant_id": str(v.id),
                "product_name": v.product.name,
                "color": v.color,
                "sku": v.sku,
                "stock": v.stock,
                "low_stock_threshold": v.low_stock_threshold,
            }
            for v in low_stock_variants
        ],
        "pending_validation_orders": [
            {
                "id": str(o.id),
                "order_number": o.order_number,
                "channel": o.channel.value,
                "customer_name": o.shipping_full_name,
                "total": float(o.total),
                "payment_method": o.payment_method.value,
                "status": o.status.value,
                "created_at": o.created_at.isoformat(),
                "spei_payment_deadline": o.spei_payment_deadline.isoformat() if o.spei_payment_deadline else None,
            }
            for o in pending_orders
        ],
        "recent_orders": [
            {
                "id": str(o.id),
                "order_number": o.order_number,
                "channel": o.channel.value,
                "customer_name": o.shipping_full_name or "Venta en mostrador",
                "total": float(o.total),
                "status": o.status.value,
                "created_at": o.created_at.isoformat(),
            }
            for o in recent_orders
        ],
    }
