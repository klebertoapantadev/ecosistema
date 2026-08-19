"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutGrid, Wrench, Shield, Users, Bell, UserCog, ClipboardList, FileText,
  Settings, X, ChevronRight, CircleUser, KeyRound, FileCheck, type LucideIcon
} from "lucide-react";
import { AdministracionPerfilesWidget } from "@eco/gestion-usuarios/componentes/AdministracionPerfilesWidget";
import { ConsultaUsuariosPerfilesWidget } from "@eco/gestion-usuarios/componentes/ConsultaUsuariosPerfilesWidget";
import { EmisionNotificacionesWidget, PreferenciasNotificacionWidget } from "@eco/notificaciones";
import { GestionTerminosConsentimientosWidget } from "@eco/identidad/componentes/GestionTerminosConsentimientosWidget";
import { FormularioConfiguracionNegocio } from "@eco/configuracion-negocio/componentes/FormularioConfiguracionNegocio";
import { FormularioSmtp } from "@eco/configuracion-negocio/componentes/FormularioSmtp";
import { FormularioPerfil } from "@eco/identidad/componentes/FormularioPerfil";
import { WidgetConfiguracionMfa } from "@eco/identidad/componentes/WidgetConfiguracionMfa";
import { SelectorRolActivo } from "../SelectorRolActivo";
import { TablaAuditoria } from "../auditoria/TablaAuditoria";
import { useCustomWidgets } from "../gestorTitulosWidgets";
import { WidgetFirmaDocumentosPdf } from "@/modulos/firma-documentos/componentes/WidgetFirmaDocumentosPdf";

import { obtenerConfiguracionNavegacionRolAction } from "@eco/gestion-usuarios/acciones";

interface Props {
  slug: string;
  negocio: string;
}

export interface WidgetInventarioDef {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  ruta: string;
  icono?: string;
  colorIcono?: string;
}

