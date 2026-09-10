import { posAccessApi } from "../../api.js";
import { showConfirmModal } from "../../components/confirmModal.js";
import { getCategories } from "../../catalogCache.js";
import { renderVariantsSection, renderNewVariantsBuilder } from "../../components/productVariants.js";
import { money, marginHtml, openFormModal, getNextSku } from "./shared.js";

// --- Sección "Catálogo": CRUD completo de productos (no paquetes), con costo/margen
// visibles en la tabla -- absorbe lo que antes era la tabla de solo lectura "Inventario". ---
export function createCatalogoSection(onUnauthorized) {
  return {
    async mount(container) {
      container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando catálogo...</div>`;

      let categories, subcategories, products, allProducts;
      try {
        [{ categories, subcategories }, { products: allProducts }] = await Promise.all([
          getCategories(),
          posAccessApi.listProducts(),
        ]);
        products = allProducts.filter((p) => !p.is_bundle);
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }

      let filterCategory = "Todas";
      let filterSubcategory = "Todas";
      let viewMode = "list";

      function filteredProducts() {
        return products.filter(
          (p) =>
            (filterCategory === "Todas" || p.category === filterCategory) &&
            (filterSubcategory === "Todas" || p.subcategory === filterSubcategory)
        );
      }

      function render() {
        const visible = filteredProducts();

        container.innerHTML = `
          <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div class="flex flex-wrap gap-3">
              <select id="filter-category" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="Todas">Todas las categorías</option>
                ${categories.map((c) => `<option value="${c.name}" ${filterCategory === c.name ? "selected" : ""}>${c.name}</option>`).join("")}
              </select>
              <select id="filter-subcategory" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="Todas">Todas las subcategorías</option>
                ${subcategories.map((s) => `<option value="${s}" ${filterSubcategory === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
            <div class="flex items-center gap-3">
              <div class="bg-gray-100 p-1 rounded-lg flex items-center gap-1">
                <button id="view-list-btn" class="${viewMode === 'list' ? 'bg-white shadow-sm text-brand-mexican' : 'text-gray-500 hover:text-gray-700'} px-3 py-1.5 rounded-md text-sm transition-all"><i class="fa-solid fa-list"></i></button>
                <button id="view-grid-btn" class="${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-mexican' : 'text-gray-500 hover:text-gray-700'} px-3 py-1.5 rounded-md text-sm transition-all"><i class="fa-solid fa-border-all"></i></button>
              </div>
              <button id="new-product-btn" class="bg-brand-mexican text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
                <i class="fa-solid fa-plus mr-2"></i>Nuevo Producto
              </button>
            </div>
          </div>
          <p class="text-gray-500 mb-4 text-sm font-medium">${visible.length} de ${products.length} productos</p>

          ${viewMode === "list" ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto mb-8">
            <table class="w-full text-left">
              <thead class="bg-gray-50 text-sm uppercase text-gray-600">
                <tr>
                  <th class="px-4 py-3">Nombre</th>
                  <th class="px-4 py-3">Categoría</th>
                  <th class="px-4 py-3">Subcategoría</th>
                  ${window.posRole !== "employee" ? '<th class="px-4 py-3">Costo</th>' : ''}
                  <th class="px-4 py-3">Precio</th>
                  ${window.posRole !== "employee" ? '<th class="px-4 py-3">Margen</th>' : ''}
                  <th class="px-4 py-3">Stock total</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                ${visible
                  .map((p) => {
                    const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                    return `
                    <tr class="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td class="px-4 py-3 font-semibold">${p.name}${p.is_on_sale ? ' <span class="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded ml-1">OFERTA</span>' : ""}</td>
                      <td class="px-4 py-3 text-sm">${p.category}</td>
                      <td class="px-4 py-3 text-sm">${p.subcategory}</td>
                      ${window.posRole !== "employee" ? `<td class="px-4 py-3 text-sm text-gray-500">${p.cost_price != null ? money(p.cost_price) : "—"}</td>` : ''}
                      <td class="px-4 py-3">${p.is_on_sale ? `<span class="line-through text-gray-400 text-xs">${money(p.price_normal)}</span> <span class="text-red-500 font-bold">${money(p.sale_price)}</span>` : money(p.price_normal)}</td>
                      ${window.posRole !== "employee" ? `<td class="px-4 py-3">${marginHtml(p)}</td>` : ''}
                      <td class="px-4 py-3">${stock === 0 ? '<span class="text-red-500 font-bold text-xs">AGOTADO</span>' : stock}</td>
                      <td class="px-4 py-3 text-right">
                        <button data-edit="${p.id}" class="text-brand-mexican font-semibold hover:underline mr-3 text-sm">Editar</button>
                        <button data-delete="${p.id}" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                      </td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
          ` : `
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            ${visible.map((p) => {
              const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
              const imageUrl = p.variants[0]?.image_url || '';
              return `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group relative hover:shadow-md transition-shadow">
                  <div class="aspect-square bg-gray-50 relative">
                    ${imageUrl ? `<img src="${imageUrl}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />` : '<div class="flex items-center justify-center h-full text-gray-300"><i class="fa-solid fa-image text-3xl"></i></div>'}
                    ${p.is_on_sale ? '<span class="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">OFERTA</span>' : ''}
                    ${stock === 0 ? '<span class="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center font-black text-gray-800 tracking-widest text-xs uppercase">Agotado</span>' : ''}
                    <div class="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button data-edit="${p.id}" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center text-brand-mexican hover:bg-white"><i class="fa-solid fa-pen text-xs"></i></button>
                      <button data-delete="${p.id}" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center text-red-500 hover:bg-white hover:text-red-600"><i class="fa-solid fa-trash-can text-xs"></i></button>
                    </div>
                  </div>
                  <div class="p-3 flex flex-col flex-1">
                    <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 truncate">${p.category}</p>
                    <h4 class="font-bold text-gray-900 text-xs leading-tight mb-2 flex-1">${p.name}</h4>
                    <div class="flex justify-between items-end mt-auto pt-2 border-t border-gray-50">
                      <div>
                        ${p.is_on_sale ? `<p class="text-[9px] text-gray-400 line-through">${money(p.price_normal)}</p><p class="text-red-500 font-bold text-sm">${money(p.sale_price)}</p>` : `<p class="font-bold text-gray-900 text-sm">${money(p.price_normal)}</p>`}
                      </div>
                      <div class="text-right">
                        <p class="text-[10px] ${stock === 0 ? 'text-red-500 font-bold' : 'text-gray-500 font-medium'}">${stock === 0 ? 'AGOTADO' : `${stock} pzas`}</p>
                        ${window.posRole !== "employee" && p.cost_price != null ? `<p class="text-[9px] text-gray-400 font-bold mt-0.5" title="Costo">C: ${money(p.cost_price)}</p>` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
          `}
        `;

        container.querySelector("#filter-category").addEventListener("change", (e) => {
          filterCategory = e.target.value;
          render();
        });
        container.querySelector("#filter-subcategory").addEventListener("change", (e) => {
          filterSubcategory = e.target.value;
          render();
        });
        container.querySelector("#view-list-btn").addEventListener("click", () => {
          viewMode = "list";
          render();
        });
        container.querySelector("#view-grid-btn").addEventListener("click", () => {
          viewMode = "grid";
          render();
        });

        container.querySelector("#new-product-btn").addEventListener("click", () => {
          openProductModal(null);
        });
        container.querySelectorAll("[data-edit]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const product = products.find((p) => p.id === btn.dataset.edit);
            openProductModal(product);
          });
        });
        container.querySelectorAll("[data-delete]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const product = products.find((p) => p.id === btn.dataset.delete);
            showConfirmModal({
              title: `¿Eliminar "${product?.name}"?`,
              message: "Esta acción no se puede deshacer. Si el producto tiene pedidos asociados, no se podrá eliminar.",
              confirmLabel: "Eliminar",
              onConfirm: async () => {
                try {
                  await posAccessApi.deleteProduct(btn.dataset.delete);
                  const idx = products.findIndex((p) => p.id === btn.dataset.delete);
                  if (idx > -1) products.splice(idx, 1);
                  render();
                } catch (err) {
                  if (err.status === 401 && onUnauthorized) {
                    onUnauthorized();
                    return;
                  }
                  alert(err.message);
                }
              },
            });
          });
        });
      }

      function openProductModal(product) {
        const modal = openFormModal();
        renderProductForm(modal.body, product, modal);
      }

      function renderProductForm(el, product, modal) {
        const isNew = !product;
        const newVariants = []; // { tempId, color, sku, stock, image_url } — solo para isNew

        el.innerHTML = `
          <div class="p-6">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-2xl font-bold">${isNew ? "Nuevo Producto" : product.name}</h3>
              <button id="close-detail" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark text-2xl"></i></button>
            </div>

            <form id="product-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label class="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                <input name="name" required value="${product?.name || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                <select name="category_id" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  ${categories.map((c) => `<option value="${c.id}" ${product?.category_id === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Subcategoría</label>
                <select name="subcategory" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  ${subcategories.map((s) => `<option value="${s}" ${product?.subcategory === s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
                <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg">${product?.description || ""}</textarea>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Precio Normal</label>
                <input type="number" step="0.01" name="price_normal" required value="${product?.price_normal ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Precio Medio ${product ? "" : `<span class="font-normal text-gray-400">(sugerido, edítalo si quieres)</span>`}</label>
                <input type="number" step="0.01" name="price_medio" required value="${product?.price_medio ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Precio Mayoreo ${product ? "" : `<span class="font-normal text-gray-400">(sugerido, edítalo si quieres)</span>`}</label>
                <input type="number" step="0.01" name="price_wholesale" required value="${product?.price_wholesale ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Precio Súper Mayoreo ${product ? "" : `<span class="font-normal text-gray-400">(sugerido, edítalo si quieres)</span>`}</label>
                <input type="number" step="0.01" name="price_super_wholesale" required value="${product?.price_super_wholesale ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              ${window.posRole !== "employee" ? `
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Costo (compra)</label>
                <input type="number" step="0.01" name="cost_price" value="${product?.cost_price ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                <p id="margin-preview" class="text-xs text-gray-500 mt-1"></p>
              </div>
              ` : `
              <input type="hidden" name="cost_price" value="${product?.cost_price ?? ""}" />
              `}
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Mín. piezas Medio</label>
                <input type="number" name="medio_min_qty" required value="${product?.medio_min_qty ?? 3}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Mín. piezas Mayoreo</label>
                <input type="number" name="wholesale_min_qty" required value="${product?.wholesale_min_qty ?? 6}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Mín. piezas Súper Mayoreo</label>
                <input type="number" name="super_wholesale_min_qty" required value="${product?.super_wholesale_min_qty ?? 50}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>

              <div class="sm:col-span-2 border-t pt-4 mt-2">
                <label class="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input type="checkbox" id="is-on-sale-checkbox" ${product?.is_on_sale ? "checked" : ""} class="w-4 h-4" />
                  Este producto está en oferta
                </label>
                <div id="sale-price-field" class="${product?.is_on_sale ? "" : "hidden"} mt-2">
                  <label class="block text-sm font-bold text-gray-700 mb-1">Precio de oferta</label>
                  <input type="number" step="0.01" name="sale_price" value="${product?.sale_price ?? ""}" class="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>

              <div class="sm:col-span-2 border-t pt-4 mt-2">
                <label class="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input type="checkbox" id="is-bundle-exclusive-checkbox" ${product?.is_bundle_exclusive ? "checked" : ""} class="w-4 h-4" />
                  Producto exclusivo para paquetes
                </label>
                <p class="text-xs text-gray-500 mt-1">No aparece en el catálogo general; solo puede incluirse en paquetes configurados para este modelo.</p>
              </div>

              ${
                isNew
                  ? `<div class="sm:col-span-2 border-t pt-4 mt-2">
                      <h4 class="font-bold text-lg mb-1">Variantes iniciales</h4>
                      <p class="text-sm text-gray-500 mb-3">Opcional: agrega colores/diseños con su imagen. También puedes hacerlo después de crear el producto.</p>
                      <div id="new-variants-builder"></div>
                    </div>`
                  : ""
              }

              <p id="form-error" class="sm:col-span-2 text-red-500 text-sm hidden"></p>

              <div class="sm:col-span-2 flex justify-end">
                <button type="submit" class="bg-brand-mexican text-white px-6 py-3 rounded-full font-semibold hover:opacity-90">
                  ${isNew ? "Crear Producto" : "Guardar Cambios"}
                </button>
              </div>
            </form>

            ${isNew ? "" : `<div id="variants-section" class="mt-8 border-t pt-6"></div>`}
          </div>
        `;

        el.querySelector("#close-detail").addEventListener("click", () => modal.close());

        if (isNew) {
          renderNewVariantsBuilder(el.querySelector("#new-variants-builder"), newVariants, () => getNextSku(allProducts));
        }

        el.querySelector("#is-on-sale-checkbox").addEventListener("change", (e) => {
          el.querySelector("#sale-price-field").classList.toggle("hidden", !e.target.checked);
        });

        const form = el.querySelector("#product-form");
        const errorEl = el.querySelector("#form-error");

        function updateMarginPreview() {
          const price = parseFloat(form.querySelector('[name="price_normal"]').value);
          const cost = parseFloat(form.querySelector('[name="cost_price"]').value);
          const preview = el.querySelector("#margin-preview");
          if (!isNaN(price) && !isNaN(cost) && price > 0) {
            const margin = price - cost;
            preview.textContent = `Margen: ${money(margin)} (${((margin / price) * 100).toFixed(0)}%)`;
          } else {
            preview.textContent = "";
          }
        }
        form.querySelector('[name="price_normal"]').addEventListener("input", updateMarginPreview);
        form.querySelector('[name="cost_price"]').addEventListener("input", updateMarginPreview);
        updateMarginPreview();

        // Sugerencia automática de precios por volumen para productos NUEVOS -- son
        // solo un punto de partida; la dueña siempre puede editarlos, y en cuanto
        // toca un campo a mano dejamos de sobreescribirlo.
        if (!product) {
          const tierInputs = {
            price_medio: form.querySelector('[name="price_medio"]'),
            price_wholesale: form.querySelector('[name="price_wholesale"]'),
            price_super_wholesale: form.querySelector('[name="price_super_wholesale"]'),
          };
          const SUGGESTED_DISCOUNTS = { price_medio: 0.9, price_wholesale: 0.8, price_super_wholesale: 0.7 };
          Object.values(tierInputs).forEach((input) => {
            input.addEventListener("input", () => {
              input.dataset.touched = "1";
            });
          });
          form.querySelector('[name="price_normal"]').addEventListener("input", () => {
            const price = parseFloat(form.querySelector('[name="price_normal"]').value);
            if (isNaN(price) || price <= 0) return;
            Object.entries(tierInputs).forEach(([key, input]) => {
              if (input.dataset.touched) return;
              input.value = (price * SUGGESTED_DISCOUNTS[key]).toFixed(2);
            });
          });
        }

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          errorEl.classList.add("hidden");
          const fd = new FormData(form);

          const payload = {
            name: fd.get("name"),
            category_id: fd.get("category_id"),
            subcategory: fd.get("subcategory"),
            description: fd.get("description"),
            price_normal: parseFloat(fd.get("price_normal")),
            price_medio: parseFloat(fd.get("price_medio")),
            price_wholesale: parseFloat(fd.get("price_wholesale")),
            price_super_wholesale: parseFloat(fd.get("price_super_wholesale")),
            cost_price: fd.get("cost_price") ? parseFloat(fd.get("cost_price")) : null,
            medio_min_qty: parseInt(fd.get("medio_min_qty"), 10),
            wholesale_min_qty: parseInt(fd.get("wholesale_min_qty"), 10),
            super_wholesale_min_qty: parseInt(fd.get("super_wholesale_min_qty"), 10),
            is_on_sale: el.querySelector("#is-on-sale-checkbox").checked,
            sale_price: fd.get("sale_price") ? parseFloat(fd.get("sale_price")) : null,
            is_bundle_exclusive: el.querySelector("#is-bundle-exclusive-checkbox").checked,
            is_bundle: false,
          };

          if (isNew && newVariants.length) {
            const incomplete = newVariants.some((v) => !v.color.trim() || !v.sku.trim());
            if (incomplete) {
              errorEl.textContent = "Cada variante necesita al menos color y SKU (o quítala con la papelera).";
              errorEl.classList.remove("hidden");
              return;
            }
            payload.variants = newVariants.map(({ color, sku, stock, image_urls }) => ({
              color,
              sku,
              stock: parseInt(stock, 10) || 0,
              image_urls,
            }));
          }

          try {
            if (isNew) {
              const { product: created } = await posAccessApi.createProduct(payload);
              products.push(created);
              render();
              modal.close();
              // Reabre en modo edición para que se puedan agregar variantes/fotos de inmediato.
              openProductModal(created);
            } else {
              const { product: updated } = await posAccessApi.updateProduct(product.id, payload);
              Object.assign(product, updated);
              render();
              modal.close();
            }
          } catch (err) {
            if (err.status === 401 && onUnauthorized) {
              onUnauthorized();
              return;
            }
            errorEl.textContent = err.message;
            errorEl.classList.remove("hidden");
          }
        });

        if (!isNew) {
          renderVariantsSection(el.querySelector("#variants-section"), product, () => getNextSku(allProducts));
        }
      }

      render();
    },
  };
}
