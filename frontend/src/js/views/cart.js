import {
  state as appState,
  updateCartQuantity,
  removeFromCart,
  cartTotal,
  cartSavings,
  priceForQuantity,
  combinedQtyForSubcategory,
} from "../state.js";
import { bindNavLinks } from "../dom.js";
import { navigate } from "../router.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(n) {
  return currencyFormatter.format(n);
}

function subcategoryTotals() {
  const totals = {};
  appState.cart
    .filter((item) => !item.product.is_bundle)
    .forEach((item) => {
      totals[item.product.subcategory] = (totals[item.product.subcategory] || 0) + item.quantity;
    });
  return totals;
}

function lineHtml(item) {
  const price = priceForQuantity(
    item.product,
    item.product.is_bundle ? item.quantity : combinedQtyForSubcategory(item.product.subcategory)
  );
  const lineTotal = price * item.quantity;
  const isCustomBundle = item.variant.isCustom;

  return `
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-b border-gray-100 py-6 last:border-0" data-line="${item.variant.id}">
      <img src="${item.variant.image_url || NO_IMAGE_PLACEHOLDER}" class="w-24 h-24 border border-gray-200 rounded object-cover flex-shrink-0" />
      <div class="flex-grow">
        <p class="text-xs text-gray-400 uppercase tracking-wide">${item.product.category}</p>
        <p data-nav="/producto/${item.product.slug}" class="font-semibold text-gray-900 cursor-pointer hover:text-brand-mexican">${item.product.name}</p>
        <p class="text-gray-500 text-sm ${isCustomBundle ? "max-w-md" : ""}">${item.variant.color}</p>
        <p class="text-gray-900 font-bold mt-1">${money(price)} c/u</p>
      </div>
      <div class="flex items-center gap-4">
        ${
          isCustomBundle
            ? `<span class="px-4 py-2 text-gray-500 text-sm">Paquete: ${item.quantity}</span>`
            : `<div class="flex items-center border border-gray-300 rounded">
                <button data-qty-minus="${item.variant.id}" class="w-9 h-9 font-bold text-gray-600 hover:text-gray-900">-</button>
                <span class="w-10 text-center font-bold">${item.quantity}</span>
                <button data-qty-plus="${item.variant.id}" class="w-9 h-9 font-bold text-gray-600 hover:text-gray-900">+</button>
              </div>`
        }
        <span class="text-lg font-bold w-24 text-right">${money(lineTotal)}</span>
        <button data-remove="${item.variant.id}" class="text-gray-400 hover:text-red-500">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `;
}

export function renderCart(container) {
  function render() {
    if (appState.cart.length === 0) {
      container.innerHTML = `
        <div class="max-w-2xl mx-auto px-4 py-24 text-center fade-in">
          <div class="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300 text-4xl">
            <i class="fa-solid fa-cart-shopping"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h2>
          <button data-nav="/categoria/Todos" class="bg-gray-900 hover:bg-brand-mexican text-white font-semibold py-3 px-8 rounded transition-colors">
            Ir a la Tienda
          </button>
        </div>`;
      bindNavLinks(container);
      return;
    }

    const totals = subcategoryTotals();
    const totalPieces = Object.values(totals).reduce((sum, n) => sum + n, 0);
    const total = cartTotal();
    const savings = cartSavings();

    container.innerHTML = `
      <div class="max-w-5xl mx-auto px-4 py-10 fade-in">
        <h1 class="text-3xl font-bold text-gray-900 mb-8">Tu Carrito</h1>
        ${
          totalPieces > 0
            ? `<div class="bg-brand-peach-light bg-opacity-40 border border-gray-200 rounded px-4 py-3 mb-6 text-sm text-gray-700">
                <i class="fa-solid fa-tags text-brand-mexican mr-2"></i>
                El precio de mayoreo se aplica combinando piezas de la <strong>misma línea</strong>
                (no se puede combinar animado con yute, por ejemplo):
                ${Object.entries(totals)
                  .map(([subcategory, qty]) => `<strong>${qty}</strong> ${subcategory}`)
                  .join(" · ")}
              </div>`
            : ""
        }
        ${
          savings > 0
            ? `<div class="bg-green-50 border border-green-200 rounded px-4 py-3 mb-6 text-sm text-green-800 font-semibold">
                <i class="fa-solid fa-piggy-bank mr-2"></i>
                Estás ahorrando ${money(savings)} por precio de mayoreo/súper mayoreo.
              </div>`
            : ""
        }
        <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
          ${appState.cart.map((item) => lineHtml(item)).join("")}
        </div>
        <div class="border border-gray-200 rounded-lg p-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-peach-light bg-opacity-30">
          <div>
            <p class="text-gray-600 text-sm">Total (precios ya reflejan descuento por volumen)</p>
            <p class="text-3xl font-bold text-gray-900">${money(total)}</p>
          </div>
          <button id="checkout-btn" class="bg-gray-900 hover:bg-brand-mexican text-white px-8 py-4 rounded text-lg font-semibold transition-colors">
            Continuar al Pago <i class="fa-solid fa-arrow-right ml-2"></i>
          </button>
        </div>
      </div>
    `;

    container.querySelectorAll("[data-qty-minus]").forEach((el) => {
      el.addEventListener("click", () => {
        const item = appState.cart.find((i) => i.variant.id === el.dataset.qtyMinus);
        updateCartQuantity(el.dataset.qtyMinus, item.quantity - 1);
        render();
      });
    });
    container.querySelectorAll("[data-qty-plus]").forEach((el) => {
      el.addEventListener("click", () => {
        const item = appState.cart.find((i) => i.variant.id === el.dataset.qtyPlus);
        updateCartQuantity(el.dataset.qtyPlus, item.quantity + 1);
        render();
      });
    });
    container.querySelectorAll("[data-remove]").forEach((el) => {
      el.addEventListener("click", () => {
        removeFromCart(el.dataset.remove);
        render();
      });
    });

    container.querySelector("#checkout-btn").addEventListener("click", () => navigate("/checkout"));

    bindNavLinks(container);
  }

  render();
}
