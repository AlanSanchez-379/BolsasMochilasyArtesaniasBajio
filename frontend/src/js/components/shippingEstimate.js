import { api } from "../api.js";
import { buildCheckoutItems } from "../state.js";
import { escapeHtml } from "../html.js";

const money = value => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

export function shippingEstimateHtml() {
  return `<section class="bg-white border border-gray-200 rounded-lg p-6 mb-6" aria-labelledby="shipping-estimate-title">
    <h2 id="shipping-estimate-title" class="text-lg font-bold mb-2">Estima tu envío antes de iniciar sesión</h2>
    <p class="text-sm text-gray-600 mb-4">Para envíos en México. Las opciones y el total final se confirman al ingresar tu dirección completa.</p>
    <form id="shipping-estimate-form" class="flex flex-wrap items-end gap-3">
      <div><label for="shipping-estimate-postal" class="block text-sm font-semibold mb-1">Código postal</label>
      <input id="shipping-estimate-postal" name="postal_code" type="text" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" required class="border border-gray-300 rounded px-3 py-3 w-40" /></div>
      <button type="submit" class="bg-gray-900 text-white px-5 py-3 rounded disabled:opacity-50">Calcular envío</button>
    </form>
    <div id="shipping-estimate-result" role="status" aria-live="polite" class="mt-4 text-sm text-gray-700"></div>
  </section>`;
}

export function bindShippingEstimate(container, subtotal) {
  const form = container.querySelector("#shipping-estimate-form");
  const result = container.querySelector("#shipping-estimate-result");
  const button = form.querySelector("button");
  let generation = 0;
  form.addEventListener("input", () => {
    generation += 1;
    result.textContent = "";
    button.disabled = false;
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const token = ++generation;
    button.disabled = true;
    result.textContent = "Calculando envío…";
    try {
      const { options } = await api.checkoutQuote({ country: "México", postal_code: form.elements.postal_code.value }, buildCheckoutItems());
      if (!result.isConnected || token !== generation) return;
      const available = (options ?? []).filter(option => option.cost != null && Number.isFinite(Number(option.cost)) && Number(option.cost) >= 0);
      result.innerHTML = available.length ? available.map(option => `
        <p class="mb-2"><strong>${escapeHtml(option.label)}: ${money(option.cost)}</strong> · Total estimado: ${money(subtotal + Number(option.cost))}<br />${escapeHtml(option.eta)}</p>
      `).join("") + "<p>Estimación con código postal. Puede haber otras opciones al proporcionar la dirección completa.</p>"
        : "No hay una estimación disponible. Consulta el envío al ingresar tu dirección completa.";
    } catch {
      if (result.isConnected && token === generation) result.textContent = "No pudimos cotizar el envío. Inténtalo nuevamente.";
    } finally {
      if (token === generation) button.disabled = false;
    }
  });
}
