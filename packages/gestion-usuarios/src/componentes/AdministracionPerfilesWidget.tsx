"use client";

import React, { useState } from "react";
import {
  ShieldCheck, Users,
  CheckCircle2, ChevronDown, ChevronUp, Search, Sliders,
  Plus, Check, LayoutGrid, Layers, ExternalLink, PanelLeft, Eye, ArrowRight
} from "lucide-react";
import { guardarPerfil, guardarWidget, guardarAsignacionWidget } from "../acciones";

export interface PerfilDef {
  clave: string;
  nombre: string;
  nivel: number;
  ambito: string;
  descripcion: string;
  panelesAsignados: string[];
  widgetsAsignados: string[]; // Claves de widgets autorizados para este perfil
  activo: boolean;
  esSuperAdmin?: boolean;
}

export interface PanelSidebarDef {
  id: string;
  nombre: string;
  ruta: string;
  descripcion: string;
  widgetsDisponibles: string[];
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
    descripcion: "Pantalla principal que agrupa accesos rápidos y widgets según el rol del usuario.",
    widgetsDisponibles: ["favoritos", "ver_como", "notificaciones"]
  },
  {
    id: "panel_cuenta",
    nombre: "Mi Cuenta & Identidad",
    ruta: "/panel/cuenta",
    descripcion: "Perfil de usuario, conmutador de rol ('Ver como') e historial de accesos.",
    widgetsDisponibles: ["mi_cuenta", "ver_como", "historial_accesos"]
  },
  {
    id: "panel_configuracion",
    nombre: "Configuración & Gobernanza",
    ruta: "/panel/configuracion",
    descripcion: "Parámetros del negocio, servidor SMTP, perfiles y alertas de notificaciones.",
    widgetsDisponibles: ["configuracion_negocio", "configuracion_correo", "perfiles", "notificaciones"]
  },
  {
    id: "panel_usuarios",
    nombre: "Gestión de Usuarios",
    ruta: "/panel/usuarios",
    descripcion: "Administración de miembros, asignación de perfiles y techo jerárquico.",
    widgetsDisponibles: ["gestion_usuarios"]
  },
  {
    id: "panel_socios",
    nombre: "Aprobación de Socios",
    ruta: "/panel/socios",
    descripcion: "Validación de matrículas y acreditación de abogados.",
    widgetsDisponibles: ["socios"]
  },
  {
    id: "panel_auditoria",
    nombre: "Auditoría BDD",
    ruta: "/panel/auditoria",
    descripcion: "Consulta de registros inmutables PostgreSQL y telemetría de APIs.",
    widgetsDisponibles: ["auditoria"]
  },
  {
    id: "panel_emision",
    nombre: "Emisión Notificaciones",
    ruta: "/panel/emision-notificaciones",
    descripcion: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp).",
    widgetsDisponibles: ["emision_notificaciones"]
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
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("ADMINISTRADOR");

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

    // Actualizar estado local
    setPerfiles(perfiles.map(p => p.clave === perfilClave ? { ...p, widgetsAsignados: nuevosWidgets } : p));

    // Persistir en servidor vía Server Action
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

    // Actualizar inventario local
    setInventarioWidgets([...inventarioWidgets, widgetNuevoDef]);

    // Asignar el nuevo widget a los perfiles seleccionados
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

    // Guardar asignación en servidor para cada perfil autorizado
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

      {/* Banner de Arquitectura de 2 Niveles: Perfil -> Paneles (Sidebar) -> Widgets */}
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

      {/* TAB 2: ASIGNACIÓN DE WIDGETS POR PANEL & PERFIL (INTERACTIVA 100%) */}
      {tabActiva === "matriz_widgets" && (
        <div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", background: "var(--panel-papel, #F7F6FA)", padding: "14px 18px", borderRadius: "12px", border: "1px solid var(--panel-linea, #E4E4E4)" }}>
            <div style={{ minWidth: "280px" }}>
              <label style={{ fontSize: "0.82rem", fontWeight: 800, display: "block", marginBottom: "4px", color: "var(--violeta, #5000BA)" }}>
                👤 Selecciona Perfil / Rol Activo a Configurar:
              </label>
              <select
                value={perfilSeleccionado}
                onChange={e => setPerfilSeleccionado(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1.5px solid var(--violeta, #5000BA)", fontWeight: 800, fontSize: "0.9rem", background: "#ffffff", cursor: "pointer" }}
              >
                {perfiles.map(p => (
                  <option key={p.clave} value={p.clave}>{p.nombre} (Nivel {p.nivel})</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", flex: 1 }}>
              Mostrando widgets asignados para: <strong style={{ color: "#111" }}>{perfilActualObj?.nombre}</strong>.
              Las casillas marcadas <strong>[x]</strong> indican qué widgets están activos en los Paneles para este perfil.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {panelesSidebar.map(panel => {
              const widgetsDelPanel = inventarioWidgets.filter(w => w.panelId === panel.id);

              return (
                <div key={panel.id} style={{ border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "12px", padding: "16px", background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <PanelLeft size={18} color="var(--violeta, #5000BA)" />
                      <strong style={{ fontSize: "0.95rem" }}>{panel.nombre}</strong>
                      <code style={{ fontSize: "0.72rem", color: "var(--panel-gris, #737373)" }}>{panel.ruta}</code>
                    </div>
                    <a href={panel.ruta} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--violeta, #5000BA)", fontWeight: 700, textDecoration: "none" }}>
                      Previsualizar Panel ↗
                    </a>
                  </div>

                  <p style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", margin: "0 0 12px 0" }}>{panel.descripcion}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
                    {widgetsDelPanel.map(w => {
                      const estaAsignado = perfilActualObj?.widgetsAsignados.includes(w.clave) ?? false;

                      return (
                        <div
                          key={w.clave}
                          onClick={() => toggleWidgetPerfil(perfilSeleccionado, w.clave)}
                          style={{
                            background: estaAsignado ? "var(--panel-linea-suave, #FAFAF9)" : "#ffffff",
                            padding: "12px 14px",
                            borderRadius: "10px",
                            border: estaAsignado ? "1.5px solid var(--violeta, #5000BA)" : "1px solid var(--panel-linea, #E4E4E4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: estaAsignado ? "var(--violeta, #5000BA)" : "#111" }}>{w.nombre}</div>
                            <div style={{ fontSize: "0.68rem", color: "var(--panel-gris, #737373)" }}>{w.clave}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={estaAsignado}
                            onChange={() => {}} // Manejado por onClick contenedor
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--violeta, #5000BA)" }}
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
                {perfiles.map(p => (
                  <tr key={p.clave} style={{ borderBottom: "1px solid var(--panel-linea, #E4E4E4)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                      {p.nombre}
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
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--violeta, #5000BA)" }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTARIO COMPLETO DE WIDGETS CON PREVISUALIZACIÓN */}
      {tabActiva === "inventario_widgets" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 4px 0" }}>Inventario Completo de Widgets ({inventarioWidgets.length})</h4>
              <p style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", margin: 0 }}>
                Todos los widgets desarrollados en la plataforma con enlace directo de previsualización.
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

                <a
                  href={w.ruta}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "9px 12px",
                    background: "var(--violeta, #5000BA)",
                    color: "#ffffff",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    textDecoration: "none"
                  }}
                >
                  <Eye size={16} /> Pre-visualizar Widget / Abrir Panel <ExternalLink size={14} />
                </a>
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
              return (
                <div
                  key={p.clave}
                  style={{
                    border: "1px solid var(--panel-linea, #E4E4E4)",
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
                      background: desplegado ? "var(--panel-papel, #F7F6FA)" : "#ffffff",
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
                          background: p.esSuperAdmin ? "rgba(45, 27, 105, 0.1)" : "var(--panel-linea-suave, #FAFAF9)",
                          color: p.esSuperAdmin ? "#2D1B69" : "var(--violeta, #5000BA)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid var(--panel-linea, #E4E4E4)",
                          flexShrink: 0
                        }}
                      >
                        {p.esSuperAdmin ? <ShieldCheck size={20} /> : <Users size={20} />}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{p.nombre}</span>
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 8px", borderRadius: "999px", background: p.nivel >= 80 ? "#0A2B22" : "var(--panel-linea-suave, #FAFAF9)", color: p.nivel >= 80 ? "#fff" : "#111" }}>
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
                          <span key={w} style={{ fontSize: "0.75rem", fontWeight: 700, background: "var(--panel-linea-suave, #FAFAF9)", border: "1px solid var(--panel-linea, #E4E4E4)", padding: "4px 10px", borderRadius: "6px" }}>
                            <Check size={12} style={{ marginRight: 4, color: "green" }} /> {w}
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

            {/* SELECTOR DE PERFILES AUTORIZADOS */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", marginBottom: "6px", color: "var(--violeta, #5000BA)" }}>
                Perfiles Autorizados para este Widget:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {perfiles.map(p => {
                  const seleccionado = nuevoWidgetPerfiles.includes(p.clave);
                  return (
                    <label
                      key={p.clave}
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        background: seleccionado ? "var(--panel-linea-suave, #FAFAF9)" : "#ffffff",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: seleccionado ? "1.5px solid var(--violeta, #5000BA)" : "1px solid var(--panel-linea, #E4E4E4)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        color: seleccionado ? "var(--violeta, #5000BA)" : "#111"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => togglePerfilNuevoWidget(p.clave)}
                        style={{ accentColor: "var(--violeta, #5000BA)" }}
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
