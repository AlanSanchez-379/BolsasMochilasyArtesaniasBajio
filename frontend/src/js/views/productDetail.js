import { api } from "../api.js";
import { addToCart, state as appState, combinedNonBundleQty } from "../state.js";
import { productCardHtml } from "../components/productCard.js";
import { bindNavLinks } from "../dom.js";
import { navigate, currentRenderToken } from "../router.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

function pricingTiersHtml(product, totalProposedQty) {
  const tierClass = (active) => (active ? "bg-white shadow border-brand-teal border-2" : "");
  return `
    <div class="bg-brand-cream rounded-xl p-6 mb-8 border border-brand-salmon border-opacity-30">
      <h3 class="font-bold text-xl mb-1 text-center">Niveles de Precio</h3>
      <p class="text-xs text-gray-500 text-center mb-4">Se calculan sumando todos los productos normales en tu carrito (mix & match)</p>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="p-3 rounded-lg ${tierClass(totalProposedQty < product.wholesale_min_qty)}">
          <p class="text-sm text-gray-500">Menudeo</p>
          <p class="text-lg font-bold">1-${product.wholesale_min_qty - 1} pz</p>
          <p class="text-2xl text-brand-blue-dark font-bold">$${product.price_normal}</p>
        </div>
        <div class="p-3 rounded-lg ${tierClass(
          totalProposedQty >= product.wholesale_min_qty && totalProposedQty < product.super_wholesale_min_qty
        )}">
          <p class="text-sm text-gray-500">Mayoreo</p>
          <p class="text-lg font-bold">${product.wholesale_min_qty}-${product.super_wholesale_min_qty - 1} pz</p>
          <p class="text-2xl text-brand-blue-dark font-bold">$${product.price_wholesale}</p>
        </div>
        <div class="p-3 rounded-lg ${tierClass(totalProposedQty >= product.super_wholesale_min_qty)}">
          <p class="text-sm text-gray-500">Súper Mayoreo</p>
          <p class="text-lg font-bold">${product.super_wholesale_min_qty}+ pz</p>
          <p class="text-2xl text-brand-blue-dark font-bold">$${product.price_super_wholesale}</p>
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
  if (product.is_bundle && product.eligible_product_ids?.length) {
    const { products: allProducts } = await api.getProducts();
    eligibleBundleProducts = allProducts.filter((p) => product.eligible_product_ids.includes(p.id));
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
      <div class="max-w-7xl mx-auto px-4 py-8 fade-in">
        <button id="back-btn" class="text-brand-blue-dark text-lg mb-6 hover:underline flex items-center">
          <i class="fa-solid fa-arrow-left mr-2"></i> Volver al catálogo
        </button>

        <div class="bg-white rounded-3xl shadow-lg p-6 md:p-10 flex flex-col md:flex-row gap-10">
          <div class="md:w-1/2">
            <div class="rounded-2xl overflow-hidden border border-gray-100 relative">
              <img src="${view.selectedVariant.image_url || NO_IMAGE_PLACEHOLDER}" alt="${product.name}" class="w-full h-auto object-cover" />
              ${
                view.selectedVariant.stock === 0
                  ? `<div class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                      <span class="bg-red-500 text-white px-6 py-3 rounded-lg text-2xl font-bold transform -rotate-12">AGOTADO</span>
                    </div>`
                  : ""
              }
            </div>
            ${
              !product.is_bundle
                ? `<div class="flex gap-3 mt-4 flex-wrap">
                    ${product.variants
                      .map(
                        (v) => `
                      <button data-variant="${v.id}" class="variant-swatch w-16 h-16 rounded-lg overflow-hidden border-2 ${
                          v.id === view.selectedVariant.id ? "border-brand-blue-dark" : "border-transparent"
                        } ${v.stock === 0 ? "opacity-40" : ""}" title="${v.color} (${v.stock} disp.)">
                        <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-full h-full object-cover" />
                      </button>`
                      )
                      .join("")}
                  </div>`
                : ""
            }
          </div>

          <div class="md:w-1/2 flex flex-col justify-center">
            <span class="text-brand-salmon font-bold tracking-wider uppercase mb-2">${product.subcategory}</span>
            <h1 class="text-4xl font-bold mb-4">${product.name}</h1>
            <p class="text-gray-600 text-lg mb-6 leading-relaxed">${product.description || ""}</p>

            ${
              product.is_bundle
                ? bundleSectionHtml()
                : `
              ${pricingTiersHtml(product, totalProposedQty)}
              <div class="flex items-center gap-4 mb-6">
                <label class="font-bold text-lg">Cantidad:</label>
                <div class="flex items-center border-2 border-gray-200 rounded-full">
                  <button id="qty-minus" class="w-10 h-10 text-xl font-bold text-brand-blue-dark">-</button>
                  <span id="qty-value" class="w-12 text-center text-lg font-bold">${view.quantity}</span>
                  <button id="qty-plus" class="w-10 h-10 text-xl font-bold text-brand-blue-dark">+</button>
                </div>
                <span class="text-gray-500">${view.selectedVariant.stock} disponibles</span>
              </div>
              <button id="add-to-cart" ${view.selectedVariant.stock === 0 ? "disabled" : ""}
                class="bg-brand-blue-dark text-white px-8 py-4 rounded-full text-xl font-semibold hover:bg-brand-blue shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                <i class="fa-solid fa-cart-plus mr-2"></i> Agregar al Carrito
              </button>
            `
            }
          </div>
        </div>

        ${
          relatedProducts.length
            ? `
          <div class="mt-16">
            <h2 class="text-3xl font-bold mb-8">También te puede interesar</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
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
      <div class="border border-gray-100 rounded-xl overflow-hidden">
        <button data-toggle-product="${ep.id}" class="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left">
          <span class="font-semibold">${ep.name}</span>
          <i class="fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} text-gray-400"></i>
        </button>
        ${
          expanded
            ? `<div class="p-4 space-y-2">
                ${
                  inStockVariants.length === 0
                    ? `<p class="text-sm text-gray-400">Sin stock disponible en este modelo.</p>`
                    : inStockVariants
                        .map((v) => {
                          const qty = view.customSelections[v.id] || 0;
                          return `
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <img src="${v.image_url || NO_IMAGE_PLACEHOLDER}" class="w-10 h-10 rounded object-cover" />
                            <span class="text-sm">${v.color} <span class="text-gray-400">(${v.stock} disp.)</span></span>
                          </div>
                          <div class="flex items-center border-2 border-gray-200 rounded-full">
                            <button data-bundle-minus="${v.id}" class="w-8 h-8 font-bold text-brand-blue-dark">-</button>
                            <span class="w-8 text-center font-bold">${qty}</span>
                            <button data-bundle-plus="${v.id}" data-max="${v.stock}" data-category="${ep.category}" class="w-8 h-8 font-bold text-brand-blue-dark">+</button>
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
                <h4 class="font-bold text-lg">${categoryName}</h4>
                <span class="font-bold ${categoryTotal === categoryLimit ? "text-brand-teal" : "text-brand-salmon"}">${categoryTotal} / ${categoryLimit}</span>
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
      <div class="mb-4 flex items-center justify-between bg-white border-2 border-brand-teal rounded-xl px-4 py-3">
        <span class="font-bold">Piezas seleccionadas</span>
        <span class="text-xl font-bold ${total === limit ? "text-brand-teal" : "text-brand-salmon"}">${total} / ${limit}</span>
      </div>
      <div class="max-h-96 overflow-y-auto space-y-4 mb-6 pr-1">
        ${eligibleBundleProducts.map((ep) => productAccordionItemHtml(ep)).join("")}
      </div>
    `;
  }

  function bundleSectionHtml() {
    const hasCategoryLimits =
      product.bundle_category_limits && Object.keys(product.bundle_category_limits).length > 0;

    return `
      <div class="bg-brand-cream rounded-xl p-6 mb-6 border border-brand-salmon border-opacity-30 text-center">
        <p class="text-sm text-gray-500">Precio fijo del paquete</p>
        <p class="text-3xl font-bold text-brand-blue-dark">$${product.price_normal}</p>
        <p class="text-gray-600 mt-1">Incluye <strong>${product.bundle_limit}</strong> piezas a elegir</p>
      </div>

      <div class="flex gap-3 mb-6">
        <button data-mode="surtido" class="mode-btn flex-1 py-3 rounded-full font-semibold border-2 ${
          view.bundleMode === "surtido" ? "bg-brand-blue-dark text-white border-brand-blue-dark" : "border-gray-300 text-gray-600"
        }">Surtido al Azar</button>
        <button data-mode="personalizado" class="mode-btn flex-1 py-3 rounded-full font-semibold border-2 ${
          view.bundleMode === "personalizado" ? "bg-brand-blue-dark text-white border-brand-blue-dark" : "border-gray-300 text-gray-600"
        }">Elegir mis diseños</button>
      </div>

      ${
        view.bundleMode === "personalizado"
          ? hasCategoryLimits
            ? categoryAccordionHtml()
            : flatSelectionListHtml()
          : `<p class="text-gray-500 mb-6"><i class="fa-solid fa-shuffle mr-2"></i>Recibirás una selección variada de nuestros modelos disponibles.</p>`
      }

      <button id="add-bundle-to-cart" class="bg-brand-blue-dark text-white px-8 py-4 rounded-full text-xl font-semibold hover:bg-brand-blue shadow-lg">
        <i class="fa-solid fa-cart-plus mr-2"></i> Agregar Paquete al Carrito
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
