const API_BASE = "http://127.0.0.1:5000/api";

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

export const api = {
  getCategories: () => request("/categories"),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (slug) => request(`/products/${slug}`),
};
