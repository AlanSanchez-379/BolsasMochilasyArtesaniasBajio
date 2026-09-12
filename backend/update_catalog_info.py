import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.extensions import db
from app.models import Product

app = create_app()

catalog_updates = {
    "Mochila Escolar Animada": {
        "material": "Poliéster impermeable de alta resistencia",
        "medidas": "42 cm x 30 cm x 15 cm",
        "contenido": "Compartimento principal amplio, 1 bolsillo frontal con cierre, 2 bolsillos laterales para agua. Tirantes acolchados y ajustables.",
        "desc": "Ideal para el regreso a clases o para llevar la diversión a todas partes. Esta mochila cuenta con diseños vibrantes y animados que capturan la atención, ofreciendo además un excelente espacio interior, comodidad y durabilidad inigualable. ¡Un producto estrella que se vende solo!"
    },
    "Mochila Fusión Media Animada": {
        "material": "Lona resistente y poliéster",
        "medidas": "38 cm x 28 cm x 14 cm",
        "contenido": "Compartimento principal, bolsillo frontal y asas superiores reforzadas.",
        "desc": "Una mezcla perfecta entre tamaño práctico y diseño llamativo. La Mochila Fusión Media destaca por sus estampados únicos, correas ajustables y ligereza, convirtiéndola en una opción versátil tanto para estudiantes como para paseos casuales."
    },
    "Mochila con Cartuchera Animada": {
        "material": "Poliéster de alta durabilidad",
        "medidas": "Mochila: 40 cm x 29 cm x 14 cm | Cartuchera: 22 cm x 10 cm x 5 cm",
        "contenido": "Mochila con múltiples compartimentos + Cartuchera a juego.",
        "desc": "¡El combo perfecto para la escuela! Esta mochila no solo ofrece un diseño espectacular y colorido, sino que incluye una cartuchera a juego, maximizando el valor para el cliente. Amplia, resistente y llena de personalidad."
    },
    "Tricombo Viaje Ligero Animado": {
        "material": "Lona repelente al agua",
        "medidas": "Mochila principal: 42 cm x 30 cm | Lonchera: 25 cm x 20 cm | Lapicera: 22 cm x 10 cm",
        "contenido": "Set de 3 piezas: Mochila, lonchera térmica y lapicera. Diseños coordinados.",
        "desc": "El set definitivo para viajar o salir con estilo. Este tricombo animado incluye todo lo necesario para mantener tus pertenencias organizadas con diseños modernos y llenos de color. Su calidad y precio lo convierten en uno de los favoritos de nuestros clientes mayoristas."
    },
    "Tricombo Escolar Animado": {
        "material": "Poliéster ultra resistente",
        "medidas": "Mochila: 41 cm x 30 cm | Lonchera térmica: 24 cm x 21 cm | Lapicera: 23 cm x 11 cm",
        "contenido": "Mochila escolar, lonchera con interior térmico y lapicera doble cierre.",
        "desc": "Prepárate para las clases con el mejor estilo. Este espectacular tricombo escolar incluye mochila, lonchera y lapicera con estampados animados a juego. Fabricado con materiales de alta resistencia, es un producto ganador para cualquier temporada escolar."
    },
    "Mochila Cofre Animada": {
        "material": "Poliéster rígido (estructura cofre)",
        "medidas": "35 cm x 25 cm x 15 cm",
        "contenido": "Formato estructurado rígido para proteger el contenido, apertura amplia de cierre.",
        "desc": "Diseño estructurado y seguro. La Mochila Cofre mantiene su forma rígida protegiendo tus pertenencias, mientras deslumbra con sus increíbles estampados animados. Ideal para paseos largos y máxima durabilidad."
    },
    "Mochila Plana Animada": {
        "material": "Poliéster ligero",
        "medidas": "39 cm x 28 cm x 8 cm",
        "contenido": "Diseño delgado y ergonómico, bolsillo frontal oculto y cierre principal.",
        "desc": "Diseño ultradelgado pero con gran capacidad. Esta mochila se adapta a tu espalda con total comodidad y presenta estampados vibrantes que no pasarán desapercibidos. Ideal para llevar tablets, libros o essentials sin abultar."
    },
    "Bolso Media Vista Artesanal": {
        "material": "Yute natural y detalles en vinipiel",
        "medidas": "32 cm x 24 cm x 12 cm",
        "contenido": "Bolsillo interno con cierre, forro interior de algodón, asas reforzadas.",
        "desc": "Destaca en cualquier ocasión con este bolso de tamaño medio. Sus hermosos acabados artesanales en yute le dan un toque orgánico y elegante, ofreciendo el tamaño perfecto para llevar tus esenciales del día a día con total comodidad."
    },
    "Bolso Tote Artesanal": {
        "material": "Yute reforzado, forro textil y asas gruesas",
        "medidas": "45 cm x 35 cm x 15 cm",
        "contenido": "Gran capacidad de almacenamiento, sin separaciones internas para máxima flexibilidad.",
        "desc": "Un clásico infalible reinventado. Nuestro Bolso Tote combina la textura y elegancia rústica del yute con detalles artesanales de primera calidad. Es el complemento perfecto por su amplio espacio y versatilidad. Una pieza clave para el catálogo de cualquier emprendedor."
    },
    "Bolso Maletin Doble Artesanal": {
        "material": "Yute entrelazado con refuerzos de estructura",
        "medidas": "38 cm x 28 cm x 16 cm",
        "contenido": "Dos compartimentos principales separados por cierre, bolsillo interior y correa ajustable.",
        "desc": "Diseñado para quienes buscan máxima organización y estilo. Este maletín cuenta con compartimentos dobles que facilitan llevar de todo. Sus detalles en yute y acabados artesanales lo convierten en una opción sofisticada y sumamente práctica."
    },
    "Bolso Broche Artesanal": {
        "material": "Yute fino y acabados metálicos",
        "medidas": "28 cm x 20 cm x 10 cm",
        "contenido": "Cierre con broche metálico frontal, correa de hombro ajustable y bolsillo trasero.",
        "desc": "La fusión perfecta entre seguridad y elegancia rústica. Destaca por su hermoso broche frontal y su resistente confección en yute. Ideal para clientas que buscan un bolso distintivo, seguro y lleno de personalidad."
    },
    "Bolso Maletin Artesanal": {
        "material": "Yute estructurado",
        "medidas": "40 cm x 30 cm x 12 cm",
        "contenido": "Estructura firme ideal para documentos o tablets, asas de mano y forro protector.",
        "desc": "Elegancia ejecutiva con un toque tradicional. Nuestro maletín artesanal es espacioso, estructurado y cuenta con detalles en yute que lo hacen único. Perfecto para la oficina o salidas donde se requiere llevar documentos o tablets con estilo."
    },
    "Bolso Oleaje Artesanal": {
        "material": "Yute con patrón curvo tejido a mano",
        "medidas": "36 cm x 26 cm x 14 cm",
        "contenido": "Silueta fluida asimétrica, cierre magnético y asa de hombro.",
        "desc": "Inspirado en la fluidez de las olas, este hermoso bolso presenta un diseño asimétrico cautivador. Fabricado con detalles de yute de alta calidad, es el accesorio ideal para quienes buscan marcar tendencia con un toque mexicano."
    },
    "Bolso Linea Media Artesanal": {
        "material": "Yute natural con acentos de color",
        "medidas": "30 cm x 22 cm x 10 cm",
        "contenido": "Tamaño medio con cierre de cremallera, ideal para el uso diario.",
        "desc": "Equilibrio perfecto entre tamaño y diseño. El Bolso Línea Media es sutil, cómodo y destaca por sus acabados rústicos en yute. Un básico indispensable que toda mujer querrá tener en su colección."
    },
    "Bolso Regina con Asa Fruncida Artesanal": {
        "material": "Yute premium y asa textil fruncida",
        "medidas": "34 cm x 25 cm x 13 cm",
        "contenido": "Asa fruncida para un look artesanal único, forro interior y bolsillo para celular.",
        "desc": "Una verdadera obra de arte en tus manos. El hermoso detalle fruncido en su asa le da un volumen y textura incomparables. Combinado con el diseño en yute, el Bolso Regina es sinónimo de moda artesanal de lujo."
    },
    "Bolso Trenzas Artesanales": {
        "material": "Yute y detalles trenzados",
        "medidas": "35 cm x 30 cm x 14 cm",
        "contenido": "Decoración de trenzas artesanales en el panel frontal, correas cómodas.",
        "desc": "Detalles que enamoran. Las delicadas trenzas tejidas en su diseño le otorgan a este bolso un carácter único y bohemio. Fabricado con yute resistente, es una pieza llamativa, espaciosa y perfecta para armar looks inolvidables."
    },
    "Bolso Cuadrado Artesanal": {
        "material": "Yute estructurado",
        "medidas": "28 cm x 28 cm x 12 cm",
        "contenido": "Forma geométrica con gran estabilidad, base reforzada.",
        "desc": "Minimalismo estructurado con un toque tradicional. Su forma geométrica perfecta permite aprovechar al máximo el espacio interior, mientras que el acabado artesanal en yute lo convierte en un accesorio versátil y moderno."
    },
    "Bolso Tote Franja Artesanal": {
        "material": "Yute con franja tejida en contraste",
        "medidas": "42 cm x 34 cm x 16 cm",
        "contenido": "Detalle de franja colorida, amplio espacio interior sin divisiones para mayor capacidad.",
        "desc": "Amplio, cómodo y con un detalle distintivo. La franja decorativa rompe con lo tradicional y aporta un estilo vibrante a nuestro querido Bolso Tote. Hecho en yute de primera, es perfecto para compras, playa o uso diario."
    },
    "Bolso Cinturón Elegante Artesanal": {
        "material": "Yute suave y correa estilo cinturón",
        "medidas": "32 cm x 24 cm x 11 cm",
        "contenido": "Diseño frontal simulando un cinturón de ajuste, cierre seguro.",
        "desc": "Un diseño que simula un delicado cinturón cruzado, aportando una estética lujosa y moderna. Combinado con la frescura del yute, este bolso es el equilibrio ideal entre lo casual y lo elegante."
    },
    "Bolso Fusión Artesanal": {
        "material": "Yute mezclado con texturas sintéticas",
        "medidas": "34 cm x 26 cm x 12 cm",
        "contenido": "Mezcla de materiales en el diseño frontal, asas dobles.",
        "desc": "Lo mejor de dos mundos en una sola pieza. Este bolso combina distintas texturas, destacando el yute como protagonista, en un diseño innovador y moderno. ¡Garantiza miradas y ventas rápidas!"
    },
    "Bolso Transparente Artesanal": {
        "material": "PVC transparente de alta resistencia y ribetes de yute",
        "medidas": "30 cm x 22 cm x 10 cm",
        "contenido": "Paneles transparentes con estructura artesanal en los bordes. Ideal para eventos.",
        "desc": "La tendencia de lo transparente se encuentra con lo artesanal. Incluye detalles únicos que enmarcan la zona transparente, dándole un toque chic y moderno. Ideal para eventos, conciertos o salidas casuales."
    },
    "Bolso Elegante De Mano Artesanal": {
        "material": "Yute de tejido fino",
        "medidas": "24 cm x 16 cm x 6 cm",
        "contenido": "Tamaño clutch/mano, cierre de broche, incluye correa delgada removible.",
        "desc": "La joya de la corona para eventos especiales. Compacto, sofisticado y con acabados en yute de alta precisión. Este bolso de mano es la definición de elegancia artesanal, perfecto para clientes exigentes."
    },
    "Bolso Cuadrado Animado": {
        "material": "Poliéster rígido con estampado",
        "medidas": "25 cm x 25 cm x 10 cm",
        "contenido": "Formato pequeño y estructurado, asa larga ajustable.",
        "desc": "Divertido, estructurado y lleno de color. Su formato cuadrado lo hace muy práctico para organizar todo fácilmente, y sus estampados animados le dan un giro alegre a cualquier conjunto."
    },
    "Bolso Cadena Animado": {
        "material": "Poliéster y cadena metálica",
        "medidas": "28 cm x 20 cm x 8 cm",
        "contenido": "Correa de cadena metálica, cierre magnético frontal.",
        "desc": "Un toque rebelde y moderno. Este bolso destaca por su llamativa correa de cadena, contrastando maravillosamente con estampados coloridos y divertidos. Un accesorio juvenil, perfecto para salir de noche o destacar en el día."
    },
    "Paquete Patrio 64 Piezas": {
        "material": "Mixto (Poliéster y Yute según los modelos incluidos)",
        "medidas": "Variadas según cada pieza",
        "contenido": "Surtido de 64 piezas incluyendo mochilas, bolsos y monederos con temática patria y lotería.",
        "desc": "¡Inicia tu negocio con el mejor margen de ganancia! Este espectacular paquete surtido incluye 64 piezas con increíbles temáticas y estampados de fiestas mexicanas y lotería. Creado especialmente para que surtas tu inventario rápido, con envío gratis y maximices tus ventas en esta temporada patria."
    }
}

with app.app_context():
    products = Product.query.all()
    updated = 0
    for p in products:
        if p.name in catalog_updates:
            info = catalog_updates[p.name]
            # Format the new description appending the structured info
            new_desc = f"{info['desc']}\n\n**Material:** {info['material']}\n**Medidas:** {info['medidas']}\n**Características:** {info['contenido']}"
            p.description = new_desc
            updated += 1
        else:
            # For products not explicitly in the dict, we can optionally add generic info
            # or skip.
            pass
    
    if updated > 0:
        db.session.commit()
        print(f"Éxito: Se actualizaron las descripciones con medidas y materiales de {updated} productos.")
    else:
        print("No se actualizó ningún producto (verifica los nombres).")
