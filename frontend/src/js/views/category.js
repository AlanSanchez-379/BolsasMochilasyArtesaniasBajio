import { api } from "../api.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { currentRenderToken } from "../router.js";
import { getCategories } from "../catalogCache.js";

const SPECIAL_CATEGORIES = { Paquetes: "Paquetes Emprendedores", Nuevos: "Nuevos Productos" };

function applyFilters(products, { search, subcategory, color, maxPrice }) {
  return products.filter((p) => {
    const matchesSubcategory = subcategory === "Todas" || p.subcategory === subcategory;
    const matchesColor = color === "Todos" || p.variants.some((v) => v.color === color);
    const matchesPrice = maxPrice == null || Number(p.price_normal) <= maxPrice;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(term) || v.color.toLowerCase().includes(term));
    return matchesSubcategory && matchesColor && matchesPrice && matchesSearch;
  });
}

function categoryShell(categories, activeCategory) {
  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div class="flex flex-col lg:flex-row gap-8">
        <div class="w-full lg:w-64 flex-shrink-0">
          <div class="border border-gray-200 rounded-lg p-6 bg-white lg:sticky lg:top-28">
            <div class="flex justify-between items-center mb-6">
              <h3 class="font-bold text-lg text-gray-900">Filtros</h3>
              <i class="fa-solid fa-sliders text-gray-400"></i>
            </div>

            <div class="mb-6 border-b border-gray-100 pb-4">
              <h4 class="font-semibold text-sm text-gray-900 mb-3">Categoría</h4>
              <ul class="space-y-2">
                <li>
                  <button data-cat="Todos" class="cat-link w-full text-left text-sm flex justify-between items-center ${
                    activeCategory === "Todos" ? "font-bold text-brand-mexican" : "text-gray-600 hover:text-gray-900"
                  }">
                    <span>Todos los productos</span>
                    <i class="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                </li>
                ${categories
                  .map(
                    (cat) => `
                  <li>
                    <button data-cat="${cat.name}" class="cat-link w-full text-left text-sm flex justify-between items-center ${
                      activeCategory === cat.name ? "font-bold text-brand-mexican" : "text-gray-600 hover:text-gray-900"
                    }">
                      <span>${cat.name}</span>
                      <i class="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                  </li>`
                  )
                  .join("")}
              </ul>
            </div>

            <div class="mb-6 border-b border-gray-100 pb-4">
              <h4 class="font-semibold text-sm text-gray-900 mb-3">Accesos Rápidos</h4>
              <ul class="space-y-2">
                ${Object.entries(SPECIAL_CATEGORIES)
                  .map(
                    ([key, label]) => `
                  <li>
                    <button data-cat="${key}" class="cat-link w-full text-left text-sm flex justify-between items-center ${
                      activeCategory === key ? "font-bold text-brand-mexican" : "text-gray-600 hover:text-gray-900"
                    }">
                      <span>${label}</span>
                      <i class="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                  </li>`
                  )
                  .join("")}
              </ul>
            </div>

            <div class="mb-6">
              <div class="relative">
                <input id="filter-search" type="text" placeholder="Buscar..."
                  class="w-full pl-8 pr-3 py-2 border-b border-gray-200 outline-none text-sm focus:border-brand-pink transition-colors" />
                <i class="fa-solid fa-search absolute left-0 top-2.5 text-gray-400 text-sm"></i>
              </div>
            </div>

            <div class="mb-4 border-t border-gray-100 pt-4">
              <label class="block font-semibold text-sm text-gray-900 mb-2">Tipo / Estampado</label>
              <select id="filter-subcategory" class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-pink"></select>
            </div>
            <div class="mb-4">
              <label class="block font-semibold text-sm text-gray-900 mb-2">Color disponible</label>
              <select id="filter-color" class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-pink"></select>
            </div>
            <div class="mb-2">
              <label class="block font-semibold text-sm text-gray-900 mb-2">Precio máximo</label>
              <input id="filter-price" type="range" min="0" max="0" step="50" class="w-full accent-brand-mexican" />
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>$0</span>
                <span id="filter-price-value" class="font-bold text-gray-900">$0</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1">
          <div class="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h2 class="text-2xl font-bold text-gray-900">${SPECIAL_CATEGORIES[activeCategory] || activeCategory}</h2>
            <span id="result-count" class="text-sm text-gray-500"></span>
          </div>
          <div id="product-grid">
            <div class="text-center py-20 bg-gray-50 rounded-lg border border-gray-200 text-gray-400">Cargando productos...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderGrid(gridEl, countEl, products) {
  countEl.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
  if (products.length === 0) {
    gridEl.innerHTML = `
      <div class="text-center py-20 bg-gray-50 rounded-lg border border-gray-200">
        <i class="fa-solid fa-box-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">No encontramos productos en esta categoría.</p>
      </div>`;
  } else {
    gridEl.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${products.map((p) => productCardHtml(p)).join("")}
    </div>`;
  }
  bindNavLinks(gridEl);
}

export async function renderCategory(container, categoryName) {
  const token = currentRenderToken();
  const activeCategory = categoryName || "Todos";

  // Las categorías ya están precargadas (o casi) desde el arranque de la app, así que
  // esto normalmente resuelve al instante: la barra lateral y los filtros aparecen sin
  // pantalla de "Cargando...". Solo la grilla de productos (que sí cambia por categoría)
  // muestra su propio estado de carga, mucho más breve y localizado.
  const { categories } = await getCategories();
  if (token !== currentRenderToken()) return;

  container.innerHTML = categoryShell(categories, activeCategory);

  container.querySelectorAll(".cat-link").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.hash = `/categoria/${encodeURIComponent(el.dataset.cat)}`;
    });
  });

  const searchInput = container.querySelector("#filter-search");
  const subcategorySelect = container.querySelector("#filter-subcategory");
  const colorSelect = container.querySelector("#filter-color");
  const priceInput = container.querySelector("#filter-price");
  const priceValueLabel = container.querySelector("#filter-price-value");
  const gridEl = container.querySelector("#product-grid");
  const countEl = container.querySelector("#result-count");

  let categoryProducts;
  if (activeCategory === "Paquetes") {
    ({ products: categoryProducts } = await api.getProducts({ is_bundle: "true" }));
  } else if (activeCategory === "Nuevos") {
    const { products } = await api.getProducts({ is_bundle: "false" });
    categoryProducts = [...products]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 24);
  } else {
    ({ products: categoryProducts } = await api.getProducts(
      activeCategory === "Todos" ? {} : { category: activeCategory }
    ));
  }
  if (token !== currentRenderToken()) return;

  const availableSubcategories = ["Todas", ...new Set(categoryProducts.map((p) => p.subcategory))];
  const availableColors = ["Todos", ...new Set(categoryProducts.flatMap((p) => p.variants.map((v) => v.color)))];

  subcategorySelect.innerHTML = availableSubcategories.map((s) => `<option value="${s}">${s}</option>`).join("");
  colorSelect.innerHTML = availableColors.map((c) => `<option value="${c}">${c}</option>`).join("");

  const highestPrice = categoryProducts.reduce((max, p) => Math.max(max, Number(p.price_normal)), 0);
  const priceCeiling = Math.max(Math.ceil(highestPrice / 50) * 50, 50);
  priceInput.max = priceCeiling;
  priceInput.value = priceCeiling;
  priceValueLabel.textContent = `$${priceCeiling}`;

  function refresh() {
    const filtered = applyFilters(categoryProducts, {
      search: searchInput.value,
      subcategory: subcategorySelect.value,
      color: colorSelect.value,
      maxPrice: Number(priceInput.value),
    });
    renderGrid(gridEl, countEl, filtered);
  }

  searchInput.addEventListener("input", refresh);
  subcategorySelect.addEventListener("change", refresh);
  colorSelect.addEventListener("change", refresh);
  priceInput.addEventListener("input", () => {
    priceValueLabel.textContent = `$${priceInput.value}`;
    refresh();
  });

  refresh();
}
