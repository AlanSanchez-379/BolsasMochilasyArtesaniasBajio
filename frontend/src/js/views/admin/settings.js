import { api } from "../../api.js";
import { invalidateSettingsCache } from "../../settingsCache.js";

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
    </div>
  `;
}

export async function renderSettingsTab(container, isCurrentTab = () => true) {
  container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando ajustes...</div>`;
  const settings = await api.adminGetSettings();
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
          invalidateSettingsCache();
          btn.innerHTML = `<i class="fa-solid fa-check mr-2"></i>¡Guardado! Actualizando...`;
          // El Navbar y el Home cachean settings al cargar la app; recargamos para que
          // se vea en todos lados de inmediato (acción poco frecuente, no amerita pub-sub).
          setTimeout(() => window.location.reload(), 700);
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.classList.remove("hidden");
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });
  }

  render();
}
