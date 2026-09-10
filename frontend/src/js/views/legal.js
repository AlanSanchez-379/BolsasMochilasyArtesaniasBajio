const LAST_UPDATED = "25 de agosto de 2026";
const CONTACT_EMAIL = "bolsasdelbajio67@gmail.com";
const LEGAL_ADDRESS = "Blvd. Hilario Medina 715, Killian, León de los Aldama, Guanajuato, C.P. 37260, México";

function pageShell(container, title, bodyHtml) {
  container.innerHTML = `
    <div class="max-w-3xl mx-auto px-4 py-12 fade-in">
      <button data-back class="text-sm font-semibold text-gray-500 hover:text-brand-mexican mb-6">
        <i class="fa-solid fa-arrow-left mr-1"></i>Volver
      </button>
      <h1 class="text-3xl font-bold text-gray-900 mb-1">${title}</h1>
      <p class="text-xs text-gray-400 mb-8">Última actualización: ${LAST_UPDATED}</p>
      <div class="prose-legal text-gray-700 leading-relaxed space-y-5">
        ${bodyHtml}
      </div>
    </div>
  `;
  container.querySelector("[data-back]").addEventListener("click", () => history.back());
}

function h2(text) {
  return `<h2 class="text-lg font-bold text-gray-900 mt-8 mb-2">${text}</h2>`;
}

function contactBlockHtml() {
  return `
    <ul class="list-none space-y-1">
      <li><i class="fa-solid fa-envelope w-5 text-gray-400"></i> <a href="mailto:${CONTACT_EMAIL}" class="text-brand-mexican font-semibold hover:underline">${CONTACT_EMAIL}</a></li>
      <li><i class="fa-solid fa-location-dot w-5 text-gray-400"></i> ${LEGAL_ADDRESS}</li>
    </ul>
  `;
}

export function renderShippingPolicy(container) {
  pageShell(
    container,
    "Política de Envíos",
    `
    <p>Enviamos desde León, Guanajuato a todo México. Esta política explica cómo calculamos el costo y tiempo de entrega de tu pedido.</p>

    ${h2("Paqueterías")}
    <p>Trabajamos con <strong>Tres Guerras</strong>, <strong>Estafeta</strong> y <strong>DHL</strong>. Al pagar tu pedido eliges la opción que prefieras según costo y tiempo estimado de entrega.</p>

    ${h2("Costo de envío")}
    <p>El costo se calcula automáticamente en el checkout según el peso aproximado de tu pedido y tu código postal de destino. El monto se muestra antes de confirmar tu compra — no hay cargos ocultos.</p>

    ${h2("Tiempos de entrega")}
    <p>Los tiempos que se muestran al cotizar son estimados por la paquetería y pueden variar por factores fuera de nuestro control (clima, disponibilidad en tu zona, días festivos, etc.). Una vez que tu pedido sale de nuestras manos, te compartimos el número de guía para que puedas rastrearlo directamente con la paquetería.</p>

    ${h2("Dirección de entrega")}
    <p>Es tu responsabilidad proporcionar una dirección completa y correcta (calle, número, colonia, ciudad, estado y código postal). No nos hacemos responsables por retrasos o pérdidas causadas por datos de envío incorrectos o incompletos.</p>

    ${h2("Responsabilidad después del envío")}
    <p>Nuestra responsabilidad sobre tu pedido termina en el momento en que la paquetería lo recibe y sale de nuestras manos. A partir de ahí, la entrega depende de la paquetería: si el repartidor tocó la puerta en la dirección proporcionada y nadie respondió, y como consecuencia el paquete fue devuelto a la paquetería (o quedó en su sucursal sin poder entregarse), eso ya no es responsabilidad de la tienda. En estos casos te contactaremos para coordinar un reenvío, cuyo costo corre por cuenta del cliente.</p>

    ${h2("Dudas sobre tu envío")}
    <p>Si tienes dudas sobre el estatus de tu pedido, puedes consultarlo en <a href="#/mis-pedidos" class="text-brand-mexican font-semibold hover:underline">Mis Pedidos</a> o contactarnos:</p>
    ${contactBlockHtml()}
    `
  );
}

