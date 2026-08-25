import type { Herramienta } from "@eco/agentes-ia";
import type { ContextoAsistente } from "./contexto";
import { campos, dinero, fechaEcuador, fechaHoraEcuador, lista } from "./formato";

// Herramientas del copiloto del ABOGADO (agente "Tranqi Asistente Abogado").
//
// El prompt del agente dice: "Operas EXCLUSIVAMENTE sobre los casos asignados a
// este abogado". Aqui eso deja de ser una instruccion y pasa a ser un hecho: las
// politicas RLS de trq_caso_judicial, trq_cita y trq_honorario filtran por
// tranqui_legal.trq_fn_abogado_actual(), que resuelve el abogado desde el JWT.
// Un caso de otro colega no aparece aunque el modelo pida su id.

type HerramientaAbogado = Herramienta<ContextoAsistente>;

const SIN_PROPIEDADES = { type: "object", properties: {} } as const;

/** Rango [inicio, fin) de un dia completo en hora de Ecuador continental (UTC-5). */
function diaEcuador(fecha: string | undefined): { desde: string; hasta: string; etiqueta: string } {
  const base = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? fecha
    : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
  // Ecuador continental no aplica horario de verano, asi que el desfase es
  // constante y se puede fijar. Galapagos (UTC-6) no se contempla aqui: la
  // agenda de la red se lleva en hora continental.
  const desde = new Date(`${base}T00:00:00-05:00`);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta: base };
}

