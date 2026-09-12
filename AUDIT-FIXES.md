# Correcciones de la auditoría — 12 de septiembre de 2026

Cambios locales; no se modificó la base de datos ni se publicó el sitio.

- Búsqueda tolerante a subcategorías, descripciones y variantes vacías; coincidencias sin distinguir acentos.
- Carrito y tarjetas usan la misma precedencia de precios que `Product.price_for_quantity` del servidor. Los paquetes se calculan con su precio unitario de paquete.
- Tarjetas con precio por pieza en MXN y cantidad mínima de mayoreo tomada del producto. Se retiró el tachado de menudeo que simulaba un descuento.
- Reglas de combinación visibles en la ficha; pie sin cantidades fijas que contradigan la configuración. Enlace de paquetes corregido.
- Cotización de envío en el carrito usando el endpoint público existente: código postal y productos, sin crear pedido. Es una estimación; las opciones completas requieren dirección y se confirman en checkout. Respuestas antiguas no sobrescriben cotizaciones nuevas.
- Tarjetas como enlaces, buscadores y controles etiquetados, estados de menús y filtros accesibles, foco visible. Buscador visible en móvil, catálogo de dos columnas y portada más compacta.
- Títulos, descripciones y metadatos sociales por navegación; datos estructurados para productos individuales. Las vistas de cuenta y pago se marcan `noindex`; el esquema de producto se retira al cambiar de página.
- Subcategorías vacías no imprimen `null`; productos sin variantes no permiten agregar. Una falla de recomendaciones no impide abrir el producto. Errores de carga ofrecen reintento.

## Verificación

- `cd frontend` y `npm test`: búsquedas, límites de precios, ofertas, agrupación por línea y paquetes.
- `npm run build:css`: recompilar y publicar también `dist/styles.css`.
- Servir `frontend` localmente y abrir `/tests/browser.html`: comprobaciones de catálogo, menú, ficha, metadatos y carrito con API simulada. No conecta con pedidos ni catálogo real.
- `/tests/browser.html#/test-error` permite verificar la recuperación tras un error de carga.

## Pendientes que no resuelve este cambio

- **Catálogo real:** identificar y retirar o renombrar «Prueba» y «FD» desde la administración. No se ocultan productos por coincidencia de nombre ni se borran registros automáticamente. Completar medidas, materiales, peso y contenido con datos reales.
- **SEO de rutas:** las URLs siguen usando `#/`. Los metadatos dinámicos no sustituyen una migración a rutas HTTP rastreables con contenido prerenderizado o servido desde el servidor. Esa migración debe coordinar reglas del alojamiento, enlaces antiguos, autenticación, URLs canónicas y sitemap. No se añadieron canónicas que apuntaran incorrectamente todos los productos a la portada.
- **Compra como invitado:** la cotización es pública; completar el pedido sigue requiriendo cuenta. Cambiar esto afecta propiedad y consulta de pedidos y necesita un flujo específico.
- **Publicación y operación:** falta desplegar y comprobar con el backend real las tarifas, sesión y pedido completo. Las pruebas locales no certifican cobros, Core Web Vitals, indexación ni seguridad interna.

El comando `npm` instalado en esta máquina apuntaba a un archivo inexistente. Se ejecutaron las pruebas con `node --test` y la compilación con `node node_modules/tailwindcss/lib/cli.js -i ./src/styles/input.css -o ./dist/styles.css`, usando las dependencias ya presentes.
