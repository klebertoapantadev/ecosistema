"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hammer,
  CheckCircle2,
  Send,
  Sparkles,
} from "lucide-react";
import {
  esPedidoDeElaboracionEnFecha,
  formatearFechaEntregaHumana,
  generarCuadriculaMesCalendario,
  normalizarFranjaHorariaTienda,
  obtenerFechaHoyEcuadorYmd,
  obtenerRangoSemanaLunesADomingo,
  sumarDiasYmd,
  type EstadoOrdenTaller,
  type OrdenTrabajoTaller,
} from "../operaciones-taller";

export type VistaCalendarioPedidos = "hoy" | "semana" | "mes";

export interface PropsCalendarioPedidosTaller {
  ordenes: OrdenTrabajoTaller[];
  modo: "despacho" | "taller";
  vistaInicial?: VistaCalendarioPedidos;
  onEnviarATaller?: (orden: OrdenTrabajoTaller) => void;
  onCambiarEstadoTaller?: (orden: OrdenTrabajoTaller, nuevoEstado: EstadoOrdenTaller) => void;
  onEditarOrden?: (orden: OrdenTrabajoTaller) => void;
  idProcesando?: string | null;
}

const NOMBRES_DIAS_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function badgeEstadoTaller(estado: EstadoOrdenTaller): {
  etiqueta: string;
  fondo: string;
  borde: string;
  color: string;
} {
  switch (estado) {
    case "PENDIENTE_ENVIO":
      return {
        etiqueta: "⏳ Por validar / enviar",
        fondo: "#FEF3C7",
        borde: "#FDE68A",
        color: "#92400E",
      };
    case "ENVIADO_TALLER":
      return {
        etiqueta: "📨 Recibido en Taller",
        fondo: "#E0F2FE",
        borde: "#BAE6FD",
        color: "#0369A1",
      };
    case "EN_PREPARACION":
      return {
        etiqueta: "🔨 En preparación",
        fondo: "#FFEDD5",
        borde: "#FED7AA",
        color: "#C2410C",
      };
    case "LISTO_ENTREGA":
      return {
        etiqueta: "🟢 Listo entrega",
        fondo: "#DCFCE7",
        borde: "#86EFAC",
        color: "#15803D",
      };
    case "ENTREGADO":
      return {
        etiqueta: "✅ Entregado",
        fondo: "#F1F5F9",
        borde: "#CBD5E1",
        color: "#475569",
      };
    default:
      return {
        etiqueta: estado,
        fondo: "#F1F5F9",
        borde: "#E2E8F0",
        color: "#64748B",
      };
  }
}

