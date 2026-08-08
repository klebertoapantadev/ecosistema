"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Pencil, Shield, Clock, Sparkles } from "lucide-react";
import { DICCIONARIO_ICONOS_WIDGET } from "./gestorTitulosWidgets";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  widgetId: string;
  tituloActual: string;
  subtituloActual: string;
  iconoActualKey?: string;
  requiereMfaActual?: boolean;
  tiempoMfaActualMinutos?: number;
  onGuardar: (
    id: string,
    nuevoTitulo: string,
    nuevoSubtitulo: string,
    nuevoIconoKey?: string,
    nuevoRequiereMfa?: boolean,
    nuevoTiempoMfaMinutos?: number
  ) => void;
}

const OPCIONES_TIEMPO_MFA = [
  { minutos: 5, etiqueta: "5 minutos de inactividad" },
  { minutos: 15, etiqueta: "15 minutos (Recomendado)" },
  { minutos: 30, etiqueta: "30 minutos" },
  { minutos: 60, etiqueta: "60 minutos (1 hora)" },
  { minutos: 120, etiqueta: "120 minutos (2 horas)" },
  { minutos: 0, etiqueta: "Solicitar siempre (Sin persistencia)" },
];

export function ModalEditarWidget({
  abierto,
  onCerrar,
  widgetId,
  tituloActual,
  subtituloActual,
  iconoActualKey,
  requiereMfaActual = false,
  tiempoMfaActualMinutos = 15,
  onGuardar,
}: Props) {
  const [titulo, setTitulo] = useState(tituloActual);
  const [subtitulo, setSubtitulo] = useState(subtituloActual);
  const [iconoKey, setIconoKey] = useState<string | undefined>(iconoActualKey);
  const [requiereMfa, setRequiereMfa] = useState(requiereMfaActual);
  const [tiempoMfaMinutos, setTiempoMfaMinutos] = useState(tiempoMfaActualMinutos);

  useEffect(() => {
    setTitulo(tituloActual);
    setSubtitulo(subtituloActual);
    setIconoKey(iconoActualKey);
    setRequiereMfa(requiereMfaActual);
    setTiempoMfaMinutos(tiempoMfaActualMinutos);
  }, [tituloActual, subtituloActual, iconoActualKey, requiereMfaActual, tiempoMfaActualMinutos, abierto]);

  if (!abierto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar(widgetId, titulo, subtitulo, iconoKey, requiereMfa, tiempoMfaMinutos);
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
          maxWidth: "540px",
          maxHeight: "90vh",
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
              <Pencil size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0, color: "var(--negro, #111111)" }}>
                Editar Configuración del Widget
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--panel-gris, #737373)" }}>
                Personaliza título, ícono y seguridad MFA para todos los perfiles
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

        {/* Formulario con Scroll */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Título */}
          <div>
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
              }}
            />
          </div>

          {/* Subtítulo */}
          <div>
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
              rows={2}
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

          {/* Selector Gráfico de Ícono */}
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--negro, #111111)",
                marginBottom: "8px",
              }}
            >
              <Sparkles size={15} color="var(--violeta, #5000BA)" />
              Ícono del Widget (Paquete Lucide)
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
                gap: "8px",
                padding: "10px",
                background: "var(--panel-papel, #F7F6FA)",
                borderRadius: "10px",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                maxHeight: "140px",
                overflowY: "auto",
              }}
            >
              {Object.entries(DICCIONARIO_ICONOS_WIDGET).map(([key, item]) => {
                const IconComp = item.icono;
                const seleccionado = iconoKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={item.nombre}
                    onClick={() => setIconoKey(key)}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      border: seleccionado ? "2px solid var(--violeta, #5000BA)" : "1px solid var(--panel-linea, #E4E4E4)",
                      background: seleccionado ? "var(--violeta-suave, #F3E8FF)" : "var(--blanco, #ffffff)",
                      color: seleccionado ? "var(--violeta, #5000BA)" : "var(--negro, #111111)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <IconComp size={20} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque de Configuración de MFA & Inactividad */}
          <div
            style={{
              padding: "14px",
              background: requiereMfa ? "rgba(80, 0, 186, 0.04)" : "var(--panel-papel, #F7F6FA)",
              borderRadius: "12px",
              border: requiereMfa ? "1px solid var(--violeta-suave, #F3E8FF)" : "1px solid var(--panel-linea, #E4E4E4)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <label className="campo-casilla" style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <input
                type="checkbox"
                checked={requiereMfa}
                onChange={(e) => setRequiereMfa(e.target.checked)}
                style={{ marginTop: "2px" }}
              />
              <div>
                <strong style={{ fontSize: "0.86rem", color: "var(--negro, #111111)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Shield size={16} color="var(--violeta, #5000BA)" /> Requerir Autenticación MFA (Doble Factor)
                </strong>
                <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", display: "block", marginTop: "2px" }}>
                  Exige verificar un código de 6 dígitos antes de desplegar el contenido sensible de este widget.
                </span>
              </div>
            </label>

            {requiereMfa && (
              <div style={{ marginTop: "4px", paddingLeft: "28px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "var(--negro, #111111)",
                    marginBottom: "4px",
                  }}
                >
                  <Clock size={14} color="var(--violeta, #5000BA)" /> Tiempo de Validez por Inactividad
                </label>
                <select
                  value={tiempoMfaMinutos}
                  onChange={(e) => setTiempoMfaMinutos(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--panel-linea, #E4E4E4)",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                  }}
                >
                  {OPCIONES_TIEMPO_MFA.map((opt) => (
                    <option key={opt.minutos} value={opt.minutos}>
                      {opt.etiqueta}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.74rem", color: "var(--panel-gris, #737373)", marginTop: "4px", display: "block" }}>
                  Tras este periodo de inactividad, se volverá a solicitar el código MFA obligatoriamente.
                </span>
              </div>
            )}
          </div>

          {/* Acciones */}
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

