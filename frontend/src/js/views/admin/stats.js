import { api } from "../../api.js";

function statCard(icon, label, value, colorClass) {
  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div class="w-14 h-14 rounded-full flex items-center justify-center ${colorClass}">
        <i class="fa-solid ${icon} text-2xl"></i>
      </div>
      <div>
        <p class="text-gray-500 text-sm">${label}</p>
        <p class="text-3xl font-bold">${value}</p>
      </div>
    </div>
  `;
}

export async function renderStatsTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando estadísticas...</div>`;

  const stats = await api.adminStats();
  if (!isCurrentTab()) return;

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
      ${statCard("fa-sack-dollar", "Ganancias Totales", `$${stats.total_earnings.toLocaleString("es-MX")}`, "bg-brand-teal bg-opacity-30 text-teal-700")}
      ${statCard("fa-chart-line", "Total de Ventas", stats.total_sales, "bg-brand-blue bg-opacity-30 text-brand-blue-dark")}
      ${statCard("fa-hourglass-half", "Pedidos Pendientes", stats.pending_orders, "bg-brand-salmon bg-opacity-30 text-orange-700")}
    </div>
    <p class="text-sm text-gray-400">
      Las ganancias y ventas solo cuentan pedidos con pago confirmado, en preparación, enviados o entregados.
      Pendientes incluye pedidos en espera de pago (SPEI) o en validación (Tarjeta).
    </p>
  `;
}
