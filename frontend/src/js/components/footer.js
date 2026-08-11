import { SOCIAL_LINKS, ADVISORS } from "../socialLinks.js";

export function renderFooter(container) {
  container.innerHTML = `
    <footer class="bg-white border-t border-gray-200 pt-12 pb-10 mt-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div class="col-span-1">
          <h3 class="text-xl font-bold text-gray-900 mb-3">Bolsas, Mochilas Y Artesanías del Bajío</h3>
          <p class="text-sm text-gray-500 leading-relaxed mb-4">
            Tu proveedor confiable para iniciar tu propio negocio con las mejores bolsas, mochilas y artesanías.
          </p>
          <div class="flex items-center gap-3">
            <a href="${SOCIAL_LINKS.facebook}" target="_blank" rel="noopener noreferrer" title="Facebook"
              class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-white hover:bg-brand-mexican hover:border-brand-mexican transition-colors">
              <i class="fa-brands fa-facebook-f"></i>
            </a>
            <a href="${SOCIAL_LINKS.instagram}" target="_blank" rel="noopener noreferrer" title="Instagram"
              class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-white hover:bg-brand-mexican hover:border-brand-mexican transition-colors">
              <i class="fa-brands fa-instagram"></i>
            </a>
            <a href="${SOCIAL_LINKS.tiktok}" target="_blank" rel="noopener noreferrer" title="TikTok"
              class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-white hover:bg-brand-mexican hover:border-brand-mexican transition-colors">
              <i class="fa-brands fa-tiktok"></i>
            </a>
          </div>
        </div>
        <div>
          <h4 class="font-bold text-gray-900 text-sm mb-4 uppercase tracking-wider">Menú Principal</h4>
          <ul class="space-y-2 text-sm text-gray-500">
            <li><a href="#/categoria/Todos" class="hover:text-brand-mexican transition-colors">Catálogo Completo</a></li>
            <li><a href="#/" class="hover:text-brand-mexican transition-colors">Paquetes Emprendedor</a></li>
            <li><a href="#/mis-pedidos" class="hover:text-brand-mexican transition-colors">Mis Pedidos</a></li>
            <li>
              <a href="${SOCIAL_LINKS.location}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-mexican transition-colors">
                <i class="fa-solid fa-location-dot mr-1"></i>Nuestra Ubicación
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-gray-900 text-sm mb-4 uppercase tracking-wider">Condiciones</h4>
          <ul class="space-y-2 text-sm text-gray-500">
            <li>Mayoreo desde 6 piezas combinadas</li>
            <li>Súper mayoreo desde 50 piezas</li>
            <li>Pago con tarjeta o SPEI</li>
          </ul>
        </div>
        <div>
          <h4 class="font-bold text-gray-900 text-sm mb-4 uppercase tracking-wider">Nuestros Asesores</h4>
          <ul class="space-y-2 text-sm text-gray-500">
            ${ADVISORS.map(
              (a) => `
              <li>
                <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-mexican transition-colors flex items-center gap-2">
                  <i class="fa-brands fa-whatsapp text-green-500"></i> Asesor ${a.name}
                </a>
              </li>`
            ).join("")}
          </ul>
        </div>
      </div>
      <div class="max-w-7xl mx-auto border-t border-gray-100 mt-10 pt-6 text-center text-xs text-gray-400">
        &copy; Bolsas, Mochilas Y Artesanías del Bajío
      </div>
    </footer>
  `;
}
