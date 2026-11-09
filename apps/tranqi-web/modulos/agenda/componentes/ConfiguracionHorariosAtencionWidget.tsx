"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { aMinutos, deMinutos, trocearFranja } from "@eco/agenda";
import {
  guardarConfiguracionAgendaNegocioAction,
  obtenerDatosConfiguracionAgendaAction,
} from "../acciones";
import type {
  DatosConfigNegocioAgenda,
  FechaEspecialAgenda,
  FranjaHorarioNegocio,
  RangoHoraSimple,
} from "../esquema";

interface MateriaItem {
  mat_id: string;
  mat_nombre: string;
}

interface Props {
  configInicial?: DatosConfigNegocioAgenda;
  materiasIniciales?: MateriaItem[];
}

const CLAVE_CACHE_LOCAL = "tranqi_config_horarios_negocio_v2";

const DIAS_SEMANA_NEGOCIO: Array<{ dia: number; nombre: string }> = [
  { dia: 1, nombre: "Lunes" },
  { dia: 2, nombre: "Martes" },
  { dia: 3, nombre: "Miércoles" },
  { dia: 4, nombre: "Jueves" },
  { dia: 5, nombre: "Viernes" },
  { dia: 6, nombre: "Sábado" },
  { dia: 7, nombre: "Domingo" },
];

const CONFIG_BASE_FALLBACK: DatosConfigNegocioAgenda = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 2,
  horizonte_dias: 45,
  permitir_sin_profesional: true,
  max_citas_simultaneas: 1,
  modo_capacidad: "fijo_negocio",
  direccion_presencial: "Despacho Central Tranqi · Quito, Ecuador",
  materia_defecto_nombre: "Civil",
  franjas_virtual: [
    { dia_semana: 1, hora_inicio: "08:00", hora_fin: "19:00" },
    { dia_semana: 2, hora_inicio: "08:00", hora_fin: "19:00" },
    { dia_semana: 3, hora_inicio: "08:00", hora_fin: "19:00" },
    { dia_semana: 4, hora_inicio: "08:00", hora_fin: "19:00" },
    { dia_semana: 5, hora_inicio: "08:00", hora_fin: "19:00" },
    { dia_semana: 6, hora_inicio: "09:00", hora_fin: "14:00" },
  ],
  franjas_presencial: [
    { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:30" },
    { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:30" },
    { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:30" },
    { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:30" },
    { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:30" },
  ],
  fechas_especiales: [
    {
      fecha: "2026-12-25",
      nombre: "Navidad (Solo Teleconsultas)",
      cerrado_total: false,
      habilitar_virtual: true,
      franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "16:00" }],
      habilitar_presencial: false,
      franjas_presencial: [],
      max_citas_simultaneas: 1,
    },
  ],
};

function normalizarConfiguracion(raw: Partial<DatosConfigNegocioAgenda>): DatosConfigNegocioAgenda {
  return {
    ...CONFIG_BASE_FALLBACK,
    ...raw,
    max_citas_simultaneas: Math.max(1, Math.min(50, Number(raw.max_citas_simultaneas ?? 1) || 1)),
    modo_capacidad:
      raw.modo_capacidad === "hibrido_abogados" ||
      raw.modo_capacidad === "solo_abogados" ||
      raw.modo_capacidad === "fijo_negocio"
        ? raw.modo_capacidad
        : "fijo_negocio",
    franjas_virtual:
      Array.isArray(raw.franjas_virtual) && raw.franjas_virtual.length > 0
        ? raw.franjas_virtual
        : CONFIG_BASE_FALLBACK.franjas_virtual,
    franjas_presencial:
      Array.isArray(raw.franjas_presencial) && raw.franjas_presencial.length > 0
        ? raw.franjas_presencial
        : CONFIG_BASE_FALLBACK.franjas_presencial,
    fechas_especiales: Array.isArray(raw.fechas_especiales)
      ? raw.fechas_especiales
      : CONFIG_BASE_FALLBACK.fechas_especiales,
  };
}

const inputBaseStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  padding: "8px 12px",
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "#0F172A",
  outline: "none",
};

const labelBaseStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "6px",
};

