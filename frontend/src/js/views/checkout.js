import { api } from "../api.js";
import {
  state as appState,
  cartTotal,
  cartSavings,
  priceForQuantity,
  combinedQtyForProductLine,
  buildCheckoutItems,
  clearCart,
} from "../state.js";
import { navigate, currentRenderToken } from "../router.js";
import { getSettings } from "../settingsCache.js";

const STEPS = ["Carrito", "Envío", "Pago"];
const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function money(n) {
  return currencyFormatter.format(n);
}

function stepperHtml(current) {
  return `
    <div class="flex items-center justify-center gap-4 mb-10">
      ${STEPS.map((label, i) => {
        const stepNum = i + 1;
        const active = stepNum === current;
        const done = stepNum < current;
        return `
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
            active ? "bg-gray-900 text-white" : done ? "bg-brand-mexican text-white" : "bg-gray-200 text-gray-500"
          }">${done ? '<i class="fa-solid fa-check"></i>' : stepNum}</div>
          <span class="font-semibold text-sm ${active ? "text-gray-900" : "text-gray-400"}">${label}</span>
          ${i < STEPS.length - 1 ? '<div class="w-10 h-px bg-gray-300 mx-2"></div>' : ""}
        </div>`;
      }).join("")}
    </div>
  `;
}

