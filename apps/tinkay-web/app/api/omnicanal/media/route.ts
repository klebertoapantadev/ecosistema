import { NextResponse } from "next/server";
import { obtenerContextoAccesoTinkay } from "../../../panel/acceso-tinkay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMINIOS_MEDIA_PERMITIDOS = [
  ".supabase.co",
  ".ycloud.com",
  "ycloud.com",
  ".amazonaws.com",
  ".cloudfront.net",
  ".whatsapp.net",
  ".fbcdn.net",
  ".fbsbx.com",
  ".googleusercontent.com",
  ".vercel.app",
];

function esUrlMediaPermitida(rawUrl: string): URL | null {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    const permitido = DOMINIOS_MEDIA_PERMITIDOS.some(
      (dom) => host === dom.replace(/^\./, "") || host.endsWith(dom)
    );
    return permitido ? u : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.perfil || !ctx.esPersonalTienda) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = (searchParams.get("url") || "").trim();
  const descargar = searchParams.get("dl") === "1";
  const nombreSugerido = (searchParams.get("nombre") || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 64);

  const destino = esUrlMediaPermitida(rawUrl);
  if (!destino) {
    return NextResponse.json({ ok: false, error: "Origen de imagen no permitido" }, { status: 400 });
  }

  try {
    const res = await fetch(destino.toString(), {
      headers: {
        Accept: "image/*,*/*;q=0.8",
      },
      cache: "force-cache",
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `No se pudo obtener la imagen (${res.status})` },
        { status: 502 }
      );
    }

    const tipo = (res.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim();
    if (!tipo.startsWith("image/") && tipo !== "application/octet-stream") {
      return NextResponse.json({ ok: false, error: "Contenido no es imagen" }, { status: 415 });
    }

    const ext =
      tipo.includes("png")
        ? "png"
        : tipo.includes("webp")
          ? "webp"
          : tipo.includes("gif")
            ? "gif"
            : "jpg";
    const nombreFinal =
      nombreSugerido && /\.(jpg|jpeg|png|webp|gif)$/i.test(nombreSugerido)
        ? nombreSugerido
        : `${nombreSugerido || `tinkay-imagen-${Date.now()}`}.${ext}`;

    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": tipo.startsWith("image/") ? tipo : "image/jpeg",
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombreFinal}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error descargando archivo multimedia" },
      { status: 502 }
    );
  }
}