export function renderPrivacyPolicy(container) {
  pageShell(
    container,
    "Política de Privacidad",
    `
    <p>En Bolsas, Mochilas Y Artesanías del Bajío ("nosotros") respetamos tu privacidad. Este aviso explica qué datos personales recabamos, para qué los usamos y cómo puedes ejercer tus derechos sobre ellos, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>

    ${h2("Responsable de tus datos")}
    <p>Bolsas, Mochilas Y Artesanías del Bajío, con domicilio en ${LEGAL_ADDRESS}, es responsable del uso y protección de tus datos personales.</p>

    ${h2("Datos que recabamos")}
    <p>Cuando creas una cuenta o realizas una compra, recabamos: nombre completo, correo electrónico, teléfono y dirección de envío. Si inicias sesión con Google, recibimos el nombre y correo asociados a tu cuenta de Google.</p>

    ${h2("Para qué usamos tus datos")}
    <p>Usamos tus datos para: procesar y entregar tus pedidos, gestionar tu cuenta y tu historial de compras, comunicarnos contigo sobre el estatus de tu pedido, prevenir fraudes, y mejorar nuestro servicio.</p>

    ${h2("Con quién compartimos tus datos")}
    <p>No vendemos ni rentamos tus datos personales. Los compartimos únicamente con los terceros necesarios para operar tu pedido, quienes actúan como <strong>encargados del tratamiento</strong>: reciben tus datos solo para cumplir el servicio que les corresponde, siguiendo nuestras instrucciones, y no pueden usarlos para sus propios fines comerciales ni cederlos a alguien más.</p>
    <ul class="list-disc pl-6 space-y-1">
      <li><strong>Paqueterías</strong> (Tres Guerras, Estafeta, DHL vía Skydropx) — para entregar tu pedido, solo reciben tu nombre, teléfono y dirección de envío.</li>
      <li><strong>Mercado Pago</strong> — para gestionar el enlace de pago que te enviamos por WhatsApp. Nosotros no almacenamos datos de tarjetas.</li>
      <li><strong>Supabase</strong> — para gestionar de forma segura tu cuenta y el inicio de sesión.</li>
    </ul>

    ${h2("Almacenamiento y transferencia internacional de datos")}
    <p>Para operar el sitio usamos proveedores de infraestructura tecnológica en la nube (Supabase) y servicios externos de pago y almacenamiento de comprobantes, cuyos servidores pueden ubicarse fuera de México. Al usar nuestro sitio, aceptas que tus datos puedan almacenarse y procesarse en esos servidores, bajo estándares de seguridad y confidencialidad equiparables a los exigidos por la legislación mexicana.</p>

    ${h2("Cookies y sesión")}
    <p>Usamos una cookie técnica para mantener tu sesión iniciada mientras navegas el sitio. No usamos cookies de rastreo publicitario.</p>

    ${h2("Tus derechos (ARCO)")}
    <p>Puedes solicitar en cualquier momento el <strong>A</strong>cceso, <strong>R</strong>ectificación, <strong>C</strong>ancelación u <strong>O</strong>posición al uso de tus datos personales, así como solicitar la eliminación de tu cuenta, escribiéndonos a:</p>
    ${contactBlockHtml()}
    <p>Para que tu solicitud sea válida, debe incluir al menos: tu nombre completo, un documento que acredite tu identidad (INE o pasaporte), una descripción clara de los datos o el derecho que deseas ejercer, y un medio de contacto para comunicarte nuestra respuesta. Responderemos dentro de un plazo máximo de <strong>20 días hábiles</strong> a partir de la recepción de tu solicitud.</p>

    ${h2("Cambios a este aviso")}
    <p>Podemos actualizar esta política ocasionalmente. Cualquier cambio se publicará en esta misma página con su fecha de actualización.</p>
    `
  );
}

