export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

export function optimizeSupabaseImageUrl(url, width, height) {
  if (!url || typeof url !== "string") return url;
  if (url.includes("/object/public/")) {
    let optUrl = url.replace("/object/public/", "/render/image/public/");
    optUrl += `?format=webp`;
    if (width) optUrl += `&width=${width}`;
    if (height) optUrl += `&height=${height}`;
    if (width || height) optUrl += `&resize=cover`;
    return optUrl;
  }
  return url;
}
