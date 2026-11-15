import { NextRequest, NextResponse } from "next/server";
import {
  consultarBandejaNotificacionesUsuario,
  ejecutarAccionBandejaNotificacionUsuario,
} from "@eco/notificaciones/api-usuario";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const negocio = req.nextUrl.searchParams.get("negocio") || "tinkay";
  const resultado = await consultarBandejaNotificacionesUsuario(negocio);
  return NextResponse.json(resultado);
}

export async function POST(req: NextRequest) {
  try {
    const cuerpo = await req.json();
    const negocio = req.nextUrl.searchParams.get("negocio") || cuerpo?.negocio || "tinkay";
    const resultado = await ejecutarAccionBandejaNotificacionUsuario(negocio, cuerpo);
    return NextResponse.json(resultado, { status: resultado.success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Cuerpo inválido" }, { status: 400 });
  }
}
