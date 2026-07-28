import { crearClienteServidor } from "@eco/supabase/servidor";

// Server-only. No importar desde un client component.

export async function listarMaterias() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_materia")
    .select("mat_id, mat_nombre")
    .eq("mat_activa", true)
    .order("mat_nombre");
  return data ?? [];
}

export async function listarProvincias() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_catalogo")
    .from("cat_provincia")
    .select("cat_id, cat_nombre")
    .order("cat_nombre");
  return data ?? [];
}

// Una sola solicitud activa o terminal mas reciente del usuario -- si existe,
// /panel/solicitud-socio muestra su estado en vez del formulario (excepto
// cuando la anterior fue rechazada, ahi se permite volver a postular).
export async function obtenerSolicitudPropia(usuarioId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("*")
    .eq("ssc_usuario_id", usuarioId)
    .order("ssc_creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

interface UsuarioResumen {
  usu_id: string;
  usu_nombres: string | null;
  usu_apellidos: string | null;
  usu_correo: string;
}

async function adjuntarUsuarios<T extends { usuarioId: string }>(
  filas: T[],
): Promise<(T & { usuario: UsuarioResumen | null })[]> {
  if (filas.length === 0) return [];
  const supabase = await crearClienteServidor();
  const ids = [...new Set(filas.map((f) => f.usuarioId))];
  const { data: usuarios } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo")
    .in("usu_id", ids);
  const mapa = new Map((usuarios ?? []).map((u) => [u.usu_id, u]));
  return filas.map((f) => ({ ...f, usuario: mapa.get(f.usuarioId) ?? null }));
}

// Admin: lista de solicitudes de socios (RLS ya filtra a solo admins de
// tranqi via seg_fn_es_admin_negocio -- si el llamador no lo es, esto
// simplemente devuelve vacio).
export async function listarSolicitudes(estado?: string) {
  const supabase = await crearClienteServidor();
  let query = supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("*")
    .order("ssc_creado_en", { ascending: false });
  if (estado) query = query.eq("ssc_estado", estado);

  const { data } = await query;
  const filas = (data ?? []).map((s) => ({ ...s, usuarioId: s.ssc_usuario_id }));
  return adjuntarUsuarios(filas);
}

export async function obtenerSolicitudDetalle(solicitudId: string) {
  const supabase = await crearClienteServidor();

  const { data: solicitud } = await supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("*")
    .eq("ssc_id", solicitudId)
    .maybeSingle();
  if (!solicitud) return null;

  const [
    { data: usuario },
    { data: experiencia },
    { data: solicitudMaterias },
    { data: solicitudProvincias },
    { data: revisiones },
    { data: documentos },
  ] = await Promise.all([
    supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp")
      .eq("usu_id", solicitud.ssc_usuario_id)
      .maybeSingle(),
    supabase
      .schema("tranqui_legal")
      .from("trq_experiencia_laboral")
      .select("*")
      .eq("exp_solicitud_id", solicitudId)
      .order("exp_fecha_inicio", { ascending: false }),
    supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_materia")
      .select("sma_materia_id")
      .eq("sma_solicitud_id", solicitudId),
    supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_provincia")
      .select("spr_provincia_id")
      .eq("spr_solicitud_id", solicitudId),
    supabase
      .schema("tranqui_legal")
      .from("trq_revision_solicitud")
      .select("*")
      .eq("rev_solicitud_id", solicitudId)
      .order("rev_creado_en", { ascending: false }),
    supabase
      .schema("tranqui_legal")
      .from("trq_documento_socio")
      .select("*")
      .eq("dcs_solicitud_id", solicitudId)
      .order("dcs_creado_en", { ascending: false }),
  ]);

  // URL firmada, nunca publica -- el bucket "socios-documentos" es privado
  // (ver migracion socios_mfa_y_documentos). 10 min alcanza para revisar un
  // documento durante la sesion de admin sin dejar el enlace vivo despues.
  const documentosConUrl = await Promise.all(
    (documentos ?? []).map(async (d) => {
      const { data: firmada } = await supabase.storage.from("socios-documentos").createSignedUrl(d.dcs_url, 600);
      return { ...d, url: firmada?.signedUrl ?? null };
    }),
  );

  // Embeds cruzando esquema (spr_provincia_id -> comun_catalogo.cat_provincia)
  // no son confiables via PostgREST -- join manual, mismo patron que
  // buscarUsuarios() en @eco/gestion-usuarios.
  const materiaIds = (solicitudMaterias ?? []).map((m) => m.sma_materia_id);
  const provinciaIds = (solicitudProvincias ?? []).map((p) => p.spr_provincia_id);

  const [{ data: materiasCatalogo }, { data: provinciasCatalogo }] = await Promise.all([
    materiaIds.length
      ? supabase.schema("tranqui_legal").from("trq_materia").select("mat_id, mat_nombre").in("mat_id", materiaIds)
      : Promise.resolve({ data: [] as { mat_id: string; mat_nombre: string }[] }),
    provinciaIds.length
      ? supabase.schema("comun_catalogo").from("cat_provincia").select("cat_id, cat_nombre").in("cat_id", provinciaIds)
      : Promise.resolve({ data: [] as { cat_id: string; cat_nombre: string }[] }),
  ]);

  return {
    solicitud,
    usuario: usuario ?? null,
    experiencia: experiencia ?? [],
    materias: materiasCatalogo ?? [],
    provincias: provinciasCatalogo ?? [],
    revisiones: revisiones ?? [],
    documentos: documentosConUrl,
  };
}

// Complementa el detalle de una solicitud aceptada con su registro de
// trq_abogado (abg_mfa_verificado, fecha de verificacion) -- null si la
// solicitud todavia no fue aceptada.
export async function obtenerAbogadoPorSolicitud(solicitudId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_abogado")
    .select("*")
    .eq("abg_solicitud_id", solicitudId)
    .maybeSingle();
  return data;
}

// Admin (SUPERADMIN via RLS de comun_auditoria): bitacora de cambios sobre
// las tablas de socios -- misma fuente que ya escribe aud_fn_auditar_tabla()
// en cada INSERT/UPDATE/DELETE, aqui solo se lee.
export async function listarAuditoria(limite = 100) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_auditoria")
    .from("aud_registro")
    .select("*")
    .eq("reg_esquema", "tranqui_legal")
    .order("reg_creado_en", { ascending: false })
    .limit(limite);

  const filas = (data ?? []).map((r) => ({ ...r, usuarioId: r.reg_usuario_id }));
  const ids = [...new Set(filas.map((f) => f.usuarioId).filter((id): id is string => !!id))];
  if (ids.length === 0) return filas.map((f) => ({ ...f, usuario: null as UsuarioResumen | null }));

  const { data: usuarios } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo")
    .in("usu_id", ids);
  const mapa = new Map((usuarios ?? []).map((u) => [u.usu_id, u]));
  return filas.map((f) => ({ ...f, usuario: f.usuarioId ? (mapa.get(f.usuarioId) ?? null) : null }));
}
