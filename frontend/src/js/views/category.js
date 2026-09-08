import { api } from "../api.js";
import { productCardHtml, findLoteriaVariantImage } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { currentRenderToken } from "../router.js";
import { getCategories } from "../catalogCache.js";

const SPECIAL_CATEGORIES = { Ofertas: "Ofertas", Paquetes: "Paquetes Emprendedores", Nuevos: "Nuevos Productos", Loteria: "Colección Fiesta Mexicana" };

// Subcategorías vigentes por categoría (Bolsas/Mochilas admiten Tricombo, el resto no).
// Para categorías fuera de este mapa (p. ej. "Todos") se derivan de los productos cargados.
const SUBCATEGORY_OPTIONS_BY_CATEGORY = {
  Bolsas: ["Estampado animado", "Estampado en yute", "Tricombo"],
  Mochilas: ["Estampado animado", "Estampado en yute", "Tricombo"],
  Carteras: ["Estampado animado", "Estampado en yute"],
  Cosmetiqueras: ["Estampado animado", "Estampado en yute"],
  Monederos: ["Estampado animado", "Estampado en yute"],
  "Porta Celular": ["Estampado animado", "Estampado en yute"],
};

function categoryIconClass(name) {
  const key = name.toLowerCase();
  if (key.includes("mochila")) return "fa-bag-shopping";
  if (key.includes("cartera")) return "fa-wallet";
  if (key.includes("cosmetiquera")) return "fa-spray-can";
  if (key.includes("monedero")) return "fa-coins";
  if (key.includes("porta") && key.includes("celular")) return "fa-mobile-screen-button";
  return "fa-bag-shopping";
}

