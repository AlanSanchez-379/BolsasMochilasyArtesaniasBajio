import { api } from "../api.js";
import { addToCart, combinedQtyForProductLine } from "../state.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { navigate, currentRenderToken } from "../router.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(n) {
  return currencyFormatter.format(n);
}

function pricingTiersHtml(product, totalProposedQty) {
  const tierClass = (active) => (active ? "bg-white border-brand-pink border-2" : "border border-gray-200");
  return `
  <div class="glass border border-brand-salmon/20 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
    <div class="absolute top-0 right-0 w-32 h-32 bg-brand-salmon rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
    <h3 class="font-display font-bold text-xl mb-2 text-center text-gray-900 tracking-tight">Niveles de Precio</h3>
    <p class="text-xs text-gray-500 text-center mb-6 font-sans">Se calculan automáticamente al sumar productos en tu carrito.</p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 text-center">
      <div class="p-4 rounded-xl transition-all duration-300 ${tierClass(totalProposedQty < product.medio_min_qty)}">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">Menudeo</p>
        <p class="text-[10px] font-bold text-gray-400 mb-2">${product.medio_min_qty > 1 ? `1-${product.medio_min_qty - 1} pz` : '1 pz'}</p>
        ${
          product.is_on_sale
            ? `<p class="text-[10px] text-gray-400 line-through">${money(product.price_normal)}</p>
                 <p class="text-xl md:text-2xl text-red-500 font-bold">${money(product.sale_price)}</p>`
            : `<p class="text-xl md:text-2xl text-gray-900 font-bold">${money(product.price_normal)}</p>`
        }
      </div>
      <div class="p-4 rounded-xl transition-all duration-300 ${tierClass(
          totalProposedQty >= product.medio_min_qty && totalProposedQty < product.wholesale_min_qty
        )}">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">Medio</p>
        <p class="text-[10px] font-bold text-gray-400 mb-2">${product.medio_min_qty}-${product.wholesale_min_qty - 1} pz</p>
        <p class="text-xl md:text-2xl text-gray-900 font-bold">${money(product.price_medio)}</p>
      </div>
      <div class="p-4 rounded-xl transition-all duration-300 ${tierClass(
          totalProposedQty >= product.wholesale_min_qty && totalProposedQty < product.super_wholesale_min_qty
        )}">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">Mayoreo</p>
        <p class="text-[10px] font-bold text-gray-400 mb-2">${product.wholesale_min_qty}-${product.super_wholesale_min_qty - 1} pz</p>
        <p class="text-xl md:text-2xl text-gray-900 font-bold">${money(product.price_wholesale)}</p>
      </div>
      <div class="p-4 rounded-xl transition-all duration-300 ${tierClass(totalProposedQty >= product.super_wholesale_min_qty)}">
        <p class="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">Súper</p>
        <p class="text-[10px] font-bold text-gray-400 mb-2">${product.super_wholesale_min_qty}+ pz</p>
        <p class="text-xl md:text-2xl text-brand-salmon font-bold">${money(product.price_super_wholesale)}</p>
      </div>
    </div>
  </div>
  `;
}

