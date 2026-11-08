// Aritmética decimal exacta sobre cadenas mediante BigInt escalado.
//
// Por qué: el estándar del repositorio prohíbe usar `number` para importes y
// cantidades. El SRI admite hasta 6 decimales en cantidad/precio y exige
// redondeo half-up (mitad alejándose de cero) a 2 decimales en bases e IVA.

export interface DecimalEscalado {
  valor: bigint;
  escala: number;
}

const PATRON_DECIMAL = /^-?\d+(\.\d+)?$/;

/** Parsea una cadena decimal ("12.5", "0.333333", "3") a entero escalado. */
export function parsearDecimal(texto: string): DecimalEscalado {
  if (typeof texto !== "string" || !PATRON_DECIMAL.test(texto)) {
    throw new Error(`Valor decimal inválido: "${texto}"`);
  }
  const negativo = texto.startsWith("-");
  const sinSigno = negativo ? texto.slice(1) : texto;
  const punto = sinSigno.indexOf(".");
  const entera = punto === -1 ? sinSigno : sinSigno.slice(0, punto);
  const fraccion = punto === -1 ? "" : sinSigno.slice(punto + 1);
  const magnitud = BigInt(entera + fraccion);
  return {
    valor: negativo && magnitud !== 0n ? -magnitud : magnitud,
    escala: fraccion.length,
  };
}

function potencia10(exponente: number): bigint {
  return 10n ** BigInt(exponente);
}

function alinear(a: DecimalEscalado, b: DecimalEscalado): { va: bigint; vb: bigint; escala: number } {
  const escala = Math.max(a.escala, b.escala);
  return {
    va: a.valor * potencia10(escala - a.escala),
    vb: b.valor * potencia10(escala - b.escala),
    escala,
  };
}

/** Convierte un DecimalEscalado a cadena conservando su escala exacta. */
export function aCadena(d: DecimalEscalado): string {
  if (d.valor === 0n) {
    return d.escala === 0 ? "0" : "0." + "0".repeat(d.escala);
  }
  const signo = d.valor < 0n ? "-" : "";
  const abs = (d.valor < 0n ? -d.valor : d.valor).toString();
  if (d.escala === 0) {
    return signo + abs;
  }
  const relleno = abs.padStart(d.escala + 1, "0");
  const corte = relleno.length - d.escala;
  return `${signo}${relleno.slice(0, corte)}.${relleno.slice(corte)}`;
}

/** Suma exacta de dos cadenas decimales. */
export function sumar(a: string, b: string): string {
  const { va, vb, escala } = alinear(parsearDecimal(a), parsearDecimal(b));
  return aCadena({ valor: va + vb, escala });
}

/** Resta exacta (a - b) de dos cadenas decimales. */
export function restar(a: string, b: string): string {
  const { va, vb, escala } = alinear(parsearDecimal(a), parsearDecimal(b));
  return aCadena({ valor: va - vb, escala });
}

/** Multiplicación exacta de dos cadenas decimales. */
export function multiplicar(a: string, b: string): string {
  const da = parsearDecimal(a);
  const db = parsearDecimal(b);
  return aCadena({
    valor: da.valor * db.valor,
    escala: da.escala + db.escala,
  });
}

/** División exacta por 100 (desplaza la coma 2 posiciones sin perder precisión). */
export function dividirPor100(x: string): string {
  const d = parsearDecimal(x);
  return aCadena({ valor: d.valor, escala: d.escala + 2 });
}

/** Compara dos cadenas decimales: -1 si a < b, 0 si a == b, 1 si a > b. */
export function comparar(a: string, b: string): -1 | 0 | 1 {
  const { va, vb } = alinear(parsearDecimal(a), parsearDecimal(b));
  return va < vb ? -1 : va > vb ? 1 : 0;
}

function redondearEscalado(d: DecimalEscalado, decimales: number): DecimalEscalado {
  if (!Number.isInteger(decimales) || decimales < 0) {
    throw new Error(`Número de decimales inválido: ${decimales}`);
  }
  if (d.escala <= decimales) {
    return {
      valor: d.valor * potencia10(decimales - d.escala),
      escala: decimales,
    };
  }
  const diferencia = d.escala - decimales;
  const divisor = potencia10(diferencia);
  const mitad = divisor / 2n;
  const signo = d.valor < 0n ? -1n : 1n;
  const abs = d.valor < 0n ? -d.valor : d.valor;
  const cociente = abs / divisor;
  const resto = abs % divisor;
  const redondeado = resto >= mitad ? cociente + 1n : cociente;
  return {
    valor: signo * redondeado,
    escala: decimales,
  };
}

/** Redondeo half-up (mitad alejándose de cero) a `decimales` posiciones fijas. */
export function redondearMitadArriba(x: string, decimales: number): string {
  return aCadena(redondearEscalado(parsearDecimal(x), decimales));
}

/** Formatea con exactamente N decimales fijos (redondeando half-up si tiene más). */
export function formatearFijo(x: string, decimales: number): string {
  return redondearMitadArriba(x, decimales);
}

/** Formatea un importe monetario a 2 decimales fijos ("10.00"). */
export function formatearImporte(x: string): string {
  return redondearMitadArriba(x, 2);
}

/**
 * Formato C# "0.00####": mínimo 2 decimales y hasta 6 decimales, eliminando
 * ceros finales más allá del segundo decimal.
 */
export function formatearCantidadPrecio(x: string): string {
  const seis = redondearMitadArriba(x, 6);
  const [entera, fraccion] = seis.split(".");
  const sinCerosExtra = fraccion.slice(0, 2) + fraccion.slice(2).replace(/0+$/, "");
  return `${entera}.${sinCerosExtra}`;
}

/**
 * Formato C# "0.##": hasta 2 decimales, sin ceros decimales superfluos
 * ("15.00" -> "15", "0.00" -> "0", "12.50" -> "12.5").
 */
export function formatearTarifa(x: string): string {
  const dos = redondearMitadArriba(x, 2);
  return dos.replace(/\.?0+$/, "");
}

// Alias en inglés según el enunciado de especificación.
export const parse = parsearDecimal;
export const add = sumar;
export const sub = restar;
export const mul = multiplicar;
export const compare = comparar;
export const roundHalfUp = redondearMitadArriba;
export const formatFixed = formatearFijo;
export const format2To6 = formatearCantidadPrecio;
