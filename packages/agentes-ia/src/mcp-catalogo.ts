// Herramientas agénticas estándar del Catálogo Comercial (comun_comercio)
// Expone herramientas MCP para que modelos de IA consulten productos, precios, fotos y stock.

import { crearManejadorMcp, type Herramienta } from "./mcp-servidor";
import { extraerBearerToken, validarTokenMcpConRpc, type ContextoTokenMcp } from "./tokens-mcp";

export interface ContextoMcpCatalogo {
  negocioId: string;
  tokenNombre: string;
  alcances: string[];
}

export interface OpcionesServidorMcpCatalogo {
  negocioPorDefecto: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  consultarProductos?: (negocioId: string) => Promise<any[]>;
}

export function crearServidorMcpCatalogo(opciones: OpcionesServidorMcpCatalogo) {
  const { negocioPorDefecto } = opciones;

  function obtenerSupabaseConfig() {
    const url = (
      opciones.supabaseUrl ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://oaybbpdxhlxjbpwnoymy.supabase.co"
    ).replace(/\/$/, "");

    const key =
      (opciones.supabaseAnonKey && opciones.supabaseAnonKey.trim().length > 0 ? opciones.supabaseAnonKey : "") ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS";

    return { url, key };
  }

  async function obtenerListaProductos(negocioId: string): Promise<any[]> {
    if (typeof opciones.consultarProductos === "function") {
      try {
        const prods = await opciones.consultarProductos(negocioId);
        if (Array.isArray(prods) && prods.length > 0) {
          return prods;
        }
      } catch (err) {
        console.error("[@eco/agentes-ia] Error en consultarProductos inyectado:", err);
      }
    }

    const { url, key } = obtenerSupabaseConfig();
    try {
      const res = await fetch(
        `${url}/rest/v1/com_producto?pro_negocio=eq.${negocioId}&pro_activo=eq.true&select=pro_id,pro_nombre,pro_slug,pro_descripcion,pro_detalle_producto,com_variante(*)&order=pro_destacado.desc`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Accept-Profile": "comun_comercio",
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return [];
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
            description: "Texto de búsqueda o palabra clave (ej. 'rosas rojas', 'coreano', 'flores', 'divorcio', 'plomería')",
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
            description: "Ocasión especial (ej. 'aniversario', 'condolencias', 'grado', 'cumpleanos')",
          },
          canal: {
            type: "string",
            description: "Canal de visibilidad para filtrar productos: 'ECOMMERCE_WEB', 'APP_CLIENTES', 'CHATBOT_WEB', 'CHATBOT_APP', 'CHATBOT_WHATSAPP', 'OTROS_API' o 'todos'",
          },
        },
      },
      async ejecutar(args, ctx) {
        const prods = await obtenerListaProductos(ctx.negocioId);
        if (!prods || prods.length === 0) {
          return { error: "No se encontraron productos disponibles en el catálogo para este negocio." };
        }

        let filtrados = [...prods];

        if (args.canal && typeof args.canal === "string" && args.canal.toLowerCase() !== "todos") {
          const canalBuscado = args.canal.toUpperCase().trim();
          filtrados = filtrados.filter((p) => {
            const canales: string[] =
              p.canales_visibilidad ||
              p.pro_detalle_producto?.canales_visibilidad || [
                "ECOMMERCE_WEB",
                "APP_CLIENTES",
                "CHATBOT_WEB",
                "CHATBOT_APP",
                "CHATBOT_WHATSAPP",
                "OTROS_API",
              ];
            return canales.includes(canalBuscado);
          });
        }

        if (args.termino && typeof args.termino === "string" && args.termino.trim().length > 0) {
          const t = args.termino.toLowerCase().trim();
          filtrados = filtrados.filter((p) => {
            const nombre = String(p.pro_nombre || p.nombre || "").toLowerCase();
            const slug = String(p.pro_slug || p.slug || "").toLowerCase();
            const desc = String(p.pro_descripcion || p.descripcion || "").toLowerCase();
            const tags = Array.isArray(p.pro_detalle_producto?.etiquetas)
              ? p.pro_detalle_producto.etiquetas.join(" ").toLowerCase()
              : "";
            const vars = Array.isArray(p.variantes)
              ? p.variantes.map((v: any) => String(v.var_nombre || v.nombre || "")).join(" ").toLowerCase()
              : "";
            return nombre.includes(t) || slug.includes(t) || desc.includes(t) || tags.includes(t) || vars.includes(t);
          });
        }

        if (args.categoria || args.ocasion) {
          const cat = String(args.categoria || args.ocasion || "").toLowerCase().trim();
          filtrados = filtrados.filter((p) => {
            const slugCat = String(p.categoria?.ctg_slug || p.categoria?.slug || "").toLowerCase();
            const nomCat = String(p.categoria?.ctg_nombre || p.categoria?.nombre || "").toLowerCase();
            const tags = Array.isArray(p.pro_detalle_producto?.etiquetas)
              ? p.pro_detalle_producto.etiquetas.join(" ").toLowerCase()
              : "";
            const desc = String(p.pro_descripcion || "").toLowerCase();
            return slugCat.includes(cat) || nomCat.includes(cat) || tags.includes(cat) || desc.includes(cat);
          });
        }

        if (typeof args.presupuesto_max_usd === "number" && args.presupuesto_max_usd > 0) {
          const max = args.presupuesto_max_usd;
          filtrados = filtrados.filter((p) => {
            const variantes = Array.isArray(p.variantes) ? p.variantes : [];
            if (variantes.length === 0) return true;
            const minPrecio = Math.min(...variantes.map((v: any) => Number(v.precio_total ?? v.var_precio ?? 0)));
            return minPrecio <= max;
          });
        }

        return {
          total_encontrados: filtrados.length,
          negocio: ctx.negocioId,
          productos: filtrados.map((p) => ({
            id: p.pro_id || p.id,
            nombre: p.pro_nombre || p.nombre,
            slug: p.pro_slug || p.slug,
            descripcion: p.pro_descripcion || p.descripcion,
            tipo: p.pro_tipo || p.tipo,
            destacado: p.pro_destacado ?? false,
            categoria: p.categoria?.ctg_nombre || p.categoria?.nombre || null,
            album_fotos_url: p.pro_detalle_producto?.album_fotos_url || null,
            portada_url: p.pro_detalle_producto?.imagen_url || null,
            delivery_incluido: p.pro_detalle_producto?.logistica?.delivery_incluido ?? false,
            canales_visibilidad:
              p.canales_visibilidad ||
              p.pro_detalle_producto?.canales_visibilidad || [
                "ECOMMERCE_WEB",
                "APP_CLIENTES",
                "CHATBOT_WEB",
                "CHATBOT_APP",
                "CHATBOT_WHATSAPP",
                "OTROS_API",
              ],
            variantes: (p.variantes || []).map((v: any) => ({
              id: v.var_id || v.id,
              sku: v.var_sku || v.sku,
              nombre: v.var_nombre || v.nombre,
              base_imponible_usd: Number(v.var_precio || v.precio || 0),
              tarifa_iva: Number(v.var_tarifa_iva_porcentaje || 15),
              monto_iva_usd: Number(v.monto_iva || 0),
              pvp_total_usd: Number(v.precio_total || v.var_precio || 0),
              foto_variante_url: v.var_detalle_variante?.portada_url || null,
            })),
          })),
        };
      },
    },

    detalle_producto: {
      descripcion: "Obtiene los detalles completos de un producto o servicio por su identificador o slug.",
      esquema: {
        type: "object",
        properties: {
          slug_o_id: {
            type: "string",
            description: "Slug o UUID del producto/servicio (ej. 'tinkay-bouq-coreano' o '3af6aff5-ddd0-4746-b282-c760e4b42214')",
          },
        },
        required: ["slug_o_id"],
      },
      async ejecutar(args, ctx) {
        const slugOId = String(args.slug_o_id ?? "").trim().toLowerCase();
        if (!slugOId) {
          return { error: "El parámetro slug_o_id es obligatorio." };
        }

        const prods = await obtenerListaProductos(ctx.negocioId);
        const encontrado = prods.find((p) => {
          const id = String(p.pro_id || p.id || "").toLowerCase();
          const slug = String(p.pro_slug || p.slug || "").toLowerCase();
          return id === slugOId || slug === slugOId;
        });

        if (encontrado) {
          return {
            id: encontrado.pro_id || encontrado.id,
            nombre: encontrado.pro_nombre || encontrado.nombre,
            slug: encontrado.pro_slug || encontrado.slug,
            descripcion: encontrado.pro_descripcion || encontrado.descripcion,
            tipo: encontrado.pro_tipo || encontrado.tipo,
            destacado: encontrado.pro_destacado ?? false,
            categoria: encontrado.categoria || null,
            canales_visibilidad:
              encontrado.canales_visibilidad ||
              encontrado.pro_detalle_producto?.canales_visibilidad || [
                "ECOMMERCE_WEB",
                "APP_CLIENTES",
                "CHATBOT_WEB",
                "CHATBOT_APP",
                "CHATBOT_WHATSAPP",
                "OTROS_API",
              ],
            detalle_producto: encontrado.pro_detalle_producto || {},
            variantes: (encontrado.variantes || []).map((v: any) => ({
              id: v.var_id || v.id,
              sku: v.var_sku || v.sku,
              nombre: v.var_nombre || v.nombre,
              base_imponible_usd: Number(v.var_precio || v.precio || 0),
              tarifa_iva: Number(v.var_tarifa_iva_porcentaje || 15),
              monto_iva_usd: Number(v.monto_iva || 0),
              pvp_total_usd: Number(v.precio_total || v.var_precio || 0),
              detalle_variante: v.var_detalle_variante || {},
            })),
          };
        }

        return { error: `Producto no encontrado para '${args.slug_o_id}'` };
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

