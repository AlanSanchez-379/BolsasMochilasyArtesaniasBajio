import { api } from "../api.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { currentRenderToken } from "../router.js";
import { getSettings } from "../settingsCache.js";
import { getCategories, getCachedOrFetch } from "../catalogCache.js";

function categoryIconClass(name) {
  const key = name.toLowerCase();
  if (key.includes("mochila")) return "fa-bag-shopping fa-rotate-90";
  if (key.includes("cartera")) return "fa-wallet";
  if (key.includes("cosmetiquera")) return "fa-spray-can";
  if (key.includes("monedero")) return "fa-coins";
  return "fa-bag-shopping";
}

function paint(container, { categories, bundles, bestsellers, settings }) {
  const bannerSrc = settings.banner_url || "https://placehold.co/1200x500/ffffff/FE81D4?text=Emprende+Con+Nosotros";

  container.innerHTML = `
    <div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 bg-white">

      <div class="relative w-full h-[60vh] min-h-[400px] border border-gray-200 mt-8 mb-16 flex flex-col items-center justify-center overflow-hidden group cursor-pointer" data-nav="/categoria/Todos">
        <img src="${bannerSrc}" alt="Banner" class="absolute inset-0 w-full h-full object-cover z-0 opacity-90 group-hover:scale-105 transition-transform duration-700" />
        <div class="relative z-10 bg-white bg-opacity-95 p-8 rounded shadow-lg text-center mt-32 md:mt-48 max-w-md border border-gray-100 mx-4">
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Inicia tu negocio hoy con precios de fábrica</h2>
          <button class="bg-gray-900 hover:bg-brand-mexican text-white font-semibold py-3 px-8 transition-colors uppercase text-sm tracking-wider rounded">
            Comprar Ahora
          </button>
        </div>
      </div>

      ${
        bestsellers.length
          ? `
      <div class="mb-20">
        <h2 class="text-3xl font-semibold text-center text-gray-900 mb-10">Lo Más Vendido</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          ${bestsellers.map((p) => productCardHtml(p)).join("")}
        </div>
      </div>`
          : ""
      }

      <hr class="border-gray-200 mb-16" />

      <div class="mb-20">
        <h2 class="text-3xl font-semibold text-center text-gray-900 mb-10">¿Qué buscas hoy?</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          ${categories
            .map(
              (cat) => `
            <div data-nav="/categoria/${encodeURIComponent(cat.name)}"
              class="aspect-square border border-gray-200 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer transition-all hover:border-brand-pink hover:shadow">
              <i class="fa-solid ${categoryIconClass(cat.name)} text-3xl text-brand-mexican mb-3"></i>
              <span class="font-semibold text-xs text-center uppercase tracking-wide">${cat.name}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>

      ${
        bundles.length
          ? `
      <div class="border border-gray-200 bg-brand-peach-light bg-opacity-40 rounded-lg py-12 px-4 mb-20">
        <div class="max-w-6xl mx-auto">
          <div class="text-center mb-10">
            <span class="bg-brand-mexican text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Especial</span>
            <h2 class="text-3xl font-bold mt-4 text-gray-900">Paquetes Emprendedores</h2>
            <p class="text-base text-gray-600 mt-2">La forma más fácil y económica de surtir tu primer inventario.</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            ${bundles.map((b) => productCardHtml(b)).join("")}
          </div>
        </div>
      </div>`
          : ""
      }

      <div class="border border-gray-200 bg-white p-10 md:p-12 text-center max-w-5xl mx-auto rounded-lg">
        <h2 class="text-3xl font-semibold text-gray-900 mb-6">Sobre Nuestra Tienda</h2>
        <p class="text-gray-600 leading-relaxed text-base max-w-3xl mx-auto">
          Somos los principales distribuidores del Bajío. Nuestro objetivo es impulsar tu emprendimiento con productos de alta calidad,
          precios competitivos y paquetes diseñados especialmente para garantizar tu margen de ganancia. Ofrecemos los diseños más
          innovadores en bolsas, mochilas, carteras, monederos y cosmetiqueras.
        </p>
      </div>
    </div>
  `;

  bindNavLinks(container);
}

async function loadHomeData() {
  const [{ categories }, { products: bundles }, { products: bestsellers }, settings] = await Promise.all([
    getCategories(),
    api.getProducts({ is_bundle: "true" }),
    api.getBestsellers(4),
    getSettings(),
  ]);
  return { categories, bundles, bestsellers, settings };
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
