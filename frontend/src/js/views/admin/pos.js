import { api } from "../../api.js";
import { priceForQuantity } from "../../state.js";
import { getCategories } from "../../catalogCache.js";
import { productCardHtml } from "../../components/productCard.js";
import { NO_IMAGE_PLACEHOLDER } from "../../imageFallback.js";

// Misma caja de "Niveles de Precio" que ve el cliente en el detalle de producto online,
// para que el vendedor vea exactamente lo mismo al cobrar en mostrador.
function pricingTiersHtml(product, totalProposedQty) {
  const tierClass = (active) => (active ? "bg-white border-brand-pink border-2" : "border border-gray-200");
  return `
    <div class="bg-brand-peach-light bg-opacity-40 rounded-lg p-6 mb-6 border border-gray-200">
      <h3 class="font-bold text-lg mb-1 text-center text-gray-900">Niveles de Precio</h3>
      <p class="text-xs text-gray-500 text-center mb-4">Se calculan sumando las piezas normales de esta venta (mix &amp; match)</p>
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

export async function renderPosTab(container, isCurrentTab = () => true, deps = {}) {
  const { listProducts = api.adminListProducts, submitSale = api.adminPosSale, onUnauthorized = null } = deps;

  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando catálogo...</div>`;

  let categories, allProducts;
  try {
    const [{ categories: cats }, { products }] = await Promise.all([getCategories(), listProducts()]);
    categories = cats;
    allProducts = products;
  } catch (err) {
    if (!isCurrentTab()) return;
    container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
    return;
  }
  if (!isCurrentTab()) return;

  let activeCategory = "Todos";
  let search = "";
  let cart = []; // { product, variant, quantity }
  let paymentMethod = "cash";
  let detailProduct = null;
  let detailVariant = null;
  let detailQty = 1;

  // Igual que en la web: los paquetes tienen precio fijo (como "Surtido al azar") y no
  // participan en la suma de piezas que activa el mayoreo de los productos normales.
  function combinedQty() {
    return cart.filter((item) => !item.product.is_bundle).reduce((sum, item) => sum + item.quantity, 0);
  }

  function lineUnitPrice(item) {
    if (item.product.is_bundle) return Number(item.product.price_normal);
    return priceForQuantity(item.product, combinedQty());
  }

  function cartTotal() {
    return cart.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0);
  }

  function findCartItem(variantId) {
    return cart.find((item) => item.variant.id === variantId);
  }

  function addToCart(product, variant, qty) {
    const existing = findCartItem(variant.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = Math.min(currentQty + qty, variant.stock);
    if (existing) existing.quantity = newQty;
    else cart.push({ product, variant, quantity: newQty });
  }

  function filteredProducts() {
    const term = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      const matchesCategory = activeCategory === "Todos" || p.category === activeCategory;
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(term) || v.color.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }

  function openDetail(product) {
    detailProduct = product;
    detailVariant = product.variants.find((v) => v.stock > 0) || product.variants[0];
    detailQty = 1;
    render();
  }

  function detailModalHtml() {
    const p = detailProduct;
    const totalProposedQty = combinedQty() + (p.is_bundle ? 0 : detailQty);

    return `
      <div id="pos-detail-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
          <button id="pos-detail-close" class="absolute top-4 right-4 text-gray-400 hover:text-gray-900 text-2xl">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div class="flex flex-col md:flex-row gap-8">
            <div class="w-full md:w-1/2">
              <div class="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 aspect-square mb-4">
                <img src="${detailVariant.image_url || NO_IMAGE_PLACEHOLDER}" alt="${p.name}" class="w-full h-full object-cover" />
              </div>
              ${
                !p.is_bundle
                  ? `<div class="grid grid-cols-5 gap-2">
                      ${p.variants
                        .map(
                          (v) => `
                        <button data-detail-variant="${v.id}" class="relative rounded overflow-hidden border-2 aspect-square ${
                            v.id === detailVariant.id ? "border-gray-900" : "border-transparent opacity-60 hover:opacity-100"
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
              <span class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                ${p.category}${p.is_bundle ? "" : ` / ${p.subcategory}`}
              </span>
              <h2 class="text-2xl font-bold text-gray-900 mb-3">
                ${p.name}
                ${p.is_bundle ? `<span class="text-xs bg-brand-mexican text-white px-2 py-1 rounded-full align-middle ml-1">PAQUETE</span>` : ""}
              </h2>
              ${p.description ? `<p class="text-gray-600 text-sm mb-4">${p.description}</p>` : ""}

              ${
                p.is_bundle
                  ? `<div class="bg-brand-peach-light bg-opacity-40 rounded-lg p-6 mb-6 border border-gray-200 text-center">
                      <p class="text-sm text-gray-500">Precio fijo del paquete</p>
                      <p class="text-3xl font-bold text-gray-900">$${p.price_normal}</p>
                    </div>`
                  : pricingTiersHtml(p, totalProposedQty)
              }

              <div class="flex items-center gap-4 mb-6">
                <label class="font-bold text-sm text-gray-900">Cantidad:</label>
                <div class="flex items-center border border-gray-300 rounded h-10">
                  <button id="detail-qty-minus" class="px-3 text-gray-500 hover:text-gray-900"><i class="fa-solid fa-minus text-xs"></i></button>
                  <span class="px-3 font-semibold w-10 text-center">${detailQty}</span>
                  <button id="detail-qty-plus" class="px-3 text-gray-500 hover:text-gray-900"><i class="fa-solid fa-plus text-xs"></i></button>
                </div>
                <span class="text-sm text-gray-500">${detailVariant.stock} disponibles</span>
              </div>

              <button id="detail-add-btn" ${detailVariant.stock === 0 ? "disabled" : ""}
                class="bg-gray-900 hover:bg-brand-mexican disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold h-12 rounded-full mt-auto transition-colors">
                <i class="fa-solid fa-cart-plus mr-2"></i>${detailVariant.stock === 0 ? "Agotado" : "Agregar a la Venta"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function cartPanelHtml() {
    const qty = combinedQty();
    return `
      <div class="border border-gray-200 rounded-lg bg-white p-5 lg:sticky lg:top-24">
        <h3 class="font-bold text-lg text-gray-900 mb-4"><i class="fa-solid fa-cash-register text-brand-mexican mr-2"></i>Venta actual</h3>

        ${
          cart.length === 0
            ? `<p class="text-gray-400 text-sm text-center py-10">Elige un producto del catálogo para empezar.</p>`
            : `
          ${
            qty > 0
              ? `<div class="bg-brand-peach-light bg-opacity-40 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-700">
                  <i class="fa-solid fa-tags text-brand-mexican mr-1"></i>${qty} pieza${qty === 1 ? "" : "s"} combinadas — mayoreo automático, igual que en la web.
                </div>`
              : ""
          }
          <div class="space-y-4 mb-4 max-h-72 overflow-y-auto pr-1">
            ${cart
              .map(
                (item) => `
              <div class="flex items-center gap-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0" data-cart-row="${item.variant.id}">
                <img src="${item.variant.image_url || NO_IMAGE_PLACEHOLDER}" class="w-14 h-14 border border-gray-200 rounded object-cover flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold truncate">
                    ${item.product.name}${item.product.is_bundle ? ` <span class="text-[10px] text-brand-mexican font-bold">PAQUETE</span>` : ""}
                  </p>
                  <p class="text-xs text-gray-500">${item.variant.color} · $${lineUnitPrice(item)} c/u</p>
                  <div class="flex items-center border border-gray-200 rounded w-fit mt-1">
                    <button data-cart-minus="${item.variant.id}" class="w-6 h-6 text-xs text-gray-500 hover:text-gray-900">-</button>
                    <span class="w-6 text-center text-xs font-bold">${item.quantity}</span>
                    <button data-cart-plus="${item.variant.id}" class="w-6 h-6 text-xs text-gray-500 hover:text-gray-900">+</button>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-sm font-bold">$${lineUnitPrice(item) * item.quantity}</p>
                  <button data-cart-remove="${item.variant.id}" class="text-gray-400 hover:text-red-500 text-xs mt-1"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </div>`
              )
              .join("")}
          </div>
        `
        }

        <div class="border-t border-gray-100 pt-4 mb-4 flex justify-between items-center">
          <span class="font-bold text-gray-700">Total</span>
          <span class="text-2xl font-bold text-gray-900">$${cartTotal()}</span>
        </div>

        <label class="block text-xs font-bold text-gray-600 mb-2">Método de pago</label>
        <div class="flex gap-2 mb-4">
          <button data-payment="cash" class="payment-btn flex-1 py-2 rounded font-semibold text-sm border-2 ${
            paymentMethod === "cash" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"
          }"><i class="fa-solid fa-money-bill-wave mr-1"></i>Efectivo</button>
          <button data-payment="card" class="payment-btn flex-1 py-2 rounded font-semibold text-sm border-2 ${
            paymentMethod === "card" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600"
          }"><i class="fa-regular fa-credit-card mr-1"></i>Terminal</button>
        </div>

        <label class="block text-xs font-bold text-gray-600 mb-1">Nombre del cliente (opcional)</label>
        <input id="pos-customer-name" type="text" placeholder="Cliente de mostrador" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-4" />

        <p id="pos-error" class="text-red-500 text-sm mb-3 hidden"></p>

        <button id="pos-complete-btn" ${cart.length === 0 ? "disabled" : ""}
          class="w-full bg-brand-mexican hover:opacity-90 text-white font-bold py-3 rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
          Completar Venta
        </button>
        ${cart.length > 0 ? `<button id="pos-clear-btn" class="w-full text-center text-xs text-gray-400 hover:text-red-500 mt-2">Vaciar venta</button>` : ""}
      </div>
    `;
  }

  function render() {
    const visible = filteredProducts();

    container.innerHTML = `
      <div class="flex flex-col lg:flex-row gap-6">
        <div class="w-full lg:w-56 flex-shrink-0">
          <div class="border border-gray-200 rounded-lg p-5 bg-white lg:sticky lg:top-24">
            <h3 class="font-bold text-sm text-gray-900 mb-4">Categoría</h3>
            <ul class="space-y-2 mb-5">
              <li>
                <button data-cat="Todos" class="pos-cat-link w-full text-left text-sm ${
                  activeCategory === "Todos" ? "font-bold text-brand-mexican" : "text-gray-600 hover:text-gray-900"
                }">Todos los productos</button>
              </li>
              ${categories
                .map(
                  (c) => `
                <li>
                  <button data-cat="${c.name}" class="pos-cat-link w-full text-left text-sm ${
                    activeCategory === c.name ? "font-bold text-brand-mexican" : "text-gray-600 hover:text-gray-900"
                  }">${c.name}</button>
                </li>`
                )
                .join("")}
            </ul>
            <div class="relative border-t border-gray-100 pt-4">
              <input id="pos-search" type="text" value="${search}" placeholder="Buscar..."
                class="w-full pl-8 pr-3 py-2 border-b border-gray-200 outline-none text-sm focus:border-brand-pink transition-colors" />
              <i class="fa-solid fa-search absolute left-0 bottom-2.5 text-gray-400 text-sm"></i>
            </div>
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-900">${activeCategory}</h2>
            <span class="text-sm text-gray-500">${visible.length} producto${visible.length === 1 ? "" : "s"}</span>
          </div>
          <div id="pos-grid" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[75vh] overflow-y-auto pr-1">
            ${
              visible.length === 0
                ? `<p class="text-gray-400 col-span-full text-center py-16">Sin resultados.</p>`
                : visible.map((p) => productCardHtml(p)).join("")
            }
          </div>
        </div>

        <div class="w-full lg:w-96 flex-shrink-0">${cartPanelHtml()}</div>
      </div>

      ${detailProduct ? detailModalHtml() : ""}
    `;

    bindEvents();
  }

  function confirmAddFromDetail() {
    addToCart(detailProduct, detailVariant, detailQty);
    detailProduct = null;
    render();
  }

  function bindEvents() {
    container.querySelectorAll(".pos-cat-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat;
        render();
      });
    });

    const searchInput = container.querySelector("#pos-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        search = searchInput.value;
        render();
        const el = container.querySelector("#pos-search");
        if (el) {
          el.focus();
          el.selectionStart = el.value.length;
        }
      });
    }

    container.querySelectorAll("#pos-grid [data-nav]").forEach((card) => {
      card.addEventListener("click", () => {
        const slug = card.dataset.nav.replace("/producto/", "");
        const product = allProducts.find((p) => p.slug === slug);
        if (product) openDetail(product);
      });
    });

    container.querySelectorAll("[data-cart-plus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = findCartItem(btn.dataset.cartPlus);
        if (item && item.quantity < item.variant.stock) item.quantity += 1;
        render();
      });
    });
    container.querySelectorAll("[data-cart-minus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = findCartItem(btn.dataset.cartMinus);
        if (item) item.quantity -= 1;
        cart = cart.filter((i) => i.quantity > 0);
        render();
      });
    });
    container.querySelectorAll("[data-cart-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cart = cart.filter((i) => i.variant.id !== btn.dataset.cartRemove);
        render();
      });
    });

    container.querySelectorAll(".payment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        paymentMethod = btn.dataset.payment;
        render();
      });
    });

    const clearBtn = container.querySelector("#pos-clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        cart = [];
        render();
      });
    }

    const completeBtn = container.querySelector("#pos-complete-btn");
    if (completeBtn) {
      completeBtn.addEventListener("click", async () => {
        const errorEl = container.querySelector("#pos-error");
        errorEl.classList.add("hidden");
        completeBtn.disabled = true;
        completeBtn.textContent = "Procesando...";

        try {
          const { order } = await submitSale({
            items: cart.map((item) => ({ variant_id: item.variant.id, quantity: item.quantity })),
            payment_method: paymentMethod,
            customer_name: container.querySelector("#pos-customer-name").value,
          });
          cart = [];
          ({ products: allProducts } = await listProducts());
          renderSuccess(order);
        } catch (err) {
          if (err.status === 401 && onUnauthorized) {
            onUnauthorized();
            return;
          }
          errorEl.textContent = err.message;
          errorEl.classList.remove("hidden");
          completeBtn.disabled = false;
          completeBtn.textContent = "Completar Venta";
        }
      });
    }

    const overlay = container.querySelector("#pos-detail-overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          detailProduct = null;
          render();
        }
      });
      container.querySelector("#pos-detail-close").addEventListener("click", () => {
        detailProduct = null;
        render();
      });

      container.querySelectorAll("[data-detail-variant]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const v = detailProduct.variants.find((v) => v.id === btn.dataset.detailVariant);
          if (v) {
            detailVariant = v;
            detailQty = 1;
            render();
          }
        });
      });

      const qtyMinus = container.querySelector("#detail-qty-minus");
      const qtyPlus = container.querySelector("#detail-qty-plus");
      if (qtyMinus) {
        qtyMinus.addEventListener("click", () => {
          detailQty = Math.max(1, detailQty - 1);
          render();
        });
        qtyPlus.addEventListener("click", () => {
          detailQty = Math.min(detailVariant.stock, detailQty + 1);
          render();
        });
      }

      const addBtn = container.querySelector("#detail-add-btn");
      if (addBtn) addBtn.addEventListener("click", confirmAddFromDetail);
    }
  }

  function renderSuccess(order) {
    container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-16">
        <i class="fa-solid fa-circle-check text-6xl text-brand-mexican mb-6"></i>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">¡Venta completada!</h2>
        <p class="text-gray-500 mb-1">Folio <strong>${order.order_number}</strong></p>
        <p class="text-3xl font-bold text-gray-900 my-4">$${order.total}</p>
        <button id="pos-new-sale-btn" class="bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded-full font-semibold transition-colors">
          Nueva Venta
        </button>
      </div>
    `;
    container.querySelector("#pos-new-sale-btn").addEventListener("click", () => {
      detailProduct = null;
      render();
    });
  }

  render();
}
