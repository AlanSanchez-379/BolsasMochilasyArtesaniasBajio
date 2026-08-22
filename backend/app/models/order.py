import enum
import random
import string

from sqlalchemy.dialects.postgresql import UUID

from app.extensions import db
from .mixins import UUIDPrimaryKeyMixin, TimestampMixin


class OrderStatus(str, enum.Enum):
    PENDING_PAYMENT = "Pendiente de pago"
    PAYMENT_IN_VALIDATION = "Pago en validación"
    PAYMENT_CONFIRMED = "Pago confirmado"
    PREPARING = "Preparando pedido"
    SHIPPED = "Enviado"
    DELIVERED = "Entregado"
    CANCELLED = "Cancelado / Reembolsado"


# Pedidos que ya representan ingreso real (excluye pendientes/en validación/cancelados).
SUCCESSFUL_ORDER_STATUSES = (
    OrderStatus.PAYMENT_CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
)

# Pedidos que todavía requieren acción/seguimiento de pago.
PENDING_ORDER_STATUSES = (OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_IN_VALIDATION)


class PaymentMethod(str, enum.Enum):
    CARD = "card"
    SPEI = "spei"
    CASH = "cash"  # Solo Punto de Venta (tienda física)


class OrderChannel(str, enum.Enum):
    ONLINE = "online"
    IN_STORE = "in_store"  # Punto de Venta (caja registradora)


# Código interno fijo para la opción de envío manual/fuera de Skydropx (Tres Guerras).
# shipping_carrier ya no es un enum de Postgres: Skydropx cotiza combinaciones
# dinámicas de paquetería/nivel de servicio, así que se guarda como texto libre
# ("3guerras" para el manual, o "skydropx:<rate_id>" para lo cotizado por Skydropx).
TRES_GUERRAS_CARRIER_CODE = "3guerras"


def _generate_order_number():
    return "ORD-" + "".join(random.choices(string.digits, k=6))


class Order(db.Model, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "orders"

    order_number = db.Column(db.String(20), unique=True, nullable=False, default=_generate_order_number)
    # Nulo en ventas de Punto de Venta: no hay cuenta de cliente asociada (venta de mostrador).
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    channel = db.Column(db.Enum(OrderChannel, name="order_channel"), nullable=False, default=OrderChannel.ONLINE)

    # Información de envío (Documento de Requerimientos secc. 5). Nula en ventas de
    # Punto de Venta (venta física, sin envío); shipping_full_name puede usarse ahí
    # como nombre opcional del cliente de mostrador.
    shipping_full_name = db.Column(db.String(255), nullable=True)
    shipping_phone = db.Column(db.String(20), nullable=True)
    shipping_street = db.Column(db.String(255), nullable=True)
    # Colonia: la exige Skydropx (area_level3) para cotizar/generar guías reales.
    shipping_colonia = db.Column(db.String(100), nullable=True)
    shipping_city = db.Column(db.String(100), nullable=True)
    shipping_state = db.Column(db.String(100), nullable=True)
    shipping_postal_code = db.Column(db.String(10), nullable=True)
    shipping_carrier = db.Column(db.String(50))
    shipping_cost = db.Column(db.Numeric(10, 2), default=0)

    payment_method = db.Column(db.Enum(PaymentMethod, name="payment_method"), nullable=False)
    # Regla de negocio SPEI: ventana de 2h para depositar antes de liberar inventario
    spei_payment_deadline = db.Column(db.DateTime(timezone=True), nullable=True)

    # Stripe: ID del PaymentIntent creado al momento del checkout (payment_method=card).
    # Se usa para relacionar los eventos del webhook con el pedido.
    stripe_payment_intent_id = db.Column(db.String(255), unique=True, nullable=True)

    # Skydropx: peso/dimensiones REALES capturados por el admin al empacar (kg, cm),
    # y el resultado de comprar la guía. shipping_cost/shipping_carrier arriba siguen
    # siendo el ESTIMADO que vio y pagó el cliente en el checkout.
    package_weight_kg = db.Column(db.Numeric(6, 2), nullable=True)
    package_length_cm = db.Column(db.Numeric(6, 2), nullable=True)
    package_width_cm = db.Column(db.Numeric(6, 2), nullable=True)
    package_height_cm = db.Column(db.Numeric(6, 2), nullable=True)

    skydropx_real_cost = db.Column(db.Numeric(10, 2), nullable=True)
    skydropx_carrier_name = db.Column(db.String(100), nullable=True)
    skydropx_service_level = db.Column(db.String(100), nullable=True)
    skydropx_quotation_id = db.Column(db.String(100), nullable=True)
    skydropx_rate_id = db.Column(db.String(100), nullable=True)
    skydropx_shipment_id = db.Column(db.String(100), nullable=True)

    tracking_number = db.Column(db.String(100), nullable=True)
    label_url = db.Column(db.String(500), nullable=True)
    tracking_url_provider = db.Column(db.String(500), nullable=True)

    status = db.Column(db.Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.PENDING_PAYMENT)

    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    total = db.Column(db.Numeric(10, 2), nullable=False)

    user = db.relationship("User", back_populates="orders")
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self):
        return f"<Order {self.order_number} {self.status.value}>"


class OrderItem(db.Model, UUIDPrimaryKeyMixin):
    __tablename__ = "order_items"

    order_id = db.Column(UUID(as_uuid=True), db.ForeignKey("orders.id"), nullable=False)
    product_id = db.Column(UUID(as_uuid=True), db.ForeignKey("products.id"), nullable=False)
    variant_id = db.Column(UUID(as_uuid=True), db.ForeignKey("product_variants.id"), nullable=False)

    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)  # precio congelado al momento de la compra

    # Paquete Emprendedor "Elegir mis diseños": las piezas elegidas se guardan como
    # OrderItem hijos, agrupados bajo la línea del paquete (bundle_parent_item_id).
    bundle_parent_item_id = db.Column(UUID(as_uuid=True), db.ForeignKey("order_items.id"), nullable=True)

    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product")
    variant = db.relationship("ProductVariant")
    bundle_children = db.relationship("OrderItem", backref=db.backref("bundle_parent", remote_side="OrderItem.id"))

    def __repr__(self):
        return f"<OrderItem {self.quantity}x {self.product_id}>"
