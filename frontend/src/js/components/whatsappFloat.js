import { ADVISORS } from "../socialLinks.js";

export function renderWhatsappFloat(container) {
  container.innerHTML = `
    <div class="fixed bottom-6 right-6 z-50">
      <div id="whatsapp-menu" class="hidden mb-3 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden w-60 fade-in">
        <p class="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">Elige un asesor</p>
        ${ADVISORS.map(
          (a) => `
          <a href="${a.url}" target="_blank" rel="noopener noreferrer"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm font-semibold text-gray-700 border-b border-gray-50 last:border-0">
            <i class="fa-brands fa-whatsapp text-green-500 text-lg"></i> Asesor ${a.name}
          </a>`
        ).join("")}
      </div>
      <button id="whatsapp-toggle" class="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center text-2xl transition-colors" title="Contactar por WhatsApp">
        <i class="fa-brands fa-whatsapp"></i>
      </button>
    </div>
  `;

  const toggle = container.querySelector("#whatsapp-toggle");
  const menu = container.querySelector("#whatsapp-menu");

  toggle.addEventListener("click", () => menu.classList.toggle("hidden"));
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) menu.classList.add("hidden");
  });
}
