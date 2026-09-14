"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  ItemDisponibilidadOperativa,
  obtenerDisponibilidadOperativaAction,
  actualizarDisponibilidadOperativaAction,
} from "../acciones";

interface Props {
  negocio?: string;
  enModal?: boolean;
  onCerrar?: () => void;
}

export function TableroDisponibilidadOperativa({
  negocio = "tinkay",
  enModal = false,
  onCerrar,
}: Props) {
  const esFloristeria = negocio === "tinkay" || negocio === "margaritas";
  const esLegal = negocio === "tranqi";
  const esMantenimiento = negocio === "fastfix";

  const [items, setItems] = useState<ItemDisponibilidadOperativa[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const res = await obtenerDisponibilidadOperativaAction(negocio);
      setItems(res);
    } catch (err: any) {
      setError(err.message || "Error al cargar disponibilidad");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

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

  const handleGuardar = async () => {
    setGuardando(true);
    setError(null);
    setMensajeExito(null);
    try {
      const res = await actualizarDisponibilidadOperativaAction(negocio, items);
      if (res.ok) {
        setMensajeExito("¡Disponibilidad sincronizada con la Web y con ARIA!");
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

  const itemsFiltrados = items.filter((it) => {
    if (filtroCategoria === "TODAS") return true;
    return it.categoria_tipo === filtroCategoria;
  });

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        border: "1px solid #E2E8F0",
        padding: "20px 24px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        maxWidth: enModal ? "780px" : "100%",
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* Cabecera del Widget */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: esFloristeria
                ? "#FFF1F2"
                : esLegal
                ? "#F5F3FF"
                : "#F0F9FF",
              color: esFloristeria
                ? "#E11D48"
                : esLegal
                ? "#5000BA"
                : "#0284C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {esFloristeria ? (
              <Flower2 size={22} />
            ) : esLegal ? (
              <Scale size={22} />
            ) : (
              <Wrench size={22} />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#0F172A",
                }}
              >
                {esFloristeria
                  ? "Disponibilidad Diaria de Taller (Rosas & Empaques)"
                  : esLegal
                  ? "Disponibilidad de Agenda & Horas de Abogados"
                  : "Disponibilidad de Cuadrillas Técnicas & Zonas"}
              </h2>
              <span
                style={{
                  background: "#ECFDF5",
                  color: "#059669",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Bot size={12} />
                ARIA MCP Activo
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.82rem",
                color: "#64748B",
              }}
            >
              {esFloristeria
                ? "Actualiza en segundos los bonches (25 tallos) y colores de rosas disponibles para la web y el bot de WhatsApp."
                : esLegal
                ? "Control de horas profesionales disponibles por abogado para consultas 1-a-1 y redacción."
                : "Control de cuadrillas técnicas disponibles para emergencias (45-60 min) y visitas programadas."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
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
              gap: "4px",
            }}
          >
            <RefreshCw size={13} className={cargando ? "animate-spin" : ""} />
            <span>Recargar</span>
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            style={{
              background: esFloristeria ? "#E11D48" : "#0F172A",
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
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <Save size={14} />
            <span>{guardando ? "Sincronizando..." : "Sincronizar"}</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #86EFAC",
            color: "#166534",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{mensajeExito}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filtros de Categoría */}
      {esFloristeria && (
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => setFiltroCategoria("TODAS")}
            style={{
              padding: "5px 12px",
              borderRadius: "20px",
              border:
                filtroCategoria === "TODAS"
                  ? "1.5px solid #E11D48"
                  : "1px solid #CBD5E1",
              background: filtroCategoria === "TODAS" ? "#FFF1F2" : "#FFFFFF",
              color: filtroCategoria === "TODAS" ? "#BE123C" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Todos ({items.length})
          </button>

          <button
            type="button"
            onClick={() => setFiltroCategoria("ROSAS")}
            style={{
              padding: "5px 12px",
              borderRadius: "20px",
              border:
                filtroCategoria === "ROSAS"
                  ? "1.5px solid #E11D48"
                  : "1px solid #CBD5E1",
              background: filtroCategoria === "ROSAS" ? "#FFF1F2" : "#FFFFFF",
              color: filtroCategoria === "ROSAS" ? "#BE123C" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🌹 Rosas por Color
          </button>

          <button
            type="button"
            onClick={() => setFiltroCategoria("ENVOLTORIO")}
            style={{
              padding: "5px 12px",
              borderRadius: "20px",
              border:
                filtroCategoria === "ENVOLTORIO"
                  ? "1.5px solid #E11D48"
                  : "1px solid #CBD5E1",
              background:
                filtroCategoria === "ENVOLTORIO" ? "#FFF1F2" : "#FFFFFF",
              color: filtroCategoria === "ENVOLTORIO" ? "#BE123C" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🎁 Envoltorios Coreanos
          </button>
        </div>
      )}

      {/* Grid de Ítems */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        {itemsFiltrados.map((it) => {
          const esAgotado = it.estado === "AGOTADO";
          const esBajo = it.estado === "BAJO";

          return (
            <div
              key={it.id}
              style={{
                background: esAgotado ? "#F8FAFC" : "#FFFFFF",
                border: esAgotado
                  ? "1px solid #E2E8F0"
                  : esBajo
                  ? "1.5px solid #FCD34D"
                  : "1.5px solid #E2E8F0",
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "10px",
                opacity: esAgotado ? 0.7 : 1,
              }}
            >
              {/* Encabezado del ítem */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                {it.color_hex && (
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: it.color_hex,
                      border: "2px solid #CBD5E1",
                      flexShrink: 0,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      color: esAgotado ? "#64748B" : "#0F172A",
                    }}
                  >
                    {it.nombre}
                  </div>
                  {it.nombre_secundario && (
                    <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                      {it.nombre_secundario}
                    </div>
                  )}
                </div>
              </div>

              {/* Contador de Bonches / Horas / Cuadrillas */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F8FAFC",
                  padding: "6px 10px",
                  borderRadius: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  {it.unidad === "BONCHE"
                    ? "Bonches (25 u.)"
                    : it.unidad === "HORA"
                    ? "Horas libres"
                    : it.unidad === "CUADRILLA"
                    ? "Cuadrillas"
                    : "Stock"}
                  :
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => modificarCantidad(it.id, -1)}
                    style={{
                      width: "24px",
                      height: "24px",
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

                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: esAgotado ? "#94A3B8" : "#0F172A",
                      minWidth: "24px",
                      textAlign: "center",
                    }}
                  >
                    {it.cantidad_disponible}
                  </span>

                  <button
                    type="button"
                    onClick={() => modificarCantidad(it.id, 1)}
                    style={{
                      width: "24px",
                      height: "24px",
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
                </div>
              </div>

              {/* Botones de Estado Rápido */}
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => cambiarEstado(it.id, "DISPONIBLE")}
                  style={{
                    flex: 1,
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border:
                      it.estado === "DISPONIBLE"
                        ? "1.5px solid #16A34A"
                        : "1px solid #E2E8F0",
                    background:
                      it.estado === "DISPONIBLE" ? "#DCFCE7" : "#FFFFFF",
                    color:
                      it.estado === "DISPONIBLE" ? "#15803D" : "#64748B",
                    fontSize: "0.68rem",
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
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border:
                      it.estado === "BAJO"
                        ? "1.5px solid #D97706"
                        : "1px solid #E2E8F0",
                    background: it.estado === "BAJO" ? "#FEF3C7" : "#FFFFFF",
                    color: it.estado === "BAJO" ? "#B45309" : "#64748B",
                    fontSize: "0.68rem",
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
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border:
                      it.estado === "AGOTADO"
                        ? "1.5px solid #DC2626"
                        : "1px solid #E2E8F0",
                    background:
                      it.estado === "AGOTADO" ? "#FEE2E2" : "#FFFFFF",
                    color: it.estado === "AGOTADO" ? "#B91C1C" : "#64748B",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔴 Agotado
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
