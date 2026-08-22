from functools import wraps

from flask import request, jsonify, g, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.models import User
from .supabase_client import get_supabase


def _load_user_from_request():
    token = request.cookies.get("sb_access_token")
    if not token:
        return None
    try:
        auth_response = get_supabase().auth.get_user(token)
    except Exception:
        return None
    supa_user = auth_response.user if auth_response else None
    if not supa_user:
        return None
    return User.query.get(supa_user.id)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _load_user_from_request()
        if user is None:
            return jsonify({"message": "No autenticado."}), 401
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _load_user_from_request()
            if user is None:
                return jsonify({"message": "No autenticado."}), 401
            if user.role.value not in roles:
                return jsonify({"message": "No autorizado."}), 403
            g.user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator


# --- Liga de venta local con PIN compartido (sin cuenta de Supabase) ---
# Sesión sin tabla nueva: un token firmado (no cifrado, pero sí a prueba de
# manipulación) con el SECRET_KEY de la app. No lleva nada sensible adentro, solo
# indica "este navegador ya pasó el PIN".
POS_ACCESS_COOKIE_NAME = "pos_access_token"
POS_ACCESS_MAX_AGE = 60 * 60 * 12  # 12h, un turno de tienda


def _pos_access_serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="pos-access")


def issue_pos_access_token():
    return _pos_access_serializer().dumps({"ok": True})


def verify_pos_access_token(token):
    if not token:
        return False
    try:
        data = _pos_access_serializer().loads(token, max_age=POS_ACCESS_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return False
    return bool(data.get("ok"))


def pos_access_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = request.cookies.get(POS_ACCESS_COOKIE_NAME)
        if not verify_pos_access_token(token):
            return jsonify({"message": "Ingresa el PIN de la tienda."}), 401
        return fn(*args, **kwargs)

    return wrapper
