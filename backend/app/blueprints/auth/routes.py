from flask import jsonify

from . import auth_bp

# TODO: login/registro/Google OAuth via supabase-py (auth.sign_in_with_password,
# auth.sign_in_with_oauth), guardando el access_token en cookie httpOnly.


@auth_bp.get("/health")
def health():
    return jsonify({"status": "ok", "blueprint": "auth"})
