"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ModalBloqueoProps {
  abierto: boolean;
  usoLabel: string;
  productos: string[];
  onCerrar: () => void;
}

export function ModalBloqueoUso({
  abierto,
  usoLabel,
  productos,
  onCerrar,
}: ModalBloqueoProps) {
  if (!abierto) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          maxWidth: "480px",
          width: "100%",
          padding: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1.5px solid #FCA5A5",
          animation: "fadeIn 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
          <div
            style={{
              background: "#FEE2E2",
              padding: "10px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={24} color="#DC2626" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#991B1B" }}>
              Uso en Utilización — No se puede eliminar
            </h3>
            <div style={{ display: "inline-block", background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontWeight: 700, fontSize: "0.8rem", padding: "2px 8px", borderRadius: "6px" }}>
              {usoLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: "0.86rem", color: "#334155", lineHeight: 1.5, margin: "0 0 12px 0" }}>
          Este uso no puede ser eliminado porque actualmente está asignado a <strong>{productos.length}</strong> producto(s) en tu catálogo:
        </p>

        <ul
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            padding: "10px 14px 10px 30px",
            margin: "0 0 14px 0",
            maxHeight: "160px",
            overflowY: "auto",
            fontSize: "0.82rem",
            color: "#1E293B",
            lineHeight: 1.6,
          }}
        >
          {productos.map((prod, idx) => (
            <li key={idx} style={{ fontWeight: 600 }}>
              {prod}
            </li>
          ))}
        </ul>

        <div
          style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "0.78rem",
            color: "#92400E",
            lineHeight: 1.4,
            marginBottom: "18px",
          }}
        >
          💡 <strong>Regla de integridad:</strong> Para poder eliminar esta opción de la lista general del negocio, primero debes abrir los productos indicados arriba y desmarcar este uso.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "#0284C7",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModalConfirmarProps {
  abierto: boolean;
  usoLabel: string;
  negocio: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirmarEliminarUso({
  abierto,
  usoLabel,
  negocio,
  onConfirmar,
  onCancelar,
}: ModalConfirmarProps) {
  if (!abierto) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          maxWidth: "460px",
          width: "100%",
          padding: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #E2E8F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
          <div
            style={{
              background: "#FEF3C7",
              padding: "10px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Trash2 size={24} color="#D97706" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#1E293B" }}>
              ¿Eliminar Uso del Catálogo?
            </h3>
            <span style={{ fontSize: "0.82rem", color: "#64748B" }}>
              Opción: <strong style={{ color: "#0F172A" }}>{usoLabel}</strong>
            </span>
          </div>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
          Se ha verificado que <strong>ningún producto</strong> de <strong>{negocio.toUpperCase()}</strong> está utilizando este uso actualmente. Ya no aparecerá disponible al editar o crear productos.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onCancelar}
            style={{
              background: "#F1F5F9",
              color: "#475569",
              border: "1px solid #CBD5E1",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            style={{
              background: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(220,38,38,0.3)",
            }}
          >
            Sí, Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
