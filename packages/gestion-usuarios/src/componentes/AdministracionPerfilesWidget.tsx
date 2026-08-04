"use client";

import React, { useState } from "react";
import {
  ShieldCheck, Users,
  CheckCircle2, ChevronDown, ChevronUp, Search, Sliders,
  Plus, Check, LayoutGrid, Layers, ExternalLink, PanelLeft, Eye, ArrowRight,
  Palette, UserCheck, X, Sparkles
} from "lucide-react";
import { guardarPerfil, guardarWidget, guardarAsignacionWidget } from "../acciones";

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
  widgetsAsignados: string[];
  activo: boolean;
  esSuperAdmin?: boolean;
}

export interface PanelSidebarDef {
  id: string;
  nombre: string;
  ruta: string;
  descripcion: string;
}

export interface WidgetInventarioDef {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  ruta: string;
  panelId: string;
  activo: boolean;
}

const PANELES_SIDEBAR_INICIALES: PanelSidebarDef[] = [
  {
    id: "panel_inicio",
    nombre: "Inicio (Tablero Principal)",
    ruta: "/panel",
    descripcion: "Pantalla principal que agrupa accesos rápidos y widgets según el rol del usuario."
  },
  {
    id: "panel_cuenta",
    nombre: "Mi Cuenta & Identidad",
    ruta: "/panel/cuenta",
    descripcion: "Perfil de usuario, conmutador de rol ('Ver como') e historial de accesos."
  },
  {
    id: "panel_configuracion",
    nombre: "Configuración & Gobernanza",
    ruta: "/panel/configuracion",
    descripcion: "Parámetros del negocio, servidor SMTP, perfiles y alertas de notificaciones."
  },
  {
    id: "panel_usuarios",
    nombre: "Gestión de Usuarios",
    ruta: "/panel/usuarios",
    descripcion: "Administración de miembros, asignación de perfiles y techo jerárquico."
  },
  {
    id: "panel_socios",
    nombre: "Aprobación de Socios",
    ruta: "/panel/socios",
    descripcion: "Validación de matrículas y acreditación de abogados."
  },
  {
    id: "panel_auditoria",
    nombre: "Auditoría BDD",
    ruta: "/panel/auditoria",
    descripcion: "Consulta de registros inmutables PostgreSQL y telemetría de APIs."
  },
  {
    id: "panel_emision",
    nombre: "Emisión Notificaciones",
    ruta: "/panel/emision-notificaciones",
    descripcion: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp)."
  }
];

