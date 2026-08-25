"use client";

import React, { useState, useEffect } from "react";
import { BarChart2, RefreshCw, Eye, Search, Filter, X } from "lucide-react";

export interface CampanaBitacora {
  id: string;
  asunto: string;
  contenidoHTML?: string;
  contenidoMarkdown?: string;
  tipoEmision: "MANUAL" | "AUTOMATICA";
  emisorNombre: string;
  emisorCorreo: string;
  emisorId?: string;
  procesoOrigen: string;
  audiencia: string;
  canales: string[];
  destinatariosDetalle?: string[];
  enviados: number;
  leidos: number;
  ignorados: number;
  fecha: string;
  correoEnviadoReal?: boolean;
}

interface Props {
  negocio?: string;
}

export function BitacoraNotificacionesWidget({ negocio = "TRANQ" }: Props) {
  const [campanas, setCampanas] = useState<CampanaBitacora[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCanal, setFiltroCanal] = useState("TODOS");
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<CampanaBitacora | null>(null);

  const cargarBitacora = () => {
    setCargando(true);
    fetch("/api/notificaciones")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.campanas)) {
          setCampanas(data.campanas);
        }
      })
      .catch((err) => console.error("Error al obtener bitácora de notificaciones:", err))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarBitacora();
  }, [negocio]);

  const campanasFiltradas = campanas.filter((c) => {
    const coincideTexto =
      !busqueda ||
      c.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.emisorNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.emisorCorreo.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.procesoOrigen.toLowerCase().includes(busqueda.toLowerCase());

    const coincideCanal =
      filtroCanal === "TODOS" || c.canales.includes(filtroCanal);

    return coincideTexto && coincideCanal;
  });

  return (
    <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #E4E4E4", padding: "24px", width: "100%" }}>
      {/* CABECERA WIDGET INDEPENDIENTE BITÁCORA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px", borderBottom: "1px solid #F1F5F9", paddingBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart2 size={22} color="#2563EB" /> Bitácora & Historial de Notificaciones Emitidas ({negocio})
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "2px 0 0 0" }}>
            Consulta auditada en tiempo real para Operadores y Administradores. Detalle completo de notificaciones y destinatarios.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarBitacora}
          style={{
            background: "#F1F5F9",
            border: "1px solid #CBD5E1",
            color: "#334155",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={14} /> Actualizar Bitácora
        </button>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ flex: 1, minWidth: "240px", display: "flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 12px" }}>
          <Search size={16} color="#94A3B8" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por asunto, emisor o proceso..."
            style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: "0.85rem", color: "#1E293B" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={16} color="#64748B" />
          <select
            value={filtroCanal}
            onChange={(e) => setFiltroCanal(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "0.85rem", fontWeight: 700, background: "#ffffff", color: "#334155" }}
          >
            <option value="TODOS">Todos los Canales</option>
            <option value="IN_APP">In-App Banner</option>
            <option value="PUSH">Push Notification</option>
            <option value="EMAIL">Correo Email</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </div>
      </div>

      {/* TABLA DATAGRID BITÁCORA */}
      {cargando ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
          Cargando bitácora de notificaciones auditadas...
        </div>
      ) : campanasFiltradas.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#F8FAFC", borderRadius: "12px", border: "1px dashed #CBD5E1" }}>
          <BarChart2 style={{ width: 40, height: 40, color: "#94A3B8", margin: "0 auto 12px", display: "block" }} />
          <p style={{ margin: 0, fontWeight: 700, color: "#475569" }}>No se encontraron registros de notificaciones en la bitácora.</p>
        </div>
      ) : (
        <div className="tabla-panel-envoltura">
          <table className="tabla-panel" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Tipo</th>
                <th style={{ padding: "10px 12px" }}>Emisor (Quién lo Envió)</th>
                <th style={{ padding: "10px 12px" }}>Proceso / Origen</th>
                <th style={{ padding: "10px 12px" }}>Asunto / Contenido</th>
                <th style={{ padding: "10px 12px" }}>Audiencia</th>
                <th style={{ padding: "10px 12px" }}>Canales</th>
                <th style={{ padding: "10px 12px" }}>Fecha / Hora</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {campanasFiltradas.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: 800, background: c.tipoEmision === "MANUAL" ? "#DBEAFE" : "#FEF3C7", color: c.tipoEmision === "MANUAL" ? "#1E40AF" : "#92400E" }}>
                      {c.tipoEmision}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <strong style={{ display: "block", color: "#0F172A" }}>{c.emisorNombre}</strong>
                    <span style={{ fontSize: "0.74rem", color: "#64748B" }}>{c.emisorCorreo}</span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#4F46E5" }}>{c.procesoOrigen}</span>
                  </td>
                  <td style={{ padding: "12px", maxWidth: "260px" }}>
                    <strong style={{ display: "block", color: "#1E293B", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {c.asunto}
                    </strong>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#F1F5F9", color: "#334155", fontWeight: 800, fontSize: "0.72rem" }}>
                      {c.audiencia}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {c.canales.map((ch) => (
                        <span
                          key={ch}
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            background: ch === "IN_APP" ? "#DBEAFE" : ch === "PUSH" ? "#E0F2FE" : ch === "EMAIL" ? "#EEF2FF" : "#DCFCE7",
                            color: ch === "IN_APP" ? "#1E40AF" : ch === "PUSH" ? "#0369A1" : ch === "EMAIL" ? "#3730A3" : "#15803D",
                          }}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "12px", fontSize: "0.76rem", color: "#64748B" }}>
                    {c.fecha}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => setCampanaSeleccionada(c)}
                      style={{
                        background: "#EEF2FF",
                        border: "1px solid #C7D2FE",
                        color: "#4338CA",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Eye size={13} /> Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETALLE DE CAMPAÑA DE BITÁCORA */}
      {campanaSeleccionada && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "20px 24px", background: "#0F172A", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
                Registro Auditado de Notificación
              </h3>
              <button
                type="button"
                onClick={() => setCampanaSeleccionada(null)}
                style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#ffffff", borderRadius: "8px", padding: "6px", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "24px", overflowY: "auto", flex: 1, fontSize: "0.88rem" }}>
              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Asunto</span>
                <h4 style={{ margin: "4px 0 0 0", color: "#0F172A", fontSize: "1.1rem" }}>{campanaSeleccionada.asunto}</h4>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F8FAFC", padding: "14px", borderRadius: "12px", marginBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700 }}>Emisor:</span>
                  <strong style={{ display: "block", color: "#1E293B" }}>{campanaSeleccionada.emisorNombre}</strong>
                  <span style={{ fontSize: "0.74rem", color: "#475569" }}>{campanaSeleccionada.emisorCorreo}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700 }}>Fecha / Origen:</span>
                  <strong style={{ display: "block", color: "#1E293B" }}>{campanaSeleccionada.fecha}</strong>
                  <span style={{ fontSize: "0.74rem", color: "#4F46E5", fontWeight: 700 }}>{campanaSeleccionada.procesoOrigen}</span>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Contenido Notificado</span>
                <div
                  style={{ marginTop: "6px", padding: "16px", background: "#ffffff", border: "1px solid #E2E8F0", borderRadius: "10px", lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: campanaSeleccionada.contenidoHTML || campanaSeleccionada.asunto }}
                />
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Destinatarios Auditados ({campanaSeleccionada.destinatariosDetalle?.length || campanaSeleccionada.enviados})</span>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px", marginTop: "6px", maxHeight: "120px", overflowY: "auto" }}>
                  {(campanaSeleccionada.destinatariosDetalle || [campanaSeleccionada.emisorCorreo]).map((email, idx) => (
                    <div key={idx} style={{ fontSize: "0.8rem", color: "#0F172A", fontWeight: 600, padding: "3px 0", borderBottom: idx < (campanaSeleccionada.destinatariosDetalle?.length || 1) - 1 ? "1px dashed #E2E8F0" : "none" }}>
                      • {email}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #F1F5F9", background: "#F8FAFC", textAlign: "right" }}>
              <button
                type="button"
                onClick={() => setCampanaSeleccionada(null)}
                style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: "#0F172A", color: "#ffffff", fontWeight: 800, cursor: "pointer" }}
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
