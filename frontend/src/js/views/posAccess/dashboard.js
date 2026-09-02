import { posAccessApi } from "../../api.js";
import { money, timeAgo } from "./shared.js";

// --- Sección "Dashboard": lo relevante para operar el negocio desde la caja. ---
export function createDashboardSection(onUnauthorized) {
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
    return `
      <div class="border border-gray-100 rounded-xl p-3" data-pending-row="${o.id}">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-semibold text-sm">
              ${o.order_number}
              <span class="text-gray-400 font-normal">· ${o.customer_name || "Cliente"}</span>
              ${o.channel === "online" ? `<span class="ml-1 text-[10px] bg-brand-blue bg-opacity-30 text-brand-blue-dark px-2 py-0.5 rounded-full">ONLINE</span>` : ""}
            </p>
            <p class="text-xs text-gray-500 uppercase">${
              o.payment_method === "spei" ? "Transferencia" : o.payment_method === "paypal" ? "PayPal" : o.payment_method === "card" ? "Tarjeta" : "Efectivo"
            } · ${money(o.total)}</p>
            ${
              o.spei_payment_deadline
                ? `<p class="text-xs text-brand-salmon font-semibold mt-1"><i class="fa-solid fa-clock mr-1"></i>Vence: ${timeAgo(o.spei_payment_deadline)}</p>`
                : ""
            }
          </div>
          <span class="text-[10px] font-bold uppercase text-gray-400">${timeAgo(o.created_at)}</span>
        </div>
        <div class="flex gap-2">
          <button data-mark-paid="${o.id}" class="flex-1 bg-brand-teal text-white text-xs font-bold py-2 rounded-full hover:opacity-90">
            <i class="fa-solid fa-check mr-1"></i>Confirmar pago
          </button>
          <button data-cancel-pending="${o.id}" class="flex-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 rounded-full hover:bg-gray-200">
            Cancelar
          </button>
        </div>
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
            <p class="text-xs text-gray-400 mb-4">Confirma pagos pendientes (efectivo/tarjeta por confirmar o transferencias), en línea y en tienda.</p>
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
