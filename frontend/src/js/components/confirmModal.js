// Modal de confirmación reutilizable (reemplaza confirm() nativo con algo visual/de marca).
// Uso: showConfirmModal({ title, message, confirmLabel, onConfirm })
export function showConfirmModal({ title, message, confirmLabel = "Eliminar", onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center fade-in";
  overlay.style.zIndex = "9999"; // por encima del navbar (z-50); evita depender de valores arbitrarios de Tailwind
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 text-center">
      <div class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
        <i class="fa-solid fa-triangle-exclamation text-2xl text-red-500"></i>
      </div>
      <h3 class="text-xl font-bold mb-2">${title}</h3>
      <p class="text-gray-500 mb-6">${message}</p>
      <div class="flex gap-3">
        <button id="confirm-cancel" class="flex-1 border-2 border-gray-300 rounded-full py-3 font-semibold hover:bg-gray-50">Cancelar</button>
        <button id="confirm-ok" class="flex-1 bg-red-500 text-white rounded-full py-3 font-semibold hover:bg-red-600">${confirmLabel}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#confirm-cancel").addEventListener("click", close);
  overlay.querySelector("#confirm-ok").addEventListener("click", () => {
    close();
    onConfirm();
  });
}
