import { NextResponse, type NextRequest } from "next/server";
import { acunarTokenSupabase } from "@eco/agentes-ia";
import { crearClienteConToken } from "@eco/supabase/token";
import { cargarBytesDocumento, verificarEnlaceDocumento } from "../../../../../modulos/asistente/documentos";

// Sirve a ARIA los bytes de un documento que una herramienta del asistente le
// entrego como enlace (ver modulos/asistente/documentos.ts).
//
// No hay cookie ni sesion: quien llama es el servidor de ARIA. Lo que autoriza
// es el token de la URL, firmado por esta app hace menos de cinco minutos con
// la identidad del usuario dueño del turno. Con esa identidad se acuña un token
// de Supabase y la fila se resuelve BAJO RLS: si el usuario no la ve, 404. El
// token no lleva ningun permiso propio, solo dice "en nombre de quien".
//
// Todas las salidas negativas son 404 sin distinguir: caducado, manipulado,
// documento ajeno o inexistente se ven igual desde fuera.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noEncontrado = () => new NextResponse(null, { status: 404 });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const secretoCapsula = process.env.ASISTENTE_CAPSULA_SECRETO;
  const secretoJwt = process.env.SUPABASE_JWT_SECRET;
  const urlProyecto = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secretoCapsula || !secretoJwt || !urlProyecto) {
    console.error("[asistente/documento] faltan ASISTENTE_CAPSULA_SECRETO, SUPABASE_JWT_SECRET o NEXT_PUBLIC_SUPABASE_URL");
    return noEncontrado();
  }

  const { token } = await params;
  const ref = await verificarEnlaceDocumento(token, secretoCapsula);
  if (!ref) return noEncontrado();

  const supabase = crearClienteConToken(await acunarTokenSupabase(ref.usuarioId, secretoJwt, urlProyecto));
  const documento = await cargarBytesDocumento(ref, supabase);
  if (!documento) return noEncontrado();

  // El nombre va en Content-Disposition porque ARIA decide por la extension
  // como tratar el fichero (PDF, DOCX, imagen). El nombre lo puso el usuario al
  // subir: se reduce a ASCII seguro para que no pueda romper la cabecera.
  const nombre = documento.nombre.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "documento";
  return new NextResponse(new Blob([documento.bytes as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": documento.mime,
      "Content-Length": String(documento.bytes.byteLength),
      "Content-Disposition": `inline; filename="${nombre}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
