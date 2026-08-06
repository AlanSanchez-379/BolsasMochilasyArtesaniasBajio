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
  user: { role: "client", name: "Invitado" },
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

// Precio por volumen: la cantidad se agrupa por PRODUCTO (no por variante).
export function priceForQuantity(product, quantity) {
  if (quantity >= product.super_wholesale_min_qty) return product.price_super_wholesale;
  if (quantity >= product.wholesale_min_qty) return product.price_wholesale;
  return product.price_normal;
}

export function cartTotal() {
  const qtyByProduct = state.cart.reduce((acc, item) => {
    acc[item.product.id] = (acc[item.product.id] || 0) + item.quantity;
    return acc;
  }, {});
  return state.cart.reduce((total, item) => {
    const price = priceForQuantity(item.product, qtyByProduct[item.product.id]);
    return total + price * item.quantity;
  }, 0);
}

export function setUser(user) {
  state.user = user;
  notify();
}
