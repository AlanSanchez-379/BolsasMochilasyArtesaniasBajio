from flask import jsonify, request, g

from app.extensions import db
from app.models import Order, OrderStatus, UserRole
from app.utils.decorators import login_required, role_required
from app.utils.serializers import serialize_order
from app.utils.stock import adjust_stock
from app.utils.shipping_estimate import get_shipping_settings_dict, get_origin_address
from app.utils.skydropx_client import get_rates, purchase_label, SkydropxError

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


@orders_bp.post("/<order_id>/shipment/rates")
@role_required(UserRole.ADMIN_STORE.value, UserRole.ADMIN_TECH.value)
def get_shipment_rates(order_id):
    """Recibe peso/dimensiones REALES ya empacado el pedido, los guarda, y devuelve
    cotizaciones reales de Skydropx para que el admin elija cuál comprar."""
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    for field in ("weight_kg", "length_cm", "width_cm", "height_cm"):
        if not data.get(field):
            return jsonify({"message": f"Falta {field}."}), 400

    order.package_weight_kg = data["weight_kg"]
    order.package_length_cm = data["length_cm"]
    order.package_width_cm = data["width_cm"]
    order.package_height_cm = data["height_cm"]
    db.session.commit()

    destination = {
        "name": order.shipping_full_name,
        "phone": order.shipping_phone,
        "street": order.shipping_street,
        "colonia": order.shipping_colonia,
        "city": order.shipping_city,
        "state": order.shipping_state,
        "postal_code": order.shipping_postal_code,
    }
    settings = get_shipping_settings_dict()
    try:
        origin = get_origin_address(settings)
        rates = get_rates(
            origin,
            destination,
            float(data["weight_kg"]),
            float(data["length_cm"]),
            float(data["width_cm"]),
            float(data["height_cm"]),
        )
    except (ValueError, SkydropxError) as e:
        return jsonify({"message": str(e)}), 502

    return jsonify({"order": serialize_order(order), "rates": rates})


@orders_bp.post("/<order_id>/shipment/purchase")
@role_required(UserRole.ADMIN_STORE.value, UserRole.ADMIN_TECH.value)
def purchase_shipment_label(order_id):
    """Compra la guía real con la tarifa que eligió el admin y la persiste en el pedido."""
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    rate_id = data.get("rate_id")
    if not rate_id:
        return jsonify({"message": "Falta rate_id."}), 400

    try:
        result = purchase_label(rate_id, data.get("quotation_id"))
    except SkydropxError as e:
        return jsonify({"message": str(e)}), 502

    order.skydropx_rate_id = rate_id
    order.skydropx_quotation_id = data.get("quotation_id")
    order.skydropx_shipment_id = result["shipment_id"]
    order.tracking_number = result["tracking_number"]
    order.label_url = result["label_url"]
    order.tracking_url_provider = result.get("tracking_url_provider")
    order.skydropx_real_cost = result["real_cost"]
    order.skydropx_carrier_name = data.get("carrier_name")
    order.skydropx_service_level = data.get("service_level")
    db.session.commit()
    return jsonify({"order": serialize_order(order)})
