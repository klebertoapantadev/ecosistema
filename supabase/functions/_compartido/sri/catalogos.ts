// Catálogos del SRI (Ficha Técnica de Comprobantes Electrónicos offline v2.34).
// Port de Domo.Firma.Core/Modelo/Catalogos.cs.

import type { Regimen, TarifaIva, TipoIdentificacion } from "./comprobante.ts";

/** Código de impuesto IVA en `totalImpuesto/codigo` e `impuesto/codigo`. */
export const CODIGO_IMPUESTO_IVA = "2";

/** Tarifas de IVA vigentes (Tabla 17, p. 30). Clave: `codigoPorcentaje`. */
export const TARIFAS_IVA: Record<string, TarifaIva> = {
  "0": { codigoPorcentaje: "0", porcentaje: "0", descripcion: "IVA 0 %" },
  "4": { codigoPorcentaje: "4", porcentaje: "15", descripcion: "IVA 15 %" },
  "5": { codigoPorcentaje: "5", porcentaje: "5", descripcion: "IVA 5 %" },
  "6": { codigoPorcentaje: "6", porcentaje: "0", descripcion: "No objeto de IVA" },
  "7": { codigoPorcentaje: "7", porcentaje: "0", descripcion: "Exento de IVA" },
  "10": { codigoPorcentaje: "10", porcentaje: "13", descripcion: "IVA 13 %" },
};

/** Formas de pago (Tabla 24). */
export const FORMAS_PAGO: Record<string, string> = {
  "01": "SIN UTILIZACIÓN DEL SISTEMA FINANCIERO",
  "15": "COMPENSACIÓN DE DEUDAS",
  "16": "TARJETA DE DÉBITO",
  "17": "DINERO ELECTRÓNICO",
  "18": "TARJETA PREPAGO",
  "19": "TARJETA DE CRÉDITO",
  "20": "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
  "21": "ENDOSO DE TÍTULOS",
};

/** Tipos de identificación del comprador (Tabla 6). */
export const TIPOS_IDENTIFICACION: Record<TipoIdentificacion, string> = {
  "04": "RUC",
  "05": "Cédula",
  "06": "Pasaporte",
  "07": "Consumidor final",
  "08": "Identificación del exterior",
};

export const IDENTIFICACION_CONSUMIDOR_FINAL = "9999999999999";

/** Tope de una factura a consumidor final (ficha técnica p. 29, num. 9.10). */
export const TOPE_CONSUMIDOR_FINAL = "50.00";

/** Leyenda obligatoria en XML y RIDE para contribuyentes del régimen RIMPE. */
export function leyendaRimpe(regimen: Regimen): string {
  switch (regimen) {
    case "RIMPE_EMPRENDEDOR":
      return "CONTRIBUYENTE RÉGIMEN RIMPE";
    case "RIMPE_NEGOCIO_POPULAR":
      return "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE";
    default:
      return "";
  }
}
