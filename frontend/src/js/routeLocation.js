// Keep legacy email/OAuth callbacks intact until the authentication handler reads them.
export function readRouteLocation(href) {
  const url = new URL(href);
  const legacy = url.hash.startsWith("#/");
  const source = legacy ? url.hash.slice(1) : url.pathname + url.search;
  const path = source.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const queryText = source.includes("?") ? source.slice(source.indexOf("?") + 1).split("#")[0] : "";
  const query = new URLSearchParams(queryText);
  return { path, query, migration: legacy && path !== "/auth/callback" ? path + (queryText ? `?${queryText}` : "") : null };
}

export function isAppPath(path) {
  return /^\/(?:$|(?:categoria|producto)\/[^/]+\/?$|(?:carrito|checkout|login|registro|mis-pedidos|politica-envios|politica-privacidad|terminos-y-condiciones|venta-local)\/?$|auth\/callback\/?$)/.test(path);
}
