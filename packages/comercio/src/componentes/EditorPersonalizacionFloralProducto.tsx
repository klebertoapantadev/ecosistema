"use client";

import React, { useState } from "react";
import { Palette, Sparkles, Check, Plus, Trash2, ClipboardList } from "lucide-react";
import {
  COLORES_ROSAS_PERSONALIZACION,
  OPCIONES_TIPO_ENVOLTORIO_FLORAL,
  normalizarConfiguracionPersonalizacionFloral,
  obtenerColoresPorDefectoEnvoltorio,
  obtenerOpcionesColorEnvoltorio,
  type ColorBasePapelId,
  type ConfiguracionPersonalizacionFloral,
  type TipoEnvoltorioFloral,
} from "../utils/personalizacionFloral";
import {
  COMPONENTES_RECETA_FLORISTERIA,
  formatearDescripcionComposicion,
  normalizarComposicionReceta,
  obtenerResumenFloresReceta,
  type ItemComposicionReceta,
} from "../utils/recetaProducto";

interface Props {
  valor: ConfiguracionPersonalizacionFloral;
  onChange: (nuevo: ConfiguracionPersonalizacionFloral) => void;
}

export function EditorPersonalizacionFloralProducto({ valor, onChange }: Props) {
  const [mostrarAgregarOtro, setMostrarAgregarOtro] = useState(false);
  const [otroNombre, setOtroNombre] = useState("");
  const [otroCantidad, setOtroCantidad] = useState<number>(1);
  const [otroAproximado, setOtroAproximado] = useState<boolean>(true);

  const recetaActual = normalizarComposicionReceta(valor.composicionReceta);
  const resumenReceta = obtenerResumenFloresReceta(recetaActual);
  const textoComposicionPreview = formatearDescripcionComposicion(recetaActual);

  const actualizar = (parcial: Partial<ConfiguracionPersonalizacionFloral>) => {
    onChange({ ...valor, ...parcial });
  };

  const actualizarReceta = (nuevaLista: ItemComposicionReceta[]) => {
    const limpia = normalizarComposicionReceta(nuevaLista);
    const res = obtenerResumenFloresReceta(limpia);
    const actualizado = normalizarConfiguracionPersonalizacionFloral(
      {
        ...valor,
        composicionReceta: limpia,
        ...(res.tieneReceta
          ? {
              maxColoresRosas: res.incluyeRosas
                ? Math.max(1, res.maxColoresRosas || valor.maxColoresRosas || 1)
                : 0,
              permiteSoloRosas: res.incluyeRosas && !res.incluyeGirasoles,
              permiteSoloGirasoles: !res.incluyeRosas && res.incluyeGirasoles,
              permiteGirasolesYRosas: res.incluyeRosas && res.incluyeGirasoles,
              orquideasMin: res.incluyeOrquideas ? Math.max(1, Math.round(res.orquideas)) : 0,
              orquideasMax: res.incluyeOrquideas
                ? Math.max(valor.orquideasMax, Math.round(res.orquideas))
                : 0,
            }
          : {}),
      },
      {
        habilitadaPorDefecto: valor.habilitada,
        tipoEnvoltorioPorDefecto: valor.tipoEnvoltorio,
      }
    );
    onChange(actualizado);
  };

  const obtenerItemReceta = (clave: string): ItemComposicionReceta | undefined =>
    recetaActual.find((it) => it.clave === clave);

  const cambiarCantidadComponente = (
    clave: string,
    cantidadNueva: number,
    opciones?: { aproximado?: boolean; maxColores?: number }
  ) => {
    const cant = Math.max(0, Math.min(9999, Math.round(Number(cantidadNueva) || 0)));
    const def = COMPONENTES_RECETA_FLORISTERIA.find((c) => c.clave === clave);
    const existente = obtenerItemReceta(clave);
    const sinClave = recetaActual.filter((it) => it.clave !== clave);
    if (cant <= 0) {
      actualizarReceta(sinClave);
      return;
    }
    const nuevoItem: ItemComposicionReceta = {
      clave,
      etiquetaSingular: existente?.etiquetaSingular || def?.etiquetaSingular || clave,
      etiquetaPlural: existente?.etiquetaPlural || def?.etiquetaPlural || clave,
      cantidad: cant,
      aproximado:
        opciones?.aproximado !== undefined
          ? opciones.aproximado
          : existente?.aproximado ?? def?.aproximadoPorDefecto ?? true,
      ...(clave === "rosas"
        ? {
            maxColores: Math.max(
              1,
              Math.min(
                12,
                Math.round(
                  opciones?.maxColores ?? existente?.maxColores ?? (valor.maxColoresRosas || 1)
                )
              )
            ),
          }
        : {}),
      visibleCliente: existente?.visibleCliente ?? true,
      unidadMedida: existente?.unidadMedida || def?.unidadMedida || "UNIDAD",
      codigoInsumo: existente?.codigoInsumo || def?.codigoInsumo || `REC_${clave.toUpperCase()}`,
    };
    actualizarReceta([...sinClave, nuevoItem]);
  };

  const agregarComponentePersonalizado = () => {
    const nombreLimpio = otroNombre.trim();
    const cant = Math.max(1, Math.min(9999, Math.round(Number(otroCantidad) || 1)));
    if (!nombreLimpio) return;
    const clave = nombreLimpio
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!clave) return;
    const plural = nombreLimpio.toLowerCase();
    const singular = plural.endsWith("s") && plural.length > 2 ? plural.slice(0, -1) : plural;
    const sinPrev = recetaActual.filter((it) => it.clave !== clave);
    actualizarReceta([
      ...sinPrev,
      {
        clave,
        etiquetaSingular: singular,
        etiquetaPlural: plural,
        cantidad: cant,
        aproximado: otroAproximado,
        visibleCliente: true,
        unidadMedida: "UNIDAD",
        codigoInsumo: `REC_${clave.toUpperCase()}`,
      },
    ]);
    setOtroNombre("");
    setOtroCantidad(1);
    setMostrarAgregarOtro(false);
  };

  const toggleColorRosa = (clave: string) => {
    const actuales = valor.coloresRosasDisponibles || [];
    const existe = actuales.includes(clave);
    const siguientes = existe
      ? actuales.filter((c) => c !== clave)
      : [...actuales, clave];
    actualizar({ coloresRosasDisponibles: siguientes });
  };

  const opcionesColorEnvoltorio = obtenerOpcionesColorEnvoltorio(valor.tipoEnvoltorio);

  const toggleColorBase = (id: ColorBasePapelId) => {
    const porDefecto = obtenerColoresPorDefectoEnvoltorio(valor.tipoEnvoltorio);
    const actuales =
      valor.coloresBaseDisponibles && valor.coloresBaseDisponibles.length > 0
        ? valor.coloresBaseDisponibles
        : porDefecto;
    const existe = actuales.includes(id);
    if (existe && actuales.length <= 1) return; // Mantener al menos 1 opción cuando está activo
    const siguientes = existe
      ? actuales.filter((c) => c !== id)
      : ([...actuales, id] as ColorBasePapelId[]);
    actualizar({ coloresBaseDisponibles: siguientes });
  };

  const cambiarTipoEnvoltorio = (nuevoTipo: TipoEnvoltorioFloral) => {
    actualizar({
      tipoEnvoltorio: nuevoTipo,
      mostrarColorBase: nuevoTipo !== "no_aplica",
      coloresBaseDisponibles: obtenerColoresPorDefectoEnvoltorio(nuevoTipo),
    });
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
          {/* 0. Composición / Receta del producto (Rosas, Girasoles, Orquídeas, Gerberas, Lirios u otros) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1.5px solid #E5DDD2",
              borderRadius: "10px",
              padding: "11px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "9px",
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
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <ClipboardList size={15} color="#2F4737" style={{ flexShrink: 0 }} />
                <div>
                  <span style={{ display: "block", fontSize: "0.76rem", fontWeight: 800, color: "#221E1B" }}>
                    Composición / Receta del Producto
                  </span>
                  <span style={{ fontSize: "0.69rem", color: "#57524C" }}>
                    Indica la cantidad de cada flor (0 = no lleva). Solo los valores mayores a 0 aparecen en la descripción.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMostrarAgregarOtro((prev) => !prev)}
                title="Agregar otro componente o flor a la receta"
                aria-label="Otro componente"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 9px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  background: "#FAF8F5",
                  color: "#3F3A35",
                  fontSize: "0.71rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Plus size={12} />
                <span>Otro</span>
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(215px, 100%), 1fr))",
                gap: "7px",
              }}
            >
              {COMPONENTES_RECETA_FLORISTERIA.map((comp) => {
                const it = obtenerItemReceta(comp.clave);
                const cant = it?.cantidad ?? 0;
                const aprox = it?.aproximado ?? comp.aproximadoPorDefecto;
                const activo = cant > 0;
                const maxColRosas = it?.maxColores ?? (valor.maxColoresRosas || 1);

                return (
                  <div
                    key={comp.clave}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      padding: "8px 9px",
                      borderRadius: "9px",
                      border: activo ? "1.5px solid #2F4737" : "1px solid #E6E2DA",
                      background: activo ? "#F4F8F5" : "#FAF8F5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: activo ? "#1F3528" : "#57524C",
                        }}
                      >
                        {comp.emoji} {comp.etiquetaAdmin}
                      </span>

                      <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          value={cant}
                          onChange={(e) =>
                            cambiarCantidadComponente(comp.clave, Number(e.target.value))
                          }
                          aria-label={`Cantidad de ${comp.etiquetaAdmin}`}
                          style={{
                            width: "58px",
                            padding: "4px 6px",
                            borderRadius: "7px",
                            border: activo ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                            background: "#FFFFFF",
                            fontSize: "0.78rem",
                            fontWeight: 800,
                            color: activo ? "#1F3528" : "#6E6861",
                            textAlign: "center",
                          }}
                        />
                        {activo && (
                          <label
                            title="Mostrar como cantidad aproximada (ej. aprox. 50 rosas)"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              color: "#57524C",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={aprox}
                              onChange={(e) =>
                                cambiarCantidadComponente(comp.clave, cant, {
                                  aproximado: e.target.checked,
                                })
                              }
                            />
                            <span>Aprox.</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Colores 1..N directamente en Rosas cuando cantidad > 0 */}
                    {comp.clave === "rosas" && activo && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "6px",
                          paddingTop: "4px",
                          borderTop: "1px dashed #CEDDD3",
                        }}
                      >
                        <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#9D174D" }}>
                          Colores (1–N):
                        </span>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {[1, 2, 3].map((n) => (
                            <button
                              key={`rc-col-${n}`}
                              type="button"
                              onClick={() =>
                                cambiarCantidadComponente("rosas", cant, { maxColores: n })
                              }
                              style={{
                                padding: "2px 7px",
                                borderRadius: "999px",
                                border:
                                  maxColRosas === n ? "1.5px solid #BE185D" : "1px solid #D5CFC4",
                                background: maxColRosas === n ? "#FDF2F8" : "#FFFFFF",
                                color: maxColRosas === n ? "#9D174D" : "#57524C",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {n}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            max={12}
                            value={maxColRosas}
                            onChange={(e) =>
                              cambiarCantidadComponente("rosas", cant, {
                                maxColores: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                              })
                            }
                            aria-label="Número máximo de colores de rosas"
                            style={{
                              width: "40px",
                              padding: "2px 4px",
                              borderRadius: "6px",
                              border: "1px solid #D5CFC4",
                              background: "#FFFFFF",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              textAlign: "center",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Otros componentes personalizados en la receta */}
              {resumenReceta.otrosComponentes.map((otro) => (
                <div
                  key={`otro-${otro.clave}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                    padding: "8px 9px",
                    borderRadius: "9px",
                    border: "1.5px solid #2F4737",
                    background: "#F4F8F5",
                  }}
                >
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#1F3528" }}>
                    ✨ {otro.aproximado ? "Aprox. " : ""}
                    {otro.cantidad} {otro.cantidad === 1 ? otro.etiquetaSingular : otro.etiquetaPlural}
                  </span>
                  <button
                    type="button"
                    onClick={() => actualizarReceta(recetaActual.filter((it) => it.clave !== otro.clave))}
                    title="Quitar componente"
                    aria-label={`Quitar ${otro.etiquetaPlural}`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#8A2E2E",
                      cursor: "pointer",
                      padding: "2px",
                      display: "inline-flex",
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {mostrarAgregarOtro && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  flexWrap: "wrap",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "#FAF8F5",
                  border: "1px dashed #B8B0A4",
                }}
              >
                <input
                  type="text"
                  value={otroNombre}
                  onChange={(e) => setOtroNombre(e.target.value)}
                  placeholder="Ej. Tulipanes, Hortensias, Claveles..."
                  style={{
                    flex: "1 1 160px",
                    padding: "5px 8px",
                    borderRadius: "7px",
                    border: "1px solid #D5CFC4",
                    fontSize: "0.75rem",
                    background: "#FFFFFF",
                  }}
                />
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={otroCantidad}
                  onChange={(e) => setOtroCantidad(Math.max(1, Number(e.target.value) || 1))}
                  aria-label="Cantidad componente personalizado"
                  style={{
                    width: "60px",
                    padding: "5px 6px",
                    borderRadius: "7px",
                    border: "1px solid #D5CFC4",
                    fontSize: "0.75rem",
                    textAlign: "center",
                    background: "#FFFFFF",
                  }}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.71rem", color: "#57524C" }}>
                  <input
                    type="checkbox"
                    checked={otroAproximado}
                    onChange={(e) => setOtroAproximado(e.target.checked)}
                  />
                  <span>Aprox.</span>
                </label>
                <button
                  type="button"
                  onClick={agregarComponentePersonalizado}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border: "none",
                    background: "#2F4737",
                    color: "#FFFFFF",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Agregar
                </button>
              </div>
            )}

            {/* Vista previa en vivo de la descripción y regla de color de rosas */}
            {textoComposicionPreview ? (
              <div
                style={{
                  padding: "7px 10px",
                  borderRadius: "8px",
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  color: "#166534",
                  fontSize: "0.72rem",
                  lineHeight: 1.4,
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                }}
              >
                <div>
                  <strong>Vista en descripción del producto:</strong> {textoComposicionPreview}
                </div>
                <div style={{ fontSize: "0.69rem", color: "#15803D" }}>
                  {resumenReceta.incluyeRosas
                    ? `✓ Incluye rosas → el cliente podrá elegir hasta ${resumenReceta.maxColoresRosas} color(es) de rosas desde inventario.`
                    : "✓ Esta receta no lleva rosas → la tienda NO pedirá seleccionar color de rosas al comprar."}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "0.7rem", color: "#847D74" }}>
                Sin cantidades cargadas todavía (todos en 0): no se agregará texto automático de composición.
              </div>
            )}
          </div>

          {/* 1. Combinaciones de flores permitidas (visible solo cuando no hay receta cerrada sin rosas) */}
          {(!resumenReceta.tieneReceta || resumenReceta.incluyeRosas) && (
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
          )}

          {/* 2. Cantidad máxima de colores de rosas (solo si la receta incluye rosas o aún no tiene receta) */}
          {((!resumenReceta.tieneReceta && (valor.permiteSoloRosas || valor.permiteGirasolesYRosas)) ||
            resumenReceta.incluyeRosas) && (
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

          {/* 4. Tipo de Envoltorio (Base / Papel / No aplica) y Color (únicamente Claros, Oscuros, Rosa) */}
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
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: "#221E1B",
                  marginBottom: "6px",
                }}
              >
                4. Tipo de Envoltorio (Base / Papel / No aplica)
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                {OPCIONES_TIPO_ENVOLTORIO_FLORAL.map((opEnv) => {
                  const selEnv =
                    valor.tipoEnvoltorio === opEnv.id ||
                    (!valor.mostrarColorBase && opEnv.id === "no_aplica");
                  return (
                    <button
                      key={opEnv.id}
                      type="button"
                      onClick={() => cambiarTipoEnvoltorio(opEnv.id)}
                      title={opEnv.descripcion}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "999px",
                        border: selEnv
                          ? opEnv.id === "no_aplica"
                            ? "1.5px solid #57524C"
                            : "1.5px solid #2F4737"
                          : "1px solid #D5CFC4",
                        background: selEnv
                          ? opEnv.id === "no_aplica"
                            ? "#57524C"
                            : "#2F4737"
                          : "#FAF8F5",
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
                            : "🚫 "}
                        {opEnv.etiqueta}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {valor.mostrarColorBase && valor.tipoEnvoltorio !== "no_aplica" ? (
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
                  Colores disponibles para{" "}
                  <strong>{valor.tipoEnvoltorio === "base" ? "Base" : "Papel"}</strong>{" "}
                  {valor.tipoEnvoltorio === "base"
                    ? "(Blanco / Negro / Rosado):"
                    : "(Colores Claros / Oscuros / Tonos Pastel):"}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {opcionesColorEnvoltorio.map((op) => {
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
                          {op.coloresMuestra.map((hex, idxM) => (
                            <span
                              key={`${op.id}-${idxM}`}
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "999px",
                                background: hex,
                                border: "1px solid rgba(0,0,0,0.22)",
                                marginLeft: idxM > 0 ? "-4px" : 0,
                              }}
                            />
                          ))}
                        </span>
                        <span>
                          {op.etiqueta}
                          {valor.tipoEnvoltorio === "papel_envoltorio" && (
                            <>
                              {" "}
                              <small style={{ fontWeight: 500, opacity: 0.8 }}>({op.detalle})</small>
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#57524C",
                  background: "#F8F7F4",
                  border: "1px dashed #D5CFC4",
                  borderRadius: "8px",
                  padding: "7px 10px",
                }}
              >
                <strong>No aplica:</strong> al comprar este arreglo no se mostrará la opción de
                seleccionar color de base ni papel al cliente.
              </div>
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
