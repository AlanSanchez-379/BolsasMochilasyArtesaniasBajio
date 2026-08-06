from flask import jsonify

from . import checkout_bp

# TODO: POST /quote - cotización dinámica DHL/Estafeta/Tres Guerras por CP.
# TODO: POST / - crea la orden, descuenta stock, aplica regla SPEI (2h / Pendiente de pago)
#       o Tarjeta (Pago en validación).


@checkout_bp.get("/health")
def health():
    return jsonify({"status": "ok", "blueprint": "checkout"})
