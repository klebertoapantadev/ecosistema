import { crearClienteServidor } from "@eco/supabase/servidor";
import { esquemaPendiente } from "./puente-tipos";

// Server-only. No importar desde un client component.
//
// Todo lo que sale de aquí pasa por RLS con la sesión del usuario: no hay
// service_role en este módulo. Los huecos de un tercero se piden por RPC
// `security definer`, que devuelve solo horas libres y nunca el detalle de lo
// ocupado (PLT-020 regla 6).

const NEGOCIO = "tranqi";

export interface HuecoDisponible {
  hueco_inicio: string;
  hueco_fin: string;
  disponibles: number;
}

export interface CitaResumen {
  cit_id: string;
  cit_inicio_en: string;
  cit_fin_en: string | null;
  cit_modalidad: string;
  cit_estado: string;
  cit_motivo: string | null;
  cit_enlace: string | null;
  cit_lugar: string | null;
  cit_cobertura: string;
  cit_asignacion: string;
  cit_abogado_id: string | null;
}

export async function listarMateriasAgendables() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_materia")
    .select("mat_id, mat_nombre")
    .eq("mat_activa", true)
    .order("mat_nombre");
  return data ?? [];
}

/** Servicios del catálogo que se pueden agendar: los que declaran duración. */
export async function listarServiciosAgendables() {
  const supabase = await crearClienteServidor();
  const { data } = await esquemaPendiente(supabase, "comun_comercio")
    .from("com_variante")
    .select("var_id, var_sku, var_nombre, var_precio, var_tarifa_iva_porcentaje, var_detalle_variante")
    .eq("var_negocio", NEGOCIO)
    .eq("var_activo", true)
    .eq("var_tipo_oferta", "UNICO")
    .is("var_eliminado_en", null)
    .order("var_precio");

  return ((data ?? []) as Array<{
    var_id: string;
    var_sku: string;
    var_nombre: string;
    var_precio: string;
    var_tarifa_iva_porcentaje: string;
    var_detalle_variante: Record<string, unknown> | null;
  }>).filter((v) => typeof v.var_detalle_variante?.duracion_min === "number");
}

export async function obtenerHuecosDeMateria(
  materiaId: string,
  desde: Date,
  hasta: Date,
  varianteId?: string | null,
  modalidad?: string | null,
): Promise<HuecoDisponible[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await esquemaPendiente(supabase, "tranqui_legal").rpc("trq_fn_horarios_materia", {
    p_materia_id: materiaId,
    p_desde: desde.toISOString(),
    p_hasta: hasta.toISOString(),
    p_variante_id: varianteId ?? null,
    p_modalidad: modalidad ?? null,
    p_provincia_id: null,
  });
  if (error) return [];
  return (data ?? []) as HuecoDisponible[];
}

/** Qué le cubre el plan al usuario en sesión este periodo. */
export async function obtenerCobertura() {
  const supabase = await crearClienteServidor();
  const { data } = await esquemaPendiente(supabase, "comun_comercio").rpc("com_fn_cobertura_usuario", {
    p_negocio: NEGOCIO,
  });
  return (data ?? []) as Array<{
    suscripcion_id: string;
    plan_nombre: string;
    concepto: string;
    incluidos: number | null;
    consumidos: number;
    restantes: number | null;
  }>;
}

export async function listarCitasDelCliente(soloFuturas = false): Promise<CitaResumen[]> {
  const supabase = await crearClienteServidor();
  let consulta = esquemaPendiente(supabase, "tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, " +
        "cit_enlace, cit_lugar, cit_cobertura, cit_asignacion, cit_abogado_id",
    )
    .is("cit_eliminado_en", null)
    .order("cit_inicio_en", { ascending: false })
    .limit(50);
  if (soloFuturas) consulta = consulta.gte("cit_inicio_en", new Date().toISOString());
  const { data } = await consulta;
  return (data ?? []) as CitaResumen[];
}

