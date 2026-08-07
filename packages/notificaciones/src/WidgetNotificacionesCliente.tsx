"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Settings, CheckCircle2, Volume2, ShieldCheck } from "lucide-react";

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

            // Solo mostrar Toast/Push para la más reciente si no ha sido leída
            if (!masReciente.not_leido_en) {
              setAlertaPushToast(masReciente);

              // Disparar Web Push nativo si el permiso fue concedido
              if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                const textoBody = masReciente.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 120);
                try { new Notification(masReciente.not_titulo, { body: textoBody, icon: "/favicon.ico" }); } catch { /* Ignorar */ }
              }

              setTimeout(() => setAlertaPushToast(null), 12000);
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
    <section className="tarjeta-seccion" aria-labelledby="t-notificaciones-eco" style={{ borderLeft: "4px solid #1f6feb", position: "relative" }}>
      {/* Alerta Pop-up Toast Flotante Push */}
      {alertaPushToast && (
        <div
          style={{
            position: "absolute",
            top: "-15px",
            right: "10px",
            left: "10px",
            background: "#0f172a",
            color: "#ffffff",
            borderRadius: "12px",
            padding: "14px 18px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            zIndex: 99,
            border: "2px solid #38bdf8",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <Volume2 color="#38bdf8" size={24} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", display: "block" }}>
              🔔 ¡ALERTA PUSH RECIBIDA EN VIVO!
            </span>
            <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff", marginTop: "2px" }}>
              {alertaPushToast.not_titulo}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: "2px" }}>
              {alertaPushToast.not_contenido_html.replace(/<[^>]*>?/gm, "").slice(0, 100)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlertaPushToast(null)}
            style={{ background: "#1e293b", border: "1px solid #475569", color: "#ffffff", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontWeight: 700, fontSize: "0.75rem" }}
          >
            Entendido
          </button>
        </div>
      )}

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id="t-notificaciones-eco" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", margin: 0, fontSize: "1rem", fontWeight: 800 }}>
          <Bell style={{ width: 20, height: 20, color: "#1f6feb" }} /> Notificaciones & Alertas
        </h2>
        <span className="chip-registrado" style={{ background: noLeidasCount > 0 ? "#1f6feb" : "#64748b", color: "#ffffff", fontWeight: 800, padding: "3px 10px", borderRadius: "12px", fontSize: "0.75rem" }}>
          🔔 {noLeidasCount} {noLeidasCount === 1 ? "Alerta" : "Alertas"}
        </span>
      </header>

      {/* Botón para solicitar o verificar permisos Web Push del Navegador */}
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
  );
}
