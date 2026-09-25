"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Home, CircleUser, Settings, ShieldCheck, ClipboardList, Wrench, CreditCard,
  PanelLeft, Sliders, Folder, Activity, FileText, UserCog,
  CheckSquare, Globe, Building, Sparkles, Phone, Lock, KeyRound, Terminal, Zap,
  Eye, Search, Pencil, LogOut, LogIn, ShoppingBag, type LucideIcon
} from "lucide-react";
import { EnlacePanel } from "./EnlacePanel";
import { BotonCerrarSesion } from "./BotonCerrarSesion";
import type { ModoRol } from "./SelectorRolActivo";
import { useRail } from "./CapaPerfilRail";
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
  ShoppingBag,
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
          panel_cuenta: ["ver_como", "mi_cuenta", "datos_facturacion", "mfa_seguridad", "historial_accesos"],
          panel_herramientas: ["agendar_cita", "mis_citas", "catalogo_productos", "firma_documentos_pdf", "billetera_documentos", "solicitud_socio"],
          panel_configuracion: ["notificaciones"]
        };

        if (rolKey === "OPERADOR" || rolKey === "AUXILIAR" || rolKey === "TECNICO") {
          widgetsPorPanel = {
            ...widgetsPorPanel,
            panel_herramientas: ["catalogo_productos", "firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
            panel_administrar: ["asignaciones_agenda", 
              "crm_clientes",
              "socios",
              "solicitud_socio",
              "historial_pagos",
              "emision_notificaciones",
              "bitacora_notificaciones",
              "monitoreo_notificaciones_usuarios",
              "gestion_terminos_consentimientos",
              "configuracion_contrato_abogado",
              "consulta_usuarios_perfiles"
            ],
            panel_seguridad: ["auditoria"]
          };
        } else if (rolKey === "ABOGADO") {
          widgetsPorPanel = {
            ...widgetsPorPanel,
            panel_herramientas: ["citas_programadas", "disponibilidad", "crm_clientes", "catalogo_productos", "firma_documentos_pdf", "billetera_documentos"],
            panel_administrar: ["crm_clientes"]
          };
        } else if (rolKey === "ADMINISTRADOR") {
          widgetsPorPanel = {
            ...widgetsPorPanel,
            panel_herramientas: ["catalogo_productos", "firma_documentos_pdf", "billetera_documentos", "emision_notificaciones"],
            panel_configuracion: ["configuracion_negocio", "configuracion_correo", "pasarela_payphone", "perfiles", "agentes_ia", "notificaciones"],
            panel_administrar: ["asignaciones_agenda", 
              "crm_clientes",
              "gestion_usuarios",
              "consulta_usuarios_perfiles",
              "socios",
              "solicitud_socio",
              "historial_pagos",
              "emision_notificaciones",
              "bitacora_notificaciones",
              "monitoreo_notificaciones_usuarios",
              "gestion_terminos_consentimientos",
              "configuracion_contrato_abogado",
              "auditoria"
            ],
            panel_seguridad: ["auditoria"]
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

  const ruta = usePathname();
  const { plegado } = useRail();
  const contenedor = useRef<HTMLDivElement>(null);
  const indicador = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);

  // El indicador de la opción activa se desliza en vez de saltar (TRQ-013).
  // Se mide después de pintar los enlaces: cambian con la ruta, con los paneles
  // que llegan de la BDD y con el plegado, que cambia su alto.
  useLayoutEffect(() => {
    const caja = contenedor.current;
    const barra = indicador.current;
    if (!caja || !barra) return;
    const activo = caja.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!activo) {
      barra.style.opacity = "0";
      return;
    }
    barra.style.opacity = "1";
    barra.style.height = `${activo.offsetHeight}px`;
    barra.style.transform = `translateY(${activo.offsetTop}px)`;
    // La primera colocación va sin transición (si no, entra deslizándose
    // desde arriba al cargar); a partir de ahí, `data-listo` la activa.
    if (!barra.dataset.listo) requestAnimationFrame(() => { barra.dataset.listo = "1"; });
  }, [ruta, panelesVisibles, plegado]);

  // Plegado, las etiquetas no se ven: el nombre sale en un tooltip propio.
  // Es `position: fixed` para escapar del `overflow: hidden` del rail (lo
  // necesita la cinta). La x es el ancho plegado fijo y no se mide: si el
  // ratón llega mientras el rail aún se está cerrando, mediría el ancho abierto.
  useEffect(() => {
    const caja = contenedor.current;
    const tip = tooltip.current;
    if (!caja || !tip) return;
    const ocultar = () => tip.classList.remove("es-visible");
    if (!plegado) {
      ocultar();
      return;
    }
    const mostrar = (evento: Event) => {
      const destino = (evento.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (!destino || !caja.contains(destino)) return;
      const r = destino.getBoundingClientRect();
      tip.textContent = destino.dataset.tip ?? "";
      tip.style.top = `${r.top + r.height / 2}px`;
      tip.classList.add("es-visible");
    };
    caja.addEventListener("mouseover", mostrar);
    caja.addEventListener("focusin", mostrar);
    caja.addEventListener("mouseleave", ocultar);
    caja.addEventListener("focusout", ocultar);
    return () => {
      caja.removeEventListener("mouseover", mostrar);
      caja.removeEventListener("focusin", mostrar);
      caja.removeEventListener("mouseleave", ocultar);
      caja.removeEventListener("focusout", ocultar);
    };
  }, [plegado]);

  return (
    <div className="panel-nav-links" ref={contenedor}>
      <span className="indicador-nav" ref={indicador} aria-hidden="true" />
      <span className="tooltip-rail" ref={tooltip} aria-hidden="true" />
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
