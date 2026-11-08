"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";
import {
  esquemaAgendaCompleta,
  esquemaBloqueo,
  esquemaConfigNegocioAgenda,
  esquemaDecisionCita,
  esquemaReasignacion,
  esquemaReserva,
} from "./esquema";
import {
  clasificarProblemaLegalConAria,
  type MensajeTriajeAria,
  type ResultadoTriajeAria,
} from "./clasificador-aria";
import {
  listarMateriasAgendables,
  obtenerConfiguracionAgendaNegocio,
} from "./consultas";

// Mutaciones del módulo. Devuelven `{ ok }` y nunca lanzan hacia el componente
// (01-convenciones §6).
//
// Ninguna escribe directamente en las tablas: todo pasa por los RPC
// transaccionales, porque reservar implica resolver turno, cobertura y solape a
// la vez, y decidir una cita implica mover la cita y su reserva juntas. Partirlo
// en escrituras sueltas deja estados imposibles a la primera concurrencia.

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const NEGOCIO = "tranqi";

/** Los mensajes de los RPC están escritos para leerse; se pasan tal cual. */
function comoError(mensaje: string | undefined): string {
  if (!mensaje) return "No se pudo completar la operación. Vuelve a intentarlo.";
  // PostgREST antepone el contexto de la función; al usuario solo le sirve el motivo.
  return mensaje.replace(/^.*?:\s*/, "").trim() || mensaje;
}

export async function clasificarProblemaConAriaAction(
  mensajes: MensajeTriajeAria[],
): Promise<Resultado<ResultadoTriajeAria>> {
  try {
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      return { ok: false, error: "Cuéntanos brevemente tu situación para ayudarte." };
    }
    const [materias, config] = await Promise.all([
      listarMateriasAgendables(),
      obtenerConfiguracionAgendaNegocio(),
    ]);
    const resultado = await clasificarProblemaLegalConAria(
      mensajes,
      materias,
      config.materia_defecto_nombre || "Civil",
    );
    return { ok: true, data: resultado };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo analizar la consulta en este momento.",
    };
  }
}

export async function reservarCitaAction(entrada: unknown): Promise<Resultado<{ citaId: string }>> {
  const validado = esquemaReserva.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0]?.message ?? "Datos incompletos" };
  }
  const d = validado.data;

  const supabase = await crearClienteServidor();

  // Resolver materia por defecto si no vino materia_id
  let materiaId = d.materia_id ?? "";
  if (!materiaId) {
    const [materias, config] = await Promise.all([
      listarMateriasAgendables(),
      obtenerConfiguracionAgendaNegocio(),
    ]);
    const defecto =
      materias.find(
        (m) => m.mat_nombre.toLowerCase() === (config.materia_defecto_nombre || "Civil").toLowerCase(),
      ) ?? materias[0];
    materiaId = defecto?.mat_id ?? "";
  }

  // Si la variante es el fallback en memoria (no existe en BD), enviar undefined al RPC
  const esVarianteSintetica =
    d.variante_id === "00000000-0000-4000-8000-000000000101" ||
    d.variante_id === "00000000-0000-4000-8000-000000000102";

  const { data, error } = await supabase.schema("tranqui_legal").rpc(
    "trq_fn_reservar_cita" as never,
    {
      p_materia_id: materiaId,
      p_inicio_en: d.inicio_en,
      p_variante_id: esVarianteSintetica ? undefined : (d.variante_id ?? undefined),
      p_modalidad: d.modalidad,
      p_motivo: d.motivo,
      p_caso_id: d.caso_id ?? undefined,
      p_provincia_id: undefined,
      p_origen: "panel",
      p_pago_id: d.pago_id ?? undefined,
      p_confirmar_inmediato: d.confirmar_inmediato ?? Boolean(d.pago_id),
    } as never,
  );

  if (error) {
    // Fallback por si la firma de 10 argumentos aún no está desplegada en el entorno remoto
    const fallback = await supabase.schema("tranqui_legal").rpc("trq_fn_reservar_cita", {
      p_materia_id: materiaId,
      p_inicio_en: d.inicio_en,
      p_variante_id: esVarianteSintetica ? undefined : (d.variante_id ?? undefined),
      p_modalidad: d.modalidad,
      p_motivo: d.motivo,
      p_caso_id: d.caso_id ?? undefined,
      p_provincia_id: undefined,
      p_origen: "panel",
    });
    if (fallback.error) {
      return { ok: false, error: comoError(error.message) };
    }
    revalidatePath("/panel/mis-citas");
    revalidatePath("/panel/agendar");
    revalidatePath("/panel/agenda/asignaciones");
    return { ok: true, data: { citaId: fallback.data as string } };
  }

  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agendar");
  revalidatePath("/panel/agenda/asignaciones");
  return { ok: true, data: { citaId: data as string } };
}

export async function confirmarPagoCitaAction(
  citaId: string,
  pagoId: string,
): Promise<Resultado<{ estado: string }>> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.schema("tranqui_legal").rpc(
    "trq_fn_confirmar_pago_cita" as never,
    {
      p_cita_id: citaId,
      p_pago_id: pagoId,
    } as never,
  );
  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agendar");
  return { ok: true, data: { estado: (data as string) ?? "confirmada" } };
}

