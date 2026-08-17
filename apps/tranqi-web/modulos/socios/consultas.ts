import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";

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

function normalizarTipoDocumento(d: { dcs_tipo: string; dcs_comentario?: string | null; dcs_url?: string | null }): string {
  if (d.dcs_tipo && d.dcs_tipo !== "otro") return d.dcs_tipo;
  if (d.dcs_comentario?.includes("[tipo:foto_perfil]") || d.dcs_comentario?.includes("[perfil]") || d.dcs_url?.includes("foto_perfil")) return "foto_perfil";
  if (d.dcs_comentario?.includes("[tipo:cv]") || d.dcs_comentario?.includes("[cv]") || d.dcs_url?.includes("/cv-")) return "cv";
  if (d.dcs_comentario?.includes("[tipo:cedula]") || d.dcs_comentario?.includes("[identidad]") || d.dcs_url?.includes("/cedula-")) return "cedula";
  if (d.dcs_comentario?.includes("[tipo:titulo]") || d.dcs_url?.includes("/titulo-")) return "titulo";
  if (d.dcs_comentario?.includes("[tipo:matricula]") || d.dcs_url?.includes("/matricula-")) return "matricula";
  if (d.dcs_comentario?.includes("[tipo:contrato_socio]") || d.dcs_url?.includes("/contrato_socio-")) return "contrato_socio";
  return d.dcs_tipo || "otro";
}

function deduplicarExperiencias<T extends { exp_empresa?: string | null; exp_cargo?: string | null; exp_fecha_inicio?: string | null }>(lista: T[]): T[] {
  const vistos = new Set<string>();
  const resultado: T[] = [];
  for (const item of lista) {
    const clave = `${(item.exp_empresa || "").trim().toLowerCase()}|${(item.exp_cargo || "").trim().toLowerCase()}|${(item.exp_fecha_inicio || "").trim()}`;
    if (!vistos.has(clave)) {
      vistos.add(clave);
      resultado.push(item);
    }
  }
  return resultado;
}

export async function obtenerSolicitudPropia(usuarioId: string) {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;
  const { data } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select(`
      *,
      trq_solicitud_materia(sma_materia_id),
      trq_solicitud_provincia(spr_provincia_id),
      trq_experiencia_laboral(*),
      trq_documento_socio(*)
    `)
    .eq("ssc_usuario_id", usuarioId)
    .is("ssc_eliminado_en", null)
    .neq("ssc_estado", "cancelada")
    .neq("ssc_estado", "eliminada")
    .order("ssc_creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  if (Array.isArray(data.trq_experiencia_laboral)) {
    data.trq_experiencia_laboral = deduplicarExperiencias(data.trq_experiencia_laboral);
  }

  // Firmar URLs de documentos existentes para el solicitante y normalizar tipos
  const docs = data.trq_documento_socio;
  if (Array.isArray(docs) && docs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docsFirmados = await Promise.all(
      docs.map(async (d: any) => {
        const tipoNormalizado = normalizarTipoDocumento(d);
        if (!d.dcs_url) return { ...d, dcs_tipo: tipoNormalizado, url: null };
        if (d.dcs_url.startsWith("data:") || d.dcs_url.startsWith("http")) {
          return { ...d, dcs_tipo: tipoNormalizado, url: d.dcs_url };
        }
        try {
          const { data: signedData } = await adminSupabase.storage
            .from("socios-documentos")
            .createSignedUrl(d.dcs_url, 3600);
          const { data: publicData } = adminSupabase.storage
            .from("socios-documentos")
            .getPublicUrl(d.dcs_url);
          return { ...d, dcs_tipo: tipoNormalizado, url: signedData?.signedUrl || publicData?.publicUrl || d.dcs_url };
        } catch {
          const { data: urlData } = adminSupabase.storage.from("socios-documentos").getPublicUrl(d.dcs_url);
          return { ...d, dcs_tipo: tipoNormalizado, url: urlData?.publicUrl ?? d.dcs_url };
        }
      })
    );
    data.trq_documento_socio = docsFirmados;
  }

  return data;
}

interface UsuarioResumen {
  usu_id: string;
  usu_nombres: string | null;
  usu_apellidos: string | null;
  usu_correo: string;
  usu_whatsapp?: string | null;
  usu_detalle_usuario?: Record<string, unknown> | null;
}

async function adjuntarUsuarios<T extends { usuarioId: string }>(
  filas: T[],
): Promise<(T & { usuario: UsuarioResumen | null })[]> {
  if (filas.length === 0) return [];
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;
  const ids = [...new Set(filas.map((f) => f.usuarioId))];
  const { data: usuarios } = await adminSupabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp")
    .in("usu_id", ids);
  const mapa = new Map((usuarios ?? []).map((u) => [u.usu_id, u]));
  return filas.map((f) => ({ ...f, usuario: mapa.get(f.usuarioId) ?? null }));
}

