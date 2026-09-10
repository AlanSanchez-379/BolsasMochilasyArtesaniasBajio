from flask import jsonify, request, g

from app.extensions import db
from app.models import Order, OrderStatus, PaymentMethod, UserRole
from app.utils.decorators import login_required, pos_access_required
from app.utils.serializers import serialize_order
from app.utils.stock import set_order_status
from app.utils.shipping_estimate import get_shipping_settings_dict, get_origin_address
from app.utils.skydropx_client import get_rates, purchase_label, SkydropxError
from app.utils.uploads import ALLOWED_VOUCHER_MIMETYPES, upload_image_file

from . import orders_bp

ORDER_VOUCHERS_FOLDER = "order-vouchers"


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


@orders_bp.post("/<order_id>/voucher")
@login_required
def upload_payment_voucher(order_id):
    """El cliente sube su comprobante de depósito SPEI desde "Mis Pedidos" -- la
    dueña lo revisa y confirma el pago manualmente desde el panel (PATCH .../status)."""
    order = Order.query.get_or_404(order_id)
    if str(order.user_id) != str(g.user.id):
        return jsonify({"message": "No autorizado."}), 403
    if order.payment_method != PaymentMethod.SPEI:
        return jsonify({"message": "Este pedido no se paga por transferencia SPEI."}), 400
    if order.status not in (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_IN_VALIDATION):
        return jsonify({"message": "Este pedido ya no admite comprobante."}), 400

    public_url, error = upload_image_file(
        request.files.get("file"), ORDER_VOUCHERS_FOLDER, ALLOWED_VOUCHER_MIMETYPES
    )
    if error:
        return error

    order.payment_voucher_url = public_url
    order.status = OrderStatus.PAYMENT_IN_VALIDATION
    db.session.commit()
    return jsonify({"order": serialize_order(order)})


@orders_bp.get("/admin/all")
@pos_access_required
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
@pos_access_required
def update_status(order_id):
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    try:
        new_status = OrderStatus(data.get("status"))
    except ValueError:
        valid = [s.value for s in OrderStatus]
        return jsonify({"message": f"Estatus inválido. Válidos: {valid}"}), 400

    set_order_status(order, new_status)
    return jsonify({"order": serialize_order(order)})


@orders_bp.patch("/<order_id>/shipping-cost")
@pos_access_required
def update_shipping_cost(order_id):
    """Para envíos internacionales (shipping_carrier="international_pending"): la
    dueña cotiza el envío real a mano, fuera de la app, y aquí registra el costo --
    recalcula el total del pedido para que quede correcto en el sistema, aunque el
    cobro de ese envío se haga aparte (transferencia/PayPal, no por este flujo)."""
    order = Order.query.get_or_404(order_id)
    data = request.get_json() or {}
    try:
        shipping_cost = float(data.get("shipping_cost"))
    except (TypeError, ValueError):
        return jsonify({"message": "Costo de envío inválido."}), 400
    if shipping_cost < 0:
        return jsonify({"message": "Costo de envío inválido."}), 400

    order.shipping_cost = shipping_cost
    order.total = float(order.subtotal) + shipping_cost
    db.session.commit()
    return jsonify({"order": serialize_order(order)})


@orders_bp.post("/<order_id>/shipment/rates")
@pos_access_required
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
@pos_access_required
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
