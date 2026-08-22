import time

from flask import jsonify, request, make_response, current_app
from werkzeug.security import check_password_hash

from app.models import Setting, Product
from app.utils.decorators import (
    pos_access_required,
    issue_pos_access_token,
    POS_ACCESS_COOKIE_NAME,
    POS_ACCESS_MAX_AGE,
)
from app.utils.serializers import serialize_product, serialize_order
from app.utils.pos_sale import execute_pos_sale, PosSaleError

from . import pos_access_bp

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 60

# Contador de intentos fallidos en memoria del proceso, por IP: {ip: (fallos, hasta_cuando_bloqueado)}.
# Suficiente para un solo terminal de tienda; se resetea si el proceso reinicia.
_failed_attempts = {}


def _client_ip():
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


@pos_access_bp.post("/login")
def login():
    ip = _client_ip()
    fails, locked_until = _failed_attempts.get(ip, (0, 0))
    if locked_until and time.time() < locked_until:
        wait = int(locked_until - time.time())
        return jsonify({"message": f"Demasiados intentos. Espera {wait} segundos."}), 429

    setting = Setting.query.get("pos_access_pin_hash")
    if not setting or not setting.value:
        return jsonify({"message": "PIN no configurado. Pídele al administrador que lo configure en Ajustes."}), 400

    password = (request.get_json() or {}).get("password") or ""
    if not check_password_hash(setting.value, password):
        fails += 1
        locked_until = time.time() + LOCKOUT_SECONDS if fails >= MAX_FAILED_ATTEMPTS else 0
        _failed_attempts[ip] = (fails, locked_until)
        return jsonify({"message": "PIN incorrecto."}), 401

    _failed_attempts.pop(ip, None)
    response = make_response(jsonify({"ok": True}))
    response.set_cookie(
        POS_ACCESS_COOKIE_NAME,
        issue_pos_access_token(),
        httponly=True,
        samesite=current_app.config["COOKIE_SAMESITE"],
        secure=current_app.config["COOKIE_SECURE"],
        max_age=POS_ACCESS_MAX_AGE,
    )
    return response


@pos_access_bp.post("/logout")
def logout():
    response = make_response(jsonify({"message": "Sesión cerrada."}))
    response.delete_cookie(
        POS_ACCESS_COOKIE_NAME,
        samesite=current_app.config["COOKIE_SAMESITE"],
        secure=current_app.config["COOKIE_SECURE"],
    )
    return response


@pos_access_bp.get("/me")
@pos_access_required
def me():
    return jsonify({"ok": True})


@pos_access_bp.get("/products")
@pos_access_required
def list_products():
    products = Product.query.order_by(Product.name).all()
    return jsonify({"products": [serialize_product(p) for p in products]})


@pos_access_bp.post("/sale")
@pos_access_required
def sale():
    data = request.get_json() or {}
    try:
        order = execute_pos_sale(data.get("items") or [], data.get("payment_method"), data.get("customer_name"))
    except PosSaleError as e:
        return jsonify({"message": str(e)}), 400
    return jsonify({"order": serialize_order(order)}), 201
