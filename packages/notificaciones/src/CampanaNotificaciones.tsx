"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCheck, ExternalLink, X, Filter } from "lucide-react";

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
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([
    {
      not_id: "demo-1",
      not_titulo: "Bienvenido a tranqi 2026",
      not_contenido_html: "Se ha activado tu suscripción a la plataforma de gestión legal e identidad unificada.",
      not_url_accion: "/panel",
      not_leido_en: null,
      not_creado_en: new Date().toISOString(),
      not_canal: "IN_APP"
    },
    {
      not_id: "demo-2",
      not_titulo: "Nuevo perfil asignado: ABOGADO",
      not_contenido_html: "Se ha actualizado la jerarquía de tu usuario en el negocio tranqi.",
      not_url_accion: "/panel?modo=abogado",
      not_leido_en: new Date().toISOString(),
      not_creado_en: new Date(Date.now() - 3600000).toISOString(),
      not_canal: "IN_APP"
    }
  ]);

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
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Botón Campana con Badge interactivo */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
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

      {/* Popover Drawer */}
      {abierto && (
        <div
          style={{
            position: "absolute",
            top: "48px",
            right: 0,
            width: "360px",
            maxHeight: "480px",
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* Header Popover */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #30363d",
              background: "#0d1117",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={16} color="#58a6ff" />
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#c9d1d9" }}>
                Notificaciones ({noLeidasCount})
              </span>
            </div>
            <button
              onClick={() => setAbierto(false)}
              style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Filtros y acciones rápidas */}
          <div
            style={{
              padding: "8px 12px",
              background: "#0d1117",
              borderBottom: "1px solid #30363d",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.76rem"
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
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Todas
              </button>
              <button
                onClick={() => setFiltro("no_leidas")}
                style={{
                  background: filtro === "no_leidas" ? "#1f6feb" : "#21262d",
                  color: filtro === "no_leidas" ? "#fff" : "#8b949e",
                  border: "none",
                  borderRadius: "12px",
                  padding: "2px 8px",
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
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {listaFiltrada.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", color: "#8b949e", fontSize: "0.82rem" }}>
                No tienes notificaciones pendientes.
              </p>
            ) : (
              listaFiltrada.map(n => (
                <div
                  key={n.not_id}
                  onClick={() => marcarComoLeida(n.not_id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    marginBottom: "6px",
                    background: n.not_leido_en ? "#161b22" : "rgba(31, 111, 235, 0.12)",
                    borderLeft: n.not_leido_en ? "3px solid transparent" : "3px solid #1f6feb",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.83rem", color: n.not_leido_en ? "#c9d1d9" : "#58a6ff" }}>
                      {n.not_titulo}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#8b949e" }}>
                      {new Date(n.not_creado_en).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: "0.78rem", color: "#8b949e", lineHeight: 1.4 }}
                    dangerouslySetInnerHTML={{ __html: n.not_contenido_html }}
                  />
                  {n.not_url_accion && (
                    <a
                      href={n.not_url_accion}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.74rem",
                        color: "#388bfd",
                        marginTop: "6px",
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
        </div>
      )}
    </div>
  );
}
