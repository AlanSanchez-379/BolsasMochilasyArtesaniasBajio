import { posAccessApi } from "../../api.js";
import { createDashboardSection } from "./dashboard.js";
import { createSaleSection } from "./cobrar.js";
import { createCatalogoSection } from "./catalogo.js";
import { createPaquetesSection } from "./paquetes.js";
import { createPedidosSection } from "./pedidos.js";
import { createAjustesSection } from "./ajustes.js";

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

const SECTIONS = [
  { id: "cobrar", label: "Cobrar", icon: "fa-cash-register", create: createSaleSection },
  { id: "dashboard", label: "Dashboard", icon: "fa-chart-pie", create: createDashboardSection },
  { id: "catalogo", label: "Catálogo", icon: "fa-box", create: createCatalogoSection },
  { id: "paquetes", label: "Paquetes", icon: "fa-gift", create: createPaquetesSection },
  { id: "pedidos", label: "Pedidos", icon: "fa-truck", create: createPedidosSection },
  { id: "ajustes", label: "Ajustes", icon: "fa-gear", create: createAjustesSection },
];

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

  function renderMain() {
    let activeSection = "cobrar";
    let sectionToken = 0;

    function render() {
      container.innerHTML = `
        <div class="min-h-screen bg-slate-50">
          <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div class="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3">
              <h1 class="font-bold text-slate-900 flex items-center gap-2 flex-shrink-0">
                <span class="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-cash-register text-sm"></i></span>
                <span class="hidden md:inline">Venta Local</span>
              </h1>
              <div class="flex items-center gap-1 sm:gap-1.5 overflow-x-auto flex-1 min-w-0">
                ${SECTIONS.map(
                  (s) => `
                  <button data-section="${s.id}" title="${s.label}" class="section-btn flex-shrink-0 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeSection === s.id ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-100"
                  }"><i class="fa-solid ${s.icon} sm:mr-1.5"></i><span class="hidden sm:inline">${s.label}</span></button>`
                ).join("")}
              </div>
              <button id="logout-btn" title="Salir" class="flex-shrink-0 text-slate-400 hover:text-red-500 text-xs sm:text-sm px-1.5 sm:px-2">
                <i class="fa-solid fa-right-from-bracket sm:mr-1"></i><span class="hidden sm:inline">Salir</span>
              </button>
            </div>
          </header>
          <div class="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6" id="pos-access-content"></div>
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
      const myToken = ++sectionToken;
      const isCurrentSection = () => myToken === sectionToken;

      const section = SECTIONS.find((s) => s.id === activeSection);
      section.create(() => {
        if (isCurrentSection()) renderGate();
      }).mount(contentEl);
    }

    render();
  }

  if (unlocked) renderMain();
  else renderGate();
}
