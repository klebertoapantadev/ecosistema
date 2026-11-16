"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Calendar,
  Clock,
  Download,
  GitCommit,
  MessageSquarePlus,
} from "lucide-react";
import { registrarComentarioTrackingCitaAction } from "../acciones";
import { construirEnlacesCalendarioCita } from "../calendario-ics";
import type { CitaResumen, EventoLogCita } from "../consultas";

const FORMATO_FECHA_TIMELINE = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

function estiloPorTipoEvento(tipo: EventoLogCita["tipo"]) {
  switch (tipo) {
    case "ACEPTACION":
      return {
        etiqueta: "CONFIRMACIÓN",
        colorPunto: "var(--exito)",
        fondoBadge: "var(--exito-diluido)",
        textoBadge: "var(--exito-texto)",
        bordeTarjeta: "var(--exito-linea)",
      };
    case "REAGENDAMIENTO":
      return {
        etiqueta: "CAMBIO DE FECHA / HORA",
        colorPunto: "var(--acento)",
        fondoBadge: "var(--acento-diluido)",
        textoBadge: "var(--acento)",
        bordeTarjeta: "var(--acento-linea)",
      };
    case "ASIGNACION":
    case "REASIGNACION":
      return {
        etiqueta: tipo === "REASIGNACION" ? "REASIGNACIÓN" : "ASIGNACIÓN",
        colorPunto: "var(--acento)",
        fondoBadge: "var(--acento-diluido)",
        textoBadge: "var(--acento-hondo)",
        bordeTarjeta: "var(--acento-linea)",
      };
    case "RECHAZO":
      return {
        etiqueta: "SOLICITUD REASIGNACIÓN",
        colorPunto: "var(--error)",
        fondoBadge: "var(--error-diluido)",
        textoBadge: "var(--error-texto)",
        bordeTarjeta: "var(--error-linea)",
      };
    case "DOCUMENTO":
      return {
        etiqueta: "RESPALDO / ARCHIVO",
        colorPunto: "var(--aviso)",
        fondoBadge: "var(--aviso-diluido)",
        textoBadge: "var(--aviso-texto)",
        bordeTarjeta: "var(--aviso-linea)",
      };
    case "VINCULACION_CASO":
      return {
        etiqueta: "EXPEDIENTE",
        colorPunto: "var(--acento)",
        fondoBadge: "var(--acento-diluido)",
        textoBadge: "var(--acento-hondo)",
        bordeTarjeta: "var(--acento-linea)",
      };
    default:
      return {
        etiqueta: "TRACKING / GESTIÓN",
        colorPunto: "var(--texto-2)",
        fondoBadge: "var(--fondo-hundido)",
        textoBadge: "var(--texto-2)",
        bordeTarjeta: "var(--linea)",
      };
  }
}

function estiloPorRol(rol: EventoLogCita["autor_rol"]) {
  if (rol === "ABOGADO") {
    return { fondo: "var(--exito-diluido)", color: "var(--exito-texto)", texto: "👨‍⚖️ ABOGADO" };
  }
  if (rol === "OPERADOR") {
    return { fondo: "var(--acento-diluido)", color: "#5000BA", texto: "🛡️ OPERADOR" };
  }
  if (rol === "CLIENTE") {
    return { fondo: "var(--acento-diluido)", color: "var(--acento-hondo)", texto: "👤 CLIENTE" };
  }
  return { fondo: "var(--fondo-hundido)", color: "var(--texto-2)", texto: "⚙️ SISTEMA" };
}

