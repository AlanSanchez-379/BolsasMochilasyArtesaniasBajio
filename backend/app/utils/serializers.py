def serialize_variant(variant):
    return {
        "id": str(variant.id),
        "color": variant.color,
        "sku": variant.sku,
        "stock": variant.stock,
        "low_stock_threshold": variant.low_stock_threshold,
        "image_url": variant.image_path,
    }


def serialize_product(product, include_eligible_ids=False):
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
        "variants": [serialize_variant(v) for v in product.variants],
    }
    if include_eligible_ids and product.is_bundle:
        data["eligible_product_ids"] = [
            str(rel.eligible_product_id) for rel in product.bundle_eligible_products
        ]
    return data
