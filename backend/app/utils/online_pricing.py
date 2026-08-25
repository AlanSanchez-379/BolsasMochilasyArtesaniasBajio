# Comisión de Stripe México (tarjetas nacionales) + IVA sobre esa comisión. Ajustar
# aquí si la cuenta real de Stripe tiene una tarifa negociada distinta.
STRIPE_PERCENTAGE_FEE = 0.036
STRIPE_FIXED_FEE_MXN = 3.0
IVA_RATE = 0.16


def apply_online_markup(base_price):
    """Precio final para venta en línea = precio base + comisión de Stripe (3.6% + $3
    MXN por cobro) + IVA (16%) sobre esa comisión -- un "impuesto fantasma" para que la
    comisión de Stripe no se coma el margen del producto. La venta en local
    (/venta-local) siempre usa el precio base tal cual se dio de alta, sin este ajuste."""
    if base_price is None:
        return None
    base = float(base_price)
    commission = base * STRIPE_PERCENTAGE_FEE + STRIPE_FIXED_FEE_MXN
    return round(base + commission * (1 + IVA_RATE), 2)
