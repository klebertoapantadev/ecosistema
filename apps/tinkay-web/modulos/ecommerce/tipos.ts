export type TipoCategoria = 'FORMATO' | 'COLECCION' | 'OCASION' | 'COMPLEMENTO' | 'EVENTO';

export interface CategoriaEcommerce {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  tipo: TipoCategoria;
  icono?: string;
  modoVisualSobrio?: boolean;
}

export interface VarianteEcommerce {
  sku: string;
  nombre: string;
  pvp: number; // Precio de Venta al Público con IVA 15% incluido
  baseImponible: number; // PVP / 1.15
  tarifaIva: number; // 15%
  detalle?: string;
  recetaBom?: string;
  unidadesFlores?: number;
  foto?: string;
  precioComparacion?: number;
}

export interface ProductoEcommerce {
  id: string;
  slug: string;
  nombre: string;
  descripcionCorta: string;
  descripcionLarga: string;
  categoriaPrincipal: string;
  categoriasSecundarias: string[];
  fotos: string[]; // Carrusel de fotos reales en alta definición
  variantes: VarianteEcommerce[];
  destacado: boolean;
  nuevo?: boolean;
  entregaHoy?: boolean;
  esCondolencias?: boolean;
  esComplemento?: boolean;
  ocasionRecomendada?: string;
  etiquetas: string[];
}

export interface DedicatoriaArreglo {
  para: string;
  de: string;
  mensaje: string;
  ocasion?: string;
}

export type FranjaHoraria = 'manana' | 'tarde' | 'hora_exacta';

export interface DatosEntrega {
  destinatarioNombre: string;
  destinatarioTelefono: string;
  direccion: string;
  referencia: string;
  ciudad: string;
  fechaEntrega: string;
  franjaHoraria: FranjaHoraria;
  horaExacta?: string;
}

export interface ItemCarrito {
  id: string; // Identificador único por línea de carrito
  producto: ProductoEcommerce;
  variante: VarianteEcommerce;
  cantidad: number;
  dedicatoria?: DedicatoriaArreglo;
  entregaIndividual?: DatosEntrega;
}

export type ModalidadEntrega = 'unificada' | 'individual';

export interface MensajeChat {
  id: string;
  remitente: 'usuario' | 'aria';
  texto: string;
  timestamp: string;
  productosSugeridos?: {
    producto: ProductoEcommerce;
    variantePorDefecto: VarianteEcommerce;
    mensajeMotivo?: string;
  }[];
  sugerenciaDedicatoria?: {
    para: string;
    mensaje: string;
  };
}
