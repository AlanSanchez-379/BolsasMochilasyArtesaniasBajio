import { escapeHtml, optimizeSupabaseImageUrl } from "../html.js";
import { priceForQuantity } from "../pricing.js";
import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(n) {
  return currencyFormatter.format(n);
}

export function findLoteriaVariantImage(product) {
  const kws = ["loteria", "lotería", "patrio"];
  const matchedVar = (product.variants ?? []).find(v => kws.some(kw =>
    (v.color || "").toLowerCase().includes(kw) ||
    (v.sku || "").toLowerCase().includes(kw)
  ));
  return matchedVar?.image_url || null;
}

export function getHourlyRandomIndex(productId, maxIndex) {
  const hour = Math.floor(Date.now() / 3600000);
  let hash = hour;
  for (let i = 0; i < productId.length; i++) {
    hash = (hash * 31 + productId.charCodeAt(i)) % 1000000007;
  }
  return hash % maxIndex;
}

export function productCardHtml(product, customImage = null) {
  const totalStock = (product.variants ?? []).reduce((sum, v) => sum + Number(v.stock || 0), 0);

  let defaultImage = customImage;
  if (!defaultImage) {
    const variantsWithImages = (product.variants ?? []).filter((v) => v.image_url);
    if (variantsWithImages.length > 0) {
      const idx = getHourlyRandomIndex(product.id, variantsWithImages.length);
      defaultImage = variantsWithImages[idx].image_url;
    } else {
      defaultImage = NO_IMAGE_PLACEHOLDER;
    }
  }

  const optimizedImage = optimizeSupabaseImageUrl(defaultImage, 300, 400);

  return `
    <a href="/producto/${encodeURIComponent(product.slug)}" data-nav="/producto/${encodeURIComponent(product.slug)}" class="flex flex-col cursor-pointer group bg-white border border-gray-100 p-3 sm:p-4 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
      <div class="relative overflow-hidden bg-gray-50 aspect-[4/5] mb-4 rounded-lg w-full">
        <img src="${escapeHtml(optimizedImage)}" width="300" height="400" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ${
          totalStock === 0
            ? `<div class="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10">
                <span class="bg-gray-900 text-white font-bold py-1.5 px-4 text-xs tracking-widest rounded-full uppercase">AGOTADO</span>
              </div>`
            : ""
        }
        ${
          product.is_bundle
            ? `<span class="absolute top-3 left-3 bg-brand-mexican text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">PAQUETE</span>`
            : product.is_on_sale
              ? `<span class="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">OFERTA</span>`
              : ""
        }
      </div>
      <div class="flex flex-col mt-auto">
        <p class="text-[10px] text-gray-500 mb-1.5 uppercase tracking-widest font-semibold">${escapeHtml(product.category)}</p>
        <h3 class="text-sm font-semibold text-gray-900 mb-3 line-clamp-2 group-hover:text-brand-mexican transition-colors leading-tight">${escapeHtml(product.name)}</h3>
        <div class="mt-auto">
          ${product.is_on_sale && product.sale_price != null && Number(priceForQuantity(product, 1)) < Number(product.price_normal)
            ? `<p class="text-xs text-gray-600 line-through">Antes: ${money(product.price_normal)}</p>` : ""}
          <p class="text-lg font-bold text-gray-900">${money(priceForQuantity(product, 1))}</p>
          <p class="text-xs text-gray-600">${product.is_bundle ? "Por paquete" : "Por pieza"} · MXN</p>
          ${!product.is_bundle && product.wholesale_min_qty > 1
            ? `<p class="text-xs text-gray-700 mt-2">Mayoreo: <strong>${money(product.price_wholesale)}</strong> desde ${product.wholesale_min_qty} piezas de la misma línea.</p>` : ""}
          ${totalStock > 0 ? '<p class="text-xs text-emerald-700 font-semibold mt-2"><i class="fa-solid fa-circle-check mr-1.5"></i>Disponible en stock</p>' : ""}
        </div>
      </div>
    </a>
  `;
}
