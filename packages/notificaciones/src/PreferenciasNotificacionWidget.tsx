"use client";

import React, { useState } from "react";
import { Bell, Mail, Smartphone, VolumeX, Calendar, Check, ShieldAlert } from "lucide-react";

interface Props {
  negocio: string;
}

export function PreferenciasNotificacionWidget({ negocio }: Props) {
  const [emailActivo, setEmailActivo] = useState(true);
  const [pushActivo, setPushActivo] = useState(true);
  const [inAppActivo, setInAppActivo] = useState(true);

  // Silenciado temporal (Mute por tiempo)
  const [muteOpcion, setMuteOpcion] = useState<"DESACTIVADO" | "HOY" | "SEMANA" | "MES" | "CUSTOM">("DESACTIVADO");
  const [fechaCustom, setFechaCustom] = useState("");
  const [guardadoMsg, setGuardadoMsg] = useState(false);

  const guardarPreferencias = () => {
    setGuardadoMsg(true);
    setTimeout(() => setGuardadoMsg(false), 3000);
  };

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: "12px",
        padding: "24px",
        color: "#c9d1d9",
        maxWidth: "680px"
      }}
    >
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#58a6ff", display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <Bell size={20} /> Preferencias de Notificaciones & Silenciado Temporal ({negocio})
      </h2>
      <p style={{ fontSize: "0.82rem", color: "#8b949e", marginBottom: "20px" }}>
        Configura por qué canales deseas recibir notificaciones o silenciar temporalmente las alertas operativas.
      </p>

      {guardadoMsg && (
        <div style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(46, 160, 67, 0.2)", border: "1px solid #2ea043", color: "#3fb950", fontSize: "0.82rem", marginBottom: "16px" }}>
          ✅ Preferencias guardadas correctamente.
        </div>
      )}

      {/* 1. Toggles por Canal */}
      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "#c9d1d9", marginBottom: "12px" }}>
          1. Canales de Recepción Habilitados
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Mail size={18} color="#3fb950" />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Correo Electrónico (Email)</div>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Notificaciones formales, comprobantes y comunicados</div>
              </div>
            </div>
            <input type="checkbox" checked={emailActivo} onChange={e => setEmailActivo(e.target.checked)} style={{ transform: "scale(1.2)", cursor: "pointer" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Smartphone size={18} color="#d29922" />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Notificaciones Push (Web y App Móvil)</div>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Alertas instantáneas en pantalla de tu navegador o smartphone</div>
              </div>
            </div>
            <input type="checkbox" checked={pushActivo} onChange={e => setPushActivo(e.target.checked)} style={{ transform: "scale(1.2)", cursor: "pointer" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Bell size={18} color="#388bfd" />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Notificaciones In-App</div>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Indicador de campana persistente dentro de la aplicación</div>
              </div>
            </div>
            <input type="checkbox" checked={inAppActivo} onChange={e => setInAppActivo(e.target.checked)} style={{ transform: "scale(1.2)", cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ marginTop: "12px", padding: "8px", background: "rgba(210, 153, 34, 0.1)", border: "1px dashed #d29922", borderRadius: "6px", fontSize: "0.74rem", color: "#d29922", display: "flex", alignItems: "center", gap: "6px" }}>
          <ShieldAlert size={14} /> Las notificaciones de seguridad crítica (reseteo de clave, inicios inusuales) NO se pueden desactivar.
        </div>
      </div>

      {/* 2. Silenciado por Tiempo (Mute Temporal) */}
      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "#c9d1d9", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
          <VolumeX size={18} color="#f85149" /> 2. Silenciado por Tiempo (Mute Temporal)
        </h3>
        <p style={{ fontSize: "0.78rem", color: "#8b949e", marginBottom: "12px" }}>
          Pausa temporalmente los avisos no críticos. El despacho se reanudará automáticamente al vencer la vigencia.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "12px" }}>
          <button
            type="button"
            onClick={() => setMuteOpcion("DESACTIVADO")}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "DESACTIVADO" ? "#238636" : "#161b22",
              color: "#fff",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🔔 Activo (Sin Mute)
          </button>
          <button
            type="button"
            onClick={() => setMuteOpcion("HOY")}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "HOY" ? "#1f6feb" : "#161b22",
              color: "#fff",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🌙 Silenciar Hoy
          </button>
          <button
            type="button"
            onClick={() => setMuteOpcion("SEMANA")}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "SEMANA" ? "#1f6feb" : "#161b22",
              color: "#fff",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            📅 Esta Semana
          </button>
          <button
            type="button"
            onClick={() => setMuteOpcion("MES")}
            style={{
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "MES" ? "#1f6feb" : "#161b22",
              color: "#fff",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🗓 Este Mes
          </button>
        </div>

        {muteOpcion !== "DESACTIVADO" && (
          <div style={{ background: "rgba(31, 111, 235, 0.12)", border: "1px solid #1f6feb", borderRadius: "6px", padding: "10px", fontSize: "0.78rem", color: "#58a6ff" }}>
            ℹ️ Las notificaciones estarán silenciadas hasta:{" "}
            <strong>
              {muteOpcion === "HOY" ? "Hoy a las 23:59" : muteOpcion === "SEMANA" ? "Domingo próximo a las 23:59" : "Fin de mes a las 23:59"}
            </strong>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={guardarPreferencias}
        style={{
          background: "#1f6feb",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          padding: "10px 20px",
          fontWeight: 700,
          fontSize: "0.85rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}
      >
        <Check size={16} /> Guardar Preferencias
      </button>
    </div>
  );
}
