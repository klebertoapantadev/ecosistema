"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import {
  descartarEntregaInmediataAction,
  listarEntregaInmediataAction,
  publicarEntregaInmediataAction,
} from "../acciones-operaciones-taller";
import type { ArregloEntregaInmediata } from "../operaciones-taller";
import {
  comprimirYEstamparFotoArchivo,
  dataUrlABlob,
  subirArchivoOperativoStorage,
} from "../utils/evidenciaImagenGps";

export interface PropsConsolaEntregaInmediata {
  negocio: string;
  itemsIniciales?: ArregloEntregaInmediata[];
  migracionPendienteInicial?: boolean;
}

export function ConsolaEntregaInmediata({
  negocio,
  itemsIniciales = [],
  migracionPendienteInicial = false,
}: PropsConsolaEntregaInmediata) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_entrega_inmediata_${negNorm}`;

  const [items, setItems] = useState<ArregloEntregaInmediata[]>(itemsIniciales);
  const [migracionPendiente, setMigracionPendiente] = useState<boolean>(migracionPendienteInicial);
  const [cargando, setCargando] = useState<boolean>(false);

  // Formulario rápido de publicación
  const [fotosSubidas, setFotosSubidas] = useState<string[]>([]);
  const [nombre, setNombre] = useState<string>("");
  const [precio, setPrecio] = useState<string>("");
  const [precioComparacion, setPrecioComparacion] = useState<string>("");
  const [stock, setStock] = useState<string>("1");
  const [descripcion, setDescripcion] = useState<string>("");
  const [subiendoImagen, setSubiendoImagen] = useState<boolean>(false);
  const [publicando, setPublicando] = useState<boolean>(false);

  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await listarEntregaInmediataAction(negNorm, true);
    setCargando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setItems(res.items);
    setMigracionPendiente(Boolean(res.migracionPendiente));
    try {
      localStorage.setItem(cacheKey, JSON.stringify(res.items));
    } catch {
      // Ignorar cuota
    }
  }, [negNorm, cacheKey]);

  useEffect(() => {
    if (itemsIniciales.length === 0) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as ArregloEntregaInmediata[];
          if (Array.isArray(parsed)) setItems(parsed);
        }
      } catch {
        // Ignorar
      }
      void recargar();
    } else {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(itemsIniciales));
      } catch {
        // Ignorar
      }
    }
  }, [itemsIniciales, cacheKey, recargar]);

  const disponiblesActivos = useMemo(
    () => items.filter((i) => i.activo && i.stockDisponible > 0),
    [items]
  );
  const historialBajas = useMemo(
    () => items.filter((i) => !i.activo || i.stockDisponible <= 0),
    [items]
  );

  const handleSubirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (archivos.length === 0) return;

    setErrorMsg(null);
    setSubiendoImagen(true);
    const supabase = crearClienteNavegador();
    const urlsNuevas: string[] = [];

    for (const file of archivos) {
      try {
        const comprimida = await comprimirYEstamparFotoArchivo(file, 1280, 0.85, null);
        const blob = dataUrlABlob(comprimida);
        const resUp = await subirArchivoOperativoStorage(
          supabase,
          "entrega-inmediata",
          negNorm,
          blob,
          "jpg",
          "image/jpeg"
        );
        if (!resUp.ok) {
          setErrorMsg(resUp.error);
        } else {
          urlsNuevas.push(resUp.publicUrl);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "No se pudo procesar la foto");
      }
    }

    setSubiendoImagen(false);
    if (urlsNuevas.length > 0) {
      setFotosSubidas((prev) => [...prev, ...urlsNuevas]);
    }
  };

  const handlePublicar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fotosSubidas.length === 0) {
      setErrorMsg("Toma o adjunta al menos una fotografía real del arreglo listo.");
      return;
    }
    const precioNum = Number(precio);
    if (!Number.isFinite(precioNum) || precioNum <= 0) {
      setErrorMsg("Ingresa un precio válido en USD para entrega inmediata.");
      return;
    }

    setPublicando(true);
    setErrorMsg(null);
    setMensajeExito(null);

    const nombreFinal =
      nombre.trim() || `Arreglo Listo #${disponiblesActivos.length + historialBajas.length + 1}`;
    const res = await publicarEntregaInmediataAction({
      negocio: negNorm,
      nombre: nombreFinal,
      precio: precioNum,
      precioComparacion: precioComparacion ? Number(precioComparacion) : null,
      stock: Math.max(1, Number(stock) || 1),
      imagenUrl: fotosSubidas[0]!,
      galeriaUrls: fotosSubidas,
      descripcion:
        descripcion.trim() ||
        "Arreglo recién elaborado en tienda, disponible para envío inmediato en 1 a 2 horas.",
    });

    setPublicando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setFotosSubidas([]);
    setNombre("");
    setPrecio("");
    setPrecioComparacion("");
    setStock("1");
    setDescripcion("");
    setMensajeExito(
      `Publicado "${nombreFinal}" ($${precioNum.toFixed(2)}) — ya aparece en la Tienda Web y en el Chat.`
    );
    await recargar();
  };

  const handleDarDeBaja = async (
    item: ArregloEntregaInmediata,
    motivo: "VENDIDO_TIENDA" | "DESCARTADO"
  ) => {
    setProcesandoId(item.productoId);
    setErrorMsg(null);
    const res = await descartarEntregaInmediataAction({
      negocio: negNorm,
      productoId: item.productoId,
      motivo,
    });
    setProcesandoId(null);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setMensajeExito(
      motivo === "VENDIDO_TIENDA"
        ? `"${item.nombre}" marcado como vendido y retirado de disponibles.`
        : `"${item.nombre}" retirado de la galería.`
    );
    await recargar();
  };

  const handleCopiarEnlace = (item: ArregloEntregaInmediata) => {
    const origen = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origen}/producto/${item.slug}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      setLinkCopiadoId(item.productoId);
      setTimeout(() => setLinkCopiadoId(null), 2200);
    }
  };

  const columnasHistorial = useMemo<ColumnaDataGrid<ArregloEntregaInmediata>[]>(
    () => [
      {
        id: "arreglo",
        encabezado: "Arreglo",
        valor: (x) => `${x.nombre} ${x.sku}`,
        render: (x) => (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {x.imagenUrl && (
              <img
                src={x.imagenUrl}
                alt={x.nombre}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "8px",
                  objectFit: "cover",
                }}
              />
            )}
            <div>
              <strong style={{ fontSize: "0.84rem", color: "#1F1C19", display: "block" }}>
                {x.nombre}
              </strong>
              <span style={{ fontSize: "0.72rem", color: "#847D74" }}>{x.sku}</span>
            </div>
          </div>
        ),
      },
      {
        id: "precio",
        encabezado: "Precio USD",
        valor: (x) => x.precio,
        render: (x) => <strong>${Number(x.precio).toFixed(2)}</strong>,
      },
      {
        id: "motivo",
        encabezado: "Salida / Motivo",
        valor: (x) => `${x.motivoBaja || "AGOTADO"} ${x.ordenVentaCodigo || ""}`,
        render: (x) => {
          const esWeb = x.motivoBaja === "VENDIDO_WEB";
          return (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 9px",
                borderRadius: "999px",
                fontSize: "0.74rem",
                fontWeight: 700,
                background: esWeb ? "#F2F6F3" : "#F4F2EE",
                color: esWeb ? "#2B4A36" : "#57524C",
              }}
            >
              {esWeb
                ? `🛍️ Vendido Web (${x.ordenVentaCodigo || "Orden"})`
                : x.motivoBaja === "VENDIDO_TIENDA"
                  ? "🏪 Vendido en Tienda / Chat"
                  : "Retirado"}
            </span>
          );
        },
      },
      {
        id: "fecha",
        encabezado: "Fecha",
        valor: (x) => new Date(x.actualizadoEn || x.creadoEn).getTime(),
        render: (x) =>
          new Date(x.actualizadoEn || x.creadoEn).toLocaleString("es-EC", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
      },
    ],
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {migracionPendiente && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#FAF6EE",
            border: "1px solid #E5D7BC",
            color: "#745622",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={16} />
          <span>
            Ejecuta la migración{" "}
            <code>20261115000010_herramientas_taller_inventario_inmediata_y_entregas_iess.sql</code>{" "}
            en Supabase para activar la publicación en catálogo en vivo.
          </span>
        </div>
      )}

      {/* FORMULARIO ULTRARRÁPIDO DE TALLER */}
      <form
        onSubmit={(e) => void handlePublicar(e)}
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "#FAF6EE",
                color: "#8F6A2E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#1F1C19" }}>
                Publicar Arreglo para Entrega Inmediata (1 a 2 Horas)
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.81rem", color: "#847D74" }}>
                Sube la foto y su precio especial. Se publica al instante en Web y Chat, y se
                descarta solo si se vende en línea.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => void recargar()}
            title="Sincronizar galería de disponibles"
            aria-label="Actualizar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "9px",
              border: "1px solid #D5CFC4",
              background: "#FFFFFF",
              color: "#1F1C19",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "10px 13px",
              borderRadius: "9px",
              background: "#FAF2F2",
              border: "1px solid #E5CACA",
              color: "#8A2E2E",
              fontSize: "0.82rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        {mensajeExito && (
          <div
            style={{
              padding: "10px 13px",
              borderRadius: "9px",
              background: "#F2F6F3",
              border: "1px solid #CEDDD3",
              color: "#2B4A36",
              fontSize: "0.83rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{mensajeExito}</span>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#57524C",
                marginBottom: "5px",
              }}
            >
              1. Fotografía del Arreglo *
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <label
                title="Tomar foto con cámara del celular"
                aria-label="Tomar foto"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 13px",
                  borderRadius: "9px",
                  background: "#1F1C19",
                  color: "#FFFFFF",
                  fontSize: "0.81rem",
                  fontWeight: 700,
                  cursor: subiendoImagen ? "wait" : "pointer",
                }}
              >
                {subiendoImagen ? <Loader2 size={14} /> : <Camera size={14} />}
                <span>Cámara</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handleSubirFoto(e)}
                  disabled={subiendoImagen}
                  style={{ display: "none" }}
                />
              </label>

              <label
                title="Subir imagen desde el dispositivo"
                aria-label="Subir imagen"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 13px",
                  borderRadius: "9px",
                  border: "1px solid #D5CFC4",
                  background: "#F8F7F4",
                  color: "#1F1C19",
                  fontSize: "0.81rem",
                  fontWeight: 600,
                  cursor: subiendoImagen ? "wait" : "pointer",
                }}
              >
                <Upload size={14} />
                <span>Galería</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void handleSubirFoto(e)}
                  disabled={subiendoImagen}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#57524C",
                marginBottom: "5px",
              }}
            >
              2. Nombre Corto (Opcional)
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Bouquet 24 Rosas Rojas Listo"
              style={{
                width: "100%",
                padding: "9px 11px",
                borderRadius: "9px",
                border: "1px solid #D5CFC4",
                fontSize: "0.85rem",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: "8px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#57524C",
                  marginBottom: "5px",
                }}
              >
                Precio Hoy ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="29.99"
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: "9px",
                  border: "1px solid #D5CFC4",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#847D74",
                  marginBottom: "5px",
                }}
              >
                Antes ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precioComparacion}
                onChange={(e) => setPrecioComparacion(e.target.value)}
                placeholder="38.00"
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: "9px",
                  border: "1px solid #E6E2DA",
                  fontSize: "0.84rem",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#847D74",
                  marginBottom: "5px",
                }}
              >
                Cant.
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: "9px",
                  border: "1px solid #D5CFC4",
                  fontSize: "0.84rem",
                }}
              />
            </div>
          </div>
        </div>

        {fotosSubidas.length > 0 && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {fotosSubidas.map((url, idx) => (
              <div key={url} style={{ position: "relative" }}>
                <img
                  src={url}
                  alt={`Vista previa ${idx + 1}`}
                  style={{
                    width: "84px",
                    height: "84px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: "2px solid #2F4737",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFotosSubidas((prev) => prev.filter((x) => x !== url))}
                  title="Quitar foto"
                  aria-label="Quitar foto"
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-6px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: "none",
                    background: "#8A2E2E",
                    color: "#FFFFFF",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalle corto para vendedoras y web (ej. 24 rosas rojas + follaje eucalipto, caja blanca)..."
            style={{
              flex: "1 1 320px",
              padding: "9px 12px",
              borderRadius: "9px",
              border: "1px solid #D5CFC4",
              fontSize: "0.84rem",
            }}
          />

          <button
            type="submit"
            disabled={publicando || subiendoImagen}
            title="Publicar arreglo como disponible para entrega inmediata en web y chat"
            aria-label="Publicar ahora"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "10px 18px",
              borderRadius: "10px",
              border: "none",
              background: "#8F6A2E",
              color: "#FFFFFF",
              fontSize: "0.86rem",
              fontWeight: 700,
              cursor: publicando ? "wait" : "pointer",
            }}
          >
            {publicando ? <Loader2 size={16} /> : <Plus size={16} />}
            <span>{publicando ? "Publicando..." : "Publicar Ahora"}</span>
          </button>
        </div>
      </form>

      {/* GRILLA EN VIVO DE DISPONIBLES ACTUALES */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1F1C19" }}>
            ⚡ Disponibles Ahora Mismo en Vitrina y Chat ({disponiblesActivos.length})
          </h3>
        </div>

        {disponiblesActivos.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#847D74",
              background: "#F8F7F4",
              borderRadius: "12px",
              border: "1px dashed #D5CFC4",
              fontSize: "0.86rem",
            }}
          >
            No hay arreglos publicados en entrega inmediata en este momento. Sube una fotografía
            arriba conforme se elaboren en taller.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
              gap: "16px",
            }}
          >
            {disponiblesActivos.map((item) => {
              const enProceso = procesandoId === item.productoId;
              const copiado = linkCopiadoId === item.productoId;

              return (
                <div
                  key={item.productoId}
                  style={{
                    border: "1px solid #E6E2DA",
                    borderRadius: "14px",
                    overflow: "hidden",
                    background: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
                  }}
                >
                  <div style={{ position: "relative", height: "210px", background: "#F4F2EE" }}>
                    <img
                      src={item.imagenUrl}
                      alt={item.nombre}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        padding: "4px 9px",
                        borderRadius: "999px",
                        background: "rgba(15, 23, 42, 0.82)",
                        color: "#E5D7BC",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      ⚡ {item.tiempoEntregaTexto} · Quedan {item.stockDisponible}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "8px",
                      }}
                    >
                      <strong style={{ fontSize: "0.94rem", color: "#1F1C19" }}>
                        {item.nombre}
                      </strong>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: "0.9rem", color: "#2F4737" }}>
                          ${Number(item.precio).toFixed(2)}
                        </strong>
                        {item.precioComparacion && item.precioComparacion > item.precio && (
                          <div
                            style={{
                              fontSize: "0.73rem",
                              color: "#847D74",
                              textDecoration: "line-through",
                            }}
                          >
                            ${Number(item.precioComparacion).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.79rem",
                        color: "#847D74",
                        lineHeight: 1.4,
                        flex: 1,
                      }}
                    >
                      {item.descripcion}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        paddingTop: "6px",
                        borderTop: "1px solid #F4F2EE",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleCopiarEnlace(item)}
                        title="Copiar link directo del producto para enviar por WhatsApp o Chat"
                        aria-label="Copiar link"
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          background: "#F8F7F4",
                          color: "#1F1C19",
                          fontSize: "0.76rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {copiado ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiado ? "Copiado" : "Link"}</span>
                      </button>

                      <a
                        href={`/producto/${item.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Ver publicación en la tienda web"
                        aria-label="Ver en tienda"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "7px 9px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          color: "#57524C",
                        }}
                      >
                        <ExternalLink size={13} />
                      </a>

                      <button
                        type="button"
                        disabled={enProceso}
                        onClick={() => void handleDarDeBaja(item, "VENDIDO_TIENDA")}
                        title="Marcar como vendido en mostrador o WhatsApp y retirar de disponibles"
                        aria-label="Marcar vendido"
                        style={{
                          flex: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "none",
                          background: "#2F4737",
                          color: "#FFFFFF",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          cursor: enProceso ? "wait" : "pointer",
                        }}
                      >
                        <ShoppingBag size={13} />
                        <span>Vendido</span>
                      </button>

                      <button
                        type="button"
                        disabled={enProceso}
                        onClick={() => void handleDarDeBaja(item, "DESCARTADO")}
                        title="Retirar o descartar este arreglo de los disponibles"
                        aria-label="Descartar arreglo"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "7px 9px",
                          borderRadius: "8px",
                          border: "1px solid #E5CACA",
                          background: "#FAF2F2",
                          color: "#8A2E2E",
                          cursor: enProceso ? "wait" : "pointer",
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
        )}
      </div>

      {/* BITÁCORA DE VENDIDOS Y RETIRADOS */}
      {historialBajas.length > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E6E2DA",
            borderRadius: "16px",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1F1C19" }}>
            Historial de Arreglos Inmediatos Vendidos o Retirados
          </h3>
          <DataGrid
            columnas={columnasHistorial}
            filas={historialBajas}
            idFila={(x) => x.productoId}
            nombreExportacion={`entrega-inmediata-${negNorm}`}
          />
        </div>
      )}
    </div>
  );
}
