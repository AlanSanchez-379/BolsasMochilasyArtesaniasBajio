const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function money(n) {
  return currencyFormatter.format(Number(n) || 0);
}

export function stockBadgeHtml(v) {
  if (v.stock === 0) return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Agotado</span>`;
  if (v.stock <= v.low_stock_threshold) return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">${v.stock}</span>`;
  return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">${v.stock}</span>`;
}

export function timeAgo(isoDate) {
  return new Date(isoDate).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function marginHtml(product) {
  if (product.cost_price == null) return `<span class="text-gray-400">—</span>`;
  const margin = Number(product.price_normal) - Number(product.cost_price);
  const pct = Number(product.price_normal) > 0 ? (margin / Number(product.price_normal)) * 100 : 0;
  const colorClass = margin >= 0 ? "text-green-600" : "text-red-600";
  return `<span class="${colorClass} font-semibold">${money(margin)} (${pct.toFixed(0)}%)</span>`;
}
