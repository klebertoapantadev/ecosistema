"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BarChart2, RefreshCw, Eye, X } from "lucide-react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";

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

  const columnas = useMemo<ColumnaDataGrid<CampanaBitacora>[]>(() => [
    {
      id: "tipo",
      encabezado: "Tipo",
      valor: (c) => c.tipoEmision,
      render: (c) => (
        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: 800, background: c.tipoEmision === "MANUAL" ? "var(--cf-dbeafe, #DBEAFE)" : "var(--cf-fef3c7, #FEF3C7)", color: c.tipoEmision === "MANUAL" ? "var(--ct-1e40af, #1E40AF)" : "var(--ct-92400e, #92400E)" }}>
          {c.tipoEmision}
        </span>
      ),
    },
    {
      id: "emisor",
      encabezado: "Emisor (Quién lo Envió)",
      valor: (c) => `${c.emisorNombre} ${c.emisorCorreo}`.trim(),
      render: (c) => (
        <div>
          <strong style={{ display: "block", color: "var(--ct-0f172a, #0F172A)" }}>{c.emisorNombre}</strong>
          <span style={{ fontSize: "0.74rem", color: "var(--ct-64748b, #64748B)" }}>{c.emisorCorreo}</span>
        </div>
      ),
    },
    {
      id: "proceso",
      encabezado: "Proceso / Origen",
      valor: (c) => c.procesoOrigen,
      render: (c) => (
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ct-4f46e5, #4F46E5)" }}>{c.procesoOrigen}</span>
      ),
    },
    {
      id: "asunto",
      encabezado: "Asunto / Contenido",
      valor: (c) => c.asunto,
      render: (c) => (
        <strong style={{ display: "block", color: "var(--ct-1e293b, #1E293B)", maxWidth: "260px" }}>
          {c.asunto}
        </strong>
      ),
    },
    {
      id: "audiencia",
      encabezado: "Audiencia",
      valor: (c) => c.audiencia,
      render: (c) => (
        <span style={{ padding: "3px 8px", borderRadius: "6px", background: "var(--cf-f1f5f9, #F1F5F9)", color: "var(--ct-334155, #334155)", fontWeight: 800, fontSize: "0.72rem" }}>
          {c.audiencia}
        </span>
      ),
    },
    {
      id: "canales",
      encabezado: "Canales",
      valor: (c) => c.canales.join(", "),
      render: (c) => (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {c.canales.map((ch) => (
            <span
              key={ch}
              style={{
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "0.68rem",
                fontWeight: 800,
                background: ch === "IN_APP" ? "var(--cf-dbeafe, #DBEAFE)" : ch === "PUSH" ? "var(--cf-e0f2fe, #E0F2FE)" : ch === "EMAIL" ? "var(--cf-eef2ff, #EEF2FF)" : "var(--cf-dcfce7, #DCFCE7)",
                color: ch === "IN_APP" ? "var(--ct-1e40af, #1E40AF)" : ch === "PUSH" ? "var(--ct-0369a1, #0369A1)" : ch === "EMAIL" ? "var(--ct-3730a3, #3730A3)" : "var(--ct-15803d, #15803D)",
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "fecha",
      encabezado: "Fecha / Hora",
      valor: (c) => c.fecha,
      render: (c) => <span style={{ fontSize: "0.76rem", color: "var(--ct-64748b, #64748B)" }}>{c.fecha}</span>,
    },
    {
      id: "acciones",
      encabezado: "Acción",
      ordenable: false,
      valor: () => "",
      render: (c) => (
        <button
          type="button"
          onClick={() => setCampanaSeleccionada(c)}
          style={{
            background: "var(--cf-eef2ff, #EEF2FF)",
            border: "1px solid var(--cb-c7d2fe, #C7D2FE)",
            color: "var(--ct-4338ca, #4338CA)",
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
      ),
    },
  ], []);

  return (
    <div style={{ background: "var(--cf-ffffff, #ffffff)", borderRadius: "16px", border: "1px solid var(--cb-e4e4e4, #E4E4E4)", padding: "24px", width: "100%" }}>
      {/* CABECERA WIDGET INDEPENDIENTE BITÁCORA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px", borderBottom: "1px solid var(--cb-f1f5f9, #F1F5F9)", paddingBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: 0, color: "var(--ct-0f172a, #0F172A)", display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart2 size={22} color="#2563EB" /> Bitácora & Historial de Notificaciones Emitidas ({negocio})
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--ct-64748b, #64748B)", margin: "2px 0 0 0" }}>
            Consulta auditada en tiempo real para Operadores y Administradores. Detalle completo de notificaciones y destinatarios.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarBitacora}
          style={{
            background: "var(--cf-f1f5f9, #F1F5F9)",
            border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
            color: "var(--ct-334155, #334155)",
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

      {/* TABLA DATAGRID BITÁCORA */}
      {cargando ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--ct-64748b, #64748B)" }}>
          Cargando bitácora de notificaciones auditadas...
        </div>
      ) : (
        <DataGrid
          columnas={columnas}
          filas={campanas}
          idFila={(c) => c.id}
          nombreExportacion={`bitacora-notificaciones-${negocio.toLowerCase()}`}
          contenidoExpandible={(c) => (
            <div style={{ padding: "14px", background: "var(--cf-f8fafc, #F8FAFC)", borderRadius: "8px", border: "1px solid var(--cb-e2e8f0, #E2E8F0)" }}>
              <div style={{ fontWeight: 800, marginBottom: "6px", color: "var(--ct-0f172a, #0F172A)" }}>Cuerpo de la Notificación:</div>
              <div style={{ background: "var(--cf-ffffff, #ffffff)", padding: "12px", borderRadius: "6px", border: "1px solid var(--cb-cbd5e1, #CBD5E1)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: c.contenidoHTML || c.asunto }} />
              {c.destinatariosDetalle && c.destinatariosDetalle.length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "var(--ct-334155, #334155)" }}>
                  <strong>Destinatarios ({c.destinatariosDetalle.length}):</strong> {c.destinatariosDetalle.join(", ")}
                </div>
              )}
            </div>
          )}
        />
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
              backgroundColor: "var(--cf-ffffff, #ffffff)",
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
                <span style={{ fontSize: "0.72rem", color: "var(--ct-64748b, #64748B)", fontWeight: 800, textTransform: "uppercase" }}>Asunto</span>
                <h4 style={{ margin: "4px 0 0 0", color: "var(--ct-0f172a, #0F172A)", fontSize: "1.1rem" }}>{campanaSeleccionada.asunto}</h4>
              </div>

              <div className="rejilla-auto" style={{ "--min": "200px", "--hueco": "12px", background: "var(--panel-linea-suave, #F1F1F1)", padding: "14px", borderRadius: "12px", marginBottom: "16px" } as React.CSSProperties}>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "var(--ct-64748b, #64748B)", fontWeight: 700 }}>Emisor:</span>
                  <strong style={{ display: "block", color: "var(--ct-1e293b, #1E293B)" }}>{campanaSeleccionada.emisorNombre}</strong>
                  <span style={{ fontSize: "0.74rem", color: "var(--ct-475569, #475569)" }}>{campanaSeleccionada.emisorCorreo}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", color: "var(--ct-64748b, #64748B)", fontWeight: 700 }}>Fecha / Origen:</span>
                  <strong style={{ display: "block", color: "var(--ct-1e293b, #1E293B)" }}>{campanaSeleccionada.fecha}</strong>
                  <span style={{ fontSize: "0.74rem", color: "var(--ct-4f46e5, #4F46E5)", fontWeight: 700 }}>{campanaSeleccionada.procesoOrigen}</span>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--ct-64748b, #64748B)", fontWeight: 800, textTransform: "uppercase" }}>Contenido Notificado</span>
                <div
                  style={{ marginTop: "6px", padding: "16px", background: "var(--cf-ffffff, #ffffff)", border: "1px solid var(--cb-e2e8f0, #E2E8F0)", borderRadius: "10px", lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: campanaSeleccionada.contenidoHTML || campanaSeleccionada.asunto }}
                />
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--ct-64748b, #64748B)", fontWeight: 800, textTransform: "uppercase" }}>Destinatarios Auditados ({campanaSeleccionada.destinatariosDetalle?.length || campanaSeleccionada.enviados})</span>
                <div style={{ background: "var(--cf-f8fafc, #F8FAFC)", border: "1px solid var(--cb-e2e8f0, #E2E8F0)", borderRadius: "10px", padding: "10px", marginTop: "6px", maxHeight: "120px", overflowY: "auto" }}>
                  {(campanaSeleccionada.destinatariosDetalle || [campanaSeleccionada.emisorCorreo]).map((email, idx) => (
                    <div key={idx} style={{ fontSize: "0.8rem", color: "var(--ct-0f172a, #0F172A)", fontWeight: 600, padding: "3px 0", borderBottom: idx < (campanaSeleccionada.destinatariosDetalle?.length || 1) - 1 ? "1px dashed var(--cb-e2e8f0, #E2E8F0)" : "none" }}>
                      • {email}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--cb-f1f5f9, #F1F5F9)", background: "var(--cf-f8fafc, #F8FAFC)", textAlign: "right" }}>
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
