"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Award,
  AlertTriangle,
  Calendar,
  Clock,
  Plus,
  Search,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Video,
  Image as ImageIcon,
  Filter,
  Tag,
  Globe,
  Building2,
  Users,
  Scale,
  X,
  Link2,
  Play,
  Share2,
} from "lucide-react";
import {
  CampanaInformativa,
  TipoInformativo,
  AudienciaInformativo,
  UbicacionInformativo,
  obtenerCampanasInformativasAction,
  guardarCampanaInformativaAction,
  alternarActivoCampanaAction,
  eliminarCampanaInformativaAction,
  restaurarCampanasEjemploAction,
} from "../acciones-informativos";
import { formatearFechaCorta } from "../utils/vigencia";
import { ModalGaleriaMedios } from "./ModalGaleriaMedios";

interface Props {
  negocio?: string;
  esAdmin?: boolean;
}

const TIPO_COLORES: Record<TipoInformativo, { label: string; bg: string; text: string; border: string }> = {
  BENEFICIO_CONVENIO: {
    label: "Convenio / Beca",
    bg: "#EEF2FF",
    text: "#4338CA",
    border: "#C7D2FE",
  },
  ALERTA_REGULATORIA: {
    label: "Alerta Regulatoria",
    bg: "#FEF2F2",
    text: "#B91C1C",
    border: "#FECACA",
  },
  NOTICIA_TRIBUTARIA_MUNICIPAL: {
    label: "Noticia Tributaria",
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
  COMUNICADO_GENERAL: {
    label: "Comunicado General",
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
  },
};

export function ConsolaGestionInformativosWidget({ negocio = "tranqi", esAdmin = true }: Props) {
  const [campanas, setCampanas] = useState<CampanaInformativa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroAudiencia, setFiltroAudiencia] = useState<string>("TODOS");

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [campanaEditar, setCampanaEditar] = useState<CampanaInformativa | null>(null);

  // Formulario State
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [contenidoMd, setContenidoMd] = useState("");
  const [tipo, setTipo] = useState<TipoInformativo>("BENEFICIO_CONVENIO");
  const [audiencias, setAudiencias] = useState<AudienciaInformativo[]>(["TODOS"]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionInformativo[]>(["PANEL_INICIO"]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [activo, setActivo] = useState(true);
  const [prioridad, setPrioridad] = useState<"ALTA" | "MEDIA" | "BAJA">("MEDIA");

  // Detalle
  const [imagenUrl, setImagenUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [ctaTexto, setCtaTexto] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [porcentajeDescuento, setPorcentajeDescuento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Galería de medios
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const data = await obtenerCampanasInformativasAction({
        negocio,
        incluirInactivos: true,
      });
      setCampanas(data);
    } catch (err) {
      console.error("Error cargando campañas informativas:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

  const abrirModalCrear = () => {
    setCampanaEditar(null);
    setTitulo("");
    setSlug("");
    setSubtitulo("");
    setContenidoMd("");
    setTipo("BENEFICIO_CONVENIO");
    setAudiencias(["TODOS"]);
    setUbicaciones(["PANEL_INICIO", "PANEL_BENEFICIOS"]);
    setFechaInicio(new Date().toISOString().split("T")[0] || "");
    setFechaFin("");
    setActivo(true);
    setPrioridad("MEDIA");
    setImagenUrl("");
    setVideoUrl("");
    setCtaTexto("");
    setCtaUrl("");
    setInstitucion("");
    setPorcentajeDescuento("");
    setErrorForm(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (c: CampanaInformativa) => {
    setCampanaEditar(c);
    setTitulo(c.inf_titulo);
    setSlug(c.inf_slug);
    setSubtitulo(c.inf_subtitulo || "");
    setContenidoMd(c.inf_contenido_md || "");
    setTipo(c.inf_tipo);
    setAudiencias(c.inf_audiencia);
    setUbicaciones(c.inf_ubicaciones);
    setFechaInicio(c.inf_fecha_inicio ? c.inf_fecha_inicio.split("T")[0] || "" : "");
    setFechaFin(c.inf_fecha_fin ? c.inf_fecha_fin.split("T")[0] || "" : "");
    setActivo(c.inf_activo);
    setPrioridad(c.inf_prioridad);

    const det = c.inf_detalle || {};
    setImagenUrl(det.imagen_url || "");
    setVideoUrl(det.video_url || "");
    setCtaTexto(det.cta_texto || "");
    setCtaUrl(det.cta_url || "");
    setInstitucion(det.institucion || "");
    setPorcentajeDescuento(det.porcentaje_descuento || "");
    setErrorForm(null);
    setModalAbierto(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setErrorForm("El título es obligatorio.");
      return;
    }

    setGuardando(true);
    setErrorForm(null);

    try {
      const payload: Partial<CampanaInformativa> = {
        inf_id: campanaEditar?.inf_id,
        inf_negocio: negocio,
        inf_titulo: titulo.trim(),
        inf_slug: slug.trim() || undefined,
        inf_subtitulo: subtitulo.trim() || null,
        inf_contenido_md: contenidoMd.trim() || null,
        inf_tipo: tipo,
        inf_audiencia: audiencias.length > 0 ? audiencias : ["TODOS"],
        inf_ubicaciones: ubicaciones.length > 0 ? ubicaciones : ["PANEL_INICIO"],
        inf_fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : new Date().toISOString(),
        inf_fecha_fin: fechaFin ? new Date(fechaFin).toISOString() : null,
        inf_activo: activo,
        inf_prioridad: prioridad,
        inf_detalle: {
          imagen_url: imagenUrl.trim() || undefined,
          video_url: videoUrl.trim() || undefined,
          cta_texto: ctaTexto.trim() || undefined,
          cta_url: ctaUrl.trim() || undefined,
          institucion: institucion.trim() || undefined,
          porcentaje_descuento: porcentajeDescuento.trim() || undefined,
          foto_ajuste: "cover",
          foto_posicion: "center center",
          foto_zoom: 100,
        },
      };

      const res = await guardarCampanaInformativaAction(payload);
      if (res.ok) {
        setModalAbierto(false);
        await cargarDatos();
      } else {
        setErrorForm(res.error || "No se pudo guardar la campaña.");
      }
    } catch (err: any) {
      setErrorForm(err?.message || "Error al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  const handleAlternarActivo = async (id: string, actual: boolean) => {
    // Optimistic update
    setCampanas((prev) =>
      prev.map((c) => (c.inf_id === id ? { ...c, inf_activo: !actual } : c))
    );
    await alternarActivoCampanaAction(negocio, id, !actual);
  };

  const handleEliminar = async (id: string, tit: string) => {
    if (!confirm(`¿Eliminar la campaña "${tit}"?`)) return;
    setCampanas((prev) => prev.filter((c) => c.inf_id !== id));
    await eliminarCampanaInformativaAction(negocio, id);
  };

  const handleRestaurarEjemplo = async () => {
    if (!confirm("¿Deseas restaurar las campañas y convenios informativos oficiales de ejemplo?")) return;
    setCargando(true);
    await restaurarCampanasEjemploAction(negocio);
    await cargarDatos();
  };

  // Toggle helpers
  const toggleAudiencia = (aud: AudienciaInformativo) => {
    if (aud === "TODOS") {
      setAudiencias(["TODOS"]);
      return;
    }
    const sinTodos = audiencias.filter((a) => a !== "TODOS");
    if (sinTodos.includes(aud)) {
      const rest = sinTodos.filter((a) => a !== aud);
      setAudiencias(rest.length === 0 ? ["TODOS"] : rest);
    } else {
      setAudiencias([...sinTodos, aud]);
    }
  };

  const toggleUbicacion = (ub: UbicacionInformativo) => {
    if (ubicaciones.includes(ub)) {
      if (ubicaciones.length === 1) return; // al menos 1
      setUbicaciones(ubicaciones.filter((u) => u !== ub));
    } else {
      setUbicaciones([...ubicaciones, ub]);
    }
  };

  const campanasFiltradas = useMemo(() => {
    return campanas.filter((c) => {
      if (filtroTipo !== "TODOS" && c.inf_tipo !== filtroTipo) return false;
      if (filtroAudiencia !== "TODOS") {
        if (!c.inf_audiencia.includes("TODOS") && !c.inf_audiencia.includes(filtroAudiencia as any)) {
          return false;
        }
      }
      if (busqueda.trim() !== "") {
        const q = busqueda.toLowerCase().trim();
        const t = c.inf_titulo.toLowerCase();
        const s = (c.inf_subtitulo || "").toLowerCase();
        const inst = (c.inf_detalle?.institucion || "").toLowerCase();
        if (!t.includes(q) && !s.includes(q) && !inst.includes(q)) return false;
      }
      return true;
    });
  }, [campanas, filtroTipo, filtroAudiencia, busqueda]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
          borderRadius: "16px",
          padding: "24px 28px",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 10px 25px -5px rgba(49, 46, 129, 0.25)",
        }}
      >
        <div>
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
            <Megaphone size={12} /> Comunicación & Convenios
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            Gestión de Informativos, Alertas & Beneficios ({negocio.toUpperCase()})
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9, maxWidth: "680px" }}>
            Configura comunicados oficiales (ANT, Judicatura, Municipios), oportunidades tributarias y el catálogo de convenios & capacitación profesional para la red de abogados.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleRestaurarEjemplo}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              color: "#FFFFFF",
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={14} /> Restaurar Ejemplos
          </button>
          <button
            type="button"
            onClick={abrirModalCrear}
            style={{
              background: "#10B981",
              border: "none",
              color: "#FFFFFF",
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            }}
          >
            <Plus size={16} /> + Nuevo Informativo / Beneficio
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          border: "1px solid #E2E8F0",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 280px" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: "340px" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
            />
            <input
              type="text"
              placeholder="Buscar por título, institución..."
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

          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
              color: "#334155",
            }}
          >
            <option value="TODOS">Todos los Tipos</option>
            <option value="BENEFICIO_CONVENIO">Convenios & Capacitaciones</option>
            <option value="ALERTA_REGULATORIA">Alertas Regulatorias</option>
            <option value="NOTICIA_TRIBUTARIA_MUNICIPAL">Noticias Tributarias</option>
            <option value="COMUNICADO_GENERAL">Comunicados Generales</option>
          </select>

          {/* Filtro Audiencia */}
          <select
            value={filtroAudiencia}
            onChange={(e) => setFiltroAudiencia(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.82rem",
              background: "#FFFFFF",
              color: "#334155",
            }}
          >
            <option value="TODOS">Todas las Audiencias</option>
            <option value="ABOGADOS">Exclusivo Abogados</option>
            <option value="CLIENTES">Personas / Clientes</option>
            <option value="EMPRESAS">Empresas / Corporativo</option>
          </select>
        </div>

        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#64748B" }}>
          {campanasFiltradas.length} {campanasFiltradas.length === 1 ? "publicación" : "publicaciones"}
        </div>
      </div>

      {/* Grid de Campañas / Avisos */}
      {cargando ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748B" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 10px", color: "#4338CA" }} />
          <div>Cargando campañas y comunicados...</div>
        </div>
      ) : campanasFiltradas.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px dashed #CBD5E1",
            borderRadius: "14px",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <Megaphone size={36} style={{ color: "#94A3B8", margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 800, color: "#1E293B" }}>
            No se encontraron publicaciones
          </h3>
          <p style={{ margin: "0 auto 16px", fontSize: "0.85rem", color: "#64748B", maxWidth: "420px" }}>
            Crea una nueva alerta para comunicar novedades de ANT, convenios de maestrías o incentivos tributarios.
          </p>
          <button
            type="button"
            onClick={abrirModalCrear}
            style={{
              background: "#4338CA",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 18px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Crear Primera Campaña
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "20px",
          }}
        >
          {campanasFiltradas.map((c) => {
            const badgeTipo = TIPO_COLORES[c.inf_tipo] || TIPO_COLORES.COMUNICADO_GENERAL;
            const det = c.inf_detalle || {};
            const img = det.imagen_url || "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80";

            return (
              <div
                key={c.inf_id}
                style={{
                  background: "#FFFFFF",
                  border: c.inf_activo ? "1px solid #E2E8F0" : "1px dashed #CBD5E1",
                  borderRadius: "14px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: c.inf_activo ? 1 : 0.65,
                  boxShadow: c.inf_activo ? "0 4px 12px rgba(0,0,0,0.04)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Portada */}
                <div style={{ position: "relative", width: "100%", height: "160px", background: "#0F172A" }}>
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
                      background: "linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 70%)",
                    }}
                  />

                  {/* Badges superiores */}
                  <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: badgeTipo.bg,
                        color: badgeTipo.text,
                        border: `1px solid ${badgeTipo.border}`,
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {badgeTipo.label}
                    </span>
                    {det.porcentaje_descuento && (
                      <span
                        style={{
                          background: "#10B981",
                          color: "#FFFFFF",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.68rem",
                          fontWeight: 800,
                        }}
                      >
                        🎁 {det.porcentaje_descuento}
                      </span>
                    )}
                  </div>

                  {/* Toggle Activo Superior Derecho */}
                  <button
                    type="button"
                    title={c.inf_activo ? "Desactivar publicación" : "Activar publicación"}
                    onClick={() => handleAlternarActivo(c.inf_id, c.inf_activo)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      background: c.inf_activo ? "rgba(16, 185, 129, 0.95)" : "rgba(100, 116, 139, 0.95)",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "3px 9px",
                      borderRadius: "12px",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: c.inf_activo ? "#FFFFFF" : "#CBD5E1",
                      }}
                    />
                    {c.inf_activo ? "Activo" : "Inactivo"}
                  </button>

                  {/* Institución / Autor abajo en foto */}
                  {det.institucion && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "12px",
                        color: "#FFFFFF",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        opacity: 0.9,
                      }}
                    >
                      🏛️ {det.institucion}
                    </div>
                  )}
                </div>

                {/* Contenido */}
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: "0.98rem", fontWeight: 800, color: "#0F172A", lineHeight: 1.35 }}>
                    {c.inf_titulo}
                  </h3>
                  {c.inf_subtitulo && (
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: "0.8rem",
                        color: "#475569",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {c.inf_subtitulo}
                    </p>
                  )}

                  {/* Meta Tags: Audiencia & Ubicación */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "12px" }}>
                    {c.inf_audiencia.map((aud) => (
                      <span
                        key={aud}
                        style={{
                          background: "#F1F5F9",
                          color: "#334155",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                        }}
                      >
                        👥 {aud}
                      </span>
                    ))}
                    {c.inf_ubicaciones.map((ub) => (
                      <span
                        key={ub}
                        style={{
                          background: "#F8FAFC",
                          color: "#64748B",
                          border: "1px solid #E2E8F0",
                          padding: "2px 6px",
                          borderRadius: "6px",
                          fontSize: "0.65rem",
                          fontWeight: 600,
                        }}
                      >
                        📍 {ub.replace("PANEL_", "").replace("LANDING_", "")}
                      </span>
                    ))}
                  </div>

                  {/* Fechas de Vigencia */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "0.72rem",
                      color: "#64748B",
                      marginBottom: "14px",
                    }}
                  >
                    <Clock size={12} />
                    <span>
                      Vigencia: {formatearFechaCorta(c.inf_fecha_inicio.split("T")[0])}
                      {c.inf_fecha_fin ? ` al ${formatearFechaCorta(c.inf_fecha_fin.split("T")[0])}` : " (Permanente)"}
                    </span>
                  </div>

                  {/* Botones de Acción */}
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "12px",
                      borderTop: "1px solid #F1F5F9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => abrirModalEditar(c)}
                        style={{
                          background: "#F1F5F9",
                          border: "none",
                          color: "#334155",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Edit3 size={13} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(c.inf_id, c.inf_titulo)}
                        style={{
                          background: "#FEF2F2",
                          border: "none",
                          color: "#DC2626",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {det.cta_texto && det.cta_url && (
                      <a
                        href={det.cta_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: "#4338CA",
                          color: "#FFFFFF",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {det.cta_texto} <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Creación / Edición */}
      {modalAbierto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "720px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px 28px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E2E8F0", paddingBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#EEF2FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4338CA",
                  }}
                >
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#0F172A" }}>
                    {campanaEditar ? "Editar Campaña / Comunicado" : "Nueva Campaña Informativa & Beneficio"}
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748B" }}>
                    Segmenta por audiencia, fechas de vigencia y añade botones de acción directa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {errorForm && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "8px", fontSize: "0.82rem" }}>
                {errorForm}
              </div>
            )}

            <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Tipo y Prioridad */}
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Tipo de Comunicado / Campaña *
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      background: "#FFFFFF",
                      color: "#1E293B",
                    }}
                  >
                    <option value="BENEFICIO_CONVENIO">🎓 Convenio / Beca / Capacitación (Abogados)</option>
                    <option value="ALERTA_REGULATORIA">⚠️ Alerta Regulatoria (ANT, Judicatura, SRI)</option>
                    <option value="NOTICIA_TRIBUTARIA_MUNICIPAL">🏛️ Noticia Tributaria / Municipal (Descuentos)</option>
                    <option value="COMUNICADO_GENERAL">📢 Comunicado General de Plataforma</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Prioridad Visual
                  </label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="ALTA">Alta (Banner Flotante / Destacado)</option>
                    <option value="MEDIA">Media (Rejilla Estándar)</option>
                    <option value="BAJA">Baja (Informativo Secundario)</option>
                  </select>
                </div>
              </div>

              {/* Título y Subtítulo */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Título del Comunicado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Convenio de Diplomados en Derecho Societario para Abogados"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.88rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Subtítulo / Resumen Corto
                </label>
                <input
                  type="text"
                  placeholder="Ej: 25% de beca exclusiva para socios activos en diplomados oficiales"
                  value={subtitulo}
                  onChange={(e) => setSubtitulo(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Institución & Descuento */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Institución / Entidad Emisora
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Agencia Nacional de Tránsito / Instituto Jurídico"
                    value={institucion}
                    onChange={(e) => setInstitucion(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Incentivo / Beneficio
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 25% Beca / 10% Descuento"
                    value={porcentajeDescuento}
                    onChange={(e) => setPorcentajeDescuento(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Audiencia Objetivo */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Audiencia Objetivo (¿Quién verá este aviso?)
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(["TODOS", "ABOGADOS", "CLIENTES", "EMPRESAS"] as AudienciaInformativo[]).map((aud) => {
                    const sel = audiencias.includes(aud);
                    return (
                      <button
                        key={aud}
                        type="button"
                        onClick={() => toggleAudiencia(aud)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          border: sel ? "1.5px solid #4338CA" : "1px solid #CBD5E1",
                          background: sel ? "#EEF2FF" : "#FFFFFF",
                          color: sel ? "#4338CA" : "#64748B",
                          cursor: "pointer",
                        }}
                      >
                        {aud === "TODOS" && "🌍 Todos"}
                        {aud === "ABOGADOS" && "⚖️ Abogados / Red Socios"}
                        {aud === "CLIENTES" && "👤 Clientes / Personas"}
                        {aud === "EMPRESAS" && "🏢 Empresas / Corporativo"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ubicaciones de Despliegue */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Ubicación de Despliegue
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { id: "PANEL_INICIO" as UbicacionInformativo, label: "Tablero Inicio (Panel)" },
                    { id: "PANEL_BENEFICIOS" as UbicacionInformativo, label: "Muro de Beneficios" },
                    { id: "LANDING_BANNER" as UbicacionInformativo, label: "Cintillo Superior Landing" },
                    { id: "LANDING_GRID" as UbicacionInformativo, label: "Sección Avisos Landing" },
                  ].map((u) => {
                    const sel = ubicaciones.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUbicacion(u.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          border: sel ? "1.5px solid #10B981" : "1px solid #CBD5E1",
                          background: sel ? "#ECFDF5" : "#FFFFFF",
                          color: sel ? "#065F46" : "#64748B",
                          cursor: "pointer",
                        }}
                      >
                        {sel ? "✓ " : "+ "}
                        {u.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fechas de Vigencia */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Fecha Inicio de Campaña *
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Fecha Fin (Opcional - Dejar vacío si es permanente)
                  </label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Multimedia: Imagen & Video */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#1E293B" }}>
                    🖼️ Recursos Multimedia (Foto de Portada & Video)
                  </span>
                  <button
                    type="button"
                    onClick={() => setGaleriaAbierta(true)}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      color: "#334155",
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
                    <ImageIcon size={13} /> Galería de Medios
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#64748B", marginBottom: "2px" }}>
                      URL Imagen de Portada
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={imagenUrl}
                      onChange={(e) => setImagenUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#64748B", marginBottom: "2px" }}>
                      URL Video (YouTube / MP4)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Acción / CTA */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Texto Botón CTA
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Inscribirme a Beca / Ver Resolución"
                    value={ctaTexto}
                    onChange={(e) => setCtaTexto(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Enlace de Destino (URL Interna o WhatsApp)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: /panel/agendar o https://wa.me/593..."
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Footer Modal */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: "1px solid #E2E8F0",
                  paddingTop: "14px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  style={{
                    background: "#F1F5F9",
                    border: "none",
                    color: "#475569",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    background: "#4338CA",
                    border: "none",
                    color: "#FFFFFF",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: guardando ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(67, 56, 202, 0.3)",
                  }}
                >
                  {guardando ? "Guardando..." : campanaEditar ? "Actualizar Campaña" : "Publicar Campaña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Galería de Medios */}
      {galeriaAbierta && (
        <ModalGaleriaMedios
          abierto={galeriaAbierta}
          onCerrar={() => setGaleriaAbierta(false)}
          onSeleccionarImagen={(url) => {
            setImagenUrl(url);
            setGaleriaAbierta(false);
          }}
          negocio={negocio}
        />
      )}
    </div>
  );
}