export async function obtenerDatosConfiguracionAgendaAction(): Promise<
  Resultado<{
    config: Awaited<ReturnType<typeof obtenerConfiguracionAgendaNegocio>>;
    materias: Awaited<ReturnType<typeof listarMateriasAgendables>>;
  }>
> {
  try {
    const [config, materias] = await Promise.all([
      obtenerConfiguracionAgendaNegocio(),
      listarMateriasAgendables(),
    ]);
    return { ok: true, data: { config, materias } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar la configuración de horarios",
    };
  }
}

export async function guardarConfiguracionAgendaNegocioAction(
  entrada: unknown,
): Promise<Resultado> {
  const validado = esquemaConfigNegocioAgenda.safeParse(entrada);
  if (!validado.success) {
    return {
      ok: false,
      error: validado.error.issues[0]?.message ?? "Revisa los horarios configurados",
    };
  }
  const d = validado.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("comun_agenda").rpc(
    "age_fn_guardar_config_negocio" as never,
    {
      p_negocio: NEGOCIO,
      p_config: {
        zona_horaria: d.zona_horaria,
        duracion_cita_min: d.duracion_cita_min,
        holgura_min: d.holgura_min,
        antelacion_minima_horas: d.antelacion_minima_horas,
        horizonte_dias: d.horizonte_dias,
        permitir_sin_profesional: d.permitir_sin_profesional,
        direccion_presencial: d.direccion_presencial ?? "",
        franjas_virtual: d.franjas_virtual,
        franjas_presencial: d.franjas_presencial,
        detalle: {
          materia_defecto_nombre: d.materia_defecto_nombre,
        },
      },
    } as never,
  );

  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agendar");
  revalidatePath("/panel/agendamiento");
  revalidatePath("/panel/agenda/asignaciones");
  revalidatePath("/panel/agenda/disponibilidad");
  return { ok: true, data: undefined };
}

export async function decidirCitaAction(entrada: unknown): Promise<Resultado<{ resultado: string }>> {
  const validado = esquemaDecisionCita.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0]?.message ?? "Datos incompletos" };
  }
  const d = validado.data;
  if (d.decision === "reagendar" && !d.nuevo_inicio) {
    return { ok: false, error: "Indica la nueva fecha y hora" };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.schema("tranqui_legal").rpc("trq_fn_decidir_cita", {
    p_cita_id: d.cita_id,
    p_decision: d.decision,
    p_nuevo_inicio: d.nuevo_inicio ?? undefined,
    p_motivo: d.motivo ?? undefined,
  });
  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agenda");
  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agenda/asignaciones");
  return { ok: true, data: { resultado: data as string } };
}

export async function reasignarCitaAction(entrada: unknown): Promise<Resultado> {
  const validado = esquemaReasignacion.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0]?.message ?? "Datos incompletos" };
  }
  const d = validado.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("tranqui_legal").rpc("trq_fn_reasignar_cita", {
    p_cita_id: d.cita_id,
    p_abogado_destino: d.abogado_destino,
    p_motivo: d.motivo ?? undefined,
  });
  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agenda/asignaciones");
  return { ok: true, data: undefined };
}

export async function guardarDisponibilidadAction(entrada: unknown): Promise<Resultado> {
  const validado = esquemaAgendaCompleta.safeParse(entrada);
  if (!validado.success) {
    // Se devuelve el primer motivo concreto ("alguna franja es más corta que
    // una cita"), no un volcado: el profesional tiene que saber qué corregir.
    return { ok: false, error: validado.error.issues[0]?.message ?? "Revisa las franjas" };
  }
  const { configuracion, franjas } = validado.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("comun_agenda").rpc("age_fn_configurar_agenda", {
    p_negocio: NEGOCIO,
    p_config: configuracion,
    p_franjas: franjas,
  });
  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agenda/disponibilidad");
  revalidatePath("/panel/agenda");
  return { ok: true, data: undefined };
}

export async function bloquearAgendaAction(entrada: unknown): Promise<Resultado> {
  const validado = esquemaBloqueo.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0]?.message ?? "Revisa las fechas" };
  }
  const d = validado.data;

  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("comun_agenda").rpc("age_fn_bloquear", {
    p_negocio: NEGOCIO,
    p_inicio: d.inicio_en,
    p_fin: d.fin_en,
    p_motivo: d.motivo ?? undefined,
    p_origen: d.es_audiencia ? "audiencia" : "manual",
  });
  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agenda/disponibilidad");
  revalidatePath("/panel/agenda");
  return { ok: true, data: undefined };
}

/**
 * Retira un bloqueo. Borrado lógico: la agenda de un profesional es un registro
 * de por qué no estuvo disponible, y eso se conserva.
 */
export async function quitarBloqueoAction(bloqueoId: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(bloqueoId)) return { ok: false, error: "Bloqueo no válido" };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("comun_agenda")
    .from("age_bloqueo")
    .update({ blq_eliminado_en: new Date().toISOString(), blq_actualizado_en: new Date().toISOString() })
    .eq("blq_id", bloqueoId);
  if (error) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agenda/disponibilidad");
  return { ok: true, data: undefined };
}
