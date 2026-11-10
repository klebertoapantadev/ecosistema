"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Download, BellRing, WifiOff, Share, PlusSquare, CheckCircle2, X, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function GestorPwaCliente() {
  const pathname = usePathname();
  const enPanel = Boolean(pathname && pathname.startsWith("/panel"));

  const [enLinea, setEnLinea] = useState(true);
  const [instalada, setInstalada] = useState(false);
  const [esIos, setEsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarGuiaIos, setMostrarGuiaIos] = useState(false);
  const [pushActivo, setPushActivo] = useState(false);
  const [procesandoPush, setProcesandoPush] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);
  const [bannerOculto, setBannerOculto] = useState(true);

  const mostrarAvisoTemporal = useCallback((texto: string) => {
    setMensajeEstado(texto);
    setTimeout(() => {
      setMensajeEstado((actual) => (actual === texto ? null : actual));
    }, 4500);
  }, []);

  const sincronizarSuscripcionExistente = useCallback(async (reg: ServiceWorkerRegistration) => {
    try {
      if (!("pushManager" in reg)) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setPushActivo(true);
        // Asegurar que esté registrada en el servidor para el usuario autenticado
        const json = sub.toJSON();
        if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
          await fetch("/api/pwa/suscripcion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accion: "suscribir",
              enviarConfirmacion: false,
              subscription: {
                endpoint: json.endpoint,
                keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
              },
            }),
          }).catch(() => {});
        }
      }
    } catch {
      /* Ignorar si el navegador bloquea pushManager */
    }
  }, []);

  const activarNotificacionesPush = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      mostrarAvisoTemporal("Tu navegador no soporta Service Workers.");
      return;
    }
    if (!("Notification" in window) || !("PushManager" in window)) {
      if (esIos && !instalada) {
        setMostrarGuiaIos(true);
        return;
      }
      mostrarAvisoTemporal("Este navegador no soporta notificaciones Web Push.");
      return;
    }

    setProcesandoPush(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        mostrarAvisoTemporal("Debes permitir las notificaciones en tu navegador.");
        setProcesandoPush(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const resCfg = await fetch("/api/pwa/suscripcion");
      const cfg = await resCfg.json();
      if (!cfg.ok || !cfg.publicKey) {
        throw new Error("No se pudo obtener la llave pública VAPID");
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const appServerKey = urlBase64ToUint8Array(cfg.publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });
      }

      const subJson = sub.toJSON();
      const resPost = await fetch("/api/pwa/suscripcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "suscribir",
          enviarConfirmacion: true,
          subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          },
        }),
      });

      const postData = await resPost.json();
      if (postData.ok) {
        setPushActivo(true);
        mostrarAvisoTemporal("¡Notificaciones Push activadas en este dispositivo!");
      } else {
        mostrarAvisoTemporal(postData.error || "No se pudo guardar la suscripción Push.");
      }
    } catch (err) {
      mostrarAvisoTemporal(
        err instanceof Error ? err.message : "Error al activar notificaciones Push."
      );
    } finally {
      setProcesandoPush(false);
    }
  }, [esIos, instalada, mostrarAvisoTemporal]);

  const dispararInstalacion = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalada(true);
          setDeferredPrompt(null);
          mostrarAvisoTemporal("¡Aplicación tranqi instalada con éxito!");
        }
      } catch {}
      return;
    }
    if (esIos && !instalada) {
      setMostrarGuiaIos(true);
      return;
    }
    mostrarAvisoTemporal("Usa el menú de tu navegador → 'Instalar aplicación' o 'Agregar a pantalla de inicio'.");
  }, [deferredPrompt, esIos, instalada, mostrarAvisoTemporal]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setEnLinea(navigator.onLine);
    const onOnline = () => setEnLinea(true);
    const onOffline = () => setEnLinea(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Detectar si ya corre como PWA instalada (standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Boolean((window.navigator as any).standalone);
    setInstalada(isStandalone);

    // Detectar iOS (iPhone / iPad)
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDetectado = /iphone|ipad|ipod/.test(ua);
    setEsIos(iosDetectado);

    // Verificar si el usuario ocultó el banner recientemente
    try {
      const oculto = localStorage.getItem("tranqi_pwa_banner_oculto");
      setBannerOculto(oculto === "1");
    } catch {
      setBannerOculto(false);
    }

    // Registrar Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          sincronizarSuscripcionExistente(reg);
        })
        .catch(() => {});
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalada(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [sincronizarSuscripcionExistente]);

  // Escuchar eventos globales disparados desde CampanaNotificaciones o Mi Cuenta
  useEffect(() => {
    const handleInstalar = () => dispararInstalacion();
    const handlePush = () => activarNotificacionesPush();

    window.addEventListener("tranqi:instalar-pwa", handleInstalar);
    window.addEventListener("tranqi:activar-push", handlePush);
    return () => {
      window.removeEventListener("tranqi:instalar-pwa", handleInstalar);
      window.removeEventListener("tranqi:activar-push", handlePush);
    };
  }, [dispararInstalacion, activarNotificacionesPush]);

  const ocultarBannerPwa = () => {
    setBannerOculto(true);
    try {
      localStorage.setItem("tranqi_pwa_banner_oculto", "1");
    } catch {}
  };

  const mostrarBarraPanel =
    enPanel && !bannerOculto && ((!instalada && (Boolean(deferredPrompt) || esIos)) || !pushActivo);

  return (
    <>
      {/* Píldora flotante cuando el dispositivo pierde conexión a internet */}
      {!enLinea && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100000,
            background: "#141019",
            color: "#FAEB2C",
            border: "1px solid rgba(250, 235, 44, 0.45)",
            borderRadius: "999px",
            padding: "7px 16px",
            fontSize: "0.76rem",
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
            whiteSpace: "nowrap",
          }}
        >
          <WifiOff size={14} />
          <span>Modo Offline · Viendo datos en caché</span>
        </div>
      )}

      {/* Toast de retroalimentación al instalar o activar Push */}
      {mensajeEstado && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "82px",
            right: "16px",
            zIndex: 100001,
            background: "#141019",
            color: "#FFFFFF",
            border: "1px solid #5000BA",
            borderRadius: "14px",
            padding: "12px 16px",
            fontSize: "0.82rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.35)",
            maxWidth: "340px",
          }}
        >
          <CheckCircle2 size={18} color="#D8FFB3" style={{ flexShrink: 0 }} />
          <span>{mensajeEstado}</span>
        </div>
      )}

      {/* Barra discreta dentro del Panel (solo para usuarios registrados) para instalar PWA o activar Push */}
      {mostrarBarraPanel && (
        <div
          style={{
            position: "fixed",
            bottom: "74px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 990,
            background: "linear-gradient(135deg, #2D006B 0%, #5000BA 100%)",
            color: "#FFFFFF",
            borderRadius: "16px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 14px 34px rgba(20, 16, 25, 0.38)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            maxWidth: "calc(100vw - 24px)",
            width: "fit-content",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} color="#FAEB2C" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>
              App tranqi (Offline & Alertas Push)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {!instalada && (Boolean(deferredPrompt) || esIos) && (
              <button
                type="button"
                onClick={dispararInstalacion}
                title="Instalar aplicación tranqi en este dispositivo"
                aria-label="Instalar aplicación tranqi"
                style={{
                  background: "#FAEB2C",
                  color: "#141019",
                  border: "none",
                  borderRadius: "999px",
                  padding: "6px 12px",
                  fontSize: "0.74rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={13} />
                <span>Instalar App</span>
              </button>
            )}

            {!pushActivo && (
              <button
                type="button"
                onClick={activarNotificacionesPush}
                disabled={procesandoPush}
                title="Activar notificaciones Push incluso con el navegador cerrado"
                aria-label="Activar notificaciones Push"
                style={{
                  background: "rgba(255, 255, 255, 0.16)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.35)",
                  borderRadius: "999px",
                  padding: "6px 12px",
                  fontSize: "0.74rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  whiteSpace: "nowrap",
                }}
              >
                <BellRing size={13} />
                <span>{procesandoPush ? "Activando..." : "Activar Push"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={ocultarBannerPwa}
              title="Ocultar aviso de instalación"
              aria-label="Cerrar aviso"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.75)",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Modal de instrucciones de 1 paso para iOS (Safari en iPhone / iPad) */}
      {mostrarGuiaIos && (
        <div
          onClick={() => setMostrarGuiaIos(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100002,
            background: "rgba(20, 16, 25, 0.72)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              color: "#141019",
              borderRadius: "20px",
              padding: "24px",
              maxWidth: "380px",
              width: "100%",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 900, color: "#5000BA" }}>
                Instalar tranqi en tu iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setMostrarGuiaIos(false)}
                aria-label="Cerrar guía"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.86rem", color: "#475569", lineHeight: 1.5, marginBottom: "16px" }}>
              Para usar <strong>tranqi</strong> a pantalla completa, trabajar sin conexión y recibir notificaciones Push con el navegador cerrado:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.84rem", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#F8FAFC", padding: "10px 12px", borderRadius: "12px" }}>
                <Share size={18} color="#5000BA" style={{ flexShrink: 0 }} />
                <span>1. Toca el botón <strong>Compartir</strong> en la barra de Safari.</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#F8FAFC", padding: "10px 12px", borderRadius: "12px" }}>
                <PlusSquare size={18} color="#5000BA" style={{ flexShrink: 0 }} />
                <span>2. Selecciona <strong>«Agregar a pantalla de inicio»</strong>.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMostrarGuiaIos(false)}
              style={{
                width: "100%",
                background: "#5000BA",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "12px",
                padding: "10px 16px",
                fontWeight: 800,
                fontSize: "0.86rem",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