/**
 * Agenda del abogado en sesión. RLS ya la acota a lo suyo: aquí no se filtra
 * por abogado, porque hacerlo a mano invitaría a olvidarlo en la siguiente
 * consulta y a creer que el filtro de la aplicación es la protección.
 */
export async function listarAgendaDelAbogado(desde: Date, hasta: Date): Promise<CitaResumen[]> {
  const supabase = await crearClienteServidor();
  const { data } = await esquemaPendiente(supabase, "tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, " +
        "cit_enlace, cit_lugar, cit_cobertura, cit_asignacion, cit_abogado_id",
    )
    .is("cit_eliminado_en", null)
    .gte("cit_inicio_en", desde.toISOString())
    .lt("cit_inicio_en", hasta.toISOString())
    .neq("cit_estado", "cancelada")
    .order("cit_inicio_en");
  return (data ?? []) as CitaResumen[];
}

/** Configuración de agenda del profesional en sesión, o null si no la ha creado. */
export async function obtenerMiAgenda() {
  const supabase = await crearClienteServidor();
  const { data: prof } = await esquemaPendiente(supabase, "comun_agenda")
    .from("age_profesional")
    .select("*")
    .eq("agp_negocio", NEGOCIO)
    .is("agp_eliminado_en", null)
    .maybeSingle();
  if (!prof) return null;

  const { data: franjas } = await esquemaPendiente(supabase, "comun_agenda")
    .from("age_franja")
    .select("fra_id, fra_dia_semana, fra_hora_inicio, fra_hora_fin, fra_modalidad")
    .eq("fra_profesional_id", prof.agp_id)
    .is("fra_eliminado_en", null)
    .order("fra_dia_semana")
    .order("fra_hora_inicio");

  const { data: bloqueos } = await esquemaPendiente(supabase, "comun_agenda")
    .from("age_bloqueo")
    .select("blq_id, blq_inicio_en, blq_fin_en, blq_motivo, blq_origen")
    .eq("blq_profesional_id", prof.agp_id)
    .is("blq_eliminado_en", null)
    .gte("blq_fin_en", new Date().toISOString())
    .order("blq_inicio_en");

  return { profesional: prof, franjas: franjas ?? [], bloqueos: bloqueos ?? [] };
}

/**
 * Cola de contingencia del operador: citas vivas que se quedaron sin abogado
 * porque el asignado canceló. No es una lista informativa — cada fila es un
 * cliente que llegará a su hora y no encontrará a nadie.
 */
export async function listarCitasEnContingencia(): Promise<CitaResumen[]> {
  const supabase = await crearClienteServidor();
  const { data } = await esquemaPendiente(supabase, "tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, " +
        "cit_enlace, cit_lugar, cit_cobertura, cit_asignacion, cit_abogado_id",
    )
    .eq("cit_asignacion", "contingencia")
    .is("cit_eliminado_en", null)
    .gte("cit_inicio_en", new Date().toISOString())
    .order("cit_inicio_en");
  return (data ?? []) as CitaResumen[];
}

/**
 * Abogados verificados con agenda configurada, para la mesa de reasignación.
 * Solo lo ve el staff: RLS de trq_abogado ya restringe la lectura a admins.
 */
export async function listarAbogadosAsignables() {
  const supabase = await crearClienteServidor();
  const { data } = await esquemaPendiente(supabase, "tranqui_legal")
    .from("trq_abogado")
    .select("abg_id, abg_usuario_id, seg_usuario:abg_usuario_id (usu_nombres, usu_apellidos)")
    .eq("abg_estado", "verificado");

  return ((data ?? []) as Array<{
    abg_id: string;
    seg_usuario: { usu_nombres: string | null; usu_apellidos: string | null } | null;
  }>).map((a) => ({
    abg_id: a.abg_id,
    nombre:
      [a.seg_usuario?.usu_nombres, a.seg_usuario?.usu_apellidos].filter(Boolean).join(" ") || "Abogado sin nombre",
  }));
}
