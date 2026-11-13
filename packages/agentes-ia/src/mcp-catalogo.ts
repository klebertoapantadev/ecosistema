// Herramientas agénticas estándar del Catálogo Comercial (comun_comercio)
// Expone herramientas MCP para que modelos de IA consulten productos, precios, fotos y stock.

import { crearManejadorMcp, type Herramienta } from "./mcp-servidor";
import { extraerBearerToken, validarTokenMcpConRpc, type ContextoTokenMcp } from "./tokens-mcp";

export interface ContextoMcpCatalogo {
  negocioId: string;
  tokenNombre: string;
  alcances: string[];
  token: string;
}

export interface ParametrosCotizarEnvioMcp {
  enlace_o_direccion?: string;
  lat?: number;
  lng?: number;
  retiro_en_local?: boolean;
  delivery_incluido_producto?: boolean;
  recargo_logistico_producto_usd?: number;
}

export interface OpcionesServidorMcpCatalogo {
  negocioPorDefecto: string;
  urlBaseTienda?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  consultarProductos?: (negocioId: string) => Promise<any[]>;
  cotizarEnvio?: (negocioId: string, params: ParametrosCotizarEnvioMcp) => Promise<unknown>;
  herramientasAdicionales?: Record<
    string,
    Herramienta<ContextoMcpCatalogo> & { alcanceRequerido?: string }
  >;
}

const URL_TIENDA_OFICIAL_POR_NEGOCIO: Record<string, string> = {
  tinkay: "https://tinkay-web.vercel.app",
  margaritas: "https://margaritas-web.vercel.app",
  tranqi: "https://tranqi-web.vercel.app",
  fastfix: "https://fastfix-web.vercel.app",
};

function normalizarSlugUrl(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function obtenerUrlBaseTiendaMcp(negocioId: string, urlBaseExplicita?: string): string {
  if (urlBaseExplicita && urlBaseExplicita.trim()) {
    return urlBaseExplicita.trim().replace(/\/+$/, "");
  }
  const clave = String(negocioId || "tinkay").trim().toLowerCase();
  return URL_TIENDA_OFICIAL_POR_NEGOCIO[clave] || URL_TIENDA_OFICIAL_POR_NEGOCIO.tinkay!;
}

function construirUrlCategoriaMcp(baseTienda: string, slugONombre: unknown): string | null {
  const slug = normalizarSlugUrl(slugONombre);
  if (!slug || slug === "todos" || slug === "cat-todos" || slug === "todas") return null;
  return `${baseTienda}/categoria/${encodeURIComponent(slug)}`;
}

function construirUrlProductoMcp(
  baseTienda: string,
  slugOIdProducto: unknown,
  skuVariante?: unknown
): string | null {
  const slug = normalizarSlugUrl(slugOIdProducto);
  if (!slug) return null;
  const baseProd = `${baseTienda}/producto/${encodeURIComponent(slug)}`;
  const sku = String(skuVariante ?? "").trim();
  return sku ? `${baseProd}?variante=${encodeURIComponent(sku)}` : baseProd;
}

// Palabras que no aportan a la búsqueda: "permiso de salida para mi hijo" busca "permiso salida hijo".
const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "para", "por", "mi", "con", "y", "a", "en",
]);

/** Minúsculas, sin tildes y con guiones (también bajos) como espacios: "Salida del País" → "salida del pais". */
export function normalizarTextoBusqueda(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ");
}

/** Palabras del término que cuentan para la búsqueda, sin repetidas ni palabras vacías. */
export function palabrasSignificativas(termino: string): string[] {
  const palabras = normalizarTextoBusqueda(termino)
    .split(/[^a-z0-9]+/)
    // Una sola letra está contenida en casi cualquier texto: no discrimina.
    .filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p));
  return [...new Set(palabras)];
}

