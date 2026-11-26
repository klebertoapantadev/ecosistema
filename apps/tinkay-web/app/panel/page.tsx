import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Flower2,
  Hammer,
  KeyRound,
  Mail,
  MapPinCheck,
  Megaphone,
  MessageSquare,
  Receipt,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  MessageSquareHeart,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  listarEntregaInmediataAction,
  obtenerCampanasInformativasAction,
  obtenerEmisorDefectoPorNegocio,
  obtenerExpedientePedidosClienteAction,
  obtenerMisProformasEventoAction,
} from "@eco/comercio";
import { EspacioClienteEcommerceTinkay } from "../../modulos/ecommerce/componentes/EspacioClienteEcommerceTinkay";
import { ListaMisProformasCliente } from "./AccionesProformaPanelCliente";
import { obtenerSaludo } from "@eco/identidad";
import {
  obtenerContextoAccesoTinkay,
  obtenerRutaAterrizajePorRolTinkay,
} from "./acceso-tinkay";

export const metadata: Metadata = { title: "Panel — Tinkay Floristería" };

const NEGOCIO = "tinkay";

interface WidgetInfo {
  clave: string;
  nombre: string;
  descripcion: string;
  ruta: string;
  icono: LucideIcon;
  grupo: "operacion" | "configuracion";
  etiqueta?: string;
}

