"use client";

import { useEffect } from "react";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Volume2, X } from "lucide-react";

export type TipoNotificacion = "exito" | "error" | "info" | "advertencia" | "push";

export interface ModalNotificacionPushProps {
  abierto: boolean;
  tipo?: TipoNotificacion;
  titulo: string;
  mensaje: string;
  textoBoton?: string;
  textoCancelar?: string;
  mostrarConfirmacion?: boolean;
  alAceptar: () => void;
  alCancelar?: () => void;
}

export function ModalNotificacionPush({
  abierto,
  tipo = "exito",
  titulo,
  mensaje,
  textoBoton = "Entendido",
  textoCancelar = "Cancelar",
  mostrarConfirmacion = false,
  alAceptar,
  alCancelar,
}: ModalNotificacionPushProps) {
  useEffect(() => {
    if (abierto && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(titulo, {
            body: mensaje.replace(/<[^>]*>?/gm, "").slice(0, 120),
            icon: "/favicon.ico",
          });
        } catch {
          // Ignorar restricciones de navegador
        }
      }
    }
  }, [abierto, titulo, mensaje]);

  if (!abierto) return null;

  const configuracionTipo = {
    exito: {
      colorIcono: "#10B981",
      colorFondoIcono: "#ECFDF5",
      colorBoton: "linear-gradient(135deg, #059669 0%, #047857 100%)",
      sombraBoton: "0 4px 14px rgba(5, 150, 105, 0.3)",
      etiqueta: "NOTIFICACIÓN PUSH RECIBIDA",
      Icono: CheckCircle2,
    },
    push: {
      colorIcono: "#38BDF8",
      colorFondoIcono: "#0284C7",
      colorBoton: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
      sombraBoton: "0 4px 14px rgba(2, 132, 199, 0.3)",
      etiqueta: "NOTIFICACIÓN PUSH EN VIVO",
      Icono: Volume2,
    },
    advertencia: {
      colorIcono: "#F59E0B",
      colorFondoIcono: "#FFFBEB",
      colorBoton: "linear-gradient(135deg, #D97706 0%, #B45309 100%)",
      sombraBoton: "0 4px 14px rgba(217, 119, 6, 0.3)",
      etiqueta: "ALERTA DE SEGURIDAD PUSH",
      Icono: AlertTriangle,
    },
    error: {
      colorIcono: "#EF4444",
      colorFondoIcono: "#FEF2F2",
      colorBoton: "linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)",
      sombraBoton: "0 4px 14px rgba(220, 38, 38, 0.3)",
      etiqueta: "ERROR DEL SISTEMA",
      Icono: AlertCircle,
    },
    info: {
      colorIcono: "#5000BA",
      colorFondoIcono: "#F3E8FF",
      colorBoton: "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)",
      sombraBoton: "0 4px 14px rgba(80, 0, 186, 0.3)",
      etiqueta: "NOTIFICACIÓN IN-APP",
      Icono: Bell,
    },
  }[tipo];

  const { Icono } = configuracionTipo;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(17, 24, 39, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          maxWidth: "480px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
          animation: "aparecerModal 0.2s ease-out",
        }}
      >
        {/* CABECERA NOTIFICACIÓN PUSH */}
        <div
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: configuracionTipo.colorFondoIcono,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icono size={22} color={configuracionTipo.colorIcono} />
            </div>
            <div>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "#38BDF8",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  display: "block",
                }}
              >
                {configuracionTipo.etiqueta}
              </span>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "2px 0 0 0", color: "#ffffff" }}>
                {titulo}
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={alCancelar || alAceptar}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              color: "#94A3B8",
              borderRadius: "8px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* CUERPO MENSAJE */}
        <div
          style={{
            padding: "24px",
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "#334155",
            whiteSpace: "pre-line",
          }}
        >
          {mensaje}
        </div>

        {/* PIE CON BOTONES */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            background: "#F8FAFC",
          }}
        >
          {mostrarConfirmacion && (
            <button
              type="button"
              onClick={alCancelar || alAceptar}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                background: "#ffffff",
                color: "#475569",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              {textoCancelar}
            </button>
          )}

          <button
            type="button"
            onClick={alAceptar}
            style={{
              padding: "12px 22px",
              borderRadius: "10px",
              border: "none",
              background: configuracionTipo.colorBoton,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: configuracionTipo.sombraBoton,
              transition: "transform 0.1s ease",
            }}
          >
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
