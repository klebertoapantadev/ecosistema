"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Award,
  Megaphone,
  AlertTriangle,
  Gift,
  Calendar,
  Clock,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Play,
  Share2,
  Building2,
  Users,
  Scale,
  ShieldCheck,
  CheckCircle2,
  Search,
  Settings,
} from "lucide-react";
import {
  CampanaInformativa,
  TipoInformativo,
  AudienciaInformativo,
  obtenerCampanasInformativasAction,
} from "../acciones-informativos";
import { formatearFechaCorta } from "../utils/vigencia";

interface Props {
  negocio?: string;
  audienciaActiva?: AudienciaInformativo | "TODOS";
  filtroTipoInicial?: TipoInformativo | "TODOS";
  tituloSeccion?: string;
  subtituloSeccion?: string;
  soloBeneficios?: boolean;
  linkGestion?: string;
}

const TIPO_INFO_MAP: Record<TipoInformativo, { label: string; icon: any; bg: string; text: string; border: string }> = {
  BENEFICIO_CONVENIO: {
    label: "Convenio & Capacitación",
    icon: Award,
    bg: "#EEF2FF",
    text: "#4338CA",
    border: "#C7D2FE",
  },
  ALERTA_REGULATORIA: {
    label: "Alerta de Institución",
    icon: AlertTriangle,
    bg: "#FEF2F2",
    text: "#B91C1C",
    border: "#FECACA",
  },
  NOTICIA_TRIBUTARIA_MUNICIPAL: {
    label: "Oportunidad Tributaria",
    icon: Building2,
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
  COMUNICADO_GENERAL: {
    label: "Aviso Oficial",
    icon: Megaphone,
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
  },
};

export function TableroBeneficiosAvisosWidget({
  negocio = "tranqi",
  audienciaActiva = "TODOS",
  filtroTipoInicial = "TODOS",
  tituloSeccion,
  subtituloSeccion,
  soloBeneficios = false,
  linkGestion,
}: Props) {
  const [campanas, setCampanas] = useState<CampanaInformativa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>(soloBeneficios ? "BENEFICIO_CONVENIO" : filtroTipoInicial);
  const [busqueda, setBusqueda] = useState("");
  const [reproduciendoVideoUrl, setReproduciendoVideoUrl] = useState<string | null>(null);

  const CACHE_KEY = `eco_campanas_informativas_${negocio}`;
  const DELETED_KEY = `eco_campanas_eliminadas_${negocio}`;

  const getEliminadosLocal = (): Set<string> => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(DELETED_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set();
  };

  useEffect(() => {
    let cancelado = false;
    const eliminados = getEliminadosLocal();

    // 1. Carga inmediata síncrona desde cache
    if (typeof window !== "undefined") {
      try {
        const guardado = localStorage.getItem(CACHE_KEY);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed)) {
            setCampanas(
              parsed.filter(
                (c: any) =>
                  c.inf_activo !== false && !eliminados.has(c.inf_id) && !eliminados.has(c.inf_slug)
              )
            );
          }
        }
      } catch {}
    }

    const cargar = async () => {
      setCargando(true);
      try {
        const data = await obtenerCampanasInformativasAction({
          negocio,
          audiencia: audienciaActiva,
          tipo: soloBeneficios ? "BENEFICIO_CONVENIO" : undefined,
          incluirInactivos: false,
        });
        if (!cancelado && Array.isArray(data)) {
          const limpios = data.filter(
            (c: any) => !eliminados.has(c.inf_id) && !eliminados.has(c.inf_slug)
          );
          setCampanas(limpios);
          if (typeof window !== "undefined") {
            localStorage.setItem(CACHE_KEY, JSON.stringify(limpios));
          }
        }
      } catch (err) {
        console.error("Error cargando tablero de beneficios:", err);
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [negocio, audienciaActiva, soloBeneficios]);

  const filtrados = useMemo(() => {
    return campanas.filter((c) => {
      if (filtroTipo !== "TODOS" && c.inf_tipo !== filtroTipo) return false;
      if (busqueda.trim() !== "") {
        const q = busqueda.toLowerCase().trim();
        const t = c.inf_titulo.toLowerCase();
        const s = (c.inf_subtitulo || "").toLowerCase();
        const inst = (c.inf_detalle?.institucion || "").toLowerCase();
        if (!t.includes(q) && !s.includes(q) && !inst.includes(q)) return false;
      }
      return true;
    });
  }, [campanas, filtroTipo, busqueda]);

  const tituloHeader =
    tituloSeccion ||
    (soloBeneficios
      ? "Paquete de Beneficios & Convenios para Abogados Socios"
      : "Avisos Oficiales, Alertas Regulatorias & Beneficios");

  const subtituloHeader =
    subtituloSeccion ||
    (soloBeneficios
      ? "Capacitaciones oficiales con becas exclusivas, convenios con institutos de postgrados, software jurídico y tarifas preferenciales para la red profesional."
      : "Comunicados actualizados de ANT, Judicatura, incentivos de patentes municipales y convenios vigentes en el ecosistema.");

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Cabecera Visual */}
      <div
        style={{
          background: soloBeneficios
            ? "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)"
            : "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0369A1 100%)",
          borderRadius: "16px",
          padding: "24px 28px",
          color: "#FFFFFF",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ flex: 1, minWidth: "280px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(6px)",
                padding: "3px 10px",
                borderRadius: "20px",
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              {soloBeneficios ? <Award size={12} /> : <Megaphone size={12} />}
              {soloBeneficios ? "Red Profesional · Beneficios Exclusivos" : "Comunidad & Novedades Oficiales"}
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 900, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
              {tituloHeader}
            </h2>
            <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9, maxWidth: "720px", lineHeight: 1.45 }}>
              {subtituloHeader}
            </p>
          </div>

          {linkGestion && (
            <a
              href={linkGestion}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#FFFFFF",
                color: "#0F172A",
                padding: "9px 16px",
                borderRadius: "10px",
                fontWeight: 700,
                fontSize: "0.84rem",
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                whiteSpace: "nowrap",
                marginTop: "4px",
              }}
              title="Abrir la consola de administración de informativos y campañas"
            >
              <Settings size={16} color="#0369A1" />
              Administrar Informativos
            </a>
          )}
        </div>
      </div>

      {/* Barra de Filtros */}
      {!soloBeneficios && (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { id: "TODOS", label: "Todos los Avisos" },
              { id: "BENEFICIO_CONVENIO", label: "🎓 Convenios & Becas" },
              { id: "ALERTA_REGULATORIA", label: "⚠️ Alertas ANT / Judicatura" },
              { id: "NOTICIA_TRIBUTARIA_MUNICIPAL", label: "🏛️ Noticias Municipales" },
            ].map((f) => {
              const sel = filtroTipo === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroTipo(f.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    border: sel ? "1.5px solid #4338CA" : "1px solid #E2E8F0",
                    background: sel ? "#EEF2FF" : "#FFFFFF",
                    color: sel ? "#4338CA" : "#64748B",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div style={{ position: "relative", width: "100%", maxWidth: "240px" }}>
            <Search
              size={14}
              style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
            />
            <input
              type="text"
              placeholder="Buscar comunicados..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px 6px 30px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "0.8rem",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}

      {/* Grid de Tarjetas de Beneficios & Avisos */}
      {cargando ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748B" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 10px", color: "#4338CA" }} />
          <div>Cargando convenios y comunicados vigentes...</div>
        </div>
      ) : filtrados.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px dashed #CBD5E1",
            borderRadius: "14px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <Award size={36} style={{ color: "#94A3B8", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", fontWeight: 800, color: "#1E293B" }}>
            No hay comunicados o convenios vigentes en este momento
          </h3>
          <p style={{ margin: "0 auto", fontSize: "0.82rem", color: "#64748B", maxWidth: "420px" }}>
            Los nuevos beneficios de formación jurídica, avisos institucionales y oportunidades tributarias se publicarán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {filtrados.map((c) => {
            const tipoDef = TIPO_INFO_MAP[c.inf_tipo] || TIPO_INFO_MAP.COMUNICADO_GENERAL;
            const det = c.inf_detalle || {};
            const img = det.imagen_url || "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80";
            const TipoIcono = tipoDef.icon;

            return (
              <div
                key={c.inf_id}
                style={{
                  background: "#FFFFFF",
                  border: c.inf_prioridad === "ALTA" ? "1.5px solid #4338CA" : "1px solid #E2E8F0",
                  borderRadius: "16px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: c.inf_prioridad === "ALTA" ? "0 8px 20px -4px rgba(67, 56, 202, 0.15)" : "0 4px 12px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* Portada Multimedia */}
                <div style={{ position: "relative", width: "100%", height: "170px", background: "#0F172A" }}>
                  <img
                    src={img}
                    alt={c.inf_titulo}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: (det.foto_ajuste as any) || "cover",
                      objectPosition: det.foto_posicion || "center center",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.2) 60%, transparent 100%)",
                    }}
                  />

                  {/* Badges superiores */}
                  <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px", flexWrap: "wrap", zIndex: 2 }}>
                    <span
                      style={{
                        background: det.color_tag ? det.color_tag : tipoDef.bg,
                        color: det.color_tag ? "#FFFFFF" : tipoDef.text,
                        border: det.color_tag ? "1px solid rgba(255,255,255,0.3)" : `1px solid ${tipoDef.border}`,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                      }}
                    >
                      <TipoIcono size={12} /> {det.categoria || tipoDef.label}
                    </span>
                    {det.porcentaje_descuento && (
                      <span
                        style={{
                          background: "#10B981",
                          color: "#FFFFFF",
                          padding: "3px 9px",
                          borderRadius: "12px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                      >
                        🎁 {det.porcentaje_descuento}
                      </span>
                    )}
                  </div>

                  {/* Botón de Video si existe */}
                  {det.video_url && (
                    <button
                      type="button"
                      onClick={() => setReproduciendoVideoUrl(det.video_url || null)}
                      style={{
                        position: "absolute",
                        bottom: "10px",
                        right: "12px",
                        background: "rgba(67, 56, 202, 0.9)",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Play size={11} fill="#FFFFFF" /> Video Explicativo
                    </button>
                  )}

                  {/* Institución abajo a la izquierda */}
                  {det.institucion && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "10px",
                        left: "12px",
                        color: "#FFFFFF",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                      }}
                    >
                      🏛️ {det.institucion}
                    </div>
                  )}
                </div>

                {/* Contenido de la Tarjeta */}
                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0F172A", lineHeight: 1.35 }}>
                    {c.inf_titulo}
                  </h3>

                  {c.inf_subtitulo && (
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                      {c.inf_subtitulo}
                    </p>
                  )}

                  {c.inf_contenido_md && (
                    <div
                      style={{
                        margin: "0 0 14px 0",
                        fontSize: "0.78rem",
                        color: "#64748B",
                        lineHeight: 1.45,
                        background: "#F8FAFC",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        borderLeft: "3px solid #4338CA",
                      }}
                    >
                      {c.inf_contenido_md}
                    </div>
                  )}

                  {/* Pie con Vigencia y Botón CTA */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "14px",
                      borderTop: "1px solid #F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.72rem", color: "#64748B" }}>
                      <Clock size={12} />
                      <span>
                        Hasta: {c.inf_fecha_fin ? formatearFechaCorta(c.inf_fecha_fin.split("T")[0]) : "Indefinido"}
                      </span>
                    </div>

                    {det.cta_texto && det.cta_url && (
                      <a
                        href={det.cta_url}
                        target={det.cta_url.startsWith("http") ? "_blank" : "_self"}
                        rel="noreferrer"
                        style={{
                          background: "#4338CA",
                          color: "#FFFFFF",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: 800,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          boxShadow: "0 2px 8px rgba(67, 56, 202, 0.25)",
                        }}
                      >
                        {det.cta_texto} <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Video Player */}
      {reproduciendoVideoUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setReproduciendoVideoUrl(null)}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "800px",
              background: "#000000",
              borderRadius: "12px",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setReproduciendoVideoUrl(null)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "rgba(0,0,0,0.7)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                zIndex: 10,
              }}
            >
              ✕
            </button>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              {reproduciendoVideoUrl.includes("youtube.com") || reproduciendoVideoUrl.includes("youtu.be") ? (
                <iframe
                  src={
                    reproduciendoVideoUrl.includes("watch?v=")
                      ? reproduciendoVideoUrl.replace("watch?v=", "embed/")
                      : reproduciendoVideoUrl
                  }
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={reproduciendoVideoUrl} controls autoPlay style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
