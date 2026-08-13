def serialize_variant(variant):
    return {
        "id": str(variant.id),
        "color": variant.color,
        "sku": variant.sku,
        "stock": variant.stock,
        "low_stock_threshold": variant.low_stock_threshold,
        "image_url": variant.image_path,
    }


def serialize_product(product):
    data = {
        "id": str(product.id),
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "category": product.category.name,
        "category_id": str(product.category_id),
        "subcategory": product.subcategory,
        "price_normal": float(product.price_normal),
        "price_wholesale": float(product.price_wholesale),
        "price_super_wholesale": float(product.price_super_wholesale),
        "wholesale_min_qty": product.wholesale_min_qty,
        "super_wholesale_min_qty": product.super_wholesale_min_qty,
        "is_bundle": product.is_bundle,
        "bundle_limit": product.bundle_limit,
        "bundle_category_limits": product.bundle_category_limits,
        "created_at": product.created_at.isoformat(),
        "variants": [serialize_variant(v) for v in product.variants],
    }
    return data


def serialize_order_item(item):
    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "product_name": item.product.name if item.product else None,
        "variant_id": str(item.variant_id),
        "variant_color": item.variant.color if item.variant else None,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price),
        "bundle_parent_item_id": str(item.bundle_parent_item_id) if item.bundle_parent_item_id else None,
    }


def serialize_order(order):
    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "channel": order.channel.value,
        "status": order.status.value,
        "payment_method": order.payment_method.value,
        "spei_payment_deadline": order.spei_payment_deadline.isoformat() if order.spei_payment_deadline else None,
        "shipping": {
            "full_name": order.shipping_full_name,
            "phone": order.shipping_phone,
            "street": order.shipping_street,
            "city": order.shipping_city,
            "state": order.shipping_state,
            "postal_code": order.shipping_postal_code,
            "carrier": order.shipping_carrier.value if order.shipping_carrier else None,
            "cost": float(order.shipping_cost),
        },
        "subtotal": float(order.subtotal),
        "total": float(order.total),
        "created_at": order.created_at.isoformat(),
        "items": [serialize_order_item(i) for i in order.items],
    }
