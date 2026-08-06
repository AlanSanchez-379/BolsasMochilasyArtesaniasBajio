import { API_BASE } from "./config.js";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
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

  checkoutQuote: (postalCode) =>
    request("/checkout/quote", { method: "POST", body: JSON.stringify({ postal_code: postalCode }) }),
  createOrder: (payload) => request("/checkout", { method: "POST", body: JSON.stringify(payload) }),

  myOrders: () => request("/orders"),
  getOrder: (id) => request(`/orders/${id}`),
  adminListOrders: (status) => request(`/orders/admin/all${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  adminUpdateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  adminStats: () => request("/admin/stats"),
  adminListProducts: () => request("/admin/products"),
  adminCreateProduct: (payload) => request("/admin/products", { method: "POST", body: JSON.stringify(payload) }),
  adminUpdateProduct: (id, payload) =>
    request(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminDeleteProduct: (id) => request(`/admin/products/${id}`, { method: "DELETE" }),
  adminSetEligibleProducts: (id, eligibleProductIds) =>
    request(`/admin/products/${id}/eligible-products`, {
      method: "PUT",
      body: JSON.stringify({ eligible_product_ids: eligibleProductIds }),
    }),
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
};
