// Cliente server-only para invocar agentes conversacionales de ARIA.
// Ningun producto llama a ARIA directamente: todos pasan por aqui.
// Ver ADR-0002 (gobernanza/arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md).

export interface ConfiguracionAgente {
  baseUrl: string;
  agentId: string;
  apiKey: string;
}

export interface RespuestaAgente {
  response: string;
  usage?: unknown;
  /** Run de ARIA. Se guarda en trq_mensaje para poder abrir su traza despues. */
  runId?: string;
}

/**
 * Resuelve la configuracion de un agente leyendo variables de entorno con el
 * prefijo dado (ej. "ARIA" -> ARIA_BASE, ARIA_AGENT_ID, ARIA_AGENT_KEY).
 *
 * Estrategia temporal: cuando exista el catalogo comun_agentes.age_agente_conversacional
 * (ADR-0002), esta funcion cambia a resolver producto+rol contra esa tabla y
 * leer la variable de entorno que la tabla indique. Es el unico punto que
 * cambiara -- ningun Route Handler de producto necesita tocarse.
 */
export function resolverAgenteDesdeEntorno(prefijo: string): ConfiguracionAgente | null {
  const baseUrl = process.env[`${prefijo}_BASE`];
  const agentId = process.env[`${prefijo}_AGENT_ID`];
  const apiKey = process.env[`${prefijo}_AGENT_KEY`];
  if (!baseUrl || !agentId || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), agentId, apiKey };
}

export async function invocarAgente(
  config: ConfiguracionAgente,
  prompt: string,
  conversationId?: string,
  /**
   * Valores para las plantillas `{{clave}}` de los headers de las herramientas
   * del agente en ARIA. Es la via por la que la identidad del usuario llega a
   * un MCP sin pasar por el prompt: el modelo no lo ve ni lo puede alterar.
   * Ver `capsula.ts` y `runtime_tools.render_contexto` en el backend de ARIA.
   */
  toolContext?: Record<string, string>,
): Promise<RespuestaAgente> {
  const r = await fetch(`${config.baseUrl}/v1/agents/${config.agentId}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      conversation_id: conversationId,
      tool_context: toolContext,
    }),
    signal: AbortSignal.timeout(120000),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.detail ?? data?.error ?? `ARIA respondio ${r.status}`);
  }
  return {
    response: data.response ?? data.detail ?? "…",
    usage: data.usage,
    runId: data.run_id,
  };
}

export { firmarJwtHs256, verificarJwtHs256 } from "./jwt";
export {
  firmarCapsula,
  verificarCapsula,
  acunarTokenSupabase,
  type RolAsistente,
  type SesionAsistente,
} from "./capsula";
export {
  crearManejadorMcp,
  type Herramienta,
  type OpcionesServidorMcp,
} from "./mcp-servidor";
export {
  llamarConsola,
  resolverConsolaDesdeEntorno,
  type ConfiguracionConsola,
  type RespuestaConsola,
} from "./consola";
