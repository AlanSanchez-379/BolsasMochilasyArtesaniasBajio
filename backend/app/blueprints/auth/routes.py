from flask import jsonify, request, make_response, current_app

from app.extensions import db
from app.models import User, UserRole
from app.utils.supabase_client import get_supabase
from app.utils.decorators import login_required

from . import auth_bp

COOKIE_NAME = "sb_access_token"


def _serialize_user(user: User):
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name, "role": user.role.value}


def _set_session_cookie(response, access_token, expires_in):
    response.set_cookie(
        COOKIE_NAME,
        access_token,
        httponly=True,
        samesite=current_app.config["COOKIE_SAMESITE"],
        secure=current_app.config["COOKIE_SECURE"],
        max_age=expires_in,
    )


def _upsert_profile(supa_user, full_name=None):
    user = User.query.get(supa_user.id)
    if user is None:
        user = User(id=supa_user.id, email=supa_user.email, full_name=full_name, role=UserRole.CLIENT)
        db.session.add(user)
        db.session.commit()
    return user


@auth_bp.post("/register")
def register():
    data = request.get_json() or {}
    email, password, full_name = data.get("email"), data.get("password"), data.get("full_name")
    if not email or not password:
        return jsonify({"message": "Correo y contraseña son requeridos."}), 400

    try:
        result = get_supabase().auth.sign_up({"email": email, "password": password})
    except Exception as e:
        return jsonify({"message": str(e)}), 400

    if not result.session:
        # Confirmación de correo activada en Supabase: no hay sesión inmediata.
        return jsonify({"message": "Cuenta creada. Revisa tu correo para confirmar antes de iniciar sesión."}), 201

    user = _upsert_profile(result.user, full_name)
    response = make_response(jsonify({"user": _serialize_user(user)}))
    _set_session_cookie(response, result.session.access_token, result.session.expires_in)
    return response


@auth_bp.post("/login")
def login():
    data = request.get_json() or {}
    email, password = data.get("email"), data.get("password")
    if not email or not password:
        return jsonify({"message": "Correo y contraseña son requeridos."}), 400

    try:
        result = get_supabase().auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        return jsonify({"message": "Correo o contraseña incorrectos."}), 401

    user = _upsert_profile(result.user)
    response = make_response(jsonify({"user": _serialize_user(user)}))
    _set_session_cookie(response, result.session.access_token, result.session.expires_in)
    return response


@auth_bp.post("/oauth-callback")
def oauth_callback():
    """El login con Google se hace en el navegador (supabase-js); aquí solo
    validamos el access_token resultante y lo guardamos como cookie httpOnly."""
    data = request.get_json() or {}
    access_token = data.get("access_token")
    if not access_token:
        return jsonify({"message": "access_token es requerido."}), 400

    try:
        auth_response = get_supabase().auth.get_user(access_token)
    except Exception:
        return jsonify({"message": "Token inválido."}), 401

    if not auth_response or not auth_response.user:
        return jsonify({"message": "Token inválido."}), 401

    supa_user = auth_response.user
    full_name = (supa_user.user_metadata or {}).get("full_name") or (supa_user.user_metadata or {}).get("name")
    user = _upsert_profile(supa_user, full_name)

    response = make_response(jsonify({"user": _serialize_user(user)}))
    _set_session_cookie(response, access_token, 3600)
    return response


@auth_bp.post("/logout")
def logout():
    response = make_response(jsonify({"message": "Sesión cerrada."}))
    response.delete_cookie(
        COOKIE_NAME,
        samesite=current_app.config["COOKIE_SAMESITE"],
        secure=current_app.config["COOKIE_SECURE"],
    )
    return response


@auth_bp.get("/me")
@login_required
def me():
    from flask import g

    return jsonify({"user": _serialize_user(g.user)})
