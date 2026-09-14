"use client";

import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  Calendar,
  CreditCard,
  Users,
  Video,
  FileText,
  Flower2,
  Wrench,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
  Receipt,
  Download,
  Image as ImageIcon,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { EstadoCoberturaCliente } from "../acciones";

export interface ItemHistorialConsumo {
  id: string;
  fecha: string;
  origen: "PLAN_SUSCRIPCION" | "CUPON_BIENVENIDA" | "CONVENIO_B2B" | "PREPAGO";
  concepto: string;
  titulo: string;
  descripcion: string;
  responsableNombre?: string;
  estado: "REALIZADO" | "PROGRAMADO" | "EN_REVISION";
  costo: string;
  evidenciaUrl?: string;
  evidenciaTipo?: "FOTO_POD" | "PDF_DICTAMEN" | "ACTA_CONSULTA";
  evidenciaDetalle?: {
    recibidoPor?: string;
    ubicacion?: string;
    horaExacta?: string;
    casoCodigo?: string;
  };
}

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  cobertura: EstadoCoberturaCliente | null;
  negocio?: string;
  onContratarPlan?: () => void;
}

const HISTORIAL_SEMILLA_TRANQI: ItemHistorialConsumo[] = [
  {
    id: "hist-trq-01",
    fecha: "14 Sep 2026 · 10:15",
    origen: "PLAN_SUSCRIPCION",
    concepto: "CONSULTA_TELEMATICA",
    titulo: "Cita Telemática — Materia Familia & Notarial",
    descripcion: "Asesoría telemática de autorización de salida del país para menores.",
    responsableNombre: "Abg. Diego Benítez (Matrícula CJ #17-2018-442)",
    estado: "REALIZADO",
    costo: "$0.00 (Descargado de tu Plan · Cupo 1 de 4)",
    evidenciaTipo: "ACTA_CONSULTA",
    evidenciaUrl: "/imagenes/catalogo/permiso-salida.jpg",
    evidenciaDetalle: {
      casoCodigo: "TRQ-CAS-2026-0034",
      horaExacta: "10:15 a 11:00 (45 min)",
    },
  },
  {
    id: "hist-trq-02",
    fecha: "08 Sep 2026 · 16:40",
    origen: "PLAN_SUSCRIPCION",
    concepto: "REVISION_CONTRATO",
    titulo: "Revisión y Dictamen de Contrato de Arrendamiento",
    descripcion: "Análisis con semáforo de riesgos para inmueble en La Carolina, Quito.",
    responsableNombre: "Abg. Ana María Reyes",
    estado: "REALIZADO",
    costo: "$0.00 (Descargado de tu Plan · Cupo 1 de 2)",
    evidenciaTipo: "PDF_DICTAMEN",
    evidenciaUrl: "/imagenes/catalogo/revision-contratos.jpg",
    evidenciaDetalle: {
      casoCodigo: "EXP-2026-089",
      horaExacta: "Emitido en 18 horas",
    },
  },
  {
    id: "hist-trq-03",
    fecha: "01 Sep 2026 · 09:00",
    origen: "CUPON_BIENVENIDA",
    concepto: "CONSULTA_ARIA_IA",
    titulo: "Consultas Continuas Asistente ARIA IA Legal",
    descripcion: "14 consultas preliminares y redacción de borradores.",
    responsableNombre: "ARIA IA (Supervisión LegalTech)",
    estado: "REALIZADO",
    costo: "$0.00 (Ilimitado en tu Plan)",
  },
];

