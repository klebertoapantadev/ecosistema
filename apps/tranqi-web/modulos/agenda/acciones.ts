"use server";

import { revalidatePath } from "next/cache";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
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
  actualizarCacheConfigAgendaNegocio,
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
  // Solo retirar códigos técnicos de PostgreSQL/PostgREST (ej. "P0001: ", "ERROR: "), sin truncar frases con ":"
  return mensaje.replace(/^(ERROR|P\d{4}|PGRST\d+):\s*/i, "").trim() || mensaje;
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
  const config = await obtenerConfiguracionAgendaNegocio();

  // Resolver materia por defecto si no vino materia_id
  let materiaId = d.materia_id ?? "";
  if (!materiaId) {
    const materias = await listarMateriasAgendables();
    const defecto =
      materias.find(
        (m) => m.mat_nombre.toLowerCase() === (config.materia_defecto_nombre || "Civil").toLowerCase(),
      ) ?? materias[0];
    materiaId = defecto?.mat_id ?? "";
  }

  // Verificar reglas de fecha exacta (ej. Navidad) y cupo máximo de citas simultáneas
  const inicioDate = new Date(d.inicio_en);
  const finDate = new Date(inicioDate.getTime() + (config.duracion_cita_min ?? 45) * 60 * 1000);
  const fechaEcuStr = new Date(inicioDate.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const reglaFecha = (config.fechas_especiales ?? []).find((f) => f.fecha === fechaEcuStr);

  if (reglaFecha) {
    if (reglaFecha.cerrado_total) {
      return {
        ok: false,
        error: `No hay atención habilitada en la fecha seleccionada (${reglaFecha.nombre}).`,
      };
    }
    if (d.modalidad === "presencial" && !reglaFecha.habilitar_presencial) {
      return {
        ok: false,
        error: `En ${reglaFecha.nombre} (${fechaEcuStr}) solo está habilitada la modalidad de teleconsulta.`,
      };
    }
    if (d.modalidad === "virtual" && !reglaFecha.habilitar_virtual) {
      return {
        ok: false,
        error: `En ${reglaFecha.nombre} (${fechaEcuStr}) no está habilitada la modalidad telemática.`,
      };
    }
  }

  const maxCupoPermitido = Math.max(
    1,
    reglaFecha?.max_citas_simultaneas ?? config.max_citas_simultaneas ?? 1,
  );

  const { data: citasExistentes } = await supabase
    .schema("tranqui_legal")
    .from("trq_cita")
    .select("cit_inicio_en, cit_fin_en, cit_estado")
    .is("cit_eliminado_en", null)
    .neq("cit_estado", "cancelada")
    .gte("cit_inicio_en", new Date(inicioDate.getTime() - 3 * 3600 * 1000).toISOString())
    .lte("cit_inicio_en", finDate.toISOString());

  const solapadas = ((citasExistentes ?? []) as Array<{
    cit_inicio_en: string;
    cit_fin_en: string | null;
  }>).filter((c) => {
    const cIni = new Date(c.cit_inicio_en).getTime();
    const cFin = c.cit_fin_en
      ? new Date(c.cit_fin_en).getTime()
      : cIni + (config.duracion_cita_min ?? 45) * 60 * 1000;
    return cIni < finDate.getTime() && cFin > inicioDate.getTime();
  }).length;

  if (solapadas >= maxCupoPermitido) {
    return {
      ok: false,
      error: `El cupo máximo de citas (${maxCupoPermitido}) para esta fecha y hora ya fue reservado. Por favor elige otro horario.`,
    };
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
  actualizarCacheConfigAgendaNegocio(d);

  const supabase = await crearClienteServidor();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, error: "Debes iniciar sesión para guardar la configuración de horarios." };
  }

  const ahoraIso = new Date().toISOString();
  const payloadAgendaHorarios = {
    zona_horaria: d.zona_horaria,
    duracion_cita_min: d.duracion_cita_min,
    holgura_min: d.holgura_min,
    antelacion_minima_horas: d.antelacion_minima_horas,
    horizonte_dias: d.horizonte_dias,
    permitir_sin_profesional: d.permitir_sin_profesional,
    max_citas_simultaneas: d.max_citas_simultaneas,
    modo_capacidad: d.modo_capacidad,
    direccion_presencial: d.direccion_presencial ?? "",
    materia_defecto_nombre: d.materia_defecto_nombre,
    franjas_virtual: d.franjas_virtual,
    franjas_presencial: d.franjas_presencial,
    fechas_especiales: d.fechas_especiales,
    actualizado_en: ahoraIso,
    actualizado_por: authData.user.id,
  };

  // 1. Persistencia primaria en PostgreSQL sobre comun_configuracion.cfg_negocio (esquema expuesto en PostgREST)
  let guardadoEnCfg = false;
  let ultimoErrorCfg: string | null = null;

  try {
    const { data: actual } = await supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", NEGOCIO)
      .maybeSingle();

    const detallePrevio =
      (actual?.cfg_detalle_configuracion as Record<string, unknown> | null) ?? {};
    const nuevoDetalle = {
      ...detallePrevio,
      agenda_horarios: payloadAgendaHorarios,
    };

    const { data: filasActualizadas, error: errUpdate } = await supabase
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: nuevoDetalle,
        cfg_actualizado_en: ahoraIso,
      })
      .eq("cfg_negocio", NEGOCIO)
      .select("cfg_id");

    if (!errUpdate && Array.isArray(filasActualizadas) && filasActualizadas.length > 0) {
      guardadoEnCfg = true;
    } else if (errUpdate) {
      ultimoErrorCfg = errUpdate.message;
    }
  } catch (err) {
    ultimoErrorCfg = err instanceof Error ? err.message : "Error al escribir en cfg_negocio";
  }

  // Si la sesión requiere validación explícita de operador/admin (ej. fila aún no creada o política RLS),
  // verificamos permiso con seg_fn_es_admin_negocio y persistimos con cliente admin.
  if (!guardadoEnCfg) {
    try {
      const { data: esStaff } = await supabase
        .schema("comun_seguridad")
        .rpc("seg_fn_es_admin_negocio", { p_negocio: NEGOCIO });

      if (esStaff === false) {
        return {
          ok: false,
          error: "Solo operadores o administradores del negocio pueden modificar los horarios de atención.",
        };
      }

      const adminClient = crearClienteAdmin() ?? supabase;
      const { data: actualAdmin } = await adminClient
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .select("cfg_id, cfg_detalle_configuracion")
        .eq("cfg_negocio", NEGOCIO)
        .maybeSingle();

      const detallePrevio =
        (actualAdmin?.cfg_detalle_configuracion as Record<string, unknown> | null) ?? {};
      const nuevoDetalle = {
        ...detallePrevio,
        agenda_horarios: payloadAgendaHorarios,
      };

      if (actualAdmin?.cfg_id) {
        const { error: errAdminUpd } = await adminClient
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .update({
            cfg_detalle_configuracion: nuevoDetalle as never,
            cfg_actualizado_en: ahoraIso,
          })
          .eq("cfg_negocio", NEGOCIO);

        if (!errAdminUpd) {
          guardadoEnCfg = true;
        } else {
          ultimoErrorCfg = errAdminUpd.message;
        }
      } else {
        const { error: errAdminIns } = await adminClient
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .insert({
            cfg_negocio: NEGOCIO,
            cfg_nombre_comercial: "Tranqi",
            cfg_detalle_configuracion: nuevoDetalle as never,
            cfg_actualizado_en: ahoraIso,
          });

        if (!errAdminIns) {
          guardadoEnCfg = true;
        } else {
          ultimoErrorCfg = errAdminIns.message;
        }
      }
    } catch (err) {
      if (!ultimoErrorCfg) {
        ultimoErrorCfg = err instanceof Error ? err.message : "Error al persistir horarios";
      }
    }
  }

  // 2. Sincronización secundaria (best-effort) en comun_agenda.age_config_negocio cuando el esquema esté expuesto
  try {
    const detallePayload = {
      materia_defecto_nombre: d.materia_defecto_nombre,
      max_citas_simultaneas: d.max_citas_simultaneas,
      modo_capacidad: d.modo_capacidad,
      fechas_especiales: d.fechas_especiales,
    };

    const { error: errRpcAge } = await supabase.schema("comun_agenda").rpc(
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
          max_citas_simultaneas: d.max_citas_simultaneas,
          modo_capacidad: d.modo_capacidad,
          direccion_presencial: d.direccion_presencial ?? "",
          franjas_virtual: d.franjas_virtual,
          franjas_presencial: d.franjas_presencial,
          fechas_especiales: d.fechas_especiales,
          detalle_config: detallePayload,
          detalle: detallePayload,
        },
      } as never,
    );

    if (!errRpcAge) {
      guardadoEnCfg = true;
    }
  } catch {
    // Ignorar si comun_agenda no está expuesto en PostgREST; ya quedó persistido en comun_configuracion.cfg_negocio
  }

  if (!guardadoEnCfg && ultimoErrorCfg) {
    return { ok: false, error: comoError(ultimoErrorCfg) };
  }

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
  const { data: authData } = await supabase.auth.getUser();
  const usuarioId = authData.user?.id;
  if (!usuarioId) {
    return { ok: false, error: "Debes iniciar sesión para configurar tu disponibilidad." };
  }

  // 1. Persistir en comun_seguridad.seg_usuario.usu_detalle_usuario.ficha_abogado (esquema expuesto)
  const ahoraIso = new Date().toISOString();
  let guardadoRespaldo = false;
  try {
    const adminClient = crearClienteAdmin() ?? supabase;
    const { data: usuRow } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", usuarioId)
      .maybeSingle();

    const detPrevio = (usuRow?.usu_detalle_usuario ?? {}) as Record<string, unknown>;
    const fichaPrevia = (detPrevio.ficha_abogado ?? {}) as Record<string, unknown>;

    const { error: errUsu } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({
        usu_detalle_usuario: {
          ...detPrevio,
          ficha_abogado: {
            ...fichaPrevia,
            configuracion_agenda: configuracion,
            franjas_agenda: franjas,
            agenda_configurada_en: ahoraIso,
          },
        } as never,
        usu_actualizado_en: ahoraIso,
      })
      .eq("usu_id", usuarioId);

    if (!errUsu) guardadoRespaldo = true;
  } catch {
    // Continuar con intento en comun_agenda
  }

  // 2. Sincronización secundaria en comun_agenda cuando el esquema esté expuesto
  const { error } = await supabase.schema("comun_agenda").rpc("age_fn_configurar_agenda", {
    p_negocio: NEGOCIO,
    p_config: configuracion,
    p_franjas: franjas,
  });
  if (error && !guardadoRespaldo) return { ok: false, error: comoError(error.message) };

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
  const { data: authData } = await supabase.auth.getUser();
  const usuarioId = authData.user?.id;
  if (!usuarioId) {
    return { ok: false, error: "Debes iniciar sesión para registrar un bloqueo." };
  }

  let guardadoRespaldo = false;
  try {
    const adminClient = crearClienteAdmin() ?? supabase;
    const { data: usuRow } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", usuarioId)
      .maybeSingle();

    const detPrevio = (usuRow?.usu_detalle_usuario ?? {}) as Record<string, unknown>;
    const fichaPrevia = (detPrevio.ficha_abogado ?? {}) as Record<string, unknown>;
    const bloqueosPrevios = Array.isArray(fichaPrevia.bloqueos_agenda)
      ? (fichaPrevia.bloqueos_agenda as Array<Record<string, unknown>>)
      : [];

    const nuevoBloqueo = {
      blq_id: crypto.randomUUID(),
      blq_inicio_en: d.inicio_en,
      blq_fin_en: d.fin_en,
      blq_motivo: d.motivo ?? null,
      blq_origen: d.es_audiencia ? "audiencia" : "manual",
      blq_eliminado_en: null,
    };

    const { error: errUsu } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({
        usu_detalle_usuario: {
          ...detPrevio,
          ficha_abogado: {
            ...fichaPrevia,
            bloqueos_agenda: [...bloqueosPrevios, nuevoBloqueo],
          },
        } as never,
        usu_actualizado_en: new Date().toISOString(),
      })
      .eq("usu_id", usuarioId);

    if (!errUsu) guardadoRespaldo = true;
  } catch {
    // Continuar con comun_agenda
  }

  const { error } = await supabase.schema("comun_agenda").rpc("age_fn_bloquear", {
    p_negocio: NEGOCIO,
    p_inicio: d.inicio_en,
    p_fin: d.fin_en,
    p_motivo: d.motivo ?? undefined,
    p_origen: d.es_audiencia ? "audiencia" : "manual",
  });
  if (error && !guardadoRespaldo) return { ok: false, error: comoError(error.message) };

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
  const { data: authData } = await supabase.auth.getUser();
  const usuarioId = authData.user?.id;

  let guardadoRespaldo = false;
  if (usuarioId) {
    try {
      const adminClient = crearClienteAdmin() ?? supabase;
      const { data: usuRow } = await adminClient
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", usuarioId)
        .maybeSingle();

      const detPrevio = (usuRow?.usu_detalle_usuario ?? {}) as Record<string, unknown>;
      const fichaPrevia = (detPrevio.ficha_abogado ?? {}) as Record<string, unknown>;
      const bloqueosPrevios = Array.isArray(fichaPrevia.bloqueos_agenda)
        ? (fichaPrevia.bloqueos_agenda as Array<Record<string, unknown>>)
        : [];

      const ahoraIso = new Date().toISOString();
      const actualizados = bloqueosPrevios.map((b) =>
        b.blq_id === bloqueoId ? { ...b, blq_eliminado_en: ahoraIso } : b,
      );

      const { error: errUsu } = await adminClient
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detPrevio,
            ficha_abogado: {
              ...fichaPrevia,
              bloqueos_agenda: actualizados,
            },
          } as never,
          usu_actualizado_en: ahoraIso,
        })
        .eq("usu_id", usuarioId);

      if (!errUsu) guardadoRespaldo = true;
    } catch {
      // Continuar con comun_agenda
    }
  }

  const { error } = await supabase.schema("comun_agenda")
    .from("age_bloqueo")
    .update({ blq_eliminado_en: new Date().toISOString(), blq_actualizado_en: new Date().toISOString() })
    .eq("blq_id", bloqueoId);
  if (error && !guardadoRespaldo) return { ok: false, error: comoError(error.message) };

  revalidatePath("/panel/agenda/disponibilidad");
  return { ok: true, data: undefined };
}
