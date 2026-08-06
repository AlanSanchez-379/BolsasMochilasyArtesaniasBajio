import { api } from "../../api.js";
import { showConfirmModal } from "../../components/confirmModal.js";

export async function renderProductsTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando catálogo...</div>`;

  const [{ categories, subcategories }, { products }] = await Promise.all([api.getCategories(), api.adminListProducts()]);
  if (!isCurrentTab()) return;

  let selectedId = null; // null | 'new' | product.id
  let filterCategory = "Todas";
  let filterSubcategory = "Todas";

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
        <button id="new-product-btn" class="bg-brand-blue-dark text-white px-5 py-2 rounded-full font-semibold hover:bg-brand-blue">
          <i class="fa-solid fa-plus mr-2"></i>Nuevo Producto
        </button>
      </div>
      <p class="text-gray-500 mb-2">${visible.length} de ${products.length} productos</p>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto mb-8">
        <table class="w-full text-left">
          <thead class="bg-brand-cream text-sm uppercase text-gray-600">
            <tr>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Categoría</th>
              <th class="px-4 py-3">Tipo</th>
              <th class="px-4 py-3">Precio</th>
              <th class="px-4 py-3">Stock total</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            ${visible
              .map((p) => {
                const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                return `
                <tr class="border-t border-gray-100">
                  <td class="px-4 py-3 font-semibold">${p.name}</td>
                  <td class="px-4 py-3 text-sm">${p.category}</td>
                  <td class="px-4 py-3 text-sm">${p.is_bundle ? `<span class="text-brand-salmon font-bold">Paquete</span>` : p.subcategory}</td>
                  <td class="px-4 py-3">$${p.price_normal}</td>
                  <td class="px-4 py-3">${stock === 0 ? '<span class="text-red-500 font-bold">AGOTADO</span>' : stock}</td>
                  <td class="px-4 py-3 text-right">
                    <button data-edit="${p.id}" class="text-brand-blue-dark font-semibold hover:underline mr-3">Editar</button>
                    <button data-delete="${p.id}" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div id="detail-panel"></div>
    `;

    container.querySelector("#filter-category").addEventListener("change", (e) => {
      filterCategory = e.target.value;
      render();
    });
    container.querySelector("#filter-subcategory").addEventListener("change", (e) => {
      filterSubcategory = e.target.value;
      render();
    });

    container.querySelector("#new-product-btn").addEventListener("click", () => {
      selectedId = "new";
      renderDetail();
    });
    container.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.dataset.edit;
        renderDetail();
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
              await api.adminDeleteProduct(btn.dataset.delete);
              const idx = products.findIndex((p) => p.id === btn.dataset.delete);
              if (idx > -1) products.splice(idx, 1);
              render();
            } catch (err) {
              alert(err.message);
            }
          },
        });
      });
    });

    renderDetail();
  }

  function renderDetail() {
    const panel = container.querySelector("#detail-panel");
    if (!panel) return;
    if (selectedId === null) {
      panel.innerHTML = "";
      return;
    }
    const product = selectedId === "new" ? null : products.find((p) => p.id === selectedId);
    panel.innerHTML = `<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"><div id="product-form-slot"></div></div>`;
    renderProductForm(panel.querySelector("#product-form-slot"), product);
  }

  function renderProductForm(el, product) {
    const isNew = !product;
    const initialTotal = product?.bundle_limit ?? 0;
    const newVariants = []; // { tempId, color, sku, stock, image_url } — solo para isNew

    el.innerHTML = `
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
          <label class="block text-sm font-bold text-gray-700 mb-1">Precio Mayoreo</label>
          <input type="number" step="0.01" name="price_wholesale" required value="${product?.price_wholesale ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Precio Súper Mayoreo</label>
          <input type="number" step="0.01" name="price_super_wholesale" required value="${product?.price_super_wholesale ?? ""}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div></div>
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Mín. piezas Mayoreo</label>
          <input type="number" name="wholesale_min_qty" required value="${product?.wholesale_min_qty ?? 6}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Mín. piezas Súper Mayoreo</label>
          <input type="number" name="super_wholesale_min_qty" required value="${product?.super_wholesale_min_qty ?? 50}" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>

        <div class="sm:col-span-2 flex items-center gap-3 border-t pt-4 mt-2">
          <input type="checkbox" id="is-bundle" name="is_bundle" ${product?.is_bundle ? "checked" : ""} class="w-5 h-5" />
          <label for="is-bundle" class="font-bold">Es un Paquete Emprendedor</label>
        </div>
        <div id="bundle-limits-wrap" class="sm:col-span-2 ${product?.is_bundle ? "" : "hidden"}">
          <label class="block text-sm font-bold text-gray-700 mb-2">Límite exacto de piezas por categoría</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            ${categories
              .map(
                (c) => `
              <div>
                <label class="block text-xs text-gray-500 mb-1">${c.name}</label>
                <input type="number" min="0" data-category-limit="${c.name}"
                  value="${product?.bundle_category_limits?.[c.name] ?? 0}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>`
              )
              .join("")}
          </div>
          <p class="text-sm text-gray-500">El sistema calcula el total automáticamente: <span id="bundle-total-display" class="font-bold text-brand-blue-dark">${initialTotal}</span> piezas</p>
        </div>

        ${
          isNew
            ? `<div class="sm:col-span-2 border-t pt-4 mt-2">
                <h4 class="font-bold text-lg mb-1">Variantes iniciales</h4>
                <p class="text-sm text-gray-500 mb-3">Opcional: agrega colores/diseños con su imagen. También puedes hacerlo después de crear el producto.</p>
                <div id="new-variants-list" class="space-y-3 mb-3"></div>
                <button type="button" id="add-new-variant-row" class="text-brand-blue-dark font-semibold hover:underline text-sm">
                  <i class="fa-solid fa-plus mr-1"></i>Agregar variante
                </button>
              </div>`
            : ""
        }

        <p id="form-error" class="sm:col-span-2 text-red-500 text-sm hidden"></p>

        <div class="sm:col-span-2 flex justify-end">
          <button type="submit" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">
            ${isNew ? "Crear Producto" : "Guardar Cambios"}
          </button>
        </div>
      </form>

      ${isNew ? "" : `<div id="variants-section" class="mt-8 border-t pt-6"></div>`}
      ${isNew ? "" : product.is_bundle ? `<div id="eligible-section" class="mt-8 border-t pt-6"></div>` : ""}
    `;

    el.querySelector("#close-detail").addEventListener("click", () => {
      selectedId = null;
      renderDetail();
    });

    const bundleCheckbox = el.querySelector("#is-bundle");
    const bundleLimitsWrap = el.querySelector("#bundle-limits-wrap");
    bundleCheckbox.addEventListener("change", () => {
      bundleLimitsWrap.classList.toggle("hidden", !bundleCheckbox.checked);
    });

    const totalDisplay = el.querySelector("#bundle-total-display");
    el.querySelectorAll("[data-category-limit]").forEach((input) => {
      input.addEventListener("input", () => {
        const total = [...el.querySelectorAll("[data-category-limit]")].reduce(
          (sum, i) => sum + (parseInt(i.value, 10) || 0),
          0
        );
        totalDisplay.textContent = total;
      });
    });

    if (isNew) {
      const newVariantsList = el.querySelector("#new-variants-list");

      function renderNewVariantsList() {
        newVariantsList.innerHTML = newVariants
          .map(
            (v) => `
          <div class="border border-gray-100 rounded-lg p-3" data-new-variant-row="${v.tempId}">
            <div class="grid grid-cols-12 gap-2 items-center mb-2">
              <div class="col-span-1 flex items-center justify-center">
                ${
                  v.image_url
                    ? `<img src="${v.image_url}" class="w-10 h-10 rounded object-cover border border-gray-200" />`
                    : `<div class="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-300"><i class="fa-regular fa-image"></i></div>`
                }
              </div>
              <input class="col-span-3 px-2 py-1 border border-gray-300 rounded" data-new-field="color" value="${v.color}" placeholder="Color" />
              <input class="col-span-3 px-2 py-1 border border-gray-300 rounded" data-new-field="sku" value="${v.sku}" placeholder="SKU" />
              <input type="number" class="col-span-2 px-2 py-1 border border-gray-300 rounded" data-new-field="stock" value="${v.stock}" placeholder="Stock" />
              <button type="button" data-remove-new-variant="${v.tempId}" class="col-span-1 text-red-400 hover:text-red-600" title="Quitar"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="flex items-center gap-2 pl-12">
              <input type="file" data-new-image-file="${v.tempId}" accept="image/png,image/jpeg,image/webp" class="text-xs" />
              <button type="button" data-upload-new-image="${v.tempId}" class="text-xs bg-brand-blue-dark text-white px-3 py-1 rounded-full hover:bg-brand-blue">
                <i class="fa-solid fa-upload mr-1"></i>Subir imagen
              </button>
            </div>
          </div>`
          )
          .join("");

        newVariantsList.querySelectorAll("[data-new-field]").forEach((input) => {
          input.addEventListener("input", () => {
            const row = input.closest("[data-new-variant-row]");
            const tempId = row.dataset.newVariantRow;
            const v = newVariants.find((nv) => nv.tempId === tempId);
            v[input.dataset.newField] = input.value;
          });
        });

        newVariantsList.querySelectorAll("[data-remove-new-variant]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = newVariants.findIndex((nv) => nv.tempId === btn.dataset.removeNewVariant);
            if (idx > -1) newVariants.splice(idx, 1);
            renderNewVariantsList();
          });
        });

        newVariantsList.querySelectorAll("[data-upload-new-image]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const tempId = btn.dataset.uploadNewImage;
            const row = btn.closest("[data-new-variant-row]");
            const fileInput = row.querySelector(`[data-new-image-file="${tempId}"]`);
            const file = fileInput.files[0];
            if (!file) {
              alert("Selecciona un archivo primero.");
              return;
            }
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i>Subiendo...`;
            try {
              const { url } = await api.adminUploadImage(file);
              const v = newVariants.find((nv) => nv.tempId === tempId);
              v.image_url = url;
              renderNewVariantsList();
            } catch (err) {
              alert(err.message);
              btn.disabled = false;
              btn.innerHTML = originalText;
            }
          });
        });
      }

      el.querySelector("#add-new-variant-row").addEventListener("click", () => {
        newVariants.push({
          tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          color: "",
          sku: "",
          stock: 0,
          image_url: null,
        });
        renderNewVariantsList();
      });
    }

    const form = el.querySelector("#product-form");
    const errorEl = el.querySelector("#form-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.classList.add("hidden");
      const fd = new FormData(form);
      const isBundle = fd.get("is_bundle") === "on";

      const payload = {
        name: fd.get("name"),
        category_id: fd.get("category_id"),
        subcategory: fd.get("subcategory"),
        description: fd.get("description"),
        price_normal: parseFloat(fd.get("price_normal")),
        price_wholesale: parseFloat(fd.get("price_wholesale")),
        price_super_wholesale: parseFloat(fd.get("price_super_wholesale")),
        wholesale_min_qty: parseInt(fd.get("wholesale_min_qty"), 10),
        super_wholesale_min_qty: parseInt(fd.get("super_wholesale_min_qty"), 10),
        is_bundle: isBundle,
      };

      if (isBundle) {
        const categoryLimits = {};
        el.querySelectorAll("[data-category-limit]").forEach((input) => {
          const val = parseInt(input.value, 10) || 0;
          if (val > 0) categoryLimits[input.dataset.categoryLimit] = val;
        });
        payload.bundle_category_limits = categoryLimits;
      }

      if (isNew && newVariants.length) {
        const incomplete = newVariants.some((v) => !v.color.trim() || !v.sku.trim());
        if (incomplete) {
          errorEl.textContent = "Cada variante necesita al menos color y SKU (o quítala con la papelera).";
          errorEl.classList.remove("hidden");
          return;
        }
        payload.variants = newVariants.map(({ color, sku, stock, image_url }) => ({
          color,
          sku,
          stock: parseInt(stock, 10) || 0,
          image_url,
        }));
      }

      try {
        if (isNew) {
          const { product: created } = await api.adminCreateProduct(payload);
          products.push(created);
          selectedId = created.id;
        } else {
          const { product: updated } = await api.adminUpdateProduct(product.id, payload);
          Object.assign(product, updated);
        }
        render();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      }
    });

    if (!isNew) {
      renderVariantsSection(el.querySelector("#variants-section"), product);
      if (product.is_bundle) {
        renderEligibleSection(el.querySelector("#eligible-section"), product);
      }
    }
  }

  function renderVariantsSection(el, product) {
    el.innerHTML = `
      <h4 class="text-xl font-bold mb-4">Variantes</h4>
      <div id="variants-list" class="space-y-3 mb-4"></div>
      <button id="add-variant-btn" class="text-brand-blue-dark font-semibold hover:underline">
        <i class="fa-solid fa-plus mr-1"></i>Agregar variante
      </button>
    `;
    const listEl = el.querySelector("#variants-list");

    function renderList() {
      listEl.innerHTML = product.variants
        .map(
          (v) => `
        <div class="border border-gray-100 rounded-lg p-3" data-variant-row="${v.id}">
          <div class="grid grid-cols-12 gap-2 items-center mb-2">
            <div class="col-span-1 flex items-center justify-center">
              ${
                v.image_url
                  ? `<img src="${v.image_url}" class="w-10 h-10 rounded object-cover border border-gray-200" />`
                  : `<div class="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-300"><i class="fa-regular fa-image"></i></div>`
              }
            </div>
            <input class="col-span-2 px-2 py-1 border border-gray-300 rounded" data-field="color" value="${v.color}" placeholder="Color" />
            <input class="col-span-2 px-2 py-1 border border-gray-300 rounded" data-field="sku" value="${v.sku}" placeholder="SKU" />
            <input type="number" class="col-span-2 px-2 py-1 border border-gray-300 rounded ${v.stock === 0 ? "border-red-300 text-red-500" : ""}" data-field="stock" value="${v.stock}" placeholder="Stock" />
            <input class="col-span-3 px-2 py-1 border border-gray-300 rounded" data-field="image_url" value="${v.image_url || ""}" placeholder="URL de imagen" />
            <button data-save-variant="${v.id}" class="col-span-1 text-brand-teal hover:opacity-70" title="Guardar"><i class="fa-solid fa-check"></i></button>
            <button data-delete-variant="${v.id}" class="col-span-1 text-red-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </div>
          <div class="flex items-center gap-2 pl-12">
            <input type="file" data-image-file="${v.id}" accept="image/png,image/jpeg,image/webp" class="text-xs" />
            <button data-upload-image="${v.id}" class="text-xs bg-brand-blue-dark text-white px-3 py-1 rounded-full hover:bg-brand-blue">
              <i class="fa-solid fa-upload mr-1"></i>Subir imagen
            </button>
            ${v.stock === 0 ? '<span class="text-xs text-red-500 font-bold ml-auto">AGOTADO — oculto para clientes</span>' : ""}
          </div>
        </div>`
        )
        .join("");

      listEl.querySelectorAll("[data-save-variant]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const row = btn.closest("[data-variant-row]");
          const payload = {
            color: row.querySelector('[data-field="color"]').value,
            sku: row.querySelector('[data-field="sku"]').value,
            stock: parseInt(row.querySelector('[data-field="stock"]').value, 10),
            image_url: row.querySelector('[data-field="image_url"]').value,
          };
          try {
            const { product: updated } = await api.adminUpdateVariant(btn.dataset.saveVariant, payload);
            Object.assign(product, updated);
            renderList();
          } catch (err) {
            alert(err.message);
          }
        });
      });

      listEl.querySelectorAll("[data-upload-image]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const variantId = btn.dataset.uploadImage;
          const row = btn.closest("[data-variant-row]");
          const fileInput = row.querySelector(`[data-image-file="${variantId}"]`);
          const file = fileInput.files[0];
          if (!file) {
            alert("Selecciona un archivo primero.");
            return;
          }
          const originalText = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i>Subiendo...`;
          try {
            const { product: updated } = await api.adminUploadVariantImage(variantId, file);
            Object.assign(product, updated);
            renderList();
          } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
        });
      });

      listEl.querySelectorAll("[data-delete-variant]").forEach((btn) => {
        btn.addEventListener("click", () => {
          showConfirmModal({
            title: "¿Eliminar esta variante?",
            message: "Esta acción no se puede deshacer.",
            onConfirm: async () => {
              try {
                const { product: updated } = await api.adminDeleteVariant(btn.dataset.deleteVariant);
                Object.assign(product, updated);
                renderList();
              } catch (err) {
                alert(err.message);
              }
            },
          });
        });
      });
    }

    renderList();

    el.querySelector("#add-variant-btn").addEventListener("click", async () => {
      try {
        const { product: updated } = await api.adminCreateVariant(product.id, {
          color: "Nuevo",
          sku: `SKU-${Date.now()}`,
          stock: 0,
        });
        Object.assign(product, updated);
        renderList();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function renderEligibleSection(el, bundle) {
    const eligibleIds = new Set(bundle.eligible_product_ids || []);
    const allowedCategories = bundle.bundle_category_limits ? Object.keys(bundle.bundle_category_limits) : null;
    const candidates = products.filter(
      (p) => !p.is_bundle && (!allowedCategories || allowedCategories.includes(p.category))
    );
    const byCategory = candidates.reduce((acc, p) => {
      (acc[p.category] ||= []).push(p);
      return acc;
    }, {});

    el.innerHTML = `
      <h4 class="text-xl font-bold mb-2">Productos elegibles para este paquete</h4>
      <p class="text-sm text-gray-500 mb-4">Solo se muestran productos de categorías con límite mayor a cero.</p>
      ${
        Object.keys(byCategory).length === 0
          ? `<p class="text-gray-400 mb-4">Asigna un límite mayor a cero a alguna categoría arriba y guarda el paquete para poder elegir productos.</p>`
          : Object.entries(byCategory)
              .map(
                ([cat, prods]) => `
            <div class="mb-4">
              <p class="font-semibold text-brand-blue-dark mb-2">${cat} <span class="text-gray-400 font-normal">(límite: ${bundle.bundle_category_limits[cat]})</span></p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${prods
                  .map(
                    (p) => `
                  <label class="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                    <input type="checkbox" data-eligible="${p.id}" ${eligibleIds.has(p.id) ? "checked" : ""} />
                    <span>${p.name}</span>
                  </label>`
                  )
                  .join("")}
              </div>
            </div>`
              )
              .join("")
      }
      <button id="save-eligible-btn" class="bg-brand-teal text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
        Guardar productos elegibles
      </button>
    `;

    el.querySelector("#save-eligible-btn").addEventListener("click", async () => {
      const ids = [...el.querySelectorAll("[data-eligible]:checked")].map((i) => i.dataset.eligible);
      try {
        const { product: updated } = await api.adminSetEligibleProducts(bundle.id, ids);
        Object.assign(bundle, updated);
        alert("Productos elegibles actualizados.");
      } catch (err) {
        alert(err.message);
      }
    });
  }

  render();
}
