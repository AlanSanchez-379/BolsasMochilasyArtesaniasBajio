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

function orderDetailHtml(o) {
  // Los paquetes personalizados guardan un OrderItem "padre" (el paquete en sí, con su
  // precio) y uno "hijo" por cada producto que el cliente eligió dentro (precio $0,
  // ligado vía bundle_parent_item_id). Los mostramos anidados para que quede claro
  // qué compró exactamente el cliente.
  const topItems = o.items.filter((i) => !i.bundle_parent_item_id);
  const childrenByParent = o.items.reduce((acc, i) => {
    if (i.bundle_parent_item_id) (acc[i.bundle_parent_item_id] ||= []).push(i);
    return acc;
  }, {});

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-brand-cream bg-opacity-40 rounded-xl p-5">
      <div>
        <h4 class="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wide">Productos comprados</h4>
        <ul class="space-y-3">
          ${topItems
            .map((item) => {
              const children = childrenByParent[item.id] || [];
              return `
              <li>
                <p class="text-sm text-gray-800">
                  <span class="font-bold">${item.quantity}x</span> ${item.product_name || "Producto eliminado"}
                  ${item.variant_color ? `<span class="text-gray-500">(${item.variant_color})</span>` : ""}
                  <span class="text-gray-500">— $${item.unit_price} c/u</span>
                </p>
                ${
                  children.length
                    ? `<ul class="ml-4 mt-1 space-y-1 border-l-2 border-brand-salmon border-opacity-40 pl-3">
                        ${children
                          .map(
                            (c) => `
                          <li class="text-xs text-gray-600">
                            ${c.quantity}x ${c.product_name || "Producto eliminado"}
                            <span class="text-gray-400">(${c.variant_color})</span>
                          </li>`
                          )
                          .join("")}
                      </ul>`
                    : ""
                }
              </li>`;
            })
            .join("")}
        </ul>
      </div>
      <div>
        <h4 class="font-bold text-sm text-gray-900 mb-3 uppercase tracking-wide">
          ${o.channel === "in_store" ? "Venta en Tienda Física" : "Datos de envío"}
        </h4>
        ${
          o.channel === "in_store"
            ? `<p class="text-sm text-gray-800 font-semibold">${o.shipping.full_name || "Cliente de mostrador"}</p>
               <p class="text-sm text-gray-600 mt-1"><i class="fa-solid fa-store mr-1"></i>Comprado y entregado en tienda física, sin envío.</p>`
            : `<p class="text-sm text-gray-800 font-semibold">${o.shipping.full_name}</p>
               <p class="text-sm text-gray-600">${o.shipping.phone}</p>
               <p class="text-sm text-gray-600">${o.shipping.street}, ${o.shipping.city}, ${o.shipping.state}</p>
               <p class="text-sm text-gray-600">CP ${o.shipping.postal_code}</p>
               <p class="text-sm text-gray-500 uppercase mt-2">${o.shipping.carrier || "-"} · $${o.shipping.cost}</p>`
        }
      </div>
    </div>
  `;
}

export async function renderOrdersTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando pedidos...</div>`;

  let orders;
  try {
    ({ orders } = await api.adminListOrders());
  } catch (err) {
    if (!isCurrentTab()) return;
    container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
    return;
  }
  if (!isCurrentTab()) return;

  const expanded = new Set();

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
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map((o) => {
                const isOpen = expanded.has(o.id);
                const hasCustomBundle = o.items.some((i) => i.bundle_parent_item_id);
                return `
              <tr class="border-t border-gray-100" data-row="${o.id}">
                <td class="px-4 py-3 font-semibold">
                  ${o.order_number}
                  <span class="block text-[10px] font-bold uppercase mt-0.5 ${o.channel === "in_store" ? "text-orange-600" : "text-gray-400"}">
                    <i class="fa-solid ${o.channel === "in_store" ? "fa-store" : "fa-globe"} mr-1"></i>${o.channel === "in_store" ? "Tienda Física" : "Online"}
                  </span>
                  ${hasCustomBundle ? `<span class="block text-[10px] font-bold text-brand-salmon uppercase mt-0.5">Paquete personalizado</span>` : ""}
                </td>
                <td class="px-4 py-3 text-sm">${o.shipping.full_name || "Cliente de mostrador"}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString("es-MX")}</td>
                <td class="px-4 py-3 text-sm uppercase">${o.payment_method}</td>
                <td class="px-4 py-3 font-bold">$${o.total}</td>
                <td class="px-4 py-3">
                  <select data-status="${o.id}" class="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                    ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
                  </select>
                </td>
                <td class="px-4 py-3 text-right">
                  <button data-toggle-detail="${o.id}" class="text-brand-blue-dark font-semibold text-sm hover:underline whitespace-nowrap">
                    ${isOpen ? "Ocultar" : "Ver detalle"} <i class="fa-solid ${isOpen ? "fa-chevron-up" : "fa-chevron-down"} ml-1 text-xs"></i>
                  </button>
                </td>
              </tr>
              ${
                isOpen
                  ? `<tr class="border-t border-gray-100"><td colspan="7" class="px-4 py-4">${orderDetailHtml(o)}</td></tr>`
                  : ""
              }`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-toggle-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.toggleDetail;
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        render();
      });
    });

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
