"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Users,
  FileText,
  UserCheck,
  UserX,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calculator,
  Download,
  Building2,
  Calendar,
  Shield,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import {
  obtenerEmpleadosLaboralAction,
  guardarEmpleadoLaboralAction,
  type EmpleadoLaboral,
} from "../acciones-legal-hr";
import { obtenerConveniosEmpresaAction, type ConvenioEmpresa } from "../acciones-convenios";

interface Props {
  negocio?: string;
  convenioId?: string;
}

const CACHE_KEY = "tranqi_legal_hr_cache";

export function LegalHRLaboral({ negocio = "tranqi", convenioId: propConvenioId }: Props) {
  const [convenios, setConvenios] = useState<ConvenioEmpresa[]>([]);
  const [convenioActivoId, setConvenioActivoId] = useState<string>(propConvenioId || "");
  const [empleados, setEmpleados] = useState<EmpleadoLaboral[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [modalFiniquitoAbierto, setModalFiniquitoAbierto] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Partial<EmpleadoLaboral> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Estado de la calculadora de finiquito
  const [calcSueldo, setCalcSueldo] = useState<number>(650);
  const [calcMesesTrabajados, setCalcMesesTrabajados] = useState<number>(18);
  const [calcCausalSalida, setCalcCausalSalida] = useState<"DESAHUCIO" | "DESPIDO" | "MUTUO_ACUERDO">("MUTUO_ACUERDO");

  // 1. Cargar convenios disponibles si no se pasa por prop
  useEffect(() => {
    async function cargarConvenios() {
      const res = await obtenerConveniosEmpresaAction(negocio);
      if (res && res.length > 0) {
        setConvenios(res);
        if (!convenioActivoId && res[0]) {
          setConvenioActivoId(res[0].cve_id);
        }
      }
    }
    if (!propConvenioId) {
      cargarConvenios();
    }
  }, [negocio, propConvenioId]);

  // 2. Cargar colaboradores de la empresa con resiliencia híbrida
  useEffect(() => {
    if (!convenioActivoId) return;

    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${convenioActivoId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setEmpleados(parsed);
      }
    } catch {}

    cargarEmpleadosServidor(convenioActivoId);
  }, [convenioActivoId]);

  async function cargarEmpleadosServidor(cId: string) {
    setCargando(true);
    try {
      const res = await obtenerEmpleadosLaboralAction(cId);
      if (res.ok && res.empleados) {
        setEmpleados(res.empleados);
        try {
          localStorage.setItem(`${CACHE_KEY}_${cId}`, JSON.stringify(res.empleados));
        } catch {}
      }
    } catch {
      setMensaje({ tipo: "error", texto: "Error al sincronizar nómina laboral" });
    } finally {
      setCargando(false);
    }
  }

  // Métricas
  const metricas = useMemo(() => {
    const total = empleados.length;
    const activos = empleados.filter((e) => e.elab_estado === "ACTIVO").length;
    const sutAlDia = empleados.filter((e) => e.elab_sut_registrado).length;
    const iessAlDia = empleados.filter((e) => e.elab_iess_aviso_entrada).length;
    const enSalida = empleados.filter((e) => e.elab_estado === "EN_PROCESO_SALIDA").length;

    return { total, activos, sutAlDia, iessAlDia, enSalida };
  }, [empleados]);

  // Filtrado
  const empleadosFiltrados = useMemo(() => {
    return empleados.filter((e) => {
      const fullName = `${e.elab_nombres} ${e.elab_apellidos}`.toLowerCase();
      const matchesBusqueda =
        fullName.includes(busqueda.toLowerCase()) ||
        e.elab_identificacion.includes(busqueda) ||
        (e.elab_cargo || "").toLowerCase().includes(busqueda.toLowerCase());

      const matchesEstado = filtroEstado === "TODOS" || e.elab_estado === filtroEstado;
      return matchesBusqueda && matchesEstado;
    });
  }, [empleados, busqueda, filtroEstado]);

  // Guardar colaborador
  async function handleGuardarColaborador() {
    if (!empleadoSeleccionado || !convenioActivoId) return;
    setGuardando(true);
    setMensaje(null);

    const res = await guardarEmpleadoLaboralAction({
      ...empleadoSeleccionado,
      elab_convenio_id: convenioActivoId,
    });

    if (res && res.ok) {
      setMensaje({ tipo: "ok", texto: "Colaborador y contrato laboral guardados en BDD" });
      setModalNuevoAbierto(false);
      setEmpleadoSeleccionado(null);
      await cargarEmpleadosServidor(convenioActivoId);
    } else {
      setMensaje({ tipo: "error", texto: res?.error || "Error al guardar colaborador" });
    }
    setGuardando(false);
  }

  // Cálculo de finiquito según normativa ecuatoriana
  const finiquitoCalculado = useMemo(() => {
    const sueldoDiario = calcSueldo / 30;
    const anosCompletos = Math.floor(calcMesesTrabajados / 12);
    
    // Proporcional 13ro y 14ro aproximado
    const decimoTercero = Math.round((calcSueldo / 12) * (calcMesesTrabajados % 12));
    const decimoCuarto = Math.round((460 / 12) * (calcMesesTrabajados % 12)); // SBU 460 USD
    const vacacionesPendientes = Math.round((calcSueldo / 24) * 0.5);

    // Bonificación por desahucio (25% del último sueldo por año completo)
    let bonifDesahucio = 0;
    if (anosCompletos > 0) {
      bonifDesahucio = Math.round((calcSueldo * 0.25) * anosCompletos);
    }

    // Indemnización por despido intempestivo (1 sueldo por año completo)
    let indDespido = 0;
    if (calcCausalSalida === "DESPIDO") {
      indDespido = Math.round(calcSueldo * Math.max(1, anosCompletos));
    }

    const totalLiquidacion = decimoTercero + decimoCuarto + vacacionesPendientes + bonifDesahucio + indDespido;

    return {
      decimoTercero,
      decimoCuarto,
      vacacionesPendientes,
      bonifDesahucio,
      indDespido,
      totalLiquidacion,
    };
  }, [calcSueldo, calcMesesTrabajados, calcCausalSalida]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Tranqi Legal HR (Onboarding & Finiquitos)
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Contratos de trabajo tipificados, firma electrónica .p12, avisos IESS y actas de finiquito MDT/SUT.
          </p>
        </div>

        {convenios.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-400" />
            <select
              value={convenioActivoId}
              onChange={(e) => setConvenioActivoId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
            >
              {convenios.map((c) => (
                <option key={c.cve_id} value={c.cve_id}>
                  {c.cve_empresa_nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {mensaje && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            mensaje.tipo === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <span>{mensaje.texto}</span>
          <button onClick={() => setMensaje(null)} className="font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas Laborales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Colaboradores Activos</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {metricas.activos} <span className="text-xs font-normal text-zinc-400">/ {metricas.total}</span>
            </div>
          </div>
          <Users className="w-8 h-8 text-indigo-500 opacity-80" />
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Contratos SUT MDT</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {metricas.sutAlDia}
            </div>
          </div>
          <FileCheck2 className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Avisos Entrada IESS</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {metricas.iessAlDia}
            </div>
          </div>
          <Shield className="w-8 h-8 text-blue-500 opacity-80" />
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">En Salida / Finiquito</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {metricas.enSalida}
            </div>
          </div>
          <UserX className="w-8 h-8 text-amber-500 opacity-80" />
        </div>
      </div>

      {/* Barra de Acciones y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por cédula, nombres o cargo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-medium"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="EN_PROCESO_SALIDA">En Salida</option>
            <option value="FINIQUITADO">Finiquitados</option>
          </select>

          <button
            onClick={() => setModalFiniquitoAbierto(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-all"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-500" />
            <span>Calculadora Liquidación</span>
          </button>

          <button
            onClick={() => {
              setEmpleadoSeleccionado({
                elab_convenio_id: convenioActivoId,
                elab_identificacion: "",
                elab_nombres: "",
                elab_apellidos: "",
                elab_tipo_contrato: "INDEFINIDO",
                elab_estado: "ACTIVO",
                elab_sut_registrado: true,
                elab_iess_aviso_entrada: true,
              });
              setModalNuevoAbierto(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Colaborador</span>
          </button>
        </div>
      </div>

      {/* Tabla de Colaboradores */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Cédula</th>
                <th className="py-3 px-4">Tipo Contrato</th>
                <th className="py-3 px-4">Ingreso</th>
                <th className="py-3 px-4">SUT MDT</th>
                <th className="py-3 px-4">IESS</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {empleadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400 text-xs">
                    No se registran colaboradores laborales para este filtro.
                  </td>
                </tr>
              ) : (
                empleadosFiltrados.map((emp) => (
                  <tr key={emp.elab_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                    <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <div>{emp.elab_nombres} {emp.elab_apellidos}</div>
                      <div className="text-[11px] text-zinc-400">{emp.elab_cargo || "Colaborador"}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-300">
                      {emp.elab_identificacion}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-semibold text-[10px]">
                        {emp.elab_tipo_contrato}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-300">
                      {emp.elab_fecha_ingreso || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      {emp.elab_sut_registrado ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Registrado
                        </span>
                      ) : (
                        <span className="text-amber-500 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {emp.elab_iess_aviso_entrada ? (
                        <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" /> Al Día
                        </span>
                      ) : (
                        <span className="text-zinc-400">Sin Aviso</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.elab_estado === "ACTIVO"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : emp.elab_estado === "EN_PROCESO_SALIDA"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {emp.elab_estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setEmpleadoSeleccionado(emp);
                          setModalNuevoAbierto(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200"
                      >
                        Editar / Contrato
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Colaborador / Contrato */}
      {modalNuevoAbierto && empleadoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Registro de Colaborador & Contrato Legal
              </h3>
              <button onClick={() => setModalNuevoAbierto(false)} className="text-zinc-400 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nombres</label>
                  <input
                    type="text"
                    value={empleadoSeleccionado.elab_nombres || ""}
                    onChange={(e) =>
                      setEmpleadoSeleccionado({ ...empleadoSeleccionado, elab_nombres: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Apellidos</label>
                  <input
                    type="text"
                    value={empleadoSeleccionado.elab_apellidos || ""}
                    onChange={(e) =>
                      setEmpleadoSeleccionado({ ...empleadoSeleccionado, elab_apellidos: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Cédula de Identidad</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={empleadoSeleccionado.elab_identificacion || ""}
                    onChange={(e) =>
                      setEmpleadoSeleccionado({ ...empleadoSeleccionado, elab_identificacion: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Cargo Laboral</label>
                  <input
                    type="text"
                    value={empleadoSeleccionado.elab_cargo || ""}
                    onChange={(e) =>
                      setEmpleadoSeleccionado({ ...empleadoSeleccionado, elab_cargo: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tipo de Contrato (Código Trabajo)</label>
                  <select
                    value={empleadoSeleccionado.elab_tipo_contrato || "INDEFINIDO"}
                    onChange={(e) =>
                      setEmpleadoSeleccionado({
                        ...empleadoSeleccionado,
                        elab_tipo_contrato: e.target.value as any,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                  >
                    <option value="INDEFINIDO">Indefinido (Periodo prueba 90d)</option>
                    <option value="PARCIAL">Jornada Parcial Permanente</option>
                    <option value="TELETRABAJO">Teletrabajo / Remoto</option>
                    <option value="EMERGENTE">Especial Emergente</option>
                    <option value="SERVICIOS">Servicios Profesionales / Factura</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={empleadoSeleccionado.elab_fecha_ingreso || ""}
                    onChange={(e) =>
                      setEmpleadoSeleccionado({ ...empleadoSeleccionado, elab_fecha_ingreso: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-2">
                <div className="font-semibold text-zinc-700 dark:text-zinc-300">Cumplimiento Legal Regulatorio</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={empleadoSeleccionado.elab_sut_registrado || false}
                      onChange={(e) =>
                        setEmpleadoSeleccionado({
                          ...empleadoSeleccionado,
                          elab_sut_registrado: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>Registrado en SUT MDT</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={empleadoSeleccionado.elab_iess_aviso_entrada || false}
                      onChange={(e) =>
                        setEmpleadoSeleccionado({
                          ...empleadoSeleccionado,
                          elab_iess_aviso_entrada: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span>Aviso Entrada IESS</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setModalNuevoAbierto(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarColaborador}
                disabled={guardando}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md"
              >
                {guardando ? "Guardando en BDD..." : "Guardar Colaborador"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Calculadora de Liquidación & Acta de Finiquito */}
      {modalFiniquitoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Calculadora Legal de Finiquitos (MDT / SUT Ecuador)
                </h3>
              </div>
              <button onClick={() => setModalFiniquitoAbierto(false)} className="text-zinc-400 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Última Remuneración (USD)</label>
                  <input
                    type="number"
                    value={calcSueldo}
                    onChange={(e) => setCalcSueldo(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Meses Trabajados</label>
                  <input
                    type="number"
                    value={calcMesesTrabajados}
                    onChange={(e) => setCalcMesesTrabajados(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Causal de Desvinculación</label>
                <select
                  value={calcCausalSalida}
                  onChange={(e) => setCalcCausalSalida(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
                >
                  <option value="MUTUO_ACUERDO">Acuerdo de las Partes / Renuncia Voluntaria</option>
                  <option value="DESAHUCIO">Desahucio (Art. 184 Código Trabajo)</option>
                  <option value="DESPIDO">Despido Intempestivo (Art. 188 Código Trabajo)</option>
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-2">
                <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                  <span>Desglose de Liquidación Estimada</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono text-base">
                    ${finiquitoCalculado.totalLiquidacion.toFixed(2)} USD
                  </span>
                </div>
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 divide-y divide-zinc-200 dark:divide-zinc-700">
                  <div className="flex justify-between py-1">
                    <span>Décimo Tercero proporcional:</span>
                    <span className="font-mono">${finiquitoCalculado.decimoTercero.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Décimo Cuarto proporcional:</span>
                    <span className="font-mono">${finiquitoCalculado.decimoCuarto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Vacaciones no gozadas:</span>
                    <span className="font-mono">${finiquitoCalculado.vacacionesPendientes.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Bonificación por Desahucio (25%):</span>
                    <span className="font-mono">${finiquitoCalculado.bonifDesahucio.toFixed(2)}</span>
                  </div>
                  {finiquitoCalculado.indDespido > 0 && (
                    <div className="flex justify-between py-1 text-rose-600 font-bold">
                      <span>Indemnización Despido Intempestivo:</span>
                      <span className="font-mono">${finiquitoCalculado.indDespido.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setModalFiniquitoAbierto(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
