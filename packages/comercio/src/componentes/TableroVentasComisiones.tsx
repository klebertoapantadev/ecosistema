"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import {
  Award,
  Check,
  CheckCircle2,
  DollarSign,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import {
  actualizarEstadoLiquidacionComisionAction,
  guardarTasaComisionAsesorAction,
  obtenerTableroComisionesAction,
  type DatosTableroComisiones,
} from "../acciones-comisiones";
import type {
  EstadoLiquidacionComision,
  PeriodoEstadisticasComision,
  VentaComisionRegistrada,
} from "../comisiones";
import type { MiembroEquipoOmnicanal } from "../omnicanal";
import { ModalCierreVentaComision } from "./ModalCierreVentaComision";

export interface PropiedadesTableroVentasComisiones {
  negocio: string;
  equipo: MiembroEquipoOmnicanal[];
  esMovil?: boolean;
}

const ETIQUETA_REGLA: Record<string, string> = {
  GANADOR_UNICO: "Ganador único",
  PROPORCIONAL_REAL: "Proporcional real",
  PROPORCIONAL_HUMANOS: "Proporcional humanos",
  MANUAL: "Manual",
};

export function TableroVentasComisiones({
  negocio,
  equipo,
  esMovil = false,
}: PropiedadesTableroVentasComisiones) {
  const [periodo, setPeriodo] = useState<PeriodoEstadisticasComision>("hoy");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [datos, setDatos] = useState<DatosTableroComisiones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [mostrarTasas, setMostrarTasas] = useState(false);
  const [tasasEditadas, setTasasEditadas] = useState<Record<string, string>>({});
  const [guardandoTasaUid, setGuardandoTasaUid] = useState<string | null>(null);
  const [ventaEditando, setVentaEditando] = useState<VentaComisionRegistrada | null>(null);

  const cargarTablero = useCallback(async () => {
    setCargando(true);
    setErrorMsg(null);
    const res = await obtenerTableroComisionesAction({
      negocio,
      periodo,
      fechaDesde: periodo === "personalizado" ? fechaDesde : null,
      fechaHasta: periodo === "personalizado" ? fechaHasta : null,
    });
    setCargando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setDatos(res.datos);
    const inicialTasas: Record<string, string> = {};
    for (const t of res.datos.tasasAsesores) {
      inicialTasas[t.usuarioId] = String(t.tasaPorcentaje);
    }
    setTasasEditadas(inicialTasas);
  }, [negocio, periodo, fechaDesde, fechaHasta]);

  useEffect(() => {
    void cargarTablero();
  }, [cargarTablero]);

  const handleGuardarTasa = async (usuarioId: string) => {
    const valor = Number(tasasEditadas[usuarioId] ?? 0);
    setGuardandoTasaUid(usuarioId);
    const res = await guardarTasaComisionAsesorAction({
      negocio,
      usuarioId,
      tasaPorcentaje: valor,
    });
    setGuardandoTasaUid(null);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setInfoMsg(`Tasa actualizada al ${res.tasaPorcentaje}%.`);
    void cargarTablero();
  };

  const handleCambiarEstado = async (ventaId: string, estado: EstadoLiquidacionComision) => {
    const res = await actualizarEstadoLiquidacionComisionAction({
      negocio,
      ventaId,
      estado,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setInfoMsg(`Estado de comisión actualizado a ${estado}.`);
    void cargarTablero();
  };

  const esAdmin = Boolean(datos?.esAdmin);

  const columnasVentas = useMemo<ColumnaDataGrid<VentaComisionRegistrada>[]>(
    () => [
      {
        id: "fecha",
        encabezado: "Fecha / Cliente",
        valor: (v) => `${v.fechaDiaEc} ${v.clienteNombre} ${v.codigoPedido || ""}`,
        render: (v) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.82rem", color: "#1F1C19" }}>{v.clienteNombre}</strong>
            <span style={{ fontSize: "0.71rem", color: "#847D74" }}>
              {v.codigoPedido ? `${v.codigoPedido} · ` : ""}
              {new Date(v.cerradoEn).toLocaleString("es-EC", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>
        ),
      },
      {
        id: "venta_total",
        encabezado: "Venta Total",
        valor: (v) => v.desglose.ventaTotalUsd,
        render: (v) => (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontSize: "0.84rem", color: "#1F1C19" }}>
              ${v.desglose.ventaTotalUsd.toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.69rem", color: "#847D74" }}>
              Base: ${v.desglose.baseComisionableUsd.toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        id: "delivery_extras",
        encabezado: "Delivery / Extras",
        valor: (v) =>
          v.desglose.deliveryFijoUsd + v.desglose.deliveryExtraUsd + v.desglose.valorExtrasUsd,
        render: (v) => (
          <div style={{ fontSize: "0.73rem", color: "#57524C", lineHeight: 1.35 }}>
            <div>
              Del. fijo: <strong>${v.desglose.deliveryFijoUsd.toFixed(2)}</strong>
              {v.desglose.deliveryExtraUsd > 0 && (
                <span> · Extra: +${v.desglose.deliveryExtraUsd.toFixed(2)}</span>
              )}
            </div>
            <div>
              Extras: <strong>${v.desglose.valorExtrasUsd.toFixed(2)}</strong>
            </div>
          </div>
        ),
      },
      {
        id: "participacion",
        encabezado: "Participación & Reparto",
        valor: (v) =>
          v.asignaciones.map((a) => `${a.asesorNombre} ${a.porcentajeComisionAsignado}%`).join(", "),
        render: (v) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {v.porcentajeIaChat > 0 && (
                <span
                  style={{
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "999px",
                    background: "#F2F6F3",
                    color: "#2F4737",
                    border: "1px solid #CEDDD3",
                  }}
                >
                  IA {v.porcentajeIaChat}%
                </span>
              )}
              {v.asignaciones.map((a) => (
                <span
                  key={a.clave}
                  style={{
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: "999px",
                    background: a.porcentajeComisionAsignado > 0 ? "#FAF6EC" : "#F8F7F4",
                    color: a.porcentajeComisionAsignado > 0 ? "#745622" : "#6E6861",
                    border: "1px solid #E6E2DA",
                  }}
                >
                  {a.asesorNombre.split(" ")[0]}: {a.porcentajeComisionAsignado}% ($
                  {a.montoComisionUsd.toFixed(2)})
                </span>
              ))}
            </div>
            <span style={{ fontSize: "0.67rem", color: "#847D74" }}>
              {ETIQUETA_REGLA[v.reglaReparto] || v.reglaReparto}
            </span>
          </div>
        ),
      },
      {
        id: "comision",
        encabezado: "Comisión",
        valor: (v) => v.totalComisionUsd,
        render: (v) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.84rem", color: "#2F4737" }}>
              ${v.totalComisionUsd.toFixed(2)}
            </strong>
            <span
              style={{
                fontSize: "0.66rem",
                fontWeight: 700,
                color:
                  v.estadoLiquidacion === "PAGADA"
                    ? "#15803D"
                    : v.estadoLiquidacion === "APROBADA"
                      ? "#2F4737"
                      : "#745622",
              }}
            >
              {v.estadoLiquidacion}
            </span>
          </div>
        ),
      },
      ...(esAdmin
        ? [
            {
              id: "acciones",
              encabezado: "Admin",
              valor: (v: VentaComisionRegistrada) => v.estadoLiquidacion,
              render: (v: VentaComisionRegistrada) => (
                <div style={{ display: "inline-flex", gap: "5px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setVentaEditando(v)}
                    title="Editar desglose y reparto de comisión"
                    aria-label="Editar reparto"
                    style={{
                      padding: "4px 8px",
                      borderRadius: "7px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      color: "#1F1C19",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Pencil size={12} />
                    <span>Reparto</span>
                  </button>
                  {v.estadoLiquidacion !== "PAGADA" && (
                    <button
                      type="button"
                      onClick={() =>
                        void handleCambiarEstado(
                          v.id,
                          v.estadoLiquidacion === "PENDIENTE" ? "APROBADA" : "PAGADA"
                        )
                      }
                      title={
                        v.estadoLiquidacion === "PENDIENTE"
                          ? "Aprobar comisión"
                          : "Marcar comisión como pagada"
                      }
                      aria-label={
                        v.estadoLiquidacion === "PENDIENTE" ? "Aprobar" : "Marcar pagada"
                      }
                      style={{
                        padding: "4px 8px",
                        borderRadius: "7px",
                        border: "none",
                        background: "#2F4737",
                        color: "#FFFFFF",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Check size={12} />
                      <span>{v.estadoLiquidacion === "PENDIENTE" ? "Aprobar" : "Pagada"}</span>
                    </button>
                  )}
                </div>
              ),
            } satisfies ColumnaDataGrid<VentaComisionRegistrada>,
          ]
        : []),
    ],
    [esAdmin]
  );

  const resumen = datos?.resumen;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E6E2DA",
        borderRadius: "16px",
        padding: "clamp(14px, 3vw, 20px)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Encabezado y controles de periodo */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#1F1C19" }}>
            {esAdmin ? "Ventas Cerradas y Comisiones del Equipo" : "Ventas de Hoy — Tienda y Asesores"}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#6E6861" }}>
            {esAdmin
              ? "Control diario, semanal y mensual de ventas cerradas, delivery, extras y reparto de comisiones."
              : `Vista diaria del equipo (${datos?.hoyEcuador || "Hoy"}): consulta tus ventas del día y las del equipo.`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {esAdmin && (
            <button
              type="button"
              onClick={() => setMostrarTasas((v) => !v)}
              title="Configurar porcentaje de comisión individual por asesor"
              aria-label="Tasas por asesor"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 11px",
                borderRadius: "9px",
                border: mostrarTasas ? "1px solid #221E1B" : "1px solid #D5CFC4",
                background: mostrarTasas ? "#221E1B" : "#FAF8F5",
                color: mostrarTasas ? "#FFFFFF" : "#1F1C19",
                fontSize: "0.76rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Tasas por asesor</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void cargarTablero()}
            title="Actualizar estadísticas de ventas y comisiones"
            aria-label="Actualizar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid #D5CFC4",
              background: "#FFFFFF",
              color: "#1F1C19",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Selector de Periodo — EXCLUSIVO PARA ADMINISTRADORES (Asesores solo ven HOY) */}
      {esAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {(
            [
              { id: "hoy", etiqueta: "Hoy" },
              { id: "ayer", etiqueta: "Ayer" },
              { id: "semana", etiqueta: "Esta Semana" },
              { id: "quincena", etiqueta: "Quincena" },
              { id: "mes", etiqueta: "Este Mes" },
              { id: "personalizado", etiqueta: "Rango" },
              { id: "todos", etiqueta: "Todos" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              style={{
                padding: "6px 11px",
                borderRadius: "8px",
                border: periodo === p.id ? "1px solid #221E1B" : "1px solid #D5CFC4",
                background: periodo === p.id ? "#221E1B" : "#FFFFFF",
                color: periodo === p.id ? "#FFFFFF" : "#57524C",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {p.etiqueta}
            </button>
          ))}

          {periodo === "personalizado" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                aria-label="Fecha desde"
                style={{
                  padding: "5px 8px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  fontSize: "0.76rem",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "#6E6861" }}>a</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                aria-label="Fecha hasta"
                style={{
                  padding: "5px 8px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  fontSize: "0.76rem",
                }}
              />
            </div>
          )}
        </div>
      )}

      {infoMsg && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "9px",
            background: "#F2F6F3",
            border: "1px solid #CEDDD3",
            color: "#2B4A36",
            fontSize: "0.78rem",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{infoMsg}</span>
          <button
            type="button"
            onClick={() => setInfoMsg(null)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#2B4A36", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "9px",
            background: "#FAF2F2",
            border: "1px solid #E5CACA",
            color: "#8A2E2E",
            fontSize: "0.78rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Panel de Tasas Variables por Asesor (Solo Admin) */}
      {esAdmin && mostrarTasas && datos && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "12px",
            background: "#FAF8F5",
            border: "1px solid #E6E2DA",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <strong style={{ fontSize: "0.82rem", color: "#1F1C19" }}>
            Porcentaje de comisión variable por asesor (% sobre Base Comisionable)
          </strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
              gap: "8px",
            }}
          >
            {datos.tasasAsesores.map((t) => (
              <div
                key={t.usuarioId}
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  border: "1px solid #E6E2DA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      fontSize: "0.78rem",
                      color: "#1F1C19",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.nombre}
                  </strong>
                  <span style={{ fontSize: "0.67rem", color: "#847D74" }}>{t.rol || "VENTAS"}</span>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={tasasEditadas[t.usuarioId] ?? String(t.tasaPorcentaje)}
                    onChange={(e) =>
                      setTasasEditadas((prev) => ({ ...prev, [t.usuarioId]: e.target.value }))
                    }
                    aria-label={`Tasa de ${t.nombre}`}
                    style={{
                      width: "58px",
                      padding: "4px 6px",
                      borderRadius: "7px",
                      border: "1px solid #D5CFC4",
                      textAlign: "right",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#57524C" }}>%</span>
                  <button
                    type="button"
                    disabled={guardandoTasaUid === t.usuarioId}
                    onClick={() => void handleGuardarTasa(t.usuarioId)}
                    title={`Guardar tasa para ${t.nombre}`}
                    aria-label={`Guardar tasa ${t.nombre}`}
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "7px",
                      border: "none",
                      background: "#221E1B",
                      color: "#FFFFFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {guardandoTasaUid === t.usuarioId ? (
                      <Loader2 size={13} />
                    ) : (
                      <Save size={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs de Tienda */}
      {resumen && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
            gap: "10px",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#FAF8F5",
              border: "1px solid #E6E2DA",
            }}
          >
            <div style={{ fontSize: "0.71rem", fontWeight: 700, color: "#6E6861", display: "flex", alignItems: "center", gap: "4px" }}>
              <TrendingUp size={13} />
              <span>Venta Total ({resumen.cantidadVentas})</span>
            </div>
            <strong style={{ fontSize: "1.15rem", color: "#1F1C19", display: "block", marginTop: "4px" }}>
              ${resumen.ventaTotalUsd.toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.69rem", color: "#847D74" }}>
              Arreglos ${resumen.valorProductoUsd.toFixed(2)} · Extras ${resumen.valorExtrasUsd.toFixed(2)}
            </span>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#FAF8F5",
              border: "1px solid #E6E2DA",
            }}
          >
            <div style={{ fontSize: "0.71rem", fontWeight: 700, color: "#6E6861" }}>
              Delivery (Fijo + Extra)
            </div>
            <strong style={{ fontSize: "1.15rem", color: "#1F1C19", display: "block", marginTop: "4px" }}>
              ${(resumen.deliveryFijoUsd + resumen.deliveryExtraUsd).toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.69rem", color: "#847D74" }}>
              Fijo ${resumen.deliveryFijoUsd.toFixed(2)} · Extra ${resumen.deliveryExtraUsd.toFixed(2)}
            </span>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#F2F6F3",
              border: "1px solid #CEDDD3",
            }}
          >
            <div style={{ fontSize: "0.71rem", fontWeight: 700, color: "#2B4A36" }}>
              Base Comisionable Neta
            </div>
            <strong style={{ fontSize: "1.15rem", color: "#2F4737", display: "block", marginTop: "4px" }}>
              ${resumen.baseComisionableUsd.toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.69rem", color: "#2B4A36" }}>
              Aporte IA promedio: {resumen.promedioParticipacionIaPct}%
            </span>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#FAF6EC",
              border: "1px solid #E8DEC6",
            }}
          >
            <div style={{ fontSize: "0.71rem", fontWeight: 700, color: "#745622", display: "flex", alignItems: "center", gap: "4px" }}>
              <DollarSign size={13} />
              <span>Comisiones del Periodo</span>
            </div>
            <strong style={{ fontSize: "1.15rem", color: "#745622", display: "block", marginTop: "4px" }}>
              ${resumen.totalComisionesUsd.toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.69rem", color: "#745622" }}>
              {esAdmin ? "Según tasa individual por asesor" : "Comisiones acumuladas hoy"}
            </span>
          </div>
        </div>
      )}

      {/* Ranking de Ventas por Asesor (Hoy para todos; periodo completo para Admin) */}
      {resumen && resumen.porAsesor.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <strong
            style={{
              fontSize: "0.82rem",
              color: "#1F1C19",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Award size={15} />
            <span>
              {esAdmin ? "Desempeño por Asesor" : "Ventas de Hoy por Asesor"}
            </span>
          </strong>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
              gap: "8px",
            }}
          >
            {resumen.porAsesor.map((as) => {
              const esYo = datos?.usuarioActualId && as.usuarioId === datos.usuarioActualId;
              return (
                <div
                  key={as.clave}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "11px",
                    background: esYo ? "#F2F6F3" : "#FAF8F5",
                    border: esYo ? "1px solid #CEDDD3" : "1px solid #E6E2DA",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.82rem", color: "#1F1C19" }}>
                      {as.nombre}
                      {esYo ? " (Tú)" : ""}
                    </strong>
                    <span
                      style={{
                        fontSize: "0.67rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "999px",
                        background: "#FFFFFF",
                        border: "1px solid #E6E2DA",
                        color: "#57524C",
                      }}
                    >
                      Tasa {as.tasaVigentePct}%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#57524C" }}>
                    <span>Vendido:</span>
                    <strong style={{ color: "#1F1C19" }}>${as.ventaTotalAtribuidaUsd.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#2F4737" }}>
                    <span>Comisión:</span>
                    <strong>${as.comisionTotalUsd.toFixed(2)}</strong>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#847D74" }}>
                    {as.ventasParticipadas} venta(s) · {as.ventasLideradas} liderada(s)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DataGrid de Ventas Cerradas */}
      {datos && (
        <DataGrid
          columnas={columnasVentas}
          filas={datos.ventas}
          idFila={(v) => v.id}
          nombreExportacion={`ventas-comisiones-${negocio}-${datos.periodoEfectivo}`}
          contenidoExpandible={(v) => (
            <div
              style={{
                padding: "10px 14px",
                background: "#FAF8F5",
                borderRadius: "10px",
                fontSize: "0.78rem",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                color: "#3A3530",
              }}
            >
              <div>
                <strong>Producto:</strong> {v.productoResumen || "Sin detalle"} ·{" "}
                <strong>Cerrado por:</strong> {v.cerradoPorNombre || "Equipo"}
              </div>
              <div>
                <strong>Desglose:</strong> Arreglo ${v.desglose.valorProductoUsd.toFixed(2)} + Extras $
                {v.desglose.valorExtrasUsd.toFixed(2)} (
                {v.desglose.extrasComisionan ? "comisionan" : "no comisionan"}) + Delivery fijo $
                {v.desglose.deliveryFijoUsd.toFixed(2)} + Delivery extra $
                {v.desglose.deliveryExtraUsd.toFixed(2)} - Desc. $
                {v.desglose.descuentosUsd.toFixed(2)} - Pasarela $
                {v.desglose.comisionPasarelaUsd.toFixed(2)} ={" "}
                <strong>Base ${v.desglose.baseComisionableUsd.toFixed(2)}</strong>
              </div>
              {v.notaAdmin && (
                <div>
                  <strong>Nota Admin:</strong> {v.notaAdmin}
                </div>
              )}
            </div>
          )}
        />
      )}

      {!cargando && datos && datos.ventas.length === 0 && (
        <div
          style={{
            padding: "18px",
            textAlign: "center",
            color: "#847D74",
            fontSize: "0.8rem",
            background: "#FAF8F5",
            borderRadius: "10px",
            border: "1px dashed #D5CFC4",
          }}
        >
          <CheckCircle2 size={22} style={{ margin: "0 auto 6px", opacity: 0.45, display: "block" }} />
          No hay ventas cerradas registradas en este periodo. Cuando marques un chat como{" "}
          <strong>Venta completada</strong>, aparecerá aquí automáticamente.
        </div>
      )}

      {/* Modal de edición de reparto (solo Admin) */}
      {esAdmin && ventaEditando && datos && (
        <ModalCierreVentaComision
          abierto={Boolean(ventaEditando)}
          negocio={negocio}
          esAdmin={true}
          esMovil={esMovil}
          equipo={equipo}
          tasasPorUsuarioId={datos.tasasMapa}
          tasaPorDefectoPct={datos.tasaPorDefectoPct}
          ventaExistente={ventaEditando}
          onCerrar={() => setVentaEditando(null)}
          onGuardado={() => {
            setVentaEditando(null);
            setInfoMsg("Reparto de comisión actualizado.");
            void cargarTablero();
          }}
        />
      )}
    </div>
  );
}
