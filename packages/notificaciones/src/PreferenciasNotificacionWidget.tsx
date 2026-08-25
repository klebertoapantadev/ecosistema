"use client";

import React, { useState } from "react";
import { Bell, Mail, Smartphone, VolumeX, Calendar, Check, ShieldAlert, ArrowLeft } from "lucide-react";

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
    <div style={{ color: "#c9d1d9", width: "100%" }}>
      {/* Banner Superior Estilo Panel Principal */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Mi Cuenta & Preferencias</div>
            <div className="tarjeta-proteccion-plan">
              Preferencias de Notificaciones & Silenciado Temporal <i>({negocio})</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Configura por qué canales deseas recibir notificaciones o silenciar temporalmente las alertas operativas.
            </div>
          </div>
          <a
            href="/panel"
            style={{
              fontSize: "0.8rem",
              color: "#c9d1d9",
              background: "#21262d",
              border: "1px solid #30363d",
              borderRadius: "6px",
              padding: "6px 12px",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <ArrowLeft size={16} /> Volver al Panel
          </a>
        </div>
      </section>

      {guardadoMsg && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(46, 160, 67, 0.15)", border: "1px solid #2ea043", color: "#3fb950", fontSize: "0.85rem", fontWeight: 600, marginBottom: "20px" }}>
          Preferencias de notificación guardadas correctamente.
        </div>
      )}

      {/* 1. Toggles por Canal */}
      <section className="tarjeta-seccion" style={{ marginBottom: "20px" }}>
        <header>
          <h2 style={{ fontSize: "1rem", color: "#58a6ff", display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={18} /> 1. Canales de Recepción Habilitados
          </h2>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1117", padding: "12px 16px", borderRadius: "8px", border: "1px solid #30363d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Mail size={20} color="#3fb950" />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#c9d1d9" }}>Correo Electrónico (Email)</div>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Notificaciones formales, comprobantes y comunicados</div>
              </div>
            </div>
            <input type="checkbox" checked={emailActivo} onChange={e => setEmailActivo(e.target.checked)} style={{ transform: "scale(1.2)", cursor: "pointer" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1117", padding: "12px 16px", borderRadius: "8px", border: "1px solid #30363d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Smartphone size={20} color="#d29922" />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#c9d1d9" }}>Notificaciones Push (Web y App Móvil)</div>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Alertas instantáneas en pantalla de tu navegador o smartphone</div>
              </div>
            </div>
            <input type="checkbox" checked={pushActivo} onChange={e => setPushActivo(e.target.checked)} style={{ transform: "scale(1.2)", cursor: "pointer" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1117", padding: "12px 16px", borderRadius: "8px", border: "1px solid #30363d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Bell size={20} color="#388bfd" />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#c9d1d9" }}>Notificaciones In-App (Campana)</div>
                <div style={{ fontSize: "0.76rem", color: "#8b949e" }}>Indicador de campana persistente dentro de la aplicación</div>
              </div>
            </div>
            <input type="checkbox" checked={inAppActivo} onChange={e => setInAppActivo(e.target.checked)} style={{ transform: "scale(1.2)", cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ marginTop: "14px", padding: "10px 12px", background: "rgba(210, 153, 34, 0.1)", border: "1px dashed #d29922", borderRadius: "6px", fontSize: "0.76rem", color: "#d29922", display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldAlert size={16} /> Las notificaciones de seguridad crítica (reseteo de clave, inicios inusuales de sesión) NO se pueden desactivar.
        </div>
      </section>

      {/* 2. Silenciado por Tiempo (Mute Temporal) */}
      <section className="tarjeta-seccion" style={{ marginBottom: "20px" }}>
        <header>
          <h2 style={{ fontSize: "1rem", color: "#58a6ff", display: "flex", alignItems: "center", gap: "8px" }}>
            <VolumeX size={18} color="#f85149" /> 2. Silenciado por Tiempo (Mute Temporal)
          </h2>
        </header>
        <p style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "4px", marginBottom: "16px" }}>
          Pausa temporalmente los avisos no críticos. El despacho se reanudará automáticamente al vencer la vigencia.
        </p>

        <div className="rejilla-auto" style={{ "--min": "130px", "--hueco": "10px", marginBottom: "16px" } as React.CSSProperties}>
          <button
            type="button"
            onClick={() => setMuteOpcion("DESACTIVADO")}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "DESACTIVADO" ? "#238636" : "#0d1117",
              color: "#fff",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Activo (Sin Mute)
          </button>
          <button
            type="button"
            onClick={() => setMuteOpcion("HOY")}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "HOY" ? "#1f6feb" : "#0d1117",
              color: "#fff",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            ⏱Silenciar Hoy
          </button>
          <button
            type="button"
            onClick={() => setMuteOpcion("SEMANA")}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "SEMANA" ? "#1f6feb" : "#0d1117",
              color: "#fff",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Esta Semana
          </button>
          <button
            type="button"
            onClick={() => setMuteOpcion("MES")}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              background: muteOpcion === "MES" ? "#1f6feb" : "#0d1117",
              color: "#fff",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Este Mes
          </button>
        </div>

        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            onClick={guardarPreferencias}
            className="btn-primario"
            style={{
              background: "#1f6feb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 20px",
              fontSize: "0.84rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Check size={16} /> Guardar Preferencias
          </button>
        </div>
      </section>
    </div>
  );
}
