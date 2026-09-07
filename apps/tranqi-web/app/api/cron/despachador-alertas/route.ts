import { NextRequest, NextResponse } from "next/server";
import {
  autorizacionCronValida,
  despacharTareasProgramadas,
  type OrigenDespacho
} from "@eco/notificaciones/despachador";

/**
 * Disparo del despachador de tareas programadas (PLT-021 / PLT-020 regla 8).
 *
 * Acepta GET y POST porque los dos disparadores previstos no coinciden: Vercel
 * Cron emite GET, y el `curl` de un crontab de Linux es POST según la
 * especificación. Rechazar uno de los dos ataría el despliegue a un proveedor,
 * que es justo lo que este endpoint existe para evitar.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function despachar(request: NextRequest) {
  if (!autorizacionCronValida(request.headers.get("authorization"))) {
    // Sin detalle: distinguir «secreto incorrecto» de «secreto no configurado»
    // le diría a quien sondea el endpoint en cuál de los dos casos está.
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // Vercel Cron se identifica con su propia cabecera. Cualquier otro origen es
  // un cron externo, que es exactamente lo que buscamos poder ser.
  const origen: OrigenDespacho = request.headers.get("x-vercel-cron")
    ? "vercel_cron"
    : "linux_cron";

  const resumen = await despacharTareasProgramadas(origen);

  // 207 cuando alguna tarea falló pero otras funcionaron: un 200 escondería el
  // fallo del monitor, y un 500 haría pensar que no se hizo nada.
  return NextResponse.json(
    { ok: resumen.fallos === 0, ...resumen },
    { status: resumen.fallos === 0 ? 200 : 207 }
  );
}

export async function GET(request: NextRequest) {
  return despachar(request);
}

export async function POST(request: NextRequest) {
  return despachar(request);
}
