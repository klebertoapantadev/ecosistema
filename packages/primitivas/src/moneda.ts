/**
 * Utilidades canónicas para el manejo monetario del ecosistema.
 * Cumple con el estándar de gobernanza: gobernanza/estandares/05-manejo-monetario-y-valores.md
 * 
 * Principio: Todo importe se calcula, almacena y transmite como número ENTERO en CENTAVOS de USD.
 */

/**
 * Convierte un importe en dólares (número decimal o string) a centavos enteros.
 * Ejemplos:
 *  35.50 -> 3550
 *  "35.50" -> 3550
 *  "35,50" -> 3550
 *  "$ 1.250,50" -> 125050
 */
export function aCentavos(valor: number | string): number {
  if (typeof valor === "number") {
    if (isNaN(valor) || !isFinite(valor)) return 0;
    return Math.round(valor * 100);
  }

  return parsearInputMoneda(valor);
}

/**
 * Convierte centavos enteros a dólares en número decimal (para APIs externas que lo requieran).
 * Ejemplo: 3550 -> 35.5
 */
export function aDolares(centavos: number): number {
  if (isNaN(centavos) || !isFinite(centavos)) return 0;
  return Math.round(centavos) / 100;
}

/**
 * Formatea un monto en centavos como texto monetario en dólares estadounidenses para la UI.
 * Ejemplo: 3550 -> "$ 35,00" o "$35.00" según locale.
 */
export function formatearUSD(centavos: number, locale: string = "es-EC"): string {
  const dolares = aDolares(centavos);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dolares);
}

/**
 * Limpia y procesa cualquier texto ingresado por el usuario (tolerante a comas, puntos y símbolos).
 * Retorna siempre centavos enteros.
 */
export function parsearInputMoneda(input: string): number {
  if (!input || typeof input !== "string") return 0;

  // Eliminar espacios, signos de dólar y letras
  let limpio = input.trim().replace(/[$\s]/g, "");
  if (!limpio) return 0;

  // Manejar separadores: si tiene coma y punto (ej "1.250,50" o "1,250.50")
  if (limpio.includes(",") && limpio.includes(".")) {
    const ultimaComa = limpio.lastIndexOf(",");
    const ultimoPunto = limpio.lastIndexOf(".");
    if (ultimaComa > ultimoPunto) {
      // Formato europeo/latino: 1.250,50 -> miles punto, decimal coma
      limpio = limpio.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato anglosajón: 1,250.50 -> miles coma, decimal punto
      limpio = limpio.replace(/,/g, "");
    }
  } else if (limpio.includes(",")) {
    // Solo tiene comas: asumimos coma decimal (ej "35,50")
    limpio = limpio.replace(",", ".");
  }

  const num = parseFloat(limpio);
  return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100);
}

/**
 * Desglosa el precio de venta al público (PVP en centavos) en Base Imponible e IVA.
 * Por defecto aplica la tarifa del 15% vigente en Ecuador.
 * Garantiza bit a bit que: baseImponibleCentavos + ivaCentavos === pvpCentavos.
 */
export function desglosarIvaDesdePvp(
  pvpCentavos: number,
  tarifaIvaPorcentaje: number = 15.0
): {
  baseImponibleCentavos: number;
  ivaCentavos: number;
  totalCentavos: number;
} {
  const pvp = Math.round(pvpCentavos);
  if (pvp <= 0) {
    return { baseImponibleCentavos: 0, ivaCentavos: 0, totalCentavos: 0 };
  }

  const factor = 1 + tarifaIvaPorcentaje / 100;
  const baseImponibleCentavos = Math.round(pvp / factor);
  const ivaCentavos = pvp - baseImponibleCentavos;

  return {
    baseImponibleCentavos,
    ivaCentavos,
    totalCentavos: pvp,
  };
}

/**
 * Suma una serie de montos en centavos de forma segura.
 */
export function sumarCentavos(...montos: number[]): number {
  return montos.reduce((acumulado, valor) => acumulado + Math.round(valor || 0), 0);
}

/**
 * Aplica un porcentaje de descuento sobre un monto en centavos con redondeo estándar.
 */
export function aplicarDescuentoPorcentaje(
  montoCentavos: number,
  porcentaje: number
): {
  descuentoCentavos: number;
  totalConDescuentoCentavos: number;
} {
  const base = Math.round(montoCentavos);
  if (base <= 0 || porcentaje <= 0) {
    return { descuentoCentavos: 0, totalConDescuentoCentavos: base };
  }

  const descuentoCentavos = Math.min(base, Math.round((base * porcentaje) / 100));
  return {
    descuentoCentavos,
    totalConDescuentoCentavos: base - descuentoCentavos,
  };
}
