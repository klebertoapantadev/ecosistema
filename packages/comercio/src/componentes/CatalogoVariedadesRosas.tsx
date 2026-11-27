"use client";

import React, { useMemo, useState } from "react";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  CheckCircle2,
  CheckSquare,
  Edit3,
  Flower2,
  Loader2,
  Plus,
  Search,
  Square,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  actualizarCategoriaColorRosaAction,
  definirVariedadDefectoAction,
  eliminarVariedadRosaAction,
  eliminarVariedadesRosaLoteAction,
  guardarVariedadRosaAction,
} from "../acciones-operaciones-taller";
import {
  obtenerVariedadDefectoPorColor,
  obtenerVariedadesPorColor,
  type VariedadRosaCatalogo,
} from "../catalogo-variedades-rosas";
import { COLORES_ROSAS_ESTANDAR, type DefinicionColorRosa } from "../operaciones-taller";
import {
  comprimirYEstamparFotoArchivo,
  dataUrlABlob,
  subirArchivoOperativoStorage,
} from "../utils/evidenciaImagenGps";

export interface PropsCatalogoVariedadesRosas {
  negocio: string;
  catalogo: VariedadRosaCatalogo[];
  onCatalogoActualizado: (nuevo: VariedadRosaCatalogo[]) => void;
  categoriasColores?: DefinicionColorRosa[];
  onCategoriasActualizadas?: (nuevas: DefinicionColorRosa[]) => void;
  migracionPendiente?: boolean;
}

