from flask import jsonify

from . import cart_bp

# TODO: POST /validate - revalida stock real y recalcula precio por volumen
# (agrupado por producto, ignorando variante) antes de pasar a checkout.


@cart_bp.get("/health")
def health():
    return jsonify({"status": "ok", "blueprint": "cart"})
