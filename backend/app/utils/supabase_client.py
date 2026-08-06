from flask import current_app
from supabase import create_client, Client

_client: Client | None = None
_admin_client: Client | None = None


def get_supabase() -> Client:
    """Cliente con la llave pública: sign_up/sign_in/get_user (verificación de tokens)."""
    global _client
    if _client is None:
        _client = create_client(
            current_app.config["SUPABASE_URL"],
            current_app.config["SUPABASE_ANON_KEY"],
        )
    return _client


def get_supabase_admin() -> Client:
    """Cliente con service_role: Storage, bypass de RLS, administración de usuarios.
    Requiere SUPABASE_SERVICE_ROLE_KEY configurada."""
    global _admin_client
    if _admin_client is None:
        key = current_app.config["SUPABASE_SERVICE_ROLE_KEY"]
        if not key:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY no está configurada en .env")
        _admin_client = create_client(current_app.config["SUPABASE_URL"], key)
    return _admin_client