const MODULOS_TINKAY: Record<string, WidgetInfo> = {
  consola_chat: {
    clave: "consola_chat",
    nombre: "Ventas Omnicanal & Chats en Vivo",
    descripcion:
      "Monitoreo estilo ManyChat: conversaciones web, intervención de asesores vs Mía (ARIA), etiquetas, /atajos, usuarios registrados y compras.",
    ruta: "/panel/conversaciones",
    icono: MessageSquare,
    grupo: "operacion",
    etiqueta: "Inbox / HITL",
  },
  directorio_contactos: {
    clave: "directorio_contactos",
    nombre: "Contactos y Listas WhatsApp",
    descripcion:
      "Extrae contactos (.vcf, .csv, Excel, celular), consolida con Join/Merge, protege contactos personales (Ignorar Total) y gestiona múltiples celulares WhatsApp.",
    ruta: "/panel/contactos",
    icono: Users,
    grupo: "operacion",
    etiqueta: "Join/Merge",
  },
  chat_equipo: {
    clave: "chat_equipo",
    nombre: "Chat Grupal del Equipo",
    descripcion:
      "Conversación interna de trabajo entre Ventas, Taller, Delivery y Administración con @menciones, fotos y reenvío de consultas.",
    ruta: "/panel/chat-equipo",
    icono: Users,
    grupo: "operacion",
    etiqueta: "@Menciones Live",
  },
  envio_pedidos_taller: {
    clave: "envio_pedidos_taller",
    nombre: "Enviar Pedidos a Taller & Exequiales",
    descripcion:
      "Valida ventas, programa entregas en el calendario (Hoy / Semana / Mes), carga pedidos futuros o llamadas Exequiales y despáchalos al Taller.",
    ruta: "/panel/envio-pedidos",
    icono: Send,
    grupo: "operacion",
    etiqueta: "Despacho Diario",
  },
  taller_floral: {
    clave: "taller_floral",
    nombre: "Taller — Producción y Elaboración",
    descripcion:
      "Recibe alertas en vivo de nuevos pedidos, visualiza pedidos de hoy y futuros (históricos ocultos por defecto) y actualiza En Preparación / Listo Entrega.",
    ruta: "/panel/taller",
    icono: Hammer,
    grupo: "operacion",
    etiqueta: "Notificación Live",
  },
  galeria_inmediata: {
    clave: "galeria_inmediata",
    nombre: "Galería Entrega Inmediata (1–2h)",
    descripcion:
      "Sube fotos de arreglos recién armados con precio especial. Se publican en Web y Chat y se retiran solos al venderse.",
    ruta: "/panel/entrega-inmediata",
    icono: Zap,
    grupo: "operacion",
    etiqueta: "Listos Hoy",
  },
  inventario_rosas: {
    clave: "inventario_rosas",
    nombre: "Inventario de Rosas (Conteo IA)",
    descripcion:
      "Adjunta fotos de bonches para que ARIA cuente paquetes por colores y muestre siempre el último inventario consolidado.",
    ruta: "/panel/inventario-rosas",
    icono: Flower2,
    grupo: "operacion",
    etiqueta: "Visión ARIA",
  },
  confirmacion_entregas: {
    clave: "confirmacion_entregas",
    nombre: "Confirmación de Entregas & Exequiales IESS",
    descripcion:
      "App móvil offline para foto + GPS sin anuncios, órdenes de trabajo Exequiales IESS e informes quincenales numerados en PDF.",
    ruta: "/panel/entregas",
    icono: MapPinCheck,
    grupo: "operacion",
    etiqueta: "PWA Offline / GPS",
  },
  pedidos_tienda: {
    clave: "pedidos_tienda",
    nombre: "Pedidos de Tienda y Despachos",
    descripcion: "Órdenes registradas, dedicatorias, enlace GPS directo y desglose interno de logística.",
    ruta: "/panel/pedidos",
    icono: ClipboardList,
    grupo: "operacion",
    etiqueta: "Taller / Envíos",
  },
  facturacion_electronica: {
    clave: "facturacion_electronica",
    nombre: "Facturación Electrónica & Cobros",
    descripcion: "Emisión automática con PLUX, liquidación de transferencias bancarias y descarga de RIDE SRI.",
    ruta: "/panel/facturacion",
    icono: Receipt,
    grupo: "operacion",
    etiqueta: "SRI / Pagos",
  },
  catalogo_productos: {
    clave: "catalogo_productos",
    nombre: "Catálogo Comercial & Portafolio",
    descripcion: "Arreglos florales, bouquets coreanos, mix de temporada, complementos y precios.",
    ruta: "/panel/catalogo-productos",
    icono: ShoppingBag,
    grupo: "operacion",
    etiqueta: "Principal",
  },
  gestion_usuarios: {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios, Invitaciones & Roles",
    descripcion: "Envío de invitaciones por correo y asignación de roles (Ventas, Operador, Delivery, Administrador).",
    ruta: "/panel/usuarios",
    icono: Users,
    grupo: "operacion",
  },
  testimonios_clientes: {
    clave: "testimonios_clientes",
    nombre: "Testimonios & Reseñas de Clientes",
    descripcion: "Gestión de capturas reales de WhatsApp, fotos de entregas en taller y enlace a Google Photos.",
    ruta: "/panel/testimonios",
    icono: MessageSquareHeart,
    grupo: "operacion",
    etiqueta: "Social Proof",
  },
  configuracion_negocio: {
    clave: "configuracion_negocio",
    nombre: "Datos de la Floristería",
    descripcion: "Identificación fiscal (RUC), nombre comercial, razón social y correo operativo.",
    ruta: "/panel/configuracion",
    icono: Building2,
    grupo: "configuracion",
  },
  configuracion_facturacion_sri: {
    clave: "configuracion_facturacion_sri",
    nombre: "Parámetros de Facturación SRI",
    descripcion: "RUC, régimen RIMPE/General, serie 001-001, secuenciales y firma electrónica .p12 en Vault.",
    ruta: "/panel/facturacion-sri",
    icono: FileCheck2,
    grupo: "configuracion",
    etiqueta: "SRI / Firma .p12",
  },
  configuracion_logistica: {
    clave: "configuracion_logistica",
    nombre: "Envíos, Zonas y Cobertura",
    descripcion: "Polígono de Envío Gratis (Centro-Norte), zonas de Pichincha y tarifa por km adicional.",
    ruta: "/panel/logistica",
    icono: Truck,
    grupo: "configuracion",
    etiqueta: "Pichincha / GPS",
  },
  pasarelas_pago: {
    clave: "pasarelas_pago",
    nombre: "Pasarela de Pagos (PLUX / Payphone)",
    descripcion: "Credenciales propias de Tinkay Floristería para cobros con tarjeta, abono 70% de eventos y webhook.",
    ruta: "/panel/pasarelas",
    icono: CreditCard,
    grupo: "configuracion",
    etiqueta: "PLUX / Tarjeta",
  },
  configuracion_aria: {
    clave: "configuracion_aria",
    nombre: "Agente Conversacional ARIA (Mía)",
    descripcion: "URL base, ID del agente y API Key cifrada en Supabase Vault para el chat en vivo.",
    ruta: "/panel/aria",
    icono: Bot,
    grupo: "configuracion",
    etiqueta: "Vault / IA",
  },
  configuracion_marketing_meta: {
    clave: "configuracion_marketing_meta",
    nombre: "Marketing & Meta (Pixel / Catálogo)",
    descripcion: "Meta Pixel, Conversions API (CAPI) en Vault, feed de catálogo Facebook/WhatsApp y atribución ARIA.",
    ruta: "/panel/marketing-meta",
    icono: Megaphone,
    grupo: "configuracion",
    etiqueta: "Meta Ads / Catálogo",
  },
  servidor_correo: {
    clave: "servidor_correo",
    nombre: "Servidor de Correo (SMTP)",
    descripcion: "Credenciales de despacho para códigos de seguridad, alertas y confirmaciones.",
    ruta: "/panel/correo",
    icono: Mail,
    grupo: "configuracion",
  },
  tokens_mcp: {
    clave: "tokens_mcp",
    nombre: "Tokens & Servidor MCP",
    descripcion: "Credenciales API para integrar el catálogo floral con WhatsApp, n8n y agentes externos.",
    ruta: "/panel/tokens-mcp",
    icono: KeyRound,
    grupo: "configuracion",
  },
};

