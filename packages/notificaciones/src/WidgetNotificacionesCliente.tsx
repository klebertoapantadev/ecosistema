"use client";

import React, { useState, useEffect } from "react";
import { Bell, Settings, ExternalLink, CheckCircle } from "lucide-react";

interface NotificacionItem {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal: "IN_APP" | "PUSH" | "EMAIL" | "WHATSAPP_PROPUESTA";
}

interface Props {
  negocio?: string;
  esAdmin?: boolean;
}

export function WidgetNotificacionesCliente({ negocio = "tranqi", esAdmin = false }: Props) {
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarNotificaciones = () => {
    fetch("/api/notificaciones/usuario")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notificaciones) && data.notificaciones.length > 0) {
          setNotificaciones(data.notificaciones);
        } else {
          setNotificaciones([
            {
              not_id: "demo-1",
              not_titulo: `Bienvenido a ${negocio} 2026`,
              not_contenido_html: "Se ha activado tu suscripción a la plataforma de gestión legal e identidad unificada.",
              not_url_accion: "/panel",
              not_leido_en: null,
              not_creado_en: new Date().toISOString(),
              not_canal: "IN_APP"
            }
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 8000);
    return () => clearInterval(interval);
  }, []);

  const noLeidasCount = notificaciones.filter(n => !n.not_leido_en).length;

  return (
    <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco" style={{ borderLeft: "4px solid #1f6feb" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id="t-notificaciones-eco" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e293b", margin: 0, fontSize: "1rem", fontWeight: 800 }}>
          <Bell style={{ width: 20, height: 20, color: "#1f6feb" }} /> Notificaciones & Alertas
        </h2>
        <span className="chip-registrado" style={{ background: "#1f6feb", color: "#ffffff", fontWeight: 800, padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem" }}>
          🔔 {noLeidasCount} {noLeidasCount === 1 ? "Alerta" : "Alertas"}
        </span>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
        {notificaciones.slice(0, 4).map(item => (
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
        ))}
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
