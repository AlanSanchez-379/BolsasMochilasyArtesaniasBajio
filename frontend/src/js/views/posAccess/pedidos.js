import { posAccessApi } from "../../api.js";
import { money } from "./shared.js";
import { printSaleTicket } from "../../components/saleTicket.js";

const STATUSES = [
  "Pendiente de pago",
  "Pago en validación",
  "Pago confirmado",
  "Preparando pedido",
  "Enviado",
  "Entregado",
  "Cancelado / Reembolsado",
];

function carrierLabel(carrier) {
  if (!carrier) return "-";
  if (carrier === "3guerras") return "Tres Guerras";
  if (carrier === "zone_shipping") return "Envío (tarifa por zona)";
  if (carrier === "international_quoted") return "Envío internacional (cotizado)";
  if (carrier.startsWith("skydropx:")) return "Paquetería (cotizado)";
  if (carrier === "fixed_estafeta") return "Estafeta (tarifa fija)";
  if (carrier === "fixed_dhl") return "DHL (tarifa fija)";
  return carrier.toUpperCase();
}

function internationalShippingHtml(o) {
  const hasCost = Number(o.shipping.cost) > 0;
  return `
    <div class="mt-2 pt-2 border-t border-blue-100 bg-blue-50 rounded p-3">
      <p class="text-xs font-bold text-blue-800 uppercase mb-1"><i class="fa-solid fa-globe mr-1"></i>Envío internacional</p>
      <p class="text-xs text-blue-800 mb-2">
        ${hasCost ? `Costo de envío registrado: <strong>${money(o.shipping.cost)}</strong> (cóbralo aparte al cliente).` : "Sin costo de envío registrado todavía -- cotízalo fuera de la app y captúralo aquí."}
      </p>
      <div class="flex gap-2">
        <input type="number" step="0.01" min="0" data-shipping-cost-input="${o.id}" placeholder="Costo de envío ($)"
          class="flex-1 px-2 py-1.5 border border-blue-200 rounded text-sm" />
        <button data-save-shipping-cost="${o.id}" class="bg-brand-mexican text-white px-3 py-1.5 rounded text-sm font-semibold hover:opacity-90">
          Guardar
        </button>
      </div>
    </div>
  `;
}

function paymentReviewHtml(order) {
  if (order.payment_method !== "spei" || !order.payment_voucher_url) return "";
  return `
    <div class="mt-5 pt-4 border-t border-amber-200 bg-amber-50 rounded p-4">
      <p class="text-sm font-bold text-amber-900 mb-1"><i class="fa-solid fa-file-invoice mr-1"></i>Comprobante SPEI</p>
      <p class="text-xs text-amber-800 mb-3">Revisa el archivo antes de confirmar que el pago fue recibido.</p>
      <div class="flex flex-wrap gap-2">
        <a href="${order.payment_voucher_url}" target="_blank" rel="noopener" class="border border-amber-700 text-amber-900 px-3 py-2 rounded text-sm font-semibold hover:bg-amber-100">
          <i class="fa-solid fa-eye mr-1"></i>Ver comprobante
        </a>
        <button data-voucher-status="${order.id}" data-status-value="Pago confirmado" class="bg-emerald-700 text-white px-3 py-2 rounded text-sm font-semibold hover:bg-emerald-800">
          <i class="fa-solid fa-check mr-1"></i>Aceptar pago
        </button>
        <button data-voucher-status="${order.id}" data-status-value="Pendiente de pago" class="border border-red-300 text-red-700 px-3 py-2 rounded text-sm font-semibold hover:bg-red-50">
          <i class="fa-solid fa-rotate-left mr-1"></i>Rechazar comprobante
        </button>
      </div>
    </div>
  `;
}

