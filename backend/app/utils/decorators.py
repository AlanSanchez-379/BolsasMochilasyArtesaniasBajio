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


def issue_pos_access_token(role="admin"):
    return _pos_access_serializer().dumps({"ok": True, "role": role})


def verify_pos_access_token(token):
    if not token:
        return None
    try:
        data = _pos_access_serializer().loads(token, max_age=POS_ACCESS_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    
    if data.get("ok"):
        return data.get("role", "admin")
    return None


def _pos_token_from_request():
    token = request.cookies.get(POS_ACCESS_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    return token


def pos_access_required(fn):
    """Cualquiera de los dos PINs (admin o empleado) -- para lo que un cajero
    legítimamente necesita: vender, ver el catálogo, consultar su propia sesión."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        role = verify_pos_access_token(_pos_token_from_request())
        if not role:
            return jsonify({"message": "Ingresa el PIN de la tienda."}), 401

        g.pos_role = role
        return fn(*args, **kwargs)

    return wrapper


def pos_admin_required(fn):
    """Solo el PIN de administrador -- ajustes, catálogo (alta/edición/borrado),
    pedidos, envíos. El PIN de empleado nunca debe llegar a estos endpoints, aunque
    los mande directo a la API sin pasar por la interfaz."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        role = verify_pos_access_token(_pos_token_from_request())
        if not role:
            return jsonify({"message": "Ingresa el PIN de la tienda."}), 401
        if role != "admin":
            return jsonify({"message": "Esta acción requiere el PIN de administrador."}), 403

        g.pos_role = role
        return fn(*args, **kwargs)

    return wrapper
