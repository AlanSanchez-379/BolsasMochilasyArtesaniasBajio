import { NO_IMAGE_PLACEHOLDER } from "../imageFallback.js";

export function productCardHtml(product) {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const defaultImage = product.variants[0]?.image_url || NO_IMAGE_PLACEHOLDER;

  return `
    <div data-nav="/producto/${product.slug}" class="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-xl transition-shadow group flex flex-col h-full border border-gray-100">
      <div class="relative">
        <img src="${defaultImage}" alt="${product.name}" class="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300" />
        ${
          totalStock === 0
            ? `<div class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                <span class="bg-red-500 text-white px-4 py-2 rounded-lg text-xl font-bold transform -rotate-12">AGOTADO</span>
              </div>`
            : ""
        }
        ${
          product.is_bundle
            ? `<span class="absolute top-4 right-4 bg-brand-salmon text-white px-3 py-1 rounded-full text-sm font-bold shadow">Paquete</span>`
            : ""
        }
      </div>
      <div class="p-5 flex flex-col flex-grow">
        <p class="text-sm text-gray-500 mb-1 uppercase tracking-wide">${product.category}</p>
        <h3 class="text-xl font-semibold mb-2 flex-grow">${product.name}</h3>
        <div class="mt-auto">
          <p class="text-gray-500 line-through text-sm">Menudeo: $${product.price_normal}</p>
          <p class="text-2xl font-bold text-brand-blue-dark">Mayoreo: $${product.price_wholesale}</p>
          <p class="text-sm text-brand-teal font-medium mt-1">
            ${totalStock > 0 ? '<i class="fa-solid fa-circle-check"></i> Disponible' : ""}
          </p>
        </div>
      </div>
    </div>
  `;
}
