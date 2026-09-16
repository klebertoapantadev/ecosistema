// Herramientas agénticas estándar del Catálogo Comercial (comun_comercio)
// Expone herramientas MCP para que modelos de IA consulten productos, precios, fotos y stock.

import { crearManejadorMcp, type Herramienta } from "./mcp-servidor";
import { extraerBearerToken, validarTokenMcpConRpc, type ContextoTokenMcp } from "./tokens-mcp";

export interface ContextoMcpCatalogo {
  negocioId: string;
  tokenNombre: string;
  alcances: string[];
}

export function crearServidorMcpCatalogo(opciones: {
  negocioPorDefecto: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const { negocioPorDefecto } = opciones;

  function obtenerSupabaseConfig() {
    const url = (
      opciones.supabaseUrl ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://oaybbpdxhlxjbpwnoymy.supabase.co"
    ).replace(/\/$/, "");

    const key =
      opciones.supabaseAnonKey ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";

    return { url, key };
  }

  const herramientas: Record<string, Herramienta<ContextoMcpCatalogo>> = {
    consultar_catalogo: {
      descripcion:
        "Busca productos, ramos, servicios y tarifas del catálogo oficial con precios, fotos y variantes.",
      esquema: {
        type: "object",
        properties: {
          termino: {
            type: "string",
            description: "Texto de búsqueda o palabra clave (ej. 'rosas rojas', 'divorcio', 'plomería')",
          },
          categoria: {
            type: "string",
            description: "Slug o nombre de categoría (ej. 'condolencias', 'cumpleanos', 'corporativo')",
          },
          presupuesto_max_usd: {
            type: "number",
            description: "Presupuesto máximo del cliente en dólares (USD)",
          },
          ocasion: {
            type: "string",
            description: "Ocasión especial (ej. 'aniversario', 'condolencias', 'grado')",
          },
        },
      },
      async ejecutar(args, ctx) {
        const { url, key } = obtenerSupabaseConfig();
        const endpointRpc = `${url}/rest/v1/rpc/tnk_fn_buscar_catalogo_conversacional`;
        try {
          const res = await fetch(endpointRpc, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              p_termino: args.termino ?? null,
              p_ocasion: args.ocasion ?? args.categoria ?? null,
              p_presupuesto_max_usd: args.presupuesto_max_usd ?? null,
            }),
            signal: AbortSignal.timeout(10000),
          });

          if (!res.ok) {
            // Fallback directo a consulta de productos en comun_comercio
            const resDirecta = await fetch(
              `${url}/rest/v1/com_producto_servicio?pro_negocio=eq.${ctx.negocioId}&pro_activo=eq.true&select=pro_id,pro_nombre,pro_slug,pro_descripcion,pro_detalle_producto,com_variante_precio(*)&limit=15`,
              {
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${key}`,
                },
              }
            );
            if (resDirecta.ok) {
              return await resDirecta.json();
            }
            return { error: "No se pudo consultar el catálogo en este momento." };
          }

          return await res.json();
        } catch (err) {
          return { error: "Error de conexión consultando el catálogo comercial." };
        }
      },
    },

    detalle_producto: {
      descripcion: "Obtiene los detalles completos de un producto o servicio por su identificador o slug.",
      esquema: {
        type: "object",
        properties: {
          slug_o_id: {
            type: "string",
            description: "Slug o UUID del producto/servicio",
          },
        },
        required: ["slug_o_id"],
      },
      async ejecutar(args, ctx) {
        const { url, key } = obtenerSupabaseConfig();
        const slugOId = String(args.slug_o_id ?? "").trim();
        const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOId);

        const filtro = esUuid ? `pro_id=eq.${slugOId}` : `pro_slug=eq.${slugOId}`;
        const endpoint = `${url}/rest/v1/com_producto_servicio?${filtro}&pro_negocio=eq.${ctx.negocioId}&select=pro_id,pro_nombre,pro_slug,pro_descripcion,pro_detalle_producto,com_variante_precio(*)&limit=1`;

        try {
          const res = await fetch(endpoint, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
          });
          const datos = await res.json();
          if (Array.isArray(datos) && datos.length > 0) {
            return datos[0];
          }
          return { error: `Producto no encontrado para '${slugOId}'` };
        } catch {
          return { error: "Error de conexión al obtener detalle del producto." };
        }
      },
    },
  };

  return crearManejadorMcp<ContextoMcpCatalogo>({
    nombre: `mcp-catalogo-${negocioPorDefecto}`,
    version: "1.0.0",
    herramientas,
    async autenticar(peticion: Request) {
      const token = extraerBearerToken(peticion);
      if (!token) return null;

      const { url, key } = obtenerSupabaseConfig();
      const validacion = await validarTokenMcpConRpc(
        token,
        url,
        key,
        "catalogo:leer"
      );

      if (!validacion || !validacion.valido || !validacion.negocioId) {
        return null;
      }

      return {
        negocioId: validacion.negocioId,
        tokenNombre: validacion.nombre ?? "Token MCP",
        alcances: validacion.alcances ?? [],
      };
    },
  });
}
