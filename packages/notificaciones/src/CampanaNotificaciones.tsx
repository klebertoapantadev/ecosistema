"use client";

import React, { useState } from "react";
import { Bell, CheckCheck, ExternalLink, X, Settings } from "lucide-react";

export interface NotificacionItem {
  not_id: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string;
  not_leido_en?: string | null;
  not_creado_en: string;
  not_canal: "IN_APP" | "PUSH" | "EMAIL" | "WHATSAPP_PROPUESTA";
}

interface Props {
  negocio: string;
  usuarioId?: string;
}

export function CampanaNotificaciones({ negocio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "no_leidas">("todas");
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);

  // Cargar notificaciones in-app reales desde el servidor
  React.useEffect(() => {
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
      .catch(() => {});
  }, [negocio]);

  const noLeidasCount = notificaciones.filter(n => !n.not_leido_en).length;

  const marcarComoLeida = (id: string) => {
    setNotificaciones(prev =>
      prev.map(n => (n.not_id === id ? { ...n, not_leido_en: new Date().toISOString() } : n))
    );
  };

  const marcarTodasComoLeidas = () => {
    const ahora = new Date().toISOString();
    setNotificaciones(prev => prev.map(n => ({ ...n, not_leido_en: n.not_leido_en || ahora })));
  };

  const listaFiltrada = notificaciones.filter(n => (filtro === "no_leidas" ? !n.not_leido_en : true));

  return (
    <>
      {/* Botón Campana con Badge interactivo */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Centro de Notificaciones e Historial"
        style={{
          position: "relative",
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#c9d1d9",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
      >
        <Bell size={19} />
        {noLeidasCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              background: "#1f6feb",
              color: "#ffffff",
              fontSize: "0.7rem",
              fontWeight: 800,
              borderRadius: "10px",
              padding: "1px 6px",
              boxShadow: "0 0 10px rgba(31, 111, 235, 0.8)",
              border: "2px solid #0d1117"
            }}
          >
            {noLeidasCount}
          </span>
        )}
      </button>

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
              maxWidth: "420px",
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

            {/* Filtros y acciones rápidas */}
            <div
              style={{
                padding: "10px 16px",
                background: "#0d1117",
                borderBottom: "1px solid #30363d",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.78rem"
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setFiltro("todas")}
                  style={{
                    background: filtro === "todas" ? "#1f6feb" : "#21262d",
                    color: filtro === "todas" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "12px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Todas ({notificaciones.length})
                </button>
                <button
                  onClick={() => setFiltro("no_leidas")}
                  style={{
                    background: filtro === "no_leidas" ? "#1f6feb" : "#21262d",
                    color: filtro === "no_leidas" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "12px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Sin leer ({noLeidasCount})
                </button>
              </div>

              {noLeidasCount > 0 && (
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
                    gap: "4px"
                  }}
                >
                  <CheckCheck size={14} /> Leídas
                </button>
              )}
            </div>

            {/* Lista de Notificaciones */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {listaFiltrada.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#8b949e", fontSize: "0.85rem" }}>
                  <Bell size={32} style={{ opacity: 0.3, marginBottom: "8px" }} />
                  <p>No tienes notificaciones pendientes.</p>
                </div>
              ) : (
                listaFiltrada.map(n => (
                  <div
                    key={n.not_id}
                    onClick={() => marcarComoLeida(n.not_id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      marginBottom: "10px",
                      background: n.not_leido_en ? "#161b22" : "rgba(31, 111, 235, 0.12)",
                      border: n.not_leido_en ? "1px solid #30363d" : "1px solid #388bfd",
                      borderLeft: n.not_leido_en ? "4px solid transparent" : "4px solid #1f6feb",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: n.not_leido_en ? "#c9d1d9" : "#58a6ff" }}>
                        {n.not_titulo}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#8b949e" }}>
                        {new Date(n.not_creado_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: "0.8rem", color: "#8b949e", lineHeight: 1.4 }}
                      dangerouslySetInnerHTML={{ __html: n.not_contenido_html }}
                    />
                    {n.not_url_accion && (
                      <a
                        href={n.not_url_accion}
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
                        Ir a la sección <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer con Enlace a Preferencias */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #30363d", background: "#0d1117" }}>
              <a
                href="/panel/notificaciones"
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
                <Settings size={14} /> Preferencias & Mute Temporal
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
