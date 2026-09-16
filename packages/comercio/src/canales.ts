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
