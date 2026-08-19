import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { obtenerSolicitudDetalle } from "../../../../../modulos/socios/consultas";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const solicitudId = searchParams.get("solicitudId");
    if (!solicitudId) {
      return new Response("ID de solicitud no especificado", { status: 400 });
    }

    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return new Response("No autorizado: sesión no iniciada", { status: 401 });
    }

    const detalle = await obtenerSolicitudDetalle(solicitudId);
    if (!detalle || !detalle.solicitud) {
      return new Response("Solicitud no encontrada", { status: 404 });
    }

    const { solicitud, documentos } = detalle;

    // Verificar permisos: el usuario debe ser el postulante o un admin/operador
    const esPropietario = solicitud.ssc_usuario_id === perfil.usu_id;
    const esSuperAdmin = Boolean(perfil.usu_superadmin_plataforma);
    const perfilesUsu = await obtenerPerfiles("TRANQ");
    const esStaff =
      esSuperAdmin ||
      perfilesUsu.includes("ADMINISTRADOR") ||
      perfilesUsu.includes("SUPERADMIN") ||
      perfilesUsu.includes("OPERADOR");

    if (!esPropietario && !esStaff) {
      return new Response("Acceso denegado a este documento", { status: 403 });
    }

    // Buscar el contrato firmado en los documentos
    const docContrato = documentos.find(
      (d) => d.dcs_tipo === "contrato_socio" || d.dcs_comentario?.includes("[tipo:contrato_socio]")
    );

    if (!docContrato || !docContrato.dcs_url) {
      return new Response("Aún no se ha cargado el contrato firmado para esta solicitud.", { status: 404 });
    }

    const adminSupabase = crearClienteAdmin() || (await crearClienteServidor());

    // Descargar el archivo desde Supabase Storage
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from("socios-documentos")
      .download(docContrato.dcs_url);

    if (downloadError || !fileData) {
      // Si falla la descarga directa, intentar redirigir a la URL firmada
      const { data: signedData } = await adminSupabase.storage
        .from("socios-documentos")
        .createSignedUrl(docContrato.dcs_url, 300);

      if (signedData?.signedUrl) {
        return Response.redirect(signedData.signedUrl, 302);
      }
      return new Response("No se pudo obtener el archivo desde el almacenamiento.", { status: 404 });
    }

    const nombreArchivo = docContrato.dcs_nombre_archivo || "Contrato_Firmado.pdf";
    const esPdf = nombreArchivo.toLowerCase().endsWith(".pdf") || fileData.type.includes("pdf");
    const contentType = esPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const arrayBuffer = await fileData.arrayBuffer();

    return new Response(new Uint8Array(arrayBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(nombreArchivo)}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al descargar el contrato firmado";
    return new Response(msg, { status: 500 });
  }
}
