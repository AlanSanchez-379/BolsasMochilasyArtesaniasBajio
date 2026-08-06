from flask import jsonify

from . import admin_bp

# TODO: CRUD de products/variants/bundles (solo admin_store/admin_tech).
# TODO: gestión de bundle_eligible_products.
# TODO: admin_tech: gestión de usuarios/roles e integraciones.


@admin_bp.get("/health")
def health():
    return jsonify({"status": "ok", "blueprint": "admin"})
