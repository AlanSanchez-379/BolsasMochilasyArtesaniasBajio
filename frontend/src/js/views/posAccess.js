import { posAccessApi } from "../api.js";
import { priceForQuantity } from "../state.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function money(n) {
  return currencyFormatter.format(Number(n) || 0);
}

function stockBadgeHtml(v) {
  if (v.stock === 0) return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Agotado</span>`;
  if (v.stock <= v.low_stock_threshold) return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">${v.stock}</span>`;
  return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">${v.stock}</span>`;
}

function timeAgo(isoDate) {
  return new Date(isoDate).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function marginHtml(product) {
  if (product.cost_price == null) return `<span class="text-gray-400">—</span>`;
  const margin = Number(product.price_normal) - Number(product.cost_price);
  const pct = Number(product.price_normal) > 0 ? (margin / Number(product.price_normal)) * 100 : 0;
  const colorClass = margin >= 0 ? "text-green-600" : "text-red-600";
  return `<span class="${colorClass} font-semibold">${money(margin)} (${pct.toFixed(0)}%)</span>`;
}

function inventoryTableHtml(products) {
  const rows = products.flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })));

  return `
    <div class="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Producto</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Color</th>
            <th class="px-4 py-3">SKU</th>
            <th class="px-4 py-3">Stock</th>
            <th class="px-4 py-3">Costo</th>
            <th class="px-4 py-3">Precio</th>
            <th class="px-4 py-3">Margen</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ({ product: p, variant: v }) => `
            <tr class="border-t border-gray-100">
              <td class="px-4 py-3 font-semibold">${p.name}</td>
              <td class="px-4 py-3 text-gray-500">${p.category}</td>
              <td class="px-4 py-3 text-gray-500">${v.color}</td>
              <td class="px-4 py-3 text-gray-500">${v.sku}</td>
              <td class="px-4 py-3 ${v.stock <= v.low_stock_threshold ? "text-red-600 font-semibold" : ""}">${v.stock}</td>
              <td class="px-4 py-3 text-gray-500">${p.cost_price != null ? money(p.cost_price) : "—"}</td>
              <td class="px-4 py-3">${money(p.price_normal)}</td>
              <td class="px-4 py-3">${marginHtml(p)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function gateHtml() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-brand-cream px-4">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
        <i class="fa-solid fa-cash-register text-4xl text-brand-mexican mb-4"></i>
        <h1 class="text-xl font-bold text-gray-900 mb-1">Venta Local</h1>
        <p class="text-sm text-gray-500 mb-6">Ingresa el PIN de la tienda</p>
        <input id="pin-input" type="password" inputmode="numeric" autocomplete="off"
          class="w-full text-center text-2xl tracking-widest px-4 py-3 border border-gray-300 rounded-lg mb-3 outline-none focus:border-brand-pink" />
        <p id="pin-error" class="text-red-500 text-sm mb-3 hidden"></p>
        <button id="pin-submit" class="w-full bg-gray-900 hover:bg-brand-mexican text-white font-bold py-3 rounded-full transition-colors">
          Entrar
        </button>
      </div>
    </div>
  `;
}

// --- Sección "Dashboard": lo relevante para operar el negocio desde la caja. ---
function createDashboardSection(onUnauthorized) {
  let stats = null;
  let error = null;

  function statCard(icon, label, value, sub, colorClass) {
    return `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
        <div class="w-12 h-12 rounded-full flex items-center justify-center ${colorClass} flex-shrink-0">
          <i class="fa-solid ${icon} text-xl"></i>
        </div>
        <div class="min-w-0">
          <p class="text-gray-500 text-xs">${label}</p>
          <p class="text-2xl font-bold truncate">${value}</p>
          ${sub ? `<p class="text-xs text-gray-400">${sub}</p>` : ""}
        </div>
      </div>
    `;
  }

  function pendingRowHtml(o) {
    const actionable = o.channel === "in_store";
    return `
      <div class="border border-gray-100 rounded-xl p-3" data-pending-row="${o.id}">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-semibold text-sm">
              ${o.order_number}
              <span class="text-gray-400 font-normal">· ${o.customer_name || "Cliente"}</span>
              ${o.channel === "online" ? `<span class="ml-1 text-[10px] bg-brand-blue bg-opacity-30 text-brand-blue-dark px-2 py-0.5 rounded-full">ONLINE</span>` : ""}
            </p>
            <p class="text-xs text-gray-500 uppercase">${o.payment_method === "spei" ? "Transferencia" : o.payment_method === "card" ? "Tarjeta" : "Efectivo"} · ${money(o.total)}</p>
            ${
              o.spei_payment_deadline
                ? `<p class="text-xs text-brand-salmon font-semibold mt-1"><i class="fa-solid fa-clock mr-1"></i>Vence: ${timeAgo(o.spei_payment_deadline)}</p>`
                : ""
            }
          </div>
          <span class="text-[10px] font-bold uppercase text-gray-400">${timeAgo(o.created_at)}</span>
        </div>
        ${
          actionable
            ? `<div class="flex gap-2">
                <button data-mark-paid="${o.id}" class="flex-1 bg-brand-teal text-white text-xs font-bold py-2 rounded-full hover:opacity-90">
                  <i class="fa-solid fa-check mr-1"></i>Confirmar pago
                </button>
                <button data-cancel-pending="${o.id}" class="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-full hover:bg-gray-200">
                  Cancelar
                </button>
              </div>`
            : `<p class="text-[11px] text-gray-400">Se gestiona desde el panel de administrador.</p>`
        }
      </div>
    `;
  }

  function html() {
    if (error) return `<p class="text-red-500 text-center py-12">${error}</p>`;
    if (!stats) return `<div class="text-center py-12 text-gray-400">Cargando dashboard...</div>`;

    const pending = stats.pending_validation_orders;

    return `
      <div class="fade-in space-y-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          ${statCard("fa-sack-dollar", "Ganancias Totales", money(stats.total_earnings), `${stats.total_sales} ventas`, "bg-brand-teal bg-opacity-30 text-teal-700")}
          ${statCard("fa-chart-line", "Utilidad Estimada", money(stats.total_profit), "ingresos − costo", "bg-brand-teal bg-opacity-30 text-teal-700")}
          ${statCard("fa-globe", "Ventas Online", money(stats.online.earnings), `${stats.online.sales} pedidos`, "bg-brand-blue bg-opacity-30 text-brand-blue-dark")}
          ${statCard("fa-store", "Ventas Tienda Física", money(stats.in_store.earnings), `${stats.in_store.sales} ventas`, "bg-brand-cream text-orange-700")}
          ${statCard("fa-hourglass-half", "Por Validar", pending.length, "pagos pendientes", "bg-brand-salmon bg-opacity-30 text-orange-700")}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 class="font-bold text-lg mb-1"><i class="fa-solid fa-clock-rotate-left text-brand-salmon mr-2"></i>Pedidos por Validar</h3>
            <p class="text-xs text-gray-400 mb-4">Confirma tus transferencias de mostrador una vez que veas el depósito.</p>
            ${
              pending.length === 0
                ? `<p class="text-gray-400 text-sm text-center py-8">No hay pagos pendientes. 🎉</p>`
                : `<div class="space-y-3 max-h-96 overflow-y-auto pr-1">${pending.map(pendingRowHtml).join("")}</div>`
            }
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 class="font-bold text-lg mb-1"><i class="fa-solid fa-triangle-exclamation text-red-400 mr-2"></i>Alertas de Inventario</h3>
            <p class="text-xs text-gray-400 mb-4">Colores/modelos a punto de agotarse.</p>
            ${
              stats.low_stock.length === 0
                ? `<p class="text-gray-400 text-sm text-center py-8">Todo el inventario está en niveles saludables.</p>`
                : `<div class="space-y-2 max-h-96 overflow-y-auto pr-1">
                    ${stats.low_stock
                      .map(
                        (v) => `
                      <div class="flex items-center justify-between border-b border-gray-50 pb-2">
                        <div>
                          <p class="text-sm font-semibold">${v.product_name}</p>
                          <p class="text-xs text-gray-500">${v.color} · SKU ${v.sku}</p>
                        </div>
                        <span class="text-sm font-bold ${v.stock === 0 ? "text-red-500" : "text-orange-500"}">
                          ${v.stock === 0 ? "AGOTADO" : `${v.stock} pzs`}
                        </span>
                      </div>`
                      )
                      .join("")}
                  </div>`
            }
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <div class="p-6 pb-0">
            <h3 class="font-bold text-lg mb-1"><i class="fa-solid fa-receipt text-brand-blue-dark mr-2"></i>Últimas Transacciones</h3>
            <p class="text-xs text-gray-400 mb-4">Las 8 ventas más recientes, en línea y en tienda física.</p>
          </div>
          <table class="w-full text-left">
            <thead class="bg-brand-cream text-sm uppercase text-gray-600">
              <tr>
                <th class="px-4 py-3">Folio</th>
                <th class="px-4 py-3">Origen</th>
                <th class="px-4 py-3">Cliente</th>
                <th class="px-4 py-3">Total</th>
                <th class="px-4 py-3">Estatus</th>
                <th class="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${
                stats.recent_orders.length === 0
                  ? `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">Aún no hay transacciones.</td></tr>`
                  : stats.recent_orders
                      .map(
                        (o) => `
                <tr class="border-t border-gray-100">
                  <td class="px-4 py-3 font-semibold">${o.order_number}</td>
                  <td class="px-4 py-3 text-sm">
                    ${
                      o.channel === "online"
                        ? `<span class="text-brand-blue-dark"><i class="fa-solid fa-globe mr-1"></i>Online</span>`
                        : `<span class="text-orange-700"><i class="fa-solid fa-store mr-1"></i>Tienda Física</span>`
                    }
                  </td>
                  <td class="px-4 py-3 text-sm">${o.customer_name}</td>
                  <td class="px-4 py-3 font-bold">${money(o.total)}</td>
                  <td class="px-4 py-3 text-sm">${o.status}</td>
                  <td class="px-4 py-3 text-sm text-gray-500">${timeAgo(o.created_at)}</td>
                </tr>`
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bind(el, rerender) {
    el.querySelectorAll("[data-mark-paid]").forEach((btn) => {
      btn.addEventListener("click", () => updateOrder(btn.dataset.markPaid, "Pago confirmado", btn, rerender));
    });
    el.querySelectorAll("[data-cancel-pending]").forEach((btn) => {
      btn.addEventListener("click", () => updateOrder(btn.dataset.cancelPending, "Cancelado / Reembolsado", btn, rerender));
    });
  }

  async function updateOrder(orderId, status, btn, rerender) {
    const row = btn.closest("[data-pending-row]");
    row.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await posAccessApi.updateOrderStatus(orderId, status);
      stats.pending_validation_orders = stats.pending_validation_orders.filter((o) => o.id !== orderId);
      rerender();
    } catch (err) {
      if (err.status === 401 && onUnauthorized) {
        onUnauthorized();
        return;
      }
      alert(err.message);
      row.querySelectorAll("button").forEach((b) => (b.disabled = false));
    }
  }

  return {
    async mount(el) {
      const rerender = () => {
        el.innerHTML = html();
        bind(el, rerender);
      };
      rerender();
      try {
        stats = await posAccessApi.stats();
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        error = err.message;
      }
      rerender();
    },
  };
}

