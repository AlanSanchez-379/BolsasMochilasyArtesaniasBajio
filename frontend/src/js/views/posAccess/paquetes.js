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
                  <th class="px-4 py-3">Modo</th>
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
                      <td class="px-4 py-3 text-sm">${b.bundle_fixed_items?.length ? "Contenido fijo" : "Elegir mis diseños"}</td>
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
                    <p class="text-[9px] font-bold text-brand-blue uppercase tracking-widest mb-1 truncate">${b.bundle_fixed_items?.length ? "Contenido fijo" : "Elegir diseños"}</p>
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
        let contentMode = bundle?.bundle_fixed_items?.length ? "fixed" : "custom";
        const fixedItems = (bundle?.bundle_fixed_items || []).map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
        let pickerOpen = false;
        let pickerSearch = "";
        let pickerProduct = null;

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
                <label class="block text-sm font-bold text-gray-700 mb-2">Cómo se arma el contenido del paquete</label>
                <div class="flex gap-3 mb-4">
                  <button type="button" data-content-mode="custom" class="content-mode-btn flex-1 py-2 rounded-lg border-2 font-semibold text-sm ${
                    contentMode === "custom" ? "border-brand-mexican bg-brand-pink-light text-brand-mexican" : "border-gray-200 text-gray-500"
                  }">Elegir mis diseños</button>
                  <button type="button" data-content-mode="fixed" class="content-mode-btn flex-1 py-2 rounded-lg border-2 font-semibold text-sm ${
                    contentMode === "fixed" ? "border-brand-mexican bg-brand-pink-light text-brand-mexican" : "border-gray-200 text-gray-500"
                  }">Contenido fijo</button>
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
          if (contentMode === "custom") {
            const total = Object.values(bundle?.bundle_category_limits || {}).reduce((a, b) => a + b, 0);
            const eligibleSubsByCategory = bundle?.bundle_eligible_subcategories || {};
            contentConfigEl.innerHTML = `
              <label class="block text-sm font-bold text-gray-700 mb-2">Límite exacto de piezas por categoría</label>
              <p class="text-xs text-gray-500 mb-2">Por cada categoría, puedes además limitar a subcategorías específicas -- sin marcar ninguna, admite cualquiera.</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                ${categories
                  .map((c) => {
                    const catEligibleSubs = eligibleSubsByCategory[c.name] || [];
                    return `
                  <div class="border border-gray-200 rounded-lg p-3">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">${c.name}</label>
                    <input type="number" min="0" data-category-limit="${c.name}"
                      value="${bundle?.bundle_category_limits?.[c.name] ?? 0}"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2" />
                    <div class="flex flex-wrap gap-3">
                      ${subcategories
                        .map(
                          (s) => `
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" data-eligible-subcategory="${c.name}::${s}" ${catEligibleSubs.includes(s) ? "checked" : ""} class="w-3.5 h-3.5 accent-brand-mexican" />
                          ${s}
                        </label>`
                        )
                        .join("")}
                    </div>
                  </div>`;
                  })
                  .join("")}
              </div>
              <p class="text-sm text-gray-500">El sistema calcula el total automáticamente: <span id="bundle-total-display" class="font-bold text-brand-mexican">${
                contentMode === "custom" ? total : initialTotal
              }</span> piezas</p>
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
          } else {
            renderFixedMode();
          }
        }

        function renderFixedMode() {
          const total = fixedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

          if (pickerOpen) {
            contentConfigEl.innerHTML = pickerProduct ? pickerQuantityHtml() : pickerGridHtml();
            bindPickerEvents();
            return;
          }

          contentConfigEl.innerHTML = `
            <p class="text-sm text-gray-500 mb-3">
              Elige qué producto y cuántas piezas incluye el paquete -- el cliente elige el color/modelo exacto al comprar.
            </p>
            <div id="fixed-items-list" class="space-y-2 mb-3"></div>
            <button type="button" id="add-fixed-item" class="text-brand-blue-dark font-semibold text-sm hover:underline">
              <i class="fa-solid fa-plus mr-1"></i>Agregar producto
            </button>
            <p class="text-sm text-gray-500 mt-2">Total: <span id="fixed-items-total" class="font-bold text-brand-mexican">${total}</span> piezas</p>
          `;

          const listEl = contentConfigEl.querySelector("#fixed-items-list");

          function renderFixedItemsList() {
            listEl.innerHTML = fixedItems.length
              ? fixedItems
                  .map((item, idx) => {
                    const p = normalProducts.find((p) => p.id === item.product_id);
                    return `
                  <div class="flex gap-2 items-center bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <img src="${p?.variants[0]?.image_url || ""}" class="w-10 h-10 rounded object-cover border border-gray-200 ${p?.variants[0]?.image_url ? "" : "invisible"}" />
                    <span class="flex-1 text-sm text-gray-700">${p ? p.name : "Producto no encontrado"}</span>
                    <input type="number" min="1" data-fixed-item-qty="${idx}" value="${item.quantity || 1}"
                      class="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
                    <button type="button" data-remove-fixed-item="${idx}" class="text-red-400 hover:text-red-600">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>`;
                  })
                  .join("")
              : `<p class="text-sm text-gray-400">Todavía no agregas ningún producto.</p>`;

            listEl.querySelectorAll("[data-fixed-item-qty]").forEach((input) => {
              input.addEventListener("input", () => {
                fixedItems[Number(input.dataset.fixedItemQty)].quantity = parseInt(input.value, 10) || 0;
                refreshTotal();
              });
            });
            listEl.querySelectorAll("[data-remove-fixed-item]").forEach((btn) => {
              btn.addEventListener("click", () => {
                fixedItems.splice(Number(btn.dataset.removeFixedItem), 1);
                renderFixedItemsList();
                refreshTotal();
              });
            });
          }

          function refreshTotal() {
            const t = fixedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
            const totalEl = contentConfigEl.querySelector("#fixed-items-total");
            if (totalEl) totalEl.textContent = t;
          }

          renderFixedItemsList();

          contentConfigEl.querySelector("#add-fixed-item").addEventListener("click", () => {
            pickerOpen = true;
            pickerSearch = "";
            pickerProduct = null;
            renderFixedMode();
          });
        }

        function pickerGridHtml() {
          const query = pickerSearch.trim().toLowerCase();
          const filtered = query ? normalProducts.filter((p) => p.name.toLowerCase().includes(query)) : normalProducts;
          return `
            <div class="flex items-center gap-2 mb-4">
              <button type="button" id="picker-cancel" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-arrow-left"></i></button>
              <input type="text" id="picker-search" placeholder="Buscar producto..." value="${pickerSearch}"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div class="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
              ${
                filtered.length
                  ? filtered
                      .map(
                        (p) => `
                <button type="button" data-picker-product="${p.id}" class="border border-gray-200 rounded-lg p-2 hover:border-brand-mexican text-left">
                  <img src="${p.variants[0]?.image_url || ""}" class="w-full aspect-square rounded object-cover border border-gray-100 mb-1 bg-gray-50" />
                  <p class="text-xs font-semibold text-gray-800 line-clamp-2">${p.name}</p>
                  <p class="text-xs text-brand-mexican font-bold">${money(p.price_normal)}</p>
                </button>`
                      )
                      .join("")
                  : `<p class="col-span-4 text-sm text-gray-400 text-center py-6">Sin resultados.</p>`
              }
            </div>
          `;
        }

        function pickerQuantityHtml() {
          const p = pickerProduct;
          const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
          return `
            <div class="flex items-center gap-2 mb-4">
              <button type="button" id="picker-back" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-arrow-left"></i></button>
              <img src="${p.variants[0]?.image_url || ""}" class="w-10 h-10 rounded object-cover border border-gray-100 bg-gray-50" />
              <p class="font-bold text-gray-900">${p.name}</p>
            </div>
            <p class="text-sm text-gray-500 mb-3">
              ${p.variants.length} modelo${p.variants.length === 1 ? "" : "s"} disponible${p.variants.length === 1 ? "" : "s"} (stock total ${totalStock}) --
              el cliente elige cuál al comprar.
            </p>
            <label class="block text-sm font-bold text-gray-700 mb-1">¿Cuántas piezas de este producto incluye el paquete?</label>
            <div class="flex gap-2">
              <input type="number" min="1" value="1" id="picker-quantity" class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button type="button" id="picker-confirm" class="bg-brand-mexican text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
                Agregar al paquete
              </button>
            </div>
          `;
        }

        function bindPickerEvents() {
          const cancelBtn = contentConfigEl.querySelector("#picker-cancel");
          if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
              pickerOpen = false;
              renderFixedMode();
            });
          }
          const searchInput = contentConfigEl.querySelector("#picker-search");
          if (searchInput) {
            searchInput.addEventListener("input", () => {
              pickerSearch = searchInput.value;
              renderFixedMode();
              contentConfigEl.querySelector("#picker-search")?.focus();
            });
          }
          contentConfigEl.querySelectorAll("[data-picker-product]").forEach((btn) => {
            btn.addEventListener("click", () => {
              pickerProduct = normalProducts.find((p) => p.id === btn.dataset.pickerProduct);
              renderFixedMode();
            });
          });
          const backBtn = contentConfigEl.querySelector("#picker-back");
          if (backBtn) {
            backBtn.addEventListener("click", () => {
              pickerProduct = null;
              renderFixedMode();
            });
          }
          const confirmBtn = contentConfigEl.querySelector("#picker-confirm");
          if (confirmBtn) {
            confirmBtn.addEventListener("click", () => {
              const qtyInput = contentConfigEl.querySelector("#picker-quantity");
              const qty = parseInt(qtyInput.value, 10) || 1;
              const existing = fixedItems.find((i) => i.product_id === pickerProduct.id);
              if (existing) existing.quantity += qty;
              else fixedItems.push({ product_id: pickerProduct.id, quantity: qty });
              pickerOpen = false;
              pickerProduct = null;
              renderFixedMode();
            });
          }
        }

        renderContentConfig();

        el.querySelectorAll(".content-mode-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            contentMode = btn.dataset.contentMode;
            el.querySelectorAll(".content-mode-btn").forEach((b) => {
              const active = b.dataset.contentMode === contentMode;
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
          const eligibleSubcategoriesByCategory = {};
          let cleanFixedItems = [];

          if (contentMode === "custom") {
            el.querySelectorAll("[data-category-limit]").forEach((input) => {
              const val = parseInt(input.value, 10) || 0;
              if (val > 0) categoryLimits[input.dataset.categoryLimit] = val;
            });
            if (Object.values(categoryLimits).reduce((a, b) => a + b, 0) === 0) {
              errorEl.textContent = "Asigna un límite mayor a cero a por lo menos una categoría.";
              errorEl.classList.remove("hidden");
              return;
            }
            el.querySelectorAll("[data-eligible-subcategory]").forEach((input) => {
              if (!input.checked) return;
              const [categoryName, subcategory] = input.dataset.eligibleSubcategory.split("::");
              (eligibleSubcategoriesByCategory[categoryName] ||= []).push(subcategory);
            });
          } else {
            cleanFixedItems = fixedItems.filter((i) => i.product_id && i.quantity > 0);
            if (cleanFixedItems.length === 0) {
              errorEl.textContent = "Agrega al menos un producto al contenido fijo del paquete.";
              errorEl.classList.remove("hidden");
              return;
            }
          }

          const price = parseFloat(fd.get("price_normal"));
          const payload = {
            name: fd.get("name"),
            // "Mixto" satisface la restricción de la base de datos -- la elegibilidad
            // real ahora se maneja con bundle_eligible_subcategories.
            subcategory: "Mixto",
            description: fd.get("description"),
            price_normal: price,
            price_wholesale: price,
            price_super_wholesale: price,
            wholesale_min_qty: 1,
            super_wholesale_min_qty: 1,
            is_bundle: true,
            // Se manda siempre el conjunto completo (aunque quede vacío) para poder
            // limpiar el modo que se dejó de usar si el admin cambia de modo al editar.
            bundle_category_limits: contentMode === "custom" ? categoryLimits : {},
            bundle_eligible_subcategories: contentMode === "custom" ? eligibleSubcategoriesByCategory : {},
            bundle_fixed_items: contentMode === "fixed" ? cleanFixedItems : [],
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
