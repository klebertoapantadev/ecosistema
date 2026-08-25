"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck, Users,
  CheckCircle2, ChevronDown, ChevronUp, Search, Sliders,
  Plus, Check, LayoutGrid, Layers, ExternalLink, PanelLeft, Eye, ArrowRight, ArrowLeft,
  Palette, UserCheck, X, Sparkles, Trash2, Star, Move, Copy, Package, GripVertical,
  Home, User, Settings, Shield, Folder, Wrench, Building, Briefcase, Bell, Database,
  Activity, Globe, Lock, KeyRound, CheckSquare, Terminal, Zap, Pencil, LogOut, LogIn,
  Forward, Inbox, FileText, Download, Printer, Share2, RotateCcw, type LucideIcon
} from "lucide-react";
import { guardarPerfil, guardarWidget, guardarAsignacionWidget, obtenerDatosGestionUsuariosAction } from "../acciones";
import type { UsuarioConMembresia } from "../consultas";

export const CATALOGO_ICONOS_PANEL: Record<string, LucideIcon> = {
  Home,
  User,
  Settings,
  Shield,
  Sliders,
  Folder,
  Wrench,
  Building,
  Briefcase,
  Bell,
  Database,
  Activity,
  Globe,
  Sparkles,
  Lock,
  KeyRound,
  CheckSquare,
  Terminal,
  Zap,
  Eye,
  Search,
  Pencil,
  LogOut,
  LogIn,
  Forward,
  Inbox,
  Layers,
  LayoutGrid,
  PanelLeft,
};

export function IconoPanelDinamico({ nombreIcono, color, size = 18 }: { nombreIcono?: string; color?: string; size?: number }) {
  const IconoComp = (nombreIcono && CATALOGO_ICONOS_PANEL[nombreIcono]) || PanelLeft;
  return <IconoComp size={size} color={color} />;
}

export interface TemaPerfilDef {
  colorPrimario: string;
  colorFondoSuave: string;
  colorBorde: string;
  colorTexto: string;
  badgeBg: string;
  badgeTexto: string;
  iconoColor: string;
}

export const TEMAS_PERFIL: Record<string, TemaPerfilDef> = {
  CLIENTE: {
    colorPrimario: "#5000BA", // Violeta Púrpura Tranqi
    colorFondoSuave: "#F5F3FF",
    colorBorde: "#7C3AED",
    colorTexto: "#4C1D95",
    badgeBg: "#DDD6FE",
    badgeTexto: "#581C87",
    iconoColor: "#6D28D9"
  },
  OPERADOR: {
    colorPrimario: "#0284C7", // Cyan / Azul Operativo
    colorFondoSuave: "#F0F9FF",
    colorBorde: "#0284C7",
    colorTexto: "#0369A1",
    badgeBg: "#BAE6FD",
    badgeTexto: "#075985",
    iconoColor: "#0284C7"
  },
  ABOGADO: {
    colorPrimario: "#05876E", // Verde Esmeralda Legal
    colorFondoSuave: "#ECFDF5",
    colorBorde: "#05876E",
    colorTexto: "#065F46",
    badgeBg: "#A7F3D0",
    badgeTexto: "#064E3B",
    iconoColor: "#05876E"
  },
  ADMINISTRADOR: {
    colorPrimario: "#D97706", // Ámbar / Oro Administración
    colorFondoSuave: "#FFFBEB",
    colorBorde: "#D97706",
    colorTexto: "#92400E",
    badgeBg: "#FDE68A",
    badgeTexto: "#78350F",
    iconoColor: "#B45309"
  },
  SUPERADMIN: {
    colorPrimario: "#111827", // Negro Ópalo / Plataforma Elite
    colorFondoSuave: "#F9FAFB",
    colorBorde: "#374151",
    colorTexto: "#111827",
    badgeBg: "#E5E7EB",
    badgeTexto: "#1F2937",
    iconoColor: "#111827"
  }
};

const TEMA_POR_DEFECTO: TemaPerfilDef = {
  colorPrimario: "#5000BA",
  colorFondoSuave: "#F5F3FF",
  colorBorde: "#5000BA",
  colorTexto: "#111111",
  badgeBg: "#E0E7FF",
  badgeTexto: "#3730A3",
  iconoColor: "#5000BA"
};

export interface PerfilDef {
  clave: string;
  nombre: string;
  nivel: number;
  ambito: string;
  descripcion: string;
  panelesAsignados: string[];
  widgetsAsignadosPorPanel: Record<string, string[]>;
  activo: boolean;
  esSuperAdmin?: boolean;
}

export interface PanelSidebarDef {
  id: string;
  nombre: string;
  ruta: string;
  descripcion: string;
  icono?: string;
  requiereMfa?: boolean;
  mostrarSinWidgets?: boolean;
  esPersonalizado?: boolean;
}

export interface WidgetInventarioDef {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  ruta: string;
  rutaFisica?: string;
  panelId: string;
  activo: boolean;
  creadoEn?: string;
}

const PANELES_SIDEBAR_INICIALES: PanelSidebarDef[] = [
  {
    id: "panel_inicio",
    nombre: "Inicio (Tablero Principal)",
    ruta: "/panel",
    descripcion: "Pantalla principal que agrupa accesos rápidos y módulos según el rol del usuario.",
    icono: "Home",
    requiereMfa: false,
    mostrarSinWidgets: true
  },
  {
    id: "panel_cuenta",
    nombre: "Mi Cuenta & Identidad",
    ruta: "/panel/cuenta",
    descripcion: "Perfil de usuario, conmutador de rol ('Ver como') e historial de accesos.",
    icono: "User",
    requiereMfa: false,
    mostrarSinWidgets: true
  },
  {
    id: "panel_herramientas",
    nombre: "Herramientas",
    ruta: "/panel/herramientas",
    descripcion: "Herramientas digitales, firmado de documentos PDF y utilitarios del ecosistema.",
    icono: "Wrench",
    requiereMfa: false,
    mostrarSinWidgets: true
  },
  {
    id: "panel_seguridad",
    nombre: "Seguridad",
    ruta: "/panel/seguridad",
    descripcion: "Seguridad MFA, autenticador e historial de accesos.",
    icono: "Shield",
    requiereMfa: false,
    mostrarSinWidgets: true
  },
  {
    id: "panel_configuracion",
    nombre: "Configuración & Gobernanza",
    ruta: "/panel/configuracion",
    descripcion: "Parámetros del negocio, servidor SMTP, perfiles y alertas de notificaciones.",
    icono: "Settings",
    requiereMfa: false,
    mostrarSinWidgets: true
  },
  {
    id: "panel_administrar",
    nombre: "Administrar (Consola de Gestión)",
    ruta: "/panel/administrar",
    descripcion: "Consola de administración protegida para usuarios, socios, solicitudes, notificaciones y auditoría.",
    icono: "Shield",
    requiereMfa: true,
    mostrarSinWidgets: true
  }
];

const PERFILES_INICIALES: PerfilDef[] = [
  {
    clave: "CLIENTE",
    nombre: "Cliente (Jerarquía Base)",
    nivel: 1,
    ambito: "Empresa",
    descripcion: "Perfil base de usuario. Acceso a paneles de Inicio, Mi Cuenta, Herramientas y Preferencias de Notificaciones.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsAsignadosPorPanel: {
      panel_inicio: ["favoritos"],
      panel_cuenta: ["ver_como", "mi_cuenta"],
      panel_herramientas: ["firma_documentos_pdf", "billetera_documentos"],
      panel_configuracion: ["notificaciones"]
    },
    activo: true
  },
  {
    clave: "OPERADOR",
    nombre: "Operador / Auxiliar",
    nivel: 30,
    ambito: "Empresa",
    descripcion: "Perfil operativo para atención al cliente, evaluación de solicitudes, configuración de términos, contratos y beneficios.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_herramientas", "panel_configuracion", "panel_administrar"],
    widgetsAsignadosPorPanel: {
      panel_inicio: ["favoritos"],
      panel_cuenta: ["ver_como", "mi_cuenta"],
      panel_herramientas: ["firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
      panel_configuracion: ["notificaciones"],
      panel_administrar: ["socios", "configuracion_contrato_abogado", "gestion_terminos_consentimientos"]
    },
    activo: true
  },
  {
    clave: "ABOGADO",
    nombre: "Socio Abogado / Profesional",
    nivel: 50,
    ambito: "Empresa",
    descripcion: "Perfil profesional para atención legal de causas y expedientes.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_herramientas", "panel_configuracion"],
    widgetsAsignadosPorPanel: {
      panel_inicio: ["favoritos"],
      panel_cuenta: ["ver_como", "mi_cuenta"],
      panel_herramientas: ["firma_documentos_pdf", "billetera_documentos"],
      panel_configuracion: ["notificaciones"]
    },
    activo: true
  },
  {
    clave: "ADMINISTRADOR",
    nombre: "Administrador del Negocio",
    nivel: 80,
    ambito: "Empresa",
    descripcion: "Gestión del negocio: usuarios, parámetros de marca, SMTP, perfiles, contratos, términos y auditoría.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_herramientas", "panel_configuracion", "panel_administrar"],
    widgetsAsignadosPorPanel: {
      panel_inicio: ["favoritos"],
      panel_cuenta: ["ver_como", "mi_cuenta"],
      panel_herramientas: ["firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
      panel_configuracion: ["configuracion_negocio", "configuracion_correo", "perfiles", "notificaciones"],
      panel_administrar: ["gestion_usuarios", "socios", "solicitud_socio", "emision_notificaciones", "gestion_terminos_consentimientos", "configuracion_contrato_abogado", "auditoria"]
    },
    activo: true
  },
  {
    clave: "SUPERADMIN",
    nombre: "SuperAdmin de Plataforma",
    nivel: 100,
    ambito: "Plataforma",
    descripcion: "Gobernanza exclusiva de la plataforma y matriz global de perfiles.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_herramientas", "panel_configuracion", "panel_administrar"],
    widgetsAsignadosPorPanel: {
      panel_inicio: ["favoritos"],
      panel_cuenta: ["ver_como", "mi_cuenta", "historial_accesos"],
      panel_herramientas: ["firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
      panel_configuracion: ["configuracion_negocio", "configuracion_correo", "perfiles", "notificaciones"],
      panel_administrar: ["gestion_usuarios", "socios", "solicitud_socio", "emision_notificaciones", "auditoria"]
    },
    activo: true,
    esSuperAdmin: true
  }
];

const WIDGETS_INVENTARIO_INICIALES: WidgetInventarioDef[] = [
  {
    clave: "favoritos",
    nombre: "Gestor de Accesos Rápidos & Favoritos",
    descripcion: "Rejilla dinámica de accesos rápidos marcados con estrella.",
    categoria: "Inicio",
    ruta: "/panel",
    rutaFisica: "/plataforma/SeccionFavoritosInicio.tsx",
    panelId: "panel_inicio",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "ver_como",
    nombre: "Selector 'Ver Como' (Conmutador de Rol)",
    descripcion: "Conmutador de rol activo asignado para cambiar de perspectiva.",
    categoria: "Identidad",
    ruta: "/panel/cuenta",
    rutaFisica: "/plataforma/SelectorRolActivo.tsx",
    panelId: "panel_cuenta",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "mi_cuenta",
    nombre: "Datos Personales & Perfil",
    descripcion: "Edición de perfil de usuario y preferencias de contacto.",
    categoria: "Identidad",
    ruta: "/panel/cuenta",
    rutaFisica: "/identidad/FormularioPerfil.tsx",
    panelId: "panel_cuenta",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "historial_accesos",
    nombre: "Historial de Accesos & Sesiones",
    descripcion: "Bitácora de inicios de sesión, navegador e IP.",
    categoria: "Seguridad",
    ruta: "/panel/cuenta",
    rutaFisica: "/identidad/HistorialAccesos.tsx",
    panelId: "panel_cuenta",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "mfa_seguridad",
    nombre: "Seguridad MFA & Autenticador",
    descripcion: "Configuración TOTP y reseteo estándar vía correo.",
    categoria: "Seguridad",
    ruta: "/panel/cuenta",
    rutaFisica: "/identidad/WidgetConfiguracionMfa.tsx",
    panelId: "panel_cuenta",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "datos_facturacion",
    nombre: "Datos de Facturación SRI & Comprobantes",
    descripcion: "Razón Social, RUC/Cédula, dirección fiscal y correo SRI.",
    categoria: "Facturación",
    ruta: "/panel/cuenta",
    rutaFisica: "/identidad/FormularioDatosFacturacion.tsx",
    panelId: "panel_cuenta",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios & Membresías",
    descripcion: "Asignación de perfiles, roles y techo jerárquico.",
    categoria: "Administración",
    ruta: "/panel/usuarios",
    rutaFisica: "/gestion-usuarios/AdministracionPerfilesWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "consulta_usuarios_perfiles",
    nombre: "Consulta de Usuarios & Perfiles",
    descripcion: "Directorio de miembros, matriz de roles y consulta de permisos (Solo Lectura).",
    categoria: "Consulta & Directorio",
    ruta: "/panel/usuarios",
    rutaFisica: "/gestion-usuarios/ConsultaUsuariosPerfilesWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-07-31"
  },
  {
    clave: "socios",
    nombre: "Aprobación de Socios Abogados",
    descripcion: "Revisión de matrículas y verificación de credenciales.",
    categoria: "Operación Legal",
    ruta: "/panel/socios",
    rutaFisica: "/tranqi/AprobacionSociosWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-07-28"
  },
  {
    clave: "solicitud_socio",
    nombre: "Solicitudes de Socios",
    descripcion: "Revisión y procesamiento de formularios de solicitud.",
    categoria: "Operación Legal",
    ruta: "/panel/solicitud-socio",
    rutaFisica: "/tranqi/SolicitudSocioWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-07-28"
  },
  {
    clave: "auditoria",
    nombre: "Auditoría por Triggers BDD",
    descripcion: "Registro inmutable de transacciones, diffs JSONB e IP.",
    categoria: "Seguridad & Auditoría",
    ruta: "/panel/auditoria",
    rutaFisica: "/auditoria/TablaAuditoria.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-07-28"
  },
  {
    clave: "emision_notificaciones",
    nombre: "Emisión de Notificaciones Multicanal",
    descripcion: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp).",
    categoria: "Comunicación",
    ruta: "/panel/emision-notificaciones",
    rutaFisica: "/notificaciones/EmisionNotificacionesWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-08-02"
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración del Negocio",
    descripcion: "Identidad legal, WhatsApp, redes sociales y locales.",
    categoria: "Configuración",
    ruta: "/panel/configuracion",
    rutaFisica: "/identidad/ConfiguracionNegocioWidget.tsx",
    panelId: "panel_configuracion",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo SMTP",
    descripcion: "Credenciales Vault para envío de emails transaccionales.",
    categoria: "Infraestructura",
    ruta: "/panel/configuracion",
    rutaFisica: "/notificaciones/ConfiguracionSmtpWidget.tsx",
    panelId: "panel_configuracion",
    activo: true,
    creadoEn: "2026-07-30"
  },
  {
    clave: "perfiles",
    nombre: "Administración de Perfiles & Permisos",
    descripcion: "Matriz de perfiles, jerarquía (1-100) y asignación de widgets.",
    categoria: "Gobernanza",
    ruta: "/panel/configuracion",
    rutaFisica: "/gestion-usuarios/AdministracionPerfilesWidget.tsx",
    panelId: "panel_configuracion",
    activo: true,
    creadoEn: "2026-07-31"
  },
  {
    clave: "notificaciones",
    nombre: "Preferencias de Alertas & Notificaciones",
    descripcion: "Canales de recepción de correo saliente, WhatsApp y Push.",
    categoria: "Comunicación",
    ruta: "/panel/configuracion",
    rutaFisica: "/identidad/ModalTerminosNotificaciones.tsx",
    panelId: "panel_configuracion",
    activo: true,
    creadoEn: "2026-07-27"
  },
  {
    clave: "gestion_terminos_consentimientos",
    nombre: "Términos, Contratos & Beneficios",
    descripcion: "Configuración centralizada de cláusulas LOPDP, contratos de sociedad, términos y beneficios informativos.",
    categoria: "Gobernanza & Legales",
    ruta: "/panel/administrar?widget=gestion_terminos_consentimientos",
    rutaFisica: "/identidad/GestionTerminosConsentimientosWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-08-13"
  },
  {
    clave: "configuracion_contrato_abogado",
    nombre: "Configuración de Contrato de Socios",
    descripcion: "Administración de la plantilla del contrato de sociedad de abogados (.MD/HTML).",
    categoria: "Operación Legal",
    ruta: "/panel/administrar?widget=configuracion_contrato_abogado",
    rutaFisica: "/tranqi/ConfiguracionContratoAbogadoWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-08-13"
  },
  {
    clave: "bitacora_notificaciones",
    nombre: "Bitácora & Historial de Notificaciones",
    descripcion: "Consulta auditada e historial en tiempo real de notificaciones emitidas.",
    categoria: "Comunicación",
    ruta: "/panel/administrar?widget=bitacora_notificaciones",
    rutaFisica: "/notificaciones/BitacoraNotificacionesWidget.tsx",
    panelId: "panel_administrar",
    activo: true,
    creadoEn: "2026-08-13"
  },
  {
    clave: "firma_documentos_pdf",
    nombre: "Firma Electrónica de Documentos PDF",
    descripcion: "Firmado digital avanzado de archivos PDF locales con certificado .p12 y estampa QR oficial.",
    categoria: "Herramientas Digitales",
    ruta: "/panel/firma-documentos",
    rutaFisica: "/firma-documentos/WidgetFirmaDocumentosPdf.tsx",
    panelId: "panel_herramientas",
    activo: true,
    creadoEn: "2026-08-19"
  },
  {
    clave: "billetera_documentos",
    nombre: "Billetera Digital de Documentos Seguros",
    descripcion: "Bóveda digital de documentos personales, vehiculares, contratos y profesionales con extracción OCR y enlaces efímeros (TTL).",
    categoria: "Herramientas Digitales",
    ruta: "/panel/billetera-documentos",
    rutaFisica: "/billetera-documentos/componentes/WidgetBilleteraDocumentos.tsx",
    panelId: "panel_herramientas",
    activo: true,
    creadoEn: "2026-08-23"
  }
];

