"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salaAbierta } from "@eco/agenda";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FolderOpen,
  History,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  ExternalLink,
  Video,
  XCircle,
} from "lucide-react";
import {
  decidirCitaAction,
  guardarGestionReunionYCitaAction,
  subirArchivoRespaldoCitaAction,
} from "../acciones";
import { ETIQUETA_COBERTURA, ETIQUETA_ESTADO_CITA } from "../esquema";
import type {
  CitaResumen,
  DocumentoAdjuntoCita,
  SiguientePasoCita,
} from "../consultas";

const FORMATO_CITA = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const FORMATO_LOG = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

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

export default function BandejaCitasAbogado({
  citas,
  alActualizar,
  rangoInicial = "semana",
}: {
  citas: CitaResumen[];
  alActualizar?: () => void;
  rangoInicial?: "hoy" | "semana" | "mes" | "todas";
}) {
  const router = useRouter();
  const [rango, setRango] = useState<"hoy" | "semana" | "mes" | "todas">(rangoInicial);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState<string | null>(null);
  const [citaGestionAbierta, setCitaGestionAbierta] = useState<string | null>(null);
  const [citaLogAbierta, setCitaLogAbierta] = useState<string | null>(null);
  const [mensajesAsignacion, setMensajesAsignacion] = useState<Record<string, string>>({});
  const [citasLocal, setCitasLocal] = useState<CitaResumen[]>(citas);
  const [accionEnCurso, setAccionEnCurso] = useState<{ citaId: string; decision: string } | null>(
    null,
  );
  const [enviando, iniciarEnvio] = useTransition();

  useEffect(() => {
    setCitasLocal(citas);
  }, [citas]);

  const hoyClave = useMemo(() => claveDiaEcuador(new Date().toISOString()), []);

  const resumenRangos = useMemo(() => {
    const ahoraMs = Date.now();
    const inicioHoyMs = ahoraMs - 12 * 3600 * 1000;
    const finSemanaMs = ahoraMs + 7 * 24 * 3600 * 1000;
    const finMesMs = ahoraMs + 31 * 24 * 3600 * 1000;

    const hoy = citasLocal.filter((c) => claveDiaEcuador(c.cit_inicio_en) === hoyClave);
    const semana = citasLocal.filter((c) => {
      const t = new Date(c.cit_inicio_en).getTime();
      return t >= inicioHoyMs && t <= finSemanaMs;
    });
    const mes = citasLocal.filter((c) => {
      const t = new Date(c.cit_inicio_en).getTime();
      return t >= inicioHoyMs && t <= finMesMs;
    });
    return { hoy, semana, mes, todas: citasLocal };
  }, [citasLocal, hoyClave]);

  const citasVisibles = useMemo(() => {
    if (rango === "hoy") return resumenRangos.hoy;
    if (rango === "semana") return resumenRangos.semana;
    if (rango === "mes") return resumenRangos.mes;
    return resumenRangos.todas;
  }, [rango, resumenRangos]);

  function decidir(citaId: string, decision: string, nuevoInicio?: string, motivo?: string) {
    setError(null);
    setExito(null);
    setAccionEnCurso({ citaId, decision });
    iniciarEnvio(async () => {
      try {
        const r = await decidirCitaAction({
          cita_id: citaId,
          decision,
          nuevo_inicio: nuevoInicio ?? null,
          motivo: motivo ?? null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setReagendando(null);
        // Actualización optimista inmediata en la tarjeta para evitar espera visual
        setCitasLocal((prev) =>
          prev.map((item) => {
            if (item.cit_id !== citaId) return item;
            const gestionPrevia = item.gestion_reunion ?? {
              cita_id: item.cit_id,
              estado_aceptacion_abogado: "pendiente" as const,
              motivo_aceptacion_abogado: null,
              notas_reunion: null,
              siguientes_pasos: [],
              documentos_adjuntos: [],
              eventos_log: [],
              actualizado_en: null,
            };
            if (decision === "aceptar_asignacion" || decision === "confirmar") {
              return {
                ...item,
                cit_estado: "confirmada",
                cit_asignacion: "operador",
                gestion_reunion: {
                  ...gestionPrevia,
                  estado_aceptacion_abogado: "aceptada",
                  motivo_aceptacion_abogado: motivo?.trim() || null,
                },
              };
            }
            if (decision === "cancelar_aceptacion") {
              return {
                ...item,
                cit_estado: "confirmada",
                cit_asignacion: "operador",
                gestion_reunion: {
                  ...gestionPrevia,
                  estado_aceptacion_abogado: "pendiente",
                  motivo_aceptacion_abogado: motivo?.trim() || null,
                },
              };
            }
            if (decision === "rechazar_asignacion") {
              return {
                ...item,
                cit_asignacion: "contingencia",
                gestion_reunion: {
                  ...gestionPrevia,
                  estado_aceptacion_abogado: "rechazada",
                  motivo_aceptacion_abogado:
                    motivo?.trim() || "El abogado solicitó reasignación de horario",
                },
              };
            }
            if (decision === "marcar_realizada") {
              return {
                ...item,
                cit_estado: "realizada",
              };
            }
            return item;
          }),
        );

        if (decision === "aceptar_asignacion" || decision === "confirmar") {
          setExito("✅ Has confirmado la asignación de la cita. Se notificó al cliente y a operaciones.");
        } else if (decision === "cancelar_aceptacion") {
          setExito("↩️ Has cancelado tu confirmación. La cita vuelve a estar pendiente de tu confirmación.");
        } else if (decision === "rechazar_asignacion") {
          setExito(
            "⚠️ Solicitaste reasignación al operador. La cita permanece visible aquí y puedes retomarla si tu horario se libera.",
          );
        } else if (decision === "marcar_realizada") {
          setExito("✅ Ejecución de la cita confirmada exitosamente.");
        } else {
          setExito("✅ Estado de la cita actualizado.");
        }
        alActualizar?.();
        router.refresh();
      } finally {
        setAccionEnCurso(null);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Resumen y Selector Hoy / Semana / Mes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "10px",
        }}
      >
        {[
          { id: "hoy" as const, titulo: "Agenda Hoy", total: resumenRangos.hoy.length, sub: "Citas del día" },
          {
            id: "semana" as const,
            titulo: "Esta Semana",
            total: resumenRangos.semana.length,
            sub: "Próximos 7 días",
          },
          {
            id: "mes" as const,
            titulo: "Este Mes",
            total: resumenRangos.mes.length,
            sub: "Próximos 30 días",
          },
          {
            id: "todas" as const,
            titulo: "Todas Mis Citas",
            total: resumenRangos.todas.length,
            sub: "Historial y futuras",
          },
        ].map((item) => {
          const activo = rango === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRango(item.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: "12px",
                border: activo ? "2px solid #05876E" : "1px solid #E2E8F0",
                background: activo ? "#ECFDF5" : "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: activo ? "#047857" : "#64748B",
                  textTransform: "uppercase",
                }}
              >
                {item.titulo}
              </span>
              <strong style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0F172A" }}>
                {item.total}
              </strong>
              <span style={{ fontSize: "0.74rem", color: "#475569" }}>{item.sub}</span>
            </button>
          );
        })}
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

      {exito && (
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
          {exito}
        </div>
      )}

      {citasVisibles.length === 0 ? (
        <div
          style={{
            padding: "28px 20px",
            borderRadius: "12px",
            background: "#F8FAFC",
            border: "1px dashed #CBD5E1",
            textAlign: "center",
            color: "#64748B",
            fontSize: "0.9rem",
          }}
        >
          No tienes citas programadas en la vista seleccionada ({rango}).{" "}
          {citas.length > 0 && rango !== "todas" && (
            <button
              type="button"
              onClick={() => setRango("todas")}
              style={{
                background: "none",
                border: "none",
                color: "#05876E",
                fontWeight: 800,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Ver todas tus citas ({citas.length})
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {citasVisibles.map((c) => {
            const inicio = new Date(c.cit_inicio_en);
            const fin = c.cit_fin_en
              ? new Date(c.cit_fin_en)
              : new Date(inicio.getTime() + 45 * 60_000);
            const abierta = salaAbierta(inicio, fin);
            const pasada = fin.getTime() < Date.now();
            const esPresencial = c.cit_modalidad === "presencial";
            const estadoAceptacion =
              c.gestion_reunion?.estado_aceptacion_abogado ?? "pendiente";
            const logEventos = c.gestion_reunion?.eventos_log ?? [];
            const gestionAbierta = citaGestionAbierta === c.cit_id;
            const logAbierto = citaLogAbierta === c.cit_id;
            const msgActual = mensajesAsignacion[c.cit_id] ?? "";

            return (
              <div
                key={c.cit_id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "14px",
                  border:
                    estadoAceptacion === "pendiente"
                      ? "1.5px solid #F59E0B"
                      : "1px solid #E2E8F0",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Cabecera de la cita */}
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "1rem",
                          color: "#0F172A",
                          textTransform: "capitalize",
                        }}
                      >
                        {FORMATO_CITA.format(inicio)}
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
                        ⚖️ {c.materia_nombre ?? "General"} ·{" "}
                        {ETIQUETA_COBERTURA[c.cit_cobertura] ?? c.cit_cobertura}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "#334155", marginTop: "6px" }}>
                      <strong>👤 Cliente:</strong> {c.cliente_nombre ?? "Afiliado"}{" "}
                      {c.cliente_correo ? `(${c.cliente_correo})` : ""}
                    </div>
                  </div>

                  {/* Estado de la cita y de la asignación */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "4px",
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        background:
                          c.cit_estado === "realizada"
                            ? "#DCFCE7"
                            : estadoAceptacion === "aceptada"
                            ? "#DCFCE7"
                            : estadoAceptacion === "rechazada"
                            ? "#FEE2E2"
                            : "#FEF3C7",
                        color:
                          c.cit_estado === "realizada"
                            ? "#166534"
                            : estadoAceptacion === "aceptada"
                            ? "#166534"
                            : estadoAceptacion === "rechazada"
                            ? "#991B1B"
                            : "#92400E",
                      }}
                    >
                      {c.cit_estado === "realizada"
                        ? "✅ Consulta Realizada"
                        : estadoAceptacion === "aceptada"
                        ? "✅ Asignación Confirmada"
                        : estadoAceptacion === "rechazada"
                        ? "⚠️ Reasignación Solicitada"
                        : "⏳ Pendiente tu Confirmación"}
                    </span>
                    {c.caso_vinculado && (
                      <span
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 800,
                          color: "#5000BA",
                          background: "#F5F3FF",
                          padding: "2px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        📁 Caso: {c.caso_vinculado.cas_titulo}
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
                    <strong>Motivo de la consulta:</strong> {c.cit_motivo}
                  </div>
                )}

                {c.cit_modalidad === "virtual" && abierta && c.cit_enlace && (
                  <div>
                    <a
                      className="btn btn-primario"
                      href={c.cit_enlace}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <Video size={15} />
                      Entrar a videollamada
                    </a>
                  </div>
                )}

                {/* Bloque de Confirmar / Cancelar Aceptación / Rechazar Asignación con mensaje opcional */}
                {!pasada && c.cit_estado !== "realizada" && (
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      background:
                        estadoAceptacion === "aceptada"
                          ? "#F8FAFC"
                          : estadoAceptacion === "rechazada"
                          ? "#FEF2F2"
                          : "#FFFBEB",
                      border: `1px solid ${
                        estadoAceptacion === "aceptada"
                          ? "#E2E8F0"
                          : estadoAceptacion === "rechazada"
                          ? "#FECACA"
                          : "#FDE68A"
                      }`,
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
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <strong style={{ fontSize: "0.8rem", color: "#0F172A" }}>
                        {estadoAceptacion === "aceptada"
                          ? "✅ Ya confirmaste esta cita. Puedes cancelar la aceptación (volver a pendiente) o pedir reasignación si surgió un imprevisto:"
                          : estadoAceptacion === "rechazada"
                          ? `⚠️ Solicitaste reasignación al operador${
                              c.gestion_reunion?.motivo_aceptacion_abogado
                                ? ` ("${c.gestion_reunion.motivo_aceptacion_abogado}")`
                                : ""
                            }. Si ya puedes atenderla, puedes retomarla y confirmarla:`
                          : "📩 Confirma esta cita en tu agenda o solicita reasignación al operador:"}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        value={msgActual}
                        onChange={(e) =>
                          setMensajesAsignacion((prev) => ({
                            ...prev,
                            [c.cit_id]: e.target.value,
                          }))
                        }
                        placeholder="Mensaje opcional (ej. Confirmado, revisaré los contratos previos / No puedo por audiencia)"
                        maxLength={300}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.83rem",
                          background: "#FFFFFF",
                        }}
                      />

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {estadoAceptacion !== "aceptada" && (
                          <button
                            type="button"
                            onClick={() =>
                              decidir(c.cit_id, "aceptar_asignacion", undefined, msgActual)
                            }
                            disabled={enviando}
                            title={
                              estadoAceptacion === "rechazada"
                                ? "Retomar y confirmar la asignación de esta cita"
                                : "Confirmar la asignación de esta cita"
                            }
                            aria-label="Confirmar asignación"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: "none",
                              background: "#05876E",
                              color: "#FFFFFF",
                              fontWeight: 800,
                              fontSize: "0.8rem",
                              cursor: enviando ? "wait" : "pointer",
                              opacity: enviando ? 0.75 : 1,
                            }}
                          >
                            <CheckCircle2 size={14} />
                            {accionEnCurso?.citaId === c.cit_id &&
                            accionEnCurso?.decision === "aceptar_asignacion"
                              ? "Confirmando…"
                              : estadoAceptacion === "rechazada"
                              ? "Retomar y Confirmar"
                              : "Confirmar Cita"}
                          </button>
                        )}

                        {estadoAceptacion === "aceptada" && (
                          <button
                            type="button"
                            onClick={() =>
                              decidir(c.cit_id, "cancelar_aceptacion", undefined, msgActual)
                            }
                            disabled={enviando}
                            title="Cancelar la confirmación para que la cita vuelva a estado pendiente sin desasignarla"
                            aria-label="Cancelar aceptación"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid #F59E0B",
                              background: "#FFFBEB",
                              color: "#92400E",
                              fontWeight: 800,
                              fontSize: "0.78rem",
                              cursor: enviando ? "wait" : "pointer",
                              opacity: enviando ? 0.75 : 1,
                            }}
                          >
                            <RotateCcw size={14} />
                            {accionEnCurso?.citaId === c.cit_id &&
                            accionEnCurso?.decision === "cancelar_aceptacion"
                              ? "Cancelando…"
                              : "Cancelar Aceptación"}
                          </button>
                        )}

                        {estadoAceptacion !== "rechazada" && (
                          <button
                            type="button"
                            onClick={() =>
                              decidir(
                                c.cit_id,
                                "rechazar_asignacion",
                                undefined,
                                msgActual || "El abogado requiere reasignación de horario",
                              )
                            }
                            disabled={enviando}
                            title="Notificar a operaciones que no puedes asistir para que reasignen a otro abogado"
                            aria-label="Pedir reasignación"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid #FCA5A5",
                              background: "#FEF2F2",
                              color: "#991B1B",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                              cursor: enviando ? "wait" : "pointer",
                              opacity: enviando ? 0.75 : 1,
                            }}
                          >
                            <XCircle size={14} />
                            {accionEnCurso?.citaId === c.cit_id &&
                            accionEnCurso?.decision === "rechazar_asignacion"
                              ? "Procesando…"
                              : "Pedir Reasignación"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setReagendando(reagendando === c.cit_id ? null : c.cit_id)
                          }
                          title="Proponer nueva fecha y hora para la consulta"
                          aria-label="Reagendar cita"
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: "#334155",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            cursor: "pointer",
                          }}
                        >
                          Reagendar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botonera de Gestión de la Reunión, Expediente/Caso y Log */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                    paddingTop: "4px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setCitaGestionAbierta(gestionAbierta ? null : c.cit_id)
                      }
                      title="Gestionar cita, adjuntar notas y archivos de respaldo"
                      aria-label="Gestionar cita, adjuntar notas y archivos de respaldo"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: "1.5px solid #5000BA",
                        background: gestionAbierta ? "#5000BA" : "#F5F3FF",
                        color: gestionAbierta ? "#FFFFFF" : "#5000BA",
                        fontWeight: 800,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      <FolderOpen size={14} />
                      {gestionAbierta ? "Cerrar Gestión" : "Gestionar Cita"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCitaLogAbierta(logAbierto ? null : c.cit_id)}
                      title="Ver el detalle completo e historial de la cita"
                      aria-label="Ver el detalle completo e historial de la cita"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: logAbierto ? "#F1F5F9" : "#FFFFFF",
                        color: "#334155",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      <History size={14} />
                      Detalle e Historial ({logEventos.length})
                    </button>
                  </div>

                  {c.cit_estado !== "realizada" && (
                    <button
                      type="button"
                      onClick={() => decidir(c.cit_id, "marcar_realizada")}
                      disabled={enviando}
                      title="Confirmar la ejecución de esta cita"
                      aria-label="Confirmar la ejecución de esta cita"
                      style={{
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: "1px solid #A7F3D0",
                        background: "#ECFDF5",
                        color: "#065F46",
                        fontWeight: 800,
                        fontSize: "0.78rem",
                        cursor: enviando ? "wait" : "pointer",
                        opacity: enviando ? 0.75 : 1,
                      }}
                    >
                      {accionEnCurso?.citaId === c.cit_id &&
                      accionEnCurso?.decision === "marcar_realizada"
                        ? "Confirmando…"
                        : "✓ Confirmar Ejecución"}
                    </button>
                  )}
                </div>

                {/* Formulario para reagendar */}
                {reagendando === c.cit_id && (
                  <form
                    className="agenda-reagendar"
                    action={(datos) => {
                      const valor = String(datos.get("nuevo") ?? "");
                      if (!valor) return;
                      decidir(
                        c.cit_id,
                        "reagendar",
                        new Date(valor).toISOString(),
                        String(datos.get("motivo") ?? ""),
                      );
                    }}
                  >
                    <label className="etiqueta-campo" htmlFor={`nuevo-${c.cit_id}`}>
                      Nueva fecha y hora
                    </label>
                    <input
                      id={`nuevo-${c.cit_id}`}
                      name="nuevo"
                      type="datetime-local"
                      required
                    />
                    <input
                      name="motivo"
                      type="text"
                      placeholder="Motivo del cambio de hora (opcional)"
                      maxLength={200}
                    />
                    <div className="fila-botones">
                      <button
                        type="submit"
                        className="btn btn-primario"
                        disabled={enviando}
                      >
                        Mover cita
                      </button>
                      <button
                        type="button"
                        className="btn btn-blanco-borde"
                        onClick={() => setReagendando(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {/* Panel desplegable: Gestión de la Reunión + Expediente del Cliente (Consulta vs Caso) */}
                {gestionAbierta && (
                  <PanelGestionReunionYExpediente
                    cita={c}
                    alGuardar={() => {
                      setExito(
                        "✅ Gestión de la reunión, documentos y expediente del cliente actualizados.",
                      );
                      alActualizar?.();
                      router.refresh();
                    }}
                  />
                )}

                {/* Panel desplegable: Detalle e Historial de la Cita */}
                {logAbierto && (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        fontSize: "0.8rem",
                        color: "#334155",
                      }}
                    >
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                          Cliente y Contacto
                        </span>
                        <strong>{c.cliente_nombre ?? "Cliente"}</strong>
                        {c.cliente_correo && (
                          <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                            {c.cliente_correo}
                          </div>
                        )}
                      </div>
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                          Especialidad y Cobertura
                        </span>
                        <strong>{c.materia_nombre ?? "General"}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                          {ETIQUETA_COBERTURA[c.cit_cobertura] ?? c.cit_cobertura}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                          Estado de Ejecución
                        </span>
                        <strong>
                          {c.cit_estado === "realizada"
                            ? "✅ Ejecutada / Realizada"
                            : ETIQUETA_ESTADO_CITA[c.cit_estado] ?? c.cit_estado}
                        </strong>
                        <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                          Respaldos: {(c.gestion_reunion?.documentos_adjuntos ?? []).length}{" "}
                          archivo(s)
                        </div>
                      </div>
                      {c.gestion_reunion?.notas_reunion && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>
                            Notas Registradas de la Cita
                          </span>
                          <div style={{ color: "#0F172A", marginTop: "2px" }}>
                            {c.gestion_reunion.notas_reunion}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <strong
                        style={{
                          fontSize: "0.82rem",
                          color: "#0F172A",
                          display: "block",
                          marginBottom: "8px",
                        }}
                      >
                        📜 Historial Cronológico de la Cita (Reserva, Asignación y Ejecución)
                      </strong>
                      {logEventos.length === 0 ? (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
                          Sin eventos adicionales registrados aún.
                        </p>
                      ) : (
                        <ul
                          style={{
                            listStyle: "none",
                            margin: 0,
                            padding: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {logEventos.map((ev) => (
                            <li
                              key={ev.id}
                              style={{
                                padding: "8px 10px",
                                borderRadius: "8px",
                                background: "#FFFFFF",
                                border: "1px solid #E2E8F0",
                                fontSize: "0.8rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                }}
                              >
                                <strong>
                                  [{ev.tipo}] {ev.resumen}
                                </strong>
                                <span style={{ color: "#64748B", fontSize: "0.74rem" }}>
                                  {FORMATO_LOG.format(new Date(ev.fecha))}
                                </span>
                              </div>
                              <div style={{ color: "#475569", marginTop: "2px" }}>
                                Responsable: {ev.autor_nombre} ({ev.autor_rol})
                                {ev.mensaje ? ` · 💬 "${ev.mensaje}"` : ""}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PanelGestionReunionYExpediente({
  cita,
  alGuardar,
}: {
  cita: CitaResumen;
  alGuardar: () => void;
}) {
  const [notas, setNotas] = useState(cita.gestion_reunion?.notas_reunion ?? "");
  const [pasos, setPasos] = useState<SiguientePasoCita[]>(
    cita.gestion_reunion?.siguientes_pasos ?? [],
  );
  const [nuevoPasoDesc, setNuevoPasoDesc] = useState("");
  const [nuevoPasoResp, setNuevoPasoResp] = useState(
    cita.abogado_nombre ?? "Abogado asignado",
  );
  const [nuevoPasoRol, setNuevoPasoRol] = useState<"ABOGADO" | "CLIENTE" | "OPERADOR">(
    "ABOGADO",
  );

  const [documentos, setDocumentos] = useState<DocumentoAdjuntoCita[]>(
    cita.gestion_reunion?.documentos_adjuntos ?? [],
  );
  const [nuevoDocNombre, setNuevoDocNombre] = useState("");
  const [nuevoDocTipo, setNuevoDocTipo] = useState<DocumentoAdjuntoCita["tipo"]>("prueba");
  const [nuevoDocRef, setNuevoDocRef] = useState("");
  const [nuevoDocNotaArchivo, setNuevoDocNotaArchivo] = useState("");
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const casosDelCliente = cita.casos_cliente ?? [];
  const [accionCaso, setAccionCaso] = useState<
    "ninguna" | "vincular_existente" | "crear_nuevo"
  >(cita.cit_caso_id ? "vincular_existente" : "ninguna");
  const [casoExistenteId, setCasoExistenteId] = useState<string>(
    cita.cit_caso_id ?? casosDelCliente[0]?.cas_id ?? "",
  );
  const [nuevoCasoTitulo, setNuevoCasoTitulo] = useState("");
  const [nuevoCasoProceso, setNuevoCasoProceso] = useState("");
  const [nuevoCasoPrioridad, setNuevoCasoPrioridad] = useState<
    "normal" | "alta" | "urgente"
  >("normal");
  const [nuevoCasoDesc, setNuevoCasoDesc] = useState("");

  // Nuevo hito/gestión/mensaje en la línea de tiempo del caso
  const [tipoHito, setTipoHito] = useState<"GESTION" | "MENSAJE" | "DOCUMENTO" | "HITO">(
    "GESTION",
  );
  const [tituloHito, setTituloHito] = useState("");
  const [detalleHito, setDetalleHito] = useState("");
  const [responsableHito, setResponsableHito] = useState(
    cita.abogado_nombre ?? "Abogado asignado",
  );

  const [marcarRealizada, setMarcarRealizada] = useState(cita.cit_estado === "realizada");
  const [errLocal, setErrLocal] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  const casoSeleccionado =
    casosDelCliente.find((x) => x.cas_id === casoExistenteId) ??
    cita.caso_vinculado ??
    null;

  function agregarPaso() {
    if (!nuevoPasoDesc.trim()) return;
    setPasos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        descripcion: nuevoPasoDesc.trim(),
        responsable_nombre: nuevoPasoResp.trim() || "Responsable",
        responsable_rol: nuevoPasoRol,
        completado: false,
      },
    ]);
    setNuevoPasoDesc("");
  }

  function agregarDocumento() {
    if (!nuevoDocNombre.trim()) return;
    setDocumentos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nombre: nuevoDocNombre.trim(),
        tipo: nuevoDocTipo,
        url_o_referencia: nuevoDocRef.trim() || null,
        notas: nuevoDocNotaArchivo.trim() || null,
        fecha: new Date().toISOString(),
      },
    ]);
    setNuevoDocNombre("");
    setNuevoDocRef("");
    setNuevoDocNotaArchivo("");
  }

  async function manejarSubidaArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrLocal(null);
    setSubiendoArchivo(true);
    try {
      const nuevosSubidos: DocumentoAdjuntoCita[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("cita_id", cita.cit_id);
        fd.append("archivo", file);
        fd.append("tipo", nuevoDocTipo);
        if (nuevoDocNotaArchivo.trim()) {
          fd.append("notas", nuevoDocNotaArchivo.trim());
        }
        const res = await subirArchivoRespaldoCitaAction(fd);
        if (!res.ok) {
          setErrLocal(res.error);
        } else {
          nuevosSubidos.push(res.data.documento);
        }
      }
      if (nuevosSubidos.length > 0) {
        setDocumentos((prev) => [...nuevosSubidos, ...prev]);
        setNuevoDocNotaArchivo("");
      }
    } catch {
      setErrLocal("No se pudo subir el archivo de respaldo.");
    } finally {
      setSubiendoArchivo(false);
      e.target.value = "";
    }
  }

  function guardarTodo() {
    setErrLocal(null);
    iniciarGuardado(async () => {
      const res = await guardarGestionReunionYCitaAction({
        cita_id: cita.cit_id,
        notas_reunion: notas,
        siguientes_pasos: pasos,
        documentos_adjuntos: documentos,
        marcar_realizada: marcarRealizada,
        accion_caso: accionCaso,
        caso_id_existente:
          accionCaso === "vincular_existente" ? casoExistenteId || null : null,
        nuevo_caso_titulo:
          accionCaso === "crear_nuevo" ? nuevoCasoTitulo || null : null,
        nuevo_caso_descripcion:
          accionCaso === "crear_nuevo" ? nuevoCasoDesc || null : null,
        nuevo_caso_prioridad: nuevoCasoPrioridad,
        nuevo_caso_numero_proceso:
          accionCaso === "crear_nuevo" ? nuevoCasoProceso || null : null,
        nuevo_evento_timeline: tituloHito.trim()
          ? {
              tipo: tipoHito,
              titulo: tituloHito.trim(),
              detalle: detalleHito.trim() || null,
              responsable_nombre: responsableHito.trim() || "Abogado",
              responsable_rol: "ABOGADO",
            }
          : null,
      });

      if (!res.ok) {
        setErrLocal(res.error);
        return;
      }
      setTituloHito("");
      setDetalleHito("");
      alGuardar();
    });
  }

  return (
    <div
      style={{
        marginTop: "6px",
        padding: "16px",
        borderRadius: "12px",
        background: "#F8FAFC",
        border: "1.5px solid #DDD6FE",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Guía de arquitectura LegalTech: Expediente del Cliente -> Consultas vs Casos */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "10px",
          background: "#F5F3FF",
          border: "1px solid #DDD6FE",
          fontSize: "0.8rem",
          color: "#4C1D95",
        }}
      >
        <strong>🏛️ Modelo de Expediente del Cliente (Estándar LegalTech):</strong> Esta{" "}
        <strong>Consulta Jurídica</strong> forma parte del expediente de{" "}
        <strong>{cita.cliente_nombre}</strong>. Puede quedar como orientación independiente o
        vincularse a un <strong>Caso / Proceso Judicial</strong> (que agrupa múltiples consultas
        con o sin costo, N documentos y la línea de tiempo con responsables).
      </div>

      {errLocal && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.82rem",
            fontWeight: 700,
          }}
        >
          {errLocal}
        </div>
      )}

      {/* 1. Notas de la Reunión */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: "0.82rem",
            fontWeight: 800,
            color: "#0F172A",
            marginBottom: "6px",
          }}
        >
          📝 1. Notas de la Reunión y Diagnóstico Jurídico
        </label>
        <textarea
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Registra el resumen de la consulta, hechos relevantes expuestos por el cliente y criterio legal…"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #CBD5E1",
            fontSize: "0.85rem",
            background: "#FFFFFF",
          }}
        />
      </div>

      {/* 2. Siguientes Pasos (con responsable) */}
      <div>
        <strong
          style={{
            display: "block",
            fontSize: "0.82rem",
            fontWeight: 800,
            color: "#0F172A",
            marginBottom: "6px",
          }}
        >
          📌 2. Siguientes Pasos y Compromisos (con Responsable)
        </strong>

        {pasos.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: "0 0 8px 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {pasos.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "8px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  fontSize: "0.82rem",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={p.completado}
                    onChange={(e) =>
                      setPasos((prev) =>
                        prev.map((x) =>
                          x.id === p.id ? { ...x, completado: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <span style={{ textDecoration: p.completado ? "line-through" : "none" }}>
                    <strong>{p.descripcion}</strong> · Responsable: {p.responsable_nombre} (
                    {p.responsable_rol})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setPasos((prev) => prev.filter((x) => x.id !== p.id))}
                  title="Eliminar paso"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#DC2626",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr auto",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={nuevoPasoDesc}
            onChange={(e) => setNuevoPasoDesc(e.target.value)}
            placeholder="Ej.: Redactar minuta de divorcio / Enviar certificados…"
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
            }}
          />
          <input
            type="text"
            value={nuevoPasoResp}
            onChange={(e) => setNuevoPasoResp(e.target.value)}
            placeholder="Responsable"
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
            }}
          />
          <select
            value={nuevoPasoRol}
            onChange={(e) =>
              setNuevoPasoRol(e.target.value as "ABOGADO" | "CLIENTE" | "OPERADOR")
            }
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
            }}
          >
            <option value="ABOGADO">Abogado</option>
            <option value="CLIENTE">Cliente</option>
            <option value="OPERADOR">Operador</option>
          </select>
          <button
            type="button"
            onClick={agregarPaso}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              fontWeight: 800,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
      </div>

      {/* 3. Archivos de Respaldo y Documentos Adjuntos */}
      <div>
        <strong
          style={{
            display: "block",
            fontSize: "0.82rem",
            fontWeight: 800,
            color: "#0F172A",
            marginBottom: "6px",
          }}
        >
          📎 3. Archivos de Respaldo y Documentos Adjuntos ({documentos.length})
        </strong>

        {documentos.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: "0 0 10px 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {documentos.map((doc) => (
              <li
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span>
                    <FileText size={13} style={{ display: "inline", marginRight: "5px" }} />
                    <strong>{doc.nombre}</strong>{" "}
                    <span
                      style={{
                        fontSize: "0.72rem",
                        padding: "1px 6px",
                        borderRadius: "6px",
                        background: "#F1F5F9",
                        color: "#475569",
                        fontWeight: 700,
                      }}
                    >
                      {doc.tipo}
                    </span>
                  </span>
                  {doc.notas && (
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      Nota: {doc.notas}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {doc.url_o_referencia && (
                    <a
                      href={doc.url_o_referencia}
                      target="_blank"
                      rel="noreferrer"
                      download={doc.url_o_referencia.startsWith("data:") ? doc.nombre : undefined}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "#F5F3FF",
                        border: "1px solid #DDD6FE",
                        color: "#5000BA",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={12} />
                      Ver Respaldo
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDocumentos((prev) => prev.filter((x) => x.id !== doc.id))
                    }
                    title="Eliminar archivo de respaldo"
                    aria-label="Eliminar archivo de respaldo"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#DC2626",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Subida directa de archivos desde el dispositivo */}
        <div
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "#FFFFFF",
            border: "1px dashed #94A3B8",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <select
              value={nuevoDocTipo}
              onChange={(e) =>
                setNuevoDocTipo(e.target.value as DocumentoAdjuntoCita["tipo"])
              }
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.82rem",
                background: "#FFFFFF",
              }}
            >
              <option value="prueba">Prueba / Respaldo de consulta</option>
              <option value="contrato">Contrato</option>
              <option value="minuta">Minuta / Acta</option>
              <option value="notificacion">Citación / Notificación</option>
              <option value="escrito">Escrito judicial</option>
              <option value="cedula">Cédula / RUC</option>
              <option value="otro">Otro documento</option>
            </select>

            <input
              type="text"
              value={nuevoDocNotaArchivo}
              onChange={(e) => setNuevoDocNotaArchivo(e.target.value)}
              placeholder="Descripción o nota del archivo (opcional)…"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.82rem",
                background: "#FFFFFF",
              }}
            />

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: subiendoArchivo ? "#94A3B8" : "#5000BA",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "0.8rem",
                cursor: subiendoArchivo ? "wait" : "pointer",
              }}
            >
              <Upload size={14} />
              {subiendoArchivo ? "Subiendo archivo…" : "Subir Archivo de Respaldo"}
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.zip"
                onChange={manejarSubidaArchivos}
                disabled={subiendoArchivo}
                style={{ display: "none" }}
              />
            </label>
          </div>
          <span style={{ fontSize: "0.74rem", color: "#64748B" }}>
            Formatos soportados: PDF, Word (.doc/.docx), Imágenes (JPG/PNG/WebP), TXT o ZIP (máx. 20 MB).
          </span>
        </div>

        {/* Opción alternativa por referencia manual */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1.5fr auto",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={nuevoDocNombre}
            onChange={(e) => setNuevoDocNombre(e.target.value)}
            placeholder="O registrar referencia manual (ej. Contrato firmado.pdf)"
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
            }}
          />
          <input
            type="text"
            value={nuevoDocRef}
            onChange={(e) => setNuevoDocRef(e.target.value)}
            placeholder="URL o referencia externa (opcional)"
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
            }}
          />
          <button
            type="button"
            onClick={agregarDocumento}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              fontWeight: 800,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Añadir Ref.
          </button>
        </div>
      </div>

      {/* 4. Expediente del Cliente: Caso Judicial y Línea de Tiempo */}
      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <strong style={{ fontSize: "0.84rem", color: "#0F172A" }}>
          📁 4. Expediente del Cliente: Relación entre esta Consulta y un Caso Legal
        </strong>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setAccionCaso("ninguna")}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border:
                accionCaso === "ninguna" ? "1.5px solid #5000BA" : "1px solid #CBD5E1",
              background: accionCaso === "ninguna" ? "#F5F3FF" : "#FFFFFF",
              color: accionCaso === "ninguna" ? "#5000BA" : "#334155",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Solo Consulta Independiente
          </button>

          {casosDelCliente.length > 0 && (
            <button
              type="button"
              onClick={() => setAccionCaso("vincular_existente")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border:
                  accionCaso === "vincular_existente"
                    ? "1.5px solid #5000BA"
                    : "1px solid #CBD5E1",
                background:
                  accionCaso === "vincular_existente" ? "#F5F3FF" : "#FFFFFF",
                color: accionCaso === "vincular_existente" ? "#5000BA" : "#334155",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Vincular a Caso Existente ({casosDelCliente.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => setAccionCaso("crear_nuevo")}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border:
                accionCaso === "crear_nuevo"
                  ? "1.5px solid #05876E"
                  : "1px solid #CBD5E1",
              background: accionCaso === "crear_nuevo" ? "#ECFDF5" : "#FFFFFF",
              color: accionCaso === "crear_nuevo" ? "#047857" : "#334155",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Abrir Nuevo Caso desde esta Consulta
          </button>
        </div>

        {accionCaso === "vincular_existente" && casosDelCliente.length > 0 && (
          <div>
            <select
              value={casoExistenteId}
              onChange={(e) => setCasoExistenteId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.84rem",
              }}
            >
              {casosDelCliente.map((cas) => (
                <option key={cas.cas_id} value={cas.cas_id}>
                  📁 {cas.cas_titulo} · Estado: {cas.cas_estado} ·{" "}
                  {cas.total_consultas} consulta(s) · {cas.total_documentos} doc(s)
                </option>
              ))}
            </select>
          </div>
        )}

        {accionCaso === "crear_nuevo" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={nuevoCasoTitulo}
              onChange={(e) => setNuevoCasoTitulo(e.target.value)}
              placeholder="Título del Caso (ej. Divorcio y Liquidación Sociedad Conyugal)"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.82rem",
              }}
            />
            <input
              type="text"
              value={nuevoCasoProceso}
              onChange={(e) => setNuevoCasoProceso(e.target.value)}
              placeholder="N° Proceso / Judicatura (opcional)"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.82rem",
              }}
            />
            <select
              value={nuevoCasoPrioridad}
              onChange={(e) =>
                setNuevoCasoPrioridad(e.target.value as "normal" | "alta" | "urgente")
              }
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.82rem",
              }}
            >
              <option value="normal">Prioridad Normal</option>
              <option value="alta">Prioridad Alta</option>
              <option value="urgente">Prioridad Urgente</option>
            </select>
            <input
              type="text"
              value={nuevoCasoDesc}
              onChange={(e) => setNuevoCasoDesc(e.target.value)}
              placeholder="Objetivo / resumen del expediente…"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.82rem",
              }}
            />
          </div>
        )}

        {/* Línea de Tiempo del Caso (si hay un caso seleccionado o vinculado) */}
        {(accionCaso === "vincular_existente" || accionCaso === "crear_nuevo") && (
          <div
            style={{
              marginTop: "6px",
              padding: "10px",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <strong style={{ fontSize: "0.8rem", color: "#0F172A" }}>
              ⏱️ Agregar actuación / mensaje a la Línea de Tiempo del Caso
            </strong>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr 1fr",
                gap: "8px",
              }}
            >
              <select
                value={tipoHito}
                onChange={(e) =>
                  setTipoHito(
                    e.target.value as "GESTION" | "MENSAJE" | "DOCUMENTO" | "HITO",
                  )
                }
                style={{
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.8rem",
                  background: "#FFFFFF",
                }}
              >
                <option value="GESTION">⚙️ Gestión procesal</option>
                <option value="MENSAJE">💬 Mensaje / Nota</option>
                <option value="HITO">🏁 Hito del proceso</option>
                <option value="DOCUMENTO">📄 Revisión documental</option>
              </select>
              <input
                type="text"
                value={tituloHito}
                onChange={(e) => setTituloHito(e.target.value)}
                placeholder="Título de la gestión o mensaje en la línea de tiempo…"
                style={{
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.8rem",
                  background: "#FFFFFF",
                }}
              />
              <input
                type="text"
                value={responsableHito}
                onChange={(e) => setResponsableHito(e.target.value)}
                placeholder="Responsable"
                style={{
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.8rem",
                  background: "#FFFFFF",
                }}
              />
            </div>
            <input
              type="text"
              value={detalleHito}
              onChange={(e) => setDetalleHito(e.target.value)}
              placeholder="Detalle adicional de trazabilidad (opcional)…"
              style={{
                padding: "7px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.8rem",
                background: "#FFFFFF",
              }}
            />

            {casoSeleccionado && casoSeleccionado.linea_tiempo.length > 0 && (
              <div style={{ marginTop: "6px" }}>
                <strong
                  style={{
                    fontSize: "0.78rem",
                    color: "#334155",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Línea de tiempo actual del caso &ldquo;{casoSeleccionado.cas_titulo}&rdquo; (
                  {casoSeleccionado.linea_tiempo.length} eventos):
                </strong>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  {casoSeleccionado.linea_tiempo.slice(0, 8).map((ev) => (
                    <li
                      key={ev.id}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "#FFFFFF",
                        borderLeft: "3px solid #5000BA",
                        fontSize: "0.78rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong>
                          [{ev.tipo}] {ev.titulo}
                        </strong>
                        <span style={{ color: "#64748B", fontSize: "0.72rem" }}>
                          {FORMATO_LOG.format(new Date(ev.fecha))}
                        </span>
                      </div>
                      {ev.detalle && (
                        <div style={{ color: "#475569", marginTop: "2px" }}>
                          {ev.detalle}
                        </div>
                      )}
                      <div style={{ color: "#64748B", fontSize: "0.72rem", marginTop: "2px" }}>
                        Responsable: {ev.responsable_nombre} ({ev.responsable_rol})
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pie de guardado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#334155",
          }}
        >
          <input
            type="checkbox"
            checked={marcarRealizada}
            onChange={(e) => setMarcarRealizada(e.target.checked)}
          />
          Marcar consulta como realizada al guardar
        </label>

        <button
          type="button"
          onClick={guardarTodo}
          disabled={guardando}
          className="btn btn-primario"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          }}
        >
          <Save size={15} />
          {guardando ? "Guardando…" : "Guardar gestión"}
        </button>
      </div>
    </div>
  );
}