function whatsappUrls(order) {
  const digits = String(order.shipping.phone || "").replace(/\D/g, "");
  if (!digits) return { pending: null, confirmed: null, mercadoPago: null };
  const phone = digits.length === 10 ? `52${digits}` : digits;
  
  const msgPending = encodeURIComponent(`Hola, somos Bolsas, Mochilas y Artesanías del Bajío. Te escribimos sobre tu pedido ${order.order_number} que se encuentra Pendiente de pago. Por favor indícanos si tienes alguna duda con el pago o envíanos tu comprobante por aquí.`);
  
  const msgConfirmed = encodeURIComponent(`Hola, somos Bolsas, Mochilas y Artesanías del Bajío. Confirmamos que hemos recibido el pago de tu pedido ${order.order_number}. Pronto te daremos más detalles sobre el envío.`);

  const msgMercadoPago = encodeURIComponent(`Hola, te contactamos sobre tu pedido ${order.order_number} de Bolsas, Mochilas y Artesanías del Bajío. Te enviaremos aquí tu enlace de Mercado Pago.`);

  return {
    pending: `https://wa.me/${phone}?text=${msgPending}`,
    confirmed: `https://wa.me/${phone}?text=${msgConfirmed}`,
    mercadoPago: `https://wa.me/${phone}?text=${msgMercadoPago}`,
  };
}

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
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 rounded-xl p-5">
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
                  <span class="text-gray-500">— ${money(item.unit_price)} c/u</span>
                </p>
                ${
                  children.length
                    ? `<ul class="ml-4 mt-1 space-y-1 border-l-2 border-brand-pink pl-3">
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
               <p class="text-sm text-gray-600">${o.shipping.street}, ${o.shipping.colonia || "-"}, ${o.shipping.city}, ${o.shipping.state}</p>
               <p class="text-sm text-gray-600">CP ${o.shipping.postal_code || "-"}${o.shipping.country && o.shipping.country !== "México" ? ` · ${o.shipping.country}` : ""}</p>
               ${
                 o.shipping.carrier === "international_pending" || o.shipping.carrier === "international_quoted"
                   ? internationalShippingHtml(o)
                   : `<p class="text-sm text-gray-500 uppercase mt-2">${carrierLabel(o.shipping.carrier)} · ${money(o.shipping.cost)}</p>
                      ${o.shipping.real_cost != null ? shipmentReconciliationHtml(o.shipping) : ""}`
               }`
        }
      </div>
    </div>
    ${paymentReviewHtml(o)}
    <div class="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-4">
      <button data-print-ticket="${o.id}" class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm font-semibold flex items-center shadow-sm">
        <i class="fa-solid fa-print mr-2"></i>Imprimir Ticket
      </button>
      ${
        o.channel !== "in_store" && whatsappUrls(o).pending
          ? `<a href="${whatsappUrls(o).pending}" target="_blank" rel="noopener" class="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded text-sm font-semibold flex items-center shadow-sm">
              <i class="fa-brands fa-whatsapp mr-2 text-green-600"></i>WhatsApp (Pedir Pago)
             </a>
             <a href="${whatsappUrls(o).confirmed}" target="_blank" rel="noopener" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded text-sm font-semibold flex items-center shadow-sm">
              <i class="fa-brands fa-whatsapp mr-2 text-emerald-600"></i>WhatsApp (Confirmado)
             </a>`
          : ""
      }
    </div>
  `;
}

function shipmentReconciliationHtml(shipping) {
  const diff = shipping.real_cost - shipping.cost;
  return `
    <div class="mt-3 pt-3 border-t border-gray-200 text-xs space-y-1">
      <p class="text-gray-500">Estimado cobrado al cliente: <strong>${money(shipping.cost)}</strong> (${carrierLabel(shipping.carrier)})</p>
      <p class="text-gray-500">Costo real Skydropx: <strong>${money(shipping.real_cost)}</strong> (${shipping.real_carrier_name || "-"} · ${shipping.real_service_level || "-"})</p>
      <p class="${diff > 0 ? "text-red-600" : "text-green-600"} font-semibold">Diferencia: ${money(diff)}</p>
      ${
        shipping.tracking_number
          ? `<p class="text-gray-500">Guía: <strong>${shipping.tracking_number}</strong>${
              shipping.label_url ? ` — <a href="${shipping.label_url}" target="_blank" class="text-brand-mexican underline">Ver PDF</a>` : ""
            }</p>`
          : ""
      }
    </div>
  `;
}

// --- Sección "Pedidos": lista completa de todos los canales (online + tienda física),
// cambio de estatus, y compra de guías reales de envío con Skydropx. ---
export function createPedidosSection(onUnauthorized) {
  return {
    async mount(container) {
      container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando pedidos...</div>`;

      let orders;
      try {
        ({ orders } = await posAccessApi.listOrders());
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }

      const expanded = new Set();

      // Estado del modal "Preparar envío" (hand-rolled, sin componente compartido):
      // null = cerrado. shipmentRates queda null hasta cotizar; una vez cotizado,
      // shipmentSelectedRateId guarda cuál eligió el operador.
      let shipmentOrderId = null;
      let shipmentRates = null;
      let shipmentSelectedRateId = null;
      let shipmentError = null;
      let shipmentBusy = false;

      function closeShipmentModal() {
        shipmentOrderId = null;
        shipmentRates = null;
        shipmentSelectedRateId = null;
        shipmentError = null;
        shipmentBusy = false;
      }

      function shipmentModalHtml(order) {
        return `
          <div id="shipment-modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-lg font-bold text-gray-900">Preparar envío</h3>
                  <p class="text-sm text-gray-500">Pedido ${order.order_number}</p>
                </div>
                <button data-close-shipment-modal class="text-gray-400 hover:text-gray-700"><i class="fa-solid fa-xmark text-xl"></i></button>
              </div>

              ${
                shipmentRates === null
                  ? `
                <p class="text-sm text-gray-600 mb-3">Captura el peso y las dimensiones reales de la caja ya empacada para cotizar con Skydropx.</p>
                <div class="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Peso (kg)</label>
                    <input type="number" step="0.01" min="0.01" id="shipment-weight" class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Largo (cm)</label>
                    <input type="number" step="0.5" min="0.5" id="shipment-length" class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Ancho (cm)</label>
                    <input type="number" step="0.5" min="0.5" id="shipment-width" class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Alto (cm)</label>
                    <input type="number" step="0.5" min="0.5" id="shipment-height" class="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                  </div>
                </div>
                ${shipmentError ? `<p class="text-red-500 text-sm mb-3">${shipmentError}</p>` : ""}
                <button id="shipment-quote-btn" ${shipmentBusy ? "disabled" : ""} class="w-full bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors disabled:opacity-50">
                  ${shipmentBusy ? "Cotizando..." : "Cotizar con Skydropx"}
                </button>`
                  : `
                <p class="text-sm text-gray-600 mb-3">Elige la tarifa a comprar:</p>
                <div class="space-y-2 mb-4">
                  ${shipmentRates
                    .map(
                      (rate) => `
                    <label class="flex items-center justify-between border rounded p-3 cursor-pointer ${
                      shipmentSelectedRateId === rate.rate_id ? "border-gray-900 border-2 bg-slate-50" : "border-gray-200"
                    }">
                      <div class="flex items-center gap-3">
                        <input type="radio" name="shipment-rate" value="${rate.rate_id}" ${shipmentSelectedRateId === rate.rate_id ? "checked" : ""} />
                        <div>
                          <p class="font-bold text-gray-900 text-sm">${rate.carrier_name} · ${rate.service_level}</p>
                          <p class="text-xs text-gray-500">${rate.eta_days ? `${rate.eta_days} días hábiles` : ""}</p>
                        </div>
                      </div>
                      <span class="text-base font-bold text-gray-900">${money(rate.cost)}</span>
                    </label>`
                    )
                    .join("")}
                </div>
                ${shipmentError ? `<p class="text-red-500 text-sm mb-3">${shipmentError}</p>` : ""}
                <div class="flex gap-3">
                  <button data-shipment-reprice class="flex-1 border-2 border-gray-300 hover:border-gray-900 px-4 py-3 rounded font-semibold text-sm">Volver a cotizar</button>
                  <button id="shipment-purchase-btn" ${shipmentBusy || !shipmentSelectedRateId ? "disabled" : ""} class="flex-1 bg-brand-mexican hover:opacity-90 text-white px-4 py-3 rounded font-semibold text-sm disabled:opacity-50">
                    ${shipmentBusy ? "Comprando..." : "Comprar guía"}
                  </button>
                </div>`
              }
            </div>
          </div>
        `;
      }

      function render() {
        if (orders.length === 0) {
          container.innerHTML = `<p class="text-gray-500 text-center py-12">Aún no hay pedidos.</p>`;
          return;
        }

        container.innerHTML = `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-gray-50 text-sm uppercase text-gray-600">
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
                      ${hasCustomBundle ? `<span class="block text-[10px] font-bold text-brand-mexican uppercase mt-0.5">Paquete personalizado</span>` : ""}
                      ${
                        o.shipping.carrier === "international_pending"
                          ? `<span class="text-[10px] font-bold text-white bg-blue-600 rounded-full px-2 py-0.5 mt-1 inline-block"><i class="fa-solid fa-globe mr-1"></i>Falta cotizar envío</span>`
                          : ""
                      }
                    </td>
                    <td class="px-4 py-3 text-sm">${o.shipping.full_name || "Cliente de mostrador"}</td>
                    <td class="px-4 py-3 text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString("es-MX")}</td>
                    <td class="px-4 py-3 text-sm uppercase">${o.payment_method}</td>
                    <td class="px-4 py-3 font-bold">${money(o.total)}</td>
                    <td class="px-4 py-3">
                      <select data-status="${o.id}" class="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                        ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
                      </select>
                    </td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                      ${
                        o.payment_method === "mercado_pago" && whatsappUrls(o).mercadoPago
                          ? `<a href="${whatsappUrls(o).mercadoPago}" target="_blank" rel="noopener" class="text-green-700 font-semibold text-sm hover:underline mr-3">
                              <i class="fa-brands fa-whatsapp mr-1"></i>Enviar por WhatsApp
                            </a>`
                          : ""
                      }
                      ${
                        o.channel !== "in_store" && !o.shipping.tracking_number
                          ? `<button data-prepare-shipment="${o.id}" class="text-gray-700 font-semibold text-sm hover:underline mr-3">
                              <i class="fa-solid fa-box mr-1"></i>Preparar envío
                            </button>`
                          : ""
                      }
                      <button data-toggle-detail="${o.id}" class="text-brand-mexican font-semibold text-sm hover:underline whitespace-nowrap">
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
          ${shipmentOrderId ? shipmentModalHtml(orders.find((o) => o.id === shipmentOrderId)) : ""}
        `;

        container.querySelectorAll("[data-prepare-shipment]").forEach((btn) => {
          btn.addEventListener("click", () => {
            closeShipmentModal();
            shipmentOrderId = btn.dataset.prepareShipment;
            render();
          });
        });

        if (shipmentOrderId) {
          const overlay = container.querySelector("#shipment-modal-overlay");
          overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
              closeShipmentModal();
              render();
            }
          });
          container.querySelector("[data-close-shipment-modal]").addEventListener("click", () => {
            closeShipmentModal();
            render();
          });

          if (shipmentRates === null) {
            container.querySelector("#shipment-quote-btn")?.addEventListener("click", async () => {
              const weight = container.querySelector("#shipment-weight").value;
              const length = container.querySelector("#shipment-length").value;
              const width = container.querySelector("#shipment-width").value;
              const height = container.querySelector("#shipment-height").value;
              if (!weight || !length || !width || !height) {
                shipmentError = "Completa peso y las 3 dimensiones.";
                render();
                return;
              }
              shipmentBusy = true;
              shipmentError = null;
              render();
              try {
                const { rates } = await posAccessApi.getShipmentRates(shipmentOrderId, {
                  weight_kg: Number(weight),
                  length_cm: Number(length),
                  width_cm: Number(width),
                  height_cm: Number(height),
                });
                shipmentRates = rates;
              } catch (err) {
                if (err.status === 401 && onUnauthorized) {
                  onUnauthorized();
                  return;
                }
                shipmentError = err.message;
              } finally {
                shipmentBusy = false;
                render();
              }
            });
          } else {
            container.querySelectorAll('input[name="shipment-rate"]').forEach((input) => {
              input.addEventListener("change", () => {
                shipmentSelectedRateId = input.value;
                render();
              });
            });

            container.querySelector("[data-shipment-reprice]")?.addEventListener("click", () => {
              shipmentRates = null;
              shipmentSelectedRateId = null;
              shipmentError = null;
              render();
            });

            container.querySelector("#shipment-purchase-btn")?.addEventListener("click", async () => {
              const rate = shipmentRates.find((r) => r.rate_id === shipmentSelectedRateId);
              if (!rate) return;
              shipmentBusy = true;
              shipmentError = null;
              render();
              try {
                const { order: updatedOrder } = await posAccessApi.purchaseShipmentLabel(shipmentOrderId, {
                  rate_id: rate.rate_id,
                  quotation_id: rate.quotation_id,
                  carrier_name: rate.carrier_name,
                  service_level: rate.service_level,
                });
                const idx = orders.findIndex((o) => o.id === shipmentOrderId);
                orders[idx] = updatedOrder;
                closeShipmentModal();
              } catch (err) {
                if (err.status === 401 && onUnauthorized) {
                  onUnauthorized();
                  return;
                }
                shipmentError = err.message;
                shipmentBusy = false;
              }
              render();
            });
          }
        }

        container.querySelectorAll("[data-print-ticket]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const orderId = btn.dataset.printTicket;
            const order = orders.find(o => o.id === orderId);
            if (!order) return;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Cargando...`;
            btn.disabled = true;
            try {
              const settings = await posAccessApi.getTicketSettings();
              printSaleTicket(order, settings, {
                amountPaid: order.total,
                change: 0,
                savings: 0,
              });
            } catch (err) {
              alert("Error al cargar configuración del ticket: " + err.message);
            } finally {
              btn.innerHTML = originalHtml;
              btn.disabled = false;
            }
          });
        });

        container.querySelectorAll("[data-save-shipping-cost]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const orderId = btn.dataset.saveShippingCost;
            const input = container.querySelector(`[data-shipping-cost-input="${orderId}"]`);
            const cost = parseFloat(input.value);
            if (isNaN(cost) || cost < 0) {
              alert("Escribe un costo de envío válido.");
              return;
            }
            btn.disabled = true;
            try {
              const { order: updatedOrder } = await posAccessApi.updateShippingCost(orderId, cost);
              const idx = orders.findIndex((o) => o.id === orderId);
              orders[idx] = updatedOrder;
              render();
            } catch (err) {
              if (err.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
              }
              alert(err.message);
              btn.disabled = false;
            }
          });
        });

        container.querySelectorAll("[data-voucher-status]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const orderId = btn.dataset.voucherStatus;
            const newStatus = btn.dataset.statusValue;
            btn.disabled = true;
            try {
              const { order } = await posAccessApi.updateOrderStatus(orderId, newStatus);
              const idx = orders.findIndex((item) => item.id === orderId);
              orders[idx] = order;
              render();
            } catch (err) {
              if (err.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
              }
              alert(err.message);
              btn.disabled = false;
            }
          });
        });

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
              const { order } = await posAccessApi.updateOrderStatus(orderId, select.value);
              orders.find((o) => o.id === orderId).status = order.status;
            } catch (err) {
              if (err.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
              }
              alert(err.message);
              select.value = previous;
            }
            select.disabled = false;
          });
        });
      }

      render();
    },
  };
}
