"use client";

// Trazas automáticas del navegador (TRQ-040): errores JS sin capturar,
// promesas rechazadas sin manejar y llamadas a Supabase que fallan o tardan,
// con la ruta donde ocurrieron. Van a comun_auditoria.aud_traza (flujo PANEL)
// por registrarTrazaClienteAction. No pinta nada.
import { useEffect } from "react";
import { registrarTrazaClienteAction } from "@eco/auditoria/acciones-trazas";
import { observarSupabase, type EventoSupabase } from "@eco/supabase/observador";

const NEGOCIO = "tranqi";
// Tope por carga de página: un error dentro de un bucle no debe inundar la tabla.
const MAX_POR_CARGA = 25;

// Ruido que no es de la app: extensiones del navegador y avisos benignos.
const RUIDO = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:/i;

export function CapturadorErrores() {
  useEffect(() => {
    const idCarga = crypto.randomUUID();
    const vistos = new Set<string>();
    let enviados = 0;

    const enviar = (paso: string, nivel: "AVISO" | "ERROR", mensaje: string, detalle: Record<string, unknown>, duracionMs?: number) => {
      const clave = `${paso}|${mensaje}`;
      if (vistos.has(clave) || enviados >= MAX_POR_CARGA) return;
      vistos.add(clave);
      enviados += 1;
      void registrarTrazaClienteAction({
        flujo: "PANEL",
        paso,
        nivel,
        negocio: NEGOCIO,
        correlacion: idCarga,
        mensaje,
        duracionMs,
        detalle: { ruta: window.location.pathname, ...detalle },
      }).catch(() => {});
    };

    const alError = (ev: ErrorEvent) => {
      const mensaje = ev.message || String(ev.error ?? "Error");
      if (RUIDO.test(mensaje) || RUIDO.test(ev.filename || "")) return;
      enviar("navegador.error_js", "ERROR", mensaje, {
        archivo: ev.filename?.split("?")[0],
        linea: ev.lineno,
        columna: ev.colno,
        pila: ev.error instanceof Error ? ev.error.stack?.split("\n").slice(0, 8).join("\n") : undefined,
      });
    };

    const alRechazo = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      const mensaje = r instanceof Error ? r.message : typeof r === "string" ? r : JSON.stringify(r ?? null)?.slice(0, 300) ?? "Promesa rechazada";
      if (RUIDO.test(mensaje)) return;
      enviar("navegador.promesa_rechazada", "ERROR", mensaje, {
        pila: r instanceof Error ? r.stack?.split("\n").slice(0, 8).join("\n") : undefined,
      });
    };

    const alEventoSupabase = (e: EventoSupabase) => {
      const mensaje =
        e.tipo === "lento"
          ? `${e.metodo} ${e.recurso} tardó ${Math.round(e.duracionMs / 100) / 10} s`
          : `${e.metodo} ${e.recurso} → ${e.status}${e.mensaje ? `: ${e.mensaje}` : ""}`;
      enviar(`supabase.${e.tipo}`, e.tipo === "lento" || (e.status >= 400 && e.status < 500) ? "AVISO" : "ERROR", mensaje, { ...e }, e.duracionMs);
    };

    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    observarSupabase(alEventoSupabase);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazo);
      observarSupabase(null);
    };
  }, []);

  return null;
}
