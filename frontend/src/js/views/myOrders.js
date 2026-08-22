import { api } from "../api.js";
import { state as appState } from "../state.js";
import { bindNavLinks } from "../dom.js";
import { navigate, currentRenderToken } from "../router.js";

const STATUS_COLORS = {
  "Pendiente de pago": "bg-yellow-100 text-yellow-700",
  "Pago en validación": "bg-blue-100 text-blue-700",
  "Pago confirmado": "bg-brand-teal bg-opacity-30 text-teal-800",
  "Preparando pedido": "bg-brand-salmon bg-opacity-30 text-orange-800",
  Enviado: "bg-purple-100 text-purple-700",
  Entregado: "bg-green-100 text-green-700",
  "Cancelado / Reembolsado": "bg-red-100 text-red-700",
};

function carrierLabel(carrier) {
  if (!carrier) return "-";
  if (carrier === "3guerras") return "Tres Guerras";
  if (carrier.startsWith("skydropx:")) return "Paquetería (cotizado)";
  return carrier.toUpperCase();
}

function orderCardHtml(order) {
  const badge = STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700";
  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
      <div class="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <p class="text-lg font-bold">${order.order_number}</p>
          <p class="text-sm text-gray-500">${new Date(order.created_at).toLocaleString("es-MX")}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-sm font-semibold ${badge}">${order.status}</span>
      </div>
      <div class="space-y-1 mb-4">
        ${order.items
          .filter((i) => !i.bundle_parent_item_id)
          .map((i) => `<p class="text-sm text-gray-600">${i.quantity}x ${i.product_name} <span class="text-gray-400">(${i.variant_color})</span></p>`)
          .join("")}
      </div>
      <div class="flex justify-between items-center border-t pt-4">
        <span class="text-gray-500">Envío: ${carrierLabel(order.shipping.carrier)}</span>
        <span class="text-xl font-bold text-brand-blue-dark">$${order.total}</span>
      </div>
      ${
        order.status === "Pendiente de pago" && order.spei_payment_deadline
          ? `<p class="text-sm text-brand-salmon font-semibold mt-2">
              <i class="fa-solid fa-clock mr-1"></i> Deposita antes de ${new Date(order.spei_payment_deadline).toLocaleString("es-MX")}
            </p>`
          : ""
      }
      ${
        order.shipping.tracking_number
          ? `<p class="text-sm text-gray-600 mt-2">
              <i class="fa-solid fa-truck mr-1"></i>Guía: <strong>${order.shipping.tracking_number}</strong>
              ${order.shipping.tracking_url_provider ? ` — <a href="${order.shipping.tracking_url_provider}" target="_blank" class="text-brand-blue-dark underline">Rastrear</a>` : ""}
            </p>`
          : ""
      }
    </div>
  `;
}

export async function renderMyOrders(container) {
  if (!appState.currentUser) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-24 text-center fade-in">
        <h2 class="text-3xl font-bold mb-4">Inicia sesión para ver tus pedidos</h2>
        <button data-nav="/login" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">Iniciar Sesión</button>
      </div>`;
    container.querySelector("[data-nav]").addEventListener("click", () => navigate("/login"));
    return;
  }

  const token = currentRenderToken();
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-400">Cargando...</div>`;
  const { orders } = await api.myOrders();
  if (token !== currentRenderToken()) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-24 text-center fade-in">
        <i class="fa-solid fa-box-open text-5xl text-brand-cream mb-6"></i>
        <h2 class="text-3xl font-bold mb-4">Aún no tienes pedidos</h2>
        <button data-nav="/categoria/Todos" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">Ir al catálogo</button>
      </div>`;
    bindNavLinks(container);
    return;
  }

  container.innerHTML = `
    <div class="max-w-3xl mx-auto px-4 py-10 fade-in">
      <h1 class="text-3xl font-bold mb-8">Mis Pedidos</h1>
      ${orders.map(orderCardHtml).join("")}
    </div>
  `;
}