// COMPONENTE PARA RENDERIZAR LA INTERFAZ REAL INTERACTIVA EN EL MODAL DE PREVISUALIZACIÓN
function RenderizadorWidgetReal({ clave, negocio }: { clave: string; negocio: string }) {
  switch (clave) {
    case "billetera_documentos":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid var(--violeta, #5000BA)", boxShadow: "0 4px 12px rgba(80,0,186,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "0.95rem", color: "var(--violeta, #5000BA)", marginBottom: "10px" }}>
            <Folder size={18} /> Billetera Digital de Documentos Seguros (OCR / TTL)
          </div>
          <p style={{ fontSize: "0.82rem", color: "#64748B", marginBottom: "12px" }}>
            Bóveda cifrada para almacenamiento y gestión inteligente de cédulas, matrículas, licencias, contratos y certificados con extracción OCR y enlaces efímeros protegidos.
          </p>
          <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1", textAlign: "center", fontSize: "0.82rem", color: "#334155", fontWeight: 700 }}>
            Categorías Inteligentes Extracción OCR ⏳ Enlaces TTL Efímeros
          </div>
        </div>
      );

    case "firma_documentos_pdf":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid var(--violeta, #5000BA)", boxShadow: "0 4px 12px rgba(80,0,186,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "0.95rem", color: "var(--violeta, #5000BA)", marginBottom: "10px" }}>
            <FileText size={18} /> Firma Electrónica de Documentos PDF (.p12 / QR)
          </div>
          <p style={{ fontSize: "0.82rem", color: "#64748B", marginBottom: "12px" }}>
            Herramienta criptográfica PAdES con procesamiento Zero-Custody en memoria local para firmado de contratos, actas e informes en PDF.
          </p>
          <div style={{ padding: "12px", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1", textAlign: "center", fontSize: "0.82rem", color: "#334155", fontWeight: 700 }}>
            Subir Archivo PDF Cargar Firma .p12 Ubicar QR Descargar PDF Firmado
          </div>
        </div>
      );

    case "ver_como":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid var(--violeta, #5000BA)", boxShadow: "0 4px 12px rgba(80,0,186,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "0.95rem", color: "var(--violeta, #5000BA)", marginBottom: "10px" }}>
            <Users size={18} /> Selector "Ver Como" (Conmutador de Rol Activo)
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", marginBottom: "12px" }}>
            Selecciona el rol con el que deseas navegar la plataforma para simular permisos y vistas:
          </p>
          <select style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "2px solid var(--violeta, #5000BA)", fontSize: "0.88rem", fontWeight: 800, background: "#F5F3FF", color: "#4C1D95", cursor: "pointer" }}>
            <option>Cliente (Jerarquía Base) - Nivel 1</option>
            <option>Socio Abogado / Profesional - Nivel 50</option>
            <option>Administrador del Negocio - Nivel 80</option>
            <option>SuperAdmin de Plataforma - Nivel 100</option>
          </select>
        </div>
      );

    case "notificaciones":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid #0284C7", boxShadow: "0 4px 12px rgba(2,132,199,0.08)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0369A1", marginBottom: "10px" }}>
            Preferencias de Alertas & Notificaciones Multicanal
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.84rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "#0284C7" }} /> Correo Electrónico Saliente (Email Transaccional)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "#0284C7" }} /> WhatsApp Directo al Celular (+593)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "#0284C7" }} /> Notificaciones Push In-App
            </label>
          </div>
        </div>
      );

    case "configuracion_negocio":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid #D97706" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#92400E", marginBottom: "10px" }}>
            Datos del Negocio ({negocio.toUpperCase()})
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#737373", display: "block" }}>Razón Social / Nombre Comercial:</label>
              <input type="text" defaultValue="TRANQUI LEGAL ECUADOR S.A.S." style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E4E4E4", fontSize: "0.84rem", fontWeight: 700 }} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#737373", display: "block" }}>WhatsApp de Soporte:</label>
              <input type="text" defaultValue="+593 99 999 9999" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E4E4E4", fontSize: "0.84rem" }} />
            </div>
          </div>
        </div>
      );

    case "configuracion_correo":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid #374151" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#111827", marginBottom: "10px" }}>
            Servidor SMTP de Correo Transaccional (Credenciales Vault)
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#737373", display: "block" }}>Servidor Host SMTP:</label>
              <input type="text" defaultValue="smtp.resend.com:587" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E4E4E4", fontSize: "0.84rem", fontWeight: 700 }} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#737373", display: "block" }}>Remitente Oficial:</label>
              <input type="text" defaultValue="notificaciones@tranqi24.com" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E4E4E4", fontSize: "0.84rem" }} />
            </div>
          </div>
        </div>
      );

    case "gestion_usuarios":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid #05876E" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#065F46", marginBottom: "10px" }}>
            Administración de Usuarios & Membresías
          </div>
          <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#ECFDF5", borderBottom: "1px solid #A7F3D0" }}>
                <th style={{ textAlign: "left", padding: "6px 10px" }}>Usuario</th>
                <th style={{ textAlign: "left", padding: "6px 10px" }}>Perfil Activo</th>
                <th style={{ textAlign: "center", padding: "6px 10px" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "6px 10px", fontWeight: 700 }}>Kleber Toapanta</td>
                <td style={{ padding: "6px 10px" }}>SuperAdmin (Nivel 100)</td>
                <td style={{ padding: "6px 10px", textAlign: "center", color: "#05876e", fontWeight: 800 }}>Activo</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid var(--violeta, #5000BA)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--violeta, #5000BA)", marginBottom: "8px" }}>
            Componente Real: {clave.toUpperCase()}
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", margin: 0 }}>
            Widget autosuficiente desacoplado. Puede asignarse a cualquier panel del sistema.
          </p>
        </div>
      );
  }
}

interface Props {
  esAdmin: boolean;
  negocio: string;
}

