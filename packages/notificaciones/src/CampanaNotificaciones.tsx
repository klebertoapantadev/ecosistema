"use client";

import React, { useState } from "react";
import { Bell, CheckCheck, ExternalLink, X, Settings, Trash2, Clock, Check, RotateCcw } from "lucide-react";

import type { NotificacionItem } from "./WidgetNotificacionesCliente";

export type { NotificacionItem };

interface Props {
  negocio: string;
  usuarioId?: string;
  variante?: "oscura" | "clara";
  /**
   * Si la app lo pasa, la alerta nueva se le entrega para que la muestre con
   * sus propios avisos y la campana no pinta su ventana emergente (el estilo
   * es de cada producto: tranqi usa su aviso 9A).
   */
  alAlertaEnVivo?: (notificacion: NotificacionItem) => void;
  /** Cómo pinta la app el título y el cuerpo en la lista (ver WidgetNotificacionesCliente). */
  presentar?: (notificacion: NotificacionItem) => { titulo: string; html: string };
}

export function CampanaNotificaciones({ negocio, variante = "oscura", alAlertaEnVivo, presentar }: Props) {
  const vista = (n: NotificacionItem) => (presentar ? presentar(n) : { titulo: n.not_titulo, html: n.not_contenido_html });
  const alAlertaEnVivoRef = React.useRef(alAlertaEnVivo);
  React.useEffect(() => {
    alAlertaEnVivoRef.current = alAlertaEnVivo;
  }, [alAlertaEnVivo]);
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "no_leidas" | "eliminadas">("todas");
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [idCopiado, setIdCopiado] = useState<string | null>(null);
  const [alertaEmergente, setAlertaEmergente] = useState<NotificacionItem | null>(null);
  const overridesLocalRef = React.useRef<Record<string, { expiraEn: number; parche: Partial<NotificacionItem> }>>({});
  const idsConocidosRef = React.useRef<Set<string> | null>(null);

  const registrarOverride = (notId: string, parche: Partial<NotificacionItem>) => {
    overridesLocalRef.current[notId] = {
      expiraEn: Date.now() + 20000,
      parche: { ...(overridesLocalRef.current[notId]?.parche || {}), ...parche },
    };
  };

  const dispararAlertaEmergenteSiNueva = React.useCallback(
    (lista: NotificacionItem[]) => {
      if (typeof window === "undefined") return;
      const claveStorage = `eco_alertas_toast_${negocio}`;
      let vistasToast: string[] = [];
      try {
        const raw = window.sessionStorage.getItem(claveStorage);
        if (raw) vistasToast = JSON.parse(raw) as string[];
      } catch {}
      const setVistas = new Set(vistasToast);
      const ahoraMs = Date.now();

      const esPrimeraCarga = idsConocidosRef.current === null;
      const previos = idsConocidosRef.current ?? new Set<string>();
      const siguienteSet = new Set<string>();
      let candidataToast: NotificacionItem | null = null;

      for (const n of lista) {
        siguienteSet.add(n.not_id);
        if (n.not_eliminada || n.not_leido_en) continue;
        const posp = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
        if (posp > ahoraMs) continue;
        if (setVistas.has(n.not_id)) continue;

        const edadMs = ahoraMs - new Date(n.not_creado_en).getTime();
        const esReciente = Number.isFinite(edadMs) && edadMs >= -60000 && edadMs <= 15 * 60 * 1000;
        const llegoEnVivo = !esPrimeraCarga && !previos.has(n.not_id);

        if ((llegoEnVivo || esReciente) && !candidataToast) {
          candidataToast = n;
        }
      }

      idsConocidosRef.current = siguienteSet;

      if (candidataToast) {
        setVistas.add(candidataToast.not_id);
        try {
          window.sessionStorage.setItem(
            claveStorage,
            JSON.stringify(Array.from(setVistas).slice(-80))
          );
        } catch {}
        if (alAlertaEnVivoRef.current) alAlertaEnVivoRef.current(candidataToast);
        else setAlertaEmergente(candidataToast);

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            const notifNativa = new Notification(candidataToast.not_titulo, {
              body: candidataToast.not_contenido_html
                .replace(/<[^>]*>?/gm, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 140),
              icon: "/favicon.ico",
            });
            const itemCapturado = candidataToast;
            notifNativa.onclick = () => {
              const ahoraIso = new Date().toISOString();
              registrarOverride(itemCapturado.not_id, { not_leido_en: ahoraIso });
              setNotificaciones(prev =>
                prev.map(n => (n.not_id === itemCapturado.not_id ? { ...n, not_leido_en: ahoraIso } : n))
              );
              setAlertaEmergente(null);
              fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`, {
                method: "POST",
                keepalive: true,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  negocio,
                  not_id: itemCapturado.not_id,
                  accion: "aceptar",
                }),
              }).catch(() => {});
              window.focus();
              if (itemCapturado.not_url_accion) {
                window.location.assign(itemCapturado.not_url_accion);
              }
              notifNativa.close();
            };
          } catch {}
        }
      }
    },
    [negocio]
  );

  // Cargar notificaciones in-app reales desde el servidor y consultar periódicamente
  const cargarNotificaciones = React.useCallback(() => {
    fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`, {
      cache: "no-store",
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notificaciones)) {
          const ahoraMs = Date.now();
          const listaConOverrides = (data.notificaciones as NotificacionItem[]).map(n => {
            const ov = overridesLocalRef.current[n.not_id];
            if (ov && ov.expiraEn > ahoraMs) {
              return { ...n, ...ov.parche };
            }
            return n;
          });
          setNotificaciones(listaConOverrides);
          dispararAlertaEmergenteSiNueva(listaConOverrides);
        }
      })
      .catch(() => {});
  }, [negocio, dispararAlertaEmergenteSiNueva]);

  React.useEffect(() => {
    let ultimaConsultaMs = Date.now();
    cargarNotificaciones();
    const consultarSiVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      ultimaConsultaMs = Date.now();
      cargarNotificaciones();
    };
    const interval = setInterval(consultarSiVisible, 60000);
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimaConsultaMs >= 10000) {
        ultimaConsultaMs = Date.now();
        cargarNotificaciones();
      }
    };
    const alRefrescar = () => {
      ultimaConsultaMs = Date.now();
      cargarNotificaciones();
    };
    const alMarcarLeidaExterna = (ev: Event) => {
      const det = (ev as CustomEvent<{ notId?: string }>).detail;
      const notIdExt = det?.notId?.trim();
      if (!notIdExt) return;
      const ahoraIso = new Date().toISOString();
      registrarOverride(notIdExt, { not_leido_en: ahoraIso });
      setNotificaciones(prev =>
        prev.map(n =>
          n.not_id === notIdExt ||
          n.not_id === `inapp-${notIdExt}` ||
          n.not_id === `push-${notIdExt}`
            ? { ...n, not_leido_en: ahoraIso }
            : n
        )
      );
      fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocio, not_id: notIdExt, accion: "aceptar" }),
      }).catch(() => {});
    };

    if (typeof window !== "undefined") {
      window.addEventListener("eco:refrescar-notificaciones", alRefrescar);
      window.addEventListener("eco:marcar-notificacion-leida", alMarcarLeidaExterna);
      document.addEventListener("visibilitychange", alCambiarVisibilidad);

      // Si el usuario ingresó haciendo clic en una notificación Push con ?not_id=..., marcarla como leída de inmediato
      try {
        const params = new URLSearchParams(window.location.search);
        const notIdUrl = params.get("not_id")?.trim();
        if (notIdUrl) {
          const ahoraIso = new Date().toISOString();
          registrarOverride(notIdUrl, { not_leido_en: ahoraIso });
          fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`, {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ negocio, not_id: notIdUrl, accion: "aceptar" }),
          })
            .then(() => cargarNotificaciones())
            .catch(() => {});
          params.delete("not_id");
          const qsLimpio = params.toString();
          const urlLimpia = `${window.location.pathname}${qsLimpio ? `?${qsLimpio}` : ""}${window.location.hash}`;
          window.history.replaceState(null, "", urlLimpia);
        }
      } catch {}
    }
    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("eco:refrescar-notificaciones", alRefrescar);
        window.removeEventListener("eco:marcar-notificacion-leida", alMarcarLeidaExterna);
        document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      }
    };
  }, [cargarNotificaciones, negocio]);

  const ahora = Date.now();

  const pendientes = notificaciones.filter(n => {
    if (n.not_eliminada) return false;
    const pospuesto = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
    if (pospuesto > ahora) return false;
    return !n.not_leido_en;
  });

  const noLeidasCount = pendientes.length;

  const enviarAccion = async (item: NotificacionItem, accion: "aceptar" | "eliminar" | "posponer" | "restaurar", horas?: number) => {
    try {
      await fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio,
          not_id: item.not_id,
          accion,
          horas,
          titulo: item.not_titulo,
          contenido_html: item.not_contenido_html,
          url_accion: item.not_url_accion,
          creado_en: item.not_creado_en,
        })
      });
    } catch {
      /* Ignorar */
    }
  };

  const marcarComoLeida = (item: NotificacionItem) => {
    const ahoraIso = new Date().toISOString();
    registrarOverride(item.not_id, { not_leido_en: ahoraIso });
    setNotificaciones(prev =>
      prev.map(n => (n.not_id === item.not_id ? { ...n, not_leido_en: ahoraIso } : n))
    );
    enviarAccion(item, "aceptar");
  };

  const marcarTodasComoLeidas = () => {
    const ahoraIso = new Date().toISOString();
    notificaciones.forEach(n => {
      if (!n.not_leido_en && !n.not_eliminada) {
        registrarOverride(n.not_id, { not_leido_en: ahoraIso });
        enviarAccion(n, "aceptar");
      }
    });
    setNotificaciones(prev =>
      prev.map(n => ({ ...n, not_leido_en: n.not_leido_en || ahoraIso }))
    );
  };

  const posponerItem = (item: NotificacionItem, horas: number) => {
    const hastaIso = new Date(Date.now() + horas * 3600 * 1000).toISOString();
    registrarOverride(item.not_id, { not_pospuesta_hasta: hastaIso, not_pospuesta_horas: horas });
    setNotificaciones(prev =>
      prev.map(n => (n.not_id === item.not_id ? { ...n, not_pospuesta_hasta: hastaIso, not_pospuesta_horas: horas } : n))
    );
    enviarAccion(item, "posponer", horas);
  };

  const eliminarItem = (item: NotificacionItem) => {
    const ahoraIso = new Date().toISOString();
    registrarOverride(item.not_id, {
      not_eliminada: true,
      not_eliminada_en: ahoraIso,
      not_leido_en: item.not_leido_en || ahoraIso,
    });
    setNotificaciones(prev =>
      prev.map(n => (n.not_id === item.not_id ? { ...n, not_eliminada: true, not_eliminada_en: ahoraIso, not_leido_en: n.not_leido_en || ahoraIso } : n))
    );
    enviarAccion(item, "eliminar");
  };

  const restaurarItem = (item: NotificacionItem) => {
    registrarOverride(item.not_id, { not_eliminada: false, not_eliminada_en: null });
    setNotificaciones(prev =>
      prev.map(n => (n.not_id === item.not_id ? { ...n, not_eliminada: false, not_eliminada_en: null } : n))
    );
    enviarAccion(item, "restaurar");
  };

  const eliminarTodas = async () => {
    const ahoraIso = new Date().toISOString();
    const copiaActual = [...notificaciones];
    copiaActual.forEach(n => {
      registrarOverride(n.not_id, {
        not_eliminada: true,
        not_eliminada_en: n.not_eliminada_en || ahoraIso,
        not_leido_en: n.not_leido_en || ahoraIso,
      });
    });
    setNotificaciones(prev =>
      prev.map(n => ({
        ...n,
        not_eliminada: true,
        not_eliminada_en: n.not_eliminada_en || ahoraIso,
        not_leido_en: n.not_leido_en || ahoraIso,
      }))
    );
    try {
      await fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negocio)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocio, accion: "eliminar_todas", items: copiaActual })
      });
    } catch {}
  };

  const copiarIdNotificacion = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    setIdCopiado(id);
    setTimeout(() => {
      setIdCopiado(prev => (prev === id ? null : prev));
    }, 2000);
  };

  const listaFiltrada = notificaciones.filter(n => {
    if (filtro === "eliminadas") return Boolean(n.not_eliminada);
    if (n.not_eliminada) return false;
    if (filtro === "no_leidas") {
      const pospuesto = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
      if (pospuesto > ahora) return false;
      return !n.not_leido_en;
    }
    return true;
  });

  const esClara = variante === "clara";

  return (
    <>
      {/* Botón Campana con Badge interactivo */}
      <button
        type="button"
        onClick={() => {
          setAlertaEmergente(null);
          setAbierto(true);
        }}
        title="Centro de Notificaciones e Historial"
        aria-label={`Centro de notificaciones (${noLeidasCount} pendientes)`}
        style={{
          position: "relative",
          background: esClara ? "#FFFFFF" : "rgba(255, 255, 255, 0.06)",
          border: esClara ? "1px solid #D5CFC4" : "1px solid rgba(214, 195, 165, 0.2)",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: esClara ? "#2F4737" : "#E5DDD2",
          cursor: "pointer",
          transition: "all 0.2s ease",
          flexShrink: 0,
        }}
      >
        <Bell size={17} />
        {noLeidasCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-3px",
              right: "-3px",
              background: esClara ? "#8A2E2E" : "#C8A25A",
              color: esClara ? "#FFFFFF" : "#1C1714",
              fontSize: "0.66rem",
              fontWeight: 700,
              borderRadius: "999px",
              padding: "1px 5.5px",
              boxShadow: "0 1px 4px rgba(0, 0, 0, 0.22)",
              border: esClara ? "1.5px solid #FFFFFF" : "1.5px solid #1A1512",
            }}
          >
            {noLeidasCount}
          </span>
        )}
      </button>

      {/* Alerta Emergente en Vivo (Toast no intrusivo en esquina superior derecha) */}
      {alertaEmergente && !abierto && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: "18px",
            right: "18px",
            width: "calc(100vw - 36px)",
            maxWidth: "380px",
            background: "#221E1B",
            color: "#F6F1E8",
            borderRadius: "12px",
            border: "1px solid rgba(200, 162, 90, 0.45)",
            boxShadow: "0 14px 32px rgba(24, 18, 14, 0.32)",
            padding: "13px 15px",
            zIndex: 100001,
            display: "flex",
            flexDirection: "column",
            gap: "9px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(200, 162, 90, 0.16)",
                  color: "#C8A25A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bell size={16} />
              </div>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#C8A25A",
                    marginBottom: "2px",
                  }}
                >
                  Nueva Alerta · {negocio.toUpperCase()}
                </span>
                <strong style={{ fontSize: "0.86rem", lineHeight: 1.35, color: "#FFFFFF", display: "block" }}>
                  {alertaEmergente.not_titulo}
                </strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertaEmergente(null)}
              title="Cerrar alerta"
              aria-label="Cerrar alerta"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                borderRadius: "50%",
                width: "26px",
                height: "26px",
                color: "#CBD5E1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                marcarComoLeida(alertaEmergente);
                setAlertaEmergente(null);
              }}
              title="Marcar alerta como leída"
              aria-label="Entendido"
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#1E293B",
                color: "#E2E8F0",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
            {alertaEmergente.not_url_accion ? (
              <a
                href={alertaEmergente.not_url_accion}
                onClick={() => {
                  marcarComoLeida(alertaEmergente);
                  setAlertaEmergente(null);
                }}
                title="Abrir directamente el chat o sección correspondiente"
                aria-label="Abrir"
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                Abrir →
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAlertaEmergente(null);
                  setAbierto(true);
                }}
                title="Ver detalle en el centro de notificaciones"
                aria-label="Ver Detalle"
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  fontSize: "0.76rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Ver Detalle
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drawer Lateral Fijo con Fondo Oscuro Backdrop */}
      {abierto && (
        <>
          {/* Backdrop Overlay */}
          <div
            onClick={() => setAbierto(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(4px)",
              zIndex: 99998
            }}
          />

          {/* Drawer Panel Fijo a la Derecha */}
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              maxWidth: "430px",
              background: "#F7F3EC",
              borderLeft: "1px solid #DFD7CA",
              boxShadow: "-10px 0 36px rgba(24, 18, 14, 0.28)",
              zIndex: 99999,
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Header Popover — Sobrio y Cálido */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(214, 195, 165, 0.16)",
                background: "#1C1714",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Bell size={19} color="#C8A25A" />
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.96rem", color: "#F6F1E8", display: "block" }}>
                    Notificaciones ({noLeidasCount})
                  </span>
                  <span style={{ fontSize: "0.73rem", color: "#A89D8F", textTransform: "capitalize" }}>
                    {negocio}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setAbierto(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(214, 195, 165, 0.22)",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  color: "#F6F1E8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <X size={17} />
              </button>
            </div>

              {/* Barra PWA discreta */}
              <div
                style={{
                  padding: "8px 14px",
                  background: "#EFE9DF",
                  borderBottom: "1px solid #E2D9CB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  flexWrap: "wrap",
                  fontSize: "0.73rem",
                }}
              >
                <span style={{ color: "#6E6359", fontWeight: 600 }}>Alertas:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("tranqi:instalar-pwa"));
                      }
                    }}
                    title="Instalar aplicación en el dispositivo"
                    aria-label="Instalar aplicación"
                    style={{
                      background: "#FFFFFF",
                      color: "#221D1A",
                      border: "1px solid #D8CFC1",
                      borderRadius: "8px",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                    }}
                  >
                    Instalar App
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("tranqi:activar-push"));
                      }
                    }}
                    title="Activar notificaciones Push incluso con el navegador cerrado"
                    aria-label="Activar notificaciones Push"
                    style={{
                      background: "#3D5A45",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "8px",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                    }}
                  >
                    Activar Push
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fetch("/api/pwa/suscripcion", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ accion: "probar" }),
                      }).catch(() => {});
                    }}
                    title="Enviar una notificación Push de prueba a este dispositivo"
                    aria-label="Probar notificación Push"
                    style={{
                      background: "#FFFFFF",
                      color: "#574E46",
                      border: "1px solid #D8CFC1",
                      borderRadius: "8px",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                    }}
                  >
                    Probar
                  </button>
                </div>
              </div>

            {/* Filtros y acciones rápidas */}
            <div
              style={{
                padding: "10px 14px",
                background: "#FAF7F2",
                borderBottom: "1px solid #E5DDD0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                gap: "4px"
              }}
            >
              <div style={{ display: "flex", gap: "5px" }}>
                <button
                  onClick={() => setFiltro("todas")}
                  style={{
                    background: filtro === "todas" ? "#221D1A" : "#FFFFFF",
                    color: filtro === "todas" ? "#F6F1E8" : "#574E46",
                    border: "1px solid #D8CFC1",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Todas ({notificaciones.filter(n => !n.not_eliminada).length})
                </button>
                <button
                  onClick={() => setFiltro("no_leidas")}
                  style={{
                    background: filtro === "no_leidas" ? "#3D5A45" : "#FFFFFF",
                    color: filtro === "no_leidas" ? "#FFFFFF" : "#574E46",
                    border: "1px solid #D8CFC1",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Sin leer ({noLeidasCount})
                </button>
                <button
                  onClick={() => setFiltro("eliminadas")}
                  style={{
                    background: filtro === "eliminadas" ? "#8F3D34" : "#FFFFFF",
                    color: filtro === "eliminadas" ? "#FFFFFF" : "#574E46",
                    border: "1px solid #D8CFC1",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Eliminadas ({notificaciones.filter(n => n.not_eliminada).length})
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {noLeidasCount > 0 && filtro !== "eliminadas" && (
                  <button
                    onClick={marcarTodasComoLeidas}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3D5A45",
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.74rem"
                    }}
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck size={13} /> Leídas
                  </button>
                )}
                {notificaciones.length > 0 && (
                  <button
                    onClick={eliminarTodas}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#9E4438",
                      cursor: "pointer",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "0.74rem"
                    }}
                    title="Eliminar todas las notificaciones"
                  >
                    <Trash2 size={13} /> Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Notificaciones */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {listaFiltrada.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#8A7F73", fontSize: "0.85rem" }}>
                  <Bell size={30} style={{ opacity: 0.35, marginBottom: "8px" }} />
                  <p>No hay notificaciones en esta sección.</p>
                </div>
              ) : (
                listaFiltrada.map(n => (
                  <div
                    key={n.not_id}
                    onClick={() => {
                      if (!n.not_eliminada && !n.not_leido_en) {
                        marcarComoLeida(n);
                      }
                      if (!n.not_eliminada && n.not_url_accion) {
                        setAbierto(false);
                        window.location.assign(n.not_url_accion);
                      }
                    }}
                    style={{
                      padding: "13px 14px",
                      borderRadius: "12px",
                      marginBottom: "10px",
                      cursor: !n.not_eliminada && n.not_url_accion ? "pointer" : "default",
                      background: n.not_eliminada
                        ? "#FAF3F2"
                        : n.not_leido_en
                        ? "#FFFFFF"
                        : "#FFFDF8",
                      border: n.not_eliminada
                        ? "1px dashed #DFC2BD"
                        : n.not_leido_en
                        ? "1px solid #E6DFD3"
                        : "1px solid #D9C49B",
                      borderLeft: n.not_eliminada
                        ? "3.5px solid #A64438"
                        : n.not_leido_en
                        ? "3.5px solid transparent"
                        : "3.5px solid #B8923F",
                      boxShadow: "0 2px 6px rgba(34, 29, 26, 0.04)",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "5px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: n.not_eliminada ? "#8F3D34" : "#221D1A" }}>
                        {vista(n).titulo}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#8A7F73", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {new Date(n.not_creado_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {n.not_eliminada && (
                      <div style={{ marginBottom: "5px" }}>
                        <span style={{ fontSize: "0.68rem", color: "#8F3D34", fontWeight: 700 }}>
                          • Eliminada
                        </span>
                      </div>
                    )}
                    <div
                      style={{ fontSize: "0.8rem", color: "#574E46", lineHeight: 1.45 }}
                      dangerouslySetInnerHTML={{ __html: vista(n).html }}
                    />
                    {n.not_url_accion && (
                      <a
                        href={n.not_url_accion}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!n.not_leido_en) {
                            marcarComoLeida(n);
                          }
                          setAbierto(false);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.77rem",
                          color: "#3D5A45",
                          marginTop: "8px",
                          textDecoration: "none",
                          fontWeight: 700
                        }}
                      >
                        Abrir detalle <ExternalLink size={12} />
                      </a>
                    )}

                    {/* Botones de acción sobrios */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", borderTop: "1px solid #EFE9DF", paddingTop: "8px" }}
                    >
                      {n.not_eliminada ? (
                        <button
                          type="button"
                          onClick={() => restaurarItem(n)}
                          style={{
                            background: "#3D5A45",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "7px",
                            padding: "4px 9px",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          <RotateCcw size={11} /> Restaurar
                        </button>
                      ) : (
                        <>
                          {!n.not_leido_en && (
                            <button
                              type="button"
                              onClick={() => marcarComoLeida(n)}
                              style={{
                                background: "#3D5A45",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "7px",
                                padding: "4px 10px",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                            >
                              <Check size={11} /> Marcar leída
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => posponerItem(n, 3)}
                            style={{
                              background: "#F5F0E8",
                              color: "#4A433C",
                              border: "1px solid #DDD4C7",
                              borderRadius: "7px",
                              padding: "4px 9px",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px"
                            }}
                          >
                            <Clock size={11} /> Posponer 3h
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copiarIdNotificacion(n.not_id);
                            }}
                            title={`Copiar ID de referencia (${n.not_id})`}
                            style={{
                              background: "transparent",
                              color: idCopiado === n.not_id ? "#3D5A45" : "#9A8F83",
                              border: "none",
                              padding: "4px 5px",
                              fontSize: "0.7rem",
                              cursor: "pointer",
                            }}
                          >
                            {idCopiado === n.not_id ? "✓ ID" : "ID"}
                          </button>

                          <button
                            type="button"
                            onClick={() => eliminarItem(n)}
                            style={{
                              background: "transparent",
                              color: "#9E4438",
                              border: "none",
                              padding: "4px 6px",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              marginLeft: "auto"
                            }}
                          >
                            <Trash2 size={11} /> Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer con Enlace a Preferencias */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #E5DDD0", background: "#FAF7F2" }}>
              <a
                href="/panel/configuracion"
                onClick={() => setAbierto(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "#FFFFFF",
                  border: "1px solid #D8CFC1",
                  color: "#221D1A",
                  borderRadius: "9px",
                  padding: "9px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textDecoration: "none"
                }}
              >
                <Settings size={14} /> Preferencias y Configuración
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
