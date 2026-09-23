import { crearClienteServidor } from "@eco/supabase/servidor";
import { estadoVigencia, type EstadoVigencia } from "./vigencia";

// Server-only. No importar desde un client component.
//
// Lecturas del inicio del cliente (TRQ-CLI-001, rediseño TRQ-013). Todo pasa
// por RLS con la sesión del usuario, sin service_role.
//
// Cada consulta filtra además por el id del usuario aunque RLS ya lo haga: un
// superadmin que mira el panel "como cliente" tiene políticas más amplias, y
// sin el filtro explícito vería en SU inicio los casos y documentos de todos.
//
// Nada de lo que devuelve este módulo se inventa: si una consulta falla, el
// dato vuelve como `null` y la pantalla lo omite o muestra el estado vacío.
// La maqueta traía un "ahorro con tu plan" y mensajes del caso; no hay de
// dónde sacarlos, así que no se trasladaron (ver README del módulo).

export type EstadoCaso = "nuevo" | "asignado" | "en_curso" | "suspendido" | "cerrado";

export interface DocumentoDeCaso {
  id: string;
  nombre: string;
  estadoRevision: string;
}

export interface CitaDeCaso {
  id: string;
  inicio: string;
  modalidad: string;
  estado: string;
}

export interface CasoReciente {
  id: string;
  secuencial: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoCaso;
  numeroProceso: string | null;
  materia: string | null;
  tieneAbogado: boolean;
  abiertoEn: string;
  actualizadoEn: string;
  /** Los más recientes (hasta 6 y 5); los totales, aparte, para las insignias. */
  documentos: DocumentoDeCaso[];
  citas: CitaDeCaso[];
  documentosTotal: number;
  citasTotal: number;
}

export interface DocumentoBilletera {
  id: string;
  titulo: string;
  categoria: string;
  estado: EstadoVigencia;
  diasParaVencer: number | null;
}

export interface ResumenBilletera {
  total: number;
  porVencer: number;
  vencidos: number;
  recientes: DocumentoBilletera[];
}

export interface ProximaCita {
  id: string;
  inicio: string;
  modalidad: string;
  motivo: string | null;
  enlace: string | null;
  lugar: string | null;
}

export interface ResumenInicioCliente {
  tramitesAbiertos: number | null;
  consultasResueltas: number | null;
  casoReciente: CasoReciente | null;
  billetera: ResumenBilletera | null;
  proximaCita: ProximaCita | null;
}


async function contarTramitesAbiertos(usuarioId: string): Promise<number | null> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .schema("tranqui_legal")
    .from("trq_caso_judicial")
    .select("cas_id", { count: "exact", head: true })
    .eq("cas_cliente_id", usuarioId)
    .is("cas_eliminado_en", null)
    .neq("cas_estado", "cerrado");
  return error ? null : (count ?? 0);
}

async function contarConsultasResueltas(usuarioId: string): Promise<number | null> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .schema("tranqui_legal")
    .from("trq_consulta_rapida")
    .select("crp_id", { count: "exact", head: true })
    .eq("crp_usuario_id", usuarioId)
    .eq("crp_resuelta", true)
    .is("crp_eliminado_en", null);
  return error ? null : (count ?? 0);
}

/** El caso abierto que se movió más recientemente, con sus documentos y
 *  citas. `null` si el cliente no tiene casos abiertos. */
