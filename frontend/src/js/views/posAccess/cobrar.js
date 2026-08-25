import { api, posAccessApi } from "../../api.js";
import { priceForQuantity } from "../../state.js";
import { money } from "./shared.js";

// --- Sección "Cobrar": estilo caja registradora (ticket + catálogo rápido). ---
export function createSaleSection(onUnauthorized) {
  let products = [];
  let topSellers = []; // top 10 más vendidos (mismo shape que products, vía /products/bestsellers)
  let cart = []; // { product, variant, quantity }
  let search = "";
  let topCategoryFilter = "Todos";
  let catalogCategoryFilter = "Todos";
  let paymentMethod = "cash";
  let amountPaid = "";
  let customerName = "";
  let needsShipping = false;
  let shipping = { full_name: "", phone: "", street: "", colonia: "", city: "", state: "", postal_code: "", carrier: "" };
  let shippingCost = "";
  let error = null;
  let busy = false;

  function combinedQty() {
    return cart.filter((item) => !item.product.is_bundle).reduce((sum, item) => sum + item.quantity, 0);
  }

  function lineUnitPrice(item) {
    if (item.product.is_bundle) return Number(item.product.price_normal);
    return priceForQuantity(item.product, combinedQty());
  }

  function itemsTotal() {
    return cart.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0);
  }

  function shippingCostValue() {
    if (!needsShipping) return 0;
    const n = parseFloat(shippingCost);
    return isNaN(n) ? 0 : n;
  }

  function grandTotal() {
    return itemsTotal() + shippingCostValue();
  }

  function change() {
    const paid = parseFloat(amountPaid);
    if (isNaN(paid)) return 0;
    return Math.max(0, paid - grandTotal());
  }

  function findCartItem(variantId) {
    return cart.find((item) => item.variant.id === variantId);
  }

  function addToCart(product, variant, qty = 1) {
    const existing = findCartItem(variant.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = Math.min(currentQty + qty, variant.stock);
    if (newQty === currentQty) return;
    if (existing) existing.quantity = newQty;
    else cart.push({ product, variant, quantity: newQty });
  }

  // Simple (no paquetes): cada variante es su propio "producto vendible" en el
  // catálogo rápido y por SKU, igual que un lector de código de barras real.
  function sellableFrom(list) {
    return list.filter((p) => !p.is_bundle).flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })));
  }

  function sellableVariants() {
    return sellableFrom(products);
  }

  function topSellerVariants() {
    return sellableFrom(topSellers);
  }

  function catalogCategories() {
    return [...new Set(sellableVariants().map(({ product }) => product.category))].sort();
  }

  function matchesSearch({ product, variant }) {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      variant.sku.toLowerCase().includes(term) ||
      variant.color.toLowerCase().includes(term)
    );
  }

  // "Top 5 Más Vendido": su propio filtro de categoría + la búsqueda compartida de arriba.
  function filteredTopSellers() {
    return topSellerVariants().filter(
      (entry) => (topCategoryFilter === "Todos" || entry.product.category === topCategoryFilter) && matchesSearch(entry)
    );
  }

  // "Catálogo Completo": su propio filtro de categoría + la búsqueda compartida de arriba.
  function filteredFullCatalog() {
    return sellableVariants().filter(
      (entry) => (catalogCategoryFilter === "Todos" || entry.product.category === catalogCategoryFilter) && matchesSearch(entry)
    );
  }

  async function loadProducts() {
    ({ products } = await posAccessApi.listProducts());
  }

  async function loadTopSellers() {
    ({ products: topSellers } = await api.getBestsellers(5));
  }

  function shippingFieldsHtml() {
    const field = (key, label, span = "") =>
      `<div class="${span}">
        <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">${label}</label>
        <input data-shipping-field="${key}" type="text" value="${shipping[key]}" class="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
      </div>`;
    return `
      <div class="mt-2 mb-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2">
        ${field("full_name", "Nombre", "col-span-2")}
        ${field("phone", "Teléfono")}
        ${field("carrier", "Paquetería / método")}
        ${field("street", "Calle y número", "col-span-2")}
        ${field("colonia", "Colonia")}
        ${field("city", "Ciudad")}
        ${field("state", "Estado")}
        ${field("postal_code", "CP")}
        <div>
          <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Costo de envío</label>
          <input id="shipping-cost-input" type="number" step="0.01" value="${shippingCost}" class="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
        </div>
      </div>
    `;
  }

  function categoryPillsHtml(activeValue, dataAttr, categories, light) {
    const pillClass = (active) =>
      light
        ? active
          ? "bg-rose-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        : active
          ? "bg-white text-slate-900"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700";
    return `
      <div class="flex items-center gap-1.5 overflow-x-auto">
        <button data-${dataAttr}="Todos" class="${dataAttr}-btn flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${pillClass(activeValue === "Todos")}">Todos</button>
        ${categories
          .map(
            (cat) => `
          <button data-${dataAttr}="${cat}" class="${dataAttr}-btn flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${pillClass(activeValue === cat)}">${cat}</button>`
          )
          .join("")}
      </div>
    `;
  }

  // Card grande, para el Top 5 (destacado).
  function bigCardHtml(product, v) {
    return `
      <button data-quick-add="${v.id}" ${v.stock === 0 ? "disabled" : ""}
        class="relative group flex flex-col rounded-xl overflow-hidden border border-slate-100 bg-white text-center ${
          v.stock === 0 ? "opacity-40 cursor-not-allowed" : "hover:shadow-md hover:border-rose-200"
        }">
        <div class="relative w-full h-36 sm:h-44 lg:h-40 xl:h-48 flex-shrink-0 bg-slate-100 overflow-hidden flex items-center justify-center">
          ${
            v.image_url
              ? `<img src="${v.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />`
              : `<i class="fa-solid fa-image text-4xl text-slate-300"></i>`
          }
          ${
            v.stock > 0
              ? `<div class="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 flex items-center justify-center transition-colors">
                  <span class="opacity-0 group-hover:opacity-100 w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center transition-opacity">
                    <i class="fa-solid fa-plus"></i>
                  </span>
                </div>`
              : ""
          }
        </div>
        <div class="p-4">
          <p class="text-base font-bold text-slate-900 leading-tight truncate">${product.name}</p>
          <p class="text-lg font-black text-rose-600 mt-1">${money(product.price_normal)}</p>
          <p class="text-xs text-slate-400 mt-0.5">Stock: ${v.stock}</p>
        </div>
      </button>`;
  }

  // Card compacta, estilo tienda en línea, para el catálogo completo.
  function compactCardHtml(product, v) {
    return `
      <button data-quick-add="${v.id}" ${v.stock === 0 ? "disabled" : ""}
        class="group flex flex-col rounded-lg overflow-hidden border border-slate-100 bg-white text-left ${
          v.stock === 0 ? "opacity-40 cursor-not-allowed" : "hover:shadow-md hover:border-rose-200"
        }">
        <div class="relative w-full h-24 sm:h-28 flex-shrink-0 bg-slate-100 overflow-hidden flex items-center justify-center">
          ${
            v.image_url
              ? `<img src="${v.image_url}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />`
              : `<i class="fa-solid fa-image text-xl text-slate-300"></i>`
          }
          ${product.is_on_sale ? `<span class="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">OFERTA</span>` : ""}
          ${v.stock === 0 ? `<span class="absolute inset-0 bg-white/70 flex items-center justify-center text-[10px] font-bold text-slate-600">AGOTADO</span>` : ""}
        </div>
        <div class="p-2">
          <p class="text-[9px] text-slate-400 uppercase tracking-wide truncate">${product.category}</p>
          <p class="text-xs font-bold text-slate-900 leading-tight truncate">${product.name}</p>
          <p class="text-sm font-black text-rose-600 mt-0.5">${money(product.price_normal)}</p>
        </div>
      </button>`;
  }

  function html() {
    const qty = combinedQty();
    const categories = catalogCategories();
    const topSellersFiltered = filteredTopSellers();
    const fullCatalog = filteredFullCatalog();
    return `
      <div class="fade-in flex flex-col gap-5">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div class="flex flex-col gap-4 min-w-0">
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <label class="text-xs font-semibold text-slate-500 mb-1.5 block">Código o nombre del producto</label>
            <div class="relative">
              <i class="fa-solid fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input id="barcode-input" type="text" autocomplete="off" placeholder="Teclea o escanea SKU, o busca por nombre..."
                value="${search}"
                class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 font-mono text-sm" />
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1">
            <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 class="font-bold text-slate-900 text-sm"><i class="fa-solid fa-cart-shopping text-rose-500 mr-2"></i>Venta actual</h3>
              ${qty > 0 ? `<span class="text-xs bg-rose-50 text-rose-600 font-semibold px-2.5 py-1 rounded-full">${qty} pz combinadas</span>` : ""}
            </div>
            <div class="overflow-x-auto max-h-[40vh] overflow-y-auto">
              <table class="w-full text-left text-sm whitespace-nowrap">
                <thead class="bg-slate-50 sticky top-0 z-10 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th class="px-4 py-2.5 font-semibold w-full">Producto</th>
                    <th class="px-4 py-2.5 font-semibold text-right">Precio</th>
                    <th class="px-4 py-2.5 font-semibold text-center">Cant.</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${
                    cart.length === 0
                      ? `<tr><td colspan="3" class="text-center py-16 text-slate-300"><i class="fa-solid fa-cart-shopping text-3xl mb-2 block"></i>Venta vacía. Escanea o busca un producto.</td></tr>`
                      : cart
                          .map(
                            (item) => `
                    <tr data-cart-row="${item.variant.id}" class="hover:bg-slate-50">
                      <td class="px-4 py-3">
                        <p class="font-semibold text-slate-900">${item.product.name}</p>
                        <p class="text-[10px] text-slate-400">${item.variant.color} · <span class="font-mono">${item.variant.sku}</span></p>
                      </td>
                      <td class="px-4 py-3 text-right text-slate-600">${money(lineUnitPrice(item))}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center justify-center gap-1.5">
                          <button data-qty-minus="${item.variant.id}" class="w-7 h-7 rounded-full border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 flex items-center justify-center">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                          </button>
                          <span class="w-6 text-center text-sm font-bold text-slate-900">${item.quantity}</span>
                          <button data-qty-plus="${item.variant.id}" class="w-7 h-7 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                          </button>
                        </div>
                      </td>
                    </tr>`
                          )
                          .join("")
                  }
                </tbody>
              </table>
            </div>

            <div class="mt-auto border-t border-slate-100 bg-slate-50 p-4">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
                <div class="bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase text-slate-400">Total</span>
                  <span class="text-xl font-black text-slate-900">${money(grandTotal())}</span>
                  ${needsShipping ? `<span class="text-[10px] text-slate-400">incl. ${money(shippingCostValue())} envío</span>` : ""}
                </div>
                <div class="bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase text-slate-400">Pagó Con</span>
                  <input id="amount-paid" type="number" step="0.01" class="w-full text-lg font-bold text-slate-900 outline-none bg-transparent" placeholder="0" value="${amountPaid}" />
                </div>
                <div class="bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase text-slate-400">Su Cambio</span>
                  <span class="text-xl font-black ${change() > 0 ? "text-emerald-600" : "text-slate-300"}">${money(change())}</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="relative">
                  <i class="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                  <input id="customer-name" type="text" placeholder="Cliente de mostrador" value="${customerName}"
                    class="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                </div>
                <label class="flex items-center justify-between gap-2 cursor-pointer bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <span class="text-xs font-semibold text-slate-600"><i class="fa-solid fa-truck mr-1 text-slate-400"></i>Necesita envío</span>
                  <span class="relative inline-block w-9 h-5 flex-shrink-0">
                    <input type="checkbox" id="needs-shipping" ${needsShipping ? "checked" : ""} class="peer sr-only" />
                    <span class="block w-9 h-5 bg-slate-200 peer-checked:bg-rose-500 rounded-full transition-colors"></span>
                    <span class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></span>
                  </span>
                </label>
              </div>
              ${needsShipping ? shippingFieldsHtml() : ""}

              <div class="grid grid-cols-3 gap-2 mb-3">
                <button data-payment="cash" class="payment-btn flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === "cash" ? "border-rose-500 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }">
                  <i class="fa-solid fa-money-bill-wave"></i>
                  <span class="text-xs font-semibold">Efectivo</span>
                </button>
                <button data-payment="card" class="payment-btn flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === "card" ? "border-rose-500 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }">
                  <i class="fa-solid fa-credit-card"></i>
                  <span class="text-xs font-semibold">Terminal</span>
                </button>
                <button data-payment="spei" class="payment-btn flex flex-col items-center justify-center gap-1 py-3 rounded-lg border-2 transition-colors ${
                  paymentMethod === "spei" ? "border-rose-500 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
                }">
                  <i class="fa-solid fa-building-columns"></i>
                  <span class="text-xs font-semibold">Transf.</span>
                </button>
              </div>
              ${
                paymentMethod === "spei"
                  ? `<p class="text-[10px] text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 mb-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Quedará pendiente hasta que confirmes el depósito en el Dashboard.</p>`
                  : ""
              }
              ${error ? `<p class="text-red-500 text-xs mb-2">${error}</p>` : ""}
              <button id="checkout-btn" ${cart.length === 0 || busy ? "disabled" : ""}
                class="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black text-base rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                ${busy ? `<i class="fa-solid fa-spinner fa-spin"></i>Procesando...` : `<i class="fa-solid fa-cash-register"></i>COBRAR ${money(grandTotal())}`}
              </button>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div class="bg-slate-900 px-4 py-3 text-white flex items-center justify-between gap-3 flex-shrink-0">
            <span class="text-xs font-bold uppercase tracking-widest flex items-center gap-2 flex-shrink-0">
              <i class="fa-solid fa-bolt text-rose-400"></i>Catálogo Rápido
            </span>
            ${categoryPillsHtml(topCategoryFilter, "top-category", categories, false)}
          </div>

          <div class="p-4">
            <h4 class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Top 5 Más Vendido</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              ${topSellersFiltered.map(({ product, variant: v }) => bigCardHtml(product, v)).join("")}
              ${
                topSellersFiltered.length === 0
                  ? `<p class="col-span-full text-center text-slate-300 text-xs py-8">${
                      topSellerVariants().length === 0 ? "Aún no hay ventas registradas." : "Sin resultados."
                    }</p>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <h4 class="text-sm font-bold text-slate-900"><i class="fa-solid fa-grip text-rose-500 mr-2"></i>Catálogo Completo</h4>
        </div>
        <div class="p-4">
          <div class="mb-3">
            ${categoryPillsHtml(catalogCategoryFilter, "catalog-category", categories, true)}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            ${fullCatalog.map(({ product, variant: v }) => compactCardHtml(product, v)).join("")}
            ${fullCatalog.length === 0 ? `<p class="col-span-full text-center text-slate-300 text-xs py-8">Sin resultados.</p>` : ""}
          </div>
        </div>
      </div>
      </div>
    `;
  }

  function bind(el, rerender) {
    const barcodeInput = el.querySelector("#barcode-input");
    barcodeInput.addEventListener("input", () => {
      search = barcodeInput.value;
      rerender();
      const input = el.querySelector("#barcode-input");
      input.focus();
      input.selectionStart = input.value.length;
    });
    barcodeInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const term = search.trim().toLowerCase();
      const exact = sellableVariants().find(({ variant }) => variant.sku.toLowerCase() === term);
      if (exact) {
        addToCart(exact.product, exact.variant, 1);
        search = "";
        rerender();
      }
    });

    el.querySelectorAll("[data-top-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        topCategoryFilter = btn.dataset.topCategory;
        rerender();
      });
    });
    el.querySelectorAll("[data-catalog-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        catalogCategoryFilter = btn.dataset.catalogCategory;
        rerender();
      });
    });

    el.querySelectorAll("[data-quick-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { product, variant } = sellableVariants().find((sv) => sv.variant.id === btn.dataset.quickAdd);
        addToCart(product, variant, 1);
        rerender();
      });
    });

    el.querySelectorAll("[data-qty-plus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = findCartItem(btn.dataset.qtyPlus);
        if (item && item.quantity < item.variant.stock) item.quantity += 1;
        rerender();
      });
    });
    el.querySelectorAll("[data-qty-minus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = findCartItem(btn.dataset.qtyMinus);
        if (item) item.quantity -= 1;
        cart = cart.filter((i) => i.quantity > 0);
        rerender();
      });
    });

    el.querySelectorAll(".payment-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        paymentMethod = btn.dataset.payment;
        rerender();
      });
    });

    el.querySelector("#amount-paid").addEventListener("input", (e) => {
      amountPaid = e.target.value;
      rerender();
      const input = el.querySelector("#amount-paid");
      input.focus();
    });

    el.querySelector("#customer-name").addEventListener("input", (e) => {
      customerName = e.target.value;
    });

    el.querySelector("#needs-shipping").addEventListener("change", (e) => {
      needsShipping = e.target.checked;
      rerender();
    });

    if (needsShipping) {
      el.querySelectorAll("[data-shipping-field]").forEach((input) => {
        input.addEventListener("input", (e) => {
          shipping[input.dataset.shippingField] = e.target.value;
        });
      });
      const shippingCostInput = el.querySelector("#shipping-cost-input");
      shippingCostInput.addEventListener("input", (e) => {
        shippingCost = e.target.value;
        rerender();
        const input = el.querySelector("#shipping-cost-input");
        input.focus();
      });
    }

    const checkoutBtn = el.querySelector("#checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", async () => {
        error = null;
        busy = true;
        rerender();
        try {
          const payload = {
            items: cart.map((item) => ({ variant_id: item.variant.id, quantity: item.quantity })),
            payment_method: paymentMethod,
            customer_name: customerName,
          };
          if (needsShipping) {
            payload.shipping = shipping;
            payload.shipping_cost = shippingCostValue();
          }
          const { order } = await posAccessApi.sale(payload);
          cart = [];
          amountPaid = "";
          customerName = "";
          needsShipping = false;
          shipping = { full_name: "", phone: "", street: "", colonia: "", city: "", state: "", postal_code: "", carrier: "" };
          shippingCost = "";
          await Promise.all([loadProducts(), loadTopSellers()]);
          busy = false;
          alert(
            order.status === "Pendiente de pago"
              ? `Venta registrada (Folio ${order.order_number}). Queda pendiente hasta confirmar el depósito en el Dashboard.`
              : `Venta completada. Folio ${order.order_number} — Total ${money(order.total)}`
          );
          rerender();
        } catch (err) {
          busy = false;
          if (err.status === 401 && onUnauthorized) {
            onUnauthorized();
            return;
          }
          error = err.message;
          rerender();
        }
      });
    }
  }

  return {
    async mount(el) {
      el.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando catálogo...</div>`;
      try {
        await Promise.all([loadProducts(), loadTopSellers()]);
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        el.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }
      const rerender = () => {
        el.innerHTML = html();
        bind(el, rerender);
      };
      rerender();
      // Solo al cargar la sección enfocamos el buscador (listo para un lector de
      // código de barras); en cada rerender posterior NO se debe robar el foco, o
      // cualquier clic (categoría, +/-, etc.) manda la página de vuelta al buscador.
      el.querySelector("#barcode-input")?.focus();
    },
  };
}
