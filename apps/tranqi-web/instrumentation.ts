import type { Instrumentation } from "next";

// Trazas automáticas del panel (TRQ-040) en comun_auditoria.aud_traza:
// - register(): cada llamada a Supabase que falla o tarda (tablas, RPC, Edge
//   Functions, storage) desde páginas, server actions y rutas API.
// - onRequestError(): toda excepción sin manejar en el servidor.
// Solo en el runtime de Node: el middleware (edge) no registra.

const NEGOCIO = "tranqi";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ observarSupabase }, { trazarEventoSupabaseServidor }] = await Promise.all([
    import("@eco/supabase/observador"),
    import("@eco/auditoria/trazas-panel"),
  ]);
  observarSupabase((evento) => trazarEventoSupabaseServidor(evento, NEGOCIO));
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { trazarErrorServidor } = await import("@eco/auditoria/trazas-panel");
  const e = error as Error & { digest?: string };
  const vercelId = request.headers["x-vercel-id"];
  await trazarErrorServidor(
    {
      mensaje: e?.message ?? String(error),
      digest: e?.digest,
      pila: e?.stack,
      ruta: request.path,
      metodo: request.method,
      correlacion: Array.isArray(vercelId) ? vercelId[0] : vercelId,
      tipoRuta: context.routeType,
      patronRuta: context.routePath,
      origenRender: "renderSource" in context ? String(context.renderSource) : undefined,
    },
    NEGOCIO,
  );
};