async function obtenerCasoReciente(usuarioId: string): Promise<CasoReciente | null> {
  const supabase = await crearClienteServidor();
  const legal = supabase.schema("tranqui_legal");
  const { data: caso, error } = await legal
    .from("trq_caso_judicial")
    .select(
      "cas_id, cas_secuencial, cas_titulo, cas_descripcion, cas_estado, cas_numero_proceso, cas_materia_id, cas_abogado_id, cas_abierto_en, cas_actualizado_en",
    )
    .eq("cas_cliente_id", usuarioId)
    .is("cas_eliminado_en", null)
    .neq("cas_estado", "cerrado")
    .order("cas_actualizado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !caso) return null;

  const [materia, documentos, citas] = await Promise.all([
    caso.cas_materia_id
      ? legal.from("trq_materia").select("mat_nombre").eq("mat_id", caso.cas_materia_id).maybeSingle()
      : Promise.resolve({ data: null }),
    legal
      .from("trq_documento_caso")
      .select("dcc_id, dcc_nombre_archivo, dcc_tipo, dcc_estado_revision", { count: "exact" })
      .eq("dcc_caso_id", caso.cas_id)
      .is("dcc_eliminado_en", null)
      .order("dcc_creado_en", { ascending: false })
      .limit(6),
    legal
      .from("trq_cita")
      .select("cit_id, cit_inicio_en, cit_modalidad, cit_estado", { count: "exact" })
      .eq("cit_caso_id", caso.cas_id)
      .eq("cit_cliente_id", usuarioId)
      .is("cit_eliminado_en", null)
      .order("cit_inicio_en", { ascending: false })
      .limit(5),
  ]);

  return {
    id: caso.cas_id,
    secuencial: caso.cas_secuencial,
    titulo: caso.cas_titulo,
    descripcion: caso.cas_descripcion,
    estado: caso.cas_estado as EstadoCaso,
    numeroProceso: caso.cas_numero_proceso,
    materia: (materia.data as { mat_nombre: string } | null)?.mat_nombre ?? null,
    tieneAbogado: Boolean(caso.cas_abogado_id),
    abiertoEn: caso.cas_abierto_en,
    actualizadoEn: caso.cas_actualizado_en,
    documentos: (documentos.data ?? []).map((d) => ({
      id: d.dcc_id,
      nombre: d.dcc_nombre_archivo ?? d.dcc_tipo,
      estadoRevision: d.dcc_estado_revision,
    })),
    citas: (citas.data ?? []).map((c) => ({
      id: c.cit_id,
      inicio: c.cit_inicio_en,
      modalidad: c.cit_modalidad,
      estado: c.cit_estado,
    })),
    documentosTotal: documentos.count ?? documentos.data?.length ?? 0,
    citasTotal: citas.count ?? citas.data?.length ?? 0,
  };
}

async function obtenerResumenBilletera(usuarioId: string): Promise<ResumenBilletera | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .schema("tranqui_legal")
    .from("trq_billetera_documento")
    .select("doc_id, doc_titulo, doc_categoria, doc_fecha_caducidad, doc_alertar_caducidad, doc_meses_anticipacion_alerta")
    .eq("doc_usuario_id", usuarioId)
    .is("doc_eliminado_en", null)
    .order("doc_creado_en", { ascending: false })
    .limit(500);
  if (error) return null;

  const ahora = new Date();
  const documentos: DocumentoBilletera[] = (data ?? []).map((d) => ({
    id: d.doc_id,
    titulo: d.doc_titulo,
    categoria: d.doc_categoria,
    ...estadoVigencia(d.doc_fecha_caducidad, d.doc_alertar_caducidad, d.doc_meses_anticipacion_alerta, ahora),
  }));

  // Los urgentes primero: el inicio muestra tres y deben ser los que piden acción.
  const orden = { vencido: 0, por_vencer: 1, vigente: 2, sin_caducidad: 3 } as const;
  const recientes = [...documentos].sort((a, b) => orden[a.estado] - orden[b.estado]).slice(0, 3);

  return {
    total: documentos.length,
    porVencer: documentos.filter((d) => d.estado === "por_vencer").length,
    vencidos: documentos.filter((d) => d.estado === "vencido").length,
    recientes,
  };
}

async function obtenerProximaCita(usuarioId: string): Promise<ProximaCita | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .schema("tranqui_legal")
    .from("trq_cita")
    .select("cit_id, cit_inicio_en, cit_modalidad, cit_motivo, cit_enlace, cit_lugar")
    .eq("cit_cliente_id", usuarioId)
    .is("cit_eliminado_en", null)
    .in("cit_estado", ["pendiente", "confirmada"])
    .gte("cit_inicio_en", new Date().toISOString())
    .order("cit_inicio_en", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.cit_id,
    inicio: data.cit_inicio_en,
    modalidad: data.cit_modalidad,
    motivo: data.cit_motivo,
    enlace: data.cit_enlace,
    lugar: data.cit_lugar,
  };
}

/** Todo lo que pinta el inicio del cliente, en paralelo. */
export async function obtenerResumenInicioCliente(usuarioId: string): Promise<ResumenInicioCliente> {
  const [tramitesAbiertos, consultasResueltas, casoReciente, billetera, proximaCita] = await Promise.all([
    contarTramitesAbiertos(usuarioId),
    contarConsultasResueltas(usuarioId),
    obtenerCasoReciente(usuarioId),
    obtenerResumenBilletera(usuarioId),
    obtenerProximaCita(usuarioId),
  ]);
  return { tramitesAbiertos, consultasResueltas, casoReciente, billetera, proximaCita };
}
