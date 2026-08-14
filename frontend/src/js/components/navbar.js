import { api } from "../api.js";
import { state, cartItemsCount, setCurrentUser, isAdmin } from "../state.js";
import { navigate } from "../router.js";
import { getSettings } from "../settingsCache.js";

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Tienda", href: "/categoria/Todos" },
  { label: "Ofertas", href: "/categoria/Ofertas" },
  { label: "Paquetes", href: "/categoria/Paquetes" },
  { label: "Nuevos Productos", href: "/categoria/Nuevos" },
];

function userMenuHtml() {
  if (!state.currentUser) {
    return `
      <button data-nav="/login" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-semibold text-gray-700">Iniciar Sesión</button>
      <button data-nav="/registro" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-gray-500">Crear Cuenta</button>
    `;
  }
  return `
    <div class="px-4 py-3 border-b border-gray-100 mb-1">
      <p class="text-xs text-gray-400">Sesión actual</p>
      <p class="text-sm font-bold text-gray-900 truncate">${state.currentUser.full_name || state.currentUser.email}</p>
      ${isAdmin() ? `<span class="block text-brand-mexican font-bold text-xs uppercase mt-1">${state.currentUser.role}</span>` : ""}
    </div>
    <button data-nav="/mis-pedidos" class="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-brand-mexican">Mis Pedidos</button>
    ${
      isAdmin()
        ? `<button data-nav="/admin" class="block w-full text-left px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 mt-1">
            <i class="fa-solid fa-gauge mr-2"></i> Panel Admin
          </button>`
        : ""
    }
    <div class="border-t border-gray-100 mt-1"></div>
    <button id="logout-btn" class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-500">
      Cerrar Sesión
    </button>
  `;
}

function logoHtml(settings) {
  if (settings.logo_url) {
    return `<img src="${settings.logo_url}" alt="Bolsas, Mochilas Y Artesanías del Bajío" class="h-full w-auto object-contain max-h-20" />`;
  }
  return `<span class="text-2xl font-black text-brand-pink tracking-tight">BM&amp;A del Bajío</span>`;
}

export async function renderNavbar(container) {
  const settings = await getSettings();
  const count = cartItemsCount();

  container.innerHTML = `
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between gap-4 lg:gap-8 h-24">
          <div class="flex-shrink-0 flex items-center cursor-pointer h-full py-2" data-nav="/">
            ${logoHtml(settings)}
          </div>

          <div class="hidden lg:flex items-center space-x-6 flex-shrink-0">
            ${NAV_LINKS.map(
              (link) => `
              <button data-nav="${link.href}" class="text-sm font-bold text-gray-800 hover:text-brand-mexican transition-colors uppercase tracking-wide whitespace-nowrap">
                ${link.label}
              </button>`
            ).join("")}
          </div>

          <div class="hidden md:flex flex-1 justify-center px-2">
            <div class="relative w-full max-w-sm">
              <input type="text" placeholder="Buscar productos..."
                class="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm outline-none focus:border-brand-pink transition-colors" />
              <i class="fa-solid fa-search absolute left-4 top-2.5 text-gray-400"></i>
            </div>
          </div>

          <div class="flex items-center space-x-5 flex-shrink-0">
            <div class="relative">
              <button id="user-menu-btn" class="flex items-center gap-2 text-gray-600 hover:text-brand-mexican">
                <i class="fa-regular fa-user text-xl"></i>
                <span class="hidden sm:inline text-sm font-medium">
                  ${state.currentUser ? (isAdmin() ? '<span class="text-brand-mexican font-bold">Admin</span>' : "Mi Cuenta") : "Invitado"}
                </span>
              </button>
              <div id="user-menu" class="hidden absolute right-0 mt-4 w-56 bg-white border border-gray-200 rounded shadow-lg py-1 z-50 fade-in">
                ${userMenuHtml()}
              </div>
            </div>

            <button data-nav="/carrito" class="bg-gray-900 hover:bg-brand-mexican text-white px-5 py-2.5 rounded flex items-center gap-3 transition-colors">
              <i class="fa-solid fa-cart-shopping"></i>
              <span class="font-semibold text-sm hidden sm:block">Tu Carrito</span>
              ${
                count > 0
                  ? `<span class="bg-white text-brand-mexican text-xs px-2 py-0.5 rounded-full font-bold">${count}</span>`
                  : ""
              }
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;

  container.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });

  const menuBtn = container.querySelector("#user-menu-btn");
  const menu = container.querySelector("#user-menu");
  menuBtn.addEventListener("click", () => menu.classList.toggle("hidden"));

  const logoutBtn = container.querySelector("#logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api.logout();
      setCurrentUser(null);
      navigate("/");
    });
  }
}
