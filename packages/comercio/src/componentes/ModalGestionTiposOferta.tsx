"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Plus,
  Settings2,
  Trash2,
  Pencil,
  Lock,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Tag,
} from "lucide-react";
import {
  eliminarTipoOfertaAction,
  guardarTipoOfertaAction,
  obtenerTiposOfertaConUsoAction,
  restaurarTiposOfertaPredeterminadosAction,
} from "../acciones-tipos-oferta";
import {
  CONDICIONES_RENTA_POR_DEFECTO,
  guardarTiposOfertaCacheLocal,
  guardarTiposOfertaEliminadosLocal,
  leerTiposOfertaCacheLocal,
  leerTiposOfertaEliminadosLocal,
  normalizarCodigoTipoOferta,
  PERIODOS_RENTA_SUGERIDOS,
  type ConfiguracionRentaProducto,
  type TipoOfertaComercial,
} from "../utils/tiposOferta";
import { detectarTipoNegocio } from "../utils/negocio";

interface ModalGestionTiposOfertaProps {
  abierto: boolean;
  onCerrar: () => void;
  negocio?: string;
  tabInicial?: "crear" | "gestionar";
  onCambioCatalogo?: (lista: TipoOfertaComercial[], seleccionadoCodigo?: string) => void;
}

export function ModalGestionTiposOferta({
  abierto,
  onCerrar,
  negocio = "tinkay",
  tabInicial = "crear",
  onCambioCatalogo,
}: ModalGestionTiposOfertaProps) {
  const { esFloristeria } = detectarTipoNegocio(negocio);
  const colorPrimario = esFloristeria ? "#E11D48" : "#0284C7";

  const [tabActiva, setTabActiva] = useState<"crear" | "gestionar">(tabInicial);
  const [listaTipos, setListaTipos] = useState<TipoOfertaComercial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // Formulario Crear / Editar
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoManual, setCodigoManual] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [esRenta, setEsRenta] = useState(false);
  const [etiquetaCorta, setEtiquetaCorta] = useState("");
  const [periodoDefecto, setPeriodoDefecto] = useState("Por evento (24h)");
  const [incluyeRetiroDefecto, setIncluyeRetiroDefecto] = useState(true);
  const [notaCondicionesDefecto, setNotaCondicionesDefecto] = useState(
    CONDICIONES_RENTA_POR_DEFECTO.nota_condiciones
  );
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Estado gestión / eliminación
  const [itemAEliminar, setItemAEliminar] = useState<TipoOfertaComercial | null>(null);
  const [eliminandoCodigo, setEliminandoCodigo] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null
  );

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre("");
    setCodigo("");
    setCodigoManual(false);
    setDescripcion("");
    setEsRenta(false);
    setEtiquetaCorta("");
    setPeriodoDefecto("Por evento (24h)");
    setIncluyeRetiroDefecto(true);
    setNotaCondicionesDefecto(CONDICIONES_RENTA_POR_DEFECTO.nota_condiciones);
    setErrorForm(null);
  };

  const cargarTipos = async () => {
    // 1. Carga sincrónica inmediata desde caché local
    const cacheLocal = leerTiposOfertaCacheLocal(negocio);
    if (cacheLocal.length > 0) {
      setListaTipos(cacheLocal);
    }
    setCargando(true);
    try {
      const remotos = await obtenerTiposOfertaConUsoAction(negocio);
      const elimLocal = new Set(leerTiposOfertaEliminadosLocal(negocio));
      const filtrados = remotos.filter((t) => !elimLocal.has(t.tof_codigo.toUpperCase()));
      const finalLista = filtrados.length > 0 ? filtrados : remotos;
      setListaTipos(finalLista);
      guardarTiposOfertaCacheLocal(negocio, finalLista);
      onCambioCatalogo?.(finalLista);
    } catch {
      // Mantiene caché local
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      setTabActiva(tabInicial);
      setMensajeFeedback(null);
      setItemAEliminar(null);
      limpiarFormulario();
      cargarTipos();
    }
  }, [abierto, tabInicial, negocio]);

  if (!abierto) return null;

  const iniciarEdicion = (item: TipoOfertaComercial) => {
    const det = item.tof_detalle_tipo_oferta || {};
    setEditandoId(item.tof_id);
    setNombre(item.tof_nombre);
    setCodigo(item.tof_codigo);
    setCodigoManual(true);
    setDescripcion(item.tof_descripcion || "");
    setEsRenta(Boolean(det.es_renta || item.tof_codigo.toUpperCase().includes("RENTA")));
    setEtiquetaCorta(det.etiqueta_corta || "");
    setPeriodoDefecto(det.periodo_defecto || "Por evento (24h)");
    setIncluyeRetiroDefecto(det.incluye_retiro_defecto !== false);
    setNotaCondicionesDefecto(
      det.nota_condiciones_defecto || CONDICIONES_RENTA_POR_DEFECTO.nota_condiciones
    );
    setErrorForm(null);
    setTabActiva("crear");
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    setMensajeFeedback(null);

    if (!nombre.trim()) {
      setErrorForm("Ingresa el nombre visible del tipo de oferta.");
      return;
    }

    const codFinal = normalizarCodigoTipoOferta(codigo || nombre);
    setGuardando(true);
    try {
      // Quitar de eliminados locales si re-crea el mismo código
      const elimPrev = leerTiposOfertaEliminadosLocal(negocio).filter((c) => c !== codFinal);
      guardarTiposOfertaEliminadosLocal(negocio, elimPrev);

      const res = await guardarTipoOfertaAction({
        negocio,
        tof_id: editandoId || undefined,
        codigo: codFinal,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        esRenta,
        etiquetaCorta:
          etiquetaCorta.trim() || (esRenta ? "🪑 En Renta" : nombre.trim().slice(0, 22)),
        icono: esRenta ? "🪑" : "🏷️",
        periodoDefecto: esRenta ? periodoDefecto.trim() : undefined,
        incluyeRetiroDefecto: esRenta ? incluyeRetiroDefecto : undefined,
        notaCondicionesDefecto: esRenta ? notaCondicionesDefecto.trim() : undefined,
      });

      if (!res.ok) {
        setErrorForm(res.error || "No se pudo guardar el tipo de oferta.");
        setGuardando(false);
        return;
      }

      const nuevaLista = res.lista || listaTipos;
      setListaTipos(nuevaLista);
      guardarTiposOfertaCacheLocal(negocio, nuevaLista);
      onCambioCatalogo?.(nuevaLista, codFinal);

      limpiarFormulario();
      setMensajeFeedback({
        tipo: "ok",
        texto: `Tipo de oferta "${nombre.trim()}" guardado y disponible en el selector.`,
      });
      setTabActiva("gestionar");
    } catch (err: any) {
      setErrorForm(err?.message || "Error inesperado al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminacion = async () => {
    if (!itemAEliminar) return;
    setEliminandoCodigo(itemAEliminar.tof_codigo);
    setMensajeFeedback(null);

    try {
      const res = await eliminarTipoOfertaAction(negocio, itemAEliminar.tof_codigo);
      if (!res.ok) {
        setMensajeFeedback({
          tipo: "error",
          texto: res.error || "No se pudo eliminar el tipo de oferta.",
        });
        setItemAEliminar(null);
        setEliminandoCodigo(null);
        return;
      }

      const elimActuales = Array.from(
        new Set([
          ...leerTiposOfertaEliminadosLocal(negocio),
          itemAEliminar.tof_codigo.toUpperCase(),
        ])
      );
      guardarTiposOfertaEliminadosLocal(negocio, elimActuales);

      const nuevaLista = (res.lista || listaTipos).filter(
        (t) => t.tof_codigo.toUpperCase() !== itemAEliminar.tof_codigo.toUpperCase()
      );
      setListaTipos(nuevaLista);
      guardarTiposOfertaCacheLocal(negocio, nuevaLista);
      onCambioCatalogo?.(nuevaLista);

      setMensajeFeedback({
        tipo: "ok",
        texto: `Se eliminó "${itemAEliminar.tof_nombre}" correctamente.`,
      });
      setItemAEliminar(null);
    } catch (err: any) {
      setMensajeFeedback({
        tipo: "error",
        texto: err?.message || "Error al eliminar el tipo de oferta.",
      });
    } finally {
      setEliminandoCodigo(null);
    }
  };

  const handleRestaurarBase = async () => {
    setRestaurando(true);
    setMensajeFeedback(null);
    try {
      guardarTiposOfertaEliminadosLocal(negocio, []);
      const res = await restaurarTiposOfertaPredeterminadosAction(negocio);
      setListaTipos(res.lista);
      guardarTiposOfertaCacheLocal(negocio, res.lista);
      onCambioCatalogo?.(res.lista);
      setMensajeFeedback({
        tipo: "ok",
        texto: "Se restauraron los tipos de oferta predeterminados (incluyendo Renta de Mobiliario).",
      });
    } catch {
      setMensajeFeedback({
        tipo: "error",
        texto: "No se pudieron restaurar los tipos predeterminados.",
      });
    } finally {
      setRestaurando(false);
    }
  };

  const listaFiltrada = listaTipos.filter((t) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      t.tof_nombre.toLowerCase().includes(q) ||
      t.tof_codigo.toLowerCase().includes(q) ||
      (t.tof_descripcion || "").toLowerCase().includes(q)
    );
  });

  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "620px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            color: "#FFFFFF",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(56, 189, 248, 0.16)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Tag size={18} color="#38BDF8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>
                Tipos de Oferta Comercial
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#94A3B8" }}>
                Administra venta física, decoración, renta de mobiliario, suscripciones y más
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ventana"
            aria-label="Cerrar ventana"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#CBD5E1",
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "10px 20px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (tabActiva !== "crear") limpiarFormulario();
              setTabActiva("crear");
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: tabActiva === "crear" ? `1.5px solid ${colorPrimario}` : "1px solid #CBD5E1",
              background: tabActiva === "crear" ? "#FFFFFF" : "transparent",
              color: tabActiva === "crear" ? colorPrimario : "#475569",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Plus size={14} />
            <span>{editandoId ? "Editar Oferta" : "Nueva Oferta"}</span>
          </button>
          <button
            type="button"
            onClick={() => setTabActiva("gestionar")}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: tabActiva === "gestionar" ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
              background: tabActiva === "gestionar" ? "#0F172A" : "transparent",
              color: tabActiva === "gestionar" ? "#FFFFFF" : "#475569",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Settings2 size={14} />
            <span>Administrar ({listaTipos.length})</span>
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          {mensajeFeedback && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: mensajeFeedback.tipo === "ok" ? "#ECFDF5" : "#FEF2F2",
                border: `1px solid ${mensajeFeedback.tipo === "ok" ? "#6EE7B7" : "#FCA5A5"}`,
                color: mensajeFeedback.tipo === "ok" ? "#065F46" : "#991B1B",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {mensajeFeedback.tipo === "ok" ? (
                <CheckCircle2 size={16} color="#059669" />
              ) : (
                <AlertCircle size={16} color="#DC2626" />
              )}
              <span>{mensajeFeedback.texto}</span>
            </div>
          )}

          {tabActiva === "crear" ? (
            <form onSubmit={handleGuardar}>
              {errorForm && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#B91C1C",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  {errorForm}
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    Nombre del Tipo de Oferta *
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNombre(val);
                      if (!codigoManual) {
                        setCodigo(normalizarCodigoTipoOferta(val));
                      }
                      if (
                        !editandoId &&
                        (val.toLowerCase().includes("renta") ||
                          val.toLowerCase().includes("alquiler"))
                      ) {
                        setEsRenta(true);
                      }
                    }}
                    placeholder="Ej. Renta de Mobiliario / Bases para Eventos"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    Código Interno
                  </label>
                  <input
                    type="text"
                    value={codigo}
                    disabled={Boolean(editandoId)}
                    onChange={(e) => {
                      setCodigoManual(true);
                      setCodigo(normalizarCodigoTipoOferta(e.target.value));
                    }}
                    placeholder="RENTA"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      fontFamily: "monospace",
                      background: editandoId ? "#F1F5F9" : "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  Etiqueta corta visible al cliente (Opcional)
                </label>
                <input
                  type="text"
                  value={etiquetaCorta}
                  onChange={(e) => setEtiquetaCorta(e.target.value)}
                  placeholder={esRenta ? "🪑 En Renta" : "Ej. Servicio Eventos"}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.84rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  Descripción operativa (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej. Mobiliario entregado temporalmente para eventos con retiro al finalizar."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.83rem",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Switch Modalidad de Renta / Alquiler */}
              <div
                style={{
                  background: esRenta ? "#FFFBEB" : "#F8FAFC",
                  border: esRenta ? "1.5px solid #F59E0B" : "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "16px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={esRenta}
                    onChange={(e) => setEsRenta(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "#D97706" }}
                  />
                  <span>🪑 Es modalidad de Renta / Alquiler temporal (requiere devolución o retiro)</span>
                </label>

                {esRenta && (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #FCD34D" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "#92400E",
                            marginBottom: "3px",
                          }}
                        >
                          Periodo predeterminado
                        </label>
                        <input
                          type="text"
                          value={periodoDefecto}
                          onChange={(e) => setPeriodoDefecto(e.target.value)}
                          placeholder="Por evento (24h)"
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            borderRadius: "7px",
                            border: "1px solid #FCD34D",
                            fontSize: "0.8rem",
                            background: "#FFFFFF",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "6px" }}>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "#78350F",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={incluyeRetiroDefecto}
                            onChange={(e) => setIncluyeRetiroDefecto(e.target.checked)}
                          />
                          <span>Incluye retiro post-evento</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          color: "#92400E",
                          marginBottom: "3px",
                        }}
                      >
                        Nota de condiciones por defecto en tienda
                      </label>
                      <input
                        type="text"
                        value={notaCondicionesDefecto}
                        onChange={(e) => setNotaCondicionesDefecto(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "7px",
                          border: "1px solid #FCD34D",
                          fontSize: "0.8rem",
                          background: "#FFFFFF",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                {editandoId && (
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    style={{
                      background: "#F1F5F9",
                      border: "1px solid #CBD5E1",
                      color: "#334155",
                      padding: "9px 14px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancelar edición
                  </button>
                )}
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    background: colorPrimario,
                    border: "none",
                    color: "#FFFFFF",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: guardando ? "wait" : "pointer",
                  }}
                >
                  {guardando ? "Guardando..." : editandoId ? "Guardar Cambios" : "Crear Oferta"}
                </button>
              </div>
            </form>
          ) : (
            <div>
              {/* Barra búsqueda + restaurar */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "12px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
                  <Search
                    size={14}
                    color="#94A3B8"
                    style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar tipo de oferta..."
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 32px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={cargarTipos}
                  title="Actualizar conteo de productos"
                  aria-label="Actualizar conteo de productos"
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    color: "#334155",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <RefreshCw size={13} />
                </button>

                <button
                  type="button"
                  onClick={handleRestaurarBase}
                  disabled={restaurando}
                  title="Restaurar tipos de oferta predeterminados"
                  aria-label="Restaurar tipos de oferta predeterminados"
                  style={{
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    color: "#92400E",
                    padding: "8px 11px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: restaurando ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Restaurar base</span>
                </button>
              </div>

              {cargando && listaTipos.length === 0 ? (
                <p style={{ textAlign: "center", color: "#64748B", fontSize: "0.84rem", padding: "20px 0" }}>
                  Cargando tipos de oferta comercial...
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {listaFiltrada.map((item) => {
                    const enUso = Boolean(item.en_uso && (item.productos_conteo || 0) > 0);
                    const esItemRenta = Boolean(
                      item.tof_detalle_tipo_oferta?.es_renta ||
                        item.tof_codigo.toUpperCase().includes("RENTA")
                    );

                    return (
                      <div
                        key={item.tof_codigo}
                        style={{
                          border: esItemRenta ? "1.5px solid #FCD34D" : "1px solid #E2E8F0",
                          background: esItemRenta ? "#FFFDF5" : "#FFFFFF",
                          borderRadius: "10px",
                          padding: "10px 12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
                              {item.tof_nombre}
                            </strong>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                background: "#F1F5F9",
                                color: "#475569",
                                padding: "2px 6px",
                                borderRadius: "5px",
                              }}
                            >
                              {item.tof_codigo}
                            </span>
                            {esItemRenta && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 800,
                                  background: "#FEF3C7",
                                  color: "#92400E",
                                  border: "1px solid #FDE68A",
                                  padding: "2px 7px",
                                  borderRadius: "999px",
                                }}
                              >
                                🪑 Modalidad Renta
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                              fontSize: "0.74rem",
                              color: "#64748B",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                color: enUso ? "#0369A1" : "#64748B",
                              }}
                            >
                              {enUso
                                ? `En uso por ${item.productos_conteo} producto(s)`
                                : "Sin productos asignados"}
                            </span>
                            {item.productos_ejemplo && item.productos_ejemplo.length > 0 && (
                              <span>• Ej: {item.productos_ejemplo.slice(0, 2).join(", ")}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => iniciarEdicion(item)}
                            title={`Editar nombre o condiciones de "${item.tof_nombre}"`}
                            aria-label={`Editar ${item.tof_nombre}`}
                            style={{
                              background: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              color: "#334155",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Pencil size={12} />
                            <span>Editar</span>
                          </button>

                          {enUso ? (
                            <button
                              type="button"
                              disabled
                              title={`No se puede eliminar: asignado a ${item.productos_conteo} producto(s)`}
                              style={{
                                background: "#F1F5F9",
                                border: "1px solid #E2E8F0",
                                color: "#94A3B8",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                cursor: "not-allowed",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Lock size={12} />
                              <span>En uso</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setItemAEliminar(item)}
                              disabled={Boolean(eliminandoCodigo)}
                              title={`Eliminar tipo de oferta "${item.tof_nombre}"`}
                              aria-label={`Eliminar ${item.tof_nombre}`}
                              style={{
                                background: "#FFF1F2",
                                border: "1px solid #FECDD3",
                                color: "#E11D48",
                                padding: "6px 10px",
                                borderRadius: "8px",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Trash2 size={12} />
                              <span>Eliminar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Confirmación de eliminación */}
              {itemAEliminar && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#FFF1F2",
                    border: "1.5px solid #FDA4AF",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#9F1239",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      marginBottom: "8px",
                    }}
                  >
                    <AlertTriangle size={16} color="#E11D48" />
                    <span>¿Eliminar el tipo de oferta "{itemAEliminar.tof_nombre}"?</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setItemAEliminar(null)}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        color: "#334155",
                        padding: "6px 12px",
                        borderRadius: "7px",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmarEliminacion}
                      disabled={Boolean(eliminandoCodigo)}
                      style={{
                        background: "#E11D48",
                        border: "none",
                        color: "#FFFFFF",
                        padding: "6px 12px",
                        borderRadius: "7px",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {eliminandoCodigo ? "Eliminando..." : "Confirmar baja"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PanelCondicionesRentaProps {
  config: ConfiguracionRentaProducto;
  onChange: (next: ConfiguracionRentaProducto) => void;
}

export function PanelCondicionesRentaProducto({ config, onChange }: PanelCondicionesRentaProps) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
        border: "1.5px solid #F59E0B",
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#92400E" }}>
          🪑 Condiciones de Renta de Mobiliario / Alquiler
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            background: "#FFFFFF",
            color: "#B45309",
            border: "1px solid #FCD34D",
            padding: "2px 8px",
            borderRadius: "999px",
          }}
        >
          Visible en Tienda, Carrito y WhatsApp
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: "10px",
          marginBottom: "8px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "#78350F",
              marginBottom: "3px",
            }}
          >
            Periodo incluido en la tarifa
          </label>
          <input
            type="text"
            list="lista-periodos-renta-eco"
            value={config.periodo}
            onChange={(e) => onChange({ ...config, periodo: e.target.value })}
            placeholder="Por evento (24h)"
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "7px",
              border: "1px solid #FCD34D",
              fontSize: "0.82rem",
              background: "#FFFFFF",
              boxSizing: "border-box",
            }}
          />
          <datalist id="lista-periodos-renta-eco">
            {PERIODOS_RENTA_SUGERIDOS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.74rem",
              fontWeight: 700,
              color: "#78350F",
              marginBottom: "3px",
            }}
          >
            Garantía reembolsable (USD, 0 = ninguna)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={config.deposito_garantia_usd || 0}
            onChange={(e) =>
              onChange({
                ...config,
                deposito_garantia_usd: Math.max(0, Number(e.target.value) || 0),
              })
            }
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "7px",
              border: "1px solid #FCD34D",
              fontSize: "0.82rem",
              background: "#FFFFFF",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "8px" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#78350F",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={config.incluye_retiro}
            onChange={(e) => onChange({ ...config, incluye_retiro: e.target.checked })}
            style={{ accentColor: "#D97706" }}
          />
          <span>Coordinamos entrega en el lugar del evento y retiro posterior del mobiliario</span>
        </label>
      </div>

      <div>
        <label
          style={{
            display: "block",
            fontSize: "0.74rem",
            fontWeight: 700,
            color: "#78350F",
            marginBottom: "3px",
          }}
        >
          Nota informativa para el cliente
        </label>
        <input
          type="text"
          value={config.nota_condiciones}
          onChange={(e) => onChange({ ...config, nota_condiciones: e.target.value })}
          placeholder="Mobiliario en calidad de renta para el evento..."
          style={{
            width: "100%",
            padding: "7px 10px",
            borderRadius: "7px",
            border: "1px solid #FCD34D",
            fontSize: "0.8rem",
            background: "#FFFFFF",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