const DESCRIPCION_BANNER_POR_ROL: Record<string, { subtitulo: string; descripcion: string }> = {
  SUPERADMIN: {
    subtitulo: "Administración Tinkay",
    descripcion:
      "Centro de operaciones y configuración de Tinkay Floristería. Administra el catálogo floral, el equipo (Ventas, Operador, Delivery) y las integraciones.",
  },
  ADMINISTRADOR: {
    subtitulo: "Administración Tinkay",
    descripcion:
      "Centro de operaciones y configuración de Tinkay Floristería. Administra el catálogo floral, el equipo (Ventas, Operador, Delivery) y las integraciones.",
  },
  OPERADOR: {
    subtitulo: "Taller Floral & Operaciones",
    descripcion:
      "Gestiona la preparación de pedidos del taller floral, hoja de ruta, catálogo de arreglos y cobertura logística.",
  },
  VENTAS: {
    subtitulo: "Portal Comercial & Ventas",
    descripcion:
      "Gestiona pedidos de tienda, proformas de eventos (variaciones V2/V3), catálogo floral y reseñas de clientes.",
  },
  DELIVERY: {
    subtitulo: "Portal de Despachos & Delivery",
    descripcion:
      "Consulta los pedidos programados para entrega, destinatarios, horarios y abre la navegación GPS en Waze o Google Maps.",
  },
  CLIENTE: {
    subtitulo: "Portal de Clientes · Tinkay",
    descripcion:
      "Consulta el historial de tus compras, revisa el estado de entrega de tus arreglos florales y gestiona tus proformas de eventos.",
  },
};