function getBaseColor(colorName) {
  if (!colorName) return "";
  let name = colorName.trim().toLowerCase();
  
  const colorMap = {
    "amarillo": "Amarillo",
    "azul cielo": "Azul Cielo",
    "azul marino": "Azul Marino",
    "azul rey": "Azul Rey",
    "azul": "Azul",
    "blanco": "Blanco",
    "café": "Café",
    "cafe": "Café",
    "gris": "Gris",
    "naranja": "Naranja",
    "negro": "Negro",
    "rojo": "Rojo",
    "rosa pastel": "Rosa Pastel",
    "rosa": "Rosa",
    "verde": "Verde",
    "morado": "Morado",
    "lila": "Lila",
    "vino": "Vino",
    "beige": "Beige",
    "fiusha": "Fiusha",
    "fucsia": "Fiusha",
    "menta": "Menta",
    "mostaza": "Mostaza",
    "turquesa": "Turquesa",
    "multicolor": "Multicolor"
  };
  
  for (const key of Object.keys(colorMap).sort((a, b) => b.length - a.length)) {
    if (name.includes(key)) return colorMap[key];
  }
  
  const firstWord = name.split(" ")[0];
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

function applyFilters(products, { search, subcategory, color, maxPrice }) {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  
  return products.filter((p) => {
    const matchesSubcategory = subcategory === "Todas" || p.subcategory === subcategory;
    const matchesColor = color === "Todos" || p.variants.some((v) => getBaseColor(v.color) === color);
    const matchesPrice = maxPrice == null || Number(p.price_normal) <= maxPrice;
    
    const matchesSearch = words.length === 0 || words.every((word) => {
      return p.name.toLowerCase().includes(word) ||
             p.category.toLowerCase().includes(word) ||
             p.subcategory.toLowerCase().includes(word) ||
             (p.description && p.description.toLowerCase().includes(word)) ||
             p.variants.some((v) => (v.sku || "").toLowerCase().includes(word) || (v.color || "").toLowerCase().includes(word));
    });
    
    return matchesSubcategory && matchesColor && matchesPrice && matchesSearch;
  });
}

function categoryShell(categories, activeCategory) {
  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      
      <!-- Iconos de Categoría (Carrusel Horizontal) -->
      <div class="mb-8 overflow-x-auto pb-4 hide-scrollbar">
        <div class="flex gap-4 min-w-max">
          <div data-nav="/categoria/Todos" class="w-24 h-24 bg-white border ${activeCategory === "Todos" ? 'border-brand-pink shadow-md' : 'border-gray-100 hover:border-gray-200'} rounded-2xl flex flex-col items-center justify-center p-2 cursor-pointer transition-all flex-shrink-0 group">
            <div class="w-10 h-10 rounded-full ${activeCategory === "Todos" ? 'bg-brand-pink' : 'bg-brand-pink-light/30'} flex items-center justify-center mb-2 transition-colors">
              <i class="fa-solid fa-border-all ${activeCategory === "Todos" ? 'text-white' : 'text-brand-mexican'}"></i>
            </div>
            <span class="font-display font-bold text-[10px] text-center uppercase tracking-widest ${activeCategory === "Todos" ? 'text-brand-pink' : 'text-gray-800'}">Todos</span>
          </div>
          ${categories.map(cat => `
            <div data-nav="/categoria/${encodeURIComponent(cat.name)}" class="w-24 h-24 bg-white border ${activeCategory === cat.name ? 'border-brand-pink shadow-md' : 'border-gray-100 hover:border-gray-200'} rounded-2xl flex flex-col items-center justify-center p-2 cursor-pointer transition-all flex-shrink-0 group">
              <div class="w-10 h-10 rounded-full ${activeCategory === cat.name ? 'bg-brand-pink' : 'bg-brand-pink-light/30'} flex items-center justify-center mb-2 transition-colors">
                <i class="fa-solid ${categoryIconClass(cat.name)} ${activeCategory === cat.name ? 'text-white' : 'text-brand-mexican'}"></i>
              </div>
              <span class="font-display font-bold text-[10px] text-center uppercase tracking-widest ${activeCategory === cat.name ? 'text-brand-pink' : 'text-gray-800'}">${cat.name}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <div class="w-full lg:w-64 flex-shrink-0">
          <button id="toggle-filters-btn" class="lg:hidden w-full mb-4 bg-white border border-gray-200 py-3 rounded-lg font-semibold text-gray-700 flex justify-center items-center gap-2 shadow-sm">
            <i class="fa-solid fa-sliders"></i> Mostrar Filtros
          </button>
          <div id="filters-container" class="hidden lg:block border border-gray-200 rounded-lg p-6 bg-white lg:sticky lg:top-28">
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

function renderGrid(gridEl, countEl, products, activeCategory, selectedColor = "Todos", searchTerm = "") {
  countEl.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
  if (products.length === 0) {
    gridEl.innerHTML = `
      <div class="text-center py-20 bg-gray-50 rounded-lg border border-gray-200">
        <i class="fa-solid fa-box-open text-4xl text-gray-300 mb-3"></i>
        <p class="text-gray-500">No encontramos productos en esta categoría.</p>
      </div>`;
  } else {
    const searchWords = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
    
    gridEl.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      ${products.map((p) => {
        let customImage = null;
        if (selectedColor !== "Todos") {
          const matchingVar = p.variants.find(v => getBaseColor(v.color) === selectedColor);
          if (matchingVar && matchingVar.image_url) customImage = matchingVar.image_url;
        } else if (searchWords.length > 0) {
          let bestVar = null;
          let bestScore = 0;
          p.variants.forEach(v => {
            const vColor = (v.color || "").toLowerCase();
            let score = 0;
            searchWords.forEach(w => { if (vColor.includes(w)) score++; });
            if (score > bestScore) {
              bestScore = score;
              bestVar = v;
            }
          });
          if (bestVar && bestVar.image_url) customImage = bestVar.image_url;
          else if (activeCategory === "Loteria") customImage = findLoteriaVariantImage(p);
        } else if (activeCategory === "Loteria") {
          customImage = findLoteriaVariantImage(p);
        }
        return productCardHtml(p, customImage);
      }).join("")}
    </div>`;
  }
  bindNavLinks(gridEl);
}

export async function renderCategory(container, categoryName, query = null) {
  const token = currentRenderToken();
  const activeCategory = categoryName || "Todos";

  // Las categorías ya están precargadas (o casi) desde el arranque de la app, así que
  // esto normalmente resuelve al instante: la barra lateral y los filtros aparecen sin
  // pantalla de "Cargando...". Solo la grilla de productos (que sí cambia por categoría)
  // muestra su propio estado de carga, mucho más breve y localizado.
  const { categories } = await getCategories();
  if (token !== currentRenderToken()) return;

  container.innerHTML = categoryShell(categories, activeCategory);
  bindNavLinks(container);

  container.querySelectorAll(".cat-link").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.hash = `/categoria/${encodeURIComponent(el.dataset.cat)}`;
    });
  });

  const toggleFiltersBtn = container.querySelector("#toggle-filters-btn");
  const filtersContainer = container.querySelector("#filters-container");
  if (toggleFiltersBtn) {
    toggleFiltersBtn.addEventListener("click", () => {
      filtersContainer.classList.toggle("hidden");
      const isHidden = filtersContainer.classList.contains("hidden");
      toggleFiltersBtn.innerHTML = isHidden 
        ? '<i class="fa-solid fa-sliders"></i> Mostrar Filtros'
        : '<i class="fa-solid fa-times"></i> Ocultar Filtros';
    });
  }

  const searchInput = container.querySelector("#filter-search");
  if (query && query.get("q")) {
    searchInput.value = query.get("q");
  }
  const subcategorySelect = container.querySelector("#filter-subcategory");
  const colorSelect = container.querySelector("#filter-color");
  const priceInput = container.querySelector("#filter-price");
  const priceValueLabel = container.querySelector("#filter-price-value");
  const gridEl = container.querySelector("#product-grid");
  const countEl = container.querySelector("#result-count");

  let categoryProducts;
  if (activeCategory === "Ofertas") {
    ({ products: categoryProducts } = await api.getProducts({ on_sale: "true" }));
  } else if (activeCategory === "Paquetes") {
    ({ products: categoryProducts } = await api.getProducts({ is_bundle: "true" }));
  } else if (activeCategory === "Nuevos") {
    const { products } = await api.getProducts({ is_bundle: "false" });
    categoryProducts = [...products]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 24);
  } else if (activeCategory === "Loteria") {
    const [p1, p2, p3] = await Promise.all([
      api.getProducts({ search: "loteria" }),
      api.getProducts({ search: "lotería" }),
      api.getProducts({ search: "patrio" }),
    ]);
    const loteriaMap = new Map();
    [...p1.products, ...p2.products, ...p3.products].forEach((p) => loteriaMap.set(p.id, p));
    categoryProducts = Array.from(loteriaMap.values());
  } else {
    ({ products: categoryProducts } = await api.getProducts(
      activeCategory === "Todos" ? {} : { category: activeCategory }
    ));
  }
  if (token !== currentRenderToken()) return;

  const availableSubcategories = [
    "Todas",
    ...(SUBCATEGORY_OPTIONS_BY_CATEGORY[activeCategory] || [...new Set(categoryProducts.map((p) => p.subcategory))]),
  ];
  
  const rawColors = new Set(
    categoryProducts.flatMap((p) =>
      p.variants
        .filter((v) => v.stock > 0 && v.color) // Solo variantes con stock y color definido
        .map((v) => getBaseColor(v.color))
    )
  );
  const availableColors = ["Todos", ...Array.from(rawColors).sort((a, b) => a.localeCompare(b))];

  subcategorySelect.innerHTML = availableSubcategories.map((s) => `<option value="${s}">${s}</option>`).join("");
  colorSelect.innerHTML = availableColors.map((c) => `<option value="${c}">${c}</option>`).join("");

  const highestPrice = categoryProducts.reduce((max, p) => Math.max(max, Number(p.price_normal)), 0);
  const priceCeiling = Math.max(Math.ceil(highestPrice / 50) * 50, 50);
  priceInput.max = priceCeiling;
  priceInput.value = priceCeiling;
  priceValueLabel.textContent = `$${priceCeiling}`;

  function refresh() {
    const selectedColor = colorSelect.value;
    const term = searchInput.value;
    const filtered = applyFilters(categoryProducts, {
      search: term,
      subcategory: subcategorySelect.value,
      color: selectedColor,
      maxPrice: Number(priceInput.value),
    });
    renderGrid(gridEl, countEl, filtered, activeCategory, selectedColor, term);
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
