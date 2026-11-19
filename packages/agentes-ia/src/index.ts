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
  /**
   * URLs de imágenes que el agente debe VER (visión). ARIA las descarga él
   * mismo y se las pasa al modelo como contenido multimodal, así que tienen que
   * ser alcanzables por HTTP desde el servidor de ARIA — para un documento
   * privado, una URL firmada de corta vida.
   *
   * No se mandan en base64 a propósito: el prompt viaja entero al proveedor y
   * en cada reintento, y una cédula escaneada son cientos de kilobytes.
   */
  imageUrls?: string[],
  /**
   * URLs de documentos que el agente debe LEER: PDF, DOCX, texto o imagen.
   * ARIA los descarga, extrae el texto y lo antepone al prompt; un PDF sin
   * capa de texto (escaneado) lo rasteriza y lo pasa como imágenes. Mismas
   * condiciones que `imageUrls`: alcanzables desde ARIA, firmadas y de corta
   * vida. Es la vía correcta para un PDF: mandado como `imageUrls`, ARIA lo
   * descarga como si fuera un JPEG y el modelo no ve nada.
   */
  documentUrls?: string[],
  /**
   * Cuanto se espera a ARIA antes de abortar. Tiene que quedar POR DEBAJO del
   * `maxDuration` de la ruta que llama: si Vercel mata la funcion antes, el
   * navegador recibe un 504 sin cuerpo y la ruta no llega a decir que paso.
   * Al vencer, el fetch lanza un `TimeoutError` que la ruta puede distinguir.
   */
  tiempoMaximoMs = 120000,
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
      image_urls: imageUrls,
      document_urls: documentUrls,
    }),
    signal: AbortSignal.timeout(tiempoMaximoMs),
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

export interface OpcionesInvocarPorNegocio {
  conversationId?: string;
  toolContext?: Record<string, string>;
  imageUrls?: string[];
  documentUrls?: string[];
  tiempoMaximoMs?: number;
  /** Prefijo de variables de entorno de respaldo cuando Vault no está activo (por defecto "ARIA"). */
  prefijoEntornoRespaldo?: string;
  /**
   * JWT de sesión del usuario autenticado (ej. `session.access_token`).
   * Permite usar el puente RPC autenticado `cfg_fn_invocar_aria_multimodal`
   * (Visión / Documentos vía Vault + pgsql-http) cuando la Edge Function
   * `invocar-aria` no está desplegada o no tiene `ARIA_FUNCION_CLAVE`.
   */
  accessToken?: string;
}

export class ErrorSinConfiguracionAria extends Error {
  readonly codigo = "SIN_CONFIGURACION_ARIA";
  constructor(negocio: string, detallePersonalizado?: string) {
    super(
      detallePersonalizado ??
        `Sin credenciales activas de ARIA para "${negocio}" en /panel/aria ni variables de entorno (ARIA_BASE, ARIA_AGENT_ID, ARIA_AGENT_KEY)`,
    );
    this.name = "ErrorSinConfiguracionAria";
  }
}

/**
 * Invoca el agente conversacional del negocio usando primero la configuración
 * administrada por negocio en `comun_configuracion.cfg_aria` + Supabase Vault
 * (Edge Function `invocar-aria`), con respaldo automático a variables de entorno
 * (`ARIA_BASE`, `ARIA_AGENT_ID`, `ARIA_AGENT_KEY`) si el negocio aún no activó
 * su configuración en `/panel/aria` o la función aún no está desplegada.
 */
