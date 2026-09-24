"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Video,
  FileCheck,
  Sparkles,
  Percent,
  Calendar,
  Users,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Zap,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import {
  obtenerCoberturaUsuarioAction,
  consumirDerechoUsuarioAction,
  EstadoCoberturaCliente,
} from "../acciones";
import { ModalHistorialUsoPlan } from "./ModalHistorialUsoPlan";

interface Props {
  negocio?: string;
  onAbrirCatalogo?: () => void;
}

export function SeccionCoberturaCliente({
  negocio = "tranqi",
  onAbrirCatalogo,
}: Props) {
  const [cobertura, setCobertura] = useState<EstadoCoberturaCliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [consumiendo, setConsumiendo] = useState<string | null>(null);
  const [mensajeConsumo, setMensajeConsumo] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);

  const cargarCobertura = async () => {
    try {
      const data = await obtenerCoberturaUsuarioAction(negocio);
      setCobertura(data);
    } catch {
      // Fallback
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCobertura();
  }, [negocio]);

  const manejarConsumirDerecho = async (concepto: string, _nombre: string) => {
    if (!cobertura?.suscripcionId) return;
    setConsumiendo(concepto);
    setMensajeConsumo(null);
    try {
      const res = await consumirDerechoUsuarioAction({
        concepto,
        negocio,
        suscripcionId: cobertura.suscripcionId,
      });

      if (res.ok) {
        setMensajeConsumo({ tipo: "exito", texto: res.mensaje });
        await cargarCobertura();
      } else {
        setMensajeConsumo({ tipo: "error", texto: res.mensaje });
      }
    } catch (err) {
      setMensajeConsumo({ tipo: "error", texto: (err as Error).message || "Error al consumir cupo." });
    } finally {
      setConsumiendo(null);
    }
  };

  if (cargando) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
          borderRadius: "20px",
          padding: "28px",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "160px",
          marginBottom: "24px",
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ marginRight: "12px" }} />
        <span>Sincronizando cobertura legal y cupos disponibles...</span>
      </div>
    );
  }

  if (!cobertura || !cobertura.tienePlanActivo) {
    return (
      <section
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderRadius: "20px",
          padding: "28px",
          color: "#FFFFFF",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(234, 179, 8, 0.15)", border: "1px solid rgba(234, 179, 8, 0.3)", borderRadius: "20px", padding: "4px 12px", fontSize: "0.75rem", fontWeight: 700, color: "#FDE047", marginBottom: "12px" }}>
              <Zap size={14} /> Membresía Legal Recomendada
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.4rem", fontWeight: 800, color: "#FFFFFF" }}>
              Activa tu Plan de Amparo & Cobertura Legal
            </h2>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#94A3B8", maxWidth: "560px", lineHeight: 1.5 }}>
              Obtén citas telemáticas ilimitadas, dictámenes de contratos en 24h, consultas ARIA IA y hasta 35% de descuento en notarías y juicios para ti y tu familia.
            </p>
          </div>

          <Link
            href="/panel/catalogo-productos"
            onClick={onAbrirCatalogo}
            style={{
              background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
              color: "#FFFFFF",
              padding: "12px 24px",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "0.9rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
              transition: "transform 0.15s ease",
            }}
          >
            <ShoppingBag size={18} /> Ver Planes & Contratar
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
        borderRadius: "24px",
        padding: "28px",
        color: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "0 20px 35px -10px rgba(49, 46, 129, 0.45)",
        marginBottom: "28px",
      }}
      aria-labelledby="t-cobertura-activa"
    >
      {/* Detalle decorativo SVG de fondo */}
      <svg
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "480px",
          height: "360px",
          opacity: 0.15,
          pointerEvents: "none",
        }}
        viewBox="0 0 800 600"
        fill="none"
      >
        <circle cx="400" cy="300" r="300" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="10 15" />
        <circle cx="400" cy="300" r="200" stroke="#A5B4FC" strokeWidth="3" />
      </svg>

      {/* HEADER DE LA TARJETA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "22px", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(52, 211, 153, 0.4)",
                color: "#6EE7B7",
                borderRadius: "20px",
                padding: "3px 10px",
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <CheckCircle2 size={12} /> Protección Activa
            </span>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                color: "#E0E7FF",
                borderRadius: "20px",
                padding: "3px 10px",
                fontSize: "0.72rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Users size={12} /> {cobertura.miembrosCubiertos} miembros cubiertos
            </span>
          </div>

          <h2
            id="t-cobertura-activa"
            style={{
              margin: 0,
              fontSize: "1.55rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <ShieldCheck size={26} color="#A5B4FC" />
            {cobertura.planNombre}
          </h2>

          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#C7D2FE", display: "flex", alignItems: "center", gap: "6px" }}>
            <Calendar size={14} />
            Próxima renovación de cupos: <strong>{cobertura.fechaRenovacion || "Fin de mes"}</strong> (Facturación {cobertura.frecuencia.toLowerCase()})
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setModalHistorialAbierto(true)}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#FFFFFF",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "0.8rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              transition: "background 0.15s ease",
            }}
          >
            Mi Plan & Historial <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* FEEDBACK DE CONSUMO */}
      {mensajeConsumo && (
        <div
          style={{
            background: mensajeConsumo.tipo === "exito" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
            border: `1px solid ${mensajeConsumo.tipo === "exito" ? "rgba(52, 211, 153, 0.5)" : "rgba(248, 113, 113, 0.5)"}`,
            borderRadius: "12px",
            padding: "10px 16px",
            fontSize: "0.85rem",
            color: "#FFFFFF",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{mensajeConsumo.texto}</span>
          <button
            onClick={() => setMensajeConsumo(null)}
            style={{ background: "transparent", border: "none", color: "#FFFFFF", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* REJILLA DE BENEFICIOS & BOLSA DE CUPOS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "14px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {cobertura.derechos.map((der, idx) => {
          const esIlimitado = der.incluidos === null;
          const porcentajeUso = esIlimitado ? 100 : Math.min(100, Math.round((der.consumidos / (der.incluidos || 1)) * 100));
          const estaAgotado = !esIlimitado && (der.restantes ?? 0) <= 0;

          const obtenerIcono = () => {
            if (der.concepto === "CONSULTA_TELEMATICA") return <Video size={18} color="#60A5FA" />;
            if (der.concepto === "REVISION_CONTRATO") return <FileCheck size={18} color="#34D399" />;
            if (der.concepto === "CONSULTA_ARIA_IA") return <Sparkles size={18} color="#FBBF24" />;
            return <Percent size={18} color="#F472B6" />;
          };

          return (
            <div
              key={idx}
              style={{
                background: "rgba(15, 23, 42, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "16px",
                padding: "16px",
                backdropFilter: "blur(8px)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: "rgba(255, 255, 255, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {obtenerIcono()}
                    </div>
                    <strong style={{ fontSize: "0.88rem", color: "#FFFFFF" }}>{der.nombre}</strong>
                  </div>

                  {esIlimitado ? (
                    <span style={{ background: "rgba(251, 191, 36, 0.2)", color: "#FDE047", fontSize: "0.72rem", fontWeight: 800, padding: "2px 8px", borderRadius: "10px" }}>
                      ILIMITADO
                    </span>
                  ) : (
                    <span
                      style={{
                        background: estaAgotado ? "rgba(239, 68, 68, 0.2)" : "rgba(52, 211, 153, 0.2)",
                        color: estaAgotado ? "#FCA5A5" : "#6EE7B7",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      {der.restantes} DISPONIBLES
                    </span>
                  )}
                </div>

                {/* Barra de progreso si tiene cupo numérico */}
                {!esIlimitado && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#94A3B8", marginBottom: "4px" }}>
                      <span>Usadas: {der.consumidos} de {der.incluidos}</span>
                      <span>{Math.round((der.restantes! / der.incluidos!) * 100)}% restante</span>
                    </div>
                    <div style={{ height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(10, 100 - porcentajeUso)}%`,
                          background: estaAgotado ? "#EF4444" : "linear-gradient(90deg, #34D399, #10B981)",
                          borderRadius: "3px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {esIlimitado && der.concepto === "CONSULTA_ARIA_IA" && (
                  <p style={{ margin: "0 0 12px", fontSize: "0.78rem", color: "#CBD5E1" }}>
                    {der.consumidos} consultas realizadas este mes con respuestas legales inmediatas.
                  </p>
                )}

                {der.porcentaje && (
                  <p style={{ margin: "0 0 12px", fontSize: "0.78rem", color: "#CBD5E1" }}>
                    Aplica automáticamente en la tarifa base de trámites notariales y litigios.
                  </p>
                )}
              </div>

              {/* Botón de acción rápida */}
              <div style={{ marginTop: "6px" }}>
                {der.concepto === "CONSULTA_TELEMATICA" && (
                  <button
                    type="button"
                    disabled={estaAgotado || consumiendo === der.concepto}
                    onClick={() => manejarConsumirDerecho(der.concepto, der.nombre)}
                    style={{
                      width: "100%",
                      background: estaAgotado ? "rgba(255, 255, 255, 0.08)" : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                      color: estaAgotado ? "#94A3B8" : "#FFFFFF",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: estaAgotado ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    {consumiendo === der.concepto ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>Agendar Cita con Cupo ($0.00) <ArrowRight size={14} /></>
                    )}
                  </button>
                )}

                {der.concepto === "REVISION_CONTRATO" && (
                  <button
                    type="button"
                    disabled={estaAgotado || consumiendo === der.concepto}
                    onClick={() => manejarConsumirDerecho(der.concepto, der.nombre)}
                    style={{
                      width: "100%",
                      background: estaAgotado ? "rgba(255, 255, 255, 0.08)" : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      color: estaAgotado ? "#94A3B8" : "#FFFFFF",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: estaAgotado ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    {consumiendo === der.concepto ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <>Subir Contrato a Revisión ($0.00) <ArrowRight size={14} /></>
                    )}
                  </button>
                )}

                {der.concepto === "CONSULTA_ARIA_IA" && (
                  <Link
                    href="/panel/chat"
                    style={{
                      width: "100%",
                      background: "rgba(251, 191, 36, 0.15)",
                      border: "1px solid rgba(251, 191, 36, 0.3)",
                      color: "#FDE047",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      textDecoration: "none",
                    }}
                  >
                    Abrir Chat con ARIA <Sparkles size={14} />
                  </Link>
                )}

                {der.concepto === "DESCUENTO_NOTARIAL" && (
                  <Link
                    href="/panel/catalogo-productos"
                    style={{
                      width: "100%",
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#FFFFFF",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      textDecoration: "none",
                    }}
                  >
                    Ver Catálogo con Descuento <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE HISTORIAL Y AUDITORÍA DE USO */}
      <ModalHistorialUsoPlan
        abierto={modalHistorialAbierto}
        alCerrar={() => setModalHistorialAbierto(false)}
        cobertura={cobertura}
        negocio={negocio}
      />
    </section>
  );
}