export function CalendarioPedidosTaller({
  ordenes,
  modo,
  vistaInicial = "hoy",
  onEnviarATaller,
  onCambiarEstadoTaller,
  onEditarOrden,
  idProcesando = null,
}: PropsCalendarioPedidosTaller) {
  const hoyYmd = useMemo(() => obtenerFechaHoyEcuadorYmd(), []);
  const [vista, setVista] = useState<VistaCalendarioPedidos>(vistaInicial);
  const [fechaCursor, setFechaCursor] = useState<string>(hoyYmd);

  const [anioCursor, mesCursor] = useMemo(() => {
    const [y, m] = (fechaCursor || hoyYmd).split("-").map((n) => Number(n));
    return [y || 2026, m || 11];
  }, [fechaCursor, hoyYmd]);

  const ordenesPorFechaEntrega = useMemo(() => {
    const mapa = new Map<string, OrdenTrabajoTaller[]>();
    for (const o of ordenes) {
      if (o.estadoTaller === "ANULADO") continue;
      const f = (o.fechaEntrega || hoyYmd).slice(0, 10);
      const lista = mapa.get(f) ?? [];
      lista.push(o);
      mapa.set(f, lista);
    }
    return mapa;
  }, [ordenes, hoyYmd]);

  const ordenesElaboracionDiaSeleccionado = useMemo(() => {
    return ordenes.filter((o) => esPedidoDeElaboracionEnFecha(o, fechaCursor, hoyYmd));
  }, [ordenes, fechaCursor, hoyYmd]);

  const semanaActual = useMemo(
    () => obtenerRangoSemanaLunesADomingo(fechaCursor),
    [fechaCursor]
  );

  const celdasMes = useMemo(
    () => generarCuadriculaMesCalendario(anioCursor, mesCursor),
    [anioCursor, mesCursor]
  );

  const navegarAnterior = () => {
    if (vista === "hoy") {
      setFechaCursor((prev) => sumarDiasYmd(prev, -1));
    } else if (vista === "semana") {
      setFechaCursor((prev) => sumarDiasYmd(prev, -7));
    } else {
      const mNuevo = mesCursor === 1 ? 12 : mesCursor - 1;
      const yNuevo = mesCursor === 1 ? anioCursor - 1 : anioCursor;
      setFechaCursor(`${yNuevo}-${String(mNuevo).padStart(2, "0")}-01`);
    }
  };

  const navegarSiguiente = () => {
    if (vista === "hoy") {
      setFechaCursor((prev) => sumarDiasYmd(prev, 1));
    } else if (vista === "semana") {
      setFechaCursor((prev) => sumarDiasYmd(prev, 7));
    } else {
      const mNuevo = mesCursor === 12 ? 1 : mesCursor + 1;
      const yNuevo = mesCursor === 12 ? anioCursor + 1 : anioCursor;
      setFechaCursor(`${yNuevo}-${String(mNuevo).padStart(2, "0")}-01`);
    }
  };

  const renderTarjetaCompacta = (o: OrdenTrabajoTaller, mostrarFechaEntregaExplicita = false) => {
    const esExeq = o.origenTipo === "EXEQUIALES_LLAMADA";
    const est = badgeEstadoTaller(o.estadoTaller);
    const procesando = idProcesando === o.id;
    const entregaDistinta = (o.fechaEntrega || "").slice(0, 10) !== fechaCursor;

    return (
      <div
        key={o.id}
        style={{
          background: esExeq ? "#FAF5FF" : "#FFFFFF",
          border: esExeq ? "1.5px solid #C084FC" : `1px solid ${est.borde}`,
          borderRadius: "11px",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>{o.codigo}</strong>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: "999px",
                fontSize: "0.69rem",
                fontWeight: 700,
                background: est.fondo,
                color: est.color,
              }}
            >
              {est.etiqueta}
            </span>
            {esExeq && (
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: "999px",
                  fontSize: "0.69rem",
                  fontWeight: 800,
                  background: "#581C87",
                  color: "#FFFFFF",
                }}
              >
                🕊️ Exequiales {o.salaServicio ? `· ${o.salaServicio}` : ""}
              </span>
            )}
          </div>

          <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#334155" }}>
            {esExeq
              ? `⏰ ${o.horaEspecifica || "Hoy"}`
              : o.franjaHoraria || "A) 09:00 - 13:00"}
          </span>
        </div>

        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#1E293B" }}>
          💐 {o.productoResumen}
        </div>

        <div style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.4 }}>
          {esExeq ? (
            <>
              <strong>Solicita:</strong> {o.clienteSolicita} · <strong>Fallecido:</strong>{" "}
              {o.destinatarioFallecido || "Por confirmar"}
            </>
          ) : (
            <>
              <strong>Recibe:</strong> {o.destinatarioFallecido || o.clienteSolicita}
              {o.ubicacionEntrega ? ` · 📍 ${o.ubicacionEntrega}` : ""}
            </>
          )}
        </div>

        {(mostrarFechaEntregaExplicita || entregaDistinta) && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "2px 8px",
              borderRadius: "6px",
              background: entregaDistinta ? "#EFF6FF" : "#F0FDF4",
              border: `1px solid ${entregaDistinta ? "#BFDBFE" : "#BBF7D0"}`,
              color: entregaDistinta ? "#1D4ED8" : "#15803D",
              fontSize: "0.71rem",
              fontWeight: 700,
            }}
          >
            {entregaDistinta
              ? `🔨 Elaborar Hoy → Entrega: ${formatearFechaEntregaHumana(o.fechaEntrega, hoyYmd).etiquetaPrincipal}`
              : `📅 Entrega: ${formatearFechaEntregaHumana(o.fechaEntrega, hoyYmd).etiquetaPrincipal}`}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "2px" }}>
          {modo === "despacho" && o.estadoTaller === "PENDIENTE_ENVIO" && onEnviarATaller && (
            <button
              type="button"
              disabled={procesando}
              onClick={() => onEnviarATaller(o)}
              title="Validar y enviar este pedido al Taller ahora"
              aria-label="Enviar a Taller"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "7px",
                border: "none",
                background: "#0F172A",
                color: "#FFFFFF",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: procesando ? "wait" : "pointer",
              }}
            >
              <Send size={12} />
              <span>Enviar a Taller</span>
            </button>
          )}

          {modo === "taller" &&
            o.estadoTaller !== "ENTREGADO" &&
            onCambiarEstadoTaller && (
              <>
                <button
                  type="button"
                  disabled={procesando || o.estadoTaller === "EN_PREPARACION"}
                  onClick={() => onCambiarEstadoTaller(o, "EN_PREPARACION")}
                  title="Marcar pedido como En preparación en mesa de armado"
                  aria-label="En Preparación"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border:
                      o.estadoTaller === "EN_PREPARACION"
                        ? "1.5px solid #C2410C"
                        : "1px solid #CBD5E1",
                    background: o.estadoTaller === "EN_PREPARACION" ? "#FFEDD5" : "#FFFFFF",
                    color: o.estadoTaller === "EN_PREPARACION" ? "#9A3412" : "#334155",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: procesando ? "wait" : "pointer",
                  }}
                >
                  <Hammer size={12} />
                  <span>En Preparación</span>
                </button>

                <button
                  type="button"
                  disabled={procesando || o.estadoTaller === "LISTO_ENTREGA"}
                  onClick={() => onCambiarEstadoTaller(o, "LISTO_ENTREGA")}
                  title="Marcar arreglo como Listo para entrega"
                  aria-label="Listo Entrega"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border: "none",
                    background: o.estadoTaller === "LISTO_ENTREGA" ? "#15803D" : "#059669",
                    color: "#FFFFFF",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: procesando ? "wait" : "pointer",
                  }}
                >
                  <CheckCircle2 size={12} />
                  <span>Listo Entrega</span>
                </button>
              </>
            )}

          {onEditarOrden && (
            <button
              type="button"
              onClick={() => onEditarOrden(o)}
              title="Editar fecha de entrega, sala o detalles del pedido"
              aria-label="Editar Pedido"
              style={{
                padding: "5px 9px",
                borderRadius: "7px",
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#334155",
                fontSize: "0.73rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Editar
            </button>
          )}
        </div>
      </div>
    );
  };

  // Agrupar la vista HOY por bloques horarios de elaboración
  const bloquesHoy = useMemo(() => {
    const exequiales: OrdenTrabajoTaller[] = [];
    const franjaA: OrdenTrabajoTaller[] = [];
    const franjaB: OrdenTrabajoTaller[] = [];
    const franjaC: OrdenTrabajoTaller[] = [];
    const anticipadosFuturos: OrdenTrabajoTaller[] = [];

    for (const o of ordenesElaboracionDiaSeleccionado) {
      if ((o.fechaEntrega || "").slice(0, 10) > fechaCursor) {
        anticipadosFuturos.push(o);
        continue;
      }
      if (o.origenTipo === "EXEQUIALES_LLAMADA") {
        exequiales.push(o);
        continue;
      }
      const norm = normalizarFranjaHorariaTienda(o.franjaHoraria);
      if (norm.startsWith("A)")) franjaA.push(o);
      else if (norm.startsWith("B)")) franjaB.push(o);
      else franjaC.push(o);
    }

    return [
      {
        id: "exeq",
        titulo: "🕊️ Exequiales / Hora Específica",
        colorBorde: "#D8B4FE",
        fondo: "#FAF5FF",
        items: exequiales,
      },
      {
        id: "a",
        titulo: "🌅 Rango A) 09:00 - 13:00",
        colorBorde: "#BAE6FD",
        fondo: "#F0F9FF",
        items: franjaA,
      },
      {
        id: "b",
        titulo: "☀️ Rango B) 13:00 - 17:00",
        colorBorde: "#FDE68A",
        fondo: "#FFFBEB",
        items: franjaB,
      },
      {
        id: "c",
        titulo: "🌙 Rango C) 17:00 - 20:00",
        colorBorde: "#C7D2FE",
        fondo: "#EEF2FF",
        items: franjaC,
      },
      {
        id: "fut",
        titulo: "🔨 En Elaboración Hoy (Entrega Mañana / Próximos Días)",
        colorBorde: "#A7F3D0",
        fondo: "#ECFDF5",
        items: anticipadosFuturos,
      },
    ];
  }, [ordenesElaboracionDiaSeleccionado, fechaCursor]);

  const ordenesFechaSeleccionadaMes = ordenesPorFechaEntrega.get(fechaCursor) ?? [];

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Barra superior del Calendario */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Calendar size={18} color="#059669" />
          <strong style={{ fontSize: "0.96rem", color: "#0F172A" }}>
            {vista === "hoy"
              ? `Elaboración y Entregas — ${formatearFechaEntregaHumana(fechaCursor, hoyYmd).etiquetaPrincipal}`
              : vista === "semana"
                ? `Semana: ${formatearFechaEntregaHumana(semanaActual.inicioLunes, hoyYmd).etiquetaPrincipal} → ${formatearFechaEntregaHumana(semanaActual.finDomingo, hoyYmd).etiquetaPrincipal}`
                : `${NOMBRES_MESES[mesCursor - 1]} ${anioCursor}`}
          </strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Navegación temporal */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              onClick={navegarAnterior}
              title="Periodo anterior"
              aria-label="Anterior"
              style={{
                padding: "6px 9px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setFechaCursor(hoyYmd)}
              title="Ir al día de hoy"
              aria-label="Ir a Hoy"
              style={{
                padding: "6px 11px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: fechaCursor === hoyYmd ? "#ECFDF5" : "#FFFFFF",
                color: fechaCursor === hoyYmd ? "#065F46" : "#334155",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={navegarSiguiente}
              title="Periodo siguiente"
              aria-label="Siguiente"
              style={{
                padding: "6px 9px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Selector de Vistas: Hoy / Semana / Mes */}
          <div
            style={{
              display: "inline-flex",
              background: "#F1F5F9",
              padding: "3px",
              borderRadius: "10px",
              gap: "3px",
            }}
          >
            {(
              [
                { id: "hoy", label: "Hoy (Elaboración)" },
                { id: "semana", label: "Semana" },
                { id: "mes", label: "Mes" },
              ] as Array<{ id: VistaCalendarioPedidos; label: string }>
            ).map((v) => {
              const activa = vista === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVista(v.id);
                    if (v.id === "hoy") setFechaCursor(hoyYmd);
                  }}
                  title={`Cambiar a vista ${v.label}`}
                  aria-label={v.label}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: activa ? "#0F172A" : "transparent",
                    color: activa ? "#FFFFFF" : "#475569",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          VISTA 1: HOY — PEDIDOS DE ELABORACIÓN POR BLOQUE HORARIO
      ===================================================================== */}
      {vista === "hoy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {ordenesElaboracionDiaSeleccionado.length === 0 ? (
            <div
              style={{
                padding: "24px",
                borderRadius: "12px",
                background: "#F8FAFC",
                border: "1px dashed #CBD5E1",
                textAlign: "center",
                color: "#64748B",
                fontSize: "0.86rem",
              }}
            >
              No hay pedidos programados en elaboración para esta fecha ({fechaCursor}).
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(265px, 1fr))",
                gap: "12px",
              }}
            >
              {bloquesHoy
                .filter((b) => b.items.length > 0)
                .map((bloque) => (
                  <div
                    key={bloque.id}
                    style={{
                      background: bloque.fondo,
                      border: `1px solid ${bloque.colorBorde}`,
                      borderRadius: "13px",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>
                        {bloque.titulo}
                      </strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "#FFFFFF",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          color: "#0F172A",
                        }}
                      >
                        {bloque.items.length}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {bloque.items.map((o) => renderTarjetaCompacta(o, false))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VISTA 2: SEMANA — 7 DÍAS MARCANDO LA FECHA DE ENTREGA
      ===================================================================== */}
      {vista === "semana" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "10px",
          }}
        >
          {semanaActual.dias.map((ymd, idx) => {
            const delDia = ordenesPorFechaEntrega.get(ymd) ?? [];
            const esHoy = ymd === hoyYmd;
            return (
              <div
                key={ymd}
                style={{
                  background: esHoy ? "#F0FDF4" : "#F8FAFC",
                  border: esHoy ? "2px solid #10B981" : "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minHeight: "175px",
                }}
              >
                <div
                  onClick={() => {
                    setFechaCursor(ymd);
                    setVista("hoy");
                  }}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    paddingBottom: "6px",
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: esHoy ? "#047857" : "#64748B",
                        textTransform: "uppercase",
                      }}
                    >
                      {NOMBRES_DIAS_CORTO[idx]} {esHoy ? "· HOY" : ""}
                    </div>
                    <strong style={{ fontSize: "0.95rem", color: "#0F172A" }}>
                      {ymd.slice(8, 10)}/{ymd.slice(5, 7)}
                    </strong>
                  </div>

                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: delDia.length > 0 ? "#0F172A" : "#E2E8F0",
                      color: delDia.length > 0 ? "#FFFFFF" : "#64748B",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                    }}
                  >
                    {delDia.length}
                  </span>
                </div>

                {delDia.length === 0 ? (
                  <span style={{ fontSize: "0.74rem", color: "#94A3B8" }}>Sin entregas</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {delDia.map((o) => renderTarjetaCompacta(o, false))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          VISTA 3: MES — CUADRÍCULA MENSUAL MARCANDO FECHAS DE ENTREGA
      ===================================================================== */}
      {vista === "mes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "6px",
            }}
          >
            {NOMBRES_DIAS_CORTO.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  fontSize: "0.73rem",
                  fontWeight: 800,
                  color: "#475569",
                  padding: "4px 0",
                }}
              >
                {d}
              </div>
            ))}

            {celdasMes.map((celda) => {
              const delDia = ordenesPorFechaEntrega.get(celda.ymd) ?? [];
              const esHoy = celda.ymd === hoyYmd;
              const seleccionada = celda.ymd === fechaCursor;
              const tieneExequiales = delDia.some((x) => x.origenTipo === "EXEQUIALES_LLAMADA");

              return (
                <button
                  key={celda.ymd}
                  type="button"
                  onClick={() => setFechaCursor(celda.ymd)}
                  title={`${celda.ymd}: ${delDia.length} entrega(s)`}
                  aria-label={`Día ${celda.ymd}`}
                  style={{
                    minHeight: "76px",
                    padding: "6px",
                    borderRadius: "10px",
                    border: seleccionada
                      ? "2px solid #0F172A"
                      : esHoy
                        ? "2px solid #10B981"
                        : delDia.length > 0
                          ? "1px solid #93C5FD"
                          : "1px solid #E2E8F0",
                    background: !celda.enMesActual
                      ? "#F8FAFC"
                      : delDia.length > 0
                        ? tieneExequiales
                          ? "#FAF5FF"
                          : "#F0FDF4"
                        : "#FFFFFF",
                    opacity: celda.enMesActual ? 1 : 0.52,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    justifyContent: "space-between",
                    gap: "4px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "0.78rem",
                        color: esHoy ? "#047857" : "#0F172A",
                      }}
                    >
                      {celda.diaMes}
                    </strong>
                    {delDia.length > 0 && (
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: "999px",
                          background: "#059669",
                          color: "#FFFFFF",
                          fontSize: "0.66rem",
                          fontWeight: 800,
                        }}
                      >
                        {delDia.length}
                      </span>
                    )}
                  </div>

                  {delDia.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      {delDia.slice(0, 2).map((o) => (
                        <span
                          key={o.id}
                          style={{
                            display: "block",
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            padding: "1px 4px",
                            borderRadius: "4px",
                            background:
                              o.origenTipo === "EXEQUIALES_LLAMADA" ? "#EDE9FE" : "#DCFCE7",
                            color:
                              o.origenTipo === "EXEQUIALES_LLAMADA" ? "#5B21B6" : "#166534",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {o.origenTipo === "EXEQUIALES_LLAMADA" ? "🕊️ " : "🌸 "}
                          {o.productoResumen}
                        </span>
                      ))}
                      {delDia.length > 2 && (
                        <span style={{ fontSize: "0.62rem", color: "#475569", fontWeight: 700 }}>
                          +{delDia.length - 2} más
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detalle del día seleccionado en la vista mensual */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
              Entregas marcadas para el {formatearFechaEntregaHumana(fechaCursor, hoyYmd).etiquetaPrincipal} (
              {ordenesFechaSeleccionadaMes.length})
            </strong>
            {ordenesFechaSeleccionadaMes.length === 0 ? (
              <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
                Selecciona cualquier día marcado en el calendario para revisar o gestionar sus pedidos.
              </span>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "10px",
                }}
              >
                {ordenesFechaSeleccionadaMes.map((o) => renderTarjetaCompacta(o, true))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
