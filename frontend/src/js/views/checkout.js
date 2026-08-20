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
import { STRIPE_PUBLISHABLE_KEY } from "../config.js";

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
    shipping: { full_name: appState.currentUser.full_name || "", phone: "", street: "", city: "", state: "", postal_code: "" },
    quoteOptions: null,
    selectedCarrier: null,
    paymentMethod: "card",
    order: null,
    clientSecret: null,
    stripe: null,
    elements: null,
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
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Revisa tu pedido</h2>
        ${appState.cart
          .map((item) => {
            const price = priceForQuantity(item.product, item.product.is_bundle ? item.quantity : combinedQty);
            return `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
              <div>
                <p class="font-semibold text-gray-900">${item.product.name}</p>
                <p class="text-sm text-gray-500">${item.variant.color} · x${item.quantity}</p>
              </div>
              <span class="font-bold">$${price * item.quantity}</span>
            </div>`;
          })
          .join("")}
        <div class="flex justify-between items-center pt-4 mt-2">
          <span class="text-lg font-bold text-gray-900">Subtotal</span>
          <span class="text-2xl font-bold text-gray-900">$${cartTotal()}</span>
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
    el.innerHTML = `
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Información de envío</h2>
        <form id="shipping-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Nombre completo</label>
            <input name="full_name" required value="${s.full_name}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
            <input name="phone" required value="${s.phone}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">Código Postal</label>
            <input name="postal_code" required maxlength="5" pattern="[0-9]{5}" value="${s.postal_code}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-semibold text-gray-700 mb-1">Calle y número</label>
            <input name="street" required value="${s.street}" class="w-full px-4 py-3 border border-gray-300 rounded outline-none focus:border-brand-pink" />
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
        <button id="quote-btn" class="mt-4 bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors">
          <i class="fa-solid fa-truck-fast mr-2"></i> Cotizar Envío
        </button>
        <p id="quote-error" class="text-red-500 text-sm mt-2 hidden"></p>

        <div id="quote-options" class="mt-6 space-y-3"></div>
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
          <span class="text-lg font-bold text-gray-900">$${opt.cost}</span>
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
    if (flow.paymentMethod === "card" && flow.order) {
      renderCardPaymentStep(el);
      return;
    }

    const selectedOption = flow.quoteOptions.find((o) => o.carrier === flow.selectedCarrier);
    const total = cartTotal() + selectedOption.cost;

    el.innerHTML = `
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Método de pago</h2>

        <div class="flex gap-3 mb-6">
          <button data-method="card" class="method-btn flex-1 py-4 rounded font-semibold border-2 ${
            flow.paymentMethod === "card" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
          }"><i class="fa-regular fa-credit-card mr-2"></i>Tarjeta</button>
          <button data-method="spei" class="method-btn flex-1 py-4 rounded font-semibold border-2 ${
            flow.paymentMethod === "spei" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600"
          }"><i class="fa-solid fa-building-columns mr-2"></i>Transferencia SPEI</button>
        </div>

        ${
          flow.paymentMethod === "spei"
            ? `<div class="bg-orange-50 border border-orange-200 rounded p-4 mb-6 text-sm text-orange-800">
                <p class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Atención</p>
                Tu pedido se creará como <strong>Pendiente de pago</strong>. Tendrás <strong>2 horas</strong> para
                realizar el depósito SPEI o el inventario se liberará automáticamente.
              </div>`
            : `<div class="bg-brand-peach-light bg-opacity-40 border border-gray-200 rounded p-4 mb-6 text-sm text-gray-700">
                En el siguiente paso vas a ingresar los datos de tu tarjeta. El cargo se procesa de forma segura con Stripe.
              </div>`
        }

        <div class="border-t border-gray-100 pt-4 space-y-2">
          <div class="flex justify-between text-gray-600"><span>Subtotal</span><span>$${cartTotal()}</span></div>
          <div class="flex justify-between text-gray-600"><span>Envío (${selectedOption.label})</span><span>$${selectedOption.cost}</span></div>
          <div class="flex justify-between text-2xl font-bold pt-2 text-gray-900"><span>Total</span><span>$${total}</span></div>
        </div>

        <p id="order-error" class="text-red-500 text-sm mt-4 hidden"></p>
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
        const { order, client_secret } = await api.createOrder({
          items: buildCheckoutItems(),
          shipping: { ...flow.shipping, carrier: flow.selectedCarrier },
          payment_method: flow.paymentMethod,
        });

        if (flow.paymentMethod === "card") {
          flow.order = order;
          flow.clientSecret = client_secret;
          renderCardPaymentStep(el);
          return;
        }

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

  function renderCardPaymentStep(el) {
    el.innerHTML = `
      <div class="border border-gray-200 rounded-lg p-6 mb-8 bg-white">
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Pago con tarjeta</h2>
        <p class="text-sm text-gray-500 mb-4">Pedido <strong>${flow.order.order_number}</strong> · Total: <strong>$${flow.order.total}</strong></p>
        <div id="payment-element" class="mb-4"></div>
        <p id="payment-element-errors" class="text-red-500 text-sm mb-4 hidden"></p>
        <button id="confirm-payment" class="w-full bg-brand-mexican hover:opacity-90 text-white px-8 py-4 rounded text-lg font-bold transition-opacity">
          Pagar $${flow.order.total}
        </button>
      </div>
    `;

    flow.stripe = flow.stripe || Stripe(STRIPE_PUBLISHABLE_KEY);
    flow.elements = flow.stripe.elements({ clientSecret: flow.clientSecret });
    flow.elements.create("payment").mount("#payment-element");

    el.querySelector("#confirm-payment").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Procesando...";
      const errorEl = el.querySelector("#payment-element-errors");
      errorEl.classList.add("hidden");

      const { error: submitError } = await flow.elements.submit();
      if (submitError) {
        errorEl.textContent = submitError.message || "Revisa los datos de tu tarjeta.";
        errorEl.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = `Pagar $${flow.order.total}`;
        return;
      }

      const { error, paymentIntent } = await flow.stripe.confirmPayment({
        elements: flow.elements,
        clientSecret: flow.clientSecret,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });

      if (error) {
        errorEl.textContent = error.message || "No se pudo procesar el pago. Intenta de nuevo.";
        errorEl.classList.remove("hidden");
        btn.disabled = false;
        btn.textContent = `Pagar $${flow.order.total}`;
        return;
      }

      if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
        clearCart();
        renderSuccess(container, flow.order);
      }
    });
  }

  render();
}