const HISTORIAL_SEMILLA_TINKAY: ItemHistorialConsumo[] = [
  {
    id: "hist-tnk-01",
    fecha: "12 Sep 2026 · 11:30",
    origen: "PLAN_SUSCRIPCION",
    concepto: "ENTREGA_FLORAL",
    titulo: "Entrega Floral Semanal #2 — Ramo Rosas Mondial Blancas",
    descripcion: "25 tallos seleccionados con preservante floral e hidratación prolongada.",
    responsableNombre: "Motorizado Repartidor #4 (Ruta Cumbayá)",
    estado: "REALIZADO",
    costo: "$0.00 (Descargado de Club Floral)",
    evidenciaTipo: "FOTO_POD",
    evidenciaUrl: "/imagenes/catalogo/planes-b2c.jpg",
    evidenciaDetalle: {
      recibidoPor: "Andrea Morales (Firma registrada)",
      ubicacion: "Urb. San Patricio, Cumbayá, Quito",
      horaExacta: "11:32 AM",
    },
  },
  {
    id: "hist-tnk-02",
    fecha: "05 Sep 2026 · 10:15",
    origen: "PLAN_SUSCRIPCION",
    concepto: "ENTREGA_FLORAL",
    titulo: "Entrega Floral Semanal #1 + Florero de Cristal Gratis",
    descripcion: "Entrega de bienvenida al Club Floral Tinkay.",
    responsableNombre: "Motorizado Repartidor #2",
    estado: "REALIZADO",
    costo: "$0.00 (Descargado de Club Floral)",
    evidenciaTipo: "FOTO_POD",
    evidenciaUrl: "/imagenes/catalogo/consultas.jpg",
    evidenciaDetalle: {
      recibidoPor: "Conserjería Edificio Torres del Parque",
      ubicacion: "Av. González Suárez, Quito",
      horaExacta: "10:18 AM",
    },
  },
];

