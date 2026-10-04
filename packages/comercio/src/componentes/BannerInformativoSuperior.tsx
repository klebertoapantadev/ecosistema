"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  AlertTriangle,
  Award,
  Building2,
  ChevronRight,
  X,
  ExternalLink,
  Clock,
  Play,
} from "lucide-react";
import {
  CampanaInformativa,
  obtenerCampanasInformativasAction,
} from "../acciones-informativos";
import { formatearFechaCorta } from "../utils/vigencia";

interface Props {
  negocio?: string;
  ubicacion?: "LANDING_BANNER" | "PANEL_INICIO" | "TODOS";
  audiencia?: "TODOS" | "ABOGADOS" | "CLIENTES" | "EMPRESAS";
}

export function BannerInformativoSuperior({
  negocio = "tranqi",
  ubicacion = "PANEL_INICIO",
  audiencia = "TODOS",
}: Props) {
  const [campanas, setCampanas] = useState<CampanaInformativa[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`eco_campanas_informativas_${negocio}`);
      const rawDel = localStorage.getItem(`eco_campanas_eliminadas_${negocio}`);
      const eliminados = rawDel ? new Set(JSON.parse(rawDel)) : new Set();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (c: any) =>
              c.inf_activo !== false &&
              !eliminados.has(c.inf_id) &&
              !eliminados.has(c.inf_slug) &&
              (!c.inf_titulo || !eliminados.has(c.inf_titulo))
          );
        }
      }
    } catch {}
    return [];
  });
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [cerrado, setCerrado] = useState(false);
  const [modalDetalle, setModalDetalle] = useState<CampanaInformativa | null>(null);

  // Limpieza de claves de bloqueo antiguas
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`eco_ocultar_banner_${negocio}`);
        sessionStorage.removeItem(`eco_ocultar_banner_sesion_${negocio}`);
      }
    } catch {}
  }, [negocio]);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        let eliminados = new Set<string>();
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`eco_campanas_eliminadas_${negocio}`);
            if (raw) eliminados = new Set(JSON.parse(raw));
          } catch {}
        }

        const data = await obtenerCampanasInformativasAction({
          negocio,
          ubicacion: ubicacion === "TODOS" ? undefined : ubicacion,
          audiencia: audiencia === "TODOS" ? undefined : (audiencia as any),
          incluirInactivos: false,
        });

        if (!cancelado && Array.isArray(data) && data.length > 0) {
          const limpios = data.filter(
            (c) =>
              !eliminados.has(c.inf_id) &&
              !eliminados.has(c.inf_slug) &&
              (!c.inf_titulo || !eliminados.has(c.inf_titulo))
          );
          if (limpios.length > 0) {
            setCampanas(limpios);
            if (typeof window !== "undefined") {
              localStorage.setItem(`eco_campanas_informativas_${negocio}`, JSON.stringify(limpios));
            }
          }
        }
      } catch (err) {
        // Silencioso para no romper landing o panel
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [negocio, ubicacion, audiencia]);

  // Rotación automática si hay más de 1
  useEffect(() => {
    if (campanas.length <= 1) return;
    const intervalo = setInterval(() => {
      setIndiceActivo((prev) => (prev + 1) % campanas.length);
    }, 6000);
    return () => clearInterval(intervalo);
  }, [campanas.length]);

  const handleCerrarActual = () => {
    setCampanas((prev) => {
      const restantes = prev.filter((_, idx) => idx !== indiceActivo);
      if (restantes.length === 0) {
        setCerrado(true);
      }
      return restantes;
    });
    setIndiceActivo(0);
  };

  if (cerrado || campanas.length === 0) return null;

  const actual = campanas[indiceActivo] || campanas[0];
  if (!actual) return null;

  const esAlerta = actual.inf_tipo === "ALERTA_REGULATORIA";
  const esConvenio = actual.inf_tipo === "BENEFICIO_CONVENIO";
  const det = actual.inf_detalle || {};
  const colorTag = det.color_tag;

  const bgStyle = colorTag
    ? `linear-gradient(90deg, ${colorTag} 0%, #0F172A 100%)`
    : esAlerta
    ? "linear-gradient(90deg, #991B1B 0%, #DC2626 50%, #B91C1C 100%)"
    : esConvenio
    ? "linear-gradient(90deg, #312E81 0%, #4338CA 50%, #3730A3 100%)"
    : "linear-gradient(90deg, #0F172A 0%, #1E293B 50%, #0369A1 100%)";

  const etiquetaCategoria = det.categoria || (esAlerta ? "Alerta" : esConvenio ? "Convenio" : "Aviso");

  return (
    <>
      <div
        onClick={() => setModalDetalle(actual)}
        title="Haz clic para ver el detalle completo de este aviso"
        style={{
          width: "100%",
          background: bgStyle,
          color: "#FFFFFF",
          padding: "9px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.78rem",
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          zIndex: 50,
          position: "relative",
          cursor: "pointer",
          borderRadius: "8px",
          transition: "filter 0.15s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            maxWidth: "92%",
            margin: "0 auto",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: colorTag ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.2)",
              border: colorTag ? "1px solid rgba(255,255,255,0.4)" : "none",
              padding: "2px 9px",
              borderRadius: "12px",
              fontSize: "0.68rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {esAlerta ? <AlertTriangle size={12} /> : esConvenio ? <Award size={12} /> : <Megaphone size={12} />}
            {etiquetaCategoria}
          </div>

          <span style={{ fontWeight: 800 }}>{actual.inf_titulo}:</span>
          <span style={{ opacity: 0.9 }}>{actual.inf_subtitulo || actual.inf_contenido_md || ""}</span>

          {det.cta_texto && det.cta_url && (
            <a
              href={det.cta_url}
              target={det.cta_url.startsWith("http") ? "_blank" : "_self"}
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#FFFFFF",
                color: colorTag || (esAlerta ? "#991B1B" : "#312E81"),
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.72rem",
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                marginLeft: "6px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              }}
            >
              {det.cta_texto} <ChevronRight size={12} />
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCerrarActual();
          }}
          title="Ocultar este aviso y pasar al siguiente"
          aria-label="Cerrar este aviso"
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.8)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            borderRadius: "4px",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Modal de Detalle Completo del Aviso Informativo */}
      {modalDetalle && (
        <div
          onClick={() => setModalDetalle(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: "18px",
              maxWidth: "620px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Botón cerrar flotante */}
            <button
              type="button"
              onClick={() => setModalDetalle(null)}
              aria-label="Cerrar detalle"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                zIndex: 10,
                background: "rgba(15, 23, 42, 0.65)",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}
            >
              <X size={18} />
            </button>

            {/* Cabecera / Imagen Hero */}
            {modalDetalle.inf_detalle?.imagen_url ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxHeight: "280px",
                  overflow: "hidden",
                  borderTopLeftRadius: "18px",
                  borderTopRightRadius: "18px",
                  background: "#0F172A",
                }}
              >
                <img
                  src={modalDetalle.inf_detalle.imagen_url}
                  alt={modalDetalle.inf_titulo}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxHeight: "280px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "16px 20px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background:
                          modalDetalle.inf_detalle?.color_tag ||
                          (modalDetalle.inf_tipo === "ALERTA_REGULATORIA"
                            ? "#DC2626"
                            : modalDetalle.inf_tipo === "BENEFICIO_CONVENIO"
                            ? "#4338CA"
                            : "#0369A1"),
                        color: "#FFFFFF",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      {modalDetalle.inf_tipo === "ALERTA_REGULATORIA" ? (
                        <AlertTriangle size={13} />
                      ) : modalDetalle.inf_tipo === "BENEFICIO_CONVENIO" ? (
                        <Award size={13} />
                      ) : (
                        <Megaphone size={13} />
                      )}
                      {modalDetalle.inf_detalle?.categoria || "Informativo Oficial"}
                    </span>
                    {modalDetalle.inf_detalle?.institucion && (
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.25)",
                          color: "#FFFFFF",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        🏛️ {modalDetalle.inf_detalle.institucion}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: modalDetalle.inf_detalle?.color_tag
                    ? `linear-gradient(135deg, ${modalDetalle.inf_detalle.color_tag} 0%, #0F172A 100%)`
                    : modalDetalle.inf_tipo === "ALERTA_REGULATORIA"
                    ? "linear-gradient(135deg, #991B1B 0%, #DC2626 50%, #B91C1C 100%)"
                    : modalDetalle.inf_tipo === "BENEFICIO_CONVENIO"
                    ? "linear-gradient(135deg, #312E81 0%, #4338CA 50%, #3730A3 100%)"
                    : "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0369A1 100%)",
                  padding: "24px 24px 20px 24px",
                  borderTopLeftRadius: "18px",
                  borderTopRightRadius: "18px",
                  color: "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.25)",
                      color: "#FFFFFF",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {modalDetalle.inf_tipo === "ALERTA_REGULATORIA" ? (
                      <AlertTriangle size={13} />
                    ) : modalDetalle.inf_tipo === "BENEFICIO_CONVENIO" ? (
                      <Award size={13} />
                    ) : (
                      <Megaphone size={13} />
                    )}
                    {modalDetalle.inf_detalle?.categoria || "Informativo Oficial"}
                  </span>
                  {modalDetalle.inf_detalle?.institucion && (
                    <span
                      style={{
                        background: "rgba(255, 255, 255, 0.2)",
                        color: "#FFFFFF",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      🏛️ {modalDetalle.inf_detalle.institucion}
                    </span>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.3 }}>
                  {modalDetalle.inf_titulo}
                </h3>
              </div>
            )}

            {/* Cuerpo del Detalle */}
            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {modalDetalle.inf_detalle?.imagen_url && (
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "1.3rem", fontWeight: 800, color: "#0F172A", lineHeight: 1.3 }}>
                    {modalDetalle.inf_titulo}
                  </h3>
                </div>
              )}

              {modalDetalle.inf_subtitulo && (
                <p style={{ margin: 0, fontSize: "0.95rem", color: "#475569", fontWeight: 600, lineHeight: 1.45 }}>
                  {modalDetalle.inf_subtitulo}
                </p>
              )}

              {modalDetalle.inf_detalle?.porcentaje_descuento && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#ECFDF5",
                    color: "#059669",
                    border: "1px solid #A7F3D0",
                    padding: "6px 12px",
                    borderRadius: "10px",
                    fontSize: "0.84rem",
                    fontWeight: 800,
                    width: "fit-content",
                  }}
                >
                  🎁 Descuento / Beneficio Exclusivo: {modalDetalle.inf_detalle.porcentaje_descuento}
                </div>
              )}

              {modalDetalle.inf_contenido_md && (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "12px",
                    padding: "16px",
                    color: "#334155",
                    fontSize: "0.88rem",
                    lineHeight: 1.6,
                    whiteSpace: "pre-line",
                  }}
                >
                  {modalDetalle.inf_contenido_md}
                </div>
              )}

              {/* Fechas de vigencia */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.78rem",
                  color: "#64748B",
                  padding: "8px 12px",
                  background: "#F1F5F9",
                  borderRadius: "8px",
                }}
              >
                <Clock size={14} color="#64748B" />
                <span>
                  {modalDetalle.inf_fecha_fin
                    ? `Vigente hasta: ${formatearFechaCorta(modalDetalle.inf_fecha_fin.split("T")[0])}`
                    : "Publicación vigente indefinida"}
                </span>
              </div>

              {/* Botón de Video si existe */}
              {modalDetalle.inf_detalle?.video_url && (
                <a
                  href={modalDetalle.inf_detalle.video_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background: "#4338CA",
                    color: "#FFFFFF",
                    padding: "10px 18px",
                    borderRadius: "10px",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  <Play size={14} fill="#FFFFFF" /> Ver Video Explicativo
                </a>
              )}

              {/* Footer con Acciones */}
              <div
                style={{
                  marginTop: "8px",
                  paddingTop: "16px",
                  borderTop: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalDetalle(null)}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>

                {modalDetalle.inf_detalle?.cta_texto && modalDetalle.inf_detalle?.cta_url && (
                  <a
                    href={modalDetalle.inf_detalle.cta_url}
                    target={modalDetalle.inf_detalle.cta_url.startsWith("http") ? "_blank" : "_self"}
                    rel="noreferrer"
                    style={{
                      background: modalDetalle.inf_detalle?.color_tag || "#0F172A",
                      color: "#FFFFFF",
                      padding: "9px 20px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      fontSize: "0.84rem",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {modalDetalle.inf_detalle.cta_texto} <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
