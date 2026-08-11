import { api } from "../api.js";
import { addToCart, state as appState, combinedNonBundleQty } from "../state.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { navigate, currentRenderToken } from "../router.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

function pricingTiersHtml(product, totalProposedQty) {
  const tierClass = (active) => (active ? "bg-white border-brand-pink border-2" : "border border-gray-200");
  return `
    <div class="bg-brand-peach-light bg-opacity-40 rounded-lg p-6 mb-8 border border-gray-200">
      <h3 class="font-bold text-lg mb-1 text-center text-gray-900">Niveles de Precio</h3>
      <p class="text-xs text-gray-500 text-center mb-4">Se calculan sumando todos los productos normales en tu carrito (mix &amp; match)</p>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="p-3 rounded ${tierClass(totalProposedQty < product.wholesale_min_qty)}">
          <p class="text-xs text-gray-500">Menudeo</p>
          <p class="text-sm font-bold">1-${product.wholesale_min_qty - 1} pz</p>
          <p class="text-xl text-gray-900 font-bold">$${product.price_normal}</p>
        </div>
        <div class="p-3 rounded ${tierClass(
          totalProposedQty >= product.wholesale_min_qty && totalProposedQty < product.super_wholesale_min_qty
        )}">
          <p class="text-xs text-gray-500">Mayoreo</p>
          <p class="text-sm font-bold">${product.wholesale_min_qty}-${product.super_wholesale_min_qty - 1} pz</p>
          <p class="text-xl text-gray-900 font-bold">$${product.price_wholesale}</p>
        </div>
        <div class="p-3 rounded ${tierClass(totalProposedQty >= product.super_wholesale_min_qty)}">
          <p class="text-xs text-gray-500">Súper Mayoreo</p>
          <p class="text-sm font-bold">${product.super_wholesale_min_qty}+ pz</p>
          <p class="text-xl text-gray-900 font-bold">$${product.price_super_wholesale}</p>
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
    // La elegibilidad se calcula por "categoría de paquete" (subcategory del propio
    // paquete): yute/animado 3D solo admiten esa subcategoría; Mixto admite cualquiera.
    const filters = { is_bundle: "false" };
    if (product.subcategory !== "Mixto") filters.subcategory = product.subcategory;
    const { products: allProducts } = await api.getProducts(filters);
    eligibleBundleProducts = allProducts;
  }

  if (token !== currentRenderToken()) return;

  const view = {
    selectedVariant: product.variants.find((v) => v.stock > 0) || product.variants[0],
    quantity: 1,
    bundleMode: "surtido", // 'surtido' | 'personalizado'
    customSelections: {}, // variantId -> qty
    expandedProducts: new Set(), // ids de modelos con el acordeón abierto
  };

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
    const totalProposedQty = combinedNonBundleQty() + view.quantity;

    container.innerHTML = `
      <div class="max-w-6xl mx-auto px-4 py-8 fade-in">
        <button id="back-btn" class="text-sm font-semibold text-gray-500 hover:text-gray-900 mb-6 flex items-center gap-2">
          <i class="fa-solid fa-arrow-left"></i> Volver al catálogo
        </button>

        <div class="flex flex-col md:flex-row gap-12">
          <div class="w-full md:w-1/2">
            <div class="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 aspect-square relative mb-4">
              <img src="${view.selectedVariant.image_url || NO_IMAGE_PLACEHOLDER}" alt="${product.name}" class="w-full h-full object-cover" />
              ${
                view.selectedVariant.stock === 0
                  ? `<div class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
                      <span class="bg-gray-800 text-white font-bold py-2 px-6 rounded text-sm">AGOTADO</span>
                    </div>`
                  : ""
              }
            </div>
            ${
              !product.is_bundle
                ? `<div class="grid grid-cols-4 gap-2">
                    ${product.variants
                      .map(
                        (v) => `
                      <button data-variant="${v.id}" class="variant-swatch relative rounded overflow-hidden border-2 aspect-square ${
                          v.id === view.selectedVariant.id ? "border-gray-900" : "border-transparent opacity-60 hover:opacity-100"
                        }" title="${v.color} (${v.stock} disp.)">
                        <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-full h-full object-cover" />
                        ${v.stock === 0 ? `<div class="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center"><i class="fa-solid fa-ban text-red-500"></i></div>` : ""}
                      </button>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </div>

          <div class="w-full md:w-1/2 flex flex-col">
            <nav class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              ${product.category} / ${product.subcategory}
            </nav>
            <h1 class="text-3xl font-bold text-gray-900 mb-4">${product.name}</h1>
            <p class="text-gray-600 mb-8 leading-relaxed">${product.description || ""}</p>

            ${
              product.is_bundle
                ? bundleSectionHtml()
                : `
              ${pricingTiersHtml(product, totalProposedQty)}
              <div class="flex items-center gap-4 mb-6">
                <label class="font-bold text-sm text-gray-900">Cantidad:</label>
                <div class="flex items-center border border-gray-300 rounded h-12">
                  <button id="qty-minus" class="px-4 text-gray-500 hover:text-gray-900"><i class="fa-solid fa-minus text-xs"></i></button>
                  <span id="qty-value" class="px-4 font-semibold w-12 text-center">${view.quantity}</span>
                  <button id="qty-plus" class="px-4 text-gray-500 hover:text-gray-900"><i class="fa-solid fa-plus text-xs"></i></button>
                </div>
                <span class="text-sm text-gray-500">${view.selectedVariant.stock} disponibles</span>
              </div>
              <button id="add-to-cart" ${view.selectedVariant.stock === 0 ? "disabled" : ""}
                class="bg-gray-900 hover:bg-brand-mexican disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold h-12 rounded transition-colors">
                <i class="fa-solid fa-cart-plus mr-2"></i> ${view.selectedVariant.stock === 0 ? "Agotado" : "Añadir al Carrito"}
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
      </div>
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
            ? `<div class="p-4 border-t border-gray-100 bg-gray-50 space-y-3">
                ${
                  inStockVariants.length === 0
                    ? `<p class="text-sm text-gray-400">Sin stock disponible en este modelo.</p>`
                    : inStockVariants
                        .map((v) => {
                          const qty = view.customSelections[v.id] || 0;
                          return `
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-8 h-8 border rounded object-cover" />
                            <span class="text-sm text-gray-600">${v.color} <span class="text-xs">(${v.stock})</span></span>
                          </div>
                          <div class="flex items-center bg-white border border-gray-200 rounded overflow-hidden">
                            <button data-bundle-minus="${v.id}" class="px-2 py-1 bg-gray-100 hover:bg-gray-200"><i class="fa-solid fa-minus text-xs"></i></button>
                            <span class="px-3 text-sm font-bold w-8 text-center">${qty}</span>
                            <button data-bundle-plus="${v.id}" data-max="${v.stock}" data-category="${ep.category}" class="px-2 py-1 bg-gray-100 hover:bg-gray-200"><i class="fa-solid fa-plus text-xs"></i></button>
                          </div>
                        </div>`;
                        })
                        .join("")
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
        ${Object.entries(product.bundle_category_limits)
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
                ${
                  productsInCategory.length
                    ? productsInCategory.map((ep) => productAccordionItemHtml(ep)).join("")
                    : `<p class="text-sm text-gray-400">No hay modelos elegibles configurados en esta categoría.</p>`
                }
              </div>
            </div>`;
          })
          .join("")}
      </div>
    `;
  }

  function flatSelectionListHtml() {
    const limit = product.bundle_limit;
    const total = customTotal();
    return `
      <div class="mb-4 flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-3">
        <span class="font-bold text-sm text-gray-900">Piezas seleccionadas</span>
        <span class="text-lg font-bold ${total === limit ? "text-brand-mexican" : "text-gray-400"}">${total} / ${limit}</span>
      </div>
      <div class="max-h-96 overflow-y-auto space-y-3 mb-6 pr-1">
        ${eligibleBundleProducts.map((ep) => productAccordionItemHtml(ep)).join("")}
      </div>
    `;
  }

  function bundleSectionHtml() {
    const hasCategoryLimits =
      product.bundle_category_limits && Object.keys(product.bundle_category_limits).length > 0;

    return `
      <div class="bg-brand-peach-light bg-opacity-40 rounded-lg p-6 mb-6 border border-gray-200 text-center">
        <p class="text-sm text-gray-500">Precio fijo del paquete</p>
        <p class="text-3xl font-bold text-gray-900">$${product.price_normal}</p>
        <p class="text-gray-600 mt-1">Incluye <strong>${product.bundle_limit}</strong> piezas a elegir</p>
      </div>

      <div class="flex gap-3 mb-6">
        <button data-mode="surtido" class="mode-btn flex-1 py-3 rounded font-semibold border-2 ${
          view.bundleMode === "surtido" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
        }">Surtido al Azar</button>
        <button data-mode="personalizado" class="mode-btn flex-1 py-3 rounded font-semibold border-2 ${
          view.bundleMode === "personalizado" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
        }">Elegir mis diseños</button>
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
        view.quantity = 1;
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
        if (view.bundleMode === "personalizado") {
          if (product.bundle_category_limits && Object.keys(product.bundle_category_limits).length) {
            const totals = categoryTotals();
            const pending = Object.entries(product.bundle_category_limits)
              .filter(([category, limit]) => (totals[category] || 0) !== limit)
              .map(([category, limit]) => `${category}: ${totals[category] || 0}/${limit}`);
            if (pending.length) {
              alert(`Completa exactamente las piezas requeridas por categoría:\n${pending.join("\n")}`);
              return;
            }
          } else if (customTotal() !== product.bundle_limit) {
            alert(`Debes seleccionar exactamente ${product.bundle_limit} piezas para completar este paquete.`);
            return;
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
            color: `Personalizado: ${desc}`,
            sku: `${product.variants[0].sku}-CUST`,
            stock: 9999,
            image_url: product.variants[0].image_url,
            isCustom: true,
            selections: { ...view.customSelections },
          };
          addToCart(product, customVariant, 1);
        } else {
          addToCart(product, product.variants[0], 1);
        }
        view.customSelections = {};
        view.bundleMode = "surtido";
        navigate("/carrito");
      });
    }
  }

  render();
}
