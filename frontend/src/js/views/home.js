import { api } from "../api.js";
import { productCardHtml, findLoteriaVariantImage } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { currentRenderToken } from "../router.js";
import { getSettings } from "../settingsCache.js";
import { getCategories, getCachedOrFetch } from "../catalogCache.js";
import { optimizeSupabaseImageUrl } from "../html.js";

function categoryIconClass(name) {
  const key = name.toLowerCase();
  if (key.includes("mochila")) return "fa-bag-shopping";
  if (key.includes("cartera")) return "fa-wallet";
  if (key.includes("cosmetiquera")) return "fa-spray-can";
  if (key.includes("monedero")) return "fa-coins";
  if (key.includes("porta") && key.includes("celular")) return "fa-mobile-screen-button";
  return "fa-bag-shopping";
}

function paint(container, { categories, bundles, bestsellers, settings, loteriaProducts }) {
  const bannerSrcOrig = settings.banner_url || "https://placehold.co/1200x500/ffffff/FE81D4?text=Emprende+Con+Nosotros";
  const bannerSrc = optimizeSupabaseImageUrl(bannerSrcOrig, 1600, 700);

  container.innerHTML = `
    <div class="animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 bg-gray-50">

      <div class="relative w-full min-h-[360px] md:h-[70vh] md:min-h-[500px] mt-6 mb-12 md:mb-24 rounded-3xl overflow-hidden shadow-2xl group">
        <div class="absolute inset-0 bg-gradient-to-r from-gray-900/80 to-transparent z-10"></div>
        <img src="${bannerSrc}" width="1600" height="700" alt="Colección de bolsas artesanales del Bajío" fetchpriority="high" class="absolute inset-0 w-full h-full object-cover z-0 opacity-100 group-hover:scale-105 transition-transform duration-1000 ease-in-out" />
        <div class="relative z-20 flex items-center h-full max-w-3xl px-4 py-6 md:px-16 animate-fade-in-up">
          <div class="glass-dark p-5 md:p-12 rounded-2xl max-w-lg border-l-4 border-l-brand-salmon">
            <h1 class="text-3xl md:text-5xl font-display font-bold text-white mb-6 leading-tight">Inicia tu negocio hoy con <span class="text-brand-salmon">precios de fábrica</span></h1>
            <p class="text-gray-300 mb-8 font-sans text-lg">Impulsa tu emprendimiento con los diseños más innovadores del Bajío.</p>
            <button data-nav="/categoria/Todos" class="bg-brand-mexican hover:bg-white hover:text-brand-mexican text-white font-bold py-3.5 px-8 transition-all duration-300 uppercase text-sm tracking-widest rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1">
              Descubrir Colección <i class="fa-solid fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="glass p-6 md:p-16 text-center max-w-4xl mx-auto rounded-3xl mb-24 shadow-sm border-white/50 relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-salmon via-brand-mexican to-brand-salmon"></div>
        <h2 class="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-6 tracking-tight">Sobre Nuestra Tienda</h2>
        <p class="text-gray-600 leading-relaxed text-lg max-w-2xl mx-auto font-sans">
          Somos los principales distribuidores del Bajío. Nuestro objetivo es impulsar tu emprendimiento con productos de alta calidad,
          precios competitivos y paquetes diseñados especialmente para ayudarte a surtir tu negocio. Ofrecemos los diseños más
          innovadores en bolsas, mochilas, carteras, monederos y cosmetiqueras.
        </p>
      </div>

      ${
        loteriaProducts && loteriaProducts.length
          ? `
      <div class="mb-24">
        <div class="flex items-center justify-center gap-4 mb-12">
          <i class="fa-solid fa-star text-green-600 text-2xl"></i>
          <h2 class="text-3xl md:text-5xl font-display font-bold text-center text-brand-mexican tracking-tight">COLECCIÓN FIESTA MEXICANA</h2>
          <i class="fa-solid fa-star text-red-600 text-2xl"></i>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          ${loteriaProducts.slice(0, 4).map((p) => productCardHtml(p, findLoteriaVariantImage(p))).join("")}
        </div>
        <div class="mt-12 text-center">
          <button data-nav="/categoria/Loteria" class="bg-brand-mexican hover:bg-gray-900 text-white font-bold py-3 px-8 rounded-full transition-colors shadow-md hover:shadow-lg uppercase text-sm tracking-wider">
            Ver Toda la Colección
          </button>
        </div>
      </div>`
          : ""
      }

      ${
        bestsellers.length
          ? `
      <div class="mb-24">
        <h2 class="text-3xl md:text-4xl font-display font-bold text-center text-gray-900 mb-12 tracking-tight">Lo Más Vendido</h2>
        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          ${bestsellers.map((p) => productCardHtml(p)).join("")}
        </div>
      </div>`
          : ""
      }

      <div class="mb-24">
        <h2 class="text-3xl md:text-4xl font-display font-bold text-center text-gray-900 mb-12 tracking-tight">¿Qué buscas hoy?</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          ${categories
            .map(
              (cat) => `
            <div data-nav="/categoria/${encodeURIComponent(cat.name)}"
              class="aspect-square bg-white border border-gray-100 rounded-2xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group relative overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-br from-brand-peach-light/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div class="w-16 h-16 rounded-full bg-brand-pink-light/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <i class="fa-solid ${categoryIconClass(cat.name)} text-2xl text-brand-mexican"></i>
              </div>
              <span class="font-display font-bold text-xs text-center uppercase tracking-widest text-gray-800 group-hover:text-brand-mexican z-10">${cat.name}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>

      ${
        bundles.length
          ? `
      <div class="bg-gray-900 rounded-3xl py-16 px-6 md:px-12 mb-10 shadow-2xl relative overflow-hidden">
        <div class="absolute top-0 right-0 w-64 h-64 bg-brand-salmon rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div class="absolute bottom-0 left-0 w-64 h-64 bg-brand-mexican rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div class="max-w-6xl mx-auto relative z-10">
          <div class="text-center mb-12">
            <span class="bg-brand-mexican text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-md">Oferta Especial</span>
            <h2 class="text-3xl md:text-5xl font-display font-bold mt-6 text-white tracking-tight">Paquetes Emprendedores</h2>
            <p class="text-lg text-gray-300 mt-4 max-w-2xl mx-auto">La forma más fácil y económica de surtir tu primer inventario con precios por paquete.</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            ${bundles.map((b) => productCardHtml(b)).join("")}
          </div>
        </div>
      </div>`
          : ""
      }
    </div>
  `;

  bindNavLinks(container);
}

async function loadHomeData() {
  const [
    { categories },
    { products: bundles },
    { products: bestsellers },
    settings,
    { products: p1 },
    { products: p2 },
    { products: p3 },
  ] = await Promise.all([
    getCategories(),
    api.getProducts({ is_bundle: "true" }),
    api.getBestsellers(4),
    getSettings(),
    api.getProducts({ search: "loteria" }),
    api.getProducts({ search: "lotería" }),
    api.getProducts({ search: "patrio" }),
  ]);

  const loteriaMap = new Map();
  [...p1, ...p2, ...p3].forEach((p) => loteriaMap.set(p.id, p));
  const loteriaProducts = Array.from(loteriaMap.values());

  return { categories, bundles, bestsellers, settings, loteriaProducts };
}

export async function renderHome(container) {
  const token = currentRenderToken();
  const { data: cached, promise } = getCachedOrFetch("home", loadHomeData);

  if (cached) {
    // Ya visitamos Home antes en esta sesión: se pinta de inmediato con lo último
    // conocido (sin pantalla de "Cargando...") y se revalida en silencio.
    paint(container, cached);
  } else {
    container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-400">Cargando...</div>`;
  }

  const fresh = await promise;
  if (token !== currentRenderToken()) return;
  paint(container, fresh);
}
