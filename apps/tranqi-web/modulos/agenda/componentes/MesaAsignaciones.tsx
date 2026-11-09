"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  History,
  Send,
  UserCheck,
  UserX,
  Video,
} from "lucide-react";
import { reasignarCitaAction } from "../acciones";
import type {
  CitaCalendarioOperador,
  CitaResumen,
  RegistroHistorialAsignacion,
} from "../consultas";

const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const FORMATO_HORA = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
});

const FORMATO_FECHA_LOG = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES_ANIO = [
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

function claveDiaEcuador(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

interface AbogadoOpcion {
  abg_id: string;
  nombre: string;
  correo?: string | null;
}

export default function MesaAsignaciones({
  citas,
  abogados,
  historialGlobal = [],
  alActualizar,
}: {
  citas: Array<CitaCalendarioOperador | CitaResumen>;
  abogados: AbogadoOpcion[];
  historialGlobal?: RegistroHistorialAsignacion[];
  alActualizar?: () => void;
}) {
  const router = useRouter();
  const hoyClave = useMemo(() => claveDiaEcuador(new Date().toISOString()), []);
  const [anioMes, setAnioMes] = useState<{ anio: number; mes: number }>(() => {
    const [y, m] = hoyClave.split("-").map(Number);
    return { anio: y || 2026, mes: (m || 1) - 1 };
  });

  const [vistaActiva, setVistaActiva] = useState<"calendario" | "historial">("calendario");
  const [filtroEstado, setFiltroEstado] = useState<
    "todas" | "sin_abogado" | "con_abogado" | "virtual" | "presencial"
  >("todas");
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [citaLogAbierta, setCitaLogAbierta] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [exitoMsg, setExitoMsg] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const citasNormalizadas = useMemo(() => {
    return citas.map((c) => {
      const ext = c as CitaCalendarioOperador;
      const tieneAbogado =
        typeof ext.tiene_abogado === "boolean"
          ? ext.tiene_abogado
          : Boolean(c.cit_abogado_id && c.cit_asignacion !== "contingencia");
      return {
        ...c,
        cliente_nombre: ext.cliente_nombre ?? c.cliente_nombre ?? "Cliente",
        cliente_correo: ext.cliente_correo ?? c.cliente_correo ?? null,
        abogado_nombre: tieneAbogado
          ? (ext.abogado_nombre ?? c.abogado_nombre ?? "Abogado asignado")
          : null,
        abogado_correo: tieneAbogado ? (ext.abogado_correo ?? c.abogado_correo ?? null) : null,
        materia_nombre: ext.materia_nombre ?? c.materia_nombre ?? "General",
        tiene_abogado: tieneAbogado,
        historial_asignaciones: Array.isArray(ext.historial_asignaciones)
          ? ext.historial_asignaciones
          : [],
        clave_dia: claveDiaEcuador(c.cit_inicio_en),
      };
    });
  }, [citas]);

  const kpis = useMemo(() => {
    const total = citasNormalizadas.length;
    const sinAbogado = citasNormalizadas.filter((c) => !c.tiene_abogado).length;
    const conAbogado = citasNormalizadas.filter((c) => c.tiene_abogado).length;
    const telematicas = citasNormalizadas.filter((c) => c.cit_modalidad !== "presencial").length;
    const presenciales = citasNormalizadas.filter((c) => c.cit_modalidad === "presencial").length;
    const urgentesHoySinAbogado = citasNormalizadas.filter(
      (c) => c.clave_dia === hoyClave && !c.tiene_abogado,
    ).length;
    return {
      total,
      sinAbogado,
      conAbogado,
      telematicas,
      presenciales,
      urgentesHoySinAbogado,
    };
  }, [citasNormalizadas, hoyClave]);

  const mapaCitasPorDia = useMemo(() => {
    const mapa = new Map<string, typeof citasNormalizadas>();
    for (const c of citasNormalizadas) {
      const lista = mapa.get(c.clave_dia) ?? [];
      lista.push(c);
      mapa.set(c.clave_dia, lista);
    }
    return mapa;
  }, [citasNormalizadas]);

  const celdasCalendario = useMemo(() => {
    const primerDia = new Date(Date.UTC(anioMes.anio, anioMes.mes, 1));
    const diaSemana = (primerDia.getUTCDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
    const diasEnMes = new Date(Date.UTC(anioMes.anio, anioMes.mes + 1, 0)).getUTCDate();

    const celdas: Array<{ clave: string | null; numero: number | null }> = [];
    for (let i = 0; i < diaSemana; i++) {
      celdas.push({ clave: null, numero: null });
    }
    for (let d = 1; d <= diasEnMes; d++) {
      const mm = String(anioMes.mes + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      celdas.push({ clave: `${anioMes.anio}-${mm}-${dd}`, numero: d });
    }
    return celdas;
  }, [anioMes]);

  const citasFiltradas = useMemo(() => {
    return citasNormalizadas.filter((c) => {
      if (diaSeleccionado && c.clave_dia !== diaSeleccionado) return false;
      if (filtroEstado === "sin_abogado" && c.tiene_abogado) return false;
      if (filtroEstado === "con_abogado" && !c.tiene_abogado) return false;
      if (filtroEstado === "virtual" && c.cit_modalidad === "presencial") return false;
      if (filtroEstado === "presencial" && c.cit_modalidad !== "presencial") return false;
      return true;
    });
  }, [citasNormalizadas, diaSeleccionado, filtroEstado]);

  function cambiarMes(delta: number) {
    setAnioMes((prev) => {
      const nuevo = new Date(Date.UTC(prev.anio, prev.mes + delta, 1));
      return { anio: nuevo.getUTCFullYear(), mes: nuevo.getUTCMonth() };
    });
  }

  function reasignar(citaId: string, abogadoId: string, motivo: string) {
    if (!abogadoId) {
      setError("Selecciona un abogado para asignar la consulta.");
      return;
    }
    setError(null);
    setExitoMsg(null);
    iniciarEnvio(async () => {
      const r = await reasignarCitaAction({
        cita_id: citaId,
        abogado_destino: abogadoId,
        motivo: motivo || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setExitoMsg(
        `✅ Abogado Dr(a). ${r.data.log.abogado_nuevo_nombre} asignado. Se envió notificación al cliente y al abogado.`,
      );
      alActualizar?.();
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Alerta crítica si hay citas HOY sin abogado */}
      {kpis.urgentesHoySinAbogado > 0 && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "12px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={20} color="#DC2626" />
            <div>
              <strong style={{ fontSize: "0.92rem", display: "block" }}>
                🚨 Atención urgente hoy: {kpis.urgentesHoySinAbogado}{" "}
                {kpis.urgentesHoySinAbogado === 1
                  ? "cita programada para hoy sigue sin abogado asignado"
                  : "citas programadas para hoy siguen sin abogado asignado"}
              </strong>
              <span style={{ fontSize: "0.8rem", color: "#B91C1C" }}>
                Asigna un abogado de inmediato para que el cliente y el profesional reciban su notificación.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setVistaActiva("calendario");
              setDiaSeleccionado(hoyClave);
              setFiltroEstado("sin_abogado");
            }}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              background: "#DC2626",
              color: "#FFFFFF",
              border: "none",
              fontWeight: 800,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Ver urgentes de hoy
          </button>
        </div>
      )}

      {/* KPIs Resumen */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", display: "block" }}>
            CITAS EN AGENDA
          </span>
          <strong style={{ fontSize: "1.45rem", fontWeight: 900, color: "#0F172A" }}>{kpis.total}</strong>
          <span style={{ fontSize: "0.76rem", color: "#475569", display: "block" }}>
            Confirmadas y programadas
          </span>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: kpis.sinAbogado > 0 ? "#FFFBEB" : "#F8FAFC",
            border: `1px solid ${kpis.sinAbogado > 0 ? "#FDE68A" : "#E2E8F0"}`,
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#B45309", display: "block" }}>
            ⚠️ SIN ABOGADO ASIGNADO
          </span>
          <strong style={{ fontSize: "1.45rem", fontWeight: 900, color: "#D97706" }}>
            {kpis.sinAbogado}
          </strong>
          <span style={{ fontSize: "0.76rem", color: "#92400E", display: "block" }}>
            Pendientes de asignación
          </span>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#047857", display: "block" }}>
            ✅ CON ABOGADO ASIGNADO
          </span>
          <strong style={{ fontSize: "1.45rem", fontWeight: 900, color: "#059669" }}>
            {kpis.conAbogado}
          </strong>
          <span style={{ fontSize: "0.76rem", color: "#065F46", display: "block" }}>
            Profesional asignado
          </span>
        </div>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#F5F3FF",
            border: "1px solid #DDD6FE",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#5000BA", display: "block" }}>
            🎥 TELEMÁTICAS vs 🏢 OFICINA
          </span>
          <strong style={{ fontSize: "1.25rem", fontWeight: 900, color: "#5000BA" }}>
            {kpis.telematicas} video · {kpis.presenciales} ofic.
          </strong>
          <span style={{ fontSize: "0.76rem", color: "#6D28D9", display: "block" }}>
            Modalidad de atención
          </span>
        </div>
      </div>

      {/* Selector de pestaña: Calendario & Citas vs Historial de Asignaciones */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          borderBottom: "1px solid #E2E8F0",
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setVistaActiva("calendario")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              borderRadius: "10px",
              border: vistaActiva === "calendario" ? "2px solid #5000BA" : "1px solid #CBD5E1",
              background: vistaActiva === "calendario" ? "#F5F3FF" : "#FFFFFF",
              color: vistaActiva === "calendario" ? "#5000BA" : "#334155",
              fontWeight: 800,
              fontSize: "0.86rem",
              cursor: "pointer",
            }}
          >
            <CalendarIcon size={16} />
            Calendario y Citas ({citasNormalizadas.length})
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva("historial")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 16px",
              borderRadius: "10px",
              border: vistaActiva === "historial" ? "2px solid #5000BA" : "1px solid #CBD5E1",
              background: vistaActiva === "historial" ? "#F5F3FF" : "#FFFFFF",
              color: vistaActiva === "historial" ? "#5000BA" : "#334155",
              fontWeight: 800,
              fontSize: "0.86rem",
              cursor: "pointer",
            }}
          >
            <History size={16} />
            Log de Asignaciones ({historialGlobal.length})
          </button>
        </div>

        {/* Leyenda visual */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", fontSize: "0.78rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#5000BA", fontWeight: 700 }}>
            🎥 Telemática
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#0369A1", fontWeight: 700 }}>
            🏢 Presencial
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#059669", fontWeight: 700 }}>
            ✅ Con Abogado
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#D97706", fontWeight: 700 }}>
            ⚠️ Sin Abogado
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.86rem",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {exitoMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            fontSize: "0.86rem",
            fontWeight: 700,
          }}
        >
          {exitoMsg}
        </div>
      )}

      {vistaActiva === "calendario" ? (
        <>
          {/* Calendario Mensual */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "14px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => cambiarMes(-1)}
                  title="Mes anterior"
                  aria-label="Mes anterior"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <strong style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0F172A", minWidth: "160px", textAlign: "center" }}>
                  {MESES_ANIO[anioMes.mes]} {anioMes.anio}
                </strong>
                <button
                  type="button"
                  onClick={() => cambiarMes(1)}
                  title="Mes siguiente"
                  aria-label="Mes siguiente"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {diaSeleccionado && (
                <button
                  type="button"
                  onClick={() => setDiaSeleccionado(null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F1F5F9",
                    color: "#334155",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mostrando día {diaSeleccionado} · Ver todo el mes ✕
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: "6px",
              }}
            >
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  style={{
                    textAlign: "center",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "#64748B",
                    padding: "4px 0",
                  }}
                >
                  {d}
                </div>
              ))}

              {celdasCalendario.map((celda, idx) => {
                if (!celda.clave || !celda.numero) {
                  return (
                    <div
                      key={`vacio-${idx}`}
                      style={{
                        minHeight: "76px",
                        borderRadius: "8px",
                        background: "#F8FAFC",
                        border: "1px dashed #F1F5F9",
                      }}
                    />
                  );
                }

                const citasDia = mapaCitasPorDia.get(celda.clave) ?? [];
                const esHoy = celda.clave === hoyClave;
                const esSeleccionado = celda.clave === diaSeleccionado;
                const tieneSinAbogado = citasDia.some((c) => !c.tiene_abogado);

                return (
                  <div
                    key={celda.clave}
                    onClick={() =>
                      setDiaSeleccionado((prev) => (prev === celda.clave ? null : celda.clave))
                    }
                    style={{
                      minHeight: "82px",
                      padding: "6px",
                      borderRadius: "10px",
                      border: esSeleccionado
                        ? "2px solid #5000BA"
                        : tieneSinAbogado
                        ? "1.5px solid #F59E0B"
                        : esHoy
                        ? "1.5px solid #0284C7"
                        : "1px solid #E2E8F0",
                      background: esSeleccionado
                        ? "#F5F3FF"
                        : citasDia.length > 0
                        ? "#FFFFFF"
                        : "#FAFAFA",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: esHoy || esSeleccionado ? 900 : 700,
                          color: esHoy ? "#0284C7" : "#1E293B",
                        }}
                      >
                        {celda.numero} {esHoy ? "· Hoy" : ""}
                      </span>
                      {citasDia.length > 0 && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: "999px",
                            background: tieneSinAbogado ? "#FEF3C7" : "#DCFCE7",
                            color: tieneSinAbogado ? "#B45309" : "#15803D",
                          }}
                        >
                          {citasDia.length}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {citasDia.slice(0, 3).map((c) => {
                        const esPres = c.cit_modalidad === "presencial";
                        const hora = FORMATO_HORA.format(new Date(c.cit_inicio_en));
                        return (
                          <div
                            key={c.cit_id}
                            title={`${hora} · ${esPres ? "Presencial" : "Telemática"} · ${c.cliente_nombre} · ${
                              c.tiene_abogado ? `Abg: ${c.abogado_nombre}` : "SIN ABOGADO"
                            }`}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 5px",
                              borderRadius: "5px",
                              background: !c.tiene_abogado
                                ? "#FFFBEB"
                                : esPres
                                ? "#E0F2FE"
                                : "#F3E8FF",
                              borderLeft: `3px solid ${
                                !c.tiene_abogado ? "#F59E0B" : esPres ? "#0284C7" : "#7C3AED"
                              }`,
                              color: "#0F172A",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontWeight: 700,
                            }}
                          >
                            {esPres ? "🏢" : "🎥"} {hora} {c.tiene_abogado ? "✅" : "⚠️"}
                          </div>
                        );
                      })}
                      {citasDia.length > 3 && (
                        <span style={{ fontSize: "0.66rem", color: "#64748B", fontWeight: 700 }}>
                          +{citasDia.length - 3} más…
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barra de Filtros */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {[
              { id: "todas", label: `Todas (${citasNormalizadas.length})` },
              { id: "sin_abogado", label: `⚠️ Sin Abogado (${kpis.sinAbogado})` },
              { id: "con_abogado", label: `✅ Con Abogado (${kpis.conAbogado})` },
              { id: "virtual", label: `🎥 Telemáticas (${kpis.telematicas})` },
              { id: "presencial", label: `🏢 Presenciales (${kpis.presenciales})` },
            ].map((f) => {
              const activo = filtroEstado === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroEstado(f.id as typeof filtroEstado)}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "999px",
                    border: activo ? "1.5px solid #5000BA" : "1px solid #CBD5E1",
                    background: activo ? "#5000BA" : "#FFFFFF",
                    color: activo ? "#FFFFFF" : "#334155",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Lista de Citas */}
          {citasFiltradas.length === 0 ? (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                background: "#F8FAFC",
                borderRadius: "12px",
                border: "1px dashed #CBD5E1",
                color: "#64748B",
                fontSize: "0.9rem",
              }}
            >
              No hay citas para el filtro seleccionado.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {citasFiltradas.map((c) => {
                const inicio = new Date(c.cit_inicio_en);
                const esPresencial = c.cit_modalidad === "presencial";
                const estadoAceptacion = c.gestion_reunion?.estado_aceptacion_abogado ?? "pendiente";
                const logEventos = c.gestion_reunion?.eventos_log ?? [];
                const verLog = citaLogAbierta === c.cit_id;

                return (
                  <div
                    key={c.cit_id}
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "14px",
                      border: !c.tiene_abogado ? "1.5px solid #F59E0B" : "1px solid #E2E8F0",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "1rem", color: "#0F172A", textTransform: "capitalize" }}>
                            {FORMATO_FECHA_LARGA.format(inicio)}
                          </strong>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              background: esPresencial ? "#E0F2FE" : "#F3E8FF",
                              color: esPresencial ? "#0369A1" : "#6D28D9",
                            }}
                          >
                            {esPresencial ? <Building2 size={13} /> : <Video size={13} />}
                            {esPresencial ? "Presencial (Oficina)" : "Telemática (Videollamada)"}
                          </span>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              background: "#F1F5F9",
                              color: "#334155",
                            }}
                          >
                            ⚖️ {c.materia_nombre}
                          </span>
                        </div>

                        <div style={{ fontSize: "0.84rem", color: "#475569", marginTop: "6px" }}>
                          <strong>👤 Cliente:</strong> {c.cliente_nombre}{" "}
                          {c.cliente_correo ? `(${c.cliente_correo})` : ""}
                        </div>
                      </div>

                      {/* Estado de Abogado Asignado */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        {c.tiene_abogado ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "5px 12px",
                              borderRadius: "999px",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              background: "#DCFCE7",
                              color: "#166534",
                            }}
                          >
                            <UserCheck size={14} />
                            Dr(a). {c.abogado_nombre}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "5px 12px",
                              borderRadius: "999px",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              background: "#FEF3C7",
                              color: "#92400E",
                            }}
                          >
                            <UserX size={14} />
                            Sin abogado asignado
                          </span>
                        )}

                        {c.tiene_abogado && (
                          <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: 700 }}>
                            {estadoAceptacion === "aceptada"
                              ? "✅ Confirmada por el abogado"
                              : "⏳ Pendiente confirmación del abogado"}
                          </span>
                        )}
                      </div>
                    </div>

                    {c.cit_motivo && (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: "10px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          fontSize: "0.85rem",
                          color: "#1E293B",
                        }}
                      >
                        <strong>Motivo de consulta:</strong> {c.cit_motivo}
                      </div>
                    )}

                    {/* Formulario de asignación o reasignación de abogado */}
                    <form
                      action={(datos) =>
                        reasignar(
                          c.cit_id,
                          String(datos.get("abogado") ?? ""),
                          String(datos.get("motivo") ?? ""),
                        )
                      }
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                        gap: "10px",
                        alignItems: "end",
                        paddingTop: "6px",
                        borderTop: "1px solid #F1F5F9",
                      }}
                    >
                      <div>
                        <label
                          htmlFor={`abogado-${c.cit_id}`}
                          style={{
                            display: "block",
                            fontSize: "0.76rem",
                            fontWeight: 800,
                            color: "#334155",
                            marginBottom: "4px",
                          }}
                        >
                          {c.tiene_abogado ? "Cambiar / Reasignar abogado" : "Asignar abogado a la cita"}
                        </label>
                        <select
                          id={`abogado-${c.cit_id}`}
                          name="abogado"
                          required
                          defaultValue={c.cit_abogado_id ?? ""}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.85rem",
                            background: "#FFFFFF",
                          }}
                        >
                          <option value="" disabled>
                            Elige un abogado…
                          </option>
                          {abogados.map((a) => (
                            <option key={a.abg_id} value={a.abg_id}>
                              Dr(a). {a.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`motivo-${c.cit_id}`}
                          style={{
                            display: "block",
                            fontSize: "0.76rem",
                            fontWeight: 800,
                            color: "#334155",
                            marginBottom: "4px",
                          }}
                        >
                          Mensaje opcional de asignación (visible para el abogado)
                        </label>
                        <input
                          id={`motivo-${c.cit_id}`}
                          name="motivo"
                          type="text"
                          placeholder="Ej.: Cliente prioritario, revisar documentos previos…"
                          maxLength={300}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.85rem",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="submit"
                          className="btn btn-primario"
                          disabled={enviando}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            padding: "9px 16px",
                            cursor: "pointer",
                            flex: 1,
                          }}
                        >
                          <Send size={14} />
                          {enviando
                            ? "Asignando…"
                            : c.tiene_abogado
                            ? "Reasignar y Notificar"
                            : "Asignar y Notificar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setCitaLogAbierta(verLog ? null : c.cit_id)}
                          title="Ver historial de asignación y gestión de esta cita"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: verLog ? "#F1F5F9" : "#FFFFFF",
                            color: "#334155",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <History size={14} />
                          Log ({logEventos.length})
                        </button>
                      </div>
                    </form>

                    {/* Log individual de la cita */}
                    {verLog && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <strong style={{ fontSize: "0.8rem", color: "#0F172A", display: "block", marginBottom: "8px" }}>
                          📜 Historial de Asignación y Gestión de la Cita
                        </strong>
                        {logEventos.length === 0 ? (
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
                            Aún no hay movimientos registrados en esta cita.
                          </p>
                        ) : (
                          <ul
                            style={{
                              listStyle: "none",
                              margin: 0,
                              padding: 0,
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {logEventos.map((ev) => (
                              <li
                                key={ev.id}
                                style={{
                                  fontSize: "0.8rem",
                                  padding: "8px 10px",
                                  borderRadius: "8px",
                                  background: "#FFFFFF",
                                  border: "1px solid #E2E8F0",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                                  <strong>
                                    [{ev.tipo}] {ev.resumen}
                                  </strong>
                                  <span style={{ color: "#64748B", fontSize: "0.74rem" }}>
                                    {FORMATO_FECHA_LOG.format(new Date(ev.fecha))}
                                  </span>
                                </div>
                                <div style={{ color: "#475569", marginTop: "2px" }}>
                                  Por: {ev.autor_nombre} ({ev.autor_rol})
                                  {ev.mensaje ? ` · 💬 "${ev.mensaje}"` : ""}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Pestaña: Historial Global de Asignaciones (Log) */
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E2E8F0",
            padding: "18px",
          }}
        >
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 800, color: "#0F172A" }}>
              Historial de Asignaciones de Abogados (Log de Auditoría)
            </h3>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748B" }}>
              Trazabilidad cronológica de todas las asignaciones y reasignaciones realizadas por los operadores, incluyendo notificaciones enviadas al cliente y al abogado.
            </p>
          </div>

          {historialGlobal.length === 0 ? (
            <p style={{ margin: 0, padding: "24px 0", textAlign: "center", color: "#64748B", fontSize: "0.88rem" }}>
              Aún no se han registrado asignaciones manuales en la bitácora.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {historialGlobal.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <strong style={{ fontSize: "0.88rem", color: "#0F172A" }}>
                      {item.abogado_anterior_nombre
                        ? `🔄 Reasignación: Dr(a). ${item.abogado_anterior_nombre} → Dr(a). ${item.abogado_nuevo_nombre}`
                        : `✅ Asignación: Dr(a). ${item.abogado_nuevo_nombre}`}
                    </strong>
                    <span style={{ fontSize: "0.76rem", color: "#64748B", fontWeight: 700 }}>
                      <Clock size={12} style={{ display: "inline", marginRight: "4px" }} />
                      {FORMATO_FECHA_LOG.format(new Date(item.fecha_asignacion))}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.82rem", color: "#334155" }}>
                    <strong>Cliente:</strong> {item.cliente_nombre} ·{" "}
                    <strong>Cita:</strong> {FORMATO_FECHA_LOG.format(new Date(item.cita_inicio_en))} (
                    {item.cita_modalidad === "presencial" ? "🏢 Presencial" : "🎥 Telemática"}) ·{" "}
                    <strong>Especialidad:</strong> {item.materia_nombre ?? "General"}
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "#475569" }}>
                    <strong>Operador responsable:</strong> {item.operador_nombre}
                    {item.motivo ? ` · 📌 Mensaje de asignación: "${item.motivo}"` : ""}
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "2px", fontSize: "0.74rem", color: "#059669", fontWeight: 700 }}>
                    <span>
                      <CheckCircle2 size={12} style={{ display: "inline", marginRight: "3px" }} />
                      Cliente notificado
                    </span>
                    <span>
                      <CheckCircle2 size={12} style={{ display: "inline", marginRight: "3px" }} />
                      Abogado notificado
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
