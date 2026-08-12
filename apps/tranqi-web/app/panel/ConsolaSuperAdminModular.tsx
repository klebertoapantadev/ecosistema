"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles, Shield, LayoutGrid, Pencil, Users, UserCheck, Eye,
  Settings, Mail, ShieldCheck, Bell, CircleUser, KeyRound, Sliders, Briefcase,
  Receipt, History, RotateCcw, type LucideIcon
} from "lucide-react";
import { resetearSistemaSuperAdminAction } from "@eco/gestion-usuarios/acciones";
import { TarjetasFavoritasGrid } from "./SeccionFavoritosInicio";
import { useCustomWidgets } from "./gestorTitulosWidgets";
import { ModalEditarWidget } from "./ModalEditarWidget";

export interface ModuloSuperAdminDef {
  clave: string;
  nombre: string;
  detalle: string;
  ruta: string;
  icono: LucideIcon;
  iconoKey: string;
  color: string;
  rutaFisica?: string;
}

export interface CategoriaSuperAdminGroup {
  categoria: string;
  modulos: ModuloSuperAdminDef[];
}

export const CATALOGO_SUPERADMIN_TODOS: ModuloSuperAdminDef[] = [
  { clave: "gestion_usuarios", nombre: "Gestión de Usuarios & Membresías", detalle: "Asignación de perfiles, roles y techo jerárquico", ruta: "/panel/usuarios", icono: Users, iconoKey: "Users", color: "var(--violeta, #5000BA)", rutaFisica: "packages/gestion-usuarios/src/componentes/ConsultaUsuariosPerfilesWidget.tsx" },
  { clave: "perfiles", nombre: "Administración de Perfiles & Permisos", detalle: "Catálogo de perfiles, jerarquía (1–100) y matriz de gobernanza BDD", ruta: "/panel/configuracion?widget=perfiles", icono: Sliders, iconoKey: "Sliders", color: "var(--violeta, #5000BA)", rutaFisica: "packages/gestion-usuarios/src/componentes/AdministracionPerfilesWidget.tsx" },
  { clave: "socios", nombre: "Aprobación de Socios Abogados", detalle: "Validación de matrículas y acreditación de abogados", ruta: "/panel/administrar?widget=socios", icono: UserCheck, iconoKey: "UserCheck", color: "#05876E", rutaFisica: "modulos/socios/componentes/AprobacionSociosWidget.tsx" },
  { clave: "solicitud_socio", nombre: "Solicitudes de Socios & Postulaciones", detalle: "Revisión y procesamiento de postulación de socios", ruta: "/panel/administrar?widget=solicitud_socio", icono: Briefcase, iconoKey: "Briefcase", color: "#05876E", rutaFisica: "modulos/socios/componentes/FormularioSolicitudSocio.tsx" },
  { clave: "consulta_usuarios", nombre: "Consulta de Usuarios & Perfiles", detalle: "Directorio de miembros y matriz de roles (Solo Lectura)", ruta: "/panel/administrar?widget=consulta_usuarios", icono: Eye, iconoKey: "Eye", color: "var(--violeta, #5000BA)", rutaFisica: "packages/gestion-usuarios/src/componentes/ConsultaUsuariosPerfilesWidget.tsx" },
  { clave: "configuracion_negocio", nombre: "Configuración del Negocio", detalle: "Parámetros del negocio, RUC, redes sociales y contacto", ruta: "/panel/configuracion?widget=negocio", icono: Settings, iconoKey: "Settings", color: "var(--violeta, #5000BA)", rutaFisica: "packages/identidad/src/componentes/ConfiguracionNegocioWidget.tsx" },
  { clave: "configuracion_correo", nombre: "Servidor SMTP & Correo Cifrado", detalle: "Credenciales cifradas SMTP en Vault y plantillas HTML", ruta: "/panel/configuracion?widget=correo", icono: Mail, iconoKey: "Mail", color: "#05876E", rutaFisica: "packages/configuracion-negocio/src/componentes/FormularioSmtp.tsx" },
  { clave: "terminos", nombre: "Términos, Consentimientos & LOPDP", detalle: "Configuración de cláusulas LOPDP y notificaciones", ruta: "/panel/configuracion?widget=notificaciones", icono: ShieldCheck, iconoKey: "ShieldCheck", color: "var(--violeta, #5000BA)", rutaFisica: "packages/identidad/src/componentes/GestionTerminosConsentimientosWidget.tsx" },
  { clave: "auditoria", nombre: "Auditoría BDD PostgreSQL & Telemetría", detalle: "Registro inmutable de transacciones, diffs JSONB e IP", ruta: "/panel/administrar?widget=auditoria", icono: Shield, iconoKey: "Shield", color: "#111827", rutaFisica: "packages/auditoria/src/componentes/TablaAuditoria.tsx" },
  { clave: "emision_notificaciones", nombre: "Emisión de Notificaciones Multicanal", detalle: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp)", ruta: "/panel/administrar?widget=emision_notificaciones", icono: Bell, iconoKey: "Bell", color: "#D97706", rutaFisica: "packages/notificaciones/src/componentes/EmisionNotificacionesWidget.tsx" },
  { clave: "preferencias_notificacion", nombre: "Preferencias de Alertas & Notificaciones", detalle: "Configuración de canales de alerta, WhatsApp y avisos", ruta: "/panel/configuracion?widget=notificaciones", icono: Bell, iconoKey: "Bell", color: "#D97706", rutaFisica: "packages/notificaciones/src/componentes/PreferenciasNotificacionWidget.tsx" },
  { clave: "mi_cuenta", nombre: "Perfil & Datos de Contacto", detalle: "Nombres, apellidos, correo verificado y WhatsApp", ruta: "/panel/cuenta?widget=mi_cuenta", icono: CircleUser, iconoKey: "CircleUser", color: "var(--violeta, #5000BA)", rutaFisica: "packages/identidad/src/componentes/FormularioPerfil.tsx" },
  { clave: "facturacion", nombre: "Datos de Facturación SRI", detalle: "Razón Social, RUC/Cédula, dirección fiscal y correo SRI", ruta: "/panel/cuenta?widget=datos_facturacion", icono: Receipt, iconoKey: "Receipt", color: "#05876E", rutaFisica: "packages/identidad/src/componentes/FormularioDatosFacturacion.tsx" },
  { clave: "mfa", nombre: "Seguridad MFA & Autenticador", detalle: "Configuración TOTP y reseteo estándar vía correo", ruta: "/panel/cuenta?widget=mfa_seguridad", icono: KeyRound, iconoKey: "KeyRound", color: "#D97706", rutaFisica: "packages/identidad/src/componentes/WidgetConfiguracionMfa.tsx" },
  { clave: "historial_accesos", nombre: "Historial de Accesos & Sesiones", detalle: "Bitácora de inicios de sesión, navegador y dirección IP", ruta: "/panel/cuenta?widget=historial_accesos", icono: History, iconoKey: "History", color: "#111827", rutaFisica: "packages/identidad/src/componentes/HistorialAccesos.tsx" },
  { clave: "ver_como", nombre: "Selector 'Ver Como' (Conmutador)", detalle: "Alternar la vista previa del portal según roles asignados", ruta: "/panel/cuenta?widget=ver_como", icono: Shield, iconoKey: "Shield", color: "var(--violeta, #5000BA)", rutaFisica: "app/panel/SelectorRolActivo.tsx" }
];

