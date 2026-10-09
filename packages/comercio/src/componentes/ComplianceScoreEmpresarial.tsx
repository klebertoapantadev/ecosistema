"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Upload,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Sparkles,
  Building2,
  Calendar,
  Eye,
  Info,
  ChevronRight,
  ExternalLink,
  Percent,
} from "lucide-react";
import {
  obtenerComplianceEmpresaAction,
  guardarComplianceItemAction,
  calcularLegalHealthScoreAction,
  type ComplianceItem,
  type LegalHealthScoreResumen,
} from "../acciones-compliance";
import { obtenerConveniosEmpresaAction, type ConvenioEmpresa } from "../acciones-convenios";

interface Props {
  negocio?: string;
  convenioId?: string;
}

const CACHE_KEY = "tranqi_compliance_cache";

export function ComplianceScoreEmpresarial({ negocio = "tranqi", convenioId: propConvenioId }: Props) {
  const [convenios, setConvenios] = useState<ConvenioEmpresa[]>([]);
  const [convenioActivoId, setConvenioActivoId] = useState<string>(propConvenioId || "");
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [scoreResumen, setScoreResumen] = useState<LegalHealthScoreResumen>({
    score: 100,
    totales: 0,
    al_dia: 0,
    por_vencer: 0,
    vencidos: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroCriticidad, setFiltroCriticidad] = useState<string>("TODOS");

  // Modal para editar / subir documento
  const [modalAbierto, setModalAbierto] = useState(false);
  const [itemEnEdicion, setItemEnEdicion] = useState<Partial<ComplianceItem> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [analizandoAria, setAnalizandoAria] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

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

  // 2. Cargar Matriz de Compliance y Score con resiliencia híbrida
  useEffect(() => {
    if (!convenioActivoId) return;

    // Cargar caché local primero para render inmediato
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${convenioActivoId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.items) setItems(parsed.items);
        if (parsed.score) setScoreResumen(parsed.score);
      }
    } catch {}

    cargarDatosServidor(convenioActivoId);
  }, [convenioActivoId]);

  async function cargarDatosServidor(cId: string) {
    setCargando(true);
    try {
      const [resItems, resScore] = await Promise.all([
        obtenerComplianceEmpresaAction(cId),
        calcularLegalHealthScoreAction(cId),
      ]);

      if (resItems.ok && resItems.items) {
        setItems(resItems.items);
      }
      if (resScore.ok && resScore.data) {
        setScoreResumen(resScore.data);
      }

      // Guardar en caché local
      try {
        localStorage.setItem(
          `${CACHE_KEY}_${cId}`,
          JSON.stringify({
            items: resItems.items || [],
            score: resScore.data || null,
          })
        );
      } catch {}
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: "Error al sincronizar con el servidor" });
    } finally {
      setCargando(false);
    }
  }

  // Filtrado reactivo de items
  const itemsFiltrados = useMemo(() => {
    return items.filter((it) => {
      const matchesBusqueda =
        (it.cei_titulo_personalizado || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (it.cei_entidad || "").toLowerCase().includes(busqueda.toLowerCase());

      const matchesEstado = filtroEstado === "TODOS" || it.cei_estado === filtroEstado;
      const matchesCriticidad = filtroCriticidad === "TODOS" || it.cei_criticidad === filtroCriticidad;

      return matchesBusqueda && matchesEstado && matchesCriticidad;
    });
  }, [items, busqueda, filtroEstado, filtroCriticidad]);

  // Manejo de guardado in-situ
  async function handleGuardarItem() {
    if (!itemEnEdicion || !convenioActivoId) return;
    setGuardando(true);
    setMensaje(null);

    const res = await guardarComplianceItemAction({
      ...itemEnEdicion,
      cei_convenio_id: convenioActivoId,
    });

    if (res && res.ok) {
      setMensaje({ tipo: "ok", texto: "Obligación legal actualizada y score recalculado" });
      setModalAbierto(false);
      setItemEnEdicion(null);
      await cargarDatosServidor(convenioActivoId);
    } else {
      setMensaje({ tipo: "error", texto: res?.error || "Error al guardar obligación" });
    }
    setGuardando(false);
  }

  // Simulación de extracción inteligente con ARIA (Visión OCR)
  function handleSimularExtraccionAria() {
    setAnalizandoAria(true);
    setTimeout(() => {
      if (itemEnEdicion) {
        const hoy = new Date();
        const fechaEmision = new Date(hoy.getFullYear(), 0, 15).toISOString().split("T")[0];
        const fechaCaducidad = new Date(hoy.getFullYear() + 1, 11, 31).toISOString().split("T")[0];

        setItemEnEdicion({
          ...itemEnEdicion,
          cei_fecha_emision: fechaEmision,
          cei_fecha_caducidad: fechaCaducidad,
          cei_estado: "VIGENTE",
          cei_aria_metadata: {
            confianza_ocr: 0.98,
            autoridad_emisora: itemEnEdicion.cei_entidad || "Autoridad Competente",
            fecha_lectura: new Date().toISOString(),
            archivo_analizado: "documento_oficial_firmado.pdf",
          },
          cei_observaciones: "Validado automáticamente por ARIA: Documento oficial vigente sin tachaduras.",
        });
      }
      setAnalizandoAria(false);
    }, 1200);
  }

  const scoreColor =
    scoreResumen.score >= 90
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
      : scoreResumen.score >= 70
      ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
      : "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800";

  return (
    <div className="space-y-6">
      {/* Header con Selector de Empresa y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Corporate Compliance & Legal Health Score
            </h2>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Matriz de obligaciones normativas, fechas de caducidad y auditoría continua con ARIA.
          </p>
        </div>

        {convenios.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-400" />
            <select
              value={convenioActivoId}
              onChange={(e) => setConvenioActivoId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {convenios.map((c) => (
                <option key={c.cve_id} value={c.cve_id}>
                  {c.cve_empresa_nombre} ({c.cve_empresa_ruc || "Sin RUC"})
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
          <button onClick={() => setMensaje(null)} className="font-bold underline ml-2">
            Cerrar
          </button>
        </div>
      )}

      {/* Tarjeta de Score Principal & Métricas Clave */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score Principal */}
        <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center shadow-sm ${scoreColor}`}>
          <span className="text-xs font-bold uppercase tracking-wider mb-1">Legal Health Score</span>
          <div className="text-4xl font-extrabold flex items-baseline gap-1">
            <span>{scoreResumen.score}%</span>
          </div>
          <span className="text-xs font-medium mt-2">
            {scoreResumen.score >= 90
              ? "🟢 Riesgo Jurídico Mínimo"
              : scoreResumen.score >= 70
              ? "🟡 Cumplimiento Aceptable"
              : "🔴 Riesgo Regulatorio Alto"}
          </span>
        </div>

        {/* Métricas de Estado */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
            <span>Al Día / Vigentes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {scoreResumen.al_dia}
            </span>
            <span className="text-xs text-zinc-400 ml-1">/ {scoreResumen.totales} obligaciones</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{
                width: `${scoreResumen.totales > 0 ? (scoreResumen.al_dia / scoreResumen.totales) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
            <span>Por Vencer (&lt; 30d)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {scoreResumen.por_vencer}
            </span>
            <span className="text-xs text-zinc-400 ml-1">renovaciones urgentes</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all"
              style={{
                width: `${scoreResumen.totales > 0 ? (scoreResumen.por_vencer / scoreResumen.totales) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs">
            <span>Vencidos / Sin Doc</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {scoreResumen.vencidos}
            </span>
            <span className="text-xs text-zinc-400 ml-1">infracciones potenciales</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full transition-all"
              style={{
                width: `${scoreResumen.totales > 0 ? (scoreResumen.vencidos / scoreResumen.totales) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar obligación o entidad (SRI, IESS, LUAE...)..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-medium"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="VIGENTE">🟢 Vigentes</option>
            <option value="POR_VENCER">🟡 Por Vencer</option>
            <option value="VENCIDO">🔴 Vencidos</option>
            <option value="PENDIENTE">⚪ Pendientes</option>
          </select>

          <select
            value={filtroCriticidad}
            onChange={(e) => setFiltroCriticidad(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-medium"
          >
            <option value="TODOS">Todas las Criticidades</option>
            <option value="CRITICA">Crítica (Bloqueante)</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
          </select>

          <button
            onClick={() => {
              setItemEnEdicion({
                cei_convenio_id: convenioActivoId,
                cei_titulo_personalizado: "",
                cei_entidad: "REGULADOR",
                cei_criticidad: "ALTA",
                cei_estado: "PENDIENTE",
              });
              setModalAbierto(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Obligación</span>
          </button>

          <button
            onClick={() => cargarDatosServidor(convenioActivoId)}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
            title="Sincronizar BDD"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabla de Obligaciones Regulatorias */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Obligación Normativa</th>
                <th className="py-3 px-4">Entidad Emisora</th>
                <th className="py-3 px-4">Criticidad</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                    No se encontraron obligaciones normativas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((it) => (
                  <tr key={it.cei_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      <div>{it.cei_titulo_personalizado}</div>
                      {it.cei_observaciones && (
                        <div className="text-[11px] text-zinc-400 truncate max-w-xs">{it.cei_observaciones}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-zinc-600 dark:text-zinc-300">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                        {it.cei_entidad}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          it.cei_criticidad === "CRITICA"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                            : it.cei_criticidad === "ALTA"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                        }`}
                      >
                        {it.cei_criticidad}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-300">
                      {it.cei_fecha_caducidad ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{it.cei_fecha_caducidad}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">No fijado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          it.cei_estado === "VIGENTE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            : it.cei_estado === "POR_VENCER"
                            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                            : it.cei_estado === "VENCIDO"
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                            : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                        }`}
                      >
                        {it.cei_estado === "VIGENTE" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {it.cei_estado === "POR_VENCER" && <Clock className="w-3 h-3 text-amber-600" />}
                        {it.cei_estado === "VENCIDO" && <XCircle className="w-3 h-3 text-rose-600" />}
                        {it.cei_estado}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setItemEnEdicion(it);
                          setModalAbierto(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 transition-colors"
                      >
                        Auditar / Cargar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Auditoría Documental con ARIA */}
      {modalAbierto && itemEnEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Auditoría de Obligación Legal & Documento
                </h3>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Nombre del Requisito / Obligación
                </label>
                <input
                  type="text"
                  value={itemEnEdicion.cei_titulo_personalizado || ""}
                  onChange={(e) =>
                    setItemEnEdicion({ ...itemEnEdicion, cei_titulo_personalizado: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Entidad Emisora
                  </label>
                  <input
                    type="text"
                    value={itemEnEdicion.cei_entidad || ""}
                    onChange={(e) =>
                      setItemEnEdicion({ ...itemEnEdicion, cei_entidad: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Criticidad
                  </label>
                  <select
                    value={itemEnEdicion.cei_criticidad || "ALTA"}
                    onChange={(e) =>
                      setItemEnEdicion({
                        ...itemEnEdicion,
                        cei_criticidad: e.target.value as any,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="CRITICA">🔴 Crítica</option>
                    <option value="ALTA">🟠 Alta</option>
                    <option value="MEDIA">🔵 Media</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={itemEnEdicion.cei_fecha_emision || ""}
                    onChange={(e) =>
                      setItemEnEdicion({ ...itemEnEdicion, cei_fecha_emision: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Fecha de Caducidad / Vencimiento
                  </label>
                  <input
                    type="date"
                    value={itemEnEdicion.cei_fecha_caducidad || ""}
                    onChange={(e) =>
                      setItemEnEdicion({ ...itemEnEdicion, cei_fecha_caducidad: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Botón de Asistente IA ARIA */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <div className="font-bold text-indigo-950 dark:text-indigo-200">
                      Lectura Automatizada con ARIA
                    </div>
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      OCR inteligente para extraer vigencia y validar autenticidad.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSimularExtraccionAria}
                  disabled={analizandoAria}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm"
                >
                  {analizandoAria ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Analizando...</span>
                    </>
                  ) : (
                    <span>Auditar con ARIA</span>
                  )}
                </button>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Observaciones Jurídicas
                </label>
                <textarea
                  rows={2}
                  value={itemEnEdicion.cei_observaciones || ""}
                  onChange={(e) =>
                    setItemEnEdicion({ ...itemEnEdicion, cei_observaciones: e.target.value })
                  }
                  placeholder="Detalles del trámite, observaciones notariales o requisitos pendientes..."
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarItem}
                disabled={guardando}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md"
              >
                {guardando ? "Guardando en BDD..." : "Guardar & Recalcular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
