// Servidor MCP (Model Context Protocol) sobre HTTP, agnostico del framework.
//
// Expone las herramientas de un agente como un endpoint que ARIA consume con su
// cliente MCP (transporte `streamable_http`, ver _open_mcp en el engine de
// ARIA). Se implementa JSON-RPC 2.0 a mano, como en tools/aria-mcp/server.js:
// son cuatro metodos y el SDK oficial arrastraria dependencias a un paquete que
// hoy no tiene ninguna y que debe poder correr en el runtime Edge.
//
// Estado: NINGUNO. No hay sesion MCP ni `Mcp-Session-Id`; cada POST se resuelve
// solo. Es lo que corresponde a un Route Handler serverless, donde dos
// peticiones seguidas pueden caer en instancias distintas.

export interface Herramienta<Contexto> {
  descripcion: string;
  /** JSON Schema de los argumentos, tal cual se le presenta al modelo. */
  esquema: Record<string, unknown>;
  ejecutar(
    argumentos: Record<string, unknown>,
    contexto: Contexto,
  ): Promise<unknown>;
}

/**
 * Un documento que la herramienta entrega al modelo para que lo LEA, no solo
 * para que sepa que existe. Sale como bloque `resource_link` del resultado; el
 * engine de ARIA lo descarga, extrae el texto (o rasteriza un PDF escaneado) y
 * lo mete en la conversacion dentro del mismo turno (ver `_mcp_documentos` y
 * `attachments.py` en el backend de ARIA).
 *
 * La URL tiene que ser alcanzable desde ARIA y de corta vida: es un documento
 * privado y el enlace queda en la traza del run.
 */
export interface DocumentoAdjunto {
  url: string;
  nombre: string;
  mime?: string;
}

/** Resultado de herramienta con texto y documentos adjuntos. Ver `conDocumentos`. */
export interface ResultadoConDocumentos {
  texto: string;
  documentos: DocumentoAdjunto[];
}

const MARCA_DOCUMENTOS = Symbol.for("eco.agentes-ia.resultado-con-documentos");

/**
 * Construye el resultado de una herramienta que, ademas de texto, entrega
 * documentos para leer. Se marca con un simbolo para que un objeto cualquiera
 * con las mismas claves —una fila de base de datos, por ejemplo— no se
 * convierta por accidente en enlaces que ARIA saldria a descargar.
 */
export function conDocumentos(
  texto: string,
  documentos: DocumentoAdjunto[],
): ResultadoConDocumentos {
  return Object.assign(Object.create(null), { texto, documentos, [MARCA_DOCUMENTOS]: true });
}

function esResultadoConDocumentos(valor: unknown): valor is ResultadoConDocumentos {
  return (
    typeof valor === "object" &&
    valor !== null &&
    (valor as Record<symbol, unknown>)[MARCA_DOCUMENTOS] === true
  );
}

export interface OpcionesServidorMcp<Contexto> {
  nombre: string;
  version?: string;
  herramientas: Record<string, Herramienta<Contexto>>;
  /**
   * Resuelve quien llama a partir de los headers. Devolver `null` corta la
   * peticion con 401 ANTES de tocar ninguna herramienta.
   */
  autenticar(peticion: Request): Promise<Contexto | null>;
}

const VERSION_PROTOCOLO_POR_DEFECTO = "2025-06-18";

/**
 * Tope del texto que devuelve una herramienta. Una consulta que traiga cien
 * casos con sus documentos reventaria la ventana de contexto del modelo y
 * ademas costaria dinero. Se corta y se avisa, en vez de truncar en silencio.
 */
const MAX_CARACTERES_RESULTADO = 16000;

interface MensajeJsonRpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function respuestaOk(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function respuestaError(
  id: string | number | null | undefined,
  code: number,
  message: string,
) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function comoTexto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  try {
    return JSON.stringify(valor, null, 2);
  } catch {
    return String(valor);
  }
}

