import { SOCIAL_LINKS, ADVISORS } from "../socialLinks.js";

export function renderFooter(container) {
  container.innerHTML = `
    <footer class="bg-gray-900 border-t border-gray-800 pt-16 pb-12 mt-20 px-4 sm:px-6 lg:px-8 text-white">
      <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div class="col-span-1">
          <h3 class="text-2xl font-display font-bold mb-4 tracking-tight">Bolsas, Mochilas Y Artesanías del Bajío</h3>
          <p class="text-sm text-gray-400 leading-relaxed mb-6 font-sans">
            Tu proveedor confiable para iniciar tu propio negocio con las mejores bolsas, mochilas y artesanías.
          </p>
          <div class="flex items-center gap-4">
            <a href="${SOCIAL_LINKS.facebook}" target="_blank" rel="noopener noreferrer" title="Facebook"
              class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-mexican hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <i class="fa-brands fa-facebook-f"></i>
            </a>
            <a href="${SOCIAL_LINKS.instagram}" target="_blank" rel="noopener noreferrer" title="Instagram"
              class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-mexican hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <i class="fa-brands fa-instagram"></i>
            </a>
            <a href="${SOCIAL_LINKS.tiktok}" target="_blank" rel="noopener noreferrer" title="TikTok"
              class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-mexican hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <i class="fa-brands fa-tiktok"></i>
            </a>
          </div>
        </div>
        <div>
          <h4 class="font-display font-bold text-white text-sm mb-6 uppercase tracking-widest">Menú Principal</h4>
          <ul class="space-y-3 text-sm text-gray-400 font-sans">
            <li><a href="/categoria/Todos" class="hover:text-brand-pink transition-colors inline-block hover:-translate-x-1 duration-200">Catálogo Completo</a></li>
            <li><a href="/categoria/Paquetes" class="hover:text-brand-pink transition-colors inline-block hover:-translate-x-1 duration-200">Paquetes Emprendedor</a></li>
            <li><a href="/mis-pedidos" class="hover:text-brand-pink transition-colors inline-block hover:-translate-x-1 duration-200">Mis Pedidos</a></li>
            <li>
              <a href="${SOCIAL_LINKS.location}" target="_blank" rel="noopener noreferrer" class="hover:text-brand-pink transition-colors inline-flex items-center gap-2 hover:-translate-x-1 duration-200 mt-2 text-brand-salmon">
                <i class="fa-solid fa-location-dot"></i>Nuestra Ubicación
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 class="font-display font-bold text-white text-sm mb-6 uppercase tracking-widest">Condiciones</h4>
          <ul class="space-y-3 text-sm text-gray-400 font-sans">
            <li class="flex items-center gap-2"><i class="fa-solid fa-check text-brand-salmon text-xs"></i> Precios por volumen según producto</li>
            <li class="flex items-center gap-2"><i class="fa-solid fa-check text-brand-salmon text-xs"></i> Combina piezas de la misma línea</li>
            <li class="flex items-center gap-2"><i class="fa-solid fa-credit-card text-brand-salmon text-xs"></i> Pago con tarjeta o SPEI</li>
            <li class="mt-4"><a href="/politica-envios" class="hover:text-brand-pink transition-colors inline-block hover:-translate-x-1 duration-200">Política de Envíos</a></li>
            <li><a href="/politica-privacidad" class="hover:text-brand-pink transition-colors inline-block hover:-translate-x-1 duration-200">Política de Privacidad</a></li>
            <li><a href="/terminos-y-condiciones" class="hover:text-brand-pink transition-colors inline-block hover:-translate-x-1 duration-200">Términos y Condiciones</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-display font-bold text-white text-sm mb-6 uppercase tracking-widest">Nuestros Asesores</h4>
          <ul class="space-y-4 text-sm text-gray-400 font-sans">
            ${ADVISORS.map(
              (a) => `
              <li>
                <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="group flex items-center gap-3 hover:text-white transition-colors">
                  <span class="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500 transition-colors">
                    <i class="fa-brands fa-whatsapp text-green-500 group-hover:text-white"></i>
                  </span>
                  Asesor ${a.name}
                </a>
              </li>`
            ).join("")}
          </ul>
        </div>
      </div>
      <div class="max-w-7xl mx-auto border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 font-sans">
        <p>&copy; 2026 Bolsas, Mochilas Y Artesanías del Bajío. Todos los derechos reservados.</p>
        <p class="mt-2 md:mt-0">Diseñado para emprender.</p>
      </div>
    </footer>
  `;
}
