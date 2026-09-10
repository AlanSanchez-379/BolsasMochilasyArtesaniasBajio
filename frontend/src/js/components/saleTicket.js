// Ticket de venta imprimible para el POS ("Cobrar"). Se imprime vía el diálogo de
// impresión normal del navegador (window.print() dentro de un iframe oculto), a 58mm
// de ancho -- funciona con cualquier impresora térmica ya instalada como impresora de
// Windows (incluida la ZKP5803, USB 58mm), sin necesidad de WebUSB ni driver especial.

const STORE_NAME = "Bolsas, Mochilas Y Artesanías del Bajío";
const CONTACT_EMAIL = "bolsasdelbajio67@gmail.com";

const PAYMENT_METHOD_LABELS = {
  cash: "Efectivo",
  card: "Tarjeta (Terminal)",
  spei: "Transferencia SPEI",
  paypal: "PayPal",
  mercado_pago: "Mercado Pago",
};

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(n) {
  return currencyFormatter.format(Number(n) || 0);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ticketItemsHtml(order) {
  const topItems = order.items.filter((i) => !i.bundle_parent_item_id);
  const childrenByParent = order.items.reduce((acc, i) => {
    if (i.bundle_parent_item_id) (acc[i.bundle_parent_item_id] ||= []).push(i);
    return acc;
  }, {});

  return topItems
    .map((item) => {
      const children = childrenByParent[item.id] || [];
      const name = escapeHtml(item.product_name || "Producto eliminado");
      const color = item.variant_color ? ` (${escapeHtml(item.variant_color)})` : "";
      const childrenHtml = children
        .map(
          (c) =>
            `<div class="ticket-item-child">${c.quantity}x ${escapeHtml(c.product_name || "Producto eliminado")}${
              c.variant_color ? ` (${escapeHtml(c.variant_color)})` : ""
            }</div>`
        )
        .join("");
      return `
        <div class="ticket-item">
          <div class="ticket-item-row">
            <span>${item.quantity}x ${name}${color}</span>
          </div>
          <div class="ticket-item-row ticket-item-price">
            <span>${money(item.unit_price)} c/u</span>
            <span>${money(item.unit_price * item.quantity)}</span>
          </div>
          ${childrenHtml}
        </div>`;
    })
    .join("");
}

export function buildSaleTicketHtml(order) {
  const date = new Date(order.created_at || Date.now()).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const paymentLabel = PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Ticket ${escapeHtml(order.order_number)}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 58mm;
    margin: 0;
    padding: 3mm;
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    line-height: 1.4;
    color: #000;
  }
  .ticket-center { text-align: center; }
  .ticket-store-name { font-weight: bold; font-size: 13px; }
  .ticket-divider { border-top: 1px dashed #000; margin: 6px 0; }
  .ticket-item { margin-bottom: 4px; }
  .ticket-item-row { display: flex; justify-content: space-between; gap: 6px; }
  .ticket-item-price { color: #333; }
  .ticket-item-child { padding-left: 8px; font-size: 10px; color: #333; }
  .ticket-total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; }
  .ticket-small { font-size: 10px; }
</style>
</head>
<body>
  <div class="ticket-center">
    <div class="ticket-store-name">${escapeHtml(STORE_NAME)}</div>
    <div class="ticket-small">${escapeHtml(CONTACT_EMAIL)}</div>
  </div>
  <div class="ticket-divider"></div>
  <div>Folio: ${escapeHtml(order.order_number)}</div>
  <div>Fecha: ${escapeHtml(date)}</div>
  <div>Pago: ${escapeHtml(paymentLabel)}</div>
  <div class="ticket-divider"></div>
  ${ticketItemsHtml(order)}
  <div class="ticket-divider"></div>
  <div class="ticket-total-row">
    <span>TOTAL</span>
    <span>${money(order.total)}</span>
  </div>
  <div class="ticket-divider"></div>
  <div class="ticket-center ticket-small">
    ¡Gracias por tu compra!
  </div>
</body>
</html>`;
}

// Imprime el ticket usando un iframe oculto (no un popup, para evitar bloqueadores de
// ventanas emergentes) y llama a window.print() del navegador -- el usuario elige la
// impresora térmica ya instalada en el diálogo de impresión de Windows.
export function printSaleTicket(order) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = cleanup;
      }
      // Respaldo por si el navegador no dispara "afterprint" (algunos móviles).
      setTimeout(cleanup, 5000);
    }
  };

  iframe.srcdoc = buildSaleTicketHtml(order);
}
