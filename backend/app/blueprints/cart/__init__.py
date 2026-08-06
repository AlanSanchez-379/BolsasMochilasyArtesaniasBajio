from flask import Blueprint

cart_bp = Blueprint("cart", __name__, url_prefix="/api/cart")

from . import routes  # noqa: E402,F401
