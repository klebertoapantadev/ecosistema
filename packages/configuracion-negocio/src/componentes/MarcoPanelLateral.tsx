"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Menu, Share, ShoppingBag, Smartphone, X } from "lucide-react";

interface EventoInstalacionNavegador extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __ecoDeferredInstallPrompt?: EventoInstalacionNavegador | null;
  }
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

  return (
    <div className="panel-layout">
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

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {!appInstalada && (
            <button
              type="button"
              onClick={() => void handleInstalarAplicacion()}
              title="Instalar aplicación en el teléfono para acceso rápido y uso sin internet"
              aria-label="Instalar App"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 10px",
                borderRadius: "999px",
                border: "1px solid rgba(52, 211, 153, 0.45)",
                background: "rgba(6, 95, 70, 0.85)",
                color: "#ECFDF5",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Download size={13} />
              <span>Instalar</span>
            </button>
          )}

          {urlTienda && (
            <Link
              href={urlTienda}
              className="panel-link-tienda-movil"
              title={`Ir a ${etiquetaTienda}`}
              aria-label={`Ir a ${etiquetaTienda}`}
            >
              <ShoppingBag size={15} />
              <span>{etiquetaTienda}</span>
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

      {/* Menú lateral (fijo en desktop, drawer deslizable en móvil) */}
      <aside
        className={`panel-nav${menuAbierto ? " panel-nav-abierto" : ""}`}
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
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(52, 211, 153, 0.35)",
                background: "rgba(16, 185, 129, 0.16)",
                color: "#A7F3D0",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Smartphone size={16} />
              <span>Instalar Aplicación</span>
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
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "22px",
              boxShadow: "0 20px 38px rgba(0,0,0,0.28)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              color: "#0F172A",
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
                <Smartphone size={20} color="#059669" />
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
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
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

            <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.5, color: "#475569" }}>
              Instala la aplicación en la pantalla de inicio de tu celular para capturar fotos GPS y
              confirmar entregas incluso sin conexión a internet:
            </p>

            {esIos ? (
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
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
                  <Share size={16} color="#2563EB" />
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
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
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
                background: "#059669",
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
  );
}
