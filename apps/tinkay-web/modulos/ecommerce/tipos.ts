import type {
  ComponenteComboConfig,
  EscalaVolumenVariante,
} from '@eco/comercio';

export type TipoCategoria = 'FORMATO' | 'COLECCION' | 'OCASION' | 'COMPLEMENTO' | 'EVENTO';

export interface CategoriaEcommerce {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  tipo: TipoCategoria;
  icono?: string;
  modoVisualSobrio?: boolean;
  orden?: number;
  palabrasClave?: string[];
}

export interface VarianteEcommerce {
  varId?: string;
  sku: string;
  nombre: string;
  pvp: number; // Precio de Venta al Público con IVA incluido
  pvpNominalSinVolumen?: number; // PVP unitario base antes de escalas por cantidad
  baseImponible: number; // PVP / (1 + IVA)
  tarifaIva: number;
  detalle?: string;
  beneficiosCustom?: string[];
  recetaBom?: string;
  unidadesFlores?: number;
  foto?: string;
  fotos?: string[]; // Galería completa configurada para esta variante (portada + galeria_urls)
  precioComparacion?: number;
  escalasVolumen?: EscalaVolumenVariante[];
  usos?: string[];
  usosModo?: 'heredar' | 'personalizado';
}

export interface ProductoEcommerce {
  id: string;
  proIdUuid?: string;
  slug: string;
  nombre: string;
  nombreBase?: string; // Nombre original del producto antes del desglose individual por variantes
  descripcionCorta: string;
  descripcionMasterCorta?: string; // Descripción corta original de la ficha maestra
  descripcionLarga: string;
  beneficios?: string[];
  requisitos?: string[];
  etiquetaTemporada?: string;
  palabrasClaveCategoria?: string[];
  categoriaPrincipal: string;
  categoriaNombre?: string;
  categoriasSecundarias: string[];
  fotos: string[]; // Carrusel de fotos reales en alta definición
  fotosMaster?: string[]; // Fotos globales configuradas en la ficha maestra del producto
  fotosModal?: string[]; // Galería completa para el modal de detalle
  varianteInicialSku?: string; // Variante preseleccionada en caso de desglose individual
  variantes: VarianteEcommerce[];
  destacado: boolean;
  nuevo?: boolean;
  entregaHoy?: boolean;
  esCondolencias?: boolean;
  esComplemento?: boolean;
  esExtra?: boolean; // Pertenece a categoría "Extras"
  esCombo?: boolean; // Set / Combo compuesto por múltiples productos individuales
  comboComponentes?: ComponenteComboConfig[];
  usos?: string[]; // Usos recomendados (ej. 'condolencias', 'cumpleanos')
  ocasionRecomendada?: string;
  etiquetas: string[];
  deliveryIncluido?: boolean;
  modalidadTransporte?: string;
  etiquetaTransporte?: string;
  coberturaTexto?: string;
  recargoLogisticoUsd?: number;
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
  enlaceMapa?: string;
  lat?: number;
  lng?: number;
  retiroEnLocal?: boolean;
  zonaDetectadaNombre?: string;
  reglaLogisticaAplicada?: string;
  distanciaVialKm?: number;
  costoEnvioCalculado?: number;
  dentroCobertura?: boolean;
  etiquetaCotizacion?: string;
  formulaCalculoInterno?: string;
  detalleDireccionGeo?: {
    resumenDireccion: string;
    callePrincipal?: string;
    sectorBarrio?: string;
    parroquia?: string;
    ciudad?: string;
    provincia?: string;
    codigoPostal?: string;
  } | null;
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
  cotizacionEnvio?: {
    etiquetaResumen: string;
    costoTotalEnvio: number;
    dentroCobertura: boolean;
    zonaDetectadaNombre?: string;
    distanciaVialKm?: number;
    direccionReferencial?: string;
    callePrincipal?: string;
    sectorBarrio?: string;
    parroquia?: string;
    enlaceMapa: string;
    lat: number;
    lng: number;
  };
  reintentarTexto?: string;
}
