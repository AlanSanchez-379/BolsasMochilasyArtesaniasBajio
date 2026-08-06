from functools import wraps

from flask import request, jsonify, g

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
