"use client";

import React, { useState } from "react";
import { X, ShieldCheck, Lock, Clock, KeyRound } from "lucide-react";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tituloWidget: string;
  tiempoInactividadMinutos: number;
  onVerificado: () => void;
}

export function ModalVerificarMFAWidget({
  abierto,
  onCerrar,
  tituloWidget,
  tiempoInactividadMinutos,
  onVerificado,
}: Props) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  if (!abierto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.trim().length < 4) {
      setError("Ingresa un código de seguridad o clave MFA válido.");
      return;
    }

    setVerificando(true);
    setError(null);

    // Simulación de verificación de MFA / TOTP token
    setTimeout(() => {
      setVerificando(false);
      setCodigo("");
      onVerificado();
    }, 400);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(5px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "var(--blanco, #ffffff)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "460px",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            background: "var(--panel-papel, #F7F6FA)",
            borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(80, 0, 186, 0.12)",
                color: "var(--violeta, #5000BA)",
                display: "flex",
              }}
            >
              <Lock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 800, margin: 0, color: "var(--negro, #111111)" }}>
                Autenticación MFA Requerida
              </h3>
              <span style={{ fontSize: "0.76rem", color: "var(--panel-gris, #737373)" }}>
                Widget Protegido por Inactividad
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--panel-gris, #737373)",
              display: "flex",
              borderRadius: "50%",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              background: "var(--violeta-suave, #F3E8FF)",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              color: "var(--violeta, #5000BA)",
              fontSize: "0.83rem",
              lineHeight: 1.4,
            }}
          >
            El widget <strong>{tituloWidget}</strong> requiere verificación MFA.
            {tiempoInactividadMinutos > 0 ? (
              <span style={{ display: "block", marginTop: "4px", fontSize: "0.78rem" }}>
                <Clock size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                La sesión anterior caducó tras {tiempoInactividadMinutos} minutos de inactividad.
              </span>
            ) : (
              <span style={{ display: "block", marginTop: "4px", fontSize: "0.78rem" }}>
                Se requiere verificación en cada acceso por políticas de seguridad estrictas.
              </span>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                background: "rgba(176, 0, 32, 0.1)",
                color: "#B00020",
                fontSize: "0.82rem",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="input-codigo-mfa-widget"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--negro, #111111)",
                marginBottom: "6px",
              }}
            >
              Código de Seguridad (MFA / 6 dígitos)
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="input-codigo-mfa-widget"
                type="text"
                maxLength={8}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                autoFocus
                required
                placeholder="Ej: 123456"
                style={{
                  width: "100%",
                  padding: "12px 12px 12px 38px",
                  borderRadius: "8px",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  fontSize: "1.1rem",
                  letterSpacing: "3px",
                  fontWeight: 800,
                  outline: "none",
                }}
              />
              <KeyRound size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={onCerrar}
              className="btn-mini"
              style={{
                background: "var(--panel-papel, #F7F6FA)",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                color: "var(--negro, #111111)",
                padding: "8px 16px",
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={verificando}
              className="btn-mini"
              style={{
                background: "var(--violeta, #5000BA)",
                border: "none",
                color: "#FFFFFF",
                padding: "10px 20px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ShieldCheck size={16} /> {verificando ? "Verificando..." : "Desbloquear Widget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
