"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { reenviarNotificacionAceptacionAction } from "../acciones";

interface Props {
  solicitudId: string;
  correo?: string | null;
}

export function BotonReenviarNotificacionAceptacion({ solicitudId, correo }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const manejarReenvio = async () => {
    setEnviando(true);
    setExito(null);
    setError(null);

    try {
      const res = await reenviarNotificacionAceptacionAction(solicitudId);
      if (res.ok) {
        setExito(`Notificación y correo de aceptación reenviados con éxito a ${correo || "el postulante"}.`);
      } else {
        setError(res.error || "No se pudo reenviar la notificación.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al reenviar la notificación.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ marginTop: "16px" }}>
      <button
        type="button"
        onClick={manejarReenvio}
        disabled={enviando}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "linear-gradient(135deg, #05876E 0%, #046A57 100%)",
          color: "#FFFFFF",
          border: "none",
          padding: "10px 18px",
          borderRadius: "10px",
          fontSize: "0.86rem",
          fontWeight: 800,
          cursor: enviando ? "not-allowed" : "pointer",
          boxShadow: "0 4px 12px rgba(5, 135, 110, 0.25)",
          transition: "all 0.15s ease",
          opacity: enviando ? 0.7 : 1,
        }}
      >
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {enviando ? "Reenviando notificación..." : "Reenviar Notificación de Aceptación y Enlace de Contrato"}
      </button>

      {exito && (
        <div
          style={{
            background: "#ECFDF5",
            border: "1px solid #10B981",
            color: "#065F46",
            padding: "10px 14px",
            borderRadius: "8px",
            marginTop: "10px",
            fontSize: "0.86rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={18} color="#059669" /> {exito}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #EF4444",
            color: "#991B1B",
            padding: "10px 14px",
            borderRadius: "8px",
            marginTop: "10px",
            fontSize: "0.86rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} color="#DC2626" /> {error}
        </div>
      )}
    </div>
  );
}
