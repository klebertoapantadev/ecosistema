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
  Download,
  FileText,
  FolderOpen,
  GitCommit,
  History,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  ExternalLink,
  Link2,
  Lock,
  RefreshCw,
  Sparkles,
  Video,
  XCircle,
} from "lucide-react";
import {
  actualizarContactoClienteCitaAction,
  actualizarEnlaceCitaTelematicaAction,
  decidirCitaAction,
  generarSalaDailyCitaAction,
  guardarGestionReunionYCitaAction,
  subirArchivoRespaldoCitaAction,
} from "../acciones";
import {
  construirEnlacesCalendarioCita,
  construirUrlWhatsappCliente,
} from "../calendario-ics";
import { ETIQUETA_COBERTURA, ETIQUETA_ESTADO_CITA } from "../esquema";
import LineaTiempoTrackingCita from "./LineaTiempoTrackingCita";
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
  const [fechasReagendar, setFechasReagendar] = useState<Record<string, string>>({});
  const [motivosReagendar, setMotivosReagendar] = useState<Record<string, string>>({});
  const [editandoWhatsappCita, setEditandoWhatsappCita] = useState<string | null>(null);
  const [nuevoWhatsappCliente, setNuevoWhatsappCliente] = useState<string>("");
  const [enlacesTelematicos, setEnlacesTelematicos] = useState<Record<string, string>>({});
  const [notasEnlaceTelematico, setNotasEnlaceTelematico] = useState<Record<string, string>>({});
  const [editandoEnlaceCita, setEditandoEnlaceCita] = useState<string | null>(null);
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
    const base =
      rango === "hoy"
        ? resumenRangos.hoy
        : rango === "semana"
        ? resumenRangos.semana
        : rango === "mes"
        ? resumenRangos.mes
        : resumenRangos.todas;

    // Mostrar las citas activas primero y las ya atendidas ("realizada") al final para diferenciarlas fácilmente
    return [...base].sort((a, b) => {
      const aRealizada = a.cit_estado === "realizada" ? 1 : 0;
      const bRealizada = b.cit_estado === "realizada" ? 1 : 0;
      if (aRealizada !== bRealizada) return aRealizada - bRealizada;
      return new Date(a.cit_inicio_en).getTime() - new Date(b.cit_inicio_en).getTime();
    });
  }, [rango, resumenRangos]);

  function guardarEnlaceTelematico(citaId: string) {
    const enlaceInput = (enlacesTelematicos[citaId] ?? "").trim();
    const notaInput = (notasEnlaceTelematico[citaId] ?? "").trim();
    if (!enlaceInput) {
      setError("Ingresa el link para la consulta telemática (ej. Google Meet, Zoom o Teams).");
      return;
    }
    setError(null);
    setExito(null);
    setAccionEnCurso({ citaId, decision: "actualizar_enlace" });
    iniciarEnvio(async () => {
      try {
        const r = await actualizarEnlaceCitaTelematicaAction({
          cita_id: citaId,
          enlace: enlaceInput,
          nota: notaInput || null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        const ahoraIso = new Date().toISOString();
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
              actualizado_en: ahoraIso,
            };
            const nuevoEv = {
              id: `link-${Date.now()}`,
              fecha: ahoraIso,
              tipo: "GESTION_REUNION" as const,
              autor_nombre: item.abogado_nombre ?? "Abogado",
              autor_rol: "ABOGADO" as const,
              resumen: r.data.esModificacion
                ? "Enlace de consulta telemática actualizado"
                : "Enlace de consulta telemática registrado",
              mensaje: `Link de videollamada: ${r.data.enlace}`,
            };
            return {
              ...item,
              cit_enlace: r.data.enlace,
              gestion_reunion: {
                ...gestionPrevia,
                eventos_log: [nuevoEv, ...(gestionPrevia.eventos_log ?? [])],
                sequence_calendario: (gestionPrevia.sequence_calendario ?? 0) + 1,
                actualizado_en: ahoraIso,
              },
            };
          }),
        );
        setEditandoEnlaceCita(null);
        setExito(
          r.data.esModificacion
            ? "✅ Link de la consulta telemática modificado. Se actualizó el Tracking y se notificó el nuevo link al cliente."
            : "✅ Link de la consulta telemática registrado. Se actualizó el Tracking y se notificó el link al cliente.",
        );
        alActualizar?.();
        router.refresh();
      } finally {
        setAccionEnCurso(null);
      }
    });
  }

  function generarSalaDailyAutomatica(citaId: string, forzarNuevo = false) {
    setError(null);
    setExito(null);
    setAccionEnCurso({ citaId, decision: "generar_daily" });
    iniciarEnvio(async () => {
      try {
        const notaInput = (notasEnlaceTelematico[citaId] ?? "").trim();
        const r = await generarSalaDailyCitaAction({
          cita_id: citaId,
          forzar_nuevo: forzarNuevo,
          nota: notaInput || null,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        const ahoraIso = new Date().toISOString();
        setEnlacesTelematicos((prev) => ({
          ...prev,
          [citaId]: r.data.enlace,
        }));
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
              actualizado_en: ahoraIso,
            };
            const nuevoEv = {
              id: `daily-${Date.now()}`,
              fecha: ahoraIso,
              tipo: "GESTION_REUNION" as const,
              autor_nombre: item.abogado_nombre ?? "Abogado",
              autor_rol: "ABOGADO" as const,
              resumen: "Sala de videollamada generada en Daily.co",
              mensaje: `Link de videollamada: ${r.data.enlace}`,
            };
            return {
              ...item,
              cit_enlace: r.data.enlace,
              gestion_reunion: {
                ...gestionPrevia,
                eventos_log: [nuevoEv, ...(gestionPrevia.eventos_log ?? [])],
                sequence_calendario: (gestionPrevia.sequence_calendario ?? 0) + 1,
                actualizado_en: ahoraIso,
              },
            };
          }),
        );
        setEditandoEnlaceCita(null);
        setExito(
          `✅ Sala de videollamada generada automáticamente (${r.data.enlace}). Se actualizó el Tracking y se notificó al cliente.`,
        );
        alActualizar?.();
        router.refresh();
      } finally {
        setAccionEnCurso(null);
      }
    });
  }

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
                cit_enlace: r.data.enlace ?? item.cit_enlace,
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
            if (decision === "reagendar" || decision === "reagendar_y_aceptar") {
              return {
                ...item,
                cit_inicio_en: nuevoInicio ?? item.cit_inicio_en,
                cit_estado: decision === "reagendar_y_aceptar" ? "confirmada" : "reagendada",
                cit_enlace: r.data.enlace ?? item.cit_enlace,
                cit_asignacion:
                  decision === "reagendar_y_aceptar" ? "operador" : item.cit_asignacion,
                gestion_reunion: {
                  ...gestionPrevia,
                  estado_aceptacion_abogado:
                    decision === "reagendar_y_aceptar"
                      ? "aceptada"
                      : gestionPrevia.estado_aceptacion_abogado,
                  motivo_aceptacion_abogado:
                    decision === "reagendar_y_aceptar"
                      ? motivo?.trim() || null
                      : gestionPrevia.motivo_aceptacion_abogado,
                  sequence_calendario: (gestionPrevia.sequence_calendario ?? 0) + 1,
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
          setExito(
            "✅ Has confirmado la asignación de la cita. Se notificó al cliente, a operaciones y se envió invitación de calendario (.ics).",
          );
        } else if (decision === "reagendar_y_aceptar") {
          setExito(
            `✅ Fecha/hora actualizada y cita confirmada.${
              r.data.enlace ? ` Se generó el nuevo link de sala Daily.co (${r.data.enlace}).` : ""
            } Se registró en el Tracking y se envió actualización de calendario (.ics).`,
          );
        } else if (decision === "reagendar") {
          setExito(
            `✅ Fecha/hora de la cita actualizada.${
              r.data.enlace ? ` Se generó el nuevo link de sala Daily.co (${r.data.enlace}).` : ""
            } Se registró en el Tracking y se envió actualización de calendario (.ics).`,
          );
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
            const esRealizada = c.cit_estado === "realizada";
            const faltaParaCitaMs = inicio.getTime() - Date.now();
            const puedeModificarLink = !c.cit_enlace || faltaParaCitaMs >= 60 * 60 * 1000;
            const mostrarEditorLink =
              !esPresencial &&
              !esRealizada &&
              (editandoEnlaceCita === c.cit_id || !c.cit_enlace);

            // Vista compacta, opaca y de información básica para citas ya atendidas ("realizada")
            if (esRealizada) {
              return (
                <div
                  key={c.cit_id}
                  style={{
                    background: "#F1F5F9",
                    borderRadius: "12px",
                    border: "1px solid #CBD5E1",
                    padding: "12px 16px",
                    opacity: 0.78,
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
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
                          fontSize: "0.92rem",
                          color: "#475569",
                          textTransform: "capitalize",
                        }}
                      >
                        {FORMATO_CITA.format(inicio)}
                      </strong>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: "#E2E8F0",
                          color: "#475569",
                        }}
                      >
                        {esPresencial ? <Building2 size={12} /> : <Video size={12} />}
                        {esPresencial ? "Presencial" : "Telemática"}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: "#E2E8F0",
                          color: "#475569",
                        }}
                      >
                        ⚖️ {c.materia_nombre ?? "General"}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: "#475569" }}>
                        · <strong>👤 Cliente:</strong> {c.cliente_nombre ?? "Afiliado"}
                      </span>
                      {c.caso_vinculado && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#475569",
                            background: "#E2E8F0",
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          📁 {c.caso_vinculado.cas_titulo}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "0.73rem",
                          fontWeight: 800,
                          background: "#E2E8F0",
                          color: "#334155",
                          border: "1px solid #CBD5E1",
                        }}
                      >
                        ✅ Consulta Realizada
                      </span>

                      <button
                        type="button"
                        onClick={() => setCitaLogAbierta(logAbierto ? null : c.cit_id)}
                        title="Visualizar bajo demanda el Tracking de esta consulta atendida"
                        aria-label="Ver Tracking"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 10px",
                          borderRadius: "8px",
                          border: "1px solid #94A3B8",
                          background: logAbierto ? "#334155" : "#FFFFFF",
                          color: logAbierto ? "#FFFFFF" : "#334155",
                          fontWeight: 800,
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        <GitCommit size={13} />
                        {logAbierto ? "Ocultar Tracking" : `Tracking (${logEventos.length})`}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCitaGestionAbierta(gestionAbierta ? null : c.cit_id)
                        }
                        title="Consultar acta o expediente registrado en esta cita"
                        aria-label="Ver acta"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "5px 9px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: gestionAbierta ? "#475569" : "transparent",
                          color: gestionAbierta ? "#FFFFFF" : "#475569",
                          fontWeight: 700,
                          fontSize: "0.73rem",
                          cursor: "pointer",
                        }}
                      >
                        <FolderOpen size={12} />
                        {gestionAbierta ? "Ocultar Acta" : "Ver Acta"}
                      </button>
                    </div>
                  </div>

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

                  {logAbierto && (
                    <LineaTiempoTrackingCita
                      cita={c}
                      rolVista="ABOGADO"
                      alActualizar={() => {
                        alActualizar?.();
                        router.refresh();
                      }}
                    />
                  )}
                </div>
              );
            }

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

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                        fontSize: "0.85rem",
                        color: "#334155",
                        marginTop: "6px",
                      }}
                    >
                      <span>
                        <strong>👤 Cliente:</strong> {c.cliente_nombre ?? "Afiliado"}{" "}
                        {c.cliente_correo ? `(${c.cliente_correo})` : ""}
                      </span>

                      {c.cliente_whatsapp ? (
                        <>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 9px",
                              borderRadius: "999px",
                              background: "#ECFDF5",
                              border: "1px solid #A7F3D0",
                              color: "#065F46",
                              fontSize: "0.76rem",
                              fontWeight: 800,
                            }}
                          >
                            <Phone size={12} />
                            {c.cliente_whatsapp}
                          </span>
                          {(() => {
                            const urlWa = construirUrlWhatsappCliente({
                              telefono: c.cliente_whatsapp,
                              clienteNombre: c.cliente_nombre,
                              abogadoNombre: c.abogado_nombre,
                              fechaTexto: FORMATO_CITA.format(inicio),
                            });
                            return urlWa ? (
                              <a
                                href={urlWa}
                                target="_blank"
                                rel="noreferrer"
                                title="Contactar al cliente por WhatsApp"
                                aria-label="Contactar por WhatsApp"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  background: "#16A34A",
                                  color: "#FFFFFF",
                                  fontSize: "0.74rem",
                                  fontWeight: 800,
                                  textDecoration: "none",
                                }}
                              >
                                <MessageCircle size={12} />
                                WhatsApp
                              </a>
                            ) : null;
                          })()}
                          <a
                            href={`tel:${c.cliente_whatsapp}`}
                            title="Llamar al celular del cliente"
                            aria-label="Llamar al cliente"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 9px",
                              borderRadius: "999px",
                              background: "#F1F5F9",
                              border: "1px solid #CBD5E1",
                              color: "#334155",
                              fontSize: "0.73rem",
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            <Phone size={11} />
                            Llamar
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoWhatsappCita(
                                editandoWhatsappCita === c.cit_id ? null : c.cit_id,
                              );
                              setNuevoWhatsappCliente(c.cliente_whatsapp ?? "");
                            }}
                            title="Actualizar celular / WhatsApp del cliente"
                            aria-label="Editar celular"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#64748B",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              textDecoration: "underline",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Editar celular
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoWhatsappCita(
                              editandoWhatsappCita === c.cit_id ? null : c.cit_id,
                            );
                            setNuevoWhatsappCliente("");
                          }}
                          title="Registrar número de celular / WhatsApp del cliente"
                          aria-label="Registrar celular"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 9px",
                            borderRadius: "999px",
                            background: "#FFFBEB",
                            border: "1px solid #FDE68A",
                            color: "#92400E",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Phone size={12} />
                          + Registrar celular/WhatsApp
                        </button>
                      )}
                    </div>

                    {editandoWhatsappCita === c.cit_id && c.cit_cliente_id && (
                      <div
                        style={{
                          marginTop: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          type="tel"
                          value={nuevoWhatsappCliente}
                          onChange={(e) => setNuevoWhatsappCliente(e.target.value)}
                          placeholder="Ej. 0991234567"
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.78rem",
                            width: "160px",
                          }}
                        />
                        <button
                          type="button"
                          disabled={enviando}
                          onClick={() => {
                            if (!c.cit_cliente_id) return;
                            iniciarEnvio(async () => {
                              const r = await actualizarContactoClienteCitaAction({
                                cita_id: c.cit_id,
                                cliente_id: c.cit_cliente_id!,
                                whatsapp: nuevoWhatsappCliente,
                              });
                              if (!r.ok) {
                                setError(r.error);
                                return;
                              }
                              setCitasLocal((prev) =>
                                prev.map((it) =>
                                  it.cit_id === c.cit_id
                                    ? { ...it, cliente_whatsapp: r.data.whatsapp }
                                    : it,
                                ),
                              );
                              setEditandoWhatsappCita(null);
                              setExito("✅ Celular / WhatsApp del cliente actualizado.");
                              alActualizar?.();
                            });
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#05876E",
                            color: "#FFFFFF",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Guardar Celular
                        </button>
                      </div>
                    )}
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

                {/* Gestión del Link para Consultas Telemáticas (Videollamada) */}
                {!esPresencial && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: c.cit_enlace ? "#F5F3FF" : "#FFFBEB",
                      border: `1px solid ${c.cit_enlace ? "#DDD6FE" : "#FDE68A"}`,
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flexWrap: "wrap",
                          fontSize: "0.82rem",
                        }}
                      >
                        <Video
                          size={15}
                          color={c.cit_enlace ? "#5000BA" : "#B45309"}
                        />
                        <strong style={{ color: "#0F172A" }}>
                          Link de Consulta Telemática:
                        </strong>
                        {c.cit_enlace ? (
                          <>
                            <a
                              href={c.cit_enlace}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#5000BA",
                                fontWeight: 800,
                                textDecoration: "underline",
                                wordBreak: "break-all",
                              }}
                            >
                              {c.cit_enlace}
                            </a>
                            {c.cit_enlace.includes(".daily.co") && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 7px",
                                  borderRadius: "999px",
                                  background: "#ECFDF5",
                                  border: "1px solid #A7F3D0",
                                  color: "#065F46",
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                }}
                              >
                                <Sparkles size={11} />
                                Daily.co Automático
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#B45309", fontWeight: 700 }}>
                            ⚠️ Pendiente registrar link de videollamada (Daily.co / Meet / Zoom)
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {c.cit_enlace && (
                          <a
                            href={c.cit_enlace}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir sala de videollamada"
                            aria-label="Abrir videollamada"
                            className="btn-responsive-accion"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: abierta ? "#05876E" : "#5000BA",
                              color: "#FFFFFF",
                              fontSize: "0.76rem",
                              fontWeight: 800,
                              textDecoration: "none",
                            }}
                          >
                            <ExternalLink size={13} />
                            <span className="btn-texto-responsive">
                              {abierta ? "Entrar a Sala" : "Abrir Link"}
                            </span>
                          </a>
                        )}

                        {puedeModificarLink && (
                          <button
                            type="button"
                            disabled={enviando}
                            onClick={() =>
                              generarSalaDailyAutomatica(
                                c.cit_id,
                                Boolean(c.cit_enlace?.includes(".daily.co")),
                              )
                            }
                            title={
                              c.cit_enlace?.includes(".daily.co")
                                ? "Generar un nuevo enlace en Daily.co e invalidar el anterior"
                                : "Generar sala oficial de videollamada automáticamente en Daily.co"
                            }
                            aria-label="Generar sala automática en Daily.co"
                            className="btn-responsive-accion"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: "1px solid #A7F3D0",
                              background: "#ECFDF5",
                              color: "#065F46",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              cursor: enviando ? "wait" : "pointer",
                            }}
                          >
                            <RefreshCw size={13} />
                            <span className="btn-texto-responsive">
                              {accionEnCurso?.citaId === c.cit_id &&
                              accionEnCurso?.decision === "generar_daily"
                                ? "Generando…"
                                : c.cit_enlace?.includes(".daily.co")
                                ? "Nuevo Daily.co"
                                : "Sala Daily.co"}
                            </span>
                          </button>
                        )}

                        {c.cit_enlace && puedeModificarLink && (
                          <button
                            type="button"
                            onClick={() => {
                              if (editandoEnlaceCita === c.cit_id) {
                                setEditandoEnlaceCita(null);
                              } else {
                                setEnlacesTelematicos((prev) => ({
                                  ...prev,
                                  [c.cit_id]: prev[c.cit_id] ?? c.cit_enlace ?? "",
                                }));
                                setEditandoEnlaceCita(c.cit_id);
                              }
                            }}
                            title="Modificar el link de la consulta telemática (permitido hasta 1 hora antes de la cita)"
                            aria-label="Modificar link"
                            className="btn-responsive-accion"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              border: "1px solid #C4B5FD",
                              background: "#FFFFFF",
                              color: "#5000BA",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            <Link2 size={13} />
                            <span className="btn-texto-responsive">
                              {editandoEnlaceCita === c.cit_id ? "Cancelar" : "Modificar Link"}
                            </span>
                          </button>
                        )}

                        {c.cit_enlace && !puedeModificarLink && (
                          <span
                            title="El enlace solo puede modificarse hasta 1 hora antes de la hora agendada"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "#F1F5F9",
                              border: "1px solid #CBD5E1",
                              color: "#64748B",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                            }}
                          >
                            <Lock size={12} />
                            Modificación cerrada (&lt;1h para la cita)
                          </span>
                        )}
                      </div>
                    </div>

                    {mostrarEditorLink && puedeModificarLink && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1.2fr auto",
                          gap: "8px",
                          alignItems: "center",
                          paddingTop: "2px",
                        }}
                      >
                        <input
                          type="url"
                          value={enlacesTelematicos[c.cit_id] ?? c.cit_enlace ?? ""}
                          onChange={(e) =>
                            setEnlacesTelematicos((prev) => ({
                              ...prev,
                              [c.cit_id]: e.target.value,
                            }))
                          }
                          placeholder="https://meet.google.com/... o enlace de Zoom / Teams"
                          style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.82rem",
                            background: "#FFFFFF",
                            width: "100%",
                          }}
                        />
                        <input
                          type="text"
                          value={notasEnlaceTelematico[c.cit_id] ?? ""}
                          onChange={(e) =>
                            setNotasEnlaceTelematico((prev) => ({
                              ...prev,
                              [c.cit_id]: e.target.value,
                            }))
                          }
                          placeholder="Nota opcional para el cliente"
                          maxLength={200}
                          style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8rem",
                            background: "#FFFFFF",
                            width: "100%",
                          }}
                        />
                        <button
                          type="button"
                          disabled={enviando}
                          onClick={() => guardarEnlaceTelematico(c.cit_id)}
                          title="Guardar link, actualizar Tracking y notificar al cliente (modificable hasta 1h antes)"
                          aria-label="Notificar link"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#5000BA",
                            color: "#FFFFFF",
                            fontSize: "0.78rem",
                            fontWeight: 800,
                            cursor: enviando ? "wait" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Link2 size={14} />
                          {accionEnCurso?.citaId === c.cit_id &&
                          accionEnCurso?.decision === "actualizar_enlace"
                            ? "Notificando…"
                            : c.cit_enlace
                            ? "Actualizar Link"
                            : "Notificar Link"}
                        </button>
                      </div>
                    )}
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
                          onClick={() => {
                            if (reagendando === c.cit_id) {
                              setReagendando(null);
                            } else {
                              // Pre-cargar hora actual de la cita en formato YYYY-MM-DDTHH:mm (hora Ecuador UTC-5)
                              const fechaEcLocal = new Date(inicio.getTime() - 5 * 3600 * 1000)
                                .toISOString()
                                .slice(0, 16);
                              setFechasReagendar((prev) => ({
                                ...prev,
                                [c.cit_id]: prev[c.cit_id] || fechaEcLocal,
                              }));
                              setReagendando(c.cit_id);
                            }
                          }}
                          title="Cambiar fecha y hora de la reunión (habilitado hasta 1 hora antes)"
                          aria-label="Cambiar hora"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: reagendando === c.cit_id ? "#F5F3FF" : "#FFFFFF",
                            color: reagendando === c.cit_id ? "#5000BA" : "#334155",
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            cursor: "pointer",
                          }}
                        >
                          <Clock size={14} />
                          Cambiar Hora
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botonera de Gestión de la Reunión, Expediente/Caso, Tracking y Calendario */}
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
                      title="Ver Tracking de la cita en línea de tiempo y sincronizar calendario"
                      aria-label="Ver Tracking de la cita"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: logAbierto ? "#0F172A" : "#FFFFFF",
                        color: logAbierto ? "#FFFFFF" : "#334155",
                        fontWeight: 800,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      <GitCommit size={14} />
                      Tracking ({logEventos.length})
                    </button>

                    {(() => {
                      const calLinks = construirEnlacesCalendarioCita({
                        citaId: c.cit_id,
                        inicioIso: c.cit_inicio_en,
                        finIso: c.cit_fin_en,
                        modalidad: c.cit_modalidad,
                        materiaNombre: c.materia_nombre ?? "General",
                        motivo: c.cit_motivo,
                        clienteNombre: c.cliente_nombre,
                        clienteCorreo: c.cliente_correo,
                        clienteWhatsapp: c.cliente_whatsapp,
                        abogadoNombre: c.abogado_nombre,
                        abogadoCorreo: c.abogado_correo,
                        enlaceVideollamada: c.cit_enlace,
                        lugarPresencial: c.cit_lugar,
                        sequence: c.gestion_reunion?.sequence_calendario ?? 0,
                      });
                      return (
                        <>
                          <a
                            href={calLinks.googleCalendarUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Agregar o actualizar esta cita en tu Google Calendar"
                            aria-label="Google Calendar"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "8px 11px",
                              borderRadius: "8px",
                              border: "1px solid #DDD6FE",
                              background: "#FFFFFF",
                              color: "#5000BA",
                              fontWeight: 700,
                              fontSize: "0.76rem",
                              textDecoration: "none",
                            }}
                          >
                            <Calendar size={13} />
                            Google Calendar
                          </a>
                          <a
                            href={calLinks.icsDownloadUrl}
                            title="Descargar archivo .ICS para agendar o actualizar en Outlook / Apple Calendar / Correo"
                            aria-label="Descargar archivo ICS"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "8px 11px",
                              borderRadius: "8px",
                              border: "1px solid #CBD5E1",
                              background: "#FFFFFF",
                              color: "#334155",
                              fontWeight: 700,
                              fontSize: "0.76rem",
                              textDecoration: "none",
                            }}
                          >
                            <Download size={13} />
                            .ICS Agenda
                          </a>
                        </>
                      );
                    })()}
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

                {/* Panel para Cambiar Fecha/Hora (con comentario obligatorio y opción de Cambiar Hora y Confirmar) */}
                {reagendando === c.cit_id && (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      background: "#F5F3FF",
                      border: "1.5px solid #C4B5FD",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <strong style={{ fontSize: "0.84rem", color: "#4C1D95" }}>
                        🕒 Cambiar Fecha y Hora de la Reunión (se registra en el Tracking y actualiza agendas por correo)
                      </strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: "#EDE9FE",
                          color: "#5B21B6",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                        }}
                      >
                        Habilitado libremente hasta 1h antes de la cita · Comentario obligatorio
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "10px",
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <label
                          htmlFor={`nuevo-${c.cit_id}`}
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            color: "#334155",
                            marginBottom: "4px",
                          }}
                        >
                          Nueva fecha y hora *
                        </label>
                        <input
                          id={`nuevo-${c.cit_id}`}
                          type="datetime-local"
                          value={fechasReagendar[c.cit_id] ?? ""}
                          onChange={(e) =>
                            setFechasReagendar((prev) => ({
                              ...prev,
                              [c.cit_id]: e.target.value,
                            }))
                          }
                          required
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            fontSize: "0.83rem",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`motivo-reag-${c.cit_id}`}
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            color: "#334155",
                            marginBottom: "4px",
                          }}
                        >
                          Comentario obligatorio para el Tracking *
                        </label>
                        <input
                          id={`motivo-reag-${c.cit_id}`}
                          type="text"
                          value={motivosReagendar[c.cit_id] ?? ""}
                          onChange={(e) =>
                            setMotivosReagendar((prev) => ({
                              ...prev,
                              [c.cit_id]: e.target.value,
                            }))
                          }
                          placeholder="Ej. Coordiné por WhatsApp con el cliente mover la reunión a las 15:00"
                          maxLength={350}
                          required
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            fontSize: "0.83rem",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "2px" }}>
                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => {
                          const valFecha = fechasReagendar[c.cit_id] ?? "";
                          const valMotivo = (motivosReagendar[c.cit_id] ?? "").trim();
                          if (!valFecha) {
                            setError("Selecciona la nueva fecha y hora para la reunión.");
                            return;
                          }
                          if (!valMotivo) {
                            setError(
                              "Es obligatorio ingresar un comentario explicando el cambio de fecha/hora para el Tracking.",
                            );
                            return;
                          }
                          const iso = new Date(`${valFecha}:00-05:00`).toISOString();
                          decidir(c.cit_id, "reagendar_y_aceptar", iso, valMotivo);
                        }}
                        title="Cambiar la fecha/hora, confirmar la cita y enviar actualización de agenda por correo"
                        aria-label="Cambiar hora y confirmar"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#05876E",
                          color: "#FFFFFF",
                          fontSize: "0.8rem",
                          fontWeight: 800,
                          cursor: enviando ? "wait" : "pointer",
                        }}
                      >
                        <CheckCircle2 size={14} />
                        {accionEnCurso?.citaId === c.cit_id &&
                        accionEnCurso?.decision === "reagendar_y_aceptar"
                          ? "Actualizando…"
                          : "Cambiar Hora y Confirmar"}
                      </button>

                      <button
                        type="button"
                        disabled={enviando}
                        onClick={() => {
                          const valFecha = fechasReagendar[c.cit_id] ?? "";
                          const valMotivo = (motivosReagendar[c.cit_id] ?? "").trim();
                          if (!valFecha) {
                            setError("Selecciona la nueva fecha y hora para la reunión.");
                            return;
                          }
                          if (!valMotivo) {
                            setError(
                              "Es obligatorio ingresar un comentario explicando el cambio de fecha/hora para el Tracking.",
                            );
                            return;
                          }
                          const iso = new Date(`${valFecha}:00-05:00`).toISOString();
                          decidir(c.cit_id, "reagendar", iso, valMotivo);
                        }}
                        title="Solo cambiar la fecha/hora de la cita y notificar"
                        aria-label="Solo cambiar hora"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#5000BA",
                          color: "#FFFFFF",
                          fontSize: "0.8rem",
                          fontWeight: 800,
                          cursor: enviando ? "wait" : "pointer",
                        }}
                      >
                        <Clock size={14} />
                        {accionEnCurso?.citaId === c.cit_id &&
                        accionEnCurso?.decision === "reagendar"
                          ? "Moviendo…"
                          : "Solo Cambiar Hora"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setReagendando(null)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#334155",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
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

                {/* Panel desplegable: Tracking (Línea de Tiempo Unificada) */}
                {logAbierto && (
                  <LineaTiempoTrackingCita
                    cita={c}
                    rolVista="ABOGADO"
                    alActualizar={() => {
                      alActualizar?.();
                      router.refresh();
                    }}
                  />
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