// --- Sección "Cobrar": estilo caja registradora (ticket + catálogo rápido), exclusiva
// de esta página — la pestaña de POS del panel de admin completo no cambia. ---
function createSaleSection(onUnauthorized) {
  let products = [];
  let cart = []; // { product, variant, quantity }
  let search = "";
  let paymentMethod = "cash";
  let amountPaid = "";
  let customerName = "";
  let needsShipping = false;
  let shipping = { full_name: "", phone: "", street: "", colonia: "", city: "", state: "", postal_code: "", carrier: "" };
  let shippingCost = "";
  let error = null;
  let busy = false;

  function combinedQty() {
    return cart.filter((item) => !item.product.is_bundle).reduce((sum, item) => sum + item.quantity, 0);
  }

  function lineUnitPrice(item) {
    if (item.product.is_bundle) return Number(item.product.price_normal);
    return priceForQuantity(item.product, combinedQty());
  }

  function itemsTotal() {
    return cart.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0);
  }

  function shippingCostValue() {
    if (!needsShipping) return 0;
    const n = parseFloat(shippingCost);
    return isNaN(n) ? 0 : n;
  }

  function grandTotal() {
    return itemsTotal() + shippingCostValue();
  }

  function change() {
    const paid = parseFloat(amountPaid);
    if (isNaN(paid)) return 0;
    return Math.max(0, paid - grandTotal());
  }

  function findCartItem(variantId) {
    return cart.find((item) => item.variant.id === variantId);
  }

  function addToCart(product, variant, qty = 1) {
    const existing = findCartItem(variant.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = Math.min(currentQty + qty, variant.stock);
    if (newQty === currentQty) return;
    if (existing) existing.quantity = newQty;
    else cart.push({ product, variant, quantity: newQty });
  }

  // Simple (no paquetes): cada variante es su propio "producto vendible" en el
  // catálogo rápido y por SKU, igual que un lector de código de barras real.
  function sellableVariants() {
    return products
      .filter((p) => !p.is_bundle)
      .flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })));
  }

  function filteredCatalog() {
    const term = search.trim().toLowerCase();
    if (!term) return sellableVariants();
    return sellableVariants().filter(
      ({ product, variant }) =>
        product.name.toLowerCase().includes(term) ||
        variant.sku.toLowerCase().includes(term) ||
        variant.color.toLowerCase().includes(term)
    );
  }

  async function loadProducts() {
    ({ products } = await posAccessApi.listProducts());
  }

  function shippingFieldsHtml() {
    const field = (key, label, span = "") =>
      `<div class="${span}">
        <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">${label}</label>
        <input data-shipping-field="${key}" type="text" value="${shipping[key]}" class="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
      </div>`;
    return `
      <div class="mt-2 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2">
        ${field("full_name", "Nombre", "col-span-2")}
        ${field("phone", "Teléfono")}
        ${field("carrier", "Paquetería / método")}
        ${field("street", "Calle y número", "col-span-2")}
        ${field("colonia", "Colonia")}
        ${field("city", "Ciudad")}
        ${field("state", "Estado")}
        ${field("postal_code", "CP")}
        <div>
          <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Costo de envío</label>
          <input id="shipping-cost-input" type="number" step="0.01" value="${shippingCost}" class="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        </div>
      </div>
    `;
  }

  function html() {
    const qty = combinedQty();
    return `
      <div class="fade-in grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div class="xl:col-span-2 flex flex-col gap-4 min-w-0">
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <label class="text-xs font-semibold text-slate-500 mb-1.5 block">Código o nombre del producto</label>
            <div class="relative">
              <i class="fa-solid fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input id="barcode-input" type="text" autocomplete="off" placeholder="Teclea o escanea SKU, o busca por nombre..."
                value="${search}"
                class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 font-mono text-sm" />
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1">
            <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 class="font-bold text-slate-900 text-sm"><i class="fa-solid fa-cart-shopping text-rose-500 mr-2"></i>Venta actual</h3>
              ${qty > 0 ? `<span class="text-xs bg-rose-50 text-rose-600 font-semibold px-2.5 py-1 rounded-full">${qty} pz combinadas</span>` : ""}
            </div>
            <div class="overflow-x-auto max-h-[40vh] overflow-y-auto">
              <table class="w-full text-left text-sm whitespace-nowrap">
                <thead class="bg-slate-50 sticky top-0 z-10 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th class="px-4 py-2.5 font-semibold w-full">Producto</th>
                    <th class="px-4 py-2.5 font-semibold text-right">Precio</th>
                    <th class="px-4 py-2.5 font-semibold text-center">Cant.</th>
                    <th class="px-4 py-2.5 font-semibold text-right">Importe</th>
                    <th class="px-4 py-2.5 font-semibold text-center">Stock</th>
                    <th class="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${
                    cart.length === 0
                      ? `<tr><td colspan="6" class="text-center py-16 text-slate-300"><i class="fa-solid fa-cart-shopping text-3xl mb-2 block"></i>Venta vacía. Escanea o busca un producto.</td></tr>`
                      : cart
                          .map(
                            (item) => `
                    <tr data-cart-row="${item.variant.id}" class="hover:bg-slate-50">
                      <td class="px-4 py-3">
                        <p class="font-semibold text-slate-900">${item.product.name}</p>
                        <p class="text-[10px] text-slate-400">${item.variant.color} · <span class="font-mono">${item.variant.sku}</span></p>
                      </td>
                      <td class="px-4 py-3 text-right text-slate-600">${money(lineUnitPrice(item))}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center justify-center gap-1">
                          <button data-qty-minus="${item.variant.id}" class="w-6 h-6 rounded border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 text-xs">-</button>
                          <span class="w-6 text-center text-sm font-bold text-slate-900">${item.quantity}</span>
                          <button data-qty-plus="${item.variant.id}" class="w-6 h-6 rounded border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 text-xs">+</button>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-right font-black text-slate-900">${money(lineUnitPrice(item) * item.quantity)}</td>
                      <td class="px-4 py-3 text-center">${stockBadgeHtml(item.variant)}</td>
                      <td class="px-4 py-3 text-center">
                        <button data-remove="${item.variant.id}" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
                      </td>
                    </tr>`
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <div class="mt-auto border-t border-slate-100 bg-slate-50 p-4">
              <div class="grid grid-cols-3 gap-3 mb-3">
                <div class="bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase text-slate-400">Total</span>
                  <span class="text-xl font-black text-slate-900">${money(grandTotal())}</span>
                  ${needsShipping ? `<span class="text-[10px] text-slate-400">incl. ${money(shippingCostValue())} envío</span>` : ""}
                </div>
                <div class="bg-white rounded-lg border border-slate-200 border-l-4 border-l-blue-400 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase text-slate-400">Pagó Con</span>
                  <input id="amount-paid" type="number" step="0.01" class="w-full text-lg font-bold text-slate-900 outline-none bg-transparent" placeholder="0" value="${amountPaid}" />
                </div>
                <div class="bg-white rounded-lg border border-slate-200 border-l-4 border-l-emerald-400 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase text-slate-400">Su Cambio</span>
                  <span class="text-xl font-black ${change() > 0 ? "text-emerald-600" : "text-slate-300"}">${money(change())}</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                  <div class="relative">
                    <i class="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                    <input id="customer-name" type="text" placeholder="Cliente de mostrador (opcional)" value="${customerName}"
                      class="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                  </div>
                  <div class="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button data-payment="cash" class="payment-btn py-2 text-xs font-bold rounded-md transition-colors ${
                      paymentMethod === "cash" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }"><i class="fa-solid fa-money-bill-wave mr-1"></i>Efectivo</button>
                    <button data-payment="card" class="payment-btn py-2 text-xs font-bold rounded-md transition-colors ${
                      paymentMethod === "card" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }"><i class="fa-solid fa-credit-card mr-1"></i>Terminal</button>
                    <button data-payment="spei" class="payment-btn py-2 text-xs font-bold rounded-md transition-colors ${
                      paymentMethod === "spei" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }"><i class="fa-solid fa-building-columns mr-1"></i>Transf.</button>
                  </div>
                  ${
                    paymentMethod === "spei"
                      ? `<p class="text-[10px] text-amber-700 bg-amber-50 rounded-md px-2 py-1.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Quedará pendiente hasta que confirmes el depósito en el Dashboard.</p>`
                      : ""
                  }
                </div>
                <div class="flex flex-col gap-2">
                  <label class="flex items-center justify-between cursor-pointer bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <span class="text-xs font-semibold text-slate-600"><i class="fa-solid fa-truck mr-1.5 text-slate-400"></i>Necesita envío</span>
                    <span class="relative inline-block w-10 h-5 flex-shrink-0">
                      <input type="checkbox" id="needs-shipping" ${needsShipping ? "checked" : ""} class="peer sr-only" />
                      <span class="block w-10 h-5 bg-slate-200 peer-checked:bg-rose-500 rounded-full transition-colors"></span>
                      <span class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></span>
                    </span>
                  </label>
                  ${needsShipping ? shippingFieldsHtml() : ""}
                  ${error ? `<p class="text-red-500 text-xs">${error}</p>` : ""}
                  <button id="checkout-btn" ${cart.length === 0 || busy ? "disabled" : ""}
                    class="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black text-base rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                    ${busy ? `<i class="fa-solid fa-spinner fa-spin"></i>Procesando...` : `<i class="fa-solid fa-cash-register"></i>COBRAR ${money(grandTotal())}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div class="bg-slate-900 px-4 py-3 text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <i class="fa-solid fa-bolt text-rose-400"></i>Catálogo Rápido
          </div>
          <div class="flex-1 overflow-y-auto p-2 grid grid-cols-4 gap-1.5 max-h-[70vh]">
            ${filteredCatalog()
              .map(
                ({ product, variant: v }) => `
              <button data-quick-add="${v.id}" ${v.stock === 0 ? "disabled" : ""}
                class="relative group rounded-lg overflow-hidden border border-slate-100 bg-white text-left ${
                  v.stock === 0 ? "opacity-40 cursor-not-allowed" : "hover:shadow-md hover:border-rose-200"
                }">
                <div class="relative aspect-square bg-slate-50 overflow-hidden">
                  <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ${
                    v.stock > 0
                      ? `<div class="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 flex items-center justify-center transition-colors">
                          <span class="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center transition-opacity">
                            <i class="fa-solid fa-plus text-[8px]"></i>
                          </span>
                        </div>`
                      : ""
                  }
                </div>
                <div class="p-1">
                  <p class="text-[8px] font-bold text-slate-900 leading-tight truncate">${product.name}</p>
                  <p class="text-[7px] text-slate-400 truncate">${v.color}</p>
                  <p class="text-[9px] font-black text-rose-600 mt-0.5">${money(product.price_normal)}</p>
                </div>
              </button>`
              )
              .join("")}
            ${filteredCatalog().length === 0 ? `<p class="col-span-4 text-center text-slate-300 text-xs py-8">Sin resultados.</p>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function bind(el, rerender) {
    const barcodeInput = el.querySelector("#barcode-input");
    barcodeInput.addEventListener("input", () => {
      search = barcodeInput.value;
      rerender();
      const input = el.querySelector("#barcode-input");
      input.focus();
      input.selectionStart = input.value.length;
    });
    barcodeInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const term = search.trim().toLowerCase();
      const exact = sellableVariants().find(({ variant }) => variant.sku.toLowerCase() === term);
      if (exact) {
        addToCart(exact.product, exact.variant, 1);
        search = "";
        rerender();
      }
    });
    barcodeInput.focus();

    el.querySelectorAll("[data-quick-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { product, variant } = sellableVariants().find((sv) => sv.variant.id === btn.dataset.quickAdd);
        addToCart(product, variant, 1);
        rerender();
      });
    });

    el.querySelectorAll("[data-qty-plus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = findCartItem(btn.dataset.qtyPlus);
        if (item && item.quantity < item.variant.stock) item.quantity += 1;
        rerender();
      });
    });
    el.querySelectorAll("[data-qty-minus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = findCartItem(btn.dataset.qtyMinus);
        if (item) item.quantity -= 1;
        cart = cart.filter((i) => i.quantity > 0);
        rerender();
      });
    });
    el.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cart = cart.filter((i) => i.variant.id !== btn.dataset.remove);
        rerender();
      });
    });

    el.querySelectorAll(".payment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        paymentMethod = btn.dataset.payment;
        rerender();
      });
    });

    el.querySelector("#amount-paid").addEventListener("input", (e) => {
      amountPaid = e.target.value;
      rerender();
      const input = el.querySelector("#amount-paid");
      input.focus();
    });

    el.querySelector("#customer-name").addEventListener("input", (e) => {
      customerName = e.target.value;
    });

    el.querySelector("#needs-shipping").addEventListener("change", (e) => {
      needsShipping = e.target.checked;
      rerender();
    });

    if (needsShipping) {
      el.querySelectorAll("[data-shipping-field]").forEach((input) => {
        input.addEventListener("input", (e) => {
          shipping[input.dataset.shippingField] = e.target.value;
        });
      });
      const shippingCostInput = el.querySelector("#shipping-cost-input");
      shippingCostInput.addEventListener("input", (e) => {
        shippingCost = e.target.value;
        rerender();
        const input = el.querySelector("#shipping-cost-input");
        input.focus();
      });
    }

    const checkoutBtn = el.querySelector("#checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", async () => {
        error = null;
        busy = true;
        rerender();
        try {
          const payload = {
            items: cart.map((item) => ({ variant_id: item.variant.id, quantity: item.quantity })),
            payment_method: paymentMethod,
            customer_name: customerName,
          };
          if (needsShipping) {
            payload.shipping = shipping;
            payload.shipping_cost = shippingCostValue();
          }
          const { order } = await posAccessApi.sale(payload);
          cart = [];
          amountPaid = "";
          customerName = "";
          needsShipping = false;
          shipping = { full_name: "", phone: "", street: "", colonia: "", city: "", state: "", postal_code: "", carrier: "" };
          shippingCost = "";
          await loadProducts();
          busy = false;
          alert(
            order.status === "Pendiente de pago"
              ? `Venta registrada (Folio ${order.order_number}). Queda pendiente hasta confirmar el depósito en el Dashboard.`
              : `Venta completada. Folio ${order.order_number} — Total ${money(order.total)}`
          );
          rerender();
        } catch (err) {
          busy = false;
          if (err.status === 401 && onUnauthorized) {
            onUnauthorized();
            return;
          }
          error = err.message;
          rerender();
        }
      });
    }
  }

  return {
    async mount(el) {
      el.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando catálogo...</div>`;
      try {
        await loadProducts();
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        el.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }
      const rerender = () => {
        el.innerHTML = html();
        bind(el, rerender);
      };
      rerender();
    },
  };
}

