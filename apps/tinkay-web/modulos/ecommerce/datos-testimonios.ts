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
export const ENLACE_ALBUM_GOOGLE_PHOTOS = 'https://photos.app.goo.gl/tinkay-testimonios';

export const TESTIMONIOS_TINKAY: TestimonioCliente[] = [
  {
    id: 'tst-01',
    nombreCliente: 'Camila R.',
    ciudad: 'Quito Norte (La Carolina)',
    ocasion: '💐 Cumpleaños Sorpresa',
    comentario:
      '«¡Llegó puntualísimo a las 9 am a la oficina de mi hermana! Las rosas olían increíble y la dedicatoria en papel verjurado quedó perfecta. 100% recomendados.»',
    imagenUrl: '/img/extras/bouquet_rojo_recostado_tinkay.jpg',
    calificacion: 5,
    fecha: 'Hace 2 días',
    destacado: true,
  },
  {
    id: 'tst-02',
    nombreCliente: 'David S.',
    ciudad: 'Cumbayá',
    ocasion: '🌹 Aniversario de Bodas',
    comentario:
      '«Compré el Abanico Floral con los chocolates Ferrero. La presentación superó las fotos de la página web. Mi esposa quedó fascinada con la frescura de los botones.»',
    imagenUrl: '/img/extras/bouquet_rojo_caja_ferrero_corazon.jpg',
    calificacion: 5,
    fecha: 'Hace 5 días',
    destacado: true,
  },
  {
    id: 'tst-03',
    nombreCliente: 'Valeria M.',
    ciudad: 'Quito Centro',
    ocasion: '🎁 Detalle de Agradecimiento',
    comentario:
      '«Excelente atención por WhatsApp y pago súper rápido con Payphone. Me enviaron foto del arreglo terminado antes de sacarlo a ruta. Gran servicio al cliente.»',
    imagenUrl: '/img/extras/bouquet_rojo_ferrero_taller.jpg',
    calificacion: 5,
    fecha: 'Hace 1 semana',
    destacado: true,
  },
  {
    id: 'tst-04',
    nombreCliente: 'Juan Carlos P.',
    ciudad: 'Tumbaco',
    ocasion: '🕊️ Arreglo de Condolencias',
    comentario:
      '«En momentos difíciles la puntualidad y el respeto lo son todo. La cinta personalizada lila quedó con caligrafía impecable y el arreglo monumental llegó a la sala con mucha solemnidad.»',
    imagenUrl: '/img/slide2_cementerio_flores.jpg',
    calificacion: 5,
    fecha: 'Hace 2 semanas',
    destacado: true,
  },
  {
    id: 'tst-05',
    nombreCliente: 'Andrea G.',
    ciudad: 'Monteserrín',
    ocasion: '🎂 Celebración Familiar',
    comentario:
      '«Pedí el Box Floral con orquídeas y bombones. Las flores duraron más de dos semanas frescas en casa siguiendo los consejos que venían en la tarjeta.»',
    imagenUrl: '/img/slide5_fiesta_familia.jpg',
    calificacion: 5,
    fecha: 'Hace 3 semanas',
    destacado: false,
  },
  {
    id: 'tst-06',
    nombreCliente: 'Esteban V.',
    ciudad: 'Valle de los Chillos',
    ocasion: '💖 Pedida de Mano',
    comentario:
      '«Coordinaron conmigo la entrega minuto a minuto para que llegara justo cuando entrábamos al restaurante. ¡La sorpresa salió de 10!»',
    imagenUrl: '/img/slide4_flores_amor.jpg',
    calificacion: 5,
    fecha: 'Hace 1 mes',
    destacado: false,
  },
];
