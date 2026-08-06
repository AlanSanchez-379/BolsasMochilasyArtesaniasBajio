import { api } from "../api.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";

export async function renderHome(container) {
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-400">Cargando...</div>`;

  const [{ categories }, { products: bundles }, { products: regularProducts }] = await Promise.all([
    api.getCategories(),
    api.getProducts({ is_bundle: "true" }),
    api.getProducts({ is_bundle: "false" }),
  ]);

  container.innerHTML = `
    <div class="fade-in">
      <div class="bg-brand-cream py-16 px-4">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center">
          <div class="md:w-1/2 mb-8 md:mb-0">
            <h1 class="text-4xl md:text-5xl font-bold text-text-dark mb-4 leading-tight">
              Inicia tu negocio hoy con <span class="text-brand-blue">precios de fábrica</span>
            </h1>
            <p class="text-xl text-gray-700 mb-8">
              Vende bolsas y carteras de alta calidad. Descubre nuestros paquetes emprendedor con grandes márgenes de ganancia.
            </p>
            <button data-nav="/categoria/Todos" class="bg-brand-blue-dark text-white px-8 py-4 rounded-full text-xl font-semibold hover:bg-brand-blue shadow-lg transition-transform transform hover:-translate-y-1">
              Ver Catálogo Completo <i class="fa-solid fa-arrow-right ml-2"></i>
            </button>
          </div>
          <div class="md:w-1/2 flex justify-center">
            <img src="https://placehold.co/600x400/9BCEC1/ffffff?text=Emprende+Con+Nosotros" alt="Hero" class="rounded-2xl shadow-xl transform rotate-2" />
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-4 py-12">
        <h2 class="text-3xl font-bold text-center mb-8">¿Qué buscas hoy?</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${categories
            .map(
              (cat) => `
            <div data-nav="/categoria/${encodeURIComponent(cat.name)}" class="bg-white rounded-xl shadow p-6 text-center cursor-pointer hover:shadow-lg hover:border-brand-teal border-2 border-transparent transition-all">
              <div class="w-20 h-20 mx-auto bg-brand-cream rounded-full flex items-center justify-center mb-4">
                <i class="fa-solid fa-bag-shopping text-3xl text-brand-salmon"></i>
              </div>
              <h3 class="text-xl font-semibold">${cat.name}</h3>
            </div>`
            )
            .join("")}
        </div>
      </div>

      ${
        bundles.length
          ? `
      <div class="bg-brand-teal bg-opacity-20 py-12 px-4">
        <div class="max-w-7xl mx-auto">
          <div class="text-center mb-10">
            <span class="bg-brand-salmon text-white px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wide">Especial</span>
            <h2 class="text-3xl font-bold mt-4">Paquetes Emprendedores</h2>
            <p class="text-lg text-gray-700 mt-2">La forma más fácil y económica de surtir tu primer inventario.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            ${bundles.map((b) => productCardHtml(b)).join("")}
          </div>
        </div>
      </div>`
          : ""
      }

      <div class="max-w-7xl mx-auto px-4 py-12">
        <h2 class="text-3xl font-bold mb-8">Productos Más Vendidos</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          ${regularProducts.map((p) => productCardHtml(p)).join("")}
        </div>
      </div>
    </div>
  `;

  bindNavLinks(container);
}
