"use client";

import React, { useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Loader2,
  Move,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { DisenoVisualTarjeta } from "../operaciones-taller";
import { subirImagenTarjetaAction } from "../acciones-operaciones-taller";

export interface PropsLienzoDisenadorTarjeta {
  negocio: string;
  esCondolencias: boolean;
  /** En Dedicatoria, true = imprime SOLO QR (sin mensaje ni imagen); false = imprime Mensaje + Imagen (sin QR). En Condolencias siempre es false. */
  soloQr: boolean;
  mensaje: string;
  diseno: DisenoVisualTarjeta;
  onCambiarDiseno: (nuevo: DisenoVisualTarjeta) => void;
  qrDataUrl?: string;
  anchoMm?: number;
  altoMm?: number;
  soloLectura?: boolean;
  onError?: (msg: string) => void;
}

export function normalizarDisenoTarjeta(
  diseno: DisenoVisualTarjeta | undefined,
  esCondolencias: boolean,
  mensaje = ""
): Required<Omit<DisenoVisualTarjeta, "imagenUrl">> & { imagenUrl: string | null } {
  const len = mensaje.length;
  const tamDefault = len < 60 ? 22 : len < 140 ? 18 : len < 240 ? 15 : 12;
  return {
    fuente: diseno?.fuente ?? (esCondolencias ? "serif" : "cursiva"),
    tamanoPt:
      typeof diseno?.tamanoPt === "number" && diseno.tamanoPt >= 9 && diseno.tamanoPt <= 36
        ? diseno.tamanoPt
        : tamDefault,
    alineacion: diseno?.alineacion ?? "center",
    negrita: Boolean(diseno?.negrita),
    italica: Boolean(diseno?.italica),
    textoXPct: typeof diseno?.textoXPct === "number" ? diseno.textoXPct : 50,
    textoYPct: typeof diseno?.textoYPct === "number" ? diseno.textoYPct : 50,
    textoAnchoPct:
      typeof diseno?.textoAnchoPct === "number"
        ? diseno.textoAnchoPct
        : esCondolencias
          ? 74
          : 82,
    imagenUrl: diseno?.imagenUrl || null,
    imagenXPct: typeof diseno?.imagenXPct === "number" ? diseno.imagenXPct : 50,
    imagenYPct: typeof diseno?.imagenYPct === "number" ? diseno.imagenYPct : 22,
    imagenAnchoMm: typeof diseno?.imagenAnchoMm === "number" ? diseno.imagenAnchoMm : 32,
    escalaGrisesImagen: Boolean(diseno?.escalaGrisesImagen),
  };
}

export function resolverFontFamilyCss(fuente?: "cursiva" | "serif" | "formal"): string {
  if (fuente === "cursiva") {
    return "'Dancing Script', 'Brush Script MT', 'Great Vibes', 'Allura', cursive";
  }
  if (fuente === "serif") {
    return "'Playfair Display', Georgia, 'Times New Roman', serif";
  }
  return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
}

async function comprimirImagenTarjetaCliente(file: File): Promise<string> {
  const dataUrlOriginal = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });

  if (typeof window === "undefined") return dataUrlOriginal;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 900;
        let w = img.naturalWidth || img.width || 600;
        let h = img.naturalHeight || img.height || 600;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrlOriginal);
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const esPng = file.type.includes("png") || file.type.includes("webp");
        const salida = esPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.86);
        resolve(salida);
      } catch {
        resolve(dataUrlOriginal);
      }
    };
    img.onerror = () => resolve(dataUrlOriginal);
    img.src = dataUrlOriginal;
  });
}

