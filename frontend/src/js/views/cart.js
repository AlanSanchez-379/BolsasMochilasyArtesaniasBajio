import {
  state as appState,
  updateCartQuantity,
  removeFromCart,
  cartTotal,
  priceForQuantity,
  combinedNonBundleQty,
} from "../state.js";
import { bindNavLinks } from "../dom.js";
import { navigate } from "../router.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

function lineHtml(item, combinedQty) {
  const price = priceForQuantity(item.product, item.product.is_bundle ? item.quantity : combinedQty);
  const lineTotal = price * item.quantity;
  const isCustomBundle = item.variant.isCustom;

  return `
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center border-b border-gray-100 py-6" data-line="${item.variant.id}">
      <img src="${item.variant.image_url || NO_IMAGE_PLACEHOLDER}" class="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
      <div class="flex-grow">
        <p class="text-sm text-gray-500 uppercase">${item.product.category}</p>
        <p data-nav="/producto/${item.product.slug}" class="text-lg font-semibold cursor-pointer hover:text-brand-blue">${item.product.name}</p>
        <p class="text-gray-500 text-sm ${isCustomBundle ? "max-w-md" : ""}">${item.variant.color}</p>
        <p class="text-brand-blue-dark font-bold mt-1">$${price} c/u</p>
      </div>
      <div class="flex items-center gap-4">
        ${
          isCustomBundle
            ? `<span class="px-4 py-2 text-gray-500">Paquete: ${item.quantity}</span>`
            : `<div class="flex items-center border-2 border-gray-200 rounded-full">
                <button data-qty-minus="${item.variant.id}" class="w-9 h-9 font-bold text-brand-blue-dark">-</button>
                <span class="w-10 text-center font-bold">${item.quantity}</span>
                <button data-qty-plus="${item.variant.id}" class="w-9 h-9 font-bold text-brand-blue-dark">+</button>
              </div>`
        }
        <span class="text-xl font-bold w-24 text-right">$${lineTotal}</span>
        <button data-remove="${item.variant.id}" class="text-red-400 hover:text-red-600">
          <i class="fa-solid fa-trash-can text-xl"></i>
        </button>
      </div>
    </div>
  `;
}

export function renderCart(container) {
  function render() {
    if (appState.cart.length === 0) {
      container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-24 text-center fade-in">
          <i class="fa-solid fa-cart-shopping text-6xl text-brand-cream mb-6"></i>
          <h2 class="text-3xl font-bold mb-4">Tu carrito está vacío</h2>
          <button data-nav="/categoria/Todos" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">
            Ir al catálogo
          </button>
        </div>`;
      bindNavLinks(container);
      return;
    }

    const combinedQty = combinedNonBundleQty();
    const total = cartTotal();

    container.innerHTML = `
      <div class="max-w-5xl mx-auto px-4 py-10 fade-in">
        <h1 class="text-3xl font-bold mb-8">Tu Carrito</h1>
        ${
          combinedQty > 0
            ? `<div class="bg-brand-teal bg-opacity-20 border border-brand-teal rounded-xl px-4 py-3 mb-6 text-sm">
                <i class="fa-solid fa-tags text-brand-teal mr-2"></i>
                Llevas <strong>${combinedQty}</strong> piezas combinadas de productos normales — el precio de mayoreo
                se aplica sumando todos tus productos, sin importar el modelo.
              </div>`
            : ""
        }
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          ${appState.cart.map((item) => lineHtml(item, combinedQty)).join("")}
        </div>
        <div class="bg-brand-cream rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <p class="text-gray-600">Total (precios ya reflejan descuento por volumen)</p>
            <p class="text-3xl font-bold text-brand-blue-dark">$${total}</p>
          </div>
          <button id="checkout-btn" class="bg-brand-blue-dark text-white px-8 py-4 rounded-full text-xl font-semibold hover:bg-brand-blue shadow-lg">
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
