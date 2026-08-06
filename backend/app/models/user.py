import enum

from sqlalchemy.dialects.postgresql import UUID

from app.extensions import db
from .mixins import TimestampMixin


class UserRole(str, enum.Enum):
    CLIENT = "client"
    ADMIN_STORE = "admin_store"
    ADMIN_TECH = "admin_tech"


class User(db.Model, TimestampMixin):
    """Profile row keyed by the Supabase Auth user id (auth.users.id)."""

    __tablename__ = "users"

    id = db.Column(UUID(as_uuid=True), primary_key=True)  # matches auth.users.id, no server-side default
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    full_name = db.Column(db.String(255))
    role = db.Column(db.Enum(UserRole, name="user_role"), default=UserRole.CLIENT, nullable=False)

    orders = db.relationship("Order", back_populates="user", lazy="dynamic")

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"
