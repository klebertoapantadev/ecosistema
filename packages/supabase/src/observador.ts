// Observador de llamadas a Supabase (TRQ-040).
//
// Los clientes de este paquete hacen sus peticiones con fetchObservado: si una
// llamada a tabla, RPC, Edge Function o storage falla o tarda demasiado, se
// avisa al observador registrado. Así queda rastro de los fallos de BD de todo
// el panel aunque el código que llamó se trague el error.
//
// Este paquete no sabe dónde se guarda el aviso: cada app registra su
// observador (tranqi-web: instrumentation.ts en el servidor y
// CapturadorErrores en el navegador). Sin observador no hace nada. Se guarda
// en globalThis porque instrumentation.ts y el resto de la app pueden quedar
// en módulos distintos del bundle.

export interface EventoSupabase {
  lado: "servidor" | "navegador";
  tipo: "error" | "lento" | "red";
  metodo: string;
  /** Recurso sin query string, p. ej. "rest/v1/rpc/com_fn_preparar_pago_plux". */
  recurso: string;
  status: number;
  duracionMs: number;
  codigo?: string | null;
  mensaje?: string | null;
}

export type ObservadorSupabase = (evento: EventoSupabase) => void | Promise<void>;

const CLAVE = "__ecoObservadorSupabase";
const UMBRAL_LENTO_MS = 4000;

export function observarSupabase(observador: ObservadorSupabase | null) {
  (globalThis as Record<string, unknown>)[CLAVE] = observador;
}

function observadorActual(): ObservadorSupabase | null {
  return ((globalThis as Record<string, unknown>)[CLAVE] as ObservadorSupabase | undefined) ?? null;
}

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function recursoDe(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+/, "").slice(0, 160);
  } catch {
    return url.split("?")[0]!.slice(0, 160);
  }
}

// Respuestas que no son fallos: el invitado sin sesión que consulta su usuario
// y el `.single()`/`.maybeSingle()` que no encuentra fila.
function esEsperado(recurso: string, status: number, codigo: string | null | undefined): boolean {
  if (recurso.startsWith("auth/v1/user") && (status === 401 || status === 403)) return true;
  if (recurso.startsWith("auth/v1/token") && status === 400) return true;
  if (status === 406 && codigo === "PGRST116") return true;
  return false;
}

async function avisar(evento: EventoSupabase) {
  const observador = observadorActual();
  if (!observador) return;
  try {
    await observador(evento);
  } catch {
    // Un observador que falla no puede romper la llamada observada.
  }
}

export function fetchObservado(lado: EventoSupabase["lado"]): typeof fetch {
  return async (input, init) => {
    const observador = observadorActual();
    const url = urlDe(input as RequestInfo | URL);
    // Sin observador, o si es la propia escritura de la traza: fetch normal.
    if (!observador || url.includes("aud_traza")) return fetch(input, init);

    const metodo = (init?.method || (typeof input === "object" && "method" in input ? input.method : "GET") || "GET").toUpperCase();
    const recurso = recursoDe(url);
    const inicio = Date.now();
    let respuesta: Response;
    try {
      respuesta = await fetch(input, init);
    } catch (e) {
      // Las cancelaciones las pide el propio código: no son fallos.
      if (!(e instanceof Error && e.name === "AbortError")) {
        await avisar({ lado, tipo: "red", metodo, recurso, status: 0, duracionMs: Date.now() - inicio, mensaje: e instanceof Error ? e.message : String(e) });
      }
      throw e;
    }
    const duracionMs = Date.now() - inicio;

    if (respuesta.status >= 400) {
      let codigo: string | null = null;
      let mensaje: string | null = null;
      try {
        const cuerpo: any = await respuesta.clone().json();
        codigo = cuerpo?.code != null ? String(cuerpo.code) : cuerpo?.error_code ?? null;
        mensaje = cuerpo?.message ?? cuerpo?.msg ?? cuerpo?.error_description ?? cuerpo?.error ?? null;
      } catch {
        // Cuerpo que no es JSON: basta con el status.
      }
      if (!esEsperado(recurso, respuesta.status, codigo)) {
        await avisar({ lado, tipo: "error", metodo, recurso, status: respuesta.status, duracionMs, codigo, mensaje: mensaje ? String(mensaje).slice(0, 500) : null });
      }
    } else if (duracionMs > UMBRAL_LENTO_MS) {
      await avisar({ lado, tipo: "lento", metodo, recurso, status: respuesta.status, duracionMs });
    }
    return respuesta;
  };
}
