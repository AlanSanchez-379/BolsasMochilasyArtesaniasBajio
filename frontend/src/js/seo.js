import { priceForQuantity } from "./pricing.js";

const BRAND = "Bolsas, Mochilas y Artesanías del Bajío";
const DEFAULT_DESCRIPTION = "Bolsas, mochilas y artesanías en León, Guanajuato. Consulta precios por pieza, descuentos por volumen y paquetes para surtir tu negocio.";

function meta(key, content, attribute = "name") {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

export function setPageMetadata({ title = BRAND, description = DEFAULT_DESCRIPTION, image, noindex = false } = {}) {
  document.title = title;
  meta("description", description);
  meta("robots", noindex ? "noindex, follow" : "index, follow");
  meta("og:title", title, "property");
  meta("og:description", description, "property");
  meta("og:type", "website", "property");
  meta("og:locale", "es_MX", "property");
  
  const canonicalUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  meta("og:url", canonicalUrl, "property");
  
  let linkCanonical = document.head.querySelector('link[rel="canonical"]');
  if (!linkCanonical) {
    linkCanonical = document.createElement("link");
    linkCanonical.setAttribute("rel", "canonical");
    document.head.append(linkCanonical);
  }
  linkCanonical.href = canonicalUrl;

  meta("twitter:card", image ? "summary_large_image" : "summary");
  document.getElementById("product-structured-data")?.remove();
  document.head.querySelector('meta[property="og:image"]')?.remove();
  if (image) meta("og:image", image, "property");
}

export function resetRouteMetadata(path, query) {
  const names = { "/carrito": "Carrito", "/checkout": "Finalizar compra", "/login": "Iniciar sesión", "/registro": "Crear cuenta", "/mis-pedidos": "Mis pedidos", "/politica-envios": "Política de envíos", "/politica-privacidad": "Política de privacidad", "/terminos-y-condiciones": "Términos y condiciones" };
  const isCatalog = path.startsWith("/categoria/");
  const name = names[path] || (isCatalog ? decodeURIComponent(path.slice(11)) : "");
  setPageMetadata({
    title: name ? `${name} | ${BRAND}` : BRAND,
    description: isCatalog ? `Explora ${name === "Todos" ? "nuestro catálogo de bolsas, mochilas y artesanías" : name}. Consulta disponibilidad, precios por pieza y cantidades para descuentos por volumen.` : DEFAULT_DESCRIPTION,
    noindex: ["/carrito", "/checkout", "/login", "/registro", "/mis-pedidos", "/auth/callback", "/venta-local"].includes(path) || query.has("q"),
  });
}

export function setProductMetadata(product) {
  const image = (product.variants ?? []).find(v => v.image_url)?.image_url;
  setPageMetadata({ title: `${product.name} | ${BRAND}`, description: product.description || `Consulta variantes, disponibilidad y precios de ${product.name}.`, image });
  // Bundle availability depends on its eligible component stock, not just its own variants.
  if (product.is_bundle) return;
  const data = {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.description || undefined, image: image ? [image] : undefined,
    offers: {
      "@type": "Offer", url: window.location.href, priceCurrency: "MXN",
      price: Number(priceForQuantity(product, 1)),
      availability: (product.variants ?? []).some(v => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "product-structured-data";
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}
