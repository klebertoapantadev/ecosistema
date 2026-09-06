"use client";

import React, { useState, useEffect } from "react";
import {
  Users, UserPlus, Search, Building2, User, Scale, Calendar,
  Folder, Eye, Plus, CheckCircle2, Shield, Sparkles, Filter, ChevronRight
} from "lucide-react";
import { obtenerClientesCRM } from "../acciones";
import { ModalAltaClienteAsistida } from "./ModalAltaClienteAsistida";
import { FichaClienteDetalleModal } from "./FichaClienteDetalleModal";

interface Props {
  negocio?: string;
}

export function BandejaClientesCRM({ negocio = "TRANQ" }: Props) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "natural" | "juridica">("todas");

  // Modales
  const [modalAltaAbierto, setModalAltaAbierto] = useState(false);
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<string | null>(null);

  // Mensaje de éxito temporal
  const [toastExito, setToastExito] = useState<string | null>(null);

  const cargarClientes = () => {
    setCargando(true);
    obtenerClientesCRM({ busqueda, tipoPersoneria: filtroTipo })
      .then((data) => setClientes(data))
      .catch((err) => console.error("Error al cargar clientes:", err))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarClientes();
  }, [filtroTipo]);

  const manejarBusquedaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cargarClientes();
  };

  const manejarAltaExito = (res: {
    clienteId: string;
    nombreCompleto: string;
    identificacion: string;
    accionContinuidad: "solo_guardar" | "radicar_expediente" | "agendar_cita";
  }) => {
    setModalAltaAbierto(false);
    cargarClientes();

    if (res.accionContinuidad === "solo_guardar") {
      setToastExito(`✅ Cliente ${res.nombreCompleto} registrado exitosamente.`);
      setTimeout(() => setToastExito(null), 4000);
    } else if (res.accionContinuidad === "radicar_expediente") {
      setClienteSeleccionadoId(res.clienteId);
      setToastExito(`✅ Cliente guardado. Abriendo expediente...`);
      setTimeout(() => setToastExito(null), 4000);
    } else if (res.accionContinuidad === "agendar_cita") {
      setClienteSeleccionadoId(res.clienteId);
      setToastExito(`✅ Cliente guardado. Abriendo agenda de citas...`);
      setTimeout(() => setToastExito(null), 4000);
    }
  };

  const totalNaturales = clientes.filter((c) => c.clp_tipo_personeria === "natural").length;
  const totalJuridicas = clientes.filter((c) => c.clp_tipo_personeria === "juridica").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%" }}>
      {/* Toast Informativo */}
      {toastExito && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #86EFAC",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "0.9rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        >
          <CheckCircle2 size={18} />
          {toastExito}
        </div>
      )}

      {/* Cabecera y KPIs Rápidos */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "10px" }}>
            <Users size={26} color="#0284C7" />
            CRM Jurídico y Recepción de Clientes
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Administración 360° de personas naturales y jurídicas, validación ARIA y verificación de conflicto de intereses
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAltaAbierto(true)}
          style={{
            background: "#0284C7",
            color: "#FFFFFF",
            border: "none",
            padding: "10px 20px",
            borderRadius: "10px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 6px -1px rgba(2, 132, 199, 0.25)",
            transition: "all 0.15s ease",
          }}
        >
          <UserPlus size={18} />
          + Registrar Cliente
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        {/* Filtros por Píldoras */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setFiltroTipo("todas")}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: filtroTipo === "todas" ? "1px solid #0284C7" : "1px solid #E2E8F0",
              background: filtroTipo === "todas" ? "#F0F9FF" : "#FFFFFF",
              color: filtroTipo === "todas" ? "#0284C7" : "#64748B",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Todos ({clientes.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo("natural")}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: filtroTipo === "natural" ? "1px solid #0284C7" : "1px solid #E2E8F0",
              background: filtroTipo === "natural" ? "#F0F9FF" : "#FFFFFF",
              color: filtroTipo === "natural" ? "#0284C7" : "#64748B",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <User size={14} />
            Personas Naturales
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo("juridica")}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              border: filtroTipo === "juridica" ? "1px solid #0284C7" : "1px solid #E2E8F0",
              background: filtroTipo === "juridica" ? "#F0F9FF" : "#FFFFFF",
              color: filtroTipo === "juridica" ? "#0284C7" : "#64748B",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Building2 size={14} />
            Empresas (Jurídicas)
          </button>
        </div>

        {/* Buscador */}
        <form onSubmit={manejarBusquedaSubmit} style={{ display: "flex", gap: "8px", flex: 1, maxWidth: "380px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
            <input
              type="text"
              placeholder="Buscar por Cédula, RUC o Nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "0 14px",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Lista / DataGrid de Clientes */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {cargando ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
            Cargando cartera de clientes...
          </div>
        ) : clientes.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <Users size={40} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0F172A" }}>
              No se encontraron clientes registrados
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748B" }}>
              Utiliza el botón "+ Registrar Cliente" para dar de alta al primer cliente desde el mostrador.
            </p>
            <button
              type="button"
              onClick={() => setModalAltaAbierto(true)}
              style={{
                background: "#0284C7",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Registrar Primer Cliente
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Identificación</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Cliente / Razón Social</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Personería</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Contacto</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Origen</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const nombre = c.clp_razon_social || `${c.clp_nombres || ""} ${c.clp_apellidos || ""}`.trim();
                  return (
                    <tr
                      key={c.clp_id}
                      style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.1s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0F172A" }}>
                        <span style={{ background: "#F1F5F9", padding: "3px 8px", borderRadius: "6px", fontSize: "0.8rem" }}>
                          {c.clp_identificacion}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#0F172A" }}>{nombre}</div>
                        {c.clp_casillero_judicial && (
                          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            Casillero: {c.clp_casillero_judicial}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: c.clp_tipo_personeria === "juridica" ? "#E0F2FE" : "#F3E8FF",
                            color: c.clp_tipo_personeria === "juridica" ? "#0284C7" : "#7E22CE",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {c.clp_tipo_personeria === "juridica" ? <Building2 size={12} /> : <User size={12} />}
                          {c.clp_tipo_personeria === "juridica" ? "Jurídica" : "Natural"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#475569" }}>
                        <div>{c.clp_correo || "—"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{c.clp_celular || c.clp_telefono || "—"}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748B", textTransform: "capitalize" }}>
                          {c.clp_origen_registro?.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setClienteSeleccionadoId(c.clp_id)}
                          style={{
                            background: "#F0F9FF",
                            border: "1px solid #BAE6FD",
                            color: "#0284C7",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Eye size={14} />
                          Ficha 360°
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales de Alta y Detalle 360 */}
      <ModalAltaClienteAsistida
        abierto={modalAltaAbierto}
        alCerrar={() => setModalAltaAbierto(false)}
        alGuardarExitoso={manejarAltaExito}
      />

      <FichaClienteDetalleModal
        clienteId={clienteSeleccionadoId}
        alCerrar={() => setClienteSeleccionadoId(null)}
      />
    </div>
  );
}
