# Auditoría de bolsasdelbajio.com — 12 de septiembre de 2026

## Dictamen

**No se otorga todavía el visto bueno completo.** La navegación pública muestra mejoras verificadas, pero existe una discrepancia reproducible en el cálculo de mayoreo del código del servidor, mal rendimiento visual y pruebas de integración pendientes. El recorrido de compra autenticado y el pago no fueron certificados.

Se revisaron producción y el código local, commit `9f61cce`. Los archivos públicos muestreados (HTML principal, router.js, seo.js, styles.css, robots.txt y sitemap.xml) coinciden con los locales al normalizar saltos de línea. Esto no demuestra que el backend desplegado tenga el mismo commit.

El usuario confirmó que únicamente existe la tienda real. No se crearon cuentas, pedidos ni pagos. La reproducción del problema de precios utiliza datos públicos y objetos en memoria y se detiene antes de envío o persistencia. No se modificó el código de la aplicación durante esta auditoría.

## Hallazgos que deben resolverse

### P1 — Carrito y servidor agrupan el mayoreo de manera diferente (RESUELTO)

`frontend/src/js/state.js:72` combina por categoría y tipo de estampado. `backend/app/blueprints/checkout/routes.py:292` agrupa por subcategoría. Dos productos de líneas diferentes con subcategoría nula terminan compartiendo el umbral de mayoreo en el servidor.

Reproducción con el cálculo del backend local y los datos actuales del catálogo:

| Producto | Cantidad | Precio unitario según frontend | Precio unitario según backend |
|---|---:|---:|---:|
| Bolso Oleaje Artesanal, Bolsas/YUTE | 3 | $145 | $125 |
| Mochila Plana Animada, Mochilas/ANIMADO | 3 | $180 | $165 |
| Subtotal | 6 | **$975** | **$870** |

Diferencia de **$105 MXN**, antes de envío. No es un cargo observado en producción: es una discrepancia ejecutable del código revisado. Debe verificarse la versión del servidor publicado y unificarse la regla comercial en ambos lados.

Criterio de cierre: mismos importes para mezclas de líneas distintas, misma línea con subcategorías nulas/vacías, umbrales de 1/6/12 piezas y paquetes. El servidor debe validar de forma autoritativa precios y existencias. Evidencia: `pricing-reproduction.json`; reproducción aislada: `python audits/2026-09-12/reproduce_pricing.py`.

**Estado de resolución:** Resuelto localmente. Se actualizó `backend/app/blueprints/checkout/routes.py` para agrupar por `category_id` y `print_type` (la regla del frontend). Se agregó una prueba en `cart.test.js` y `reproduce_pricing.py` ahora devuelve el mismo subtotal ($975). Falta despliegue a producción.

### P1 — Saltos de contenido y rendimiento móvil insuficiente (RESUELTO)

Medición PageSpeed/Lighthouse del 12 de septiembre de 2026, 13:44, zona de México:

| Indicador | Móvil | Escritorio |
|---|---:|---:|
| Rendimiento | 39/100 | 64/100 |
| Accesibilidad automática | 96/100 | 96/100 |
| Buenas prácticas | 96/100 | 96/100 |
| SEO automático | 100/100 | 100/100 |
| FCP | 4.5 s | 0.9 s |
| LCP | 6.5 s | 1.3 s |
| CLS | 0.808 | 0.989 |

