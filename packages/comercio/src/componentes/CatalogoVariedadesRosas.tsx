"use client";

import React, { useMemo, useState } from "react";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  CheckCircle2,
  Flower2,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  definirVariedadDefectoAction,
  eliminarVariedadRosaAction,
  guardarVariedadRosaAction,
} from "../acciones-operaciones-taller";
import {
  obtenerVariedadDefectoPorColor,
  obtenerVariedadesPorColor,
  type VariedadRosaCatalogo,
} from "../catalogo-variedades-rosas";
import { COLORES_ROSAS_ESTANDAR } from "../operaciones-taller";
import {
  comprimirYEstamparFotoArchivo,
  dataUrlABlob,
  subirArchivoOperativoStorage,
} from "../utils/evidenciaImagenGps";

export interface PropsCatalogoVariedadesRosas {
  negocio: string;
  catalogo: VariedadRosaCatalogo[];
  onCatalogoActualizado: (nuevo: VariedadRosaCatalogo[]) => void;
  migracionPendiente?: boolean;
}

export function CatalogoVariedadesRosas({
  negocio,
  catalogo,
  onCatalogoActualizado,
  migracionPendiente = false,
}: PropsCatalogoVariedadesRosas) {
  const negNorm = negocio.trim().toLowerCase();
  const [colorActivo, setColorActivo] = useState<string>("rojo");
  const [busqueda, setBusqueda] = useState<string>("");
  const [mostrarFormulario, setMostrarFormulario] = useState<boolean>(false);

  const [nuevoColor, setNuevoColor] = useState<string>("rojo");
  const [nuevoNombre, setNuevoNombre] = useState<string>("");
  const [nuevaImagenUrl, setNuevaImagenUrl] = useState<string>("");
  const [nuevoEsDefecto, setNuevoEsDefecto] = useState<boolean>(false);
  const [subiendoImg, setSubiendoImg] = useState<boolean>(false);

  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [guardandoNueva, setGuardandoNueva] = useState<boolean>(false);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const defColorActivo = useMemo(
    () => COLORES_ROSAS_ESTANDAR.find((c) => c.clave === colorActivo) ?? COLORES_ROSAS_ESTANDAR[0]!,
    [colorActivo]
  );

  const variedadesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = q
      ? catalogo.filter((v) => v.nombre.toLowerCase().includes(q))
      : obtenerVariedadesPorColor(catalogo, colorActivo);
    return base;
  }, [catalogo, colorActivo, busqueda]);

  const handleSubirImagenNueva = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendoImg(true);
    setMensajeError(null);
    try {
      const supabase = crearClienteNavegador();
      const comprimida = await comprimirYEstamparFotoArchivo(archivo, 900, 0.85, null);
      const blob = dataUrlABlob(comprimida);
      const subida = await subirArchivoOperativoStorage(
        supabase,
        "inventario-rosas",
        negNorm,
        blob,
        "jpg",
        "image/jpeg"
      );
      if (subida.ok) {
        setNuevaImagenUrl(subida.publicUrl);
      } else {
        setMensajeError(`No se pudo subir la imagen (${subida.error}). Puedes pegar una URL.`);
      }
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : "Error al procesar la imagen");
    } finally {
      setSubiendoImg(false);
    }
  };

  const handleGuardarNueva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) {
      setMensajeError("Escribe el nombre de la variedad.");
      return;
    }
    setGuardandoNueva(true);
    setMensajeError(null);
    setMensajeOk(null);

    const res = await guardarVariedadRosaAction({
      negocio: negNorm,
      colorClave: nuevoColor,
      nombre: nuevoNombre.trim(),
      imagenUrl: nuevaImagenUrl.trim() || undefined,
      esDefecto: nuevoEsDefecto,
    });

    setGuardandoNueva(false);
    if (!res.ok) {
      setMensajeError(res.error);
      return;
    }

    onCatalogoActualizado(res.items);
    setColorActivo(nuevoColor);
    setNuevoNombre("");
    setNuevaImagenUrl("");
    setNuevoEsDefecto(false);
    setMostrarFormulario(false);
    setMensajeOk(`Variedad "${res.item.nombre}" guardada correctamente.`);
  };

  const handleFijarDefecto = async (v: VariedadRosaCatalogo) => {
    setProcesandoId(v.id);
    setMensajeError(null);
    setMensajeOk(null);
    const res = await definirVariedadDefectoAction({
      negocio: negNorm,
      colorClave: v.colorClave,
      variedadId: v.id,
    });
    setProcesandoId(null);
    if (!res.ok) {
      setMensajeError(res.error);
      return;
    }
    onCatalogoActualizado(res.items);
    const colLabel =
      COLORES_ROSAS_ESTANDAR.find((c) => c.clave === v.colorClave)?.etiqueta ?? v.colorClave;
    setMensajeOk(`"${v.nombre}" fijada como variedad por defecto para ${colLabel}.`);
  };

  const handleEliminar = async (v: VariedadRosaCatalogo) => {
    if (!window.confirm(`¿Eliminar la variedad "${v.nombre}" del catálogo?`)) return;
    setProcesandoId(v.id);
    setMensajeError(null);
    setMensajeOk(null);
    const res = await eliminarVariedadRosaAction({
      negocio: negNorm,
      variedadId: v.id,
    });
    setProcesandoId(null);
    if (!res.ok) {
      setMensajeError(res.error);
      return;
    }
    onCatalogoActualizado(res.items);
    setMensajeOk(`Variedad "${v.nombre}" eliminada.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Cabecera del catálogo */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
              Catálogo Maestro de Variedades de Rosas ({catalogo.length})
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748B" }}>
              Configura la variedad por defecto de cada color (★). Cuando ARIA detecte un color sin
              variedad específica, asignará automáticamente su variedad por defecto.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNuevoColor(colorActivo);
              setMostrarFormulario((prev) => !prev);
              setMensajeError(null);
            }}
            title="Agregar nueva variedad de rosa"
            aria-label="Nueva variedad"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 14px",
              borderRadius: "10px",
              border: "none",
              background: "#0F172A",
              color: "#FFFFFF",
              fontSize: "0.83rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {mostrarFormulario ? <X size={15} /> : <Plus size={15} />}
            <span>{mostrarFormulario ? "Cerrar" : "Nueva Variedad"}</span>
          </button>
        </div>

        {migracionPendiente && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              color: "#92400E",
              fontSize: "0.8rem",
            }}
          >
            Mostrando catálogo base Floraroma. Ejecuta la migración{" "}
            <code>20261119000005_catalogo_variedades_rosas_floraroma.sql</code> en Supabase para
            guardar nuevas variedades o cambiar las variedades por defecto.
          </div>
        )}

        {mensajeError && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "0.82rem",
            }}
          >
            {mensajeError}
          </div>
        )}

        {mensajeOk && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#ECFDF5",
              border: "1px solid #A7F3D0",
              color: "#065F46",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <CheckCircle2 size={15} />
            <span>{mensajeOk}</span>
          </div>
        )}

        {/* Formulario Nueva Variedad */}
        {mostrarFormulario && (
          <form
            onSubmit={(e) => void handleGuardarNueva(e)}
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
              Color
              <select
                value={nuevoColor}
                onChange={(e) => setNuevoColor(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "0.84rem",
                }}
              >
                {COLORES_ROSAS_ESTANDAR.map((c) => (
                  <option key={c.clave} value={c.clave}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
              Nombre de Variedad
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej. Heart O'Hara, Vendela..."
                required
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  fontSize: "0.84rem",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
              URL Imagen o Subir Foto
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="url"
                  value={nuevaImagenUrl}
                  onChange={(e) => setNuevaImagenUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    fontSize: "0.82rem",
                  }}
                />
                <label
                  title="Subir foto de la variedad"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    cursor: subiendoImg ? "wait" : "pointer",
                    color: "#0F172A",
                  }}
                >
                  {subiendoImg ? <Loader2 size={15} /> : <Upload size={15} />}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleSubirImagenNueva(e)}
                    disabled={subiendoImg}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.8rem",
                  color: "#0F172A",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={nuevoEsDefecto}
                  onChange={(e) => setNuevoEsDefecto(e.target.checked)}
                />
                Variedad por defecto
              </label>

              <button
                type="submit"
                disabled={guardandoNueva}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "0.83rem",
                  fontWeight: 700,
                  cursor: guardandoNueva ? "wait" : "pointer",
                }}
              >
                {guardandoNueva ? <Loader2 size={14} /> : <Plus size={14} />}
                <span>Guardar Variedad</span>
              </button>
            </div>
          </form>
        )}

        {/* Selector de los 11 colores + buscador */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {COLORES_ROSAS_ESTANDAR.map((col) => {
              const cant = catalogo.filter((v) => v.colorClave === col.clave).length;
              const def = obtenerVariedadDefectoPorColor(catalogo, col.clave);
              const activo = !busqueda.trim() && colorActivo === col.clave;
              return (
                <button
                  key={col.clave}
                  type="button"
                  onClick={() => {
                    setBusqueda("");
                    setColorActivo(col.clave);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "7px 11px",
                    borderRadius: "10px",
                    border: activo ? "2px solid #0F172A" : "1px solid #E2E8F0",
                    background: activo ? "#0F172A" : "#FFFFFF",
                    color: activo ? "#FFFFFF" : "#1E293B",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: col.colorHex,
                      border: "1px solid rgba(0,0,0,0.2)",
                      flexShrink: 0,
                    }}
                  />
                  <span>{col.etiqueta}</span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      opacity: 0.78,
                      fontWeight: 500,
                    }}
                  >
                    ({cant})
                  </span>
                  {def && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        background: activo ? "rgba(255,255,255,0.16)" : "#FEF3C7",
                        color: activo ? "#FDE68A" : "#92400E",
                        fontWeight: 700,
                      }}
                    >
                      ★ {def.nombre}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              maxWidth: "360px",
            }}
          >
            <Search size={15} color="#64748B" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en todas las variedades..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: "0.84rem",
                width: "100%",
                color: "#0F172A",
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#64748B",
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Título de categoría activa */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #F1F5F9",
            paddingTop: "12px",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0F172A", letterSpacing: "0.02em" }}>
            {busqueda.trim()
              ? `Resultados para "${busqueda.trim()}" (${variedadesFiltradas.length})`
              : `${defColorActivo.etiqueta.toUpperCase()} (${variedadesFiltradas.length} variedades)`}
          </div>
        </div>

        {/* Grilla visual estilo Floraroma */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))",
            gap: "12px",
          }}
        >
          {variedadesFiltradas.map((v) => {
            const ocupada = procesandoId === v.id;
            const colInfo = COLORES_ROSAS_ESTANDAR.find((c) => c.clave === v.colorClave);
            return (
              <div
                key={v.id}
                style={{
                  borderRadius: "14px",
                  border: v.esDefecto ? "2px solid #F59E0B" : "1px solid #E2E8F0",
                  background: "#FFFFFF",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: v.esDefecto
                    ? "0 6px 16px rgba(245, 158, 11, 0.14)"
                    : "0 2px 6px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    background: "#0B0F19",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {v.imagenUrl ? (
                    <img
                      src={v.imagenUrl}
                      alt={v.nombre}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Flower2 size={36} color="#64748B" />
                  )}

                  {v.esDefecto && (
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "999px",
                        background: "#F59E0B",
                        color: "#FFFFFF",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                      }}
                    >
                      <Star size={11} fill="#FFFFFF" />
                      Defecto
                    </span>
                  )}

                  {busqueda.trim() && colInfo && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: "8px",
                        padding: "2px 7px",
                        borderRadius: "999px",
                        background: "rgba(15, 23, 42, 0.8)",
                        color: "#FFFFFF",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                      }}
                    >
                      {colInfo.etiqueta}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    flex: 1,
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      color: "#0F172A",
                      lineHeight: 1.25,
                    }}
                  >
                    {v.nombre}
                  </div>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {!v.esDefecto ? (
                      <button
                        type="button"
                        disabled={ocupada}
                        onClick={() => void handleFijarDefecto(v)}
                        title={`Establecer ${v.nombre} como variedad por defecto`}
                        aria-label={`Fijar ${v.nombre} por defecto`}
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "5px 8px",
                          borderRadius: "8px",
                          border: "1px solid #FDE68A",
                          background: "#FFFBEB",
                          color: "#92400E",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: ocupada ? "wait" : "pointer",
                        }}
                      >
                        {ocupada ? <Loader2 size={12} /> : <Star size={12} />}
                        <span>Por defecto</span>
                      </button>
                    ) : (
                      <span
                        style={{
                          flex: 1,
                          fontSize: "0.72rem",
                          color: "#B45309",
                          fontWeight: 700,
                        }}
                      >
                        ★ Activa por defecto
                      </span>
                    )}

                    <button
                      type="button"
                      disabled={ocupada}
                      onClick={() => void handleEliminar(v)}
                      title={`Eliminar ${v.nombre}`}
                      aria-label={`Eliminar ${v.nombre}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "5px 7px",
                        borderRadius: "8px",
                        border: "1px solid #FECACA",
                        background: "#FEF2F2",
                        color: "#B91C1C",
                        cursor: ocupada ? "wait" : "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
