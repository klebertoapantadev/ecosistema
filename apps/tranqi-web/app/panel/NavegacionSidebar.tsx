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
import { obtenerConfiguracionNavegacionRolAction } from "@eco/gestion-usuarios/acciones";

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
  { id: "panel_herramientas", nombre: "Herramientas", ruta: "/panel/herramientas", icono: "Wrench" },
  { id: "panel_seguridad", nombre: "Seguridad", ruta: "/panel/seguridad", icono: "Shield" },
];

const DEFAULT_PANELES_POR_ROL: Record<string, string[]> = {
  CLIENTE: ["panel_inicio", "panel_cuenta"],
  OPERADOR: ["panel_inicio", "panel_administrar", "panel_configuracion", "panel_cuenta", "panel_herramientas", "panel_seguridad"],
  AUXILIAR: ["panel_inicio", "panel_administrar", "panel_configuracion", "panel_cuenta", "panel_herramientas", "panel_seguridad"],
  TECNICO: ["panel_inicio", "panel_administrar", "panel_configuracion", "panel_cuenta", "panel_herramientas", "panel_seguridad"],
  ABOGADO: ["panel_inicio", "panel_cuenta", "panel_administrar"],
  ADMINISTRADOR: ["panel_inicio", "panel_administrar", "panel_configuracion", "panel_cuenta", "panel_herramientas", "panel_seguridad"],
  SUPERADMIN: ["panel_inicio", "panel_administrar", "panel_configuracion", "panel_cuenta", "panel_herramientas", "panel_seguridad"]
};

export function NavegacionSidebar({
  modoActivo,
  negocio = "tranqi"
}: {
  modoActivo: ModoRol;
  negocio?: string;
}) {
  const [panelesVisibles, setPanelesVisibles] = useState<PanelDefNav[]>(PANELES_BASE_DEFAULT);

  useEffect(() => {
    async function actualizarNavegacion() {
      try {
        const rolKey = (modoActivo || "CLIENTE").toUpperCase();
        const asignadosPorDefecto = DEFAULT_PANELES_POR_ROL[rolKey] || ["panel_inicio", "panel_cuenta"];

        const savedPaneles = localStorage.getItem(`tranqi_paneles_sidebar_${negocio}`) || localStorage.getItem("tranqi_paneles_sidebar_TRANQ");
        let listaPaneles: PanelDefNav[] = PANELES_BASE_DEFAULT;
        if (savedPaneles) {
          const parsed = JSON.parse(savedPaneles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Unir paneles por defecto con paneles personalizados guardados evitando duplicados
            const idsExistentes = new Set(parsed.map((p: PanelDefNav) => p.id));
            const baseSinDuplicados = PANELES_BASE_DEFAULT.filter(p => !idsExistentes.has(p.id));
            listaPaneles = [...baseSinDuplicados, ...parsed];
          }
        }

        // Consultar servidor (PostgreSQL comun_seguridad.seg_rol_widget)
        const resBdd = await obtenerConfiguracionNavegacionRolAction(modoActivo, negocio.toUpperCase());

        let panelesAsignados: string[] = [...asignadosPorDefecto];
        let widgetsPorPanel: Record<string, string[]> = {};

        if (resBdd.ok && resBdd.data) {
          if (resBdd.data.panelesAsignados && resBdd.data.panelesAsignados.length > 0) {
            panelesAsignados = Array.from(new Set([...panelesAsignados, ...resBdd.data.panelesAsignados]));
          }
          widgetsPorPanel = resBdd.data.widgetsPorPanel;
        }

        // Complementar con personalizaciones en localStorage si existen
        const savedPerfiles = localStorage.getItem(`tranqi_perfiles_${negocio}`) || localStorage.getItem("tranqi_perfiles_TRANQ");
        if (savedPerfiles) {
          const perfiles = JSON.parse(savedPerfiles);
          if (Array.isArray(perfiles)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === rolKey);
            if (perfilObj) {
              if (perfilObj.panelesAsignados && perfilObj.panelesAsignados.length > 0) {
                panelesAsignados = Array.from(new Set([...panelesAsignados, ...perfilObj.panelesAsignados]));
              }
              if (perfilObj.widgetsAsignadosPorPanel) {
                widgetsPorPanel = { ...widgetsPorPanel, ...perfilObj.widgetsAsignadosPorPanel };
              }
            }
          }
        }

        // Filtrar los paneles del sidebar según asignaciones BDD + Local + Defecto
        const filtrados = listaPaneles.filter((p) => {
          const esNucleo = p.id === "panel_inicio" || p.id === "panel_cuenta";
          const estaAsignado = panelesAsignados.includes(p.id);

          if (!estaAsignado && !esNucleo && rolKey !== "SUPERADMIN") {
            return false;
          }

          return true;
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
