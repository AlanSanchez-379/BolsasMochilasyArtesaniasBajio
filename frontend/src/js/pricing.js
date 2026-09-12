// Keep the same tier precedence as Product.price_for_quantity on the server.
export function priceForQuantity(product, quantity) {
  if (quantity >= product.super_wholesale_min_qty) return product.price_super_wholesale;
  if (quantity >= product.wholesale_min_qty) return product.price_wholesale;
  if (quantity >= product.medio_min_qty) return product.price_medio;
  if (product.is_on_sale && product.sale_price != null) return product.sale_price;
  return product.price_normal;
}
