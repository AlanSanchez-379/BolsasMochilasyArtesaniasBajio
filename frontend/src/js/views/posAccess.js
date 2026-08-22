import { posAccessApi } from "../api.js";
import { renderPosTab } from "./admin/pos.js";

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function marginHtml(product) {
  if (product.cost_price == null) return `<span class="text-gray-400">—</span>`;
  const margin = Number(product.price_normal) - Number(product.cost_price);
  const pct = Number(product.price_normal) > 0 ? (margin / Number(product.price_normal)) * 100 : 0;
  const colorClass = margin >= 0 ? "text-green-600" : "text-red-600";
  return `<span class="${colorClass} font-semibold">${money(margin)} (${pct.toFixed(0)}%)</span>`;
}

function inventoryTableHtml(products) {
  const rows = products.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v }))
  );

  return `
    <div class="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th class="px-4 py-3">Producto</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Color</th>
            <th class="px-4 py-3">SKU</th>
            <th class="px-4 py-3">Stock</th>
            <th class="px-4 py-3">Costo</th>
            <th class="px-4 py-3">Precio</th>
            <th class="px-4 py-3">Margen</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ({ product: p, variant: v }) => `
            <tr class="border-t border-gray-100">
              <td class="px-4 py-3 font-semibold">${p.name}</td>
              <td class="px-4 py-3 text-gray-500">${p.category}</td>
              <td class="px-4 py-3 text-gray-500">${v.color}</td>
              <td class="px-4 py-3 text-gray-500">${v.sku}</td>
              <td class="px-4 py-3 ${v.stock <= v.low_stock_threshold ? "text-red-600 font-semibold" : ""}">${v.stock}</td>
              <td class="px-4 py-3 text-gray-500">${p.cost_price != null ? money(p.cost_price) : "—"}</td>
              <td class="px-4 py-3">${money(p.price_normal)}</td>
              <td class="px-4 py-3">${marginHtml(p)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function gateHtml() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-brand-cream px-4">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
        <i class="fa-solid fa-cash-register text-4xl text-brand-mexican mb-4"></i>
        <h1 class="text-xl font-bold text-gray-900 mb-1">Venta Local</h1>
        <p class="text-sm text-gray-500 mb-6">Ingresa el PIN de la tienda</p>
        <input id="pin-input" type="password" inputmode="numeric" autocomplete="off"
          class="w-full text-center text-2xl tracking-widest px-4 py-3 border border-gray-300 rounded-lg mb-3 outline-none focus:border-brand-pink" />
        <p id="pin-error" class="text-red-500 text-sm mb-3 hidden"></p>
        <button id="pin-submit" class="w-full bg-gray-900 hover:bg-brand-mexican text-white font-bold py-3 rounded-full transition-colors">
          Entrar
        </button>
      </div>
    </div>
  `;
}

export async function renderPosAccess(container) {
  let unlocked = false;
  try {
    await posAccessApi.me();
    unlocked = true;
  } catch {
    unlocked = false;
  }

  function renderGate() {
    container.innerHTML = gateHtml();
    const input = container.querySelector("#pin-input");
    const errorEl = container.querySelector("#pin-error");
    const submitBtn = container.querySelector("#pin-submit");

    async function submit() {
      errorEl.classList.add("hidden");
      submitBtn.disabled = true;
      submitBtn.textContent = "Verificando...";
      try {
        await posAccessApi.login(input.value);
        renderMain();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Entrar";
      }
    }

    submitBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    input.focus();
  }

  async function renderMain() {
    let activeSection = "venta";
    let products = null;

    async function loadProducts() {
      if (!products) ({ products } = await posAccessApi.listProducts());
      return products;
    }

    async function render() {
      container.innerHTML = `
        <div class="min-h-screen bg-brand-cream">
          <header class="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
            <h1 class="font-bold text-gray-900"><i class="fa-solid fa-cash-register text-brand-mexican mr-2"></i>Venta Local</h1>
            <div class="flex items-center gap-2">
              <button data-section="venta" class="section-btn px-4 py-2 rounded-full text-sm font-semibold ${
                activeSection === "venta" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }">Venta</button>
              <button data-section="inventario" class="section-btn px-4 py-2 rounded-full text-sm font-semibold ${
                activeSection === "inventario" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }">Inventario y costos</button>
              <button id="logout-btn" class="text-gray-400 hover:text-red-500 text-sm ml-2"><i class="fa-solid fa-right-from-bracket mr-1"></i>Salir</button>
            </div>
          </header>
          <div class="max-w-7xl mx-auto px-4 py-6" id="pos-access-content"></div>
        </div>
      `;

      container.querySelectorAll(".section-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeSection = btn.dataset.section;
          render();
        });
      });

      container.querySelector("#logout-btn").addEventListener("click", async () => {
        await posAccessApi.logout();
        renderGate();
      });

      const contentEl = container.querySelector("#pos-access-content");
      if (activeSection === "venta") {
        renderPosTab(contentEl, () => true, {
          listProducts: posAccessApi.listProducts,
          submitSale: posAccessApi.sale,
          onUnauthorized: renderGate,
        });
      } else {
        contentEl.innerHTML = `<div class="text-center py-12 text-gray-400">Cargando inventario...</div>`;
        try {
          const list = await loadProducts();
          if (contentEl.isConnected) contentEl.innerHTML = inventoryTableHtml(list);
        } catch (err) {
          if (err.status === 401) {
            renderGate();
            return;
          }
          contentEl.innerHTML = `<p class="text-red-500 text-center py-12">${err.message}</p>`;
        }
      }
    }

    render();
  }

  if (unlocked) renderMain();
  else renderGate();
}
