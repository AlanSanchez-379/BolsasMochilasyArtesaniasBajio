import { posAccessApi } from "../../api.js";
import { createDashboardSection } from "./dashboard.js";
import { createSaleSection } from "./cobrar.js";
import { createCatalogoSection } from "./catalogo.js";
import { createPaquetesSection } from "./paquetes.js";
import { createPedidosSection } from "./pedidos.js";
import { createAjustesSection } from "./ajustes.js";
import { createTicketSection } from "./ticket.js";

function gateHtml() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
      <!-- Decoraciones de fondo -->
      <div class="absolute -top-32 -right-32 w-96 h-96 bg-brand-pink/20 rounded-full blur-3xl mix-blend-multiply"></div>
      <div class="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-mexican/10 rounded-full blur-3xl mix-blend-multiply"></div>

      <div class="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-8 sm:p-10 w-full max-w-sm text-center relative z-10 animate-fade-in-up">
        <div class="w-20 h-20 mx-auto bg-gradient-to-tr from-brand-pink to-brand-mexican rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-brand-pink/30">
          <i class="fa-solid fa-cash-register text-4xl text-white"></i>
        </div>
        <h1 class="text-2xl font-display font-bold text-gray-900 mb-1 tracking-tight">Punto de Venta</h1>
        <p class="text-sm text-gray-500 mb-8 font-sans">Ingresa el PIN de seguridad</p>
        <input id="pin-input" type="password" inputmode="numeric" autocomplete="off" placeholder="••••"
          class="w-full text-center text-3xl tracking-[1em] px-4 py-4 bg-gray-50/50 border border-gray-200 rounded-xl mb-4 outline-none focus:border-brand-pink focus:bg-white focus:ring-4 focus:ring-brand-pink/10 transition-all font-mono" />
        <p id="pin-error" class="text-red-500 text-sm mb-4 hidden font-medium"></p>
        <button id="pin-submit" class="w-full bg-gray-900 hover:bg-brand-mexican text-white font-bold py-4 rounded-xl transition-colors shadow-md hover:shadow-lg uppercase tracking-wider text-sm">
          Ingresar al Sistema
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
  { id: "ticket", label: "Ticket", icon: "fa-receipt", create: createTicketSection },
  { id: "ajustes", label: "Ajustes", icon: "fa-gear", create: createAjustesSection },
];

export async function renderPosAccess(container) {
  let unlocked = false;
  let userRole = "admin";
  try {
    const res = await posAccessApi.me();
    unlocked = true;
    userRole = res.role || "admin";
    window.posRole = userRole;
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
        const res = await posAccessApi.login(input.value);
        if (res.token) {
          localStorage.setItem("pos_token", res.token);
        }
        userRole = res.role || "admin";
        window.posRole = userRole;
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
    const allowedSections = SECTIONS.filter(s => {
      if (userRole === "employee" && (s.id === "dashboard" || s.id === "ajustes" || s.id === "ticket")) {
        return false;
      }
      return true;
    });

    function render() {
      container.innerHTML = `
        <div class="min-h-screen bg-[#F4F4F9]">
          <header class="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-30 shadow-sm">
            <div class="px-4 sm:px-6 py-3 flex items-center justify-between gap-4 overflow-hidden">
              
              <!-- Logo / Título -->
              <h1 class="font-display font-bold text-gray-900 flex items-center gap-3 flex-shrink-0">
                <span class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-pink to-brand-mexican text-white flex items-center justify-center flex-shrink-0 shadow-md">
                  <i class="fa-solid fa-store text-lg"></i>
                </span>
                <span class="hidden md:inline tracking-tight text-lg">Punto de Venta</span>
              </h1>
              
              <!-- Navegación -->
              <div class="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 hide-scrollbar pb-1 -mb-1 px-2">
                ${allowedSections.map(
                  (s) => `
                  <button data-section="${s.id}" title="${s.label}" class="section-btn flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                    activeSection === s.id ? "bg-brand-mexican text-white shadow-md shadow-brand-mexican/20 scale-105" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  }"><i class="fa-solid ${s.icon} sm:mr-2"></i><span class="hidden sm:inline">${s.label}</span></button>`
                ).join("")}
              </div>

              <!-- Salir -->
              <button id="logout-btn" title="Cerrar Sesión" class="flex-shrink-0 flex items-center gap-2 text-gray-400 hover:text-red-500 text-sm font-bold bg-gray-50 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors">
                <i class="fa-solid fa-power-off"></i><span class="hidden lg:inline uppercase text-[10px] tracking-widest">Salir</span>
              </button>
            </div>
          </header>
          
          <div class="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8" id="pos-access-content"></div>
        </div>
      `;

      container.querySelectorAll(".section-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeSection = btn.dataset.section;
          render();
        });
      });

      container.querySelector("#logout-btn").addEventListener("click", async () => {
        localStorage.removeItem("pos_token");
        await posAccessApi.logout();
        renderGate();
      });

      const contentEl = container.querySelector("#pos-access-content");
      const myToken = ++sectionToken;
      const isCurrentSection = () => myToken === sectionToken;

      const section = allowedSections.find((s) => s.id === activeSection) || allowedSections[0];
      if (activeSection !== section.id) activeSection = section.id;
      
      section.create(() => {
        if (isCurrentSection()) renderGate();
      }).mount(contentEl);
    }

    render();
  }

  if (unlocked) renderMain();
  else renderGate();
}
