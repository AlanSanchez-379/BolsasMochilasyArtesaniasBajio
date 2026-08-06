from app.extensions import db


class Setting(db.Model):
    """Key-value store para configuración editable del sitio (logo, banner, etc.)."""

    __tablename__ = "settings"

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text)

    def __repr__(self):
        return f"<Setting {self.key}={self.value!r}>"