export function LienzoDisenadorTarjeta({
  negocio,
  esCondolencias,
  soloQr,
  mensaje,
  diseno,
  onCambiarDiseno,
  qrDataUrl,
  anchoMm,
  altoMm,
  soloLectura = false,
  onError,
}: PropsLienzoDisenadorTarjeta) {
  const norm = normalizarDisenoTarjeta(diseno, esCondolencias, mensaje);
  const wMm = anchoMm ?? (esCondolencias ? 168 : 113);
  const hMm = altoMm ?? (esCondolencias ? 113 : 168);
  const modoSoloQrActivo = !esCondolencias && soloQr;

  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const inputImgRef = useRef<HTMLInputElement | null>(null);

  const [elementoActivo, setElementoActivo] = useState<"texto" | "imagen" | null>(null);
  const [arrastrando, setArrastrando] = useState<"texto" | "imagen" | null>(null);
  const [subiendoImg, setSubiendoImg] = useState<boolean>(false);

  const actualizar = (parcial: Partial<DisenoVisualTarjeta>) => {
    onCambiarDiseno({ ...norm, ...parcial });
  };

  const iniciarArrastre = (
    tipo: "texto" | "imagen",
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (soloLectura || modoSoloQrActivo) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setElementoActivo(tipo);
    setArrastrando(tipo);
  };

  const moverArrastre = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastrando || !lienzoRef.current) return;
    const rect = lienzoRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct = Math.round(
      Math.max(10, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100)) * 10
    ) / 10;
    const yPct = Math.round(
      Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100)) * 10
    ) / 10;

    if (arrastrando === "texto") {
      actualizar({ textoXPct: xPct, textoYPct: yPct });
    } else {
      actualizar({ imagenXPct: xPct, imagenYPct: yPct });
    }
  };

  const terminarArrastre = (e: React.PointerEvent<HTMLDivElement>) => {
    if (arrastrando) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setArrastrando(null);
    }
  };

  const handleSubirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      onError?.("La imagen no debe superar los 8 MB.");
      return;
    }
    setSubiendoImg(true);
    try {
      const comprimida = await comprimirImagenTarjetaCliente(file);
      const res = await subirImagenTarjetaAction({
        negocio,
        dataUrl: comprimida,
        nombreArchivo: file.name,
      });
      if (!res.ok) {
        onError?.(res.error);
        return;
      }
      actualizar({
        imagenUrl: res.publicUrl,
        imagenXPct: 50,
        imagenYPct: esCondolencias ? 22 : 26,
        imagenAnchoMm: esCondolencias ? 34 : 30,
        // Bajar un poco el texto si estaba justo en el centro para que no se monte con el logo
        ...(norm.textoYPct >= 44 && norm.textoYPct <= 56 ? { textoYPct: 62 } : {}),
      });
      setElementoActivo("imagen");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
    } finally {
      setSubiendoImg(false);
    }
  };

  const resetearPosiciones = () => {
    actualizar({
      alineacion: "center",
      negrita: false,
      italica: false,
      textoXPct: 50,
      textoYPct: norm.imagenUrl ? 62 : 50,
      textoAnchoPct: esCondolencias ? 74 : 82,
      imagenXPct: 50,
      imagenYPct: esCondolencias ? 22 : 26,
      imagenAnchoMm: esCondolencias ? 34 : 30,
    });
  };

  const anchoImagenPct = Math.max(8, Math.min(82, (norm.imagenAnchoMm / wMm) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* BARRA DE HERRAMIENTAS DE DISEÑADOR GRÁFICO (solo cuando imprime mensaje) */}
      {!soloLectura && !modoSoloQrActivo && (
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #CBD5E1",
            borderRadius: "10px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "7px",
          }}
        >
          {/* Fila 1: Fuente + Alineación/Justificación + B/I + Centrar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
            {(
              [
                { id: "cursiva", label: "Cursiva" },
                { id: "serif", label: "Serif" },
                { id: "formal", label: "Formal" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => actualizar({ fuente: f.id })}
                title={`Tipografía ${f.label}`}
                aria-label={`Fuente ${f.label}`}
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: norm.fuente === f.id ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                  background: norm.fuente === f.id ? "#E0F2FE" : "#FFFFFF",
                  color: norm.fuente === f.id ? "#0369A1" : "#334155",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}

            <span style={{ width: "1px", height: "16px", background: "#CBD5E1", margin: "0 2px" }} />

            {/* Alineación / Justificación */}
            {(
              [
                { id: "left", icon: AlignLeft, title: "Alinear a la izquierda" },
                { id: "center", icon: AlignCenter, title: "Centrar texto" },
                { id: "right", icon: AlignRight, title: "Alinear a la derecha" },
                { id: "justify", icon: AlignJustify, title: "Justificar texto" },
              ] as const
            ).map(({ id, icon: Icon, title }) => (
              <button
                key={id}
                type="button"
                onClick={() => actualizar({ alineacion: id })}
                title={title}
                aria-label={title}
                style={{
                  padding: "4px 6px",
                  borderRadius: "6px",
                  border: norm.alineacion === id ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                  background: norm.alineacion === id ? "#E0F2FE" : "#FFFFFF",
                  color: norm.alineacion === id ? "#0369A1" : "#334155",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Icon size={13} />
              </button>
            ))}

            <button
              type="button"
              onClick={() => actualizar({ negrita: !norm.negrita })}
              title="Negrita"
              aria-label="Negrita"
              style={{
                padding: "4px 6px",
                borderRadius: "6px",
                border: norm.negrita ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                background: norm.negrita ? "#E0F2FE" : "#FFFFFF",
                color: norm.negrita ? "#0369A1" : "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Bold size={13} />
            </button>

            <button
              type="button"
              onClick={() => actualizar({ italica: !norm.italica })}
              title="Cursiva / Itálica"
              aria-label="Itálica"
              style={{
                padding: "4px 6px",
                borderRadius: "6px",
                border: norm.italica ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                background: norm.italica ? "#E0F2FE" : "#FFFFFF",
                color: norm.italica ? "#0369A1" : "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Italic size={13} />
            </button>

            <button
              type="button"
              onClick={resetearPosiciones}
              title="Restablecer centrado automático"
              aria-label="Centrar"
              style={{
                marginLeft: "auto",
                padding: "3px 7px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                fontSize: "0.69rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <RotateCcw size={11} />
              <span>Centrar</span>
            </button>
          </div>

          {/* Fila 2: Tamaño letra + Ancho caja texto */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.7rem", color: "#334155", fontWeight: 600 }}>
              <span>Letra:</span>
              <input
                type="range"
                min="10"
                max="34"
                value={norm.tamanoPt}
                onChange={(e) => actualizar({ tamanoPt: Number(e.target.value) })}
                style={{ flex: 1, minWidth: "50px", cursor: "pointer" }}
              />
              <strong style={{ minWidth: "28px", textAlign: "right" }}>{norm.tamanoPt}pt</strong>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.7rem", color: "#334155", fontWeight: 600 }}>
              <span>Ancho:</span>
              <input
                type="range"
                min="42"
                max="92"
                value={norm.textoAnchoPct}
                onChange={(e) => actualizar({ textoAnchoPct: Number(e.target.value) })}
                style={{ flex: 1, minWidth: "50px", cursor: "pointer" }}
              />
              <strong style={{ minWidth: "28px", textAlign: "right" }}>{norm.textoAnchoPct}%</strong>
            </label>
          </div>

          {/* Fila 3: Imagen / Logo opcional */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px",
              paddingTop: "5px",
              borderTop: "1px dashed #CBD5E1",
            }}
          >
            <button
              type="button"
              disabled={subiendoImg}
              onClick={() => inputImgRef.current?.click()}
              title="Agregar imagen o logotipo a la tarjeta impresa"
              aria-label="Agregar Imagen"
              style={{
                padding: "4px 9px",
                borderRadius: "6px",
                border: "1px solid #0284C7",
                background: "#FFFFFF",
                color: "#0369A1",
                fontSize: "0.71rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {subiendoImg ? <Loader2 size={12} /> : <ImagePlus size={12} />}
              <span>
                {subiendoImg
                  ? "Subiendo..."
                  : norm.imagenUrl
                    ? "Cambiar Imagen"
                    : "Agregar Imagen"}
              </span>
            </button>
            <input
              ref={inputImgRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => void handleSubirImagen(e)}
              style={{ display: "none" }}
            />

            {norm.imagenUrl && (
              <>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.69rem", color: "#334155", fontWeight: 600 }}>
                  <span>Tamaño:</span>
                  <input
                    type="range"
                    min="14"
                    max={Math.round(wMm * 0.78)}
                    value={norm.imagenAnchoMm}
                    onChange={(e) => actualizar({ imagenAnchoMm: Number(e.target.value) })}
                    style={{ width: "68px", cursor: "pointer" }}
                  />
                  <strong>{norm.imagenAnchoMm}mm</strong>
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "0.69rem", color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={norm.escalaGrisesImagen}
                    onChange={(e) => actualizar({ escalaGrisesImagen: e.target.checked })}
                  />
                  <span>B/N</span>
                </label>

                <button
                  type="button"
                  onClick={() => actualizar({ imagenUrl: null })}
                  title="Quitar imagen de la tarjeta"
                  aria-label="Quitar Imagen"
                  style={{
                    padding: "3px 6px",
                    borderRadius: "6px",
                    border: "1px solid #FECACA",
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <Trash2 size={11} />
                  <span>Quitar</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* LIENZO INTERACTIVO EN PROPORCIÓN REAL (113×168 mm VERTICAL O 168×113 mm HORIZONTAL) */}
      <div
        style={{
          background: "#F1F5F9",
          borderRadius: "12px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          ref={lienzoRef}
          onClick={() => setElementoActivo(null)}
          style={{
            width: esCondolencias ? "100%" : "238px",
            maxWidth: esCondolencias ? "390px" : "238px",
            aspectRatio: `${wMm} / ${hMm}`,
            backgroundColor: "#F6F4EE",
            border: "1.5px solid #CBD5E1",
            borderRadius: "6px",
            boxShadow: "0 10px 22px rgba(15, 23, 42, 0.12)",
            position: "relative",
            overflow: "hidden",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          {/* Guía visual (no impresa) del doblez central horizontal en Dedicatoria Vertical */}
          {!esCondolencias && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                borderTop: "1px dashed rgba(148, 163, 184, 0.55)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "-13px",
                  fontSize: "0.56rem",
                  color: "#94A3B8",
                  background: "rgba(246, 244, 238, 0.9)",
                  padding: "0 3px",
                }}
              >
                doblez 8,4 cm
              </span>
            </div>
          )}

          {/* Arte preimpreso en esquinas diagonales (superior-izquierda e inferior-derecha) para Condolencias */}
          {esCondolencias && (
            <>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "6px",
                  left: "8px",
                  fontSize: "1.35rem",
                  opacity: 0.35,
                  filter: "grayscale(100%)",
                  pointerEvents: "none",
                }}
              >
                🌿
              </div>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: "6px",
                  right: "8px",
                  fontSize: "1.35rem",
                  opacity: 0.35,
                  filter: "grayscale(100%)",
                  transform: "rotate(180deg)",
                  pointerEvents: "none",
                }}
              >
                🌿
              </div>
            </>
          )}

          {modoSoloQrActivo ? (
            // DEDICATORIA MODO SOLO QR: NO IMPRIME MENSAJE NI IMAGEN, SOLO QR CENTRADO EN LA MITAD INFERIOR
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "74%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Tarjeta Digital"
                  style={{
                    width: "68px",
                    height: "68px",
                    background: "#FFFFFF",
                    padding: "3px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "68px",
                    height: "68px",
                    background: "#FFFFFF",
                    border: "1px dashed #94A3B8",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    color: "#64748B",
                    fontWeight: 700,
                  }}
                >
                  QR
                </div>
              )}
              <span style={{ fontSize: "0.55rem", color: "#64748B", fontWeight: 600 }}>
                Solo QR (mensaje en web)
              </span>
            </div>
          ) : (
            <>
              {/* IMAGEN / LOGO ARRASTRABLE */}
              {norm.imagenUrl && (
                <div
                  onPointerDown={(e) => iniciarArrastre("imagen", e)}
                  onPointerMove={moverArrastre}
                  onPointerUp={terminarArrastre}
                  onPointerCancel={terminarArrastre}
                  title={soloLectura ? undefined : "Arrastra para mover la imagen"}
                  style={{
                    position: "absolute",
                    left: `${norm.imagenXPct}%`,
                    top: `${norm.imagenYPct}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${anchoImagenPct}%`,
                    cursor: soloLectura ? "default" : arrastrando === "imagen" ? "grabbing" : "grab",
                    border:
                      !soloLectura && (elementoActivo === "imagen" || arrastrando === "imagen")
                        ? "1.5px dashed #0284C7"
                        : "1px dashed transparent",
                    borderRadius: "4px",
                    padding: "2px",
                    zIndex: 2,
                    boxSizing: "border-box",
                  }}
                >
                  <img
                    src={norm.imagenUrl}
                    alt="Imagen tarjeta"
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      objectFit: "contain",
                      filter: norm.escalaGrisesImagen ? "grayscale(100%)" : "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              )}

              {/* BLOQUE DE TEXTO ARRASTRABLE (SIN QR) */}
              <div
                onPointerDown={(e) => iniciarArrastre("texto", e)}
                onPointerMove={moverArrastre}
                onPointerUp={terminarArrastre}
                onPointerCancel={terminarArrastre}
                title={soloLectura ? undefined : "Arrastra para mover el mensaje"}
                style={{
                  position: "absolute",
                  left: `${norm.textoXPct}%`,
                  top: `${norm.textoYPct}%`,
                  transform: "translate(-50%, -50%)",
                  width: `${norm.textoAnchoPct}%`,
                  fontFamily: resolverFontFamilyCss(norm.fuente),
                  fontSize: `${Math.max(9, norm.tamanoPt * 0.66)}pt`,
                  fontWeight: norm.negrita ? 700 : 400,
                  fontStyle: norm.italica ? "italic" : "normal",
                  textAlign: norm.alineacion,
                  lineHeight: 1.36,
                  color: "#18181B",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  cursor: soloLectura ? "default" : arrastrando === "texto" ? "grabbing" : "grab",
                  border:
                    !soloLectura && (elementoActivo === "texto" || arrastrando === "texto")
                      ? "1.5px dashed #0284C7"
                      : !soloLectura
                        ? "1px dashed rgba(148, 163, 184, 0.45)"
                        : "none",
                  borderRadius: "4px",
                  padding: "4px 6px",
                  boxSizing: "border-box",
                  zIndex: 3,
                }}
              >
                {mensaje ||
                  (esCondolencias
                    ? "Expresamos nuestras más sentidas condolencias."
                    : "Escribe el mensaje de dedicatoria...")}
              </div>
            </>
          )}
        </div>

        {!soloLectura && !modoSoloQrActivo && (
          <span
            style={{
              fontSize: "0.68rem",
              color: "#64748B",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Move size={11} />
            Arrastra el texto o la imagen sobre la cartulina para ubicarlos donde desees.
          </span>
        )}
      </div>
    </div>
  );
}
