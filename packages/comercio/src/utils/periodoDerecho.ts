/** Periodo de los cupos de un plan (TRQ-022).
 *
 *  Misma regla que `comun_comercio.com_fn_periodo_derecho` en la base
 *  (migración 20261114000001): si el derecho o la suscripción son ANUALES, el
 *  ciclo empieza en el aniversario de la compra; si no, en el mes calendario.
 *  Todo en UTC, como la base. */

export interface SuscripcionParaPeriodo {
  sub_creado_en?: string | null;
  sub_frecuencia?: string | null;
  sub_proximo_cobro_en?: string | null;
}

export interface DerechoParaPeriodo {
  periodo?: string | null;
}

function aFechaUtc(valor: string | Date): Date {
  const d = typeof valor === "string" ? new Date(valor) : valor;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function aTexto(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Suma años conservando el día; el 29-feb cae en el 28-feb (como `+ interval '1 year'`). */
function sumarAnios(d: Date, anios: number): Date {
  const anio = d.getUTCFullYear() + anios;
  const ultimoDia = new Date(Date.UTC(anio, d.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, d.getUTCMonth(), Math.min(d.getUTCDate(), ultimoDia)));
}

function aniosCumplidos(desde: Date, hasta: Date): number {
  let n = hasta.getUTCFullYear() - desde.getUTCFullYear();
  if (sumarAnios(desde, n) > hasta) n -= 1;
  return Math.max(0, n);
}

/** Frecuencia que manda para un derecho: la suya, o la de la suscripción. */
export function frecuenciaDerecho(sub: SuscripcionParaPeriodo, derecho?: DerechoParaPeriodo | null): string {
  return (String(derecho?.periodo ?? "").trim() || String(sub.sub_frecuencia ?? "").trim() || "MENSUAL").toUpperCase();
}

/** Inicio del periodo vigente (`YYYY-MM-DD`): el valor de `der_periodo`. */
export function periodoDerecho(
  sub: SuscripcionParaPeriodo,
  derecho?: DerechoParaPeriodo | null,
  hoy: Date = new Date(),
): string {
  const dia = aFechaUtc(hoy);
  if (frecuenciaDerecho(sub, derecho) === "ANUAL" && sub.sub_creado_en) {
    const inicio = aFechaUtc(sub.sub_creado_en);
    if (dia >= inicio) return aTexto(sumarAnios(inicio, aniosCumplidos(inicio, dia)));
  }
  return aTexto(new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), 1)));
}

/** Mediodía UTC: el día no cambia al mostrarlo en Ecuador (UTC-5) ni en el servidor. */
function aMediodia(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
}

/** Próxima renovación de la suscripción: el próximo cobro si se conoce; si
 *  no, el siguiente aniversario (ANUAL) o el mismo día del mes siguiente.
 *  Las fechas calculadas van a mediodía UTC para que el día no se corra. */
export function fechaRenovacionSuscripcion(sub: SuscripcionParaPeriodo, hoy: Date = new Date()): Date {
  if (sub.sub_proximo_cobro_en) {
    const proximo = new Date(sub.sub_proximo_cobro_en);
    if (!Number.isNaN(proximo.getTime())) return proximo;
  }
  const dia = aFechaUtc(hoy);
  const inicio = sub.sub_creado_en ? aFechaUtc(sub.sub_creado_en) : dia;
  if (String(sub.sub_frecuencia || "").toUpperCase() === "ANUAL") {
    return aMediodia(sumarAnios(inicio, aniosCumplidos(inicio, dia) + 1));
  }
  let meses = (dia.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + dia.getUTCMonth() - inicio.getUTCMonth();
  const enMes = (m: number) => {
    const ultimo = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + m, Math.min(inicio.getUTCDate(), ultimo)));
  };
  meses = Math.max(meses, 0);
  while (enMes(meses) <= dia) meses += 1;
  return aMediodia(enMes(meses));
}
