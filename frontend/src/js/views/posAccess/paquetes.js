import { posAccessApi } from "../../api.js";
import { showConfirmModal } from "../../components/confirmModal.js";
import { getCategories } from "../../catalogCache.js";
import { renderVariantsSection, renderNewVariantsBuilder } from "../../components/productVariants.js";
import { money, openFormModal, getNextSku } from "./shared.js";

// --- Sección "Paquetes": CRUD completo de productos is_bundle=true. ---
export function createPaquetesSection(onUnauthorized) {
  return {
    async mount(container) {
      container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando paquetes...</div>`;

      let categories, subcategories, bundles, normalProducts, allProducts;
      try {
        const [{ categories: cats, subcategories: subs }, { products: fetchedProducts }] = await Promise.all([
          getCategories(),
          posAccessApi.listProducts(),
        ]);
        categories = cats;
        subcategories = subs;
        allProducts = fetchedProducts;
        bundles = allProducts.filter((p) => p.is_bundle);
        normalProducts = allProducts.filter((p) => !p.is_bundle);
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }

      let viewMode = "list";

      function render() {
        container.innerHTML = `
          <div class="flex justify-between items-center mb-4">
            <p class="text-gray-500 font-medium">${bundles.length} paquete${bundles.length === 1 ? "" : "s"}</p>
            <div class="flex items-center gap-3">
              <div class="bg-gray-100 p-1 rounded-lg flex items-center gap-1">
                <button id="view-list-btn" class="${viewMode === 'list' ? 'bg-white shadow-sm text-brand-mexican' : 'text-gray-500 hover:text-gray-700'} px-3 py-1.5 rounded-md text-sm transition-all"><i class="fa-solid fa-list"></i></button>
                <button id="view-grid-btn" class="${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-mexican' : 'text-gray-500 hover:text-gray-700'} px-3 py-1.5 rounded-md text-sm transition-all"><i class="fa-solid fa-border-all"></i></button>
              </div>
              <button id="new-bundle-btn" class="bg-brand-mexican text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
                <i class="fa-solid fa-plus mr-2"></i>Nuevo Paquete
              </button>
            </div>
          </div>

          ${viewMode === "list" ? `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto mb-8">
            <table class="w-full text-left">
              <thead class="bg-gray-50 text-sm uppercase text-gray-600">
                <tr>
                  <th class="px-4 py-3">Nombre</th>
                  <th class="px-4 py-3">Estampado</th>
                  <th class="px-4 py-3">Precio</th>
                  <th class="px-4 py-3">Piezas totales</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                ${
                  bundles.length === 0
                    ? `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">Todavía no hay paquetes creados.</td></tr>`
                    : bundles
                        .map(
                          (b) => `
                    <tr class="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td class="px-4 py-3 font-semibold">${b.name}</td>
                      <td class="px-4 py-3 text-sm">${b.print_type || "Yute"}</td>
                      <td class="px-4 py-3">${money(b.price_normal)}</td>
                      <td class="px-4 py-3">${b.bundle_limit ?? "-"}</td>
                      <td class="px-4 py-3 text-right">
                        <button data-edit="${b.id}" class="text-brand-mexican font-semibold hover:underline mr-3 text-sm">Editar</button>
                        <button data-delete="${b.id}" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                      </td>
                    </tr>`
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
          ` : `
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            ${bundles.length === 0 ? `<p class="col-span-full text-center text-gray-400 py-8">Todavía no hay paquetes creados.</p>` : bundles.map((b) => {
              const imageUrl = b.variants[0]?.image_url || '';
              return `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group relative hover:shadow-md transition-shadow">
                  <div class="aspect-square bg-gray-50 relative">
                    ${imageUrl ? `<img src="${imageUrl}" class="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />` : '<div class="flex items-center justify-center h-full text-gray-300"><i class="fa-solid fa-box text-3xl"></i></div>'}
                    <div class="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button data-edit="${b.id}" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center text-brand-mexican hover:bg-white"><i class="fa-solid fa-pen text-xs"></i></button>
                      <button data-delete="${b.id}" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center text-red-500 hover:bg-white hover:text-red-600"><i class="fa-solid fa-trash-can text-xs"></i></button>
                    </div>
                  </div>
                  <div class="p-3 flex flex-col flex-1">
                    <p class="text-[9px] font-bold text-brand-blue uppercase tracking-widest mb-1 truncate">${b.print_type || "Yute"}</p>
                    <h4 class="font-bold text-gray-900 text-xs leading-tight mb-2 flex-1">${b.name}</h4>
                    <div class="flex justify-between items-end mt-auto pt-2 border-t border-gray-50">
                      <div>
                        <p class="font-bold text-gray-900 text-sm">${money(b.price_normal)}</p>
                      </div>
                      <div class="text-right">
                        <p class="text-[10px] text-gray-500 font-medium">${b.bundle_limit ?? "-"} pzas</p>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
          `}
        `;

        container.querySelector("#view-list-btn").addEventListener("click", () => {
          viewMode = "list";
          render();
        });
        container.querySelector("#view-grid-btn").addEventListener("click", () => {
          viewMode = "grid";
          render();
        });

        container.querySelector("#new-bundle-btn").addEventListener("click", () => {
          openBundleModal(null);
        });
        container.querySelectorAll("[data-edit]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const bundle = bundles.find((b) => b.id === btn.dataset.edit);
            openBundleModal(bundle);
          });
        });
        container.querySelectorAll("[data-delete]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const bundle = bundles.find((b) => b.id === btn.dataset.delete);
            showConfirmModal({
              title: `¿Eliminar "${bundle?.name}"?`,
              message: "Esta acción no se puede deshacer. Si el paquete tiene pedidos asociados, no se podrá eliminar.",
              confirmLabel: "Eliminar",
              onConfirm: async () => {
                try {
                  await posAccessApi.deleteProduct(btn.dataset.delete);
                  const idx = bundles.findIndex((b) => b.id === btn.dataset.delete);
                  if (idx > -1) bundles.splice(idx, 1);
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

      function openBundleModal(bundle) {
        const modal = openFormModal();
        renderBundleForm(modal.body, bundle, modal);
      }

      function renderBundleForm(el, bundle, modal) {
        const isNew = !bundle;
        const newVariants = [];
        const initialTotal = bundle?.bundle_limit ?? 0;
        let printType = bundle?.print_type?.toUpperCase() || "YUTE";
        const eligibleProductIds = new Set(bundle?.bundle_eligible_products || []);
        const initialModelLimits = bundle?.bundle_model_limits || {};
        const mandatoryModelIds = new Set(bundle?.bundle_mandatory_models || []);

        el.innerHTML = `
          <div class="p-6">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-2xl font-bold">${isNew ? "Nuevo Paquete" : bundle.name}</h3>
              <button id="close-detail" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark text-2xl"></i></button>
            </div>

            <form id="bundle-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="sm:col-span-2">
                <label class="block text-sm font-bold text-gray-700 mb-1">Nombre del paquete</label>
                <input name="name" required value="${bundle?.name || ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-700 mb-1">Precio del paquete</label>
                <input type="number" step="0.01" name="price_normal" required value="${bundle?.price_normal ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div class="sm:col-span-2">
                <label class="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
                <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg">${bundle?.description || ""}</textarea>
              </div>

              <div class="sm:col-span-2 border-t pt-4 mt-2">
                <label class="block text-sm font-bold text-gray-700 mb-2">Tipo de Estampado</label>
                <div class="flex gap-3 mb-4">
                  <button type="button" data-print-type="YUTE" class="print-type-btn flex-1 py-2 rounded-lg border-2 font-semibold text-sm ${
                    printType === "YUTE" ? "border-brand-mexican bg-brand-pink-light text-brand-mexican" : "border-gray-200 text-gray-500"
                  }">Yute</button>
                  <button type="button" data-print-type="ANIMADO" class="print-type-btn flex-1 py-2 rounded-lg border-2 font-semibold text-sm ${
                    printType === "ANIMADO" ? "border-brand-mexican bg-brand-pink-light text-brand-mexican" : "border-gray-200 text-gray-500"
                  }">Animado</button>
                </div>
                <div id="bundle-content-config"></div>
              </div>

              ${
                isNew
                  ? `<div class="sm:col-span-2 border-t pt-4 mt-2">
                      <h4 class="font-bold text-lg mb-1">Variante del paquete</h4>
                      <p class="text-sm text-gray-500 mb-3">Foto y stock del paquete tal cual se muestra al cliente (ej. color "Surtido"). También puedes hacerlo después de crear el paquete.</p>
                      <div id="new-variants-builder"></div>
                    </div>`
                  : ""
              }

              <p id="form-error" class="sm:col-span-2 text-red-500 text-sm hidden"></p>

              <div class="sm:col-span-2 flex justify-end">
                <button type="submit" class="bg-brand-mexican text-white px-6 py-3 rounded-full font-semibold hover:opacity-90">
                  ${isNew ? "Crear Paquete" : "Guardar Cambios"}
                </button>
              </div>
            </form>

            ${isNew ? "" : `<div id="variants-section" class="mt-8 border-t pt-6"></div>`}
          </div>
        `;

        el.querySelector("#close-detail").addEventListener("click", () => modal.close());

        const contentConfigEl = el.querySelector("#bundle-content-config");

        function renderContentConfig() {
            const total = Object.values(bundle?.bundle_category_limits || {}).reduce((a, b) => a + b, 0);
            const filteredProducts = normalProducts.filter(p => (p.print_type?.toUpperCase() || "YUTE") === printType);

            contentConfigEl.innerHTML = `
              <div class="border border-gray-200 rounded-lg p-3 mb-4">
                <label class="block text-sm font-bold text-gray-700 mb-1">Modelos permitidos</label>
                <p class="text-xs text-gray-500 mb-2">Selecciona qué modelos entran en el paquete. Puedes definir límites y si es obligatorio.</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  ${filteredProducts.map((p) => {
                    const isChecked = eligibleProductIds.has(p.id);
                    return `
                    <div class="flex flex-col gap-1 border ${isChecked ? 'border-brand-mexican bg-brand-pink-light/30' : 'border-gray-100'} rounded p-2 text-xs">
                      <label class="flex items-center gap-2 text-gray-700 cursor-pointer">
                        <input type="checkbox" data-eligible-product="${p.id}" ${isChecked ? "checked" : ""} class="w-3.5 h-3.5 accent-brand-mexican" />

                        <span class="flex-1 font-semibold truncate" title="${p.name}">${p.name}</span>
                      </label>
                      <div class="flex items-center gap-2 pl-5 mt-1 ${isChecked ? '' : 'hidden'}" id="product-options-${p.id}">
                        <input type="number" min="1" data-model-limit="${p.id}" value="${initialModelLimits[p.id] ?? ""}" placeholder="Límite" class="w-16 px-1.5 py-1 border border-gray-200 rounded" />
                        <label class="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" data-mandatory-model="${p.id}" ${mandatoryModelIds.has(p.id) ? "checked" : ""} class="w-3.5 h-3.5 accent-brand-mexican" />
                          <span class="text-gray-600">Obligatorio</span>
                        </label>
                      </div>
                    </div>`;
                  }).join("")}
                  ${filteredProducts.length === 0 ? `<p class="text-gray-400 p-2 col-span-full text-center">No hay productos de ${printType} creados.</p>` : ''}
                </div>
              </div>
              <label class="block text-sm font-bold text-gray-700 mb-2">Límite exacto de piezas por categoría</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                ${categories
                  .map((c) => `
                  <div class="border border-gray-200 rounded-lg p-3">
                    <label class="block text-xs font-semibold text-gray-600 mb-1 truncate">${c.name}</label>
                    <input type="number" min="0" data-category-limit="${c.name}"
                      value="${bundle?.bundle_category_limits?.[c.name] ?? 0}"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>`)
                  .join("")}
              </div>
              <p class="text-sm text-gray-500">El sistema calcula el total automáticamente: <span id="bundle-total-display" class="font-bold text-brand-mexican">${total > 0 ? total : initialTotal}</span> piezas</p>
            `;
            const totalDisplay = contentConfigEl.querySelector("#bundle-total-display");
            contentConfigEl.querySelectorAll("[data-category-limit]").forEach((input) => {
              input.addEventListener("input", () => {
                const t = [...contentConfigEl.querySelectorAll("[data-category-limit]")].reduce(
                  (sum, i) => sum + (parseInt(i.value, 10) || 0),
                  0
                );
                totalDisplay.textContent = t;
              });
            });

            contentConfigEl.querySelectorAll("[data-eligible-product]").forEach((input) => {
              input.addEventListener("change", (e) => {
                const id = e.target.dataset.eligibleProduct;
                if (e.target.checked) eligibleProductIds.add(id);
                else eligibleProductIds.delete(id);
                // No re-renderizamos todo, solo mostramos/ocultamos opciones
                const optionsDiv = contentConfigEl.querySelector(`#product-options-${id}`);
                if (optionsDiv) {
                  optionsDiv.classList.toggle("hidden", !e.target.checked);
                }
                const container = e.target.closest('.border');
                if (container) {
                  container.classList.toggle('border-brand-mexican', e.target.checked);
                  container.classList.toggle('bg-brand-pink-light/30', e.target.checked);
                  container.classList.toggle('border-gray-100', !e.target.checked);
                }
              });
            });
        }

        renderContentConfig();

        el.querySelectorAll(".print-type-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            printType = btn.dataset.printType;
            el.querySelectorAll(".print-type-btn").forEach((b) => {
              const active = b.dataset.printType === printType;
              b.classList.toggle("border-brand-mexican", active);
              b.classList.toggle("bg-brand-pink-light", active);
              b.classList.toggle("text-brand-mexican", active);
              b.classList.toggle("border-gray-200", !active);
              b.classList.toggle("text-gray-500", !active);
            });
            renderContentConfig();
          });
        });

        if (isNew) {
          renderNewVariantsBuilder(el.querySelector("#new-variants-builder"), newVariants, () => getNextSku(allProducts));
        }

        const form = el.querySelector("#bundle-form");
        const errorEl = el.querySelector("#form-error");

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          errorEl.classList.add("hidden");
          const fd = new FormData(form);

          const categoryLimits = {};
          const eligibleProductIdsPayload = [...el.querySelectorAll("[data-eligible-product]:checked")].map((input) => input.dataset.eligibleProduct);
          const modelLimits = {};
          const mandatoryModelsPayload = [];
          
          el.querySelectorAll("[data-model-limit]").forEach((input) => {
            const value = parseInt(input.value, 10) || 0;
            if (value > 0) modelLimits[input.dataset.modelLimit] = value;
          });

          el.querySelectorAll("[data-mandatory-model]:checked").forEach((input) => {
            mandatoryModelsPayload.push(input.dataset.mandatoryModel);
          });

          el.querySelectorAll("[data-category-limit]").forEach((input) => {
            const val = parseInt(input.value, 10) || 0;
            if (val > 0) categoryLimits[input.dataset.categoryLimit] = val;
          });

          if (Object.values(categoryLimits).reduce((a, b) => a + b, 0) === 0) {
            errorEl.textContent = "Asigna un límite mayor a cero a por lo menos una categoría.";
            errorEl.classList.remove("hidden");
            return;
          }

          const price = parseFloat(fd.get("price_normal"));
          const payload = {
            name: fd.get("name"),
            subcategory: "MIXTO",
            print_type: printType,
            description: fd.get("description"),
            price_normal: price,
            price_medio: price,
            price_wholesale: price,
            price_super_wholesale: price,
            medio_min_qty: 1,
            wholesale_min_qty: 1,
            super_wholesale_min_qty: 1,
            is_bundle: true,
            bundle_category_limits: categoryLimits,
            bundle_eligible_subcategories: {},
            bundle_eligible_products: eligibleProductIdsPayload,
            bundle_model_limits: modelLimits,
            bundle_mandatory_models: mandatoryModelsPayload,
            bundle_fixed_items: [],
          };
          if (isNew) payload.category_id = categories[0]?.id;

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
              bundles.push(created);
              render();
              modal.close();
              // Reabre en modo edición para que se puedan agregar variantes/fotos de inmediato.
              openBundleModal(created);
            } else {
              const { product: updated } = await posAccessApi.updateProduct(bundle.id, payload);
              Object.assign(bundle, updated);
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
          renderVariantsSection(el.querySelector("#variants-section"), bundle, () => getNextSku(allProducts));
        }
      }

      render();
    },
  };
}
