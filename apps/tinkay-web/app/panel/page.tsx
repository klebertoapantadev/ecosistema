import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag, Users, Settings, Mail, ArrowRight, Sparkles } from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, obtenerSaludo } from "@eco/identidad";

export const metadata: Metadata = { title: "Panel de Control — Tinkay Floristería" };

const NEGOCIO = "tinkay";

interface WidgetInfo {
  clave: string;
  nombre: string;
  descripcion: string;
  ruta: string;
  icono: any;
  etiqueta?: string;
  color: string;
}

const MODULOS_TINKAY: Record<string, WidgetInfo> = {
  catalogo_productos: {
    clave: "catalogo_productos",
    nombre: "Catálogo Comercial & Portafolio",
    descripcion: "Arreglos florales, bouquets coreanos, mix de temporada, complementos y precios SRI (IVA 15%).",
    ruta: "/panel/catalogo-productos",
    icono: ShoppingBag,
    etiqueta: "Nuevo / Activo",
    color: "#3D5A45",
  },
  gestion_usuarios: {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios & Roles",
    descripcion: "Asignación de membresías, roles de asesoras de ventas y permisos del taller.",
    ruta: "/panel/usuarios",
    icono: Users,
    color: "#2563EB",
  },
  configuracion_negocio: {
    clave: "configuracion_negocio",
    nombre: "Configuración de la Floristería",
    descripcion: "Políticas de entrega, franjas horarias, teléfonos de contacto y redes oficiales.",
    ruta: "/panel/configuracion",
    icono: Settings,
    color: "#475569",
  },
  configuracion_correo: {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo (SMTP)",
    descripcion: "Credenciales de envío para confirmaciones de compra y alertas de despacho.",
    ruta: "/panel/correo",
    icono: Mail,
    color: "#D97706",
  },
};

export default async function PaginaPanel() {
  const perfil = await obtenerPerfilActual();
  const widgets = perfil
    ? await obtenerWidgetsVisibles(perfil.usu_id, perfil.usu_superadmin_plataforma, NEGOCIO)
    : [];

  const nombre = perfil?.usu_nombres || perfil?.usu_correo || "";
  const saludo = perfil ? await obtenerSaludo(perfil.usu_id, nombre) : null;
  const esAdmin = perfil?.usu_superadmin_plataforma || widgets.some((w) => w.wdg_clave === "gestion_usuarios" || w.wdg_clave === "catalogo_productos");

  // Filtrar o componer los módulos visibles
  const clavesVisibles = new Set(widgets.map((w) => w.wdg_clave));
  // Si es admin o superadmin garantizamos acceso a catálogo
  if (esAdmin) {
    clavesVisibles.add("catalogo_productos");
  }

  const modulosDisponibles = Object.values(MODULOS_TINKAY).filter(
    (m) => clavesVisibles.has(m.clave) || perfil?.usu_superadmin_plataforma
  );

  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto", padding: "8px 0" }}>
      {/* Cabecera del Panel */}
      <div
        style={{
          background: "linear-gradient(135deg, #3D5A45 0%, #2A3F30 100%)",
          borderRadius: "16px",
          padding: "32px",
          color: "#FFFFFF",
          marginBottom: "32px",
          boxShadow: "0 10px 25px -5px rgba(61, 90, 69, 0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
              <Sparkles size={14} />
              Administración Tinkay
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0", color: "#FFFFFF" }}>
              {saludo ?? `Hola, ${nombre}`}
            </h1>
            <p style={{ margin: 0, fontSize: "15px", color: "rgba(255,255,255,0.85)", maxWidth: "600px" }}>
              Bienvenido al centro de administración y operaciones de Tinkay Floristería. Desde aquí puedes gestionar el portafolio comercial, variantes, precios y personal.
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", padding: "12px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", textAlign: "right" }}>
            <span style={{ display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.7)" }}>Módulos activos</span>
            <strong style={{ fontSize: "24px", fontWeight: 800 }}>{modulosDisponibles.length}</strong>
          </div>
        </div>
      </div>

      {/* Rejilla de Módulos */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#1F2421" }}>
            Módulos y Herramientas del Sistema
          </h2>
          <span style={{ fontSize: "13px", color: "#64748B" }}>Acceso configurado según tu rol</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {modulosDisponibles.map((mod) => {
            const Icono = mod.icono;
            return (
              <Link
                key={mod.clave}
                href={mod.ruta}
                style={{
                  textDecoration: "none",
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  padding: "24px",
                  border: "1.5px solid #E2E8F0",
                  transition: "all 0.2s ease-in-out",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: `${mod.color}15`,
                        color: mod.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icono size={22} />
                    </div>
                    {mod.etiqueta && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: "#EC7FA71A",
                          color: "#D6336C",
                          border: "1px solid #EC7FA740",
                        }}
                      >
                        {mod.etiqueta}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                    {mod.nombre}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                    {mod.descripcion}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "20px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: mod.color,
                  }}
                >
                  Abrir módulo
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
