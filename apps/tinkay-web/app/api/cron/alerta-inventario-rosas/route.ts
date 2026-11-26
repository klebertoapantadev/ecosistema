import { NextRequest, NextResponse } from "next/server";
import { autorizacionCronValida } from "@eco/notificaciones/despachador";
import { ejecutarCronAlertaInventarioRosas } from "@eco/comercio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function manejar(request: NextRequest) {
  if (!autorizacionCronValida(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const resumen = await ejecutarCronAlertaInventarioRosas(["tinkay"], 15);
  return NextResponse.json(resumen, { status: resumen.ok ? 200 : 207 });
}

export async function GET(request: NextRequest) {
  return manejar(request);
}

export async function POST(request: NextRequest) {
  return manejar(request);
}
