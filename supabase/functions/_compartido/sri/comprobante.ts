// Contrato de los módulos SRI (PLT-006). Lo construye la Edge Function
// facturacion-sri a partir de comun_facturacion y lo consumen el cálculo de
// totales, el generador de XML, la firma y el RIDE.
//
// Los importes viajan como cadenas decimales ("12.50", "0.333333"), nunca como
// number: el estándar 05 prohíbe flotantes para dinero y el SRI admite hasta 6
// decimales en cantidad y precio, que un entero en centavos no representa.
// La aritmética exacta vive en decimal.ts.
//
// Port del modelo de DOMO (Domo.Firma.Core/Modelo/Comprobante.cs).

/** codDoc del SRI: 01 factura, 04 nota de crédito. */
export type TipoComprobante = "01" | "04";

/** 1 = pruebas (celcer.sri.gob.ec), 2 = producción (cel.sri.gob.ec). */
export type Ambiente = 1 | 2;

export type Regimen = "GENERAL" | "RIMPE_EMPRENDEDOR" | "RIMPE_NEGOCIO_POPULAR";

/** 04 RUC · 05 cédula · 06 pasaporte · 07 consumidor final · 08 identificación del exterior. */
export type TipoIdentificacion = "04" | "05" | "06" | "07" | "08";

export interface Emisor {
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccionMatriz: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string | null;
  agenteRetencion: string | null;
  regimen: Regimen;
}

export interface Establecimiento {
  /** 3 dígitos, p. ej. "001". */
  codigo: string;
  direccion: string;
  nombreComercial: string | null;
}

export interface Comprador {
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;
  razonSocial: string;
  direccion: string | null;
  correo: string | null;
  telefono: string | null;
}

export interface CampoAdicional {
  nombre: string;
  valor: string;
}

/** Línea tal como se guardó. Los importes calculados salen de calcularTotales(). */
export interface LineaDetalle {
  orden: number;
  codigo: string;
  codigoAuxiliar: string | null;
  descripcion: string;
  /** Hasta 6 decimales. */
  cantidad: string;
  /** Hasta 6 decimales. Base imponible unitaria, sin IVA. */
  precioUnitario: string;
  /** 2 decimales. */
  descuento: string;
  /** codigoPorcentaje de la Tabla 17: "0", "4", "5", "6", "7", "10". */
  codigoIva: string;
  detallesAdicionales: CampoAdicional[];
}

/** Forma de pago de la Tabla 24 ("01", "16", "19", "20"…). */
export interface Pago {
  formaPago: string;
  /** 2 decimales. */
  total: string;
  plazo: number | null;
  unidadTiempo: string | null;
}

/** Documento que modifica una nota de crédito. numero = "001-001-000000001". */
export interface DocumentoModificado {
  codDoc: "01";
  numero: string;
  /** AAAA-MM-DD */
  fechaEmision: string;
}

export interface Comprobante {
  tipo: TipoComprobante;
  ambiente: Ambiente;
  /** 49 dígitos, asignada por fac_fn_emitir. */
  claveAcceso: string;
  /** Secuencial SRI (1..999999999). */
  numero: number;
  /** AAAA-MM-DD, fecha civil de Ecuador. */
  fechaEmision: string;
  emisor: Emisor;
  establecimiento: Establecimiento;
  /** 3 dígitos. */
  puntoEmision: string;
  comprador: Comprador;
  detalles: LineaDetalle[];
  pagos: Pago[];
  infoAdicional: CampoAdicional[];
  /** Solo nota de crédito. */
  modifica: DocumentoModificado | null;
  /** Solo nota de crédito. */
  motivo: string | null;
}

export interface TarifaIva {
  codigoPorcentaje: string;
  /** Porcentaje como decimal: "15", "0", "13". */
  porcentaje: string;
  descripcion: string;
}

export interface TotalesLinea {
  orden: number;
  /** precioTotalSinImpuesto, 2 decimales. */
  base: string;
  /** IVA de la línea tras el reparto de centavos, 2 decimales. */
  valorIva: string;
  tarifa: TarifaIva;
}

export interface TotalGrupo {
  codigoPorcentaje: string;
  tarifa: string;
  base: string;
  valor: string;
}

/** Única fuente de verdad de los importes del comprobante. */
export interface Totales {
  lineas: TotalesLinea[];
  grupos: TotalGrupo[];
  totalSinImpuestos: string;
  totalDescuento: string;
  totalIva: string;
  importeTotal: string;
}

export interface MensajeSri {
  identificador: string;
  mensaje: string;
  informacionAdicional: string | null;
  tipo: string;
}

export interface RespuestaRecepcion {
  /** "RECIBIDA" | "DEVUELTA" */
  estado: string;
  mensajes: MensajeSri[];
}

export interface AutorizacionSri {
  /** "AUTORIZADO" | "NO AUTORIZADO" | "EN PROCESO" … */
  estado: string;
  numeroAutorizacion: string | null;
  /** ISO 8601 tal como lo devuelve el SRI. */
  fechaAutorizacion: string | null;
  ambiente: string | null;
  comprobanteXml: string | null;
  mensajes: MensajeSri[];
}

/** Lista vacía = el SRI todavía no tiene respuesta. */
export interface RespuestaAutorizacion {
  autorizaciones: AutorizacionSri[];
}

/** Número visible: 001-001-000000123. */
export function numeroVisible(c: Pick<Comprobante, "establecimiento" | "puntoEmision" | "numero">): string {
  return `${c.establecimiento.codigo}-${c.puntoEmision}-${String(c.numero).padStart(9, "0")}`;
}
