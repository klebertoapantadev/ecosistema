"use client";

import React from "react";
import { X, ShieldCheck, BellRing, Check } from "lucide-react";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onAceptar?: () => void;
  aceptado?: boolean;
}

export function ModalTerminosNotificaciones({
  abierto,
  onCerrar,
  onAceptar,
  aceptado = false,
}: Props) {
  if (!abierto) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
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
          maxWidth: "560px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del Modal */}
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
                padding: "6px",
                borderRadius: "8px",
                background: "var(--violeta-suave, #F3E8FF)",
                color: "var(--violeta, #5000BA)",
                display: "flex",
              }}
            >
              <BellRing size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, color: "var(--negro, #111111)" }}>
                Términos y Condiciones de Notificaciones
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--panel-gris, #737373)" }}>
                Conformidad Ley LOPDP & Canales de Comunicación
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

        {/* Cuerpo con Scroll */}
        <div style={{ padding: "20px", overflowY: "auto", fontSize: "0.85rem", color: "#374151", lineHeight: 1.6 }}>
          <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--negro, #111111)", marginBottom: "8px" }}>
            1. Consentimiento de Recepción de Notificaciones Operativas y Legales
          </h4>
          <p style={{ margin: "0 0 12px 0" }}>
            Al autorizar el envío de notificaciones (vía correo electrónico, WhatsApp o alertas in-app), el usuario acepta recibir avisos sobre el estado de sus trámites, solicitudes, actualizaciones de causas legales, recordatorios de citas y alertas de seguridad.
          </p>

          <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--negro, #111111)", marginBottom: "8px" }}>
            2. Protección de Datos Personales (LOPDP Ecuador)
          </h4>
          <p style={{ margin: "0 0 12px 0" }}>
            Sus datos de contacto (número de WhatsApp, correo institucional y correos adicionales de notificación) serán tratados de manera confidencial y encriptados en los servidores de la plataforma. Jamás serán vendidos ni transferidos a terceros con fines comerciales no autorizados.
          </p>

          <h4 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--negro, #111111)", marginBottom: "8px" }}>
            3. Canales y Frecuencia de Despacho
          </h4>
          <p style={{ margin: "0 0 12px 0" }}>
            - **Correo Principal & Adicionales:** Notificaciones sobre actuaciones procesales, resúmenes periódicos y códigos de seguridad.<br />
            - **WhatsApp (Opcional):** Alertas inmediatas en tiempo real ante eventos críticos o mensajes directos de su abogado / operador asignado.<br />
            - **Revocación:** Puede modificar sus preferencias o desautorizar el contacto por WhatsApp en cualquier momento desde esta sección.
          </p>

          <div
            style={{
              padding: "12px",
              background: "var(--esmeralda-suave, #E6F4F1)",
              borderRadius: "8px",
              border: "1px solid var(--esmeralda, #05876E)",
              color: "var(--esmeralda-honda, #034D3F)",
              fontWeight: 600,
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            <ShieldCheck size={18} /> Protocolo de comunicaciones cifradas en tránsito (TLS 1.3) y reposo PostgreSQL Vault.
          </div>
        </div>

        {/* Pie del Modal */}
        <div
          style={{
            padding: "14px 20px",
            background: "var(--panel-papel, #F7F6FA)",
            borderTop: "1px solid var(--panel-linea, #E4E4E4)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onCerrar}
            className="btn-mini"
            style={{
              background: "var(--blanco, #ffffff)",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              color: "var(--negro, #111111)",
              padding: "8px 16px",
            }}
          >
            Entendido / Cerrar
          </button>

          {onAceptar && (
            <button
              type="button"
              onClick={() => {
                onAceptar();
                onCerrar();
              }}
              className="btn-mini"
              style={{
                background: "var(--violeta, #5000BA)",
                border: "none",
                color: "#FFFFFF",
                padding: "8px 16px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Check size={16} /> {aceptado ? "Términos Aceptados" : "Aceptar Términos de Notificación"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
