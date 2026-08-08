"use client";

import { useState, useEffect } from "react";
import {
  Home, CircleUser, Settings, ShieldCheck, ClipboardList, Wrench, CreditCard,
  PanelLeft, Sliders, Folder, Activity, FileText,
  CheckSquare, Globe, Building, Sparkles, Phone, Lock, KeyRound, Terminal, Zap,
  Eye, Search, Pencil, LogOut, LogIn, type LucideIcon
} from "lucide-react";
import { EnlacePanel } from "./EnlacePanel";
import { BotonCerrarSesion } from "./BotonCerrarSesion";
import type { ModoRol } from "./SelectorRolActivo";

interface PanelDefNav {
  id: string;
  nombre: string;
  ruta: string;
  icono?: string;
  requiereMfa?: boolean;
}

interface PerfilEstadoSave {
  clave: string;
  widgetsAsignadosPorPanel?: Record<string, string[]>;
}

const MAPA_ICONOS_NAV: Record<string, LucideIcon> = {
  Home,
  User: CircleUser,
  CircleUser,
  Settings,
  Shield: ShieldCheck,
  ShieldCheck,
  Wrench,
  ClipboardList,
  CreditCard,
  Sliders,
  Folder,
  Activity,
  FileText,
  CheckSquare,
  Globe,
  Building,
  Sparkles,
  Phone,
  Lock,
  KeyRound,
  Terminal,
  Zap,
  Eye,
  Search,
  Pencil,
  LogOut,
  LogIn,
  PanelLeft,
};

// Configuración inicial por defecto de paneles
const PANELES_BASE_DEFAULT: PanelDefNav[] = [
  { id: "panel_inicio", nombre: "Inicio", ruta: "/panel", icono: "Home" },
  { id: "panel_administrar", nombre: "Administrar", ruta: "/panel/administrar", icono: "ShieldCheck" },
  { id: "panel_configuracion", nombre: "Configurar", ruta: "/panel/configuracion", icono: "Settings" },
  { id: "panel_cuenta", nombre: "Mi cuenta", ruta: "/panel/cuenta", icono: "CircleUser" },
  { id: "panel_tramites", nombre: "Mis trámites", ruta: "/panel/tramites", icono: "ClipboardList" },
  { id: "panel_herramientas", nombre: "Herramientas", ruta: "/panel/herramientas", icono: "Wrench" },
  { id: "panel_pagos", nombre: "Pagos y plan", ruta: "/panel/pagos", icono: "CreditCard" },
];

// Asignaciones por defecto de widgets por perfil
const PERFILES_PANEL_WIDGETS_DEFAULT: Record<string, Record<string, string[]>> = {
  CLIENTE: {
    panel_inicio: ["favoritos", "ultimos_accesos"],
    panel_cuenta: ["mi_cuenta", "ver_como", "datos_facturacion", "baja_cuenta"],
    panel_administrar: [], // Sin widgets -> [pronto]
    panel_configuracion: [], // Sin widgets -> [pronto]
    panel_tramites: [], // [pronto]
    panel_herramientas: [], // [pronto]
    panel_pagos: [], // [pronto]
  },
  ABOGADO: {
    panel_inicio: ["favoritos", "ultimos_accesos"],
    panel_cuenta: ["mi_cuenta", "ver_como", "datos_facturacion"],
    panel_administrar: ["socios", "solicitud_socio"],
    panel_configuracion: [],
    panel_tramites: [],
    panel_herramientas: [],
    panel_pagos: [],
  },
  OPERADOR: {
    panel_inicio: ["favoritos", "ultimos_accesos"],
    panel_cuenta: ["mi_cuenta", "ver_como"],
    panel_administrar: ["gestion_usuarios", "socios"],
    panel_configuracion: [],
    panel_tramites: [],
    panel_herramientas: [],
    panel_pagos: [],
  },
  ADMINISTRADOR: {
    panel_inicio: ["favoritos", "ultimos_accesos"],
    panel_cuenta: ["mi_cuenta", "ver_como", "datos_facturacion"],
    panel_administrar: ["gestion_usuarios", "socios", "solicitud_socio", "auditoria", "emision_notificaciones"],
    panel_configuracion: ["configuracion_negocio", "configuracion_correo", "gestion_perfiles"],
    panel_tramites: [],
    panel_herramientas: [],
    panel_pagos: [],
  },
  SUPERADMIN: {
    panel_inicio: ["favoritos", "ultimos_accesos"],
    panel_cuenta: ["mi_cuenta", "ver_como", "datos_facturacion"],
    panel_administrar: ["gestion_usuarios", "socios", "solicitud_socio", "auditoria", "emision_notificaciones"],
    panel_configuracion: ["configuracion_negocio", "configuracion_correo", "gestion_perfiles"],
    panel_tramites: [],
    panel_herramientas: [],
    panel_pagos: [],
  }
};

