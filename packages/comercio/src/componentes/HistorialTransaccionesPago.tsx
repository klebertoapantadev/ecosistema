"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  TransaccionPagoCRM,
  obtenerHistorialTransaccionesAction,
} from "../acciones";

interface Props {
  negocio?: string;
}

export function HistorialTransaccionesPago({ negocio = "tranqi" }: Props) {
  const [transacciones, setTransacciones] = useState<TransaccionPagoCRM[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const cargarTransacciones = async () => {
    setCargando(true);
    try {
      const data = await obtenerHistorialTransaccionesAction(negocio);
      setTransacciones(data);
    } catch (err) {
      console.error("Error al cargar historial de pagos:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTransacciones();
  }, [negocio]);

  const filtradas = transacciones.filter((t) => {
    const q = busqueda.toLowerCase().trim();
    const cumpleBusqueda =
      q === "" ||
      t.pag_identificador_cliente.toLowerCase().includes(q) ||
      (t.pag_autorizacion_codigo && t.pag_autorizacion_codigo.toLowerCase().includes(q)) ||
      (t.pag_titular_email && t.pag_titular_email.toLowerCase().includes(q)) ||
      (t.pag_titular_identificacion && t.pag_titular_identificacion.toLowerCase().includes(q));

    const cumpleEstado = filtroEstado === "todos" || t.pag_estado === filtroEstado;
    return cumpleBusqueda && cumpleEstado;
  });

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case "APROBADO":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#D1FAE5",
              color: "#065F46",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <CheckCircle2 size={13} />
            Aprobado
          </span>
        );
      case "RECHAZADO":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#FEE2E2",
              color: "#991B1B",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <XCircle size={13} />
            Rechazado
          </span>
        );
      case "PENDIENTE":
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#FEF3C7",
              color: "#92400E",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Clock size={13} />
            Pendiente
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#F1F5F9",
              color: "#475569",
            }}
          >
            {estado}
          </span>
        );
    }
  };

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Cabecera */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                background: "#E0F2FE",
                color: "#0284C7",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              Auditoría y Liquidación
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0F172A" }}>
            Historial de Transacciones y Pagos
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Registro inmutable de transacciones procesadas vía Payphone (en vivo y simuladas).
          </p>
        </div>

        <button
          type="button"
          onClick={cargarTransacciones}
          style={{
            background: "#F1F5F9",
            color: "#334155",
            border: "1px solid #CBD5E1",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "16px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
          <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "11px" }} />
          <input
            type="text"
            placeholder="Buscar por ID transacción, código de autorización, email o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {["todos", "APROBADO", "PENDIENTE", "RECHAZADO"].map((est) => (
            <button
              key={est}
              type="button"
              onClick={() => setFiltroEstado(est)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: filtroEstado === est ? "#0F172A" : "#F1F5F9",
                color: filtroEstado === est ? "#FFFFFF" : "#475569",
              }}
            >
              {est === "todos" ? "Todos" : est}
            </button>
          ))}
        </div>
      </div>

      {/* DataGrid */}
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
          <div style={{ padding: "50px 20px", textAlign: "center", color: "#64748B" }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <div>Cargando transacciones contables...</div>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <CreditCard size={40} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0F172A" }}>
              No se registran transacciones
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B" }}>
              Aún no se han ejecutado cobros ni pruebas de botón de pago.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>ID Transacción</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Fecha / Hora</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Pagador</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Pasarela</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Monto</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Estado</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Autorización</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => (
                  <tr
                    key={t.pag_id}
                    style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.1s ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "#0F172A" }}>
                      {t.pag_identificador_cliente}
                      {t.pag_detalle_transaccion?.modo_simulado && (
                        <span
                          style={{
                            marginLeft: "6px",
                            background: "#FEF3C7",
                            color: "#92400E",
                            fontSize: "0.65rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          SIMULADA
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#64748B" }}>
                      {new Date(t.pag_creado_en).toLocaleString("es-EC", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#0F172A" }}>{t.pag_titular_email || "—"}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                        C.I: {t.pag_titular_identificacion || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontWeight: 600, color: "#0284C7" }}>{t.pag_pasarela}</span>
                      {t.pag_tarjeta_marca && (
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                          {t.pag_tarjeta_marca} •••• {t.pag_tarjeta_ultimos_digitos}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 800, color: "#0F172A" }}>
                      ${Number(t.pag_monto_total).toFixed(2)} USD
                    </td>
                    <td style={{ padding: "14px 16px" }}>{getBadgeEstado(t.pag_estado)}</td>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#334155" }}>
                      {t.pag_autorizacion_codigo || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
