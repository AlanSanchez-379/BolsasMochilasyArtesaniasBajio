import { bindNavLinks } from "../dom.js";

export function renderPlaceholder(container, title) {
  container.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 py-24 text-center fade-in">
      <i class="fa-solid fa-hammer text-5xl text-brand-salmon mb-6"></i>
      <h2 class="text-3xl font-bold mb-4">${title}</h2>
      <p class="text-lg text-gray-500 mb-8">Esta vista se construye en la siguiente iteración.</p>
      <button data-nav="/" class="bg-brand-blue-dark text-white px-6 py-3 rounded-full font-semibold hover:bg-brand-blue">
        Volver al inicio
      </button>
    </div>
  `;
  bindNavLinks(container);
}
