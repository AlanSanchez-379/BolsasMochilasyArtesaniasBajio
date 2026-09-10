import { posAccessApi } from "../../api.js";
import { buildSaleTicketHtml, sampleOrderForPreview } from "../../components/saleTicket.js";

// --- Sección "Personalizar Ticket": logo, nombre y mensaje del ticket de venta
// (58mm, impresora térmica) que se imprime desde Cobrar, con vista previa en vivo. ---
export function createTicketSection(onUnauthorized) {
  return {
    async mount(container) {
      container.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando...</div>`;

      let settings;
      try {
        settings = await posAccessApi.getTicketSettings();
      } catch (err) {
        if (err.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }
        container.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        return;
      }

      const draft = {
        ticket_logo_url: settings.ticket_logo_url || "",
        ticket_store_name: settings.ticket_store_name || "",
        ticket_footer_message: settings.ticket_footer_message || "",
        ticket_qr_url: settings.ticket_qr_url || "",
      };
      const sampleOrder = sampleOrderForPreview();

      function render() {
        container.innerHTML = `
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 class="text-xl font-bold mb-1">Personalizar Ticket</h3>
              <p class="text-sm text-gray-500 mb-4">
                Así se ve e imprime el ticket de venta (58mm, impresora térmica) cada vez que se cobra en Cobrar.
                Se imprime directo en la impresora ya instalada -- no se genera ningún PDF.
              </p>

              <label class="block text-sm font-bold text-gray-700 mb-1">Logotipo del ticket</label>
              <div class="mb-2 bg-slate-50 rounded-xl p-4 flex items-center justify-center" style="min-height: 90px">
                ${
                  draft.ticket_logo_url
                    ? `<img src="${draft.ticket_logo_url}" alt="Logo del ticket" class="max-h-20 max-w-full object-contain" />`
                    : `<span class="text-gray-400 text-sm">Sin logo configurado (opcional)</span>`
                }
              </div>
              <div class="flex items-center gap-2 mb-4">
                <input type="file" id="ticket-logo-file" accept="image/png,image/jpeg,image/webp" class="flex-1 text-sm" />
                ${
                  draft.ticket_logo_url
                    ? `<button type="button" id="ticket-logo-remove" class="text-red-400 hover:text-red-600 text-sm font-semibold">Quitar</button>`
                    : ""
                }
              </div>
              <p id="ticket-logo-error" class="text-red-500 text-sm mb-3 hidden"></p>

              <label class="block text-sm font-bold text-gray-700 mb-1 mt-4">Código QR (Redes Sociales)</label>
              <div class="mb-2 bg-slate-50 rounded-xl p-4 flex items-center justify-center" style="min-height: 90px">
                ${
                  draft.ticket_qr_url
                    ? `<img src="${draft.ticket_qr_url}" alt="QR del ticket" class="max-h-20 max-w-full object-contain" />`
                    : `<span class="text-gray-400 text-sm">Sin QR configurado (opcional)</span>`
                }
              </div>
              <div class="flex items-center gap-2 mb-4">
                <input type="file" id="ticket-qr-file" accept="image/png,image/jpeg,image/webp" class="flex-1 text-sm" />
                ${
                  draft.ticket_qr_url
                    ? `<button type="button" id="ticket-qr-remove" class="text-red-400 hover:text-red-600 text-sm font-semibold">Quitar</button>`
                    : ""
                }
              </div>
              <p id="ticket-qr-error" class="text-red-500 text-sm mb-3 hidden"></p>

              <label class="block text-sm font-bold text-gray-700 mb-1">Nombre de la tienda en el ticket</label>
              <input type="text" id="ticket-store-name" value="${draft.ticket_store_name}"
                placeholder="Bolsas, Mochilas Y Artesanías del Bajío"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4" />

              <label class="block text-sm font-bold text-gray-700 mb-1">Mensaje al pie del ticket</label>
              <textarea id="ticket-footer-message" rows="2" placeholder="¡Gracias por tu compra!"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4">${draft.ticket_footer_message}</textarea>

              <p data-ticket-error class="text-red-500 text-sm mb-2 hidden"></p>
              <p data-ticket-success class="text-green-600 text-sm mb-2 hidden">Guardado.</p>
              <button id="save-ticket-settings" class="bg-brand-mexican text-white px-5 py-2 rounded-full font-semibold hover:opacity-90">
                <i class="fa-solid fa-floppy-disk mr-2"></i>Guardar
              </button>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 class="text-lg font-bold mb-1">Vista previa</h3>
              <p class="text-sm text-gray-500 mb-4">Con un pedido de ejemplo -- se actualiza mientras editas.</p>
              <div class="flex justify-center bg-gray-100 rounded-xl p-6">
                <div class="bg-white shadow-lg" style="width: 220px;">
                  <iframe id="ticket-preview-frame" style="width: 100%; height: 420px; border: 0;"></iframe>
                </div>
              </div>
            </div>
          </div>
        `;

        function updatePreview() {
          const frame = container.querySelector("#ticket-preview-frame");
          if (frame) frame.srcdoc = buildSaleTicketHtml(sampleOrder, draft);
        }
        updatePreview();

        container.querySelector("#ticket-store-name").addEventListener("input", (e) => {
          draft.ticket_store_name = e.target.value;
          updatePreview();
        });
        container.querySelector("#ticket-footer-message").addEventListener("input", (e) => {
          draft.ticket_footer_message = e.target.value;
          updatePreview();
        });

        const logoRemoveBtn = container.querySelector("#ticket-logo-remove");
        if (logoRemoveBtn) {
          logoRemoveBtn.addEventListener("click", () => {
            draft.ticket_logo_url = "";
            render();
          });
        }

        container.querySelector("#ticket-logo-file").addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const errorEl = container.querySelector("#ticket-logo-error");
          errorEl.classList.add("hidden");
          try {
            const { url } = await posAccessApi.uploadImage(file);
            draft.ticket_logo_url = url;
            render();
          } catch (err) {
            if (err.status === 401 && onUnauthorized) {
              onUnauthorized();
              return;
            }
            errorEl.textContent = err.message;
            errorEl.classList.remove("hidden");
          }
        });

        const qrRemoveBtn = container.querySelector("#ticket-qr-remove");
        if (qrRemoveBtn) {
          qrRemoveBtn.addEventListener("click", () => {
            draft.ticket_qr_url = "";
            render();
          });
        }

        container.querySelector("#ticket-qr-file").addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const errorEl = container.querySelector("#ticket-qr-error");
          errorEl.classList.add("hidden");
          try {
            const { url } = await posAccessApi.uploadImage(file);
            draft.ticket_qr_url = url;
            render();
          } catch (err) {
            if (err.status === 401 && onUnauthorized) {
              onUnauthorized();
              return;
            }
            errorEl.textContent = err.message;
            errorEl.classList.remove("hidden");
          }
        });

        container.querySelector("#save-ticket-settings").addEventListener("click", async () => {
          const btn = container.querySelector("#save-ticket-settings");
          const errorEl = container.querySelector("[data-ticket-error]");
          const successEl = container.querySelector("[data-ticket-success]");
          errorEl.classList.add("hidden");
          successEl.classList.add("hidden");
          btn.disabled = true;
          const originalText = btn.innerHTML;
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Guardando...`;
          try {
            settings = await posAccessApi.updateTicketSettings(draft);
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
      }

      render();
    },
  };
}
