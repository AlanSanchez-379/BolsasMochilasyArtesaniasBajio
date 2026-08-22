from flask import Blueprint

pos_access_bp = Blueprint("pos_access", __name__, url_prefix="/api/pos-access")

from . import routes  # noqa: E402,F401
