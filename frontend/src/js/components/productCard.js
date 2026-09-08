import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(n) {
  return currencyFormatter.format(n);
}

export function findLoteriaVariantImage(product) {
  const kws = ["loteria", "lotería", "patrio"];
  const matchedVar = product.variants.find(v => kws.some(kw => 
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
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  
  let defaultImage = customImage;
  if (!defaultImage) {
    const variantsWithImages = product.variants.filter((v) => v.image_url);
    if (variantsWithImages.length > 0) {
      const idx = getHourlyRandomIndex(product.id, variantsWithImages.length);
      defaultImage = variantsWithImages[idx].image_url;
    } else {
      defaultImage = NO_IMAGE_PLACEHOLDER;
    }
  }

  return `
    <div data-nav="/producto/${product.slug}" class="flex flex-col cursor-pointer group bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full relative overflow-hidden">
      <div class="relative overflow-hidden bg-gray-50 aspect-[4/5] mb-4 rounded-lg w-full">
        <img src="${defaultImage}" alt="${product.name}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
        <p class="text-[10px] text-gray-500 mb-1.5 uppercase tracking-widest font-semibold">${product.category}</p>
        <h3 class="text-sm font-semibold text-gray-900 mb-3 line-clamp-2 group-hover:text-brand-mexican transition-colors leading-tight">${product.name}</h3>
        <div class="mt-auto">
          ${
            product.is_on_sale
              ? `<p class="text-xs text-gray-400 line-through mb-0.5">Antes: ${money(product.price_normal)}</p>
                 <p class="text-lg font-bold text-red-500">${money(product.sale_price)} <span class="text-[10px] font-bold tracking-wide text-red-400 uppercase ml-1">Oferta</span></p>`
              : `<p class="text-xs text-gray-400 line-through mb-0.5">Menudeo: ${money(product.price_normal)}</p>
                 <p class="text-lg font-bold text-gray-900">${money(product.price_wholesale)} <span class="text-[10px] font-bold tracking-wide text-brand-salmon uppercase ml-1">Mayoreo</span></p>`
          }
          ${totalStock > 0 ? '<p class="text-[11px] text-emerald-600 font-semibold mt-2"><i class="fa-solid fa-circle-check mr-1.5"></i>Disponible en stock</p>' : ""}
        </div>
      </div>
    </div>
  `;
}
