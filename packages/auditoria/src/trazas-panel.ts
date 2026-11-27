import type { EventoSupabase } from "@eco/supabase/observador";
import { registrarTraza } from "./trazas";

// Trazas automáticas del panel (flujo PANEL, TRQ-040): fallos de Supabase y
// excepciones del servidor, sin instrumentar cada acción a mano. Las registra
// instrumentation.ts de cada app.

interface ContextoPeticion {
  correlacion: string | null;
  ruta: string | null;
  accion: string | null;
}

// Dentro de una petición (página, server action, ruta API) saca de las
// cabeceras de qué pantalla viene. Fuera de una petición devuelve vacío.
async function contextoPeticion(): Promise<ContextoPeticion> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const accion = h.get("next-action");
    let ruta = h.get("x-matched-path") || h.get("next-url") || null;
    // Una server action se publica en la ruta de la pantalla que la llamó, que
    // es su referer. En una carga de página el referer es la página anterior:
    // ahí manda la ruta de la propia petición.
    const referer = h.get("referer");
    if (accion && referer) {
      try {
        ruta = new URL(referer).pathname;
      } catch {
        // Referer ilegible: queda la ruta de la cabecera.
      }
    }
    return {
      correlacion: h.get("x-vercel-id")?.slice(0, 80) ?? null,
      ruta: ruta?.slice(0, 200) ?? null,
      accion: accion?.slice(0, 60) ?? null,
    };
  } catch {
    return { correlacion: null, ruta: null, accion: null };
  }
}

export async function trazarEventoSupabaseServidor(evento: EventoSupabase, negocio: string): Promise<void> {
  const ctx = await contextoPeticion();
  await registrarTraza({
    flujo: "PANEL",
    paso: `supabase.${evento.tipo}`,
    nivel: evento.tipo === "lento" || (evento.status >= 400 && evento.status < 500) ? "AVISO" : "ERROR",
    origen: "SERVIDOR",
    negocio,
    correlacion: ctx.correlacion,
    duracionMs: evento.duracionMs,
    mensaje:
      evento.tipo === "lento"
        ? `${evento.metodo} ${evento.recurso} tardó ${Math.round(evento.duracionMs / 100) / 10} s`
        : `${evento.metodo} ${evento.recurso} → ${evento.status}${evento.mensaje ? `: ${evento.mensaje}` : ""}`,
    detalle: { ...evento, ruta: ctx.ruta, accion: ctx.accion },
  });
}

export interface ErrorPeticion {
  mensaje: string;
  digest?: string;
  pila?: string;
  ruta: string;
  metodo: string;
  correlacion?: string | null;
  tipoRuta?: string;
  patronRuta?: string;
  origenRender?: string;
}

export async function trazarErrorServidor(error: ErrorPeticion, negocio: string): Promise<void> {
  await registrarTraza({
    flujo: "PANEL",
    paso: `servidor.excepcion${error.tipoRuta ? `.${error.tipoRuta}` : ""}`,
    nivel: "ERROR",
    origen: "SERVIDOR",
    negocio,
    correlacion: error.correlacion ?? null,
    mensaje: error.mensaje,
    detalle: {
      ruta: error.ruta,
      metodo: error.metodo,
      patron_ruta: error.patronRuta,
      origen_render: error.origenRender,
      digest: error.digest,
      pila: error.pila?.split("\n").slice(0, 8).join("\n"),
    },
  });
}
