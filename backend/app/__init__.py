from flask import Flask

from .config import Config
from .extensions import db, migrate, cors
from . import models  # noqa: F401  (registra los modelos en SQLAlchemy metadata)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGINS"]}}, supports_credentials=True)

    from .blueprints.catalog import catalog_bp
    from .blueprints.auth import auth_bp
    from .blueprints.cart import cart_bp
    from .blueprints.checkout import checkout_bp
    from .blueprints.orders import orders_bp
    from .blueprints.admin import admin_bp

    app.register_blueprint(catalog_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(checkout_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(admin_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app
