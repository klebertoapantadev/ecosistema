"use server";

import { headers } from "next/headers";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { detalleSeguro, registrarTraza, type NivelTraza } from "./trazas";

// Puerta del navegador a aud_traza. Cualquiera puede llamarla (el checkout lo
// usan invitados), así que solo acepta flujos y negocios conocidos, exige el
// formato de la correlación, recorta todo, limita llamadas por IP y fija
// el origen en CLIENTE: no puede hacerse pasar por el servidor ni el webhook.
// Lo que manda el navegador es indicio, no prueba: por eso queda marcado.

const FLUJOS_PERMITIDOS = new Set(["PAGO_PLUX", "PANEL"]);
const NEGOCIOS_PERMITIDOS = new Set(["tranqi", "tinkay", "fastfix", "margaritas"]);
const NIVELES: NivelTraza[] = ["INFO", "AVISO", "ERROR"];
const RE_PASO = /^[a-z0-9_.]{1,60}$/;
// Identificador PLUX (mismo formato que REGEX_IDENTIFICADOR_PLUX en
// @eco/comercio) o el id de carga de página que genera CapturadorErrores.
const RE_CORRELACION = /^([A-Z]{3}-PLX-[0-9A-F]{12}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const MAX_DETALLE_CLIENTE = 2000;

// Límite por IP en memoria de la instancia: no es exacto en serverless (cada
// instancia cuenta lo suyo), pero corta un bucle o un abuso sencillo. Un pago
// normal deja menos de 10 trazas del navegador y CapturadorErrores manda como
// mucho 25 por carga de página; hay holgura para varias personas tras una IP.
const VENTANA_MS = 10 * 60_000;
const MAX_POR_VENTANA = 150;
const llamadasPorIp = new Map<string, { desde: number; n: number }>();

function superaLimite(ip: string): boolean {
  const ahora = Date.now();
  if (llamadasPorIp.size > 5000) {
    for (const [k, v] of llamadasPorIp) if (ahora - v.desde > VENTANA_MS) llamadasPorIp.delete(k);
  }
  const actual = llamadasPorIp.get(ip);
  if (!actual || ahora - actual.desde > VENTANA_MS) {
    llamadasPorIp.set(ip, { desde: ahora, n: 1 });
    return false;
  }
  actual.n += 1;
  return actual.n > MAX_POR_VENTANA;
}

export interface TrazaCliente {
  flujo: string;
  paso: string;
  nivel?: NivelTraza;
  negocio?: string;
  correlacion?: string | null;
  duracionMs?: number;
  mensaje?: string;
  detalle?: Record<string, unknown>;
}

export async function registrarTrazaClienteAction(t: TrazaCliente): Promise<void> {
  try {
    if (!t || typeof t !== "object") return;
    if (typeof t.flujo !== "string" || !FLUJOS_PERMITIDOS.has(t.flujo)) return;
    if (typeof t.paso !== "string" || !RE_PASO.test(t.paso)) return;

    let agente: string | null = null;
    let ip = "desconocida";
    try {
      const h = await headers();
      agente = h.get("user-agent");
      ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "desconocida").split(",")[0]!.trim().slice(0, 64);
    } catch {
      // Fuera de una petición (tests): sin cabeceras.
    }
    if (superaLimite(ip)) return;

    const nivel = typeof t.nivel === "string" && NIVELES.includes(t.nivel) ? t.nivel : "INFO";
    const negocioNorm = typeof t.negocio === "string" ? t.negocio.trim().toLowerCase() : "";
    const negocio = NEGOCIOS_PERMITIDOS.has(negocioNorm) ? negocioNorm : null;
    const correlacion = typeof t.correlacion === "string" && RE_CORRELACION.test(t.correlacion) ? t.correlacion : null;
    const duracionMs =
      typeof t.duracionMs === "number" && Number.isFinite(t.duracionMs) && t.duracionMs >= 0
        ? Math.min(t.duracionMs, 86_400_000)
        : null;
    const detalleCliente =
      t.detalle && typeof t.detalle === "object" && !Array.isArray(t.detalle)
        ? detalleSeguro(t.detalle, MAX_DETALLE_CLIENTE)
        : {};

    let usuarioId: string | null = null;
    try {
      const supabase: any = await crearClienteServidor();
      const { data } = await supabase.auth.getUser();
      usuarioId = data?.user?.id ?? null;
    } catch {
      // Invitado: la traza vale igual sin usuario.
    }

    await registrarTraza({
      flujo: t.flujo,
      paso: t.paso,
      nivel,
      origen: "CLIENTE",
      negocio,
      correlacion,
      duracionMs,
      mensaje: typeof t.mensaje === "string" ? t.mensaje.slice(0, 500) : null,
      usuarioId,
      detalle: { ...detalleCliente, user_agent: agente?.slice(0, 200) ?? null },
    });
  } catch {
    // Una traza nunca devuelve error al navegador.
  }
}
