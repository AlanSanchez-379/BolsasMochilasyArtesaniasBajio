import { posAccessApi } from "../../api.js";
import { invalidateSettingsCache } from "../../settingsCache.js";
import { getCategories } from "../../catalogCache.js";

const SETTING_KEYS = { logo: "logo_url", banner: "banner_url" };
// Debe coincidir con ZONE_SHIPPING_COSTS en backend/app/utils/shipping_estimate.py.
const ZONE_NORMAL_COST = 380;
const ZONE_EXTENDED_COST = 480;

function numberFieldHtml(key, label, value, step = "0.01") {
  return `
    <div>
      <label class="block text-xs font-semibold text-gray-600 mb-1">${label}</label>
      <input type="number" step="${step}" min="0" data-shipping-key="${key}" value="${value ?? ""}"
        class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-mexican" />
    </div>
  `;
}

function textFieldHtml(key, label, value) {
  return `
    <div>
      <label class="block text-xs font-semibold text-gray-600 mb-1">${label}</label>
      <input type="text" data-shipping-key="${key}" value="${value ?? ""}"
        class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-mexican" />
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

  let extendedZonePrefixes = [];
  try {
    extendedZonePrefixes = JSON.parse(shippingSettings.shipping_extended_zone_postal_prefixes || "[]");
  } catch {
    extendedZonePrefixes = [];
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
        ${numberFieldHtml("shipping_tres_guerras_fixed_cost", "Costo fijo Tres Guerras, pedidos ligeros ($)", shippingSettings.shipping_tres_guerras_fixed_cost)}
        ${numberFieldHtml("shipping_bundle_fixed_cost", "Envío de paquetes de contenido fijo ($)", shippingSettings.shipping_bundle_fixed_cost)}
      </div>

      <div class="bg-brand-pink-light bg-opacity-40 rounded-xl p-4 mb-6">
        <label class="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" data-shipping-checkbox="shipping_bulk_promo_active"
            ${shippingSettings.shipping_bulk_promo_active === "true" ? "checked" : ""}
            class="w-5 h-5 accent-brand-mexican" />
          <span class="text-sm font-semibold text-gray-700">
            Promoción "Mayoreo desde 1 pieza" activa
          </span>
        </label>
        <p class="text-xs text-gray-500 mt-1 ml-8">
          Mientras esté prendida, en el checkout el cliente ve la opción de usar la tarifa fija de envío
          por zona aunque lleve pocas piezas.
        </p>
      </div>

      <h4 class="text-sm font-bold text-gray-700 mb-2">Tarifa fija de envío (pedidos de 4+ piezas)</h4>
      <p class="text-xs text-gray-500 mb-2">
        A partir de 4 piezas ya no se cotiza con Skydropx: se cobra $${ZONE_NORMAL_COST} (zona normal) o
        $${ZONE_EXTENDED_COST} (zona extendida). Escribe los prefijos de código postal que cuenten como
        zona extendida, separados por coma (ej. <code>77, 97, 23</code>).
      </p>
      <div class="mb-6">
        <label class="block text-xs font-semibold text-gray-600 mb-1">Prefijos de zona extendida</label>
        <input type="text" data-shipping-key="shipping_extended_zone_postal_prefixes"
          value="${extendedZonePrefixes.join(", ")}"
          placeholder="ej. 77, 97, 23"
          class="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-mexican" />
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
      <button data-save-shipping-settings class="bg-brand-mexican text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
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
        PIN compartido para entrar a esta misma terminal (<code>/venta-local</code>) —
        ${posAccessSettings.pin_configured ? "ya hay uno configurado." : "todavía no hay uno configurado."}
      </p>
      <label class="block text-xs font-semibold text-gray-600 mb-1">Nuevo PIN de Admin (mínimo 4 caracteres)</label>
      <input type="text" inputmode="numeric" autocomplete="off" id="pos-pin-input" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2" placeholder="Dejar en blanco para no cambiar" />
      
      <label class="block text-xs font-semibold text-gray-600 mb-1 mt-4">PIN de Empleados (Mínimo 4 caracteres)</label>
      <input type="text" inputmode="numeric" autocomplete="off" id="pos-emp-pin-input" class="w-full px-3 py-2 border border-gray-300 rounded text-sm mb-2" placeholder="${posAccessSettings.emp_pin_configured ? 'Ya configurado (escribe para cambiar)' : 'No configurado'}" />
      
      <p data-pos-pin-error class="text-red-500 text-sm mb-2 hidden"></p>
      <p data-pos-pin-success class="text-green-600 text-sm mb-2 hidden">PINs actualizados.</p>
      <button data-save-pos-pin class="bg-brand-mexican text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
        <i class="fa-solid fa-key mr-2"></i>Guardar PINs
      </button>
    </div>
  `;
}