export async function listarSolicitudesParaAdmin(estado?: string) {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;
  let query = adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("*")
    .order("ssc_enviada_en", { ascending: false });

  if (estado) query = query.eq("ssc_estado", estado);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rawList = (data ?? []).map((s) => ({
    ...s,
    solicitudId: s.ssc_id,
    usuarioId: s.ssc_usuario_id,
    cedula: s.ssc_cedula,
    matriculaProfesional: s.ssc_matricula_profesional,
    universidad: s.ssc_universidad,
    anioGraduacion: s.ssc_anio_graduacion,
    anosExperiencia: s.ssc_anos_experiencia,
    resumenProfesional: s.ssc_resumen_profesional,
    telefonoContacto: s.ssc_telefono_contacto,
    estado: s.ssc_estado,
    enlaceSenescytVerificado: s.ssc_enlace_senescyt_verificado,
    enlaceForoVerificado: s.ssc_enlace_foro_verificado,
    creadoEn: s.ssc_creado_en,
    enviadaEn: s.ssc_enviada_en,
  }));

  return adjuntarUsuarios(rawList);
}

export const listarSolicitudes = listarSolicitudesParaAdmin;

export async function obtenerDetalleSolicitudParaAdmin(solicitudId: string) {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  // 1. Obtener la solicitud con adminSupabase
  const { data: solicitud, error: errSol } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("*")
    .eq("ssc_id", solicitudId)
    .single();

  if (errSol || !solicitud) return null;

  // 2. Obtener todas las relaciones concurrentemente con adminSupabase
  const [materiasRes, provinciasRes, experienciaRes, documentosRes, historialRes] =
    await Promise.all([
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_solicitud_materia")
        .select("sma_materia_id, trq_materia(mat_id, mat_nombre)")
        .eq("sma_solicitud_id", solicitudId),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_solicitud_provincia")
        .select("spr_provincia_id, cat_provincia:comun_catalogo!trq_solicitud_provincia_spr_provincia_id_fkey(cat_id, cat_nombre)")
        .eq("spr_solicitud_id", solicitudId),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_experiencia_laboral")
        .select("*")
        .eq("exp_solicitud_id", solicitudId)
        .order("exp_fecha_inicio", { ascending: false }),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_documento_socio")
        .select("*")
        .eq("dcs_solicitud_id", solicitudId)
        .order("dcs_creado_en", { ascending: false }),
      adminSupabase
        .schema("tranqui_legal")
        .from("trq_revision_solicitud")
        .select("*")
        .eq("rev_solicitud_id", solicitudId)
        .order("rev_creado_en", { ascending: false }),
    ]);

  // 3. Obtener el usuario postulante para el avatar y nombre
  const { data: usuario } = await adminSupabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_detalle_usuario")
    .eq("usu_id", solicitud.ssc_usuario_id)
    .maybeSingle();

  const docsFirmados = await Promise.all(
    (documentosRes.data ?? []).map(async (d) => {
      const tipoNormalizado = normalizarTipoDocumento(d);
      if (!d.dcs_url) return { ...d, dcs_tipo: tipoNormalizado, url: null };
      if (d.dcs_url.startsWith("data:") || d.dcs_url.startsWith("http")) {
        return { ...d, dcs_tipo: tipoNormalizado, url: d.dcs_url };
      }
      try {
        const { data: signedData } = await adminSupabase.storage
          .from("socios-documentos")
          .createSignedUrl(d.dcs_url, 3600);
        const { data: publicData } = adminSupabase.storage
          .from("socios-documentos")
          .getPublicUrl(d.dcs_url);
        return { ...d, dcs_tipo: tipoNormalizado, url: signedData?.signedUrl || publicData?.publicUrl || d.dcs_url };
      } catch {
        const { data: urlData } = adminSupabase.storage.from("socios-documentos").getPublicUrl(d.dcs_url);
        return { ...d, dcs_tipo: tipoNormalizado, url: urlData?.publicUrl ?? d.dcs_url };
      }
    })
  );

  // 4. Enriquecer revisiones con información del operador / revisor
  const revsRaw = historialRes.data ?? [];
  const adminIds = Array.from(new Set(revsRaw.map((r: { rev_admin_id?: string | null }) => r.rev_admin_id).filter(Boolean))) as string[];
  const revisoresMap = new Map<string, { nombre: string; correo: string }>();

  if (adminIds.length > 0) {
    const { data: usuariosRevisores } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo")
      .in("usu_id", adminIds);

    if (Array.isArray(usuariosRevisores)) {
      for (const u of usuariosRevisores) {
        const nom = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || u.usu_correo;
        revisoresMap.set(u.usu_id, { nombre: nom, correo: u.usu_correo });
      }
    }
  }

  const revisionesEnriquecidas = revsRaw.map((r: Record<string, unknown>) => ({
    ...r,
    revisor: r.rev_admin_id ? revisoresMap.get(r.rev_admin_id as string) || null : null,
  }));

  return {
    solicitud,
    usuario: usuario ?? null,
    materias: (materiasRes.data ?? []).map((m) => (m as unknown as { trq_materia: { mat_id: string; mat_nombre: string } }).trq_materia).filter(Boolean),
    provincias: (provinciasRes.data ?? []).map((p) => (p as unknown as { cat_provincia: { cat_id: string; cat_nombre: string } }).cat_provincia).filter(Boolean),
    experiencia: deduplicarExperiencias(experienciaRes.data ?? []),
    documentos: docsFirmados,
    revisiones: revisionesEnriquecidas,
    historial: revisionesEnriquecidas,
  };
}

export const obtenerSolicitudDetalle = obtenerDetalleSolicitudParaAdmin;

export async function obtenerAbogadoPorSolicitud(usuarioId: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_abogado")
    .select("*")
    .eq("abg_usuario_id", usuarioId)
    .maybeSingle();
  return data;
}
