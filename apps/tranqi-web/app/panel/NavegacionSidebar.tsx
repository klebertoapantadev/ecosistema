"use client";

import { useState, useEffect } from "react";
import {
  Home, CircleUser, Settings, ShieldCheck, ClipboardList, Wrench, CreditCard,
  PanelLeft, Sliders, Folder, Activity, FileText, UserCog,
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
  UserCog,
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
  panel_inicio: Home,
  panel_administrar: UserCog,
  panel_configuracion: Settings,
  panel_cuenta: CircleUser,
  panel_herramientas: Wrench,
  panel_seguridad: ShieldCheck,
};

// Configuración inicial de paneles base del ecosistema
const PANELES_BASE_DEFAULT: PanelDefNav[] = [
  { id: "panel_inicio", nombre: "Inicio", ruta: "/panel", icono: "Home" },
  { id: "panel_administrar", nombre: "Administrar", ruta: "/panel/administrar", icono: "UserCog" },
  { id: "panel_configuracion", nombre: "Configurar", ruta: "/panel/configuracion", icono: "Settings" },
  { id: "panel_cuenta", nombre: "Mi cuenta", ruta: "/panel/cuenta", icono: "CircleUser" },
  { id: "panel_herramientas", nombre: "Herramientas", ruta: "/panel/herramientas", icono: "Wrench" },
  { id: "panel_seguridad", nombre: "Seguridad", ruta: "/panel/seguridad", icono: "Shield" },
];

function obtenerPanelesInicialesPorRol(modoActivo: ModoRol): PanelDefNav[] {
  const rolKey = (modoActivo || "CLIENTE").toUpperCase();

  if (rolKey === "SUPERADMIN") {
    return PANELES_BASE_DEFAULT.filter(p => p.id === "panel_inicio" || p.id === "panel_cuenta");
  }

  if (rolKey === "OPERADOR" || rolKey === "AUXILIAR" || rolKey === "TECNICO") {
    return PANELES_BASE_DEFAULT.filter(p => p.id !== "panel_configuracion");
  }

  if (rolKey === "CLIENTE" || rolKey === "ABOGADO") {
    return PANELES_BASE_DEFAULT.filter(p => p.id === "panel_inicio" || p.id === "panel_cuenta" || p.id === "panel_herramientas");
  }

  return PANELES_BASE_DEFAULT;
}

export function NavegacionSidebar({
  modoActivo,
  negocio = "tranqi"
}: {
  modoActivo: ModoRol;
  negocio?: string;
}) {
  const [panelesVisibles, setPanelesVisibles] = useState<PanelDefNav[]>(() => obtenerPanelesInicialesPorRol(modoActivo));

  useEffect(() => {
    async function actualizarNavegacion() {
      try {
        const rolKey = (modoActivo || "CLIENTE").toUpperCase();

        // REGLA SUPERADMIN: Mostrar únicamente Inicio y Mi Cuenta en el sidebar (todos los widgets se muestran en el menú Inicio /panel)
        if (rolKey === "SUPERADMIN") {
          const panelesSuperAdmin = PANELES_BASE_DEFAULT.filter(p => p.id === "panel_inicio" || p.id === "panel_cuenta");
          setPanelesVisibles(panelesSuperAdmin);
          return;
        }

        const savedPaneles = localStorage.getItem(`tranqi_paneles_sidebar_${negocio}`) || localStorage.getItem("tranqi_paneles_sidebar_TRANQ");
        let listaPaneles: PanelDefNav[] = PANELES_BASE_DEFAULT;
        if (savedPaneles) {
          const parsed = JSON.parse(savedPaneles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const idsExistentes = new Set(parsed.map((p: PanelDefNav) => p.id));
            const baseSinDuplicados = PANELES_BASE_DEFAULT.filter(p => !idsExistentes.has(p.id));
            listaPaneles = [...baseSinDuplicados, ...parsed];
          }
        }

        // Consultar servidor (PostgreSQL comun_seguridad.seg_rol_widget)
        const resBdd = await obtenerConfiguracionNavegacionRolAction(modoActivo, negocio.toUpperCase());

        let widgetsPorPanel: Record<string, string[]> = {
          panel_inicio: ["favoritos"],
          panel_cuenta: ["ver_como", "mi_cuenta"],
          panel_herramientas: ["firma_documentos_pdf", "billetera_documentos"]
        };

        if (rolKey === "OPERADOR" || rolKey === "AUXILIAR" || rolKey === "TECNICO") {
          widgetsPorPanel = {
            ...widgetsPorPanel,
            panel_administrar: ["socios"],
            panel_herramientas: ["firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
            panel_seguridad: ["auditoria", "solicitud_socio"]
          };
        } else if (rolKey === "ADMINISTRADOR") {
          widgetsPorPanel = {
            ...widgetsPorPanel,
            panel_configuracion: ["configuracion_negocio", "configuracion_correo", "perfiles", "notificaciones"],
            panel_administrar: ["gestion_usuarios", "socios", "solicitud_socio", "emision_notificaciones", "auditoria"],
            panel_herramientas: ["firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
            panel_seguridad: ["auditoria"]
          };
        } else if (rolKey === "CLIENTE" || rolKey === "ABOGADO") {
          widgetsPorPanel = {
            ...widgetsPorPanel,
            panel_herramientas: ["firma_documentos_pdf", "billetera_documentos"]
          };
        }

        if (resBdd.ok && resBdd.data && resBdd.data.widgetsPorPanel) {
          widgetsPorPanel = { ...widgetsPorPanel, ...resBdd.data.widgetsPorPanel };
        }

        // Complementar con personalizaciones en localStorage si existen
        const savedPerfiles = localStorage.getItem(`tranqi_perfiles_${negocio}`) || localStorage.getItem("tranqi_perfiles_TRANQ");
        if (savedPerfiles) {
          const perfiles = JSON.parse(savedPerfiles);
          if (Array.isArray(perfiles)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === rolKey);
            if (perfilObj && perfilObj.widgetsAsignadosPorPanel) {
              widgetsPorPanel = { ...widgetsPorPanel, ...perfilObj.widgetsAsignadosPorPanel };
            }
          }
        }

        // REGLA GENERAL: Mostrar panel únicamente si tiene al menos 1 widget asignado (o si es panel de inicio / mi cuenta)
        const filtrados = listaPaneles.filter((p) => {
          const esNucleo = p.id === "panel_inicio" || p.id === "panel_cuenta";
          if (esNucleo) return true;

          const widgetsDelPanel = widgetsPorPanel[p.id] || [];
          return widgetsDelPanel.length > 0;
        });

        setPanelesVisibles(filtrados.length > 0 ? filtrados : PANELES_BASE_DEFAULT.slice(0, 2));
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
