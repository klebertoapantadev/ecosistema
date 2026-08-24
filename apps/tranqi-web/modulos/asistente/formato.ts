// Como se le presentan los datos al modelo.
//
// Texto compacto en vez de JSON crudo, por dos razones medidas en ARIA: el
// JSON.stringify por defecto escapa los acentos (é) y el modelo los acaba
// reproduciendo literales en su respuesta, y ademas las llaves y comillas son
// tokens que se pagan en cada turno sin aportar nada.

const ZONA_ECUADOR = "America/Guayaquil";

/** Fecha y hora legibles en hora de Ecuador continental, que es la referencia del producto. */
export function fechaHoraEcuador(iso: string | null): string {
  if (!iso) return "sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: ZONA_ECUADOR,
  }).format(new Date(iso));
}

export function fechaEcuador(iso: string | null): string {
  if (!iso) return "sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "long",
    timeZone: ZONA_ECUADOR,
  }).format(new Date(iso));
}

export function dinero(monto: number | string, moneda = "USD"): string {
  const valor = typeof monto === "string" ? Number(monto) : monto;
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: moneda }).format(valor);
}

/**
 * Renderiza una lista para el modelo.
 *
 * Cuando no hay nada devuelve el texto de `vacio`, nunca una lista vacia: "no
 * tienes citas agendadas" es una respuesta util, y `[]` invita al modelo a
 * inventarse por que.
 */
export function lista<T>(
  titulo: string,
  filas: T[] | null,
  vacio: string,
  render: (fila: T, indice: number) => string,
): string {
  if (!filas || filas.length === 0) return vacio;
  const cuerpo = filas.map((f, i) => render(f, i)).join("\n");
  return `${titulo} (${filas.length}):\n${cuerpo}`;
}

/** Une pares etiqueta/valor omitiendo los vacios, para no mostrar "sin datos" en cadena. */
export function campos(pares: Array<[string, unknown]>): string {
  return pares
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
    .map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)
    .join(" · ");
}
