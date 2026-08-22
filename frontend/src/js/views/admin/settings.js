import { api } from "../../api.js";
import { invalidateSettingsCache } from "../../settingsCache.js";
import { getCategories } from "../../catalogCache.js";

const SETTING_KEYS = { logo: "logo_url", banner: "banner_url" };

function numberFieldHtml(key, label, value, step = "0.01") {
  return `
    <div>
      <label class="block text-xs font-semibold text-gray-600 mb-1">${label}</label>
      <input type="number" step="${step}" min="0" data-shipping-key="${key}" value="${value ?? ""}"
        class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-pink" />
    </div>
  `;
}

function textFieldHtml(key, label, value) {
  return `
    <div>
      <label class="block text-xs font-semibold text-gray-600 mb-1">${label}</label>
      <input type="text" data-shipping-key="${key}" value="${value ?? ""}"
        class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-pink" />
    </div>
  `;
}

function shippingSettingsCardHtml(shippingSettings, categories) {
  let weightPerCategory = {};
  try {
    weightPerCategory = JSON.parse(shippingSettings.shipping_weight_per_category_kg || "{}");
  } catch {
    weightPerCategory = {};
  }

  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:col-span-2">
      <h3 class="text-xl font-bold mb-1">Envíos (Skydropx)</h3>
      <p class="text-sm text-gray-500 mb-4">
        Pesos usados para estimar el envío en el checkout, dirección desde donde sale el paquete,
        y el costo fijo de la opción manual (Tres Guerras). Ajústalos cuando quieras — no requieren tocar código.
      </p>

      <h4 class="text-sm font-bold text-gray-700 mb-2">Peso aproximado por categoría (kg/pieza)</h4>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        ${categories
          .map((cat) => numberFieldHtml(`category:${cat.name}`, cat.name, weightPerCategory[cat.name]))
          .join("")}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        ${numberFieldHtml("shipping_default_weight_per_piece_kg", "Peso por defecto (categoría sin dato)", shippingSettings.shipping_default_weight_per_piece_kg)}
        ${numberFieldHtml("shipping_packaging_weight_kg", "Peso de empaque (una vez por pedido)", shippingSettings.shipping_packaging_weight_kg)}
        ${numberFieldHtml("shipping_tres_guerras_fixed_cost", "Costo fijo Tres Guerras ($)", shippingSettings.shipping_tres_guerras_fixed_cost)}
      </div>

      <h4 class="text-sm font-bold text-gray-700 mb-2">Dirección de origen</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        ${textFieldHtml("shipping_origin_name", "Nombre / empresa", shippingSettings.shipping_origin_name)}
        ${textFieldHtml("shipping_origin_phone", "Teléfono de contacto", shippingSettings.shipping_origin_phone)}
        ${textFieldHtml("shipping_origin_street", "Calle y número", shippingSettings.shipping_origin_street)}
        ${textFieldHtml("shipping_origin_colonia", "Colonia", shippingSettings.shipping_origin_colonia)}
        ${textFieldHtml("shipping_origin_city", "Ciudad", shippingSettings.shipping_origin_city)}
        ${textFieldHtml("shipping_origin_state", "Estado", shippingSettings.shipping_origin_state)}
        ${textFieldHtml("shipping_origin_postal_code", "Código postal", shippingSettings.shipping_origin_postal_code)}
      </div>

      <p data-shipping-error class="text-red-500 text-sm mb-2 hidden"></p>
      <p data-shipping-success class="text-green-600 text-sm mb-2 hidden">Guardado.</p>
      <button data-save-shipping-settings class="bg-brand-blue-dark text-white px-5 py-2 rounded-full font-semibold hover:bg-brand-blue">
        <i class="fa-solid fa-floppy-disk mr-2"></i>Guardar ajustes de envío
      </button>
    </div>
  `;
}

function posAccessCardHtml(posAccessSettings) {
  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-xl font-bold mb-1">PIN de Venta Local</h3>
      <p class="text-sm text-gray-500 mb-4">
        PIN compartido para entrar a <code>/venta-local</code> sin necesitar una cuenta —
        ${posAccessSettings.pin_configured ? "ya hay uno configurado." : "todavía no hay uno configurado."}
      </p>
      <label class="block text-xs font-semibold text-gray-600 mb-1">Nuevo PIN (mínimo 4 caracteres)</label>
      <input type="text" id="pos-pin-input" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2" />
      <p data-pos-pin-error class="text-red-500 text-sm mb-2 hidden"></p>
      <p data-pos-pin-success class="text-green-600 text-sm mb-2 hidden">PIN actualizado.</p>
      <button data-save-pos-pin class="bg-brand-blue-dark text-white px-5 py-2 rounded-full font-semibold hover:bg-brand-blue">
        <i class="fa-solid fa-key mr-2"></i>Guardar PIN
      </button>
    </div>
  `;
}

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

  let settings, shippingSettings, categories, posAccessSettings;
  try {
    [settings, shippingSettings, { categories }, posAccessSettings] = await Promise.all([
      api.adminGetSettings(),
      api.adminGetShippingSettings(),
      getCategories(),
      api.adminGetPosAccessSettings(),
    ]);
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
        ${posAccessCardHtml(posAccessSettings)}
        ${shippingSettingsCardHtml(shippingSettings, categories)}
      </div>
    `;

    container.querySelector("[data-save-pos-pin]").addEventListener("click", async () => {
      const btn = container.querySelector("[data-save-pos-pin]");
      const input = container.querySelector("#pos-pin-input");
      const errorEl = container.querySelector("[data-pos-pin-error]");
      const successEl = container.querySelector("[data-pos-pin-success]");
      errorEl.classList.add("hidden");
      successEl.classList.add("hidden");

      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando...`;
      try {
        posAccessSettings = await api.adminUpdatePosAccessSettings(input.value);
        input.value = "";
        successEl.classList.remove("hidden");
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    container.querySelector("[data-save-shipping-settings]").addEventListener("click", async () => {
      const btn = container.querySelector("[data-save-shipping-settings]");
      const errorEl = container.querySelector("[data-shipping-error]");
      const successEl = container.querySelector("[data-shipping-success]");
      errorEl.classList.add("hidden");
      successEl.classList.add("hidden");

      const payload = {};
      const weightPerCategory = {};
      container.querySelectorAll("[data-shipping-key]").forEach((input) => {
        const key = input.dataset.shippingKey;
        const value = input.value.trim();
        if (!value) return;
        if (key.startsWith("category:")) {
          weightPerCategory[key.slice("category:".length)] = Number(value);
        } else {
          payload[key] = value;
        }
      });
      payload.shipping_weight_per_category_kg = JSON.stringify(weightPerCategory);

      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando...`;
      try {
        shippingSettings = { ...shippingSettings, ...(await api.adminUpdateShippingSettings(payload)) };
        successEl.classList.remove("hidden");
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

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
