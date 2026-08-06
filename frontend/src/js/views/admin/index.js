import { state as appState, isAdmin } from "../../state.js";
import { navigate } from "../../router.js";
import { renderProductsTab } from "./products.js";
import { renderOrdersTab } from "./orders.js";
import { renderUsersTab } from "./users.js";
import { renderStatsTab } from "./stats.js";
import { renderSettingsTab } from "./settings.js";

export function renderAdmin(container) {
  if (!isAdmin()) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-24 text-center fade-in">
        <i class="fa-solid fa-ban text-5xl text-red-400 mb-6"></i>
        <h2 class="text-3xl font-bold mb-4">Acceso restringido</h2>
        <p class="text-gray-500 mb-8">Esta sección es solo para administradores.</p>
        <button data-nav="/" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">Volver al inicio</button>
      </div>`;
    container.querySelector("[data-nav]").addEventListener("click", () => navigate("/"));
    return;
  }

  const isTech = appState.currentUser.role === "admin_tech";
  const tabs = [
    { id: "estadisticas", label: "Estadísticas", icon: "fa-chart-pie" },
    { id: "catalogo", label: "Catálogo", icon: "fa-box" },
    { id: "pedidos", label: "Pedidos", icon: "fa-truck" },
    ...(isTech
      ? [
          { id: "usuarios", label: "Usuarios", icon: "fa-users" },
          { id: "ajustes", label: "Ajustes Web", icon: "fa-gear" },
        ]
      : []),
  ];

  let activeTab = tabs[0].id;
  let tabToken = 0;

  function render() {
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-8 fade-in">
        <h1 class="text-3xl font-bold mb-2">Panel Admin</h1>
        <p class="text-gray-500 mb-8">${appState.currentUser.email} · <span class="uppercase text-brand-salmon font-bold text-sm">${appState.currentUser.role}</span></p>

        <div class="flex gap-2 border-b border-gray-200 mb-8">
          ${tabs
            .map(
              (t) => `
            <button data-tab="${t.id}" class="tab-btn px-5 py-3 font-semibold border-b-4 -mb-px ${
                activeTab === t.id ? "border-brand-blue-dark text-brand-blue-dark" : "border-transparent text-gray-400 hover:text-gray-600"
              }">
              <i class="fa-solid ${t.icon} mr-2"></i>${t.label}
            </button>`
            )
            .join("")}
        </div>

        <div id="admin-tab-content"></div>
      </div>
    `;

    container.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        render();
      });
    });

    const tabContent = container.querySelector("#admin-tab-content");
    const myTabToken = ++tabToken;
    const isCurrentTab = () => myTabToken === tabToken;

    if (activeTab === "estadisticas") renderStatsTab(tabContent, isCurrentTab);
    else if (activeTab === "catalogo") renderProductsTab(tabContent, isCurrentTab);
    else if (activeTab === "pedidos") renderOrdersTab(tabContent, isCurrentTab);
    else if (activeTab === "usuarios") renderUsersTab(tabContent, isCurrentTab);
    else if (activeTab === "ajustes") renderSettingsTab(tabContent, isCurrentTab);
  }

  render();
}
