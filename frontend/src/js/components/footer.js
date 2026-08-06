export function renderFooter(container) {
  container.innerHTML = `
    <footer class="bg-text-dark text-white pt-12 pb-8 mt-12">
      <div class="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 class="text-2xl font-bold text-brand-salmon mb-4">BM&A del Bajío</h3>
          <p class="text-gray-300 text-lg">Tu proveedor confiable para iniciar tu propio negocio con las mejores bolsas y mochilas.</p>
        </div>
        <div>
          <h4 class="text-xl font-bold mb-4">Enlaces Rápidos</h4>
          <ul class="space-y-2 text-lg text-gray-300">
            <li><a href="#/categoria/Todos" class="hover:text-brand-teal">Catálogo Completo</a></li>
            <li><a href="#/" class="hover:text-brand-teal">Paquetes Emprendedor</a></li>
            <li><a href="#/" class="hover:text-brand-teal">Condiciones de Mayoreo</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-xl font-bold mb-4">Atención al Cliente</h4>
          <p class="text-gray-300 text-lg"><i class="fa-brands fa-whatsapp text-brand-teal mr-2"></i> 55 1234 5678</p>
          <p class="text-gray-300 text-lg mt-2"><i class="fa-regular fa-envelope text-brand-teal mr-2"></i> contacto@bmabajio.com</p>
        </div>
      </div>
    </footer>
  `;
}
