import os

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "changeme-dev-secret")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

    # localhost y 127.0.0.1 son orígenes distintos para CORS; se permiten ambos en dev.
    # En prod, FRONTEND_ORIGIN puede traer varios orígenes separados por coma
    # (ej. "https://bolsasdelbajio.com,https://www.bolsasdelbajio.com").
    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173").split(",")
    ] + ["http://127.0.0.1:5173", "http://localhost:5173"]

    # Cookies de sesión: en localhost (http, mismo origen) secure=False y samesite=Lax
    # funcionan. En prod, frontend y backend viven en dominios distintos (Hostinger +
    # Render), así que el navegador solo manda la cookie cross-site si es secure=True
    # y samesite=None — eso requiere HTTPS en el backend.
    COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "Lax")

    # Business rules (Documento de Requerimientos secc. 2 y 5)
    DEFAULT_MIN_STOCK_WARNING = 5
    SPEI_PAYMENT_WINDOW_HOURS = 2
