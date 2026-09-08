import { api, posAccessApi } from "../../api.js";
import { priceForQuantity } from "../../state.js";
import { money } from "./shared.js";

// --- Sección "Cobrar": estilo caja registradora (ticket + catálogo rápido). ---
export function createSaleSection(onUnauthorized) {
  let products = [];
  let cart = []; // { product, variant, quantity }
  let search = "";
  let catalogCategoryFilter = "Todos";
  let paymentMethod = "cash";
  let amountPaid = "";
  let customerName = "";
  let needsShipping = false;
  let shipping = { full_name: "", phone: "", street: "", colonia: "", city: "", state: "", postal_code: "", carrier: "" };
  let shippingCost = "";
  let error = null;
  let busy = false;

  // Mayoreo combinado: solo suma piezas de productos normales de la MISMA línea
  // (subcategory) -- no se puede combinar animado con yute para alcanzar el mínimo.
  function combinedQtyForSubcategory(subcategory) {
    return cart
      .filter((item) => !item.product.is_bundle && item.product.subcategory === subcategory)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  function subcategoryTotals() {
    const totals = {};
    cart
      .filter((item) => !item.product.is_bundle)
      .forEach((item) => {
        totals[item.product.subcategory] = (totals[item.product.subcategory] || 0) + item.quantity;
      });
    return totals;
  }

  // priceOverride: null = automático por cantidad combinada (comportamiento normal);
  // "normal" | "wholesale" | "super_wholesale" = fijado a mano para esta línea, sin
  // importar cuántas piezas combinadas haya en el carrito.
  function lineUnitPrice(item) {
    if (item.product.is_bundle) return Number(item.product.price_normal);
    if (item.priceOverride === "normal") return Number(item.product.price_normal);
    if (item.priceOverride === "wholesale") return Number(item.product.price_wholesale);
    if (item.priceOverride === "super_wholesale") return Number(item.product.price_super_wholesale);
    return priceForQuantity(item.product, combinedQtyForSubcategory(item.product.subcategory));
  }

  function itemsTotal() {
    return cart.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0);
  }

  function itemsSavings() {
    return cart.reduce((sum, item) => {
      if (item.product.is_bundle || item.priceOverride) return sum;
      return sum + (Number(item.product.price_normal) - lineUnitPrice(item)) * item.quantity;
    }, 0);
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
    else cart.push({ product, variant, quantity: newQty, priceOverride: null });
  }

  // Simple (no paquetes): cada variante es su propio "producto vendible" en el
  // catálogo rápido y por SKU, igual que un lector de código de barras real.
  function sellableFrom(list) {
    return list.filter((p) => !p.is_bundle).flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })));
  }

  function sellableVariants() {
    return sellableFrom(products);
  }

  function catalogCategories() {
    return [...new Set(sellableVariants().map(({ product }) => product.category))].sort();
  }

  function matchesSearch({ product, variant }) {
    if (!search.trim()) return true;
    
    const normalize = (str) => (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const searchTerms = normalize(search).split(/\s+/);
    
    const searchableText = normalize([
      product.name,
      product.category,
      product.subcategory,
      product.description,
      variant.sku,
      variant.color
    ].join(" "));
    
    return searchTerms.every(term => searchableText.includes(term));
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

  function shippingFieldsHtml() {
    const field = (key, label, span = "") =>
      `<div class="${span}">
        <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">${label}</label>
        <input data-shipping-field="${key}" type="text" value="${shipping[key]}" class="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-brand-mexican focus:ring-2 focus:ring-brand-pink-light" />
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
          <input id="shipping-cost-input" type="text" inputmode="decimal" value="${shippingCost}" class="w-full px-2 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-brand-mexican focus:ring-2 focus:ring-brand-pink-light" />
        </div>
      </div>
    `;
  }

  function categoryPillsHtml(activeValue, dataAttr, categories, light) {
    const pillClass = (active) =>
      light
        ? active
          ? "bg-brand-mexican text-white shadow-md shadow-brand-mexican/20 scale-105"
          : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 hover:text-gray-900"
        : active
          ? "bg-white text-brand-mexican shadow-sm"
          : "text-white/70 hover:text-white hover:bg-white/10";
    return `
      <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mb-1 px-1">
        <button data-${dataAttr}="Todos" class="${dataAttr}-btn flex-shrink-0 px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-bold whitespace-nowrap transition-all duration-300 ${pillClass(activeValue === "Todos")}">Todos</button>
        ${categories
          .map(
            (cat) => `
          <button data-${dataAttr}="${cat}" class="${dataAttr}-btn flex-shrink-0 px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-bold whitespace-nowrap transition-all duration-300 ${pillClass(activeValue === cat)}">${cat}</button>`
          )
          .join("")}
      </div>
    `;
  }

  // Card grande, para el Top 5 (destacado).
  function bigCardHtml(product, v) {
    return `
      <button data-quick-add="${v.id}" ${v.stock === 0 ? "disabled" : ""}
        class="relative group flex flex-col rounded-2xl overflow-hidden border border-gray-100 bg-white text-center shadow-sm transition-all duration-300 ${
          v.stock === 0 ? "opacity-50 cursor-not-allowed grayscale" : "hover:shadow-xl hover:-translate-y-1 hover:border-brand-pink/30"
        }">
        <div class="relative w-full h-36 sm:h-44 lg:h-40 xl:h-48 flex-shrink-0 bg-gray-50 overflow-hidden flex items-center justify-center p-2">
          ${
            v.image_url
              ? `<img src="${v.image_url}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" />`
              : `<i class="fa-solid fa-image text-4xl text-gray-200"></i>`
          }
          ${
            v.stock > 0
              ? `<div class="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end items-center pb-4">
                  <span class="w-12 h-12 rounded-full bg-brand-mexican text-white shadow-lg shadow-brand-mexican/40 flex items-center justify-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <i class="fa-solid fa-plus text-xl"></i>
                  </span>
                </div>`
              : `<div class="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center"><span class="bg-red-500 text-white font-bold px-3 py-1 rounded-full text-xs tracking-widest uppercase">Agotado</span></div>`
          }
        </div>
        <div class="p-4 flex flex-col items-center">
          <p class="text-sm font-bold text-gray-900 leading-tight line-clamp-2 min-h-[40px]">${product.name}</p>
          <div class="mt-2 w-8 h-1 bg-gradient-to-r from-brand-pink to-brand-mexican rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <p class="text-xl font-black text-brand-mexican mt-3">${money(product.price_normal)}</p>
          <p class="text-[11px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">Disp: <span class="${v.stock <= 5 && v.stock > 0 ? 'text-red-500' : 'text-gray-600'}">${v.stock}</span></p>
        </div>
      </button>`;
  }

  // Card compacta, estilo tienda en línea, para el catálogo completo.
  function compactCardHtml(product, v) {
    return `
      <button data-quick-add="${v.id}" ${v.stock === 0 ? "disabled" : ""}
        class="group flex flex-col rounded-xl overflow-hidden border border-gray-100 bg-white text-left shadow-sm transition-all duration-300 ${
          v.stock === 0 ? "opacity-50 cursor-not-allowed grayscale" : "hover:shadow-lg hover:-translate-y-1 hover:border-brand-pink/30"
        }">
        <div class="relative w-full h-24 sm:h-32 flex-shrink-0 bg-gray-50 overflow-hidden flex items-center justify-center p-2">
          ${
            v.image_url
              ? `<img src="${v.image_url}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500" />`
              : `<i class="fa-solid fa-image text-2xl text-gray-200"></i>`
          }
          ${product.is_on_sale ? `<span class="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm">OFERTA</span>` : ""}
          ${v.stock === 0 ? `<span class="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center text-xs font-black tracking-widest text-gray-800 uppercase">AGOTADO</span>` : ""}
        </div>
        <div class="p-3">
          <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate mb-1">${product.category}</p>
          <p class="text-xs font-bold text-gray-900 leading-tight truncate">${product.name}</p>
          <div class="flex items-center justify-between mt-2">
            <p class="text-sm font-black text-brand-mexican">${money(product.price_normal)}</p>
            <span class="w-6 h-6 rounded-full bg-brand-pink-light/30 text-brand-mexican flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i class="fa-solid fa-plus text-[10px]"></i>
            </span>
          </div>
        </div>
      </button>`;
  }

  function html() {
    const totals = subcategoryTotals();
    const totalsLabel = Object.entries(totals)
      .map(([subcategory, n]) => `${n} ${subcategory}`)
      .join(" · ");
    const savings = itemsSavings();
    const categories = catalogCategories();
    const fullCatalog = filteredFullCatalog();
    return `
      <div class="fade-in flex flex-col gap-6">
      <div class="flex flex-col lg:flex-row gap-6">
        <!-- Columna Izquierda: Carrito y Cobro -->
        <div class="w-full lg:w-[450px] xl:w-[500px] flex-shrink-0 flex flex-col gap-4 min-w-0">
          
          <!-- Buscador -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative z-20">
            <label class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">Buscar Producto</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i class="fa-solid fa-barcode text-gray-400 group-focus-within:text-brand-pink transition-colors"></i>
              </div>
              <input id="barcode-input" type="text" autocomplete="off" placeholder="Escanea SKU o busca por nombre..."
                value="${search}"
                class="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-pink focus:bg-white focus:ring-4 focus:ring-brand-pink/10 font-mono text-sm transition-all" />
            </div>
          </div>

          <!-- Carrito -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-[400px]">
            <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-white rounded-t-2xl">
              <h3 class="font-display font-bold text-gray-900 text-base"><i class="fa-solid fa-cart-shopping text-brand-mexican mr-2"></i>Venta Actual</h3>
              ${totalsLabel ? `<span class="text-[10px] font-bold uppercase tracking-widest bg-brand-pink-light/30 text-brand-mexican px-3 py-1.5 rounded-full" title="Mayoreo solo combina piezas de la misma línea">${totalsLabel}</span>` : ""}
            </div>
            
            <div class="flex-1 overflow-y-auto bg-gray-50/30 p-2 space-y-2 max-h-[50vh]">
              ${
                cart.length === 0
                  ? `<div class="flex flex-col items-center justify-center h-full py-16 text-gray-300">
                      <div class="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                        <i class="fa-solid fa-basket-shopping text-3xl"></i>
                      </div>
                      <p class="text-sm font-medium">El carrito está vacío</p>
                    </div>`
                  : cart
                      .map(
                        (item) => `
                <div data-cart-row="${item.variant.id}" class="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-brand-pink/20 transition-all flex flex-col sm:flex-row sm:items-center gap-3">
                  
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-900 text-sm leading-tight mb-1 truncate">${item.product.name}</p>
                    <p class="text-[11px] text-gray-500 font-medium">${item.variant.color} <span class="mx-1 text-gray-300">•</span> <span class="font-mono text-brand-mexican bg-brand-pink-light/20 px-1.5 py-0.5 rounded">${item.variant.sku}</span></p>
                    ${
                      item.product.is_bundle
                        ? ""
                        : `<select data-price-tier="${item.variant.id}" class="mt-2 w-full sm:w-auto text-[11px] font-semibold border border-gray-200 bg-gray-50 rounded-lg px-2 py-1.5 text-gray-600 outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/10 transition-all cursor-pointer appearance-none">
                            <option value="" ${!item.priceOverride ? "selected" : ""}>Automático (por cantidad)</option>
                            <option value="normal" ${item.priceOverride === "normal" ? "selected" : ""}>Menudeo</option>
                            <option value="wholesale" ${item.priceOverride === "wholesale" ? "selected" : ""}>Mayoreo</option>
                            <option value="super_wholesale" ${item.priceOverride === "super_wholesale" ? "selected" : ""}>Súper Mayoreo</option>
                          </select>`
                    }
                  </div>

                  <div class="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center gap-2 flex-shrink-0">
                    <p class="font-black text-gray-900 text-base">${money(lineUnitPrice(item))}</p>
                    <div class="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <button data-qty-minus="${item.variant.id}" class="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors active:bg-gray-300">
                        <i class="fa-solid fa-minus text-xs"></i>
                      </button>
                      <span class="w-10 text-center text-sm font-bold text-gray-900">${item.quantity}</span>
                      <button data-qty-plus="${item.variant.id}" class="w-10 h-10 flex items-center justify-center bg-brand-pink-light/50 text-brand-mexican hover:bg-brand-pink-light hover:text-brand-pink transition-colors active:bg-brand-pink active:text-white">
                        <i class="fa-solid fa-plus text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>`
                      )
                      .join("")
              }
            </div>

            <div class="mt-auto border-t border-gray-100 bg-white p-5 rounded-b-2xl">
              <!-- Resumen Total -->
              <div class="flex flex-col gap-3 mb-5">
                <div class="flex justify-between items-end">
                  <div>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Total a Cobrar</span>
                    <span class="text-4xl font-display font-black text-gray-900 leading-none">${money(grandTotal())}</span>
                  </div>
                  <div class="text-right">
                    ${needsShipping ? `<span class="text-[10px] text-gray-500 font-medium block">incl. ${money(shippingCostValue())} de envío</span>` : ""}
                    ${savings > 0 ? `<span class="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md mt-1 inline-block"><i class="fa-solid fa-piggy-bank mr-1"></i>Ahorro: ${money(savings)}</span>` : ""}
                  </div>
                </div>
              </div>

              <!-- Pagó Con y Cambio -->
              <div class="grid grid-cols-2 gap-3 mb-5">
                <div class="bg-gray-50 rounded-xl border border-gray-200 p-3 flex flex-col focus-within:border-brand-pink focus-within:ring-2 focus-within:ring-brand-pink/10 transition-all">
                  <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Pagó Con</span>
                  <div class="flex items-center">
                    <span class="text-gray-400 font-bold mr-1">$</span>
                    <input id="amount-paid" type="text" inputmode="decimal" class="w-full text-xl font-bold text-gray-900 outline-none bg-transparent" placeholder="0.00" value="${amountPaid}" />
                  </div>
                </div>
                <div class="bg-gray-50 rounded-xl border border-gray-200 p-3 flex flex-col">
                  <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Su Cambio</span>
                  <span class="text-xl font-black ${change() > 0 ? "text-emerald-600" : "text-gray-400"}">${money(change())}</span>
                </div>
              </div>

              <!-- Cliente y Envío -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div class="relative group">
                  <i class="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-brand-pink transition-colors"></i>
                  <input id="customer-name" type="text" placeholder="Cliente de mostrador" value="${customerName}"
                    class="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-pink focus:ring-4 focus:ring-brand-pink/10 transition-all font-medium" />
                </div>
                <label class="flex items-center justify-between gap-3 cursor-pointer bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 transition-colors">
                  <span class="text-xs font-bold text-gray-600 uppercase tracking-wider"><i class="fa-solid fa-truck mr-2 text-gray-400"></i>Envío</span>
                  <span class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input type="checkbox" id="needs-shipping" ${needsShipping ? "checked" : ""} class="peer sr-only" />
                    <span class="block w-10 h-6 bg-gray-200 peer-checked:bg-gradient-to-r peer-checked:from-brand-pink peer-checked:to-brand-mexican rounded-full transition-colors shadow-inner"></span>
                    <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></span>
                  </span>
                </label>
              </div>
              ${needsShipping ? shippingFieldsHtml() : ""}

              <!-- Métodos de Pago -->
              <div class="grid grid-cols-3 gap-3 mb-5">
                <button data-payment="cash" class="payment-btn flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all duration-300 ${
                  paymentMethod === "cash" ? "border-brand-pink bg-brand-pink-light/20 text-brand-mexican shadow-md shadow-brand-pink/10 scale-[1.02]" : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }">
                  <i class="fa-solid fa-money-bill-wave text-xl"></i>
                  <span class="text-[10px] font-bold uppercase tracking-widest">Efectivo</span>
                </button>
                <button data-payment="card" class="payment-btn flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all duration-300 ${
                  paymentMethod === "card" ? "border-brand-pink bg-brand-pink-light/20 text-brand-mexican shadow-md shadow-brand-pink/10 scale-[1.02]" : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }">
                  <i class="fa-solid fa-credit-card text-xl"></i>
                  <span class="text-[10px] font-bold uppercase tracking-widest">Terminal</span>
                </button>
                <button data-payment="spei" class="payment-btn flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all duration-300 ${
                  paymentMethod === "spei" ? "border-brand-pink bg-brand-pink-light/20 text-brand-mexican shadow-md shadow-brand-pink/10 scale-[1.02]" : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                }">
                  <i class="fa-solid fa-building-columns text-xl"></i>
                  <span class="text-[10px] font-bold uppercase tracking-widest">Transf.</span>
                </button>
              </div>
              ${
                paymentMethod === "spei"
                  ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-3">
                      <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
                      <p class="text-[11px] text-amber-800 font-medium leading-relaxed">Quedará pendiente de pago hasta que confirmes el depósito en el Dashboard.</p>
                    </div>`
                  : ""
              }
              ${error ? `<div class="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-600 text-xs font-bold text-center">${error}</div>` : ""}
              
              <!-- Botón Final -->
              <button id="checkout-btn" ${cart.length === 0 || busy ? "disabled" : ""}
                class="w-full h-16 bg-gradient-to-r from-brand-pink to-brand-mexican hover:opacity-90 text-white font-black text-xl rounded-xl shadow-lg shadow-brand-pink/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-3">
                ${busy ? `<i class="fa-solid fa-spinner fa-spin text-2xl"></i><span>Procesando...</span>` : `<i class="fa-solid fa-cash-register text-2xl"></i><span>COBRAR ${money(grandTotal())}</span>`}
              </button>
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Catálogo Completo -->
        <div class="flex-1 flex flex-col min-w-0">

          <!-- Catálogo Completo -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white">
              <h4 class="text-base font-display font-bold text-gray-900"><i class="fa-solid fa-grip text-brand-mexican mr-2"></i>Catálogo Completo</h4>
            </div>
            <div class="p-5 flex-1 bg-gray-50/30">
              <div class="mb-5 border-b border-gray-100 pb-4">
                ${categoryPillsHtml(catalogCategoryFilter, "catalog-category", categories, true)}
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                ${fullCatalog.map(({ product, variant: v }) => compactCardHtml(product, v)).join("")}
                ${fullCatalog.length === 0 ? `<div class="col-span-full text-center text-gray-400 py-12"><i class="fa-solid fa-magnifying-glass text-3xl mb-2"></i><p>Sin resultados.</p></div>` : ""}
              </div>
            </div>
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
    el.querySelectorAll("[data-price-tier]").forEach((select) => {
      select.addEventListener("change", (e) => {
        const item = findCartItem(select.dataset.priceTier);
        if (item) item.priceOverride = e.target.value || null;
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
      input.selectionStart = input.selectionEnd = input.value.length;
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
        input.selectionStart = input.selectionEnd = input.value.length;
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
            items: cart.map((item) => ({ variant_id: item.variant.id, quantity: item.quantity, price_tier: item.priceOverride })),
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
          await loadProducts();
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
        await loadProducts();
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
