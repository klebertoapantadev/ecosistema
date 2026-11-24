"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  exportarHojasAExcel,
  leerHojasDesdeExcelBuffer,
} from "@eco/datagrid";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  actualizarProductosMasivoAction,
  type CategoriaCatalogo,
  type ProductoCatalogo,
  type ResultadoActualizacionMasivaCatalogo,
} from "../acciones";
import {
  calcularPlanActualizacionMasiva,
  construirHojasExcelCatalogo,
  exportarCatalogoAMarkdown,
  parsearCatalogoDesdeHojasExcel,
  parsearCatalogoDesdeMarkdown,
  type PlanActualizacionMasiva,
} from "../utils/catalogoMasivo";

export interface PropsModalExportarImportarCatalogo {
  abierto: boolean;
  negocio: string;
  productos: ProductoCatalogo[];
  productosFiltrados?: ProductoCatalogo[];
  categorias: CategoriaCatalogo[];
  onCerrar: () => void;
  onCatalogoActualizado: () => Promise<void> | void;
}

type PestanaModal = "ver_md" | "exportar" | "importar";
type AlcanceExportacion = "todos" | "activos" | "filtrados";

const PROMPT_IA_SUGERIDO = `Analiza el catálogo comercial en formato Markdown que te comparto a continuación.
Objetivo:
1. Optimiza descripciones (claras, persuasivas y sin clichés), beneficios (viñetas concretas), usos/ocasiones y etiquetas SEO.
2. Revisa coherencia de precios, IVA, tiempos de entrega y configuración floral (colores de rosas y tipo de envoltorio).
3. Devuélveme el archivo Markdown ACTUALIZADO conservando EXACTAMENTE la estructura original:
   - NO modifiques los valores de \`pro_id\` ni \`var_id\`.
   - Mantén los encabezados \`## PRODUCTO: ...\`, \`### Descripción\`, \`### Beneficios\`, \`### Requisitos\` y la tabla \`### Variantes\`.
   - Usa únicamente categorías existentes en la lista de "Categorías / Colecciones disponibles".`;

