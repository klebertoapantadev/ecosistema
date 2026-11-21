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
  Download,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import {
  descartarEntregaInmediataAction,
  eliminarDefinitivoEntregaInmediataAction,
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
  /** Endpoint opcional de servidor para generar fotos Estudio + Taller con IA (aislado por negocio). */
  endpointEstudioIa?: string;
}

type ModoFotoIa = "estudio" | "taller";

interface RespuestaEndpointEstudioIa {
  ok?: boolean;
  error?: string;
  resultados?: Partial<Record<ModoFotoIa, { dataUrl: string; mimeType: string }>>;
  errores?: Partial<Record<ModoFotoIa, string>>;
}

async function convertirDataUrlAJpegBlob(dataUrl: string): Promise<Blob> {
  if (typeof window === "undefined" || dataUrl.startsWith("data:image/jpeg")) {
    return dataUrlABlob(dataUrl);
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo decodificar la imagen IA"));
      el.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrlABlob(dataUrl);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    return dataUrlABlob(jpegDataUrl);
  } catch {
    return dataUrlABlob(dataUrl);
  }
}

export function ConsolaEntregaInmediata({
  negocio,
  itemsIniciales = [],
  migracionPendienteInicial = false,
  endpointEstudioIa,
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
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del generador Estudio IA (activos solo cuando endpointEstudioIa está definido)
  const [tipoSoporteIa, setTipoSoporteIa] = useState<"mesa" | "piso" | "pedestal">("mesa");
  const [coreanoIa, setCoreanoIa] = useState<boolean>(false);
  const [geometriaIa, setGeometriaIa] = useState<"auto" | "con_frente" | "recto">("auto");
  const [incluirTarjetaIa, setIncluirTarjetaIa] = useState<boolean>(true);
  const [generandoIa, setGenerandoIa] = useState<{ estudio: boolean; taller: boolean }>({
    estudio: false,
    taller: false,
  });
  const [fotosIa, setFotosIa] = useState<{
    estudio: { dataUrl: string; seleccionada: boolean } | null;
    taller: { dataUrl: string; seleccionada: boolean } | null;
  }>({ estudio: null, taller: null });
  const [erroresIa, setErroresIa] = useState<{ estudio: string | null; taller: string | null }>({
    estudio: null,
    taller: null,
  });
  const [reemplazarOriginalIa, setReemplazarOriginalIa] = useState<boolean>(true);
  const [aplicandoIa, setAplicandoIa] = useState<boolean>(false);

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

  const handleDefinirPortada = (url: string) => {
    setFotosSubidas((prev) => {
      if (!prev.includes(url)) return prev;
      return [url, ...prev.filter((item) => item !== url)];
    });
  };

  const handleQuitarFotoSubida = (url: string) => {
    setFotosSubidas((prev) => {
      const restantes = prev.filter((x) => x !== url);
      if (restantes.length === 0) {
        setFotosIa({ estudio: null, taller: null });
        setErroresIa({ estudio: null, taller: null });
      }
      return restantes;
    });
  };

  const handleGenerarFotosIa = async (modosSolicitados: ModoFotoIa[]) => {
    if (!endpointEstudioIa || fotosSubidas.length === 0) return;

    const fotoBase = fotosSubidas[0];
    if (!fotoBase) return;

    setErrorMsg(null);
    setMensajeExito(null);

    setGenerandoIa((prev) => ({
      estudio: modosSolicitados.includes("estudio") ? true : prev.estudio,
      taller: modosSolicitados.includes("taller") ? true : prev.taller,
    }));
    setErroresIa((prev) => ({
      estudio: modosSolicitados.includes("estudio") ? null : prev.estudio,
      taller: modosSolicitados.includes("taller") ? null : prev.taller,
    }));

    try {
      const res = await fetch(endpointEstudioIa, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fotoUrl: fotoBase,
          modos: modosSolicitados,
          opciones: {
            tipoSoporte: tipoSoporteIa,
            coreano: coreanoIa,
            geometria: geometriaIa,
            incluirTarjeta: incluirTarjetaIa,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as RespuestaEndpointEstudioIa;

      if (!res.ok && !data.resultados) {
        const detalleErr = data.error || `No se pudieron generar las fotos IA (HTTP ${res.status})`;
        setErroresIa((prev) => ({
          estudio: modosSolicitados.includes("estudio")
            ? data.errores?.estudio || detalleErr
            : prev.estudio,
          taller: modosSolicitados.includes("taller")
            ? data.errores?.taller || detalleErr
            : prev.taller,
        }));
        setErrorMsg(detalleErr);
        return;
      }

      setFotosIa((prev) => ({
        estudio: data.resultados?.estudio?.dataUrl
          ? { dataUrl: data.resultados.estudio.dataUrl, seleccionada: true }
          : prev.estudio,
        taller: data.resultados?.taller?.dataUrl
          ? { dataUrl: data.resultados.taller.dataUrl, seleccionada: true }
          : prev.taller,
      }));

      setErroresIa((prev) => ({
        estudio: modosSolicitados.includes("estudio")
          ? data.errores?.estudio || null
          : prev.estudio,
        taller: modosSolicitados.includes("taller")
          ? data.errores?.taller || null
          : prev.taller,
      }));

      if (!res.ok && data.error) {
        setErrorMsg(data.error);
      }
    } catch (err) {
      const detalleErr =
        err instanceof Error ? err.message : "Error de conexión al generar fotos con IA";
      setErroresIa((prev) => ({
        estudio: modosSolicitados.includes("estudio") ? detalleErr : prev.estudio,
        taller: modosSolicitados.includes("taller") ? detalleErr : prev.taller,
      }));
      setErrorMsg(detalleErr);
    } finally {
      setGenerandoIa((prev) => ({
        estudio: modosSolicitados.includes("estudio") ? false : prev.estudio,
        taller: modosSolicitados.includes("taller") ? false : prev.taller,
      }));
    }
  };

  const handleToggleSeleccionIa = (modo: ModoFotoIa) => {
    setFotosIa((prev) => {
      const actual = prev[modo];
      if (!actual) return prev;
      return {
        ...prev,
        [modo]: { ...actual, seleccionada: !actual.seleccionada },
      };
    });
  };

  const handleDescargarFotoIa = async (modo: ModoFotoIa) => {
    const item = fotosIa[modo];
    if (!item) return;
    try {
      const blob = await convertirDataUrlAJpegBlob(item.dataUrl);
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = `tinkay-${modo}-${new Date().toISOString().slice(0, 10)}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(urlObj), 1500);
    } catch {
      const a = document.createElement("a");
      a.href = item.dataUrl;
      a.download = `tinkay-${modo}.jpg`;
      a.click();
    }
  };

  const handleAplicarFotosIa = async () => {
    const seleccionadas: Array<{ modo: ModoFotoIa; dataUrl: string }> = [];
    if (fotosIa.estudio?.seleccionada) {
      seleccionadas.push({ modo: "estudio", dataUrl: fotosIa.estudio.dataUrl });
    }
    if (fotosIa.taller?.seleccionada) {
      seleccionadas.push({ modo: "taller", dataUrl: fotosIa.taller.dataUrl });
    }
    if (seleccionadas.length === 0) {
      setErrorMsg("Selecciona al menos una fotografía generada (Estudio o Taller) para aplicarla.");
      return;
    }

    setAplicandoIa(true);
    setErrorMsg(null);
    setMensajeExito(null);

    try {
      const supabase = crearClienteNavegador();
      const urlsSubidasIa: string[] = [];

      for (const item of seleccionadas) {
        const blob = await convertirDataUrlAJpegBlob(item.dataUrl);
        const resUp = await subirArchivoOperativoStorage(
          supabase,
          "entrega-inmediata",
          negNorm,
          blob,
          "jpg",
          "image/jpeg"
        );
        if (!resUp.ok) {
          throw new Error(resUp.error || `No se pudo subir la foto de ${item.modo}`);
        }
        urlsSubidasIa.push(resUp.publicUrl);
      }

      setFotosSubidas((prev) =>
        reemplazarOriginalIa ? [...urlsSubidasIa, ...prev.slice(1)] : [...urlsSubidasIa, ...prev]
      );
      setFotosIa({ estudio: null, taller: null });
      setErroresIa({ estudio: null, taller: null });
      setMensajeExito(
        urlsSubidasIa.length === 2
          ? "Fotos Estudio (portada) y Taller listas. Revisa el precio y pulsa Publicar Ahora."
          : "Foto IA aplicada a tu publicación. Revisa los datos y pulsa Publicar Ahora."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudieron guardar las fotos IA");
    } finally {
      setAplicandoIa(false);
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
    setFotosIa({ estudio: null, taller: null });
    setErroresIa({ estudio: null, taller: null });
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

  const handleEliminarDefinitivo = useCallback(
    async (item: ArregloEntregaInmediata) => {
      if (confirmarEliminarId !== item.productoId) {
        setConfirmarEliminarId(item.productoId);
        return;
      }

      setConfirmarEliminarId(null);
      setProcesandoId(item.productoId);
      setErrorMsg(null);
      setMensajeExito(null);

      const res = await eliminarDefinitivoEntregaInmediataAction({
        negocio: negNorm,
        productoId: item.productoId,
      });

      setProcesandoId(null);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setItems((prev) => prev.filter((x) => x.productoId !== item.productoId));
      setMensajeExito(`"${item.nombre}" eliminado definitivamente del catálogo.`);
      await recargar();
    },
    [confirmarEliminarId, negNorm, recargar]
  );

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
      {
        id: "acciones",
        encabezado: "Acciones",
        valor: () => "",
        render: (x) => {
          const enProceso = procesandoId === x.productoId;
          const confirmando = confirmarEliminarId === x.productoId;
          return (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                className="btn-responsive-accion"
                disabled={enProceso}
                onClick={() => void handleEliminarDefinitivo(x)}
                title={
                  confirmando
                    ? `Confirmar eliminación definitiva de "${x.nombre}"`
                    : `Eliminar definitivamente "${x.nombre}" del catálogo`
                }
                aria-label={confirmando ? "Confirmar eliminar" : "Eliminar definitivo"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: confirmando ? "none" : "1px solid #E5CACA",
                  background: confirmando ? "#8A2E2E" : "#FAF2F2",
                  color: confirmando ? "#FFFFFF" : "#8A2E2E",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: enProceso ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {enProceso ? (
                  <Loader2 size={13} className="eco-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span className="btn-texto-responsive">
                  {enProceso ? "Eliminando..." : confirmando ? "Confirmar" : "Eliminar"}
                </span>
              </button>
              {confirmando && !enProceso && (
                <button
                  type="button"
                  onClick={() => setConfirmarEliminarId(null)}
                  title="Cancelar eliminación"
                  aria-label="Cancelar"
                  style={{
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#57524C",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [procesandoId, confirmarEliminarId, handleEliminarDefinitivo]
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span>{errorMsg}</span>
            {endpointEstudioIa &&
              /\/panel\/aria|Estudio IA|OPENROUTER_API_KEY|GEMINI_API_KEY/i.test(errorMsg) && (
                <a
                  href="/panel/aria#estudio-ia"
                  title="Abrir Configuración → Agente ARIA → Estudio IA"
                  aria-label="Configurar IA"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "8px",
                    border: "1px solid #8A2E2E",
                    background: "#FFFFFF",
                    color: "#8A2E2E",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <ExternalLink size={12} />
                  <span>Configurar IA</span>
                </a>
              )}
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
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
            {fotosSubidas.map((url, idx) => (
              <div
                key={url}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <img
                  src={url}
                  alt={`Vista previa ${idx + 1}`}
                  style={{
                    width: "84px",
                    height: "84px",
                    objectFit: "cover",
                    borderRadius: "10px",
                    border: idx === 0 ? "2px solid #2F4737" : "1px solid #D5CFC4",
                  }}
                />
                {endpointEstudioIa && idx === 0 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: fotosSubidas.length > 1 ? "28px" : "5px",
                      left: "5px",
                      padding: "2px 6px",
                      borderRadius: "999px",
                      background: "rgba(47, 71, 55, 0.92)",
                      color: "#FFFFFF",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Portada
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleQuitarFotoSubida(url)}
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
                {endpointEstudioIa && idx > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDefinirPortada(url)}
                    title="Usar esta fotografía como portada principal"
                    aria-label="Portada"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "3px 7px",
                      borderRadius: "7px",
                      border: "1px solid #D5CFC4",
                      background: "#F8F7F4",
                      color: "#57524C",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Star size={10} />
                    <span>Portada</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PANEL ESTUDIO IA (ESTUDIO + TALLER) — SOLO CUANDO endpointEstudioIa ESTÁ CONFIGURADO */}
        {endpointEstudioIa && fotosSubidas.length > 0 && (
          <div
            style={{
              background: "#FAF6EE",
              border: "1px solid #E5D7BC",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "8px",
                    background: "#FFFFFF",
                    border: "1px solid #E5D7BC",
                    color: "#8F6A2E",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={15} />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "0.84rem", color: "#1F1C19" }}>
                    Estudio IA (Estudio + Taller)
                  </strong>
                  <span style={{ fontSize: "0.73rem", color: "#57524C" }}>
                    Genera en paralelo la toma limpia de catálogo y el ambiente oficial de taller (3:4).
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={generandoIa.estudio || generandoIa.taller || aplicandoIa}
                onClick={() => void handleGenerarFotosIa(["estudio", "taller"])}
                title="Generar fotos de Estudio y Taller con IA"
                aria-label="Generar IA"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 14px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#8F6A2E",
                  color: "#FFFFFF",
                  fontSize: "0.81rem",
                  fontWeight: 700,
                  cursor:
                    generandoIa.estudio || generandoIa.taller || aplicandoIa
                      ? "wait"
                      : "pointer",
                  opacity: generandoIa.estudio || generandoIa.taller || aplicandoIa ? 0.72 : 1,
                }}
              >
                {generandoIa.estudio || generandoIa.taller ? (
                  <Loader2 size={14} className="eco-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>
                  {generandoIa.estudio || generandoIa.taller ? "Generando..." : "Generar IA"}
                </span>
              </button>
            </div>

            {/* Controles compactos de configuración del arreglo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#57524C",
                }}
              >
                <span>Soporte</span>
                <select
                  value={tipoSoporteIa}
                  onChange={(e) =>
                    setTipoSoporteIa(e.target.value as "mesa" | "piso" | "pedestal")
                  }
                  disabled={generandoIa.estudio || generandoIa.taller}
                  aria-label="Tipo de soporte del arreglo"
                  style={{
                    padding: "6px 9px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#1F1C19",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  <option value="mesa">Mesa</option>
                  <option value="piso">Piso (Trípode)</option>
                  <option value="pedestal">Pedestal</option>
                </select>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#57524C",
                }}
              >
                <span>Geometría</span>
                <select
                  value={geometriaIa}
                  onChange={(e) =>
                    setGeometriaIa(e.target.value as "auto" | "con_frente" | "recto")
                  }
                  disabled={generandoIa.estudio || generandoIa.taller}
                  aria-label="Geometría de copa del arreglo"
                  style={{
                    padding: "6px 9px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#1F1C19",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="con_frente">Con frente</option>
                  <option value="recto">Recto 360°</option>
                </select>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#1F1C19",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: "1px solid #E5D7BC",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={coreanoIa}
                  onChange={(e) => setCoreanoIa(e.target.checked)}
                  disabled={generandoIa.estudio || generandoIa.taller}
                  style={{ accentColor: "#2F4737", width: "15px", height: "15px" }}
                />
                <span>Estilo coreano</span>
              </label>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#1F1C19",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: "1px solid #E5D7BC",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={incluirTarjetaIa}
                  onChange={(e) => setIncluirTarjetaIa(e.target.checked)}
                  disabled={generandoIa.estudio || generandoIa.taller}
                  style={{ accentColor: "#2F4737", width: "15px", height: "15px" }}
                />
                <span>Tarjeta Tinkay</span>
              </label>
            </div>

            {/* Previsualización en 2 columnas: Estudio y Taller */}
            {(generandoIa.estudio ||
              generandoIa.taller ||
              fotosIa.estudio ||
              fotosIa.taller ||
              erroresIa.estudio ||
              erroresIa.taller) && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {(
                    [
                      {
                        modo: "estudio" as const,
                        titulo: "Estudio",
                        subtitulo: "Fondo limpio de catálogo",
                      },
                      {
                        modo: "taller" as const,
                        titulo: "Taller",
                        subtitulo: "Ambiente oficial con neón Tinkay",
                      },
                    ] as const
                  ).map(({ modo, titulo, subtitulo }) => {
                    const resultado = fotosIa[modo];
                    const cargandoModo = generandoIa[modo];
                    const errorModo = erroresIa[modo];
                    const seleccionada = Boolean(resultado?.seleccionada);

                    return (
                      <div
                        key={modo}
                        style={{
                          background: "#FFFFFF",
                          border: seleccionada
                            ? "2px solid #2F4737"
                            : errorModo
                              ? "1px solid #E5CACA"
                              : "1px solid #E6E2DA",
                          borderRadius: "12px",
                          padding: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "9px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "6px",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "0.82rem", color: "#1F1C19", display: "block" }}>
                              {titulo}
                            </strong>
                            <span style={{ fontSize: "0.7rem", color: "#847D74" }}>
                              {subtitulo}
                            </span>
                          </div>
                          {cargandoModo ? (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: "#FAF6EE",
                                color: "#8F6A2E",
                                border: "1px solid #E5D7BC",
                              }}
                            >
                              Generando
                            </span>
                          ) : resultado ? (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: seleccionada ? "#F2F6F3" : "#F4F2EE",
                                color: seleccionada ? "#2B4A36" : "#57524C",
                                border: seleccionada
                                  ? "1px solid #CEDDD3"
                                  : "1px solid #E6E2DA",
                              }}
                            >
                              {seleccionada ? "Incluida" : "Omitida"}
                            </span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "3 / 4",
                            borderRadius: "9px",
                            overflow: "hidden",
                            background: "#F4F2EE",
                            border: "1px solid #E6E2DA",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {resultado ? (
                            <>
                              <img
                                src={resultado.dataUrl}
                                alt={`Foto IA ${titulo}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  opacity: seleccionada ? 1 : 0.45,
                                  transition: "opacity 0.15s ease",
                                }}
                              />
                              {cargandoModo && (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "rgba(248, 247, 244, 0.78)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    color: "#8F6A2E",
                                    fontSize: "0.78rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  <Loader2 size={22} className="eco-spin" />
                                  <span>Regenerando {titulo}...</span>
                                </div>
                              )}
                            </>
                          ) : cargandoModo ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "8px",
                                padding: "16px",
                                textAlign: "center",
                                color: "#8F6A2E",
                              }}
                            >
                              <Loader2 size={24} className="eco-spin" />
                              <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                                Creando foto {titulo}...
                              </span>
                              <span style={{ fontSize: "0.7rem", color: "#847D74" }}>
                                Tomará ~15 a 30 segundos
                              </span>
                            </div>
                          ) : errorModo ? (
                            <div
                              style={{
                                padding: "14px",
                                textAlign: "center",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: "8px",
                                color: "#8A2E2E",
                              }}
                            >
                              <AlertTriangle size={20} />
                              <span style={{ fontSize: "0.75rem", lineHeight: 1.4 }}>
                                {errorModo}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#847D74" }}>
                              Sin generar aún
                            </span>
                          )}
                        </div>

                        {errorModo && resultado && (
                          <div
                            style={{
                              padding: "6px 8px",
                              borderRadius: "7px",
                              background: "#FAF2F2",
                              border: "1px solid #E5CACA",
                              color: "#8A2E2E",
                              fontSize: "0.71rem",
                            }}
                          >
                            {errorModo}
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          {resultado && (
                            <button
                              type="button"
                              className="btn-responsive-accion"
                              onClick={() => handleToggleSeleccionIa(modo)}
                              disabled={cargandoModo || aplicandoIa}
                              title={
                                seleccionada
                                  ? `Quitar foto de ${titulo} de la publicación`
                                  : `Incluir foto de ${titulo} en la publicación`
                              }
                              aria-label={seleccionada ? "Quitar" : "Incluir"}
                              style={{
                                flex: 1,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                                padding: "7px 9px",
                                borderRadius: "8px",
                                border: seleccionada
                                  ? "1px solid #E5CACA"
                                  : "1px solid #CEDDD3",
                                background: seleccionada ? "#FAF2F2" : "#F2F6F3",
                                color: seleccionada ? "#8A2E2E" : "#2B4A36",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {seleccionada ? <Trash2 size={13} /> : <Check size={13} />}
                              <span className="btn-texto-responsive">
                                {seleccionada ? "Quitar" : "Incluir"}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-responsive-accion"
                            onClick={() => void handleGenerarFotosIa([modo])}
                            disabled={cargandoModo || aplicandoIa}
                            title={`Regenerar únicamente la foto de ${titulo}`}
                            aria-label="Regenerar"
                            style={{
                              flex: resultado ? undefined : 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "5px",
                              padding: "7px 9px",
                              borderRadius: "8px",
                              border: "1px solid #D5CFC4",
                              background: "#F8F7F4",
                              color: "#1F1C19",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: cargandoModo ? "wait" : "pointer",
                            }}
                          >
                            {cargandoModo ? (
                              <Loader2 size={13} className="eco-spin" />
                            ) : (
                              <RefreshCw size={13} />
                            )}
                            <span className="btn-texto-responsive">Regenerar</span>
                          </button>

                          {resultado && (
                            <button
                              type="button"
                              className="btn-responsive-accion"
                              onClick={() => void handleDescargarFotoIa(modo)}
                              disabled={cargandoModo}
                              title={`Descargar imagen de ${titulo} en formato JPG`}
                              aria-label="Descargar"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                                padding: "7px 9px",
                                borderRadius: "8px",
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#57524C",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <Download size={13} />
                              <span className="btn-texto-responsive">Descargar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barra de confirmación para aplicar las fotos seleccionadas al formulario */}
                {(fotosIa.estudio || fotosIa.taller) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      flexWrap: "wrap",
                      paddingTop: "8px",
                      borderTop: "1px solid #E5D7BC",
                    }}
                  >
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        fontSize: "0.79rem",
                        fontWeight: 600,
                        color: "#1F1C19",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={reemplazarOriginalIa}
                        onChange={(e) => setReemplazarOriginalIa(e.target.checked)}
                        disabled={aplicandoIa}
                        style={{ accentColor: "#2F4737", width: "16px", height: "16px" }}
                      />
                      <span>Reemplazar foto original</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleAplicarFotosIa()}
                      disabled={
                        aplicandoIa ||
                        generandoIa.estudio ||
                        generandoIa.taller ||
                        (!fotosIa.estudio?.seleccionada && !fotosIa.taller?.seleccionada)
                      }
                      title="Subir y aplicar las fotos IA seleccionadas al formulario"
                      aria-label="Usar Fotos"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 16px",
                        borderRadius: "9px",
                        border: "none",
                        background: "#2F4737",
                        color: "#FFFFFF",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: aplicandoIa ? "wait" : "pointer",
                        opacity:
                          aplicandoIa ||
                          generandoIa.estudio ||
                          generandoIa.taller ||
                          (!fotosIa.estudio?.seleccionada && !fotosIa.taller?.seleccionada)
                            ? 0.6
                            : 1,
                      }}
                    >
                      {aplicandoIa ? (
                        <Loader2 size={14} className="eco-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      <span>{aplicandoIa ? "Aplicando..." : "Usar Fotos"}</span>
                    </button>
                  </div>
                )}
              </>
            )}
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
            disabled={publicando || subiendoImagen || aplicandoIa}
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