export function NavegacionSidebar({
  modoActivo,
  negocio = "tranqi"
}: {
  modoActivo: ModoRol;
  negocio?: string;
}) {
  const [paneles, setPaneles] = useState<PanelDefNav[]>(PANELES_BASE_DEFAULT);
  const [perfilMapaWidgets, setPerfilMapaWidgets] = useState<Record<string, string[]>>(
    () => PERFILES_PANEL_WIDGETS_DEFAULT[modoActivo.toUpperCase()] ?? PERFILES_PANEL_WIDGETS_DEFAULT["CLIENTE"] ?? {}
  );

  useEffect(() => {
    try {
      // Cargar paneles desde localStorage si se han personalizado en AdministracionPerfilesWidget
      const savedPaneles = localStorage.getItem(`tranqi_paneles_sidebar_${negocio}`);
      if (savedPaneles) {
        const parsed = JSON.parse(savedPaneles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPaneles(parsed);
        }
      }

      // Cargar asignación de widgets por perfil desde localStorage
      const savedPerfiles = localStorage.getItem(`tranqi_perfiles_${negocio}`);
      if (savedPerfiles) {
        const parsed = JSON.parse(savedPerfiles);
        if (Array.isArray(parsed)) {
          const perfilObj = parsed.find((p: PerfilEstadoSave) => p.clave?.toUpperCase() === modoActivo.toUpperCase());
          if (perfilObj && perfilObj.widgetsAsignadosPorPanel) {
            setPerfilMapaWidgets(perfilObj.widgetsAsignadosPorPanel);
          }
        }
      }
    } catch {
      // Fallback silencioso a configuracion por defecto
    }
  }, [modoActivo, negocio]);

  return (
    <div className="panel-nav-links">
      {paneles.map((p) => {
        const IconoComp = MAPA_ICONOS_NAV[p.icono || ""] || MAPA_ICONOS_NAV[p.id] || PanelLeft;
        
        // Determinar si el panel tiene widgets asignados para el perfil activo
        const asignadosLocales = perfilMapaWidgets[p.id] || [];
        const tieneWidgetsLocales = asignadosLocales.length > 0;
        
        // Caso especial para paneles núcleo obligatorios
        const esPanelNucleo = p.id === "panel_inicio" || p.id === "panel_cuenta";
        
        // Panel activo si tiene widgets asignados o es núcleo (o modo administrador/superadmin)
        const esPanelActivo = esPanelNucleo || tieneWidgetsLocales || modoActivo === "superadmin" || (modoActivo === "admin" && (p.id === "panel_administrar" || p.id === "panel_configuracion"));

        if (esPanelActivo) {
          return (
            <EnlacePanel
              key={p.id}
              href={p.ruta}
              icono={<IconoComp className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}
            >
              {p.nombre}
            </EnlacePanel>
          );
        }

        // Si NO tiene widgets asignados para este perfil -> Se muestra como "Próximamente" (pronto)
        return (
          <span className="enlace-inerte" key={p.id} title={`${p.nombre} - Próximamente (Sin módulos asignados)`}>
            <IconoComp className="icono-nav" aria-hidden="true" strokeWidth={1.8} />
            <span className="etiqueta-nav">{p.nombre}</span>
            <span className="chip-pronto-nav">pronto</span>
          </span>
        );
      })}

      {/* Botón único de Cerrar Sesión en el menú de navegación */}
      <BotonCerrarSesion variante="nav" />
    </div>
  );
}
