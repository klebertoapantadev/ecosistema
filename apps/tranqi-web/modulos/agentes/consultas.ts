import { llamarConsola, resolverConsolaDesdeEntorno } from "@eco/agentes-ia";

// Server-only. Lecturas de la consola de agentes.
//
// Van directas a ARIA con la key de tenant, sin pasar por /api/aria: ese proxy
// existe para el NAVEGADOR, que no puede tener la key. Un Server Component ya
// esta del lado seguro, y hacerle dar el rodeo por su propia API solo añadiria
// un salto de red y una cookie que reenviar.
//
// La autorizacion de estas lecturas la pone el layout de la seccion (rol admin
// + aal2). Estas funciones no se exportan a ningun sitio publico.

export interface AgenteResumen {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  model: string;
  enabled: boolean;
  identity?: string;
  system_sections?: Array<{ title: string; content: string }>;
  capabilities?: Record<string, unknown>;
}

export interface ServidorMcp {
  id: string;
  name: string;
  slug: string;
  transport: string;
  url: string | null;
  enabled: boolean;
}

export interface RunResumen {
  id: string;
  agent_id: string;
  status: string;
  duration_ms: number;
  created_at: string;
  source: string;
  prompt?: string;
}

/** Falta de configuracion o ARIA caido no deben tumbar la pantalla: se
 *  distingue "no hay nada" de "no se pudo preguntar". */
export type Resultado<T> = { ok: true; datos: T } | { ok: false; motivo: string };

async function consultar<T>(ruta: string): Promise<Resultado<T>> {
  const config = resolverConsolaDesdeEntorno("ARIA");
  if (!config) {
    return {
      ok: false,
      motivo: "Faltan las variables ARIA_BASE, ARIA_TENANT_KEY o ARIA_GATE_KEY.",
    };
  }
  try {
    const { estado, datos } = await llamarConsola(config, "GET", ruta);
    if (estado >= 400) {
      const detalle =
        datos && typeof datos === "object" && "detail" in datos
          ? String((datos as { detail: unknown }).detail)
          : `HTTP ${estado}`;
      return { ok: false, motivo: detalle };
    }
    return { ok: true, datos: datos as T };
  } catch (e) {
    return { ok: false, motivo: String((e as Error).message ?? e) };
  }
}

export function listarAgentes() {
  return consultar<AgenteResumen[]>("/v1/agents");
}

export function obtenerAgente(id: string) {
  return consultar<AgenteResumen>(`/v1/agents/${id}`);
}

export function listarServidoresMcp() {
  return consultar<ServidorMcp[]>("/v1/mcp-servers");
}

export function listarMcpDeAgente(id: string) {
  return consultar<ServidorMcp[]>(`/v1/agents/${id}/mcp-servers`);
}

export function listarRuns(limite = 20) {
  return consultar<RunResumen[]>(`/v1/runs?limit=${limite}`);
}
