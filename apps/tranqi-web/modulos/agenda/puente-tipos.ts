import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteConToken } from "@eco/supabase/token";

/**
 * Acceso a esquemas y funciones que todavía no están en `packages/db`.
 *
 * `Database` sale de `supabase gen types typescript` contra la base real
 * (01-convenciones §5: los tipos de fila se generan, nunca se escriben a mano).
 * Hoy esos tipos no incluyen `comun_agenda`, `comun_comercio` ni las columnas y
 * RPC que añaden las migraciones `20260905000001`–`20260905000008`, porque esas
 * migraciones no están aplicadas en la base de la que se generan.
 *
 * Escribir aquí los tipos de fila a mano sería justo lo que el estándar
 * prohíbe: una segunda declaración capaz de divergir del esquema real sin que
 * nadie se entere. Así que no se escribe ninguna. Se pierde el tipado de estas
 * consultas concretas —a cambio de no tener una fuente de verdad falsa— y lo
 * que importa se valida con Zod, que es lo que el mismo §5 exige para toda
 * entrada externa.
 *
 * CÓMO SE RETIRA ESTO: aplicar las migraciones, ejecutar
 * `supabase gen types typescript` sobre `packages/db/src/tipos-generados.ts`, y
 * sustituir cada `esquemaPendiente(supabase, "x")` por `supabase.schema("x")`.
 * El typecheck dirá qué quedó mal. No hay nada más que borrar: este fichero
 * desaparece entero.
 */
// El `any` del retorno es la deuda hecha explícita, y está acotada a esta
// función: sin tipos generados no hay forma de saber la forma de estas filas, y
// fingirla escribiéndola a mano es peor que admitir que no se conoce.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la deuda, explicita
export function esquemaPendiente(supabase: ClienteConToken, nombre: string): any {
  return (supabase as unknown as SupabaseClient).schema(nombre);
}