// Texto normalizado donde se busca cada palabra: nombre, slug, categoría, descripción, beneficios, etiquetas, usos y variantes.
function textoBuscable(p: any): string {
  const detalle = p.pro_detalle_producto ?? {};
  const etiquetas = Array.isArray(detalle.etiquetas) ? detalle.etiquetas : [];
  const beneficios = Array.isArray(detalle.beneficios)
    ? detalle.beneficios
    : typeof detalle.beneficios === "string"
    ? [detalle.beneficios]
    : [];
  const usos = Array.isArray(detalle.usos)
    ? detalle.usos
    : Array.isArray(detalle.ocasiones)
    ? detalle.ocasiones
    : [];
  const catNombre = p.categoria?.ctg_nombre || p.categoria?.nombre || p.categoria_nombre;
  const catSlug = p.categoria?.ctg_slug || p.categoria?.slug;
  const variantes = Array.isArray(p.variantes)
    ? p.variantes.flatMap((v: any) => [
        v.var_nombre || v.nombre,
        v.var_sku || v.sku,
        v.var_detalle_variante?.descripcion_corta,
        v.var_detalle_variante?.detalle,
        v.var_detalle_variante?.receta_bom,
        ...(Array.isArray(v.var_detalle_variante?.beneficios_custom)
          ? v.var_detalle_variante.beneficios_custom
          : []),
        ...(Array.isArray(v.var_detalle_variante?.usos)
          ? v.var_detalle_variante.usos
          : []),
      ])
    : [];
  return normalizarTextoBusqueda(
    [
      p.pro_nombre || p.nombre,
      p.pro_slug || p.slug,
      catNombre,
      catSlug,
      p.pro_descripcion || p.descripcion,
      detalle.descripcion_corta,
      detalle.ocasion_recomendada,
      ...beneficios,
      ...etiquetas,
      ...usos,
      ...variantes,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Filtra por las palabras del término y ordena por cuántas coinciden (más coincidencias primero;
 * los empates conservan el orden recibido). Un producto entra si coincide al menos una palabra.
 * Sin palabras significativas (término vacío o solo palabras vacías) devuelve la lista intacta.
 */
export function filtrarPorTermino<T>(productos: T[], termino: string): T[] {
  const palabras = palabrasSignificativas(termino);
  if (palabras.length === 0) return productos;

  return productos
    .map((producto) => {
      const texto = textoBuscable(producto);
      return { producto, puntuacion: palabras.filter((palabra) => texto.includes(palabra)).length };
    })
    .filter(({ puntuacion }) => puntuacion > 0)
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .map(({ producto }) => producto);
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

  async function obtenerListaProductos(negocioId: string, canal?: string): Promise<any[]> {
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

    // 1. Intentar primero RPC de base de datos directa
    try {
      const resRpc = await fetch(`${url}/rest/v1/rpc/com_fn_obtener_catalogo_productos`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_negocio: negocioId,
          p_canal: canal && canal !== "todos" && canal !== "TODOS" ? canal.toUpperCase().trim() : null,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (resRpc.ok) {
        const data = await resRpc.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // Fallback
    }

    // 2. Consulta directa REST a com_producto
    try {
      const res = await fetch(
        `${url}/rest/v1/com_producto?pro_negocio=eq.${negocioId}&pro_activo=eq.true&select=pro_id,pro_nombre,pro_slug,pro_tipo,pro_descripcion,pro_detalle_producto,com_variante(*)&order=pro_destacado.desc`,
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
        "Busca productos, ramos, sets de eventos, servicios y tarifas del catálogo oficial con precios, fotos, variantes y enlaces directos al E-Commerce (`url_tienda_producto`, `url_tienda_categoria`, `url_tienda_variante`). " +
        "Comparte siempre `url_tienda_producto` o `url_tienda_categoria` cuando el cliente quiera ver fotos en la tienda (por WhatsApp o Chat Web). " +
        "pvp_total_usd es el precio final con IVA; frecuencia indica si se cobra de forma recurrente (p. ej. MENSUAL) o es un pago único (null).",
      esquema: {
        type: "object",
        properties: {
          termino: {
            type: "string",
            description:
              "Texto de búsqueda: palabra clave o frase natural (ej. 'rosas rojas', 'coreano', 'eventos', 'cartel bienvenida', 'divorcio'). " +
              "Cada palabra se busca por separado, sin distinguir tildes; primero salen los productos que coinciden con más palabras.",
          },
          categoria: {
            type: "string",
            description: "Slug o nombre de categoría (ej. 'eventos', 'box-florales', 'condolencias', 'cumpleanos', 'corporativo')",
          },
          presupuesto_max_usd: {
            type: "number",
            description: "Presupuesto máximo del cliente en dólares (USD)",
          },
          uso: {
            type: "string",
            description: "Uso, aplicación o escenario recomendado (ej. 'cumpleanos', 'aniversario', 'amor', 'pedida_mano', 'recuperate', 'condolencias', 'creacion_empresa', 'fuga_agua')",
          },
          ocasion: {
            type: "string",
            description: "Alias de 'uso' para floristería (ej. 'aniversario', 'condolencias', 'grado', 'cumpleanos', 'eventos')",
          },
          canal: {
            type: "string",
            description: "Canal de visibilidad para filtrar productos: 'ECOMMERCE_WEB', 'APP_CLIENTES', 'CHATBOT_WEB', 'CHATBOT_APP', 'CHATBOT_WHATSAPP', 'OTROS_API' o 'todos'",
          },
        },
      },
      async ejecutar(args, ctx) {
        const baseTienda = obtenerUrlBaseTiendaMcp(ctx.negocioId, opciones.urlBaseTienda);
        const canalParam = typeof args.canal === "string" ? args.canal : undefined;
        const prods = await obtenerListaProductos(ctx.negocioId, canalParam);
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

        if (typeof args.termino === "string") {
          filtrados = filtrarPorTermino(filtrados, args.termino);
        }

        const criterioUso = normalizarTextoBusqueda(
          args.uso || args.ocasion || args.categoria || ""
        ).trim();
        if (criterioUso) {
          filtrados = filtrados.filter((p) => {
            const slugCat = normalizarTextoBusqueda(p.categoria?.ctg_slug || p.categoria?.slug || "");
            const nomCat = normalizarTextoBusqueda(p.categoria?.ctg_nombre || p.categoria?.nombre || "");
            const tags = Array.isArray(p.pro_detalle_producto?.etiquetas)
              ? p.pro_detalle_producto.etiquetas.map((t: string) => normalizarTextoBusqueda(t))
              : [];
            const usos = Array.isArray(p.pro_detalle_producto?.usos)
              ? p.pro_detalle_producto.usos.map((u: string) => normalizarTextoBusqueda(u))
              : Array.isArray(p.pro_detalle_producto?.ocasiones)
              ? p.pro_detalle_producto.ocasiones.map((u: string) => normalizarTextoBusqueda(u))
              : [];
            const desc = normalizarTextoBusqueda(p.pro_descripcion || "");

            const matchUso = usos.some((u: string) => Boolean(u) && (u.includes(criterioUso) || criterioUso.includes(u)));
            const matchTag = tags.some((t: string) => Boolean(t) && (t.includes(criterioUso) || criterioUso.includes(t)));

            return matchUso || matchTag || slugCat.includes(criterioUso) || nomCat.includes(criterioUso) || desc.includes(criterioUso);
          });
        }

        if (typeof args.presupuesto_max_usd === "number" && args.presupuesto_max_usd > 0) {
          const max = args.presupuesto_max_usd;
          filtrados = filtrados.filter((p) => {
            const variantes = Array.isArray(p.variantes) ? p.variantes : [];
            if (variantes.length === 0) return true;
            const minPrecio = Math.min(...variantes.map((v: any) => Number(v.precio_total ?? v.pvp_total_usd ?? v.var_precio ?? v.precio ?? 0)));
            return minPrecio <= max;
          });
        }

        const catFiltroUrl =
          typeof args.categoria === "string" && args.categoria.trim()
            ? construirUrlCategoriaMcp(
                baseTienda,
                filtrados[0]?.categoria?.ctg_slug ||
                  filtrados[0]?.categoria?.slug ||
                  filtrados[0]?.categoria?.ctg_nombre ||
                  args.categoria
              )
            : null;

        return {
          total_encontrados: filtrados.length,
          negocio: ctx.negocioId,
          url_tienda_general: `${baseTienda}/#catalogo`,
          ...(catFiltroUrl ? { url_tienda_categoria_consultada: catFiltroUrl } : {}),
          productos: filtrados.map((p) => {
            const prodSlug = p.pro_slug || p.slug || p.pro_id || p.id;
            const catNombre =
              p.categoria?.ctg_nombre || p.categoria?.nombre || p.categoria_nombre || null;
            const catSlug = p.categoria?.ctg_slug || p.categoria?.slug || catNombre;
            const listaVariantes = Array.isArray(p.variantes) ? p.variantes : [];

            return {
              id: p.pro_id || p.id || p.producto_id,
              nombre: p.pro_nombre || p.nombre,
              slug: p.pro_slug || p.slug,
              url_tienda_producto: construirUrlProductoMcp(baseTienda, prodSlug),
              url_tienda_categoria: construirUrlCategoriaMcp(baseTienda, catSlug),
              descripcion: p.pro_descripcion || p.descripcion,
              tipo: p.pro_tipo || p.tipo,
              destacado: p.pro_destacado ?? false,
              es_combo: Boolean(p.pro_detalle_producto?.es_combo),
              combo_componentes: Array.isArray(p.pro_detalle_producto?.combo_componentes)
                ? p.pro_detalle_producto.combo_componentes
                : undefined,
              categoria: catNombre,
              album_fotos_url: p.pro_detalle_producto?.album_fotos_url || p.album_fotos_url || null,
              portada_url: p.pro_detalle_producto?.imagen_url || p.portada_url || null,
              tipo_oferta: p.pro_tipo || p.tipo || "FISICO",
              es_renta: Boolean(
                p.pro_detalle_producto?.es_renta === true ||
                  String(p.pro_tipo || "").toUpperCase().includes("RENTA") ||
                  String(p.pro_tipo || "").toUpperCase().includes("ALQUILER")
              ),
              condiciones_renta: p.pro_detalle_producto?.renta_config || null,
              delivery_incluido: p.pro_detalle_producto?.logistica?.delivery_incluido ?? p.delivery_incluido ?? false,
              usos: p.pro_detalle_producto?.usos || p.pro_detalle_producto?.ocasiones || [],
              etiquetas: p.pro_detalle_producto?.etiquetas || [],
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
              variantes: listaVariantes.map((v: any) => {
                const base = Number(v.var_precio ?? v.precio ?? v.precio_base_usd ?? 0);
                const tarifaIva = Number(
                  v.var_tarifa_iva_porcentaje ??
                  v.tarifa_iva ??
                  p.pro_detalle_producto?.tarifa_iva_predeterminada ??
                  0
                );
                const montoIva = Number(v.monto_iva ?? v.monto_iva_usd ?? ((base * tarifaIva) / 100));
                const pvpTotal = Number(v.precio_total ?? v.pvp_total_usd ?? (base + montoIva));
                const skuVar = v.var_sku || v.sku;

                return {
                  id: v.var_id || v.id || v.variante_id,
                  sku: skuVar,
                  nombre: v.var_nombre || v.nombre,
                  url_tienda_variante: construirUrlProductoMcp(
                    baseTienda,
                    prodSlug,
                    listaVariantes.length > 1 ? skuVar : undefined
                  ),
                  base_imponible_usd: base,
                  tarifa_iva: tarifaIva,
                  monto_iva_usd: Number(montoIva.toFixed(2)),
                  pvp_total_usd: Number(pvpTotal.toFixed(2)),
                  escalas_volumen: Array.isArray(v.var_detalle_variante?.escalas_volumen)
                    ? v.var_detalle_variante.escalas_volumen
                    : undefined,
                  frecuencia: v.var_frecuencia_recurrencia ?? v.frecuencia ?? null,
                  foto_variante_url: v.var_detalle_variante?.portada_url || v.foto_variante_url || null,
                };
              }),
            };
          }),
        };
      },
    },

    detalle_producto: {
      descripcion:
        "Obtiene los detalles completos y los enlaces directos a la tienda (`url_tienda_producto`, `url_tienda_variante`) de un producto o servicio por su identificador, slug o nombre.",
      esquema: {
        type: "object",
        properties: {
          slug_o_id: {
            type: "string",
            description: "Slug, UUID o nombre del producto/servicio (ej. 'cartel-bienvenida', 'tinkay-bouq-coreano')",
          },
        },
        required: ["slug_o_id"],
      },
      async ejecutar(args, ctx) {
        const baseTienda = obtenerUrlBaseTiendaMcp(ctx.negocioId, opciones.urlBaseTienda);
        const slugOId = String(args.slug_o_id ?? "").trim().toLowerCase();
        if (!slugOId) {
          return { error: "El parámetro slug_o_id es obligatorio." };
        }

        const prods = await obtenerListaProductos(ctx.negocioId);
        const normBuscado = normalizarTextoBusqueda(slugOId);
        const encontrado =
          prods.find((p) => {
            const id = String(p.pro_id || p.id || p.producto_id || "").toLowerCase();
            const slug = String(p.pro_slug || p.slug || "").toLowerCase();
            return id === slugOId || slug === slugOId;
          }) ||
          prods.find((p) => {
            const nom = normalizarTextoBusqueda(p.pro_nombre || p.nombre || "");
            return Boolean(nom && normBuscado && (nom === normBuscado || nom.includes(normBuscado)));
          });

        if (encontrado) {
          const prodSlug = encontrado.pro_slug || encontrado.slug || encontrado.pro_id || encontrado.id;
          const catNombre =
            encontrado.categoria?.ctg_nombre ||
            encontrado.categoria?.nombre ||
            encontrado.categoria_nombre ||
            null;
          const catSlug =
            encontrado.categoria?.ctg_slug || encontrado.categoria?.slug || catNombre;
          const listaVariantes = Array.isArray(encontrado.variantes) ? encontrado.variantes : [];

          return {
            id: encontrado.pro_id || encontrado.id || encontrado.producto_id,
            nombre: encontrado.pro_nombre || encontrado.nombre,
            slug: encontrado.pro_slug || encontrado.slug,
            url_tienda_producto: construirUrlProductoMcp(baseTienda, prodSlug),
            url_tienda_categoria: construirUrlCategoriaMcp(baseTienda, catSlug),
            descripcion: encontrado.pro_descripcion || encontrado.descripcion,
            tipo: encontrado.pro_tipo || encontrado.tipo,
            es_renta: Boolean(
              encontrado.pro_detalle_producto?.es_renta === true ||
                String(encontrado.pro_tipo || "").toUpperCase().includes("RENTA") ||
                String(encontrado.pro_tipo || "").toUpperCase().includes("ALQUILER")
            ),
            condiciones_renta: encontrado.pro_detalle_producto?.renta_config || null,
            destacado: encontrado.pro_destacado ?? false,
            categoria: catNombre,
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
            variantes: listaVariantes.map((v: any) => {
              const base = Number(v.var_precio ?? v.precio ?? v.precio_base_usd ?? 0);
              const tarifaIva = Number(
                v.var_tarifa_iva_porcentaje ??
                v.tarifa_iva ??
                encontrado.pro_detalle_producto?.tarifa_iva_predeterminada ??
                0
              );
              const montoIva = Number(v.monto_iva ?? v.monto_iva_usd ?? ((base * tarifaIva) / 100));
              const pvpTotal = Number(v.precio_total ?? v.pvp_total_usd ?? (base + montoIva));
              const skuVar = v.var_sku || v.sku;

              return {
                id: v.var_id || v.id || v.variante_id,
                sku: skuVar,
                nombre: v.var_nombre || v.nombre,
                url_tienda_variante: construirUrlProductoMcp(
                  baseTienda,
                  prodSlug,
                  listaVariantes.length > 1 ? skuVar : undefined
                ),
                base_imponible_usd: base,
                tarifa_iva: tarifaIva,
                monto_iva_usd: Number(montoIva.toFixed(2)),
                pvp_total_usd: Number(pvpTotal.toFixed(2)),
                frecuencia: v.var_frecuencia_recurrencia ?? v.frecuencia ?? null,
                detalle_variante: v.var_detalle_variante || {},
              };
            }),
          };
        }

        return { error: `Producto no encontrado para '${args.slug_o_id}'` };
      },
    },

    obtener_enlaces_tienda: {
      descripcion:
        "Genera enlaces directos (Deep Links) al E-Commerce para redirigir al cliente por WhatsApp o Chat Web hacia una categoría específica (ej. 'eventos', 'box florales', 'condolencias') o directamente a la ventana de un producto específico.",
      esquema: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description: "Opcional. Nombre o slug de la categoría cuyo link se desea obtener (ej. 'eventos', 'box florales', 'estilo coreano', 'condolencias'). Si se omite, lista todas las categorías activas con sus links.",
          },
          producto: {
            type: "string",
            description: "Opcional. Nombre, slug o SKU del producto cuyo link directo se desea obtener (ej. 'cartel bienvenida', 'backing media luna').",
          },
        },
      },
      async ejecutar(args, ctx) {
        const baseTienda = obtenerUrlBaseTiendaMcp(ctx.negocioId, opciones.urlBaseTienda);
        const prods = await obtenerListaProductos(ctx.negocioId, "ECOMMERCE_WEB");

        const mapaCategorias = new Map<string, { nombre: string; slug: string; url: string; total_productos: number }>();
        for (const p of prods) {
          const catNom = String(p.categoria?.ctg_nombre || p.categoria?.nombre || p.categoria_nombre || "").trim();
          const catSlugRaw = String(p.categoria?.ctg_slug || p.categoria?.slug || catNom).trim();
          const slugNorm = normalizarSlugUrl(catSlugRaw);
          if (!catNom || !slugNorm || slugNorm.includes("extra")) continue;
          const urlCat = construirUrlCategoriaMcp(baseTienda, slugNorm);
          if (!urlCat) continue;
          const existente = mapaCategorias.get(slugNorm);
          if (existente) {
            existente.total_productos += 1;
          } else {
            mapaCategorias.set(slugNorm, {
              nombre: catNom,
              slug: slugNorm,
              url: urlCat,
              total_productos: 1,
            });
          }
        }

        let categoriasRes = Array.from(mapaCategorias.values());
        if (typeof args.categoria === "string" && args.categoria.trim()) {
          const busqCat = normalizarTextoBusqueda(args.categoria);
          const filtradasCat = categoriasRes.filter((c) => {
            const n = normalizarTextoBusqueda(`${c.nombre} ${c.slug}`);
            return n.includes(busqCat) || busqCat.includes(normalizarTextoBusqueda(c.nombre));
          });
          if (filtradasCat.length > 0) {
            categoriasRes = filtradasCat;
          } else {
            const urlDirecta = construirUrlCategoriaMcp(baseTienda, args.categoria);
            if (urlDirecta) {
              categoriasRes = [
                {
                  nombre: args.categoria.trim(),
                  slug: normalizarSlugUrl(args.categoria),
                  url: urlDirecta,
                  total_productos: 0,
                },
              ];
            }
          }
        }

        let productosRes: Array<{
          nombre: string;
          slug: string;
          url: string | null;
          pvp_desde_usd: number;
          variantes?: Array<{ nombre: string; sku: string; pvp_usd: number; url: string | null }>;
        }> = [];

        if (typeof args.producto === "string" && args.producto.trim()) {
          const prodsCoincidentes = filtrarPorTermino(prods, args.producto).slice(0, 6);
          productosRes = prodsCoincidentes.map((p) => {
            const prodSlug = p.pro_slug || p.slug || p.pro_id || p.id;
            const listaVars = Array.isArray(p.variantes) ? p.variantes : [];
            const precios = listaVars.map((v: any) =>
              Number(v.precio_total ?? v.pvp_total_usd ?? v.var_precio ?? 0)
            );
            return {
              nombre: p.pro_nombre || p.nombre,
              slug: prodSlug,
              url: construirUrlProductoMcp(baseTienda, prodSlug),
              pvp_desde_usd: precios.length > 0 ? Math.min(...precios) : 0,
              ...(listaVars.length > 1
                ? {
                    variantes: listaVars.map((v: any) => ({
                      nombre: v.var_nombre || v.nombre,
                      sku: v.var_sku || v.sku,
                      pvp_usd: Number(v.precio_total ?? v.pvp_total_usd ?? v.var_precio ?? 0),
                      url: construirUrlProductoMcp(baseTienda, prodSlug, v.var_sku || v.sku),
                    })),
                  }
                : {}),
            };
          });
        }

        return {
          negocio: ctx.negocioId,
          url_tienda_inicio: `${baseTienda}/#catalogo`,
          categorias: categoriasRes,
          ...(productosRes.length > 0 ? { productos: productosRes } : {}),
        };
      },
    },
  };

  const herramientasFinales: Record<string, Herramienta<ContextoMcpCatalogo>> = {
    ...herramientas,
  };

  if (typeof opciones.cotizarEnvio === "function") {
    const cotizarFn = opciones.cotizarEnvio;
    herramientasFinales.cotizar_envio_domicilio = {
      descripcion:
        "Calcula el costo exacto de envío a domicilio o retiro gratis en tienda según un enlace GPS (Google Maps, Apple Maps, Waze), " +
        "coordenadas de ubicación de WhatsApp (lat, lng) o dirección/sector en Pichincha, Ecuador. " +
        "Retorna la zona detectada (ej. Centro-Norte de Quito con Envío Gratis, Cumbayá, Tumbaco, Valle de los Chillos), " +
        "el costo final de delivery para el cliente y, cuando el negocio lo habilita, la distancia en kilómetros. " +
        "Nunca expongas fórmulas internas al cliente; informa únicamente el costo final y lo permitido por mostrar_kilometros_cliente.",
      esquema: {
        type: "object",
        properties: {
          enlace_o_direccion: {
            type: "string",
            description:
              "URL de Google Maps (incluye links cortos maps.app.goo.gl), Apple Maps, Waze, coordenadas 'lat,lng' o sector/dirección en Pichincha (ej. 'Parque La Carolina', 'Scala Shopping Cumbayá').",
          },
          lat: {
            type: "number",
            description: "Latitud GPS opcional cuando el cliente envía pin nativo de ubicación (ej. desde WhatsApp).",
          },
          lng: {
            type: "number",
            description: "Longitud GPS opcional cuando el cliente envía pin nativo de ubicación (ej. desde WhatsApp).",
          },
          retiro_en_local: {
            type: "boolean",
            description: "true si el cliente indica que retirará el pedido directamente en la tienda física (costo $0.00).",
          },
          delivery_incluido_producto: {
            type: "boolean",
            description: "Por defecto true. Enviar false únicamente si el producto consultado no incluye subsidio base de envío.",
          },
          recargo_logistico_producto_usd: {
            type: "number",
            description: "Recargo logístico adicional de un arreglo monumental específico en USD (opcional, por defecto 0).",
          },
        },
      },
      async ejecutar(args, ctx) {
        return await cotizarFn(ctx.negocioId, {
          enlace_o_direccion:
            typeof args.enlace_o_direccion === "string" ? args.enlace_o_direccion : undefined,
          lat: typeof args.lat === "number" ? args.lat : undefined,
          lng: typeof args.lng === "number" ? args.lng : undefined,
          retiro_en_local: typeof args.retiro_en_local === "boolean" ? args.retiro_en_local : false,
          delivery_incluido_producto:
            typeof args.delivery_incluido_producto === "boolean"
              ? args.delivery_incluido_producto
              : true,
          recargo_logistico_producto_usd:
            typeof args.recargo_logistico_producto_usd === "number"
              ? args.recargo_logistico_producto_usd
              : 0,
        });
      },
    };
  }

  if (opciones.herramientasAdicionales) {
    for (const [clave, h] of Object.entries(opciones.herramientasAdicionales)) {
      if (h.alcanceRequerido) {
        const alcance = h.alcanceRequerido;
        herramientasFinales[clave] = {
          descripcion: h.descripcion,
          esquema: h.esquema,
          async ejecutar(argumentos, contexto) {
            if (!contexto.alcances.includes(alcance) && !contexto.alcances.includes("*")) {
              return { error: `El token no tiene el alcance ${alcance}.` };
            }
            return h.ejecutar(argumentos, contexto);
          },
        };
      } else {
        herramientasFinales[clave] = h;
      }
    }
  }

  return crearManejadorMcp<ContextoMcpCatalogo>({
    nombre: `mcp-catalogo-${negocioPorDefecto}`,
    version: "1.0.0",
    herramientas: herramientasFinales,
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
        token,
      };
    },
  });
}

