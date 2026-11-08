// Clave de acceso de 49 dígitos (ficha técnica offline v2.34):
//   ddmmaaaa(8) + codDoc(2) + RUC(13) + ambiente(1) + establecimiento(3)
//   + punto de emisión(3) + secuencial(9) + código numérico(8) + tipo de emisión "1"(1) + DV(1)
// DV: módulo 11 con pesos 2..7 de derecha a izquierda; 11 → 0, 10 → 1.
//
// La genera fac_fn_emitir en SQL (una sola vez, antes de enviar); aquí se usa
// para comprobar que la clave guardada encaja con los datos del comprobante.

import type { Ambiente, TipoComprobante } from "./comprobante.ts";

export interface DatosClave {
  /** AAAA-MM-DD */
  fechaEmision: string;
  tipo: TipoComprobante;
  ruc: string;
  ambiente: Ambiente;
  establecimiento: string;
  puntoEmision: string;
  numero: number;
  /** 8 dígitos. */
  codigoNumerico: string;
}

export function digitoVerificador(base48: string): number {
  let suma = 0;
  let peso = 2;
  for (let i = base48.length - 1; i >= 0; i--) {
    suma += Number(base48[i]) * peso;
    peso = peso === 7 ? 2 : peso + 1;
  }
  const dv = 11 - (suma % 11);
  return dv === 11 ? 0 : dv === 10 ? 1 : dv;
}

export function generarClaveAcceso(d: DatosClave): string {
  const [anio, mes, dia] = d.fechaEmision.split("-");
  const base48 = `${dia}${mes}${anio}${d.tipo}${d.ruc}${d.ambiente}${d.establecimiento}${d.puntoEmision}` +
    `${String(d.numero).padStart(9, "0")}${d.codigoNumerico}1`;
  if (!/^\d{48}$/.test(base48)) {
    throw new Error("Datos de la clave de acceso con formato inválido");
  }
  return base48 + digitoVerificador(base48);
}

export function claveAccesoValida(clave: string): boolean {
  return /^\d{49}$/.test(clave) && digitoVerificador(clave.slice(0, 48)) === Number(clave[48]);
}

/** La clave guardada corresponde a estos datos (salvo el código numérico, que es aleatorio). */
export function claveCoincide(clave: string, d: Omit<DatosClave, "codigoNumerico">): boolean {
  if (!claveAccesoValida(clave)) return false;
  return generarClaveAcceso({ ...d, codigoNumerico: clave.slice(39, 47) }) === clave;
}
