from flask import Blueprint

checkout_bp = Blueprint("checkout", __name__, url_prefix="/api/checkout")

from . import routes  # noqa: E402,F401