export default async function PaginaPanel() {
  const ctx = await obtenerContextoAccesoTinkay();
  const { perfil, rolPrincipal, esAdminTienda, esCliente, clavesAutorizadas } = ctx;

  // Aterrizaje directo por rol (Ventas -> Conversaciones, Taller -> Taller, Delivery -> Entregas)
  const rutaDirecta = obtenerRutaAterrizajePorRolTinkay(rolPrincipal);
  if (rutaDirecta) {
    redirect(rutaDirecta);
  }

  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre, NEGOCIO) : null;
  const infoBanner = DESCRIPCION_BANNER_POR_ROL[rolPrincipal] ?? DESCRIPCION_BANNER_POR_ROL.CLIENTE!;

  // Si es CLIENTE, mostrar su espacio nativo de E-Commerce (Pedidos + Entrega + Factura, Carrito, Proformas editables y Promociones)
  if (esCliente) {
    const [resExpediente, resInmediata, campanas] = await Promise.all([
      obtenerExpedientePedidosClienteAction(NEGOCIO),
      listarEntregaInmediataAction(NEGOCIO).catch(() => ({ ok: true as const, items: [] })),
      obtenerCampanasInformativasAction({ negocio: NEGOCIO, audiencia: "CLIENTES" }).catch(
        () => []
      ),
    ]);

    return (
      <EspacioClienteEcommerceTinkay
        saludo={saludo ?? `Qué bueno verte, ${nombre}`}
        nombreCliente={nombre}
        registrosIniciales={resExpediente.ok ? resExpediente.registros : []}
        emisorSri={
          resExpediente.ok
            ? resExpediente.emisorSri
            : obtenerEmisorDefectoPorNegocio(NEGOCIO)
        }
        entregaInmediataInicial={resInmediata.ok ? resInmediata.items : []}
        campanasInformativas={campanas}
      />
    );
  }

  const resMisProformas = perfil
    ? await obtenerMisProformasEventoAction(NEGOCIO)
    : { ok: true as const, proformas: [] };
  const misProformas = resMisProformas.ok ? resMisProformas.proformas : [];

  // Vista para Personal de Tienda (DELIVERY, VENTAS, OPERADOR, ADMINISTRADOR, SUPERADMIN)
  const modulosDisponibles = Object.values(MODULOS_TINKAY).filter(
    (m) =>
      clavesAutorizadas.has(m.clave) ||
      (esAdminTienda &&
        (m.clave === "facturacion_electronica" || m.clave === "configuracion_facturacion_sri"))
  );
  const modulosOperacion = modulosDisponibles.filter((m) => m.grupo === "operacion");
  const modulosConfiguracion = modulosDisponibles.filter((m) => m.grupo === "configuracion");

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Cabecera Sobria y Editorial del Panel */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderLeft: "3px solid #2F4737",
          borderRadius: "12px",
          padding: "clamp(16px, 3vw, 22px) clamp(16px, 3.5vw, 24px)",
          color: "#1F1C19",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: "#847D74",
                fontSize: "0.69rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: "4px",
              }}
            >
              <Sparkles size={12} color="#B8923F" />
              {infoBanner.subtitulo}
            </div>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
              {saludo ?? `Hola, ${nombre}`}
            </h1>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#57524C", maxWidth: "640px", lineHeight: 1.48 }}>
              {infoBanner.descripcion}
            </p>
          </div>
          {esAdminTienda && modulosConfiguracion.length > 0 && (
            <Link
              href="/panel/configuracion"
              title="Abrir parámetros e integraciones de tienda"
              aria-label="Configuración"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "#F8F7F4",
                border: "1px solid #D5CFC4",
                color: "#1F1C19",
                textDecoration: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              <Settings size={14} />
              <span>Configuración</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mis Proformas de Eventos y Pedidos personales si tuviese */}
      <ListaMisProformasCliente proformasIniciales={misProformas} />

      {/* Grupo 1: Operación Comercial */}
      {modulosOperacion.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0, color: "#57524C" }}>
              Operación Comercial y Equipo
            </h2>
            <span style={{ fontSize: "0.76rem", color: "#847D74" }}>Gestión diaria de la floristería</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(265px, 100%), 1fr))", gap: "12px" }}>
            {modulosOperacion.map((mod) => (
              <TarjetaModuloPanel key={mod.clave} mod={mod} />
            ))}
          </div>
        </section>
      )}

      {/* Grupo 2: Configuración e Integraciones */}
      {modulosConfiguracion.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0, color: "#57524C" }}>
              Configuración e Integraciones
            </h2>
            <span style={{ fontSize: "0.76rem", color: "#847D74" }}>Parámetros exclusivos de Tinkay en Vault</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))", gap: "12px" }}>
            {modulosConfiguracion.map((mod) => (
              <TarjetaModuloPanel key={mod.clave} mod={mod} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TarjetaModuloPanel({ mod }: { mod: WidgetInfo }) {
  const Icono = mod.icono;
  return (
    <Link
      href={mod.ruta}
      style={{
        textDecoration: "none",
        background: "#FFFFFF",
        borderRadius: "11px",
        padding: "16px 18px",
        border: "1px solid #E6E2DA",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "11px",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              background: "#F6F4F0",
              border: "1px solid #E6E2DA",
              color: "#221E1B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icono size={16} />
          </div>
          {mod.etiqueta && (
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "999px",
                background: "#F8F7F4",
                color: "#57524C",
                border: "1px solid #E6E2DA",
              }}
            >
              {mod.etiqueta}
            </span>
          )}
        </div>
        <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "#1F1C19", margin: "0 0 5px 0" }}>
          {mod.nombre}
        </h3>
        <p style={{ fontSize: "0.78rem", color: "#6E6861", margin: 0, lineHeight: 1.45 }}>
          {mod.descripcion}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          marginTop: "14px",
          fontSize: "0.76rem",
          fontWeight: 600,
          color: "#2F4737",
        }}
      >
        Abrir
        <ArrowRight size={13} />
      </div>
    </Link>
  );
}
