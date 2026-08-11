import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

export function productCardHtml(product) {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const defaultImage = product.variants[0]?.image_url || NO_IMAGE_PLACEHOLDER;

  return `
    <div data-nav="/producto/${product.slug}" class="flex flex-col cursor-pointer group border border-gray-200 p-3 hover:border-brand-pink transition-colors bg-white h-full rounded-lg">
      <div class="relative overflow-hidden bg-gray-50 aspect-square mb-3 rounded">
        <img src="${defaultImage}" alt="${product.name}" class="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
        ${
          totalStock === 0
            ? `<div class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                <span class="bg-gray-800 text-white font-bold py-1 px-4 text-sm rounded">AGOTADO</span>
              </div>`
            : ""
        }
        ${
          product.is_bundle
            ? `<span class="absolute top-2 left-2 bg-brand-mexican text-white text-xs font-bold px-2 py-1 rounded">PAQUETE</span>`
            : ""
        }
      </div>
      <div class="flex flex-col mt-auto">
        <p class="text-xs text-gray-400 mb-1 uppercase tracking-wide">${product.category}</p>
        <h3 class="text-sm font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-brand-mexican transition-colors">${product.name}</h3>
        <div>
          <p class="text-xs text-gray-400 line-through">Menudeo: $${product.price_normal}</p>
          <p class="text-lg font-bold text-gray-900">$${product.price_wholesale} <span class="text-xs font-normal text-gray-400">Mayoreo</span></p>
          ${totalStock > 0 ? '<p class="text-xs text-brand-mexican font-semibold mt-1"><i class="fa-solid fa-circle-check mr-1"></i>Disponible</p>' : ""}
        </div>
      </div>
    </div>
  `;
}