export function crearManejadorMcp<Contexto>(
  opciones: OpcionesServidorMcp<Contexto>,
): (peticion: Request) => Promise<Response> {
  const { nombre, version = "1.0.0", herramientas, autenticar } = opciones;

  async function atender(
    mensaje: MensajeJsonRpc,
    contexto: Contexto,
  ): Promise<object | null> {
    const { id, method, params } = mensaje;

    // Sin `id` es una notificacion: el protocolo prohibe responderla.
    const esNotificacion = id === undefined;

    switch (method) {
      case "initialize":
        return respuestaOk(id, {
          // Se devuelve la version que pidio el cliente cuando la manda, para
          // no forzar una negociacion a la baja con clientes mas nuevos.
          protocolVersion: params?.protocolVersion ?? VERSION_PROTOCOLO_POR_DEFECTO,
          capabilities: { tools: {} },
          serverInfo: { name: nombre, version },
        });

      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      case "ping":
        return respuestaOk(id, {});

      case "tools/list":
        return respuestaOk(id, {
          tools: Object.entries(herramientas).map(([clave, h]) => ({
            name: clave,
            description: h.descripcion,
            inputSchema: h.esquema,
          })),
        });

      case "tools/call": {
        const clave = params?.name;
        const herramienta = typeof clave === "string" ? herramientas[clave] : undefined;
        if (!herramienta) {
          return respuestaError(id, -32602, `La herramienta '${String(clave)}' no existe.`);
        }
        const argumentos = (params?.arguments ?? {}) as Record<string, unknown>;
        try {
          const resultado = await herramienta.ejecutar(argumentos, contexto);
          const documentos = esResultadoConDocumentos(resultado) ? resultado.documentos : [];
          let texto = comoTexto(esResultadoConDocumentos(resultado) ? resultado.texto : resultado);
          if (texto.length > MAX_CARACTERES_RESULTADO) {
            texto =
              texto.slice(0, MAX_CARACTERES_RESULTADO) +
              "\n\n[…resultado recortado por tamaño. Acota la consulta —por fecha, " +
              "por caso o con un limite mas bajo— para verlo completo.]";
          }
          return respuestaOk(id, {
            content: [
              { type: "text", text: texto },
              ...documentos.map((d) => ({
                type: "resource_link",
                uri: d.url,
                name: d.nombre,
                ...(d.mime ? { mimeType: d.mime } : {}),
              })),
            ],
          });
        } catch (error) {
          // Un fallo de herramienta NO es un error de protocolo: se devuelve
          // como resultado con isError para que el modelo lo lea y se lo pueda
          // explicar al usuario, en vez de romper el turno entero.
          const detalle = error instanceof Error ? error.message : String(error);
          return respuestaOk(id, {
            content: [{ type: "text", text: `La herramienta falló: ${detalle}` }],
            isError: true,
          });
        }
      }

      default:
        if (esNotificacion) return null;
        return respuestaError(id, -32601, `Metodo no soportado: ${String(method)}`);
    }
  }

  return async function manejar(peticion: Request): Promise<Response> {
    if (peticion.method !== "POST") {
      // Sin transporte SSE iniciado por el servidor: no hay nada que ofrecer en
      // GET, y el cliente MCP acepta este 405 y sigue solo con POST.
      return new Response("Metodo no permitido", { status: 405 });
    }

    const contexto = await autenticar(peticion);
    if (contexto === null) {
      return Response.json(
        respuestaError(null, -32001, "No autorizado"),
        { status: 401 },
      );
    }

    let cuerpo: unknown;
    try {
      cuerpo = await peticion.json();
    } catch {
      return Response.json(respuestaError(null, -32700, "JSON invalido"), { status: 400 });
    }

    const mensajes: MensajeJsonRpc[] = Array.isArray(cuerpo)
      ? (cuerpo as MensajeJsonRpc[])
      : [cuerpo as MensajeJsonRpc];

    const respuestas: object[] = [];
    for (const mensaje of mensajes) {
      const respuesta = await atender(mensaje, contexto);
      if (respuesta) respuestas.push(respuesta);
    }

    // Solo habia notificaciones: 202 sin cuerpo, como pide la especificacion.
    if (respuestas.length === 0) return new Response(null, { status: 202 });

    const carga = Array.isArray(cuerpo) ? respuestas : respuestas[0];

    // La especificacion de Streamable HTTP admite responder JSON o SSE. Se
    // negocia porque distintos clientes MCP prefieren uno u otro; ARIA usa el
    // cliente de Python, que acepta los dos.
    const acepta = peticion.headers.get("accept") ?? "";
    if (acepta.includes("text/event-stream")) {
      const evento = `event: message\ndata: ${JSON.stringify(carga)}\n\n`;
      return new Response(evento, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return Response.json(carga, { status: 200 });
  };
}
