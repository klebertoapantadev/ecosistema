"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  Flower2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  analizarFotoBonchesConAriaAction,
  guardarCorteInventarioRosasAction,
  obtenerInventarioRosasAction,
} from "../acciones-operaciones-taller";
import {
  COLORES_ROSAS_ESTANDAR,
  consolidarFotosInventario,
  formatearFechaCorteInventario,
  formatearResumenInventarioTexto,
  type CorteInventarioRosas,
  type FotoConteoBonches,
} from "../operaciones-taller";
import {
  comprimirYEstamparFotoArchivo,
  dataUrlABlob,
  subirArchivoOperativoStorage,
} from "../utils/evidenciaImagenGps";

export interface PropsConsolaInventarioRosas {
  negocio: string;
  ultimoCorteInicial?: CorteInventarioRosas | null;
  historialInicial?: CorteInventarioRosas[];
  migracionPendienteInicial?: boolean;
}

export function ConsolaInventarioRosas({
  negocio,
  ultimoCorteInicial = null,
  historialInicial = [],
  migracionPendienteInicial = false,
}: PropsConsolaInventarioRosas) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_inventario_rosas_${negNorm}`;

  const [ultimoCorte, setUltimoCorte] = useState<CorteInventarioRosas | null>(ultimoCorteInicial);
  const [historial, setHistorial] = useState<CorteInventarioRosas[]>(historialInicial);
  const [migracionPendiente, setMigracionPendiente] = useState<boolean>(migracionPendienteInicial);

  const [fotosActuales, setFotosActuales] = useState<FotoConteoBonches[]>([]);
  const [observaciones, setObservaciones] = useState<string>("");
  const [subiendoFotos, setSubiendoFotos] = useState<boolean>(false);
  const [analizandoFotoIds, setAnalizandoFotoIds] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await obtenerInventarioRosasAction(negNorm);
    setCargando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setUltimoCorte(res.ultimoCorte);
    setHistorial(res.historial);
    setMigracionPendiente(Boolean(res.migracionPendiente));
    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ultimoCorte: res.ultimoCorte, historial: res.historial })
      );
    } catch {
      // Ignorar cuota localStorage
    }
  }, [negNorm, cacheKey]);

  useEffect(() => {
    if (!ultimoCorteInicial && historialInicial.length === 0) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            ultimoCorte?: CorteInventarioRosas | null;
            historial?: CorteInventarioRosas[];
          };
          if (parsed.ultimoCorte) setUltimoCorte(parsed.ultimoCorte);
          if (Array.isArray(parsed.historial)) setHistorial(parsed.historial);
        }
      } catch {
        // Ignorar caché corrupto
      }
      void recargar();
    } else {
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ ultimoCorte: ultimoCorteInicial, historial: historialInicial })
        );
      } catch {
        // Ignorar
      }
    }
  }, [ultimoCorteInicial, historialInicial, cacheKey, recargar]);

  const consolidadoEnCurso = useMemo(
    () => consolidarFotosInventario(fotosActuales),
    [fotosActuales]
  );

  const analizarFotoIndividualConIa = async (fotoId: string, urlPublica: string) => {
    setAnalizandoFotoIds((prev) => ({ ...prev, [fotoId]: true }));
    const resIa = await analizarFotoBonchesConAriaAction(negNorm, urlPublica);
    setAnalizandoFotoIds((prev) => ({ ...prev, [fotoId]: false }));

    if (resIa.ok) {
      setFotosActuales((prev) =>
        prev.map((f) =>
          f.id === fotoId
            ? {
                ...f,
                conteoColores:
                  Object.keys(resIa.conteoColores).length > 0
                    ? resIa.conteoColores
                    : f.conteoColores,
                notaIa:
                  resIa.notaIa ||
                  (Object.keys(resIa.conteoColores).length > 0
                    ? "Conteo detectado por ARIA Visión"
                    : "ARIA revisó la imagen; verifica las cantidades por color."),
                analizadoPorIa: true,
              }
            : f
        )
      );
    } else {
      setFotosActuales((prev) =>
        prev.map((f) =>
          f.id === fotoId
            ? {
                ...f,
                notaIa: resIa.error,
                analizadoPorIa: false,
              }
            : f
        )
      );
    }
  };

  const handleSeleccionarFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const listaArchivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (listaArchivos.length === 0) return;

    setErrorMsg(null);
    setMensajeExito(null);
    setSubiendoFotos(true);

    const supabase = crearClienteNavegador();
    const nuevasFotos: FotoConteoBonches[] = [];

    for (const archivo of listaArchivos) {
      try {
        const comprimida = await comprimirYEstamparFotoArchivo(archivo, 1400, 0.84, null);
        const blob = dataUrlABlob(comprimida);
        const subida = await subirArchivoOperativoStorage(
          supabase,
          "inventario-rosas",
          negNorm,
          blob,
          "jpg",
          "image/jpeg"
        );

        const idLocal = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const urlFinal = subida.ok ? subida.publicUrl : comprimida;

        nuevasFotos.push({
          id: idLocal,
          imagenUrl: urlFinal,
          nombreArchivo: archivo.name,
          conteoColores: {},
          notaIa: subida.ok
            ? "Analizando paquetes con ARIA..."
            : `Cargada localmente (${subida.error}). Ajusta cantidades abajo.`,
          analizadoPorIa: false,
        });
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "No se pudo procesar una de las fotografías"
        );
      }
    }

    setSubiendoFotos(false);
    if (nuevasFotos.length === 0) return;

    setFotosActuales((prev) => [...prev, ...nuevasFotos]);

    // Disparar conteo multimodal con ARIA en paralelo por cada foto subida con URL pública
    await Promise.all(
      nuevasFotos
        .filter((f) => /^https?:\/\//i.test(f.imagenUrl))
        .map((f) => analizarFotoIndividualConIa(f.id, f.imagenUrl))
    );
  };

  const handleAjustarColorFoto = (fotoId: string, claveColor: string, delta: number) => {
    setFotosActuales((prev) =>
      prev.map((f) => {
        if (f.id !== fotoId) return f;
        const actual = Number(f.conteoColores[claveColor]) || 0;
        const siguiente = Math.max(0, actual + delta);
        const copia = { ...f.conteoColores };
        if (siguiente === 0) delete copia[claveColor];
        else copia[claveColor] = siguiente;
        return { ...f, conteoColores: copia };
      })
    );
  };

  const handleAgregarCorteManualSinFoto = () => {
    setFotosActuales((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        imagenUrl: "",
        nombreArchivo: "Conteo directo en cuarto frío",
        conteoColores: { rojo: 0, blanco: 0, rosado: 0 },
        notaIa: "Lote manual sin fotografía",
        analizadoPorIa: false,
      },
    ]);
  };

  const handleGuardarInventario = async () => {
    if (fotosActuales.length === 0) {
      setErrorMsg("Adjunta al menos una foto de los bonches o agrega un lote de conteo.");
      return;
    }
    setGuardando(true);
    setErrorMsg(null);
    setMensajeExito(null);

    const res = await guardarCorteInventarioRosasAction({
      negocio: negNorm,
      resumenColores: consolidadoEnCurso.resumenColores,
      fotos: fotosActuales,
      observaciones,
    });

    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    const nuevoHistorial = [res.corte, ...historial.filter((h) => h.id !== res.corte.id)];
    setUltimoCorte(res.corte);
    setHistorial(nuevoHistorial);
    setFotosActuales([]);
    setObservaciones("");
    setMensajeExito(
      `Inventario consolidado publicado: ${formatearFechaCorteInventario(res.corte.fechaCorte)} (${res.corte.totalPaquetes} paquetes).`
    );

    try {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ultimoCorte: res.corte, historial: nuevoHistorial })
      );
    } catch {
      // Ignorar
    }
  };

  const columnasHistorial = useMemo<ColumnaDataGrid<CorteInventarioRosas>[]>(
    () => [
      {
        id: "fecha",
        encabezado: "Fecha y Hora del Corte",
        valor: (c) => new Date(c.fechaCorte).getTime(),
        render: (c) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
              {formatearFechaCorteInventario(c.fechaCorte)}
            </strong>
            <span style={{ fontSize: "0.73rem", color: "#64748B" }}>
              Por: {c.registradoNombre}
            </span>
          </div>
        ),
      },
      {
        id: "total",
        encabezado: "Total Bonches",
        valor: (c) => Number(c.totalPaquetes) || 0,
        render: (c) => (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              borderRadius: "999px",
              background: "#ECFDF5",
              color: "#065F46",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            {c.totalPaquetes} paq.
          </span>
        ),
      },
      {
        id: "desglose",
        encabezado: "Consolidado por Colores",
        valor: (c) => formatearResumenInventarioTexto(c.resumenColores),
        render: (c) => (
          <span style={{ fontSize: "0.83rem", color: "#1E293B" }}>
            {formatearResumenInventarioTexto(c.resumenColores)}
          </span>
        ),
      },
      {
        id: "fotos",
        encabezado: "Fotos",
        valor: (c) => (Array.isArray(c.fotos) ? c.fotos.length : 0),
        render: (c) => (
          <span style={{ fontSize: "0.78rem", color: "#475569" }}>
            {Array.isArray(c.fotos) ? c.fotos.filter((f) => f.imagenUrl).length : 0} foto(s)
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* CABECERA PERMANENTE DEL ÚLTIMO INVENTARIO REALIZADO */}
      <div
        style={{
          padding: "18px 20px",
          borderRadius: "16px",
          background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
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
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(236, 127, 167, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F472B6",
              }}
            >
              <Flower2 size={22} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.73rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#94A3B8",
                  fontWeight: 700,
                }}
              >
                Último Inventario Realizado en Tienda
              </div>
              <div style={{ fontSize: "1.12rem", fontWeight: 700, marginTop: "2px" }}>
                {ultimoCorte ? (
                  <>
                    <span style={{ color: "#34D399" }}>
                      {formatearFechaCorteInventario(ultimoCorte.fechaCorte)}
                    </span>
                    {" : "}
                    <span>{formatearResumenInventarioTexto(ultimoCorte.resumenColores)}</span>
                  </>
                ) : (
                  <span style={{ color: "#CBD5E1" }}>
                    Aún no se ha registrado un corte de inventario fotográfico
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {ultimoCorte && (
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  background: "rgba(52, 211, 153, 0.16)",
                  border: "1px solid rgba(52, 211, 153, 0.4)",
                  color: "#6EE7B7",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                }}
              >
                Total: {ultimoCorte.totalPaquetes} paquetes
              </div>
            )}
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => void recargar()}
              title="Actualizar último inventario"
              aria-label="Actualizar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
              <span className="btn-texto-responsive">Actualizar</span>
            </button>
          </div>
        </div>

        {ultimoCorte && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {COLORES_ROSAS_ESTANDAR.map((def) => {
              const cant = Number(ultimoCorte.resumenColores?.[def.clave]) || 0;
              if (cant <= 0) return null;
              return (
                <span
                  key={def.clave}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 11px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.1)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: def.colorHex,
                      border: "1px solid rgba(255,255,255,0.6)",
                    }}
                  />
                  {cant} {def.etiqueta}
                </span>
              );
            })}
            <span style={{ fontSize: "0.75rem", color: "#94A3B8", marginLeft: "6px" }}>
              <Clock size={12} style={{ verticalAlign: "middle", marginRight: "4px" }} />
              Registrado por {ultimoCorte.registradoNombre}
            </span>
          </div>
        )}
      </div>

      {migracionPendiente && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            color: "#92400E",
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
            en Supabase para habilitar la persistencia del inventario.
          </span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: "0.83rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {mensajeExito && (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: "10px",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            fontSize: "0.84rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* SECCIÓN DE NUEVO CORTE POR FOTOS CON ARIA */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
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
              Nuevo Conteo Fotográfico de Bonches con IA (ARIA)
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#64748B" }}>
              Toma o sube las fotografías de los paquetes de rosas. ARIA cuenta cada foto por color
              y abajo consolida automáticamente el total.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <label
              title="Tomar foto directa de los paquetes de rosas con la cámara"
              aria-label="Tomar foto de bonches"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 14px",
                borderRadius: "10px",
                background: "#0F172A",
                color: "#FFFFFF",
                fontSize: "0.83rem",
                fontWeight: 700,
                cursor: subiendoFotos ? "wait" : "pointer",
              }}
            >
              {subiendoFotos ? <Loader2 size={15} /> : <Camera size={15} />}
              <span>Tomar Foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleSeleccionarFotos(e)}
                disabled={subiendoFotos}
                style={{ display: "none" }}
              />
            </label>

            <label
              title="Adjuntar una o varias fotos desde galería o WhatsApp"
              aria-label="Subir fotos de bonches"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "9px 14px",
                borderRadius: "10px",
                background: "#EC7FA7",
                color: "#FFFFFF",
                fontSize: "0.83rem",
                fontWeight: 700,
                cursor: subiendoFotos ? "wait" : "pointer",
              }}
            >
              {subiendoFotos ? <Loader2 size={15} /> : <Upload size={15} />}
              <span>Subir Fotos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void handleSeleccionarFotos(e)}
                disabled={subiendoFotos}
                style={{ display: "none" }}
              />
            </label>

            <button
              type="button"
              onClick={handleAgregarCorteManualSinFoto}
              title="Registrar conteo manual sin adjuntar imagen"
              aria-label="Conteo manual"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 13px",
                borderRadius: "10px",
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#334155",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={15} />
              <span>Lote Manual</span>
            </button>
          </div>
        </div>

        {/* TARJETAS INDIVIDUALES POR FOTO */}
        {fotosActuales.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {fotosActuales.map((foto, idx) => {
              const analizando = Boolean(analizandoFotoIds[foto.id]);
              const subtotalFoto = Object.values(foto.conteoColores).reduce(
                (acc, v) => acc + (Number(v) || 0),
                0
              );

              return (
                <div
                  key={foto.id}
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "14px",
                    background: "#F8FAFC",
                    display: "grid",
                    gridTemplateColumns: foto.imagenUrl
                      ? "minmax(140px, 200px) minmax(0, 1fr)"
                      : "minmax(0, 1fr)",
                    gap: "16px",
                    alignItems: "start",
                  }}
                >
                  {foto.imagenUrl && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <img
                        src={foto.imagenUrl}
                        alt={`Foto bonches ${idx + 1}`}
                        style={{
                          width: "100%",
                          height: "155px",
                          objectFit: "cover",
                          borderRadius: "10px",
                          border: "1px solid #CBD5E1",
                        }}
                      />
                      {/^https?:\/\//i.test(foto.imagenUrl) && (
                        <button
                          type="button"
                          onClick={() => void analizarFotoIndividualConIa(foto.id, foto.imagenUrl)}
                          disabled={analizando}
                          title="Volver a contar esta fotografía con ARIA IA"
                          aria-label="Recontar con IA"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: "#0F172A",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: analizando ? "wait" : "pointer",
                          }}
                        >
                          {analizando ? <Loader2 size={13} /> : <Sparkles size={13} />}
                          <span>{analizando ? "Contando..." : "Recontar IA"}</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "0.9rem", color: "#0F172A" }}>
                          Foto #{idx + 1} ({subtotalFoto} paq.)
                        </strong>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.75rem",
                            color: analizando ? "#0284C7" : "#475569",
                          }}
                        >
                          <Bot size={13} />
                          {analizando
                            ? "ARIA contando paquetes por color..."
                            : foto.notaIa || "Verifica o ajusta con +/-"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setFotosActuales((prev) => prev.filter((x) => x.id !== foto.id))
                        }
                        title="Quitar esta foto del conteo"
                        aria-label="Quitar foto"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "5px 9px",
                          borderRadius: "8px",
                          border: "1px solid #FECACA",
                          background: "#FEF2F2",
                          color: "#B91C1C",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Quitar</span>
                      </button>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
                        gap: "8px",
                      }}
                    >
                      {COLORES_ROSAS_ESTANDAR.map((def) => {
                        const cant = Number(foto.conteoColores[def.clave]) || 0;
                        return (
                          <div
                            key={def.clave}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 9px",
                              borderRadius: "10px",
                              background: cant > 0 ? def.fondoHex : "#FFFFFF",
                              border: `1px solid ${cant > 0 ? def.colorHex : "#E2E8F0"}`,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: cant > 0 ? 700 : 500,
                                color: cant > 0 ? def.textoHex : "#475569",
                              }}
                            >
                              {def.etiqueta}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                              <button
                                type="button"
                                onClick={() => handleAjustarColorFoto(foto.id, def.clave, -1)}
                                title={`Restar 1 ${def.etiqueta}`}
                                aria-label={`Restar ${def.etiqueta}`}
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                  background: "#FFFFFF",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <Minus size={12} />
                              </button>
                              <strong
                                style={{
                                  minWidth: "20px",
                                  textAlign: "center",
                                  fontSize: "0.84rem",
                                  color: "#0F172A",
                                }}
                              >
                                {cant}
                              </strong>
                              <button
                                type="button"
                                onClick={() => handleAjustarColorFoto(foto.id, def.clave, 1)}
                                title={`Sumar 1 ${def.etiqueta}`}
                                aria-label={`Sumar ${def.etiqueta}`}
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                  background: "#FFFFFF",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* RESUMEN CONSOLIDADO DE TODAS LAS FOTOS ANTES DE GUARDAR */}
            <div
              style={{
                padding: "16px 18px",
                borderRadius: "14px",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                <strong style={{ fontSize: "0.95rem", color: "#065F46" }}>
                  Consolidado Total ({fotosActuales.length} foto/lote):{" "}
                  {consolidadoEnCurso.totalPaquetes} paquetes
                </strong>
                <span style={{ fontSize: "0.84rem", color: "#047857" }}>
                  {formatearResumenInventarioTexto(consolidadoEnCurso.resumenColores)}
                </span>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Nota opcional (ej. Rosas frescas llegada de finca Tabacundo)..."
                  style={{
                    marginTop: "6px",
                    padding: "8px 11px",
                    borderRadius: "8px",
                    border: "1px solid #A7F3D0",
                    background: "#FFFFFF",
                    fontSize: "0.82rem",
                    maxWidth: "460px",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => void handleGuardarInventario()}
                disabled={guardando}
                title="Consolidar y publicar este inventario como el corte vigente de la tienda"
                aria-label="Guardar inventario"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "11px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                  cursor: guardando ? "wait" : "pointer",
                }}
              >
                {guardando ? <Loader2 size={16} /> : <Save size={16} />}
                <span>{guardando ? "Guardando..." : "Guardar Corte"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HISTORIAL DE CORTES EN DATAGRID ESTÁNDAR */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, color: "#0F172A" }}>
          Historial de Cortes de Inventario de Rosas
        </h3>
        <DataGrid
          columnas={columnasHistorial}
          filas={historial}
          idFila={(c) => c.id}
          nombreExportacion={`inventario-rosas-${negNorm}`}
          contenidoExpandible={(c) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0" }}>
              {c.observaciones && (
                <div style={{ fontSize: "0.82rem", color: "#334155" }}>
                  <strong>Observaciones:</strong> {c.observaciones}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {(c.fotos || []).map((f, i) => (
                  <div
                    key={f.id || i}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "8px",
                      background: "#FFFFFF",
                      width: "190px",
                    }}
                  >
                    {f.imagenUrl && (
                      <img
                        src={f.imagenUrl}
                        alt={`Corte foto ${i + 1}`}
                        style={{
                          width: "100%",
                          height: "110px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          marginBottom: "6px",
                        }}
                      />
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#0F172A", fontWeight: 600 }}>
                      {formatearResumenInventarioTexto(f.conteoColores)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