const PERFILES_INICIALES: PerfilDef[] = [
  {
    clave: "CLIENTE",
    nombre: "Cliente (Jerarquía Base)",
    nivel: 1,
    ambito: "Empresa",
    descripcion: "Perfil base de usuario. Acceso a paneles de Inicio, Mi Cuenta y Preferencias de Notificaciones.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_configuracion"],
    widgetsAsignados: ["favoritos", "mi_cuenta", "ver_como", "notificaciones"],
    activo: true
  },
  {
    clave: "OPERADOR",
    nombre: "Operador / Auxiliar",
    nivel: 30,
    ambito: "Empresa",
    descripcion: "Perfil operativo para atención al cliente y seguimiento de solicitudes.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_configuracion"],
    widgetsAsignados: ["favoritos", "mi_cuenta", "ver_como", "notificaciones"],
    activo: true
  },
  {
    clave: "ABOGADO",
    nombre: "Socio Abogado / Profesional",
    nivel: 50,
    ambito: "Empresa",
    descripcion: "Perfil profesional para atención legal de causas y expedientes.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_configuracion"],
    widgetsAsignados: ["favoritos", "mi_cuenta", "ver_como", "notificaciones"],
    activo: true
  },
  {
    clave: "ADMINISTRADOR",
    nombre: "Administrador del Negocio",
    nivel: 80,
    ambito: "Empresa",
    descripcion: "Gestión del negocio: usuarios, parámetros de marca, SMTP, perfiles y auditoría.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_configuracion", "panel_usuarios", "panel_socios", "panel_auditoria"],
    widgetsAsignados: ["favoritos", "configuracion_negocio", "configuracion_correo", "perfiles", "gestion_usuarios", "socios", "auditoria", "notificaciones", "mi_cuenta", "ver_como"],
    activo: true
  },
  {
    clave: "SUPERADMIN",
    nombre: "SuperAdmin de Plataforma",
    nivel: 100,
    ambito: "Plataforma",
    descripcion: "Gobernanza exclusiva de la plataforma y matriz global de perfiles.",
    panelesAsignados: ["panel_inicio", "panel_cuenta", "panel_configuracion", "panel_usuarios", "panel_socios", "panel_auditoria", "panel_emision"],
    widgetsAsignados: ["favoritos", "configuracion_negocio", "configuracion_correo", "perfiles", "gestion_usuarios", "socios", "auditoria", "emision_notificaciones", "mi_cuenta", "ver_como", "historial_accesos"],
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
    panelId: "panel_inicio",
    activo: true
  },
  {
    clave: "ver_como",
    nombre: "Selector 'Ver Como' (Conmutador de Rol)",
    descripcion: "Conmutador de rol activo asignado para cambiar de perspectiva.",
    categoria: "Identidad",
    ruta: "/panel/cuenta",
    panelId: "panel_cuenta",
    activo: true
  },
  {
    clave: "mi_cuenta",
    nombre: "Datos Personales & Perfil",
    descripcion: "Edición de perfil de usuario y preferencias de contacto.",
    categoria: "Identidad",
    ruta: "/panel/cuenta",
    panelId: "panel_cuenta",
    activo: true
  },
  {
    clave: "historial_accesos",
    nombre: "Historial de Accesos & Sesiones",
    descripcion: "Bitácora de inicios de sesión, navegador e IP.",
    categoria: "Seguridad",
    ruta: "/panel/cuenta",
    panelId: "panel_cuenta",
    activo: true
  },
  {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios & Membresías",
    descripcion: "Asignación de perfiles, roles y techo jerárquico.",
    categoria: "Administración",
    ruta: "/panel/usuarios",
    panelId: "panel_usuarios",
    activo: true
  },
  {
    clave: "socios",
    nombre: "Aprobación de Socios Abogados",
    descripcion: "Revisión de matrículas y verificación de credenciales.",
    categoria: "Operación Legal",
    ruta: "/panel/socios",
    panelId: "panel_socios",
    activo: true
  },
  {
    clave: "auditoria",
    nombre: "Auditoría por Triggers BDD",
    descripcion: "Registro inmutable de transacciones, diffs JSONB e IP.",
    categoria: "Seguridad & Auditoría",
    ruta: "/panel/auditoria",
    panelId: "panel_auditoria",
    activo: true
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración del Negocio",
    descripcion: "Identidad legal, WhatsApp, redes sociales y locales.",
    categoria: "Configuración",
    ruta: "/panel/configuracion",
    panelId: "panel_configuracion",
    activo: true
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo SMTP",
    descripcion: "Credenciales Vault para envío de emails transaccionales.",
    categoria: "Infraestructura",
    ruta: "/panel/configuracion",
    panelId: "panel_configuracion",
    activo: true
  },
  {
    clave: "perfiles",
    nombre: "Administración de Perfiles & Permisos",
    descripcion: "Matriz de perfiles, jerarquía (1-100) y asignación de widgets.",
    categoria: "Gobernanza",
    ruta: "/panel/configuracion",
    panelId: "panel_configuracion",
    activo: true
  },
  {
    clave: "notificaciones",
    nombre: "Preferencias de Alertas & Notificaciones",
    descripcion: "Canales de recepción de correo saliente, WhatsApp y Push.",
    categoria: "Comunicación",
    ruta: "/panel/configuracion",
    panelId: "panel_configuracion",
    activo: true
  },
  {
    clave: "emision_notificaciones",
    nombre: "Emisión de Notificaciones Multicanal",
    descripcion: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp).",
    categoria: "Comunicación",
    ruta: "/panel/emision-notificaciones",
    panelId: "panel_emision",
    activo: true
  }
];