export function renderCheckout(container) {
  if (!appState.currentUser) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-24 text-center fade-in">
        <i class="fa-solid fa-lock text-5xl text-brand-mexican mb-6"></i>
        <h2 class="text-3xl font-bold text-gray-900 mb-4">Inicia sesión para continuar</h2>
        <p class="text-gray-500 mb-8">Necesitas una cuenta para completar tu compra y dar seguimiento a tu pedido.</p>
        <button data-nav="/login" class="bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors">Iniciar Sesión</button>
      </div>`;
    container.querySelector("[data-nav]").addEventListener("click", () => navigate("/login"));
    return;
  }

  if (appState.cart.length === 0) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-24 text-center fade-in">
        <h2 class="text-3xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h2>
        <button data-nav="/categoria/Todos" class="bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors">Ir al catálogo</button>
      </div>`;
    container.querySelector("[data-nav]").addEventListener("click", () => navigate("/categoria/Todos"));
    return;
  }

  const flow = {
    step: 1,
    shipping: { full_name: appState.currentUser.full_name || "", phone: "", street: "", colonia: "", city: "", state: "", postal_code: "", country: "México", use_bulk_promo: false },
    isInternational: false,
    quoteOptions: null,
    bulkPromoAvailable: false,
    selectedCarrier: null,
    paymentMethod: "spei",
    order: null,
  };

  function render() {
    container.innerHTML = `
      <div class="max-w-3xl mx-auto px-4 py-10 fade-in">
        ${stepperHtml(flow.step)}
        <div id="step-content"></div>
      </div>
    `;
    const stepContent = container.querySelector("#step-content");
    if (flow.step === 1) renderStep1(stepContent);
    else if (flow.step === 2) renderStep2(stepContent);
    else renderStep3(stepContent);
  }

  function renderStep1(el) {
    const savings = cartSavings();

    el.innerHTML = `
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Revisa tu pedido</h2>
        <p class="text-xs text-gray-400 mb-4">
          El precio de mayoreo se aplica combinando piezas de la misma línea (no se puede combinar animado con yute).
        </p>
        ${appState.cart
          .map((item) => {
            const qty = item.product.is_bundle ? item.quantity : combinedQtyForProductLine(item.product);
            const price = priceForQuantity(item.product, qty);
            return `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <div>
                <p class="font-semibold text-gray-900">${item.product.name}</p>
                <p class="text-sm text-gray-500">${item.variant.color} · x${item.quantity}</p>
              </div>
              <span class="font-bold">${money(price * item.quantity)}</span>
            </div>`;
          })
          .join("")}
        ${
          savings > 0
            ? `<div class="bg-green-50 border border-green-200 rounded px-4 py-3 mt-4 text-sm text-green-800 font-semibold">
                <i class="fa-solid fa-piggy-bank mr-2"></i>
                Estás ahorrando ${money(savings)} por precio de mayoreo/súper mayoreo.
              </div>`
            : ""
        }
        <div class="flex justify-between items-center pt-4 mt-2">
          <span class="text-lg font-bold text-gray-900">Subtotal</span>
          <span class="text-2xl font-bold text-gray-900">${money(cartTotal())}</span>
        </div>
      </div>
      <div class="flex justify-between">
        <button id="back-to-cart" class="text-sm font-semibold text-gray-500 hover:text-gray-900">Volver al carrito</button>
        <button id="next-1" class="bg-gray-900 hover:bg-brand-mexican text-white px-8 py-3 rounded font-semibold transition-colors">Continuar</button>
      </div>
    `;
    el.querySelector("#back-to-cart").addEventListener("click", () => navigate("/carrito"));
    el.querySelector("#next-1").addEventListener("click", () => {
      flow.step = 2;
      render();
    });
  }

  function renderStep2(el) {
    const s = flow.shipping;
    const isIntl = flow.isInternational;
    el.innerHTML = `
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Información de envío</h2>

        <label class="flex items-start gap-3 cursor-pointer bg-blue-50 border border-blue-100 rounded p-4 mb-5">
          <input type="checkbox" id="international-toggle" ${isIntl ? "checked" : ""} class="w-5 h-5 mt-0.5 accent-brand-mexican flex-shrink-0" />
          <span class="text-sm text-blue-900">
            <span class="font-bold block">Es un envío internacional (fuera de México)</span>
            Solo el equipo de la tienda puede cotizar envíos internacionales. Marca esta casilla y te contactaremos para confirmar el costo real antes de enviarte tu pedido.
          </span>
        </label>

        <form id="shipping-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Nombre completo</label>
            <input name="full_name" required value="${s.full_name}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
            <input name="phone" required value="${s.phone}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          ${
            isIntl
              ? `<div>
                  <label class="block text-sm font-semibold text-gray-700 mb-1">País</label>
                  <input name="country" required value="${s.country === "México" ? "" : s.country}" placeholder="Ej. Estados Unidos" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
                </div>`
              : `<input type="hidden" name="country" value="México" />
                 <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-1">Código Postal</label>
                  <input name="postal_code" maxlength="10" value="${s.postal_code}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
                </div>`
          }
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Calle y número</label>
            <input name="street" required value="${s.street}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Colonia</label>
            <input name="colonia" value="${s.colonia}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Ciudad</label>
            <input name="city" required value="${s.city}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Estado</label>
            <input name="state" required value="${s.state}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
        </form>
        ${
          isIntl
            ? `<p class="text-xs text-brand-mexican font-semibold mt-2">
                <i class="fa-solid fa-globe mr-1"></i>Envío fuera de México: el costo real se confirma después de tu compra, te contactaremos para cobrarlo aparte.
              </p>`
            : ""
        }
        <button id="quote-btn" class="mt-4 bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors">
          <i class="fa-solid fa-truck-fast mr-2"></i> Cotizar Envío
        </button>
        <p id="quote-error" class="text-red-500 text-sm mt-2 hidden"></p>

        <div id="quote-options" class="mt-6 space-y-3"></div>
        <div id="bulk-promo-toggle" class="mt-4"></div>
        <p class="text-xs text-gray-400 mt-3">Costo de envío estimado; puede ajustarse una vez que se pese el paquete real.</p>
      </div>
      <div class="flex justify-between">
        <button id="back-2" class="text-sm font-semibold text-gray-500 hover:text-gray-900">Atrás</button>
        <button id="next-2" disabled class="bg-gray-900 hover:bg-brand-mexican text-white px-8 py-3 rounded font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Continuar</button>
      </div>
    `;

    const form = el.querySelector("#shipping-form");
    const nextBtn = el.querySelector("#next-2");
    const quoteError = el.querySelector("#quote-error");
    const quoteOptionsEl = el.querySelector("#quote-options");
    const bulkPromoToggleEl = el.querySelector("#bulk-promo-toggle");

    el.querySelector("#international-toggle").addEventListener("change", (e) => {
      Object.assign(flow.shipping, Object.fromEntries(new FormData(form).entries()));
      flow.isInternational = e.target.checked;
      flow.shipping.country = flow.isInternational ? "" : "México";
      flow.quoteOptions = null;
      flow.selectedCarrier = null;
      renderStep2(el);
    });

    function renderBulkPromoToggle() {
      if (!flow.bulkPromoAvailable) {
        bulkPromoToggleEl.innerHTML = "";
        return;
      }
      bulkPromoToggleEl.innerHTML = `
        <label class="flex items-center gap-3 cursor-pointer bg-brand-pink-light bg-opacity-30 rounded p-3">
          <input type="checkbox" id="bulk-promo-checkbox" ${flow.shipping.use_bulk_promo ? "checked" : ""} class="w-5 h-5 accent-brand-mexican" />
          <span class="text-sm font-semibold text-gray-700">
            Usar promoción de mayoreo (tarifa fija de envío, sin importar la cantidad)
          </span>
        </label>
      `;
      bulkPromoToggleEl.querySelector("#bulk-promo-checkbox").addEventListener("change", async (e) => {
        flow.shipping.use_bulk_promo = e.target.checked;
        await runQuote();
      });
    }

    async function runQuote() {
      quoteError.classList.add("hidden");
      try {
        const { options, bulk_promo_available } = await api.checkoutQuote(flow.shipping, buildCheckoutItems());
        flow.quoteOptions = options;
        flow.bulkPromoAvailable = bulk_promo_available;
        flow.selectedCarrier = null;
        nextBtn.disabled = true;
        renderQuoteOptions();
        renderBulkPromoToggle();
      } catch (err) {
        quoteError.textContent = err.message;
        quoteError.classList.remove("hidden");
      }
    }

    function renderQuoteOptions() {
      if (!flow.quoteOptions) {
        quoteOptionsEl.innerHTML = "";
        return;
      }
      quoteOptionsEl.innerHTML = flow.quoteOptions
        .map(
          (opt) => `
        <label class="flex items-center justify-between border rounded p-4 cursor-pointer ${
          flow.selectedCarrier === opt.carrier ? "border-gray-900 border-2 bg-brand-peach-light bg-opacity-30" : "border-gray-200"
        }">
          <div class="flex items-center gap-3">
            <input type="radio" name="carrier" value="${opt.carrier}" ${flow.selectedCarrier === opt.carrier ? "checked" : ""} />
            <div>
              <p class="font-bold text-gray-900">${opt.label}</p>
              <p class="text-sm text-gray-500">${opt.eta}</p>
            </div>
          </div>
          <span class="text-lg font-bold text-gray-900">${opt.carrier === "international_pending" ? "Por confirmar" : money(opt.cost)}</span>
        </label>`
        )
        .join("");

      quoteOptionsEl.querySelectorAll('input[name="carrier"]').forEach((input) => {
        input.addEventListener("change", () => {
          flow.selectedCarrier = input.value;
          nextBtn.disabled = false;
          renderQuoteOptions();
        });
      });
    }

    el.querySelector("#quote-btn").addEventListener("click", async () => {
      const formData = new FormData(form);
      Object.assign(flow.shipping, Object.fromEntries(formData.entries()));
      if (!form.reportValidity()) return;
      if (!flow.isInternational) {
        if (!/^\d{5}$/.test(flow.shipping.postal_code || "")) {
          quoteError.textContent = "Código postal inválido. Debe tener 5 dígitos.";
          quoteError.classList.remove("hidden");
          return;
        }
        if (!flow.shipping.colonia) {
          quoteError.textContent = "Falta la colonia.";
          quoteError.classList.remove("hidden");
          return;
        }
      }
      await runQuote();
    });

    renderQuoteOptions();
    renderBulkPromoToggle();

    el.querySelector("#back-2").addEventListener("click", () => {
      flow.step = 1;
      render();
    });
    nextBtn.addEventListener("click", () => {
      Object.assign(flow.shipping, Object.fromEntries(new FormData(form).entries()));
      flow.step = 3;
      render();
    });
  }

  async function renderStep3(el) {
    const settings = await getSettings();
    const selectedOption = flow.quoteOptions.find((o) => o.carrier === flow.selectedCarrier);
    const total = cartTotal() + selectedOption.cost;

    el.innerHTML = `
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Método de pago</h2>

        <div class="flex gap-3 mb-6">
          <button data-method="spei" class="method-btn flex-1 py-4 rounded font-semibold border-2 ${
            flow.paymentMethod === "spei" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
          }"><i class="fa-solid fa-building-columns mr-2"></i>Transferencia SPEI</button>
          <button data-method="mercado_pago" class="method-btn flex-1 py-4 rounded font-semibold border-2 ${
            flow.paymentMethod === "mercado_pago" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
          }"><i class="fa-solid fa-wallet mr-2"></i>Mercado Pago</button>
        </div>

        ${
          flow.paymentMethod === "spei"
            ? `<div class="bg-orange-50 border border-orange-200 rounded p-4 mb-6 text-sm text-orange-800">
                <p class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Atención</p>
                Tu pedido se creará como <strong>Pendiente de pago</strong>. Tendrás <strong>2 horas</strong> para
                realizar el depósito SPEI por ${money(total)} a cualquiera de estas cuentas y subir tu comprobante, o el inventario se liberará automáticamente:
                <ul class="list-disc pl-5 mt-2 font-mono text-xs font-semibold">
                  <li>Banco Azteca: 1272 2501 3540 365808</li>
                  <li>Mercado Pago W: 722969010810246052</li>
                  <li>BanCoppel: 137225104582902160</li>
                </ul>
              </div>`
            : `<div class="bg-brand-peach-light bg-opacity-40 border border-gray-200 rounded p-4 mb-6 text-sm text-gray-700">
                <p class="font-bold mb-1"><i class="fa-solid fa-circle-info mr-2"></i>Cómo funciona</p>
                Al confirmar, te enviaremos por WhatsApp al número que diste un link de Mercado Pago por
                ${money(total)} para que completes tu pago.
              </div>`
        }

        <div class="border-t border-gray-100 pt-4 space-y-2">
          <div class="flex justify-between text-gray-600"><span>Subtotal</span><span>${money(cartTotal())}</span></div>
          <div class="flex justify-between text-gray-600">
            <span>Envío (${selectedOption.label})</span>
            <span>${selectedOption.carrier === "international_pending" ? "Por confirmar" : money(selectedOption.cost)}</span>
          </div>
          <div class="flex justify-between text-2xl font-bold pt-2 text-gray-900"><span>Total</span><span>${money(total)}</span></div>
        </div>
        ${
          selectedOption.carrier === "international_pending"
            ? `<p class="text-xs text-brand-mexican font-semibold mt-3">
                <i class="fa-solid fa-globe mr-1"></i>El total de arriba NO incluye el envío -- te contactaremos para confirmar
                el costo real y cobrarlo aparte.
              </p>`
            : ""
        }

        <p id="order-error" class="text-red-500 text-sm mt-4 hidden"></p>

        <p class="text-xs text-gray-400 mt-4">
          Al confirmar aceptas nuestra
          <a href="#/politica-envios" target="_blank" class="text-brand-mexican hover:underline">Política de Envíos</a>.
        </p>
      </div>
      <div class="flex justify-between">
        <button id="back-3" class="text-sm font-semibold text-gray-500 hover:text-gray-900">Atrás</button>
        <button id="place-order" class="bg-brand-mexican hover:opacity-90 text-white px-8 py-4 rounded text-lg font-bold transition-opacity">
          Confirmar Pedido
        </button>
      </div>
    `;

    el.querySelectorAll(".method-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        flow.paymentMethod = btn.dataset.method;
        renderStep3(el);
      });
    });

    el.querySelector("#back-3").addEventListener("click", () => {
      flow.step = 2;
      render();
    });

    el.querySelector("#place-order").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Procesando...";
      const errorEl = el.querySelector("#order-error");
      errorEl.classList.add("hidden");

      try {
        const { order } = await api.createOrder({
          items: buildCheckoutItems(),
          shipping: { ...flow.shipping, carrier: flow.selectedCarrier },
          payment_method: flow.paymentMethod,
        });

        clearCart();
        renderSuccess(container, order);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = "Confirmar Pedido";
      }
    });
  }

  render();
}

