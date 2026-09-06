import type { Herramienta } from "@eco/agentes-ia";
import { DIAS_SEMANA, describirAgenda, esquemaAgendaCompleta } from "@eco/agenda";
import type { ContextoAsistente } from "./contexto";
import { campos, fechaHoraEcuador, lista } from "./formato";
import { esquemaPendiente } from "../agenda/puente-tipos";

// Herramientas de AGENDA del asistente del abogado (TRQ-ABG-004 / PLT-020).
//
// Aqui vive el onboarding conversacional de las horas operativas: cuando
// `mi_disponibilidad` responde que no hay agenda, el agente la levanta
// preguntando, y solo escribe tras repetir el resumen y obtener un si
// explicito. Escribir la agenda de alguien sin que lo confirme es cambiarle la
// semana laboral por su cuenta.

type HerramientaAbogado = Herramienta<ContextoAsistente>;

const NEGOCIO = "tranqi";
const SIN_PROPIEDADES = { type: "object", properties: {} } as const;

const miDisponibilidad: HerramientaAbogado = {
  descripcion:
    "Devuelve las horas operativas del abogado: dias, horarios, duracion de cita y " +
    "antelacion. Si responde que no hay agenda configurada, ofrecete a configurarla " +
    "preguntando dias, horario, duracion, modalidad y antelacion; al final repite el " +
    "resumen y espera su confirmacion antes de llamar a configurar_disponibilidad.",
  esquema: SIN_PROPIEDADES,
  async ejecutar(_argumentos, { supabase }) {
    const { data: prof, error } = await esquemaPendiente(supabase, "comun_agenda")
      .from("age_profesional")
      .select(
        "agp_id, agp_zona_horaria, agp_duracion_cita_min, agp_holgura_min, agp_antelacion_minima_horas, " +
          "agp_horizonte_dias, agp_modalidades, agp_acepta_turno, agp_direccion, agp_configurada_en, " +
          "agp_google_calendar_id",
      )
      .eq("agp_negocio", NEGOCIO)
      .is("agp_eliminado_en", null)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!prof || !prof.agp_configurada_en) {
      return (
        "Todavia no tiene agenda configurada, asi que no aparece disponible para " +
        "ningun afiliado ni entra en el reparto de turnos. Preguntale: que dias " +
        "atiende, en que horario, cuanto quiere que dure una consulta, si atiende " +
        "presencial y donde, y con cuanta antelacion necesita que le reserven. " +
        "Luego repite el resumen completo y pide confirmacion."
      );
    }

    const { data: franjas } = await esquemaPendiente(supabase, "comun_agenda")
      .from("age_franja")
      .select("fra_dia_semana, fra_hora_inicio, fra_hora_fin, fra_modalidad")
      .eq("fra_profesional_id", prof.agp_id)
      .is("fra_eliminado_en", null)
      .order("fra_dia_semana")
      .order("fra_hora_inicio");

    const horario = lista(
      "Horas operativas",
      franjas,
      "No tiene ninguna franja activa: sin franjas no se genera ni un hueco, aunque la agenda este configurada.",
      (f: { fra_dia_semana: number; fra_hora_inicio: string; fra_hora_fin: string; fra_modalidad: string }) =>
        `- ${DIAS_SEMANA[f.fra_dia_semana]} ${f.fra_hora_inicio.slice(0, 5)}–${f.fra_hora_fin.slice(0, 5)} (${f.fra_modalidad})`,
    );

    return [
      horario,
      campos([
        ["duración de cita", `${prof.agp_duracion_cita_min} min`],
        ["descanso entre citas", `${prof.agp_holgura_min} min`],
        ["antelación mínima", `${prof.agp_antelacion_minima_horas} h`],
        ["horizonte", `${prof.agp_horizonte_dias} días`],
        ["modalidades", (prof.agp_modalidades ?? []).join(", ")],
        ["zona horaria", prof.agp_zona_horaria],
        ["recibe turnos", prof.agp_acepta_turno ? "sí" : "no"],
        ["dirección", prof.agp_direccion],
        ["Google Calendar", prof.agp_google_calendar_id ? "conectado" : "sin conectar"],
      ]),
    ].join("\n");
  },
};

