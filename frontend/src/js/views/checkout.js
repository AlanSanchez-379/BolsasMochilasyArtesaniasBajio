import { api } from "../api.js";
import {
  state as appState,
  cartTotal,
  priceForQuantity,
  combinedNonBundleQty,
  buildCheckoutItems,
  clearCart,
} from "../state.js";
import { navigate } from "../router.js";

const STEPS = ["Carrito", "Envío", "Pago"];

function stepperHtml(current) {
  return `
    <div class="flex items-center justify-center gap-4 mb-10">
      ${STEPS.map((label, i) => {
        const stepNum = i + 1;
        const active = stepNum === current;
        const done = stepNum < current;
        return `
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold ${
            active ? "bg-brand-blue-dark text-white" : done ? "bg-brand-teal text-white" : "bg-gray-200 text-gray-500"
          }">${done ? '<i class="fa-solid fa-check"></i>' : stepNum}</div>
          <span class="font-semibold ${active ? "text-text-dark" : "text-gray-400"}">${label}</span>
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
        <i class="fa-solid fa-lock text-5xl text-brand-salmon mb-6"></i>
        <h2 class="text-3xl font-bold mb-4">Inicia sesión para continuar</h2>
        <p class="text-gray-500 mb-8">Necesitas una cuenta para completar tu compra y dar seguimiento a tu pedido.</p>
        <button data-nav="/login" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">Iniciar Sesión</button>
      </div>`;
    container.querySelector("[data-nav]").addEventListener("click", () => navigate("/login"));
    return;
  }

  if (appState.cart.length === 0) {
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-24 text-center fade-in">
        <h2 class="text-3xl font-bold mb-4">Tu carrito está vacío</h2>
        <button data-nav="/categoria/Todos" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">Ir al catálogo</button>
      </div>`;
    container.querySelector("[data-nav]").addEventListener("click", () => navigate("/categoria/Todos"));
    return;
  }

  const flow = {
    step: 1,
    shipping: { full_name: appState.currentUser.full_name || "", phone: "", street: "", city: "", state: "", postal_code: "" },
    quoteOptions: null,
    selectedCarrier: null,
    paymentMethod: "card",
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
    const combinedQty = combinedNonBundleQty();

    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 class="text-2xl font-bold mb-6">Revisa tu pedido</h2>
        ${appState.cart
          .map((item) => {
            const price = priceForQuantity(item.product, item.product.is_bundle ? item.quantity : combinedQty);
            return `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <div>
                <p class="font-semibold">${item.product.name}</p>
                <p class="text-sm text-gray-500">${item.variant.color} · x${item.quantity}</p>
              </div>
              <span class="font-bold">$${price * item.quantity}</span>
            </div>`;
          })
          .join("")}
        <div class="flex justify-between items-center pt-4 mt-2">
          <span class="text-lg font-bold">Subtotal</span>
          <span class="text-2xl font-bold text-brand-blue-dark">$${cartTotal()}</span>
        </div>
      </div>
      <div class="flex justify-between">
        <button id="back-to-cart" class="text-brand-blue-dark font-semibold hover:underline">Volver al carrito</button>
        <button id="next-1" class="bg-brand-blue-dark text-white px-8 py-3 rounded-full font-semibold hover:bg-brand-blue">Continuar</button>
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
    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 class="text-2xl font-bold mb-6">Información de envío</h2>
        <form id="shipping-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-sm font-bold text-gray-700 mb-1">Nombre completo</label>
            <input name="full_name" required value="${s.full_name}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
            <input name="phone" required value="${s.phone}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Código Postal</label>
            <input name="postal_code" required maxlength="5" pattern="[0-9]{5}" value="${s.postal_code}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-bold text-gray-700 mb-1">Calle y número</label>
            <input name="street" required value="${s.street}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Ciudad</label>
            <input name="city" required value="${s.city}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Estado</label>
            <input name="state" required value="${s.state}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-brand-teal" />
          </div>
        </form>
        <button id="quote-btn" class="mt-4 bg-brand-teal text-white px-6 py-3 rounded-full font-semibold hover:opacity-90">
          <i class="fa-solid fa-truck-fast mr-2"></i> Cotizar Envío
        </button>
        <p id="quote-error" class="text-red-500 text-sm mt-2 hidden"></p>

        <div id="quote-options" class="mt-6 space-y-3"></div>
      </div>
      <div class="flex justify-between">
        <button id="back-2" class="text-brand-blue-dark font-semibold hover:underline">Atrás</button>
        <button id="next-2" disabled class="bg-brand-blue-dark text-white px-8 py-3 rounded-full font-semibold hover:bg-brand-blue disabled:opacity-40 disabled:cursor-not-allowed">Continuar</button>
      </div>
    `;

    const form = el.querySelector("#shipping-form");
    const nextBtn = el.querySelector("#next-2");
    const quoteError = el.querySelector("#quote-error");
    const quoteOptionsEl = el.querySelector("#quote-options");

    function renderQuoteOptions() {
      if (!flow.quoteOptions) {
        quoteOptionsEl.innerHTML = "";
        return;
      }
      quoteOptionsEl.innerHTML = flow.quoteOptions
        .map(
          (opt) => `
        <label class="flex items-center justify-between border-2 rounded-xl p-4 cursor-pointer ${
          flow.selectedCarrier === opt.carrier ? "border-brand-blue-dark bg-brand-cream" : "border-gray-200"
        }">
          <div class="flex items-center gap-3">
            <input type="radio" name="carrier" value="${opt.carrier}" ${flow.selectedCarrier === opt.carrier ? "checked" : ""} />
            <div>
              <p class="font-bold">${opt.label}</p>
              <p class="text-sm text-gray-500">${opt.eta}</p>
            </div>
          </div>
          <span class="text-xl font-bold text-brand-blue-dark">$${opt.cost}</span>
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
      quoteError.classList.add("hidden");
      const formData = new FormData(form);
      Object.assign(flow.shipping, Object.fromEntries(formData.entries()));
      if (!form.reportValidity()) return;

      try {
        const { options } = await api.checkoutQuote(flow.shipping.postal_code);
        flow.quoteOptions = options;
        flow.selectedCarrier = null;
        nextBtn.disabled = true;
        renderQuoteOptions();
      } catch (err) {
        quoteError.textContent = err.message;
        quoteError.classList.remove("hidden");
      }
    });

    renderQuoteOptions();

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

  function renderStep3(el) {
    const selectedOption = flow.quoteOptions.find((o) => o.carrier === flow.selectedCarrier);
    const total = cartTotal() + selectedOption.cost;

    el.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 class="text-2xl font-bold mb-6">Método de pago</h2>

        <div class="flex gap-3 mb-6">
          <button data-method="card" class="method-btn flex-1 py-4 rounded-xl font-semibold border-2 ${
            flow.paymentMethod === "card" ? "bg-brand-blue-dark text-white border-brand-blue-dark" : "border-gray-300 text-gray-600"
          }"><i class="fa-regular fa-credit-card mr-2"></i>Tarjeta</button>
          <button data-method="spei" class="method-btn flex-1 py-4 rounded-xl font-semibold border-2 ${
            flow.paymentMethod === "spei" ? "bg-brand-blue-dark text-white border-brand-blue-dark" : "border-gray-300 text-gray-600"
          }"><i class="fa-solid fa-building-columns mr-2"></i>Transferencia SPEI</button>
        </div>

        ${
          flow.paymentMethod === "spei"
            ? `<div class="bg-brand-salmon bg-opacity-20 border border-brand-salmon rounded-xl p-4 mb-6 text-sm text-text-dark">
                <i class="fa-solid fa-triangle-exclamation text-brand-salmon mr-2"></i>
                Tu pedido se creará como <strong>Pendiente de pago</strong>. Tendrás <strong>2 horas</strong> para
                realizar el depósito SPEI o el inventario se liberará automáticamente.
              </div>`
            : `<div class="bg-brand-cream rounded-xl p-4 mb-6 text-sm text-text-dark">
                Tu pedido quedará como <strong>Pago en validación</strong> mientras confirmamos el cargo.
              </div>`
        }

        <div class="border-t pt-4 space-y-2">
          <div class="flex justify-between text-gray-600"><span>Subtotal</span><span>$${cartTotal()}</span></div>
          <div class="flex justify-between text-gray-600"><span>Envío (${selectedOption.label})</span><span>$${selectedOption.cost}</span></div>
          <div class="flex justify-between text-2xl font-bold pt-2"><span>Total</span><span class="text-brand-blue-dark">$${total}</span></div>
        </div>

        <p id="order-error" class="text-red-500 text-sm mt-4 hidden"></p>
      </div>
      <div class="flex justify-between">
        <button id="back-3" class="text-brand-blue-dark font-semibold hover:underline">Atrás</button>
        <button id="place-order" class="bg-brand-blue-dark text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-brand-blue shadow-lg">
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

