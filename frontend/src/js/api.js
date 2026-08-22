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
  getBestsellers: (limit = 4) => request(`/products/bestsellers?limit=${limit}`),

  register: (email, password, fullName) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  oauthCallback: (accessToken) =>
    request("/auth/oauth-callback", { method: "POST", body: JSON.stringify({ access_token: accessToken }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),

  checkoutQuote: (shipping, items) =>
    request("/checkout/quote", { method: "POST", body: JSON.stringify({ ...shipping, items }) }),
  createOrder: (payload) => request("/checkout", { method: "POST", body: JSON.stringify(payload) }),

  myOrders: () => request("/orders"),
  getOrder: (id) => request(`/orders/${id}`),
  adminListOrders: (status) => request(`/orders/admin/all${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminUpdateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminGetShipmentRates: (orderId, payload) =>
    request(`/orders/${orderId}/shipment/rates`, { method: "POST", body: JSON.stringify(payload) }),
  adminPurchaseShipmentLabel: (orderId, payload) =>
    request(`/orders/${orderId}/shipment/purchase`, { method: "POST", body: JSON.stringify(payload) }),

  adminStats: () => request("/admin/stats"),
  adminPosSale: (payload) => request("/admin/pos/sale", { method: "POST", body: JSON.stringify(payload) }),
  adminListProducts: () => request("/admin/products"),
  adminCreateProduct: (payload) => request("/admin/products", { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateProduct: (id, payload) =>
    request(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminDeleteProduct: (id) => request(`/admin/products/${id}`, { method: "DELETE" }),
  adminCreateVariant: (productId, payload) =>
    request(`/admin/products/${productId}/variants`, { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateVariant: (variantId, payload) =>
    request(`/admin/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminDeleteVariant: (variantId) => request(`/admin/variants/${variantId}`, { method: "DELETE" }),
  adminUploadImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return upload("/admin/upload-image", formData);
  },
  adminUploadVariantImage: (variantId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    return upload(`/admin/variants/${variantId}/image`, formData);
  },
  adminProductImageHistory: () => request("/admin/products/image-history"),

  adminListUsers: () => request("/admin/users"),
  adminUpdateUserRole: (userId, role) =>
    request(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),

  adminGetSettings: () => request("/admin/settings"),
  adminUploadSettingImage: (type, file) => {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    return upload("/admin/settings/upload", formData);
  },
  adminSettingsHistory: (type) => request(`/admin/settings/history?type=${encodeURIComponent(type)}`),
  adminSetSetting: (key, value) =>
    request("/admin/settings", { method: "PATCH", body: JSON.stringify({ key, value }) }),

  adminGetShippingSettings: () => request("/admin/shipping-settings"),
  adminUpdateShippingSettings: (payload) =>
    request("/admin/shipping-settings", { method: "PATCH", body: JSON.stringify(payload) }),

  adminGetPosAccessSettings: () => request("/admin/pos-access-settings"),
  adminUpdatePosAccessSettings: (pin) =>
    request("/admin/pos-access-settings", { method: "PATCH", body: JSON.stringify({ pin }) }),
};

// Liga de venta local (/venta-local): PIN compartido, sin cuenta de Supabase. No usa
// request()/handleUnauthorized() porque un 401 aquí debe regresar al prompt de PIN,
// no mandar al login de clientes.
async function posAccessFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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

export const posAccessApi = {
  login: (password) => posAccessFetch("/pos-access/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => posAccessFetch("/pos-access/logout", { method: "POST" }),
  me: () => posAccessFetch("/pos-access/me"),
  listProducts: () => posAccessFetch("/pos-access/products"),
  sale: (payload) => posAccessFetch("/pos-access/sale", { method: "POST", body: JSON.stringify(payload) }),
};
