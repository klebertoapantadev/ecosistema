"use server";

import { revalidatePath } from "next/cache";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import {
  esquemaAgendaCompleta,
  esquemaBloqueo,
  esquemaConfigNegocioAgenda,
  esquemaDecisionCita,
  esquemaGestionReunionCita,
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
  listarAbogadosAsignables,
  listarAgendaDelAbogado,
  listarCitasCalendarioOperador,
  listarCitasDelCliente,
  listarCitasEnContingencia,
  listarMateriasAgendables,
  listarServiciosAgendables,
  obtenerCobertura,
  obtenerConfiguracionAgendaNegocio,
  obtenerHuecosDeMateria,
  obtenerMiAgenda,
  type DocumentoAdjuntoCita,
  type EventoLineaTiempoCaso,
  type EventoLogCita,
  type GestionReunionCita,
  type RegistroHistorialAsignacion,
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

const FORMATO_FECHA_CITA_EC = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

async function despacharNotificacionAgendaUsuarios(params: {
  usuarioIds: string[];
  notIdPrefijo: string;
  titulo: string;
  contenidoHtml: string;
  urlAccion: string;
  canal?: "IN_APP" | "PUSH";
}) {
  const idsUnicos = Array.from(new Set(params.usuarioIds.filter(Boolean)));
  if (idsUnicos.length === 0) return;

  try {
    const supabase = await crearClienteServidor();
    const db = crearClienteAdmin() ?? supabase;
    const ahoraIso = new Date().toISOString();

    for (const usuId of idsUnicos) {
      const notId = `${params.notIdPrefijo}-${usuId.slice(0, 8)}`;
      try {
        const { data: uRow } = await db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_id, usu_correo, usu_detalle_usuario")
          .eq("usu_id", usuId)
          .maybeSingle();

        const det = ((uRow?.usu_detalle_usuario ?? {}) as Record<string, unknown>) || {};
        const bandejaPrevia = Array.isArray(det.notificaciones_bandeja)
          ? (det.notificaciones_bandeja as Array<Record<string, unknown>>)
          : [];

        const itemNotif = {
          not_id: notId,
          not_titulo: params.titulo,
          not_contenido_html: params.contenidoHtml,
          not_url_accion: params.urlAccion,
          not_leido_en: null,
          not_creado_en: ahoraIso,
          not_canal: params.canal ?? "PUSH",
          not_eliminada: false,
        };

        const filtrada = bandejaPrevia.filter((b) => b?.not_id !== notId);
        const nuevaBandeja = [itemNotif, ...filtrada].slice(0, 80);

        await db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .update({
            usu_detalle_usuario: {
              ...det,
              notificaciones_bandeja: nuevaBandeja,
            } as never,
            usu_actualizado_en: ahoraIso,
          })
          .eq("usu_id", usuId);

        if (uRow?.usu_correo) {
          try {
            const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
            await enviarCorreo({
              negocio: NEGOCIO,
              para: uRow.usu_correo,
              asunto: params.titulo,
              html: params.contenidoHtml,
            });
          } catch {
            // Best-effort email
          }
        }
      } catch {
        // Continuar con el siguiente destinatario
      }
    }

    try {
      const filasRegistro = idsUnicos.map((usuId) => ({
        not_usuario_id: usuId,
        not_negocio: NEGOCIO,
        not_canal: params.canal ?? "PUSH",
        not_titulo: params.titulo,
        not_contenido_html: params.contenidoHtml,
        not_url_accion: params.urlAccion,
        not_creado_en: ahoraIso,
      }));
      await (db as unknown as {
        schema: (s: string) => { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } };
      })
        .schema("comun_notificacion")
        .from("not_registro")
        .insert(filasRegistro);
    } catch {
      // Esquema comun_notificacion opcional si ya quedó en seg_usuario.notificaciones_bandeja
    }
  } catch {
    // Best-effort
  }
}

async function obtenerIdsOperadoresTranqi(): Promise<string[]> {
  try {
    const supabase = await crearClienteServidor();
    const db = crearClienteAdmin() ?? supabase;
    const { data: mems } = await db
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_usuario_id, mem_rol, mem_negocio, mem_estado")
      .eq("mem_estado", "ACTIVO");

    const ids = new Set<string>();
    const memIdsTranqi: string[] = [];

    for (const m of (mems ?? []) as Array<{
      mem_id: string;
      mem_usuario_id: string;
      mem_rol?: string | null;
      mem_negocio?: string | null;
    }>) {
      const neg = (m.mem_negocio ?? "").toUpperCase();
      if (!neg.startsWith("TRANQ")) continue;
      memIdsTranqi.push(m.mem_id);
      const rol = (m.mem_rol ?? "").toUpperCase();
      if (rol === "OPERADOR" || rol === "ADMINISTRADOR" || rol === "SUPERADMIN" || rol === "AUXILIAR") {
        ids.add(m.mem_usuario_id);
      }
    }

    if (memIdsTranqi.length > 0) {
      const { data: mps } = await db
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .select("mpe_membresia_id, mpe_perfil_id")
        .in("mpe_membresia_id", memIdsTranqi);

      const { data: perfiles } = await db
        .schema("comun_seguridad")
        .from("seg_perfil")
        .select("per_id, per_clave");

      const mapaPer = new Map<string, string>();
      for (const p of (perfiles ?? []) as Array<{ per_id: string; per_clave: string }>) {
        mapaPer.set(p.per_id, (p.per_clave ?? "").toUpperCase());
      }
      const mapaMemUsu = new Map<string, string>();
      for (const m of (mems ?? []) as Array<{ mem_id: string; mem_usuario_id: string }>) {
        mapaMemUsu.set(m.mem_id, m.mem_usuario_id);
      }

      for (const mp of (mps ?? []) as Array<{ mpe_membresia_id: string; mpe_perfil_id: string }>) {
        const clave = mapaPer.get(mp.mpe_perfil_id) ?? "";
        if (clave === "OPERADOR" || clave === "ADMINISTRADOR" || clave === "SUPERADMIN" || clave === "AUXILIAR") {
          const uId = mapaMemUsu.get(mp.mpe_membresia_id);
          if (uId) ids.add(uId);
        }
      }
    }

    return Array.from(ids);
  } catch {
    return [];
  }
}

