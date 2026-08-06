from flask import Blueprint

catalog_bp = Blueprint("catalog", __name__, url_prefix="/api")

from . import routes  # noqa: E402,F401
