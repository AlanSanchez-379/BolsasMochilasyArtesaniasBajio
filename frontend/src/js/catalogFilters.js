export function normalizeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function matchesProductSearch(product, search) {
  const words = normalizeSearch(search).trim().split(/\s+/).filter(Boolean);
  const fields = [product.name, product.category, product.subcategory, product.description,
    ...(product.variants ?? []).flatMap(v => [v.sku, v.color])].map(normalizeSearch);
  return words.every(word => fields.some(field => field.includes(word)));
}
