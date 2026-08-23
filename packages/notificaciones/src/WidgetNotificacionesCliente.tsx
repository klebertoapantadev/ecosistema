"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bell, Settings, CheckCircle2, Volume2, X, Clock, Trash2, Check,
  ChevronDown, History, RotateCcw, Info
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
                  🔔 ALERTA EN VIVO
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
                      ⏳ {h} horas
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

      {/* SECCIÓN LATERAL DEL PANEL */}
      <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco" style={{ borderLeft: "4px solid #1f6feb" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 id="t-notificaciones-eco" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", margin: 0, fontSize: "1rem", fontWeight: 800 }}>
            <Bell style={{ width: 20, height: 20, color: "#1f6feb" }} /> Notificaciones & Alertas
          </h2>
          <span className="chip-registrado" style={{ background: noLeidasCount > 0 ? "#1f6feb" : "#64748b", color: "#ffffff", fontWeight: 800, padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem" }}>
            🔔 {noLeidasCount} {noLeidasCount === 1 ? "Pendiente" : "Pendientes"}
          </span>
        </header>

        {/* Pestañas: Pendientes vs Historial vs Eliminadas */}
        <div style={{ display: "flex", gap: "4px", marginTop: "12px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
          <button
            type="button"
            onClick={() => setTabActiva("pendientes")}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: "6px",
              border: "none",
              background: tabActiva === "pendientes" ? "#ffffff" : "transparent",
              color: tabActiva === "pendientes" ? "#0f172a" : "#64748b",
              fontWeight: tabActiva === "pendientes" ? 800 : 600,
              fontSize: "0.76rem",
              cursor: "pointer",
              boxShadow: tabActiva === "pendientes" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <Bell size={13} /> Pendientes ({pendientes.length})
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("historial")}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: "6px",
              border: "none",
              background: tabActiva === "historial" ? "#ffffff" : "transparent",
              color: tabActiva === "historial" ? "#0f172a" : "#64748b",
              fontWeight: tabActiva === "historial" ? 800 : 600,
              fontSize: "0.76rem",
              cursor: "pointer",
              boxShadow: tabActiva === "historial" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <History size={13} /> Historial ({historial.length})
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("eliminadas")}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: "6px",
              border: "none",
              background: tabActiva === "eliminadas" ? "#ffffff" : "transparent",
              color: tabActiva === "eliminadas" ? "#ef4444" : "#64748b",
              fontWeight: tabActiva === "eliminadas" ? 800 : 600,
              fontSize: "0.76rem",
              cursor: "pointer",
              boxShadow: tabActiva === "eliminadas" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <Trash2 size={13} /> Eliminadas ({eliminadas.length})
          </button>
        </div>

        {/* Botón para activar permisos Web Push */}
        {permisoPush !== "granted" && (
          <div style={{ marginTop: "10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.74rem", color: "#0369a1", fontWeight: 600 }}>
              Activa notificaciones del navegador para recibir comunicados.
            </span>
            <button
              type="button"
              onClick={solicitarPermisoPush}
              style={{ background: "#0284c7", color: "#ffffff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Activar
            </button>
          </div>
        )}

        {/* Lista de Notificaciones según pestaña activa */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
          {tabActiva === "pendientes" && (
            pendientes.length === 0 ? (
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                <CheckCircle2 size={24} color="#16a34a" style={{ margin: "0 auto 6px auto", display: "block" }} />
                No tienes notificaciones pendientes en este momento.
              </div>
            ) : (
              pendientes.map(item => (
                <div
                  key={item.not_id}
                  style={{
                    padding: "12px 14px",
                    background: "#f0f7ff",
                    borderRadius: "10px",
                    border: "1.5px solid #3b82f6",
                    boxShadow: "0 2px 8px rgba(37,99,235,0.12)",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>
                      {item.not_titulo}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(item.not_creado_en).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: "0.82rem", color: "#334155", marginTop: "6px", lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                  />

                  {/* Barra de 3 Acciones: Aceptar, Posponer, Eliminar */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginTop: "10px", borderTop: "1px solid #dbeafe", paddingTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => aceptarNotificacion(item)}
                      style={{
                        background: "#10b981",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Confirmar lectura y pasar al historial"
                    >
                      <Check size={13} /> Aceptar
                    </button>

                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownPosponerId(dropdownPosponerId === item.not_id ? null : item.not_id);
                          setMostrarInputPersonalizado(null);
                        }}
                        style={{
                          background: "#ffffff",
                          color: "#1e293b",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <Clock size={13} /> Posponer <ChevronDown size={12} />
                      </button>

                      {dropdownPosponerId === item.not_id && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "100%",
                            left: 0,
                            marginBottom: "6px",
                            background: "#ffffff",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "8px",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            minWidth: "180px",
                            padding: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px"
                          }}
                        >
                          <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#64748b", padding: "4px 8px", textTransform: "uppercase" }}>
                            Ocultar alerta por:
                          </div>
                          {[3, 6, 12, 24].map(h => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => posponerNotificacion(item, h)}
                              style={{
                                background: "none",
                                border: "none",
                                textAlign: "left",
                                padding: "6px 8px",
                                fontSize: "0.78rem",
                                color: "#1e293b",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: 600
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                              onMouseLeave={e => (e.currentTarget.style.background = "none")}
                            >
                              ⏳ {h} horas
                            </button>
                          ))}

                          <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "4px", paddingTop: "4px" }}>
                            {mostrarInputPersonalizado === item.not_id ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px" }}>
                                <input
                                  type="number"
                                  min="1"
                                  max="720"
                                  value={horasPersonalizadas}
                                  onChange={e => setHorasPersonalizadas(e.target.value)}
                                  style={{
                                    width: "50px",
                                    padding: "4px",
                                    fontSize: "0.78rem",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "4px",
                                    textAlign: "center"
                                  }}
                                />
                                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>hrs</span>
                                <button
                                  type="button"
                                  onClick={() => posponerNotificacion(item, Number(horasPersonalizadas) || 4)}
                                  style={{
                                    background: "#0284c7",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    cursor: "pointer"
                                  }}
                                >
                                  OK
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setMostrarInputPersonalizado(item.not_id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  textAlign: "left",
                                  padding: "6px 8px",
                                  fontSize: "0.78rem",
                                  color: "#0284c7",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontWeight: 700,
                                  width: "100%"
                                }}
                              >
                                ✏️ Personalizado...
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => eliminarNotificacion(item)}
                      style={{
                        background: "transparent",
                        color: "#ef4444",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 8px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        marginLeft: "auto"
                      }}
                      title="Eliminar lógicamente (se guarda en la pestaña Eliminadas)"
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {tabActiva === "historial" && (
            historial.length === 0 ? (
              <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                No tienes notificaciones registradas en tu historial.
              </div>
            ) : (
              historial.map(item => (
                <div
                  key={item.not_id}
                  style={{
                    padding: "10px 12px",
                    background: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    opacity: 0.95
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                      {item.not_titulo}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {new Date(item.not_creado_en).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px", lineHeight: 1.4 }}
                    dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", borderTop: "1px dashed #f1f5f9", paddingTop: "6px" }}>
                    <span style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 700 }}>
                      ✓ Leída / Confirmada
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarNotificacion(item)}
                      style={{
                        background: "transparent",
                        color: "#94a3b8",
                        border: "none",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                    >
                      <Trash2 size={12} /> Mover a eliminadas
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {tabActiva === "eliminadas" && (
            <div>
              <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "8px", color: "#991b1b", fontSize: "0.74rem", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Info size={14} /> Eliminación lógica auditable. Puedes restaurar cualquier notificación en cualquier momento.
              </div>

              {eliminadas.length === 0 ? (
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                  No tienes notificaciones eliminadas.
                </div>
              ) : (
                eliminadas.map(item => (
                  <div
                    key={item.not_id}
                    style={{
                      padding: "10px 12px",
                      background: "#fefefe",
                      borderRadius: "8px",
                      border: "1px dashed #fca5a5",
                      marginBottom: "8px",
                      opacity: 0.9
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>
                        {item.not_titulo}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 700, whiteSpace: "nowrap" }}>
                        Eliminada
                      </span>
                    </div>
                    <div
                      style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px", lineHeight: 1.4 }}
                      dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", borderTop: "1px dashed #fee2e2", paddingTop: "6px" }}>
                      <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                        {item.not_eliminada_en ? `Eliminada el ${new Date(item.not_eliminada_en).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}` : "Eliminada lógicamente"}
                      </span>
                      <button
                        type="button"
                        onClick={() => restaurarNotificacion(item)}
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <RotateCcw size={12} /> Restaurar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Acceso a Preferencias */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
          <a
            href="/panel/configuracion"
            style={{
              fontSize: "0.78rem",
              color: "#334155",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              padding: "6px 12px",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Settings size={14} /> Preferencias & Configuración
          </a>

          {esAdmin && (
            <a
              href="/panel/emision-notificaciones"
              style={{
                fontSize: "0.78rem",
                color: "#ffffff",
                background: "#2563eb",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                textDecoration: "none",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Bell size={14} /> Consola de Emisión Multicanal
            </a>
          )}
        </div>
      </section>
    </>
  );
}
