"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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

    // 1. Carga inmediata desde caché local (Resiliencia Híbrida)
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
            // ignorar almacenamiento lleno
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

  // ── Gestión de Horarios Semanales Normales (Por Defecto) ──

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

  // ── Gestión de Fechas Exactas con Horario Diferenciado ──

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

  // ── Simulador en vivo para comprobar el horario efectivo de cualquier fecha ──

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
        "Disponibilidad guardada: horarios por defecto (telemático y oficina), fechas exactas y cupo máximo por hora sincronizados con la Agenda y ARIA.",
      );
    });
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-3 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        Cargando configuración de disponibilidad y horarios de atención…
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      {/* 1. ENCABEZADO Y ACCIÓN DE GUARDADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-3 py-0.5 text-xs font-bold text-violet-700">
            <CalendarClock className="h-3.5 w-3.5" />
            Disponibilidad de Abogados & Motor de Agendamiento ARIA
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Horarios de Atención (Telemático y Oficina), Fechas Especiales y Cupo por Hora
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Configura el horario laborable normal por defecto, excepciones por fechas exactas (ej.
            Navidad) y el número máximo de citas permitidas en la misma fecha y hora.
          </p>
        </div>

        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando}
          title="Guardar configuración de disponibilidad y horarios"
          aria-label="Guardar configuración de disponibilidad y horarios"
          className="btn btn-primario btn-responsive-accion inline-flex items-center justify-center gap-2 self-start sm:self-auto px-4 py-2.5 rounded-xl font-semibold"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="btn-texto-responsive">
            {guardando ? "Guardando…" : "Guardar Horarios"}
          </span>
        </button>
      </div>

      {mensajeOk && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{mensajeOk}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. PARÁMETRO DE CUPO MÁXIMO POR FECHA/HORA Y ESTRATEGIA DE CAPACIDAD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-slate-50 p-4 sm:p-5">
        {/* Cupo máximo de citas en la misma fecha/hora */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-violet-200 bg-white p-4 shadow-2xs">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-violet-700">
              <Users className="h-4 w-4" />
              Control de Concurrencia por Turno
            </div>
            <h3 className="mt-1 text-sm sm:text-base font-bold text-slate-900">
              Máximo de citas en la misma fecha y hora
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Por defecto <strong>1 sola cita</strong> por bloque horario. Cuando se reserva ese
              cupo, la hora queda ocupada automáticamente para otros clientes.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
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
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
              >
                <Minus className="h-4 w-4" />
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
                className="w-16 rounded-xl border border-violet-300 bg-violet-50/50 px-2 py-1.5 text-center text-base font-extrabold text-violet-950"
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
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
              </button>

              <span className="text-xs font-bold text-slate-700">
                {config.max_citas_simultaneas === 1
                  ? "cita por hora (Por defecto)"
                  : "citas simultáneas"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, max_citas_simultaneas: n }))}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    config.max_citas_simultaneas === n
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {n} {n === 1 ? "cita" : "citas"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Estrategia de Capacidad y Especialidad por Defecto de ARIA */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="select-modo-capacidad"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Modo de Disponibilidad Operativa
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
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900"
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
              <label
                htmlFor="select-materia-defecto"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                Especialidad por defecto (ARIA)
              </label>
              <select
                id="select-materia-defecto"
                value={config.materia_defecto_nombre}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, materia_defecto_nombre: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900"
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

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600 leading-relaxed">
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              1. Horario Laborable Normal (Por Defecto — Editable)
            </h3>
            <p className="text-xs text-slate-500">
              Se aplica todos los días del año salvo en las fechas exactas que tengan un horario
              diferenciado configurado más abajo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* COLUMNA 1: HORARIO NORMAL CONSULTAS TELEMÁTICAS */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <Video className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Horario Normal — Consultas Telemáticas
                  </h4>
                  <p className="text-xs text-slate-500">
                    Videollamada (Por defecto Lun–Vie 08:00 a 19:00, Sáb 09:00 a 14:00)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => aplicarPresetTelematico("estandar")}
                  title="Restaurar horario telemático estándar Lun-Sáb"
                  aria-label="Restaurar horario telemático estándar Lun-Sáb"
                  className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="btn-texto-responsive">Por Defecto</span>
                </button>
                <button
                  type="button"
                  onClick={() => agregarFranja("virtual")}
                  title="Añadir franja telemática"
                  aria-label="Añadir franja telemática"
                  className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="btn-texto-responsive">Añadir Día</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {config.franjas_virtual.map((f, idx) => (
                <div
                  key={`virt-${idx}`}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <select
                    aria-label="Día de la semana telemático"
                    value={f.dia_semana}
                    onChange={(e) =>
                      actualizarFranja("virtual", idx, { dia_semana: Number(e.target.value) })
                    }
                    className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    {DIAS_SEMANA_NEGOCIO.map((d) => (
                      <option key={d.dia} value={d.dia}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="time"
                      aria-label="Hora inicio telemático"
                      value={f.hora_inicio}
                      onChange={(e) =>
                        actualizarFranja("virtual", idx, { hora_inicio: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900"
                    />
                    <span>a</span>
                    <input
                      type="time"
                      aria-label="Hora fin telemático"
                      value={f.hora_fin}
                      onChange={(e) =>
                        actualizarFranja("virtual", idx, { hora_fin: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminarFranja("virtual", idx)}
                    disabled={config.franjas_virtual.length <= 1}
                    title="Eliminar franja telemática"
                    aria-label="Eliminar franja telemática"
                    className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* COLUMNA 2: HORARIO NORMAL CONSULTAS EN OFICINA (PRESENCIAL) */}
          <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Horario Normal — Consultas en Oficina
                  </h4>
                  <p className="text-xs text-slate-500">
                    Atención presencial en despacho (Por defecto Lun–Vie 09:00 a 17:30)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => aplicarPresetPresencial("oficina")}
                  title="Restaurar horario de oficina Lun-Vie"
                  aria-label="Restaurar horario de oficina Lun-Vie"
                  className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="btn-texto-responsive">Por Defecto</span>
                </button>
                <button
                  type="button"
                  onClick={() => agregarFranja("presencial")}
                  title="Añadir franja de oficina"
                  aria-label="Añadir franja de oficina"
                  className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="btn-texto-responsive">Añadir Día</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {config.franjas_presencial.map((f, idx) => (
                <div
                  key={`pres-${idx}`}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <select
                    aria-label="Día de la semana oficina"
                    value={f.dia_semana}
                    onChange={(e) =>
                      actualizarFranja("presencial", idx, { dia_semana: Number(e.target.value) })
                    }
                    className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    {DIAS_SEMANA_NEGOCIO.map((d) => (
                      <option key={d.dia} value={d.dia}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="time"
                      aria-label="Hora inicio oficina"
                      value={f.hora_inicio}
                      onChange={(e) =>
                        actualizarFranja("presencial", idx, { hora_inicio: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900"
                    />
                    <span>a</span>
                    <input
                      type="time"
                      aria-label="Hora fin oficina"
                      value={f.hora_fin}
                      onChange={(e) =>
                        actualizarFranja("presencial", idx, { hora_fin: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminarFranja("presencial", idx)}
                    disabled={config.franjas_presencial.length <= 1}
                    title="Eliminar franja de oficina"
                    aria-label="Eliminar franja de oficina"
                    className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-1">
              <label
                htmlFor="input-direccion-presencial"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
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
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-800"
              />
            </div>
          </section>
        </div>
      </div>

      {/* 4. HORARIOS DIFERENCIADOS POR FECHAS EXACTAS (EJ. NAVIDAD, FERIADOS) */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-800">
              <CalendarPlus className="h-4 w-4 text-amber-600" />
              Excepciones al Horario por Defecto
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              2. Horarios Diferenciados por Fechas Exactas (Navidad, Feriados, Jornadas Especiales)
            </h3>
            <p className="text-xs text-slate-600">
              Si ingresas una fecha exacta aquí, su configuración reemplaza al horario normal en ese
              día (por ejemplo: en Navidad <code>2026-12-25</code> habilitar solo teleconsultas de{" "}
              <code>08:00</code> a <code>16:00</code> y cerrar oficina).
            </p>
          </div>

          {/* Plantillas rápidas de 1 clic */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("navidad")}
              title="Configurar 25 de Diciembre: Solo Teleconsultas 08:00 a 16:00"
              aria-label="Configurar Navidad 25 de Diciembre"
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
            >
              🎄 Navidad (25 Dic · Tele 08h–16h)
            </button>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("nochebuena")}
              title="Configurar 24 de Diciembre: Solo Teleconsultas 08:00 a 14:00"
              aria-label="Configurar Nochebuena 24 de Diciembre"
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
            >
              🎅 Nochebuena (24 Dic)
            </button>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("fin_anio")}
              title="Configurar 31 de Diciembre: Solo Teleconsultas 08:00 a 14:00"
              aria-label="Configurar Fin de Año 31 de Diciembre"
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
            >
              🎆 Fin de Año (31 Dic)
            </button>
            <button
              type="button"
              onClick={() => aplicarPlantillaFechaEspecial("anio_nuevo")}
              title="Configurar 1 de Enero como feriado cerrado"
              aria-label="Configurar Año Nuevo Cerrado"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              🛑 01 Ene (Cerrado)
            </button>
          </div>
        </div>

        {/* Formulario para agregar nueva fecha exacta */}
        <div className="rounded-2xl border border-amber-200/90 bg-white p-4 space-y-3 shadow-2xs">
          <div className="text-xs font-bold text-slate-800">
            Agregar o actualizar horario diferenciado para una fecha exacta:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Fecha Exacta
              </label>
              <input
                type="date"
                aria-label="Fecha exacta especial"
                value={nuevaFecha}
                onChange={(e) => setNuevaFecha(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Motivo / Etiqueta
              </label>
              <input
                type="text"
                aria-label="Motivo o etiqueta de la fecha especial"
                value={nuevoNombreFecha}
                onChange={(e) => setNuevoNombreFecha(e.target.value)}
                placeholder="Ej. Navidad — Solo Teleconsultas"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!nuevoCerradoTotal && nuevoHabilitarVirtual}
                  disabled={nuevoCerradoTotal}
                  onChange={(e) => setNuevoHabilitarVirtual(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600"
                />
                Teleconsulta en esta fecha
              </label>
              {!nuevoCerradoTotal && nuevoHabilitarVirtual ? (
                <div className="flex items-center gap-1 text-xs">
                  <input
                    type="time"
                    aria-label="Hora inicio teleconsulta fecha especial"
                    value={nuevoVirtualInicio}
                    onChange={(e) => setNuevoVirtualInicio(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                  />
                  <span>a</span>
                  <input
                    type="time"
                    aria-label="Hora fin teleconsulta fecha especial"
                    value={nuevoVirtualFin}
                    onChange={(e) => setNuevoVirtualFin(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                  Sin teleconsulta
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!nuevoCerradoTotal && nuevoHabilitarPresencial}
                  disabled={nuevoCerradoTotal}
                  onChange={(e) => setNuevoHabilitarPresencial(e.target.checked)}
                  className="rounded border-slate-300 text-slate-800"
                />
                Oficina abierta
              </label>
              {!nuevoCerradoTotal && nuevoHabilitarPresencial ? (
                <div className="flex items-center gap-1 text-xs">
                  <input
                    type="time"
                    aria-label="Hora inicio oficina fecha especial"
                    value={nuevoPresencialInicio}
                    onChange={(e) => setNuevoPresencialInicio(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-1.5 py-1 text-xs font-semibold"
                  />
                  <span>a</span>
                  <input
                    type="time"
                    aria-label="Hora fin oficina fecha especial"
                    value={nuevoPresencialFin}
                    onChange={(e) => setNuevoPresencialFin(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-1.5 py-1 text-xs font-semibold"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                  Oficina cerrada
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <label className="block text-[11px] font-bold text-slate-600 mb-1" title="Máximo de citas por hora en esta fecha">
                Máx/Hora
              </label>
              <input
                type="number"
                min={1}
                max={50}
                aria-label="Cupo máximo por hora en esta fecha especial"
                value={nuevoMaxCitasFecha}
                onChange={(e) => setNuevoMaxCitasFecha(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-2 py-1.5 text-center text-xs font-bold text-slate-900"
              />
            </div>

            <div className="lg:col-span-1">
              <button
                type="button"
                onClick={handleAgregarDesdeFormulario}
                title="Agregar fecha especial a la lista"
                aria-label="Agregar fecha especial"
                className="btn-responsive-accion w-full inline-flex items-center justify-center gap-1 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                <Plus className="h-4 w-4" />
                <span className="btn-texto-responsive">Añadir</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={nuevoCerradoTotal}
                onChange={(e) => setNuevoCerradoTotal(e.target.checked)}
                className="rounded border-slate-300 text-rose-600"
              />
              Marcar esta fecha como Feriado Cerrado Total (sin teleconsulta ni oficina)
            </label>
          </div>
        </div>

        {/* Lista de fechas exactas configuradas */}
        {(config.fechas_especiales ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-white/70 p-4 text-center text-xs text-slate-500">
            No hay fechas exactas diferenciadas configuradas. Todos los días usan el horario
            laborable normal por defecto.
          </div>
        ) : (
          <div className="space-y-2.5">
            {(config.fechas_especiales ?? []).map((fe) => {
              const rVirt = fe.franjas_virtual?.[0] ?? { hora_inicio: "08:00", hora_fin: "16:00" };
              const rPres = fe.franjas_presencial?.[0] ?? { hora_inicio: "09:00", hora_fin: "13:00" };

              return (
                <div
                  key={fe.fecha}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-950">
                      <Calendar className="h-3.5 w-3.5 text-amber-700" />
                      {fe.fecha}
                    </span>
                    <input
                      type="text"
                      aria-label={`Nombre para la fecha ${fe.fecha}`}
                      value={fe.nombre}
                      onChange={(e) =>
                        actualizarFechaEspecialEnLista(fe.fecha, { nombre: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-900 min-w-[210px]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Cierre Total */}
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fe.cerrado_total}
                        onChange={(e) =>
                          actualizarFechaEspecialEnLista(fe.fecha, {
                            cerrado_total: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-rose-600"
                      />
                      Cerrado Total
                    </label>

                    {!fe.cerrado_total && (
                      <>
                        {/* Teleconsulta */}
                        <div className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/50 px-2.5 py-1">
                          <label className="inline-flex items-center gap-1 text-xs font-bold text-violet-900 cursor-pointer">
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
                              className="rounded border-violet-300 text-violet-600"
                            />
                            Teleconsulta:
                          </label>
                          {fe.habilitar_virtual ? (
                            <div className="flex items-center gap-1 text-xs">
                              <input
                                type="time"
                                aria-label={`Hora inicio teleconsulta en ${fe.fecha}`}
                                value={rVirt.hora_inicio}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "virtual", 0, {
                                    hora_inicio: e.target.value,
                                  })
                                }
                                className="rounded border border-violet-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900"
                              />
                              <span>a</span>
                              <input
                                type="time"
                                aria-label={`Hora fin teleconsulta en ${fe.fecha}`}
                                value={rVirt.hora_fin}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "virtual", 0, {
                                    hora_fin: e.target.value,
                                  })
                                }
                                className="rounded border border-violet-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">No</span>
                          )}
                        </div>

                        {/* Oficina */}
                        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
                          <label className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 cursor-pointer">
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
                              className="rounded border-slate-300 text-slate-800"
                            />
                            Oficina:
                          </label>
                          {fe.habilitar_presencial ? (
                            <div className="flex items-center gap-1 text-xs">
                              <input
                                type="time"
                                aria-label={`Hora inicio oficina en ${fe.fecha}`}
                                value={rPres.hora_inicio}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "presencial", 0, {
                                    hora_inicio: e.target.value,
                                  })
                                }
                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900"
                              />
                              <span>a</span>
                              <input
                                type="time"
                                aria-label={`Hora fin oficina en ${fe.fecha}`}
                                value={rPres.hora_fin}
                                onChange={(e) =>
                                  actualizarRangoFechaEspecial(fe.fecha, "presencial", 0, {
                                    hora_fin: e.target.value,
                                  })
                                }
                                className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-900"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600">Cerrada</span>
                          )}
                        </div>

                        {/* Cupo máximo en esa fecha */}
                        <div className="flex items-center gap-1 text-xs text-slate-700">
                          <span className="font-semibold">Máx. citas/hora:</span>
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
                            className="w-12 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-center text-xs font-bold text-slate-900"
                          />
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setFechaSimulacion(fe.fecha)}
                      title="Ver vista previa de turnos en esta fecha"
                      aria-label="Ver vista previa de turnos en esta fecha"
                      className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarFechaEspecial(fe.fecha)}
                      title="Eliminar excepción de fecha"
                      aria-label="Eliminar excepción de fecha"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. SIMULADOR / VERIFICADOR DE TURNOS POR FECHA EXACTA */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900">
              3. Simulador de Horarios por Fecha (Comprobación en Vivo)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sim-fecha" className="text-xs font-bold text-slate-600">
              Probar fecha:
            </label>
            <input
              id="sim-fecha"
              type="date"
              value={fechaSimulacion}
              onChange={(e) => setFechaSimulacion(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-900"
            />
          </div>
        </div>

        {simulacionDia && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="font-bold text-slate-500 uppercase text-[11px]">
                Regla Aplicada ({simulacionDia.nombreDia} {fechaSimulacion})
              </div>
              {simulacionDia.reglaEspecial ? (
                <div className="font-bold text-amber-800">
                  ✨ Fecha Especial: {simulacionDia.reglaEspecial.nombre}
                </div>
              ) : (
                <div className="font-bold text-slate-800">
                  📅 Horario Laborable Normal (Por defecto)
                </div>
              )}
              <div className="text-slate-600">
                Cupo máximo por bloque:{" "}
                <strong className="text-violet-700">
                  {simulacionDia.cupoEfectivo}{" "}
                  {simulacionDia.cupoEfectivo === 1 ? "cita" : "citas"}
                </strong>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
              <div className="font-bold text-violet-700 flex items-center justify-between">
                <span>Turnos Telemáticos ({simulacionDia.turnosVirtual.length})</span>
              </div>
              {simulacionDia.turnosVirtual.length === 0 ? (
                <p className="text-slate-400 font-medium">Sin atención telemática en esta fecha</p>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {simulacionDia.turnosVirtual.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-[11px] font-semibold text-violet-900"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Turnos en Oficina ({simulacionDia.turnosPresencial.length})</span>
              </div>
              {simulacionDia.turnosPresencial.length === 0 ? (
                <p className="text-rose-600 font-semibold">
                  Oficina cerrada (Solo teleconsulta o feriado)
                </p>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {simulacionDia.turnosPresencial.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-800"
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
        <div>
          <label htmlFor="cfg-duracion" className="block text-xs font-bold text-slate-600 mb-1">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="cfg-holgura" className="block text-xs font-bold text-slate-600 mb-1">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="cfg-antelacion" className="block text-xs font-bold text-slate-600 mb-1">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="cfg-horizonte" className="block text-xs font-bold text-slate-600 mb-1">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
          />
        </div>
      </div>
    </div>
  );
}
