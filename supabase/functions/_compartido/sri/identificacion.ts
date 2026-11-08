// Validación de identificaciones del comprador según las reglas del SRI.
// Port de Domo.Firma.Sri/ValidadorIdentificacion.cs.

import { IDENTIFICACION_CONSUMIDOR_FINAL } from "./catalogos.ts";
import type { TipoIdentificacion } from "./comprobante.ts";

/**
 * Valida una cédula ecuatoriana de 10 dígitos (provincia 01..24 o 30, tercer
 * dígito 0..5 y dígito verificador módulo 10).
 */
export function cedulaValida(cedula: string): boolean {
  if (typeof cedula !== "string" || !/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provincia = Number(cedula.slice(0, 2));
  if ((provincia < 1 || provincia > 24) && provincia !== 30) {
    return false;
  }

  const tercerDigito = Number(cedula[2]);
  if (tercerDigito < 0 || tercerDigito > 5) {
    return false;
  }

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    const d = Number(cedula[i]);
    if (i % 2 === 0) {
      const p = d * 2;
      suma += p >= 10 ? p - 9 : p;
    } else {
      suma += d;
    }
  }

  const resto = suma % 10;
  const dvEsperado = (10 - resto) % 10;
  const dvReal = Number(cedula[9]);

  return dvEsperado === dvReal;
}

function rucValido(ruc: string): { valida: boolean; motivo: string | null } {
  if (!/^\d{13}$/.test(ruc)) {
    return { valida: false, motivo: "El RUC debe tener 13 dígitos numéricos" };
  }
  if (!ruc.endsWith("001")) {
    return { valida: false, motivo: "El RUC debe terminar en 001" };
  }
  const tercerDigito = Number(ruc[2]);
  if (tercerDigito < 6) {
    return cedulaValida(ruc.slice(0, 10))
      ? { valida: true, motivo: null }
      : { valida: false, motivo: "La cédula base del RUC de persona natural no es válida" };
  }
  if (tercerDigito === 6 || tercerDigito === 9) {
    return { valida: true, motivo: null };
  }
  return { valida: false, motivo: "Tercer dígito de RUC no válido" };
}

/**
 * Valida una identificación según su código SRI (Tabla 6):
 * 04 RUC, 05 cédula, 06 pasaporte, 07 consumidor final, 08 exterior.
 */
export function validarIdentificacion(
  tipo: TipoIdentificacion,
  identificacion: string,
): { valida: boolean; motivo: string | null } {
  if (!tipo || !identificacion) {
    return { valida: false, motivo: "El tipo de identificación y el número son obligatorios" };
  }

  switch (tipo) {
    case "05":
      return cedulaValida(identificacion)
        ? { valida: true, motivo: null }
        : { valida: false, motivo: "Cédula inválida" };
    case "04":
      return rucValido(identificacion);
    case "07":
      return identificacion === IDENTIFICACION_CONSUMIDOR_FINAL
        ? { valida: true, motivo: null }
        : { valida: false, motivo: "Identificación de consumidor final inválida" };
    case "06":
    case "08":
      return identificacion.length >= 1 && identificacion.length <= 20
        ? { valida: true, motivo: null }
        : { valida: false, motivo: "La identificación debe tener entre 1 y 20 caracteres" };
    default:
      return { valida: false, motivo: "Tipo de identificación desconocido" };
  }
}
