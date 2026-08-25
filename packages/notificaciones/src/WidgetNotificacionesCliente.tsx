"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bell, Settings, CheckCircle2, Volume2, X, Clock, Trash2, Check,
  ChevronDown, RotateCcw, Info
} from "lucide-react";

export interface NotificacionItem {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal?: string;
  not_pospuesta_hasta?: string | null;
  not_pospuesta_horas?: number | null;
  not_eliminada?: boolean;
  not_eliminada_en?: string | null;
}

interface Props {
  negocio?: string;
  esAdmin?: boolean;
}

const STORAGE_KEY_LEIDAS = "tranqi_notifs_leidas";
const STORAGE_KEY_ELIMINADAS = "tranqi_notifs_eliminadas";
const STORAGE_KEY_POSPUESTAS = "tranqi_notifs_pospuestas";

export function WidgetNotificacionesCliente({ negocio = "tranqi", esAdmin = false }: Props) {
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [alertaPushToast, setAlertaPushToast] = useState<NotificacionItem | null>(null);
  const [permisoPush, setPermisoPush] = useState<string>("default");
  const [tabActiva, setTabActiva] = useState<"pendientes" | "historial" | "eliminadas">("pendientes");
  const [dropdownPosponerId, setDropdownPosponerId] = useState<string | null>(null);
  const [dropdownToastPosponer, setDropdownToastPosponer] = useState<boolean>(false);
  const [horasPersonalizadas, setHorasPersonalizadas] = useState<string>("4");
  const [mostrarInputPersonalizado, setMostrarInputPersonalizado] = useState<string | null>(null);

  // Estados locales de filtrado rápido y sincronización
  const [leidasLocal, setLeidasLocal] = useState<Set<string>>(new Set());
  const [eliminadasLocal, setEliminadasLocal] = useState<Set<string>>(new Set());
  const [pospuestasLocal, setPospuestasLocal] = useState<Record<string, number>>({});
  const yaCargadoInicialRef = useRef<boolean>(false);

  // Cargar preferencias locales al inicio
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const l = JSON.parse(localStorage.getItem(STORAGE_KEY_LEIDAS) || "[]");
        const e = JSON.parse(localStorage.getItem(STORAGE_KEY_ELIMINADAS) || "[]");
        const p = JSON.parse(localStorage.getItem(STORAGE_KEY_POSPUESTAS) || "{}");
        setLeidasLocal(new Set(l));
        setEliminadasLocal(new Set(e));
        setPospuestasLocal(p);
      } catch {
        /* Ignorar */
      }
      if ("Notification" in window) {
        setPermisoPush(Notification.permission);
      }
    }
  }, []);

  const solicitarPermisoPush = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then(perm => {
        setPermisoPush(perm);
      });
    }
  };

  const enviarAccionServidor = async (
    item: NotificacionItem,
    accion: "aceptar" | "eliminar" | "posponer" | "restaurar",
    horas?: number
  ) => {
    try {
      await fetch("/api/notificaciones/usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          not_id: item.not_id,
          accion,
          horas,
          titulo: item.not_titulo,
          contenido_html: item.not_contenido_html,
          url_accion: item.not_url_accion
        })
      });
    } catch (err) {
      console.warn("Aviso al sincronizar notificación con el servidor:", err);
    }
  };

  const aceptarNotificacion = (item: NotificacionItem) => {
    const ahoraIso = new Date().toISOString();
    // 1. Actualizar estado local reactivo
    setNotificaciones(prev =>
      prev.map(n => (n.not_id === item.not_id ? { ...n, not_leido_en: ahoraIso } : n))
    );
    const nextLeidas = new Set(leidasLocal).add(item.not_id);
    setLeidasLocal(nextLeidas);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_LEIDAS, JSON.stringify(Array.from(nextLeidas)));
    }
    if (alertaPushToast?.not_id === item.not_id) {
      setAlertaPushToast(null);
    }
    setDropdownPosponerId(null);
    setDropdownToastPosponer(false);
    enviarAccionServidor(item, "aceptar");
  };

  const eliminarNotificacion = (item: NotificacionItem) => {
    const ahoraIso = new Date().toISOString();
    // 1. Actualizar estado local reactivo marcando eliminada lógicamente
    setNotificaciones(prev =>
      prev.map(n =>
        n.not_id === item.not_id
          ? { ...n, not_eliminada: true, not_eliminada_en: ahoraIso, not_leido_en: n.not_leido_en || ahoraIso }
          : n
      )
    );
    const nextEliminadas = new Set(eliminadasLocal).add(item.not_id);
    setEliminadasLocal(nextEliminadas);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ELIMINADAS, JSON.stringify(Array.from(nextEliminadas)));
    }
    if (alertaPushToast?.not_id === item.not_id) {
      setAlertaPushToast(null);
    }
    setDropdownPosponerId(null);
    setDropdownToastPosponer(false);
    enviarAccionServidor(item, "eliminar");
  };

  const restaurarNotificacion = (item: NotificacionItem) => {
    // 1. Desmarcar eliminación lógica
    setNotificaciones(prev =>
      prev.map(n =>
        n.not_id === item.not_id
          ? { ...n, not_eliminada: false, not_eliminada_en: null }
          : n
      )
    );
    const nextEliminadas = new Set(eliminadasLocal);
    nextEliminadas.delete(item.not_id);
    setEliminadasLocal(nextEliminadas);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ELIMINADAS, JSON.stringify(Array.from(nextEliminadas)));
    }
    enviarAccionServidor(item, "restaurar");
  };

  const posponerNotificacion = (item: NotificacionItem, horas: number) => {
    const hastaTimestamp = Date.now() + horas * 3600 * 1000;
    const hastaIso = new Date(hastaTimestamp).toISOString();

    // 1. Actualizar estado local reactivo con fecha de pospuesto
    setNotificaciones(prev =>
      prev.map(n =>
        n.not_id === item.not_id
          ? { ...n, not_pospuesta_hasta: hastaIso, not_pospuesta_horas: horas }
          : n
      )
    );
    const nextPospuestas = { ...pospuestasLocal, [item.not_id]: hastaTimestamp };
    setPospuestasLocal(nextPospuestas);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_POSPUESTAS, JSON.stringify(nextPospuestas));
    }
    if (alertaPushToast?.not_id === item.not_id) {
      setAlertaPushToast(null);
    }
    setDropdownPosponerId(null);
    setDropdownToastPosponer(false);
    setMostrarInputPersonalizado(null);
    enviarAccionServidor(item, "posponer", horas);
  };

  const cargarNotificaciones = () => {
    fetch("/api/notificaciones/usuario")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notificaciones)) {
          const ahora = Date.now();
          const p = pospuestasLocal;
          const e = eliminadasLocal;
          const l = leidasLocal;

          // Filtrar las visibles activas para toast
          const pendientesParaToast = data.notificaciones.filter((n: NotificacionItem) => {
            if (e.has(n.not_id) || n.not_eliminada) return false;
            const pospServer = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
            const pospLocal = p[n.not_id] || 0;
            const pospFinal = Math.max(pospServer, pospLocal);
            if (pospFinal > ahora) return false;
            if (l.has(n.not_id) || Boolean(n.not_leido_en)) return false;
            return true;
          });

          // Si hay una nueva notificación pendiente no mostrada antes
          if (pendientesParaToast.length > 0 && !yaCargadoInicialRef.current) {
            const masReciente = pendientesParaToast[0];
            setAlertaPushToast(masReciente);

            // Disparar Web Push nativo si el permiso fue concedido
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              const textoBody = masReciente.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 120);
              try { new Notification(masReciente.not_titulo, { body: textoBody, icon: "/favicon.ico" }); } catch { /* Ignorar */ }
            }
          }

          yaCargadoInicialRef.current = true;
          setNotificaciones(data.notificaciones);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 6000);
    return () => clearInterval(interval);
  }, []);

  const ahora = Date.now();

  // 1. Notificaciones Eliminadas Lógicamente
  const eliminadas = notificaciones.filter(n => n.not_eliminada || eliminadasLocal.has(n.not_id));

  // 2. Notificaciones no eliminadas
  const sinEliminar = notificaciones.filter(n => !n.not_eliminada && !eliminadasLocal.has(n.not_id));

  // 3. Pendientes: No leídas, no eliminadas y no pospuestas activamente
  const pendientes = sinEliminar.filter(n => {
    const pospuestoHasta = Math.max(
      pospuestasLocal[n.not_id] || 0,
      n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0
    );
    if (pospuestoHasta > ahora) return false;
    if (leidasLocal.has(n.not_id)) return false;
    return !n.not_leido_en;
  });

  // 4. Historial: Leídas o aceptadas, pero no eliminadas
  const historial = sinEliminar.filter(n => {
    return Boolean(n.not_leido_en) || leidasLocal.has(n.not_id);
  });

  const noLeidasCount = pendientes.length;

  return (
    <>
      {/* ALERTA TOAST FLOTANTE GLOBAL DE PANTALLA COMPLETA (FIXED OVERLAY) */}
      {alertaPushToast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            maxWidth: "460px",
            width: "calc(100vw - 48px)",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            borderRadius: "16px",
            padding: "18px 20px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 2px #38bdf8",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            animation: "fadeIn 0.3s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ background: "#0284c7", borderRadius: "50%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Volume2 color="#ffffff" size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Alerta en vivo
                </span>
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Ahora</span>
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff", marginBottom: "6px" }}>
                {alertaPushToast.not_titulo}
              </div>
              <div
                style={{ fontSize: "0.84rem", color: "#cbd5e1", lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: alertaPushToast.not_contenido_html }}
              />
            </div>
            <button
              type="button"
              onClick={() => setAlertaPushToast(null)}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                color: "#ffffff",
                borderRadius: "8px",
                padding: "6px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              title="Cerrar ventana emergente"
            >
              <X size={18} />
            </button>
          </div>

          {/* Botones de Acción en el Toast */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: "10px", position: "relative" }}>
            <button
              type="button"
              onClick={() => aceptarNotificacion(alertaPushToast)}
              style={{
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              <Check size={14} /> Aceptar (Leída)
            </button>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setDropdownToastPosponer(!dropdownToastPosponer)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px"
                }}
              >
                <Clock size={14} /> Posponer <ChevronDown size={12} />
              </button>

              {dropdownToastPosponer && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: 0,
                    marginBottom: "6px",
                    background: "#0f172a",
                    border: "1.5px solid #334155",
                    borderRadius: "8px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    zIndex: 100000,
                    minWidth: "160px",
                    padding: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#94a3b8", padding: "4px 8px", textTransform: "uppercase" }}>
                    Posponer por:
                  </div>
                  {[3, 6, 12, 24].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => posponerNotificacion(alertaPushToast, h)}
                      style={{
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        padding: "6px 8px",
                        fontSize: "0.76rem",
                        color: "#e2e8f0",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      {h} horas
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => eliminarNotificacion(alertaPushToast)}
              style={{
                background: "transparent",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                marginLeft: "auto"
              }}
              title="Eliminar lógicamente (se conserva en la pestaña Eliminadas)"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      )}

      {/* SECCIÓN LATERAL DEL PANEL
          TRQ-010: se va el filo azul de 4px de la izquierda. Era un color ajeno
          al sistema de marca (#1f6feb no está en la paleta) y el mismo recurso
          aparecía en tres sitios con tres colores distintos, así que ya no
          significaba nada. La tarjeta se distingue como todas las demás del
          panel: superficie blanca y línea de 1px. */}
      <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco">
        <header>
          <h2 id="t-notificaciones-eco">Notificaciones</h2>
          {/* El contador solo aparece cuando hay algo pendiente: un chip que
              dice "0 Pendientes" ocupa sitio para no informar de nada. Fondo
              diluido y no pleno, como manda §6 del sistema visual. */}
          {noLeidasCount > 0 && (
            <span className="chip-pendientes">
              {noLeidasCount} {noLeidasCount === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </header>

        {/* Pestañas: Pendientes vs Historial vs Eliminadas.
            Sin iconos: la campana, el reloj y la papelera repetían en dibujo lo
            que la palabra de al lado ya decía, en tres pestañas de 90px. */}
        <div className="pestanas-notif" role="tablist">
          <button
            type="button" role="tab"
            aria-selected={tabActiva === "pendientes"}
            className={`pestana-notif${tabActiva === "pendientes" ? " es-activa" : ""}`}
            onClick={() => setTabActiva("pendientes")}
          >
            Pendientes ({pendientes.length})
          </button>
          <button
            type="button" role="tab"
            aria-selected={tabActiva === "historial"}
            className={`pestana-notif${tabActiva === "historial" ? " es-activa" : ""}`}
            onClick={() => setTabActiva("historial")}
          >
            Historial ({historial.length})
          </button>
          <button
            type="button" role="tab"
            aria-selected={tabActiva === "eliminadas"}
            className={`pestana-notif${tabActiva === "eliminadas" ? " es-activa" : ""}`}
            onClick={() => setTabActiva("eliminadas")}
          >
            Eliminadas ({eliminadas.length})
          </button>
        </div>

        {/* Aviso para activar permisos Web Push */}
        {permisoPush !== "granted" && (
          <div className="aviso-push">
            <span>Activa los avisos del navegador para enterarte al momento.</span>
            <button type="button" className="accion-menor es-discreta" onClick={solicitarPermisoPush}>
              Activar
            </button>
          </div>
        )}

        {/* Lista de Notificaciones según pestaña activa */}
        <div className="lista-notif">
          {tabActiva === "pendientes" && (
            pendientes.length === 0 ? (
              <div className="vacio-notif">
                <CheckCircle2 size={22} aria-hidden="true" />
                <span>No tienes notificaciones pendientes.</span>
              </div>
            ) : (
              pendientes.map(item => (
                /* TRQ-010: la tarjeta era azul sobre azul con borde azul de
                   1.5px y sombra azul. Ahora es blanca como el resto del panel
                   y lo pendiente lo dice el punto del título, no el envase. */
                <article key={item.not_id} className="notif">
                  <div className="notif-cabeza">
                    <span className="notif-titulo">{item.not_titulo}</span>
                    <time className="notif-hora">
                      {new Date(item.not_creado_en).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                    </time>
                  </div>
                  <div
                    className="notif-cuerpo"
                    dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                  />

                  {/* Barra de 3 acciones: Aceptar, Posponer, Eliminar.
                      Antes eran verde pleno, blanca con borde y roja: un
                      semáforo entero dentro de una tarjeta de 440px. Ahora solo
                      "Aceptar" lleva relleno -- es la única que el usuario
                      quiere pulsar; las otras dos existen por si acaso. */}
                  <div className="fila-acciones notif-acciones">
                    <button
                      type="button"
                      className="accion-menor es-principal"
                      onClick={() => aceptarNotificacion(item)}
                      title="Confirmar lectura y pasar al historial"
                    >
                      <Check size={14} aria-hidden="true" /> Aceptar
                    </button>

                    <div className="envoltura-posponer">
                      <button
                        type="button"
                        className="accion-menor es-discreta"
                        onClick={() => {
                          setDropdownPosponerId(dropdownPosponerId === item.not_id ? null : item.not_id);
                          setMostrarInputPersonalizado(null);
                        }}
                      >
                        <Clock size={14} aria-hidden="true" /> Posponer <ChevronDown size={12} aria-hidden="true" />
                      </button>

                      {dropdownPosponerId === item.not_id && (
                        <div className="menu-posponer">
                          <div className="menu-posponer-titulo">Ocultar por</div>
                          {[3, 6, 12, 24].map(h => (
                            <button
                              key={h}
                              type="button"
                              className="opcion-posponer"
                              onClick={() => posponerNotificacion(item, h)}
                            >
                              {h} horas
                            </button>
                          ))}

                          <div className="menu-posponer-pie">
                            {mostrarInputPersonalizado === item.not_id ? (
                              <div className="posponer-personalizado">
                                <input
                                  type="number"
                                  min="1"
                                  max="720"
                                  value={horasPersonalizadas}
                                  onChange={e => setHorasPersonalizadas(e.target.value)}
                                  aria-label="Horas para posponer"
                                />
                                <span>hrs</span>
                                <button
                                  type="button"
                                  className="accion-menor es-principal"
                                  onClick={() => posponerNotificacion(item, Number(horasPersonalizadas) || 4)}
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="opcion-posponer es-enlace"
                                onClick={() => setMostrarInputPersonalizado(item.not_id)}
                              >
                                Otro plazo…
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="accion-menor es-peligro notif-eliminar"
                      onClick={() => eliminarNotificacion(item)}
                      title="Eliminar lógicamente (se guarda en la pestaña Eliminadas)"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      <span className="texto-accion">Eliminar</span>
                    </button>
                  </div>
                </article>
              ))
            )
          )}

          {tabActiva === "historial" && (
            historial.length === 0 ? (
              <div className="vacio-notif">
                <span>Tu historial está vacío.</span>
              </div>
            ) : (
              historial.map(item => (
                <article key={item.not_id} className="notif es-pasada">
                  <div className="notif-cabeza">
                    <span className="notif-titulo">{item.not_titulo}</span>
                    <time className="notif-hora">
                      {new Date(item.not_creado_en).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })}
                    </time>
                  </div>
                  <div
                    className="notif-cuerpo"
                    dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                  />
                  <div className="fila-acciones notif-acciones">
                    <span className="marca-leida">
                      <Check size={13} aria-hidden="true" /> Leída
                    </span>
                    <button
                      type="button"
                      className="accion-menor es-peligro notif-eliminar"
                      onClick={() => eliminarNotificacion(item)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span className="texto-accion">Eliminar</span>
                    </button>
                  </div>
                </article>
              ))
            )
          )}

          {tabActiva === "eliminadas" && (
            <div className="lista-eliminadas">
              <p className="nota-eliminadas">
                <Info size={14} aria-hidden="true" /> Nada se borra del todo: puedes restaurar cualquier notificación cuando quieras.
              </p>

              {eliminadas.length === 0 ? (
                <div className="vacio-notif">
                  <span>No tienes notificaciones eliminadas.</span>
                </div>
              ) : (
                eliminadas.map(item => (
                  <article key={item.not_id} className="notif es-pasada es-eliminada">
                    <div className="notif-cabeza">
                      <span className="notif-titulo">{item.not_titulo}</span>
                      <time className="notif-hora">
                        {item.not_eliminada_en
                          ? new Date(item.not_eliminada_en).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </time>
                    </div>
                    <div
                      className="notif-cuerpo"
                      dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                    />
                    <div className="fila-acciones notif-acciones">
                      <span className="marca-eliminada">Eliminada</span>
                      <button
                        type="button"
                        className="accion-menor es-discreta notif-eliminar"
                        onClick={() => restaurarNotificacion(item)}
                      >
                        <RotateCcw size={13} aria-hidden="true" /> Restaurar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>

        {/* Acceso a Preferencias */}
        <div className="pie-notif">
          <a href="/panel/configuracion" className="accion-menor es-discreta">
            <Settings size={14} aria-hidden="true" /> Preferencias
          </a>

          {esAdmin && (
            <a href="/panel/emision-notificaciones" className="accion-menor es-discreta">
              <Bell size={14} aria-hidden="true" /> Emitir notificación
            </a>
          )}
        </div>
      </section>
    </>
  );
}
