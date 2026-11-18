"use client";

import React, { useState } from "react";
import { Bell, CheckCheck, ExternalLink, X, Settings, Trash2, Clock, Check, RotateCcw } from "lucide-react";

import type { NotificacionItem } from "./WidgetNotificacionesCliente";

export type { NotificacionItem };

interface Props {
  negocio: string;
  usuarioId?: string;
  variante?: "oscura" | "clara";
}

export function CampanaNotificaciones({ negocio, variante = "oscura" }: Props) {
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
        setAlertaEmergente(candidataToast);

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
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 8000);
    const alRefrescar = () => cargarNotificaciones();
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
          background: esClara ? "#FFFFFF" : "#161b22",
          border: esClara ? "1.5px solid #D1D5DB" : "1px solid #30363d",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: esClara ? "#2D4734" : "#c9d1d9",
          cursor: "pointer",
          transition: "all 0.2s ease",
          flexShrink: 0,
        }}
      >
        <Bell size={19} />
        {noLeidasCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-3px",
              right: "-3px",
              background: esClara ? "#DC2626" : "#1f6feb",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 800,
              borderRadius: "10px",
              padding: "1px 6px",
              boxShadow: esClara
                ? "0 2px 8px rgba(220, 38, 38, 0.45)"
                : "0 0 10px rgba(31, 111, 235, 0.8)",
              border: esClara ? "2px solid #FFFFFF" : "2px solid #0d1117",
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
            maxWidth: "390px",
            background: "#0F172A",
            color: "#F8FAFC",
            borderRadius: "14px",
            border: "1.5px solid #10B981",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.45)",
            padding: "14px 16px",
            zIndex: 100001,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.18)",
                  color: "#34D399",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bell size={18} />
              </div>
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#34D399",
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
              background: "#161b22",
              borderLeft: "1px solid #30363d",
              boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.7)",
              zIndex: 99999,
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Header Popover */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #30363d",
                background: "#0d1117",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Bell size={20} color="#58a6ff" />
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#c9d1d9", display: "block" }}>
                    Centro de Notificaciones ({noLeidasCount})
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#8b949e" }}>Negocio: {negocio}</span>
                </div>
              </div>
              <button
                onClick={() => setAbierto(false)}
                style={{
                  background: "#21262d",
                  border: "1px solid #30363d",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  color: "#c9d1d9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <X size={18} />
              </button>
            </div>

              {/* Barra PWA: Instalar App y Notificaciones Push en segundo plano */}
              <div
                style={{
                  padding: "8px 14px",
                  background: "#11161f",
                  borderBottom: "1px solid #30363d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  flexWrap: "wrap",
                  fontSize: "0.74rem",
                }}
              >
                <span style={{ color: "#8b949e", fontWeight: 600 }}>App & Alertas Push:</span>
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
                      background: "#21262d",
                      color: "#c9d1d9",
                      border: "1px solid #30363d",
                      borderRadius: "8px",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                    }}
                  >
                    📲 Instalar App
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
                      background: "#1f6feb",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                    }}
                  >
                    🔔 Activar Push
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
                      background: "rgba(56, 139, 253, 0.15)",
                      color: "#58a6ff",
                      border: "1px solid rgba(56, 139, 253, 0.4)",
                      borderRadius: "8px",
                      padding: "4px 9px",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                    }}
                  >
                    ⚡ Probar Push
                  </button>
                </div>
              </div>

            {/* Filtros y acciones rápidas */}
            <div
              style={{
                padding: "10px 14px",
                background: "#0d1117",
                borderBottom: "1px solid #30363d",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.76rem",
                gap: "4px"
              }}
            >
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => setFiltro("todas")}
                  style={{
                    background: filtro === "todas" ? "#1f6feb" : "#21262d",
                    color: filtro === "todas" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "10px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Todas ({notificaciones.filter(n => !n.not_eliminada).length})
                </button>
                <button
                  onClick={() => setFiltro("no_leidas")}
                  style={{
                    background: filtro === "no_leidas" ? "#1f6feb" : "#21262d",
                    color: filtro === "no_leidas" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "10px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Sin leer ({noLeidasCount})
                </button>
                <button
                  onClick={() => setFiltro("eliminadas")}
                  style={{
                    background: filtro === "eliminadas" ? "#b91c1c" : "#21262d",
                    color: filtro === "eliminadas" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "10px",
                    padding: "3px 8px",
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
                      color: "#388bfd",
                      cursor: "pointer",
                      fontWeight: 600,
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
                      color: "#f87171",
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
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#8b949e", fontSize: "0.85rem" }}>
                  <Bell size={32} style={{ opacity: 0.3, marginBottom: "8px" }} />
                  <p>No se encontraron notificaciones en esta sección.</p>
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
                      padding: "12px 14px",
                      borderRadius: "8px",
                      marginBottom: "10px",
                      cursor: !n.not_eliminada && n.not_url_accion ? "pointer" : "default",
                      background: n.not_eliminada
                        ? "rgba(239, 68, 68, 0.08)"
                        : n.not_leido_en
                        ? "#161b22"
                        : "rgba(31, 111, 235, 0.12)",
                      border: n.not_eliminada
                        ? "1px dashed rgba(239, 68, 68, 0.4)"
                        : n.not_leido_en
                        ? "1px solid #30363d"
                        : "1px solid #388bfd",
                      borderLeft: n.not_eliminada
                        ? "4px solid #ef4444"
                        : n.not_leido_en
                        ? "4px solid transparent"
                        : "4px solid #1f6feb",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: n.not_eliminada ? "#fca5a5" : n.not_leido_en ? "#c9d1d9" : "#58a6ff" }}>
                        {n.not_titulo}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#8b949e", whiteSpace: "nowrap" }}>
                        {new Date(n.not_creado_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copiarIdNotificacion(n.not_id);
                        }}
                        title="Clic para copiar el ID único de esta notificación"
                        style={{
                          background: "#0d1117",
                          border: "1px solid #30363d",
                          borderRadius: "4px",
                          padding: "1px 6px",
                          fontSize: "0.66rem",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          color: idCopiado === n.not_id ? "#3fb950" : "#8b949e",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>ID: {n.not_id}</span>
                        <span style={{ fontWeight: 700 }}>{idCopiado === n.not_id ? "✓ Copiado" : "📋"}</span>
                      </button>
                      {n.not_eliminada && (
                        <span style={{ fontSize: "0.66rem", color: "#fca5a5", fontWeight: 700 }}>
                          • Estado: Eliminada
                        </span>
                      )}
                    </div>
                    <div
                      style={{ fontSize: "0.8rem", color: "#8b949e", lineHeight: 1.4 }}
                      dangerouslySetInnerHTML={{ __html: n.not_contenido_html }}
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
                          fontSize: "0.76rem",
                          color: "#388bfd",
                          marginTop: "8px",
                          textDecoration: "none",
                          fontWeight: 600
                        }}
                      >
                        Abrir pedido / sección <ExternalLink size={12} />
                      </a>
                    )}

                    {/* Botones de acción en la tarjeta */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", borderTop: "1px solid #21262d", paddingTop: "8px" }}
                    >
                      {n.not_eliminada ? (
                        <button
                          type="button"
                          onClick={() => restaurarItem(n)}
                          style={{
                            background: "#1e3a8a",
                            color: "#bfdbfe",
                            border: "none",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
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
                                background: "#065f46",
                                color: "#a7f3d0",
                                border: "none",
                                borderRadius: "4px",
                                padding: "3px 8px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                            >
                              <Check size={11} /> Aceptar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => posponerItem(n, 3)}
                            style={{
                              background: "#21262d",
                              color: "#c9d1d9",
                              border: "1px solid #30363d",
                              borderRadius: "4px",
                              padding: "3px 8px",
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
                            onClick={() => eliminarItem(n)}
                            style={{
                              background: "transparent",
                              color: "#f87171",
                              border: "none",
                              padding: "3px 6px",
                              fontSize: "0.72rem",
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
            <div style={{ padding: "12px 16px", borderTop: "1px solid #30363d", background: "#0d1117" }}>
              <a
                href="/panel/configuracion"
                onClick={() => setAbierto(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  background: "#21262d",
                  border: "1px solid #30363d",
                  color: "#c9d1d9",
                  borderRadius: "6px",
                  padding: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textDecoration: "none"
                }}
              >
                <Settings size={14} /> Preferencias & Configuración
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