export function ConfiguracionHorariosAtencionWidget({
  configInicial,
  materiasIniciales,
}: Props) {
  const [config, setConfig] = useState<DatosConfigNegocioAgenda>(() =>
    configInicial ? normalizarConfiguracion(configInicial) : CONFIG_BASE_FALLBACK,
  );
  const [materias, setMaterias] = useState<MateriaItem[]>(materiasIniciales ?? []);
  const [cargando, setCargando] = useState(!configInicial);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  // Estado para agregar rápidamente una nueva fecha exacta diferenciada
  const [nuevaFecha, setNuevaFecha] = useState<string>("2026-12-24");
  const [nuevoNombreFecha, setNuevoNombreFecha] = useState<string>("Nochebuena (Horario Especial)");
  const [nuevoCerradoTotal, setNuevoCerradoTotal] = useState<boolean>(false);
  const [nuevoHabilitarVirtual, setNuevoHabilitarVirtual] = useState<boolean>(true);
  const [nuevoVirtualInicio, setNuevoVirtualInicio] = useState<string>("08:00");
  const [nuevoVirtualFin, setNuevoVirtualFin] = useState<string>("16:00");
  const [nuevoHabilitarPresencial, setNuevoHabilitarPresencial] = useState<boolean>(false);
  const [nuevoPresencialInicio, setNuevoPresencialInicio] = useState<string>("09:00");
  const [nuevoPresencialFin, setNuevoPresencialFin] = useState<string>("13:00");
  const [nuevoMaxCitasFecha, setNuevoMaxCitasFecha] = useState<number>(1);

  // Estado para el simulador de vista previa por fecha
  const [fechaSimulacion, setFechaSimulacion] = useState<string>("2026-12-25");

  useEffect(() => {
    if (configInicial) return;
    let cancelado = false;

    try {
      const cache = localStorage.getItem(CLAVE_CACHE_LOCAL);
      if (cache) {
        const parsed = JSON.parse(cache) as Partial<DatosConfigNegocioAgenda>;
        setConfig(normalizarConfiguracion(parsed));
      }
    } catch {
      // ignorar
    }

    async function cargar() {
      setCargando(true);
      try {
        const res = await obtenerDatosConfiguracionAgendaAction();
        if (!cancelado && res.ok) {
          const norm = normalizarConfiguracion(res.data.config);
          setConfig(norm);
          setMaterias(res.data.materias);
          try {
            localStorage.setItem(CLAVE_CACHE_LOCAL, JSON.stringify(norm));
          } catch {
            // ignorar
          }
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [configInicial]);

  function actualizarFranja(
    tipo: "virtual" | "presencial",
    indice: number,
    parcial: Partial<FranjaHorarioNegocio>,
  ) {
    setMensajeOk(null);
    setError(null);
    const clave = tipo === "virtual" ? "franjas_virtual" : "franjas_presencial";
    setConfig((prev) => ({
      ...prev,
      [clave]: prev[clave].map((f, i) => (i === indice ? { ...f, ...parcial } : f)),
    }));
  }

  function agregarFranja(tipo: "virtual" | "presencial") {
    setMensajeOk(null);
    setError(null);
    const clave = tipo === "virtual" ? "franjas_virtual" : "franjas_presencial";
    const base: FranjaHorarioNegocio =
      tipo === "virtual"
        ? { dia_semana: 1, hora_inicio: "08:00", hora_fin: "19:00" }
        : { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:30" };
    setConfig((prev) => ({
      ...prev,
      [clave]: [...prev[clave], base],
    }));
  }

  function eliminarFranja(tipo: "virtual" | "presencial", indice: number) {
    setMensajeOk(null);
    setError(null);
    const clave = tipo === "virtual" ? "franjas_virtual" : "franjas_presencial";
    setConfig((prev) => ({
      ...prev,
      [clave]: prev[clave].filter((_, i) => i !== indice),
    }));
  }

  function aplicarPresetTelematico(preset: "estandar" | "extendido") {
    setMensajeOk(null);
    setError(null);
    const nuevas: FranjaHorarioNegocio[] =
      preset === "estandar"
        ? [1, 2, 3, 4, 5]
            .map((d) => ({ dia_semana: d, hora_inicio: "08:00", hora_fin: "19:00" }))
            .concat([{ dia_semana: 6, hora_inicio: "09:00", hora_fin: "14:00" }])
        : [1, 2, 3, 4, 5, 6, 7].map((d) => ({
            dia_semana: d,
            hora_inicio: "07:00",
            hora_fin: "21:00",
          }));
    setConfig((prev) => ({ ...prev, franjas_virtual: nuevas }));
  }

  function aplicarPresetPresencial(preset: "oficina" | "con_sabado") {
    setMensajeOk(null);
    setError(null);
    const nuevas: FranjaHorarioNegocio[] =
      preset === "oficina"
        ? [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d, hora_inicio: "09:00", hora_fin: "17:30" }))
        : [1, 2, 3, 4, 5]
            .map((d) => ({ dia_semana: d, hora_inicio: "09:00", hora_fin: "17:30" }))
            .concat([{ dia_semana: 6, hora_inicio: "09:00", hora_fin: "13:00" }]);
    setConfig((prev) => ({ ...prev, franjas_presencial: nuevas }));
  }

  function agregarOActualizarFechaEspecial(item: FechaEspecialAgenda) {
    setMensajeOk(null);
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) {
      setError("Selecciona una fecha exacta válida (AAAA-MM-DD).");
      return;
    }
    if (!item.nombre.trim()) {
      setError("Ingresa un nombre o motivo para la fecha especial (ej. Navidad).");
      return;
    }
    if (
      !item.cerrado_total &&
      item.habilitar_virtual &&
      item.franjas_virtual.some((f) => f.hora_fin <= f.hora_inicio)
    ) {
      setError("En el horario telemático de la fecha especial, la hora fin debe ser mayor a la hora inicio.");
      return;
    }
    if (
      !item.cerrado_total &&
      item.habilitar_presencial &&
      item.franjas_presencial.some((f) => f.hora_fin <= f.hora_inicio)
    ) {
      setError("En el horario de oficina de la fecha especial, la hora fin debe ser mayor a la hora inicio.");
      return;
    }

    setConfig((prev) => {
      const actuales = [...(prev.fechas_especiales ?? [])];
      const idxExistente = actuales.findIndex((f) => f.fecha === item.fecha);
      if (idxExistente >= 0) {
        actuales[idxExistente] = item;
      } else {
        actuales.push(item);
      }
      actuales.sort((a, b) => a.fecha.localeCompare(b.fecha));
      return { ...prev, fechas_especiales: actuales };
    });
    setFechaSimulacion(item.fecha);
  }

  function handleAgregarDesdeFormulario() {
    agregarOActualizarFechaEspecial({
      fecha: nuevaFecha,
      nombre: nuevoNombreFecha.trim() || "Horario Especial",
      cerrado_total: nuevoCerradoTotal,
      habilitar_virtual: nuevoCerradoTotal ? false : nuevoHabilitarVirtual,
      franjas_virtual:
        !nuevoCerradoTotal && nuevoHabilitarVirtual
          ? [{ hora_inicio: nuevoVirtualInicio, hora_fin: nuevoVirtualFin }]
          : [],
      habilitar_presencial: nuevoCerradoTotal ? false : nuevoHabilitarPresencial,
      franjas_presencial:
        !nuevoCerradoTotal && nuevoHabilitarPresencial
          ? [{ hora_inicio: nuevoPresencialInicio, hora_fin: nuevoPresencialFin }]
          : [],
      max_citas_simultaneas: Math.max(1, Math.min(50, nuevoMaxCitasFecha || config.max_citas_simultaneas)),
    });
  }

  function aplicarPlantillaFechaEspecial(
    tipo: "navidad" | "nochebuena" | "fin_anio" | "anio_nuevo",
  ) {
    if (tipo === "navidad") {
      agregarOActualizarFechaEspecial({
        fecha: "2026-12-25",
        nombre: "Navidad (Solo Teleconsultas 08:00 a 16:00)",
        cerrado_total: false,
        habilitar_virtual: true,
        franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "16:00" }],
        habilitar_presencial: false,
        franjas_presencial: [],
        max_citas_simultaneas: config.max_citas_simultaneas,
      });
    } else if (tipo === "nochebuena") {
      agregarOActualizarFechaEspecial({
        fecha: "2026-12-24",
        nombre: "Nochebuena (Solo Teleconsultas 08:00 a 14:00)",
        cerrado_total: false,
        habilitar_virtual: true,
        franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "14:00" }],
        habilitar_presencial: false,
        franjas_presencial: [],
        max_citas_simultaneas: config.max_citas_simultaneas,
      });
    } else if (tipo === "fin_anio") {
      agregarOActualizarFechaEspecial({
        fecha: "2026-12-31",
        nombre: "Fin de Año (Solo Teleconsultas 08:00 a 14:00)",
        cerrado_total: false,
        habilitar_virtual: true,
        franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "14:00" }],
        habilitar_presencial: false,
        franjas_presencial: [],
        max_citas_simultaneas: config.max_citas_simultaneas,
      });
    } else {
      agregarOActualizarFechaEspecial({
        fecha: "2027-01-01",
        nombre: "Año Nuevo (Feriado Cerrado)",
        cerrado_total: true,
        habilitar_virtual: false,
        franjas_virtual: [],
        habilitar_presencial: false,
        franjas_presencial: [],
        max_citas_simultaneas: 1,
      });
    }
  }

  function actualizarFechaEspecialEnLista(
    fechaClave: string,
    parcial: Partial<FechaEspecialAgenda>,
  ) {
    setMensajeOk(null);
    setError(null);
    setConfig((prev) => ({
      ...prev,
      fechas_especiales: (prev.fechas_especiales ?? []).map((fe) =>
        fe.fecha === fechaClave ? { ...fe, ...parcial } : fe,
      ),
    }));
  }

  function actualizarRangoFechaEspecial(
    fechaClave: string,
    modalidad: "virtual" | "presencial",
    rangoIdx: number,
    parcial: Partial<RangoHoraSimple>,
  ) {
    setMensajeOk(null);
    setError(null);
    const campo = modalidad === "virtual" ? "franjas_virtual" : "franjas_presencial";
    setConfig((prev) => ({
      ...prev,
      fechas_especiales: (prev.fechas_especiales ?? []).map((fe) => {
        if (fe.fecha !== fechaClave) return fe;
        const listaActual = fe[campo] ?? [];
        const nuevaLista =
          listaActual.length === 0
            ? [{ hora_inicio: "08:00", hora_fin: "16:00", ...parcial }]
            : listaActual.map((r, i) => (i === rangoIdx ? { ...r, ...parcial } : r));
        return { ...fe, [campo]: nuevaLista };
      }),
    }));
  }

  function eliminarFechaEspecial(fechaClave: string) {
    setMensajeOk(null);
    setError(null);
    setConfig((prev) => ({
      ...prev,
      fechas_especiales: (prev.fechas_especiales ?? []).filter((fe) => fe.fecha !== fechaClave),
    }));
  }

  const simulacionDia = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaSimulacion)) {
      return null;
    }
    const [yyyy, mm, dd] = fechaSimulacion.split("-").map(Number);
    const fechaUtc = new Date(Date.UTC(yyyy ?? 2026, (mm ?? 1) - 1, dd ?? 1, 12, 0, 0));
    const jsDay = fechaUtc.getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const nombreDia =
      DIAS_SEMANA_NEGOCIO.find((d) => d.dia === isoDay)?.nombre ?? "Día";

    const reglaEspecial = (config.fechas_especiales ?? []).find(
      (f) => f.fecha === fechaSimulacion,
    );

    const duracion = config.duracion_cita_min || 45;
    const holgura = config.holgura_min ?? 15;
    const cupoEfectivo = reglaEspecial?.max_citas_simultaneas ?? config.max_citas_simultaneas ?? 1;

    let rangosVirtual: RangoHoraSimple[] = [];
    let rangosPresencial: RangoHoraSimple[] = [];

    if (reglaEspecial) {
      if (!reglaEspecial.cerrado_total) {
        if (reglaEspecial.habilitar_virtual) {
          rangosVirtual = reglaEspecial.franjas_virtual ?? [];
        }
        if (reglaEspecial.habilitar_presencial) {
          rangosPresencial = reglaEspecial.franjas_presencial ?? [];
        }
      }
    } else {
      rangosVirtual = config.franjas_virtual
        .filter((f) => f.dia_semana === isoDay)
        .map((f) => ({ hora_inicio: f.hora_inicio, hora_fin: f.hora_fin }));
      rangosPresencial = config.franjas_presencial
        .filter((f) => f.dia_semana === isoDay)
        .map((f) => ({ hora_inicio: f.hora_inicio, hora_fin: f.hora_fin }));
    }

    const generarTurnos = (rangos: RangoHoraSimple[]) => {
      const turnos: string[] = [];
      for (const r of rangos) {
        const ini = aMinutos(r.hora_inicio);
        const fin = aMinutos(r.hora_fin);
        if (fin > ini) {
          for (const b of trocearFranja(ini, fin, duracion, holgura)) {
            turnos.push(`${deMinutos(b.inicioMin)} – ${deMinutos(b.finMin)}`);
          }
        }
      }
      return turnos;
    };

    return {
      nombreDia,
      reglaEspecial,
      cupoEfectivo,
      turnosVirtual: generarTurnos(rangosVirtual),
      turnosPresencial: generarTurnos(rangosPresencial),
    };
  }, [fechaSimulacion, config]);

  function onGuardar() {
    setMensajeOk(null);
    setError(null);

    try {
      localStorage.setItem(CLAVE_CACHE_LOCAL, JSON.stringify(config));
    } catch {
      // ignorar
    }

    iniciarGuardado(async () => {
      const res = await guardarConfiguracionAgendaNegocioAction(config);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMensajeOk(
        "Disponibilidad guardada: horarios por defecto (telemático y oficina), fechas exactas y cupo máximo por hora sincronizados con la Agenda y Tranqi.",
      );
    });
  }

  if (cargando) {
    return (
      <div
        style={{
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          background: "#FFFFFF",
          padding: "24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "0.9rem",
          color: "#475569",
        }}
      >
        <Loader2 size={20} color="#5000BA" />
        <span>Cargando configuración de disponibilidad y horarios de atención…</span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "20px",
        border: "1px solid #E2E8F0",
        padding: "24px",
        boxShadow: "0 4px 16px -4px rgba(15, 23, 42, 0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%",
      }}
    >
      {/* 1. ENCABEZADO Y BOTÓN DE GUARDADO */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          paddingBottom: "18px",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", maxWidth: "740px" }}>
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              background: "#F5F3FF",
              color: "#5000BA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "1px solid #DDD6FE",
            }}
          >
            <CalendarClock size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#F5F3FF",
                  border: "1px solid #DDD6FE",
                  color: "#5000BA",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                }}
              >
                <Sparkles size={12} />
                Disponibilidad de Abogados & Motor de Agendamiento Tranqi
              </span>
            </div>
            <h2
              style={{
                margin: "0 0 4px 0",
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "#0F172A",
                letterSpacing: "-0.01em",
              }}
            >
              Horarios de Atención (Telemático y Oficina), Fechas Especiales y Cupo por Hora
            </h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B", lineHeight: 1.45 }}>
              Configura el horario laborable normal por defecto, excepciones por fechas exactas (ej.
              Navidad) y el número máximo de citas permitidas en la misma fecha y hora.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando}
          title="Guardar configuración de disponibilidad y horarios"
          aria-label="Guardar configuración de disponibilidad y horarios"
          className="btn-responsive-accion"
          style={{
            background: "var(--violeta, #5000BA)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "12px",
            padding: "10px 18px",
            fontSize: "0.86rem",
            fontWeight: 700,
            cursor: guardando ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(80, 0, 186, 0.22)",
            opacity: guardando ? 0.75 : 1,
          }}
        >
          {guardando ? <Loader2 size={16} /> : <Save size={16} />}
          <span className="btn-texto-responsive">
            {guardando ? "Guardando…" : "Guardar Horarios"}
          </span>
        </button>
      </div>

      {/* ALERTAS DE ÉXITO O ERROR */}
      {mensajeOk && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderRadius: "12px",
            border: "1px solid #86EFAC",
            background: "#F0FDF4",
            padding: "12px 16px",
            fontSize: "0.86rem",
            fontWeight: 600,
            color: "#166534",
          }}
        >
          <CheckCircle2 size={18} color="#16A34A" />
          <span>{mensajeOk}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderRadius: "12px",
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            padding: "12px 16px",
            fontSize: "0.86rem",
            fontWeight: 600,
            color: "#991B1B",
          }}
        >
          <AlertCircle size={18} color="#DC2626" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. PARÁMETRO DE CUPO MÁXIMO POR FECHA/HORA Y ESTRATEGIA DE CAPACIDAD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          background: "linear-gradient(135deg, #F5F3FF 0%, #F8FAFC 100%)",
          border: "1.5px solid #DDD6FE",
          borderRadius: "16px",
          padding: "18px",
        }}
      >
        {/* Tarjeta Izquierda: Máximo de citas en la misma fecha y hora */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E9D5FF",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
            boxShadow: "0 2px 6px rgba(80, 0, 186, 0.04)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#5000BA",
                marginBottom: "4px",
              }}
            >
              <Users size={15} />
              <span>Control de Concurrencia por Turno</span>
            </div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "1rem", fontWeight: 800, color: "#0F172A" }}>
              Máximo de citas en la misma fecha y hora
            </h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B", lineHeight: 1.45 }}>
              Por defecto <strong>1 sola cita</strong> por bloque horario. Cuando se reserva ese
              cupo, la fecha/hora se bloquea automáticamente para otros clientes.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #F1F5F9",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    max_citas_simultaneas: Math.max(1, (prev.max_citas_simultaneas || 1) - 1),
                  }))
                }
                title="Reducir cupo máximo por hora"
                aria-label="Reducir cupo máximo por hora"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Minus size={15} />
              </button>

              <input
                type="number"
                min={1}
                max={50}
                aria-label="Número máximo de citas en la misma fecha y hora"
                value={config.max_citas_simultaneas}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_citas_simultaneas: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                  }))
                }
                style={{
                  width: "64px",
                  height: "34px",
                  borderRadius: "10px",
                  border: "1.5px solid #5000BA",
                  background: "#F5F3FF",
                  textAlign: "center",
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "#3B0087",
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    max_citas_simultaneas: Math.min(50, (prev.max_citas_simultaneas || 1) + 1),
                  }))
                }
                title="Aumentar cupo máximo por hora"
                aria-label="Aumentar cupo máximo por hora"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Plus size={15} />
              </button>

              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>
                {config.max_citas_simultaneas === 1
                  ? "cita por hora (Por defecto)"
                  : "citas simultáneas"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {[1, 2, 3].map((n) => {
                const activo = config.max_citas_simultaneas === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, max_citas_simultaneas: n }))}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: activo ? "1px solid #5000BA" : "1px solid #CBD5E1",
                      background: activo ? "#5000BA" : "#F8FAFC",
                      color: activo ? "#FFFFFF" : "#475569",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {n} {n === 1 ? "cita" : "citas"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tarjeta Derecha: Modo de Disponibilidad Operativa y Especialidad ARIA */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E2E8F0",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            <div>
              <label htmlFor="select-modo-capacidad" style={labelBaseStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <ShieldCheck size={14} color="#05876E" />
                  Modo de Disponibilidad Operativa
                </span>
              </label>
              <select
                id="select-modo-capacidad"
                value={config.modo_capacidad}
                onChange={(e) => {
                  const val = e.target.value as DatosConfigNegocioAgenda["modo_capacidad"];
                  setConfig((prev) => ({
                    ...prev,
                    modo_capacidad: val,
                    permitir_sin_profesional: val !== "solo_abogados",
                  }));
                }}
                style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
              >
                <option value="fijo_negocio">
                  1. Horario Base Tranqi (Cupo fijo por hora, sin requerir horario de socios)
                </option>
                <option value="hibrido_abogados">
                  2. Híbrido Inteligente (Horario Base Tranqi + Suma de Socios Abogados libres)
                </option>
                <option value="solo_abogados">
                  3. Exclusivo Socios Abogados (Solo cuando un socio tenga agenda abierta)
                </option>
              </select>
            </div>

            <div>
              <label htmlFor="select-materia-defecto" style={labelBaseStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <Sparkles size={14} color="#5000BA" />
                  Especialidad por defecto (Tranqi)
                </span>
              </label>
              <select
                id="select-materia-defecto"
                value={config.materia_defecto_nombre}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, materia_defecto_nombre: e.target.value }))
                }
                style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
              >
                {materias.length > 0 ? (
                  materias.map((m) => (
                    <option key={m.mat_id} value={m.mat_nombre}>
                      {m.mat_nombre}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Civil">Civil</option>
                    <option value="Familia y Niñez">Familia y Niñez</option>
                    <option value="Laboral">Laboral</option>
                    <option value="Arrendamiento e Inquilinato">Arrendamiento e Inquilinato</option>
                    <option value="Penal">Penal</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "0.78rem",
              color: "#475569",
              lineHeight: 1.5,
            }}
          >
            {config.modo_capacidad === "fijo_negocio" && (
              <span>
                <strong>Modo actual (Recomendado en etapa inicial):</strong> Los clientes agendan y
                pagan dentro del <strong>Horario Laborable Normal</strong> (o el{" "}
                <strong>Horario de Fecha Exacta</strong> como Navidad), respetando el límite de{" "}
                <strong>{config.max_citas_simultaneas} cita(s) por bloque horario</strong>. Las
                citas quedan confirmadas y listas para asignación de socio abogado.
              </span>
            )}
            {config.modo_capacidad === "hibrido_abogados" && (
              <span>
                <strong>Modo Híbrido:</strong> Mantiene garantizado el horario por defecto de Tranqi
                con mínimo <strong>{config.max_citas_simultaneas} cita(s)</strong>, y si más socios
                abogados configuran su agenda en la misma hora, amplía automáticamente el cupo.
              </span>
            )}
            {config.modo_capacidad === "solo_abogados" && (
              <span>
                <strong>Modo Exclusivo Socios:</strong> Solo ofrece en el calendario las horas que
                los socios abogados verificados hayan habilitado individualmente.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. HORARIO LABORABLE NORMAL (POR DEFECTO — EDITABLE): TELEMÁTICO Y OFICINA */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
            1. Horario Laborable Normal (Por Defecto — Editable)
          </h3>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748B" }}>
            Se aplica todos los días del año salvo en las fechas exactas que tengan un horario
            diferenciado configurado en la sección 2.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "18px",
          }}
        >
          {/* COLUMNA 1: HORARIO NORMAL CONSULTAS TELEMÁTICAS */}
          <section
            style={{
              borderRadius: "16px",
              border: "1px solid #DDD6FE",
              background: "#FAF8FF",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#5000BA",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Video size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#0F172A" }}>
                    Horario Normal — Consultas Telemáticas
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                    Videollamada (Por defecto Lun–Vie 08:00 a 19:00, Sáb 09:00 a 14:00)
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => aplicarPresetTelematico("estandar")}
                  title="Restaurar horario telemático estándar Lun-Sáb"
                  aria-label="Restaurar horario telemático estándar Lun-Sáb"
                  className="btn-responsive-accion"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={13} />
                  <span className="btn-texto-responsive">Por Defecto</span>
                </button>
                <button
                  type="button"
                  onClick={() => agregarFranja("virtual")}
                  title="Añadir franja telemática"
                  aria-label="Añadir franja telemática"
                  className="btn-responsive-accion"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#5000BA",
                    padding: "6px 12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  <span className="btn-texto-responsive">Añadir Día</span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {config.franjas_virtual.map((f, idx) => (
                <div
                  key={`virt-${idx}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    padding: "8px 12px",
                  }}
                >
                  <select
                    aria-label="Día de la semana telemático"
                    value={f.dia_semana}
                    onChange={(e) =>
                      actualizarFranja("virtual", idx, { dia_semana: Number(e.target.value) })
                    }
                    style={{
                      ...inputBaseStyle,
                      flex: "1 1 120px",
                      minWidth: "120px",
                      background: "#F8FAFC",
                      padding: "6px 10px",
                    }}
                  >
                    {DIAS_SEMANA_NEGOCIO.map((d) => (
                      <option key={d.dia} value={d.dia}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#475569" }}>
                    <Clock size={14} color="#5000BA" />
                    <input
                      type="time"
                      aria-label="Hora inicio telemático"
                      value={f.hora_inicio}
                      onChange={(e) =>
                        actualizarFranja("virtual", idx, { hora_inicio: e.target.value })
                      }
                      style={{ ...inputBaseStyle, padding: "5px 8px" }}
                    />
                    <span style={{ fontWeight: 600 }}>a</span>
                    <input
                      type="time"
                      aria-label="Hora fin telemático"
                      value={f.hora_fin}
                      onChange={(e) =>
                        actualizarFranja("virtual", idx, { hora_fin: e.target.value })
                      }
                      style={{ ...inputBaseStyle, padding: "5px 8px" }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminarFranja("virtual", idx)}
                    disabled={config.franjas_virtual.length <= 1}
                    title="Eliminar franja telemática"
                    aria-label="Eliminar franja telemática"
                    style={{
                      border: "1px solid #FEE2E2",
                      background: "#FFF1F2",
                      color: "#E11D48",
                      borderRadius: "8px",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: config.franjas_virtual.length <= 1 ? "not-allowed" : "pointer",
                      opacity: config.franjas_virtual.length <= 1 ? 0.35 : 1,
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* COLUMNA 2: HORARIO NORMAL CONSULTAS EN OFICINA (PRESENCIAL) */}
          <section
            style={{
              borderRadius: "16px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#0F172A",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#0F172A" }}>
                    Horario Normal — Consultas en Oficina
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                    Atención presencial en despacho (Por defecto Lun–Vie 09:00 a 17:30)
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => aplicarPresetPresencial("oficina")}
                  title="Restaurar horario de oficina Lun-Vie"
                  aria-label="Restaurar horario de oficina Lun-Vie"
                  className="btn-responsive-accion"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <RotateCcw size={13} />
                  <span className="btn-texto-responsive">Por Defecto</span>
                </button>
                <button
                  type="button"
                  onClick={() => agregarFranja("presencial")}
                  title="Añadir franja de oficina"
                  aria-label="Añadir franja de oficina"
                  className="btn-responsive-accion"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0F172A",
                    padding: "6px 12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  <span className="btn-texto-responsive">Añadir Día</span>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {config.franjas_presencial.map((f, idx) => (
                <div
                  key={`pres-${idx}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    background: "#FFFFFF",
                    padding: "8px 12px",
                  }}
                >
                  <select
                    aria-label="Día de la semana oficina"
                    value={f.dia_semana}
                    onChange={(e) =>
                      actualizarFranja("presencial", idx, { dia_semana: Number(e.target.value) })
                    }
                    style={{
                      ...inputBaseStyle,
                      flex: "1 1 120px",
                      minWidth: "120px",
                      background: "#F8FAFC",
                      padding: "6px 10px",
                    }}
                  >
                    {DIAS_SEMANA_NEGOCIO.map((d) => (
                      <option key={d.dia} value={d.dia}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#475569" }}>
                    <Clock size={14} color="#0F172A" />
                    <input
                      type="time"
                      aria-label="Hora inicio oficina"
                      value={f.hora_inicio}
                      onChange={(e) =>
                        actualizarFranja("presencial", idx, { hora_inicio: e.target.value })
                      }
                      style={{ ...inputBaseStyle, padding: "5px 8px" }}
                    />
                    <span style={{ fontWeight: 600 }}>a</span>
                    <input
                      type="time"
                      aria-label="Hora fin oficina"
                      value={f.hora_fin}
                      onChange={(e) =>
                        actualizarFranja("presencial", idx, { hora_fin: e.target.value })
                      }
                      style={{ ...inputBaseStyle, padding: "5px 8px" }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminarFranja("presencial", idx)}
                    disabled={config.franjas_presencial.length <= 1}
                    title="Eliminar franja de oficina"
                    aria-label="Eliminar franja de oficina"
                    style={{
                      border: "1px solid #FEE2E2",
                      background: "#FFF1F2",
                      color: "#E11D48",
                      borderRadius: "8px",
                      width: "32px",
                      height: "32px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: config.franjas_presencial.length <= 1 ? "not-allowed" : "pointer",
                      opacity: config.franjas_presencial.length <= 1 ? 0.35 : 1,
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ paddingTop: "6px" }}>
              <label htmlFor="input-direccion-presencial" style={labelBaseStyle}>
                Dirección de la Oficina para Consultas Presenciales
              </label>
              <input
                id="input-direccion-presencial"
                type="text"
                value={config.direccion_presencial ?? ""}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, direccion_presencial: e.target.value }))
                }
                placeholder="Ej.: Av. República del Salvador y Moscú, Edificio Tranqi, Piso 5"
                style={{ ...inputBaseStyle, width: "100%" }}
              />
            </div>
          </section>
        </div>
      </div>

      {/* 4. HORARIOS DIFERENCIADOS POR FECHAS EXACTAS (EJ. NAVIDAD, FERIADOS) */}
      <section
        style={{
          borderRadius: "16px",
          border: "1.5px solid #FDE68A",
          background: "#FFFBEB",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div style={{ maxWidth: "680px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#B45309",
                marginBottom: "4px",
              }}
            >
              <CalendarPlus size={15} />
              <span>Excepciones al Horario por Defecto</span>
            </div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
              2. Horarios Diferenciados por Fechas Exactas (Navidad, Feriados, Jornadas Especiales)
            </h3>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#78350F", lineHeight: 1.45 }}>
              Si ingresas una fecha exacta aquí, su configuración reemplaza al horario normal en ese
              día (por ejemplo: en Navidad <strong>2026-12-25</strong> habilitar solo teleconsultas
              de <strong>08:00 a 16:00</strong> y cerrar oficina).
            </p>
          </div>

          {/* Plantillas rápidas de 1 clic */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("navidad")}
              title="Configurar 25 de Diciembre: Solo Teleconsultas 08:00 a 16:00"
              aria-label="Configurar Navidad 25 de Diciembre"
              style={{
                borderRadius: "10px",
                border: "1px solid #F59E0B",
                background: "#FFFFFF",
                padding: "7px 12px",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#92400E",
                cursor: "pointer",
              }}
            >
              🎄 Navidad (25 Dic · Tele 08h–16h)
            </button>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("nochebuena")}
              title="Configurar 24 de Diciembre: Solo Teleconsultas 08:00 a 14:00"
              aria-label="Configurar Nochebuena 24 de Diciembre"
              style={{
                borderRadius: "10px",
                border: "1px solid #F59E0B",
                background: "#FFFFFF",
                padding: "7px 12px",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#92400E",
                cursor: "pointer",
              }}
            >
              🎅 Nochebuena (24 Dic)
            </button>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("fin_anio")}
              title="Configurar 31 de Diciembre: Solo Teleconsultas 08:00 a 14:00"
              aria-label="Configurar Fin de Año 31 de Diciembre"
              style={{
                borderRadius: "10px",
                border: "1px solid #F59E0B",
                background: "#FFFFFF",
                padding: "7px 12px",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#92400E",
                cursor: "pointer",
              }}
            >
              🎆 Fin de Año (31 Dic)
            </button>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("anio_nuevo")}
              title="Configurar 1 de Enero como feriado cerrado"
              aria-label="Configurar Año Nuevo Cerrado"
              style={{
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                padding: "7px 12px",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              🛑 01 Ene (Cerrado)
            </button>
          </div>
        </div>

        {/* Formulario para agregar nueva fecha exacta */}
        <div
          style={{
            borderRadius: "14px",
            border: "1px solid #FCD34D",
            background: "#FFFFFF",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0F172A" }}>
            Agregar o actualizar horario diferenciado para una fecha exacta:
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div>
              <label style={labelBaseStyle}>Fecha Exacta</label>
              <input
                type="date"
                aria-label="Fecha exacta especial"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
              />
            </div>

            <div>
              <label style={labelBaseStyle}>Motivo / Etiqueta</label>
              <input
                type="text"
                aria-label="Motivo o etiqueta de la fecha especial"
                value={nuevoNombreFecha}
                onChange={(e) => setNuevoNombreFecha(e.target.value)}
                placeholder="Ej. Navidad — Solo Teleconsultas"
                style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
              />
            </div>

            <div>
              <label
                style={{
                  ...labelBaseStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#5000BA",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!nuevoCerradoTotal && nuevoHabilitarVirtual}
                  disabled={nuevoCerradoTotal}
                  onChange={(e) => setNuevoHabilitarVirtual(e.target.checked)}
                />
                <span>Teleconsulta en esta fecha</span>
              </label>
              {!nuevoCerradoTotal && nuevoHabilitarVirtual ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="time"
                    aria-label="Hora inicio teleconsulta fecha especial"
                    value={nuevoVirtualInicio}
                    onChange={(e) => setNuevoVirtualInicio(e.target.value)}
                    style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                  />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>a</span>
                  <input
                    type="time"
                    aria-label="Hora fin teleconsulta fecha especial"
                    value={nuevoVirtualFin}
                    onChange={(e) => setNuevoVirtualFin(e.target.value)}
                    style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#F1F5F9",
                    padding: "8px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#64748B",
                  }}
                >
                  Sin teleconsulta
                </div>
              )}
            </div>

            <div>
              <label
                style={{
                  ...labelBaseStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#0F172A",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!nuevoCerradoTotal && nuevoHabilitarPresencial}
                  disabled={nuevoCerradoTotal}
                  onChange={(e) => setNuevoHabilitarPresencial(e.target.checked)}
                />
                <span>Oficina abierta</span>
              </label>
              {!nuevoCerradoTotal && nuevoHabilitarPresencial ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="time"
                    aria-label="Hora inicio oficina fecha especial"
                    value={nuevoPresencialInicio}
                    onChange={(e) => setNuevoPresencialInicio(e.target.value)}
                    style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                  />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>a</span>
                  <input
                    type="time"
                    aria-label="Hora fin oficina fecha especial"
                    value={nuevoPresencialFin}
                    onChange={(e) => setNuevoPresencialFin(e.target.value)}
                    style={{ ...inputBaseStyle, width: "100%", padding: "6px 8px" }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    background: "#F1F5F9",
                    padding: "8px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#64748B",
                  }}
                >
                  Oficina cerrada
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <div style={{ width: "90px" }}>
                <label style={labelBaseStyle} title="Máximo de citas por hora en esta fecha">
                  Máx/Hora
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  aria-label="Cupo máximo por hora en esta fecha especial"
                  value={nuevoMaxCitasFecha}
                  onChange={(e) => setNuevoMaxCitasFecha(Math.max(1, Number(e.target.value) || 1))}
                  style={{ ...inputBaseStyle, width: "100%", textAlign: "center", background: "#F8FAFC" }}
                />
              </div>

              <button
                type="button"
                onClick={handleAgregarDesdeFormulario}
                title="Agregar fecha especial a la lista"
                aria-label="Agregar fecha especial"
                className="btn-responsive-accion"
                style={{
                  flex: 1,
                  height: "38px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#D97706",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Plus size={15} />
                <span className="btn-texto-responsive">Añadir</span>
              </button>
            </div>
          </div>

          <div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={nuevoCerradoTotal}
                onChange={(e) => setNuevoCerradoTotal(e.target.checked)}
              />
              <span>Marcar esta fecha como Feriado Cerrado Total (sin teleconsulta ni oficina)</span>
            </label>
          </div>
        </div>

        {/* Lista de fechas exactas configuradas */}
        {(config.fechas_especiales ?? []).length === 0 ? (
          <div
            style={{
              borderRadius: "12px",
              border: "1px dashed #F59E0B",
              background: "#FFFFFF",
              padding: "16px",
              textAlign: "center",
              fontSize: "0.82rem",
              color: "#64748B",
            }}
          >
            No hay fechas exactas diferenciadas configuradas. Todos los días usan el horario
            laborable normal por defecto.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(config.fechas_especiales ?? []).map((fe) => {
              const rVirt = fe.franjas_virtual?.[0] ?? { hora_inicio: "08:00", hora_fin: "16:00" };
              const rPres = fe.franjas_presencial?.[0] ?? { hora_inicio: "09:00", hora_fin: "13:00" };

              return (
                <div
                  key={fe.fecha}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    borderRadius: "14px",
                    border: "1px solid #FDE68A",
                    background: "#FFFFFF",
                    padding: "12px 16px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "10px",
                        background: "#FEF3C7",
                        border: "1px solid #FCD34D",
                        padding: "5px 10px",
                        fontSize: "0.8rem",
                        fontWeight: 800,
                        color: "#92400E",
                      }}
                    >
                      <Calendar size={14} color="#D97706" />
                      {fe.fecha}
                    </span>
                    <input
                      type="text"
                      aria-label={`Nombre para la fecha ${fe.fecha}`}
                      value={fe.nombre}
                      onChange={(e) =>
                        actualizarFechaEspecialEnLista(fe.fecha, { nombre: e.target.value })
                      }
                      style={{
                        ...inputBaseStyle,
                        minWidth: "220px",
                        background: "#F8FAFC",
                        padding: "6px 10px",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                    {/* Cierre Total */}
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#BE123C",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={fe.cerrado_total}
                        onChange={(e) =>
                          actualizarFechaEspecialEnLista(fe.fecha, {
                            cerrado_total: e.target.checked,
                          })
                        }
                      />
                      <span>Cerrado Total</span>
                    </label>

                    {!fe.cerrado_total && (
                      <>
                        {/* Teleconsulta */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            borderRadius: "10px",
                            border: "1px solid #DDD6FE",
                            background: "#F5F3FF",
                            padding: "5px 10px",
                          }}
                        >
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              color: "#4C1D95",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={fe.habilitar_virtual}
                              onChange={(e) =>
                                actualizarFechaEspecialEnLista(fe.fecha, {
                                  habilitar_virtual: e.target.checked,
                                  franjas_virtual:
                                    e.target.checked && (!fe.franjas_virtual || fe.franjas_virtual.length === 0)
                                      ? [{ hora_inicio: "08:00", hora_fin: "16:00" }]
                                      : fe.franjas_virtual,
                                })
                              }
                            />
                            <span>Teleconsulta:</span>
                          </label>
                          {fe.habilitar_virtual ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <input
                                type="time"
                                aria-label={`Hora inicio teleconsulta en ${fe.fecha}`}
                                value={rVirt.hora_inicio}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "virtual", 0, {
                                    hora_inicio: e.target.value,
                                  })
                                }
                                style={{ ...inputBaseStyle, padding: "3px 6px", fontSize: "0.78rem" }}
                              />
                              <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>a</span>
                              <input
                                type="time"
                                aria-label={`Hora fin teleconsulta en ${fe.fecha}`}
                                value={rVirt.hora_fin}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "virtual", 0, {
                                    hora_fin: e.target.value,
                                  })
                                }
                                style={{ ...inputBaseStyle, padding: "3px 6px", fontSize: "0.78rem" }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8" }}>
                              No
                            </span>
                          )}
                        </div>

                        {/* Oficina */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            borderRadius: "10px",
                            border: "1px solid #E2E8F0",
                            background: "#F8FAFC",
                            padding: "5px 10px",
                          }}
                        >
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              color: "#1E293B",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={fe.habilitar_presencial}
                              onChange={(e) =>
                                actualizarFechaEspecialEnLista(fe.fecha, {
                                  habilitar_presencial: e.target.checked,
                                  franjas_presencial:
                                    e.target.checked &&
                                    (!fe.franjas_presencial || fe.franjas_presencial.length === 0)
                                      ? [{ hora_inicio: "09:00", hora_fin: "13:00" }]
                                      : fe.franjas_presencial,
                                })
                              }
                            />
                            <span>Oficina:</span>
                          </label>
                          {fe.habilitar_presencial ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <input
                                type="time"
                                aria-label={`Hora inicio oficina en ${fe.fecha}`}
                                value={rPres.hora_inicio}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "presencial", 0, {
                                    hora_inicio: e.target.value,
                                  })
                                }
                                style={{ ...inputBaseStyle, padding: "3px 6px", fontSize: "0.78rem" }}
                              />
                              <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>a</span>
                              <input
                                type="time"
                                aria-label={`Hora fin oficina en ${fe.fecha}`}
                                value={rPres.hora_fin}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "presencial", 0, {
                                    hora_fin: e.target.value,
                                  })
                                }
                                style={{ ...inputBaseStyle, padding: "3px 6px", fontSize: "0.78rem" }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#E11D48" }}>
                              Cerrada
                            </span>
                          )}
                        </div>

                        {/* Cupo máximo en esa fecha */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "#334155" }}>
                          <span style={{ fontWeight: 700 }}>Máx/hora:</span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            aria-label={`Máximo citas por hora en ${fe.fecha}`}
                            value={fe.max_citas_simultaneas ?? config.max_citas_simultaneas}
                            onChange={(e) =>
                              actualizarFechaEspecialEnLista(fe.fecha, {
                                max_citas_simultaneas: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            style={{
                              ...inputBaseStyle,
                              width: "52px",
                              padding: "4px 6px",
                              textAlign: "center",
                            }}
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setFechaSimulacion(fe.fecha)}
                      title="Ver vista previa de turnos en esta fecha"
                      aria-label="Ver vista previa de turnos en esta fecha"
                      style={{
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      <Eye size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarFechaEspecial(fe.fecha)}
                      title="Eliminar excepción de fecha"
                      aria-label="Eliminar excepción de fecha"
                      style={{
                        borderRadius: "8px",
                        border: "1px solid #FEE2E2",
                        background: "#FFF1F2",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#E11D48",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. SIMULADOR / VERIFICADOR DE TURNOS POR FECHA EXACTA */}
      <section
        style={{
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          background: "#F8FAFC",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Eye size={18} color="#5000BA" />
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
              3. Simulador de Horarios por Fecha (Comprobación en Vivo)
            </h3>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="sim-fecha" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
              Probar fecha:
            </label>
            <input
              id="sim-fecha"
              type="date"
              value={fechaSimulacion}
              onChange={(e) => setFechaSimulacion(e.target.value)}
              style={{ ...inputBaseStyle, padding: "6px 10px" }}
            />
          </div>
        </div>

        {simulacionDia && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "#64748B",
                }}
              >
                Regla Aplicada ({simulacionDia.nombreDia} {fechaSimulacion})
              </div>
              {simulacionDia.reglaEspecial ? (
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#B45309" }}>
                  ✨ Fecha Especial: {simulacionDia.reglaEspecial.nombre}
                </div>
              ) : (
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#0F172A" }}>
                  📅 Horario Laborable Normal (Por defecto)
                </div>
              )}
              <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                Cupo máximo por bloque:{" "}
                <strong style={{ color: "#5000BA" }}>
                  {simulacionDia.cupoEfectivo}{" "}
                  {simulacionDia.cupoEfectivo === 1 ? "cita" : "citas"}
                </strong>
              </div>
            </div>

            <div
              style={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#5000BA" }}>
                Turnos Telemáticos ({simulacionDia.turnosVirtual.length})
              </div>
              {simulacionDia.turnosVirtual.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#94A3B8", fontWeight: 600 }}>
                  Sin atención telemática en esta fecha
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "110px", overflowY: "auto" }}>
                  {simulacionDia.turnosVirtual.map((t) => (
                    <span
                      key={t}
                      style={{
                        borderRadius: "6px",
                        background: "#F5F3FF",
                        border: "1px solid #DDD6FE",
                        padding: "3px 8px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#4C1D95",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#0F172A" }}>
                Turnos en Oficina ({simulacionDia.turnosPresencial.length})
              </div>
              {simulacionDia.turnosPresencial.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#E11D48", fontWeight: 700 }}>
                  Oficina cerrada (Solo teleconsulta o feriado)
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "110px", overflowY: "auto" }}>
                  {simulacionDia.turnosPresencial.map((t) => (
                    <span
                      key={t}
                      style={{
                        borderRadius: "6px",
                        background: "#F1F5F9",
                        border: "1px solid #CBD5E1",
                        padding: "3px 8px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#1E293B",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 6. PARÁMETROS DE DURACIÓN, HOLGURA Y HORIZONTE */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          paddingTop: "14px",
          borderTop: "1px solid #F1F5F9",
        }}
      >
        <div>
          <label htmlFor="cfg-duracion" style={labelBaseStyle}>
            Duración cita (min)
          </label>
          <input
            id="cfg-duracion"
            type="number"
            min={15}
            max={180}
            step={5}
            value={config.duracion_cita_min}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, duracion_cita_min: Number(e.target.value) || 45 }))
            }
            style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
          />
        </div>
        <div>
          <label htmlFor="cfg-holgura" style={labelBaseStyle}>
            Descanso entre citas (min)
          </label>
          <input
            id="cfg-holgura"
            type="number"
            min={0}
            max={60}
            step={5}
            value={config.holgura_min}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, holgura_min: Number(e.target.value) || 0 }))
            }
            style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
          />
        </div>
        <div>
          <label htmlFor="cfg-antelacion" style={labelBaseStyle}>
            Antelación mínima (horas)
          </label>
          <input
            id="cfg-antelacion"
            type="number"
            min={0}
            max={168}
            value={config.antelacion_minima_horas}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                antelacion_minima_horas: Number(e.target.value) || 0,
              }))
            }
            style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
          />
        </div>
        <div>
          <label htmlFor="cfg-horizonte" style={labelBaseStyle}>
            Horizonte abierto (días)
          </label>
          <input
            id="cfg-horizonte"
            type="number"
            min={1}
            max={180}
            value={config.horizonte_dias}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, horizonte_dias: Number(e.target.value) || 45 }))
            }
            style={{ ...inputBaseStyle, width: "100%", background: "#F8FAFC" }}
          />
        </div>
      </div>
    </div>
  );
}