const casosAsignados: HerramientaAbogado = {
  descripcion:
    "Lista los casos asignados a este abogado. Usala para 'mis casos', 'que tengo " +
    "abierto', o antes de responder cualquier cosa sobre un expediente concreto.",
  esquema: {
    type: "object",
    properties: {
      estado: {
        type: "string",
        enum: ["nuevo", "asignado", "en_curso", "suspendido", "cerrado"],
        description: "Filtra por estado. Omitelo para verlos todos.",
      },
      prioridad: { type: "string", enum: ["normal", "alta", "urgente"] },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    let consulta = supabase
      .schema("tranqui_legal")
      .from("trq_caso_judicial")
      // De una pieza: ver la nota en herramientas-cliente.ts.
      .select(
        "cas_id, cas_secuencial, cas_titulo, cas_estado, cas_prioridad, cas_numero_proceso, cas_abierto_en, trq_materia(mat_nombre)",
      )
      .is("cas_eliminado_en", null)
      .order("cas_prioridad", { ascending: false })
      .order("cas_abierto_en", { ascending: false })
      .limit(40);

    if (typeof argumentos.estado === "string") consulta = consulta.eq("cas_estado", argumentos.estado);
    if (typeof argumentos.prioridad === "string") {
      consulta = consulta.eq("cas_prioridad", argumentos.prioridad);
    }

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return lista(
      "Casos asignados",
      data,
      "No hay casos asignados a este abogado.",
      (c: Record<string, unknown>) =>
        `- [${c.cas_id}] #${c.cas_secuencial} ${c.cas_titulo} — ` +
        campos([
          ["estado", c.cas_estado],
          ["prioridad", c.cas_prioridad],
          ["materia", (c.trq_materia as { mat_nombre?: string } | null)?.mat_nombre],
          ["proceso", c.cas_numero_proceso],
        ]),
    );
  },
};

const agendaDelDia: HerramientaAbogado = {
  descripcion:
    "Citas del abogado en un dia concreto, en orden. Es lo que hay que consultar " +
    "cuando pregunte 'como viene el dia', 'que tengo hoy' o por una fecha.",
  esquema: {
    type: "object",
    properties: {
      fecha: {
        type: "string",
        description: "Dia en formato AAAA-MM-DD, hora de Ecuador. Omitelo para hoy.",
      },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    const fecha = typeof argumentos.fecha === "string" ? argumentos.fecha : undefined;
    const { desde, hasta, etiqueta } = diaEcuador(fecha);

    const { data, error } = await supabase
      .schema("tranqui_legal")
      .from("trq_cita")
      .select(
        "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_enlace, cit_lugar, cit_caso_id",
      )
      .gte("cit_inicio_en", desde)
      .lt("cit_inicio_en", hasta)
      .neq("cit_estado", "cancelada")
      .is("cit_eliminado_en", null)
      .order("cit_inicio_en", { ascending: true });
    if (error) throw new Error(error.message);

    return lista(
      `Agenda del ${etiqueta}`,
      data,
      `No hay citas agendadas para el ${etiqueta}.`,
      (c: Record<string, unknown>) =>
        `- ${fechaHoraEcuador(c.cit_inicio_en as string)} — ` +
        campos([
          ["modalidad", c.cit_modalidad],
          ["estado", c.cit_estado],
          ["motivo", c.cit_motivo],
          ["caso", c.cit_caso_id],
          ["enlace", c.cit_enlace],
          ["lugar", c.cit_lugar],
        ]),
    );
  },
};

const documentosDelCaso: HerramientaAbogado = {
  descripcion:
    "Documentos del expediente de un caso asignado, con su estado de revision. " +
    "Devuelve METADATOS, no el contenido: si necesitas leer un documento, dilo, no " +
    "supongas lo que dice a partir del nombre del archivo.",
  esquema: {
    type: "object",
    properties: {
      caso_id: { type: "string", description: "El cas_id devuelto por casos_asignados." },
    },
    required: ["caso_id"],
  },
  async ejecutar(argumentos, { supabase }) {
    const casoId = argumentos.caso_id;
    if (typeof casoId !== "string") throw new Error("Falta caso_id.");

    const { data, error } = await supabase
      .schema("tranqui_legal")
      .from("trq_documento_caso")
      .select(
        "dcc_id, dcc_tipo, dcc_nombre_archivo, dcc_mime, dcc_estado_revision, dcc_dictaminado_en, dcc_creado_en",
      )
      .eq("dcc_caso_id", casoId)
      .is("dcc_eliminado_en", null)
      .order("dcc_creado_en", { ascending: false });
    if (error) throw new Error(error.message);

    return lista(
      "Documentos del expediente",
      data,
      "No hay documentos en ese expediente, o el caso no esta asignado a este abogado.",
      (d: Record<string, unknown>) =>
        `- [${d.dcc_id}] ${d.dcc_nombre_archivo ?? "(sin nombre)"} — ` +
        campos([
          ["tipo", d.dcc_tipo],
          ["revision", d.dcc_estado_revision],
          ["dictaminado", d.dcc_dictaminado_en ? fechaEcuador(d.dcc_dictaminado_en as string) : null],
          ["cargado", fechaEcuador(d.dcc_creado_en as string)],
        ]),
    );
  },
};

const plazosProximos: HerramientaAbogado = {
  descripcion:
    "Citas y vencimientos de los proximos dias, para sacar a primer plano lo que " +
    "corre prisa. El prompt te pide avisar de un termino proximo aunque no te lo " +
    "hayan preguntado: esta es la herramienta para comprobarlo.",
  esquema: {
    type: "object",
    properties: {
      dias: { type: "integer", description: "Ventana en dias hacia adelante. Por defecto 7." },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    const dias =
      typeof argumentos.dias === "number" && argumentos.dias > 0 && argumentos.dias <= 90
        ? Math.floor(argumentos.dias)
        : 7;
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .schema("tranqui_legal")
      .from("trq_cita")
      .select("cit_inicio_en, cit_modalidad, cit_estado, cit_motivo, cit_caso_id")
      .gte("cit_inicio_en", ahora.toISOString())
      .lte("cit_inicio_en", limite.toISOString())
      .neq("cit_estado", "cancelada")
      .is("cit_eliminado_en", null)
      .order("cit_inicio_en", { ascending: true });
    if (error) throw new Error(error.message);

    const citas = lista(
      `Citas en los proximos ${dias} dias`,
      data,
      `No hay citas en los proximos ${dias} dias.`,
      (c: Record<string, unknown>) =>
        `- ${fechaHoraEcuador(c.cit_inicio_en as string)} — ` +
        campos([
          ["estado", c.cit_estado],
          ["motivo", c.cit_motivo],
          ["caso", c.cit_caso_id],
        ]),
    );

    // Honesto sobre el limite: hoy solo hay citas. Los terminos procesales
    // dependen de trq_caso_judicial.cas_detalle_caso, que todavia no los
    // modela. Decirlo evita que el modelo afirme "no tienes plazos pendientes"
    // cuando en realidad nadie los esta guardando.
    return (
      `${citas}\n\n` +
      "Nota para ti, no para el abogado: los terminos procesales todavia no se " +
      "registran en el sistema, asi que esta consulta solo cubre citas. No afirmes " +
      "que no hay plazos pendientes; si el tema sale, di que los plazos hay que " +
      "verificarlos en el expediente judicial."
    );
  },
};

const misHonorarios: HerramientaAbogado = {
  descripcion:
    "Honorarios del abogado, con su estado de liquidacion. Usala para 'cuanto me " +
    "toca', 'mis honorarios' o preguntas sobre su cuenta digital.",
  esquema: {
    type: "object",
    properties: {
      periodo: {
        type: "string",
        description: "Mes en formato AAAA-MM. Omitelo para ver los ultimos movimientos.",
      },
      estado: { type: "string", enum: ["pendiente", "aprobado", "liquidado", "rechazado"] },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    let consulta = supabase
      .schema("tranqui_legal")
      .from("trq_honorario")
      .select("hon_secuencial, hon_concepto, hon_monto, hon_moneda, hon_estado, hon_periodo, hon_caso_id")
      .is("hon_eliminado_en", null)
      .order("hon_periodo", { ascending: false })
      .limit(50);

    const periodo = argumentos.periodo;
    if (typeof periodo === "string") {
      if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error("El periodo debe ser AAAA-MM.");
      consulta = consulta.eq("hon_periodo", `${periodo}-01`);
    }
    if (typeof argumentos.estado === "string") consulta = consulta.eq("hon_estado", argumentos.estado);

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return "No hay honorarios registrados para ese criterio.";

    const total = data.reduce((suma, h) => suma + Number(h.hon_monto), 0);
    const detalle = data
      .map(
        (h) =>
          `- #${h.hon_secuencial} ${h.hon_concepto} — ` +
          campos([
            ["monto", dinero(h.hon_monto, h.hon_moneda)],
            ["estado", h.hon_estado],
            ["periodo", h.hon_periodo],
            ["caso", h.hon_caso_id],
          ]),
      )
      .join("\n");

    return `Honorarios (${data.length}):\n${detalle}\n\nSuma de lo listado: ${dinero(total)}`;
  },
};

const miFicha: HerramientaAbogado = {
  descripcion: "Datos del abogado con el que estas hablando: nombre, correo y estado en la red.",
  esquema: SIN_PROPIEDADES,
  async ejecutar(_argumentos, { supabase, sesion }) {
    const { data: usuario } = await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo")
      .eq("usu_id", sesion.usuarioId)
      .maybeSingle();

    const { data: abogado } = await supabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_estado, abg_verificado_en, abg_mfa_verificado")
      .maybeSingle();

    return campos([
      ["nombre", [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ")],
      ["correo", usuario?.usu_correo],
      ["estado en la red", abogado?.abg_estado],
      ["verificado", abogado ? fechaEcuador(abogado.abg_verificado_en) : null],
      ["MFA configurado", abogado ? (abogado.abg_mfa_verificado ? "si" : "no") : null],
    ]);
  },
};

export const HERRAMIENTAS_ABOGADO: Record<string, HerramientaAbogado> = {
  casos_asignados: casosAsignados,
  agenda_del_dia: agendaDelDia,
  documentos_del_caso: documentosDelCaso,
  plazos_proximos: plazosProximos,
  mis_honorarios: misHonorarios,
  mi_ficha: miFicha,
};
