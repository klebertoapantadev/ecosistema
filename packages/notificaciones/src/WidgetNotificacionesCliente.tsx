"use client";

import React, { useState, useEffect } from "react";
import { Bell, Settings, CheckCircle2, Volume2 } from "lucide-react";

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

  const cargarNotificaciones = () => {
    fetch("/api/notificaciones/usuario")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notificaciones)) {
          const prevIds = new Set(notificaciones.map(n => n.not_id));
          const nuevas = data.notificaciones.filter((n: NotificacionItem) => !prevIds.has(n.not_id));

          // Si hay una nueva notificación entrante, disparar alerta Push / Toast
          if (nuevas.length > 0 && notificaciones.length > 0) {
            const masReciente = nuevas[0];
            setAlertaPushToast(masReciente);

            // Disparar Notificación de Navegador (Web Push)
            if (typeof window !== "undefined" && "Notification" in window) {
              const textoBody = masReciente.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 120);
              if (Notification.permission === "granted") {
                try { new Notification(masReciente.not_titulo, { body: textoBody, icon: "/favicon.ico" }); } catch { /* Ignorar */ }
              } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(p => {
                  if (p === "granted") {
                    try { new Notification(masReciente.not_titulo, { body: textoBody, icon: "/favicon.ico" }); } catch { /* Ignorar */ }
                  }
                });
              }
            }

            setTimeout(() => setAlertaPushToast(null), 10000);
          }

          setNotificaciones(data.notificaciones);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 5000);
    return () => clearInterval(interval);
  }, []);

  const noLeidasCount = notificaciones.filter(n => !n.not_leido_en).length;

  return (
    <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco" style={{ borderLeft: "4px solid #1f6feb", position: "relative" }}>
      {/* Toast Alert Pop-up para Push Recibida en Vivo */}
      {alertaPushToast && (
        <div
          style={{
            position: "absolute",
            top: "-15px",
            right: "10px",
            left: "10px",
            background: "#1e293b",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "12px 16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            zIndex: 99,
            border: "1.5px solid #38bdf8",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "pulse 2s infinite"
          }}
        >
          <Volume2 color="#38bdf8" size={22} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", display: "block" }}>
              🔔 ¡NUEVA NOTIFICACIÓN PUSH RECIBIDA!
            </span>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>
              {alertaPushToast.not_titulo}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>
              {alertaPushToast.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 90)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlertaPushToast(null)}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id="t-notificaciones-eco" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", margin: 0, fontSize: "1rem", fontWeight: 800 }}>
          <Bell style={{ width: 20, height: 20, color: "#1f6feb" }} /> Notificaciones & Alertas
        </h2>
        <span className="chip-registrado" style={{ background: "#1f6feb", color: "#ffffff", fontWeight: 800, padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem" }}>
          🔔 {noLeidasCount} {noLeidasCount === 1 ? "Alerta" : "Alertas"}
        </span>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
        {notificaciones.length === 0 ? (
          <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
            <CheckCircle2 size={24} color="#16a34a" style={{ margin: "0 auto 6px auto", display: "block" }} />
            No tienes notificaciones pendientes.
          </div>
        ) : (
          notificaciones.slice(0, 4).map(item => (
            <div
              key={item.not_id}
              style={{
                padding: "12px 14px",
                background: item.not_leido_en ? "#ffffff" : "#f0f7ff",
                borderRadius: "10px",
                border: `1px solid ${item.not_leido_en ? "#e2e8f0" : "#93c5fd"}`,
                boxShadow: item.not_leido_en ? "none" : "0 2px 6px rgba(37,99,235,0.08)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
                  {item.not_titulo}
                </span>
                <span style={{ fontSize: "0.72rem", color: "#64748b", whiteSpace: "nowrap" }}>
                  {new Date(item.not_creado_en).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                </span>
              </div>
              <div
                style={{ fontSize: "0.8rem", color: "#334155", marginTop: "6px", lineHeight: 1.5 }}
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
  );
}