async function notificarOperadoresNuevaCitaConfirmada(citaId: string) {
  try {
    const supabase = await crearClienteServidor();
    const db = crearClienteAdmin() ?? supabase;

    const { data: cita } = await db
      .schema("tranqui_legal")
      .from("trq_cita")
      .select("cit_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_modalidad, cit_motivo, cit_estado, cit_asignacion")
      .eq("cit_id", citaId)
      .maybeSingle();

    if (!cita) return;

    const [cliRes, idsOperadores] = await Promise.all([
      db
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo")
        .eq("usu_id", cita.cit_cliente_id)
        .maybeSingle(),
      obtenerIdsOperadoresTranqi(),
    ]);

    let abogadoNombre: string | null = null;
    if (cita.cit_abogado_id && cita.cit_asignacion !== "contingencia") {
      const { data: abgRow } = await db
        .schema("tranqui_legal")
        .from("trq_abogado")
        .select("abg_usuario_id")
        .eq("abg_id", cita.cit_abogado_id)
        .maybeSingle();
      if (abgRow?.abg_usuario_id) {
        const { data: uAbg } = await db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_nombres, usu_apellidos, usu_correo")
          .eq("usu_id", abgRow.abg_usuario_id)
          .maybeSingle();
        abogadoNombre =
          [uAbg?.usu_nombres, uAbg?.usu_apellidos].filter(Boolean).join(" ").trim() ||
          uAbg?.usu_correo ||
          "Abogado asignado";
      }
    }

    const clienteNombre =
      [cliRes.data?.usu_nombres, cliRes.data?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      cliRes.data?.usu_correo ||
      "Cliente";
    const materiaNombre = "General";
    const esPresencial = cita.cit_modalidad === "presencial";
    const etiquetaModalidad = esPresencial ? "Presencial en Oficina" : "Telemática (Videollamada)";
    const fechaTxt = FORMATO_FECHA_CITA_EC.format(new Date(cita.cit_inicio_en));

    const estadoAbgHtml = abogadoNombre
      ? `<span style="color:#065F46;font-weight:800;">✅ Asignado a Dr(a). ${abogadoNombre}</span>`
      : `<span style="color:#B45309;font-weight:800;">⚠️ Pendiente de asignar abogado</span>`;

    const htmlOperador = `
      <div>
        <p style="margin:0 0 8px 0;">
          Se ha confirmado una nueva consulta jurídica en <strong>Tranqi</strong>.
        </p>
        <div style="font-size:0.82rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin:6px 0;">
          <strong>👤 Cliente:</strong> ${clienteNombre} (${cliRes.data?.usu_correo || "—"})<br/>
          <strong>📅 Fecha y hora:</strong> ${fechaTxt}<br/>
          <strong>📍 Modalidad:</strong> ${etiquetaModalidad}<br/>
          <strong>⚖️ Especialidad:</strong> ${materiaNombre}<br/>
          <strong>👨‍⚖️ Abogado:</strong> ${estadoAbgHtml}<br/>
          ${cita.cit_motivo ? `<strong>📝 Motivo:</strong> ${cita.cit_motivo}` : ""}
        </div>
        <p style="margin:8px 0 0 0;font-size:0.8rem;">
          <a href="/panel/agendamiento?widget=asignaciones_agenda" style="color:#5000BA;font-weight:800;text-decoration:underline;">
            Abrir Agenda, Citas Abogados →
          </a>
        </p>
      </div>
    `;

    await despacharNotificacionAgendaUsuarios({
      usuarioIds: idsOperadores,
      notIdPrefijo: `nueva-cita-${cita.cit_id.slice(0, 8)}`,
      titulo: `📅 Nueva consulta jurídica confirmada (${esPresencial ? "Presencial" : "Telemática"})`,
      contenidoHtml: htmlOperador,
      urlAccion: "/panel/agendamiento?widget=asignaciones_agenda",
      canal: "PUSH",
    });
  } catch {
    // Best-effort
  }
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
    const citaIdFallback = fallback.data as string;
    await notificarOperadoresNuevaCitaConfirmada(citaIdFallback);
    revalidatePath("/panel/mis-citas");
    revalidatePath("/panel/agendar");
    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/agenda/asignaciones");
    return { ok: true, data: { citaId: citaIdFallback } };
  }

  const citaIdCreada = data as string;
  await notificarOperadoresNuevaCitaConfirmada(citaIdCreada);
  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agendar");
  revalidatePath("/panel/agendamiento");
  revalidatePath("/panel/agenda/asignaciones");
  return { ok: true, data: { citaId: citaIdCreada } };
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

  await notificarOperadoresNuevaCitaConfirmada(citaId);
  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agendar");
  revalidatePath("/panel/agendamiento");
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
  const db = crearClienteAdmin() ?? supabase;
  const { data: authData } = await supabase.auth.getUser();
  const actorId = authData.user?.id ?? null;

  const { data: citaActual } = await db
    .schema("tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_notas, cit_asignacion",
    )
    .eq("cit_id", d.cita_id)
    .maybeSingle();

  let autorNombre = authData.user?.email ?? "Abogado";
  if (actorId) {
    const { data: usuActor } = await db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo")
      .eq("usu_id", actorId)
      .maybeSingle();
    if (usuActor) {
      autorNombre =
        [usuActor.usu_nombres, usuActor.usu_apellidos].filter(Boolean).join(" ").trim() ||
        usuActor.usu_correo ||
        autorNombre;
    }
  }

  const ahoraIso = new Date().toISOString();

  // Caso 1: Abogado acepta/confirma la asignación
  if (d.decision === "aceptar_asignacion" || d.decision === "confirmar") {
    const { error: errUpd } = await db
      .schema("tranqui_legal")
      .from("trq_cita")
      .update({
        cit_estado: "confirmada",
        cit_actualizado_en: ahoraIso,
      })
      .eq("cit_id", d.cita_id);

    if (errUpd) return { ok: false, error: comoError(errUpd.message) };

    await registrarEventoYEstadoGestionCita(db, d.cita_id, {
      estado_aceptacion_abogado: "aceptada",
      motivo_aceptacion_abogado: d.motivo?.trim() || null,
      evento: {
        id: crypto.randomUUID(),
        fecha: ahoraIso,
        tipo: "ACEPTACION",
        autor_nombre: autorNombre,
        autor_rol: "ABOGADO",
        resumen: `Dr(a). ${autorNombre} confirmó la asignación de la cita`,
        mensaje: d.motivo?.trim() || null,
      },
    });

    if (citaActual?.cit_cliente_id) {
      const fechaTxt = FORMATO_FECHA_CITA_EC.format(new Date(citaActual.cit_inicio_en));
      const operadoresIds = await obtenerIdsOperadoresTranqi();
      await Promise.all([
        despacharNotificacionAgendaUsuarios({
          usuarioIds: [citaActual.cit_cliente_id],
          notIdPrefijo: `conf-abg-cli-${d.cita_id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
          titulo: `✅ Tu abogado Dr(a). ${autorNombre} confirmó la cita`,
          contenidoHtml: `<div><p style="margin:0 0 6px 0;">Dr(a). <strong>${autorNombre}</strong> ha confirmado tu consulta del <strong>${fechaTxt}</strong>.</p>${d.motivo ? `<p style="margin:0;font-size:0.82rem;color:#334155;">💬 Mensaje del abogado: "${d.motivo}"</p>` : ""}</div>`,
          urlAccion: "/panel/agendamiento?widget=mis_citas",
          canal: "PUSH",
        }),
        operadoresIds.length > 0
          ? despacharNotificacionAgendaUsuarios({
              usuarioIds: operadoresIds,
              notIdPrefijo: `conf-abg-op-${d.cita_id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
              titulo: `✅ Cita aceptada por Dr(a). ${autorNombre}`,
              contenidoHtml: `<div><p style="margin:0;">El abogado asignado aceptó la consulta programada para <strong>${fechaTxt}</strong>.${d.motivo ? ` Nota: "${d.motivo}"` : ""}</p></div>`,
              urlAccion: "/panel/agendamiento?widget=asignaciones_agenda",
              canal: "IN_APP",
            })
          : Promise.resolve(),
      ]);
    }

    revalidatePath("/panel/agenda");
    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/mis-citas");
    revalidatePath("/panel/agenda/asignaciones");
    return { ok: true, data: { resultado: "confirmada" } };
  }

  // Caso 2: Abogado rechaza la asignación -> pasa a contingencia para reasignación sin cancelar al cliente
  if (d.decision === "rechazar_asignacion") {
    const { error: errUpd } = await db
      .schema("tranqui_legal")
      .from("trq_cita")
      .update({
        cit_abogado_id: null,
        cit_asignacion: "contingencia",
        cit_estado: "confirmada",
        cit_actualizado_en: ahoraIso,
      })
      .eq("cit_id", d.cita_id);

    if (errUpd) return { ok: false, error: comoError(errUpd.message) };

    await registrarEventoYEstadoGestionCita(db, d.cita_id, {
      estado_aceptacion_abogado: "rechazada",
      motivo_aceptacion_abogado: d.motivo?.trim() || "El abogado indicó que no puede atender este horario",
      evento: {
        id: crypto.randomUUID(),
        fecha: ahoraIso,
        tipo: "RECHAZO",
        autor_nombre: autorNombre,
        autor_rol: "ABOGADO",
        resumen: `Dr(a). ${autorNombre} rechazó la asignación (requiere reasignación)`,
        mensaje: d.motivo?.trim() || null,
      },
    });

    if (citaActual) {
      const fechaTxt = FORMATO_FECHA_CITA_EC.format(new Date(citaActual.cit_inicio_en));
      const operadoresIds = await obtenerIdsOperadoresTranqi();
      if (operadoresIds.length > 0) {
        await despacharNotificacionAgendaUsuarios({
          usuarioIds: operadoresIds,
          notIdPrefijo: `rech-abg-op-${d.cita_id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
          titulo: `⚠️ Asignación rechazada por Dr(a). ${autorNombre} — Reasignar abogado`,
          contenidoHtml: `<div><p style="margin:0 0 6px 0;">Dr(a). <strong>${autorNombre}</strong> no podrá atender la consulta del <strong>${fechaTxt}</strong>.</p>${d.motivo ? `<p style="margin:0 0 6px 0;font-size:0.82rem;"><strong>Motivo:</strong> ${d.motivo}</p>` : ""}<p style="margin:0;font-size:0.8rem;"><a href="/panel/agendamiento?widget=asignaciones_agenda" style="color:#5000BA;font-weight:800;text-decoration:underline;">Asignar otro abogado en Agenda, Citas Abogados →</a></p></div>`,
          urlAccion: "/panel/agendamiento?widget=asignaciones_agenda",
          canal: "PUSH",
        });
      }
    }

    revalidatePath("/panel/agenda");
    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/mis-citas");
    revalidatePath("/panel/agenda/asignaciones");
    return { ok: true, data: { resultado: "en_contingencia" } };
  }

  // Caso 3: Otras decisiones (reagendar, cancelar por cliente/abogado, marcar_realizada, marcar_no_asistio)
  const { data, error } = await supabase.schema("tranqui_legal").rpc("trq_fn_decidir_cita", {
    p_cita_id: d.cita_id,
    p_decision: d.decision,
    p_nuevo_inicio: d.nuevo_inicio ?? undefined,
    p_motivo: d.motivo ?? undefined,
  });

  if (error) {
    // Fallback administrativo si el RPC falla por no tener fila en comun_agenda
    const cambiosDirectos: {
      cit_actualizado_en: string;
      cit_estado?: string;
      cit_inicio_en?: string;
    } = { cit_actualizado_en: ahoraIso };
    if (d.decision === "marcar_realizada") cambiosDirectos.cit_estado = "realizada";
    else if (d.decision === "cancelar") cambiosDirectos.cit_estado = "cancelada";
    else if (d.decision === "reagendar" && d.nuevo_inicio) {
      cambiosDirectos.cit_inicio_en = d.nuevo_inicio;
      cambiosDirectos.cit_estado = "reagendada";
    }
    const { error: errDirecto } = await db
      .schema("tranqui_legal")
      .from("trq_cita")
      .update(cambiosDirectos)
      .eq("cit_id", d.cita_id);

    if (errDirecto) return { ok: false, error: comoError(error.message) };
  }

  await registrarEventoYEstadoGestionCita(db, d.cita_id, {
    evento: {
      id: crypto.randomUUID(),
      fecha: ahoraIso,
      tipo: d.decision === "reagendar" ? "REAGENDAMIENTO" : "GESTION_REUNION",
      autor_nombre: autorNombre,
      autor_rol: actorId && citaActual?.cit_cliente_id === actorId ? "CLIENTE" : "ABOGADO",
      resumen:
        d.decision === "reagendar"
          ? `Cita reagendada por ${autorNombre}`
          : d.decision === "marcar_realizada"
          ? `Cita marcada como realizada por ${autorNombre}`
          : `Estado actualizado (${d.decision}) por ${autorNombre}`,
      mensaje: d.motivo?.trim() || null,
    },
  });

  revalidatePath("/panel/agenda");
  revalidatePath("/panel/agendamiento");
  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agenda/asignaciones");
  return { ok: true, data: { resultado: (data as string) ?? d.decision } };
}

async function registrarEventoYEstadoGestionCita(
  db: ReturnType<typeof crearClienteAdmin> extends infer R ? NonNullable<R> : never,
  citaId: string,
  cambios: {
    estado_aceptacion_abogado?: "pendiente" | "aceptada" | "rechazada";
    motivo_aceptacion_abogado?: string | null;
    notas_reunion?: string | null;
    siguientes_pasos?: GestionReunionCita["siguientes_pasos"];
    documentos_adjuntos?: GestionReunionCita["documentos_adjuntos"];
    evento?: EventoLogCita;
  },
) {
  try {
    const ahoraIso = new Date().toISOString();
    const { data: cfgRow } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", NEGOCIO)
      .maybeSingle();

    const detPrevio = ((cfgRow?.cfg_detalle_configuracion ?? {}) as Record<string, unknown>) || {};
    const gestionesPrevias =
      ((detPrevio.gestiones_citas ?? {}) as Record<string, GestionReunionCita>) || {};

    const actual: GestionReunionCita = gestionesPrevias[citaId] ?? {
      cita_id: citaId,
      estado_aceptacion_abogado: "pendiente",
      motivo_aceptacion_abogado: null,
      notas_reunion: null,
      siguientes_pasos: [],
      documentos_adjuntos: [],
      eventos_log: [],
      actualizado_en: ahoraIso,
    };

    const nuevosEventos = cambios.evento
      ? [cambios.evento, ...(actual.eventos_log ?? [])].slice(0, 100)
      : actual.eventos_log ?? [];

    const actualizado: GestionReunionCita = {
      ...actual,
      estado_aceptacion_abogado:
        cambios.estado_aceptacion_abogado ?? actual.estado_aceptacion_abogado,
      motivo_aceptacion_abogado:
        cambios.motivo_aceptacion_abogado !== undefined
          ? cambios.motivo_aceptacion_abogado
          : actual.motivo_aceptacion_abogado,
      notas_reunion:
        cambios.notas_reunion !== undefined ? cambios.notas_reunion : actual.notas_reunion,
      siguientes_pasos:
        cambios.siguientes_pasos !== undefined ? cambios.siguientes_pasos : actual.siguientes_pasos,
      documentos_adjuntos:
        cambios.documentos_adjuntos !== undefined
          ? cambios.documentos_adjuntos
          : actual.documentos_adjuntos,
      eventos_log: nuevosEventos,
      actualizado_en: ahoraIso,
    };

    await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrevio,
          gestiones_citas: {
            ...gestionesPrevias,
            [citaId]: actualizado,
          },
        } as never,
        cfg_actualizado_en: ahoraIso,
      })
      .eq("cfg_negocio", NEGOCIO);
  } catch {
    // Best-effort log persistence
  }
}

export async function reasignarCitaAction(
  entrada: unknown,
): Promise<Resultado<{ log: RegistroHistorialAsignacion }>> {
  const validado = esquemaReasignacion.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0]?.message ?? "Datos incompletos" };
  }
  const d = validado.data;

  const supabase = await crearClienteServidor();
  const db = crearClienteAdmin() ?? supabase;

  const { data: authData } = await supabase.auth.getUser();
  const operadorId = authData.user?.id ?? null;
  if (!operadorId) {
    return { ok: false, error: "Debes iniciar sesión como operador o administrador para asignar abogados." };
  }

  // Cargar datos actuales de la cita antes de actualizar
  const { data: citaActual, error: errCita } = await db
    .schema("tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_lugar, cit_enlace, cit_notas, cit_asignacion",
    )
    .eq("cit_id", d.cita_id)
    .maybeSingle();

  if (errCita || !citaActual) {
    return { ok: false, error: "No se encontró la cita seleccionada." };
  }

  // Cargar abogado destino
  const { data: abgDestino } = await db
    .schema("tranqui_legal")
    .from("trq_abogado")
    .select("abg_id, abg_usuario_id")
    .eq("abg_id", d.abogado_destino)
    .maybeSingle();

  if (!abgDestino) {
    return { ok: false, error: "El abogado seleccionado no existe en el directorio." };
  }

  // Cargar abogado anterior si existía
  let abgAnteriorUsuId: string | null = null;
  if (citaActual.cit_abogado_id) {
    const { data: abgAnt } = await db
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_usuario_id")
      .eq("abg_id", citaActual.cit_abogado_id)
      .maybeSingle();
    abgAnteriorUsuId = abgAnt?.abg_usuario_id ?? null;
  }

  const idsUsuarios = Array.from(
    new Set(
      [
        citaActual.cit_cliente_id,
        abgDestino.abg_usuario_id,
        abgAnteriorUsuId,
        operadorId,
      ].filter(Boolean) as string[],
    ),
  );

  const usuRes = await db
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo")
    .in("usu_id", idsUsuarios);

  const mapaUsu = new Map<string, { nombre: string; correo: string | null }>();
  for (const u of (usuRes.data ?? []) as Array<{
    usu_id: string;
    usu_nombres?: string | null;
    usu_apellidos?: string | null;
    usu_correo?: string | null;
  }>) {
    mapaUsu.set(u.usu_id, {
      nombre: [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ").trim() || u.usu_correo || "Usuario",
      correo: u.usu_correo ?? null,
    });
  }

  const clienteInfo = mapaUsu.get(citaActual.cit_cliente_id) ?? { nombre: "Cliente", correo: null };
  const abgNuevoInfo = mapaUsu.get(abgDestino.abg_usuario_id) ?? { nombre: "Abogado", correo: null };
  const abgAntInfo = abgAnteriorUsuId ? (mapaUsu.get(abgAnteriorUsuId) ?? null) : null;
  const operadorInfo = mapaUsu.get(operadorId) ?? { nombre: "Operador", correo: authData.user?.email ?? null };
  const materiaNombre = "General";

  // 1. Intentar RPC trq_fn_reasignar_cita y asegurar actualización en tranqui_legal.trq_cita
  const ahoraIso = new Date().toISOString();
  const notaLinea = `Asignado a Dr(a). ${abgNuevoInfo.nombre} por ${operadorInfo.nombre}${d.motivo ? ` (${d.motivo})` : ""} [${ahoraIso}]`;
  const notasActualizadas = [citaActual.cit_notas, notaLinea].filter(Boolean).join("\n");

  const { error: errRpc } = await supabase.schema("tranqui_legal").rpc("trq_fn_reasignar_cita", {
    p_cita_id: d.cita_id,
    p_abogado_destino: d.abogado_destino,
    p_motivo: d.motivo ?? undefined,
  });

  if (errRpc) {
    // Si el abogado aún no tiene fila en comun_agenda.age_profesional, actualizar directamente en trq_cita
    const { error: errUpdDirecto } = await db
      .schema("tranqui_legal")
      .from("trq_cita")
      .update({
        cit_abogado_id: d.abogado_destino,
        cit_asignacion: "operador",
        cit_reasignada_de: citaActual.cit_abogado_id,
        cit_estado: "confirmada",
        cit_notas: notasActualizadas,
        cit_actualizado_en: ahoraIso,
      })
      .eq("cit_id", d.cita_id);

    if (errUpdDirecto) {
      return { ok: false, error: comoError(errUpdDirecto.message || errRpc.message) };
    }
  }

  // 2. Registrar en el Log de Asignación (Historial) en comun_configuracion.cfg_negocio
  const nuevoLog: RegistroHistorialAsignacion = {
    id: crypto.randomUUID(),
    cita_id: d.cita_id,
    fecha_asignacion: ahoraIso,
    cita_inicio_en: citaActual.cit_inicio_en,
    cita_modalidad: citaActual.cit_modalidad === "presencial" ? "presencial" : "virtual",
    materia_nombre: materiaNombre,
    cliente_id: citaActual.cit_cliente_id,
    cliente_nombre: clienteInfo.nombre,
    cliente_correo: clienteInfo.correo,
    abogado_anterior_id: citaActual.cit_abogado_id ?? null,
    abogado_anterior_nombre:
      citaActual.cit_abogado_id && citaActual.cit_asignacion !== "contingencia"
        ? (abgAntInfo?.nombre ?? "Abogado previo")
        : null,
    abogado_nuevo_id: d.abogado_destino,
    abogado_nuevo_nombre: abgNuevoInfo.nombre,
    abogado_nuevo_correo: abgNuevoInfo.correo,
    operador_id: operadorId,
    operador_nombre: operadorInfo.nombre,
    operador_correo: operadorInfo.correo,
    motivo: d.motivo?.trim() || null,
    notificado_cliente: true,
    notificado_abogado: true,
  };

  try {
    const { data: cfgRow } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", NEGOCIO)
      .maybeSingle();

    const detPrevio = ((cfgRow?.cfg_detalle_configuracion ?? {}) as Record<string, unknown>) || {};
    const historialPrevio = Array.isArray(detPrevio.historial_asignaciones_citas)
      ? (detPrevio.historial_asignaciones_citas as RegistroHistorialAsignacion[])
      : [];

    const nuevoHistorial = [nuevoLog, ...historialPrevio].slice(0, 300);

    const gestionesPrevias =
      ((detPrevio.gestiones_citas ?? {}) as Record<string, GestionReunionCita>) || {};
    const gestionActual = gestionesPrevias[d.cita_id] ?? {
      cita_id: d.cita_id,
      estado_aceptacion_abogado: "pendiente",
      motivo_aceptacion_abogado: null,
      notas_reunion: null,
      siguientes_pasos: [],
      documentos_adjuntos: [],
      eventos_log: [],
      actualizado_en: ahoraIso,
    };

    const eventoAsignacion: EventoLogCita = {
      id: `asig-${nuevoLog.id}`,
      fecha: ahoraIso,
      tipo: nuevoLog.abogado_anterior_id ? "REASIGNACION" : "ASIGNACION",
      autor_nombre: operadorInfo.nombre,
      autor_rol: "OPERADOR",
      resumen: `Asignado a Dr(a). ${abgNuevoInfo.nombre}`,
      mensaje: d.motivo?.trim() || null,
    };

    const gestionActualizada: GestionReunionCita = {
      ...gestionActual,
      estado_aceptacion_abogado: "pendiente",
      motivo_aceptacion_abogado: d.motivo?.trim() || null,
      eventos_log: [eventoAsignacion, ...(gestionActual.eventos_log ?? [])].slice(0, 100),
      actualizado_en: ahoraIso,
    };

    await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrevio,
          historial_asignaciones_citas: nuevoHistorial,
          gestiones_citas: {
            ...gestionesPrevias,
            [d.cita_id]: gestionActualizada,
          },
        } as never,
        cfg_actualizado_en: ahoraIso,
      })
      .eq("cfg_negocio", NEGOCIO);
  } catch {
    // Continuar con despacho de notificaciones
  }

  // 3. Generar notificación al Cliente y al Abogado indicando la asignación
  const fechaCitaTxt = FORMATO_FECHA_CITA_EC.format(new Date(citaActual.cit_inicio_en));
  const esPresencial = citaActual.cit_modalidad === "presencial";
  const etiquetaModalidad = esPresencial ? "Presencial en Oficina" : "Telemática (Videollamada)";

  const htmlCliente = `
    <div>
      <p style="margin:0 0 8px 0;">
        Te informamos que se ha asignado un abogado especialista para tu consulta jurídica en <strong>Tranqi</strong>.
      </p>
      <div style="font-size:0.82rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin:6px 0;">
        <strong>👨‍⚖️ Abogado asignado:</strong> Dr(a). ${abgNuevoInfo.nombre}<br/>
        <strong>⚖️ Especialidad:</strong> ${materiaNombre}<br/>
        <strong>📅 Fecha y hora:</strong> ${fechaCitaTxt}<br/>
        <strong>📍 Modalidad:</strong> ${etiquetaModalidad}
        ${esPresencial && citaActual.cit_lugar ? `<br/><strong>🏢 Dirección:</strong> ${citaActual.cit_lugar}` : ""}
      </div>
      <p style="margin:8px 0 0 0;font-size:0.8rem;">
        <a href="/panel/agendamiento?widget=mis_citas" style="color:#5000BA;font-weight:800;text-decoration:underline;">
          Ver detalle en Mis Citas →
        </a>
      </p>
    </div>
  `;

  const htmlAbogado = `
    <div>
      <p style="margin:0 0 8px 0;">
        Se te ha asignado una consulta jurídica en tu agenda de <strong>Tranqi</strong>.
      </p>
      <div style="font-size:0.82rem;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin:6px 0;">
        <strong>👤 Cliente:</strong> ${clienteInfo.nombre} (${clienteInfo.correo || "—"})<br/>
        <strong>⚖️ Especialidad:</strong> ${materiaNombre}<br/>
        <strong>📅 Fecha y hora:</strong> ${fechaCitaTxt}<br/>
        <strong>📍 Modalidad:</strong> ${etiquetaModalidad}<br/>
        ${citaActual.cit_motivo ? `<strong>📝 Motivo del cliente:</strong> ${citaActual.cit_motivo}<br/>` : ""}
        ${d.motivo ? `<strong>📌 Nota de asignación:</strong> ${d.motivo}` : ""}
      </div>
      <p style="margin:8px 0 0 0;font-size:0.8rem;">
        <a href="/panel/agendamiento?widget=citas_programadas" style="color:#05876E;font-weight:800;text-decoration:underline;">
          Abrir mis Citas Programadas →
        </a>
      </p>
    </div>
  `;

  await Promise.all([
    despacharNotificacionAgendaUsuarios({
      usuarioIds: [citaActual.cit_cliente_id],
      notIdPrefijo: `asig-cli-${d.cita_id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
      titulo: `⚖️ Abogado asignado a tu consulta: Dr(a). ${abgNuevoInfo.nombre}`,
      contenidoHtml: htmlCliente,
      urlAccion: "/panel/agendamiento?widget=mis_citas",
      canal: "PUSH",
    }),
    despacharNotificacionAgendaUsuarios({
      usuarioIds: [abgDestino.abg_usuario_id],
      notIdPrefijo: `asig-abg-${d.cita_id.slice(0, 8)}-${Date.now().toString().slice(-4)}`,
      titulo: `📅 Nueva consulta asignada (${esPresencial ? "Presencial" : "Telemática"}): ${clienteInfo.nombre}`,
      contenidoHtml: htmlAbogado,
      urlAccion: "/panel/agendamiento?widget=citas_programadas",
      canal: "PUSH",
    }),
  ]);

  revalidatePath("/panel/agenda/asignaciones");
  revalidatePath("/panel/agendamiento");
  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agenda");
  return { ok: true, data: { log: nuevoLog } };
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

export async function obtenerDatosAgendarCitaWidgetAction() {
  try {
    const [materias, servicios, cobertura, configAgenda] = await Promise.all([
      listarMateriasAgendables(),
      listarServiciosAgendables(),
      obtenerCobertura(),
      obtenerConfiguracionAgendaNegocio(),
    ]);
    return {
      ok: true as const,
      data: { materias, servicios, cobertura, configAgenda },
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudieron cargar los datos de agendamiento.",
    };
  }
}

export async function buscarHuecosMateriaAction(
  materiaId: string,
  varianteId: string | null,
  modalidad: string,
) {
  const configAgenda = await obtenerConfiguracionAgendaNegocio();
  const desde = new Date();
  const horizonteDias = configAgenda.horizonte_dias || 21;
  const hasta = new Date(desde.getTime() + horizonteDias * 24 * 60 * 60 * 1000);
  return obtenerHuecosDeMateria(materiaId, desde, hasta, varianteId, modalidad);
}

export async function obtenerMisCitasWidgetAction() {
  try {
    const [citas, cobertura] = await Promise.all([
      listarCitasDelCliente(),
      obtenerCobertura(),
    ]);
    return {
      ok: true as const,
      data: { citas, cobertura },
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudieron cargar tus citas.",
    };
  }
}

export async function guardarGestionReunionYCitaAction(
  entrada: unknown,
): Promise<Resultado<{ caso_id: string | null }>> {
  const validado = esquemaGestionReunionCita.safeParse(entrada);
  if (!validado.success) {
    return {
      ok: false,
      error: validado.error.issues[0]?.message ?? "Revisa los datos de la gestión de la reunión.",
    };
  }
  const d = validado.data;

  const supabase = await crearClienteServidor();
  const db = crearClienteAdmin() ?? supabase;
  const { data: authData } = await supabase.auth.getUser();
  const actorId = authData.user?.id ?? null;
  if (!actorId) {
    return { ok: false, error: "Debes iniciar sesión para guardar la gestión de la cita." };
  }

  const [citaRes, actorRes] = await Promise.all([
    db
      .schema("tranqui_legal")
      .from("trq_cita")
      .select(
        "cit_id, cit_caso_id, cit_cliente_id, cit_abogado_id, cit_inicio_en, cit_modalidad, cit_estado, cit_motivo, cit_notas",
      )
      .eq("cit_id", d.cita_id)
      .maybeSingle(),
    db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo")
      .eq("usu_id", actorId)
      .maybeSingle(),
  ]);

  const citaActual = citaRes.data;
  if (!citaActual) {
    return { ok: false, error: "No se encontró la cita seleccionada." };
  }

  const autorNombre =
    [actorRes.data?.usu_nombres, actorRes.data?.usu_apellidos].filter(Boolean).join(" ").trim() ||
    actorRes.data?.usu_correo ||
    "Abogado";

  const ahoraIso = new Date().toISOString();
  let casoIdFinal: string | null = citaActual.cit_caso_id ?? null;

  // 1. Si se solicitó crear un Nuevo Caso / Proceso Judicial desde la consulta
  if (d.accion_caso === "crear_nuevo" && d.nuevo_caso_titulo?.trim()) {
    const eventoApertura: EventoLineaTiempoCaso = {
      id: crypto.randomUUID(),
      fecha: ahoraIso,
      tipo: "HITO",
      titulo: `Apertura de caso desde consulta jurídica: ${d.nuevo_caso_titulo.trim()}`,
      detalle:
        d.nuevo_caso_descripcion?.trim() ||
        citaActual.cit_motivo ||
        "Expediente abierto por el abogado asignado.",
      responsable_nombre: autorNombre,
      responsable_rol: "ABOGADO",
      cita_id: d.cita_id,
    };

    const docsNormalizados: DocumentoAdjuntoCita[] = (d.documentos_adjuntos ?? []).map((doc) => ({
      ...doc,
      subido_por_nombre: doc.subido_por_nombre || autorNombre,
      fecha: doc.fecha || ahoraIso,
    }));

    const { data: nuevoCaso, error: errNuevoCaso } = await db
      .schema("tranqui_legal")
      .from("trq_caso_judicial")
      .insert({
        cas_cliente_id: citaActual.cit_cliente_id,
        cas_abogado_id: citaActual.cit_abogado_id,
        cas_materia_id: null,
        cas_titulo: d.nuevo_caso_titulo.trim(),
        cas_descripcion: d.nuevo_caso_descripcion?.trim() || citaActual.cit_motivo || null,
        cas_estado: "en_curso",
        cas_prioridad: d.nuevo_caso_prioridad || "normal",
        cas_numero_proceso: d.nuevo_caso_numero_proceso?.trim() || null,
        cas_detalle_caso: {
          documentos: docsNormalizados,
          linea_tiempo: [eventoApertura],
        } as never,
        cas_abierto_en: ahoraIso,
        cas_creado_en: ahoraIso,
        cas_actualizado_en: ahoraIso,
      })
      .select("cas_id")
      .single();

    if (errNuevoCaso || !nuevoCaso) {
      return {
        ok: false,
        error: comoError(errNuevoCaso?.message ?? "No se pudo crear el expediente del caso."),
      };
    }

    casoIdFinal = nuevoCaso.cas_id;
  } else if (d.accion_caso === "vincular_existente" && d.caso_id_existente) {
    casoIdFinal = d.caso_id_existente;
  }

  // 2. Si hay un caso vinculado, sincronizar documentos adjuntos y línea de tiempo del caso
  if (casoIdFinal) {
    const { data: casoActual } = await db
      .schema("tranqui_legal")
      .from("trq_caso_judicial")
      .select("cas_id, cas_titulo, cas_detalle_caso")
      .eq("cas_id", casoIdFinal)
      .maybeSingle();

    if (casoActual) {
      const detCaso = ((casoActual.cas_detalle_caso ?? {}) as Record<string, unknown>) || {};
      const docsPrevios = Array.isArray(detCaso.documentos)
        ? (detCaso.documentos as DocumentoAdjuntoCita[])
        : [];
      const timelinePrevio = Array.isArray(detCaso.linea_tiempo)
        ? (detCaso.linea_tiempo as EventoLineaTiempoCaso[])
        : [];

      const idsDocsPrevios = new Set(docsPrevios.map((x) => x.id));
      const docsNuevos = (d.documentos_adjuntos ?? [])
        .filter((x) => !idsDocsPrevios.has(x.id))
        .map((x) => ({
          ...x,
          subido_por_nombre: x.subido_por_nombre || autorNombre,
          fecha: x.fecha || ahoraIso,
        }));

      const nuevosEventosTimeline: EventoLineaTiempoCaso[] = [];
      if (d.nuevo_evento_timeline?.titulo) {
        nuevosEventosTimeline.push({
          id: crypto.randomUUID(),
          fecha: ahoraIso,
          tipo: d.nuevo_evento_timeline.tipo,
          titulo: d.nuevo_evento_timeline.titulo.trim(),
          detalle: d.nuevo_evento_timeline.detalle?.trim() || null,
          responsable_nombre: d.nuevo_evento_timeline.responsable_nombre?.trim() || autorNombre,
          responsable_rol: d.nuevo_evento_timeline.responsable_rol || "ABOGADO",
          cita_id: d.cita_id,
        });
      }

      if (d.notas_reunion?.trim() && !d.nuevo_evento_timeline?.titulo) {
        nuevosEventosTimeline.push({
          id: crypto.randomUUID(),
          fecha: ahoraIso,
          tipo: "CONSULTA",
          titulo: "Acta y gestión de consulta jurídica registrada",
          detalle: d.notas_reunion.trim().slice(0, 500),
          responsable_nombre: autorNombre,
          responsable_rol: "ABOGADO",
          cita_id: d.cita_id,
        });
      }

      for (const docNuevo of docsNuevos) {
        nuevosEventosTimeline.push({
          id: crypto.randomUUID(),
          fecha: ahoraIso,
          tipo: "DOCUMENTO",
          titulo: `Documento incorporado al caso: ${docNuevo.nombre} (${docNuevo.tipo})`,
          detalle: docNuevo.notas || docNuevo.url_o_referencia || null,
          responsable_nombre: autorNombre,
          responsable_rol: "ABOGADO",
          cita_id: d.cita_id,
        });
      }

      await db
        .schema("tranqui_legal")
        .from("trq_caso_judicial")
        .update({
          cas_detalle_caso: {
            ...detCaso,
            documentos: [...docsNuevos, ...docsPrevios],
            linea_tiempo: [...nuevosEventosTimeline, ...timelinePrevio].slice(0, 200),
          } as never,
          cas_actualizado_en: ahoraIso,
        })
        .eq("cas_id", casoIdFinal);
    }
  }

  // 3. Actualizar la fila trq_cita (notas, caso_id y estado si se marcó realizada)
  const cambiosCita: {
    cit_notas: string | null;
    cit_caso_id: string | null;
    cit_actualizado_en: string;
    cit_estado?: string;
  } = {
    cit_notas: d.notas_reunion?.trim() || citaActual.cit_notas || null,
    cit_caso_id: casoIdFinal,
    cit_actualizado_en: ahoraIso,
  };
  if (d.marcar_realizada) {
    cambiosCita.cit_estado = "realizada";
  }

  await db.schema("tranqui_legal").from("trq_cita").update(cambiosCita).eq("cit_id", d.cita_id);

  // 4. Registrar en gestiones_citas[citaId] y en su log de eventos
  const resumenLog =
    d.accion_caso === "crear_nuevo" && d.nuevo_caso_titulo
      ? `Apertura de caso "${d.nuevo_caso_titulo}" y registro de gestión de reunión`
      : d.accion_caso === "vincular_existente"
      ? `Consulta vinculada a expediente de caso y gestión actualizada`
      : d.marcar_realizada
      ? `Reunión finalizada y acta registrada (${d.siguientes_pasos.length} siguientes pasos, ${d.documentos_adjuntos.length} documentos)`
      : `Gestión de reunión actualizada (${d.siguientes_pasos.length} siguientes pasos, ${d.documentos_adjuntos.length} documentos)`;

  await registrarEventoYEstadoGestionCita(db, d.cita_id, {
    notas_reunion: d.notas_reunion?.trim() || null,
    siguientes_pasos: d.siguientes_pasos,
    documentos_adjuntos: (d.documentos_adjuntos ?? []).map((doc) => ({
      ...doc,
      subido_por_nombre: doc.subido_por_nombre || autorNombre,
      fecha: doc.fecha || ahoraIso,
    })),
    evento: {
      id: crypto.randomUUID(),
      fecha: ahoraIso,
      tipo:
        d.accion_caso === "crear_nuevo" || d.accion_caso === "vincular_existente"
          ? "VINCULACION_CASO"
          : "GESTION_REUNION",
      autor_nombre: autorNombre,
      autor_rol: "ABOGADO",
      resumen: resumenLog,
      mensaje: d.notas_reunion?.trim() ? d.notas_reunion.trim().slice(0, 240) : null,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/agendamiento");
  revalidatePath("/panel/mis-citas");
  revalidatePath("/panel/agenda/asignaciones");
  return { ok: true, data: { caso_id: casoIdFinal } };
}

export async function subirArchivoRespaldoCitaAction(
  formData: FormData,
): Promise<Resultado<{ documento: DocumentoAdjuntoCita }>> {
  try {
    const citaId = String(formData.get("cita_id") ?? "").trim();
    const archivo = formData.get("archivo") as File | null;
    const tipoRaw = String(formData.get("tipo") ?? "prueba").trim();
    const notas = String(formData.get("notas") ?? "").trim() || null;

    if (!citaId || !archivo || typeof archivo.arrayBuffer !== "function") {
      return { ok: false, error: "Selecciona un archivo válido para adjuntar a la cita." };
    }

    if (archivo.size > 20 * 1024 * 1024) {
      return { ok: false, error: "El archivo supera el tamaño máximo permitido (20 MB)." };
    }

    const supabase = await crearClienteServidor();
    const db = crearClienteAdmin() ?? supabase;
    const { data: authData } = await supabase.auth.getUser();
    const actorId = authData.user?.id ?? null;
    if (!actorId) {
      return { ok: false, error: "Debes iniciar sesión para adjuntar respaldos a la cita." };
    }

    const { data: actorUsu } = await db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo")
      .eq("usu_id", actorId)
      .maybeSingle();

    const autorNombre =
      [actorUsu?.usu_nombres, actorUsu?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      actorUsu?.usu_correo ||
      "Abogado";

    const nombreOriginal = archivo.name || "respaldo.pdf";
    const nombreSanitizado = nombreOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const rutaStorage = `citas-respaldos/${citaId}/${Date.now()}-${nombreSanitizado}`;

    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = archivo.type || "application/octet-stream";

    let urlFinal: string | null = null;

    const { error: errStorage } = await db.storage
      .from("socios-documentos")
      .upload(rutaStorage, buffer, {
        contentType,
        upsert: true,
      });

    if (!errStorage) {
      const { data: signedData } = await db.storage
        .from("socios-documentos")
        .createSignedUrl(rutaStorage, 60 * 60 * 24 * 365);
      if (signedData?.signedUrl) {
        urlFinal = signedData.signedUrl;
      } else {
        const { data: pubData } = db.storage.from("socios-documentos").getPublicUrl(rutaStorage);
        urlFinal = pubData?.publicUrl ?? rutaStorage;
      }
    } else if (archivo.size <= 4 * 1024 * 1024) {
      urlFinal = `data:${contentType};base64,${buffer.toString("base64")}`;
    } else {
      return { ok: false, error: `No se pudo subir el archivo: ${errStorage.message}` };
    }

    const tiposValidos: DocumentoAdjuntoCita["tipo"][] = [
      "contrato",
      "minuta",
      "notificacion",
      "prueba",
      "escrito",
      "cedula",
      "otro",
    ];
    const tipoDoc: DocumentoAdjuntoCita["tipo"] = tiposValidos.includes(
      tipoRaw as DocumentoAdjuntoCita["tipo"],
    )
      ? (tipoRaw as DocumentoAdjuntoCita["tipo"])
      : "prueba";

    const ahoraIso = new Date().toISOString();
    const nuevoDoc: DocumentoAdjuntoCita = {
      id: crypto.randomUUID(),
      nombre: nombreOriginal,
      tipo: tipoDoc,
      url_o_referencia: urlFinal,
      subido_por_nombre: autorNombre,
      fecha: ahoraIso,
      notas,
    };

    // Persistir inmediatamente en gestiones_citas[citaId] y en el historial de la cita
    const { data: cfgRow } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", NEGOCIO)
      .maybeSingle();

    const detPrevio = ((cfgRow?.cfg_detalle_configuracion ?? {}) as Record<string, unknown>) || {};
    const gestionesPrevias =
      ((detPrevio.gestiones_citas ?? {}) as Record<string, GestionReunionCita>) || {};
    const actualGestion = gestionesPrevias[citaId];
    const docsPrevios = Array.isArray(actualGestion?.documentos_adjuntos)
      ? actualGestion.documentos_adjuntos
      : [];

    await registrarEventoYEstadoGestionCita(db, citaId, {
      documentos_adjuntos: [nuevoDoc, ...docsPrevios],
      evento: {
        id: crypto.randomUUID(),
        fecha: ahoraIso,
        tipo: "DOCUMENTO",
        autor_nombre: autorNombre,
        autor_rol: "ABOGADO",
        resumen: `Respaldo adjuntado: ${nombreOriginal} (${tipoDoc})`,
        mensaje: notas,
      },
    });

    revalidatePath("/panel/agendamiento");
    revalidatePath("/panel/agenda");
    revalidatePath("/panel/mis-citas");
    return { ok: true, data: { documento: nuevoDoc } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo adjuntar el archivo de respaldo.",
    };
  }
}

export async function obtenerAgendaAbogadoWidgetAction() {
  try {
    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const finMes = new Date(ahora.getTime() + 45 * 24 * 60 * 60 * 1000);
    const [citas, agenda] = await Promise.all([
      listarAgendaDelAbogado(desde, finMes),
      obtenerMiAgenda(),
    ]);
    return {
      ok: true as const,
      data: {
        citas,
        sinConfigurar: !agenda || !agenda.profesional.agp_configurada_en,
      },
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudo cargar tu agenda.",
    };
  }
}

export async function obtenerAsignacionesWidgetAction() {
  try {
    const datos = await listarCitasCalendarioOperador();
    return {
      ok: true as const,
      data: datos,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "No se pudieron cargar las citas y asignaciones.",
    };
  }
}