const INVENTARIO_GLOBAL_WIDGETS: Record<string, { titulo: string; subtitulo: string; icono: LucideIcon; colorIcono: string; categoria: string }> = {
  firma_documentos_pdf: {
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR",
    icono: FileCheck,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  firma_documentos: {
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR",
    icono: FileCheck,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  firma_pdf: {
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR",
    icono: FileCheck,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  mfa_seguridad: {
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configuración TOTP, autenticador móvil y reseteo estándar vía correo",
    icono: KeyRound,
    colorIcono: "#D97706",
    categoria: "Seguridad"
  },
  mfa: {
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configuración TOTP, autenticador móvil y reseteo estándar vía correo",
    icono: KeyRound,
    colorIcono: "#D97706",
    categoria: "Seguridad"
  },
  seguridad_mfa: {
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configuración TOTP, autenticador móvil y reseteo estándar vía correo",
    icono: KeyRound,
    colorIcono: "#D97706",
    categoria: "Seguridad"
  },
  emision_notificaciones: {
    titulo: "Emisión de Notificaciones Multicanal",
    subtitulo: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp)",
    icono: Bell,
    colorIcono: "#D97706",
    categoria: "Comunicación"
  },
  gestion_usuarios: {
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: UserCog,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Usuarios & Permisos"
  },
  perfiles: {
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: UserCog,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Usuarios & Permisos"
  },
  consulta_usuarios_perfiles: {
    titulo: "Consulta de Usuarios & Perfiles",
    subtitulo: "Directorio de miembros, matriz de roles y consulta de permisos (Solo Lectura)",
    icono: Users,
    colorIcono: "#5000BA",
    categoria: "Consulta & Directorio"
  },
  consulta_perfiles: {
    titulo: "Consulta de Usuarios & Perfiles",
    subtitulo: "Directorio de miembros, matriz de roles y consulta de permisos (Solo Lectura)",
    icono: Users,
    colorIcono: "#5000BA",
    categoria: "Consulta & Directorio"
  },
  socios: {
    titulo: "Aprobación de Socios Abogados",
    subtitulo: "Validación de matrículas, acreditación y verificación de abogados",
    icono: Users,
    colorIcono: "#05876E",
    categoria: "Operación Legal"
  },
  solicitud_socio: {
    titulo: "Solicitudes de Socios",
    subtitulo: "Procesamiento de postulaciones y formularios de postulación socio",
    icono: ClipboardList,
    colorIcono: "#05876E",
    categoria: "Operación Legal"
  },
  auditoria: {
    titulo: "Auditoría BDD & Telemetría",
    subtitulo: "Consulta de registros inmutables PostgreSQL y telemetría de APIs",
    icono: Shield,
    colorIcono: "#111827",
    categoria: "Seguridad & Auditoría"
  },
  gestion_terminos_consentimientos: {
    titulo: "Términos, Consentimientos & LOPDP",
    subtitulo: "Configuración de cláusulas LOPDP y notificaciones de privacidad",
    icono: FileText,
    colorIcono: "#5000BA",
    categoria: "Gobernanza & Legales"
  },
  notificaciones: {
    titulo: "Preferencias de Alertas & Notificaciones",
    subtitulo: "Configuración de canales de alerta, WhatsApp y avisos",
    icono: Bell,
    colorIcono: "#D97706",
    categoria: "Preferencias"
  },
  configuracion_negocio: {
    titulo: "Configuración del Negocio",
    subtitulo: "Parámetros del negocio, RUC, redes sociales y contacto",
    icono: Settings,
    colorIcono: "#5000BA",
    categoria: "Parámetros"
  },
  negocio: {
    titulo: "Configuración del Negocio",
    subtitulo: "Parámetros del negocio, RUC, redes sociales y contacto",
    icono: Settings,
    colorIcono: "#5000BA",
    categoria: "Parámetros"
  },
  configuracion_correo: {
    titulo: "Servidor SMTP & Correo",
    subtitulo: "Credenciales cifradas SMTP y plantillas HTML",
    icono: Settings,
    colorIcono: "#05876E",
    categoria: "Servicios"
  },
  correo: {
    titulo: "Servidor SMTP & Correo",
    subtitulo: "Credenciales cifradas SMTP y plantillas HTML",
    icono: Settings,
    colorIcono: "#05876E",
    categoria: "Servicios"
  },
  mi_cuenta: {
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado y WhatsApp",
    icono: CircleUser,
    colorIcono: "#5000BA",
    categoria: "Identidad"
  },
  perfil: {
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado y WhatsApp",
    icono: CircleUser,
    colorIcono: "#5000BA",
    categoria: "Identidad"
  },
  ver_como: {
    titulo: "Selector 'Ver Como' (Conmutador de Rol)",
    subtitulo: "Alternar la vista previa del portal según los roles asignados",
    icono: Shield,
    colorIcono: "#5000BA",
    categoria: "Gobernanza"
  },
  rol_activo: {
    titulo: "Selector 'Ver Como' (Conmutador de Rol)",
    subtitulo: "Alternar la vista previa del portal según los roles asignados",
    icono: Shield,
    colorIcono: "#5000BA",
    categoria: "Gobernanza"
  }
};

function obtenerWidgetsInicialesDinamicos(panelId: string, slugStr: string): string[] {
  if (typeof document === "undefined") return [];
  const cookieStore = document.cookie || "";
  let rolActivo = "CLIENTE";
  const matchModo = cookieStore.match(/tranqi_modo_rol=([^;]+)/);
  const matchFav = cookieStore.match(/tranqi_rol_favorito=([^;]+)/);
  if (matchModo && matchModo[1]) rolActivo = matchModo[1].toUpperCase();
  else if (matchFav && matchFav[1]) rolActivo = matchFav[1].toUpperCase();

  if (rolActivo === "OPERADOR" || rolActivo === "AUXILIAR" || rolActivo === "TECNICO") {
    if (panelId === "panel_herramientas" || slugStr === "herramientas") return ["firma_documentos_pdf", "emision_notificaciones"];
    if (panelId === "panel_seguridad" || slugStr === "seguridad") return ["mfa_seguridad", "auditoria", "solicitud_socio"];
    if (panelId === "panel_administrar" || slugStr === "administrar") return ["socios", "firma_documentos_pdf"];
    if (panelId === "panel_cuenta" || slugStr === "cuenta") return ["ver_como", "mi_cuenta"];
  } else if (rolActivo === "ADMINISTRADOR" || rolActivo === "SUPERADMIN") {
    if (panelId === "panel_herramientas" || slugStr === "herramientas") return ["firma_documentos_pdf", "emision_notificaciones"];
    if (panelId === "panel_seguridad" || slugStr === "seguridad") return ["mfa_seguridad", "auditoria", "solicitud_socio"];
    if (panelId === "panel_administrar" || slugStr === "administrar") return ["gestion_usuarios", "socios", "firma_documentos_pdf", "solicitud_socio", "emision_notificaciones", "auditoria"];
    if (panelId === "panel_configuracion" || slugStr === "configuracion") return ["configuracion_negocio", "configuracion_correo", "perfiles", "notificaciones"];
    if (panelId === "panel_cuenta" || slugStr === "cuenta") return ["ver_como", "mi_cuenta", "historial_accesos"];
  } else {
    // ROL CLIENTE / ABOGADO
    if (panelId === "panel_herramientas" || slugStr === "herramientas") return ["firma_documentos_pdf"];
    if (panelId === "panel_cuenta" || slugStr === "cuenta") return ["mi_cuenta"];
  }
  return [];
}

export function PanelDinamicoModular({ slug, negocio }: Props) {
  const panelIdBuscado = slug.startsWith("panel_") ? slug : `panel_${slug}`;

  const [panelInfo, setPanelInfo] = useState<{ id: string; nombre: string; descripcion: string; icono?: string; requiereMfa?: boolean }>({
    id: `panel_${slug}`,
    nombre: slug.charAt(0).toUpperCase() + slug.slice(1),
    descripcion: `Panel dinámico ${slug}`
  });

  const [widgetsAsignados, setWidgetsAsignados] = useState<string[]>(() => obtenerWidgetsInicialesDinamicos(panelIdBuscado, slug));
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null);
  const { getWidgetInfo } = useCustomWidgets();

  // Cargar configuración de panel y widgets asignados (BDD + Presets de Rol + LocalStorage)
  useEffect(() => {
    async function cargarConfiguracion() {
      try {
        const savedPaneles = localStorage.getItem(`tranqi_paneles_sidebar_${negocio}`) || localStorage.getItem("tranqi_paneles_sidebar_TRANQ");
        if (savedPaneles) {
          const parsed = JSON.parse(savedPaneles);
          if (Array.isArray(parsed)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pFound = parsed.find((p: any) => p.id === panelIdBuscado || p.ruta === `/panel/${slug}` || p.id === slug);
            if (pFound) {
              setPanelInfo({
                id: pFound.id,
                nombre: pFound.nombre,
                descripcion: pFound.descripcion || `Panel personalizado ${pFound.nombre}`,
                icono: pFound.icono,
                requiereMfa: pFound.requiereMfa
              });
            }
          }
        }

        const cookieStore = typeof document !== "undefined" ? document.cookie : "";
        let rolActivo = "CLIENTE";
        const matchModo = cookieStore.match(/tranqi_modo_rol=([^;]+)/);
        const matchFav = cookieStore.match(/tranqi_rol_favorito=([^;]+)/);
        if (matchModo && matchModo[1]) rolActivo = matchModo[1].toUpperCase();
        else if (matchFav && matchFav[1]) rolActivo = matchFav[1].toUpperCase();

        // 1. Presets de asignación por rol y por panel
        let listW: string[] = [];
        if (rolActivo === "OPERADOR" || rolActivo === "AUXILIAR" || rolActivo === "TECNICO") {
          if (panelIdBuscado === "panel_herramientas" || slug === "herramientas") listW = ["emision_notificaciones"];
          else if (panelIdBuscado === "panel_seguridad" || slug === "seguridad") listW = ["mfa_seguridad", "auditoria", "solicitud_socio"];
          else if (panelIdBuscado === "panel_administrar" || slug === "administrar") listW = ["socios"];
          else if (panelIdBuscado === "panel_cuenta" || slug === "cuenta") listW = ["ver_como", "mi_cuenta"];
        } else if (rolActivo === "ADMINISTRADOR" || rolActivo === "SUPERADMIN") {
          if (panelIdBuscado === "panel_herramientas" || slug === "herramientas") listW = ["emision_notificaciones"];
          else if (panelIdBuscado === "panel_seguridad" || slug === "seguridad") listW = ["mfa_seguridad", "auditoria", "solicitud_socio"];
          else if (panelIdBuscado === "panel_administrar" || slug === "administrar") listW = ["gestion_usuarios", "socios", "solicitud_socio", "emision_notificaciones", "auditoria"];
          else if (panelIdBuscado === "panel_configuracion" || slug === "configuracion") listW = ["configuracion_negocio", "configuracion_correo", "perfiles", "notificaciones"];
          else if (panelIdBuscado === "panel_cuenta" || slug === "cuenta") listW = ["ver_como", "mi_cuenta", "historial_accesos"];
        }

        // 2. Consultar servidor (PostgreSQL comun_seguridad.seg_rol_widget)
        const resBdd = await obtenerConfiguracionNavegacionRolAction(rolActivo, (negocio || "TRANQ").toUpperCase());
        if (resBdd.ok && resBdd.data && resBdd.data.widgetsPorPanel) {
          const wBdd = resBdd.data.widgetsPorPanel[panelIdBuscado] || resBdd.data.widgetsPorPanel[slug] || [];
          if (wBdd.length > 0) {
            listW = Array.from(new Set([...listW, ...wBdd]));
          }
        }

        // 3. Complementar con personalizaciones en localStorage si existen en esta máquina
        const savedPerfiles = localStorage.getItem(`tranqi_perfiles_${negocio}`) || localStorage.getItem("tranqi_perfiles_TRANQ");
        if (savedPerfiles) {
          const perfiles = JSON.parse(savedPerfiles);
          if (Array.isArray(perfiles)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === rolActivo);
            if (!perfilObj && (rolActivo === "OPERADOR" || rolActivo === "AUXILIAR")) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === "OPERADOR");
            }
            if (perfilObj && perfilObj.widgetsAsignadosPorPanel) {
              const wLocal = perfilObj.widgetsAsignadosPorPanel[panelIdBuscado] || perfilObj.widgetsAsignadosPorPanel[slug] || [];
              if (wLocal.length > 0) {
                listW = Array.from(new Set([...listW, ...wLocal]));
              }
            }
          }
        }

        setWidgetsAsignados(listW);
      } catch (err) {
        console.error("Error cargando panel dinámico:", err);
      }
    }

    cargarConfiguracion();
    window.addEventListener("storage", cargarConfiguracion);
    return () => window.removeEventListener("storage", cargarConfiguracion);
  }, [slug, negocio, panelIdBuscado]);

  const renderWidgetComponente = (wClave: string) => {
    switch (wClave) {
      case "firma_documentos_pdf":
      case "firma_documentos":
      case "firma_pdf":
      case "firma":
        return <WidgetFirmaDocumentosPdf negocio={negocio} onCerrar={() => setWidgetActivo(null)} mostrarBotonCerrar={false} />;
      case "mfa_seguridad":
      case "mfa":
      case "seguridad_mfa":
        return <WidgetConfiguracionMfa negocio={negocio} />;
      case "emision_notificaciones":
        return <EmisionNotificacionesWidget negocio={negocio} />;
      case "gestion_usuarios":
      case "perfiles":
        return <AdministracionPerfilesWidget esAdmin={true} negocio={negocio} />;
      case "consulta_usuarios_perfiles":
      case "consulta_perfiles":
        return <ConsultaUsuariosPerfilesWidget negocio={negocio} />;
      case "gestion_terminos_consentimientos":
      case "terminos":
        return <GestionTerminosConsentimientosWidget />;
      case "notificaciones":
        return <PreferenciasNotificacionWidget negocio={negocio} />;
      case "configuracion_negocio":
      case "negocio":
        return <FormularioConfiguracionNegocio inicial={null} negocio={negocio} />;
      case "configuracion_correo":
      case "correo":
        return <FormularioSmtp inicial={null} negocio={negocio} />;
      case "mi_cuenta":
      case "perfil":
        return <FormularioPerfil inicial={{ nombres: "", apellidos: "", correo: "", whatsapp: "", autorizaWhatsapp: false }} />;
      case "ver_como":
      case "rol_activo":
        return <SelectorRolActivo />;
      case "auditoria":
        return <TablaAuditoria registros={[]} />;
      default:
        return (
          <div style={{ padding: "30px", background: "#ffffff", borderRadius: "12px", border: "1px solid #E4E4E4" }}>
            <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--violeta, #5000BA)", marginBottom: "8px" }}>
              ⚡ Módulo Operativo: {wClave.toUpperCase()}
            </h4>
            <p style={{ fontSize: "0.85rem", color: "#666" }}>
              Módulo dinámico activo y vinculado a este panel.
            </p>
          </div>
        );
    }
  };

  const widgetActivoDef = widgetActivo ? INVENTARIO_GLOBAL_WIDGETS[widgetActivo] : null;

  if (widgetActivo) {
    return (
      <div style={{ width: "100%", animation: "fadeIn 0.15s ease" }}>
        <section className="tarjeta-seccion" style={{ background: "#ffffff", borderRadius: "16px", overflow: "hidden", width: "100%", border: "1px solid #E4E4E4" }}>
          <header style={{ padding: "16px 20px", background: "#F7F6FA", borderBottom: "1px solid #E4E4E4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setWidgetActivo(null)}
                style={{ background: "#ffffff", border: "1px solid #E4E4E4", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                title="Cerrar y volver al panel"
              >
                <X size={18} color="#111" />
              </button>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#111" }}>
                  {widgetActivoDef?.titulo || widgetActivo.toUpperCase()}
                </h2>
                <p style={{ fontSize: "0.78rem", color: "#666", margin: 0 }}>
                  {widgetActivoDef?.subtitulo || `Panel ${panelInfo.nombre}`}
                </p>
              </div>
            </div>
          </header>
          <div style={{ padding: "24px" }}>
            {renderWidgetComponente(widgetActivo)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
      {/* BANNER PRINCIPAL DEL PANEL DINÁMICO */}
      <section
        style={{
          background: "linear-gradient(135deg, var(--violeta, #5000BA) 0%, #3B0087 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          color: "#ffffff",
          boxShadow: "0 10px 25px rgba(80, 0, 186, 0.18)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <LayoutGrid size={24} color="#F59E0B" />
          <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "20px" }}>
            CONSOLA OPERATIVA DINÁMICA
          </span>
        </div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
          {panelInfo.nombre}
        </h1>
        <p style={{ fontSize: "0.88rem", opacity: 0.9, margin: 0, maxWidth: "680px" }}>
          {panelInfo.descripcion}
        </p>
      </section>

      {/* SECCIÓN WIDGETS ASIGNADOS AL PANEL */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            MÓDULOS DE {panelInfo.nombre.toUpperCase()} ASIGNADOS
          </h2>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--violeta, #5000BA)", background: "#F3E8FF", padding: "4px 10px", borderRadius: "12px" }}>
            {widgetsAsignados.length} Módulos Activos
          </span>
        </div>

        {widgetsAsignados.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1.5px dashed #E4E4E4" }}>
            <Wrench size={32} color="#9CA3AF" style={{ marginBottom: "12px" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#374151", margin: "0 0 6px 0" }}>
              No hay módulos asignados a este panel
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#6B7280", margin: 0 }}>
              Asigna widgets a este panel desde la Matriz de Perfiles en la Consola de Administración.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {widgetsAsignados.map((wClave) => {
              const def = INVENTARIO_GLOBAL_WIDGETS[wClave] || {
                titulo: wClave.toUpperCase(),
                subtitulo: `Módulo operativo ${wClave}`,
                icono: LayoutGrid,
                colorIcono: "var(--violeta, #5000BA)",
                categoria: "Operación"
              };
              const IconoComp = def.icono;
              const infoCustom = getWidgetInfo(wClave, def.titulo, def.subtitulo);

              return (
                <div
                  key={wClave}
                  onClick={() => setWidgetActivo(wClave)}
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #E4E4E4",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                  className="tarjeta-modulo-hover"
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#F7F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IconoComp size={22} color={def.colorIcono} />
                      </div>
                      <ChevronRight size={18} color="#9CA3AF" />
                    </div>
                    <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: "#111", margin: "0 0 6px 0" }}>
                      {infoCustom.titulo}
                    </h3>
                    <p style={{ fontSize: "0.82rem", color: "#666", margin: 0, lineHeight: 1.4 }}>
                      {infoCustom.subtitulo}
                    </p>
                  </div>
                  <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>
                      {def.categoria}
                    </span>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--violeta, #5000BA)" }}>
                      Abrir Módulo →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
