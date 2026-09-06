import type { Herramienta } from "@eco/agentes-ia";
import type { ContextoAsistente } from "./contexto";
import { campos, fechaHoraEcuador, lista } from "./formato";
import { HERRAMIENTAS_CLIENTE_AGENDA } from "./herramientas-cliente-agenda";

// Herramientas del asistente del AFILIADO (TRQ_CLIENTE, agente
// "Tranqi Asistente Cliente").
//
// REGLA QUE NO SE ROMPE: ninguna herramienta acepta un identificador de
// usuario, cedula ni correo. La identidad sale del contexto, que viene de una
// capsula firmada por la app. Las que si aceptan un `caso_id` no son una
// excepcion: ese id lo elige el modelo, pero la consulta va bajo el JWT del
// usuario y RLS solo devuelve filas suyas. Un id ajeno no da error, da vacio,
// que es la forma correcta de fallar (no confirma que ese caso exista).

type HerramientaCliente = Herramienta<ContextoAsistente>;

const SIN_PROPIEDADES = { type: "object", properties: {} } as const;

const misCasos: HerramientaCliente = {
  descripcion:
    "Lista los casos legales del afiliado con su estado y el abogado asignado. " +
    "Usala cuando pregunte por 'mi caso', 'mis tramites', 'como va lo mio' o similar.",
  esquema: {
    type: "object",
    properties: {
      estado: {
        type: "string",
        enum: ["nuevo", "asignado", "en_curso", "suspendido", "cerrado"],
        description: "Filtra por estado. Omitelo para ver todos los abiertos y cerrados.",
      },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    let consulta = supabase
      .schema("tranqui_legal")
      .from("trq_caso_judicial")
      .select(
        "cas_id, cas_secuencial, cas_titulo, cas_estado, cas_prioridad, cas_numero_proceso, cas_abierto_en, trq_materia(mat_nombre)",
      )
      .is("cas_eliminado_en", null)
      .order("cas_abierto_en", { ascending: false })
      .limit(25);

    if (typeof argumentos.estado === "string") {
      consulta = consulta.eq("cas_estado", argumentos.estado);
    }

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return lista(
      "Casos del afiliado",
      data,
      "El afiliado no tiene ningun caso registrado todavia.",
      (c: Record<string, unknown>) =>
        `- [${c.cas_id}] #${c.cas_secuencial} ${c.cas_titulo} — ` +
        campos([
          ["estado", c.cas_estado],
          ["prioridad", c.cas_prioridad],
          ["materia", (c.trq_materia as { mat_nombre?: string } | null)?.mat_nombre],
          ["proceso", c.cas_numero_proceso],
          ["abierto", fechaHoraEcuador(c.cas_abierto_en as string)],
        ]),
    );
  },
};

const detalleCaso: HerramientaCliente = {
  descripcion:
    "Devuelve el detalle completo de UN caso del afiliado: descripcion, estado, " +
    "abogado asignado y documentos. Pasa el cas_id que devolvio mis_casos.",
  esquema: {
    type: "object",
    properties: {
      caso_id: { type: "string", description: "El cas_id devuelto por mis_casos." },
    },
    required: ["caso_id"],
  },
  async ejecutar(argumentos, { supabase }) {
    const casoId = argumentos.caso_id;
    if (typeof casoId !== "string") throw new Error("Falta caso_id.");

    const { data, error } = await supabase
      .schema("tranqui_legal")
      .from("trq_caso_judicial")
      // La cadena del select va de una pieza a proposito: supabase-js infiere el
      // tipo de la fila del LITERAL, y partirla con `+` deja el resultado como
      // GenericStringError.
      .select(
        "cas_id, cas_secuencial, cas_titulo, cas_descripcion, cas_estado, cas_prioridad, cas_numero_proceso, cas_abierto_en, cas_cerrado_en, trq_materia(mat_nombre)",
      )
      .eq("cas_id", casoId)
      .is("cas_eliminado_en", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // Sin datos porque RLS no lo dejo ver, o porque no existe. No se
      // distingue a proposito: decir "existe pero no es tuyo" ya seria filtrar.
      return "No hay ningun caso del afiliado con ese identificador.";
    }

    const { data: documentos } = await supabase
      .schema("tranqui_legal")
      .from("trq_documento_caso")
      .select("dcc_tipo, dcc_nombre_archivo, dcc_estado_revision")
      .eq("dcc_caso_id", casoId)
      .is("dcc_eliminado_en", null);

    const cabecera = [
      `Caso #${data.cas_secuencial}: ${data.cas_titulo}`,
      campos([
        ["estado", data.cas_estado],
        ["prioridad", data.cas_prioridad],
        ["materia", (data.trq_materia as { mat_nombre?: string } | null)?.mat_nombre],
        ["numero de proceso", data.cas_numero_proceso],
        ["abierto", fechaHoraEcuador(data.cas_abierto_en)],
        ["cerrado", data.cas_cerrado_en ? fechaHoraEcuador(data.cas_cerrado_en) : null],
      ]),
      data.cas_descripcion ? `\nDescripcion: ${data.cas_descripcion}` : "",
    ].join("\n");

    const bloqueDocs = lista(
      "\nDocumentos del expediente",
      documentos,
      "\nNo hay documentos cargados en este expediente.",
      (d: Record<string, unknown>) =>
        `- ${d.dcc_nombre_archivo ?? d.dcc_tipo} (${d.dcc_tipo}) — revision: ${d.dcc_estado_revision}`,
    );

    return `${cabecera}\n${bloqueDocs}`;
  },
};

const misCitas: HerramientaCliente = {
  descripcion:
    "Lista las citas del afiliado. Por defecto solo las futuras. Usala antes de " +
    "proponer un horario nuevo, para no pisar una cita que ya tiene.",
  esquema: {
    type: "object",
    properties: {
      incluir_pasadas: {
        type: "boolean",
        description: "true para incluir citas ya realizadas. Por defecto false.",
      },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    let consulta = supabase
      .schema("tranqui_legal")
      .from("trq_cita")
      .select("cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_enlace, cit_lugar")
      .is("cit_eliminado_en", null)
      .order("cit_inicio_en", { ascending: true })
      .limit(25);

    if (argumentos.incluir_pasadas !== true) {
      consulta = consulta.gte("cit_inicio_en", new Date().toISOString());
    }

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return lista(
      "Citas del afiliado",
      data,
      "El afiliado no tiene citas agendadas.",
      (c: Record<string, unknown>) =>
        `- [${c.cit_id}] ${fechaHoraEcuador(c.cit_inicio_en as string)} — ` +
        campos([
          ["modalidad", c.cit_modalidad],
          ["estado", c.cit_estado],
          ["motivo", c.cit_motivo],
          ["enlace", c.cit_enlace],
          ["lugar", c.cit_lugar],
        ]),
    );
  },
};

const documentosPendientes: HerramientaCliente = {
  descripcion:
    "Lista los documentos del afiliado que siguen pendientes de revision o fueron " +
    "rechazados. Usala cuando pregunte que le falta para su tramite.",
  esquema: {
    type: "object",
    properties: {
      caso_id: { type: "string", description: "Acota a un caso. Omitelo para ver todos." },
    },
  },
  async ejecutar(argumentos, { supabase }) {
    let consulta = supabase
      .schema("tranqui_legal")
      .from("trq_documento_caso")
      .select("dcc_id, dcc_tipo, dcc_nombre_archivo, dcc_estado_revision, dcc_caso_id, dcc_creado_en")
      .in("dcc_estado_revision", ["pendiente", "rechazado"])
      .is("dcc_eliminado_en", null)
      .order("dcc_creado_en", { ascending: false })
      .limit(30);

    if (typeof argumentos.caso_id === "string") {
      consulta = consulta.eq("dcc_caso_id", argumentos.caso_id);
    }

    const { data, error } = await consulta;
    if (error) throw new Error(error.message);

    return lista(
      "Documentos pendientes o rechazados",
      data,
      "No hay documentos pendientes: el expediente esta al dia.",
      (d: Record<string, unknown>) =>
        `- ${d.dcc_nombre_archivo ?? d.dcc_tipo} (${d.dcc_tipo}) — ${d.dcc_estado_revision}` +
        ` · caso ${d.dcc_caso_id}`,
    );
  },
};

const miPerfil: HerramientaCliente = {
  descripcion:
    "Datos del afiliado que esta hablando: nombre, correo y estado de su membresia " +
    "en Tranqi. Usala para saludarlo por su nombre o si pregunta por su plan.",
  esquema: SIN_PROPIEDADES,
  async ejecutar(_argumentos, { supabase, sesion }) {
    const { data: usuario, error } = await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo")
      .eq("usu_id", sesion.usuarioId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: membresia } = await supabase
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_rol, mem_estado, mem_fecha_registro")
      .eq("mem_usuario_id", sesion.usuarioId)
      .eq("mem_negocio", "tranqi")
      .maybeSingle();

    return campos([
      ["nombre", [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ")],
      ["correo", usuario?.usu_correo],
      ["rol en tranqi", membresia?.mem_rol],
      ["estado de la membresia", membresia?.mem_estado],
      ["afiliado desde", membresia ? fechaHoraEcuador(membresia.mem_fecha_registro) : null],
    ]);
  },
};

export const HERRAMIENTAS_CLIENTE: Record<string, HerramientaCliente> = {
  mis_casos: misCasos,
  detalle_caso: detalleCaso,
  mis_citas: misCitas,
  documentos_pendientes: documentosPendientes,
  mi_perfil: miPerfil,
  // Agenda (PLT-020). `agendar_cita` vivia aqui y se retiro: insertaba en
  // trq_cita sin cit_abogado_id, de modo que la cita no la veia ningun
  // abogado. La sustituyen buscar_horarios + reservar_cita, que pasan por el
  // RPC transaccional donde se resuelven turno, cobertura y solape.
  ...HERRAMIENTAS_CLIENTE_AGENDA,
};
