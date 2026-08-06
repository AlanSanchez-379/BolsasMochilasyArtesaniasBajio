from flask import jsonify

from . import orders_bp

# TODO: GET / - historial del cliente autenticado.
# TODO: GET /<id> - detalle de pedido.
# TODO: PATCH /<id>/status - admin_store/admin_tech actualiza estado trazable (secc. 6).


@orders_bp.get("/health")
def health():
    return jsonify({"status": "ok", "blueprint": "orders"})
