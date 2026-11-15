/**
 * Datos y configuración de testimonios y capturas de clientes para Tinkay Floristería.
 * Puedes agregar o reemplazar imágenes con capturas de WhatsApp o fotos de entregas.
 * Coloca las imágenes en `apps/tinkay-web/public/img/testimonios/` o usa URLs externas.
 */

export interface TestimonioCliente {
  id: string;
  nombreCliente: string;
  ciudad: string;
  ocasion: string;
  comentario: string;
  imagenUrl: string;
  calificacion: number;
  fecha?: string;
  destacado?: boolean;
}

/**
 * Enlace directo al álbum compartido de Google Photos.
 * Reemplaza esta URL con el enlace de tu álbum compartido.
 */
export const ENLACE_ALBUM_GOOGLE_PHOTOS = 'https://photos.app.goo.gl/pARRDFJCASyUW4vRA';

export const TESTIMONIOS_TINKAY: TestimonioCliente[] = [
  {
    id: 'tst-01',
    nombreCliente: 'Marcela Serna',
    ciudad: 'Quito',
    ocasion: '💍 Arco Floral & Matrimonio',
    comentario:
      '«Buenos días don Kleber, quedamos encantados con su trabajo, espectacular. Muchísimas gracias, estaremos coordinando a futuro para nuestro matrimonio eclesiástico. ¡Un buen día!»',
    imagenUrl: '/img/testimonios/testimonio-marcela-serna-arco-boda.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
  {
    id: 'tst-02',
    nombreCliente: 'Angelo Carvajal',
    ciudad: 'Quito Norte',
    ocasion: '🌻 Arreglo Especial de Girasoles',
    comentario:
      '«El arreglo está muy lindo, le gustó mucho a mi esposa. Muchas gracias por la confirmación y la entrega puntual.»',
    imagenUrl: '/img/testimonios/testimonio-whatsapp-girasoles.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
  {
    id: 'tst-03',
    nombreCliente: 'Daysi Salguero',
    ciudad: 'Quito y Valles',
    ocasion: '🚗 Entrega Express a Domicilio',
    comentario:
      '«¡Muchas gracias por su ayuda e inmediata gestión! El detalle con peluche y girasoles llegó perfecto en su vehículo de entrega.»',
    imagenUrl: '/img/testimonios/testimonio-daysi-salguero-camioneta-tinkay.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
  {
    id: 'tst-04',
    nombreCliente: 'Danny',
    ciudad: 'Quito Centro-Norte',
    ocasion: '💐 Bouquet Mix de Rosas y Girasoles',
    comentario:
      '«Muchas gracias, excelente servicio. El arreglo floral superó las expectativas y la entrega fue 100% puntual.»',
    imagenUrl: '/img/testimonios/testimonio-danny-girasoles-rosas.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
  {
    id: 'tst-05',
    nombreCliente: 'Jenny Ordóñez',
    ciudad: 'Quito y Valles',
    ocasion: '🌙 Montaje de Arco Media Luna en Jardín',
    comentario:
      '«Muchas gracias, les quedó precioso. Las maestras floristas montaron la estructura en el jardín con total delicadeza.»',
    imagenUrl: '/img/testimonios/testimonio-jenny-ordonez-arco-luna.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
  {
    id: 'tst-06',
    nombreCliente: 'Diana Jaramillo',
    ciudad: 'Quito',
    ocasion: '🌹 Estructura Circular & Rosas Rojas',
    comentario:
      '«Ohh está hermoso, mil gracias. La composición circular con rosas rojas y pedestales dorados se robó todas las miradas.»',
    imagenUrl: '/img/testimonios/testimonio-diana-jaramillo-aro-rosas.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
  {
    id: 'tst-07',
    nombreCliente: 'José González',
    ciudad: 'Quito y Valles',
    ocasion: '🎪 Montaje y Decoración de Evento',
    comentario:
      '«Quedó muy bien, muy recomendados. Agradecemos su gentileza y puntualidad con el equipo de instalación en la carpa.»',
    imagenUrl: '/img/testimonios/testimonio-whatsapp-evento-mesas.jpg',
    calificacion: 5,
    fecha: 'Reciente',
    destacado: true,
  },
];
