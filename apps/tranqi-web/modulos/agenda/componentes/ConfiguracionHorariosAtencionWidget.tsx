"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { DIAS_SEMANA } from "@eco/agenda";
import {
  guardarConfiguracionAgendaNegocioAction,
  obtenerDatosConfiguracionAgendaAction,
} from "../acciones";
import type { DatosConfigNegocioAgenda, FranjaHorarioNegocio } from "../esquema";

interface MateriaItem {
  mat_id: string;
  mat_nombre: string;
}

interface Props {
  configInicial?: DatosConfigNegocioAgenda;
  materiasIniciales?: MateriaItem[];
}

const CLAVE_CACHE_LOCAL = "tranqi_config_horarios_negocio_v1";

const CONFIG_BASE_FALLBACK: DatosConfigNegocioAgenda = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 2,
  horizonte_dias: 21,
  permitir_sin_profesional: true,
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
};

export function ConfiguracionHorariosAtencionWidget({
  configInicial,
  materiasIniciales,
}: Props) {
  const [config, setConfig] = useState<DatosConfigNegocioAgenda>(
    configInicial ?? CONFIG_BASE_FALLBACK,
  );
  const [materias, setMaterias] = useState<MateriaItem[]>(materiasIniciales ?? []);
  const [cargando, setCargando] = useState(!configInicial);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  useEffect(() => {
    if (configInicial) return;
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      try {
        const res = await obtenerDatosConfiguracionAgendaAction();
        if (!cancelado && res.ok) {
          setConfig(res.data.config);
          setMaterias(res.data.materias);
          try {
            localStorage.setItem(CLAVE_CACHE_LOCAL, JSON.stringify(res.data.config));
          } catch {
            // ignorar almacenamiento lleno
          }
        } else if (!cancelado) {
          // Intentar recuperar de caché local si la BD aún no tiene la tabla
          try {
            const cache = localStorage.getItem(CLAVE_CACHE_LOCAL);
            if (cache) setConfig(JSON.parse(cache) as DatosConfigNegocioAgenda);
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
        "Horarios de atención telemática y presencial guardados correctamente.",
      );
    });
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-3 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
        Cargando configuración de horarios de atención…
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-3 py-0.5 text-xs font-bold text-violet-700">
            <CalendarClock className="h-3.5 w-3.5" />
            Operación de Agendamiento y ARIA
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Horarios de Atención por Defecto (Telemático y Presencial)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Define las franjas horarias en las que los clientes pueden agendar y pagar su consulta
            incluso cuando aún no haya un abogado asignado en ese horario.
          </p>
        </div>

        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando}
          title="Guardar configuración de horarios de atención"
          aria-label="Guardar configuración de horarios de atención"
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Parámetros de ARIA y Reserva sin Abogado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
        <div className="lg:col-span-2 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={config.permitir_sin_profesional}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  permitir_sin_profesional: e.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="block text-sm font-bold text-slate-900">
                Permitir agendar y cobrar aunque no haya abogado disponible en ese horario
              </span>
              <span className="block text-xs text-slate-600">
                Si ningún abogado tiene agenda libre en la hora elegida, el sistema confirma la cita
                con el pago del cliente y la registra en la cola operativa para asignarle abogado después.
              </span>
            </div>
          </label>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="select-materia-defecto"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700"
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
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
          <p className="text-[11px] text-slate-500">
            Se asigna cuando el caso del cliente es general o ambiguo.
          </p>
        </div>
      </div>

      {/* Dos columnas: Horario Telemático y Horario Presencial */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* COLUMNA 1: HORARIO CONSULTAS TELEMÁTICAS */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Horario Consultas Telemáticas
                </h3>
                <p className="text-xs text-slate-500">Atención por videollamada</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => aplicarPresetTelematico("estandar")}
                title="Aplicar horario estándar Lun-Sáb"
                aria-label="Aplicar horario estándar Lun-Sáb"
                className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="btn-texto-responsive">Lun–Sáb</span>
              </button>
              <button
                type="button"
                onClick={() => agregarFranja("virtual")}
                title="Añadir franja telemática"
                aria-label="Añadir franja telemática"
                className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="btn-texto-responsive">Añadir Franja</span>
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
                  {Object.entries(DIAS_SEMANA).map(([num, nombre]) => (
                    <option key={num} value={Number(num)}>
                      {nombre}
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

        {/* COLUMNA 2: HORARIO CONSULTAS PRESENCIALES */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Horario Consultas Presenciales
                </h3>
                <p className="text-xs text-slate-500">Atención en oficina / despacho</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => aplicarPresetPresencial("oficina")}
                title="Aplicar horario oficina Lun-Vie"
                aria-label="Aplicar horario oficina Lun-Vie"
                className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="btn-texto-responsive">Lun–Vie</span>
              </button>
              <button
                type="button"
                onClick={() => agregarFranja("presencial")}
                title="Añadir franja presencial"
                aria-label="Añadir franja presencial"
                className="btn-responsive-accion inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="btn-texto-responsive">Añadir Franja</span>
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
                  aria-label="Día de la semana presencial"
                  value={f.dia_semana}
                  onChange={(e) =>
                    actualizarFranja("presencial", idx, { dia_semana: Number(e.target.value) })
                  }
                  className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  {Object.entries(DIAS_SEMANA).map(([num, nombre]) => (
                    <option key={num} value={Number(num)}>
                      {nombre}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="time"
                    aria-label="Hora inicio presencial"
                    value={f.hora_inicio}
                    onChange={(e) =>
                      actualizarFranja("presencial", idx, { hora_inicio: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-900"
                  />
                  <span>a</span>
                  <input
                    type="time"
                    aria-label="Hora fin presencial"
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
                  title="Eliminar franja presencial"
                  aria-label="Eliminar franja presencial"
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
              Dirección del Despacho para Consultas Presenciales
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

      {/* Parámetros de duración, holgura y horizonte */}
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
            max={90}
            value={config.horizonte_dias}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, horizonte_dias: Number(e.target.value) || 21 }))
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
          />
        </div>
      </div>
    </div>
  );
}

