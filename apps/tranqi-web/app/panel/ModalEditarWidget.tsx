"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Pencil } from "lucide-react";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  widgetId: string;
  tituloActual: string;
  subtituloActual: string;
  onGuardar: (id: string, nuevoTitulo: string, nuevoSubtitulo: string) => void;
}

export function ModalEditarWidget({
  abierto,
  onCerrar,
  widgetId,
  tituloActual,
  subtituloActual,
  onGuardar,
}: Props) {
  const [titulo, setTitulo] = useState(tituloActual);
  const [subtitulo, setSubtitulo] = useState(subtituloActual);

  useEffect(() => {
    setTitulo(tituloActual);
    setSubtitulo(subtituloActual);
  }, [tituloActual, subtituloActual, abierto]);

  if (!abierto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar(widgetId, titulo, subtitulo);
    onCerrar();
  };

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
          maxWidth: "500px",
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
              <Pencil size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, color: "var(--negro, #111111)" }}>
                Editar Widget
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--panel-gris, #737373)" }}>
                Aplica a todos los perfiles de usuario
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="input-titulo-widget"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--negro, #111111)",
                marginBottom: "6px",
              }}
            >
              Título del Widget
            </label>
            <input
              id="input-titulo-widget"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              placeholder="Escribe el título visible..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="textarea-subtitulo-widget"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--negro, #111111)",
                marginBottom: "6px",
              }}
            >
              Descripción / Subtítulo del Widget
            </label>
            <textarea
              id="textarea-subtitulo-widget"
              rows={3}
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              required
              placeholder="Escribe la descripción explicativa..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                fontSize: "0.88rem",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
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
              className="btn-mini"
              style={{
                background: "var(--violeta, #5000BA)",
                border: "none",
                color: "#FFFFFF",
                padding: "8px 16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
              }}
            >
              <Save size={15} /> Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
