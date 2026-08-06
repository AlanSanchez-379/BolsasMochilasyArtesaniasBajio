import { api } from "../api.js";
import { state, cartItemsCount, setCurrentUser, isAdmin } from "../state.js";
import { navigate } from "../router.js";
import { getSettings } from "../settingsCache.js";

let categoriesCache = null;

async function getCategories() {
  if (!categoriesCache) {
    const data = await api.getCategories();
    categoriesCache = data.categories;
  }
  return categoriesCache;
}

function userMenuHtml() {
  if (!state.currentUser) {
    return `
      <button data-nav="/login" class="block w-full text-left px-4 py-2 text-sm hover:bg-brand-cream font-medium">Iniciar Sesión</button>
      <button data-nav="/registro" class="block w-full text-left px-4 py-2 text-sm hover:bg-brand-cream">Crear Cuenta</button>
    `;
  }
  return `
    <div class="px-4 py-2 text-sm text-gray-500 border-b mb-2">
      ${state.currentUser.full_name || state.currentUser.email}
      ${isAdmin() ? `<span class="block text-brand-salmon font-bold text-xs uppercase mt-1">${state.currentUser.role}</span>` : ""}
    </div>
    <button data-nav="/mis-pedidos" class="block w-full text-left px-4 py-2 text-sm hover:bg-brand-cream">Mis Pedidos</button>
    ${
      isAdmin()
        ? `<button data-nav="/admin" class="block w-full text-left px-4 py-2 text-sm text-white bg-brand-blue-dark font-bold hover:bg-brand-blue mt-2">
            <i class="fa-solid fa-gauge mr-2"></i> Panel Admin
          </button>`
        : ""
    }
    <button id="logout-btn" class="block w-full text-left px-4 py-2 text-sm hover:bg-brand-cream text-red-500 mt-2 border-t pt-3">
      Cerrar Sesión
    </button>
  `;
}

function logoHtml(settings) {
  if (settings.logo_url) {
    return `<img src="${settings.logo_url}" alt="BM&A del Bajío" class="h-14 md:h-16 max-w-xs object-contain" />`;
  }
  return `
    <div class="text-xl md:text-2xl font-bold text-brand-blue flex items-center">
      <div class="bg-brand-salmon text-white p-2 rounded-xl mr-3 shadow-sm">
        <i class="fa-solid fa-bag-shopping text-2xl"></i>
      </div>
      <div class="hidden lg:flex flex-col leading-tight">
        <span class="font-black text-xl text-text-dark tracking-tight">BM&A del Bajío</span>
        <span class="text-xs text-brand-blue-dark font-semibold tracking-widest uppercase">Bolsas, Mochilas & Artesanías</span>
      </div>
      <span class="lg:hidden text-text-dark font-black">BM&A</span>
    </div>
  `;
}

export async function renderNavbar(container) {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const count = cartItemsCount();

  container.innerHTML = `
    <nav class="bg-white shadow-md sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-24">
          <div class="flex items-center cursor-pointer" data-nav="/">
            ${logoHtml(settings)}
          </div>

          <div class="hidden lg:flex items-center space-x-6 mx-4">
            ${categories
              .map(
                (cat) => `
              <button data-nav="/categoria/${encodeURIComponent(cat.name)}" class="text-gray-600 hover:text-brand-teal font-bold text-lg transition-colors whitespace-nowrap">
                ${cat.name}
              </button>`
              )
              .join("")}
          </div>

          <div class="hidden md:flex items-center flex-1 max-w-sm ml-auto mr-4">
            <div class="relative w-full">
              <input type="text" placeholder="Buscar por nombre, código..."
                class="w-full pl-4 pr-10 py-2 rounded-full border-2 border-brand-cream focus:border-brand-teal outline-none text-md transition-colors" />
              <button class="absolute right-3 top-2 text-brand-blue"><i class="fa-solid fa-search"></i></button>
            </div>
          </div>

          <div class="flex items-center space-x-4">
            <div class="relative">
              <button id="user-menu-btn" class="flex items-center text-text-dark hover:text-brand-blue">
                <i class="fa-regular fa-circle-user text-2xl mr-2"></i>
                <span class="hidden sm:inline font-medium">
                  ${state.currentUser ? (isAdmin() ? '<span class="text-brand-salmon font-bold">Admin</span>' : "Mi Cuenta") : "Ingresar"}
                </span>
              </button>
              <div id="user-menu" class="hidden absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-100 fade-in">
                ${userMenuHtml()}
              </div>
            </div>

            <button data-nav="/carrito" class="relative flex items-center text-text-dark hover:text-brand-blue text-lg">
              <i class="fa-solid fa-cart-shopping text-2xl"></i>
              ${
                count > 0
                  ? `<span class="absolute -top-2 -right-2 bg-brand-salmon text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-sm">${count}</span>`
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
