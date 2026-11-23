"use client";

import React from "react";
import { Palette, Sparkles, Check } from "lucide-react";
import {
  COLORES_ROSAS_PERSONALIZACION,
  OPCIONES_COLOR_BASE_PAPEL,
  OPCIONES_TIPO_ENVOLTORIO_FLORAL,
  type ColorBasePapelId,
  type ConfiguracionPersonalizacionFloral,
} from "../utils/personalizacionFloral";

interface Props {
  valor: ConfiguracionPersonalizacionFloral;
  onChange: (nuevo: ConfiguracionPersonalizacionFloral) => void;
}

export function EditorPersonalizacionFloralProducto({ valor, onChange }: Props) {
  const actualizar = (parcial: Partial<ConfiguracionPersonalizacionFloral>) => {
    onChange({ ...valor, ...parcial });
  };

  const toggleColorRosa = (clave: string) => {
    const actuales = valor.coloresRosasDisponibles || [];
    const existe = actuales.includes(clave);
    const siguientes = existe
      ? actuales.filter((c) => c !== clave)
      : [...actuales, clave];
    actualizar({ coloresRosasDisponibles: siguientes });
  };

  const toggleColorBase = (id: ColorBasePapelId) => {
    const actuales = valor.coloresBaseDisponibles || ["claros", "oscuros", "rosa"];
    const existe = actuales.includes(id);
    if (existe && actuales.length <= 1) return; // Mantener al menos 1 opción cuando está activo
    const siguientes = existe
      ? actuales.filter((c) => c !== id)
      : ([...actuales, id] as ColorBasePapelId[]);
    actualizar({ coloresBaseDisponibles: siguientes });
  };

  const actualizarOrqMin = (nuevoMin: number) => {
    const minClamped = Math.max(0, Math.min(50, Math.round(nuevoMin || 0)));
    actualizar({
      orquideasMin: minClamped,
      orquideasMax: Math.max(minClamped, valor.orquideasMax),
    });
  };

  const actualizarOrqMax = (nuevoMax: number) => {
    const maxClamped = Math.max(0, Math.min(50, Math.round(nuevoMax || 0)));
    actualizar({
      orquideasMax: maxClamped,
      orquideasMin: Math.min(valor.orquideasMin, maxClamped),
    });
  };

  return (
    <div
      style={{
        background: "#FAF8F5",
        border: "1px solid #E6E0D6",
        borderRadius: "12px",
        padding: "14px",
        marginTop: "12px",
        marginBottom: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Cabecera + interruptor */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              background: "#FDF2F8",
              border: "1px solid #FBCFE8",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#BE185D",
              flexShrink: 0,
            }}
          >
            <Palette size={16} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: "0.84rem", color: "#1F1C19" }}>
              Personalización de Colores, Flores y Base/Papel
            </strong>
            <span style={{ fontSize: "0.72rem", color: "#57524C" }}>
              Define qué combinaciones puede elegir el cliente al comprar este arreglo.
            </span>
          </div>
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "0.76rem",
            fontWeight: 700,
            color: valor.habilitada ? "#2F4737" : "#6B7280",
            cursor: "pointer",
            background: valor.habilitada ? "#EAF3ED" : "#F3F4F6",
            border: valor.habilitada ? "1px solid #B7D8C2" : "1px solid #D1D5DB",
            padding: "5px 10px",
            borderRadius: "999px",
          }}
        >
          <input
            type="checkbox"
            checked={valor.habilitada}
            onChange={(e) => actualizar({ habilitada: e.target.checked })}
          />
          <span>{valor.habilitada ? "Activa en tienda" : "Desactivada"}</span>
        </label>
      </div>

      {valor.habilitada && (
        <>
          {/* 1. Combinaciones de flores permitidas */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #ECE7DF",
              borderRadius: "10px",
              padding: "10px 12px",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "#221E1B",
                marginBottom: "8px",
              }}
            >
              1. Combinaciones de Flores Disponibles
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[
                {
                  clave: "permiteSoloRosas" as const,
                  label: "🌹 Solo Rosas",
                  activo: valor.permiteSoloRosas,
                },
                {
                  clave: "permiteSoloGirasoles" as const,
                  label: "🌻 Solo Girasoles",
                  activo: valor.permiteSoloGirasoles,
                },
                {
                  clave: "permiteGirasolesYRosas" as const,
                  label: "🌻🌹 Girasoles y Rosas",
                  activo: valor.permiteGirasolesYRosas,
                },
              ].map((op) => (
                <button
                  key={op.clave}
                  type="button"
                  onClick={() => actualizar({ [op.clave]: !op.activo })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "999px",
                    border: op.activo ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                    background: op.activo ? "#2F4737" : "#FAF8F5",
                    color: op.activo ? "#FFFFFF" : "#57524C",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {op.activo && <Check size={13} />}
                  <span>{op.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Cantidad máxima de colores de rosas (1 color por defecto, 2 o N) */}
          {(valor.permiteSoloRosas || valor.permiteGirasolesYRosas) && (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #ECE7DF",
                borderRadius: "10px",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#221E1B" }}>
                  2. Colores de Rosas Disponibles (por defecto 1 color)
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  {[1, 2, 3, 4].map((num) => {
                    const sel = valor.maxColoresRosas === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => actualizar({ maxColoresRosas: num })}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border: sel ? "1.5px solid #BE185D" : "1px solid #D5CFC4",
                          background: sel ? "#FDF2F8" : "#FFFFFF",
                          color: sel ? "#9D174D" : "#57524C",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {num === 1 ? "1 Color" : `${num} Colores`}
                      </button>
                    );
                  })}
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "0.72rem",
                      color: "#57524C",
                      fontWeight: 700,
                    }}
                  >
                    <span>N:</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={valor.maxColoresRosas}
                      onChange={(e) =>
                        actualizar({
                          maxColoresRosas: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                        })
                      }
                      style={{
                        width: "54px",
                        padding: "4px 6px",
                        borderRadius: "7px",
                        border: "1px solid #D5CFC4",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Restricción opcional de colores disponibles */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "#57524C" }}>
                    {valor.coloresRosasDisponibles.length === 0
                      ? "Colores habilitados: Todos los disponibles (toca para limitar colores específicos)"
                      : `Colores específicos habilitados (${valor.coloresRosasDisponibles.length}):`}
                  </span>
                  {valor.coloresRosasDisponibles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => actualizar({ coloresRosasDisponibles: [] })}
                      style={{
                        border: "none",
                        background: "none",
                        color: "#BE185D",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Habilitar todos
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {COLORES_ROSAS_PERSONALIZACION.map((col) => {
                    const seleccionado = valor.coloresRosasDisponibles.includes(col.clave);
                    return (
                      <button
                        key={col.clave}
                        type="button"
                        onClick={() => toggleColorRosa(col.clave)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "4px 8px",
                          borderRadius: "999px",
                          border: seleccionado ? "1.5px solid #221E1B" : "1px solid #E5E0D8",
                          background: seleccionado ? "#221E1B" : "#FAF8F5",
                          color: seleccionado ? "#FFFFFF" : "#3F3F46",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "999px",
                            background: col.colorHex,
                            border: `1px solid ${col.bordeHex || "rgba(0,0,0,0.18)"}`,
                            flexShrink: 0,
                          }}
                        />
                        <span>{col.etiqueta}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. Orquídeas (desde 0 hasta N) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #ECE7DF",
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: "#221E1B" }}>
                  3. Orquídeas (desde 0 hasta N)
                </span>
                <span style={{ fontSize: "0.7rem", color: "#57524C" }}>
                  {valor.orquideasMax === 0
                    ? "Desactivado (0 orquídeas). Sube el máximo para permitir combinarlas."
                    : `El cliente podrá elegir entre ${valor.orquideasMin} y ${valor.orquideasMax} orquídeas.`}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {[0, 3, 5, 10].map((maxPreset) => {
                  const sel = valor.orquideasMax === maxPreset;
                  return (
                    <button
                      key={maxPreset}
                      type="button"
                      onClick={() => actualizarOrqMax(maxPreset)}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "999px",
                        border: sel ? "1.5px solid #6D28D9" : "1px solid #D5CFC4",
                        background: sel ? "#F5F3FF" : "#FFFFFF",
                        color: sel ? "#5B21B6" : "#57524C",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {maxPreset === 0 ? "Sin orquídeas (0)" : `Hasta ${maxPreset}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  color: "#57524C",
                }}
              >
                <span>Mínimo:</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={valor.orquideasMin}
                  onChange={(e) => actualizarOrqMin(Number(e.target.value))}
                  style={{
                    width: "58px",
                    padding: "4px 6px",
                    borderRadius: "7px",
                    border: "1px solid #D5CFC4",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                />
              </label>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  color: "#57524C",
                }}
              >
                <span>Máximo (N):</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={valor.orquideasMax}
                  onChange={(e) => actualizarOrqMax(Number(e.target.value))}
                  style={{
                    width: "58px",
                    padding: "4px 6px",
                    borderRadius: "7px",
                    border: "1px solid #D5CFC4",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                />
              </label>
            </div>
          </div>

          {/* 4. Tipo de Envoltorio (Base / Papel Envoltorio) y Color (únicamente Claros, Oscuros, Rosa) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #ECE7DF",
              borderRadius: "10px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#221E1B" }}>
                4. Tipo de Envoltorio (Base / Papel Envoltorio) y Color
              </span>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#57524C",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={valor.mostrarColorBase}
                  onChange={(e) => actualizar({ mostrarColorBase: e.target.checked })}
                />
                <span>Solicitar al comprar</span>
              </label>
            </div>

            {valor.mostrarColorBase && (
              <>
                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.71rem",
                      fontWeight: 700,
                      color: "#57524C",
                      marginBottom: "6px",
                    }}
                  >
                    Tipo de envoltorio de este arreglo / variante:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {OPCIONES_TIPO_ENVOLTORIO_FLORAL.map((opEnv) => {
                      const selEnv = valor.tipoEnvoltorio === opEnv.id;
                      return (
                        <button
                          key={opEnv.id}
                          type="button"
                          onClick={() => actualizar({ tipoEnvoltorio: opEnv.id })}
                          title={opEnv.descripcion}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 11px",
                            borderRadius: "999px",
                            border: selEnv ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                            background: selEnv ? "#2F4737" : "#FAF8F5",
                            color: selEnv ? "#FFFFFF" : "#3F3F46",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {selEnv && <Check size={13} />}
                          <span>
                            {opEnv.id === "base"
                              ? "📦 "
                              : opEnv.id === "papel_envoltorio"
                                ? "🎀 "
                                : "✨ "}
                            {opEnv.etiqueta}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.71rem",
                      fontWeight: 700,
                      color: "#57524C",
                      marginBottom: "6px",
                    }}
                  >
                    Colores disponibles (3 alternativas exclusivas):
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {OPCIONES_COLOR_BASE_PAPEL.map((op) => {
                      const activa = valor.coloresBaseDisponibles.includes(op.id);
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => toggleColorBase(op.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "7px",
                            padding: "6px 11px",
                            borderRadius: "10px",
                            border: activa ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                            background: activa ? "#F2F6F3" : "#FAF8F5",
                            color: activa ? "#1F1C19" : "#78716C",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center" }}>
                            <span
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "999px",
                                background: op.coloresMuestra[0],
                                border: "1px solid rgba(0,0,0,0.22)",
                              }}
                            />
                            <span
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "999px",
                                background: op.coloresMuestra[1],
                                border: "1px solid rgba(0,0,0,0.22)",
                                marginLeft: "-4px",
                              }}
                            />
                          </span>
                          <span>
                            {op.etiqueta}{" "}
                            <small style={{ fontWeight: 500, opacity: 0.8 }}>({op.detalle})</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.7rem",
                color: "#2F4737",
                background: "#F2F6F3",
                padding: "6px 9px",
                borderRadius: "8px",
              }}
            >
              <Sparkles size={13} />
              <span>
                En tienda el cliente también contará con la opción rápida{" "}
                <strong>&ldquo;Mismos colores de la foto&rdquo;</strong> y un campo para{" "}
                <strong>indicaciones adicionales</strong>.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