const configurarDisponibilidad: HerramientaAbogado = {
  descripcion:
    "Escribe las horas operativas del abogado. REEMPLAZA la configuracion anterior " +
    "por completo, asi que manda siempre todas las franjas, no solo las nuevas. " +
    "NO la llames sin haber repetido el resumen al abogado y recibido un si explicito.",
  esquema: {
    type: "object",
    properties: {
      franjas: {
        type: "array",
        description: "Todas las franjas de la semana. Reemplazan a las anteriores.",
        items: {
          type: "object",
          properties: {
            dia_semana: { type: "number", description: "0 domingo, 1 lunes, ... 6 sábado." },
            hora_inicio: { type: "string", description: "HH:MM en hora local del despacho, p. ej. 09:00." },
            hora_fin: { type: "string", description: "HH:MM, posterior a hora_inicio." },
            modalidad: { type: "string", enum: ["virtual", "presencial", "ambas"] },
          },
          required: ["dia_semana", "hora_inicio", "hora_fin"],
        },
      },
      duracion_cita_min: { type: "number", description: "Duración de una consulta. Por defecto 45." },
      holgura_min: { type: "number", description: "Descanso entre citas. Por defecto 15." },
      antelacion_minima_horas: { type: "number", description: "Antelación mínima para reservarle. Por defecto 24." },
      horizonte_dias: { type: "number", description: "Hasta cuántos días se puede reservar. Por defecto 60." },
      modalidades: { type: "array", items: { type: "string", enum: ["virtual", "presencial"] } },
      acepta_turno: { type: "boolean", description: "Si entra en el reparto automático de casos." },
      direccion: { type: "string", description: "Dirección del despacho, si atiende presencial." },
      zona_horaria: { type: "string", description: "IANA. Solo si no es America/Guayaquil (p. ej. Pacific/Galapagos)." },
    },
    required: ["franjas"],
  },
  async ejecutar(argumentos, { supabase }) {
    const validado = esquemaAgendaCompleta.safeParse({
      configuracion: {
        zona_horaria: argumentos.zona_horaria ?? "America/Guayaquil",
        duracion_cita_min: argumentos.duracion_cita_min ?? 45,
        holgura_min: argumentos.holgura_min ?? 15,
        antelacion_minima_horas: argumentos.antelacion_minima_horas ?? 24,
        horizonte_dias: argumentos.horizonte_dias ?? 60,
        modalidades: argumentos.modalidades ?? ["virtual", "presencial"],
        acepta_turno: argumentos.acepta_turno ?? true,
        direccion: argumentos.direccion ?? null,
      },
      franjas: argumentos.franjas ?? [],
    });
    if (!validado.success) {
      // El texto lo lee el modelo: se le devuelve el motivo concreto para que
      // lo aclare con el abogado, no un volcado de Zod.
      throw new Error(
        `No puedo guardar esa agenda: ${validado.error.issues.map((i) => i.message).join("; ")}. ` +
          `Aclaralo con el abogado y vuelve a intentarlo.`,
      );
    }

    const { configuracion, franjas } = validado.data;
    const { error } = await esquemaPendiente(supabase, "comun_agenda").rpc("age_fn_configurar_agenda", {
      p_negocio: NEGOCIO,
      p_config: configuracion,
      p_franjas: franjas,
    });
    if (error) throw new Error(error.message);

    return `Agenda guardada. ${describirAgenda(validado.data)}`;
  },
};

const bloquearAgenda: HerramientaAbogado = {
  descripcion:
    "Bloquea un rango de la agenda del abogado: una audiencia, un viaje, vacaciones. " +
    "Durante ese rango no se le puede reservar. Confirma fechas con el antes de llamarla.",
  esquema: {
    type: "object",
    properties: {
      inicio_en: { type: "string", description: "ISO-8601 con zona horaria." },
      fin_en: { type: "string", description: "ISO-8601 con zona horaria, posterior al inicio." },
      motivo: { type: "string", description: "Audiencia, vacaciones, capacitación…" },
      es_audiencia: { type: "boolean", description: "true si es una diligencia judicial." },
    },
    required: ["inicio_en", "fin_en"],
  },
  async ejecutar(argumentos, { supabase }) {
    const { inicio_en: inicioEn, fin_en: finEn, motivo, es_audiencia: esAudiencia } = argumentos;
    if (typeof inicioEn !== "string" || typeof finEn !== "string") {
      throw new Error("Faltan inicio_en o fin_en.");
    }
    const inicio = new Date(inicioEn);
    const fin = new Date(finEn);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      throw new Error("No entiendo esas fechas. Usa ISO-8601 con zona horaria.");
    }
    if (fin <= inicio) throw new Error("El bloqueo termina antes de empezar. Confirma las fechas.");

    const { error } = await esquemaPendiente(supabase, "comun_agenda").rpc("age_fn_bloquear", {
      p_negocio: NEGOCIO,
      p_inicio: inicio.toISOString(),
      p_fin: fin.toISOString(),
      p_motivo: typeof motivo === "string" ? motivo : null,
      p_origen: esAudiencia === true ? "audiencia" : "manual",
    });
    if (error) throw new Error(error.message);

    return `Agenda bloqueada del ${fechaHoraEcuador(inicio.toISOString())} al ${fechaHoraEcuador(fin.toISOString())}. Nadie podra reservarle en ese rango.`;
  },
};

