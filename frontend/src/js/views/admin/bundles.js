import { api } from "../../api.js";
import { showConfirmModal } from "../../components/confirmModal.js";
import { getCategories } from "../../catalogCache.js";
import { renderVariantsSection, renderNewVariantsBuilder } from "../../components/productVariants.js";

const BUNDLE_LABELS = { "Estampado en yute": "Yute", "Estampado animado 3D": "Animado 3D", Mixto: "Mixto" };

export async function renderBundlesTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando paquetes...</div>`;

  let categories, bundleSubcategories, bundles;
  try {
    const [{ categories: cats, bundle_subcategories: bundleSubs }, { products: allProducts }] = await Promise.all([
      getCategories(),
      api.adminListProducts(),
    ]);
    categories = cats;
    bundleSubcategories = bundleSubs;
    bundles = allProducts.filter((p) => p.is_bundle);
  } catch (err) {
    if (!isCurrentTab()) return;
    container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
    return;
  }
  if (!isCurrentTab()) return;

  let selectedId = null; // null | 'new' | bundle.id

  function render() {
    container.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <p class="text-gray-500">${bundles.length} paquete${bundles.length === 1 ? "" : "s"}</p>
        <button id="new-bundle-btn" class="bg-brand-blue-dark text-white px-5 py-2 rounded-full font-semibold hover:bg-brand-blue">
          <i class="fa-solid fa-plus mr-2"></i>Nuevo Paquete
        </button>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto mb-8">
        <table class="w-full text-left">
          <thead class="bg-brand-cream text-sm uppercase text-gray-600">
            <tr>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Categoría de paquete</th>
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
                <tr class="border-t border-gray-100">
                  <td class="px-4 py-3 font-semibold">${b.name}</td>
                  <td class="px-4 py-3 text-sm">${BUNDLE_LABELS[b.subcategory] || b.subcategory}</td>
                  <td class="px-4 py-3">$${b.price_normal}</td>
                  <td class="px-4 py-3">${b.bundle_limit ?? "-"}</td>
                  <td class="px-4 py-3 text-right">
                    <button data-edit="${b.id}" class="text-brand-blue-dark font-semibold hover:underline mr-3">Editar</button>
                    <button data-delete="${b.id}" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                  </td>
                </tr>`
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>

      <div id="detail-panel"></div>
    `;

    container.querySelector("#new-bundle-btn").addEventListener("click", () => {
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
        const bundle = bundles.find((b) => b.id === btn.dataset.delete);
        showConfirmModal({
          title: `¿Eliminar "${bundle?.name}"?`,
          message: "Esta acción no se puede deshacer. Si el paquete tiene pedidos asociados, no se podrá eliminar.",
          confirmLabel: "Eliminar",
          onConfirm: async () => {
            try {
              await api.adminDeleteProduct(btn.dataset.delete);
              const idx = bundles.findIndex((b) => b.id === btn.dataset.delete);
              if (idx > -1) bundles.splice(idx, 1);
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
    const bundle = selectedId === "new" ? null : bundles.find((b) => b.id === selectedId);
    panel.innerHTML = `<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"><div id="bundle-form-slot"></div></div>`;
    renderBundleForm(panel.querySelector("#bundle-form-slot"), bundle);
  }

  function renderBundleForm(el, bundle) {
    const isNew = !bundle;
    const newVariants = [];
    const initialTotal = bundle?.bundle_limit ?? 0;

    el.innerHTML = `
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
        <div>
          <label class="block text-sm font-bold text-gray-700 mb-1">Categoría de paquete</label>
          <select name="subcategory" required class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            ${bundleSubcategories
              .map((s) => `<option value="${s}" ${bundle?.subcategory === s ? "selected" : ""}>${BUNDLE_LABELS[s] || s}</option>`)
              .join("")}
          </select>
          <p class="text-xs text-gray-500 mt-1">Define qué productos podrá elegir el cliente: Yute y Animado 3D solo admiten esa impresión; Mixto admite cualquiera.</p>
        </div>
        <div class="sm:col-span-2">
          <label class="block text-sm font-bold text-gray-700 mb-1">Descripción</label>
          <textarea name="description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg">${bundle?.description || ""}</textarea>
        </div>

        <div class="sm:col-span-2 border-t pt-4 mt-2">
          <label class="block text-sm font-bold text-gray-700 mb-2">Límite exacto de piezas por categoría</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            ${categories
              .map(
                (c) => `
              <div>
                <label class="block text-xs text-gray-500 mb-1">${c.name}</label>
                <input type="number" min="0" data-category-limit="${c.name}"
                  value="${bundle?.bundle_category_limits?.[c.name] ?? 0}"
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
                <h4 class="font-bold text-lg mb-1">Variante del paquete</h4>
                <p class="text-sm text-gray-500 mb-3">Foto y stock del paquete tal cual se muestra al cliente (ej. color "Surtido"). También puedes hacerlo después de crear el paquete.</p>
                <div id="new-variants-builder"></div>
              </div>`
            : ""
        }

        <p id="form-error" class="sm:col-span-2 text-red-500 text-sm hidden"></p>

        <div class="sm:col-span-2 flex justify-end">
          <button type="submit" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">
            ${isNew ? "Crear Paquete" : "Guardar Cambios"}
          </button>
        </div>
      </form>

      ${isNew ? "" : `<div id="variants-section" class="mt-8 border-t pt-6"></div>`}
    `;

    el.querySelector("#close-detail").addEventListener("click", () => {
      selectedId = null;
      renderDetail();
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
      renderNewVariantsBuilder(el.querySelector("#new-variants-builder"), newVariants);
    }

    const form = el.querySelector("#bundle-form");
    const errorEl = el.querySelector("#form-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.classList.add("hidden");
      const fd = new FormData(form);

      const categoryLimits = {};
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
        subcategory: fd.get("subcategory"),
        description: fd.get("description"),
        price_normal: price,
        price_wholesale: price,
        price_super_wholesale: price,
        wholesale_min_qty: 1,
        super_wholesale_min_qty: 1,
        is_bundle: true,
        bundle_category_limits: categoryLimits,
      };
      if (isNew) payload.category_id = categories[0]?.id;

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
          bundles.push(created);
          selectedId = created.id;
        } else {
          const { product: updated } = await api.adminUpdateProduct(bundle.id, payload);
          Object.assign(bundle, updated);
        }
        render();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      }
    });

    if (!isNew) {
      renderVariantsSection(el.querySelector("#variants-section"), bundle);
    }
  }

  render();
}