export function CatalogoVariedadesRosas({
  negocio,
  catalogo,
  onCatalogoActualizado,
  categoriasColores = COLORES_ROSAS_ESTANDAR,
  onCategoriasActualizadas,
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

  // Edición de categoría de color (ej. Rosa Intenso -> Fucsia)
  const [editandoCategoria, setEditandoCategoria] = useState<boolean>(false);
  const [nombreCategoriaEdit, setNombreCategoriaEdit] = useState<string>("");
  const [colorHexCategoriaEdit, setColorHexCategoriaEdit] = useState<string>("#221E1B");
  const [guardandoCategoria, setGuardandoCategoria] = useState<boolean>(false);

  // Multiselección para eliminar variedades
  const [modoSeleccion, setModoSeleccion] = useState<boolean>(false);
  const [seleccionadosIds, setSeleccionadosIds] = useState<Set<string>>(new Set());
  const [eliminandoLote, setEliminandoLote] = useState<boolean>(false);

  const defColorActivo = useMemo(
    () => categoriasColores.find((c) => c.clave === colorActivo) ?? categoriasColores[0]!,
    [categoriasColores, colorActivo]
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
      categoriasColores.find((c) => c.clave === v.colorClave)?.etiqueta ?? v.colorClave;
    setMensajeOk(`"${v.nombre}" fijada como variedad por defecto para ${colLabel}.`);
  };

  const handleGuardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCategoriaEdit.trim()) {
      setMensajeError("Escribe el nombre de la categoría.");
      return;
    }
    setGuardandoCategoria(true);
    setMensajeError(null);
    setMensajeOk(null);
    const res = await actualizarCategoriaColorRosaAction({
      negocio: negNorm,
      clave: defColorActivo.clave,
      etiqueta: nombreCategoriaEdit.trim(),
      colorHex: colorHexCategoriaEdit,
    });
    setGuardandoCategoria(false);
    if (!res.ok) {
      setMensajeError(res.error);
      return;
    }
    onCategoriasActualizadas?.(res.categoriasColores);
    setEditandoCategoria(false);
    setMensajeOk(`Categoría renombrada a "${nombreCategoriaEdit.trim()}".`);
  };

  const toggleSeleccionVariedad = (id: string) => {
    setSeleccionadosIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEliminarLote = async () => {
    if (seleccionadosIds.size === 0) return;
    if (
      !window.confirm(
        `¿Eliminar las ${seleccionadosIds.size} variedades seleccionadas del catálogo?`
      )
    ) {
      return;
    }
    setEliminandoLote(true);
    setMensajeError(null);
    setMensajeOk(null);
    const res = await eliminarVariedadesRosaLoteAction({
      negocio: negNorm,
      variedadIds: Array.from(seleccionadosIds),
    });
    setEliminandoLote(false);
    if (!res.ok) {
      setMensajeError(res.error);
      return;
    }
    onCatalogoActualizado(res.items);
    setSeleccionadosIds(new Set());
    setModoSeleccion(false);
    setMensajeOk(`Se eliminaron ${res.eliminadas} variedades del catálogo.`);
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
          background: "var(--cf-ffffff, #FFFFFF)",
          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
          borderRadius: "12px",
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Catálogo Maestro de Variedades de Rosas ({catalogo.length})
            </h2>
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
              padding: "7px 13px",
              borderRadius: "8px",
              border: "1px solid var(--cb-221e1b, #221E1B)",
              background: "#221E1B",
              color: "#FAF8F5",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {mostrarFormulario ? <X size={14} /> : <Plus size={14} />}
            <span>{mostrarFormulario ? "Cerrar" : "Nueva Variedad"}</span>
          </button>
        </div>

        {migracionPendiente && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "9px",
              background: "var(--cf-faf6ee, #FAF6EE)",
              border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
              color: "var(--ct-745622, #745622)",
              fontSize: "0.78rem",
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
              padding: "9px 12px",
              borderRadius: "9px",
              background: "var(--cf-faf2f2, #FAF2F2)",
              border: "1px solid var(--cb-e5caca, #E5CACA)",
              color: "var(--ct-8a2e2e, #8A2E2E)",
              fontSize: "0.79rem",
            }}
          >
            {mensajeError}
          </div>
        )}

        {mensajeOk && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "9px",
              background: "var(--cf-f2f6f3, #F2F6F3)",
              border: "1px solid var(--cb-ceddd3, #CEDDD3)",
              color: "var(--ct-2b4a36, #2B4A36)",
              fontSize: "0.79rem",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <CheckCircle2 size={14} />
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
              background: "var(--cf-f8f7f4, #F8F7F4)",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)" }}>
              Color
              <select
                value={nuevoColor}
                onChange={(e) => setNuevoColor(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  fontSize: "0.84rem",
                }}
              >
                {categoriasColores.map((c) => (
                  <option key={c.clave} value={c.clave}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)" }}>
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
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  fontSize: "0.84rem",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", fontWeight: 600, color: "var(--ct-57524c, #57524C)" }}>
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
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
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
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    cursor: subiendoImg ? "wait" : "pointer",
                    color: "var(--ct-1f1c19, #1F1C19)",
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
                  color: "var(--ct-1f1c19, #1F1C19)",
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
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 600,
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
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {categoriasColores.map((col) => {
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
                    gap: "6px",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: activo ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                    background: activo ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                    color: activo ? "#FAF8F5" : "var(--ct-2e2a26, #2E2A26)",
                    fontSize: "0.77rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: col.colorHex,
                      border: "1px solid var(--cb-000000-a180, rgba(0,0,0,0.18))",
                      flexShrink: 0,
                    }}
                  />
                  <span>{col.etiqueta}</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      opacity: 0.72,
                      fontWeight: 500,
                    }}
                  >
                    ({cant})
                  </span>
                  {def && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        background: activo ? "rgba(255,255,255,0.14)" : "var(--cf-f8f7f4, #F8F7F4)",
                        border: activo ? "none" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                        color: activo ? "#E8D5AE" : "var(--ct-6e6861, #6E6861)",
                        fontWeight: 600,
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
              padding: "7px 11px",
              borderRadius: "8px",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: "var(--cf-f8f7f4, #F8F7F4)",
              maxWidth: "340px",
            }}
          >
            <Search size={14} color="#847D74" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en todas las variedades..."
              aria-label="Buscar variedades de rosas"
              style={{
                border: "none",
                background: "transparent",
                fontSize: "0.8rem",
                width: "100%",
                color: "var(--ct-1f1c19, #1F1C19)",
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--ct-847d74, #847D74)",
                  padding: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Título de categoría activa + edición de categoría + multiselección */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
            borderTop: "1px solid var(--cb-efece6, #EFECE6)",
            paddingTop: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--ct-1f1c19, #1F1C19)", letterSpacing: "0.02em" }}>
              {busqueda.trim()
                ? `Resultados para "${busqueda.trim()}" (${variedadesFiltradas.length})`
                : `${defColorActivo.etiqueta.toUpperCase()} (${variedadesFiltradas.length} variedades)`}
            </div>
            {!busqueda.trim() && (
              <button
                type="button"
                onClick={() => {
                  setNombreCategoriaEdit(defColorActivo.etiqueta);
                  setColorHexCategoriaEdit(defColorActivo.colorHex);
                  setEditandoCategoria((prev) => !prev);
                }}
                title="Renombrar esta categoría de flor"
                aria-label="Renombrar categoría"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "7px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-f8f7f4, #F8F7F4)",
                  color: "var(--ct-57524c, #57524C)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Edit3 size={11} />
                <span>Renombrar</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setModoSeleccion((prev) => !prev);
                if (modoSeleccion) setSeleccionadosIds(new Set());
              }}
              title="Activar multiselección para eliminar varias variedades"
              aria-label="Seleccionar múltiples"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 10px",
                borderRadius: "7px",
                border: modoSeleccion ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: modoSeleccion ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                color: modoSeleccion ? "#FAF8F5" : "var(--ct-57524c, #57524C)",
                fontSize: "0.73rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <CheckSquare size={12} />
              <span>{modoSeleccion ? "Cancelar selección" : "Seleccionar"}</span>
            </button>

            {(modoSeleccion || seleccionadosIds.size > 0) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (seleccionadosIds.size === variedadesFiltradas.length) {
                      setSeleccionadosIds(new Set());
                    } else {
                      setSeleccionadosIds(new Set(variedadesFiltradas.map((x) => x.id)));
                    }
                  }}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    color: "var(--ct-1f1c19, #1F1C19)",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {seleccionadosIds.size === variedadesFiltradas.length
                    ? "Deseleccionar"
                    : `Todas (${variedadesFiltradas.length})`}
                </button>

                {seleccionadosIds.size > 0 && (
                  <button
                    type="button"
                    disabled={eliminandoLote}
                    onClick={() => void handleEliminarLote()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "none",
                      background: "#8A2E2E",
                      color: "#FFFFFF",
                      fontSize: "0.73rem",
                      fontWeight: 600,
                      cursor: eliminandoLote ? "wait" : "pointer",
                    }}
                  >
                    {eliminandoLote ? <Loader2 size={12} /> : <Trash2 size={12} />}
                    <span>Eliminar ({seleccionadosIds.size})</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {editandoCategoria && !busqueda.trim() && (
          <form
            onSubmit={(e) => void handleGuardarCategoria(e)}
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "var(--cf-f8f7f4, #F8F7F4)",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "end",
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "var(--ct-57524c, #57524C)",
                flex: "1 1 190px",
              }}
            >
              Nombre de categoría
              <input
                type="text"
                value={nombreCategoriaEdit}
                onChange={(e) => setNombreCategoriaEdit(e.target.value)}
                placeholder="Ej. Fucsia"
                style={{
                  padding: "7px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                  background: "var(--cf-ffffff, #FFFFFF)",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "0.76rem",
                fontWeight: 700,
                color: "var(--ct-57524c, #57524C)",
              }}
            >
              Color
              <input
                type="color"
                value={colorHexCategoriaEdit}
                onChange={(e) => setColorHexCategoriaEdit(e.target.value)}
                style={{
                  width: "44px",
                  height: "34px",
                  borderRadius: "6px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  padding: "2px",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  cursor: "pointer",
                }}
              />
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={() => setEditandoCategoria(false)}
                style={{
                  padding: "7px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoCategoria}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.77rem",
                  fontWeight: 600,
                  cursor: guardandoCategoria ? "wait" : "pointer",
                }}
              >
                {guardandoCategoria ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {/* Grilla visual estilo Floraroma */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(150px, 100%), 1fr))",
            gap: "11px",
          }}
        >
          {variedadesFiltradas.map((v) => {
            const ocupada = procesandoId === v.id;
            const seleccionada = seleccionadosIds.has(v.id);
            const colInfo = categoriasColores.find((c) => c.clave === v.colorClave);
            return (
              <div
                key={v.id}
                onClick={modoSeleccion ? () => toggleSeleccionVariedad(v.id) : undefined}
                style={{
                  borderRadius: "10px",
                  border: seleccionada
                    ? "1.5px solid #8A2E2E"
                    : v.esDefecto
                      ? "1.5px solid var(--cb-b8923f, #B8923F)"
                      : "1px solid var(--cb-e6e2da, #E6E2DA)",
                  background: seleccionada ? "var(--cf-faf2f2, #FAF2F2)" : "var(--cf-ffffff, #FFFFFF)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: modoSeleccion ? "pointer" : "default",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    background: "#1A1715",
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
                    <Flower2 size={32} color="#847D74" />
                  )}

                  {v.esDefecto && (
                    <span
                      style={{
                        position: "absolute",
                        top: "7px",
                        left: "7px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2.5px 7px",
                        borderRadius: "999px",
                        background: "rgba(31, 28, 25, 0.85)",
                        border: "1px solid var(--cb-c8a25a-a550, rgba(200, 162, 90, 0.55))",
                        color: "#E8D5AE",
                        fontSize: "0.66rem",
                        fontWeight: 600,
                      }}
                    >
                      <Star size={10} fill="#E8D5AE" />
                      Defecto
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSeleccionVariedad(v.id);
                    }}
                    title={seleccionada ? "Quitar de selección" : "Seleccionar variedad"}
                    aria-label={seleccionada ? `Deseleccionar ${v.nombre}` : `Seleccionar ${v.nombre}`}
                    style={{
                      position: "absolute",
                      top: "7px",
                      right: "7px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      borderRadius: "6px",
                      border: "none",
                      background: seleccionada ? "#8A2E2E" : "rgba(31, 28, 25, 0.72)",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    {seleccionada ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>

                  {busqueda.trim() && colInfo && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: "7px",
                        left: "7px",
                        padding: "2px 7px",
                        borderRadius: "999px",
                        background: "rgba(31, 28, 25, 0.8)",
                        color: "#FAF8F5",
                        fontSize: "0.66rem",
                        fontWeight: 600,
                      }}
                    >
                      {colInfo.etiqueta}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    padding: "9px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                    flex: 1,
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.81rem",
                      fontWeight: 600,
                      color: "var(--ct-1f1c19, #1F1C19)",
                      lineHeight: 1.25,
                    }}
                  >
                    {v.nombre}
                  </div>

                  <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
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
                          padding: "4.5px 7px",
                          borderRadius: "7px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background: "var(--cf-f8f7f4, #F8F7F4)",
                          color: "var(--ct-57524c, #57524C)",
                          fontSize: "0.71rem",
                          fontWeight: 600,
                          cursor: ocupada ? "wait" : "pointer",
                        }}
                      >
                        {ocupada ? <Loader2 size={11} /> : <Star size={11} />}
                        <span>Por defecto</span>
                      </button>
                    ) : (
                      <span
                        style={{
                          flex: 1,
                          fontSize: "0.7rem",
                          color: "var(--ct-745622, #745622)",
                          fontWeight: 600,
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
                        padding: "4.5px 6.5px",
                        borderRadius: "7px",
                        border: "1px solid var(--cb-e5caca, #E5CACA)",
                        background: "var(--cf-faf2f2, #FAF2F2)",
                        color: "var(--ct-8a2e2e, #8A2E2E)",
                        cursor: ocupada ? "wait" : "pointer",
                      }}
                    >
                      <Trash2 size={12} />
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
