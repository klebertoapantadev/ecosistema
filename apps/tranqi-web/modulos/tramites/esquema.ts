import type { VarianteCatalogo } from "@eco/comercio";

/**
 * Un trámite es un producto del catálogo de tranqi (categoría «tramites») que tranqi
 * gestiona por el cliente: notarizaciones, poderes, declaraciones, salida de menores…
 * No hay tabla propia: precio, requisitos y plazo salen del catálogo (TRQ-043).
 */
export interface OpcionTramite {
  variante: VarianteCatalogo;
  nombre: string;
  descripcion: string | null;
  /** `concepto_derecho` de la variante: identifica la opción sin depender del nombre. */
  concepto: string | null;
}

export interface TramiteCatalogo {
  productoId: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tiempoEntrega: string | null;
  requisitos: string[];
  etiquetas: string[];
  opciones: OpcionTramite[];
}

export interface TramiteDetectado {
  tramite: TramiteCatalogo;
  /** var_id de la opción que mejor encaja con lo que contó el cliente. */
  opcionId: string;
}

/** Un trámite que el cliente ya pagó, para «Mis necesidades». */
export interface TramitePedido {
  id: string;
  nombre: string;
  tramite: string | null;
  pedidoEn: string;
  montoTotal: number;
  tiempoEntrega: string | null;
}
