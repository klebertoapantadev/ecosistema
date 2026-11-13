/**
 * Generador e intérprete canónico de enlaces profundos (Deep Links) hacia el E-Commerce
 * para compartir categorías y productos vía WhatsApp, Chat Web (ARIA/Mía) y redes sociales.
 * Sin dependencias de Next.js (apto para navegador, servidor, MCP y apps Capacitor).
 */

export const URL_TIENDA_POR_NEGOCIO: Record<string, string> = {
  tinkay: "https://tinkay-web.vercel.app",
  margaritas: "https://margaritas-web.vercel.app",
  tranqi: "https://tranqi-web.vercel.app",
  fastfix: "https://fastfix-web.vercel.app",
};

export function normalizarSlugEnlace(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolverUrlBaseTienda(negocio = "tinkay", baseUrlExplicita?: string): string {
  if (baseUrlExplicita && baseUrlExplicita.trim()) {
    return baseUrlExplicita.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  const envUrl =
    (typeof process !== "undefined" &&
      (process.env?.NEXT_PUBLIC_SITE_URL || process.env?.NEXT_PUBLIC_APP_URL)) ||
    "";
  if (envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  const clave = negocio.trim().toLowerCase();
  return URL_TIENDA_POR_NEGOCIO[clave] || URL_TIENDA_POR_NEGOCIO.tinkay!;
}

export function construirEnlaceCategoriaTienda(params: {
  negocio?: string;
  slugCategoria: string;
  baseUrl?: string;
}): string {
  const base = resolverUrlBaseTienda(params.negocio, params.baseUrl);
  const slug = normalizarSlugEnlace(params.slugCategoria);
  if (!slug || slug === "todos" || slug === "cat-todos" || slug === "todas") {
    return `${base}/#catalogo`;
  }
  return `${base}/categoria/${encodeURIComponent(slug)}`;
}

export function construirEnlaceProductoTienda(params: {
  negocio?: string;
  slugProducto: string;
  skuVariante?: string | null;
  baseUrl?: string;
}): string {
  const base = resolverUrlBaseTienda(params.negocio, params.baseUrl);
  const slug = normalizarSlugEnlace(params.slugProducto) || encodeURIComponent(params.slugProducto.trim());
  if (!slug) {
    return `${base}/#catalogo`;
  }
  const rutaBase = `${base}/producto/${slug}`;
  const skuLimpio = params.skuVariante ? params.skuVariante.trim() : "";
  if (skuLimpio) {
    return `${rutaBase}?variante=${encodeURIComponent(skuLimpio)}`;
  }
  return rutaBase;
}

export interface DestinoEnlaceTienda {
  tipo: "categoria" | "producto" | "busqueda" | "catalogo" | "externo";
  categoria?: string;
  producto?: string;
  variante?: string;
  busqueda?: string;
}

/**
 * Analiza una URL absoluta o ruta relativa y determina si apunta a una categoría
 * o producto de la tienda (soportando tanto rutas limpias `/categoria/...` y `/producto/...`
 * como query params `?categoria=...`, `?producto=...`, `?variante=...`, `?sku=...`).
 */
export function interpretarEnlaceTienda(
  urlORuta: string,
  origenTiendaActual?: string
): DestinoEnlaceTienda {
  const entrada = (urlORuta || "").trim();
  if (!entrada) return { tipo: "externo" };

  try {
    const baseDummy = "https://tienda.local";
    const parsed = /^https?:\/\//i.test(entrada)
      ? new URL(entrada)
      : new URL(entrada.startsWith("/") ? entrada : `/${entrada}`, baseDummy);

    if (/^https?:\/\//i.test(entrada)) {
      const hostLower = parsed.hostname.toLowerCase();
      const origenesConocidos = Object.values(URL_TIENDA_POR_NEGOCIO).map((u) => {
        try {
          return new URL(u).hostname.toLowerCase();
        } catch {
          return "";
        }
      });
      let hostActual = "";
      if (origenTiendaActual) {
        try {
          hostActual = new URL(origenTiendaActual).hostname.toLowerCase();
        } catch {
          hostActual = "";
        }
      } else if (typeof window !== "undefined" && window.location?.hostname) {
        hostActual = window.location.hostname.toLowerCase();
      }

      const esHostTienda =
        (hostActual && hostLower === hostActual) ||
        origenesConocidos.includes(hostLower) ||
        hostLower === "localhost" ||
        hostLower === "127.0.0.1";

      if (!esHostTienda) {
        return { tipo: "externo" };
      }
    }

    const segmentos = parsed.pathname
      .split("/")
      .map((s) => decodeURIComponent(s.trim()))
      .filter(Boolean);

    const paramVariante =
      parsed.searchParams.get("variante") ||
      parsed.searchParams.get("sku") ||
      undefined;
    const paramProducto =
      parsed.searchParams.get("producto") ||
      parsed.searchParams.get("prod") ||
      parsed.searchParams.get("arreglo") ||
      undefined;
    const paramCategoria =
      parsed.searchParams.get("categoria") ||
      parsed.searchParams.get("cat") ||
      parsed.searchParams.get("coleccion") ||
      undefined;
    const paramBusqueda =
      parsed.searchParams.get("q") ||
      parsed.searchParams.get("busqueda") ||
      undefined;

    // 1. Ruta limpia /producto/{slug} o /p/{slug}
    if (
      segmentos.length >= 2 &&
      (segmentos[0]?.toLowerCase() === "producto" ||
        segmentos[0]?.toLowerCase() === "productos" ||
        segmentos[0]?.toLowerCase() === "p")
    ) {
      return {
        tipo: "producto",
        producto: segmentos[1],
        ...(paramVariante ? { variante: paramVariante } : {}),
      };
    }

    // 2. Ruta limpia /categoria/{slug} o /coleccion/{slug} o /c/{slug}
    if (
      segmentos.length >= 2 &&
      (segmentos[0]?.toLowerCase() === "categoria" ||
        segmentos[0]?.toLowerCase() === "categorias" ||
        segmentos[0]?.toLowerCase() === "coleccion" ||
        segmentos[0]?.toLowerCase() === "c")
    ) {
      return {
        tipo: "categoria",
        categoria: segmentos[1],
      };
    }

    // 3. Parámetros por query string en raíz `/`
    if (paramProducto) {
      return {
        tipo: "producto",
        producto: paramProducto,
        ...(paramVariante ? { variante: paramVariante } : {}),
      };
    }

    if (paramVariante && segmentos.length === 0) {
      return {
        tipo: "producto",
        producto: paramVariante,
        variante: paramVariante,
      };
    }

    if (paramCategoria) {
      return {
        tipo: "categoria",
        categoria: paramCategoria,
      };
    }

    if (paramBusqueda) {
      return {
        tipo: "busqueda",
        busqueda: paramBusqueda,
      };
    }

    if (segmentos.length === 0 && parsed.hash === "#catalogo") {
      return { tipo: "catalogo" };
    }

    return { tipo: "externo" };
  } catch {
    return { tipo: "externo" };
  }
}

