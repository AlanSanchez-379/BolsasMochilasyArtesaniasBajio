import { api } from "../api.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { currentRenderToken } from "../router.js";

function applyFilters(products, { search, subcategory, color }) {
  return products.filter((p) => {
    const matchesSubcategory = subcategory === "Todas" || p.subcategory === subcategory;
    const matchesColor = color === "Todos" || p.variants.some((v) => v.color === color);
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(term) || v.color.toLowerCase().includes(term));
    return matchesSubcategory && matchesColor && matchesSearch;
  });
}

function categoryShell(categories, activeCategory) {
  return `
    <div class="max-w-7xl mx-auto px-4 py-8 fade-in flex flex-col md:flex-row gap-8">
      <div class="md:w-1/4">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:sticky md:top-24">
          <h3 class="text-2xl font-bold mb-6 border-b pb-4">Categorías</h3>
          <ul class="space-y-3 text-lg">
            <li>
              <button data-cat="Todos" class="cat-link w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activeCategory === "Todos" ? "bg-brand-blue-dark text-white font-medium" : "hover:bg-brand-cream text-gray-700"
              }">Todos los productos</button>
            </li>
            ${categories
              .map(
                (cat) => `
              <li>
                <button data-cat="${cat.name}" class="cat-link w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  activeCategory === cat.name ? "bg-brand-blue-dark text-white font-medium" : "hover:bg-brand-cream text-gray-700"
                }">${cat.name}</button>
              </li>`
              )
              .join("")}
          </ul>

          <div class="mt-8 border-t pt-6">
            <h4 class="text-xl font-bold mb-4">Filtrar ${activeCategory}</h4>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2">Buscar (Nombre, Código...)</label>
              <input id="filter-search" type="text" placeholder="Ej. Yute, Rojo, BYP-1..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal" />
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2">Tipo / Estampado</label>
              <select id="filter-subcategory" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal"></select>
            </div>
            <div class="mb-4">
              <label class="block text-gray-700 text-sm font-bold mb-2">Color disponible</label>
              <select id="filter-color" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal"></select>
            </div>
          </div>
        </div>
      </div>

      <div class="md:w-3/4">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold">${activeCategory}</h2>
          <span id="result-count" class="text-lg text-gray-500"></span>
        </div>
        <div id="product-grid"></div>
      </div>
    </div>
  `;
}

function renderGrid(gridEl, countEl, products) {
  countEl.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
  if (products.length === 0) {
    gridEl.innerHTML = `
      <div class="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <i class="fa-regular fa-face-frown-open text-6xl text-gray-300 mb-4"></i>
        <p class="text-xl text-gray-500">No encontramos productos en esta categoría.</p>
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
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-400">Cargando...</div>`;

  const activeCategory = categoryName || "Todos";
  const [{ categories }, { products: categoryProducts }] = await Promise.all([
    api.getCategories(),
    api.getProducts(activeCategory === "Todos" ? {} : { category: activeCategory }),
  ]);
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
  const gridEl = container.querySelector("#product-grid");
  const countEl = container.querySelector("#result-count");

  const availableSubcategories = ["Todas", ...new Set(categoryProducts.map((p) => p.subcategory))];
  const availableColors = ["Todos", ...new Set(categoryProducts.flatMap((p) => p.variants.map((v) => v.color)))];

  subcategorySelect.innerHTML = availableSubcategories.map((s) => `<option value="${s}">${s}</option>`).join("");
  colorSelect.innerHTML = availableColors.map((c) => `<option value="${c}">${c}</option>`).join("");

  function refresh() {
    const filtered = applyFilters(categoryProducts, {
      search: searchInput.value,
      subcategory: subcategorySelect.value,
      color: colorSelect.value,
    });
    renderGrid(gridEl, countEl, filtered);
  }

  searchInput.addEventListener("input", refresh);
  subcategorySelect.addEventListener("change", refresh);
  colorSelect.addEventListener("change", refresh);

  refresh();
}