export function ConsolaSuperAdminModular() {
  const { getWidgetInfo, guardarWidget, obtenerIconoComponente } = useCustomWidgets();
  const [reseteando, setReseteando] = useState(false);

  async function handleResetearSistema() {
    const confirmacionText = prompt(`⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\nEsta acción eliminará TODOS los usuarios de prueba, perfiles y solicitudes configuradas en la base de datos (conservando únicamente la cuenta SuperAdmin).\n\nPara confirmar, escribe "CONFIRMAR RESET":`);
    if (confirmacionText !== "CONFIRMAR RESET") {
      alert("Operación cancelada.");
      return;
    }
    try {
      setReseteando(true);
      const res = await resetearSistemaSuperAdminAction("TRANQ");
      if (res.ok) {
        alert("💥 El sistema para el negocio Tranqi ha sido reseteado. Se han eliminado todas sus cuentas y perfiles de prueba preservando los demás negocios.");
        window.location.reload();
      } else {
        alert(`❌ Error al resetear el sistema: ${res.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`❌ Error al resetear el sistema: ${msg}`);
    } finally {
      setReseteando(false);
    }
  }

  const [widgetEditar, setWidgetEditar] = useState<{
    id: string;
    titulo: string;
    subtitulo: string;
    iconoKey?: string;
    requiereMfa?: boolean;
    tiempoMfaMinutos?: number;
    rutaFisica?: string;
  } | null>(null);

  const abrirModalEditar = (
    e: React.MouseEvent,
    mod: ModuloSuperAdminDef,
    info: { titulo: string; subtitulo: string; iconoKey?: string; requiereMfa?: boolean; tiempoMfaMinutos?: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setWidgetEditar({
      id: mod.clave,
      titulo: info.titulo,
      subtitulo: info.subtitulo,
      iconoKey: info.iconoKey || mod.iconoKey,
      requiereMfa: info.requiereMfa,
      tiempoMfaMinutos: info.tiempoMfaMinutos,
      rutaFisica: mod.rutaFisica
    });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#111", margin: 0 }}>
          ⚡ Consola Master Control — SuperAdmin Plataforma
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleResetearSistema}
            disabled={reseteando}
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#DC2626",
              background: "#FEF2F2",
              padding: "7px 16px",
              borderRadius: "20px",
              border: "1.5px solid #FCA5A5",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(220,38,38,0.1)"
            }}
            title="Borrar todos los usuarios de prueba, perfiles y solicitudes para iniciar desde cero"
          >
            <RotateCcw size={15} /> {reseteando ? "Reseteando..." : "Reset Master del Sistema (Pruebas desde Cero)"}
          </button>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#D97706", background: "#FEF3C7", padding: "6px 14px", borderRadius: "20px", border: "1px solid #FCD34D", display: "flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={14} /> Vista Consolidada Global
          </span>
        </div>
      </div>
      <p className="inicio-cliente-sub" style={{ marginBottom: "24px" }}>
        Todos los módulos y herramientas del ecosistema desplegados y centralizados directamente en tu menú Inicio.
      </p>

      {/* HERO CARD SUPERADMIN */}
      <section
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          color: "#ffffff",
          marginBottom: "28px",
          boxShadow: "0 10px 25px rgba(30, 27, 75, 0.2)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <Shield size={22} color="#F59E0B" />
          <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "20px" }}>
            CATÁLOGO UNIFICADO DE WIDGETS Y MÓDULOS (16 DISPONIBLES)
          </span>
        </div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "0 0 6px 0", color: "#ffffff" }}>
          Catálogo Único de Herramientas del Ecosistema
        </h2>
        <p style={{ fontSize: "0.88rem", opacity: 0.9, margin: 0, maxWidth: "720px", lineHeight: 1.5 }}>
          Haz clic en cualquier módulo para abrir la herramienta directamente o presiona ✏️ Editar para personalizar títulos e íconos en tiempo real.
        </p>
      </section>

      {/* SECCIÓN ACCESOS FAVORITOS */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
          ⭐ Accesos Rápidos Marcados
        </h3>
        <TarjetasFavoritasGrid />
      </div>

      {/* CATÁLOGO UNIFICADO DE WIDGETS DE TODO EL ECOSISTEMA */}
      <section>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--violeta, #5000BA)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <LayoutGrid size={18} /> Todos los Módulos & Widgets del Ecosistema
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {CATALOGO_SUPERADMIN_TODOS.map((m) => {
            const info = getWidgetInfo(m.clave, m.nombre, m.detalle, m.iconoKey);
            const IconoComp = obtenerIconoComponente(info.iconoKey, m.icono);

            return (
              <div
                key={m.clave}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #E4E4E4",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
                }}
                className="tarjeta-modulo-hover"
              >
                <div>
                  {/* BARRA DE BOTONES SUPERIOR */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#F7F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconoComp size={20} color={m.color} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: m.color, background: "#F3F4F6", padding: "4px 8px", borderRadius: "6px" }}>
                        Módulo Activo
                      </span>
                      <button
                        type="button"
                        onClick={(e) => abrirModalEditar(e, m, info)}
                        title="Editar Título, Descripción e Ícono de este Widget"
                        style={{
                          border: "1px solid #E5E7EB",
                          background: "#FFFFFF",
                          borderRadius: "8px",
                          padding: "4px 8px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          color: "#4B5563",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <Pencil size={12} color="#5000BA" /> Editar
                      </button>
                    </div>
                  </div>

                  <h4 style={{ fontSize: "0.96rem", fontWeight: 800, color: "#111", margin: "0 0 4px 0" }}>
                    {info.titulo}
                  </h4>
                  <p style={{ fontSize: "0.82rem", color: "#666", margin: 0, lineHeight: 1.4 }}>
                    {info.subtitulo}
                  </p>
                </div>

                <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link
                    href={m.ruta}
                    style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--violeta, #5000BA)", textDecoration: "none" }}
                  >
                    Abrir Módulo →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL EDITAR WIDGET DE INICIO */}
      {widgetEditar && (
        <ModalEditarWidget
          abierto={Boolean(widgetEditar)}
          onCerrar={() => setWidgetEditar(null)}
          widgetId={widgetEditar.id}
          tituloActual={widgetEditar.titulo}
          subtituloActual={widgetEditar.subtitulo}
          iconoActualKey={widgetEditar.iconoKey}
          requiereMfaActual={widgetEditar.requiereMfa}
          tiempoMfaActualMinutos={widgetEditar.tiempoMfaMinutos}
          rutaFisicaActual={widgetEditar.rutaFisica}
          onGuardar={(id, nTitulo, nSubtitulo, nIconoKey, nMfa, nMinutos) => {
            guardarWidget(id, nTitulo, nSubtitulo, nIconoKey, nMfa, nMinutos);
            setWidgetEditar(null);
          }}
        />
      )}
    </>
  );
}