export function AdministracionPerfilesWidget({ esAdmin, negocio }: Props) {
  const [tabActiva, setTabActiva] = useState<"matriz_paneles" | "matriz_widgets" | "inventario_widgets" | "perfiles" | "reporte_gobernanza">("matriz_widgets");
  // Estado local
  const [perfiles, setPerfiles] = useState<PerfilDef[]>(PERFILES_INICIALES);
  const [panelesSidebar, setPanelesSidebar] = useState<PanelSidebarDef[]>(PANELES_SIDEBAR_INICIALES);
  const [inventarioWidgets, setInventarioWidgets] = useState<WidgetInventarioDef[]>(WIDGETS_INVENTARIO_INICIALES);
  const [criterioOrden, setCriterioOrden] = useState<"fecha" | "nombre" | "directorio">("fecha");

  // Estado del Reporte de Gobernanza
  const [usuariosReporte, setUsuariosReporte] = useState<UsuarioConMembresia[]>([]);
  const [cargandoUsuariosReporte, setCargandoUsuariosReporte] = useState(false);
  const [filtroPerfilReporte, setFiltroPerfilReporte] = useState<string>("TODOS");
  const [busquedaReporte, setBusquedaReporte] = useState<string>("");

  const cargarUsuariosParaReporte = async () => {
    setCargandoUsuariosReporte(true);
    try {
      const res = await obtenerDatosGestionUsuariosAction("", negocio);
      if (res.ok && res.data?.usuarios) {
        setUsuariosReporte(res.data.usuarios);
      }
    } catch (e) {
      console.warn("Error cargando usuarios para reporte:", e);
    } finally {
      setCargandoUsuariosReporte(false);
    }
  };

  useEffect(() => {
    cargarUsuariosParaReporte();
  }, [negocio]);

  const copiarReporteMarkdown = () => {
    let md = `# REPORTE DE GOBERNANZA — MATRIZ DE PERFILES, PANELES, WIDGETS Y USUARIOS (${negocio.toUpperCase()})\n\n`;
    md += `*Fecha de Generación:* ${new Date().toLocaleString("es-EC")}\n\n`;

    const perfilesFiltrados = filtroPerfilReporte === "TODOS" ? perfiles : perfiles.filter(p => p.clave === filtroPerfilReporte);

    perfilesFiltrados.forEach(p => {
      md += `## PERFIL: ${p.nombre.toUpperCase()} (Nivel ${p.nivel})\n`;
      md += `- **Clave:** \`${p.clave}\`\n`;
      md += `- **Ámbito:** ${p.ambito}\n`;
      md += `- **Descripción:** ${p.descripcion || "Sin descripción"}\n\n`;

      // Paneles y Widgets
      md += `### Paneles y Widgets Asignados:\n`;
      const panelesDelPerfil = panelesSidebar.filter(pan => p.panelesAsignados.includes(pan.id));
      if (panelesDelPerfil.length === 0) {
        md += `*Sin paneles asignados.*\n\n`;
      } else {
        panelesDelPerfil.forEach(pan => {
          const widgetsDelPanel = (p.widgetsAsignadosPorPanel[pan.id] || []).map(wClave => {
            const wObj = inventarioWidgets.find(w => w.clave === wClave);
            return wObj ? `${wObj.nombre} (\`${wObj.clave}\` - ${wObj.categoria})` : `\`${wClave}\``;
          });
          md += `- **Panel:** **${pan.nombre}** (\`${pan.ruta}\`) ${pan.requiereMfa ? "[MFA Requerido]" : ""}\n`;
          if (widgetsDelPanel.length > 0) {
            widgetsDelPanel.forEach(w => {
              md += `  - ${w}\n`;
            });
          } else {
            md += `  - *(Sin widgets asignados)*\n`;
          }
        });
        md += `\n`;
      }

      // Usuarios Asignados
      const usuariosDelPerfil = usuariosReporte.filter(u => {
        if (p.clave === "SUPERADMIN") return u.perfiles.includes("SUPERADMIN");
        return u.perfiles.map(x => x.toUpperCase()).includes(p.clave.toUpperCase());
      });

      md += `### Usuarios Asignados (${usuariosDelPerfil.length}):\n`;
      if (usuariosDelPerfil.length === 0) {
        md += `*No hay usuarios con este perfil asignado.*\n\n`;
      } else {
        usuariosDelPerfil.forEach(u => {
          const nombreCompleto = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || "Sin Nombre";
          md += `- **${nombreCompleto}** — \`${u.usu_correo}\` (Estado: ${u.mem_estado || "ACTIVO"})\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    });

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(md);
      setMensajeExito("Reporte copiado al portapapeles en formato Markdown.");
      setTimeout(() => setMensajeExito(null), 4000);
    }
  };

  const exportarReporteCSV = () => {
    const filas: string[][] = [
      ["Perfil", "Nivel", "Ambito", "Panel", "Ruta Panel", "MFA Panel", "Widget Clave", "Widget Nombre", "Categoria Widget", "Usuario Nombre", "Usuario Correo", "Usuario Estado"]
    ];

    const perfilesFiltrados = filtroPerfilReporte === "TODOS" ? perfiles : perfiles.filter(p => p.clave === filtroPerfilReporte);

    perfilesFiltrados.forEach(p => {
      const panelesDelPerfil = panelesSidebar.filter(pan => p.panelesAsignados.includes(pan.id));
      const usuariosDelPerfil = usuariosReporte.filter(u => {
        if (p.clave === "SUPERADMIN") return u.perfiles.includes("SUPERADMIN");
        return u.perfiles.map(x => x.toUpperCase()).includes(p.clave.toUpperCase());
      });

      panelesDelPerfil.forEach(pan => {
        const widgets = p.widgetsAsignadosPorPanel[pan.id] || [];
        if (widgets.length === 0) {
          filas.push([
            p.nombre,
            String(p.nivel),
            p.ambito,
            pan.nombre,
            pan.ruta,
            pan.requiereMfa ? "SI" : "NO",
            "-",
            "Sin widgets",
            "-",
            usuariosDelPerfil.length > 0 ? usuariosDelPerfil.map(u => [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ")).join("; ") : "Sin usuarios",
            usuariosDelPerfil.length > 0 ? usuariosDelPerfil.map(u => u.usu_correo).join("; ") : "-",
            "-"
          ]);
        } else {
          widgets.forEach(wClave => {
            const wObj = inventarioWidgets.find(w => w.clave === wClave);
            filas.push([
              p.nombre,
              String(p.nivel),
              p.ambito,
              pan.nombre,
              pan.ruta,
              pan.requiereMfa ? "SI" : "NO",
              wClave,
              wObj?.nombre || wClave,
              wObj?.categoria || "General",
              usuariosDelPerfil.length > 0 ? usuariosDelPerfil.map(u => [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ")).join("; ") : "Sin usuarios",
              usuariosDelPerfil.length > 0 ? usuariosDelPerfil.map(u => u.usu_correo).join("; ") : "-",
              "-"
            ]);
          });
        }
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," + filas.map(e => e.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Gobernanza_Perfiles_${negocio}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // FUNCIÓN PARA FORZAR SINCRONIZACIÓN INMEDIATA DEL CATÁLOGO MAESTRO (WIDGETS, PANELES Y PERFILES)
  const sincronizarCatalogoMaestro = () => {
    try {
      const clavesActuales = new Set(inventarioWidgets.map(w => w.clave));
      const faltantesInventario = WIDGETS_INVENTARIO_INICIALES.filter(w => !clavesActuales.has(w.clave));
      const inventarioActualizado = [
        ...inventarioWidgets.map(w => {
          const original = WIDGETS_INVENTARIO_INICIALES.find(o => o.clave === w.clave);
          return original ? { ...w, ...original, nombre: w.nombre || original.nombre } : w;
        }),
        ...faltantesInventario
      ];
      setInventarioWidgets(inventarioActualizado);
      localStorage.setItem(`tranqi_inventario_widgets_${negocio}`, JSON.stringify(inventarioActualizado));

      const perfilesActualizados = perfiles.map(p => {
        const base = PERFILES_INICIALES.find(b => b.clave === p.clave);
        if (!base) return p;
        const panelesMerged = Array.from(new Set([...(p.panelesAsignados || []), ...base.panelesAsignados]));
        const widgetsMerged: Record<string, string[]> = { ...(p.widgetsAsignadosPorPanel || {}) };
        Object.entries(base.widgetsAsignadosPorPanel || {}).forEach(([panelKey, listBase]) => {
          const currentList = widgetsMerged[panelKey] || [];
          widgetsMerged[panelKey] = Array.from(new Set([...currentList, ...listBase]));
        });
        return {
          ...p,
          panelesAsignados: panelesMerged,
          widgetsAsignadosPorPanel: widgetsMerged
        };
      });
      setPerfiles(perfilesActualizados);
      localStorage.setItem(`tranqi_perfiles_${negocio}`, JSON.stringify(perfilesActualizados));

      const idsPaneles = new Set(panelesSidebar.map(p => p.id));
      const faltantesPaneles = PANELES_SIDEBAR_INICIALES.filter(p => !idsPaneles.has(p.id));
      const panelesActualizados = [...panelesSidebar, ...faltantesPaneles];
      setPanelesSidebar(panelesActualizados);
      localStorage.setItem(`tranqi_paneles_sidebar_${negocio}`, JSON.stringify(panelesActualizados));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
      }

      alert(`Catálogo Maestro Sincronizado: ${inventarioActualizado.length} widgets del sistema disponibles para asignar.`);
    } catch (err) {
      console.error("Error al sincronizar catálogo:", err);
    }
  };

  // CLAVES LOCALSTORAGE PERSISTENCIA POR NEGOCIO
  const KEY_PANELES = `tranqi_paneles_sidebar_${negocio}`;
  const KEY_PERFILES = `tranqi_perfiles_${negocio}`;
  const KEY_INVENTARIO = `tranqi_inventario_widgets_${negocio}`;

  // Cargar estado persistido al cargar el componente
  useEffect(() => {
    try {
      const savedPaneles = localStorage.getItem(KEY_PANELES);
      if (savedPaneles) {
        const parsed = JSON.parse(savedPaneles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const idsExistentes = new Set(parsed.map((p: any) => p.id));
          const faltantes = PANELES_SIDEBAR_INICIALES.filter(p => !idsExistentes.has(p.id));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const saneados = [...parsed, ...faltantes].map((p: any) => {
            let r = p.ruta || "/panel";
            if (r === "/panel/" || r === "/panel") {
              const slugClean = (p.id || "").replace(/^panel_/, "");
              if (slugClean) r = `/panel/${slugClean}`;
            }
            return { ...p, ruta: r };
          });
          setPanelesSidebar(saneados);
        }
      }

      const savedPerfiles = localStorage.getItem(KEY_PERFILES);
      if (savedPerfiles) {
        const parsed = JSON.parse(savedPerfiles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Asegurar que perfiles base mantengan widgets iniciales si no los tenian
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const combinados = parsed.map((p: any) => {
            const base = PERFILES_INICIALES.find(b => b.clave === p.clave);
            if (!base) return p;
            const panelesMerged = Array.from(new Set([...(p.panelesAsignados || []), ...base.panelesAsignados]));
            const widgetsMerged: Record<string, string[]> = { ...(p.widgetsAsignadosPorPanel || {}) };
            Object.entries(base.widgetsAsignadosPorPanel || {}).forEach(([panelKey, listBase]) => {
              const currentList = widgetsMerged[panelKey] || [];
              widgetsMerged[panelKey] = Array.from(new Set([...currentList, ...listBase]));
            });
            return {
              ...p,
              panelesAsignados: panelesMerged,
              widgetsAsignadosPorPanel: widgetsMerged
            };
          });
          setPerfiles(combinados);
        }
      }

      const savedInventario = localStorage.getItem(KEY_INVENTARIO);
      if (savedInventario) {
        const parsed = JSON.parse(savedInventario);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Fusionar con WIDGETS_INVENTARIO_INICIALES para no perder nuevos widgets y actualizar los campos creados/rutas
          const clavesExistentes = new Set(parsed.map((w: any) => w.clave));
          const nuevosWidgets = WIDGETS_INVENTARIO_INICIALES.filter(w => !clavesExistentes.has(w.clave));
          
          // Asegurarse de actualizar propiedades de fecha de creación y ruta de los ya cargados si cambian en código
          const actualizados = parsed.map((w: any) => {
            const original = WIDGETS_INVENTARIO_INICIALES.find(o => o.clave === w.clave);
            return original ? { ...w, creadoEn: original.creadoEn, rutaFisica: original.rutaFisica } : w;
          });
          
          setInventarioWidgets([...actualizados, ...nuevosWidgets]);
        }
      }
    } catch (err) {
      console.warn("Error cargando configuración persistida:", err);
    }
  }, [negocio]);

  // Guardar dinámicamente ante cualquier cambio de estado
  useEffect(() => {
    try {
      localStorage.setItem(KEY_PANELES, JSON.stringify(panelesSidebar));
    } catch (e) {}
  }, [panelesSidebar, negocio]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_PERFILES, JSON.stringify(perfiles));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
      }
    } catch (e) {}
  }, [perfiles, negocio]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_INVENTARIO, JSON.stringify(inventarioWidgets));
    } catch (e) {}
  }, [inventarioWidgets, negocio]);

  // Estado Drag & Drop HTML5 (Reorganización Gráfica para Web Desktop)
  const [widgetArrastrado, setWidgetArrastrado] = useState<{ widgetClave: string; panelOrigenId: string } | null>(null);
  const [panelOverId, setPanelOverId] = useState<string | null>(null);

  const handleDropWidget = (widgetClave: string, panelOrigenId: string, panelDestinoId: string) => {
    if (panelOrigenId === panelDestinoId) return;

    if (panelOrigenId === "DISPONIBLES") {
      agregarWidgetAPanel(perfilSeleccionado, widgetClave, panelDestinoId);
      return;
    }

    const wObj = inventarioWidgets.find(w => w.clave === widgetClave);
    if (!wObj) return;

    setWidgetTransferir({ widget: wObj, panelOrigenId });
    setPanelDestinoId(panelDestinoId);
    setAccionTransferir("mover");
  };

  // Modal Crear y Editar Panel
  const [mostrarModalPanel, setMostrarModalPanel] = useState(false);
  const [panelEditarModal, setPanelEditarModal] = useState<PanelSidebarDef | null>(null);
  const [nuevoPanel, setNuevoPanel] = useState({
    nombre: "",
    ruta: "/panel/",
    descripcion: "",
    icono: "Wrench",
    requiereMfa: false,
    mostrarSinWidgets: true
  });

  const toggleMfaPanel = (panelId: string) => {
    setPanelesSidebar(panelesSidebar.map(p => {
      if (p.id === panelId) {
        const nuevoEstado = !p.requiereMfa;
        setMensajeExito(`Autenticación MFA (TOTP) ${nuevoEstado ? "ACTIVADA" : "DESACTIVADA"} para el panel '${p.nombre}'.`);
        setTimeout(() => setMensajeExito(null), 3500);
        return { ...p, requiereMfa: nuevoEstado };
      }
      return p;
    }));
  };

  const handleGuardarPanel = () => {
    if (!nuevoPanel.nombre.trim()) return;
    const slug = nuevoPanel.nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const panelId = `panel_${slug}`;
    let rutaFormateada = nuevoPanel.ruta.startsWith("/") ? nuevoPanel.ruta : `/${nuevoPanel.ruta}`;
    if (rutaFormateada === "/panel/" || rutaFormateada === "/panel") {
      rutaFormateada = `/panel/${slug}`;
    }

    const creado: PanelSidebarDef = {
      id: panelId,
      nombre: nuevoPanel.nombre,
      ruta: rutaFormateada,
      descripcion: nuevoPanel.descripcion || `Panel personalizado ${nuevoPanel.nombre}`,
      requiereMfa: nuevoPanel.requiereMfa,
      esPersonalizado: true
    };

    setPanelesSidebar([...panelesSidebar, creado]);

    // Asignar por defecto a ADMINISTRADOR y SUPERADMIN
    setPerfiles(perfiles.map(p => {
      if (p.clave === "ADMINISTRADOR" || p.clave === "SUPERADMIN") {
        return {
          ...p,
          panelesAsignados: [...p.panelesAsignados, panelId],
          widgetsAsignadosPorPanel: {
            ...p.widgetsAsignadosPorPanel,
            [panelId]: []
          }
        };
      }
      return p;
    }));

    setMostrarModalPanel(false);
    setNuevoPanel({ nombre: "", ruta: "/panel/", descripcion: "", icono: "Wrench", requiereMfa: false, mostrarSinWidgets: true });
    setMensajeExito(`Panel '${nuevoPanel.nombre}' creado exitosamente.`);
    setTimeout(() => setMensajeExito(null), 3000);
  };

  // Perfil seleccionado en pestaña 2 (Widgets por Panel & Perfil)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("CLIENTE");

  // Widget para previsualizar en Modal Flotante En Vivo
  const [widgetPrevisualizar, setWidgetPrevisualizar] = useState<WidgetInventarioDef | null>(null);

  // Panel seleccionado para abrir modal "+ Agregar Widget a este Panel"
  const [panelAgregarWidget, setPanelAgregarWidget] = useState<PanelSidebarDef | null>(null);
  const [busquedaWidgetAgregar, setBusquedaWidgetAgregar] = useState<string>("");

  // Modal de Reorganización / Transferencia entre Paneles (Mover vs Duplicar)
  const [widgetTransferir, setWidgetTransferir] = useState<{
    widget: WidgetInventarioDef;
    panelOrigenId: string;
  } | null>(null);
  const [panelDestinoId, setPanelDestinoId] = useState<string>("");
  const [accionTransferir, setAccionTransferir] = useState<"mover" | "duplicar">("mover");

  // Tema del perfil activo seleccionado
  const temaPerfilActivo = TEMAS_PERFIL[perfilSeleccionado] || TEMA_POR_DEFECTO;

  // Reordenar posición interna de un widget dentro de un panel (Izquierda / Derecha)
  const reordenarWidgetEnPanel = (
    perfilClave: string,
    panelId: string,
    widgetClave: string,
    direccion: "izquierda" | "derecha"
  ) => {
    const perfil = perfiles.find(p => p.clave === perfilClave);
    if (!perfil) return;

    const asignados = Array.from(new Set(perfil.widgetsAsignadosPorPanel[panelId] || []));
    const idx = asignados.indexOf(widgetClave);
    if (idx === -1) return;

    const targetIdx = direccion === "izquierda" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= asignados.length) return;

    const reordenados = [...asignados];
    const elemActual = reordenados[idx];
    const elemDestino = reordenados[targetIdx];
    if (elemActual && elemDestino) {
      reordenados[idx] = elemDestino;
      reordenados[targetIdx] = elemActual;
    }

    const mapaActualizado = {
      ...perfil.widgetsAsignadosPorPanel,
      [panelId]: reordenados
    };

    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, widgetsAsignadosPorPanel: mapaActualizado } : p));
  };

  // Ejecutar Transferencia (Mover o Duplicar entre Paneles)
  const handleEjecutarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!widgetTransferir || !panelDestinoId) return;

    const { widget, panelOrigenId } = widgetTransferir;
    const perfilClave = perfilSeleccionado;
    const perfil = perfiles.find(p => p.clave === perfilClave);
    if (!perfil) return;

    const origenList = Array.from(new Set(perfil.widgetsAsignadosPorPanel[panelOrigenId] || []));
    const destinoList = Array.from(new Set(perfil.widgetsAsignadosPorPanel[panelDestinoId] || []));

    let nuevoOrigenList = origenList;
    if (accionTransferir === "mover") {
      nuevoOrigenList = origenList.filter(w => w !== widget.clave);
      await guardarAsignacionWidget(perfilClave, widget.clave, negocio, false, panelOrigenId);
    }

    let nuevoDestinoList = destinoList;
    if (!destinoList.includes(widget.clave)) {
      nuevoDestinoList = [...destinoList, widget.clave];
      await guardarAsignacionWidget(perfilClave, widget.clave, negocio, true, panelDestinoId);
    }

    const mapaActualizado = {
      ...perfil.widgetsAsignadosPorPanel,
      [panelOrigenId]: nuevoOrigenList,
      [panelDestinoId]: nuevoDestinoList,
    };

    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, widgetsAsignadosPorPanel: mapaActualizado } : p));

    const nombreOrigen = panelesSidebar.find(p => p.id === panelOrigenId)?.nombre || panelOrigenId;
    const nombreDestino = panelesSidebar.find(p => p.id === panelDestinoId)?.nombre || panelDestinoId;

    setMensajeExito(
      `Widget '${widget.nombre}' ${accionTransferir === "mover" ? "MOVIDO" : "DUPLICADO"} de '${nombreOrigen}' a '${nombreDestino}'.`
    );
    setTimeout(() => setMensajeExito(null), 4000);
    setWidgetTransferir(null);
  };

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [perfilDetalle, setPerfilDetalle] = useState<string | null>(null);

  // Modales
  const [mostrarModalPerfil, setMostrarModalPerfil] = useState(false);
  const [mostrarModalWidget, setMostrarModalWidget] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Formulario Perfil
  const [nuevoPerfil, setNuevoPerfil] = useState({
    clave: "",
    nombre: "",
    nivel: 50,
    ambito: "Empresa",
    descripcion: ""
  });

  // Formulario Widget
  const [nuevoWidget, setNuevoWidget] = useState({
    clave: "",
    nombre: "",
    descripcion: "",
    categoria: "General",
    ruta: "/panel/",
    panelId: "panel_configuracion"
  });

  const [nuevoWidgetPerfiles, setNuevoWidgetPerfiles] = useState<string[]>(["ADMINISTRADOR", "SUPERADMIN"]);

  // Alternar asignación de Panel al Sidebar de un Perfil
  const togglePanelPerfil = (perfilClave: string, panelId: string) => {
    const perfil = perfiles.find(p => p.clave === perfilClave);
    if (!perfil) return;

    const asignado = perfil.panelesAsignados.includes(panelId);
    const nuevosPaneles = asignado
      ? perfil.panelesAsignados.filter(id => id !== panelId)
      : [...perfil.panelesAsignados, panelId];

    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, panelesAsignados: nuevosPaneles } : p));
    setMensajeExito(`Panel '${panelId}' ${asignado ? "retirado de" : "asignado a"} la navegación del perfil '${perfilClave}'.`);
    setTimeout(() => setMensajeExito(null), 3000);
  };

  // AGREGAR WIDGET A UN PANEL ESPECÍFICO DE UN PERFIL
  const agregarWidgetAPanel = async (perfilClave: string, widgetClave: string, panelId: string) => {
    const perfil = perfiles.find(p => p.clave === perfilClave);
    if (!perfil) return;

    const asignadosPanel = perfil.widgetsAsignadosPorPanel[panelId] || [];
    if (asignadosPanel.includes(widgetClave)) return;

    const nuevosAsignados = [...asignadosPanel, widgetClave];
    const mapaActualizado = {
      ...perfil.widgetsAsignadosPorPanel,
      [panelId]: nuevosAsignados
    };

    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, widgetsAsignadosPorPanel: mapaActualizado } : p));

    await guardarAsignacionWidget(perfilClave, widgetClave, negocio, true, panelId);

    const nombrePanel = panelesSidebar.find(p => p.id === panelId)?.nombre || panelId;
    setMensajeExito(`Widget '${widgetClave}' asignado exitosamente a '${nombrePanel}' para '${perfilClave}'.`);
    setTimeout(() => setMensajeExito(null), 3500);
  };

  // RETIRAR WIDGET DE UN PANEL ESPECÍFICO DE UN PERFIL
  const retirarWidgetDePanel = async (perfilClave: string, widgetClave: string, panelId: string) => {
    const perfil = perfiles.find(p => p.clave === perfilClave);
    if (!perfil) return;

    const asignadosPanel = perfil.widgetsAsignadosPorPanel[panelId] || [];
    const nuevosAsignados = asignadosPanel.filter(w => w !== widgetClave);
    const mapaActualizado = {
      ...perfil.widgetsAsignadosPorPanel,
      [panelId]: nuevosAsignados
    };

    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, widgetsAsignadosPorPanel: mapaActualizado } : p));

    await guardarAsignacionWidget(perfilClave, widgetClave, negocio, false, panelId);

    const nombrePanel = panelesSidebar.find(p => p.id === panelId)?.nombre || panelId;
    setMensajeExito(`Widget '${widgetClave}' retirado de '${nombrePanel}' para '${perfilClave}'.`);
    setTimeout(() => setMensajeExito(null), 3500);
  };

  // Guardar nuevo Perfil
  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoPerfil.clave.trim() || !nuevoPerfil.nombre.trim()) return;

    const claveUpper = nuevoPerfil.clave.toUpperCase().trim();
    const perfilNuevoDef: PerfilDef = {
      clave: claveUpper,
      nombre: nuevoPerfil.nombre.trim(),
      nivel: Number(nuevoPerfil.nivel),
      ambito: nuevoPerfil.ambito,
      descripcion: nuevoPerfil.descripcion.trim(),
      panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_configuracion"],
      widgetsAsignadosPorPanel: {
        panel_inicio: ["favoritos"],
        panel_cuenta: ["ver_como", "mi_cuenta"],
        panel_configuracion: ["notificaciones"]
      },
      activo: true
    };

    setPerfiles([...perfiles, perfilNuevoDef]);
    setMostrarModalPerfil(false);
    setNuevoPerfil({ clave: "", nombre: "", nivel: 50, ambito: "Empresa", descripcion: "" });

    await guardarPerfil({
      clave: claveUpper,
      nombre: perfilNuevoDef.nombre,
      nivel: perfilNuevoDef.nivel,
      ambito: perfilNuevoDef.ambito,
      descripcion: perfilNuevoDef.descripcion,
      activo: true
    });

    setMensajeExito(`Perfil '${claveUpper}' creado exitosamente.`);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  // Guardar nuevo Widget
  const handleGuardarWidget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoWidget.clave.trim() || !nuevoWidget.nombre.trim()) return;

    const claveLower = nuevoWidget.clave.toLowerCase().trim();
    const widgetNuevoDef: WidgetInventarioDef = {
      clave: claveLower,
      nombre: nuevoWidget.nombre.trim(),
      descripcion: nuevoWidget.descripcion.trim(),
      categoria: nuevoWidget.categoria,
      ruta: nuevoWidget.ruta.trim(),
      panelId: nuevoWidget.panelId,
      activo: true
    };

    setInventarioWidgets([...inventarioWidgets, widgetNuevoDef]);

    setPerfiles(perfiles.map(p => {
      if (nuevoWidgetPerfiles.includes(p.clave)) {
        const prevList = p.widgetsAsignadosPorPanel[nuevoWidget.panelId] || [];
        return {
          ...p,
          widgetsAsignadosPorPanel: {
            ...p.widgetsAsignadosPorPanel,
            [nuevoWidget.panelId]: [...prevList, claveLower]
          }
        };
      }
      return p;
    }));

    setMostrarModalWidget(false);
    setNuevoWidget({ clave: "", nombre: "", descripcion: "", categoria: "General", ruta: "/panel/", panelId: "panel_configuracion" });

    await guardarWidget({
      clave: claveLower,
      nombre: widgetNuevoDef.nombre,
      descripcion: widgetNuevoDef.descripcion,
      categoria: widgetNuevoDef.categoria,
      ruta: widgetNuevoDef.ruta,
      negocio
    });

    for (const perfClave of nuevoWidgetPerfiles) {
      await guardarAsignacionWidget(perfClave, claveLower, negocio, true, nuevoWidget.panelId);
    }

    setMensajeExito(`Widget '${claveLower}' registrado en el inventario.`);
    setTimeout(() => setMensajeExito(null), 4000);
  };

  const togglePerfilNuevoWidget = (clave: string) => {
    if (nuevoWidgetPerfiles.includes(clave)) {
      setNuevoWidgetPerfiles(nuevoWidgetPerfiles.filter(c => c !== clave));
    } else {
      setNuevoWidgetPerfiles([...nuevoWidgetPerfiles, clave]);
    }
  };

  const perfilActualObj = perfiles.find(p => p.clave === perfilSeleccionado);

  const perfilesFiltrados = perfiles.filter(p => {
    return p.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) ||
           p.clave.toLowerCase().includes(filtroTexto.toLowerCase()) ||
           p.descripcion.toLowerCase().includes(filtroTexto.toLowerCase());
  });

  return (
    <div style={{ width: "100%", color: "var(--negro, #111111)" }}>
      {/* Notificación de Éxito Flotante */}
      {mensajeExito && (
        <div
          style={{
            background: "#05876e",
            color: "#ffffff",
            padding: "10px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeIn 0.2s ease"
          }}
        >
          <CheckCircle2 size={18} /> {mensajeExito}
        </div>
      )}

      {/* Banner de Arquitectura de Gobernanza */}
      <div
        style={{
          background: "var(--panel-papel, #F7F6FA)",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "20px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Sliders size={20} color="var(--violeta, #5000BA)" />
          <h3 style={{ fontSize: "0.98rem", fontWeight: 800, margin: 0 }}>
            Arquitectura de Gobernanza: Perfil Paneles (Sidebar) Widgets
          </h3>
        </div>
        <div style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
          <span style={{ padding: "3px 10px", borderRadius: "6px", background: "#ffffff", border: "1px solid var(--panel-linea, #E4E4E4)", fontWeight: 700, color: "#111" }}>
            1. Perfil / Rol
          </span>
          <ArrowRight size={14} />
          <span style={{ padding: "3px 10px", borderRadius: "6px", background: "#ffffff", border: "1px solid var(--panel-linea, #E4E4E4)", fontWeight: 700, color: "var(--violeta, #5000BA)" }}>
            2. Paneles Asignados al Sidebar
          </span>
          <ArrowRight size={14} />
          <span style={{ padding: "3px 10px", borderRadius: "6px", background: "#ffffff", border: "1px solid var(--panel-linea, #E4E4E4)", fontWeight: 700, color: "#05876e" }}>
            3. Widgets Contenidos por Panel
          </span>
        </div>
      </div>

      {/* Tabs Principales de Gobernanza */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
          marginBottom: "20px",
          flexWrap: "wrap"
        }}
      >
        <button
          type="button"
          onClick={() => setTabActiva("matriz_widgets")}
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: tabActiva === "matriz_widgets" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            color: tabActiva === "matriz_widgets" ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
            fontWeight: tabActiva === "matriz_widgets" ? 800 : 600,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Layers size={18} /> 2. Módulos por Panel & Perfil
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("matriz_paneles")}
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: tabActiva === "matriz_paneles" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            color: tabActiva === "matriz_paneles" ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
            fontWeight: tabActiva === "matriz_paneles" ? 800 : 600,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <PanelLeft size={18} /> 1. Matriz Perfil Paneles (Sidebar)
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("inventario_widgets")}
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: tabActiva === "inventario_widgets" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            color: tabActiva === "inventario_widgets" ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
            fontWeight: tabActiva === "inventario_widgets" ? 800 : 600,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <LayoutGrid size={18} /> Catálogo de Módulos ({inventarioWidgets.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("perfiles")}
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: tabActiva === "perfiles" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            color: tabActiva === "perfiles" ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
            fontWeight: tabActiva === "perfiles" ? 800 : 600,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Users size={18} /> Catálogo de Perfiles ({perfiles.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setTabActiva("reporte_gobernanza");
            cargarUsuariosParaReporte();
          }}
          style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: tabActiva === "reporte_gobernanza" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            color: tabActiva === "reporte_gobernanza" ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
            fontWeight: tabActiva === "reporte_gobernanza" ? 800 : 600,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <FileText size={18} /> Reporte Integral de Gobernanza
        </button>
      </div>

      {/* TAB 2: ASIGNACIÓN DE WIDGETS POR PANEL & PERFIL (100% CORREGIDO POR PANEL ESPECÍFICO) */}
      {tabActiva === "matriz_widgets" && (
        <div>
          {/* BANNER DINÁMICO DE TEMATIZACIÓN SEGÚN EL PERFIL SELECCIONADO */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              background: temaPerfilActivo.colorFondoSuave,
              padding: "16px 20px",
              borderRadius: "14px",
              border: `2px solid ${temaPerfilActivo.colorBorde}`,
              boxShadow: `0 4px 12px ${temaPerfilActivo.colorPrimario}15`,
              transition: "all 0.25s ease"
            }}
          >
            <div style={{ minWidth: "300px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <Palette size={18} color={temaPerfilActivo.colorPrimario} />
                <label style={{ fontSize: "0.82rem", fontWeight: 800, color: temaPerfilActivo.colorTexto, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Perfil / Rol Activo a Configurar:
                </label>
              </div>

              <select
                value={perfilSeleccionado}
                onChange={e => setPerfilSeleccionado(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `2px solid ${temaPerfilActivo.colorBorde}`,
                  fontWeight: 800,
                  fontSize: "0.92rem",
                  background: "#ffffff",
                  color: temaPerfilActivo.colorTexto,
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                }}
              >
                {perfiles.map(p => {
                  const t = TEMAS_PERFIL[p.clave] || TEMA_POR_DEFECTO;
                  return (
                    <option key={p.clave} value={p.clave} style={{ color: t.colorTexto, fontWeight: 700 }}>
                      {p.nombre} (Nivel {p.nivel})
                    </option>
                  );
                })}
              </select>
            </div>

        <div style={{ flex: 1, minWidth: "240px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: temaPerfilActivo.badgeBg, color: temaPerfilActivo.badgeTexto, padding: "4px 12px", borderRadius: "999px", fontWeight: 800, fontSize: "0.78rem", marginBottom: "6px" }}>
                <UserCheck size={14} /> MODO CONFIGURACIÓN: {perfilActualObj?.nombre.toUpperCase()} (NIVEL {perfilActualObj?.nivel})
              </div>
              <p style={{ fontSize: "0.82rem", color: temaPerfilActivo.colorTexto, margin: 0, lineHeight: 1.4, opacity: 0.9 }}>
                Mostrando únicamente los widgets asignados para <strong>{perfilActualObj?.nombre}</strong>. En el tablero principal, <strong>Favoritos</strong> se ubica siempre en <strong>Posición #1</strong>.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 2px 0" }}>Paneles & Módulos Operativos</h4>
              <p style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", margin: 0 }}>
                Administra los módulos de cada panel y configura la exigencia opcional de MFA (TOTP).
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={sincronizarCatalogoMaestro}
                title="Sincroniza todos los widgets y perfiles registrados en el código con el inventario del navegador"
                style={{
                  background: "#F5F3FF",
                  color: "var(--violeta, #5000BA)",
                  border: "1px solid #DDD6FE",
                  borderRadius: "8px",
                  padding: "9px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
              >
                <RotateCcw size={15} /> Sincronizar Catálogo Maestro
              </button>

              <button
                type="button"
                onClick={() => setMostrarModalPanel(true)}
                style={{
                  background: "var(--violeta, #5000BA)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px 16px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Plus size={16} /> + Crear Nuevo Panel
              </button>
            </div>
          </div>

          {/* LISTADO LIMPIO DE PANELES CON SUS WIDGETS AUTORIZADOS POR PANEL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {panelesSidebar.map(panel => {
              // Obtener la lista de claves asignadas a este panel específico para este perfil (DESDUPLICADAS)
              const clavesAsignadasBrutas = perfilActualObj?.widgetsAsignadosPorPanel[panel.id] || [];
              const clavesAsignadasPanel = Array.from(new Set(clavesAsignadasBrutas));

              // Mapear exactamente en el orden personalizado registrado en el perfil
              const widgetsOrdenados: WidgetInventarioDef[] = [];
              clavesAsignadasPanel.forEach(clave => {
                const def = inventarioWidgets.find(w => w.clave === clave);
                if (def && !widgetsOrdenados.some(w => w.clave === clave)) {
                  widgetsOrdenados.push(def);
                }
              });

              // Si es el panel de inicio y contiene "favoritos", mantener "favoritos" en Posición #1
              if (panel.id === "panel_inicio" && widgetsOrdenados.some(w => w.clave === "favoritos")) {
                const favIdx = widgetsOrdenados.findIndex(w => w.clave === "favoritos");
                if (favIdx > 0) {
                  const [fav] = widgetsOrdenados.splice(favIdx, 1);
                  if (fav) widgetsOrdenados.unshift(fav);
                }
              }

              const esDestinoDropOver = panelOverId === panel.id && widgetArrastrado?.panelOrigenId !== panel.id;

              return (
                <div
                  key={panel.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (widgetArrastrado && widgetArrastrado.panelOrigenId !== panel.id) {
                      setPanelOverId(panel.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (panelOverId === panel.id) setPanelOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    try {
                      const raw = e.dataTransfer.getData("text/plain");
                      if (raw) {
                        const parsed = JSON.parse(raw);
                        handleDropWidget(parsed.widgetClave, parsed.panelOrigenId, panel.id);
                      }
                    } catch (err) {}
                    setPanelOverId(null);
                    setWidgetArrastrado(null);
                  }}
                  style={{
                    border: esDestinoDropOver
                      ? "2.5px dashed var(--violeta, #5000BA)"
                      : `1.5px solid ${temaPerfilActivo.colorBorde}44`,
                    borderRadius: "14px",
                    padding: "16px",
                    background: esDestinoDropOver ? "#F5F3FF" : "#ffffff",
                    transition: "all 0.2s ease",
                    position: "relative"
                  }}
                >
                  {esDestinoDropOver && (
                    <div style={{ position: "absolute", top: "12px", right: "140px", background: "var(--violeta, #5000BA)", color: "#ffffff", padding: "4px 12px", borderRadius: "999px", fontSize: "0.74rem", fontWeight: 800, zIndex: 10, display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(80,0,186,0.2)" }}>
                      <Move size={14} /> Soltar aquí para transferir a {panel.nombre}
                    </div>
                  )}

                  {/* ENCABEZADO DEL PANEL CON CONMUTADOR MFA, CONFIGURAR ÍCONO Y BOTÓN "+ AGREGAR WIDGET" */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div
                      onClick={() => setPanelEditarModal(panel)}
                      style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                      title="Haz clic para seleccionar el ícono del sidebar o editar la ruta/nombre del panel"
                    >
                      <span
                        style={{
                          background: "rgba(80, 0, 186, 0.12)",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid rgba(80, 0, 186, 0.25)"
                        }}
                      >
                        <IconoPanelDinamico nombreIcono={panel.icono} size={20} color={temaPerfilActivo.colorPrimario} />
                      </span>
                      <div>
                        <strong style={{ fontSize: "0.95rem", color: "#111111", display: "block" }}>{panel.nombre}</strong>
                        <code style={{ fontSize: "0.72rem", color: "var(--panel-gris, #737373)" }}>{panel.ruta}</code>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPanelEditarModal(panel);
                        }}
                        style={{
                          background: "#ffffff",
                          border: "1px solid var(--violeta, #5000BA)",
                          color: "var(--violeta, #5000BA)",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <Pencil size={12} /> <span>Ícono</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setPanelEditarModal(panel)}
                        title={`Configurar ícono de sidebar (${panel.icono || "PanelLeft"}) y visibilidad del panel`}
                        style={{
                          background: "rgba(80, 0, 186, 0.08)",
                          color: "var(--violeta, #5000BA)",
                          border: "1px solid rgba(80, 0, 186, 0.25)",
                          borderRadius: "8px",
                          padding: "5px 10px",
                          fontSize: "0.74rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        <IconoPanelDinamico nombreIcono={panel.icono} size={14} color="var(--violeta, #5000BA)" />
                        <span>Ícono & Visibilidad</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleMfaPanel(panel.id)}
                        title={panel.requiereMfa ? "MFA (TOTP) Requerido. Haz clic para cambiar a opcional" : "MFA (TOTP) Opcional. Haz clic para requerir MFA"}
                        style={{
                          background: panel.requiereMfa ? "rgba(220, 38, 38, 0.12)" : "var(--panel-linea-suave, #FAFAF9)",
                          color: panel.requiereMfa ? "#DC2626" : "var(--panel-gris, #737373)",
                          border: panel.requiereMfa ? "1.5px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--panel-linea, #E4E4E4)",
                          borderRadius: "999px",
                          padding: "4px 10px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {panel.requiereMfa ? "MFA Requerido" : "MFA Opcional"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPanelAgregarWidget(panel);
                          setBusquedaWidgetAgregar("");
                        }}
                        style={{
                          background: temaPerfilActivo.colorPrimario,
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "6px 14px",
                          fontSize: "0.78rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          boxShadow: `0 2px 6px ${temaPerfilActivo.colorPrimario}33`
                        }}
                      >
                        <Plus size={15} /> <span className="txt-btn-movil">Agregar</span>
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", margin: "0 0 14px 0" }}>{panel.descripcion}</p>

                  {/* REJILLA DE ELEMENTOS ASIGNADOS CON POSICIONADO Y ORDENAMIENTO GARANTIZADO */}
                  {widgetsOrdenados.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "12px" }}>
                      {widgetsOrdenados.map((w, idx) => {
                        const esFavoritos = w.clave === "favoritos";
                        const esArrastrando = widgetArrastrado?.widgetClave === w.clave;

                        return (
                          <div
                            key={w.clave}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", JSON.stringify({ widgetClave: w.clave, panelOrigenId: panel.id }));
                              setWidgetArrastrado({ widgetClave: w.clave, panelOrigenId: panel.id });
                            }}
                            onDragEnd={() => {
                              setWidgetArrastrado(null);
                              setPanelOverId(null);
                            }}
                            style={{
                              background: esFavoritos ? `${temaPerfilActivo.colorFondoSuave}` : "#ffffff",
                              padding: "12px 14px",
                              borderRadius: "10px",
                              border: esArrastrando
                                ? "2px dashed var(--violeta, #5000BA)"
                                : esFavoritos
                                ? `2px solid ${temaPerfilActivo.colorBorde}`
                                : "1.5px solid var(--panel-linea, #E4E4E4)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              cursor: "grab",
                              opacity: esArrastrando ? 0.45 : 1,
                              transform: esArrastrando ? "scale(0.98)" : "none",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <div style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: "6px" }}>
                              <span title="Arrastrar para mover entre paneles" style={{ display: "inline-flex", cursor: "grab" }}>
                                <GripVertical size={16} color="var(--panel-gris, #737373)" style={{ marginTop: "2px", opacity: 0.6, flexShrink: 0 }} />
                              </span>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: "0.85rem", color: temaPerfilActivo.colorTexto, display: "flex", alignItems: "center", gap: "6px" }}>
                                  {esFavoritos && <Star size={14} fill={temaPerfilActivo.colorPrimario} color={temaPerfilActivo.colorPrimario} />}
                                  {w.nombre}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: temaPerfilActivo.colorPrimario, fontWeight: 700, opacity: 0.85, marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span>Posición #{idx + 1} • {w.clave}</span>
                                  <code style={{ fontSize: "0.66rem", color: "var(--panel-gris, #737373)", background: "rgba(0,0,0,0.05)", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                    {w.rutaFisica || `/plataforma/${w.clave}.tsx`}
                                  </code>
                                </div>
                              </div>
                            </div>

                             <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              {/* Reordenamiento Interno: Mover a la Izquierda / Subir Posición */}
                              <button
                                type="button"
                                title="Subir posición / Mover a la izquierda"
                                disabled={idx === 0}
                                onClick={() => reordenarWidgetEnPanel(perfilSeleccionado, panel.id, w.clave, "izquierda")}
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid var(--panel-linea, #E4E4E4)",
                                  borderRadius: "6px",
                                  padding: "5px 7px",
                                  cursor: idx === 0 ? "not-allowed" : "pointer",
                                  opacity: idx === 0 ? 0.3 : 1,
                                  color: "var(--negro, #111111)",
                                  display: "flex",
                                  alignItems: "center"
                                }}
                              >
                                <ArrowLeft size={13} />
                              </button>

                              {/* Reordenamiento Interno: Mover a la Derecha / Bajar Posición */}
                              <button
                                type="button"
                                title="Bajar posición / Mover a la derecha"
                                disabled={idx === widgetsOrdenados.length - 1}
                                onClick={() => reordenarWidgetEnPanel(perfilSeleccionado, panel.id, w.clave, "derecha")}
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid var(--panel-linea, #E4E4E4)",
                                  borderRadius: "6px",
                                  padding: "5px 7px",
                                  cursor: idx === widgetsOrdenados.length - 1 ? "not-allowed" : "pointer",
                                  opacity: idx === widgetsOrdenados.length - 1 ? 0.3 : 1,
                                  color: "var(--negro, #111111)",
                                  display: "flex",
                                  alignItems: "center"
                                }}
                              >
                                <ArrowRight size={13} />
                              </button>

                              {/* Modal Reorganizar: Mover o Duplicar a otro Panel */}
                              <button
                                type="button"
                                title="Reorganizar: Mover o duplicar este widget a otro panel"
                                onClick={() => {
                                  setWidgetTransferir({ widget: w, panelOrigenId: panel.id });
                                  const primerDestino = panelesSidebar.find(p => p.id !== panel.id)?.id || "";
                                  setPanelDestinoId(primerDestino);
                                  setAccionTransferir("mover");
                                }}
                                style={{
                                  background: "#F3E8FF",
                                  border: "1px solid #DDD6FE",
                                  color: "#5000BA",
                                  borderRadius: "6px",
                                  padding: "5px 7px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center"
                                }}
                              >
                                <Move size={14} />
                              </button>

                              {/* Retirar de este Panel */}
                              <button
                                type="button"
                                title="Retirar de este panel"
                                onClick={() => retirarWidgetDePanel(perfilSeleccionado, w.clave, panel.id)}
                                style={{
                                  background: "#ffffff",
                                  border: `1px solid ${temaPerfilActivo.colorBorde}66`,
                                  color: "#DC2626",
                                  borderRadius: "6px",
                                  padding: "5px 8px",
                                  cursor: "pointer",
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "3px"
                                }}
                              >
                                <Trash2 size={13} /> <span className="txt-btn-movil">Retirar</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "16px",
                        borderRadius: "10px",
                        background: "var(--panel-papel, #F7F6FA)",
                        border: "1px dashed var(--panel-linea, #E4E4E4)",
                        textAlign: "center",
                        fontSize: "0.8rem",
                        color: "var(--panel-gris, #737373)"
                      }}
                    >
                      No hay widgets asignados a este panel para <strong>{perfilActualObj?.nombre}</strong>. Haz clic en el botón <strong>+ Agregar Widget</strong> para vincular uno.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SECCIÓN 3: BLOQUE DESTACADO DE WIDGETS DISPONIBLES SIN ASIGNAR */}
          {(() => {
            const todasLasClavesAsignadas = new Set(
              Object.values(perfilActualObj?.widgetsAsignadosPorPanel || {}).flat()
            );
            const widgetsDisponiblesSinAsignar = inventarioWidgets.filter(
              w => !todasLasClavesAsignadas.has(w.clave)
            );

            // Ordenamiento dinámico
            const widgetsOrdenados = [...widgetsDisponiblesSinAsignar].sort((a, b) => {
              if (criterioOrden === "fecha") {
                const dateA = a.creadoEn ? new Date(a.creadoEn).getTime() : 0;
                const dateB = b.creadoEn ? new Date(b.creadoEn).getTime() : 0;
                return dateB - dateA; // Más nuevos primero
              }
              if (criterioOrden === "nombre") {
                return a.nombre.localeCompare(b.nombre);
              }
              if (criterioOrden === "directorio") {
                const pathA = a.rutaFisica || "";
                const pathB = b.rutaFisica || "";
                return pathA.localeCompare(pathB);
              }
              return 0;
            });

            const esCreadoHoy = (fechaStr?: string) => {
              if (!fechaStr) return false;
              try {
                const hoy = new Date().toISOString().split("T")[0]; // "2026-08-13"
                const creado = new Date(fechaStr).toISOString().split("T")[0];
                return hoy === creado;
              } catch {
                return false;
              }
            };

            return (
              <div
                style={{
                  marginTop: "24px",
                  background: "#F7F6FA",
                  borderRadius: "14px",
                  border: "1.5px dashed #E4E4E4",
                  padding: "18px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 2px 0", color: "#111111", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Package size={18} color="#5000BA" /> Widgets Disponibles Sin Asignar
                    </h4>
                    <p style={{ fontSize: "0.78rem", color: "#737373", margin: 0 }}>
                      Widgets del inventario que no están vinculados a ningún panel para el perfil <strong>{perfilActualObj?.nombre}</strong>.
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "0.75rem", color: "#737373", fontWeight: 600 }}>Ordenar por:</span>
                      <select
                        value={criterioOrden}
                        onChange={(e) => setCriterioOrden(e.target.value as any)}
                        style={{
                          fontSize: "0.75rem",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid #D1D5DB",
                          background: "#FFF",
                          outline: "none",
                          fontWeight: 600,
                          color: "#374151",
                          cursor: "pointer"
                        }}
                      >
                        <option value="fecha">Fecha de Registro</option>
                        <option value="nombre">Nombre</option>
                        <option value="directorio">Directorio Real</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={sincronizarCatalogoMaestro}
                      title="Sincronizar inventario con el catálogo maestro de código"
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        background: "#ffffff",
                        color: "#5000BA",
                        border: "1px solid #DDD6FE",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <RotateCcw size={12} /> Sincronizar
                    </button>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, background: "#F3E8FF", color: "#5000BA", padding: "4px 12px", borderRadius: "999px" }}>
                      {widgetsDisponiblesSinAsignar.length} Disponibles
                    </span>
                  </div>
                </div>

                {widgetsOrdenados.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "12px" }}>
                    {widgetsOrdenados.map(w => {
                      const esArrastrando = widgetArrastrado?.widgetClave === w.clave;
                      const nuevo = esCreadoHoy(w.creadoEn);

                      return (
                        <div
                          key={w.clave}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", JSON.stringify({ widgetClave: w.clave, panelOrigenId: "DISPONIBLES" }));
                            setWidgetArrastrado({ widgetClave: w.clave, panelOrigenId: "DISPONIBLES" });
                          }}
                          onDragEnd={() => {
                            setWidgetArrastrado(null);
                            setPanelOverId(null);
                          }}
                          style={{
                            background: "#FFFFFF",
                            borderRadius: "10px",
                            border: esArrastrando ? "2px dashed #5000BA" : "1px solid #E4E4E4",
                            padding: "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                            cursor: "grab",
                            opacity: esArrastrando ? 0.45 : 1,
                            transform: esArrastrando ? "scale(0.98)" : "none",
                            transition: "all 0.15s ease",
                            position: "relative"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                            <span title="Arrastrar a cualquier panel para asignar" style={{ display: "inline-flex", cursor: "grab" }}>
                              <GripVertical size={16} color="#737373" style={{ marginTop: "2px", opacity: 0.6, flexShrink: 0 }} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <strong style={{ fontSize: "0.85rem", color: "#111111" }}>{w.nombre}</strong>
                                {nuevo && (
                                  <span
                                    style={{
                                      fontSize: "0.58rem",
                                      fontWeight: 800,
                                      background: "linear-gradient(135deg, #10B981, #05876E)",
                                      color: "#FFF",
                                      padding: "1px 6px",
                                      borderRadius: "999px",
                                      letterSpacing: "0.05em",
                                      boxShadow: "0 1px 3px rgba(16,185,129,0.25)"
                                    }}
                                  >
                                    NUEVO
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: "0.75rem", color: "#737373", margin: "2px 0 6px 0", lineHeight: 1.3 }}>{w.descripcion}</p>
                              
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "0.68rem", marginTop: "6px" }}>
                                <code>{w.clave}</code>
                                <span style={{ color: "#737373" }}>• Cat: <strong>{w.categoria}</strong></span>
                                {w.creadoEn && (
                                  <span style={{ color: "#737373" }}>
                                    • Reg: <strong>{new Date(w.creadoEn).toLocaleDateString("es-EC", { timeZone: "UTC" })}</strong>
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "0.68rem", marginTop: "4px" }}>
                                <span style={{ color: "#737373" }}>Dir:</span>
                                <code style={{ background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: "4px", color: "#4B5563", wordBreak: "break-all" }}>
                                  {w.rutaFisica || `/plataforma/${w.clave}.tsx`}
                                </code>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "auto", paddingTop: "8px", borderTop: "1px solid #E4E4E4" }}>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  agregarWidgetAPanel(perfilSeleccionado, w.clave, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: "6px 8px",
                                borderRadius: "6px",
                                border: "1px solid #E4E4E4",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                background: "#FFFFFF"
                              }}
                            >
                              <option value="" disabled>+ Asignar a Panel...</option>
                              {panelesSidebar.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "14px", fontSize: "0.8rem", color: "#05876E", fontWeight: 700 }}>
                    ¡Excelente! Todos los widgets del inventario están asignados a algún panel de navegación para este perfil.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL DE SELECCIÓN CORREGIDO 100%: EVALÚA ASIGNACIÓN ESPECÍFICA POR PANEL */}
      {panelAgregarWidget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "24px", maxWidth: "650px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid var(--panel-linea, #E4E4E4)", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.08rem", fontWeight: 800, margin: 0, color: temaPerfilActivo.colorPrimario, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Plus size={20} /> Vincular Widget a: {panelAgregarWidget.nombre}
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)" }}>
                  Perfil Activo: <strong>{perfilActualObj?.nombre}</strong> (Nivel {perfilActualObj?.nivel})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPanelAgregarWidget(null)}
                style={{ background: "#ffffff", border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* BUSCADOR DENTRO DEL MODAL */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
              <input
                type="text"
                placeholder="Buscar widget disponible por nombre o categoría..."
                value={busquedaWidgetAgregar}
                onChange={e => setBusquedaWidgetAgregar(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "8px",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  fontSize: "0.85rem"
                }}
              />
            </div>

            {/* LISTA DE WIDGETS DISPONIBLES (EVALÚA ÚNICAMENTE ESTE PANEL ESPECÍFICO) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "380px", overflowY: "auto" }}>
              {inventarioWidgets
                .filter(w => w.nombre.toLowerCase().includes(busquedaWidgetAgregar.toLowerCase()) || w.categoria.toLowerCase().includes(busquedaWidgetAgregar.toLowerCase()))
                .map(w => {
                  // CORRECCIÓN CENTRAL: Evalúa si el widget YA está en la lista de asignados DE ESTE PANEL ESPECÍFICO
                  const asignadosPanelActual = perfilActualObj?.widgetsAsignadosPorPanel[panelAgregarWidget.id] || [];
                  const yaAsignadoEnEstePanel = asignadosPanelActual.includes(w.clave);

                  return (
                    <div
                      key={w.clave}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: yaAsignadoEnEstePanel ? "1px solid #A7F3D0" : "1px solid var(--panel-linea, #E4E4E4)",
                        background: yaAsignadoEnEstePanel ? "#ECFDF5" : "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.88rem", color: yaAsignadoEnEstePanel ? "#065F46" : "#111111" }}>
                          {w.nombre}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "var(--panel-gris, #737373)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                          <code>{w.clave}</code> • Categoría: <strong>{w.categoria}</strong> • <code style={{ fontSize: "0.68rem", background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: "4px" }}>{w.rutaFisica || `/plataforma/${w.clave}.tsx`}</code>
                        </div>
                      </div>

                      {yaAsignadoEnEstePanel ? (
                        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#05876E", display: "flex", alignItems: "center", gap: "4px", background: "#ffffff", padding: "4px 10px", borderRadius: "6px", border: "1px solid #A7F3D0" }}>
                          <Check size={14} /> Ya Asignado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            agregarWidgetAPanel(perfilSeleccionado, w.clave, panelAgregarWidget.id);
                            setPanelAgregarWidget(null);
                          }}
                          style={{
                            background: temaPerfilActivo.colorPrimario,
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "0.78rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <Plus size={14} /> Asignar a {panelAgregarWidget.nombre.split(" ")[0]}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPanelAgregarWidget(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--panel-linea, #E4E4E4)", background: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.82rem" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: PASO 1 - MATRIZ PERFIL -> PANELES DEL SIDEBAR */}
      {tabActiva === "matriz_paneles" && (
        <div>
          <div style={{ background: "var(--panel-linea-suave, #FAFAF9)", padding: "14px 18px", borderRadius: "10px", border: "1px solid var(--panel-linea, #E4E4E4)", marginBottom: "20px", fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
            <span style={{ fontWeight: 800, color: "var(--negro, #111111)" }}>Paso 1: Configurar Opciones del Menú Lateral (Sidebar) por Perfil</span>
            <br />
            Marca qué <strong>Paneles / Opciones</strong> aparecerán visibles en el Sidebar izquierdo para cada perfil de usuario.
          </div>

          <div style={{ overflowX: "auto", border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "var(--panel-papel, #F7F6FA)", borderBottom: "1px solid var(--panel-linea, #E4E4E4)" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 800 }}>Perfil / Rol</th>
                  {panelesSidebar.map(p => (
                    <th key={p.id} style={{ textAlign: "center", padding: "12px 8px", fontWeight: 800, minWidth: "120px" }} title={`${p.nombre} (${p.ruta})`}>
                      <div style={{ fontSize: "0.78rem" }}>{p.nombre.split(" ")[0]}</div>
                      <a href={p.ruta} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.65rem", color: "var(--violeta, #5000BA)", textDecoration: "none", fontWeight: 700 }}>
                        {p.ruta} ↗
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perfiles.map(p => {
                  const t = TEMAS_PERFIL[p.clave] || TEMA_POR_DEFECTO;
                  return (
                    <tr key={p.clave} style={{ borderBottom: "1px solid var(--panel-linea, #E4E4E4)" }}>
                      <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                        <span style={{ color: t.colorTexto, fontWeight: 800 }}>{p.nombre}</span>
                        <div style={{ fontSize: "0.7rem", color: "var(--panel-gris, #737373)" }}>Nivel {p.nivel}</div>
                      </td>
                      {panelesSidebar.map(panel => {
                        const asignado = p.panelesAsignados.includes(panel.id);
                        return (
                          <td key={panel.id} style={{ textAlign: "center", padding: "10px" }}>
                            <input
                              type="checkbox"
                              checked={asignado}
                              onChange={() => togglePanelPerfil(p.clave, panel.id)}
                              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: t.colorPrimario }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTARIO COMPLETO DE WIDGETS CON PREVISUALIZACIÓN EN VIVO DE INTERFAZ REAL */}
      {tabActiva === "inventario_widgets" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 4px 0" }}>Inventario Completo de Widgets ({inventarioWidgets.length})</h4>
              <p style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", margin: 0 }}>
                Componentes independientes y desacoplados reutilizables libremente en cualquier panel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMostrarModalWidget(true)}
              style={{
                background: "var(--violeta, #5000BA)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Plus size={16} /> Registrar Nuevo Widget
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {inventarioWidgets.map(w => (
              <div key={w.clave} style={{ border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "12px", padding: "16px", background: "#ffffff", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: "0.95rem", display: "block" }}>{w.nombre}</span>
                    <code style={{ fontSize: "0.72rem", color: "var(--panel-gris, #737373)" }}>{w.clave}</code>
                  </div>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "var(--panel-linea-suave, #FAFAF9)", padding: "2px 8px", borderRadius: "999px", border: "1px solid var(--panel-linea, #E4E4E4)" }}>
                    {w.categoria}
                  </span>
                </div>

                <p style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", margin: "0 0 12px 0", lineHeight: 1.4, flex: 1 }}>
                  {w.descripcion}
                </p>

                {/* BOTÓN PREVISUALIZAR EN VIVO (MODAL FLOTANTE) */}
                <button
                  type="button"
                  onClick={() => setWidgetPrevisualizar(w)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "9px 12px",
                    background: "var(--violeta, #5000BA)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Eye size={16} /> Pre-visualizar Widget Real
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CATÁLOGO DE PERFILES */}
      {tabActiva === "perfiles" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
              <input
                type="text"
                placeholder="Buscar perfil..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "8px",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  fontSize: "0.85rem",
                  background: "#ffffff"
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setMostrarModalPerfil(true)}
              style={{
                background: "var(--violeta, #5000BA)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Plus size={16} /> Crear Nuevo Perfil
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {perfilesFiltrados.map(p => {
              const desplegado = perfilDetalle === p.clave;
              const t = TEMAS_PERFIL[p.clave] || TEMA_POR_DEFECTO;

              return (
                <div
                  key={p.clave}
                  style={{
                    border: `1px solid ${t.colorBorde}44`,
                    borderRadius: "12px",
                    background: "#ffffff",
                    overflow: "hidden"
                  }}
                >
                  <div
                    onClick={() => setPerfilDetalle(desplegado ? null : p.clave)}
                    style={{
                      padding: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: desplegado ? t.colorFondoSuave : "#ffffff",
                      gap: "12px",
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "10px",
                          background: t.badgeBg,
                          color: t.badgeTexto,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: `1px solid ${t.colorBorde}33`,
                          flexShrink: 0
                        }}
                      >
                        {p.esSuperAdmin ? <ShieldCheck size={20} /> : <Users size={20} />}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.95rem", color: t.colorTexto }}>{p.nombre}</span>
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", background: t.badgeBg, color: t.badgeTexto }}>
                            Nivel {p.nivel}
                          </span>
                          <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "999px", border: "1px solid var(--panel-linea, #E4E4E4)", color: "var(--panel-gris, #737373)" }}>
                            {p.clave}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                          {p.descripcion}
                        </span>
                      </div>
                    </div>
                    {desplegado ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>

                  {desplegado && (
                    <div style={{ padding: "16px 20px", borderTop: "1px solid var(--panel-linea, #E4E4E4)", background: "#ffffff" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", marginBottom: "8px" }}>
                        Paneles y Widgets Configurados:
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                        {Object.entries(p.widgetsAsignadosPorPanel).flatMap(([panId, list]) => list.map(w => `${panId}:${w}`)).map(wKey => (
                          <span key={wKey} style={{ fontSize: "0.75rem", fontWeight: 700, background: t.colorFondoSuave, color: t.colorTexto, border: `1px solid ${t.colorBorde}33`, padding: "4px 10px", borderRadius: "6px" }}>
                            <Check size={12} style={{ marginRight: 4, color: t.colorPrimario }} /> {wKey}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: REPORTE INTEGRAL DE GOBERNANZA (PERFILES, PANELES, WIDGETS Y USUARIOS ASIGNADOS) */}
      {tabActiva === "reporte_gobernanza" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* CABECERA HERO DEL REPORTE */}
          <div
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              borderRadius: "16px",
              padding: "24px",
              color: "#ffffff",
              boxShadow: "0 10px 30px rgba(30, 27, 75, 0.25)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#c7d2fe", marginBottom: "8px" }}>
                  <ShieldCheck size={14} /> GOBERNANZA TRANSVERSAL ({negocio.toUpperCase()})
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 6px 0", color: "#ffffff" }}>
                  Reporte de Perfiles, Paneles, Widgets y Usuarios Asignados
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#c7d2fe", margin: 0, maxWidth: "680px", lineHeight: 1.5 }}>
                  Consolidado integral de la matriz de seguridad, jerarquías de perfiles (1-100), rutas de paneles, módulos widget activos y lista de usuarios con membresía vinculada.
                </p>
              </div>

              {/* BOTONES DE ACCIÓN: COPIAR, EXPORTAR CSV, IMPRIMIR */}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={copiarReporteMarkdown}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "#ffffff",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  title="Copiar reporte en formato Markdown al portapapeles"
                >
                  <Copy size={16} /> Copiar Reporte
                </button>

                <button
                  type="button"
                  onClick={exportarReporteCSV}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#05876E",
                    border: "none",
                    color: "#ffffff",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(5,135,110,0.3)"
                  }}
                  title="Descargar matriz en formato CSV / Excel"
                >
                  <Download size={16} /> Exportar CSV
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#5000BA",
                    border: "none",
                    color: "#ffffff",
                    padding: "9px 16px",
                    borderRadius: "10px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(80,0,186,0.3)"
                  }}
                  title="Imprimir o guardar como PDF"
                >
                  <Printer size={16} /> Imprimir / PDF
                </button>
              </div>
            </div>

            {/* FILTROS Y BÚSQUEDA DEL REPORTE */}
            <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Buscar en el reporte por perfil, panel, widget o usuario..."
                  value={busquedaReporte}
                  onChange={e => setBusquedaReporte(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ minWidth: "220px" }}>
                <select
                  value={filtroPerfilReporte}
                  onChange={e => setFiltroPerfilReporte(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "#312e81",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  <option value="TODOS">Todos los Perfiles ({perfiles.length})</option>
                  {perfiles.map(p => (
                    <option key={p.clave} value={p.clave}>
                      {p.nombre} (Nivel {p.nivel})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={cargarUsuariosParaReporte}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  padding: "9px 14px",
                  borderRadius: "10px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {cargandoUsuariosReporte ? "Cargando..." : "↻ Actualizar"}
              </button>
            </div>
          </div>

          {/* LISTADO DE TARJETAS DE REPORTE POR PERFIL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {perfiles
              .filter(p => {
                if (filtroPerfilReporte !== "TODOS" && p.clave !== filtroPerfilReporte) return false;
                if (!busquedaReporte.trim()) return true;
                const txt = busquedaReporte.toLowerCase();
                const coincidePerfil = p.nombre.toLowerCase().includes(txt) || p.clave.toLowerCase().includes(txt);
                const coincideWidget = Object.values(p.widgetsAsignadosPorPanel).flat().some(w => w.toLowerCase().includes(txt));
                const coincideUsuario = usuariosReporte.some(u => {
                  const tieneP = p.clave === "SUPERADMIN" ? u.perfiles.includes("SUPERADMIN") : u.perfiles.map(x => x.toUpperCase()).includes(p.clave.toUpperCase());
                  return tieneP && (u.usu_correo.toLowerCase().includes(txt) || (u.usu_nombres || "").toLowerCase().includes(txt) || (u.usu_apellidos || "").toLowerCase().includes(txt));
                });
                return coincidePerfil || coincideWidget || coincideUsuario;
              })
              .map(p => {
                const t = TEMAS_PERFIL[p.clave] || TEMA_POR_DEFECTO;
                const panelesDelPerfil = panelesSidebar.filter(pan => p.panelesAsignados.includes(pan.id));
                const usuariosDelPerfil = usuariosReporte.filter(u => {
                  if (p.clave === "SUPERADMIN") return u.perfiles.includes("SUPERADMIN");
                  return u.perfiles.map(x => x.toUpperCase()).includes(p.clave.toUpperCase());
                });

                const totalWidgets = Object.values(p.widgetsAsignadosPorPanel).reduce((acc, list) => acc + list.length, 0);

                return (
                  <div
                    key={p.clave}
                    style={{
                      border: `2px solid ${t.colorBorde}44`,
                      borderRadius: "16px",
                      background: "#ffffff",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                      overflow: "hidden"
                    }}
                  >
                    {/* CABECERA DE PERFIL */}
                    <div
                      style={{
                        padding: "18px 24px",
                        background: t.colorFondoSuave,
                        borderBottom: `1.5px solid ${t.colorBorde}33`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "12px",
                            background: t.badgeBg,
                            color: t.badgeTexto,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `1.5px solid ${t.colorBorde}44`
                          }}
                        >
                          {p.esSuperAdmin ? <ShieldCheck size={24} /> : <Users size={24} />}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: t.colorTexto, margin: 0 }}>
                              {p.nombre}
                            </h3>
                            <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "3px 10px", borderRadius: "999px", background: t.badgeBg, color: t.badgeTexto, border: `1px solid ${t.colorBorde}33` }}>
                              Nivel {p.nivel} (Jerarquía 1-100)
                            </span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: "#ffffff", color: "#555", border: "1px solid #E4E4E4" }}>
                              {p.clave}
                            </span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: "999px", background: "#ffffff", color: "#555", border: "1px solid #E4E4E4" }}>
                              Ámbito: {p.ambito}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.82rem", color: t.colorTexto, margin: "4px 0 0 0", opacity: 0.85 }}>
                            {p.descripcion || "Perfil configurado para el sistema."}
                          </p>
                        </div>
                      </div>

                      {/* BADGES METRICAS */}
                      <div style={{ display: "flex", gap: "10px" }}>
                        <div style={{ textAlign: "center", padding: "6px 14px", background: "#ffffff", borderRadius: "10px", border: "1px solid #E4E4E4" }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 900, color: t.colorPrimario, display: "block", lineHeight: 1 }}>{panelesDelPerfil.length}</span>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#737373", textTransform: "uppercase" }}>Paneles</span>
                        </div>
                        <div style={{ textAlign: "center", padding: "6px 14px", background: "#ffffff", borderRadius: "10px", border: "1px solid #E4E4E4" }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 900, color: t.colorPrimario, display: "block", lineHeight: 1 }}>{totalWidgets}</span>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#737373", textTransform: "uppercase" }}>Widgets</span>
                        </div>
                        <div style={{ textAlign: "center", padding: "6px 14px", background: "#ffffff", borderRadius: "10px", border: "1px solid #E4E4E4" }}>
                          <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#05876E", display: "block", lineHeight: 1 }}>{usuariosDelPerfil.length}</span>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#737373", textTransform: "uppercase" }}>Usuarios</span>
                        </div>
                      </div>
                    </div>

                    {/* CUERPO DEL REPORTE: PANELES / WIDGETS Y USUARIOS */}
                    <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
                      {/* COLUMNA 1: PANELES & WIDGETS ASIGNADOS */}
                      <div style={{ background: "#FBFBFE", padding: "18px", borderRadius: "12px", border: "1px solid #EAE8F2" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#1e1b4b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Layers size={16} color={t.colorPrimario} /> Paneles del Menú & Módulos Asignados ({panelesDelPerfil.length})
                        </div>

                        {panelesDelPerfil.length === 0 ? (
                          <p style={{ fontSize: "0.82rem", color: "#888", fontStyle: "italic", margin: 0 }}>
                            Este perfil no tiene paneles de navegación asignados actualmente.
                          </p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {panelesDelPerfil.map(pan => {
                              const widgetsDeEstePanel = (p.widgetsAsignadosPorPanel[pan.id] || []).map(wClave => {
                                return inventarioWidgets.find(w => w.clave === wClave) || {
                                  clave: wClave,
                                  nombre: wClave,
                                  categoria: "General",
                                  descripcion: "",
                                  ruta: pan.ruta
                                };
                              });

                              return (
                                <div key={pan.id} style={{ background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #E4E4E4" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      <IconoPanelDinamico nombreIcono={pan.icono} color={t.colorPrimario} size={16} />
                                      <strong style={{ fontSize: "0.88rem", color: "#111" }}>{pan.nombre}</strong>
                                      <code style={{ fontSize: "0.72rem", color: "#666", background: "#f1f1f1", padding: "1px 6px", borderRadius: "4px" }}>{pan.ruta}</code>
                                    </div>
                                    {pan.requiereMfa && (
                                      <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: "999px", border: "1px solid #fecaca" }}>
                                        MFA TOTP
                                      </span>
                                    )}
                                  </div>

                                  {widgetsDeEstePanel.length === 0 ? (
                                    <span style={{ fontSize: "0.75rem", color: "#999", fontStyle: "italic" }}>
                                      (Sin widgets configurados en este panel)
                                    </span>
                                  ) : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                      {widgetsDeEstePanel.map((w, idx) => (
                                        <span
                                          key={idx}
                                          style={{
                                            fontSize: "0.74rem",
                                            fontWeight: 700,
                                            padding: "4px 8px",
                                            borderRadius: "6px",
                                            background: t.colorFondoSuave,
                                            color: t.colorTexto,
                                            border: `1px solid ${t.colorBorde}33`,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "4px"
                                          }}
                                          title={`Clave: ${w.clave} | Categoría: ${w.categoria}`}
                                        >
                                          <Check size={12} color={t.colorPrimario} /> {w.nombre}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* COLUMNA 2: USUARIOS ASIGNADOS AL PERFIL */}
                      <div style={{ background: "#FBFBFE", padding: "18px", borderRadius: "12px", border: "1px solid #EAE8F2" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#1e1b4b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <Users size={16} color="#05876E" /> Usuarios con este Perfil ({usuariosDelPerfil.length})
                        </div>

                        {usuariosDelPerfil.length === 0 ? (
                          <div style={{ padding: "24px", textAlign: "center", background: "#ffffff", borderRadius: "10px", border: "1px dashed #D1D5DB" }}>
                            <UserCheck size={28} color="#9CA3AF" style={{ margin: "0 auto 8px" }} />
                            <p style={{ fontSize: "0.82rem", color: "#6B7280", margin: 0, fontWeight: 600 }}>
                              No hay usuarios registrados que tengan asignado este perfil actualmente.
                            </p>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "380px", overflowY: "auto", paddingRight: "4px" }}>
                            {usuariosDelPerfil.map((u, idx) => {
                              const nombreCompleto = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || "Usuario Registrado";
                              const iniciales = (u.usu_nombres?.[0] || u.usu_correo[0] || "U").toUpperCase();

                              return (
                                <div
                                  key={u.usu_id || idx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "10px 12px",
                                    background: "#ffffff",
                                    borderRadius: "8px",
                                    border: "1px solid #E4E4E4",
                                    gap: "10px"
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                    <div
                                      style={{
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        background: t.badgeBg,
                                        color: t.badgeTexto,
                                        fontWeight: 800,
                                        fontSize: "0.82rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0
                                      }}
                                    >
                                      {iniciales}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <strong style={{ fontSize: "0.84rem", color: "#111", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {nombreCompleto}
                                      </strong>
                                      <span style={{ fontSize: "0.74rem", color: "#737373", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {u.usu_correo}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                    <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }}>
                                      {u.mem_estado || "ACTIVO"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* MODAL DE PREVISUALIZACIÓN FLOTANTE EN VIVO CON RENDERIZADO INTERACTIVO DEL WIDGET REAL */}
      {widgetPrevisualizar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "24px", maxWidth: "720px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--panel-linea, #E4E4E4)", paddingBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--violeta, #5000BA)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={20} color="var(--violeta, #5000BA)" /> Vista Previa del Widget Real: {widgetPrevisualizar.nombre}
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                  Clave: <code>{widgetPrevisualizar.clave}</code> | Categoría: {widgetPrevisualizar.categoria}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWidgetPrevisualizar(null)}
                style={{ background: "#ffffff", border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--panel-gris, #737373)", marginBottom: "16px", lineHeight: 1.5 }}>
              {widgetPrevisualizar.descripcion}
            </p>

            {/* CONTENEDOR CON EL COMPONENTE REACT REAL INTERACTIVO */}
            <div style={{ border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "14px", padding: "20px", background: "var(--panel-papel, #F7F6FA)", marginBottom: "20px" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--violeta, #5000BA)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "6px" }}>
                <Eye size={16} /> Interfaz Interactiva Real del Componente
              </div>

              {/* RENDERIZADO DEL COMPONENTE DE SOFTWARE REAL */}
              <RenderizadorWidgetReal clave={widgetPrevisualizar.clave} negocio={negocio} />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <a
                href={widgetPrevisualizar.ruta}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--violeta, #5000BA)",
                  color: "var(--violeta, #5000BA)",
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: "0.82rem"
                }}
              >
                Abrir en Panel Contenedor ({widgetPrevisualizar.ruta}) <ExternalLink size={14} />
              </a>
              <button
                type="button"
                onClick={() => setWidgetPrevisualizar(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--violeta, #5000BA)",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.82rem"
                }}
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR PERFIL */}
      {mostrarModalPerfil && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <form onSubmit={handleGuardarPerfil} style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", maxWidth: "500px", width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "16px" }}>+ Crear Nuevo Perfil</h3>
            
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Clave del Perfil (ej: COORDINADOR):</label>
              <input
                type="text"
                required
                value={nuevoPerfil.clave}
                onChange={e => setNuevoPerfil({ ...nuevoPerfil, clave: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Nombre del Perfil:</label>
              <input
                type="text"
                required
                value={nuevoPerfil.nombre}
                onChange={e => setNuevoPerfil({ ...nuevoPerfil, nombre: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Nivel Jerárquico (1 - 100):</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={nuevoPerfil.nivel}
                onChange={e => setNuevoPerfil({ ...nuevoPerfil, nivel: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Descripción:</label>
              <textarea
                value={nuevoPerfil.descripcion}
                onChange={e => setNuevoPerfil({ ...nuevoPerfil, descripcion: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)", minHeight: "60px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setMostrarModalPerfil(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)", background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "var(--violeta, #5000BA)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Guardar Perfil</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CREAR WIDGET CON SELECCIÓN DE PERFILES AUTORIZADOS */}
      {mostrarModalWidget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <form onSubmit={handleGuardarWidget} style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", maxWidth: "520px", width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "16px" }}>+ Registrar Nuevo Widget</h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Clave (ej: reportes_avanzados):</label>
              <input
                type="text"
                required
                value={nuevoWidget.clave}
                onChange={e => setNuevoWidget({ ...nuevoWidget, clave: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Nombre del Widget:</label>
              <input
                type="text"
                required
                value={nuevoWidget.nombre}
                onChange={e => setNuevoWidget({ ...nuevoWidget, nombre: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Panel Contenedor:</label>
              <select
                value={nuevoWidget.panelId}
                onChange={e => setNuevoWidget({ ...nuevoWidget, panelId: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)" }}
              >
                {panelesSidebar.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.ruta})</option>
                ))}
              </select>
            </div>

            {/* SELECTOR DE PERFILES AUTORIZADOS CON COLORES */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "6px", color: "var(--violeta, #5000BA)" }}>
                Perfiles Autorizados para este Widget:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {perfiles.map(p => {
                  const seleccionado = nuevoWidgetPerfiles.includes(p.clave);
                  const t = TEMAS_PERFIL[p.clave] || TEMA_POR_DEFECTO;

                  return (
                    <label
                      key={p.clave}
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        background: seleccionado ? t.colorFondoSuave : "#ffffff",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: seleccionado ? `1.5px solid ${t.colorBorde}` : "1px solid var(--panel-linea, #E4E4E4)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        color: seleccionado ? t.colorTexto : "#111"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => togglePerfilNuevoWidget(p.clave)}
                        style={{ accentColor: t.colorPrimario }}
                      />
                      {p.nombre}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Descripción:</label>
              <textarea
                value={nuevoWidget.descripcion}
                onChange={e => setNuevoWidget({ ...nuevoWidget, descripcion: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)", minHeight: "50px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setMostrarModalWidget(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)", background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "var(--violeta, #5000BA)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Guardar Widget & Permisos</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CREAR NUEVO PANEL CON CONFIGURACIÓN MFA (PLT-002) */}
      {mostrarModalPanel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <form onSubmit={e => { e.preventDefault(); handleGuardarPanel(); }} style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", maxWidth: "480px", width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <LayoutGrid size={20} color="var(--violeta, #5000BA)" /> + Crear Nuevo Panel Personalizado
            </h3>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Nombre del Panel (ej: Gestión, Reportes, Operación):</label>
              <input
                type="text"
                required
                value={nuevoPanel.nombre}
                onChange={e => {
                  const val = e.target.value;
                  const slug = val.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
                  setNuevoPanel({
                    ...nuevoPanel,
                    nombre: val,
                    ruta: `/panel/${slug || "nuevo"}`
                  });
                }}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.88rem", fontWeight: 700 }}
                placeholder="Ej. Gestión"
              />
            </div>

            {/* Ruta del Panel (Auto-generada) */}
            <div style={{ marginBottom: "16px", background: "#F3F4F6", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#4B5563", textTransform: "uppercase" }}>
                    Ruta de Navegación (Generada Automáticamente):
                  </span>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#5000BA", fontFamily: "monospace", marginTop: "2px" }}>
                    {nuevoPanel.ruta || `/panel/${nuevoPanel.nombre.toLowerCase().trim().replace(/[^a-z0-9]/g, "_") || "nuevo"}`}
                  </div>
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#05876E", background: "#D1FAE5", padding: "4px 8px", borderRadius: "6px" }}>
                  Automática
                </span>
              </div>
              <p style={{ fontSize: "0.74rem", color: "#6B7280", margin: "4px 0 0 0" }}>
                No necesitas escribir rutas técnicas. Los widgets vinculados a este panel se renderizarán automáticamente en esta dirección.
              </p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Descripción:</label>
              <textarea
                value={nuevoPanel.descripcion}
                onChange={e => setNuevoPanel({ ...nuevoPanel, descripcion: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)", minHeight: "50px" }}
                placeholder="Consola de administración y módulos operativos..."
              />
            </div>

            {/* SELECTOR DE ÍCONO DE SIDEBAR */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 800, display: "block", marginBottom: "6px", color: "var(--violeta, #5000BA)" }}>
                Seleccionar Ícono para Visualizar en el Sidebar:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(75px, 1fr))", gap: "8px", maxHeight: "150px", overflowY: "auto", border: "1px solid #E4E4E4", borderRadius: "8px", padding: "8px", background: "#ffffff" }}>
                {Object.keys(CATALOGO_ICONOS_PANEL).map(iconKey => {
                  const esSeleccionado = nuevoPanel.icono === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setNuevoPanel({ ...nuevoPanel, icono: iconKey })}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        padding: "8px 4px",
                        borderRadius: "6px",
                        border: esSeleccionado ? "2px solid #5000BA" : "1px solid #E4E4E4",
                        background: esSeleccionado ? "#F3E8FF" : "#ffffff",
                        cursor: "pointer"
                      }}
                    >
                      <IconoPanelDinamico nombreIcono={iconKey} color={esSeleccionado ? "#5000BA" : "#555555"} size={18} />
                      <span style={{ fontSize: "0.64rem", fontWeight: esSeleccionado ? 800 : 500, color: esSeleccionado ? "#5000BA" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65px" }}>
                        {iconKey}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CHECKBOX REQUERIR MFA TOTP (PLT-002) */}
            <div style={{ marginBottom: "20px", background: "var(--panel-papel, #F7F6FA)", padding: "12px", borderRadius: "8px", border: "1px solid var(--panel-linea, #E4E4E4)" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#111" }}>
                <input
                  type="checkbox"
                  checked={nuevoPanel.requiereMfa}
                  onChange={e => setNuevoPanel({ ...nuevoPanel, requiereMfa: e.target.checked })}
                  style={{ width: "18px", height: "18px", accentColor: "#DC2626" }}
                />
                Requerir Autenticación Multifactor MFA (TOTP) al ingresar (PLT-002)
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setMostrarModalPanel(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--panel-linea, #E4E4E4)", background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "var(--violeta, #5000BA)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Crear Panel</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIGURAR ÍCONO DE SIDEBAR Y DETALLES DEL PANEL */}
      {panelEditarModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "20px" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPanelesSidebar(panelesSidebar.map(p => p.id === panelEditarModal.id ? panelEditarModal : p));
              setPanelEditarModal(null);
              setMensajeExito(`Panel '${panelEditarModal.nombre}' e ícono '${panelEditarModal.icono || "PanelLeft"}' actualizados.`);
              setTimeout(() => setMensajeExito(null), 3500);
            }}
            style={{ background: "#ffffff", borderRadius: "18px", padding: "24px", maxWidth: "560px", width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #E4E4E4", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, color: "var(--violeta, #5000BA)", display: "flex", alignItems: "center", gap: "8px" }}>
                <IconoPanelDinamico nombreIcono={panelEditarModal.icono} color="var(--violeta, #5000BA)" size={20} /> Configurar Ícono & Panel: {panelEditarModal.nombre}
              </h3>
              <button type="button" onClick={() => setPanelEditarModal(null)} style={{ background: "#ffffff", border: "1px solid #E4E4E4", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            {/* Selector de Ícono para el Sidebar */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 800, display: "block", marginBottom: "6px", color: "var(--violeta, #5000BA)" }}>
                Seleccionar Ícono para Visualizar en el Sidebar:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(75px, 1fr))", gap: "8px", maxHeight: "160px", overflowY: "auto", border: "1px solid #E4E4E4", borderRadius: "8px", padding: "8px" }}>
                {Object.keys(CATALOGO_ICONOS_PANEL).map(iconKey => {
                  const esSeleccionado = panelEditarModal.icono === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setPanelEditarModal({ ...panelEditarModal, icono: iconKey })}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        padding: "8px 4px",
                        borderRadius: "6px",
                        border: esSeleccionado ? "2px solid #5000BA" : "1px solid #E4E4E4",
                        background: esSeleccionado ? "#F3E8FF" : "#ffffff",
                        cursor: "pointer"
                      }}
                    >
                      <IconoPanelDinamico nombreIcono={iconKey} color={esSeleccionado ? "#5000BA" : "#555555"} size={18} />
                      <span style={{ fontSize: "0.64rem", fontWeight: esSeleccionado ? 800 : 500, color: esSeleccionado ? "#5000BA" : "#666", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65px" }}>
                        {iconKey}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nombre del Panel */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Nombre del Panel:</label>
              <input
                type="text"
                required
                value={panelEditarModal.nombre}
                onChange={e => {
                  const val = e.target.value;
                  const slug = val.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
                  const esBase = ["panel_inicio", "panel_administrar", "panel_configuracion", "panel_cuenta", "panel_herramientas", "panel_seguridad"].includes(panelEditarModal.id);
                  const rutaAuto = esBase ? panelEditarModal.ruta : `/panel/${slug || "nuevo"}`;
                  setPanelEditarModal({ ...panelEditarModal, nombre: val, ruta: rutaAuto });
                }}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #D1D5DB", fontSize: "0.88rem", fontWeight: 700 }}
              />
            </div>

            {/* Ruta de Navegación (Auto-generada) */}
            <div style={{ marginBottom: "16px", background: "#F3F4F6", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#4B5563", textTransform: "uppercase" }}>
                    Ruta de Navegación (Generada Automáticamente):
                  </span>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#5000BA", fontFamily: "monospace", marginTop: "2px" }}>
                    {panelEditarModal.ruta}
                  </div>
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#05876E", background: "#D1FAE5", padding: "4px 8px", borderRadius: "6px" }}>
                  Automática
                </span>
              </div>
              <p style={{ fontSize: "0.74rem", color: "#6B7280", margin: "4px 0 0 0" }}>
                No necesitas escribir rutas técnicas. Los widgets vinculados a este panel se renderizarán automáticamente en esta dirección.
              </p>
            </div>

            {/* Descripción */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "4px" }}>Descripción del Panel:</label>
              <textarea
                value={panelEditarModal.descripcion}
                onChange={e => setPanelEditarModal({ ...panelEditarModal, descripcion: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #E4E4E4", minHeight: "50px", fontSize: "0.82rem" }}
              />
            </div>

            {/* Mostrar u Ocultar si no tiene widgets */}
            <div style={{ marginBottom: "12px", background: "#F7F6FA", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E4E4E4" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#111111" }}>
                <input
                  type="checkbox"
                  checked={panelEditarModal.mostrarSinWidgets !== false}
                  onChange={e => setPanelEditarModal({ ...panelEditarModal, mostrarSinWidgets: e.target.checked })}
                  style={{ width: "16px", height: "16px", accentColor: "#5000BA" }}
                />
                Mostrar este panel en el sidebar aunque no tenga widgets asignados (como 'Próximamente')
              </label>
            </div>

            {/* Requerir MFA */}
            <div style={{ marginBottom: "18px", background: "#F7F6FA", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E4E4E4" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!panelEditarModal.requiereMfa}
                  onChange={e => setPanelEditarModal({ ...panelEditarModal, requiereMfa: e.target.checked })}
                  style={{ width: "16px", height: "16px", accentColor: "#DC2626" }}
                />
                Requerir MFA TOTP al ingresar a este panel
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setPanelEditarModal(null)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #E4E4E4", background: "#fff", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ padding: "8px 18px", borderRadius: "6px", border: "none", background: "var(--violeta, #5000BA)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Guardar Ajustes</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL REORGANIZAR / TRANSFERIR WIDGET ENTRE PANELES (MOVER VS DUPLICAR) */}
      {widgetTransferir && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "24px", maxWidth: "520px", width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #E4E4E4", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, color: "#5000BA", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Move size={18} /> Reorganizar / Transferir Widget
                </h3>
                <span style={{ fontSize: "0.78rem", color: "#737373" }}>
                  Perfil: <strong>{perfilActualObj?.nombre}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWidgetTransferir(null)}
                style={{ background: "#ffffff", border: "1px solid #E4E4E4", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEjecutarTransferencia} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Información del Widget */}
              <div style={{ background: "#F7F6FA", padding: "12px 14px", borderRadius: "10px", border: "1px solid #E4E4E4" }}>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "#111111" }}>{widgetTransferir.widget.nombre}</strong>
                <span style={{ fontSize: "0.75rem", color: "#737373", display: "block", marginTop: "2px" }}>
                  Panel Origen Actual: <strong>{panelesSidebar.find(p => p.id === widgetTransferir.panelOrigenId)?.nombre || widgetTransferir.panelOrigenId}</strong>
                </span>
              </div>

              {/* Selección de Acción: Mover (por defecto) vs Duplicar */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111111", display: "block", marginBottom: "8px" }}>
                  ¿Qué deseas hacer con este widget?
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: accionTransferir === "mover" ? "1.5px solid #5000BA" : "1px solid #E4E4E4",
                      background: accionTransferir === "mover" ? "#F3E8FF" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "0.84rem",
                      fontWeight: 700
                    }}
                  >
                    <input
                      type="radio"
                      name="accionTransferir"
                      value="mover"
                      checked={accionTransferir === "mover"}
                      onChange={() => setAccionTransferir("mover")}
                    />
                    <div>
                      <span>⇄ Mover Widget (Por Defecto)</span>
                      <span style={{ display: "block", fontSize: "0.74rem", fontWeight: 500, color: "#737373" }}>
                        Quita el widget del panel origen y lo transfiere al panel destino.
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: accionTransferir === "duplicar" ? "1.5px solid #5000BA" : "1px solid #E4E4E4",
                      background: accionTransferir === "duplicar" ? "#F3E8FF" : "#FFFFFF",
                      cursor: "pointer",
                      fontSize: "0.84rem",
                      fontWeight: 700
                    }}
                  >
                    <input
                      type="radio"
                      name="accionTransferir"
                      value="duplicar"
                      checked={accionTransferir === "duplicar"}
                      onChange={() => setAccionTransferir("duplicar")}
                    />
                    <div>
                      <span>Duplicar Widget</span>
                      <span style={{ display: "block", fontSize: "0.74rem", fontWeight: 500, color: "#737373" }}>
                        Conserva el widget en el panel origen y lo añade también al panel destino.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Selección del Panel Destino */}
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "#111111", display: "block", marginBottom: "6px" }}>
                  Seleccionar Panel Destino
                </label>
                <select
                  value={panelDestinoId}
                  onChange={(e) => setPanelDestinoId(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #E4E4E4",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    background: "#FFFFFF"
                  }}
                >
                  {panelesSidebar
                    .filter(p => p.id !== widgetTransferir.panelOrigenId)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.ruta})
                      </option>
                    ))}
                </select>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setWidgetTransferir(null)}
                  style={{
                    background: "#F7F6FA",
                    border: "1px solid #E4E4E4",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  style={{
                    background: "#5000BA",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 20px",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  {accionTransferir === "mover" ? "⇄ Mover Widget" : "Duplicar Widget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
