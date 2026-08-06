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
// piezas de productos normales en el carrito, sin importar si son de distintos productos
// (ej. 5 bolsas + 1 monedero = 6 piezas -> todas al precio de mayoreo). Los paquetes
// tienen precio fijo y no participan en esta suma.
export function priceForQuantity(product, quantity) {
  if (quantity >= product.super_wholesale_min_qty) return product.price_super_wholesale;
  if (quantity >= product.wholesale_min_qty) return product.price_wholesale;
  return product.price_normal;
}

export function combinedNonBundleQty() {
  return state.cart
    .filter((item) => !item.product.is_bundle)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function cartTotal() {
  const combinedQty = combinedNonBundleQty();
  return state.cart.reduce((total, item) => {
    const qty = item.product.is_bundle ? item.quantity : combinedQty;
    const price = priceForQuantity(item.product, qty);
    return total + price * item.quantity;
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

export function isAdmin() {
  return state.currentUser && state.currentUser.role !== "client";
}
