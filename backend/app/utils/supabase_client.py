from flask import current_app
from supabase import create_client, Client

_client: Client | None = None


def get_supabase() -> Client:
    """Service-role client for server-side calls (Auth admin, Storage)."""
    global _client
    if _client is None:
        _client = create_client(
            current_app.config["SUPABASE_URL"],
            current_app.config["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _client
