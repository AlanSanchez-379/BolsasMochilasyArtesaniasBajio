import { API_BASE } from "./config.js";
import { state, setCurrentUser } from "./state.js";
import { navigate } from "./router.js";

// Si creíamos tener sesión (currentUser ya cargado) y el backend responde 401, el
// token de Supabase expiró a medio uso: limpiamos el estado local y mandamos a login
// en vez de dejar la vista actual colgada con un fetch fallido. Si currentUser ya era
// null (invitado, o falló un intento de login), no se toca nada — evita loops de
// redirección en /auth/me al arrancar la app o en la propia pantalla de login.
function handleUnauthorized() {
  if (state.currentUser) {
    setCurrentUser(null);
    navigate("/login");
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error ${res.status} en ${path}`);
  }
  return res.json();
}

async function upload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData, // sin Content-Type manual: el navegador arma el boundary del multipart
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Error ${res.status} en ${path}`);
  }
  return res.json();
}

export const api = {
  getSettings: () => request("/settings"),

  getCategories: () => request("/categories"),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (slug) => request(`/products/${slug}`),
  getBestsellers: (limit = 4, raw = false) => request(`/products/bestsellers?limit=${limit}${raw ? "&raw=true" : ""}`),

  register: (email, password, fullName) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  oauthCallback: (accessToken) =>
    request("/auth/oauth-callback", { method: "POST", body: JSON.stringify({ access_token: accessToken }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  resetPassword: (email) => request("/auth/reset-password", { method: "POST", body: JSON.stringify({ email }) }),

  checkoutQuote: (shipping, items) =>
    request("/checkout/quote", { method: "POST", body: JSON.stringify({ ...shipping, items }) }),
  createOrder: (payload) => request("/checkout", { method: "POST", body: JSON.stringify(payload) }),
  uploadOrderVoucher: (orderId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return upload(`/orders/${orderId}/voucher`, formData);
  },

  myOrders: () => request("/orders"),
  getOrder: (id) => request(`/orders/${id}`),
  adminListOrders: (status) => request(`/orders/admin/all${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminUpdateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminGetShipmentRates: (orderId, payload) =>
    request(`/orders/${orderId}/shipment/rates`, { method: "POST", body: JSON.stringify(payload) }),
  adminPurchaseShipmentLabel: (orderId, payload) =>
    request(`/orders/${orderId}/shipment/purchase`, { method: "POST", body: JSON.stringify(payload) }),

};

// Liga de venta local (/venta-local): PIN compartido, sin cuenta de Supabase. Es la
// ÚNICA superficie administrativa del sitio (el panel /admin con cuentas de Supabase
// se retiró por completo). No usa request()/handleUnauthorized() porque un 401 aquí
// debe regresar al prompt de PIN, no mandar al login de clientes.
async function posAccessFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("pos_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { ...headers, ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Error ${res.status} en ${path}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function posAccessUpload(path, formData) {
  const headers = {};
  const token = localStorage.getItem("pos_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: formData, // sin Content-Type manual: el navegador arma el boundary del multipart
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Error ${res.status} en ${path}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const posAccessApi = {
  login: (password) => posAccessFetch("/pos-access/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => posAccessFetch("/pos-access/logout", { method: "POST" }),
  me: () => posAccessFetch("/pos-access/me"),
  listProducts: () => posAccessFetch("/pos-access/products"),
  sale: (payload) => posAccessFetch("/pos-access/sale", { method: "POST", body: JSON.stringify(payload) }),
  stats: (period) => posAccessFetch(period ? `/pos-access/stats?period=${period}` : "/pos-access/stats"),
  updateOrderStatus: (id, status) =>
    posAccessFetch(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Catálogo (productos y paquetes comparten estos mismos endpoints, is_bundle decide cuál es cuál)
  createProduct: (payload) => posAccessFetch("/admin/products", { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (id, payload) =>
    posAccessFetch(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (id) => posAccessFetch(`/admin/products/${id}`, { method: "DELETE" }),
  createVariant: (productId, payload) =>
    posAccessFetch(`/admin/products/${productId}/variants`, { method: "POST", body: JSON.stringify(payload) }),
  updateVariant: (variantId, payload) =>
    posAccessFetch(`/admin/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteVariant: (variantId) => posAccessFetch(`/admin/variants/${variantId}`, { method: "DELETE" }),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return posAccessUpload("/admin/upload-image", formData);
  },
  uploadVariantImage: (variantId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return posAccessUpload(`/admin/variants/${variantId}/image`, formData);
  },
  productImageHistory: () => posAccessFetch("/admin/products/image-history"),

  // Pedidos (todos los canales)
  listOrders: () => posAccessFetch("/orders/admin/all"),
  getShipmentRates: (orderId, payload) =>
    posAccessFetch(`/orders/${orderId}/shipment/rates`, { method: "POST", body: JSON.stringify(payload) }),
  purchaseShipmentLabel: (orderId, payload) =>
    posAccessFetch(`/orders/${orderId}/shipment/purchase`, { method: "POST", body: JSON.stringify(payload) }),
  updateShippingCost: (orderId, shippingCost) =>
    posAccessFetch(`/orders/${orderId}/shipping-cost`, { method: "PATCH", body: JSON.stringify({ shipping_cost: shippingCost }) }),

  // Ajustes (branding, envío, PIN de esta misma terminal)
  getAdminSettings: () => posAccessFetch("/admin/settings"),
  uploadSettingImage: (type, file) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return posAccessUpload("/admin/settings/upload", formData);
  },
  settingsHistory: (type) => posAccessFetch(`/admin/settings/history?type=${encodeURIComponent(type)}`),
  setSetting: (key, value) =>
    posAccessFetch("/admin/settings", { method: "PATCH", body: JSON.stringify({ key, value }) }),
  getShippingSettings: () => posAccessFetch("/admin/shipping-settings"),
  updateShippingSettings: (payload) =>
    posAccessFetch("/admin/shipping-settings", { method: "PATCH", body: JSON.stringify(payload) }),
  getPaymentSettings: () => posAccessFetch("/admin/payment-settings"),
  updatePaymentSettings: (payload) =>
    posAccessFetch("/admin/payment-settings", { method: "PATCH", body: JSON.stringify(payload) }),
  getTicketSettings: () => posAccessFetch("/admin/ticket-settings"),
  updateTicketSettings: (payload) =>
    posAccessFetch("/admin/ticket-settings", { method: "PATCH", body: JSON.stringify(payload) }),
  getPosAccessSettings: () => posAccessFetch("/admin/pos-access-settings"),
  updatePosAccessSettings: (pin, emp_pin) =>
    posAccessFetch("/admin/pos-access-settings", {
      method: "PATCH",
      body: JSON.stringify({ pin, emp_pin }),
    }),
};
