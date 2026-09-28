// Definición de Canales de Visibilidad Omnicanal del Catálogo Comercial

export type CanalVisibilidad =
  | "ECOMMERCE_WEB"
  | "APP_CLIENTES"
  | "CHATBOT_WEB"
  | "CHATBOT_APP"
  | "CHATBOT_WHATSAPP"
  | "OTROS_API";

export interface InfoCanalVisibilidad {
  clave: CanalVisibilidad;
  nombre: string;
  descripcion: string;
  icono: string;
  color: string;
}

export const CANALES_CATALOGO_OFICIALES: InfoCanalVisibilidad[] = [
  {
    clave: "ECOMMERCE_WEB",
    nombre: "E-Commerce Web",
    descripcion: "Catálogo público en la web del negocio",
    icono: "Globe",
    color: "#0284C7",
  },
  {
    clave: "APP_CLIENTES",
    nombre: "App Clientes",
    descripcion: "Aplicación móvil nativa para clientes",
    icono: "Smartphone",
    color: "#7C3AED",
  },
  {
    clave: "CHATBOT_WEB",
    nombre: "Chatbot Web (ARIA)",
    descripcion: "Asistente conversacional en portal web",
    icono: "Bot",
    color: "#059669",
  },
  {
    clave: "CHATBOT_APP",
    nombre: "Chatbot App",
    descripcion: "Asistente conversacional en App móvil",
    icono: "MessageSquare",
    color: "#2563EB",
  },
  {
    clave: "CHATBOT_WHATSAPP",
    nombre: "Chatbot WhatsApp",
    descripcion: "Agente ARIA por WhatsApp (YCloud / n8n)",
    icono: "MessageCircle",
    color: "#16A34A",
  },
  {
    clave: "OTROS_API",
    nombre: "Otros / MCP / B2B",
    descripcion: "Servidores MCP externos y convenios API",
    icono: "Cpu",
    color: "#EA580C",
  },
];

export const CANALES_POR_DEFECTO: CanalVisibilidad[] = [
  "ECOMMERCE_WEB",
  "APP_CLIENTES",
  "CHATBOT_WEB",
  "CHATBOT_APP",
  "CHATBOT_WHATSAPP",
  "OTROS_API",
];

// Canales visuales que exigen obligatoriamente al menos una imagen configurada
export const CANALES_REQUIEREN_IMAGEN: CanalVisibilidad[] = [
  "ECOMMERCE_WEB",
  "APP_CLIENTES",
];

/**
 * Determina si un producto cuenta con al menos una imagen válida (portada, galería o variantes)
 * para cumplir el requisito de visibilidad en E-Commerce Web y App Clientes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function productoTieneAlMenosUnaImagen(p: any): boolean {
  if (!p) return false;

  // 1. Imagen directa en raíz o detalles
  const imgDirecta = p.imagen_url || p.pro_imagen_url || p.imagenUrl;
  if (typeof imgDirecta === "string" && imgDirecta.trim().length > 0) return true;

  const det = p.pro_detalle_producto || p.detalle || {};
  if (typeof det.imagen_url === "string" && det.imagen_url.trim().length > 0) return true;
  if (typeof det.foto_portada === "string" && det.foto_portada.trim().length > 0) return true;
  if (typeof det.portada_url === "string" && det.portada_url.trim().length > 0) return true;

  // 2. Galería de fotos
  if (Array.isArray(det.galeria_imagenes) && det.galeria_imagenes.some((img: unknown) => typeof img === "string" && img.trim().length > 0)) {
    return true;
  }
  if (Array.isArray(det.imagenes) && det.imagenes.some((img: unknown) => typeof img === "string" && img.trim().length > 0)) {
    return true;
  }

  // 3. Imágenes en variantes asociadas
  if (Array.isArray(p.variantes)) {
    for (const v of p.variantes) {
      if (typeof v.imagen_url === "string" && v.imagen_url.trim().length > 0) return true;
      const vdet = v.var_detalle_variante || {};
      if (typeof vdet.portada_url === "string" && vdet.portada_url.trim().length > 0) return true;
      if (typeof vdet.imagen_url === "string" && vdet.imagen_url.trim().length > 0) return true;
      if (typeof vdet.foto_url === "string" && vdet.foto_url.trim().length > 0) return true;
      if (Array.isArray(vdet.imagenes) && vdet.imagenes.some((img: unknown) => typeof img === "string" && img.trim().length > 0)) return true;
    }
  }

  return false;
}

