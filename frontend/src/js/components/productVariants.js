import { api } from "../api.js";
import { showConfirmModal } from "./confirmModal.js";
import { renderImageHistoryPicker, invalidateProductImageHistory } from "./imageHistoryPicker.js";

// Cada variante admite hasta esta cantidad de fotos; debe coincidir con
// MAX_VARIANT_IMAGES en backend/app/models/product.py.
const MAX_VARIANT_IMAGES = 3;

function photoSlotsHtml(images, { fileAttr, uploadAttr, historyAttr, removeAttr }) {
  const thumbs = images
    .map(
      (url, i) => `
    <div class="relative w-14 h-14 flex-shrink-0">
      <img src="${url}" class="w-14 h-14 rounded object-cover border border-gray-200" />
      <button type="button" data-${removeAttr}="${i}" title="Quitar foto"
        class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center hover:bg-red-600">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`
    )
    .join("");

  const uploader =
    images.length < MAX_VARIANT_IMAGES
      ? `
    <div class="flex items-center gap-1">
      <input type="file" data-${fileAttr} accept="image/png,image/jpeg,image/webp" class="text-xs w-28" />
      <button type="button" data-${uploadAttr} class="text-xs bg-brand-blue-dark text-white px-2 py-1.5 rounded-full hover:bg-brand-blue" title="Subir foto">
        <i class="fa-solid fa-upload"></i>
      </button>
      <button type="button" data-${historyAttr} class="text-xs text-brand-blue-dark hover:underline">
        o reutilizar una anterior
      </button>
    </div>`
      : `<span class="text-xs text-gray-400">Máximo ${MAX_VARIANT_IMAGES} fotos</span>`;

  return `<div class="flex items-center gap-2 flex-wrap">${thumbs}${uploader}</div>`;
}

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
          <input class="col-span-3 px-2 py-1 border border-gray-300 rounded" data-field="sku" value="${v.sku}" placeholder="SKU" />
          <input type="number" class="col-span-2 px-2 py-1 border border-gray-300 rounded ${v.stock === 0 ? "border-red-300 text-red-500" : ""}" data-field="stock" value="${v.stock}" placeholder="Stock" />
          <button data-save-variant="${v.id}" class="col-span-1 text-brand-teal hover:opacity-70" title="Guardar"><i class="fa-solid fa-check"></i></button>
          <button data-delete-variant="${v.id}" class="col-span-1 text-red-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          ${v.stock === 0 ? '<span class="col-span-2 text-xs text-red-500 font-bold text-right">AGOTADO</span>' : ""}
        </div>
        <div class="pl-12">
          ${photoSlotsHtml(v.image_urls || [], {
            fileAttr: `image-file="${v.id}"`,
            uploadAttr: `upload-image="${v.id}"`,
            historyAttr: `toggle-history="${v.id}"`,
            removeAttr: `remove-image="${v.id}:`,
          })}
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
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
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

    listEl.querySelectorAll("[data-remove-image]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const [variantId, indexStr] = btn.dataset.removeImage.split(":");
        const v = product.variants.find((pv) => pv.id === variantId);
        const nextUrls = (v.image_urls || []).filter((_, i) => i !== parseInt(indexStr, 10));
        try {
          const { product: updated } = await api.adminUpdateVariant(variantId, { image_urls: nextUrls });
          Object.assign(product, updated);
          renderList();
        } catch (err) {
          alert(err.message);
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
              const current = v.image_urls || [];
              if (current.length >= MAX_VARIANT_IMAGES) {
                alert(`Esta variante ya tiene el máximo de ${MAX_VARIANT_IMAGES} fotos. Quita una primero.`);
                return;
              }
              try {
                const { product: updated } = await api.adminUpdateVariant(variantId, {
                  image_urls: [...current, url],
                });
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
          <input class="col-span-3 px-2 py-1 border border-gray-300 rounded" data-new-field="color" value="${v.color}" placeholder="Color" />
          <input class="col-span-3 px-2 py-1 border border-gray-300 rounded" data-new-field="sku" value="${v.sku}" placeholder="SKU" />
          <input type="number" class="col-span-2 px-2 py-1 border border-gray-300 rounded" data-new-field="stock" value="${v.stock}" placeholder="Stock" />
          <button type="button" data-remove-new-variant="${v.tempId}" class="col-span-1 text-red-400 hover:text-red-600" title="Quitar"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <div class="pl-1">
          ${photoSlotsHtml(v.image_urls || [], {
            fileAttr: `new-image-file="${v.tempId}"`,
            uploadAttr: `upload-new-image="${v.tempId}"`,
            historyAttr: `toggle-new-history="${v.tempId}"`,
            removeAttr: `remove-new-image="${v.tempId}:`,
          })}
        </div>
        <div data-new-history-picker="${v.tempId}" class="hidden flex flex-wrap gap-2 mt-2"></div>
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

    listEl.querySelectorAll("[data-remove-new-image]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [tempId, indexStr] = btn.dataset.removeNewImage.split(":");
        const v = variants.find((nv) => nv.tempId === tempId);
        v.image_urls = (v.image_urls || []).filter((_, i) => i !== parseInt(indexStr, 10));
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
        const v = variants.find((nv) => nv.tempId === tempId);
        if ((v.image_urls || []).length >= MAX_VARIANT_IMAGES) {
          alert(`Ya agregaste el máximo de ${MAX_VARIANT_IMAGES} fotos para esta variante.`);
          return;
        }
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        try {
          const { url } = await api.adminUploadImage(file);
          invalidateProductImageHistory();
          v.image_urls = [...(v.image_urls || []), url];
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
            currentUrl: (v.image_urls || [])[0],
            onSelect: (url) => {
              if ((v.image_urls || []).length >= MAX_VARIANT_IMAGES) {
                alert(`Ya agregaste el máximo de ${MAX_VARIANT_IMAGES} fotos para esta variante.`);
                return;
              }
              v.image_urls = [...(v.image_urls || []), url];
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
      image_urls: [],
    });
    renderList();
  });

  renderList();
}
