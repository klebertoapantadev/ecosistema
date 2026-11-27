"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Share,
  ShoppingBag,
  Smartphone,
  X,
} from "lucide-react";

interface EventoInstalacionNavegador extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __ecoDeferredInstallPrompt?: EventoInstalacionNavegador | null;
  }
}

export interface ValorContextoBarraLateral {
  plegada: boolean;
  alternarPlegado: () => void;
  setPlegada: (valor: boolean) => void;
}

const ContextoBarraLateral = createContext<ValorContextoBarraLateral>({
  plegada: false,
  alternarPlegado: () => {},
  setPlegada: () => {},
});

export function useBarraLateralPanel(): ValorContextoBarraLateral {
  return useContext(ContextoBarraLateral);
}

export interface PropsMarcoPanelLateral {
  marcaNombre: string;
  marcaHref?: string;
  etiquetaRol?: string;
  estiloBadgeRol?: { bg: string; color: string };
  urlTienda?: string;
  etiquetaTienda?: string;
  barraLateral: React.ReactNode;
  children: React.ReactNode;
}

const STORAGE_SIDEBAR_KEY = "eco_panel_sidebar_plegado_v1";

export function MarcoPanelLateral({
  marcaNombre,
  marcaHref = "/panel",
  etiquetaRol,
  estiloBadgeRol,
  urlTienda = "/",
  etiquetaTienda = "Tienda",
  barraLateral,
  children,
}: PropsMarcoPanelLateral) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [plegada, setPlegadaEstado] = useState(false);
  const [esMovilViewport, setEsMovilViewport] = useState(false);
  const [appInstalada, setAppInstalada] = useState(false);
  const [esIos, setEsIos] = useState(false);
  const [promptInstalacion, setPromptInstalacion] =
    useState<EventoInstalacionNavegador | null>(null);
  const [mostrarGuiaInstalacion, setMostrarGuiaInstalacion] = useState(false);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const guardado = window.localStorage.getItem(STORAGE_SIDEBAR_KEY);
      if (guardado === "1") {
        setPlegadaEstado(true);
      }
    } catch {
      // Ignorar restricciones de almacenamiento
    }

    const revisarAncho = () => {
      setEsMovilViewport(window.innerWidth <= 880);
    };
    revisarAncho();
    window.addEventListener("resize", revisarAncho);
    return () => window.removeEventListener("resize", revisarAncho);
  }, []);

  const setPlegada = useCallback((valor: boolean) => {
    setPlegadaEstado(valor);
    try {
      window.localStorage.setItem(STORAGE_SIDEBAR_KEY, valor ? "1" : "0");
    } catch {
      // Ignorar
    }
  }, []);

  const alternarPlegado = useCallback(() => {
    setPlegadaEstado((prev) => {
      const siguiente = !prev;
      try {
        window.localStorage.setItem(STORAGE_SIDEBAR_KEY, siguiente ? "1" : "0");
      } catch {
        // Ignorar
      }
      return siguiente;
    });
  }, []);

  // Atajo rápido Ctrl+B / Cmd+B para plegar o desplegar la barra lateral
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "b") {
        const tag = (ev.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (ev.target as HTMLElement | null)?.isContentEditable) {
          return;
        }
        ev.preventDefault();
        alternarPlegado();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alternarPlegado]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    setAppInstalada(standalone);

    const ua = window.navigator.userAgent || "";
    setEsIos(/iPad|iPhone|iPod/i.test(ua));

    if (window.__ecoDeferredInstallPrompt) {
      setPromptInstalacion(window.__ecoDeferredInstallPrompt);
    }

    const onBeforeInstall = (ev: Event) => {
      ev.preventDefault();
      const castEv = ev as EventoInstalacionNavegador;
      window.__ecoDeferredInstallPrompt = castEv;
      setPromptInstalacion(castEv);
    };

    const onAppInstalled = () => {
      window.__ecoDeferredInstallPrompt = null;
      setPromptInstalacion(null);
      setAppInstalada(true);
      setMostrarGuiaInstalacion(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw-operaciones.js", { scope: "/" })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;
    const alPresionarTecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenuAbierto(false);
    };
    window.addEventListener("keydown", alPresionarTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPresionarTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [menuAbierto]);

  const handleInstalarAplicacion = useCallback(async () => {
    const diferido =
      promptInstalacion ||
      (typeof window !== "undefined" ? window.__ecoDeferredInstallPrompt : null);

    if (diferido) {
      try {
        await diferido.prompt();
        const decision = await diferido.userChoice;
        if (decision.outcome === "accepted") {
          window.__ecoDeferredInstallPrompt = null;
          setPromptInstalacion(null);
          setAppInstalada(true);
        }
        return;
      } catch {
        // Mostrar guía manual si el navegador requiere acción desde menú
      }
    }
    setMostrarGuiaInstalacion(true);
  }, [promptInstalacion]);

  const plegadaEfectiva = !esMovilViewport && !menuAbierto && plegada;

  return (
    <ContextoBarraLateral.Provider
      value={{
        plegada: plegadaEfectiva,
        alternarPlegado,
        setPlegada,
      }}
    >
      <div className={`panel-layout${plegadaEfectiva ? " panel-layout-plegado" : ""}`}>
        {/* Barra superior exclusiva para móvil/tablet (<= 880px) */}
        <header className="panel-barra-movil">
          <div className="panel-barra-movil-izq">
            <button
              type="button"
              className="panel-btn-hamburguesa"
              onClick={() => setMenuAbierto(true)}
              title="Abrir menú del panel"
              aria-label="Abrir menú del panel"
              aria-expanded={menuAbierto}
            >
              <Menu size={20} />
            </button>
            <Link href={marcaHref} className="panel-marca-movil">
              {marcaNombre}
            </Link>
            {etiquetaRol && (
              <span
                className="etiqueta-superadmin panel-rol-movil"
                style={
                  estiloBadgeRol
                    ? { background: estiloBadgeRol.bg, color: estiloBadgeRol.color }
                    : undefined
                }
              >
                {etiquetaRol}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {!appInstalada && (
              <button
                type="button"
                className="btn-responsive-accion"
                onClick={() => void handleInstalarAplicacion()}
                title="Instalar aplicación en el teléfono para acceso rápido y uso sin internet"
                aria-label="Instalar App"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "7px 10px",
                  borderRadius: "999px",
                  border: "1px solid rgba(52, 211, 153, 0.45)",
                  background: "rgba(6, 95, 70, 0.85)",
                  color: "#F2F6F3",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={14} />
                <span className="btn-texto-responsive">Instalar</span>
              </button>
            )}

            {urlTienda && (
              <Link
                href={urlTienda}
                className="panel-link-tienda-movil btn-responsive-accion"
                title={`Ir a ${etiquetaTienda}`}
                aria-label={`Ir a ${etiquetaTienda}`}
              >
                <ShoppingBag size={15} />
                <span className="btn-texto-responsive">{etiquetaTienda}</span>
              </Link>
            )}
          </div>
        </header>

        {/* Fondo semitransparente al abrir el menú en móvil */}
        <div
          className={`panel-nav-backdrop${menuAbierto ? " activo" : ""}`}
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />

        {/* Menú lateral plegable en desktop y deslizable en móvil */}
        <aside
          className={`panel-nav${menuAbierto ? " panel-nav-abierto" : ""}${
            plegadaEfectiva ? " panel-nav-plegado" : ""
          }`}
          onClick={(ev) => {
            const target = ev.target as HTMLElement | null;
            if (target?.closest("a")) {
              setMenuAbierto(false);
            }
          }}
        >
          <button
            type="button"
            className="panel-nav-btn-cerrar"
            onClick={() => setMenuAbierto(false)}
            title="Cerrar menú"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>

          {/* Botón superior discreto para plegar / expandir barra lateral en escritorio */}
          {!esMovilViewport && (
            <div
              className="panel-nav-barra-plegado"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: plegadaEfectiva ? "center" : "flex-end",
                marginBottom: "-10px",
              }}
            >
              <button
                type="button"
                onClick={alternarPlegado}
                title={
                  plegadaEfectiva
                    ? "Expandir barra lateral (Ctrl+B)"
                    : "Plegar barra lateral para ganar espacio (Ctrl+B)"
                }
                aria-label={plegadaEfectiva ? "Expandir menú" : "Plegar menú"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  padding: plegadaEfectiva ? "7px" : "5px 9px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-ffffff-a140, rgba(255, 255, 255, 0.14))",
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "rgba(255, 255, 255, 0.85)",
                  fontSize: "0.71rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                {plegadaEfectiva ? (
                  <PanelLeftOpen size={15} />
                ) : (
                  <>
                    <PanelLeftClose size={14} />
                    <span>Ocultar</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Pestaña flotante en el borde derecho del menú para expandir/plegar con 1 clic */}
          {!esMovilViewport && (
            <button
              type="button"
              className="panel-nav-tirador-borde"
              onClick={alternarPlegado}
              title={plegadaEfectiva ? "Expandir menú lateral" : "Plegar menú lateral"}
              aria-label={plegadaEfectiva ? "Expandir menú" : "Plegar menú"}
            >
              {plegadaEfectiva ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          )}

          {barraLateral}

          {!appInstalada && (
            <div style={{ paddingTop: "8px", marginTop: "auto" }}>
              <button
                type="button"
                onClick={() => {
                  setMenuAbierto(false);
                  void handleInstalarAplicacion();
                }}
                title="Instalar aplicación en la pantalla principal del dispositivo"
                aria-label="Instalar App"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: plegadaEfectiva ? "10px 0" : "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(52, 211, 153, 0.35)",
                  background: "rgba(16, 185, 129, 0.16)",
                  color: "#CEDDD3",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Smartphone size={16} />
                {!plegadaEfectiva && <span>Instalar App</span>}
              </button>
            </div>
          )}
        </aside>

        <main className="panel-contenido">{children}</main>

        {mostrarGuiaInstalacion && (
          <div
            onClick={() => setMostrarGuiaInstalacion(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Instalar aplicación"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "18px",
              zIndex: 10000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "400px",
                background: "var(--cf-ffffff, #FFFFFF)",
                borderRadius: "16px",
                padding: "22px",
                boxShadow: "0 20px 38px rgba(0,0,0,0.28)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                color: "var(--ct-1f1c19, #1F1C19)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Smartphone size={20} color="#2F4737" />
                  <strong style={{ fontSize: "1.02rem" }}>
                    Instalar App {marcaNombre}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarGuiaInstalacion(false)}
                  title="Cerrar guía de instalación"
                  aria-label="Cerrar"
                  style={{
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    borderRadius: "8px",
                    width: "32px",
                    height: "32px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "var(--ct-57524c, #57524C)" }}>
                Instala la aplicación en la pantalla de inicio de tu celular para capturar fotos GPS y
                confirmar entregas incluso sin conexión a internet:
              </p>

              {esIos ? (
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    fontSize: "0.84rem",
                    lineHeight: 1.55,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Share size={16} color="#221E1B" />
                    <span>
                      <strong>1.</strong> Toca el botón <strong>Compartir</strong> en la barra de Safari.
                    </span>
                  </div>
                  <div>
                    <strong>2.</strong> Selecciona <strong>«Agregar a Inicio»</strong> y toca{" "}
                    <strong>Agregar</strong>.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    fontSize: "0.84rem",
                    lineHeight: 1.55,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong>1.</strong> Toca el menú <strong>⋮</strong> (tres puntos arriba a la
                    derecha en Chrome).
                  </div>
                  <div>
                    <strong>2.</strong> Elige <strong>«Instalar aplicación»</strong> o{" "}
                    <strong>«Agregar a la pantalla principal»</strong>.
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMostrarGuiaInstalacion(false)}
                title="Cerrar ventana"
                aria-label="Entendido"
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
    </ContextoBarraLateral.Provider>
  );
}
