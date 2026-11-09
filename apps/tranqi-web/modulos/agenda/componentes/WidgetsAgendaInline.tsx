"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Loader2 } from "lucide-react";
import {
  buscarHuecosMateriaAction,
  obtenerAgendaAbogadoWidgetAction,
  obtenerAsignacionesWidgetAction,
  obtenerDatosAgendarCitaWidgetAction,
  obtenerMisCitasWidgetAction,
} from "../acciones";
import type {
  CitaCalendarioOperador,
  CitaResumen,
  RegistroHistorialAsignacion,
  ServicioAgendable,
} from "../consultas";
import type { DatosConfigNegocioAgenda } from "../esquema";
import FormularioAgendar from "./FormularioAgendar";
import ListaCitasCliente from "./ListaCitasCliente";
import BandejaCitasAbogado from "./BandejaCitasAbogado";
import MesaAsignaciones from "./MesaAsignaciones";

export function WidgetAgendarCitaInline() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<{
    materias: Array<{ mat_id: string; mat_nombre: string }>;
    servicios: ServicioAgendable[];
    cobertura: Array<{
      suscripcion_id: string;
      plan_nombre: string;
      concepto: string;
      incluidos: number | null;
      restantes: number | null;
    }>;
    configAgenda: DatosConfigNegocioAgenda;
  } | null>(null);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const res = await obtenerDatosAgendarCitaWidgetAction();
        if (!activo) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setDatos(res.data);
      } catch {
        if (activo) setError("No se pudo iniciar el asistente de agendamiento.");
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => {
      activo = false;
    };
  }, []);

  if (cargando) {
    return (
      <div
        style={{
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          color: "#475569",
        }}
      >
        <Loader2 size={28} color="#5000BA" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Cargando asistente de agendamiento…</span>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "12px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          color: "#991B1B",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}
      >
        {error ?? "No se pudieron cargar los datos de agendamiento."}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "780px", margin: "0 auto" }}>
      <FormularioAgendar
        materias={datos.materias}
        servicios={datos.servicios}
        cobertura={datos.cobertura}
        configAgenda={datos.configAgenda}
        buscarHuecos={buscarHuecosMateriaAction}
      />
    </div>
  );
}

export function WidgetMisCitasInline({ onIrAAgendar }: { onIrAAgendar?: () => void }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<CitaResumen[]>([]);
  const [cobertura, setCobertura] = useState<
    Array<{ suscripcion_id: string; concepto: string; incluidos: number | null; restantes: number | null }>
  >([]);

  const cargarMisCitas = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError(null);
    try {
      const res = await obtenerMisCitasWidgetAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCitas(res.data.citas);
      setCobertura(res.data.cobertura);
    } catch {
      setError("No se pudieron cargar tus citas programadas.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarMisCitas(false);
  }, [cargarMisCitas]);

  if (cargando) {
    return (
      <div
        style={{
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          color: "#475569",
        }}
      >
        <Loader2 size={28} color="#5000BA" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Cargando tus citas programadas…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "12px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          color: "#991B1B",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {cobertura.length > 0 && (
        <section className="agenda-cobertura">
          <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 8px 0" }}>Tu plan este mes</h3>
          <ul className="lista-detalle">
            {cobertura.map((c) => (
              <li key={`${c.suscripcion_id}-${c.concepto}`}>
                {c.concepto.toLowerCase().replaceAll("_", " ")}:{" "}
                {c.incluidos === null ? "sin límite" : `${c.restantes} de ${c.incluidos} disponibles`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ListaCitasCliente citas={citas} alActualizar={() => cargarMisCitas(true)} />

      <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: "6px" }}>
        {onIrAAgendar ? (
          <button
            type="button"
            onClick={onIrAAgendar}
            className="btn btn-primario"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
            }}
          >
            <CalendarPlus size={16} />
            Agendar consulta
          </button>
        ) : (
          <Link
            href="/panel/agendamiento?widget=agendar_cita"
            className="btn btn-primario"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CalendarPlus size={16} />
            Agendar consulta
          </Link>
        )}
      </div>
    </div>
  );
}

export function WidgetCitasProgramadasAbogadoInline({
  onIrADisponibilidad,
}: {
  onIrADisponibilidad?: () => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<CitaResumen[]>([]);
  const [sinConfigurar, setSinConfigurar] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError(null);
    try {
      const res = await obtenerAgendaAbogadoWidgetAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCitas(res.data.citas);
      setSinConfigurar(res.data.sinConfigurar);
    } catch {
      setError("No se pudo cargar tu agenda de citas.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(false);
  }, [cargar]);

  if (cargando) {
    return (
      <div
        style={{
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          color: "#475569",
        }}
      >
        <Loader2 size={28} color="#05876E" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Cargando tu agenda de los próximos 7 días…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "12px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          color: "#991B1B",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {sinConfigurar && (
        <p className="agenda-aviso">
          Todavía no has definido tus horas de atención.{" "}
          {onIrADisponibilidad ? (
            <button
              type="button"
              onClick={onIrADisponibilidad}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#5000BA",
                fontWeight: 800,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Configúralas aquí
            </button>
          ) : (
            <Link href="/panel/agendamiento?widget=disponibilidad">Configúralas aquí</Link>
          )}
          .
        </p>
      )}

      <BandejaCitasAbogado citas={citas} alActualizar={() => cargar(true)} />

      <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: "6px" }}>
        {onIrADisponibilidad ? (
          <button type="button" onClick={onIrADisponibilidad} className="btn btn-blanco-borde">
            Cambiar disponibilidad
          </button>
        ) : (
          <Link href="/panel/agendamiento?widget=disponibilidad" className="btn btn-blanco-borde">
            Cambiar disponibilidad
          </Link>
        )}
      </div>
    </div>
  );
}

export function WidgetAsignacionesAgendaInline() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<CitaCalendarioOperador[]>([]);
  const [abogados, setAbogados] = useState<Array<{ abg_id: string; nombre: string }>>([]);
  const [historialGlobal, setHistorialGlobal] = useState<RegistroHistorialAsignacion[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await obtenerAsignacionesWidgetAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCitas(res.data.citas);
      setAbogados(res.data.abogados);
      setHistorialGlobal(res.data.historialGlobal ?? []);
    } catch {
      setError("No se pudieron cargar las citas y el calendario de abogados.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div
        style={{
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          color: "#475569",
        }}
      >
        <Loader2 size={28} color="#0284C7" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
          Cargando calendario y citas de abogados…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "12px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          color: "#991B1B",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <MesaAsignaciones
      citas={citas}
      abogados={abogados}
      historialGlobal={historialGlobal}
      alActualizar={cargar}
    />
  );
}
