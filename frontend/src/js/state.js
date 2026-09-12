import { priceForQuantity } from "./pricing.js";
export { priceForQuantity } from "./pricing.js";
const CART_STORAGE_KEY = "bma_cart";

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

const listeners = new Set();

export const state = {
  cart: loadCart(), // [{ product, variant, quantity }]
  currentUser: null, // null = invitado, o { id, email, full_name, role }
};

function persist() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function addToCart(product, variant, quantity) {
  const existing = state.cart.find((item) => item.variant.id === variant.id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, variant.stock);
  } else {
    state.cart.push({ product, variant, quantity });
  }
  persist();
  notify();
}

export function updateCartQuantity(variantId, quantity) {
  const item = state.cart.find((i) => i.variant.id === variantId);
  if (!item) return;
  item.quantity = Math.min(Math.max(1, quantity), item.variant.stock);
  persist();
  notify();
}

export function removeFromCart(variantId) {
  state.cart = state.cart.filter((i) => i.variant.id !== variantId);
  persist();
  notify();
}

export function clearCart() {
  state.cart = [];
  persist();
  notify();
}

export function cartItemsCount() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Mayoreo combinado (Mix & Match): el precio por volumen se decide por el total de
// piezas de productos normales de la MISMA línea (Categoría + Tipo de Estampado) en el carrito.
// Los paquetes tienen precio fijo y no participan en esta suma.

export function combinedQtyForProductLine(product) {
  return state.cart
    .filter((item) => !item.product.is_bundle && item.product.category_id === product.category_id && item.product.print_type === product.print_type)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function cartTotal() {
  return state.cart.reduce((total, item) => {
    const qty = item.product.is_bundle ? 1 : combinedQtyForProductLine(item.product);
    const price = priceForQuantity(item.product, qty);
    return total + price * item.quantity;
  }, 0);
}

// Cuánto se está ahorrando el cliente vs. precio de menudeo, sumando las líneas del
// carrito que ya alcanzaron mayoreo/súper mayoreo por combinar piezas de su misma línea.
export function cartSavings() {
  return state.cart.reduce((total, item) => {
    if (item.product.is_bundle) return total;
    const qty = combinedQtyForProductLine(item.product);
    const price = priceForQuantity(item.product, qty);
    return total + (Number(item.product.price_normal) - price) * item.quantity;
  }, 0);
}

// Traduce las líneas del carrito al payload que espera POST /api/checkout.
export function buildCheckoutItems() {
  return state.cart.map((item) => {
    if (item.variant.isCustom) {
      return {
        type: "bundle_custom",
        product_id: item.product.id,
        selections: Object.entries(item.variant.selections).map(([variant_id, quantity]) => ({
          variant_id,
          quantity,
        })),
      };
    }
    if (item.variant.isFixedBundle) {
      return {
        type: "bundle_fixed",
        product_id: item.product.id,
        quantity: 1,
        selections: Object.entries(item.variant.selections).map(([variant_id, quantity]) => ({
          variant_id,
          quantity,
        })),
      };
    }
    if (item.product.is_bundle) {
      return { type: "bundle_random", product_id: item.product.id, quantity: item.quantity };
    }
    return {
      type: "simple",
      product_id: item.product.id,
      variant_id: item.variant.id,
      quantity: item.quantity,
    };
  });
}

export function setCurrentUser(user) {
  state.currentUser = user;
  notify();
}
