import { crearClienteAdmin } from "@eco/supabase/servidor";

// Trazas de ejecución de flujos (comun_auditoria.aud_traza, TRQ-039).
//
// Cada paso de un flujo (preparar pago, abrir PLUX, confirmar, webhook...)
// deja una fila con la misma `correlacion`, y así se ve dónde se quedó uno que
// no terminó. Solo servidor: escribe con el cliente admin. Desde el navegador se
// usa registrarTrazaClienteAction.
//
// Nunca lanza: una traza que falla no puede tumbar el flujo que observa. Si no
// hay clave de servicio (local sin .env) queda solo la línea de consola, que
// también llega a los logs de Vercel.

export type NivelTraza = "INFO" | "AVISO" | "ERROR";
export type OrigenTraza = "CLIENTE" | "SERVIDOR" | "WEBHOOK";

export interface Traza {
  flujo: string;
  paso: string;
  nivel?: NivelTraza;
  origen?: OrigenTraza;
  negocio?: string | null;
  correlacion?: string | null;
  duracionMs?: number | null;
  mensaje?: string | null;
  usuarioId?: string | null;
  detalle?: Record<string, unknown>;
}

const MAX_MENSAJE = 1000;
const MAX_DETALLE = 8000;
// Datos que no deben quedar en una traza aunque vengan en una respuesta de
// pasarela: número de tarjeta, CVV, secretos y cabeceras de autenticación.
const CLAVE_SENSIBLE = /^(pan|cvv|cvc|cvv2|jwt)$|card_?number|numero_?tarjeta|password|contrasena|clave_secreta|secret|authorization|authentication|service.?role|api_?key|cookie|bearer|private_?key|access_?token|refresh_?token/i;
const MAX_INT = 2_147_483_647;

function limpiar(valor: unknown, profundidad = 0): unknown {
  if (valor === null || valor === undefined) return valor ?? null;
  if (typeof valor === "string") return valor.length > 500 ? `${valor.slice(0, 500)}…` : valor;
  if (typeof valor === "bigint") return valor.toString();
  if (typeof valor === "function" || typeof valor === "symbol") return String(valor);
  if (typeof valor !== "object") return valor;
  if (profundidad >= 4) return "[…]";
  if (valor instanceof Error) return { nombre: valor.name, mensaje: valor.message };
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => limpiar(v, profundidad + 1));
  const salida: Record<string, unknown> = {};
  for (const k of Object.keys(valor).slice(0, 50)) {
    try {
      salida[k] = CLAVE_SENSIBLE.test(k) ? "[oculto]" : limpiar((valor as Record<string, unknown>)[k], profundidad + 1);
    } catch {
      salida[k] = "[ilegible]";
    }
  }
  return salida;
}

export function detalleSeguro(detalle: unknown, max = MAX_DETALLE): Record<string, unknown> {
  try {
    const limpio = limpiar(detalle ?? {});
    const objeto = limpio && typeof limpio === "object" && !Array.isArray(limpio) ? limpio : { valor: limpio };
    const texto = JSON.stringify(objeto);
    return texto.length > max ? { recortado: true, inicio: texto.slice(0, max) } : (objeto as Record<string, unknown>);
  } catch {
    return { ilegible: true };
  }
}

/** Mensaje legible de cualquier cosa capturada en un catch. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export async function registrarTraza(t: Traza): Promise<void> {
  try {
    await guardarTraza(t);
  } catch (e) {
    console.error("registrarTraza: fallo inesperado", mensajeDeError(e));
  }
}

async function guardarTraza(t: Traza): Promise<void> {
  const nivel = t.nivel ?? "INFO";
  const duracion = typeof t.duracionMs === "number" && Number.isFinite(t.duracionMs) ? Math.round(t.duracionMs) : null;
  const fila = {
    tra_negocio: t.negocio ? String(t.negocio).slice(0, 30) : null,
    tra_flujo: String(t.flujo).slice(0, 60),
    tra_paso: String(t.paso).slice(0, 100),
    tra_nivel: nivel,
    tra_origen: t.origen ?? "SERVIDOR",
    tra_correlacion: t.correlacion ? String(t.correlacion).slice(0, 80) : null,
    tra_duracion_ms: duracion === null ? null : Math.min(Math.max(duracion, 0), MAX_INT),
    tra_mensaje: t.mensaje ? String(t.mensaje).slice(0, MAX_MENSAJE) : null,
    tra_usuario_id: t.usuarioId ?? null,
    tra_detalle_traza: detalleSeguro(t.detalle),
  };

  const linea = JSON.stringify({ traza: `${fila.tra_flujo}.${fila.tra_paso}`, ...fila });
  if (nivel === "ERROR") console.error(linea);
  else if (nivel === "AVISO") console.warn(linea);
  else console.log(linea);

  const admin: any = crearClienteAdmin();
  if (!admin) return;
  const { error } = await admin.schema("comun_auditoria").from("aud_traza").insert(fila);
  if (error) console.error("registrarTraza: no se pudo guardar", error.message);
}

/**
 * Cronómetro para trazas con duración:
 *   const fin = cronometro(); ...; await registrarTraza({ ..., duracionMs: fin() })
 */
export function cronometro(): () => number {
  const inicio = Date.now();
  return () => Date.now() - inicio;
}
