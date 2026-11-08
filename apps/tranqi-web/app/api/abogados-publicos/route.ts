import { NextResponse } from "next/server";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";

export async function GET() {
  try {
    const adminSupabase = (crearClienteAdmin() || (await crearClienteServidor())) as any;

    const { data: abogados, error: errAbg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select(`
        abg_id,
        abg_usuario_id,
        abg_estado,
        abg_anos_experiencia,
        abg_verificado_en,
        trq_abogado_materia (
          amt_eliminado_en,
          trq_materia (mat_nombre)
        ),
        trq_abogado_provincia (
          apr_eliminado_en,
          comun_catalogo:cat_provincia!trq_abogado_provincia_apr_provincia_id_fkey (cat_nombre)
        ),
        trq_solicitud_socio:trq_solicitud_socio!abg_solicitud_id (
          ssc_id,
          ssc_anos_experiencia,
          ssc_universidad,
          ssc_matricula_profesional,
          trq_solicitud_materia (
            trq_materia (mat_nombre)
          ),
          trq_solicitud_provincia (
            comun_catalogo (cat_nombre)
          )
        )
      `)
      .eq("abg_estado", "verificado")
      .order("abg_verificado_en", { ascending: false })
      .limit(16);

    if (errAbg || !abogados || abogados.length === 0) {
      return NextResponse.json({ ok: true, abogados: [] });
    }

    const uIds = abogados.map((a: any) => a.abg_usuario_id).filter(Boolean);
    const { data: usuarios } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_detalle_usuario")
      .in("usu_id", uIds);

    const mapaUsuarios = new Map<string, any>((usuarios ?? []).map((u: any) => [u.usu_id, u]));

    const resultado = (abogados as any[]).map((a) => {
      const u = mapaUsuarios.get(a.abg_usuario_id);
      const nombreCompleto =
        [u?.usu_nombres, u?.usu_apellidos].filter(Boolean).join(" ") || "Socio Abogado tranqi";
      const sol = a.trq_solicitud_socio || {};
      const detUsuario = (u?.usu_detalle_usuario || {}) as Record<string, any>;
      const ficha = (detUsuario.ficha_abogado || {}) as Record<string, any>;

      const materiasDirectas = (a.trq_abogado_materia ?? [])
        .filter((m: any) => !m.amt_eliminado_en)
        .map((m: any) => m.trq_materia?.mat_nombre)
        .filter(Boolean);

      const materiasSolicitud = (sol.trq_solicitud_materia ?? [])
        .map((m: any) => m.trq_materia?.mat_nombre)
        .filter(Boolean);

      const materias = materiasDirectas.length > 0 ? materiasDirectas : materiasSolicitud;
      const materiaPrincipal = materias[0] || "Derecho General";

      const provinciasDirectas = (a.trq_abogado_provincia ?? [])
        .filter((p: any) => !p.apr_eliminado_en)
        .map((p: any) => p.comun_catalogo?.cat_nombre)
        .filter(Boolean);

      const provinciasSolicitud = (sol.trq_solicitud_provincia ?? [])
        .map((p: any) => p.comun_catalogo?.cat_nombre)
        .filter(Boolean);

      const provincias = provinciasDirectas.length > 0 ? provinciasDirectas : provinciasSolicitud;
      const ubicacion =
        provincias.length > 0 ? `${provincias[0]} · ${provincias.length} prov.` : "Ecuador";

      const anosExp = a.abg_anos_experiencia || ficha.anos_experiencia || sol.ssc_anos_experiencia;
      const fotoUrl = detUsuario.foto_url || null;

      return {
        id: a.abg_id,
        nombre: nombreCompleto,
        cargo: "Socio Abogado Acreditado",
        materia: materiaPrincipal,
        ubicacion: ubicacion,
        experiencia: anosExp ? `${anosExp} años exp.` : "Verificado",
        foto_url: fotoUrl,
        verificado: true,
      };
    });

    return NextResponse.json({ ok: true, abogados: resultado });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al obtener abogados";
    return NextResponse.json({ ok: false, error: msg, abogados: [] }, { status: 500 });
  }
}
