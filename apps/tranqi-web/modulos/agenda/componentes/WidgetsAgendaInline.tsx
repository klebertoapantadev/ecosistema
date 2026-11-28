"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
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
import { obtenerTramitesPedidosAction } from "../../tramites/acciones";
import type { TramiteCatalogo, TramitePedido } from "../../tramites/esquema";
import ListaTramitesPedidos from "../../tramites/componentes/ListaTramitesPedidos";

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
    tramites: TramiteCatalogo[];
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
          color: "var(--texto-2)",
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
          background: "var(--error-diluido)",
          border: "1px solid var(--error-linea)",
          color: "var(--error-texto)",
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
        // Mismo recorrido que el inicio (TRQ-043): trámite o cita, según lo que cuente.
        variante="recorrido"
        tramites={datos.tramites}
      />
    </div>
  );
}

type FiltroNecesidades = "todas" | "tramites" | "citas";

/**
 * «Mis necesidades» del cliente (TRQ-043): los trámites que pidió y sus citas.
 * La clave del widget sigue siendo `mis_citas` para no tocar la configuración de roles.
 */
export function WidgetMisCitasInline({ onIrAAgendar }: { onIrAAgendar?: () => void }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [citas, setCitas] = useState<CitaResumen[]>([]);
  const [tramites, setTramites] = useState<TramitePedido[]>([]);
  const [filtro, setFiltro] = useState<FiltroNecesidades>("todas");
  const [falloTramites, setFalloTramites] = useState(false);
  const [cobertura, setCobertura] = useState<
    Array<{ suscripcion_id: string; concepto: string; incluidos: number | null; restantes: number | null }>
  >([]);

  const cargarMisCitas = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError(null);
    try {
      const [res, resTramites] = await Promise.all([
        obtenerMisCitasWidgetAction(),
        obtenerTramitesPedidosAction().catch(() => null),
      ]);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCitas(res.data.citas);
      setCobertura(res.data.cobertura);
      // Si fallan los trámites, las citas se siguen mostrando y se avisa del fallo.
      setFalloTramites(!resTramites?.ok);
      if (resTramites?.ok) setTramites(resTramites.data);
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
          color: "var(--texto-2)",
        }}
      >
        <Loader2 size={28} color="#5000BA" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Cargando tus necesidades…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "20px",
          borderRadius: "12px",
          background: "var(--error-diluido)",
          border: "1px solid var(--error-linea)",
          color: "var(--error-texto)",
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

      <div className="necesidades-filtros" role="group" aria-label="Filtrar">
        {(
          [
            ["todas", "Todas", tramites.length + citas.length],
            ["tramites", "Trámites", tramites.length],
            ["citas", "Citas", citas.length],
          ] as const
        ).map(([clave, etiqueta, total]) => (
          <button key={clave} type="button" aria-pressed={filtro === clave} onClick={() => setFiltro(clave)}>
            {etiqueta}
            <small>{total}</small>
          </button>
        ))}
      </div>

      {filtro !== "citas" && (
        <section>
          <h3 className="necesidades-seccion-titulo">Trámites</h3>
          {falloTramites ? (
            <p className="estado-vacio">No pudimos cargar tus trámites. Vuelve a intentarlo en un momento.</p>
          ) : tramites.length > 0 ? (
            <ListaTramitesPedidos tramites={tramites} />
          ) : (
            <p className="estado-vacio">Aún no has pedido ningún trámite.</p>
          )}
        </section>
      )}

      {filtro !== "tramites" && (
        <section>
          <h3 className="necesidades-seccion-titulo">Citas</h3>
          <ListaCitasCliente citas={citas} alActualizar={() => cargarMisCitas(true)} />
        </section>
      )}

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
            <Plus size={16} />
            Resolver otra necesidad
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
            <Plus size={16} />
            Resolver otra necesidad
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
          color: "var(--texto-2)",
        }}
      >
        <Loader2 size={28} color="#0E6648" style={{ animation: "spin 1s linear infinite" }} />
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
          background: "var(--error-diluido)",
          border: "1px solid var(--error-linea)",
          color: "var(--error-texto)",
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
                color: "var(--ct-5000ba, #5000BA)",
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
          color: "var(--texto-2)",
        }}
      >
        <Loader2 size={28} color="var(--acento)" style={{ animation: "spin 1s linear infinite" }} />
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
          background: "var(--error-diluido)",
          border: "1px solid var(--error-linea)",
          color: "var(--error-texto)",
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
