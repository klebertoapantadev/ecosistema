import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  KeyRound,
  Mail,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  obtenerPerfilActual,
  obtenerWidgetsVisibles,
  obtenerSaludo,
  obtenerPerfiles,
} from "@eco/identidad";

export const metadata: Metadata = { title: "Panel de Control — Tinkay Floristería" };

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
    nombre: "Gestión de Usuarios & Roles",
    descripcion: "Asignación de membresías, roles de asesoras de ventas y permisos del taller floral.",
    ruta: "/panel/usuarios",
    icono: Users,
    grupo: "operacion",
  },
  configuracion_negocio: {
    clave: "configuracion_negocio",
    nombre: "Datos de la Floristería",
    descripcion: "Identificación fiscal (RUC), nombre comercial, razón social y correo operativo.",
    ruta: "/panel/configuracion",
    icono: Building2,
    grupo: "configuracion",
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
  configuracion_aria: {
    clave: "configuracion_aria",
    nombre: "Agente Conversacional ARIA (Mía)",
    descripcion: "URL base, ID del agente y API Key cifrada en Supabase Vault para el chat en vivo.",
    ruta: "/panel/aria",
    icono: Bot,
    grupo: "configuracion",
    etiqueta: "Vault / IA",
  },
  configuracion_correo: {
    clave: "configuracion_correo",
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

export default async function PaginaPanel() {
  const perfil = await obtenerPerfilActual();
  const correo = perfil?.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail =
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "familiammtg@gmail.com" ||
    correo === "jesus251296@gmail.com" ||
    correo === "tinkay.uio@gmail.com";
  const esSuperAdmin = esSuperAdminEmail || Boolean(perfil?.usu_superadmin_plataforma);

  const perfiles = perfil ? await obtenerPerfiles(NEGOCIO) : [];
  const widgets = perfil
    ? await obtenerWidgetsVisibles(perfil.usu_id, esSuperAdmin, NEGOCIO)
    : [];

  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre) : null;
  const esAdmin =
    esSuperAdmin ||
    perfiles.some((p) =>
      ["ADMINISTRADOR", "SUPERADMIN", "OPERADOR"].includes(p.toUpperCase().trim())
    ) ||
    widgets.some((w) =>
      ["gestion_usuarios", "catalogo_productos", "configuracion_negocio"].includes(w.wdg_clave)
    );

  const clavesVisibles = new Set<string>(["catalogo_productos"]);

  if (esAdmin) {
    Object.keys(MODULOS_TINKAY).forEach((k) => clavesVisibles.add(k));
  } else {
    widgets.forEach((w) => {
      if (w.wdg_clave === "vitrina_comercial" || w.wdg_clave === "gestion_catalogo") {
        clavesVisibles.add("catalogo_productos");
      } else if (MODULOS_TINKAY[w.wdg_clave]) {
        clavesVisibles.add(w.wdg_clave);
      }
    });
  }

  const modulosDisponibles = Object.values(MODULOS_TINKAY).filter((m) =>
    clavesVisibles.has(m.clave)
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
              Administración Tinkay
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0", color: "#FFFFFF" }}>
              {saludo ?? `Hola, ${nombre}`}
            </h1>
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(255,255,255,0.82)", maxWidth: "600px", lineHeight: 1.5 }}>
              Centro de operaciones y configuración de Tinkay Floristería. Administra el catálogo floral,
              el equipo de ventas y las integraciones de atención automatizada.
            </p>
          </div>
          {modulosConfiguracion.length > 0 && (
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
        Configurar
        <ArrowRight size={14} />
      </div>
    </Link>
  );
}