export default function LineaTiempoTrackingCita({
  cita,
  rolVista,
  permitirAgregarNota = true,
  alActualizar,
}: {
  cita: CitaResumen;
  rolVista: "ABOGADO" | "OPERADOR" | "CLIENTE";
  permitirAgregarNota?: boolean;
  alActualizar?: () => void;
}) {
  const eventosIniciales = cita.gestion_reunion?.eventos_log ?? [];
  const [eventosLocal, setEventosLocal] = useState<EventoLogCita[]>(eventosIniciales);
  const [comentario, setComentario] = useState("");
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const [exitoNota, setExitoNota] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  useEffect(() => {
    setEventosLocal(cita.gestion_reunion?.eventos_log ?? []);
  }, [cita.gestion_reunion?.eventos_log]);

  const seqCalendario = cita.gestion_reunion?.sequence_calendario ?? 0;
  const enlacesCal = construirEnlacesCalendarioCita({
    citaId: cita.cit_id,
    inicioIso: cita.cit_inicio_en,
    finIso: cita.cit_fin_en,
    modalidad: cita.cit_modalidad,
    materiaNombre: cita.materia_nombre ?? "General",
    motivo: cita.cit_motivo,
    clienteNombre: cita.cliente_nombre,
    clienteCorreo: cita.cliente_correo,
    clienteWhatsapp: cita.cliente_whatsapp,
    abogadoNombre: cita.abogado_nombre,
    abogadoCorreo: cita.abogado_correo,
    enlaceVideollamada: cita.cit_enlace,
    lugarPresencial: cita.cit_lugar,
    sequence: seqCalendario,
  });

  function registrarNotaTracking(e: React.FormEvent) {
    e.preventDefault();
    setErrorNota(null);
    setExitoNota(null);
    const limpio = comentario.trim();
    if (!limpio) {
      setErrorNota("Escribe un comentario para agregarlo al Tracking.");
      return;
    }

    iniciarGuardado(async () => {
      const res = await registrarComentarioTrackingCitaAction({
        cita_id: cita.cit_id,
        comentario: limpio,
        rol_forzado: rolVista,
      });
      if (!res.ok) {
        setErrorNota(res.error);
        return;
      }
      setEventosLocal((prev) => [res.data.evento, ...prev]);
      setComentario("");
      setExitoNota("✅ Registro añadido a la línea de tiempo del Tracking.");
      alActualizar?.();
    });
  }

  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        background: "var(--fondo-suave)",
        border: "1px solid var(--linea)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Cabecera de Tracking + Botones de Sincronización con Calendario Personal */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--linea)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "#5000BA",
              color: "#FFFFFF",
            }}
          >
            <GitCommit size={16} />
          </span>
          <div>
            <strong style={{ fontSize: "0.9rem", color: "var(--texto)", display: "block" }}>
              Tracking de la Cita — Línea de Tiempo ({eventosLocal.length})
            </strong>
            <span style={{ fontSize: "0.75rem", color: "var(--texto-suave)" }}>
              Trazabilidad cronológica de reserva, asignaciones, cambios de hora y gestión
            </span>
          </div>
        </div>

        {/* Botones para agendar/actualizar en correo y calendario personal */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <a
            href={enlacesCal.googleCalendarUrl}
            target="_blank"
            rel="noreferrer"
            title="Agregar o actualizar esta cita en Google Calendar"
            aria-label="Agendar en Google Calendar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "7px",
              background: "#FFFFFF",
              border: "1px solid var(--acento-linea)",
              color: "#5000BA",
              fontSize: "0.74rem",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            <Calendar size={13} />
            Google Calendar
          </a>
          <a
            href={enlacesCal.outlookCalendarUrl}
            target="_blank"
            rel="noreferrer"
            title="Agregar o actualizar esta cita en Outlook / Office 365"
            aria-label="Agendar en Outlook"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "7px",
              background: "#FFFFFF",
              border: "1px solid var(--acento-linea)",
              color: "var(--acento-hondo)",
              fontSize: "0.74rem",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            <Calendar size={13} />
            Outlook
          </a>
          <a
            href={enlacesCal.icsDownloadUrl}
            title="Descargar archivo .ICS para sincronizar en tu agenda de correo"
            aria-label="Descargar archivo ICS"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "7px",
              background: "var(--exito-diluido)",
              border: "1px solid var(--exito-linea)",
              color: "var(--exito-texto)",
              fontSize: "0.74rem",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            <Download size={13} />
            Agenda .ICS {seqCalendario > 0 ? `(v${seqCalendario})` : ""}
          </a>
        </div>
      </div>

      {/* Formulario rápido para añadir comentario al Tracking */}
      {permitirAgregarNota && (
        <form
          onSubmit={registrarNotaTracking}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            background: "#FFFFFF",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid var(--linea)",
          }}
        >
          <input
            type="text"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Registrar comentario en el Tracking (ej. Contacté al cliente por WhatsApp, acordamos reunirnos a las 15:00)..."
            maxLength={400}
            style={{
              flex: "1 1 240px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--linea-fuerte)",
              fontSize: "0.82rem",
              background: "#FFFFFF",
            }}
          />
          <button
            type="submit"
            disabled={guardando}
            title="Guardar comentario en la línea de tiempo del Tracking"
            aria-label="Guardar en Tracking"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: "var(--texto)",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 800,
              cursor: guardando ? "wait" : "pointer",
            }}
          >
            <MessageSquarePlus size={14} />
            {guardando ? "Registrando…" : "Añadir al Tracking"}
          </button>
        </form>
      )}

      {errorNota && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            background: "var(--error-diluido)",
            border: "1px solid var(--error-linea)",
            color: "var(--error-texto)",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          {errorNota}
        </div>
      )}

      {exitoNota && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            background: "var(--exito-diluido)",
            border: "1px solid var(--exito-linea)",
            color: "var(--exito-texto)",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}
        >
          {exitoNota}
        </div>
      )}

      {/* Línea de Tiempo Vertical */}
      {eventosLocal.length === 0 ? (
        <div
          style={{
            padding: "18px",
            textAlign: "center",
            color: "var(--texto-suave)",
            fontSize: "0.82rem",
            background: "#FFFFFF",
            borderRadius: "10px",
            border: "1px dashed var(--linea-fuerte)",
          }}
        >
          Aún no hay eventos registrados en el Tracking de esta cita.
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            paddingLeft: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Línea vertical conectora */}
          <div
            style={{
              position: "absolute",
              left: "7px",
              top: "8px",
              bottom: "8px",
              width: "2px",
              background: "var(--linea-fuerte)",
            }}
          />

          {eventosLocal.map((ev, idx) => {
            const est = estiloPorTipoEvento(ev.tipo);
            const rolEst = estiloPorRol(ev.autor_rol);
            const esMasReciente = idx === 0;

            return (
              <div
                key={ev.id || `${ev.fecha}-${idx}`}
                style={{
                  position: "relative",
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  border: `1px solid ${esMasReciente ? est.bordeTarjeta : "var(--linea)"}`,
                  padding: "10px 14px",
                  boxShadow: esMasReciente ? "0 1px 3px rgba(15, 23, 42, 0.06)" : "none",
                }}
              >
                {/* Nodo circular sobre la línea de tiempo */}
                <span
                  style={{
                    position: "absolute",
                    left: "-21px",
                    top: "14px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "999px",
                    background: est.colorPunto,
                    border: "2px solid #FFFFFF",
                    boxShadow: `0 0 0 2px ${est.bordeTarjeta}`,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "6px",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        background: est.fondoBadge,
                        color: est.textoBadge,
                      }}
                    >
                      {est.etiqueta}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        background: rolEst.fondo,
                        color: rolEst.color,
                      }}
                    >
                      {rolEst.texto}: {ev.autor_nombre}
                    </span>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      color: "var(--texto-suave)",
                    }}
                  >
                    <Clock size={12} />
                    {FORMATO_FECHA_TIMELINE.format(new Date(ev.fecha))}
                  </span>
                </div>

                <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--texto)" }}>
                  {ev.resumen}
                </div>

                {ev.mensaje && (
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      background: "var(--fondo-suave)",
                      borderLeft: `3px solid ${est.colorPunto}`,
                      fontSize: "0.8rem",
                      color: "var(--texto-2)",
                    }}
                  >
                    <strong>💬 Comentario:</strong> {ev.mensaje}
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