export async function renderPosAccess(container) {
  let unlocked = false;
  try {
    await posAccessApi.me();
    unlocked = true;
  } catch {
    unlocked = false;
  }

  function renderGate() {
    container.innerHTML = gateHtml();
    const input = container.querySelector("#pin-input");
    const errorEl = container.querySelector("#pin-error");
    const submitBtn = container.querySelector("#pin-submit");

    async function submit() {
      errorEl.classList.add("hidden");
      submitBtn.disabled = true;
      submitBtn.textContent = "Verificando...";
      try {
        await posAccessApi.login(input.value);
        renderMain();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Entrar";
      }
    }

    submitBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    input.focus();
  }

  async function renderMain() {
    let activeSection = "cobrar";
    let inventoryProducts = null;

    const SECTIONS = [
      { id: "cobrar", label: "Cobrar", icon: "fa-cash-register" },
      { id: "dashboard", label: "Dashboard", icon: "fa-chart-pie" },
      { id: "inventario", label: "Inventario y costos", icon: "fa-box" },
    ];

    async function render() {
      container.innerHTML = `
        <div class="min-h-screen bg-slate-50">
          <header class="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
            <h1 class="font-bold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center"><i class="fa-solid fa-cash-register text-sm"></i></span>
              Venta Local
            </h1>
            <div class="flex items-center gap-1.5">
              ${SECTIONS.map(
                (s) => `
                <button data-section="${s.id}" class="section-btn px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeSection === s.id ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }"><i class="fa-solid ${s.icon} mr-1.5"></i>${s.label}</button>`
              ).join("")}
              <span class="w-px h-6 bg-slate-200 mx-1"></span>
              <button id="logout-btn" class="text-slate-400 hover:text-red-500 text-sm px-2"><i class="fa-solid fa-right-from-bracket mr-1"></i>Salir</button>
            </div>
          </header>
          <div class="max-w-7xl mx-auto px-4 py-6" id="pos-access-content"></div>
        </div>
      `;

      container.querySelectorAll(".section-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeSection = btn.dataset.section;
          render();
        });
      });

      container.querySelector("#logout-btn").addEventListener("click", async () => {
        await posAccessApi.logout();
        renderGate();
      });

      const contentEl = container.querySelector("#pos-access-content");
      if (activeSection === "cobrar") {
        createSaleSection(renderGate).mount(contentEl);
      } else if (activeSection === "dashboard") {
        createDashboardSection(renderGate).mount(contentEl);
      } else {
        contentEl.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando inventario...</div>`;
        try {
          if (!inventoryProducts) ({ products: inventoryProducts } = await posAccessApi.listProducts());
          if (contentEl.isConnected) contentEl.innerHTML = inventoryTableHtml(inventoryProducts);
        } catch (err) {
          if (err.status === 401) {
            renderGate();
            return;
          }
          contentEl.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        }
      }
    }

    render();
  }

  if (unlocked) renderMain();
  else renderGate();
}
