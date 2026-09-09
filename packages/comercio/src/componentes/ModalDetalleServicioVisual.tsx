"use client";

import React, { useState } from "react";
import {
  X,
  Play,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Info,
} from "lucide-react";
import { ProductoCatalogo, VarianteCatalogo } from "../acciones";

interface Props {
  abierto: boolean;
  producto: ProductoCatalogo | null;
  onCerrar: () => void;
  onContratar: (producto: ProductoCatalogo, variante: VarianteCatalogo) => void;
  negocio?: string;
}

export function ModalDetalleServicioVisual({
  abierto,
  producto,
  onCerrar,
  onContratar,
  negocio = "tranqi",
}: Props) {
  const [varianteSeleccionadaId, setVarianteSeleccionadaId] = useState<string>("");
  const [reproduciendoVideo, setReproduciendoVideo] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<"alcance" | "requisitos">("alcance");

  if (!abierto || !producto) return null;

  const currentVarId = varianteSeleccionadaId || producto.variantes[0]?.var_id;
  const currentVar = producto.variantes.find((v) => v.var_id === currentVarId) || producto.variantes[0];

  const detalle = producto.pro_detalle_producto || {};
  const imagenUrl =
    detalle.imagen_url ||
    "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80";
  const videoUrl = detalle.video_url;
  const beneficios: string[] = Array.isArray(detalle.beneficios) && detalle.beneficios.length > 0
    ? detalle.beneficios
    : [
        "Asignación de abogado especialista acreditado",
        "Revisión y acompañamiento integral durante todo el proceso",
        "Constancia digital y respaldo en tu expediente seguro",
      ];
  const requisitos: string[] = Array.isArray(detalle.requisitos) && detalle.requisitos.length > 0
    ? detalle.requisitos
    : [
        "Documento de identidad (cédula o pasaporte vigente)",
        "Información básica o antecedentes de tu caso",
      ];
  const tiempoEntrega = detalle.tiempo_entrega || "24 a 48 horas hábiles";

  // Extraer embed de YouTube si aplica
  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch?v=")) {
      const id = url.split("watch?v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    return url;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
      >
        {/* Header con Media Hero */}
        <div style={{ position: "relative", width: "100%", height: "230px", background: "#0F172A", overflow: "hidden" }}>
          {reproduciendoVideo && videoUrl ? (
            <iframe
              src={getEmbedUrl(videoUrl)}
              title="Video demostrativo del servicio"
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <img
                src={imagenUrl}
                alt={producto.pro_nombre}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.3) 60%, transparent 100%)",
                }}
              />

              {/* Botón de Play si hay Video */}
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setReproduciendoVideo(true)}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(2, 132, 199, 0.9)",
                    color: "#FFFFFF",
                    border: "3px solid #FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}
                  title="Ver video explicativo"
                >
                  <Play size={24} style={{ marginLeft: "3px" }} />
                </button>
              )}

              {/* Badges superiores */}
              <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", gap: "8px" }}>
                <span
                  style={{
                    background: "rgba(15, 23, 42, 0.8)",
                    backdropFilter: "blur(4px)",
                    color: "#FFFFFF",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {producto.categoria?.ctg_nombre || "Servicio Jurídico"}
                </span>
                {producto.pro_destacado && (
                  <span
                    style={{
                      background: "linear-gradient(135deg, #F59E0B, #D97706)",
                      color: "#FFFFFF",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Sparkles size={12} /> RECOMENDADO
                  </span>
                )}
              </div>
            </>
          )}

          {/* Botón de Cerrar */}
          <button
            type="button"
            onClick={onCerrar}
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#FFFFFF",
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            <X size={18} />
          </button>

          {/* Título en Hero */}
          <div style={{ position: "absolute", bottom: "16px", left: "20px", right: "20px" }}>
            <h2 style={{ margin: 0, color: "#FFFFFF", fontSize: "1.35rem", fontWeight: 800, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
              {producto.pro_nombre}
            </h2>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Descripción */}
          <p style={{ margin: 0, fontSize: "0.92rem", color: "#334155", lineHeight: 1.5 }}>
            {producto.pro_descripcion}
          </p>

          {/* Selector de Modalidades / Tarifas si tiene varias */}
          {producto.variantes.length > 1 && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                Selecciona tu plan o modalidad de atención:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {producto.variantes.map((v) => {
                  const activa = currentVar?.var_id === v.var_id;
                  return (
                    <button
                      key={v.var_id}
                      type="button"
                      onClick={() => setVarianteSeleccionadaId(v.var_id)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: activa ? "2px solid #0284C7" : "1px solid #CBD5E1",
                        background: activa ? "#EFF6FF" : "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            border: activa ? "5px solid #0284C7" : "2px solid #94A3B8",
                            background: "#FFFFFF",
                          }}
                        />
                        <span style={{ fontSize: "0.88rem", fontWeight: activa ? 700 : 500, color: activa ? "#0369A1" : "#1E293B" }}>
                          {v.var_nombre}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
                          ${v.precio_total.toFixed(2)}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block" }}>
                          IVA 15% incl.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pestañas de Información */}
          <div>
            <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", gap: "16px", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => setPestanaActiva("alcance")}
                style={{
                  padding: "8px 0",
                  border: "none",
                  borderBottom: pestanaActiva === "alcance" ? "2px solid #0284C7" : "2px solid transparent",
                  background: "transparent",
                  fontWeight: pestanaActiva === "alcance" ? 700 : 500,
                  color: pestanaActiva === "alcance" ? "#0284C7" : "#64748B",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <ShieldCheck size={16} /> ¿Qué incluye?
              </button>
              <button
                type="button"
                onClick={() => setPestanaActiva("requisitos")}
                style={{
                  padding: "8px 0",
                  border: "none",
                  borderBottom: pestanaActiva === "requisitos" ? "2px solid #0284C7" : "2px solid transparent",
                  background: "transparent",
                  fontWeight: pestanaActiva === "requisitos" ? 700 : 500,
                  color: pestanaActiva === "requisitos" ? "#0284C7" : "#64748B",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileText size={16} /> Requisitos
              </button>
            </div>

            {pestanaActiva === "alcance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", color: "#0369A1", background: "#F0F9FF", padding: "8px 12px", borderRadius: "8px" }}>
                  <Clock size={16} />
                  <span><strong>Tiempo estimado de entrega o atención:</strong> {tiempoEntrega}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {beneficios.map((b, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.85rem", color: "#334155" }}>
                      <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pestanaActiva === "requisitos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {requisitos.map((r, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "0.85rem", color: "#334155" }}>
                    <Info size={16} color="#0284C7" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer con Liquidación y Botón de Pago Payphone */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <span style={{ fontSize: "0.75rem", color: "#64748B", display: "block" }}>
              Base: ${currentVar?.var_precio.toFixed(2)} + IVA 15%: ${currentVar?.monto_iva.toFixed(2)}
            </span>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0F172A" }}>
              ${currentVar?.precio_total.toFixed(2)}{" "}
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748B" }}>USD</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                color: "#475569",
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentVar) onContratar(producto, currentVar);
              }}
              style={{
                background: "#0284C7",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: "10px",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
              }}
            >
              <CreditCard size={18} />
              Contratar y Pagar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
