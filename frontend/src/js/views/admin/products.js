import { api } from "../../api.js";
import { showConfirmModal } from "../../components/confirmModal.js";
import { getCategories } from "../../catalogCache.js";
import { renderVariantsSection, renderNewVariantsBuilder } from "../../components/productVariants.js";

export async function renderProductsTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando catálogo...</div>`;

  let categories, subcategories, products, allProducts;
  try {
    [{ categories, subcategories }, { products: allProducts }] = await Promise.all([
      getCategories(),
      api.adminListProducts(),
    ]);
    products = allProducts.filter((p) => !p.is_bundle);
  } catch (err) {
    if (!isCurrentTab()) return;
    container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
    return;
  }
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
              <th class="px-4 py-3">Subcategoría</th>
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
                  <td class="px-4 py-3 text-sm">${p.subcategory}</td>
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
          <button type="submit" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">
            ${isNew ? "Crear Producto" : "Guardar Cambios"}
          </button>
        </div>
      </form>

      ${isNew ? "" : `<div id="variants-section" class="mt-8 border-t pt-6"></div>`}
    `;

    el.querySelector("#close-detail").addEventListener("click", () => {
      selectedId = null;
      renderDetail();
    });

    if (isNew) {
      renderNewVariantsBuilder(el.querySelector("#new-variants-builder"), newVariants);
    }

    const form = el.querySelector("#product-form");
    const errorEl = el.querySelector("#form-error");

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
        price_wholesale: parseFloat(fd.get("price_wholesale")),
        price_super_wholesale: parseFloat(fd.get("price_super_wholesale")),
        wholesale_min_qty: parseInt(fd.get("wholesale_min_qty"), 10),
        super_wholesale_min_qty: parseInt(fd.get("super_wholesale_min_qty"), 10),
        is_bundle: false,
      };

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
    }
  }

  render();
}
