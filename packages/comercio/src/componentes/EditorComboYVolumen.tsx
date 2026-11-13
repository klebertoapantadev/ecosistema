"use client";

import React, { useState, useMemo } from "react";
import { Plus, Trash2, Gift, Percent, AlertCircle, CheckCircle2, Minus } from "lucide-react";
import type { ProductoCatalogo, VarianteCatalogo } from "../acciones";
import {
  calcularPrecioPorVolumen,
  type ComponenteComboConfig,
  type EscalaVolumenVariante,
  type TipoDescuentoVolumen,
} from "../utils/combosVolumen";

interface PropsEscalasVolumen {
  escalas: EscalaVolumenVariante[];
  pvpUnitarioNominal: number;
  onChange: (nuevas: EscalaVolumenVariante[]) => void;
}

export function EditorEscalasVolumenVariante({
  escalas,
  pvpUnitarioNominal,
  onChange,
}: PropsEscalasVolumen) {
  const agregarRegla = () => {
    const maxMinActual = escalas.reduce((acc, e) => Math.max(acc, e.min_cantidad), 1);
    const nuevaMin = Math.max(2, maxMinActual + 1);
    const valorSugerido =
      pvpUnitarioNominal > 10 ? Number((pvpUnitarioNominal * 0.9).toFixed(2)) : 10;
    onChange([
      ...escalas,
      {
        min_cantidad: escalas.length === 0 ? 2 : nuevaMin,
        tipo: pvpUnitarioNominal > 10 ? "PRECIO_FIJO" : "DESCUENTO_PORCENTAJE",
        valor: valorSugerido,
      },
    ]);
  };

  const actualizarRegla = (
    idx: number,
    parcial: Partial<EscalaVolumenVariante>
  ) => {
    const copia = escalas.map((item, i) =>
      i === idx ? { ...item, ...parcial } : item
    );
    onChange(copia);
  };

  const eliminarRegla = (idx: number) => {
    onChange(escalas.filter((_, i) => i !== idx));
  };

  return (
    <div
      style={{
        marginTop: "12px",
        background: "#FFFBEB",
        border: "1px solid #FDE68A",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: escalas.length > 0 ? "10px" : "0",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#92400E",
            }}
          >
            <Percent size={14} color="#D97706" />
            <span>Descuento por Cantidad / Volumen (Opcional)</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#B45309", marginTop: "2px" }}>
            Ej. Si cuesta ${pvpUnitarioNominal.toFixed(2)}, aplica precio especial o % al llevar 2 o más unidades (en catálogo y en Sets).
          </div>
        </div>

        <button
          type="button"
          onClick={agregarRegla}
          title="Agregar regla de descuento por cantidad"
          aria-label="Agregar regla de descuento por cantidad"
          style={{
            background: "#D97706",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "7px",
            padding: "6px 11px",
            fontSize: "0.73rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Plus size={13} />
          <span>Nueva Regla</span>
        </button>
      </div>

      {escalas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {escalas.map((regla, idx) => {
            const sim = calcularPrecioPorVolumen({
              pvpUnitarioNominal,
              cantidad: Math.max(2, regla.min_cantidad),
              escalas: [regla],
            });

            return (
              <div
                key={idx}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #FCD34D",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#334155" }}>
                    Desde
                  </span>
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={regla.min_cantidad}
                    onChange={(e) =>
                      actualizarRegla(idx, {
                        min_cantidad: Math.max(2, Math.floor(Number(e.target.value) || 2)),
                      })
                    }
                    style={{
                      width: "58px",
                      padding: "5px 7px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  />
                  <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#334155" }}>
                    + uds:
                  </span>
                </div>

                <select
                  value={regla.tipo}
                  onChange={(e) =>
                    actualizarRegla(idx, {
                      tipo: e.target.value as TipoDescuentoVolumen,
                    })
                  }
                  style={{
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    background: "#F8FAFC",
                    color: "#0F172A",
                  }}
                >
                  <option value="PRECIO_FIJO">Precio fijo c/u ($)</option>
                  <option value="DESCUENTO_PORCENTAJE">% Descuento</option>
                  <option value="DESCUENTO_MONTO">-$ Descuento c/u</option>
                </select>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={regla.valor}
                  onChange={(e) =>
                    actualizarRegla(idx, {
                      valor: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  style={{
                    width: "82px",
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "#0F172A",
                  }}
                />

                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: sim.tieneDescuentoVolumen ? "#059669" : "#64748B",
                    background: sim.tieneDescuentoVolumen ? "#ECFDF5" : "#F1F5F9",
                    padding: "3px 8px",
                    borderRadius: "999px",
                    marginLeft: "auto",
                  }}
                >
                  {sim.tieneDescuentoVolumen
                    ? `Queda $${sim.pvpUnitarioFinal.toFixed(2)} c/u (-${sim.porcentajeDescuento}%)`
                    : "Sin ahorro frente al precio base"}
                </span>

                <button
                  type="button"
                  onClick={() => eliminarRegla(idx)}
                  title="Eliminar regla de volumen"
                  aria-label="Eliminar regla de volumen"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#EF4444",
                    cursor: "pointer",
                    padding: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PropsEditorSetCombo {
  esCombo: boolean;
  onCambiarEsCombo: (activo: boolean) => void;
  componentes: ComponenteComboConfig[];
  onCambiarComponentes: (nuevos: ComponenteComboConfig[]) => void;
  catalogoProductos: ProductoCatalogo[];
  productoActualId?: string;
  pvpSetCompleto: number;
  onCambiarPrecioSetBase?: (nuevoPrecioBaseSinIva: number) => void;
  onSincronizarPrecioComparacion?: (sumaNominalTotal: number) => void;
  tarifaIvaSet?: number;
}

function obtenerPvpVariante(v?: VarianteCatalogo | null): number {
  if (!v) return 0;
  if (typeof v.precio_total === "number" && v.precio_total > 0) return v.precio_total;
  const base = Number(v.var_precio || 0);
  const iva = Number(v.var_tarifa_iva_porcentaje || 0);
  return Number((base * (1 + iva / 100)).toFixed(2));
}

function obtenerMiniaturaProducto(p?: ProductoCatalogo | null, v?: VarianteCatalogo | null): string {
  const vPortada = v?.var_detalle_variante?.portada_url;
  if (typeof vPortada === "string" && vPortada.trim()) return vPortada.trim();
  const pImg = p?.pro_detalle_producto?.imagen_url;
  if (typeof pImg === "string" && pImg.trim()) return pImg.trim();
  const gal = p?.pro_detalle_producto?.galeria_urls;
  if (Array.isArray(gal) && typeof gal[0] === "string" && gal[0].trim()) return gal[0].trim();
  return "";
}

export function EditorSetComboConfigurable({
  esCombo,
  onCambiarEsCombo,
  componentes,
  onCambiarComponentes,
  catalogoProductos,
  productoActualId,
  pvpSetCompleto,
  onCambiarPrecioSetBase,
  onSincronizarPrecioComparacion,
  tarifaIvaSet = 0,
}: PropsEditorSetCombo) {
  const productosElegibles = useMemo(() => {
    return (catalogoProductos || []).filter((p) => {
      if (!p || p.pro_activo === false) return false;
      if (productoActualId && p.pro_id === productoActualId) return false;
      // Evitar combos anidados circulares
      if (p.pro_detalle_producto?.es_combo === true) return false;
      return Array.isArray(p.variantes) && p.variantes.length > 0;
    });
  }, [catalogoProductos, productoActualId]);

  const [prodSeleccionadoId, setProdSeleccionadoId] = useState<string>("");
  const [varSeleccionadaSku, setVarSeleccionadaSku] = useState<string>("");
  const [cantidadAgregar, setCantidadAgregar] = useState<number>(1);
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>("");

  const productosFiltrados = useMemo(() => {
    const q = filtroBusqueda.trim().toLowerCase();
    if (!q) return productosElegibles;
    return productosElegibles.filter(
      (p) =>
        p.pro_nombre.toLowerCase().includes(q) ||
        (p.pro_slug || "").toLowerCase().includes(q)
    );
  }, [productosElegibles, filtroBusqueda]);

  const prodActivoParaAgregar = useMemo(() => {
    return (
      productosFiltrados.find((p) => p.pro_id === prodSeleccionadoId) ||
      productosFiltrados[0] ||
      null
    );
  }, [productosFiltrados, prodSeleccionadoId]);

  const varActivaParaAgregar = useMemo(() => {
    if (!prodActivoParaAgregar) return null;
    return (
      prodActivoParaAgregar.variantes.find((v) => v.var_sku === varSeleccionadaSku) ||
      prodActivoParaAgregar.variantes[0] ||
      null
    );
  }, [prodActivoParaAgregar, varSeleccionadaSku]);

  const handleAgregarComponente = () => {
    if (!prodActivoParaAgregar || !varActivaParaAgregar) return;
    const cant = Math.max(1, Math.floor(cantidadAgregar || 1));

    const idxExistente = componentes.findIndex(
      (c) =>
        c.producto_id === prodActivoParaAgregar.pro_id &&
        (c.variante_sku === varActivaParaAgregar.var_sku ||
          c.variante_id === varActivaParaAgregar.var_id)
    );

    let nuevos: ComponenteComboConfig[];
    if (idxExistente >= 0) {
      nuevos = componentes.map((c, i) =>
        i === idxExistente ? { ...c, cantidad_base: c.cantidad_base + cant } : c
      );
    } else {
      nuevos = [
        ...componentes,
        {
          producto_id: prodActivoParaAgregar.pro_id,
          producto_slug: prodActivoParaAgregar.pro_slug,
          producto_nombre: prodActivoParaAgregar.pro_nombre,
          variante_id: varActivaParaAgregar.var_id,
          variante_sku: varActivaParaAgregar.var_sku,
          variante_nombre: varActivaParaAgregar.var_nombre,
          cantidad_base: cant,
          orden: componentes.length + 1,
        },
      ];
    }

    onCambiarComponentes(nuevos);
    setCantidadAgregar(1);
  };

  const resumenCombo = useMemo(() => {
    let sumaNominal = 0;
    let sumaConVolumenIndividual = 0;

    const filas = componentes.map((comp) => {
      const prod = (catalogoProductos || []).find(
        (p) =>
          p.pro_id === comp.producto_id ||
          (comp.producto_slug && p.pro_slug === comp.producto_slug)
      );
      const variante =
        prod?.variantes.find(
          (v) =>
            (comp.variante_id && v.var_id === comp.variante_id) ||
            (comp.variante_sku && v.var_sku === comp.variante_sku)
        ) || prod?.variantes[0];

      const pvpUnit = obtenerPvpVariante(variante);
      const calcVol = calcularPrecioPorVolumen({
        pvpUnitarioNominal: pvpUnit,
        tarifaIvaPorcentaje: variante?.var_tarifa_iva_porcentaje || 0,
        cantidad: comp.cantidad_base,
        escalas: variante?.var_detalle_variante?.escalas_volumen,
      });

      sumaNominal += calcVol.subtotalLineaNominal;
      sumaConVolumenIndividual += calcVol.subtotalLineaFinal;

      return {
        comp,
        prod,
        variante,
        pvpUnit,
        calcVol,
        miniatura: obtenerMiniaturaProducto(prod, variante),
      };
    });

    const sumaNominalRedondeada = Number(sumaNominal.toFixed(2));
    const sumaVolRedondeada = Number(sumaConVolumenIndividual.toFixed(2));
    const ahorroNominal = Math.max(0, Number((sumaNominalRedondeada - pvpSetCompleto).toFixed(2)));
    const porcentajeDescuentoSet =
      sumaNominalRedondeada > 0 && ahorroNominal > 0
        ? Math.round((ahorroNominal / sumaNominalRedondeada) * 100)
        : 0;

    return {
      filas,
      sumaNominal: sumaNominalRedondeada,
      sumaConVolumenIndividual: sumaVolRedondeada,
      ahorroNominal,
      porcentajeDescuentoSet,
    };
  }, [componentes, catalogoProductos, pvpSetCompleto]);

  return (
    <div
      style={{
        background: esCombo ? "#FDF2F8" : "#F8FAFC",
        border: esCombo ? "2px solid #EC4899" : "1.5px dashed #CBD5E1",
        borderRadius: "12px",
        padding: "14px",
        marginBottom: "14px",
      }}
    >
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
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              background: esCombo ? "#FCE7F3" : "#E2E8F0",
              color: esCombo ? "#BE185D" : "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Gift size={18} />
          </div>
          <div>
            <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "#0F172A" }}>
              Set / Combo Compuesto para Eventos
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
              Agrupa varios productos individuales (con o sin variantes) bajo un precio especial de Set o personalizable por el cliente.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCambiarEsCombo(!esCombo)}
          title={esCombo ? "Desactivar modo Set/Combo" : "Activar modo Set/Combo"}
          aria-label={esCombo ? "Desactivar modo Set/Combo" : "Activar modo Set/Combo"}
          style={{
            background: esCombo ? "#BE185D" : "#FFFFFF",
            color: esCombo ? "#FFFFFF" : "#334155",
            border: esCombo ? "1.5px solid #BE185D" : "1.5px solid #94A3B8",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "0.76rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Gift size={14} />
          <span>{esCombo ? "✓ Set Activo" : "Activar Set"}</span>
        </button>
      </div>

      {esCombo && (
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Selector para agregar productos al Set */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #FBCFE8",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#831843", marginBottom: "8px" }}>
              1. Agregar elementos individuales al Set Completo
            </div>

            {productosElegibles.length === 0 ? (
              <div style={{ fontSize: "0.76rem", color: "#64748B" }}>
                Primero crea los productos individuales del catálogo (ej. Aro Floral, Cartel Bienvenida, Box Floral) para poder incluirlos aquí.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="🔍 Filtrar producto por nombre (ej. Aro, Cartel, Box)..."
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.78rem",
                    boxSizing: "border-box",
                  }}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      prodActivoParaAgregar && prodActivoParaAgregar.variantes.length > 1
                        ? "1.4fr 1fr 74px auto"
                        : "1fr 74px auto",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={prodActivoParaAgregar?.pro_id || ""}
                    onChange={(e) => {
                      const nuevoProd = productosFiltrados.find((p) => p.pro_id === e.target.value);
                      setProdSeleccionadoId(e.target.value);
                      setVarSeleccionadaSku(nuevoProd?.variantes[0]?.var_sku || "");
                    }}
                    style={{
                      width: "100%",
                      padding: "7px 8px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background: "#FFFFFF",
                    }}
                  >
                    {productosFiltrados.map((p) => {
                      const v0 = p.variantes[0];
                      const precioRef = obtenerPvpVariante(v0);
                      return (
                        <option key={p.pro_id} value={p.pro_id}>
                          {p.pro_nombre} (${precioRef.toFixed(2)}
                          {p.variantes.length > 1 ? ` • ${p.variantes.length} tallas` : ""})
                        </option>
                      );
                    })}
                  </select>

                  {prodActivoParaAgregar && prodActivoParaAgregar.variantes.length > 1 && (
                    <select
                      value={varActivaParaAgregar?.var_sku || ""}
                      onChange={(e) => setVarSeleccionadaSku(e.target.value)}
                      title="Tamaño / Variante predefinida en el Set Completo"
                      style={{
                        width: "100%",
                        padding: "7px 8px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        background: "#F8FAFC",
                      }}
                    >
                      {prodActivoParaAgregar.variantes.map((v) => (
                        <option key={v.var_sku} value={v.var_sku}>
                          {v.var_nombre} (${obtenerPvpVariante(v).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={cantidadAgregar}
                    onChange={(e) => setCantidadAgregar(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    title="Cantidad incluida en el Set"
                    style={{
                      width: "100%",
                      padding: "7px 6px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      textAlign: "center",
                      boxSizing: "border-box",
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleAgregarComponente}
                    disabled={!prodActivoParaAgregar}
                    title="Añadir pieza al Set"
                    aria-label="Añadir pieza al Set"
                    style={{
                      background: "#DB2777",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "7px",
                      padding: "7px 12px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      cursor: prodActivoParaAgregar ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Plus size={14} />
                    <span>Añadir Pieza</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de componentes agregados */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #FBCFE8",
              borderRadius: "10px",
              padding: "12px",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#831843", marginBottom: "8px" }}>
              2. Composición del Set Completo ({componentes.length} {componentes.length === 1 ? "elemento" : "elementos"})
            </div>

            {resumenCombo.filas.length === 0 ? (
              <div
                style={{
                  padding: "14px",
                  textAlign: "center",
                  fontSize: "0.76rem",
                  color: "#94A3B8",
                  border: "1px dashed #E2E8F0",
                  borderRadius: "8px",
                }}
              >
                Aún no has añadido elementos al Set (ej. 1 × Aro Floral + 2 × Cartel Bienvenida).
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {resumenCombo.filas.map((fila, idx) => (
                  <div
                    key={`${fila.comp.producto_id}-${fila.comp.variante_sku || idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      flexWrap: "wrap",
                    }}
                  >
                    {fila.miniatura ? (
                      <img
                        src={fila.miniatura}
                        alt={fila.prod?.pro_nombre || fila.comp.producto_nombre || "Pieza"}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "6px",
                          objectFit: "cover",
                          border: "1px solid #CBD5E1",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "6px",
                          background: "#E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          color: "#64748B",
                        }}
                      >
                        🌸
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: "150px" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0F172A" }}>
                        {fila.prod?.pro_nombre || fila.comp.producto_nombre || "Producto"}
                      </div>

                      {fila.prod && fila.prod.variantes.length > 1 ? (
                        <select
                          value={fila.variante?.var_sku || ""}
                          onChange={(e) => {
                            const nuevaVar = fila.prod?.variantes.find(
                              (v) => v.var_sku === e.target.value
                            );
                            if (!nuevaVar) return;
                            const actualizados = componentes.map((c, i) =>
                              i === idx
                                ? {
                                    ...c,
                                    variante_id: nuevaVar.var_id,
                                    variante_sku: nuevaVar.var_sku,
                                    variante_nombre: nuevaVar.var_nombre,
                                  }
                                : c
                            );
                            onCambiarComponentes(actualizados);
                          }}
                          style={{
                            marginTop: "3px",
                            padding: "2px 6px",
                            borderRadius: "5px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            background: "#FFFFFF",
                          }}
                        >
                          {fila.prod.variantes.map((v) => (
                            <option key={v.var_sku} value={v.var_sku}>
                              Variante Set: {v.var_nombre} (${obtenerPvpVariante(v).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                          Precio individual: ${fila.pvpUnit.toFixed(2)} c/u
                          {fila.calcVol.tieneDescuentoVolumen && (
                            <span style={{ color: "#D97706", fontWeight: 700, marginLeft: "6px" }}>
                              (Volumen {fila.comp.cantidad_base}+: ${fila.calcVol.pvpUnitarioFinal.toFixed(2)} c/u)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Control de cantidad en el Set */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "999px",
                        padding: "3px 8px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (fila.comp.cantidad_base <= 1) return;
                          onCambiarComponentes(
                            componentes.map((c, i) =>
                              i === idx ? { ...c, cantidad_base: c.cantidad_base - 1 } : c
                            )
                          );
                        }}
                        title="Reducir cantidad"
                        aria-label="Reducir cantidad"
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: "2px",
                          display: "inline-flex",
                        }}
                      >
                        <Minus size={13} />
                      </button>
                      <span style={{ fontSize: "0.82rem", fontWeight: 800, minWidth: "18px", textAlign: "center" }}>
                        {fila.comp.cantidad_base}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onCambiarComponentes(
                            componentes.map((c, i) =>
                              i === idx ? { ...c, cantidad_base: c.cantidad_base + 1 } : c
                            )
                          )
                        }
                        title="Aumentar cantidad"
                        aria-label="Aumentar cantidad"
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          padding: "2px",
                          display: "inline-flex",
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div style={{ textAlign: "right", minWidth: "78px" }}>
                      <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "#0F172A" }}>
                        ${fila.calcVol.subtotalLineaNominal.toFixed(2)}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#64748B" }}>
                        nominal
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onCambiarComponentes(componentes.filter((_, i) => i !== idx))}
                      title="Quitar pieza del Set"
                      aria-label="Quitar pieza del Set"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#EF4444",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen Financiero del Set Completo */}
          {resumenCombo.filas.length > 0 && (
            <div
              style={{
                background: "linear-gradient(135deg, #FFF1F2 0%, #FCE7F3 100%)",
                border: "1.5px solid #F472B6",
                borderRadius: "10px",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.73rem", color: "#831843", fontWeight: 700 }}>
                    Suma individual de elementos:
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#475569", textDecoration: "line-through" }}>
                    ${resumenCombo.sumaNominal.toFixed(2)}
                  </div>
                  {onSincronizarPrecioComparacion && (
                    <button
                      type="button"
                      onClick={() => onSincronizarPrecioComparacion(resumenCombo.sumaNominal)}
                      title="Fijar esta suma como precio tachado de referencia"
                      aria-label="Fijar suma como precio tachado"
                      style={{
                        marginTop: "4px",
                        background: "#FFFFFF",
                        border: "1px solid #F472B6",
                        color: "#9D174D",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Fijar Tachado (${resumenCombo.sumaNominal.toFixed(2)})
                    </button>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.73rem",
                      fontWeight: 800,
                      color: "#831843",
                      marginBottom: "3px",
                    }}
                  >
                    Precio Especial Set Completo ($ USD) *
                  </label>
                  {onCambiarPrecioSetBase ? (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        tarifaIvaSet > 0
                          ? Number((pvpSetCompleto / (1 + tarifaIvaSet / 100)).toFixed(2))
                          : pvpSetCompleto
                      }
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        onCambiarPrecioSetBase(val);
                        if (onSincronizarPrecioComparacion && resumenCombo.sumaNominal > val) {
                          onSincronizarPrecioComparacion(resumenCombo.sumaNominal);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "2px solid #DB2777",
                        fontSize: "0.95rem",
                        fontWeight: 800,
                        color: "#9D174D",
                        background: "#FFFFFF",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#9D174D" }}>
                      ${pvpSetCompleto.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "8px",
                  borderTop: "1px dashed #F9A8D4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {resumenCombo.ahorroNominal > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", fontWeight: 800, color: "#065F46" }}>
                    <CheckCircle2 size={15} color="#059669" />
                    <span>
                      Cliente ahorra ${resumenCombo.ahorroNominal.toFixed(2)} (-{resumenCombo.porcentajeDescuentoSet}% OFF en el Set Completo)
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 700, color: "#B45309" }}>
                    <AlertCircle size={15} color="#D97706" />
                    <span>
                      Sugerencia: ingresa un Precio del Set menor a ${resumenCombo.sumaNominal.toFixed(2)} para mostrar el % de ahorro del combo.
                    </span>
                  </div>
                )}

                {resumenCombo.sumaConVolumenIndividual < pvpSetCompleto && (
                  <div style={{ fontSize: "0.72rem", color: "#B91C1C", fontWeight: 700 }}>
                    ⚠️ Nota: comprando las piezas con descuento por volumen suman ${resumenCombo.sumaConVolumenIndividual.toFixed(2)}. Conviene fijar el Set en ≤ ${resumenCombo.sumaConVolumenIndividual.toFixed(2)}.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

