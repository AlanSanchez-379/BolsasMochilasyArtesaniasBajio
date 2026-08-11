import { api } from "../api.js";

let historyPromise = null;

function getHistory() {
  if (!historyPromise) historyPromise = api.adminProductImageHistory();
  return historyPromise;
}

export function invalidateProductImageHistory() {
  historyPromise = null;
}

// Pinta un picker de miniaturas clicables con el historial de imágenes de producto
// ya subidas (de cualquier producto/variante), para reutilizarlas sin volver a subir
// el archivo. `onSelect(url)` se llama al hacer clic en una miniatura.
export async function renderImageHistoryPicker(container, { currentUrl, onSelect }) {
  container.innerHTML = `<span class="text-xs text-gray-400">Cargando historial...</span>`;

  let images;
  try {
    ({ images } = await getHistory());
  } catch (err) {
    container.innerHTML = `<span class="text-xs text-red-500">${err.message}</span>`;
    return;
  }

  if (images.length === 0) {
    container.innerHTML = `<span class="text-xs text-gray-400">Todavía no hay imágenes anteriores.</span>`;
    return;
  }

  container.innerHTML = images
    .map(
      (img) => `
    <button type="button" data-history-img="${img.url}"
      class="w-12 h-12 rounded-lg overflow-hidden border-2 flex-shrink-0 ${
        img.url === currentUrl ? "border-brand-blue-dark" : "border-transparent hover:border-brand-teal"
      }" title="${img.url === currentUrl ? "En uso actualmente" : "Reutilizar esta imagen"}">
      <img src="${img.url}" class="w-full h-full object-cover" />
    </button>`
    )
    .join("");

  container.querySelectorAll("[data-history-img]").forEach((btn) => {
    btn.addEventListener("click", () => onSelect(btn.dataset.historyImg));
  });
}