function uploadCardHtml(type, label, currentUrl, hint) {
  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-xl font-bold mb-1">${label}</h3>
      <p class="text-sm text-gray-500 mb-4">${hint}</p>
      <div class="mb-4 bg-slate-50 rounded-xl p-4 flex items-center justify-center" style="min-height: 120px">
        ${
          currentUrl
            ? `<img src="${currentUrl}" alt="${label}" class="max-h-40 max-w-full object-contain" />`
            : `<span class="text-gray-400 text-sm">Sin imagen configurada todavía</span>`
        }
      </div>
      <input type="file" data-file-input="${type}" accept="image/png,image/jpeg,image/webp" class="mb-3 text-sm" />
      <p data-error="${type}" class="text-red-500 text-sm mb-2 hidden"></p>
      <button data-upload-btn="${type}" class="bg-brand-mexican text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
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

// --- Sección "Ajustes": branding (logo/banner), PIN de esta terminal, y ajustes de envío. ---
export function createAjustesSection(onUnauthorized) {
  return {
    async mount(container) {
      container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando ajustes...</div>`;

      let settings, shippingSettings, categories, posAccessSettings;
      try {
        [settings, shippingSettings, { categories }, posAccessSettings] = await Promise.all([
          posAccessApi.getAdminSettings(),
          posAccessApi.getShippingSettings(),
          getCategories(),
          posAccessApi.getPosAccessSettings(),
        ]);
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }

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
          const empInput = container.querySelector("#pos-emp-pin-input");
          const errorEl = container.querySelector("[data-pos-pin-error]");
          const successEl = container.querySelector("[data-pos-pin-success]");
          errorEl.classList.add("hidden");
          successEl.classList.add("hidden");

          btn.disabled = true;
          const originalText = btn.innerHTML;
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando...`;
          try {
            await posAccessApi.updatePosAccessSettings(input.value, empInput.value);
            posAccessSettings = await posAccessApi.getPosAccessSettings();
            input.value = "";
            empInput.value = "";
            successEl.classList.remove("hidden");
          } catch (err) {
            if (err.status === 401 && onUnauthorized) {
              onUnauthorized();
              return;
            }
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
            if (key === "shipping_extended_zone_postal_prefixes") {
              payload[key] = JSON.stringify(
                value
                  ? value
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean)
                  : []
              );
              return;
            }
            if (!value) return;
            if (key.startsWith("category:")) {
              weightPerCategory[key.slice("category:".length)] = Number(value);
            } else {
              payload[key] = value;
            }
          });
          payload.shipping_weight_per_category_kg = JSON.stringify(weightPerCategory);
          container.querySelectorAll("[data-shipping-checkbox]").forEach((input) => {
            payload[input.dataset.shippingCheckbox] = input.checked ? "true" : "false";
          });

          btn.disabled = true;
          const originalText = btn.innerHTML;
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando...`;
          try {
            shippingSettings = { ...shippingSettings, ...(await posAccessApi.updateShippingSettings(payload)) };
            successEl.classList.remove("hidden");
          } catch (err) {
            if (err.status === 401 && onUnauthorized) {
              onUnauthorized();
              return;
            }
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
              await posAccessApi.uploadSettingImage(type, file);
              reloadAfterChange();
            } catch (err) {
              if (err.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
              }
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
          ({ images } = await posAccessApi.settingsHistory(type));
        } catch (err) {
          listEl.innerHTML = `<span class="text-xs text-red-500">${err.message}</span>`;
          return;
        }
        if (!container.isConnected) return;

        if (images.length === 0) {
          listEl.innerHTML = `<span class="text-xs text-gray-400">Todavía no hay imágenes anteriores.</span>`;
          return;
        }

        listEl.innerHTML = images
          .map(
            (img) => `
          <button type="button" data-history-item="${img.url}" data-history-type="${type}"
            class="relative w-16 h-16 rounded-lg overflow-hidden border-2 ${
              img.url === currentUrl ? "border-brand-mexican" : "border-transparent hover:border-brand-pink"
            }" title="${img.url === currentUrl ? "En uso actualmente" : "Reutilizar esta imagen"}">
            <img src="${img.url}" class="w-full h-full object-cover" />
            ${img.url === currentUrl ? `<span class="absolute inset-0 bg-brand-mexican bg-opacity-30 flex items-center justify-center"><i class="fa-solid fa-check text-white"></i></span>` : ""}
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
              await posAccessApi.setSetting(SETTING_KEYS[type], url);
              reloadAfterChange();
            } catch (err) {
              if (err.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
              }
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
    },
  };
}