const citasPendientes: HerramientaAbogado = {
  descripcion:
    "Lista las citas que le asignaron y siguen sin confirmar. Usala cuando pregunte " +
    "que tiene pendiente o que le llego.",
  esquema: SIN_PROPIEDADES,
  async ejecutar(_argumentos, { supabase }) {
    const { data, error } = await esquemaPendiente(supabase, "tranqui_legal")
      .from("trq_cita")
      .select("cit_id, cit_inicio_en, cit_modalidad, cit_motivo, cit_cobertura")
      .eq("cit_estado", "propuesta")
      .is("cit_eliminado_en", null)
      .gte("cit_inicio_en", new Date().toISOString())
      .order("cit_inicio_en")
      .limit(25);
    if (error) throw new Error(error.message);

    return lista(
      "Citas pendientes de confirmar",
      data,
      "No tiene ninguna cita pendiente de confirmar.",
      (c: { cit_id: string; cit_inicio_en: string; cit_modalidad: string; cit_motivo: string | null }) =>
        `- ${fechaHoraEcuador(c.cit_inicio_en)} (${c.cit_modalidad}) · ${c.cit_motivo ?? "sin motivo"} · id ${c.cit_id}`,
    );
  },
};

const decidirCita: HerramientaAbogado = {
  descripcion:
    "Confirma, reagenda, cancela o cierra una cita del abogado. Pide confirmacion " +
    "explicita antes de llamarla. Si CANCELA, avisale de que la cita del afiliado no " +
    "se cancela: pasa a la mesa del operador para reasignarla a otro abogado.",
  esquema: {
    type: "object",
    properties: {
      cita_id: { type: "string", description: "cit_id, de citas_pendientes_de_confirmar o agenda_del_dia." },
      decision: {
        type: "string",
        enum: ["confirmar", "reagendar", "cancelar", "marcar_realizada", "marcar_no_asistio"],
      },
      nuevo_inicio: { type: "string", description: "Solo para reagendar: ISO-8601 con zona horaria." },
      motivo: { type: "string", description: "Motivo, en palabras del abogado." },
    },
    required: ["cita_id", "decision"],
  },
  async ejecutar(argumentos, { supabase }) {
    const { cita_id: citaId, decision, nuevo_inicio: nuevoInicio, motivo } = argumentos;
    if (typeof citaId !== "string") throw new Error("Falta cita_id.");
    if (typeof decision !== "string") throw new Error("Falta la decision.");
    if (decision === "reagendar" && typeof nuevoInicio !== "string") {
      throw new Error("Para reagendar necesito nuevo_inicio. Preguntale al abogado a que hora la mueve.");
    }

    const { data, error } = await esquemaPendiente(supabase, "tranqui_legal").rpc("trq_fn_decidir_cita", {
      p_cita_id: citaId,
      p_decision: decision,
      p_nuevo_inicio: typeof nuevoInicio === "string" ? new Date(nuevoInicio).toISOString() : null,
      p_motivo: typeof motivo === "string" ? motivo : null,
    });
    if (error) throw new Error(error.message);

    if (data === "contingencia") {
      return (
        "Cita liberada. El afiliado conserva su cita: pasa a la mesa del operador " +
        "para que la reasigne a otro abogado sin cancelarsela."
      );
    }
    return `Cita ${data}.`;
  },
};

export const HERRAMIENTAS_ABOGADO_AGENDA: Record<string, HerramientaAbogado> = {
  mi_disponibilidad: miDisponibilidad,
  configurar_disponibilidad: configurarDisponibilidad,
  bloquear_agenda: bloquearAgenda,
  citas_pendientes_de_confirmar: citasPendientes,
  decidir_cita: decidirCita,
};
