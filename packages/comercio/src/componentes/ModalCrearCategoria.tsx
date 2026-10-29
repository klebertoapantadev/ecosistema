"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FolderPlus,
  Flower2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  Settings2,
  Lock,
  Search,
  RefreshCw,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import {
  crearCategoriaAction,
  eliminarCategoriaAction,
  obtenerCategoriasConUsoAction,
  CategoriaCatalogo,
} from "../acciones";
import { detectarTipoNegocio } from "../utils/negocio";

type CategoriaConUso = CategoriaCatalogo & {
  productos_conteo: number;
  en_uso: boolean;
  productos_ejemplo?: string[];
};

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCategoriaCreada: (cat: CategoriaCatalogo) => void;
  onCategoriaEliminada?: (categoriaId: string) => void;
  negocio?: string;
  tabInicial?: "crear" | "gestionar";
}

export function ModalCrearCategoria({
  abierto,
  onCerrar,
  onCategoriaCreada,
  onCategoriaEliminada,
  negocio = "tranqi",
  tabInicial = "crear",
}: Props) {
  const { esFloristeria } = detectarTipoNegocio(negocio);

  const [tabActiva, setTabActiva] = useState<"crear" | "gestionar">(tabInicial);

  // Estados Formulario Crear
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState(esFloristeria ? "COLECCION" : "FORMATO");
  const [orden, setOrden] = useState(1);
  const [imagenUrl, setImagenUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  // Estados Tab Gestionar / Eliminar
  const [categoriasUso, setCategoriasUso] = useState<CategoriaConUso[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [catAEliminar, setCatAEliminar] = useState<CategoriaConUso | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorEliminarModal, setErrorEliminarModal] = useState<string | null>(null);
  const [mensajeErrorGestion, setMensajeErrorGestion] = useState<string | null>(null);
  const [mensajeExitoGestion, setMensajeExitoGestion] = useState<string | null>(null);

  // Sincronizar tab inicial cuando se abre el modal
  useEffect(() => {
    if (abierto) {
      setTabActiva(tabInicial);
      setErrorCrear(null);
      setErrorEliminarModal(null);
      setMensajeErrorGestion(null);
      setMensajeExitoGestion(null);
      setCatAEliminar(null);
      cargarCategoriasConUso();
    }
  }, [abierto, tabInicial, negocio]);

  const cargarCategoriasConUso = async () => {
    setCargandoLista(true);
    try {
      const datos = await obtenerCategoriasConUsoAction(negocio);
      let filtrados = datos;
      if (typeof window !== "undefined") {
        try {
          const keyStorage = `eco_cats_eliminadas_${negocio}`;
          const guardadas: string[] = JSON.parse(localStorage.getItem(keyStorage) || "[]");
          if (guardadas.length > 0) {
            const setElim = new Set(guardadas);
            filtrados = datos.filter((c) => !setElim.has(c.ctg_id) && !setElim.has(c.ctg_slug));
          }
        } catch {}
      }
      setCategoriasUso(filtrados);
    } catch (err: any) {
      setMensajeErrorGestion(err?.message || "No se pudo cargar la lista de categorías.");
    } finally {
      setCargandoLista(false);
    }
  };

  if (!abierto) return null;

  const handleNombreChange = (val: string) => {
    setNombre(val);
    const s = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(s);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCrear(null);
    if (!nombre.trim()) {
      setErrorCrear(esFloristeria ? "Ingresa el nombre de la colección floral." : "Ingresa el nombre de la categoría.");
      return;
    }

    setGuardando(true);
    try {
      const res = await crearCategoriaAction({
        nombre: nombre.trim(),
        slug: slug.trim(),
        descripcion: descripcion.trim(),
        tipo,
        orden: Number(orden) || 1,
        imagenUrl: imagenUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        negocio,
      });

      if (res.ok && res.categoria) {
        onCategoriaCreada(res.categoria);
        setNombre("");
        setSlug("");
        setDescripcion("");
        setImagenUrl("");
        setVideoUrl("");
        setAlbumFotosUrl("");
        onCerrar();
      } else {
        setErrorCrear(res.error || "No se pudo crear la categoría.");
      }
    } catch (err: any) {
      setErrorCrear(err.message || "Error al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarEliminar = async () => {
    if (!catAEliminar) return;

    const idEliminar = catAEliminar.ctg_id;
    const slugEliminar = catAEliminar.ctg_slug;
    const nombreEliminar = catAEliminar.ctg_nombre;

    setEliminandoId(idEliminar);
    setErrorEliminarModal(null);
    setMensajeErrorGestion(null);
    setMensajeExitoGestion(null);

    try {
      const res = await eliminarCategoriaAction({
        categoriaId: idEliminar,
        slug: slugEliminar,
        negocio,
      });

      // Si fue exitosa o si la base de datos reporta que ya no existe
      const yaNoExiste = res.error?.includes("no existe") || res.error?.includes("ya ha sido eliminada");

      if (res.ok || yaNoExiste) {
        setMensajeExitoGestion(res.mensaje || `Categoría "${nombreEliminar}" eliminada correctamente.`);
        // Actualizar lista local de forma reactiva
        setCategoriasUso((prev) => prev.filter((c) => c.ctg_id !== idEliminar && c.ctg_slug !== slugEliminar));
        
        // Persistir en localStorage
        if (typeof window !== "undefined") {
          try {
            const keyStorage = `eco_cats_eliminadas_${negocio}`;
            const guardadas: string[] = JSON.parse(localStorage.getItem(keyStorage) || "[]");
            guardadas.push(idEliminar, slugEliminar);
            localStorage.setItem(keyStorage, JSON.stringify(Array.from(new Set(guardadas))));
          } catch {}
        }

        if (onCategoriaEliminada) {
          onCategoriaEliminada(idEliminar);
        }
        setCatAEliminar(null);
        setErrorEliminarModal(null);
      } else {
        setErrorEliminarModal(res.error || "No se pudo eliminar la categoría.");
        setMensajeErrorGestion(res.error || "No se pudo eliminar la categoría.");
      }
    } catch (err: any) {
      const msg = err?.message || "Error al ejecutar la eliminación.";
      setErrorEliminarModal(msg);
      setMensajeErrorGestion(msg);
    } finally {
      setEliminandoId(null);
    }
  };

  const categoriasFiltradas = categoriasUso.filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    return (
      c.ctg_nombre.toLowerCase().includes(q) ||
      c.ctg_slug.toLowerCase().includes(q) ||
      (c.ctg_descripcion && c.ctg_descripcion.toLowerCase().includes(q))
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: tabActiva === "gestionar" ? "680px" : "540px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          transition: "max-width 0.2s ease",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: esFloristeria ? "#FFFDF8" : "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: esFloristeria ? "#FEF2F2" : "#E0F2FE",
                color: esFloristeria ? "#E11D48" : "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {esFloristeria ? <Flower2 size={20} /> : <FolderPlus size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
                {esFloristeria ? "Colecciones & Ocasiones Florales" : "Categorías Comerciales"}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                {tabActiva === "crear"
                  ? "Crea una nueva clasificación para el catálogo"
                  : "Administra y elimina categorías sin productos activos"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748B",
              padding: "6px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Pestañas de Navegación */}
        <div
          style={{
            display: "flex",
            background: "#F1F5F9",
            padding: "4px 8px",
            borderBottom: "1px solid #E2E8F0",
            gap: "6px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTabActiva("crear");
              setMensajeErrorGestion(null);
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: tabActiva === "crear" ? "#FFFFFF" : "transparent",
              color: tabActiva === "crear" ? (esFloristeria ? "#E11D48" : "#0284C7") : "#64748B",
              boxShadow: tabActiva === "crear" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <FolderPlus size={15} />
            <span>+ {esFloristeria ? "Nueva Colección" : "Nueva Categoría"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTabActiva("gestionar");
              setErrorCrear(null);
              cargarCategoriasConUso();
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: tabActiva === "gestionar" ? "#FFFFFF" : "transparent",
              color: tabActiva === "gestionar" ? "#0F172A" : "#64748B",
              boxShadow: tabActiva === "gestionar" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            <Settings2 size={15} />
            <span>Administrar ({categoriasUso.length})</span>
          </button>
        </div>

        {/* Contenido según pestaña */}
        <div style={{ overflowY: "auto", flex: 1, padding: "18px 22px" }}>
          {tabActiva === "crear" ? (
            /* TAB 1: FORMULARIO CREAR CATEGORÍA */
            <form onSubmit={handleGuardar}>
              {errorCrear && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    color: "#991B1B",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{errorCrear}</span>
                </div>
              )}

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Nombre de la {esFloristeria ? "Colección" : "Categoría"} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={esFloristeria ? "Ej. Bouquets Estilo Coreano o Ramos para Florero" : "Ej. Trámites Notariales"}
                  value={nombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
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

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Identificador Slug
                  </label>
                  <input
                    type="text"
                    placeholder="ej. cat-coreanos"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Posición / Orden
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={orden}
                    onChange={(e) => setOrden(parseInt(e.target.value) || 1)}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Recursos Digitales */}
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <ImageIcon size={14} color="#15803D" />
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#15803D", textTransform: "uppercase" }}>
                    Recursos Digitales de la Colección
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#334155", marginBottom: "2px" }}>
                      URL Portada / Banner
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={imagenUrl}
                      onChange={(e) => setImagenUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.75rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#334155", marginBottom: "2px" }}>
                      URL Video Reel / Spot
                    </label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/shorts/..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.75rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#334155", marginBottom: "2px" }}>
                    URL Álbum de Fotos / Galería
                  </label>
                  <input
                    type="url"
                    placeholder="https://photos.app.goo.gl/..."
                    value={albumFotosUrl}
                    onChange={(e) => setAlbumFotosUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.75rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Descripción / Alcance
                </label>
                <textarea
                  rows={2}
                  placeholder={esFloristeria ? "Arreglos florales envueltos en papel coreano..." : "Breve resumen..."}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={onCerrar}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    background: esFloristeria ? "#E11D48" : "#0284C7",
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
                  <CheckCircle2 size={15} />
                  <span>{guardando ? "Creando..." : esFloristeria ? "Crear Colección" : "Crear Categoría"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: ADMINISTRAR Y ELIMINAR CATEGORÍAS */
            <div>
              {/* Notificaciones de Éxito / Error */}
              {mensajeExitoGestion && (
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #86EFAC",
                    color: "#166534",
                    padding: "9px 14px",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{mensajeExitoGestion}</span>
                </div>
              )}

              {mensajeErrorGestion && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    color: "#991B1B",
                    padding: "9px 14px",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>{mensajeErrorGestion}</span>
                </div>
              )}

              {/* Banner Informativo de Regla de Negocio */}
              <div
                style={{
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                }}
              >
                <Info size={16} color="#1D4ED8" style={{ marginTop: "2px", flexShrink: 0 }} />
                <span style={{ fontSize: "0.76rem", color: "#1E40AF", lineHeight: 1.4 }}>
                  <strong>Control de Integridad:</strong> Solo es posible eliminar categorías que{" "}
                  <strong>no tengan productos asignados</strong>. Si una categoría está en uso, el botón estará bloqueado
                  para proteger la consistencia del catálogo comercial.
                </span>
              </div>

              {/* Buscador y Refrescar */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search
                    size={14}
                    style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
                  />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o slug..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 10px 7px 32px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={cargarCategoriasConUso}
                  disabled={cargandoLista}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "7px 12px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                  title="Actualizar estado de uso"
                >
                  <RefreshCw size={13} className={cargandoLista ? "animate-spin" : ""} />
                  <span>Refrescar</span>
                </button>
              </div>

              {/* Lista de Categorías */}
              {cargandoLista ? (
                <div style={{ padding: "28px", textAlign: "center", color: "#64748B", fontSize: "0.82rem" }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <span>Verificando categorías y uso de productos...</span>
                </div>
              ) : categoriasFiltradas.length === 0 ? (
                <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", fontSize: "0.82rem" }}>
                  No se encontraron categorías coincidentes.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {categoriasFiltradas.map((cat) => {
                    const enUso = cat.en_uso || cat.productos_conteo > 0;
                    return (
                      <div
                        key={cat.ctg_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0",
                          background: enUso ? "#FAFAFA" : "#FFFFFF",
                          gap: "12px",
                        }}
                      >
                        {/* Datos de la Categoría */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1E293B" }}>
                              {cat.ctg_nombre}
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "#F1F5F9",
                                color: "#64748B",
                                fontFamily: "monospace",
                              }}
                            >
                              {cat.ctg_slug}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                            {enUso ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  color: "#0369A1",
                                  background: "#E0F2FE",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                }}
                                title={cat.productos_ejemplo?.length ? `En uso por: ${cat.productos_ejemplo.join(", ")}` : undefined}
                              >
                                <Lock size={11} />
                                <span>
                                  En uso ({cat.productos_conteo} {cat.productos_conteo === 1 ? (esFloristeria ? "arreglo" : "producto") : (esFloristeria ? "arreglos" : "productos")})
                                </span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  color: "#15803D",
                                  background: "#DCFCE7",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                }}
                              >
                                <CheckCircle2 size={11} />
                                <span>Sin productos (Disponible para eliminar)</span>
                              </span>
                            )}

                            {cat.ctg_descripcion && (
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  color: "#64748B",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: "220px",
                                }}
                                title={cat.ctg_descripcion}
                              >
                                {cat.ctg_descripcion}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botón de Acción Eliminar / Bloqueado */}
                        <div>
                          {enUso ? (
                            <button
                              type="button"
                              disabled
                              title={`No se puede eliminar: tiene ${cat.productos_conteo} producto(s) asignados${cat.productos_ejemplo?.length ? ` (ej. ${cat.productos_ejemplo.join(", ")})` : ""}.`}
                              style={{
                                background: "#F1F5F9",
                                border: "1px solid #E2E8F0",
                                color: "#94A3B8",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                cursor: "not-allowed",
                              }}
                            >
                              <Lock size={12} />
                              <span>En uso</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(eliminandoId)}
                              onClick={() => {
                                setErrorEliminarModal(null);
                                setCatAEliminar(cat);
                              }}
                              style={{
                                background: eliminandoId === cat.ctg_id ? "#FFE4E6" : "#FFF1F2",
                                border: "1px solid #FECDD3",
                                color: "#E11D48",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                cursor: eliminandoId === cat.ctg_id ? "wait" : "pointer",
                                transition: "all 0.15s ease",
                              }}
                              title="Eliminar esta categoría que no tiene productos asignados"
                            >
                              {eliminandoId === cat.ctg_id ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Eliminando...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 size={13} />
                                  <span>Eliminar</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={onCerrar}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Diálogo Flotante de Confirmación de Eliminación (Centrado en Pantalla) */}
      {catAEliminar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10050,
            padding: "16px",
            animation: "fadeIn 0.15s ease",
          }}
          onClick={() => {
            if (!eliminandoId) {
              setCatAEliminar(null);
              setErrorEliminarModal(null);
            }
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #FECDD3",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#FFE4E6",
                  color: "#E11D48",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
                  ¿Eliminar esta categoría?
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748B", lineHeight: 1.4 }}>
                  Vas a retirar del catálogo la categoría:
                </p>
                <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#E11D48" }}>
                    {catAEliminar.ctg_nombre}
                  </span>
                  <code style={{ fontSize: "0.72rem", background: "#F1F5F9", color: "#475569", padding: "2px 6px", borderRadius: "4px" }}>
                    {catAEliminar.ctg_slug}
                  </code>
                </div>
              </div>
            </div>

            {errorEliminarModal ? (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  fontSize: "0.8rem",
                  color: "#991B1B",
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#DC2626" }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ display: "block", marginBottom: "3px", color: "#B91C1C" }}>
                    No se puede eliminar en este momento:
                  </strong>
                  <span>{errorEliminarModal}</span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#FFF1F2",
                  border: "1px solid #FECDD3",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.78rem",
                  color: "#9F1239",
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  Esta acción retirará la categoría de la vitrina, filtros y catálogo. No se puede revertir.
                </span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={Boolean(eliminandoId)}
                onClick={() => {
                  setCatAEliminar(null);
                  setErrorEliminarModal(null);
                }}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(eliminandoId)}
                onClick={handleConfirmarEliminar}
                style={{
                  background: "#E11D48",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: eliminandoId ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(225, 29, 72, 0.35)",
                }}
              >
                {eliminandoId ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Sí, Eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