function renderSuccess(container, order) {
  const isSpei = order.payment_method === "spei";
  container.innerHTML = `
    <div class="max-w-xl mx-auto px-4 py-16 text-center fade-in">
      <i class="fa-solid fa-circle-check text-6xl text-brand-mexican mb-6"></i>
      <h2 class="text-3xl font-bold text-gray-900 mb-2">¡Pedido confirmado!</h2>
      <p class="text-gray-500 mb-6">Número de pedido <strong>${order.order_number}</strong></p>

      ${
        isSpei
          ? `<div class="bg-orange-50 border border-orange-200 rounded p-5 mb-8 text-left">
              <p class="font-bold mb-1 text-orange-800"><i class="fa-solid fa-clock mr-2"></i>Realiza tu transferencia SPEI antes de:</p>
              <p class="text-lg text-orange-800">${new Date(order.spei_payment_deadline).toLocaleString("es-MX")}</p>
            </div>`
          : `<div class="bg-brand-peach-light bg-opacity-40 border border-gray-200 rounded p-5 mb-8 text-left">
              <p><i class="fa-solid fa-circle-check mr-2 text-brand-mexican"></i>¡Tu pago fue aprobado! Estamos preparando tu pedido.</p>
            </div>`
      }

      <p class="text-2xl font-bold text-gray-900 mb-8">Total: $${order.total}</p>

      <div class="flex gap-4 justify-center">
        <button data-nav="/mis-pedidos" class="bg-gray-900 hover:bg-brand-mexican text-white px-6 py-3 rounded font-semibold transition-colors">Ver Mis Pedidos</button>
        <button data-nav="/" class="border-2 border-gray-300 hover:border-gray-900 px-6 py-3 rounded font-semibold transition-colors">Seguir Comprando</button>
      </div>
    </div>
  `;
  container.querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));
}
