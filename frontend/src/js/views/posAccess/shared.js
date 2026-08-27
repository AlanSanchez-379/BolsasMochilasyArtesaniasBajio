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

// Modal genérico para formularios largos (crear/editar producto o paquete) -- antes
// estos formularios se insertaban en un panel debajo de la tabla, lo que con muchas
// filas quedaba fuera de la vista y parecía que el botón "no hacía nada". Se cierra
// con el botón X, la tecla Escape, o programáticamente vía `close()`; a propósito NO
// se cierra al hacer clic fuera, para no perder un formulario largo por accidente.
export function openFormModal() {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-3 sm:p-6 fade-in overflow-y-auto";
  overlay.style.zIndex = "9999";
  overlay.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto"></div>`;
  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  };
  function onKeydown(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeydown);

  return { body: overlay.firstElementChild, close };
}
