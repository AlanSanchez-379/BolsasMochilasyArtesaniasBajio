from flask import jsonify, request, g

from app.extensions import db
from app.models import Order, OrderStatus, UserRole
from app.utils.decorators import login_required, role_required
from app.utils.serializers import serialize_order
from app.utils.stock import adjust_stock

from . import orders_bp


@orders_bp.get("")
@login_required
def my_orders():
    orders = Order.query.filter_by(user_id=g.user.id).order_by(Order.created_at.desc()).all()
    return jsonify({"orders": [serialize_order(o) for o in orders]})


def _can_view(order):
    return str(order.user_id) == str(g.user.id) or g.user.role != UserRole.CLIENT


@orders_bp.get("/<order_id>")
@login_required
def get_order(order_id):
    order = Order.query.get_or_404(order_id)
    if not _can_view(order):
        return jsonify({"message": "No autorizado."}), 403
    return jsonify({"order": serialize_order(order)})


@orders_bp.get("/admin/all")
@role_required(UserRole.ADMIN_STORE.value, UserRole.ADMIN_TECH.value)
def list_all_orders():
    status = request.args.get("status")
    query = Order.query
    if status:
        try:
            query = query.filter(Order.status == OrderStatus(status))
        except ValueError:
            return jsonify({"message": "Estatus inválido."}), 400
    orders = query.order_by(Order.created_at.desc()).all()
    return jsonify({"orders": [serialize_order(o) for o in orders]})


@orders_bp.patch("/<order_id>/status")
@role_required(UserRole.ADMIN_STORE.value, UserRole.ADMIN_TECH.value)
def update_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    try:
        new_status = OrderStatus(data.get("status"))
    except ValueError:
        valid = [s.value for s in OrderStatus]
        return jsonify({"message": f"Estatus inválido. Válidos: {valid}"}), 400

    was_cancelled = order.status == OrderStatus.CANCELLED
    will_be_cancelled = new_status == OrderStatus.CANCELLED

    if will_be_cancelled and not was_cancelled:
        adjust_stock(order, sign=1)  # libera inventario reservado
    elif was_cancelled and not will_be_cancelled:
        adjust_stock(order, sign=-1)  # se reactiva el pedido, se vuelve a comprometer el stock

    order.status = new_status
    db.session.commit()
    return jsonify({"order": serialize_order(order)})
