import os
from dotenv import load_dotenv

load_dotenv()

from app import create_app
from app.extensions import db
from app.models import Product

app = create_app()

descriptions = {
    "Mochila Escolar Animada": "Ideal para el regreso a clases o para llevar la diversión a todas partes. Esta mochila cuenta con diseños vibrantes y animados que capturan la atención, ofreciendo además un excelente espacio interior, comodidad y durabilidad inigualable. ¡Un producto estrella que se vende solo!",
    "Mochila Fusión Media Animada": "Una mezcla perfecta entre tamaño práctico y diseño llamativo. La Mochila Fusión Media destaca por sus estampados únicos, correas ajustables y ligereza, convirtiéndola en una opción versátil tanto para estudiantes como para paseos casuales.",
    "Mochila con Cartuchera Animada": "¡El combo perfecto para la escuela! Esta mochila no solo ofrece un diseño espectacular y colorido, sino que incluye una cartuchera a juego, maximizando el valor para el cliente. Amplia, resistente y llena de personalidad.",
    "Tricombo Viaje Ligero Animado": "El set definitivo para viajar o salir con estilo. Este tricombo animado incluye todo lo necesario para mantener tus pertenencias organizadas con diseños modernos y llenos de color. Su calidad y precio lo convierten en uno de los favoritos de nuestros clientes mayoristas.",
    "Paquete Patrio 64 Piezas": "¡Inicia tu negocio con el mejor margen de ganancia! Este espectacular paquete surtido incluye 64 piezas con increíbles temáticas y estampados de fiestas mexicanas y lotería. Creado especialmente para que surtas tu inventario rápido, con envío gratis y maximices tus ventas en esta temporada patria.",
    "Tricombo Escolar Animado": "Prepárate para las clases con el mejor estilo. Este espectacular tricombo escolar incluye mochila, lonchera y lapicera con estampados animados a juego. Fabricado con materiales de alta resistencia, es un producto ganador para cualquier temporada escolar.",
    "Bolso Media Vista Artesanal": "Destaca en cualquier ocasión con este bolso de tamaño medio. Sus hermosos acabados artesanales en yute le dan un toque orgánico y elegante, ofreciendo el tamaño perfecto para llevar tus esenciales del día a día con total comodidad.",
    "Bolso Tote Artesanal": "Un clásico infalible reinventado. Nuestro Bolso Tote combina la textura y elegancia rústica del yute con detalles artesanales de primera calidad. Es el complemento perfecto por su amplio espacio y versatilidad. Una pieza clave para el catálogo de cualquier emprendedor.",
    "Bolso Maletin Doble Artesanal": "Diseñado para quienes buscan máxima organización y estilo. Este maletín cuenta con compartimentos dobles que facilitan llevar de todo. Sus detalles en yute y acabados artesanales lo convierten en una opción sofisticada y sumamente práctica.",
    "Bolso Broche Artesanal": "La fusión perfecta entre seguridad y elegancia rústica. Destaca por su hermoso broche frontal y su resistente confección en yute. Ideal para clientas que buscan un bolso distintivo, seguro y lleno de personalidad.",
    "Bolso Maletin Artesanal": "Elegancia ejecutiva con un toque tradicional. Nuestro maletín artesanal es espacioso, estructurado y cuenta con detalles en yute que lo hacen único. Perfecto para la oficina o salidas donde se requiere llevar documentos o tablets con estilo.",
    "Bolso Oleaje Artesanal": "Inspirado en la fluidez de las olas, este hermoso bolso presenta un diseño asimétrico cautivador. Fabricado con detalles de yute de alta calidad, es el accesorio ideal para quienes buscan marcar tendencia con un toque mexicano.",
    "Bolso Linea Media Artesanal": "Equilibrio perfecto entre tamaño y diseño. El Bolso Línea Media es sutil, cómodo y destaca por sus acabados rústicos en yute. Un básico indispensable que toda mujer querrá tener en su colección.",
    "Mochila Cofre Animada": "Diseño estructurado y seguro. La Mochila Cofre mantiene su forma rígida protegiendo tus pertenencias, mientras deslumbra con sus increíbles estampados animados. Ideal para paseos largos y máxima durabilidad.",
    "Bolso Regina con Asa Fruncida Artesanal": "Una verdadera obra de arte en tus manos. El hermoso detalle fruncido en su asa le da un volumen y textura incomparables. Combinado con el diseño en yute, el Bolso Regina es sinónimo de moda artesanal de lujo.",
    "Bolso Trenzas Artesanales": "Detalles que enamoran. Las delicadas trenzas tejidas en su diseño le otorgan a este bolso un carácter único y bohemio. Fabricado con yute resistente, es una pieza llamativa, espaciosa y perfecta para armar looks inolvidables.",
    "Bolso Cuadrado Artesanal": "Minimalismo estructurado con un toque tradicional. Su forma geométrica perfecta permite aprovechar al máximo el espacio interior, mientras que el acabado artesanal en yute lo convierte en un accesorio versátil y moderno.",
    "Bolso Tote Franja Artesanal": "Amplio, cómodo y con un detalle distintivo. La franja decorativa rompe con lo tradicional y aporta un estilo vibrante a nuestro querido Bolso Tote. Hecho en yute de primera, es perfecto para compras, playa o uso diario.",
    "Bolso Cinturón Elegante Artesanal": "Un diseño que simula un delicado cinturón cruzado, aportando una estética lujosa y moderna. Combinado con la frescura del yute, este bolso es el equilibrio ideal entre lo casual y lo elegante.",
    "Bolso Fusión Artesanal": "Lo mejor de dos mundos en una sola pieza. Este bolso combina distintas texturas, destacando el yute como protagonista, en un diseño innovador y moderno. ¡Garantiza miradas y ventas rápidas!",
    "Bolso Transparente Artesanal": "La tendencia de lo transparente se encuentra con lo artesanal. Incluye detalles únicos que enmarcan la zona transparente, dándole un toque chic y moderno. Ideal para eventos, conciertos o salidas casuales.",
    "Bolso Elegante De Mano Artesanal": "La joya de la corona para eventos especiales. Compacto, sofisticado y con acabados en yute de alta precisión. Este bolso de mano es la definición de elegancia artesanal, perfecto para clientes exigentes.",
    "Mochila Plana Animada": "Diseño ultradelgado pero con gran capacidad. Esta mochila se adapta a tu espalda con total comodidad y presenta estampados vibrantes que no pasarán desapercibidos. Ideal para llevar tablets, libros o essentials sin abultar.",
    "Bolso Cuadrado Animado": "Divertido, estructurado y lleno de color. Su formato cuadrado lo hace muy práctico para organizar todo fácilmente, y sus estampados animados le dan un giro alegre a cualquier conjunto.",
    "Bolso Cadena Animado": "Un toque rebelde y moderno. Este bolso destaca por su llamativa correa de cadena, contrastando maravillosamente con estampados coloridos y divertidos. Un accesorio juvenil, perfecto para salir de noche o destacar en el día."
}

with app.app_context():
    products = Product.query.all()
    updated = 0
    for p in products:
        if p.name in descriptions:
            p.description = descriptions[p.name]
            updated += 1
    
    if updated > 0:
        db.session.commit()
        print(f"Éxito: Se actualizaron las descripciones de {updated} productos.")
    else:
        print("No se actualizó ningún producto (verifica los nombres).")
