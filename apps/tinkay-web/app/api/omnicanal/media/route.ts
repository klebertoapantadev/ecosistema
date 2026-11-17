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
    const headersUpstream: Record<string, string> = {
      Accept: "image/*,audio/*,application/pdf,*/*;q=0.8",
    };
    const rangeReq = request.headers.get("range");
    if (rangeReq) {
      headersUpstream.Range = rangeReq;
    }

    const res = await fetch(destino.toString(), {
      headers: headersUpstream,
      cache: "force-cache",
    });

    if (!res.ok && res.status !== 206) {
      return NextResponse.json(
        { ok: false, error: `No se pudo obtener el archivo multimedia (${res.status})` },
        { status: 502 }
      );
    }

    const tipo = (res.headers.get("content-type") || "application/octet-stream")
      .split(";")[0]!
      .trim()
      .toLowerCase();

    const esPermitido =
      tipo.startsWith("image/") ||
      tipo.startsWith("audio/") ||
      tipo === "video/ogg" ||
      tipo === "application/ogg" ||
      tipo === "application/pdf" ||
      tipo.includes("officedocument") ||
      tipo === "application/msword" ||
      tipo === "text/plain" ||
      tipo === "text/csv" ||
      tipo === "application/octet-stream";

    if (!esPermitido) {
      return NextResponse.json({ ok: false, error: "Tipo de archivo no permitido" }, { status: 415 });
    }

    const ext =
      tipo.includes("png")
        ? "png"
        : tipo.includes("webp")
          ? "webp"
          : tipo.includes("gif")
            ? "gif"
            : tipo.includes("ogg")
              ? "ogg"
              : tipo.includes("mpeg") || tipo.includes("mp3")
                ? "mp3"
                : tipo.includes("mp4") || tipo.includes("m4a")
                  ? "m4a"
                  : tipo.includes("wav")
                    ? "wav"
                    : tipo.includes("pdf")
                      ? "pdf"
                      : "jpg";

    const nombreFinal =
      nombreSugerido && /\.[a-z0-9]{2,5}$/i.test(nombreSugerido)
        ? nombreSugerido
        : `${nombreSugerido || `tinkay-media-${Date.now()}`}.${ext}`;

    const contentTypeEfectivo =
      tipo === "video/ogg" || tipo === "application/ogg"
        ? "audio/ogg"
        : tipo;

    const bytes = await res.arrayBuffer();
    const headersResp: Record<string, string> = {
      "Content-Type": contentTypeEfectivo,
      "Cache-Control": "private, max-age=86400",
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombreFinal}"`,
    };
    const contentRange = res.headers.get("content-range");
    if (contentRange) {
      headersResp["Content-Range"] = contentRange;
    }

    return new NextResponse(bytes, {
      status: res.status === 206 ? 206 : 200,
      headers: headersResp,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error descargando archivo multimedia" },
      { status: 502 }
    );
  }
}
