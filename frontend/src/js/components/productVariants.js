import { api } from "../api.js";
import { showConfirmModal } from "./confirmModal.js";
import { renderImageHistoryPicker, invalidateProductImageHistory } from "./imageHistoryPicker.js";

// Editor de variantes de un producto (o paquete) ya guardado: cada fila se edita y
// sube su imagen de forma independiente contra el backend. Compartido entre el tab
// de Catálogo y el de Paquetes del panel admin.
export function renderVariantsSection(el, product) {
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
          <button type="button" data-toggle-history="${v.id}" class="text-xs text-brand-blue-dark hover:underline">
            o reutilizar una anterior
          </button>
          ${v.stock === 0 ? '<span class="text-xs text-red-500 font-bold ml-auto">AGOTADO — oculto para clientes</span>' : ""}
        </div>
        <div data-history-picker="${v.id}" class="hidden flex flex-wrap gap-2 mt-2 pl-12"></div>
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
          invalidateProductImageHistory();
          Object.assign(product, updated);
          renderList();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });

    listEl.querySelectorAll("[data-toggle-history]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const variantId = btn.dataset.toggleHistory;
        const picker = listEl.querySelector(`[data-history-picker="${variantId}"]`);
        const wasHidden = picker.classList.contains("hidden");
        picker.classList.toggle("hidden");
        if (wasHidden) {
          const v = product.variants.find((pv) => pv.id === variantId);
          renderImageHistoryPicker(picker, {
            currentUrl: v.image_url,
            onSelect: async (url) => {
              try {
                const { product: updated } = await api.adminUpdateVariant(variantId, { image_url: url });
                Object.assign(product, updated);
                renderList();
              } catch (err) {
                alert(err.message);
              }
            },
          });
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

// Constructor de variantes iniciales para un producto (o paquete) todavía no
// guardado: solo mantiene la lista en memoria (`variants`); se envía junto con el
// resto del formulario al crear. `variants` se muta in-place para que el caller lea
// su contenido final al hacer submit.
export function renderNewVariantsBuilder(el, variants) {
  el.innerHTML = `
    <div id="new-variants-list" class="space-y-3 mb-3"></div>
    <button type="button" id="add-new-variant-row" class="text-brand-blue-dark font-semibold hover:underline text-sm">
      <i class="fa-solid fa-plus mr-1"></i>Agregar variante
    </button>
  `;
  const listEl = el.querySelector("#new-variants-list");

  function renderList() {
    listEl.innerHTML = variants
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
          <button type="button" data-toggle-new-history="${v.tempId}" class="text-xs text-brand-blue-dark hover:underline">
            o reutilizar una anterior
          </button>
        </div>
        <div data-new-history-picker="${v.tempId}" class="hidden flex flex-wrap gap-2 mt-2 pl-12"></div>
      </div>`
      )
      .join("");

    listEl.querySelectorAll("[data-new-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const row = input.closest("[data-new-variant-row]");
        const tempId = row.dataset.newVariantRow;
        const v = variants.find((nv) => nv.tempId === tempId);
        v[input.dataset.newField] = input.value;
      });
    });

    listEl.querySelectorAll("[data-remove-new-variant]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = variants.findIndex((nv) => nv.tempId === btn.dataset.removeNewVariant);
        if (idx > -1) variants.splice(idx, 1);
        renderList();
      });
    });

    listEl.querySelectorAll("[data-upload-new-image]").forEach((btn) => {
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
          invalidateProductImageHistory();
          const v = variants.find((nv) => nv.tempId === tempId);
          v.image_url = url;
          renderList();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });

    listEl.querySelectorAll("[data-toggle-new-history]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tempId = btn.dataset.toggleNewHistory;
        const picker = listEl.querySelector(`[data-new-history-picker="${tempId}"]`);
        const wasHidden = picker.classList.contains("hidden");
        picker.classList.toggle("hidden");
        if (wasHidden) {
          const v = variants.find((nv) => nv.tempId === tempId);
          renderImageHistoryPicker(picker, {
            currentUrl: v.image_url,
            onSelect: (url) => {
              v.image_url = url;
              renderList();
            },
          });
        }
      });
    });
  }

  el.querySelector("#add-new-variant-row").addEventListener("click", () => {
    variants.push({
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      color: "",
      sku: "",
      stock: 0,
      image_url: null,
    });
    renderList();
  });

  renderList();
}