export function ModalHistorialUsoPlan({
  abierto,
  alCerrar,
  cobertura,
  negocio = "tranqi",
  onContratarPlan,
}: Props) {
  const [evidenciaModalUrl, setEvidenciaModalUrl] = useState<string | null>(null);

  if (!abierto) return null;

  const esDemo = Boolean(cobertura?.suscripcionId?.startsWith("sub-demo"));
  const historial =
    negocio === "tinkay" ? HISTORIAL_SEMILLA_TINKAY : HISTORIAL_SEMILLA_TRANQI;

  const obtenerIconoConcepto = (concepto: string) => {
    if (concepto === "CONSULTA_TELEMATICA") return <Video size={18} color="#3B82F6" />;
    if (concepto === "REVISION_CONTRATO") return <FileText size={18} color="#10B981" />;
    if (concepto === "ENTREGA_FLORAL") return <Flower2 size={18} color="#EC4899" />;
    if (concepto === "VISITA_TECNICA") return <Wrench size={18} color="#F59E0B" />;
    return <Sparkles size={18} color="#6366F1" />;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
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
          background: "#FFFFFF",
          borderRadius: "24px",
          maxWidth: "760px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* HEADER DEL MODAL */}
        <div
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={22} color="#A5B4FC" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                Mi Plan & Historial de Cobertura
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#C7D2FE" }}>
                Auditoría de vigencia, facturación y trazabilidad de uso de tus beneficios
              </p>
            </div>
          </div>

          <button
            onClick={alCerrar}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO SCROLLEABLE */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          {/* 1. RESUMEN DEL CONTRATO / SUSCRIPCIÓN */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "18px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                {esDemo ? (
                  <span
                    style={{
                      background: "#FEF3C7",
                      color: "#92400E",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: "12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "6px",
                      border: "1px solid #FDE68A",
                    }}
                  >
                    <Sparkles size={12} /> SIMULACIÓN / MODO DEMO
                  </span>
                ) : (
                  <span
                    style={{
                      background: "#DCFCE7",
                      color: "#166534",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: "12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "6px",
                    }}
                  >
                    <CheckCircle2 size={12} /> MEMBRESÍA ACTIVA (BDD)
                  </span>
                )}
                <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0F172A" }}>
                  {cobertura?.planNombre || "Plan Amparo Familiar"}
                </h4>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748B" }}>
                  ID: <code style={{ fontWeight: 700 }}>{cobertura?.suscripcionId || "sub-activo"}</code>
                </span>
                {esDemo && onContratarPlan && (
                  <button
                    type="button"
                    onClick={onContratarPlan}
                    style={{
                      background: "#10B981",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Contratar Real
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                fontSize: "0.82rem",
                color: "#475569",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={16} color="#6366F1" />
                <span>
                  Próxima Facturación: <strong>{cobertura?.fechaRenovacion || "Fin de mes"}</strong>
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CreditCard size={16} color="#0284C7" />
                <span>
                  Método de Pago: <strong>Visa Pichincha (•••• 4500)</strong>
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={16} color="#10B981" />
                <span>
                  Miembros Cubiertos: <strong>{cobertura?.miembrosCubiertos || 4} Registrados</strong>
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Receipt size={16} color="#D97706" />
                <span>
                  Facturación SRI: <strong>IVA 15% incluido</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 2. LÍNEA DE TIEMPO / BITÁCORA DE CONSUMOS */}
          <div>
            <h4 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={18} color="#6366F1" /> Trazabilidad & Consumos del Periodo
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {historial.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "16px",
                    background: "#FFFFFF",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          background: "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {obtenerIconoConcepto(item.concepto)}
                      </div>
                      <div>
                        <strong style={{ fontSize: "0.9rem", color: "#0F172A", display: "block" }}>
                          {item.titulo}
                        </strong>
                        <span style={{ fontSize: "0.75rem", color: "#64748B" }}>{item.fecha}</span>
                      </div>
                    </div>

                    <span
                      style={{
                        background: "#EFF6FF",
                        color: "#1E40AF",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "8px",
                      }}
                    >
                      {item.costo}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#334155" }}>
                    {item.descripcion}
                  </p>

                  {item.responsableNombre && (
                    <div style={{ fontSize: "0.78rem", color: "#475569", marginBottom: "8px" }}>
                      Atendido por: <strong>{item.responsableNombre}</strong>
                    </div>
                  )}

                  {/* EVIDENCIA ASOCIADA (POD / ACTA / DICTAMEN) */}
                  {item.evidenciaUrl && (
                    <div
                      style={{
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.78rem",
                        marginTop: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#334155" }}>
                        {item.evidenciaTipo === "FOTO_POD" ? (
                          <>
                            <ImageIcon size={14} color="#EC4899" />
                            <span>
                              Proof of Delivery (POD): <strong>{item.evidenciaDetalle?.recibidoPor || "Foto de Entrega"}</strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <FileText size={14} color="#10B981" />
                            <span>
                              Expediente / Dictamen: <strong>{item.evidenciaDetalle?.casoCodigo || "Dictamen Oficial"}</strong>
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setEvidenciaModalUrl(item.evidenciaUrl!)}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          color: "#1E293B",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <ExternalLink size={12} /> Ver Evidencia
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#F8FAFC",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
            {esDemo ? "Vista preliminar con datos simulados." : "Tus derechos se reinician automáticamente al inicio de cada ciclo de facturación."}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            {esDemo && onContratarPlan && (
              <button
                type="button"
                onClick={onContratarPlan}
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                }}
              >
                <CreditCard size={15} /> Contratar Plan Real (Payphone)
              </button>
            )}
            <button
              type="button"
              onClick={alCerrar}
              style={{
                background: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                padding: "8px 18px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE VISUALIZACIÓN DE EVIDENCIA (FOTO POD / DICTAMEN) */}
      {evidenciaModalUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setEvidenciaModalUrl(null)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "16px",
              maxWidth: "600px",
              width: "100%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <strong style={{ fontSize: "0.95rem" }}>Evidencia de Entrega / Dictamen</strong>
              <button
                onClick={() => setEvidenciaModalUrl(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
            <img
              src={evidenciaModalUrl}
              alt="Evidencia"
              style={{ width: "100%", maxHeight: "420px", objectFit: "cover", borderRadius: "10px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
