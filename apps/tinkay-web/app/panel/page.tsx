import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  KeyRound,
  Mail,
  MessageSquare,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  MessageSquareHeart,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { obtenerMisProformasEventoAction } from "@eco/comercio";
import { ListaMisProformasCliente } from "./AccionesProformaPanelCliente";
import { obtenerSaludo } from "@eco/identidad";
import { obtenerContextoAccesoTinkay } from "./acceso-tinkay";

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

  const resMisProformas = perfil
    ? await obtenerMisProformasEventoAction(NEGOCIO)
    : { ok: true as const, proformas: [] };
  const misProformas = resMisProformas.ok ? resMisProformas.proformas : [];

  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre, NEGOCIO) : null;
  const infoBanner = DESCRIPCION_BANNER_POR_ROL[rolPrincipal] ?? DESCRIPCION_BANNER_POR_ROL.CLIENTE!;

  // Si es CLIENTE, mostrar exclusivamente su portal de cliente (Historial de Compras + Mis Proformas + Mi Cuenta)
  if (esCliente) {
    return (
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #2D4334 0%, #1F2E24 100%)",
            borderRadius: "16px",
            padding: "28px 32px",
            color: "#FFFFFF",
            boxShadow: "0 8px 20px -6px rgba(31, 46, 36, 0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(255,255,255,0.12)",
                  padding: "4px 11px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "10px",
                }}
              >
                <Sparkles size={13} />
                {infoBanner.subtitulo}
              </div>
              <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0", color: "#FFFFFF" }}>
                {saludo ?? `Hola, ${nombre}`}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "rgba(255,255,255,0.82)",
                  maxWidth: "620px",
                  lineHeight: 1.5,
                }}
              >
                {infoBanner.descripcion}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <Link
                href="/#catalogo"
                title="Explorar el catálogo floral de la tienda"
                aria-label="Tienda Floral"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  background: "#C27D5F",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <ShoppingBag size={15} />
                <span>Tienda Floral</span>
              </Link>
              <Link
                href="/panel/cuenta"
                title="Ver mis datos personales y perfil"
                aria-label="Mi Cuenta"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                <UserCheck size={15} />
                <span>Mi Cuenta</span>
              </Link>
            </div>
          </div>
        </div>

        <ListaMisProformasCliente proformasIniciales={misProformas} mostrarSiempre={true} />
      </div>
    );
  }

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
    <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Cabecera Sobria del Panel */}
      <div
        style={{
          background: "linear-gradient(135deg, #2D4334 0%, #1F2E24 100%)",
          borderRadius: "16px",
          padding: "28px 32px",
          color: "#FFFFFF",
          boxShadow: "0 8px 20px -6px rgba(31, 46, 36, 0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255,255,255,0.12)",
                padding: "4px 11px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "10px",
              }}
            >
              <Sparkles size={13} />
              {infoBanner.subtitulo}
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0", color: "#FFFFFF" }}>
              {saludo ?? `Hola, ${nombre}`}
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.82)", maxWidth: "600px", lineHeight: 1.5 }}>
              {infoBanner.descripcion}
            </p>
          </div>
          {esAdminTienda && modulosConfiguracion.length > 0 && (
            <Link
              href="/panel/configuracion"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                color: "#FFFFFF",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <Settings size={15} />
              Centro de Configuración
            </Link>
          )}
        </div>
      </div>

      {/* Mis Proformas de Eventos y Pedidos personales si tuviese */}
      <ListaMisProformasCliente proformasIniciales={misProformas} />

      {/* Grupo 1: Operación Comercial */}
      {modulosOperacion.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, color: "#374151" }}>
              Operación Comercial y Equipo
            </h2>
            <span style={{ fontSize: "12.5px", color: "#6B7280" }}>Gestión diaria de la floristería</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {modulosOperacion.map((mod) => (
              <TarjetaModuloPanel key={mod.clave} mod={mod} />
            ))}
          </div>
        </section>
      )}

      {/* Grupo 2: Configuración e Integraciones */}
      {modulosConfiguracion.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, color: "#374151" }}>
              Configuración e Integraciones
            </h2>
            <span style={{ fontSize: "12.5px", color: "#6B7280" }}>Parámetros exclusivos de Tinkay en Vault</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "16px" }}>
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
        borderRadius: "13px",
        padding: "20px 22px",
        border: "1px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#F4F4F5",
              border: "1px solid #E4E4E7",
              color: "#18181B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icono size={19} />
          </div>
          {mod.etiqueta && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: "999px",
                background: "#F3F4F6",
                color: "#374151",
                border: "1px solid #E5E7EB",
              }}
            >
              {mod.etiqueta}
            </span>
          )}
        </div>
        <h3 style={{ fontSize: "15.5px", fontWeight: 700, color: "#111827", margin: "0 0 6px 0" }}>
          {mod.nombre}
        </h3>
        <p style={{ fontSize: "13px", color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
          {mod.descripcion}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "18px",
          fontSize: "12.5px",
          fontWeight: 600,
          color: "#18181B",
        }}
      >
        Abrir
        <ArrowRight size={14} />
      </div>
    </Link>
  );
}
