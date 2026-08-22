def serialize_variant(variant):
    image_urls = variant.image_paths or []
    return {
        "id": str(variant.id),
        "color": variant.color,
        "sku": variant.sku,
        "stock": variant.stock,
        "low_stock_threshold": variant.low_stock_threshold,
        "image_url": image_urls[0] if image_urls else None,
        "image_urls": image_urls,
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
        "cost_price": float(product.cost_price) if product.cost_price is not None else None,
        "is_on_sale": product.is_on_sale,
        "sale_price": float(product.sale_price) if product.sale_price is not None else None,
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
        "cost_price": float(item.cost_price) if item.cost_price is not None else None,
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
            "colonia": order.shipping_colonia,
            "city": order.shipping_city,
            "state": order.shipping_state,
            "postal_code": order.shipping_postal_code,
            "carrier": order.shipping_carrier,
            "cost": float(order.shipping_cost),
            "real_weight_kg": float(order.package_weight_kg) if order.package_weight_kg is not None else None,
            "real_dimensions_cm": {
                "length": float(order.package_length_cm) if order.package_length_cm is not None else None,
                "width": float(order.package_width_cm) if order.package_width_cm is not None else None,
                "height": float(order.package_height_cm) if order.package_height_cm is not None else None,
            } if order.package_weight_kg is not None else None,
            "real_cost": float(order.skydropx_real_cost) if order.skydropx_real_cost is not None else None,
            "real_carrier_name": order.skydropx_carrier_name,
            "real_service_level": order.skydropx_service_level,
            "tracking_number": order.tracking_number,
            "label_url": order.label_url,
            "tracking_url_provider": order.tracking_url_provider,
        },
        "subtotal": float(order.subtotal),
        "total": float(order.total),
        "created_at": order.created_at.isoformat(),
        "items": [serialize_order_item(i) for i in order.items],
    }
