import { NextResponse } from "next/server";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";

export async function GET() {
  try {
    const adminSupabase = crearClienteAdmin() || await crearClienteServidor();

    // Consultar abogados activos y verificados
    const { data: abogados, error: errAbg } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select(`
        abg_id,
        abg_usuario_id,
        abg_verificado_en,
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
      .order("abg_verificado_en", { ascending: false })
      .limit(16);

    if (errAbg || !abogados || abogados.length === 0) {
      return NextResponse.json({ ok: true, abogados: [] });
    }

    const uIds = abogados.map((a) => a.abg_usuario_id).filter(Boolean);
    const { data: usuarios } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_detalle_usuario")
      .in("usu_id", uIds);

    const mapaUsuarios = new Map((usuarios ?? []).map((u) => [u.usu_id, u]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultado = (abogados as any[]).map((a) => {
      const u = mapaUsuarios.get(a.abg_usuario_id);
      const nombreCompleto = [u?.usu_nombres, u?.usu_apellidos].filter(Boolean).join(" ") || "Socio Abogado tranqi";
      const sol = a.trq_solicitud_socio || {};
      
      const materias = (sol.trq_solicitud_materia ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => m.trq_materia?.mat_nombre)
        .filter(Boolean);
      const materiaPrincipal = materias[0] || "Derecho General";

      const provincias = (sol.trq_solicitud_provincia ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => p.comun_catalogo?.cat_nombre)
        .filter(Boolean);
      const ubicacion = provincias.length > 0 ? `${provincias[0]} · ${provincias.length} prov.` : "Ecuador";

      const fotoUrl = (u?.usu_detalle_usuario as Record<string, unknown>)?.foto_url || null;

      return {
        id: a.abg_id,
        nombre: nombreCompleto,
        cargo: "Socio Abogado Acreditado",
        materia: materiaPrincipal,
        ubicacion: ubicacion,
        experiencia: sol.ssc_anos_experiencia ? `${sol.ssc_anos_experiencia} años exp.` : "Verificado",
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