function renderSuccess(container, order) {
  const isSpei = order.payment_method === "spei";
  container.innerHTML = `
    <div class="max-w-xl mx-auto px-4 py-16 text-center fade-in">
      <i class="fa-solid fa-circle-check text-6xl text-brand-teal mb-6"></i>
      <h2 class="text-3xl font-bold mb-2">¡Pedido confirmado!</h2>
      <p class="text-gray-500 mb-6">Número de pedido <strong>${order.order_number}</strong></p>

      ${
        isSpei
          ? `<div class="bg-brand-salmon bg-opacity-20 border border-brand-salmon rounded-xl p-5 mb-8 text-left">
              <p class="font-bold mb-1"><i class="fa-solid fa-clock mr-2"></i>Realiza tu transferencia SPEI antes de:</p>
              <p class="text-lg">${new Date(order.spei_payment_deadline).toLocaleString("es-MX")}</p>
            </div>`
          : `<div class="bg-brand-cream rounded-xl p-5 mb-8 text-left">
              <p>Tu pago está <strong>en validación</strong>. Te notificaremos cuando se confirme.</p>
            </div>`
      }

      <p class="text-2xl font-bold text-brand-blue-dark mb-8">Total: $${order.total}</p>

      <div class="flex gap-4 justify-center">
        <button data-nav="/mis-pedidos" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">Ver Mis Pedidos</button>
        <button data-nav="/" class="border-2 border-gray-300 px-6 py-3 rounded-full font-semibold hover:bg-gray-50">Seguir Comprando</button>
      </div>
    </div>
  `;
  container.querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));
}
