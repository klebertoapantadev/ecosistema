import { NextResponse } from "next/server";
import { registrarEventoPuenteOmnicanalPublicoAction } from "@eco/comercio";

export async function POST(request: Request) {
  try {
    const texto = await request.text();
    if (!texto) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const body = JSON.parse(texto) as Record<string, unknown>;
    const direccion =
      body.direccion === "WHATSAPP_A_WEB" ? "WHATSAPP_A_WEB" : "WEB_A_WHATSAPP";

    const res = await registrarEventoPuenteOmnicanalPublicoAction({
      negocio: typeof body.negocio === "string" ? body.negocio : "tinkay",
      direccion,
      refWeb: typeof body.refWeb === "string" ? body.refWeb : null,
      wref: typeof body.wref === "string" ? body.wref : null,
      claveHiloWeb: typeof body.claveHiloWeb === "string" ? body.claveHiloWeb : null,
      productoNombre: typeof body.productoNombre === "string" ? body.productoNombre : null,
      productoSlug: typeof body.productoSlug === "string" ? body.productoSlug : null,
      varianteNombre: typeof body.varianteNombre === "string" ? body.varianteNombre : null,
      pvp: typeof body.pvp === "number" ? body.pvp : null,
      urlPagina: typeof body.urlPagina === "string" ? body.urlPagina : null,
      visitanteNombre: typeof body.visitanteNombre === "string" ? body.visitanteNombre : null,
      visitanteCorreo: typeof body.visitanteCorreo === "string" ? body.visitanteCorreo : null,
      visitanteTelefono:
        typeof body.visitanteTelefono === "string" ? body.visitanteTelefono : null,
    });

    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
