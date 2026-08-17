import { NextResponse } from "next/server";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import {
  generarRutaRepositorioComun,
  CONCEPTOS_REPOSITORIO,
} from "../../../../modulos/socios/esquema";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const solicitudId = formData.get("solicitudId") as string;
    const tipo = formData.get("tipo") as "foto_perfil" | "titulo" | "matricula" | "cedula" | "identificacion" | "otro" | "cv" | "contrato_socio" | "respaldo_revision";
    const archivo = formData.get("archivo") as File;
    const comentario = (formData.get("comentario") as string) || undefined;
    const usuarioId = (formData.get("usuarioId") as string) || undefined;
    const concepto = (formData.get("concepto") as string) || undefined;

    if (!solicitudId || !archivo || !tipo) {
      return NextResponse.json({ ok: false, error: "Datos incompletos para subir documento." }, { status: 400 });
    }

    const adminSupabase = crearClienteAdmin() || await crearClienteServidor();
    const supabase = await crearClienteServidor();
    const { data: { user } } = await supabase.auth.getUser();
    const targetUsuId = usuarioId || user?.id || solicitudId;

    const infoRuta = generarRutaRepositorioComun({
      negocio: "TRANQ",
      usuarioId: targetUsuId,
      procesoOConcepto: concepto || (tipo === "foto_perfil" ? CONCEPTOS_REPOSITORIO.PERFIL : (tipo === "respaldo_revision" ? "revision" : CONCEPTOS_REPOSITORIO.REGISTRO)),
      tramiteORefId: solicitudId,
      tipoDocumento: tipo,
      nombreOriginal: archivo.name,
    });

    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await adminSupabase.storage
      .from("socios-documentos")
      .upload(infoRuta.rutaCompleta, buffer, {
        contentType: archivo.type || "application/octet-stream",
        upsert: true,
      });

    if (storageError) {
      console.error("Error al subir archivo a Storage:", storageError);
      return NextResponse.json({ ok: false, error: storageError.message }, { status: 500 });
    }

    const TIPOS_PERMITIDOS = ["foto_perfil", "titulo", "matricula", "cedula", "identificacion", "cv", "contrato_socio", "otro", "respaldo_revision"];
    const tipoFinal = TIPOS_PERMITIDOS.includes(tipo) ? (tipo === "identificacion" ? "cedula" : tipo) : "otro";

    // Limpiar documento previo del mismo tipo (ej. reemplazar foto anterior, cedula anterior, titulo anterior o cv anterior)
    if (["foto_perfil", "titulo", "matricula", "cedula", "cv", "contrato_socio"].includes(tipoFinal)) {
      try {
        const { data: docsExistentes } = await adminSupabase
          .schema("tranqui_legal")
          .from("trq_documento_socio")
          .select("dcs_id, dcs_tipo, dcs_comentario, dcs_url")
          .eq("dcs_solicitud_id", solicitudId);

        if (Array.isArray(docsExistentes)) {
          const idsAEliminar = docsExistentes
            .filter((d) => {
              const tipoNorm = d.dcs_tipo === "otro" 
                ? (d.dcs_comentario?.includes("[tipo:foto_perfil]") || d.dcs_comentario?.includes("[perfil]") || d.dcs_url?.includes("foto_perfil") ? "foto_perfil"
                  : d.dcs_comentario?.includes("[tipo:cv]") || d.dcs_comentario?.includes("[cv]") || d.dcs_url?.includes("/cv-") ? "cv"
                  : d.dcs_comentario?.includes("[tipo:cedula]") || d.dcs_comentario?.includes("[identidad]") || d.dcs_url?.includes("/cedula-") ? "cedula"
                  : d.dcs_comentario?.includes("[tipo:titulo]") || d.dcs_url?.includes("/titulo-") ? "titulo"
                  : d.dcs_comentario?.includes("[tipo:matricula]") || d.dcs_url?.includes("/matricula-") ? "matricula"
                  : d.dcs_comentario?.includes("[tipo:contrato_socio]") || d.dcs_url?.includes("/contrato_socio-") ? "contrato_socio"
                  : d.dcs_tipo)
                : d.dcs_tipo;
              return tipoNorm === tipoFinal || (tipoFinal === "cedula" && tipoNorm === "identificacion");
            })
            .map((d) => d.dcs_id);

          if (idsAEliminar.length > 0) {
            await adminSupabase
              .schema("tranqui_legal")
              .from("trq_documento_socio")
              .delete()
              .in("dcs_id", idsAEliminar);
          }
        }
      } catch (errDel) {
        console.warn("Aviso al limpiar doc previo:", errDel);
      }
    }

    const comentarioFinal = concepto ? `[${concepto}] ${comentario || ""}`.trim() : (comentario || null);

    let { error: dbError } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_documento_socio")
      .insert({
        dcs_solicitud_id: solicitudId,
        dcs_tipo: tipoFinal,
        dcs_url: infoRuta.rutaCompleta,
        dcs_nombre_archivo: infoRuta.nombreSanitizado,
        dcs_comentario: comentarioFinal,
        dcs_subido_por: user?.id || targetUsuId,
      });

    // Si el check constraint de PostgreSQL de la base de datos remota rechaza 'foto_perfil' o 'cv', reintentar con 'otro' y tag [tipo:xxx]
    if (dbError && dbError.message?.includes("trq_documento_socio_dcs_tipo_check")) {
      const tagComentario = `[tipo:${tipoFinal}] ${comentarioFinal || ""}`.trim();
      const resFallback = await adminSupabase
        .schema("tranqui_legal")
        .from("trq_documento_socio")
        .insert({
          dcs_solicitud_id: solicitudId,
          dcs_tipo: "otro",
          dcs_url: infoRuta.rutaCompleta,
          dcs_nombre_archivo: infoRuta.nombreSanitizado,
          dcs_comentario: tagComentario,
          dcs_subido_por: user?.id || targetUsuId,
        });
      dbError = resFallback.error;
    }

    if (dbError) {
      console.error("Error al registrar en trq_documento_socio:", dbError);
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
    }

    // Sincronizar avatar en seg_usuario si es foto de perfil
    if (tipoFinal === "foto_perfil" && targetUsuId) {
      try {
        const { data: publicUrlData } = adminSupabase.storage
          .from("socios-documentos")
          .getPublicUrl(infoRuta.rutaCompleta);

        const fotoUrl = publicUrlData?.publicUrl;
        if (fotoUrl) {
          const { data: uExistente } = await adminSupabase
            .schema("comun_seguridad")
            .from("seg_usuario")
            .select("usu_detalle_usuario")
            .eq("usu_id", targetUsuId)
            .maybeSingle();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detalleActual = (uExistente?.usu_detalle_usuario as Record<string, any>) || {};
          await adminSupabase
            .schema("comun_seguridad")
            .from("seg_usuario")
            .update({
              usu_detalle_usuario: {
                ...detalleActual,
                foto_url: fotoUrl,
                avatar_url: fotoUrl,
              }
            })
            .eq("usu_id", targetUsuId);
        }
      } catch (errFotoSync) {
        console.warn("Aviso al sincronizar foto en perfil de usuario:", errFotoSync);
      }
    }

    return NextResponse.json({ ok: true, data: { url: infoRuta.rutaCompleta, path: infoRuta.rutaCompleta } });
  } catch (errSubida: unknown) {
    const msg = errSubida instanceof Error ? errSubida.message : "Error inesperado al subir archivo";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