export async function renderProductDetail(container, slug) {
  const token = currentRenderToken();
  container.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-400">Cargando...</div>`;

  let product;
  try {
    ({ product } = await api.getProduct(slug));
  } catch {
    if (token !== currentRenderToken()) return;
    container.innerHTML = `<p class="max-w-7xl mx-auto px-4 py-20 text-center text-xl text-gray-500">Producto no encontrado.</p>`;
    return;
  }

  const { products: categoryProducts } = await api.getProducts({ category: product.category });
  const relatedProducts = categoryProducts.filter((p) => p.id !== product.id).slice(0, 4);

  let eligibleBundleProducts = [];
  if (product.is_bundle) {
    const { products: allProducts } = await api.getProducts({ is_bundle: "false", include_exclusive: "true" });
    const eligibleProductIds = product.bundle_eligible_products?.length ? new Set(product.bundle_eligible_products) : null;
    eligibleBundleProducts = allProducts.filter((p) => {
      // Must be explicitly selected if it has a print_type/etc. Since we removed subcategory logic,
      // eligible products are purely based on the explicit selection in `bundle_eligible_products`.
      if (eligibleProductIds && !eligibleProductIds.has(p.id)) return false;
      if (p.is_bundle_exclusive && (!eligibleProductIds || !eligibleProductIds.has(p.id))) return false;
      return true;
    });
  }

  if (token !== currentRenderToken()) return;

  const view = {
    selectedVariant: product.variants.find((v) => v.stock > 0) || product.variants[0],
    selectedImageIndex: 0,
    quantity: 1,
    bundleMode: "surtido", // 'surtido' | 'personalizado'
    customSelections: {}, // variantId -> qty
    fixedSelections: {}, // variantId -> qty (paquete de contenido fijo)
    expandedProducts: new Set(), // ids de modelos con el acordeón abierto
  };

  function fixedSelectedQtyForProduct(productId) {
    return 0; // Removed fixed items logic
  }

  function customTotal() {
    return Object.values(view.customSelections).reduce((sum, q) => sum + q, 0);
  }

  function variantOwner(variantId) {
    return eligibleBundleProducts.find((p) => p.variants.some((v) => v.id === variantId));
  }

  function categoryTotals() {
    const totals = {};
    for (const [variantId, qty] of Object.entries(view.customSelections)) {
      if (!qty) continue;
      const owner = variantOwner(variantId);
      if (!owner) continue;
      totals[owner.category] = (totals[owner.category] || 0) + qty;
    }
    return totals;
  }

  function render() {
    const totalProposedQty = combinedQtyForProductLine(product) + view.quantity;

    container.innerHTML = `
    <div class="animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button id="back-btn" class="text-sm font-semibold text-gray-500 hover:text-brand-mexican mb-8 flex items-center gap-2 transition-colors">
          <i class="fa-solid fa-arrow-left"></i> Volver al catálogo
        </button>

        <div class="flex flex-col lg:flex-row gap-12 lg:gap-16">
          <div class="w-full lg:w-1/2">
            <div class="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50 aspect-square relative mb-4 shadow-sm">
              <img src="${view.selectedVariant.image_urls?.[view.selectedImageIndex] || view.selectedVariant.image_url || NO_IMAGE_PLACEHOLDER}" alt="${product.name}" class="w-full h-full object-cover" />
              ${
                view.selectedVariant.stock === 0
                  ? `<div class="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10">
                      <span class="bg-gray-900 text-white font-bold py-2 px-8 rounded-full text-sm tracking-widest shadow-lg">AGOTADO</span>
                    </div>`
                  : ""
              }
            </div>
            
            ${
              view.selectedVariant.image_urls && view.selectedVariant.image_urls.length > 1
                ? `<div class="flex gap-3 mb-6 overflow-x-auto pb-2">
                    ${view.selectedVariant.image_urls.map((url, idx) => `
                      <button data-img-index="${idx}" class="carousel-thumb relative rounded-lg overflow-hidden border-2 aspect-square w-20 flex-shrink-0 transition-all ${idx === view.selectedImageIndex ? "border-brand-mexican shadow-md" : "border-transparent opacity-60 hover:opacity-100"}">
                        <img src="${url}" class="w-full h-full object-cover" />
                      </button>
                    `).join("")}
                   </div>`
                : `<div class="mb-6"></div>`
            }
            ${
              !product.is_bundle
                ? `<div class="grid grid-cols-5 gap-3">
                    ${product.variants
                      .map(
                        (v) => `
                      <button data-variant="${v.id}" class="variant-swatch relative rounded-xl overflow-hidden border-2 aspect-square transition-all duration-200 ${
                          v.id === view.selectedVariant.id ? "border-brand-mexican shadow-md scale-105" : "border-transparent opacity-70 hover:opacity-100 hover:scale-105"
                        }" title="${v.color} (${v.stock} disp.)">
                        <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-full h-full object-cover" />
                        ${v.stock === 0 ? `<div class="absolute inset-0 bg-white/60 flex items-center justify-center"><i class="fa-solid fa-ban text-red-500"></i></div>` : ""}
                      </button>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </div>

          <div class="w-full lg:w-1/2 flex flex-col">
            <nav class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 font-sans">
              ${product.category} <span class="mx-2 text-gray-300">/</span> ${product.subcategory}
            </nav>
            <h1 class="text-3xl md:text-5xl font-display font-bold text-gray-900 mb-6 tracking-tight leading-tight">
              ${product.name}
              ${product.is_on_sale ? '<span class="ml-3 align-middle bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm tracking-widest uppercase">Oferta</span>' : ""}
            </h1>
            <p class="text-gray-600 mb-10 leading-relaxed font-sans text-lg">${product.description || ""}</p>

            ${
              product.is_bundle
                ? bundleSectionHtml()
                : `
              ${pricingTiersHtml(product, totalProposedQty)}
              <div class="flex items-center gap-6 mb-8">
                <label class="font-bold text-sm text-gray-900 uppercase tracking-widest">Cantidad:</label>
                <div class="flex items-center border-2 border-gray-200 rounded-full h-14 bg-white shadow-sm overflow-hidden w-40">
                  <button id="qty-minus" class="px-5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"><i class="fa-solid fa-minus text-xs"></i></button>
                  <span id="qty-value" class="flex-1 font-bold text-lg text-center">${view.quantity}</span>
                  <button id="qty-plus" class="px-5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"><i class="fa-solid fa-plus text-xs"></i></button>
                </div>
                <span class="text-sm text-gray-500 font-medium">${view.selectedVariant.stock} disponibles</span>
              </div>
              <button id="add-to-cart" ${view.selectedVariant.stock === 0 ? "disabled" : ""}
                class="bg-gray-900 hover:bg-brand-mexican disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold h-16 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 w-full md:w-auto md:px-12 text-lg tracking-wide">
                <i class="fa-solid fa-cart-plus mr-3"></i> ${view.selectedVariant.stock === 0 ? "AGOTADO" : "AÑADIR AL CARRITO"}
              </button>
            `
            }
          </div>
        </div>

        ${
    relatedProducts.length
      ? `
          <div class="mt-24 border-t border-gray-100 pt-12">
            <h2 class="text-2xl font-bold mb-8 text-center text-gray-900">También te podría interesar</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
              ${relatedProducts.map((p) => productCardHtml(p)).join("")}
            </div>
          </div>`
      : ""
  }
      </div >
    `;

    bindEvents();
  }

  function productAccordionItemHtml(ep) {
    const expanded = view.expandedProducts.has(ep.id);
    const inStockVariants = ep.variants.filter((v) => v.stock > 0);
    return `
    <div class="border border-gray-200 rounded overflow-hidden bg-white">
      <button data-toggle-product="${ep.id}" class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left text-sm">
        <span class="font-semibold text-gray-800">${ep.name}</span>
        <i class="fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} text-gray-400"></i>
      </button>
    ${
    expanded
      ? `<div class="p-4 border-t border-gray-100 bg-gray-50">
                ${inStockVariants.length === 0
        ? `<p class="text-sm text-gray-400">Sin stock disponible en este modelo.</p>`
        : `<div class="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                        ${inStockVariants
          .map((v) => {
            const qty = view.customSelections[v.id] || 0;
            return `
                          <div class="border border-gray-200 rounded-lg p-2 flex flex-col items-center text-center bg-white">
                            <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-full aspect-square rounded object-cover border border-gray-100 mb-1 bg-gray-50" />
                            <span class="text-xs text-gray-600 line-clamp-1 w-full">${v.color}</span>
                            <span class="text-[10px] text-gray-400 mb-1">stock ${v.stock}</span>
                            <div class="flex items-center bg-gray-50 border border-gray-200 rounded overflow-hidden">
                              <button data-bundle-minus="${v.id}" class="px-1.5 py-1 bg-gray-100 hover:bg-gray-200"><i class="fa-solid fa-minus text-[10px]"></i></button>
                              <span class="px-2 text-xs font-bold w-6 text-center">${qty}</span>
                              <button data-bundle-plus="${v.id}" data-max="${v.stock}" data-category="${ep.category}" class="px-1.5 py-1 bg-gray-100 hover:bg-gray-200"><i class="fa-solid fa-plus text-[10px]"></i></button>
                            </div>
                          </div>`;
          })
          .join("")}
                      </div>`
      }
              </div>`
      : ""
  }
      </div>
    `;
  }

  function categoryAccordionHtml() {
    const totals = categoryTotals();
    const productsByCategory = eligibleBundleProducts.reduce((acc, p) => {
      (acc[p.category] ||= []).push(p);
      return acc;
    }, {});

    return `
    <div class="space-y-5 mb-6">
      ${
    Object.entries(product.bundle_category_limits)
      .map(([categoryName, categoryLimit]) => {
        const categoryTotal = totals[categoryName] || 0;
        const productsInCategory = productsByCategory[categoryName] || [];
        return `
            <div>
              <div class="flex justify-between items-center mb-2">
                <h4 class="font-bold text-sm text-gray-900">${categoryName}</h4>
                <span class="font-bold text-sm ${categoryTotal === categoryLimit ? "text-brand-mexican" : "text-gray-400"}">${categoryTotal} / ${categoryLimit}</span>
              </div>
              <div class="space-y-2">
                ${productsInCategory.length
            ? productsInCategory.map((ep) => productAccordionItemHtml(ep)).join("")
            : `<p class="text-sm text-gray-400">No hay modelos elegibles configurados en esta categoría.</p>`
          }
              </div>
            </div>`;
      })
      .join("")
  }
      </div>
    `;
  }

  function flatSelectionListHtml() {
    const limit = product.bundle_limit;
    const total = customTotal();
    return `
    <div class="mb-4 flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-3">
        <span class="font-bold text-sm text-gray-900">Piezas seleccionadas</span>
        <span class="text-lg font-bold ${total === limit ? "text-brand-mexican" : "text-gray-400"}"> ${total} / ${limit}</span>
      </div>
    <div class="max-h-96 overflow-y-auto space-y-3 mb-6 pr-1">
      ${eligibleBundleProducts.map((ep) => productAccordionItemHtml(ep)).join("")}
    </div>
  `;
  }

  function bundleFixedContentHtml() {
    return ""; // Removed
  }

  function bundleSectionHtml() {
    if (product.bundle_fixed_items?.length) {
      return `
    <div class="bg-brand-peach-light bg-opacity-40 rounded-lg p-6 mb-6 border border-gray-200 text-center">
          <p class="text-sm text-gray-500">Precio fijo del paquete</p>
          <p class="text-3xl font-bold text-gray-900">${money(product.price_normal)}</p>
        </div>
    ${ bundleFixedContentHtml() }
  `;
    }

    const hasCategoryLimits =
      product.bundle_category_limits && Object.keys(product.bundle_category_limits).length > 0;

    return `
    <div class="bg-brand-peach-light bg-opacity-40 rounded-lg p-6 mb-6 border border-gray-200 text-center">
        <p class="text-sm text-gray-500">Precio fijo del paquete</p>
        <p class="text-3xl font-bold text-gray-900">${money(product.price_normal)}</p>
        <p class="text-gray-600 mt-1">Incluye <strong>${product.bundle_limit || "-"}</strong> piezas a elegir</p>
      </div>

      <div class="flex gap-3 mb-6">
        <button data-mode="surtido" class="mode-btn flex-1 py-3 rounded font-semibold border-2 ${
          view.bundleMode === "surtido" ? "bg-brand-mexican bg-opacity-10 text-brand-mexican border-brand-mexican" : "border-gray-300 text-gray-600 hover:border-gray-400"
        }">Al azar</button>
        <button data-mode="personalizado" class="mode-btn flex-1 py-3 rounded font-semibold border-2 ${
          view.bundleMode === "personalizado" ? "bg-brand-mexican bg-opacity-10 text-brand-mexican border-brand-mexican" : "border-gray-300 text-gray-600 hover:border-gray-400"
        }">Elegir diseños</button>
      </div>

  ${
  view.bundleMode === "personalizado"
    ? hasCategoryLimits
      ? categoryAccordionHtml()
      : flatSelectionListHtml()
    : `<p class="text-gray-500 mb-6 text-sm"><i class="fa-solid fa-shuffle mr-2"></i>Recibirás una selección variada de nuestros modelos disponibles.</p>`
}

<button id="add-bundle-to-cart" class="bg-gray-900 hover:bg-brand-mexican text-white font-semibold h-12 rounded transition-colors mt-auto">
  <i class="fa-solid fa-cart-plus mr-2"></i> Añadir Paquete al Carrito
</button>
`;
  }

  function bindEvents() {
    bindNavLinks(container);

    container.querySelector("#back-btn").addEventListener("click", () => navigate(`/categoria/${encodeURIComponent(product.category)}`));

    container.querySelectorAll(".variant-swatch").forEach((el) => {
      el.addEventListener("click", () => {
        const variant = product.variants.find((v) => v.id === el.dataset.variant);
        if (!variant) return;
        view.selectedVariant = variant;
        view.selectedImageIndex = 0;
        view.quantity = 1;
        render();
      });
    });

    container.querySelectorAll(".carousel-thumb").forEach((el) => {
      el.addEventListener("click", () => {
        view.selectedImageIndex = parseInt(el.dataset.imgIndex);
        render();
      });
    });

    const qtyMinus = container.querySelector("#qty-minus");
    const qtyPlus = container.querySelector("#qty-plus");
    if (qtyMinus) {
      qtyMinus.addEventListener("click", () => {
        view.quantity = Math.max(1, view.quantity - 1);
        render();
      });
      qtyPlus.addEventListener("click", () => {
        view.quantity = Math.min(view.selectedVariant.stock, view.quantity + 1);
        render();
      });
    }

    const addBtn = container.querySelector("#add-to-cart");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        addToCart(product, view.selectedVariant, view.quantity);
        view.quantity = 1;
        render();
      });
    }

container.querySelectorAll(".mode-btn").forEach((el) => {
  el.addEventListener("click", () => {
    view.bundleMode = el.dataset.mode;
    render();
  });
});

container.querySelectorAll("[data-toggle-product]").forEach((el) => {
  el.addEventListener("click", () => {
    const id = el.dataset.toggleProduct;
    if (view.expandedProducts.has(id)) view.expandedProducts.delete(id);
    else view.expandedProducts.add(id);
    render();
  });
});

container.querySelectorAll("[data-bundle-plus]").forEach((el) => {
  el.addEventListener("click", () => {
    const id = el.dataset.bundlePlus;
    const max = Number(el.dataset.max);
    const current = view.customSelections[id] || 0;
    if (current >= max) return;

    if (product.bundle_category_limits && Object.keys(product.bundle_category_limits).length) {
      const category = el.dataset.category;
      const categoryLimit = product.bundle_category_limits[category] || 0;
      const categoryTotal = categoryTotals()[category] || 0;
      if (categoryTotal >= categoryLimit) return;
    } else if (customTotal() >= product.bundle_limit) {
      return;
    }

    view.customSelections[id] = current + 1;
    render();
  });
});

container.querySelectorAll("[data-bundle-minus]").forEach((el) => {
  el.addEventListener("click", () => {
    const id = el.dataset.bundleMinus;
    const current = view.customSelections[id] || 0;
    if (current <= 0) return;
    view.customSelections[id] = current - 1;
    render();
  });
});

const addBundleBtn = container.querySelector("#add-bundle-to-cart");
if (addBundleBtn) {
  addBundleBtn.addEventListener("click", () => {
    if (view.bundleMode === "surtido") {
      let selections = {};
      let currentTotal = 0;
      const catTotals = {};
      const modelLimits = product.bundle_model_limits || {};
      const mandatoryIds = product.bundle_mandatory_models || [];
      const targetLimit = product.bundle_limit || 0;
      
      for (const mId of mandatoryIds) {
        const prod = eligibleBundleProducts.find(p => p.id === mId);
        if(!prod) continue;
        const availableVariants = prod.variants.filter(v => v.stock > (selections[v.id] || 0));
        if (availableVariants.length > 0) {
           const v = availableVariants[Math.floor(Math.random() * availableVariants.length)];
           selections[v.id] = (selections[v.id] || 0) + 1;
           currentTotal++;
           catTotals[prod.category] = (catTotals[prod.category] || 0) + 1;
        }
      }

      let tries = 0;
      while(currentTotal < targetLimit && tries < 1000) {
         tries++;
         const validProducts = eligibleBundleProducts.filter(p => {
             if (product.bundle_category_limits && product.bundle_category_limits[p.category]) {
                if ((catTotals[p.category] || 0) >= product.bundle_category_limits[p.category]) return false;
             }
             if (modelLimits[p.id]) {
                const currentModelTotal = p.variants.reduce((sum, v) => sum + (selections[v.id] || 0), 0);
                if (currentModelTotal >= modelLimits[p.id]) return false;
             }
             return p.variants.some(v => v.stock > (selections[v.id] || 0));
         });
         if(validProducts.length === 0) break;
         
         const prod = validProducts[Math.floor(Math.random() * validProducts.length)];
         const availableVariants = prod.variants.filter(v => v.stock > (selections[v.id] || 0));
         const v = availableVariants[Math.floor(Math.random() * availableVariants.length)];
         
         selections[v.id] = (selections[v.id] || 0) + 1;
         currentTotal++;
         catTotals[prod.category] = (catTotals[prod.category] || 0) + 1;
      }
      
      view.customSelections = selections;
      // Continuamos abajo para construir la variante con la selección al azar
    }

    // Validar en caso personalizado (y que el azar haya llenado todo)
    if (product.bundle_category_limits && Object.keys(product.bundle_category_limits).length) {
      const totals = categoryTotals();
      const pending = Object.entries(product.bundle_category_limits)
        .filter(([category, limit]) => (totals[category] || 0) !== limit)
        .map(([category, limit]) => `${category}: ${totals[category] || 0}/${limit}`);
      if (pending.length) {
        alert(`Completa exactamente las piezas requeridas por categoría:\n${pending.join("\n")}`);
        if(view.bundleMode === "surtido") view.customSelections = {};
        return;
      }
    } else if (customTotal() !== product.bundle_limit) {
      alert(`Debes seleccionar exactamente ${product.bundle_limit} piezas para completar este paquete. Haz seleccionado ${customTotal()}.`);
      if(view.bundleMode === "surtido") view.customSelections = {};
      return;
    }

    if (view.bundleMode === "personalizado") {
      const mandatoryProducts = product.bundle_mandatory_models || [];
      const missingMandatory = mandatoryProducts.filter(productId => {
          const hasSelection = Object.entries(view.customSelections).some(([vid, qty]) => {
              if(qty <= 0) return false;
              const owner = variantOwner(vid);
              return owner && owner.id === productId;
          });
          return !hasSelection;
      });

      if (missingMandatory.length) {
          const missingNames = missingMandatory.map(id => eligibleBundleProducts.find(p => p.id === id)?.name || "Producto desconocido");
          alert(`Debes incluir al menos un modelo de los siguientes productos obligatorios:\n- ${missingNames.join("\n- ")}`);
          return;
      }
    }

    const allEligibleVariants = eligibleBundleProducts.flatMap((p) =>
      p.variants.map((v) => ({ ...v, productName: p.name }))
    );
    const desc = Object.entries(view.customSelections)
      .filter(([, q]) => q > 0)
      .map(([vid, q]) => {
        const v = allEligibleVariants.find((v) => v.id === vid);
        return `${q}x ${v.productName} (${v.color})`;
      })
      .join(", ");
      
    const customVariant = {
      id: `custom-${Date.now()}`,
      color: `${view.bundleMode === "surtido" ? "Al Azar" : "Personalizado"}: ${desc}`,
      sku: `${product.variants[0].sku}-${view.bundleMode === "surtido" ? "AZAR" : "CUST"}`,
      stock: 9999,
      image_url: product.variants[0].image_url,
      isCustom: true,
      selections: { ...view.customSelections },
    };
    addToCart(product, customVariant, 1);

    view.customSelections = {};
    view.bundleMode = "surtido";
    navigate("/carrito");
  });
}
  }

render();
}
