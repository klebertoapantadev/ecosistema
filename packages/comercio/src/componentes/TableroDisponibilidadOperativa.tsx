"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Flower2,
  Scale,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Layers,
  Save,
  Plus,
  Minus,
  Bot,
  Info,
  Send,
  CheckCheck,
  XCircle,
  UserCheck,
  Filter,
  Search,
  Calendar,
  Briefcase,
  ShieldCheck,
  Sliders,
  ChevronRight,
} from "lucide-react";
import {
  ItemDisponibilidadOperativa,
  obtenerDisponibilidadOperativaAction,
  actualizarDisponibilidadOperativaAction,
  proponerDisponibilidadPreliminarAction,
  aprobarPropuestaDisponibilidadAction,
  rechazarPropuestaDisponibilidadAction,
} from "../acciones";
import { detectarTipoNegocio } from "../utils/negocio";

interface Props {
  negocio?: string;
  enModal?: boolean;
  modoVista?: "operador" | "abogado" | "admin";
  onCerrar?: () => void;
}

export function TableroDisponibilidadOperativa({
  negocio = "tranqi",
  enModal = false,
  modoVista: modoVistaProp,
  onCerrar,
}: Props) {
  const { esFloristeria, esLegal, esMantenimiento } = detectarTipoNegocio(negocio);

  // Modo de vista: Operador (aprobación/gestión global) vs Abogado (propuesta preliminar)
  const [modoVista, setModoVista] = useState<"operador" | "abogado" | "admin">(
    modoVistaProp || "operador"
  );

  const [items, setItems] = useState<ItemDisponibilidadOperativa[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
  const [filtroEstadoAprobacion, setFiltroEstadoAprobacion] = useState<"TODOS" | "PRELIMINAR" | "APROBADO">("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado para la propuesta del abogado
  const [abogadoSeleccionadoId, setAbogadoSeleccionadoId] = useState<string>("");
  const [horasPropuestasInput, setHorasPropuestasInput] = useState<number>(8);
  const [nombreAbogadoInput, setNombreAbogadoInput] = useState<string>("Dr. Abogado Asociado");

  // Detectar rol activo desde cookies / props si no se pasó explícito
  useEffect(() => {
    if (!modoVistaProp && typeof document !== "undefined") {
      const cookieStore = document.cookie || "";
      const matchModo = cookieStore.match(/tranqi_modo_rol=([^;]+)/);
      const matchFav = cookieStore.match(/tranqi_rol_favorito=([^;]+)/);
      const rolActual = (matchModo?.[1] || matchFav?.[1] || "").toUpperCase();
      if (rolActual === "ABOGADO") {
        setModoVista("abogado");
      } else {
        setModoVista("operador");
      }
    } else if (modoVistaProp) {
      setModoVista(modoVistaProp);
    }
  }, [modoVistaProp]);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const res = await obtenerDisponibilidadOperativaAction(negocio);
      setItems(res);
      if (res && res.length > 0 && res[0] && !abogadoSeleccionadoId) {
        setAbogadoSeleccionadoId(res[0].id || "");
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar disponibilidad operativa");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

  // Modificación en tiempo real por el operador
  const modificarCantidad = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const nuevaCant = Math.max(0, it.cantidad_disponible + delta);
        const nuevoEstado =
          nuevaCant === 0 ? "AGOTADO" : nuevaCant <= 3 ? "BAJO" : "DISPONIBLE";
        return {
          ...it,
          cantidad_disponible: nuevaCant,
          estado: nuevoEstado,
        };
      })
    );
  };

  const cambiarEstado = (id: string, nuevoEstado: "DISPONIBLE" | "BAJO" | "AGOTADO") => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const cant =
          nuevoEstado === "AGOTADO"
            ? 0
            : nuevoEstado === "BAJO" && it.cantidad_disponible === 0
            ? 2
            : it.cantidad_disponible === 0
            ? 5
            : it.cantidad_disponible;
        return {
          ...it,
          estado: nuevoEstado,
          cantidad_disponible: cant,
        };
      })
    );
  };

  // Guardar sincronización general
  const handleGuardar = async () => {
    setGuardando(true);
    setError(null);
    setMensajeExito(null);
    try {
      const res = await actualizarDisponibilidadOperativaAction(negocio, items);
      if (res.ok) {
        setMensajeExito("¡Disponibilidad sincronizada con la Web, agenda y ARIA MCP!");
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setError(res.error || "No se pudo guardar la disponibilidad");
      }
    } catch (err: any) {
      setError(err.message || "Error al sincronizar");
    } finally {
      setGuardando(false);
    }
  };

  // Acción del Abogado: Enviar propuesta preliminar de horas
  const handleEnviarPropuestaPreliminar = async (itemId: string, horas: number) => {
    setProcesandoId(itemId);
    setError(null);
    setMensajeExito(null);
    try {
      const res = await proponerDisponibilidadPreliminarAction(
        negocio,
        itemId,
        horas,
        nombreAbogadoInput
      );
      if (res.ok && res.items) {
        setItems(res.items);
        setMensajeExito("✅ Propuesta preliminar enviada al Operador para su revisión y aprobación.");
        setTimeout(() => setMensajeExito(null), 4500);
      } else {
        setError(res.error || "Error al enviar la propuesta.");
      }
    } catch (err: any) {
      setError(err.message || "Error al enviar propuesta");
    } finally {
      setProcesandoId(null);
    }
  };

  // Acción del Operador: Aprobar propuesta individual
  const handleAprobarPropuesta = async (itemId: string, horas?: number) => {
    setProcesandoId(itemId);
    setError(null);
    setMensajeExito(null);
    try {
      const res = await aprobarPropuestaDisponibilidadAction(negocio, itemId, horas);
      if (res.ok && res.items) {
        setItems(res.items);
        setMensajeExito("✅ Propuesta de horas aprobada y activada en el catálogo y ARIA.");
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setError(res.error || "Error al aprobar la propuesta.");
      }
    } catch (err: any) {
      setError(err.message || "Error al aprobar propuesta");
    } finally {
      setProcesandoId(null);
    }
  };

  // Acción del Operador: Aprobar todas las propuestas preliminares
  const handleAprobarTodasPropuestas = async () => {
    setGuardando(true);
    setError(null);
    setMensajeExito(null);
    try {
      const actualizados = items.map((it) => {
        if (it.estado_aprobacion === "PRELIMINAR" && typeof it.propuesta_preliminar_horas === "number") {
          return {
            ...it,
            cantidad_disponible: it.propuesta_preliminar_horas,
            estado: (it.propuesta_preliminar_horas <= 0 ? "AGOTADO" : it.propuesta_preliminar_horas <= 3 ? "BAJO" : "DISPONIBLE") as any,
            estado_aprobacion: "APROBADO" as const,
            propuesta_preliminar_horas: undefined,
          };
        }
        return it;
      });

      const res = await actualizarDisponibilidadOperativaAction(negocio, actualizados);
      if (res.ok && res.items) {
        setItems(res.items);
        setMensajeExito("🎉 Todas las propuestas preliminares fueron aprobadas y sincronizadas exitosamente.");
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setError(res.error || "Error al aprobar todas las propuestas.");
      }
    } catch (err: any) {
      setError(err.message || "Error al aprobar todas las propuestas");
    } finally {
      setGuardando(false);
    }
  };

  // Acción del Operador: Rechazar / Descartar propuesta preliminar
  const handleRechazarPropuesta = async (itemId: string) => {
    setProcesandoId(itemId);
    setError(null);
    setMensajeExito(null);
    try {
      const res = await rechazarPropuestaDisponibilidadAction(negocio, itemId);
      if (res.ok && res.items) {
        setItems(res.items);
        setMensajeExito("Propuesta preliminar descartada.");
        setTimeout(() => setMensajeExito(null), 3000);
      } else {
        setError(res.error || "Error al descartar la propuesta.");
      }
    } catch (err: any) {
      setError(err.message || "Error al descartar propuesta");
    } finally {
      setProcesandoId(null);
    }
  };

  // Cálculos de métricas
  const propuestasPendientes = useMemo(
    () => items.filter((it) => it.estado_aprobacion === "PRELIMINAR"),
    [items]
  );

  const totalHorasDisponibles = useMemo(
    () => items.reduce((acc, it) => acc + (it.cantidad_disponible || 0), 0),
    [items]
  );

  const itemsFiltrados = useMemo(() => {
    return items.filter((it) => {
      if (filtroCategoria !== "TODAS" && it.categoria_tipo !== filtroCategoria) return false;
      if (filtroEstadoAprobacion === "PRELIMINAR" && it.estado_aprobacion !== "PRELIMINAR") return false;
      if (filtroEstadoAprobacion === "APROBADO" && it.estado_aprobacion === "PRELIMINAR") return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const matchNombre = it.nombre.toLowerCase().includes(q);
        const matchEsp = (it.detalle?.especialidad || "").toLowerCase().includes(q);
        const matchCod = it.codigo.toLowerCase().includes(q);
        if (!matchNombre && !matchEsp && !matchCod) return false;
      }
      return true;
    });
  }, [items, filtroCategoria, filtroEstadoAprobacion, busqueda]);

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        border: "1px solid #E2E8F0",
        padding: "24px",
        boxShadow: "0 4px 12px -2px rgba(0, 0, 0, 0.05)",
        maxWidth: enModal ? "820px" : "100%",
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* 1. Cabecera Principal del Widget */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "14px",
          borderBottom: "1px solid #F1F5F9",
          paddingBottom: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              background: esFloristeria ? "#FFF1F2" : esLegal ? "#F5F3FF" : "#F0F9FF",
              color: esFloristeria ? "#E11D48" : esLegal ? "#5000BA" : "#0284C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
            }}
          >
            {esFloristeria ? (
              <Flower2 size={24} />
            ) : esLegal ? (
              <Scale size={24} />
            ) : (
              <Wrench size={24} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.01em",
                }}
              >
                {esLegal
                  ? "Disponibilidad de Agenda & Horas de Abogados"
                  : esFloristeria
                  ? "Disponibilidad Diaria de Taller (Rosas & Empaques)"
                  : "Disponibilidad de Cuadrillas Técnicas & Zonas"}
              </h2>
              <span
                style={{
                  background: "#ECFDF5",
                  color: "#059669",
                  padding: "3px 9px",
                  borderRadius: "14px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  border: "1px solid #A7F3D0",
                }}
              >
                <Bot size={12} />
                ARIA MCP Sincronizado
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.84rem",
                color: "#64748B",
              }}
            >
              {esLegal
                ? "Gestión de turnos y cupos de atención profesional. Los abogados proponen horas preliminares y el operador aprueba para activar en Web y ARIA."
                : esFloristeria
                ? "Actualiza en segundos los bonches (25 tallos) y colores de rosas disponibles para la web y el bot de WhatsApp."
                : "Control de cuadrillas técnicas disponibles para emergencias (45-60 min) y visitas programadas."}
            </p>
          </div>
        </div>

        {/* Selector de Modo de Vista & Acciones Rápidas */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Conmutador de Modo de Vista */}
          <div
            style={{
              display: "flex",
              background: "#F1F5F9",
              padding: "3px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
            }}
          >
            <button
              type="button"
              onClick={() => setModoVista("operador")}
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                border: "none",
                background: modoVista === "operador" ? "#FFFFFF" : "transparent",
                color: modoVista === "operador" ? "#0F172A" : "#64748B",
                fontWeight: modoVista === "operador" ? 700 : 500,
                fontSize: "0.75rem",
                cursor: "pointer",
                boxShadow: modoVista === "operador" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <ShieldCheck size={13} color="#05876E" />
              Vista Operador
              {propuestasPendientes.length > 0 && (
                <span
                  style={{
                    background: "#EF4444",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "1px 6px",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                  }}
                >
                  {propuestasPendientes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModoVista("abogado")}
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                border: "none",
                background: modoVista === "abogado" ? "#FFFFFF" : "transparent",
                color: modoVista === "abogado" ? "#5000BA" : "#64748B",
                fontWeight: modoVista === "abogado" ? 700 : 500,
                fontSize: "0.75rem",
                cursor: "pointer",
                boxShadow: modoVista === "abogado" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Briefcase size={13} color="#5000BA" />
              Vista Abogado (Preliminar)
            </button>
          </div>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
            style={{
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              color: "#475569",
              padding: "7px 12px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <RefreshCw size={13} className={cargando ? "animate-spin" : ""} />
            <span>Recargar</span>
          </button>

          {modoVista === "operador" && (
            <button
              type="button"
              onClick={handleGuardar}
              disabled={guardando}
              style={{
                background: "var(--violeta, #5000BA)",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 6px rgba(80, 0, 186, 0.25)",
              }}
            >
              <Save size={14} />
              <span>{guardando ? "Sincronizando..." : "Sincronizar"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Banner de Notificaciones y Alertas */}
      {mensajeExito && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #86EFAC",
            color: "#166534",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <CheckCircle2 size={18} color="#16A34A" />
          <span style={{ fontWeight: 600 }}>{mensajeExito}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertCircle size={18} color="#DC2626" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. SECCIÓN ESPECIAL: MODO ABOGADO (PROPUESTA PRELIMINAR) */}
      {modoVista === "abogado" && (
        <div
          style={{
            background: "#F5F3FF",
            border: "1.5px solid #DDD6FE",
            borderRadius: "14px",
            padding: "18px 20px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <Briefcase size={18} color="#5000BA" />
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#4C1D95" }}>
              Panel de Postulación / Declaración de Disponibilidad Preliminar
            </h3>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: "0.82rem", color: "#5B21B6", lineHeight: 1.5 }}>
            Como abogado socio o especialista, ingresa las horas semanales o mensuales que dispondrás para consultas 1-a-1.
            Tu propuesta quedará registrada en estado <strong>Preliminar</strong> hasta que el <strong>Operador</strong> la revise y apruebe.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              alignItems: "flex-end",
              background: "#FFFFFF",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #E9D5FF",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "5px" }}>
                Selecciona tu Especialidad / Turno:
              </label>
              <select
                value={abogadoSeleccionadoId}
                onChange={(e) => setAbogadoSeleccionadoId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  color: "#0F172A",
                  background: "#fff",
                  outline: "none",
                }}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.nombre} ({it.cantidad_disponible} hrs activas)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "5px" }}>
                Horas Disponibles Propuestas:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={horasPropuestasInput}
                  onChange={(e) => setHorasPropuestasInput(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#0F172A",
                  }}
                />
                <span style={{ fontSize: "0.8rem", color: "#64748B", fontWeight: 600 }}>horas</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => handleEnviarPropuestaPreliminar(abogadoSeleccionadoId, horasPropuestasInput)}
                disabled={procesandoId === abogadoSeleccionadoId}
                style={{
                  width: "100%",
                  background: "#5000BA",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(80, 0, 186, 0.2)",
                }}
              >
                <Send size={14} />
                <span>{procesandoId === abogadoSeleccionadoId ? "Enviando..." : "Enviar Propuesta Preliminar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SECCIÓN DE ALERTA: BANDEJA DE PROPUESTAS PENDIENTES (MODO OPERADOR) */}
      {modoVista === "operador" && propuestasPendientes.length > 0 && (
        <div
          style={{
            background: "#FFFBEB",
            border: "1.5px solid #FDE68A",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#92400E" }}>
                {propuestasPendientes.length} Propuesta(s) de Disponibilidad Preliminar Pendiente(s) de Aprobación
              </h3>
            </div>

            <button
              type="button"
              onClick={handleAprobarTodasPropuestas}
              disabled={guardando}
              style={{
                background: "#059669",
                color: "#FFFFFF",
                border: "none",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: "0 1px 3px rgba(5, 150, 105, 0.2)",
              }}
            >
              <CheckCheck size={14} />
              <span>Aprobar Todas las Propuestas</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {propuestasPendientes.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  border: "1px solid #FCD34D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                    {p.nombre}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span>Horas actuales: <strong>{p.cantidad_disponible}</strong></span>
                    <span>•</span>
                    <span style={{ color: "#D97706", fontWeight: 700 }}>
                      Propuesta recibida: {p.propuesta_preliminar_horas} horas
                    </span>
                    {p.propuesta_por_nombre && (
                      <>
                        <span>•</span>
                        <span>Por: {p.propuesta_por_nombre}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => handleAprobarPropuesta(p.id, p.propuesta_preliminar_horas)}
                    disabled={procesandoId === p.id}
                    style={{
                      background: "#10B981",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Aprobar ({p.propuesta_preliminar_horas} hrs)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRechazarPropuesta(p.id)}
                    disabled={procesandoId === p.id}
                    style={{
                      background: "#F1F5F9",
                      color: "#64748B",
                      border: "1px solid #CBD5E1",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <XCircle size={13} />
                    <span>Descartar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Métricas de Resumen */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 14px" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
            {esLegal ? "Total Horas Disponibles" : "Stock Total Operativo"}
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
            {totalHorasDisponibles} <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748B" }}>{esLegal ? "hrs" : "unidades"}</span>
          </div>
        </div>

        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 14px" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
            {esLegal ? "Especialistas en Catálogo" : "Líneas de Insumos"}
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
            {items.length} <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748B" }}>perfiles</span>
          </div>
        </div>

        <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 14px" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>
            Propuestas Preliminares
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: propuestasPendientes.length > 0 ? "#D97706" : "#059669", marginTop: "4px" }}>
            {propuestasPendientes.length} <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748B" }}>pendientes</span>
          </div>
        </div>
      </div>

      {/* 6. Barra de Búsqueda y Filtros */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "240px" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "360px",
            }}
          >
            <Search
              size={14}
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
            />
            <input
              type="text"
              placeholder="Buscar por especialista o área..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px 7px 32px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.8rem",
                color: "#1E293B",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setFiltroEstadoAprobacion("TODOS")}
              style={{
                padding: "5px 10px",
                borderRadius: "16px",
                border: filtroEstadoAprobacion === "TODOS" ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
                background: filtroEstadoAprobacion === "TODOS" ? "#F1F5F9" : "#fff",
                color: filtroEstadoAprobacion === "TODOS" ? "#0F172A" : "#64748B",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Todos ({items.length})
            </button>

            <button
              type="button"
              onClick={() => setFiltroEstadoAprobacion("PRELIMINAR")}
              style={{
                padding: "5px 10px",
                borderRadius: "16px",
                border: filtroEstadoAprobacion === "PRELIMINAR" ? "1.5px solid #D97706" : "1px solid #CBD5E1",
                background: filtroEstadoAprobacion === "PRELIMINAR" ? "#FEF3C7" : "#fff",
                color: filtroEstadoAprobacion === "PRELIMINAR" ? "#B45309" : "#64748B",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🟡 Preliminares ({propuestasPendientes.length})
            </button>
          </div>
        </div>
      </div>

      {/* 7. Rejilla de Especialistas / Recursos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: "14px",
        }}
      >
        {itemsFiltrados.map((it) => {
          const esAgotado = it.estado === "AGOTADO";
          const esBajo = it.estado === "BAJO";
          const esPreliminar = it.estado_aprobacion === "PRELIMINAR";

          return (
            <div
              key={it.id}
              style={{
                background: esAgotado ? "#F8FAFC" : "#FFFFFF",
                border: esPreliminar
                  ? "2px solid #F59E0B"
                  : esAgotado
                  ? "1px solid #E2E8F0"
                  : esBajo
                  ? "1.5px solid #FCD34D"
                  : "1.5px solid #E2E8F0",
                borderRadius: "14px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
                boxShadow: esPreliminar ? "0 4px 12px rgba(245, 158, 11, 0.1)" : "0 1px 3px rgba(0,0,0,0.03)",
                opacity: esAgotado ? 0.75 : 1,
                position: "relative",
              }}
            >
              {/* Badge de Estado Preliminar si aplica */}
              {esPreliminar && (
                <div
                  style={{
                    position: "absolute",
                    top: "-10px",
                    right: "12px",
                    background: "#F59E0B",
                    color: "#FFFFFF",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Clock size={11} />
                  Propuesta Preliminar ({it.propuesta_preliminar_horas} hrs)
                </div>
              )}

              {/* Encabezado del ítem */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                {it.color_hex ? (
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      backgroundColor: it.color_hex,
                      border: "2px solid #CBD5E1",
                      flexShrink: 0,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#F1F5F9",
                      color: "#475569",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Scale size={16} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      color: esAgotado ? "#64748B" : "#0F172A",
                      lineHeight: 1.3,
                    }}
                  >
                    {it.nombre}
                  </div>
                  {it.detalle?.especialidad && (
                    <div style={{ fontSize: "0.74rem", color: "#64748B", marginTop: "2px" }}>
                      Especialidad: <strong>{it.detalle.especialidad}</strong>
                      {it.detalle.tarifa_hora && ` • $${it.detalle.tarifa_hora}/hr`}
                    </div>
                  )}
                </div>
              </div>

              {/* Contador de Horas / Stock */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F8FAFC",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #F1F5F9",
                }}
              >
                <span
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  {it.unidad === "HORA"
                    ? "Horas Activas Disponibles"
                    : it.unidad === "BONCHE"
                    ? "Bonches (25 u.)"
                    : "Stock Disponible"}
                  :
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {modoVista === "operador" && (
                    <button
                      type="button"
                      onClick={() => modificarCantidad(it.id, -1)}
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Minus size={13} />
                    </button>
                  )}

                  <span
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      color: esAgotado ? "#94A3B8" : "#0F172A",
                      minWidth: "28px",
                      textAlign: "center",
                    }}
                  >
                    {it.cantidad_disponible}
                  </span>

                  {modoVista === "operador" && (
                    <button
                      type="button"
                      onClick={() => modificarCantidad(it.id, 1)}
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Botones de Estado y Aprobación Rápida */}
              {modoVista === "operador" ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(it.id, "DISPONIBLE")}
                    style={{
                      flex: 1,
                      padding: "5px 6px",
                      borderRadius: "6px",
                      border:
                        it.estado === "DISPONIBLE"
                          ? "1.5px solid #16A34A"
                          : "1px solid #E2E8F0",
                      background: it.estado === "DISPONIBLE" ? "#DCFCE7" : "#FFFFFF",
                      color: it.estado === "DISPONIBLE" ? "#15803D" : "#64748B",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🟢 Disponible
                  </button>

                  <button
                    type="button"
                    onClick={() => cambiarEstado(it.id, "BAJO")}
                    style={{
                      flex: 1,
                      padding: "5px 6px",
                      borderRadius: "6px",
                      border:
                        it.estado === "BAJO"
                          ? "1.5px solid #D97706"
                          : "1px solid #E2E8F0",
                      background: it.estado === "BAJO" ? "#FEF3C7" : "#FFFFFF",
                      color: it.estado === "BAJO" ? "#B45309" : "#64748B",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🟡 Poco
                  </button>

                  <button
                    type="button"
                    onClick={() => cambiarEstado(it.id, "AGOTADO")}
                    style={{
                      flex: 1,
                      padding: "5px 6px",
                      borderRadius: "6px",
                      border:
                        it.estado === "AGOTADO"
                          ? "1.5px solid #DC2626"
                          : "1px solid #E2E8F0",
                      background: it.estado === "AGOTADO" ? "#FEE2E2" : "#FFFFFF",
                      color: it.estado === "AGOTADO" ? "#B91C1C" : "#64748B",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🔴 Agotado
                  </button>
                </div>
              ) : (
                /* Vista Abogado: Botón de postulación directa */
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: esPreliminar ? "#D97706" : "#059669",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {esPreliminar ? "🟡 En Revisión por Operador" : "🟢 Horas Aprobadas y Activas"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAbogadoSeleccionadoId(it.id);
                      setHorasPropuestasInput(it.cantidad_disponible || 8);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    style={{
                      background: "#F5F3FF",
                      color: "#5000BA",
                      border: "1px solid #DDD6FE",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Proponer Horas
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Alias exportado para compatibilidad plena
export const DisponibilidadAbogadosWidget = TableroDisponibilidadOperativa;
