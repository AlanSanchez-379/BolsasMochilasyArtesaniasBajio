import { api } from "../../api.js";
import { invalidateSettingsCache } from "../../settingsCache.js";

const SETTING_KEYS = { logo: "logo_url", banner: "banner_url" };

function uploadCardHtml(type, label, currentUrl, hint) {
  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-xl font-bold mb-1">${label}</h3>
      <p class="text-sm text-gray-500 mb-4">${hint}</p>
      <div class="mb-4 bg-brand-cream rounded-xl p-4 flex items-center justify-center" style="min-height: 120px">
        ${
          currentUrl
            ? `<img src="${currentUrl}" alt="${label}" class="max-h-40 max-w-full object-contain" />`
            : `<span class="text-gray-400 text-sm">Sin imagen configurada todavía</span>`
        }
      </div>
      <input type="file" data-file-input="${type}" accept="image/png,image/jpeg,image/webp" class="mb-3 text-sm" />
      <p data-error="${type}" class="text-red-500 text-sm mb-2 hidden"></p>
      <button data-upload-btn="${type}" class="bg-brand-blue-dark text-white px-5 py-2 rounded-full font-semibold hover:bg-brand-blue">
        <i class="fa-solid fa-upload mr-2"></i>Guardar ${label}
      </button>

      <div class="mt-6 pt-4 border-t border-gray-100">
        <h4 class="text-sm font-bold text-gray-700 mb-1">
          <i class="fa-solid fa-clock-rotate-left mr-1"></i>Historial
        </h4>
        <p class="text-xs text-gray-400 mb-3">Clic en una imagen para reutilizarla como ${label.toLowerCase()} sin volver a subirla.</p>
        <div data-history-list="${type}" class="flex flex-wrap gap-2">
          <span class="text-xs text-gray-400">Cargando historial...</span>
        </div>
      </div>
    </div>
  `;
}

export async function renderSettingsTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando ajustes...</div>`;

  let settings;
  try {
    settings = await api.adminGetSettings();
  } catch (err) {
    if (!isCurrentTab()) return;
    container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
    return;
  }
  if (!isCurrentTab()) return;

  function render() {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${uploadCardHtml("logo", "Logotipo", settings.logo_url, "Se muestra en la barra de navegación. Recomendado: PNG con fondo transparente.")}
        ${uploadCardHtml("banner", "Banner Principal", settings.banner_url, "Se muestra en el banner del Home. Recomendado: JPG horizontal, ancho.")}
      </div>
    `;

    container.querySelectorAll("[data-upload-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.uploadBtn;
        const input = container.querySelector(`[data-file-input="${type}"]`);
        const errorEl = container.querySelector(`[data-error="${type}"]`);
        errorEl.classList.add("hidden");

        const file = input.files[0];
        if (!file) {
          errorEl.textContent = "Selecciona un archivo primero.";
          errorEl.classList.remove("hidden");
          return;
        }

        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Subiendo...`;

        try {
          await api.adminUploadSettingImage(type, file);
          reloadAfterChange();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.classList.remove("hidden");
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });

    loadHistory("logo", settings.logo_url);
    loadHistory("banner", settings.banner_url);
  }

  async function loadHistory(type, currentUrl) {
    const listEl = container.querySelector(`[data-history-list="${type}"]`);
    if (!listEl) return;

    let images;
    try {
      ({ images } = await api.adminSettingsHistory(type));
    } catch (err) {
      listEl.innerHTML = `<span class="text-xs text-red-500">${err.message}</span>`;
      return;
    }
    if (!isCurrentTab() || !container.isConnected) return;

    if (images.length === 0) {
      listEl.innerHTML = `<span class="text-xs text-gray-400">Todavía no hay imágenes anteriores.</span>`;
      return;
    }

    listEl.innerHTML = images
      .map(
        (img) => `
      <button type="button" data-history-item="${img.url}" data-history-type="${type}"
        class="relative w-16 h-16 rounded-lg overflow-hidden border-2 ${
          img.url === currentUrl ? "border-brand-blue-dark" : "border-transparent hover:border-brand-teal"
        }" title="${img.url === currentUrl ? "En uso actualmente" : "Reutilizar esta imagen"}">
        <img src="${img.url}" class="w-full h-full object-cover" />
        ${img.url === currentUrl ? `<span class="absolute inset-0 bg-brand-blue-dark bg-opacity-30 flex items-center justify-center"><i class="fa-solid fa-check text-white"></i></span>` : ""}
      </button>`
      )
      .join("");

    listEl.querySelectorAll("[data-history-item]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const url = btn.dataset.historyItem;
        const type = btn.dataset.historyType;
        if (url === (type === "logo" ? settings.logo_url : settings.banner_url)) return; // ya está activa

        btn.disabled = true;
        try {
          await api.adminSetSetting(SETTING_KEYS[type], url);
          reloadAfterChange();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
        }
      });
    });
  }

  function reloadAfterChange() {
    invalidateSettingsCache();
    // El Navbar y el Home cachean settings al cargar la app; recargamos para que
    // se vea en todos lados de inmediato (acción poco frecuente, no amerita pub-sub).
    window.location.reload();
  }

  render();
}
