import { crearClienteServidor } from "@eco/supabase/servidor";

// El negocio va dentro de un filtro .or() de PostgREST: solo identificadores simples.
const RE_NEGOCIO = /^[a-z0-9_-]{1,30}$/;
function filtroNegocio(negocio: string | undefined): string | null {
  return negocio && RE_NEGOCIO.test(negocio) ? `tra_negocio.eq.${negocio},tra_negocio.is.null` : null;
}

// Lectura de comun_auditoria.aud_traza (TRQ-040). Con el cliente del usuario:
// la RLS solo deja ver filas al superadmin de plataforma.

export interface ResumenTraza {
  tra_flujo: string;
  tra_negocio: string | null;
  tra_correlacion: string;
  inicio: string;
  fin: string;
  pasos: number;
  errores: number;
  ultimo_paso: string;
  ultimo_nivel: "INFO" | "AVISO" | "ERROR";
  ultimo_problema: string | null;
}

export interface FilaTraza {
  tra_id: string;
  tra_negocio: string | null;
  tra_flujo: string;
  tra_paso: string;
  tra_nivel: "INFO" | "AVISO" | "ERROR";
  tra_origen: "CLIENTE" | "SERVIDOR" | "WEBHOOK";
  tra_correlacion: string | null;
  tra_duracion_ms: number | null;
  tra_mensaje: string | null;
  tra_detalle_traza: Record<string, unknown>;
  tra_creado_en: string;
}

export async function listarResumenTrazas(filtros: {
  negocio?: string;
  flujo?: string;
  desde?: string;
  soloProblemas?: boolean;
  limite?: number;
}): Promise<{ data: ResumenTraza[]; error: string | null }> {
  const supabase: any = await crearClienteServidor();
  let q = supabase
    .schema("comun_auditoria")
    .from("aud_v_traza_resumen")
    .select("*")
    .order("fin", { ascending: false })
    .limit(filtros.limite ?? 100);
  if (filtros.negocio) q = q.eq("tra_negocio", filtros.negocio);
  if (filtros.flujo) q = q.eq("tra_flujo", filtros.flujo);
  if (filtros.desde) q = q.gte("fin", filtros.desde);
  if (filtros.soloProblemas) q = q.neq("ultimo_nivel", "INFO");
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as ResumenTraza[], error: null };
}

export async function listarTrazasDeCorrelacion(correlacion: string): Promise<{ data: FilaTraza[]; error: string | null }> {
  const supabase: any = await crearClienteServidor();
  const { data, error } = await supabase
    .schema("comun_auditoria")
    .from("aud_traza")
    .select("tra_id, tra_negocio, tra_flujo, tra_paso, tra_nivel, tra_origen, tra_correlacion, tra_duracion_ms, tra_mensaje, tra_detalle_traza, tra_creado_en")
    .eq("tra_correlacion", correlacion)
    .order("tra_creado_en", { ascending: true })
    .limit(200);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as FilaTraza[], error: null };
}

export interface FrecuenciaTraza {
  tra_flujo: string;
  tra_negocio: string | null;
  tra_nivel: "AVISO" | "ERROR";
  tra_paso: string;
  mensaje: string;
  veces: number;
  correlaciones: number;
  primera: string;
  ultima: string;
  ultima_ruta: string | null;
}

/** Avisos y errores de los últimos 7 días agrupados por paso y mensaje. */
export async function listarFrecuenciaTrazas(filtros: { negocio?: string; flujo?: string; limite?: number }): Promise<{ data: FrecuenciaTraza[]; error: string | null }> {
  const supabase: any = await crearClienteServidor();
  let q = supabase
    .schema("comun_auditoria")
    .from("aud_v_traza_frecuente")
    .select("*")
    .order("veces", { ascending: false })
    .limit(filtros.limite ?? 50);
  const porNegocio = filtroNegocio(filtros.negocio);
  if (porNegocio) q = q.or(porNegocio);
  if (filtros.flujo) q = q.eq("tra_flujo", filtros.flujo);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as FrecuenciaTraza[], error: null };
}

/** Últimas trazas de un flujo, una por fila. */
export async function listarUltimasTrazas(filtros: {
  negocio?: string;
  flujo?: string;
  desde?: string;
  soloProblemas?: boolean;
  limite?: number;
}): Promise<{ data: FilaTraza[]; error: string | null }> {
  const supabase: any = await crearClienteServidor();
  let q = supabase
    .schema("comun_auditoria")
    .from("aud_traza")
    .select("tra_id, tra_negocio, tra_flujo, tra_paso, tra_nivel, tra_origen, tra_correlacion, tra_duracion_ms, tra_mensaje, tra_detalle_traza, tra_creado_en")
    .order("tra_creado_en", { ascending: false })
    .limit(filtros.limite ?? 100);
  const porNegocio = filtroNegocio(filtros.negocio);
  if (porNegocio) q = q.or(porNegocio);
  if (filtros.flujo) q = q.eq("tra_flujo", filtros.flujo);
  if (filtros.desde) q = q.gte("tra_creado_en", filtros.desde);
  if (filtros.soloProblemas) q = q.neq("tra_nivel", "INFO");
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as FilaTraza[], error: null };
}

/** Errores sin correlación (p. ej. el webhook rechazado antes de leer el cuerpo). */
export async function listarErroresSueltos(filtros: { negocio?: string; flujo?: string; limite?: number }): Promise<{ data: FilaTraza[]; error: string | null }> {
  const supabase: any = await crearClienteServidor();
  let q = supabase
    .schema("comun_auditoria")
    .from("aud_traza")
    .select("tra_id, tra_negocio, tra_flujo, tra_paso, tra_nivel, tra_origen, tra_correlacion, tra_duracion_ms, tra_mensaje, tra_detalle_traza, tra_creado_en")
    .is("tra_correlacion", null)
    .neq("tra_nivel", "INFO")
    .order("tra_creado_en", { ascending: false })
    .limit(filtros.limite ?? 30);
  // Negocio nulo también: el webhook que llega sin ?negocio= no sabe de quién es.
  const porNegocio = filtroNegocio(filtros.negocio);
  if (porNegocio) q = q.or(porNegocio);
  if (filtros.flujo) q = q.eq("tra_flujo", filtros.flujo);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as FilaTraza[], error: null };
}
