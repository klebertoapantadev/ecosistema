"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salaAbierta } from "@eco/agenda";
import { Calendar, Clock, Download, GitCommit, Video } from "lucide-react";
import { decidirCitaAction } from "../acciones";
import { construirEnlacesCalendarioCita } from "../calendario-ics";
import { ETIQUETA_COBERTURA, ETIQUETA_ESTADO_CITA } from "../esquema";
import LineaTiempoTrackingCita from "./LineaTiempoTrackingCita";
import type { CitaResumen } from "../consultas";

const FORMATO = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const HORAS_SIN_PENALIZACION = 24;

export default function ListaCitasCliente({
  citas,
  alActualizar,
}: {
  citas: CitaResumen[];
  alActualizar?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState<string | null>(null);
  const [trackingAbierto, setTrackingAbierto] = useState<string | null>(null);
  const [nuevaFechaHora, setNuevaFechaHora] = useState<Record<string, string>>({});
  const [comentarioCambio, setComentarioCambio] = useState<Record<string, string>>({});
  const [enviando, iniciarEnvio] = useTransition();

  function cancelar(cita: CitaResumen, motivo: string) {
    setError(null);
    setExito(null);
    iniciarEnvio(async () => {
      const r = await decidirCitaAction({ cita_id: cita.cit_id, decision: "cancelar", motivo });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCancelando(null);
      setExito("✅ La cita ha sido cancelada y se actualizó tu calendario.");
      alActualizar?.();
      router.refresh();
    });
  }

  function reagendarCliente(cita: CitaResumen) {
    setError(null);
    setExito(null);
    const valFecha = nuevaFechaHora[cita.cit_id] ?? "";
    const valMotivo = (comentarioCambio[cita.cit_id] ?? "").trim();
    if (!valFecha) {
      setError("Selecciona la nueva fecha y hora para tu consulta.");
      return;
    }
    if (!valMotivo) {
      setError("Es obligatorio ingresar un comentario explicando el motivo del cambio de fecha/hora.");
      return;
    }

    iniciarEnvio(async () => {
      const iso = new Date(`${valFecha}:00-05:00`).toISOString();
      const r = await decidirCitaAction({
        cita_id: cita.cit_id,
        decision: "reagendar",
        nuevo_inicio: iso,
        motivo: valMotivo,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setReagendando(null);
      setExito(
        "✅ Fecha y hora actualizadas. Se registró en el Tracking y enviamos el agendamiento actualizado a tu correo.",
      );
      alActualizar?.();
      router.refresh();
    });
  }

  if (citas.length === 0) {
    return (
      <p className="estado-vacio">
        Todavía no tienes ninguna cita. Puedes agendar una cuando quieras.
      </p>
    );
  }

  return (
    <>
      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.84rem",
            fontWeight: 700,
            marginBottom: "10px",
          }}
        >
          {error}
        </div>
      )}
      {exito && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            fontSize: "0.84rem",
            fontWeight: 700,
            marginBottom: "10px",
          }}
        >
          {exito}
        </div>
      )}
      <ul className="agenda-lista-citas">
        {[...citas]
          .sort((a, b) => {
            const aRealizada = a.cit_estado === "realizada" ? 1 : 0;
            const bRealizada = b.cit_estado === "realizada" ? 1 : 0;
            if (aRealizada !== bRealizada) return aRealizada - bRealizada;
            return new Date(a.cit_inicio_en).getTime() - new Date(b.cit_inicio_en).getTime();
          })
          .map((c) => {
          const inicio = new Date(c.cit_inicio_en);
          const fin = c.cit_fin_en
            ? new Date(c.cit_fin_en)
            : new Date(inicio.getTime() + 45 * 60_000);
          const abierta = salaAbierta(inicio, fin);
          const futura = inicio.getTime() > Date.now();
          const puedeCambiarHora =
            inicio.getTime() - Date.now() >= 60 * 60 * 1000 &&
            c.cit_estado !== "cancelada" &&
            c.cit_estado !== "realizada";
          const conPenalizacion =
            inicio.getTime() - Date.now() < HORAS_SIN_PENALIZACION * 3_600_000;
          const cancelable =
            futura && c.cit_estado !== "cancelada" && c.cit_estado !== "realizada";
          const logEventos = c.gestion_reunion?.eventos_log ?? [];
          const verTracking = trackingAbierto === c.cit_id;
          const esRealizada = c.cit_estado === "realizada";

          // Vista compacta, opaca y de información básica para citas ya atendidas ("realizada")
          if (esRealizada) {
            return (
              <li
                key={c.cit_id}
                className="agenda-cita"
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  padding: "12px 16px",
                  opacity: 0.78,
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
                    <strong style={{ textTransform: "capitalize", color: "#475569", fontSize: "0.92rem" }}>
                      {FORMATO.format(inicio)}
                    </strong>
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
                      {c.cit_modalidad === "virtual" ? "🎥 Videollamada" : "🏢 Presencial"}
                    </span>
                    {c.materia_nombre && (
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
                        ⚖️ {c.materia_nombre}
                      </span>
                    )}
                    {c.abogado_nombre && (
                      <span style={{ fontSize: "0.8rem", color: "#475569" }}>
                        · 👨‍⚖️ Dr(a). {c.abogado_nombre}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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
                      onClick={() => setTrackingAbierto(verTracking ? null : c.cit_id)}
                      title="Visualizar bajo demanda el Tracking de tu consulta atendida"
                      aria-label="Ver Tracking"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: "1px solid #94A3B8",
                        background: verTracking ? "#334155" : "#FFFFFF",
                        color: verTracking ? "#FFFFFF" : "#334155",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      <GitCommit size={13} />
                      {verTracking ? "Ocultar Tracking" : `Tracking (${logEventos.length})`}
                    </button>
                  </div>
                </div>

                {verTracking && (
                  <div style={{ marginTop: "10px" }}>
                    <LineaTiempoTrackingCita
                      cita={c}
                      rolVista="CLIENTE"
                      alActualizar={() => {
                        alActualizar?.();
                        router.refresh();
                      }}
                    />
                  </div>
                )}
              </li>
            );
          }

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
            <li key={c.cit_id} className="agenda-cita">
              <div className="agenda-cita-cabeza">
                <strong style={{ textTransform: "capitalize" }}>{FORMATO.format(inicio)}</strong>
                <span className="pildora-estado">
                  {ETIQUETA_ESTADO_CITA[c.cit_estado] ?? c.cit_estado}
                </span>
              </div>
              <p className="agenda-cita-meta">
                {c.cit_modalidad === "virtual" ? "🎥 Videollamada" : "🏢 Presencial"} ·{" "}
                {ETIQUETA_COBERTURA[c.cit_cobertura] ?? c.cit_cobertura}
                {c.materia_nombre ? ` · ⚖️ ${c.materia_nombre}` : ""}
              </p>
              {c.abogado_nombre && (
                <p
                  style={{
                    margin: "4px 0 6px 0",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    color: "#059669",
                  }}
                >
                  👨‍⚖️ Abogado asignado: Dr(a). {c.abogado_nombre}
                </p>
              )}
              {c.cit_motivo && <p className="agenda-cita-motivo">{c.cit_motivo}</p>}
              {c.caso_vinculado && (
                <div
                  style={{
                    margin: "6px 0",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "#F5F3FF",
                    border: "1px solid #DDD6FE",
                    fontSize: "0.8rem",
                    color: "#4C1D95",
                  }}
                >
                  <strong>📁 Expediente / Caso vinculado:</strong> {c.caso_vinculado.cas_titulo} (
                  {c.caso_vinculado.cas_estado.replace("_", " ")})
                </div>
              )}
              {c.gestion_reunion?.siguientes_pasos &&
                c.gestion_reunion.siguientes_pasos.length > 0 && (
                  <div
                    style={{
                      margin: "6px 0",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "0.8rem",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: "4px", color: "#0F172A" }}>
                      📌 Siguientes pasos acordados en tu consulta:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", color: "#334155" }}>
                      {c.gestion_reunion.siguientes_pasos.map((p) => (
                        <li key={p.id}>
                          {p.descripcion} —{" "}
                          <em>
                            Responsable: {p.responsable_nombre} ({p.responsable_rol})
                          </em>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {c.cit_modalidad === "virtual" &&
                c.cit_estado !== "cancelada" &&
                (c.cit_enlace ? (
                  <div
                    style={{
                      margin: "8px 0",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "#F5F3FF",
                      border: "1px solid #DDD6FE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ fontSize: "0.82rem", color: "#1E293B" }}>
                      <strong>📹 Enlace para tu consulta telemática:</strong>{" "}
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
                    </div>
                    <a
                      className="btn btn-primario"
                      href={c.cit_enlace}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 14px",
                        fontSize: "0.78rem",
                      }}
                    >
                      <Video size={14} />
                      {abierta ? "Entrar a videollamada" : "Abrir link"}
                    </a>
                  </div>
                ) : futura ? (
                  <p className="agenda-nota">
                    Tu abogado asignado compartirá aquí el link de la videollamada y te llegará una
                    notificación.
                  </p>
                ) : null)}

              {/* Botonera de Acciones del Cliente: Tracking, Cambiar Hora, Agendar en Calendario y Cancelar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "10px",
                  paddingTop: "8px",
                  borderTop: "1px solid #F1F5F9",
                }}
              >
                <button
                  type="button"
                  onClick={() => setTrackingAbierto(verTracking ? null : c.cit_id)}
                  title="Ver Tracking de tu cita en línea de tiempo"
                  aria-label="Ver Tracking"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: verTracking ? "#0F172A" : "#FFFFFF",
                    color: verTracking ? "#FFFFFF" : "#334155",
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <GitCommit size={14} />
                  Tracking ({logEventos.length})
                </button>

                {puedeCambiarHora && (
                  <button
                    type="button"
                    onClick={() => {
                      if (reagendando === c.cit_id) {
                        setReagendando(null);
                      } else {
                        const fechaEcLocal = new Date(inicio.getTime() - 5 * 3600 * 1000)
                          .toISOString()
                          .slice(0, 16);
                        setNuevaFechaHora((prev) => ({
                          ...prev,
                          [c.cit_id]: prev[c.cit_id] || fechaEcLocal,
                        }));
                        setReagendando(c.cit_id);
                      }
                    }}
                    title="Cambiar fecha y hora (permitido hasta 1 hora antes)"
                    aria-label="Cambiar hora"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: "1px solid #C4B5FD",
                      background: reagendando === c.cit_id ? "#5000BA" : "#F5F3FF",
                      color: reagendando === c.cit_id ? "#FFFFFF" : "#5000BA",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    <Clock size={14} />
                    Cambiar Hora
                  </button>
                )}

                {c.cit_estado !== "cancelada" && (
                  <>
                    <a
                      href={calLinks.googleCalendarUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Agregar o actualizar en tu Google Calendar"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "7px 11px",
                        borderRadius: "8px",
                        border: "1px solid #DDD6FE",
                        background: "#FFFFFF",
                        color: "#5000BA",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      <Calendar size={13} />
                      Google Calendar
                    </a>
                    <a
                      href={calLinks.icsDownloadUrl}
                      title="Descargar archivo .ICS para el calendario de tu correo"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "7px 11px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#334155",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      <Download size={13} />
                      .ICS Agenda
                    </a>
                  </>
                )}

                {cancelable && cancelando !== c.cit_id && (
                  <button
                    type="button"
                    className="accion-menor"
                    onClick={() => setCancelando(c.cit_id)}
                  >
                    Cancelar cita
                  </button>
                )}
              </div>

              {/* Panel de Cambio de Fecha/Hora para el Cliente (con comentario obligatorio) */}
              {reagendando === c.cit_id && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#F5F3FF",
                    border: "1px solid #C4B5FD",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <strong style={{ fontSize: "0.82rem", color: "#4C1D95" }}>
                    🕒 Cambiar fecha y hora de tu consulta (habilitado hasta 1 hora antes · comentario obligatorio)
                  </strong>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="datetime-local"
                      value={nuevaFechaHora[c.cit_id] ?? ""}
                      onChange={(e) =>
                        setNuevaFechaHora((prev) => ({ ...prev, [c.cit_id]: e.target.value }))
                      }
                      required
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        fontSize: "0.82rem",
                      }}
                    />
                    <input
                      type="text"
                      value={comentarioCambio[c.cit_id] ?? ""}
                      onChange={(e) =>
                        setComentarioCambio((prev) => ({ ...prev, [c.cit_id]: e.target.value }))
                      }
                      placeholder="Comentario obligatorio (ej. Solicito mover a la tarde)"
                      maxLength={300}
                      required
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-primario"
                      disabled={enviando}
                      onClick={() => reagendarCliente(c)}
                    >
                      {enviando ? "Guardando…" : "Guardar Nuevo Horario"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-blanco-borde"
                      onClick={() => setReagendando(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {cancelable && cancelando === c.cit_id && (
                <form
                  className="agenda-cancelar"
                  action={(datos) => cancelar(c, String(datos.get("motivo") ?? ""))}
                >
                  <label className="etiqueta-campo" htmlFor={`motivo-${c.cit_id}`}>
                    ¿Por qué la cancelas?
                  </label>
                  <input id={`motivo-${c.cit_id}`} name="motivo" type="text" maxLength={200} />
                  {conPenalizacion && c.cit_cobertura === "plan" && (
                    <p className="agenda-aviso">
                      Faltan menos de {HORAS_SIN_PENALIZACION} horas: esta consulta no volverá a tu
                      plan si la cancelas ahora.
                    </p>
                  )}
                  <div className="fila-botones">
                    <button type="submit" className="btn btn-peligro" disabled={enviando}>
                      {enviando ? "Cancelando…" : "Sí, cancelar"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-blanco-borde"
                      onClick={() => setCancelando(null)}
                    >
                      Volver
                    </button>
                  </div>
                </form>
              )}

              {/* Línea de Tiempo de Tracking para el Cliente */}
              {verTracking && (
                <div style={{ marginTop: "10px" }}>
                  <LineaTiempoTrackingCita
                    cita={c}
                    rolVista="CLIENTE"
                    alActualizar={() => {
                      alActualizar?.();
                      router.refresh();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