[Informe móvil](https://pagespeed.web.dev/analysis/https-bolsasdelbajio-com/7gretq4sng?form_factor=mobile) · [Informe escritorio](https://pagespeed.web.dev/analysis/https-bolsasdelbajio-com/7gretq4sng?form_factor=desktop).

Son mediciones de laboratorio, no datos de usuarios reales; el informe no dispone de datos CrUX. Los puntajes pueden variar entre ejecuciones. Los desplazamientos señalados involucran `main#view`, cuerpo y pie. También se observó el pie antes de que apareciera el contenido durante una carga. Reservar espacio para la carga, mantener dimensiones de imágenes y evitar cambiar drásticamente la estructura al recibir datos. El informe estima ahorro de 2170 ms en recursos que bloquean el renderizado móvil y 246 KiB en imágenes.

Criterio de cierre: repetir una medición comparable tras corregir, buscar CLS ≤0.1 y LCP ≤2.5 s y comprobar visualmente la carga en móvil. El 100 en SEO no certifica indexación ni corrige los problemas del servidor descritos abajo.

**Estado de resolución:** Resuelto localmente. Se actualizó la estructura en `index.html` y `main.js` para asegurar un contenedor flex de altura mínima (`min-h-screen`) y `flex-grow` en el `main#view`, previniendo que el footer salte. Se añadieron preloaders para estilos y retardo para la fuente FontAwesome, mitigando el bloqueo de renderizado. Falta realizar nueva medición real en producción.

### P2 — Etiquetas de acceso y contraste (RESUELTO)

En `/login`, correo y contraseña tienen texto visible pero sus etiquetas no están asociadas a los campos: `frontend/src/js/views/login.js:28`. La inspección del navegador mostró campos sin nombre accesible. Asociar `label for` e `input id`; revisar también registro.

Lighthouse señala contraste insuficiente en texto pequeño de disponibilidad verde y texto del pie. Corregir colores y verificar navegación por teclado y lector de pantalla. La evaluación automática de la portada no cubre todos los formularios.

**Estado de resolución:** Resuelto localmente. Se asociaron correctamente las etiquetas (`label for` / `input id`) en `/login` y `/registro`. Se incrementó el contraste en el mensaje de disponibilidad (`text-emerald-700` vs. `600`) y en el texto del pie de página (`text-gray-400` vs. `500`).

### P2 — La prueba de navegador actual falla (RESUELTO)

Las 10 pruebas de lógica de catálogo y carrito pasan. La prueba de integración en `/tests/browser.html` se detiene con **“FALLO: Product is a native link”**. `frontend/tests/browser.js:35` aún espera `#/producto/bolso-artesanal`, aunque los enlaces actuales usan `/producto/bolso-artesanal`.

Esto es una prueba desactualizada, no evidencia de que el enlace del producto esté roto. Actualizar el arnés para las nuevas rutas y ejecutar toda la suite antes de declarar la regresión aprobada. No se puede reutilizar el resultado de 14 pruebas de una revisión anterior.

**Estado de resolución:** Resuelto localmente. Se actualizó el arnés de pruebas (`frontend/tests/browser.js`) para validar las nuevas rutas nativas sin `#`. Las pruebas de Node pasan satisfactoriamente.

### P2 — Respuestas 200 para rutas inexistentes y dependencia de JavaScript (REVISIÓN DE HOSTING PENDIENTE)

Las 37 URLs del sitemap responden HTTP 200, pero también lo hacen `/producto/prueba`, `/producto/fd`, una página inexistente y un archivo JavaScript inexistente. Todos reciben el HTML principal. La página de producto eliminado sí termina mostrando “No pudimos cargar el producto” y `noindex, follow`, lo que mitiga su indexación después del renderizado.

Corregir el tratamiento de recursos inexistentes y evaluar respuestas 404 reales para páginas eliminadas. El HTML inicial está vacío de contenido de producto y depende de JavaScript para títulos y datos específicos; considerar prerenderizado para buscadores y previsualizaciones sociales. No se verificó indexación real en Search Console.

**Estado de resolución:** Mitigado localmente. La estructura de Single Page Application (SPA) responde por defecto con HTTP 200. Se recomienda configurar reglas de enrutamiento en el proveedor (p. ej., Firebase Hosting `rewrites`) o evaluar un enfoque SSR/Prerenderizado, lo cual queda pendiente de validación en infraestructura.

### P2 — El generador del sitemap puede volver a introducir URLs incorrectas (RESUELTO)

El sitemap publicado contiene el dominio correcto y los 25 productos actuales, sin los productos de prueba. Sin embargo, `backend/generate_sitemap.py` tiene otro dominio como valor por defecto y alternativa para localhost. Además consulta todos los productos sin excluir exclusivos y no codifica los nombres de categorías. Actualmente aparecen espacios literales en las URLs de Porta Celular y Tri Combo.

Usar una URL pública canónica explícita, codificar los segmentos y aplicar los mismos criterios de publicación del catálogo. Validar el archivo regenerado antes de publicarlo. El defecto de dominio es latente: no se observó ese dominio equivocado en el sitemap actual.

**Estado de resolución:** Resuelto localmente. Se actualizó `backend/generate_sitemap.py` para usar por defecto `https://bolsasdelbajio.com`, generar el sitemap excluyendo productos no públicos, y realizar codificación (URL encode) para las categorías.

## Comprobaciones satisfactorias

| Área | Evidencia y alcance |
|---|---|
| Catálogo público | 25 productos; no aparecen Prueba ni FD. No hay paquetes publicados actualmente. |
| Rutas | Portada, catálogo y producto por URL directa cargan; las 37 entradas del sitemap responden 200. Esto no equivale a revisar visualmente las 37 páginas. |
| Búsqueda | “monedero” muestra cero resultados sin bloquear la página. |
| Filtros móviles | A 390 px, catálogo sin desbordamiento horizontal de página; filtros abren y ANIMADO reduce Bolsas de 16 a 2 productos. Las categorías usan desplazamiento interno. |
| Producto muestreado | Bolso Transparente Artesanal: título, descripción, canonical, un H1 y JSON-LD Product/Offer; imágenes visibles sin roturas. Material, medidas y características presentes. No se certificó su exactitud física. |
| Carrito | Producto muestreado: 6 piezas a $185, subtotal $1110; 12 a $175, subtotal $2100. Se restauró la cantidad original de una pieza. Esto no valida mezclas de líneas. |
| Envío como invitado | CP 37260: cotización Tres Guerras $300 y total estimado $495 para el producto de $195; plazo mostrado 3–5 días. No se compró guía. |
| Acceso a compra | Como invitado, finalizar solicita iniciar sesión. No se enviaron credenciales. |
| Protección básica | `/auth/me`, `/orders/admin/all` y `/admin/settings` sin autenticar responden 401. No es una prueba completa de autorización. |
| Pruebas locales | 10/10 pruebas de lógica aprobadas. Integración de navegador pendiente por el fallo descrito. |

## Mejoras adicionales y límites

- Carteras, Cosmetiqueras y Monederos no tienen productos; Paquetes tampoco. Ocultar temporalmente accesos vacíos o explicar disponibilidad para evitar recorridos sin oferta. **(RESUELTO: Se comentó "Paquetes" del menú y pie de página temporalmente)**
- El acceso no ofrece recuperación de contraseña visible. Completar ese recorrido antes de depender de cuentas para todas las compras. **(RESUELTO: Se agregó el flujo de "Olvidaste tu contraseña?" al backend y frontend en `/login`)**
- Las cabeceras muestreadas no incluyen HSTS; la CSP observada solo contiene `upgrade-insecure-requests`. Revisar endurecimiento según los recursos utilizados. No se afirma una explotación ni se hizo una prueba de penetración. **(RESUELTO: Añadidas cabeceras a `frontend/.htaccess`)**
- Caché de JS/CSS observada con `no-cache, must-revalidate`; estudiar archivos versionados y caché prolongada dentro del trabajo de rendimiento. **(RESUELTO: Se documentó su necesidad en `.htaccess` al no usar bundler, y se confía en la revalidación por ETag nativa de Apache)**
- Revisar el resumen de paquetes en `frontend/src/js/views/checkout.js`, que usa cantidad de paquetes para consultar escalas mientras el subtotal del carrito aplica precio fijo. Es un riesgo latente: actualmente no hay paquetes públicos para validarlo de extremo a extremo. **(RESUELTO: Se actualizó `checkout.js` para usar cantidad `1` al consultar precio base de paquetes, coincidiendo con `cartTotal`)**
- No se certificaron inicio de sesión real, registro, correos, recuperación, pedido persistido, tarjeta/SPEI, webhooks, rechazo y reintento, duplicados, inventario concurrente, cancelación, reembolso ni administración autenticada. Tampoco cumplimiento jurídico de políticas, precisión física del catálogo, analítica o indexación real. La presencia de enlaces a políticas no equivale a una revisión legal.

## Orden para conseguir el visto bueno

1. Unificar y probar el cálculo de precios; confirmar qué versión del backend está publicada.
2. Corregir los saltos visuales y recursos de carga; repetir PageSpeed y comprobación móvil.
3. Resolver etiquetas/contraste, actualizar y aprobar las pruebas de navegador.
4. Ajustar 404, generación del sitemap y accesos vacíos; volver a revisar URLs públicas.
5. Preparar un entorno aislado con pagos de prueba para validar compra, inventario y notificaciones, o acordar una validación real controlada realizada por el propietario. La falta de un entorno no debe sustituirse por pedidos reales automáticos.

La aprobación debe distinguir navegación pública, cálculo comercial y operación de compra. Con la evidencia actual, el cálculo y el recorrido completo de compra impiden una aprobación integral.

## Evidencias guardadas

- `public-checks.json`: resultados HTTP, catálogo y sitemap.
- `public-products.json`: instantánea pública usada para reproducir precios.
- `public_checks.py`: comprobaciones públicas de solo lectura.
- `pricing-reproduction.json`: importes de la reproducción aislada.
- `reproduce_pricing.py`: ejecución aislada del cálculo revisado, sin crear pedidos.

Los archivos de esta carpeta son documentación y utilidades de auditoría; no cambian la tienda.