// COMPONENTE PARA RENDERIZAR LA INTERFAZ REAL INTERACTIVA EN EL MODAL DE PREVISUALIZACIÓN
function RenderizadorWidgetReal({ clave, negocio }: { clave: string; negocio: string }) {
  switch (clave) {
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
            <option>👤 Cliente (Jerarquía Base) - Nivel 1</option>
            <option>⚖️ Socio Abogado / Profesional - Nivel 50</option>
            <option>🏢 Administrador del Negocio - Nivel 80</option>
            <option>🛡️ SuperAdmin de Plataforma - Nivel 100</option>
          </select>
        </div>
      );

    case "notificaciones":
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid #0284C7", boxShadow: "0 4px 12px rgba(2,132,199,0.08)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0369A1", marginBottom: "10px" }}>
            🔔 Preferencias de Alertas & Notificaciones Multicanal
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
            🏢 Datos del Negocio ({negocio.toUpperCase()})
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
            📧 Servidor SMTP de Correo Transaccional (Credenciales Vault)
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
            👥 Administración de Usuarios & Membresías
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
                <td style={{ padding: "6px 10px", textAlign: "center", color: "#05876e", fontWeight: 800 }}>✓ Activo</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1.5px solid var(--violeta, #5000BA)" }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--violeta, #5000BA)", marginBottom: "8px" }}>
            ⚡ Componente Real: {clave.toUpperCase()}
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
  const [tabActiva, setTabActiva] = useState<"matriz_paneles" | "matriz_widgets" | "inventario_widgets" | "perfiles">("matriz_widgets");
  
  // Estado local
  const [perfiles, setPerfiles] = useState<PerfilDef[]>(PERFILES_INICIALES);
  const [panelesSidebar] = useState<PanelSidebarDef[]>(PANELES_SIDEBAR_INICIALES);
  const [inventarioWidgets, setInventarioWidgets] = useState<WidgetInventarioDef[]>(WIDGETS_INVENTARIO_INICIALES);

  // Perfil seleccionado en pestaña 2 (Widgets por Panel & Perfil)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("ABOGADO");

  // Widget para previsualizar en Modal Flotante En Vivo
  const [widgetPrevisualizar, setWidgetPrevisualizar] = useState<WidgetInventarioDef | null>(null);

  // Tema del perfil activo seleccionado
  const temaPerfilActivo = TEMAS_PERFIL[perfilSeleccionado] || TEMA_POR_DEFECTO;

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

  // Alternar asignación de Widget a un Perfil dinámicamente
  const toggleWidgetPerfil = async (perfilClave: string, widgetClave: string) => {
    const perfil = perfiles.find(p => p.clave === perfilClave);
    if (!perfil) return;

    const asignado = perfil.widgetsAsignados.includes(widgetClave);
    const nuevosWidgets = asignado
      ? perfil.widgetsAsignados.filter(w => w !== widgetClave)
      : [...perfil.widgetsAsignados, widgetClave];

    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, widgetsAsignados: nuevosWidgets } : p));

    await guardarAsignacionWidget(perfilClave, widgetClave, negocio, !asignado);

    setMensajeExito(`Widget '${widgetClave}' ${asignado ? "desmarcado para" : "asignado a"} perfil '${perfilClave}'.`);
    setTimeout(() => setMensajeExito(null), 3000);
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
      widgetsAsignados: ["favoritos", "mi_cuenta", "notificaciones"],
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
        return { ...p, widgetsAsignados: [...p.widgetsAsignados, claveLower] };
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
      await guardarAsignacionWidget(perfClave, claveLower, negocio, true);
    }

    setMensajeExito(`Widget '${claveLower}' registrado y asignado a [${nuevoWidgetPerfiles.join(", ")}].`);
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
            Arquitectura de Gobernanza: Perfil ➔ Paneles (Sidebar) ➔ Widgets
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
            3. Widgets Contenidos por Panel (Inclusión Libre N a N)
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
          <Layers size={18} /> 2. Widgets por Panel & Perfil
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
          <PanelLeft size={18} /> 1. Matriz Perfil ➔ Paneles (Sidebar)
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
          <LayoutGrid size={18} /> Inventario de Widgets ({inventarioWidgets.length})
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
      </div>

      {/* TAB 2: ASIGNACIÓN LIBRE DE WIDGETS POR PANEL & PERFIL */}
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
                Configuración libre N a N. Puedes habilitar un widget como <strong>'Ver Como'</strong> en <strong>Mi Cuenta</strong> y también en <strong>Configuración</strong> simultáneamente.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {panelesSidebar.map(panel => {
              return (
                <div
                  key={panel.id}
                  style={{
                    border: `1px solid ${temaPerfilActivo.colorBorde}33`,
                    borderRadius: "12px",
                    padding: "16px",
                    background: "#ffffff",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <PanelLeft size={18} color={temaPerfilActivo.colorPrimario} />
                      <strong style={{ fontSize: "0.95rem", color: "#111111" }}>{panel.nombre}</strong>
                      <code style={{ fontSize: "0.72rem", color: "var(--panel-gris, #737373)" }}>{panel.ruta}</code>
                    </div>
                    <a href={panel.ruta} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: temaPerfilActivo.colorPrimario, fontWeight: 700, textDecoration: "none" }}>
                      Previsualizar Panel ↗
                    </a>
                  </div>

                  <p style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", margin: "0 0 12px 0" }}>{panel.descripcion}</p>

                  {/* INVENTARIO COMPLETO DISPONIBLE PARA INCLUSIÓN LIBRE EN ESTE PANEL */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
                    {inventarioWidgets.map(w => {
                      const estaAsignado = perfilActualObj?.widgetsAsignados.includes(w.clave) ?? false;

                      return (
                        <div
                          key={w.clave}
                          onClick={() => toggleWidgetPerfil(perfilSeleccionado, w.clave)}
                          style={{
                            background: estaAsignado ? temaPerfilActivo.colorFondoSuave : "#ffffff",
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: estaAsignado ? `2px solid ${temaPerfilActivo.colorBorde}` : "1px solid var(--panel-linea, #E4E4E4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            transition: "all 0.18s ease"
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: estaAsignado ? temaPerfilActivo.colorTexto : "#111111" }}>
                              {w.nombre}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: estaAsignado ? temaPerfilActivo.colorPrimario : "var(--panel-gris, #737373)", opacity: 0.8 }}>
                              {w.clave} • {w.categoria}
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={estaAsignado}
                            onChange={() => {}}
                            style={{
                              width: "18px",
                              height: "18px",
                              cursor: "pointer",
                              accentColor: temaPerfilActivo.colorPrimario
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: PASO 1 - MATRIZ PERFIL -> PANELES DEL SIDEBAR */}
      {tabActiva === "matriz_paneles" && (
        <div>
          <div style={{ background: "var(--panel-linea-suave, #FAFAF9)", padding: "14px 18px", borderRadius: "10px", border: "1px solid var(--panel-linea, #E4E4E4)", marginBottom: "20px", fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
            <span style={{ fontWeight: 800, color: "var(--negro, #111111)" }}>💡 Paso 1: Configurar Opciones del Menú Lateral (Sidebar) por Perfil</span>
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
                        Widgets Autorizados ({p.widgetsAsignados.length}):
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                        {p.widgetsAsignados.map(w => (
                          <span key={w} style={{ fontSize: "0.75rem", fontWeight: 700, background: t.colorFondoSuave, color: t.colorTexto, border: `1px solid ${t.colorBorde}33`, padding: "4px 10px", borderRadius: "6px" }}>
                            <Check size={12} style={{ marginRight: 4, color: t.colorPrimario }} /> {w}
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
    </div>
  );
}
