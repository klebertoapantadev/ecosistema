"use client";

import React, { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";

export function BotonImpresionAutomatica() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="no-print" style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#F3F4F6",
      borderBottom: "1px solid #D1D5DB",
      padding: "12px 24px",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <button
        type="button"
        onClick={() => window.close()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "#FFF",
          border: "1px solid #D1D5DB",
          borderRadius: "6px",
          padding: "6px 12px",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <ArrowLeft size={14} /> Cerrar Pestaña
      </button>

      <span style={{ fontSize: "0.85rem", color: "#4B5563", fontWeight: 700 }}>
        Presiona Ctrl+P o haz clic en Imprimir para Guardar como PDF
      </span>

      <button
        type="button"
        onClick={() => window.print()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "#5000BA",
          color: "#FFF",
          border: "none",
          borderRadius: "6px",
          padding: "7px 14px",
          fontSize: "0.82rem",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(80,0,186,0.15)",
        }}
      >
        <Printer size={14} /> Imprimir Contrato
      </button>
    </div>
  );
}
