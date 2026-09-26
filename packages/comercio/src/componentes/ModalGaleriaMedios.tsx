"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Image as ImageIcon,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Folder,
  Layers,
  Filter,
  ExternalLink,
  Loader2,
  HardDrive,
  FileCheck,
  Sparkles,
} from "lucide-react";
import {
  listarGaleriaNegocioAction,
  eliminarImagenGaleriaAction,
  subirImagenCatalogoAction,
  ElementoMedioGaleria,
} from "../acciones";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  negocio?: string;
  onSeleccionarImagen?: (url: string, medio?: ElementoMedioGaleria) => void;
  titulo?: string;
  carpetaPredeterminada?: "portadas" | "variantes" | "galeria" | "general" | "";
}

export function ModalGaleriaMedios({
  abierto,
  onCerrar,
  negocio = "tranqi",
  onSeleccionarImagen,
  titulo = "Galería y Biblioteca Multimedia del Negocio",
  carpetaPredeterminada = "",
}: Props) {
  const [tabActiva, setTabActiva] = useState<"biblioteca" | "subir">("biblioteca");
  const [medios, setMedios] = useState<ElementoMedioGaleria[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCarpeta, setFiltroCarpeta] = useState<string>(carpetaPredeterminada);
  const [seleccionado, setSeleccionado] = useState<ElementoMedioGaleria | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<ElementoMedioGaleria | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Estados de subida
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const [archivosProgreso, setArchivosProgreso] = useState<{ nombre: string; estado: "subiendo" | "listo" | "error" }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargarMedios = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await listarGaleriaNegocioAction(negocio);
      if (res.ok) {
        setMedios(res.medios || []);
      } else {
        setError(res.error || "No se pudieron cargar los archivos de la galería.");
      }
    } catch (e: any) {
      setError(`Error al conectar con la galería: ${e.message || e}`);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      cargarMedios();
      setSeleccionado(null);
      setConfirmarEliminar(null);
      setExito(null);
      setError(null);
    }
  }, [abierto, negocio]);

  if (!abierto) return null;

  const mediosFiltrados = medios.filter((m) => {
    const coincideTexto =
      !busqueda.trim() ||
      m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.rutaCompleta.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCarpeta = !filtroCarpeta || m.carpeta === filtroCarpeta;
    return coincideTexto && coincideCarpeta;
  });

  const handleSubirArchivos = async (archivos: FileList | File[]) => {
    if (!archivos || archivos.length === 0) return;
    setSubiendoArchivos(true);
    setError(null);
    setExito(null);

    const lista = Array.from(archivos);
    setArchivosProgreso(lista.map((f) => ({ nombre: f.name, estado: "subiendo" })));

    let exitosos = 0;
    let ultimaUrl = "";
    let ultimoMedio: ElementoMedioGaleria | undefined;

    for (let i = 0; i < lista.length; i++) {
      const file = lista[i]!;
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("negocio", negocio);
        formData.append("carpeta", filtroCarpeta || "portadas");

        const res = await subirImagenCatalogoAction(formData);
        if (res.ok && res.urlPublica) {
          exitosos++;
          ultimaUrl = res.urlPublica;
          setArchivosProgreso((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, estado: "listo" } : item))
          );
        } else {
          setArchivosProgreso((prev) =>
            prev.map((item, idx) => (idx === i ? { ...item, estado: "error" } : item))
          );
        }
      } catch {
        setArchivosProgreso((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, estado: "error" } : item))
        );
      }
    }

    setSubiendoArchivos(false);
    if (exitosos > 0) {
      setExito(`¡Se subieron ${exitosos} imagen(es) a la galería de ${negocio.toUpperCase()}!`);
      await cargarMedios();
      setTabActiva("biblioteca");
    } else {
      setError("No se pudo subir ninguno de los archivos seleccionados.");
    }
  };

  const handleEliminar = async (medio: ElementoMedioGaleria) => {
    setEliminandoId(medio.id);
    setError(null);
    try {
      const res = await eliminarImagenGaleriaAction(negocio, medio.rutaCompleta);
      if (res.ok) {
        setMedios((prev) => prev.filter((m) => m.id !== medio.id && m.rutaCompleta !== medio.rutaCompleta));
        if (seleccionado?.id === medio.id) {
          setSeleccionado(null);
        }
        setConfirmarEliminar(null);
        setExito(`Imagen "${medio.nombre}" eliminada de la galería.`);
      } else {
        setError(res.error || "No se pudo eliminar la imagen.");
      }
    } catch (e: any) {
      setError(`Error al eliminar: ${e.message || e}`);
    } finally {
      setEliminandoId(null);
    }
  };

  const handleConfirmarSeleccion = () => {
    if (seleccionado && onSeleccionarImagen) {
      onSeleccionarImagen(seleccionado.urlPublica, seleccionado);
      onCerrar();
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
        boxSizing: "border-box",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "960px",
          height: "90vh",
          maxHeight: "720px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: "14px 20px",
            background: "#0F172A",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1E293B",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(56, 189, 248, 0.2)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38BDF8",
              }}
            >
              <ImageIcon size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>
                  {titulo}
                </h3>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: "#0284C7",
                    color: "#FFFFFF",
                  }}
                >
                  {negocio.toUpperCase()}
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.72rem", color: "#94A3B8" }}>
                Biblioteca en la nube (Supabase Storage). Sube fotos de tu equipo o selecciona existentes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE TABS & FILTROS */}
        <div
          style={{
            padding: "10px 20px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setTabActiva("biblioteca")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: tabActiva === "biblioteca" ? 800 : 600,
                border: tabActiva === "biblioteca" ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                background: tabActiva === "biblioteca" ? "#0284C7" : "#FFFFFF",
                color: tabActiva === "biblioteca" ? "#FFFFFF" : "#475569",
                cursor: "pointer",
              }}
            >
              <Folder size={14} />
              <span>Explorar Biblioteca ({medios.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva("subir")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: tabActiva === "subir" ? 800 : 600,
                border: tabActiva === "subir" ? "1.5px solid #059669" : "1px solid #CBD5E1",
                background: tabActiva === "subir" ? "#059669" : "#FFFFFF",
                color: tabActiva === "subir" ? "#FFFFFF" : "#475569",
                cursor: "pointer",
              }}
            >
              <Upload size={14} />
              <span>+ Subir Nuevas Fotos</span>
            </button>
          </div>

          {tabActiva === "biblioteca" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "420px" }}>
              {/* Buscador */}
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={14}
                  color="#94A3B8"
                  style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 30px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.78rem",
                    boxSizing: "border-box",
                    background: "#FFFFFF",
                  }}
                />
              </div>

              {/* Filtro Carpeta */}
              <select
                value={filtroCarpeta}
                onChange={(e) => setFiltroCarpeta(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.78rem",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontWeight: 600,
                }}
              >
                <option value="">Todas las carpetas</option>
                <option value="portadas">Portadas Master</option>
                <option value="variantes">Variantes / Tamaños</option>
                <option value="galeria">Galería Adicional</option>
                <option value="general">General</option>
              </select>

              {/* Botón Refrescar */}
              <button
                type="button"
                onClick={cargarMedios}
                disabled={cargando}
                title="Recargar archivos de la galería"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  cursor: cargando ? "wait" : "pointer",
                  color: "#475569",
                  display: "flex",
                }}
              >
                <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
              </button>
            </div>
          )}
        </div>

        {/* MENSAJES FEEDBACK */}
        {error && (
          <div
            style={{
              background: "#FEF2F2",
              borderBottom: "1px solid #FCA5A5",
              color: "#991B1B",
              padding: "8px 16px",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {exito && (
          <div
            style={{
              background: "#F0FDF4",
              borderBottom: "1px solid #86EFAC",
              color: "#166534",
              padding: "8px 16px",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={14} />
              <span>{exito}</span>
            </div>
            <button
              onClick={() => setExito(null)}
              style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* TAB 1: BIBLIOTECA DE MEDIOS */}
          {tabActiva === "biblioteca" && (
            <div>
              {cargando ? (
                <div style={{ padding: "60px 0", textAlign: "center", color: "#64748B" }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px" }} />
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600 }}>
                    Consultando biblioteca multimedia de {negocio.toUpperCase()}...
                  </p>
                </div>
              ) : mediosFiltrados.length === 0 ? (
                <div
                  style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    background: "#F8FAFC",
                    borderRadius: "12px",
                    border: "2px dashed #CBD5E1",
                  }}
                >
                  <ImageIcon size={44} color="#94A3B8" style={{ margin: "0 auto 10px" }} />
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.95rem", color: "#334155" }}>
                    No hay imágenes disponibles en esta carpeta
                  </h4>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.78rem", color: "#64748B" }}>
                    Sube fotos desde tu equipo o disco local para utilizarlas en los productos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTabActiva("subir")}
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Upload size={14} />
                    <span>Subir Fotos Ahora</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {mediosFiltrados.map((item) => {
                    const esActivo = seleccionado?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSeleccionado(item)}
                        style={{
                          border: esActivo ? "2.5px solid #0284C7" : "1px solid #E2E8F0",
                          borderRadius: "10px",
                          overflow: "hidden",
                          background: "#FFFFFF",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          position: "relative",
                          boxShadow: esActivo
                            ? "0 4px 12px rgba(2, 132, 199, 0.25)"
                            : "0 1px 3px rgba(0,0,0,0.05)",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Miniatura Cuadrada */}
                        <div
                          style={{
                            width: "100%",
                            paddingTop: "75%",
                            position: "relative",
                            background: "#0F172A",
                          }}
                        >
                          <img
                            src={item.urlPublica}
                            alt={item.nombre}
                            loading="lazy"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />

                          {/* Badge de Carpeta */}
                          <span
                            style={{
                              position: "absolute",
                              top: "6px",
                              left: "6px",
                              background: "rgba(15, 23, 42, 0.75)",
                              color: "#FFFFFF",
                              fontSize: "0.6rem",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backdropFilter: "blur(2px)",
                              textTransform: "uppercase",
                            }}
                          >
                            {item.carpeta}
                          </span>

                          {/* Check de Selección */}
                          {esActivo && (
                            <div
                              style={{
                                position: "absolute",
                                top: "6px",
                                right: "6px",
                                background: "#0284C7",
                                color: "#FFFFFF",
                                borderRadius: "50%",
                                width: "22px",
                                height: "22px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                              }}
                            >
                              <CheckCircle2 size={16} />
                            </div>
                          )}
                        </div>

                        {/* Info del Archivo */}
                        <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                          <div>
                            <div
                              title={item.nombre}
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "#1E293B",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.nombre}
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "#94A3B8", marginTop: "2px" }}>
                              {formatBytes(item.tamanioBytes)}
                            </div>
                          </div>

                          {/* Acciones del ítem */}
                          <div
                            style={{
                              marginTop: "8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderTop: "1px solid #F1F5F9",
                              paddingTop: "6px",
                            }}
                          >
                            <a
                              href={item.urlPublica}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Ver imagen en tamaño completo"
                              style={{
                                color: "#64748B",
                                fontSize: "0.68rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "2px",
                                textDecoration: "none",
                              }}
                            >
                              <ExternalLink size={12} />
                            </a>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmarEliminar(item);
                              }}
                              disabled={eliminandoId === item.id}
                              title="Eliminar de la galería"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#EF4444",
                                cursor: "pointer",
                                padding: "2px",
                                display: "flex",
                              }}
                            >
                              {eliminandoId === item.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUBIR NUEVAS FOTOS */}
          {tabActiva === "subir" && (
            <div>
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  if (e.dataTransfer.files) {
                    handleSubirArchivos(e.dataTransfer.files);
                  }
                }}
                style={{
                  border: arrastrando ? "2.5px dashed #0284C7" : "2px dashed #CBD5E1",
                  background: arrastrando ? "#F0F9FF" : "#F8FAFC",
                  borderRadius: "14px",
                  padding: "48px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  marginBottom: "16px",
                }}
                onClick={() => inputRef.current?.click()}
              >
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "12px",
                    background: "#E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    color: "#0F172A",
                  }}
                >
                  <Upload size={28} />
                </div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", color: "#0F172A", fontWeight: 800 }}>
                  Arrastra y suelta fotos aquí, o haz clic para examinar
                </h4>
                <p style={{ margin: "0 0 14px 0", fontSize: "0.78rem", color: "#64748B" }}>
                  Archivos compatibles: JPG, PNG, WEBP, GIF, SVG (Hasta 15 MB por imagen).
                </p>

                <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={subiendoArchivos}
                    style={{
                      background: "#0F172A",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {subiendoArchivos ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Subiendo archivos...</span>
                      </>
                    ) : (
                      <>
                        <HardDrive size={15} />
                        <span>Examinar desde este Equipo</span>
                      </>
                    )}
                  </button>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={subiendoArchivos}
                  onChange={(e) => {
                    if (e.target.files) {
                      handleSubirArchivos(e.target.files);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </div>

              {/* Lista de progreso si está subiendo */}
              {archivosProgreso.length > 0 && (
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                    Archivos en cola ({archivosProgreso.length}):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {archivosProgreso.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: "#F8FAFC",
                          fontSize: "0.74rem",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#334155" }}>{p.nombre}</span>
                        {p.estado === "subiendo" && (
                          <span style={{ color: "#0284C7", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Loader2 size={12} className="animate-spin" /> Subiendo...
                          </span>
                        )}
                        {p.estado === "listo" && (
                          <span style={{ color: "#15803D", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={12} /> Listo
                          </span>
                        )}
                        {p.estado === "error" && (
                          <span style={{ color: "#B91C1C", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertCircle size={12} /> Error
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
        {confirmarEliminar && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(15, 23, 42, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100000,
              padding: "16px",
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                padding: "20px",
                maxWidth: "400px",
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#DC2626", marginBottom: "12px" }}>
                <AlertCircle size={24} />
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>¿Eliminar esta imagen?</h4>
              </div>
              <p style={{ margin: "0 0 14px 0", fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                Se eliminará el archivo <strong>"{confirmarEliminar.nombre}"</strong> de la galería en la nube de {negocio.toUpperCase()}.
                Los productos que usen este enlace podrían dejar de mostrar la foto.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setConfirmarEliminar(null)}
                  style={{
                    background: "#F1F5F9",
                    border: "1px solid #CBD5E1",
                    color: "#475569",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleEliminar(confirmarEliminar)}
                  style={{
                    background: "#DC2626",
                    border: "none",
                    color: "#FFFFFF",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIE DE PÁGINA CON BOTONES DE ACCIÓN */}
        <div
          style={{
            padding: "12px 20px",
            background: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
            {seleccionado ? (
              <span>
                Seleccionado: <strong style={{ color: "#0F172A" }}>{seleccionado.nombre}</strong> ({formatBytes(seleccionado.tamanioBytes)})
              </span>
            ) : (
              <span>Haz clic en una imagen para seleccionarla</span>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                color: "#475569",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>

            {onSeleccionarImagen && (
              <button
                type="button"
                disabled={!seleccionado}
                onClick={handleConfirmarSeleccion}
                style={{
                  background: seleccionado ? "#0284C7" : "#94A3B8",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  cursor: seleccionado ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: seleccionado ? "0 2px 4px rgba(2, 132, 199, 0.3)" : "none",
                }}
              >
                <CheckCircle2 size={15} />
                <span>Usar Imagen Seleccionada</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