export async function invocarAgentePorNegocio(
  negocio: string,
  prompt: string,
  opciones?: OpcionesInvocarPorNegocio,
): Promise<RespuestaAgente> {
  const tiempoMaximoMs = opciones?.tiempoMaximoMs ?? 120000;
  const prefijoRespaldo = opciones?.prefijoEntornoRespaldo ?? "ARIA";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  const claveFuncion = process.env.ARIA_FUNCION_CLAVE ?? process.env.CORREO_FUNCION_CLAVE;

  let errorVaultNoConfigurado = false;
  let faltaPuenteSupabase = false;
  let faltaPuenteMultimodal = false;
  let errorInfraestructuraVault: string | null = null;
  let errorAguasArribaAria: Error | null = null;

  if (supabaseUrl && supabaseKey) {
    const baseSupabase = supabaseUrl.replace(/\/+$/, "");
    let funcionNoDisponibleParaEstaLlamada = false;

    // 1. Intentar primero vía Edge Function invocar-aria (soporta adjuntos y tool_context)
    try {
      const urlFuncion = `${baseSupabase}/functions/v1/invocar-aria`;
      const cabeceras: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      };
      if (claveFuncion) {
        cabeceras["x-aria-clave"] = claveFuncion;
      }

      const r = await fetch(urlFuncion, {
        method: "POST",
        headers: cabeceras,
        body: JSON.stringify({
          negocio: negocio.trim().toLowerCase(),
          prompt,
          conversation_id: opciones?.conversationId,
          tool_context: opciones?.toolContext,
          image_urls: opciones?.imageUrls,
          document_urls: opciones?.documentUrls,
          tiempo_maximo_ms: Math.min(tiempoMaximoMs, 110000),
        }),
        signal: AbortSignal.timeout(tiempoMaximoMs),
      });

      const data = await r.json().catch(() => null);

      if (r.ok && data) {
        return {
          response: data.response ?? data.detail ?? "…",
          usage: data.usage,
          runId: data.runId ?? data.run_id,
        };
      }

      if (r.status === 404 || (r.status === 401 && !claveFuncion)) {
        funcionNoDisponibleParaEstaLlamada = true;
      } else if (r.status === 409) {
        errorVaultNoConfigurado = true;
      } else if (r.status === 502) {
        errorAguasArribaAria = new Error(data?.error ?? data?.detail ?? "ARIA respondió con error (502)");
      } else {
        errorInfraestructuraVault = data?.error ?? `invocar-aria respondió ${r.status}`;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw err;
      }
      funcionNoDisponibleParaEstaLlamada = true;
    }

    // 2. Si la Edge Function aún no está desplegada (404) o requiere x-aria-clave no definida (401),
    //    usar el puente RPC directo en PostgreSQL (Vault + pgsql-http):
    //    - Multimodal (imageUrls / documentUrls): `cfg_fn_invocar_aria_multimodal` (autenticado)
    //    - Texto simple: `cfg_fn_invocar_aria`
    const tieneToolContext = Boolean(opciones?.toolContext);
    const esLlamadaMultimodal =
      Boolean(opciones?.imageUrls?.length) || Boolean(opciones?.documentUrls?.length);

    if (funcionNoDisponibleParaEstaLlamada && !tieneToolContext && !errorAguasArribaAria) {
      const nombreRpc = esLlamadaMultimodal
        ? "cfg_fn_invocar_aria_multimodal"
        : "cfg_fn_invocar_aria";
      const tokenAutorizacion =
        esLlamadaMultimodal && opciones?.accessToken ? opciones.accessToken : supabaseKey;
      const cuerpoRpc = esLlamadaMultimodal
        ? {
            p_negocio: negocio.trim().toLowerCase(),
            p_prompt: prompt,
            p_image_urls: opciones?.imageUrls?.length ? opciones.imageUrls : null,
            p_document_urls: opciones?.documentUrls?.length ? opciones.documentUrls : null,
            p_conversation_id: opciones?.conversationId ?? null,
          }
        : {
            p_negocio: negocio.trim().toLowerCase(),
            p_prompt: prompt,
            p_conversation_id: opciones?.conversationId ?? null,
          };

      try {
        const rRpc = await fetch(`${baseSupabase}/rest/v1/rpc/${nombreRpc}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Profile": "comun_configuracion",
            apikey: supabaseKey,
            Authorization: `Bearer ${tokenAutorizacion}`,
          },
          body: JSON.stringify(cuerpoRpc),
          signal: AbortSignal.timeout(tiempoMaximoMs),
        });

        const dataRpc = await rRpc.json().catch(() => null);

        if (rRpc.ok && dataRpc) {
          if (dataRpc.ok === true) {
            return {
              response: dataRpc.response ?? "…",
              usage: dataRpc.usage,
              runId: dataRpc.runId ?? dataRpc.run_id,
            };
          }
          if (dataRpc.codigo === "SIN_CONFIGURACION_VAULT") {
            errorVaultNoConfigurado = true;
          } else {
            errorAguasArribaAria = new Error(
              dataRpc.error ?? "ARIA devolvió un error al procesar la consulta",
            );
          }
        } else if (rRpc.status === 404) {
          if (esLlamadaMultimodal) {
            faltaPuenteMultimodal = true;
          } else {
            faltaPuenteSupabase = true;
          }
        } else {
          errorInfraestructuraVault =
            dataRpc?.message ?? dataRpc?.error ?? `${nombreRpc} respondió ${rRpc.status}`;
        }
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw err;
        }
        errorInfraestructuraVault = err instanceof Error ? err.message : String(err);
      }
    }
  }

  if (errorAguasArribaAria) {
    throw errorAguasArribaAria;
  }

  const configEntorno = resolverAgenteDesdeEntorno(prefijoRespaldo);
  if (configEntorno) {
    return invocarAgente(
      configEntorno,
      prompt,
      opciones?.conversationId,
      opciones?.toolContext,
      opciones?.imageUrls,
      opciones?.documentUrls,
      tiempoMaximoMs,
    );
  }

  if (errorInfraestructuraVault && !errorVaultNoConfigurado) {
    throw new Error(errorInfraestructuraVault);
  }

  if (faltaPuenteMultimodal) {
    throw new ErrorSinConfiguracionAria(
      negocio,
      `Falta aplicar en Supabase SQL Editor la migración 20261119000001_cfg_fn_invocar_aria_multimodal.sql para habilitar ARIA Visión desde Vault.`,
    );
  }

  if (faltaPuenteSupabase) {
    throw new ErrorSinConfiguracionAria(
      negocio,
      `La clave puede estar guardada en Vault, pero falta aplicar en Supabase SQL Editor la función comun_configuracion.cfg_fn_invocar_aria (migración 20261112000001_cfg_fn_invocar_aria_rpc.sql) o desplegar la Edge Function invocar-aria.`,
    );
  }

  throw new ErrorSinConfiguracionAria(negocio);
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
  conDocumentos,
  type DocumentoAdjunto,
  type Herramienta,
  type OpcionesServidorMcp,
  type ResultadoConDocumentos,
} from "./mcp-servidor";
export {
  llamarConsola,
  resolverConsolaDesdeEntorno,
  type ConfiguracionConsola,
  type RespuestaConsola,
} from "./consola";
export {
  extraerBearerToken,
  validarTokenMcpConRpc,
  type ContextoTokenMcp,
  type TokenMcpItem,
  type RespuestaGenerarTokenMcp,
} from "./tokens-mcp";
export {
  crearServidorMcpCatalogo,
  type ContextoMcpCatalogo,
  type OpcionesServidorMcpCatalogo,
  type ParametrosCotizarEnvioMcp,
} from "./mcp-catalogo";



