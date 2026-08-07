"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Settings, CheckCircle2, Volume2, X } from "lucide-react";

interface NotificacionItem {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal?: string;
}

interface Props {
  negocio?: string;
  esAdmin?: boolean;
}

export function WidgetNotificacionesCliente({ negocio = "tranqi", esAdmin = false }: Props) {
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [alertaPushToast, setAlertaPushToast] = useState<NotificacionItem | null>(null);
  const [permisoPush, setPermisoPush] = useState<string>("default");
  const yaCargadoInicialRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermisoPush(Notification.permission);
    }
  }, []);

  const solicitarPermisoPush = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then(perm => {
        setPermisoPush(perm);
        if (perm === "granted" && notificaciones.length > 0) {
          const reciente = notificaciones[0];
          if (reciente) {
            const textoBody = reciente.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 120);
            try { new Notification(reciente.not_titulo, { body: textoBody, icon: "/favicon.ico" }); } catch { /* Ignorar */ }
          }
        }
      });
    }
  };

  const cargarNotificaciones = () => {
    fetch("/api/notificaciones/usuario")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notificaciones)) {
          const prevIds = new Set(notificaciones.map(n => n.not_id));
          const nuevas = data.notificaciones.filter((n: NotificacionItem) => !prevIds.has(n.not_id));

          // Si es la carga inicial y hay elementos, o si entran notificaciones nuevas
          if ((!yaCargadoInicialRef.current && data.notificaciones.length > 0) || (nuevas.length > 0)) {
            const masReciente = nuevas.length > 0 ? nuevas[0] : data.notificaciones[0];

            if (masReciente && !masReciente.not_leido_en) {
              setAlertaPushToast(masReciente);

              // Disparar Web Push nativo si el permiso fue concedido
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                const textoBody = masReciente.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 120);
                try { new Notification(masReciente.not_titulo, { body: textoBody, icon: "/favicon.ico" }); } catch { /* Ignorar */ }
              }

              setTimeout(() => setAlertaPushToast(null), 15000);
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
    const interval = setInterval(cargarNotificaciones, 4000);
    return () => clearInterval(interval);
  }, []);

  const noLeidasCount = notificaciones.filter(n => !n.not_leido_en).length;

  return (
    <>
      {/* ALERTA TOAST FLOTANTE GLOBAL DE PANTALLA COMPLETA (FIXED OVERLAY) */}
      {alertaPushToast && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            right: "24px",
            maxWidth: "440px",
            width: "calc(100vw - 48px)",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
            borderRadius: "16px",
            padding: "18px 20px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 2px #38bdf8",
            zIndex: 99999,
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            transition: "all 0.3s ease"
          }}
        >
          <div style={{ background: "#0284c7", borderRadius: "50%", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Volume2 color="#ffffff" size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🔔 ALERTA PUSH RECIBIDA EN VIVO
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
            title="Cerrar Alerta"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco" style={{ borderLeft: "4px solid #1f6feb" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 id="t-notificaciones-eco" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", margin: 0, fontSize: "1rem", fontWeight: 800 }}>
            <Bell style={{ width: 20, height: 20, color: "#1f6feb" }} /> Notificaciones & Alertas
          </h2>
          <span className="chip-registrado" style={{ background: noLeidasCount > 0 ? "#1f6feb" : "#64748b", color: "#ffffff", fontWeight: 800, padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem" }}>
            🔔 {noLeidasCount} {noLeidasCount === 1 ? "Alerta" : "Alertas"}
          </span>
        </header>

        {/* Botón para activar o verificar permisos Web Push del Navegador */}
        {permisoPush !== "granted" && (
          <div style={{ marginTop: "12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.76rem", color: "#0369a1", fontWeight: 600 }}>
              Activa las alertas Push del navegador para recibir comunicados instantáneos.
            </span>
            <button
              type="button"
              onClick={solicitarPermisoPush}
              style={{ background: "#0284c7", color: "#ffffff", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Activar Push
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          {notificaciones.length === 0 ? (
            <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
              <CheckCircle2 size={24} color="#16a34a" style={{ margin: "0 auto 6px auto", display: "block" }} />
              No tienes notificaciones pendientes.
            </div>
          ) : (
            notificaciones.slice(0, 5).map(item => (
              <div
                key={item.not_id}
                style={{
                  padding: "12px 14px",
                  background: item.not_leido_en ? "#ffffff" : "#f0f7ff",
                  borderRadius: "10px",
                  border: `1.5px solid ${item.not_leido_en ? "#e2e8f0" : "#3b82f6"}`,
                  boxShadow: item.not_leido_en ? "none" : "0 2px 8px rgba(37,99,235,0.12)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>
                    {item.not_titulo}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(item.not_creado_en).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                  </span>
                </div>
                <div
                  style={{ fontSize: "0.82rem", color: "#334155", marginTop: "6px", lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: item.not_contenido_html }}
                />
              </div>
            ))
          )}
        </div>

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
            <Settings size={14} /> Preferencias & Alertas Recibidas
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
