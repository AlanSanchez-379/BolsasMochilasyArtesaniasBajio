import { api } from "../../api.js";

const STATUSES = [
  "Pendiente de pago",
  "Pago en validación",
  "Pago confirmado",
  "Preparando pedido",
  "Enviado",
  "Entregado",
  "Cancelado / Reembolsado",
];

export async function renderOrdersTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando pedidos...</div>`;
  const { orders } = await api.adminListOrders();
  if (!isCurrentTab()) return;

  function render() {
    if (orders.length === 0) {
      container.innerHTML = `<p class="text-gray-500 text-center py-12">Aún no hay pedidos.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-brand-cream text-sm uppercase text-gray-600">
            <tr>
              <th class="px-4 py-3">Pedido</th>
              <th class="px-4 py-3">Cliente</th>
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3">Pago</th>
              <th class="px-4 py-3">Total</th>
              <th class="px-4 py-3">Estatus</th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (o) => `
              <tr class="border-t border-gray-100" data-row="${o.id}">
                <td class="px-4 py-3 font-semibold">${o.order_number}</td>
                <td class="px-4 py-3 text-sm">${o.shipping.full_name}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString("es-MX")}</td>
                <td class="px-4 py-3 text-sm uppercase">${o.payment_method}</td>
                <td class="px-4 py-3 font-bold">$${o.total}</td>
                <td class="px-4 py-3">
                  <select data-status="${o.id}" class="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                    ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
                  </select>
                </td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-status]").forEach((select) => {
      select.addEventListener("change", async () => {
        const orderId = select.dataset.status;
        const previous = orders.find((o) => o.id === orderId).status;
        select.disabled = true;
        try {
          const { order } = await api.adminUpdateOrderStatus(orderId, select.value);
          orders.find((o) => o.id === orderId).status = order.status;
        } catch (err) {
          alert(err.message);
          select.value = previous;
        }
        select.disabled = false;
      });
    });
  }

  render();
}
