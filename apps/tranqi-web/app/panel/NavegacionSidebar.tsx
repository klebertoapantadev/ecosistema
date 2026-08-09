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

// Configuración inicial de paneles base del ecosistema
const PANELES_BASE_DEFAULT: PanelDefNav[] = [
  { id: "panel_inicio", nombre: "Inicio", ruta: "/panel", icono: "Home" },
  { id: "panel_administrar", nombre: "Administrar", ruta: "/panel/administrar", icono: "ShieldCheck" },
  { id: "panel_configuracion", nombre: "Configurar", ruta: "/panel/configuracion", icono: "Settings" },
  { id: "panel_cuenta", nombre: "Mi cuenta", ruta: "/panel/cuenta", icono: "CircleUser" },
];

export function NavegacionSidebar({
  modoActivo,
  negocio = "tranqi"
}: {
  modoActivo: ModoRol;
  negocio?: string;
}) {
  const [panelesVisibles, setPanelesVisibles] = useState<PanelDefNav[]>(PANELES_BASE_DEFAULT);

  useEffect(() => {
    function actualizarNavegacion() {
      try {
        const savedPaneles = localStorage.getItem(`tranqi_paneles_sidebar_${negocio}`) || localStorage.getItem("tranqi_paneles_sidebar_TRANQ");
        let listaPaneles: PanelDefNav[] = PANELES_BASE_DEFAULT;
        if (savedPaneles) {
          const parsed = JSON.parse(savedPaneles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            listaPaneles = parsed;
          }
        }

        const savedPerfiles = localStorage.getItem(`tranqi_perfiles_${negocio}`) || localStorage.getItem("tranqi_perfiles_TRANQ");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let perfilObj: any = null;
        if (savedPerfiles) {
          const perfiles = JSON.parse(savedPerfiles);
          if (Array.isArray(perfiles)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === modoActivo.toUpperCase());
            if (!perfilObj && modoActivo === "admin") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === "ADMINISTRADOR");
            }
          }
        }

        // Obtener paneles asignados al rol activo desde la matriz de perfiles
        const panelesAsignados: string[] = perfilObj?.panelesAsignados || [];
        const widgetsPorPanel: Record<string, string[]> = perfilObj?.widgetsAsignadosPorPanel || {};

        // Filtrar únicamente los paneles configurados en el sistema y asignados para el rol
        const filtrados = listaPaneles.filter((p) => {
          const esNucleo = p.id === "panel_inicio" || p.id === "panel_cuenta";
          const estaAsignadoEnPerfil = panelesAsignados.length > 0 ? panelesAsignados.includes(p.id) : true;

          if (!estaAsignadoEnPerfil && !esNucleo && modoActivo !== "superadmin") {
            return false;
          }

          // Si es un panel administrativo o de configuración, verificar asignaciones
          const widgetsDelPanel = widgetsPorPanel[p.id] || [];
          if (p.id === "panel_administrar" || p.id === "panel_configuracion") {
            return estaAsignadoEnPerfil && (widgetsDelPanel.length > 0 || modoActivo === "admin" || modoActivo === "superadmin");
          }

          return estaAsignadoEnPerfil;
        });

        setPanelesVisibles(filtrados.length > 0 ? filtrados : PANELES_BASE_DEFAULT);
      } catch (err) {
        console.error("Error cargando navegación sidebar:", err);
        setPanelesVisibles(PANELES_BASE_DEFAULT);
      }
    }

    actualizarNavegacion();
    window.addEventListener("storage", actualizarNavegacion);
    return () => window.removeEventListener("storage", actualizarNavegacion);
  }, [modoActivo, negocio]);

  return (
    <div className="panel-nav-links">
      {panelesVisibles.map((p) => {
        const IconoComp = MAPA_ICONOS_NAV[p.icono || ""] || MAPA_ICONOS_NAV[p.id] || PanelLeft;
        return (
          <EnlacePanel
            key={p.id}
            href={p.ruta}
            icono={<IconoComp className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}
          >
            {p.nombre}
          </EnlacePanel>
        );
      })}

      <BotonCerrarSesion variante="nav" />
    </div>
  );
}