export function ModalExportarImportarCatalogo({
  abierto,
  negocio,
  productos,
  productosFiltrados,
  categorias,
  onCerrar,
  onCatalogoActualizado,
}: PropsModalExportarImportarCatalogo) {
  const [pestana, setPestana] = useState<PestanaModal>("ver_md");
  const [alcance, setAlcance] = useState<AlcanceExportacion>("todos");
  const [copiadoMd, setCopiadoMd] = useState(false);
  const [copiadoPrompt, setCopiadoPrompt] = useState(false);

  // Estado de Importación Masiva
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const [nombreArchivoCargado, setNombreArchivoCargado] = useState<string | null>(null);
  const [textoMdPegado, setTextoMdPegado] = useState("");
  const [planImportacion, setPlanImportacion] = useState<PlanActualizacionMasiva | null>(null);
  const [seleccionadosIds, setSeleccionadosIds] = useState<Record<string, boolean>>({});
  const [analizando, setAnalizando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [errorImportacion, setErrorImportacion] = useState<string | null>(null);
  const [resultadoAplicacion, setResultadoAplicacion] =
    useState<ResultadoActualizacionMasivaCatalogo | null>(null);

  const productosAlcance = useMemo(() => {
    if (alcance === "activos") {
      return productos.filter(
        (p) => p.pro_activo !== false && p.pro_detalle_producto?.pro_activo !== false
      );
    }
    if (alcance === "filtrados" && productosFiltrados && productosFiltrados.length > 0) {
      return productosFiltrados;
    }
    return productos;
  }, [alcance, productos, productosFiltrados]);

  const markdownGenerado = useMemo(() => {
    if (!abierto) return "";
    return exportarCatalogoAMarkdown(productosAlcance, categorias, { negocio });
  }, [abierto, productosAlcance, categorias, negocio]);

  if (!abierto) return null;

  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const prefijoArchivo = `catalogo-${negocio.toLowerCase()}-${fechaArchivo}`;

  const handleCopiarMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownGenerado);
      setCopiadoMd(true);
      setTimeout(() => setCopiadoMd(false), 2400);
    } catch {
      setErrorImportacion("No se pudo copiar al portapapeles. Usa Descargar .md.");
    }
  };

  const handleCopiarPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_IA_SUGERIDO);
      setCopiadoPrompt(true);
      setTimeout(() => setCopiadoPrompt(false), 2400);
    } catch {
      // Silencioso si el navegador bloquea clipboard
    }
  };

  const handleDescargarMd = () => {
    const blob = new Blob([markdownGenerado], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefijoArchivo}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDescargarExcel = () => {
    const hojas = construirHojasExcelCatalogo(productosAlcance, categorias, { negocio });
    exportarHojasAExcel(`${prefijoArchivo}.xlsx`, hojas);
  };

  const inicializarSeleccionDesdePlan = (plan: PlanActualizacionMasiva) => {
    const mapa: Record<string, boolean> = {};
    for (const it of plan.items) {
      if (it.estado === "CON_CAMBIOS" && it.pro_id) {
        mapa[it.pro_id] = true;
      }
    }
    setSeleccionadosIds(mapa);
  };

  const handleCargarArchivo = async (file: File) => {
    setAnalizando(true);
    setErrorImportacion(null);
    setResultadoAplicacion(null);
    setNombreArchivoCargado(file.name);

    try {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext === "md" || ext === "markdown" || ext === "txt") {
        const texto = await file.text();
        setTextoMdPegado(texto);
        const parsed = parsearCatalogoDesdeMarkdown(texto);
        const plan = calcularPlanActualizacionMasiva(productos, categorias, parsed, { negocio });
        setPlanImportacion(plan);
        inicializarSeleccionDesdePlan(plan);
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        const buffer = await file.arrayBuffer();
        const hojas = leerHojasDesdeExcelBuffer(buffer);
        const parsed = parsearCatalogoDesdeHojasExcel(hojas);
        const plan = calcularPlanActualizacionMasiva(productos, categorias, parsed, { negocio });
        setPlanImportacion(plan);
        inicializarSeleccionDesdePlan(plan);
      } else {
        setErrorImportacion(
          "Formato no soportado. Carga un archivo .md, .xlsx, .xls o .csv."
        );
      }
    } catch (err: any) {
      setErrorImportacion(
        err?.message || "No se pudo leer el archivo seleccionado. Verifica que no esté dañado."
      );
    } finally {
      setAnalizando(false);
    }
  };

  const handleAnalizarTextoPegado = () => {
    setErrorImportacion(null);
    setResultadoAplicacion(null);
    if (!textoMdPegado.trim()) {
      setErrorImportacion("Pega primero el contenido Markdown actualizado o selecciona un archivo.");
      return;
    }
    setNombreArchivoCargado("Markdown pegado manualmente");
    const parsed = parsearCatalogoDesdeMarkdown(textoMdPegado);
    const plan = calcularPlanActualizacionMasiva(productos, categorias, parsed, { negocio });
    setPlanImportacion(plan);
    inicializarSeleccionDesdePlan(plan);
  };

  const itemsSeleccionadosParaAplicar = useMemo(() => {
    if (!planImportacion) return [];
    return planImportacion.items.filter(
      (it) => it.estado === "CON_CAMBIOS" && it.pro_id && it.patch && seleccionadosIds[it.pro_id]
    );
  }, [planImportacion, seleccionadosIds]);

  const handleAplicarActualizacionMasiva = async () => {
    if (itemsSeleccionadosParaAplicar.length === 0 || aplicando) return;
    setAplicando(true);
    setErrorImportacion(null);
    setResultadoAplicacion(null);

    try {
      const patches = itemsSeleccionadosParaAplicar
        .map((it) => it.patch!)
        .filter(Boolean);

      const res = await actualizarProductosMasivoAction({
        negocio,
        patches,
      });

      setResultadoAplicacion(res);
      if (!res.ok && res.error) {
        setErrorImportacion(res.error);
      }
      if (res.actualizados > 0) {
        await onCatalogoActualizado();
      }
    } catch (err: any) {
      setErrorImportacion(err?.message || "Error inesperado al aplicar cambios masivos.");
    } finally {
      setAplicando(false);
    }
  };

  const contarActivos = productos.filter(
    (p) => p.pro_activo !== false && p.pro_detalle_producto?.pro_activo !== false
  ).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Exportar e Importar Catálogo Masivo"
      onClick={() => {
        if (!aplicando) onCerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9980,
        background: "rgba(15, 23, 42, 0.58)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "960px",
          maxHeight: "92vh",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E6E2DA",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera oscura */}
        <div
          style={{
            background: "#221E1B",
            color: "#FFFFFF",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.12)",
                color: "#7EA389",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet size={19} />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "0.96rem",
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                Catálogo Masivo — Ver, Exportar (MD / Excel) e Importar
              </h2>
              <div style={{ fontSize: "0.74rem", color: "#B8B0A4", marginTop: "2px" }}>
                Exporta todo tu catálogo para analizarlo con IA, edita el MD o Excel y cárgalo para actualizar masivamente.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            disabled={aplicando}
            title="Cerrar ventana"
            aria-label="Cerrar"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px",
              color: "#D5CFC4",
              width: "34px",
              height: "34px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: aplicando ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de pestañas */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            padding: "10px 18px",
            background: "#FAF8F5",
            borderBottom: "1px solid #E6E2DA",
          }}
        >
          <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
            {(
              [
                { id: "ver_md" as const, label: "Ver y Copiar MD", icono: FileText },
                { id: "exportar" as const, label: "Exportar Archivos", icono: Download },
                { id: "importar" as const, label: "Importar Masivo", icono: Upload },
              ] as const
            ).map((t) => {
              const Icono = t.icono;
              const activa = pestana === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPestana(t.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 13px",
                    borderRadius: "9px",
                    border: activa ? "1px solid #221E1B" : "1px solid #D5CFC4",
                    background: activa ? "#221E1B" : "#FFFFFF",
                    color: activa ? "#FFFFFF" : "#44403C",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Icono size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {pestana !== "importar" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#6E6861" }}>
                Alcance:
              </span>
              {(
                [
                  { id: "todos" as const, texto: `Todos (${productos.length})` },
                  { id: "activos" as const, texto: `Activos (${contarActivos})` },
                  ...(productosFiltrados &&
                  productosFiltrados.length > 0 &&
                  productosFiltrados.length !== productos.length
                    ? [
                        {
                          id: "filtrados" as const,
                          texto: `Filtrados (${productosFiltrados.length})`,
                        },
                      ]
                    : []),
                ] as const
              ).map((op) => {
                const sel = alcance === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setAlcance(op.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: sel ? "1px solid #2F4737" : "1px solid #D5CFC4",
                      background: sel ? "#EAF3ED" : "#FFFFFF",
                      color: sel ? "#1F352C" : "#57524C",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {op.texto}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contenido principal con scroll */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* TAB 1: VER Y COPIAR MARKDOWN COMPLETO */}
          {pestana === "ver_md" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "0.82rem", color: "#57524C" }}>
                  Mostrando <strong>{productosAlcance.length}</strong> producto(s) con todas sus
                  variantes, descripciones, beneficios, precios, canales y personalización floral.
                </div>
                <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void handleCopiarMarkdown()}
                    title="Copiar todo el Markdown al portapapeles para pegar en IA"
                    aria-label="Copiar Todo"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 13px",
                      borderRadius: "8px",
                      border: "none",
                      background: copiadoMd ? "#166534" : "#2F4737",
                      color: "#FFFFFF",
                      fontSize: "0.79rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {copiadoMd ? <Check size={14} /> : <ClipboardCopy size={14} />}
                    <span>{copiadoMd ? "Copiado" : "Copiar Todo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDescargarMd}
                    title="Descargar archivo Markdown (.md)"
                    aria-label="Descargar MD"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      color: "#221E1B",
                      fontSize: "0.79rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <FileText size={14} />
                    <span>Descargar .md</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDescargarExcel}
                    title="Descargar libro Excel (.xlsx) con Productos y Variantes"
                    aria-label="Descargar Excel"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: "1px solid #C6DEC9",
                      background: "#EAF3ED",
                      color: "#1F352C",
                      fontSize: "0.79rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Descargar Excel</span>
                  </button>
                </div>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: "14px",
                  borderRadius: "12px",
                  background: "#FAF8F5",
                  border: "1px solid #E6E2DA",
                  color: "#221E1B",
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "52vh",
                  overflowY: "auto",
                }}
              >
                {markdownGenerado}
              </pre>
            </>
          )}

          {/* TAB 2: EXPORTAR ARCHIVOS + GUÍA PARA IA */}
          {pestana === "exportar" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "14px",
                }}
              >
                {/* Tarjeta Markdown */}
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "14px",
                    border: "1px solid #E6E2DA",
                    background: "#FAF8F5",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={20} color="#2F4737" />
                    <strong style={{ fontSize: "0.94rem", color: "#1F1C19" }}>
                      Formato Markdown (.md) — Ideal para IA
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.81rem", color: "#57524C", lineHeight: 1.5 }}>
                    Incluye cada producto en un bloque legible con <strong>descripción completa</strong>,
                    viñetas de beneficios, personalización floral, logística y tabla de variantes.
                    Puedes subir el `.md` a ChatGPT, Claude o Gemini, pedir mejoras masivas y re-importarlo aquí.
                  </p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "auto", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleDescargarMd}
                      title="Descargar archivo .md"
                      aria-label="Descargar MD"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 14px",
                        borderRadius: "9px",
                        border: "none",
                        background: "#221E1B",
                        color: "#FFFFFF",
                        fontSize: "0.81rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={14} />
                      <span>Descargar .md</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopiarMarkdown()}
                      title="Copiar contenido Markdown"
                      aria-label="Copiar MD"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 14px",
                        borderRadius: "9px",
                        border: "1px solid #D5CFC4",
                        background: "#FFFFFF",
                        color: "#221E1B",
                        fontSize: "0.81rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {copiadoMd ? <Check size={14} color="#166534" /> : <ClipboardCopy size={14} />}
                      <span>{copiadoMd ? "Copiado" : "Copiar MD"}</span>
                    </button>
                  </div>
                </div>

                {/* Tarjeta Excel */}
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "14px",
                    border: "1px solid #C6DEC9",
                    background: "#F4FAF6",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileSpreadsheet size={20} color="#166534" />
                    <strong style={{ fontSize: "0.94rem", color: "#1F1C19" }}>
                      Formato Excel (.xlsx) — Multi-hoja
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.81rem", color: "#3A5A46", lineHeight: 1.5 }}>
                    Genera 3 hojas sincronizadas: <strong>Productos</strong> (todos los atributos),
                    <strong> Variantes</strong> (precios, tamaños, SKU, IVA, envoltorio) y{" "}
                    <strong>Guia_IA</strong>. Edítalo en Excel, Google Sheets o IA y vuelve a subirlo.
                  </p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                    <button
                      type="button"
                      onClick={handleDescargarExcel}
                      title="Descargar libro Excel .xlsx"
                      aria-label="Descargar Excel"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "9px 14px",
                        borderRadius: "9px",
                        border: "none",
                        background: "#2F4737",
                        color: "#FFFFFF",
                        fontSize: "0.81rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={14} />
                      <span>Descargar Excel</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Prompt listo para IA */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid #E6E2DA",
                  background: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.83rem",
                      fontWeight: 800,
                      color: "#1F1C19",
                    }}
                  >
                    <Sparkles size={15} color="#8F6A2E" />
                    <span>Prompt sugerido para analizar y actualizar con IA</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopiarPrompt()}
                    title="Copiar prompt sugerido"
                    aria-label="Copiar Prompt"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "7px",
                      border: "1px solid #D5CFC4",
                      background: "#FAF8F5",
                      color: "#221E1B",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {copiadoPrompt ? <Check size={13} color="#166534" /> : <ClipboardCopy size={13} />}
                    <span>{copiadoPrompt ? "Copiado" : "Copiar Prompt"}</span>
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    background: "#FAF8F5",
                    border: "1px solid #EFECE6",
                    fontSize: "0.75rem",
                    color: "#44403C",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.45,
                    fontFamily: "inherit",
                  }}
                >
                  {PROMPT_IA_SUGERIDO}
                </pre>
              </div>
            </>
          )}

          {/* TAB 3: IMPORTAR ACTUALIZACIÓN MASIVA */}
          {pestana === "importar" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                  gap: "12px",
                }}
              >
                {/* Opción A: Subir archivo .md o .xlsx */}
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1.5px dashed #B8B0A4",
                    background: "#FAF8F5",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: "10px",
                  }}
                >
                  <Upload size={26} color="#2F4737" />
                  <div>
                    <strong style={{ fontSize: "0.86rem", color: "#1F1C19", display: "block" }}>
                      Subir archivo .md o Excel (.xlsx / .csv)
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "#6E6861" }}>
                      {nombreArchivoCargado
                        ? `Cargado: ${nombreArchivoCargado}`
                        : "Selecciona el archivo editado para ver la vista previa de cambios antes de guardar."}
                    </span>
                  </div>
                  <input
                    ref={inputArchivoRef}
                    type="file"
                    accept=".md,.markdown,.txt,.xlsx,.xls,.csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleCargarArchivo(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={analizando || aplicando}
                    onClick={() => inputArchivoRef.current?.click()}
                    title="Seleccionar archivo .md o .xlsx"
                    aria-label="Seleccionar Archivo"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 15px",
                      borderRadius: "9px",
                      border: "none",
                      background: "#221E1B",
                      color: "#FFFFFF",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: analizando ? "wait" : "pointer",
                    }}
                  >
                    {analizando ? <Loader2 size={14} /> : <Upload size={14} />}
                    <span>Seleccionar Archivo</span>
                  </button>
                </div>

                {/* Opción B: Pegar Markdown directo desde la IA */}
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #E6E2DA",
                    background: "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    htmlFor="eco-pegar-md-masivo"
                    style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1F1C19" }}
                  >
                    O pega el Markdown actualizado directo desde tu IA:
                  </label>
                  <textarea
                    id="eco-pegar-md-masivo"
                    rows={4}
                    value={textoMdPegado}
                    onChange={(e) => setTextoMdPegado(e.target.value)}
                    placeholder="Pega aquí los bloques ## PRODUCTO: ... devueltos por ChatGPT / Claude / Gemini..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      fontSize: "0.76rem",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      disabled={!textoMdPegado.trim() || analizando || aplicando}
                      onClick={handleAnalizarTextoPegado}
                      title="Analizar diferencias antes de guardar"
                      aria-label="Analizar Cambios"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 13px",
                        borderRadius: "8px",
                        border: "1px solid #2F4737",
                        background: "#EAF3ED",
                        color: "#1F352C",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: textoMdPegado.trim() ? "pointer" : "not-allowed",
                        opacity: textoMdPegado.trim() ? 1 : 0.55,
                      }}
                    >
                      <Sparkles size={13} />
                      <span>Analizar Cambios</span>
                    </button>
                  </div>
                </div>
              </div>

              {errorImportacion && (
                <div
                  role="alert"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#B91C1C",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorImportacion}</span>
                </div>
              )}

              {resultadoAplicacion && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    background:
                      resultadoAplicacion.fallidos === 0 ? "#F0FDF4" : "#FFFBEB",
                    border:
                      resultadoAplicacion.fallidos === 0
                        ? "1px solid #BBF7D0"
                        : "1px solid #FDE68A",
                    color:
                      resultadoAplicacion.fallidos === 0 ? "#166534" : "#92400E",
                    fontSize: "0.82rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800 }}>
                    <CheckCircle2 size={17} />
                    <span>
                      Actualización completada: {resultadoAplicacion.actualizados} producto(s)
                      actualizados
                      {resultadoAplicacion.fallidos > 0
                        ? ` · ${resultadoAplicacion.fallidos} con error`
                        : "."}
                    </span>
                  </div>
                  {resultadoAplicacion.detalles
                    .filter((d) => !d.ok)
                    .map((d) => (
                      <div key={d.pro_id} style={{ fontSize: "0.76rem", color: "#B91C1C" }}>
                        • <strong>{d.nombre}:</strong> {d.error}
                      </div>
                    ))}
                </div>
              )}

              {/* Vista Previa de Cambios (Diff) */}
              {planImportacion && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Resumen numérico */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: "#FAF8F5",
                      border: "1px solid #E6E2DA",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "0.76rem", fontWeight: 700 }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "999px",
                          background: "#FFFFFF",
                          border: "1px solid #D5CFC4",
                          color: "#221E1B",
                        }}
                      >
                        Leídos: {planImportacion.totalLeidos}
                      </span>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "999px",
                          background: "#DCFCE7",
                          color: "#166534",
                        }}
                      >
                        Con cambios: {planImportacion.totalConCambios}
                      </span>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "999px",
                          background: "#F4F2EE",
                          color: "#57524C",
                        }}
                      >
                        Sin cambios: {planImportacion.totalSinCambios}
                      </span>
                      {(planImportacion.totalNoEncontrados > 0 ||
                        planImportacion.totalErrores > 0) && (
                        <span
                          style={{
                            padding: "3px 9px",
                            borderRadius: "999px",
                            background: "#FEF3C7",
                            color: "#92400E",
                          }}
                        >
                          Omitidos: {planImportacion.totalNoEncontrados + planImportacion.totalErrores}
                        </span>
                      )}
                    </div>

                    {planImportacion.totalConCambios > 0 && (
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => inicializarSeleccionDesdePlan(planImportacion)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid #D5CFC4",
                            background: "#FFFFFF",
                            color: "#221E1B",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Marcar todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeleccionadosIds({})}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid #D5CFC4",
                            background: "#FFFFFF",
                            color: "#57524C",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Desmarcar
                        </button>
                      </div>
                    )}
                  </div>

                  {planImportacion.advertenciasGlobales.map((adv, idx) => (
                    <div
                      key={`adv-g-${idx}`}
                      style={{
                        padding: "8px 11px",
                        borderRadius: "8px",
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        color: "#92400E",
                        fontSize: "0.77rem",
                      }}
                    >
                      {adv}
                    </div>
                  ))}

                  {/* Lista detallada de diffs */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      maxHeight: "34vh",
                      overflowY: "auto",
                    }}
                  >
                    {planImportacion.items
                      .filter((it) => it.estado !== "SIN_CAMBIOS")
                      .map((it) => {
                        const esEditable = it.estado === "CON_CAMBIOS" && Boolean(it.pro_id);
                        const marcado = Boolean(it.pro_id && seleccionadosIds[it.pro_id]);

                        return (
                          <div
                            key={it.clave}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "10px",
                              border:
                                it.estado === "CON_CAMBIOS"
                                  ? "1px solid #C6DEC9"
                                  : "1px solid #FDE68A",
                              background:
                                it.estado === "CON_CAMBIOS" ? "#FFFFFF" : "#FFFBEB",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <label
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  cursor: esEditable ? "pointer" : "default",
                                  fontWeight: 800,
                                  fontSize: "0.82rem",
                                  color: "#1F1C19",
                                }}
                              >
                                {esEditable && (
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    onChange={(e) => {
                                      if (!it.pro_id) return;
                                      setSeleccionadosIds((prev) => ({
                                        ...prev,
                                        [it.pro_id!]: e.target.checked,
                                      }));
                                    }}
                                    style={{ width: "16px", height: "16px", accentColor: "#2F4737" }}
                                  />
                                )}
                                <span>{it.nombreActual}</span>
                              </label>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  background:
                                    it.estado === "CON_CAMBIOS" ? "#EAF3ED" : "#FEF3C7",
                                  color:
                                    it.estado === "CON_CAMBIOS" ? "#166534" : "#92400E",
                                }}
                              >
                                {it.estado === "CON_CAMBIOS"
                                  ? `${it.cambios.length} cambio(s)`
                                  : it.estado === "NO_ENCONTRADO"
                                    ? "No encontrado"
                                    : "Omitido"}
                              </span>
                            </div>

                            {it.cambios.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "24px" }}>
                                {it.cambios.map((c) => (
                                  <div
                                    key={`${it.clave}-${c.campo}`}
                                    style={{
                                      fontSize: "0.74rem",
                                      color: "#44403C",
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    <strong>{c.etiqueta}:</strong>{" "}
                                    <span style={{ color: "#991B1B", textDecoration: "line-through" }}>
                                      {c.antes}
                                    </span>{" "}
                                    →{" "}
                                    <span style={{ color: "#166534", fontWeight: 700 }}>
                                      {c.despues}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {it.advertencias.map((adv, idxAdv) => (
                              <div
                                key={`${it.clave}-adv-${idxAdv}`}
                                style={{
                                  fontSize: "0.73rem",
                                  color: "#92400E",
                                  paddingLeft: esEditable ? "24px" : 0,
                                }}
                              >
                                ⚠️ {adv}
                              </div>
                            ))}
                          </div>
                        );
                      })}

                    {planImportacion.totalConCambios === 0 &&
                      planImportacion.totalNoEncontrados === 0 &&
                      planImportacion.totalErrores === 0 && (
                        <div
                          style={{
                            padding: "16px",
                            borderRadius: "10px",
                            background: "#F4F2EE",
                            textAlign: "center",
                            fontSize: "0.82rem",
                            color: "#57524C",
                          }}
                        >
                          Todos los productos del archivo coinciden exactamente con el catálogo actual (0 cambios detectados).
                        </div>
                      )}
                  </div>

                  {/* Botón aplicar cambios masivos */}
                  {planImportacion.totalConCambios > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "8px",
                        paddingTop: "6px",
                        borderTop: "1px solid #E6E2DA",
                      }}
                    >
                      <button
                        type="button"
                        disabled={itemsSeleccionadosParaAplicar.length === 0 || aplicando}
                        onClick={() => void handleAplicarActualizacionMasiva()}
                        title="Aplicar los cambios seleccionados en la base de datos"
                        aria-label="Aplicar Cambios"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "10px 18px",
                          borderRadius: "10px",
                          border: "none",
                          background: "#2F4737",
                          color: "#FFFFFF",
                          fontSize: "0.84rem",
                          fontWeight: 700,
                          cursor:
                            itemsSeleccionadosParaAplicar.length === 0 || aplicando
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            itemsSeleccionadosParaAplicar.length === 0 || aplicando ? 0.55 : 1,
                        }}
                      >
                        {aplicando ? <Loader2 size={15} /> : <CheckCircle2 size={15} />}
                        <span>
                          {aplicando
                            ? "Actualizando…"
                            : `Aplicar Cambios (${itemsSeleccionadosParaAplicar.length})`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
