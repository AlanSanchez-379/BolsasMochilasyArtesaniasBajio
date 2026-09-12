import { bindNavLinks } from "../dom.js";
import { api } from "../api.js";
import { state, cartItemsCount, setCurrentUser } from "../state.js";
import { navigate } from "../router.js";
import { getSettings } from "../settingsCache.js";
import { optimizeSupabaseImageUrl } from "../html.js";

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
    </div>
    <button data-nav="/mis-pedidos" class="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-brand-mexican">Mis Pedidos</button>
    <div class="border-t border-gray-100 mt-1"></div>
    <button class="logout-btn block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-500">
      Cerrar Sesión
    </button>
  `;
}

function logoHtml(settings) {
  if (settings.logo_url) {
    const optimized = optimizeSupabaseImageUrl(settings.logo_url, 200, 80);
    return `<img src="${optimized}" width="200" height="80" alt="Bolsas, Mochilas Y Artesanías del Bajío" class="w-auto h-auto max-h-20 max-w-[200px] object-contain" />`;
  }
  return `<span class="text-2xl font-black text-white tracking-tight">BM&amp;A del Bajío</span>`;
}

// El logo se sube desde Ajustes (Venta Local) y cambia de URL cada vez -- se usa el
// mismo para el ícono de la pestaña del navegador en vez de un archivo estático fijo.
function applyFavicon(url) {
  if (!url) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

export async function renderNavbar(container) {
  const settings = await getSettings();
  applyFavicon(settings.logo_url);
  const count = cartItemsCount();

  container.innerHTML = `
    <nav class="bg-brand-pink sticky top-0 z-50 shadow-md">
      <div class="h-1.5 w-full bg-gradient-to-r from-green-500 via-white to-red-500"></div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between gap-4 lg:gap-8 h-24 relative">
          <div class="flex-shrink-0 flex items-center cursor-pointer max-w-[50%]" data-nav="/">
            ${logoHtml(settings)}
          </div>

          <div class="hidden lg:flex items-center space-x-8 flex-shrink-0">
            ${NAV_LINKS.map(
              (link) => `
              <button data-nav="${link.href}" class="relative text-sm font-bold text-gray-900 hover:text-gray-700 transition-colors uppercase tracking-widest whitespace-nowrap group">
                ${link.label}
                <span class="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all group-hover:w-full"></span>
              </button>`
            ).join("")}
          </div>

          <div class="hidden md:flex flex-1 justify-center px-2">
            <div class="relative w-full max-w-sm">
              <input type="search" aria-label="Buscar productos" placeholder="Buscar productos..."
                class="search-input w-full pl-11 pr-4 py-2.5 bg-gray-100/50 border border-gray-200 rounded-full text-sm outline-none focus:border-brand-pink focus:bg-white focus:shadow-sm transition-all" />
              <button type="button" aria-label="Buscar" class="search-icon absolute left-1 top-0 w-10 h-10 text-gray-700"><i aria-hidden="true" class="fa-solid fa-search"></i></button>
            </div>
          </div>

          <div class="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
            <div class="hidden lg:block relative">
              <button id="user-menu-btn" aria-expanded="false" aria-controls="user-menu" class="flex items-center gap-2 text-gray-900 hover:text-gray-700 transition-colors">
                <i class="fa-regular fa-user text-xl"></i>
                <span class="text-sm font-medium">
                  ${state.currentUser ? "Mi Cuenta" : "Invitado"}
                </span>
              </button>
              <div id="user-menu" class="hidden absolute right-0 mt-4 w-56 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-50 animate-fade-in-up">
                ${userMenuHtml()}
              </div>
            </div>

            <button data-nav="/carrito" aria-label="Carrito: ${count} piezas" class="bg-white hover:bg-gray-100 text-brand-mexican w-11 h-11 lg:w-auto lg:px-6 lg:py-2.5 rounded-full flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5 shadow-md relative">
              <i class="fa-solid fa-cart-shopping"></i>
              <span class="font-semibold text-sm hidden lg:block tracking-wide">CARRITO</span>
              ${
                count > 0
                  ? `<span class="absolute -top-1 -right-1 lg:static lg:top-auto lg:right-auto bg-brand-salmon text-white text-[10px] lg:text-xs w-5 h-5 lg:w-auto lg:px-2 lg:py-0.5 flex items-center justify-center rounded-full font-bold shadow-sm">${count}</span>`
                  : ""
              }
            </button>
            
            <button id="mobile-menu-btn" aria-label="Menú principal" aria-expanded="false" aria-controls="mobile-menu" class="lg:hidden text-gray-900 hover:text-gray-700 w-11 h-11 flex items-center justify-center transition-colors">
              <i class="fa-solid fa-bars text-2xl"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="md:hidden px-4 pb-3">
        <div class="relative">
          <input type="search" aria-label="Buscar productos" placeholder="Buscar productos..." class="search-input w-full pl-11 pr-4 py-3 bg-white rounded-full text-sm" />
          <button type="button" aria-label="Buscar" class="search-icon absolute left-1 top-0 w-11 h-11 text-gray-700"><i aria-hidden="true" class="fa-solid fa-search"></i></button>
        </div>
      </div>
      <!-- Menú Móvil -->
      <div id="mobile-menu" class="hidden lg:hidden bg-white shadow-xl absolute top-full left-0 w-full animate-fade-in-down border-t border-gray-100 z-40">
        <div class="px-4 py-4 bg-gray-50 flex items-center gap-4 border-b border-gray-100">
          <div class="w-12 h-12 rounded-full bg-brand-pink/10 text-brand-pink flex items-center justify-center text-xl">
            <i class="fa-regular fa-user"></i>
          </div>
          <div>
            ${state.currentUser ? `
              <p class="text-xs text-gray-500">Sesión actual</p>
              <p class="text-sm font-bold text-gray-900">${state.currentUser.full_name || state.currentUser.email}</p>
            ` : `
              <p class="text-sm font-bold text-gray-900">Bienvenido</p>
              <p class="text-xs text-gray-500">Inicia sesión para comprar</p>
            `}
          </div>
        </div>
        <div class="px-4 pt-2 pb-2 space-y-1">
          ${NAV_LINKS.map(
            (link) => `
            <button data-nav="${link.href}" class="mobile-nav-link block w-full text-left px-4 py-3 rounded-md text-sm font-bold text-gray-700 hover:text-brand-pink hover:bg-gray-50 uppercase tracking-widest">
              ${link.label}
            </button>`
          ).join("")}
        </div>
        
        <div class="px-4 py-2 border-t border-gray-100 space-y-1">
            ${state.currentUser ? `
              <button data-nav="/mis-pedidos" class="mobile-nav-link block w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Mis Pedidos</button>
              <button class="logout-btn block w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50">Cerrar Sesión</button>
            ` : `
              <button data-nav="/login" class="mobile-nav-link block w-full text-left px-4 py-3 text-sm font-bold text-brand-pink hover:bg-brand-pink/5">Iniciar Sesión</button>
              <button data-nav="/registro" class="mobile-nav-link block w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50">Crear Cuenta</button>
            `}
        </div>

        <div class="px-4 py-4 mt-2 border-t border-gray-100 bg-gray-50">
          <div class="relative w-full">
            <input type="search" aria-label="Buscar productos" placeholder="Buscar productos..."
              class="search-input w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-full text-sm outline-none focus:border-brand-pink focus:shadow-sm transition-all" />
            <button type="button" aria-label="Buscar" class="search-icon absolute left-1 top-0 w-11 h-11 text-gray-700"><i aria-hidden="true" class="fa-solid fa-search"></i></button>
          </div>
        </div>
      </div>
    </nav>
  `;

  bindNavLinks(container);

  const menuBtn = container.querySelector("#user-menu-btn");
  const menu = container.querySelector("#user-menu");
  menuBtn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
    menuBtn.setAttribute("aria-expanded", String(!menu.classList.contains("hidden")));
  });

  const mobileMenuBtn = container.querySelector("#mobile-menu-btn");
  const mobileMenu = container.querySelector("#mobile-menu");
  mobileMenuBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("hidden");
    mobileMenuBtn.setAttribute("aria-expanded", String(!mobileMenu.classList.contains("hidden")));
    const icon = mobileMenuBtn.querySelector("i");
    icon.classList.toggle("fa-bars");
    icon.classList.toggle("fa-xmark");
  });

  container.querySelectorAll(".mobile-nav-link").forEach(el => {
    el.addEventListener("click", () => {
      mobileMenu.classList.add("hidden");
      mobileMenuBtn.setAttribute("aria-expanded", "false");
      mobileMenuBtn.querySelector("i").classList.remove("fa-xmark");
      mobileMenuBtn.querySelector("i").classList.add("fa-bars");
    });
  });

  container.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.logout();
      setCurrentUser(null);
      navigate("/");
    });
  });

  const performSearch = (val) => {
    if (val.trim()) {
      navigate(`/categoria/Todos?q=${encodeURIComponent(val.trim())}`);
      if (mobileMenu) {
        mobileMenu.classList.add("hidden");
      mobileMenuBtn.setAttribute("aria-expanded", "false");
        mobileMenuBtn.querySelector("i").classList.remove("fa-xmark");
        mobileMenuBtn.querySelector("i").classList.add("fa-bars");
      }
    }
  };

  container.querySelectorAll(".search-input").forEach((input, idx) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performSearch(e.target.value);
    });
    const icon = container.querySelectorAll(".search-icon")[idx];
    if (icon) {
      icon.addEventListener("click", () => performSearch(input.value));
    }
  });
}