async function renderSuccess(container, order, justQuoted = false) {
  const isSpei = order.payment_method === "spei";
  const isMercadoPago = order.payment_method === "mercado_pago";
  const isIntlPending = order.shipping.carrier === "international_pending";

  container.innerHTML = `
    <div class="max-w-xl mx-auto px-4 py-16 text-center fade-in">
      <i class="fa-solid fa-circle-check text-6xl text-brand-mexican mb-6"></i>
      <h2 class="text-3xl font-bold text-gray-900 mb-2">¡Pedido confirmado!</h2>
      <p class="text-gray-500 mb-6">Número de pedido <strong>${order.order_number}</strong></p>

      ${
        isIntlPending
          ? `<div class="bg-blue-50 border border-blue-200 rounded p-5 mb-8 text-left">
              <p class="font-bold mb-1 text-blue-800"><i class="fa-solid fa-globe mr-2"></i>Cotizando tu envío internacional...</p>
              <p class="text-sm text-blue-800">
                Estamos calculando el costo real de tu envío -- puede tardar unos minutos. En cuanto esté listo, verás aquí mismo
                el total final y cómo pagar. No necesitas hacer nada, puedes dejar esta página abierta o volver después desde
                "Mis Pedidos".
              </p>
              <div class="flex items-center gap-2 mt-3 text-blue-700 text-sm">
                <i class="fa-solid fa-spinner fa-spin"></i> Esperando cotización de la tienda...
              </div>
            </div>`
          : `${
              justQuoted
                ? `<div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4 text-left text-sm text-blue-800">
                    <i class="fa-solid fa-globe mr-1"></i>Ya tenemos el costo de tu envío internacional -- el total de abajo ya lo incluye.
                  </div>`
                : ""
            }
            ${
              isSpei
                ? `<div class="bg-orange-50 border border-orange-200 rounded p-5 mb-8 text-left">
                    <p class="font-bold mb-1 text-orange-800"><i class="fa-solid fa-clock mr-2"></i>Realiza tu transferencia SPEI antes de:</p>
                    <p class="text-lg text-orange-800 mb-2">${new Date(order.spei_payment_deadline).toLocaleString("es-MX")}</p>
                    <p class="text-sm text-orange-800">A cualquiera de estas cuentas:</p>
                    <ul class="list-disc pl-5 mt-1 font-mono text-xs font-semibold text-orange-800">
                      <li>Banco Azteca: 1272 2501 3540 365808</li>
                      <li>Mercado Pago W: 722969010810246052</li>
                      <li>BanCoppel: 137225104582902160</li>
                    </ul>
                    <div class="mt-4 pt-4 border-t border-orange-200">
                      <p class="text-sm font-semibold text-orange-800 mb-2">Sube tu comprobante de depósito:</p>
                      <div class="flex gap-2">
                        <input type="file" id="voucher-file" accept="image/*,.pdf" class="flex-1 text-sm text-orange-800" />
                        <button id="voucher-upload-btn" class="bg-orange-800 text-white text-sm font-semibold px-4 py-2 rounded hover:opacity-90">Subir</button>
                      </div>
                      <p id="voucher-status" class="text-xs mt-2"></p>
                    </div>
                  </div>`
                : isMercadoPago
                ? `<div class="bg-orange-50 border border-orange-200 rounded p-5 mb-8 text-left">
                    <p class="font-bold mb-1 text-orange-800"><i class="fa-solid fa-wallet mr-2"></i>Pago en validación</p>
                    <p class="text-sm text-orange-800">Nos pondremos en contacto por WhatsApp al número que diste para enviarte el link de pago de Mercado Pago.</p>
                  </div>`
                : `<div class="bg-brand-peach-light bg-opacity-40 border border-gray-200 rounded p-5 mb-8 text-left">
                    <p><i class="fa-solid fa-circle-check mr-2 text-brand-mexican"></i>¡Tu pago fue aprobado! Estamos preparando tu pedido.</p>
                  </div>`
            }`
      }

      <p class="text-2xl font-bold text-gray-900 mb-8">Total: ${money(order.total)}</p>

      <div class="flex gap-4 justify-center">
        <button data-nav="/mis-pedidos" class="bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors">Ver Mis Pedidos</button>
        <button data-nav="/" class="border-2 border-gray-300 hover:border-gray-900 px-6 py-3 rounded font-semibold transition-colors">Seguir Comprando</button>
      </div>
    </div>
  `;
  container.querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));

  if (isIntlPending) {
    const token = currentRenderToken();
    const poll = async () => {
      if (token !== currentRenderToken()) return; // el cliente ya salió de esta pantalla
      try {
        const { order: fresh } = await api.getOrder(order.id);
        if (fresh.shipping.carrier !== "international_pending") {
          renderSuccess(container, fresh, true);
          return;
        }
      } catch {
        // red inestable, etc. -- seguimos intentando
      }
      setTimeout(poll, 8000);
    };
    setTimeout(poll, 8000);
    return;
  }

  const uploadBtn = container.querySelector("#voucher-upload-btn");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      const fileInput = container.querySelector("#voucher-file");
      const statusEl = container.querySelector("#voucher-status");
      const file = fileInput.files[0];
      if (!file) {
        statusEl.textContent = "Selecciona un archivo primero.";
        statusEl.className = "text-xs mt-2 text-red-600 font-semibold";
        return;
      }
      uploadBtn.disabled = true;
      uploadBtn.textContent = "Subiendo...";
      try {
        await api.uploadOrderVoucher(order.id, file);
        statusEl.textContent = "¡Comprobante recibido! Lo revisaremos y confirmaremos tu pago.";
        statusEl.className = "text-xs mt-2 text-emerald-700 font-semibold";
        uploadBtn.textContent = "Subido";
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.className = "text-xs mt-2 text-red-600 font-semibold";
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Subir";
      }
    });
  }
}