export function renderTerms(container) {
  pageShell(
    container,
    "Términos y Condiciones",
    `
    <p>Estos Términos y Condiciones ("Términos") rigen el uso de este sitio y la compra de productos a través de él. Al marcar la casilla de aceptación al registrarte o al continuar con tu compra, confirmas que has leído y aceptas estos Términos y nuestra Política de Privacidad.</p>

    ${h2("Precios y disponibilidad")}
    <p>Todos los precios están expresados en pesos mexicanos (MXN) e incluyen los niveles de menudeo, mayoreo y súper mayoreo según la cantidad de piezas combinadas en tu carrito. Los precios y la disponibilidad de existencias pueden cambiar sin previo aviso, y tu compra queda sujeta a la confirmación de inventario disponible y a la validación del pago.</p>
    <p><strong>Errores del sistema.</strong> Si por un error evidente del sitio (por ejemplo, un error tipográfico o de captura) un producto se muestra con un precio claramente incorrecto, nos reservamos el derecho de cancelar el pedido afectado y reembolsar cualquier cargo ya realizado, notificándote por correo electrónico.</p>

    ${h2("Cuenta de usuario")}
    <p>Eres responsable de proporcionar datos verídicos al registrarte y de mantener la confidencialidad de tu contraseña. Notifícanos si sospechas de un uso no autorizado de tu cuenta.</p>
    <p><strong>Suspensión o cancelación de cuentas.</strong> Nos reservamos el derecho de suspender, cancelar o restringir el acceso a cualquier cuenta que presente actividad sospechosa, intentos de fraude, o que incumpla estos Términos, sin que ello genere responsabilidad para nosotros.</p>

    ${h2("Pagos")}
    <p>Aceptamos pago mediante un enlace de Mercado Pago, que te enviamos por WhatsApp, y transferencia SPEI. Para SPEI puedes subir tu comprobante desde el checkout o desde <a href="#/mis-pedidos" class="text-brand-mexican font-semibold hover:underline">Mis Pedidos</a>. No nos hacemos responsables por interrupciones o fallas en la disponibilidad de estos proveedores de pago externos, ajenas a nuestro control.</p>
    <p>Los pedidos pagados por SPEI quedan como <strong>Pendiente de pago</strong> dentro de la ventana de tiempo indicada en el checkout. Si el depósito no se recibe dentro de ese plazo, el pedido se cancela automáticamente y el inventario reservado se libera; si llegaras a realizar el depósito después de la cancelación, contáctanos para resolverlo mediante reembolso o saldo a favor.</p>

    ${h2("Envíos")}
    <p>Consulta el detalle completo en nuestra <a href="#/politica-envios" class="text-brand-mexican font-semibold hover:underline">Política de Envíos</a>.</p>

    ${h2("Cambios y devoluciones")}
    <p>Debido a la naturaleza de nuestros productos, <strong>todas las ventas son finales</strong>: no se aceptan devoluciones ni cambios por motivos de preferencia del cliente (talla, color, cambio de opinión, etc.).</p>
    <p>Si tu producto llega con un <strong>defecto de fabricación evidente</strong> o daño ocurrido durante el envío, contáctanos dentro de las 48 horas siguientes a la entrega, junto con fotos del producto, para evaluar tu caso.</p>

    ${h2("Propiedad intelectual")}
    <p>Todos los textos, imágenes, logotipos, diseño y contenido de este sitio son propiedad de Bolsas, Mochilas Y Artesanías del Bajío o de sus licenciantes, y están protegidos por la legislación de propiedad intelectual aplicable. Queda prohibida su reproducción, extracción automatizada (scraping), copia o uso comercial sin autorización previa por escrito.</p>

    ${h2("Limitación de responsabilidad")}
    <p>El sitio se proporciona "tal cual" y "según disponibilidad". Hacemos nuestro mejor esfuerzo por mantenerlo operando correctamente, pero no garantizamos un acceso ininterrumpido, libre de errores, o libre de fallas técnicas o de ciberseguridad ajenas a nuestro control.</p>

    ${h2("Uso del sitio")}
    <p>Te comprometes a usar el sitio de forma lícita y a no interferir con su funcionamiento normal.</p>

    ${h2("Privacidad")}
    <p>El tratamiento de tus datos personales se rige por nuestra <a href="#/politica-privacidad" class="text-brand-mexican font-semibold hover:underline">Política de Privacidad</a>.</p>

    ${h2("Jurisdicción y ley aplicable")}
    <p>Para la interpretación y cumplimiento de los presentes Términos, las partes se someten a las leyes aplicables de los Estados Unidos Mexicanos y a la jurisdicción de los tribunales competentes en León, Guanajuato, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.</p>

    ${h2("Contacto")}
    <p>Para dudas sobre estos Términos o para notificaciones legales, contáctanos:</p>
    ${contactBlockHtml()}
    `
  );
}
