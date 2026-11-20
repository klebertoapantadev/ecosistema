"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Contrast,
  Droplets,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Loader2,
  Maximize2,
  Move,
  MoveHorizontal,
  PenLine,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Type,
} from "lucide-react";
import type {
  BloqueTextoTarjeta,
  ClaveFuenteTarjeta,
  DisenoVisualTarjeta,
  ImagenDisenoTarjeta,
  ModoImpresionTarjeta,
} from "../operaciones-taller";
import { subirImagenTarjetaAction } from "../acciones-operaciones-taller";

export const MAX_IMAGENES_TARJETA = 3;
export const MAX_BLOQUES_EXTRA_TEXTO = 2;

export interface DefinicionFuenteTarjeta {
  id: ClaveFuenteTarjeta;
  etiqueta: string;
  cssFamily: string;
  canvasFamily: string;
}

export const CATALOGO_FUENTES_TARJETA: readonly DefinicionFuenteTarjeta[] = [
  {
    id: "cursiva",
    etiqueta: "Cursiva",
    cssFamily: "'Dancing Script', 'Brush Script MT', cursive",
    canvasFamily: "Dancing Script, cursive",
  },
  {
    id: "caligrafia",
    etiqueta: "Caligrafía",
    cssFamily: "'Great Vibes', 'Brush Script MT', cursive",
    canvasFamily: "Great Vibes, cursive",
  },
  {
    id: "manuscrita",
    etiqueta: "Manuscrita",
    cssFamily: "'Alex Brush', 'Brush Script MT', cursive",
    canvasFamily: "Alex Brush, cursive",
  },
  {
    id: "editorial",
    etiqueta: "Editorial",
    cssFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
    canvasFamily: "Playfair Display, Georgia, serif",
  },
  {
    id: "clasica",
    etiqueta: "Clásica",
    cssFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    canvasFamily: "Cormorant Garamond, Georgia, serif",
  },
  {
    id: "moderna",
    etiqueta: "Moderna",
    cssFamily: "'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    canvasFamily: "Montserrat, sans-serif",
  },
] as const;

const GOOGLE_FONTS_TARJETA_URL =
  "https://fonts.googleapis.com/css2?family=Alex+Brush&family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Montserrat:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap";

export function asegurarFuentesGoogleTarjetaCargadas() {
  if (typeof document === "undefined") return;
  if (document.getElementById("eco-fuentes-tarjeta-google")) return;
  const link = document.createElement("link");
  link.id = "eco-fuentes-tarjeta-google";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_TARJETA_URL;
  document.head.appendChild(link);
}

export function normalizarClaveFuenteTarjeta(
  fuente?: ClaveFuenteTarjeta | string | null,
  esCondolencias = false
): ClaveFuenteTarjeta {
  if (fuente === "serif") return "editorial";
  if (fuente === "formal") return "moderna";
  if (
    fuente === "cursiva" ||
    fuente === "caligrafia" ||
    fuente === "manuscrita" ||
    fuente === "editorial" ||
    fuente === "clasica" ||
    fuente === "moderna"
  ) {
    return fuente;
  }
  return esCondolencias ? "editorial" : "cursiva";
}

export function resolverFontFamilyCss(
  fuente?: ClaveFuenteTarjeta | string | null,
  esCondolencias = false
): string {
  const clave = normalizarClaveFuenteTarjeta(fuente, esCondolencias);
  const def = CATALOGO_FUENTES_TARJETA.find((f) => f.id === clave);
  return def ? def.cssFamily : CATALOGO_FUENTES_TARJETA[0]!.cssFamily;
}

export interface DisenoVisualNormalizado {
  fuente: ClaveFuenteTarjeta;
  tamanoPt: number;
  alineacion: "left" | "center" | "right" | "justify";
  negrita: boolean;
  italica: boolean;
  textoXPct: number;
  textoYPct: number;
  textoAnchoPct: number;
  mostrarFirma: boolean;
  remitentePortada: string;
  modoImpresion?: ModoImpresionTarjeta;
  bloquesTexto: BloqueTextoTarjeta[];
  imagenes: ImagenDisenoTarjeta[];
  /** Campos legados conservados por retrocompatibilidad */
  imagenUrl: string | null;
  imagenXPct: number;
  imagenYPct: number;
  imagenAnchoMm: number;
  escalaGrisesImagen: boolean;
}

/**
 * Determina si un mensaje es suficientemente corto como para vivir cómodamente
 * en la mitad inferior de la tarjeta díptico (debajo del doblez 8,4 cm),
 * dejando la mitad superior libre salvo que realmente se necesite.
 */
export function esMensajeCortoParaMitadInferior(mensaje: string): boolean {
  const limpio = (mensaje || "").trim();
  if (!limpio) return true;
  const lineas = limpio.split(/\r?\n/).length;
  return limpio.length <= 200 && lineas <= 6;
}

/**
 * En tarjetas verticales de Dedicatoria (díptico 113 × 168 mm con doblez en 84 mm / 50%),
 * si un bloque de texto cruza la franja crítica del doblez (78..90 mm), inserta saltos de línea
 * de respiro justo en la línea que caería sobre el pliegue para que ninguna letra se distorsione
 * al doblar o imprimir.
 */
export function ajustarTextoParaDoblezDiptico(
  texto: string,
  esCondolencias: boolean,
  yPct: number,
  tamanoPt: number,
  anchoPct: number
): string {
  if (esCondolencias || !texto || !texto.trim()) return texto;

  const hTarjetaMm = 168;
  const wTarjetaMm = 113;
  const ptToMm = 25.4 / 72;
  const tamMm = Math.max(9, tamanoPt || 16) * ptToMm;
  const altoLineaMm = tamMm * 1.36;
  const anchoCajaMm = Math.max(30, (Math.max(25, Math.min(96, anchoPct || 84)) / 100) * wTarjetaMm);
  const charsPorLinea = Math.max(12, Math.floor(anchoCajaMm / (tamMm * 0.54)));

  // Descomponer el texto en líneas visuales aproximadas preservando párrafos explícitos
  const lineasVisuales: Array<{ texto: string; esVacia: boolean }> = [];
  for (const parrafo of texto.split(/\r?\n/)) {
    const t = parrafo.trim();
    if (!t) {
      lineasVisuales.push({ texto: "", esVacia: true });
      continue;
    }
    const palabras = t.split(/\s+/);
    let actual = "";
    for (const pal of palabras) {
      const prueba = actual ? `${actual} ${pal}` : pal;
      if (prueba.length <= charsPorLinea || !actual) {
        actual = prueba;
      } else {
        lineasVisuales.push({ texto: actual, esVacia: false });
        actual = pal;
      }
    }
    if (actual) lineasVisuales.push({ texto: actual, esVacia: false });
  }

  if (lineasVisuales.length < 3) return texto;

  const altoTotalMm = lineasVisuales.length * altoLineaMm;
  const centroMm = (yPct / 100) * hTarjetaMm;
  const inicioMm = centroMm - altoTotalMm / 2;
  const finMm = inicioMm + altoTotalMm;

  // Si todo el texto vive arriba del doblez (< 79 mm) o debajo del doblez (> 88 mm), no necesita ajuste
  if (finMm <= 79 || inicioMm >= 88) return texto;

  // Buscar la línea que intersecta el doblez central (84 mm)
  const idxDoblez = Math.floor((84 - inicioMm) / altoLineaMm);
  if (idxDoblez <= 0 || idxDoblez >= lineasVisuales.length) return texto;

  // Si ya existe una línea en blanco justo alrededor del doblez, respetar el espacio existente
  const yaTieneRespiro =
    lineasVisuales[idxDoblez]?.esVacia ||
    lineasVisuales[idxDoblez - 1]?.esVacia ||
    lineasVisuales[idxDoblez + 1]?.esVacia;
  if (yaTieneRespiro) return texto;

  // Insertar salto de línea doble (dos líneas de respiro ~12-16mm) justo antes de la línea que cae sobre el doblez
  const parteSuperior = lineasVisuales
    .slice(0, idxDoblez)
    .map((l) => l.texto)
    .join("\n");
  const parteInferior = lineasVisuales
    .slice(idxDoblez)
    .map((l) => l.texto)
    .join("\n");

  return `${parteSuperior}\n\n\n${parteInferior}`;
}

export function normalizarDisenoTarjeta(
  diseno: DisenoVisualTarjeta | undefined,
  esCondolencias: boolean,
  mensaje = ""
): DisenoVisualNormalizado {
  const len = mensaje.length;
  const tamDefault = len < 60 ? 22 : len < 140 ? 18 : len < 240 ? 15 : 12;
  const fuentePrincipal = normalizarClaveFuenteTarjeta(diseno?.fuente, esCondolencias);
  const tamanoPrincipal =
    typeof diseno?.tamanoPt === "number" && diseno.tamanoPt >= 9 && diseno.tamanoPt <= 40
      ? diseno.tamanoPt
      : tamDefault;
  const alineacionPrincipal = diseno?.alineacion ?? "center";
  const esCorto = esMensajeCortoParaMitadInferior(mensaje);
  const defaultYPct = esCondolencias ? 48 : esCorto ? 68 : 49;
  const textoXPct = typeof diseno?.textoXPct === "number" ? diseno.textoXPct : 50;
  const textoYPct = typeof diseno?.textoYPct === "number" ? diseno.textoYPct : defaultYPct;
  const textoAnchoPct =
    typeof diseno?.textoAnchoPct === "number"
      ? diseno.textoAnchoPct
      : esCondolencias
        ? 76
        : 84;

  // Imágenes (hasta 3): si existe diseno.imagenes úsalo; si no, migrar imagenUrl legado
  let imagenes: ImagenDisenoTarjeta[] = [];
  if (Array.isArray(diseno?.imagenes) && diseno.imagenes.length > 0) {
    imagenes = diseno.imagenes
      .filter((im) => Boolean(im && im.url))
      .slice(0, MAX_IMAGENES_TARJETA)
      .map((im, idx) => ({
        id: im.id || `img-${idx + 1}`,
        url: im.url,
        xPct: typeof im.xPct === "number" ? im.xPct : 50,
        yPct: typeof im.yPct === "number" ? im.yPct : 24,
        anchoMm: typeof im.anchoMm === "number" ? im.anchoMm : 36,
        rotacionDeg:
          typeof im.rotacionDeg === "number"
            ? Math.max(-180, Math.min(180, im.rotacionDeg))
            : 0,
        cubrirTarjeta: Boolean(im.cubrirTarjeta),
        escalaGrises: Boolean(im.escalaGrises),
        opacidad: typeof im.opacidad === "number" ? Math.max(0.1, Math.min(1, im.opacidad)) : 1,
      }));
  } else if (diseno?.imagenUrl) {
    imagenes = [
      {
        id: "img-1",
        url: diseno.imagenUrl,
        xPct: typeof diseno.imagenXPct === "number" ? diseno.imagenXPct : 50,
        yPct: typeof diseno.imagenYPct === "number" ? diseno.imagenYPct : 24,
        anchoMm: typeof diseno.imagenAnchoMm === "number" ? diseno.imagenAnchoMm : 36,
        rotacionDeg: 0,
        cubrirTarjeta: false,
        escalaGrises: Boolean(diseno.escalaGrisesImagen),
        opacidad: 1,
      },
    ];
  }

  // Bloques de texto: asegurar siempre "mensaje" + "firma" + hasta 2 "extra"
  const bloquesEntrada = Array.isArray(diseno?.bloquesTexto) ? diseno.bloquesTexto : [];
  const bloqueMensajeEntrada = bloquesEntrada.find((b) => b.rol === "mensaje");
  const bloqueFirmaEntrada = bloquesEntrada.find((b) => b.rol === "firma");
  const bloquesExtra = bloquesEntrada
    .filter((b) => b.rol === "extra")
    .slice(0, MAX_BLOQUES_EXTRA_TEXTO)
    .map((b, idx) => ({
      id: b.id || `extra-${idx + 1}`,
      rol: "extra" as const,
      texto: b.texto ?? "",
      fuente: normalizarClaveFuenteTarjeta(b.fuente ?? fuentePrincipal, esCondolencias),
      tamanoPt: typeof b.tamanoPt === "number" ? b.tamanoPt : 14,
      alineacion: b.alineacion ?? "center",
      negrita: Boolean(b.negrita),
      italica: Boolean(b.italica),
      colorHex: b.colorHex || "#18181B",
      xPct: typeof b.xPct === "number" ? b.xPct : 50,
      yPct: typeof b.yPct === "number" ? b.yPct : 16,
      anchoPct: typeof b.anchoPct === "number" ? b.anchoPct : 80,
    }));

  const bloqueMensaje: BloqueTextoTarjeta = {
    id: bloqueMensajeEntrada?.id || "mensaje",
    rol: "mensaje",
    fuente: normalizarClaveFuenteTarjeta(
      bloqueMensajeEntrada?.fuente ?? fuentePrincipal,
      esCondolencias
    ),
    tamanoPt:
      typeof bloqueMensajeEntrada?.tamanoPt === "number"
        ? bloqueMensajeEntrada.tamanoPt
        : tamanoPrincipal,
    alineacion: bloqueMensajeEntrada?.alineacion ?? alineacionPrincipal,
    negrita:
      bloqueMensajeEntrada?.negrita !== undefined
        ? Boolean(bloqueMensajeEntrada.negrita)
        : Boolean(diseno?.negrita),
    italica:
      bloqueMensajeEntrada?.italica !== undefined
        ? Boolean(bloqueMensajeEntrada.italica)
        : Boolean(diseno?.italica),
    colorHex: bloqueMensajeEntrada?.colorHex || "#18181B",
    xPct: typeof bloqueMensajeEntrada?.xPct === "number" ? bloqueMensajeEntrada.xPct : textoXPct,
    yPct: typeof bloqueMensajeEntrada?.yPct === "number" ? bloqueMensajeEntrada.yPct : textoYPct,
    anchoPct:
      typeof bloqueMensajeEntrada?.anchoPct === "number"
        ? bloqueMensajeEntrada.anchoPct
        : textoAnchoPct,
  };

  const bloqueFirma: BloqueTextoTarjeta = {
    id: bloqueFirmaEntrada?.id || "firma",
    rol: "firma",
    fuente: normalizarClaveFuenteTarjeta(
      bloqueFirmaEntrada?.fuente ?? (esCondolencias ? "clasica" : fuentePrincipal),
      esCondolencias
    ),
    tamanoPt:
      typeof bloqueFirmaEntrada?.tamanoPt === "number"
        ? bloqueFirmaEntrada.tamanoPt
        : esCondolencias
          ? 13
          : 15,
    alineacion: bloqueFirmaEntrada?.alineacion ?? "right",
    negrita:
      bloqueFirmaEntrada?.negrita !== undefined ? Boolean(bloqueFirmaEntrada.negrita) : false,
    italica:
      bloqueFirmaEntrada?.italica !== undefined
        ? Boolean(bloqueFirmaEntrada.italica)
        : esCondolencias,
    colorHex: bloqueFirmaEntrada?.colorHex || "#27272A",
    xPct: typeof bloqueFirmaEntrada?.xPct === "number" ? bloqueFirmaEntrada.xPct : 50,
    yPct:
      typeof bloqueFirmaEntrada?.yPct === "number"
        ? bloqueFirmaEntrada.yPct
        : esCondolencias
          ? 84
          : 85,
    anchoPct:
      typeof bloqueFirmaEntrada?.anchoPct === "number"
        ? bloqueFirmaEntrada.anchoPct
        : esCondolencias
          ? 74
          : 82,
  };

  const primeraImg = imagenes[0] ?? null;
  const modoImpresionNorm: ModoImpresionTarjeta | undefined =
    diseno?.modoImpresion === "SOLO_MENSAJE" ||
    diseno?.modoImpresion === "SOLO_QR" ||
    diseno?.modoImpresion === "MENSAJE_Y_QR"
      ? diseno.modoImpresion
      : undefined;

  return {
    fuente: bloqueMensaje.fuente || fuentePrincipal,
    tamanoPt: bloqueMensaje.tamanoPt || tamanoPrincipal,
    alineacion: bloqueMensaje.alineacion || alineacionPrincipal,
    negrita: Boolean(bloqueMensaje.negrita),
    italica: Boolean(bloqueMensaje.italica),
    textoXPct: bloqueMensaje.xPct,
    textoYPct: bloqueMensaje.yPct,
    textoAnchoPct: bloqueMensaje.anchoPct,
    mostrarFirma: diseno?.mostrarFirma !== false,
    remitentePortada: typeof diseno?.remitentePortada === "string" ? diseno.remitentePortada : "",
    modoImpresion: modoImpresionNorm,
    bloquesTexto: [bloqueMensaje, bloqueFirma, ...bloquesExtra],
    imagenes,
    imagenUrl: primeraImg ? primeraImg.url : null,
    imagenXPct: primeraImg ? primeraImg.xPct : 50,
    imagenYPct: primeraImg ? primeraImg.yPct : 24,
    imagenAnchoMm: primeraImg ? primeraImg.anchoMm : 36,
    escalaGrisesImagen: primeraImg ? Boolean(primeraImg.escalaGrises) : false,
  };
}

export function esFirmaVisibleValida(firma?: string | null): boolean {
  const limpia = (firma || "").trim();
  if (!limpia) return false;
  const low = limpia.toLowerCase();
  return low !== "pendiente" && low !== "cliente" && low !== "cliente tienda";
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
        const maxDim = 1200;
        let w = img.naturalWidth || img.width || 800;
        let h = img.naturalHeight || img.height || 800;
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

function cargarImagenHtml(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Renderiza el diseño completo de la tarjeta en un PNG de alta resolución (10 px/mm)
 * para compartir por WhatsApp / Web Share API o descargar como vista final.
 */
export async function renderizarTarjetaEnCanvasPng(params: {
  esCondolencias: boolean;
  soloQr: boolean;
  mensaje: string;
  firma?: string;
  diseno: DisenoVisualNormalizado;
  qrDataUrl?: string;
  anchoMm: number;
  altoMm: number;
}): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {}

  const PX_PER_MM = 10;
  const wPx = Math.round(params.anchoMm * PX_PER_MM);
  const hPx = Math.round(params.altoMm * PX_PER_MM);
  const canvas = document.createElement("canvas");
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fondo de cartulina
  ctx.fillStyle = "#F6F4EE";
  ctx.fillRect(0, 0, wPx, hPx);

  if (params.soloQr && !params.esCondolencias) {
    if (params.qrDataUrl) {
      const qrImg = await cargarImagenHtml(params.qrDataUrl);
      if (qrImg) {
        const qrPx = Math.round(28 * PX_PER_MM);
        const x = (wPx - qrPx) / 2;
        const y = hPx * 0.75 - qrPx / 2;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x - 14, y - 14, qrPx + 28, qrPx + 28);
        ctx.drawImage(qrImg, x, y, qrPx, qrPx);
      }
    }
  } else {
    // 1. Imágenes (primero fondos 100%, luego imágenes libres)
    const imgsOrdenadas = [
      ...params.diseno.imagenes.filter((im) => im.cubrirTarjeta),
      ...params.diseno.imagenes.filter((im) => !im.cubrirTarjeta),
    ];

    for (const im of imgsOrdenadas) {
      const htmlImg = await cargarImagenHtml(im.url);
      if (!htmlImg) continue;
      ctx.save();
      ctx.globalAlpha = typeof im.opacidad === "number" ? im.opacidad : 1;
      if (im.escalaGrises) {
        ctx.filter = "grayscale(100%)";
      }
      if (im.cubrirTarjeta) {
        // object-fit: cover (+ soporte rotación si fue girada)
        const rotRad = ((im.rotacionDeg || 0) * Math.PI) / 180;
        if (rotRad !== 0) {
          ctx.translate(wPx / 2, hPx / 2);
          ctx.rotate(rotRad);
          ctx.translate(-wPx / 2, -hPx / 2);
        }
        const ratioCanvas = wPx / hPx;
        const ratioImg = htmlImg.width / Math.max(1, htmlImg.height);
        let drawW = wPx;
        let drawH = hPx;
        let dx = 0;
        let dy = 0;
        if (ratioImg > ratioCanvas) {
          drawH = hPx;
          drawW = hPx * ratioImg;
          dx = (wPx - drawW) / 2;
        } else {
          drawW = wPx;
          drawH = wPx / ratioImg;
          dy = (hPx - drawH) / 2;
        }
        ctx.drawImage(htmlImg, dx, dy, drawW, drawH);
      } else {
        const imgW = Math.min(wPx, im.anchoMm * PX_PER_MM);
        const imgH = imgW * (htmlImg.height / Math.max(1, htmlImg.width));
        const cx = (im.xPct / 100) * wPx;
        const cy = (im.yPct / 100) * hPx;
        const rotRad = ((im.rotacionDeg || 0) * Math.PI) / 180;
        ctx.translate(cx, cy);
        if (rotRad !== 0) ctx.rotate(rotRad);
        ctx.drawImage(htmlImg, -imgW / 2, -imgH / 2, imgW, imgH);
      }
      ctx.restore();
    }

    // 2. Bloques de texto
    const PT_TO_PX = (PX_PER_MM * 25.4) / 72; // ~3.527 px/pt
    for (const bloque of params.diseno.bloquesTexto) {
      let texto = "";
      if (bloque.rol === "mensaje") {
        const textoBase =
          params.mensaje.trim() ||
          (params.esCondolencias
            ? "Expresamos nuestras más sentidas condolencias."
            : "Con todo mi cariño");
        texto = ajustarTextoParaDoblezDiptico(
          textoBase,
          params.esCondolencias,
          bloque.yPct,
          bloque.tamanoPt || 18,
          bloque.anchoPct || 84
        );
      } else if (bloque.rol === "firma") {
        if (!params.diseno.mostrarFirma || !esFirmaVisibleValida(params.firma)) continue;
        texto = (params.firma || "").trim();
      } else {
        texto = (bloque.texto || "").trim();
        if (!texto) continue;
      }

      const fontDef =
        CATALOGO_FUENTES_TARJETA.find(
          (f) => f.id === normalizarClaveFuenteTarjeta(bloque.fuente, params.esCondolencias)
        ) ?? CATALOGO_FUENTES_TARJETA[0]!;
      const fontSizePx = Math.round((bloque.tamanoPt || 18) * PT_TO_PX);
      const lineHeight = fontSizePx * 1.36;
      const boxW = (bloque.anchoPct / 100) * wPx;
      const boxLeft = (bloque.xPct / 100) * wPx - boxW / 2;

      ctx.save();
      ctx.font = `${bloque.italica ? "italic " : ""}${bloque.negrita ? "700 " : "400 "}${fontSizePx}px ${fontDef.canvasFamily}`;
      ctx.fillStyle = bloque.colorHex || "#18181B";
      ctx.textBaseline = "middle";

      const parrafos = texto.split(/\r?\n/);
      const lineas: Array<{ texto: string; finParrafo: boolean }> = [];
      for (const p of parrafos) {
        const limpio = p.trim();
        if (!limpio) {
          lineas.push({ texto: "", finParrafo: true });
          continue;
        }
        const palabras = limpio.split(/\s+/);
        let actual = "";
        for (const pal of palabras) {
          const prueba = actual ? `${actual} ${pal}` : pal;
          if (ctx.measureText(prueba).width <= boxW || !actual) {
            actual = prueba;
          } else {
            lineas.push({ texto: actual, finParrafo: false });
            actual = pal;
          }
        }
        if (actual) lineas.push({ texto: actual, finParrafo: true });
      }

      const totalH = lineas.length * lineHeight;
      let cursorY = (bloque.yPct / 100) * hPx - totalH / 2 + lineHeight / 2;

      for (const item of lineas) {
        if (item.texto) {
          const alin = bloque.alineacion || "center";
          if (alin === "justify" && !item.finParrafo) {
            const pals = item.texto.split(/\s+/).filter(Boolean);
            if (pals.length > 1) {
              const wPals = pals.reduce((acc, w) => acc + ctx.measureText(w).width, 0);
              const gap = Math.max(0, (boxW - wPals) / (pals.length - 1));
              let xCur = boxLeft;
              ctx.textAlign = "left";
              for (const w of pals) {
                ctx.fillText(w, xCur, cursorY);
                xCur += ctx.measureText(w).width + gap;
              }
            } else {
              ctx.textAlign = "left";
              ctx.fillText(item.texto, boxLeft, cursorY);
            }
          } else if (alin === "left" || alin === "justify") {
            ctx.textAlign = "left";
            ctx.fillText(item.texto, boxLeft, cursorY);
          } else if (alin === "right") {
            ctx.textAlign = "right";
            ctx.fillText(item.texto, boxLeft + boxW, cursorY);
          } else {
            ctx.textAlign = "center";
            ctx.fillText(item.texto, boxLeft + boxW / 2, cursorY);
          }
        }
        cursorY += lineHeight;
      }
      ctx.restore();
    }

    // 3. Si es modo Mensaje + QR digital en Dedicatoria, estampar QR compacto en esquina inferior derecha
    if (!params.esCondolencias && params.diseno.modoImpresion === "MENSAJE_Y_QR" && params.qrDataUrl) {
      const qrImg = await cargarImagenHtml(params.qrDataUrl);
      if (qrImg) {
        const qrPx = Math.round(16 * PX_PER_MM);
        const margen = Math.round(4 * PX_PER_MM);
        const qrX = wPx - qrPx - margen;
        const qrY = hPx - qrPx - margen;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(qrX - 6, qrY - 6, qrPx + 12, qrPx + 12);
        ctx.drawImage(qrImg, qrX, qrY, qrPx, qrPx);
      }
    }
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.96);
  });
}

export interface PropsLienzoDisenadorTarjeta {
  negocio: string;
  esCondolencias: boolean;
  /** En Dedicatoria, true = imprime SOLO QR (sin mensaje ni imagen); false = imprime Mensaje + Imágenes. En Condolencias siempre es false. */
  soloQr: boolean;
  /** En Dedicatoria, true = imprime el mensaje y añade un QR compacto en la esquina inferior derecha para ver la tarjeta digital. */
  incluirQrEnEsquina?: boolean;
  mensaje: string;
  /** Texto de la firma ("De parte de"), renderizado como cuadro de texto independiente en la tarjeta */
  firma?: string;
  /** Callback opcional para editar el mensaje directamente desde el diseñador (barra o inline sobre el gráfico) */
  onCambiarMensaje?: (nuevo: string) => void;
  /** Callback opcional para editar la firma directamente desde el diseñador (barra o inline sobre el gráfico) */
  onCambiarFirma?: (nueva: string) => void;
  diseno: DisenoVisualTarjeta;
  onCambiarDiseno: (nuevo: DisenoVisualTarjeta) => void;
  qrDataUrl?: string;
  anchoMm?: number;
  altoMm?: number;
  soloLectura?: boolean;
  onError?: (msg: string) => void;
}

export function LienzoDisenadorTarjeta({
  negocio,
  esCondolencias,
  soloQr,
  incluirQrEnEsquina = false,
  mensaje,
  firma = "",
  onCambiarMensaje,
  onCambiarFirma,
  diseno,
  onCambiarDiseno,
  qrDataUrl,
  anchoMm,
  altoMm,
  soloLectura = false,
  onError,
}: PropsLienzoDisenadorTarjeta) {
  useEffect(() => {
    asegurarFuentesGoogleTarjetaCargadas();
  }, []);

  const norm = normalizarDisenoTarjeta(diseno, esCondolencias, mensaje);
  const wMm = anchoMm ?? (esCondolencias ? 168 : 113);
  const hMm = altoMm ?? (esCondolencias ? 113 : 168);
  const modoSoloQrActivo = !esCondolencias && soloQr;

  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const inputImgRef = useRef<HTMLInputElement | null>(null);

  const [seleccion, setSeleccion] = useState<{ tipo: "texto" | "imagen"; id: string }>({
    tipo: "texto",
    id: "mensaje",
  });
  const [editandoTextoId, setEditandoTextoId] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<{ tipo: "texto" | "imagen"; id: string } | null>(
    null
  );
  const [subiendoImg, setSubiendoImg] = useState<boolean>(false);

  const emitirCambio = (siguiente: DisenoVisualNormalizado) => {
    const msgBlk = siguiente.bloquesTexto.find((b) => b.rol === "mensaje");
    const primImg = siguiente.imagenes[0] ?? null;
    onCambiarDiseno({
      fuente: msgBlk?.fuente ?? siguiente.fuente,
      tamanoPt: msgBlk?.tamanoPt ?? siguiente.tamanoPt,
      alineacion: msgBlk?.alineacion ?? siguiente.alineacion,
      negrita: msgBlk?.negrita ?? siguiente.negrita,
      italica: msgBlk?.italica ?? siguiente.italica,
      textoXPct: msgBlk?.xPct ?? siguiente.textoXPct,
      textoYPct: msgBlk?.yPct ?? siguiente.textoYPct,
      textoAnchoPct: msgBlk?.anchoPct ?? siguiente.textoAnchoPct,
      mostrarFirma: siguiente.mostrarFirma,
      remitentePortada: siguiente.remitentePortada,
      modoImpresion: siguiente.modoImpresion,
      bloquesTexto: siguiente.bloquesTexto,
      imagenes: siguiente.imagenes,
      imagenUrl: primImg ? primImg.url : null,
      imagenXPct: primImg ? primImg.xPct : 50,
      imagenYPct: primImg ? primImg.yPct : 24,
      imagenAnchoMm: primImg ? primImg.anchoMm : 36,
      escalaGrisesImagen: primImg ? Boolean(primeraImgGrises(primImg)) : false,
    });
  };

  const puedeEditarBloqueTexto = (blk: BloqueTextoTarjeta): boolean => {
    if (soloLectura) return false;
    if (blk.rol === "extra") return true;
    if (blk.rol === "mensaje") return Boolean(onCambiarMensaje);
    if (blk.rol === "firma") return Boolean(onCambiarFirma);
    return false;
  };

  const obtenerValorEditableBloque = (blk: BloqueTextoTarjeta): string => {
    if (blk.rol === "mensaje") return mensaje;
    if (blk.rol === "firma") return firma;
    return blk.texto || "";
  };

  const handleCambiarValorBloque = (blk: BloqueTextoTarjeta, valor: string) => {
    if (blk.rol === "mensaje") {
      onCambiarMensaje?.(valor);
    } else if (blk.rol === "firma") {
      onCambiarFirma?.(valor);
    } else {
      actualizarBloque(blk.id, { texto: valor });
    }
  };

  const primeraImgGrises = (im: ImagenDisenoTarjeta) => Boolean(im.escalaGrises);

  const actualizarBloque = (id: string, parcial: Partial<BloqueTextoTarjeta>) => {
    const nuevos = norm.bloquesTexto.map((b) => (b.id === id ? { ...b, ...parcial } : b));
    emitirCambio({ ...norm, bloquesTexto: nuevos });
  };

  const actualizarImagen = (id: string, parcial: Partial<ImagenDisenoTarjeta>) => {
    const nuevas = norm.imagenes.map((im) => (im.id === id ? { ...im, ...parcial } : im));
    emitirCambio({ ...norm, imagenes: nuevas });
  };

  const bloqueSeleccionado =
    seleccion.tipo === "texto"
      ? norm.bloquesTexto.find((b) => b.id === seleccion.id) ?? norm.bloquesTexto[0]!
      : norm.bloquesTexto[0]!;
  const imagenSeleccionada =
    seleccion.tipo === "imagen"
      ? norm.imagenes.find((im) => im.id === seleccion.id) ?? null
      : null;

  const iniciarArrastre = (
    tipo: "texto" | "imagen",
    id: string,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (soloLectura || modoSoloQrActivo) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSeleccion({ tipo, id });
    if (tipo === "imagen") {
      const im = norm.imagenes.find((x) => x.id === id);
      if (im?.cubrirTarjeta) return; // El fondo 100% ya ocupa toda la tarjeta
    }
    setArrastrando({ tipo, id });
  };

  const moverArrastre = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastrando || !lienzoRef.current) return;
    const rect = lienzoRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct =
      Math.round(Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100)) * 10) /
      10;
    const yPct =
      Math.round(Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100)) * 10) /
      10;

    if (arrastrando.tipo === "texto") {
      actualizarBloque(arrastrando.id, { xPct, yPct });
    } else {
      actualizarImagen(arrastrando.id, { xPct, yPct });
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
    if (norm.imagenes.length >= MAX_IMAGENES_TARJETA) {
      onError?.(`Puedes agregar hasta ${MAX_IMAGENES_TARJETA} imágenes por tarjeta.`);
      return;
    }
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
      const nuevoId = `img-${Date.now().toString(36)}`;
      const idx = norm.imagenes.length;
      const nuevaImg: ImagenDisenoTarjeta = {
        id: nuevoId,
        url: res.publicUrl,
        xPct: idx === 0 ? 50 : idx === 1 ? 26 : 74,
        yPct: idx === 0 ? (esCondolencias ? 22 : 24) : 78,
        anchoMm: Math.round(wMm * (idx === 0 ? 0.42 : 0.28)),
        cubrirTarjeta: false,
        escalaGrises: false,
        opacidad: 1,
      };
      const nuevosBloques =
        idx === 0
          ? norm.bloquesTexto.map((b) =>
              b.rol === "mensaje" && b.yPct >= 44 && b.yPct <= 56 ? { ...b, yPct: 60 } : b
            )
          : norm.bloquesTexto;
      emitirCambio({
        ...norm,
        bloquesTexto: nuevosBloques,
        imagenes: [...norm.imagenes, nuevaImg],
      });
      setSeleccion({ tipo: "imagen", id: nuevoId });
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "No se pudo cargar la imagen.");
    } finally {
      setSubiendoImg(false);
    }
  };

  const handleAgregarBloqueTexto = () => {
    const extrasActuales = norm.bloquesTexto.filter((b) => b.rol === "extra");
    if (extrasActuales.length >= MAX_BLOQUES_EXTRA_TEXTO) {
      onError?.(`Puedes agregar hasta ${MAX_BLOQUES_EXTRA_TEXTO} cuadros de texto adicionales.`);
      return;
    }
    const nuevoId = `extra-${Date.now().toString(36)}`;
    const nuevoBloque: BloqueTextoTarjeta = {
      id: nuevoId,
      rol: "extra",
      texto: extrasActuales.length === 0 ? "Para ti" : "Con cariño",
      fuente: norm.fuente,
      tamanoPt: 15,
      alineacion: "center",
      negrita: false,
      italica: false,
      colorHex: "#18181B",
      xPct: 50,
      yPct: extrasActuales.length === 0 ? 15 : 74,
      anchoPct: 80,
    };
    emitirCambio({
      ...norm,
      bloquesTexto: [...norm.bloquesTexto, nuevoBloque],
    });
    setSeleccion({ tipo: "texto", id: nuevoId });
  };

  const handleEliminarBloqueExtra = (id: string) => {
    const restantes = norm.bloquesTexto.filter((b) => b.id !== id);
    emitirCambio({ ...norm, bloquesTexto: restantes });
    setSeleccion({ tipo: "texto", id: "mensaje" });
  };

  const handleEliminarImagen = (id: string) => {
    const restantes = norm.imagenes.filter((im) => im.id !== id);
    emitirCambio({ ...norm, imagenes: restantes });
    setSeleccion({ tipo: "texto", id: "mensaje" });
  };

  const resetearPosiciones = () => {
    const esCorto = esMensajeCortoParaMitadInferior(mensaje);
    const bloquesReset = norm.bloquesTexto.map((b, idx) => {
      if (b.rol === "mensaje") {
        return {
          ...b,
          alineacion: "center" as const,
          xPct: 50,
          yPct: esCondolencias
            ? 48
            : esCorto || norm.imagenes.some((im) => !im.cubrirTarjeta)
              ? 68
              : 49,
          anchoPct: esCondolencias ? 76 : 84,
        };
      }
      if (b.rol === "firma") {
        return {
          ...b,
          alineacion: "right" as const,
          xPct: 50,
          yPct: esCondolencias ? 84 : 85,
          anchoPct: esCondolencias ? 74 : 82,
        };
      }
      return {
        ...b,
        xPct: 50,
        yPct: idx === 2 ? 15 : 74,
        anchoPct: 80,
      };
    });
    emitirCambio({ ...norm, bloquesTexto: bloquesReset });
  };

  const extrasCount = norm.bloquesTexto.filter((b) => b.rol === "extra").length;
  const firmaVisible = norm.mostrarFirma && esFirmaVisibleValida(firma);

  return (
    <div className="eco-disenador-wrap">
      <style>{`
        .eco-disenador-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .eco-disenador-toolbar {
          background: #F8F7F4;
          border: 1px solid #E6E2DA;
          border-radius: 10px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .eco-disenador-fila-capas {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }
        .eco-disenador-chips-scroll {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          min-width: 0;
        }
        .eco-disenador-acciones-top {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }
        .eco-disenador-fuentes {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
          padding-top: 6px;
          border-top: 1px dashed #D5CFC4;
          min-width: 0;
        }
        .eco-disenador-formato-fila {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          align-items: center;
          min-width: 0;
        }
        .eco-disenador-sliders {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          min-width: 0;
        }
        .eco-disenador-slider-lbl {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.69rem;
          color: #57524C;
          font-weight: 600;
          min-width: 0;
        }
        .eco-disenador-slider-input {
          flex: 1;
          min-width: 0;
          width: 100%;
          cursor: pointer;
          accent-color: #221E1B;
        }
        .eco-disenador-lienzo-box {
          background: #F4F2EE;
          border: 1px solid #E6E2DA;
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .eco-disenador-solo-movil {
          display: none;
        }
        .eco-disenador-firma-desktop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding-top: 5px;
          border-top: 1px solid #E6E2DA;
          font-size: 0.69rem;
          color: #57524C;
        }
        @media (max-width: 767px) {
          .eco-disenador-wrap {
            flex-direction: column-reverse;
            gap: 8px;
          }
          .eco-disenador-toolbar {
            padding: 8px;
            gap: 8px;
          }
          .eco-disenador-fila-capas {
            flex-wrap: nowrap;
            gap: 6px;
          }
          .eco-disenador-chips-scroll {
            flex: 1;
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 1px;
          }
          .eco-disenador-chips-scroll::-webkit-scrollbar {
            display: none;
          }
          .eco-disenador-fuentes {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 2px;
          }
          .eco-disenador-fuentes::-webkit-scrollbar {
            display: none;
          }
          .eco-disenador-fuentes button {
            flex-shrink: 0;
            white-space: nowrap;
          }
          .eco-disenador-txt-btn {
            display: none !important;
          }
          .eco-disenador-btn-ico {
            min-width: 34px !important;
            min-height: 34px !important;
            padding: 0 7px !important;
            justify-content: center !important;
          }
          .eco-disenador-formato-fila {
            justify-content: space-between;
            flex-wrap: nowrap;
            overflow-x: auto;
            scrollbar-width: none;
          }
          .eco-disenador-formato-fila::-webkit-scrollbar {
            display: none;
          }
          .eco-disenador-solo-movil {
            display: inline-flex;
          }
          .eco-disenador-firma-desktop,
          .eco-disenador-tip-movil {
            display: none !important;
          }
          .eco-disenador-lienzo-box {
            padding: 8px;
            border-radius: 10px;
          }
        }
      `}</style>

      {/* BARRA DE HERRAMIENTAS DE DISEÑADOR GRÁFICO (solo cuando imprime mensaje) */}
      {!soloLectura && !modoSoloQrActivo && (
        <div className="eco-disenador-toolbar">
          {/* Fila 1: Chips rápidos de elementos (Mensaje, Firma, Extras, Imágenes) + Botones + Imagen, + Texto, Centrar */}
          <div className="eco-disenador-fila-capas">
            <div className="eco-disenador-chips-scroll">
              <button
                type="button"
                className="eco-disenador-btn-ico"
                onClick={() => {
            setEditandoTextoId(null);
            setSeleccion({ tipo: "texto", id: "mensaje" });
          }}
                title="Seleccionar bloque de mensaje"
                aria-label="Seleccionar mensaje"
                style={{
                  padding: "4px 8px",
                  borderRadius: "999px",
                  border:
                    seleccion.tipo === "texto" && seleccion.id === "mensaje"
                      ? "1.5px solid #221E1B"
                      : "1px solid #D5CFC4",
                  background:
                    seleccion.tipo === "texto" && seleccion.id === "mensaje" ? "#221E1B" : "#FFFFFF",
                  color:
                    seleccion.tipo === "texto" && seleccion.id === "mensaje" ? "#FFFFFF" : "#57524C",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                }}
              >
                <FileText size={13} />
                <span className="eco-disenador-txt-btn">Mensaje</span>
              </button>

              {firmaVisible && (
                <button
                  type="button"
                  className="eco-disenador-btn-ico"
                  onClick={() => setSeleccion({ tipo: "texto", id: "firma" })}
                  title="Seleccionar firma (De parte de)"
                  aria-label="Seleccionar firma"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "999px",
                    border:
                      seleccion.tipo === "texto" && seleccion.id === "firma"
                        ? "1.5px solid #221E1B"
                        : "1px solid #D5CFC4",
                    background:
                      seleccion.tipo === "texto" && seleccion.id === "firma" ? "#221E1B" : "#FFFFFF",
                    color:
                      seleccion.tipo === "texto" && seleccion.id === "firma" ? "#FFFFFF" : "#57524C",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  <PenLine size={13} />
                  <span className="eco-disenador-txt-btn">Firma</span>
                </button>
              )}

              {norm.bloquesTexto
                .filter((b) => b.rol === "extra")
                .map((b, idx) => {
                  const act = seleccion.tipo === "texto" && seleccion.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className="eco-disenador-btn-ico"
                      onClick={() => setSeleccion({ tipo: "texto", id: b.id })}
                      title={`Seleccionar texto adicional ${idx + 1}`}
                      aria-label={`Texto adicional ${idx + 1}`}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "999px",
                        border: act ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                        background: act ? "#221E1B" : "#FFFFFF",
                        color: act ? "#FFFFFF" : "#57524C",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        flexShrink: 0,
                      }}
                    >
                      <Type size={13} />
                      <span className="eco-disenador-txt-btn">Texto</span>
                      <span style={{ fontSize: "0.65rem" }}>{idx + 1}</span>
                    </button>
                  );
                })}

              {norm.imagenes.map((im, idx) => {
                const act = seleccion.tipo === "imagen" && seleccion.id === im.id;
                return (
                  <button
                    key={im.id}
                    type="button"
                    className="eco-disenador-btn-ico"
                    onClick={() => setSeleccion({ tipo: "imagen", id: im.id })}
                    title={`Seleccionar imagen ${idx + 1}`}
                    aria-label={`Imagen ${idx + 1}`}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "999px",
                      border: act ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                      background: act ? "#2F4737" : "#FFFFFF",
                      color: act ? "#FFFFFF" : "#57524C",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      flexShrink: 0,
                    }}
                  >
                    <ImageIcon size={13} />
                    <span className="eco-disenador-txt-btn">Img</span>
                    <span style={{ fontSize: "0.65rem" }}>{idx + 1}</span>
                  </button>
                );
              })}
            </div>

            <div className="eco-disenador-acciones-top">
              <button
                type="button"
                className="eco-disenador-btn-ico"
                disabled={subiendoImg || norm.imagenes.length >= MAX_IMAGENES_TARJETA}
                onClick={() => inputImgRef.current?.click()}
                title={`Agregar imagen o logotipo (${norm.imagenes.length}/${MAX_IMAGENES_TARJETA})`}
                aria-label={`Agregar imagen (${norm.imagenes.length} de ${MAX_IMAGENES_TARJETA})`}
                style={{
                  padding: "4px 8px",
                  borderRadius: "7px",
                  border: "1px solid #2F4737",
                  background: norm.imagenes.length >= MAX_IMAGENES_TARJETA ? "#F4F2EE" : "#F2F6F3",
                  color: norm.imagenes.length >= MAX_IMAGENES_TARJETA ? "#9C948A" : "#2F4737",
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  cursor: norm.imagenes.length >= MAX_IMAGENES_TARJETA ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {subiendoImg ? <Loader2 size={14} className="eco-spin" /> : <ImagePlus size={14} />}
                <span className="eco-disenador-txt-btn">
                  {subiendoImg
                    ? "Subiendo..."
                    : `Imagen (${norm.imagenes.length}/${MAX_IMAGENES_TARJETA})`}
                </span>
              </button>
              <input
                ref={inputImgRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => void handleSubirImagen(e)}
                style={{ display: "none" }}
              />

              <button
                type="button"
                className="eco-disenador-btn-ico"
                disabled={extrasCount >= MAX_BLOQUES_EXTRA_TEXTO}
                onClick={handleAgregarBloqueTexto}
                title="Agregar cuadro de texto adicional"
                aria-label="Agregar cuadro de texto"
                style={{
                  padding: "4px 8px",
                  borderRadius: "7px",
                  border: "1px solid #D5CFC4",
                  background: extrasCount >= MAX_BLOQUES_EXTRA_TEXTO ? "#F4F2EE" : "#FFFFFF",
                  color: extrasCount >= MAX_BLOQUES_EXTRA_TEXTO ? "#9C948A" : "#1F1C19",
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  cursor: extrasCount >= MAX_BLOQUES_EXTRA_TEXTO ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <Plus size={14} />
                <span className="eco-disenador-txt-btn">Texto</span>
              </button>

              <button
                type="button"
                className="eco-disenador-btn-ico"
                onClick={resetearPosiciones}
                title="Restablecer centrado automático"
                aria-label="Restablecer centrado"
                style={{
                  padding: "4px 8px",
                  borderRadius: "7px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#57524C",
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <RotateCcw size={14} />
                <span className="eco-disenador-txt-btn">Centrar</span>
              </button>
            </div>
          </div>

          {/* CONTROLES CONTEXTUALES: SI HAY UNA IMAGEN SELECCIONADA (ROTACIÓN, TRANSPARENCIA, TAMAÑO 100%, B/N) */}
          {imagenSeleccionada ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                paddingTop: "6px",
                borderTop: "1px dashed #D5CFC4",
                minWidth: 0,
              }}
            >
              {/* Fila A: Fondo 100% + Tamaño + B/N + Quitar */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", minWidth: 0 }}>
                <button
                  type="button"
                  className="eco-disenador-btn-ico"
                  onClick={() =>
                    actualizarImagen(imagenSeleccionada.id, {
                      cubrirTarjeta: !imagenSeleccionada.cubrirTarjeta,
                      ...(imagenSeleccionada.cubrirTarjeta
                        ? { anchoMm: Math.round(wMm * 0.6) }
                        : { anchoMm: wMm, xPct: 50, yPct: 50 }),
                    })
                  }
                  title="Ampliar imagen al 100% del espacio de la tarjeta"
                  aria-label="Fondo 100%"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "7px",
                    border: imagenSeleccionada.cubrirTarjeta
                      ? "1.5px solid #2F4737"
                      : "1px solid #D5CFC4",
                    background: imagenSeleccionada.cubrirTarjeta ? "#F2F6F3" : "#FFFFFF",
                    color: imagenSeleccionada.cubrirTarjeta ? "#2F4737" : "#1F1C19",
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Maximize2 size={13} />
                  <span className="eco-disenador-txt-btn">Fondo 100%</span>
                </button>

                {!imagenSeleccionada.cubrirTarjeta && (
                  <label
                    className="eco-disenador-slider-lbl"
                    style={{ flex: 1, minWidth: "90px" }}
                    title="Tamaño de imagen"
                  >
                    <MoveHorizontal size={13} className="eco-disenador-solo-movil" />
                    <span className="eco-disenador-txt-btn">Tamaño:</span>
                    <input
                      type="range"
                      aria-label="Tamaño de imagen"
                      min="14"
                      max={wMm}
                      value={Math.min(wMm, imagenSeleccionada.anchoMm)}
                      onChange={(e) =>
                        actualizarImagen(imagenSeleccionada.id, { anchoMm: Number(e.target.value) })
                      }
                      className="eco-disenador-slider-input"
                    />
                    <strong style={{ minWidth: "30px", textAlign: "right", color: "#1F1C19" }}>
                      {Math.round((Math.min(wMm, imagenSeleccionada.anchoMm) / wMm) * 100)}%
                    </strong>
                  </label>
                )}

                <button
                  type="button"
                  className="eco-disenador-btn-ico"
                  onClick={() =>
                    actualizarImagen(imagenSeleccionada.id, {
                      escalaGrises: !imagenSeleccionada.escalaGrises,
                    })
                  }
                  title="Blanco y negro"
                  aria-label="Blanco y negro"
                  aria-pressed={Boolean(imagenSeleccionada.escalaGrises)}
                  style={{
                    padding: "4px 7px",
                    borderRadius: "7px",
                    border: imagenSeleccionada.escalaGrises
                      ? "1.5px solid #221E1B"
                      : "1px solid #D5CFC4",
                    background: imagenSeleccionada.escalaGrises ? "#221E1B" : "#FFFFFF",
                    color: imagenSeleccionada.escalaGrises ? "#FFFFFF" : "#57524C",
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <Contrast size={13} />
                  <span className="eco-disenador-txt-btn">B/N</span>
                </button>

                <button
                  type="button"
                  className="eco-disenador-btn-ico"
                  onClick={() => handleEliminarImagen(imagenSeleccionada.id)}
                  title="Quitar esta imagen"
                  aria-label="Quitar imagen"
                  style={{
                    marginLeft: "auto",
                    padding: "4px 7px",
                    borderRadius: "7px",
                    border: "1px solid #E5CACA",
                    background: "#FAF2F2",
                    color: "#8A2E2E",
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <Trash2 size={13} />
                  <span className="eco-disenador-txt-btn">Quitar</span>
                </button>
              </div>

              {/* Fila B: Rotación (-180° a +180° + botones rápidos) */}
              <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "5px", minWidth: 0 }}>
                <span className="eco-disenador-txt-btn" style={{ fontSize: "0.69rem", fontWeight: 700, color: "#57524C" }}>
                  Rotar:
                </span>
                <button
                  type="button"
                  className="eco-disenador-btn-ico"
                  onClick={() => {
                    const actual = imagenSeleccionada.rotacionDeg || 0;
                    const sig = actual - 90 < -180 ? actual + 270 : actual - 90;
                    actualizarImagen(imagenSeleccionada.id, { rotacionDeg: sig });
                  }}
                  title="Girar 90° a la izquierda"
                  aria-label="Rotar -90 grados"
                  style={{
                    padding: "3px 6px",
                    borderRadius: "6px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#1F1C19",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    flexShrink: 0,
                  }}
                >
                  <RotateCcw size={12} />
                  <span className="eco-disenador-txt-btn">90°</span>
                </button>
                <button
                  type="button"
                  className="eco-disenador-txt-btn"
                  onClick={() =>
                    actualizarImagen(imagenSeleccionada.id, {
                      rotacionDeg: Math.max(-180, (imagenSeleccionada.rotacionDeg || 0) - 15),
                    })
                  }
                  title="Girar -15°"
                  aria-label="Rotar -15 grados"
                  style={{
                    padding: "3px 5px",
                    borderRadius: "6px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#57524C",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  -15°
                </button>
                <input
                  type="range"
                  aria-label="Rotación de imagen"
                  min="-180"
                  max="180"
                  value={imagenSeleccionada.rotacionDeg || 0}
                  onChange={(e) =>
                    actualizarImagen(imagenSeleccionada.id, { rotacionDeg: Number(e.target.value) })
                  }
                  className="eco-disenador-slider-input"
                />
                <strong style={{ fontSize: "0.69rem", minWidth: "32px", textAlign: "right", color: "#1F1C19", flexShrink: 0 }}>
                  {imagenSeleccionada.rotacionDeg || 0}°
                </strong>
                <button
                  type="button"
                  className="eco-disenador-txt-btn"
                  onClick={() =>
                    actualizarImagen(imagenSeleccionada.id, {
                      rotacionDeg: Math.min(180, (imagenSeleccionada.rotacionDeg || 0) + 15),
                    })
                  }
                  title="Girar +15°"
                  aria-label="Rotar +15 grados"
                  style={{
                    padding: "3px 5px",
                    borderRadius: "6px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#57524C",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  +15°
                </button>
                <button
                  type="button"
                  className="eco-disenador-btn-ico"
                  onClick={() => {
                    const actual = imagenSeleccionada.rotacionDeg || 0;
                    const sig = actual + 90 > 180 ? actual - 270 : actual + 90;
                    actualizarImagen(imagenSeleccionada.id, { rotacionDeg: sig });
                  }}
                  title="Girar 90° a la derecha"
                  aria-label="Rotar +90 grados"
                  style={{
                    padding: "3px 6px",
                    borderRadius: "6px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    color: "#1F1C19",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    flexShrink: 0,
                  }}
                >
                  <RotateCw size={12} />
                  <span className="eco-disenador-txt-btn">90°</span>
                </button>
                {(imagenSeleccionada.rotacionDeg || 0) !== 0 && (
                  <button
                    type="button"
                    onClick={() => actualizarImagen(imagenSeleccionada.id, { rotacionDeg: 0 })}
                    title="Restablecer rotación a 0°"
                    aria-label="Rotación 0 grados"
                    style={{
                      padding: "3px 6px",
                      borderRadius: "6px",
                      border: "1px solid #221E1B",
                      background: "#F4F2EE",
                      color: "#221E1B",
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    0°
                  </button>
                )}
              </div>

              {/* Fila C: Transparencia (0% opaca a 90% marca de agua + accesos rápidos) */}
              {(() => {
                const transpActual = Math.round((1 - (imagenSeleccionada.opacidad ?? 1)) * 100);
                return (
                  <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "5px", minWidth: 0 }}>
                    <Droplets size={13} className="eco-disenador-solo-movil" style={{ color: "#57524C", flexShrink: 0 }} />
                    <span className="eco-disenador-txt-btn" style={{ fontSize: "0.69rem", fontWeight: 700, color: "#57524C" }}>
                      Transparencia:
                    </span>
                    <input
                      type="range"
                      aria-label="Transparencia de imagen"
                      min="0"
                      max="90"
                      value={transpActual}
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        actualizarImagen(imagenSeleccionada.id, {
                          opacidad: Math.max(0.1, Math.min(1, Number((1 - t / 100).toFixed(2)))),
                        });
                      }}
                      className="eco-disenador-slider-input"
                    />
                    <strong style={{ fontSize: "0.69rem", minWidth: "30px", textAlign: "right", color: "#1F1C19", flexShrink: 0 }}>
                      {transpActual}%
                    </strong>
                    {(
                      [
                        { label: "0%", op: 1 },
                        { label: "40%", op: 0.6 },
                        { label: "70%", op: 0.3 },
                      ] as const
                    ).map((p) => {
                      const activoOp = Math.abs((imagenSeleccionada.opacidad ?? 1) - p.op) < 0.05;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => actualizarImagen(imagenSeleccionada.id, { opacidad: p.op })}
                          style={{
                            padding: "3px 6px",
                            borderRadius: "6px",
                            border: activoOp ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                            background: activoOp ? "#F2F6F3" : "#FFFFFF",
                            color: activoOp ? "#2F4737" : "#57524C",
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* CONTROLES CONTEXTUALES: SI HAY UN CUADRO DE TEXTO SELECCIONADO */
            <>
              {/* 6 Fuentes curadas con vista previa real (scroll horizontal limpio en móvil) */}
              <div className="eco-disenador-fuentes">
                {CATALOGO_FUENTES_TARJETA.map((f) => {
                  const activa =
                    normalizarClaveFuenteTarjeta(bloqueSeleccionado.fuente, esCondolencias) === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => actualizarBloque(bloqueSeleccionado.id, { fuente: f.id })}
                      title={`Tipografía ${f.etiqueta}`}
                      aria-label={`Fuente ${f.etiqueta}`}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "7px",
                        border: activa ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                        background: activa ? "#221E1B" : "#FFFFFF",
                        color: activa ? "#FFFFFF" : "#3A3530",
                        fontFamily: f.cssFamily,
                        fontSize:
                          f.id === "cursiva" || f.id === "caligrafia" || f.id === "manuscrita"
                            ? "0.86rem"
                            : "0.73rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {f.etiqueta}
                    </button>
                  );
                })}
              </div>

              {/* Alineación + B/I + Toggle Firma (móvil solo ícono) */}
              <div className="eco-disenador-formato-fila">
                <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                  {(
                    [
                      { id: "left", icon: AlignLeft, title: "Alinear a la izquierda" },
                      { id: "center", icon: AlignCenter, title: "Centrar texto" },
                      { id: "right", icon: AlignRight, title: "Alinear a la derecha" },
                      { id: "justify", icon: AlignJustify, title: "Justificar texto" },
                    ] as const
                  ).map(({ id, icon: Icon, title }) => {
                    const activoAlign = (bloqueSeleccionado.alineacion || "center") === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className="eco-disenador-btn-ico"
                        onClick={() => actualizarBloque(bloqueSeleccionado.id, { alineacion: id })}
                        title={title}
                        aria-label={title}
                        aria-pressed={activoAlign}
                        style={{
                          padding: "5px 7px",
                          borderRadius: "7px",
                          border: activoAlign ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                          background: activoAlign ? "#221E1B" : "#FFFFFF",
                          color: activoAlign ? "#FFFFFF" : "#57524C",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="eco-disenador-btn-ico"
                    onClick={() =>
                      actualizarBloque(bloqueSeleccionado.id, {
                        negrita: !bloqueSeleccionado.negrita,
                      })
                    }
                    title="Negrita"
                    aria-label="Negrita"
                    aria-pressed={Boolean(bloqueSeleccionado.negrita)}
                    style={{
                      padding: "5px 7px",
                      borderRadius: "7px",
                      border: bloqueSeleccionado.negrita ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                      background: bloqueSeleccionado.negrita ? "#221E1B" : "#FFFFFF",
                      color: bloqueSeleccionado.negrita ? "#FFFFFF" : "#57524C",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Bold size={14} />
                  </button>

                  <button
                    type="button"
                    className="eco-disenador-btn-ico"
                    onClick={() =>
                      actualizarBloque(bloqueSeleccionado.id, {
                        italica: !bloqueSeleccionado.italica,
                      })
                    }
                    title="Itálica"
                    aria-label="Itálica"
                    aria-pressed={Boolean(bloqueSeleccionado.italica)}
                    style={{
                      padding: "5px 7px",
                      borderRadius: "7px",
                      border: bloqueSeleccionado.italica ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                      background: bloqueSeleccionado.italica ? "#221E1B" : "#FFFFFF",
                      color: bloqueSeleccionado.italica ? "#FFFFFF" : "#57524C",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Italic size={14} />
                  </button>

                  {/* En móvil: botón solo ícono para incluir/ocultar firma sin párrafo largo */}
                  <button
                    type="button"
                    className="eco-disenador-solo-movil eco-disenador-btn-ico"
                    onClick={() => emitirCambio({ ...norm, mostrarFirma: !norm.mostrarFirma })}
                    title={norm.mostrarFirma ? "Ocultar firma en tarjeta" : "Mostrar firma en tarjeta"}
                    aria-label="Mostrar u ocultar firma en la tarjeta"
                    aria-pressed={norm.mostrarFirma}
                    style={{
                      padding: "5px 7px",
                      borderRadius: "7px",
                      border: norm.mostrarFirma ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                      background: norm.mostrarFirma ? "#F2F6F3" : "#FFFFFF",
                      color: norm.mostrarFirma ? "#2F4737" : "#847D74",
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                  >
                    <PenLine size={14} />
                  </button>
                </div>
              </div>

              <div className="eco-disenador-sliders">
                <label className="eco-disenador-slider-lbl" title="Tamaño de letra (puntos)">
                  <Type size={13} className="eco-disenador-solo-movil" style={{ flexShrink: 0 }} />
                  <span className="eco-disenador-txt-btn">Pt:</span>
                  <input
                    type="range"
                    aria-label="Tamaño de fuente en puntos"
                    min="9"
                    max="38"
                    value={bloqueSeleccionado.tamanoPt || 18}
                    onChange={(e) =>
                      actualizarBloque(bloqueSeleccionado.id, { tamanoPt: Number(e.target.value) })
                    }
                    className="eco-disenador-slider-input"
                  />
                  <strong style={{ minWidth: "22px", textAlign: "right", color: "#1F1C19", flexShrink: 0 }}>
                    {bloqueSeleccionado.tamanoPt || 18}
                  </strong>
                </label>

                <label className="eco-disenador-slider-lbl" title="Ancho del cuadro de texto">
                  <MoveHorizontal size={13} className="eco-disenador-solo-movil" style={{ flexShrink: 0 }} />
                  <span className="eco-disenador-txt-btn">Ancho:</span>
                  <input
                    type="range"
                    aria-label="Ancho del cuadro de texto"
                    min="30"
                    max="96"
                    value={bloqueSeleccionado.anchoPct}
                    onChange={(e) =>
                      actualizarBloque(bloqueSeleccionado.id, { anchoPct: Number(e.target.value) })
                    }
                    className="eco-disenador-slider-input"
                  />
                  <strong style={{ minWidth: "30px", textAlign: "right", color: "#1F1C19", flexShrink: 0 }}>
                    {bloqueSeleccionado.anchoPct}%
                  </strong>
                </label>
              </div>

              {/* Control de edición directa del texto seleccionado (Mensaje, Firma o Texto extra) */}
              {puedeEditarBloqueTexto(bloqueSeleccionado) && (
                <div style={{ display: "flex", gap: "6px", alignItems: "flex-start", minWidth: 0 }}>
                  {bloqueSeleccionado.rol === "mensaje" ? (
                    <textarea
                      rows={2}
                      value={obtenerValorEditableBloque(bloqueSeleccionado)}
                      onChange={(e) => handleCambiarValorBloque(bloqueSeleccionado, e.target.value)}
                      placeholder={
                        esCondolencias
                          ? "Escribe el mensaje de condolencias..."
                          : "Escribe el mensaje de tu tarjeta..."
                      }
                      aria-label="Editar texto del mensaje"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CFC8BC",
                        fontSize: "16px",
                        lineHeight: 1.4,
                        background: "#FFFFFF",
                        color: "#1F1C19",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={obtenerValorEditableBloque(bloqueSeleccionado)}
                      onChange={(e) => handleCambiarValorBloque(bloqueSeleccionado, e.target.value)}
                      placeholder={
                        bloqueSeleccionado.rol === "firma"
                          ? "Firma (ej: Att: Kleber)"
                          : "Texto adicional..."
                      }
                      aria-label={
                        bloqueSeleccionado.rol === "firma"
                          ? "Editar firma"
                          : "Editar texto adicional"
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "7px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CFC8BC",
                        fontSize: "16px",
                        background: "#FFFFFF",
                        color: "#1F1C19",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                  {bloqueSeleccionado.rol === "extra" && (
                    <button
                      type="button"
                      className="eco-disenador-btn-ico"
                      onClick={() => handleEliminarBloqueExtra(bloqueSeleccionado.id)}
                      title="Eliminar cuadro de texto adicional"
                      aria-label="Quitar texto adicional"
                      style={{
                        padding: "8px 9px",
                        borderRadius: "8px",
                        border: "1px solid #E5CACA",
                        background: "#FAF2F2",
                        color: "#8A2E2E",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} />
                      <span className="eco-disenador-txt-btn">Quitar</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Toggle de firma en tarjeta (desktop) */}
          <div className="eco-disenador-firma-desktop">
            <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={norm.mostrarFirma}
                onChange={(e) => emitirCambio({ ...norm, mostrarFirma: e.target.checked })}
                style={{ accentColor: "#221E1B" }}
              />
              <span>Incluir firma (&ldquo;De parte de&rdquo;) en la tarjeta</span>
            </label>
            {norm.imagenes.length > 0 && (
              <span style={{ color: "#847D74" }}>
                Toca imagen o texto para editar
              </span>
            )}
          </div>
        </div>
      )}

      {/* LIENZO INTERACTIVO EN PROPORCIÓN REAL (113×168 mm VERTICAL O 168×113 mm HORIZONTAL) */}
      <div className="eco-disenador-lienzo-box">
        <div
          ref={lienzoRef}
          onClick={() => {
            setEditandoTextoId(null);
            setSeleccion({ tipo: "texto", id: "mensaje" });
          }}
          style={{
            width: esCondolencias ? "100%" : "min(238px, 68vw)",
            maxWidth: esCondolencias ? "400px" : "244px",
            aspectRatio: `${wMm} / ${hMm}`,
            backgroundColor: "#FAF8F4",
            border: "1.5px solid #D5CFC4",
            borderRadius: "6px",
            boxShadow: "0 8px 20px rgba(31, 28, 25, 0.1)",
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
                borderTop: "1px dashed rgba(132, 125, 116, 0.48)",
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              <span
                className="eco-disenador-tip-movil"
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "-13px",
                  fontSize: "0.56rem",
                  color: "#847D74",
                  background: "rgba(250, 248, 244, 0.9)",
                  padding: "0 3px",
                }}
              >
                doblez 8,4 cm
              </span>
            </div>
          )}

          {/* Arte sobrio lineal monocromático en esquinas diagonales para Condolencias */}
          {esCondolencias && (
            <>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: "4.6%",
                  border: "1px solid rgba(63, 63, 70, 0.24)",
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 64 64"
                fill="none"
                style={{
                  position: "absolute",
                  top: "7%",
                  left: "5.5%",
                  width: "30px",
                  height: "30px",
                  opacity: 0.28,
                  pointerEvents: "none",
                  zIndex: 4,
                }}
              >
                <path d="M8 54 C14 34, 28 18, 54 10" stroke="#3F3F46" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M22 33 C17 24, 21 15, 29 18 C27 25, 24 29, 22 33 Z" stroke="#3F3F46" strokeWidth="1.2" />
                <path d="M34 22 C35 13, 44 10, 48 16 C42 20, 38 22, 34 22 Z" stroke="#3F3F46" strokeWidth="1.2" />
              </svg>
              <svg
                aria-hidden="true"
                viewBox="0 0 64 64"
                fill="none"
                style={{
                  position: "absolute",
                  bottom: "7%",
                  right: "5.5%",
                  width: "30px",
                  height: "30px",
                  opacity: 0.28,
                  transform: "rotate(180deg)",
                  pointerEvents: "none",
                  zIndex: 4,
                }}
              >
                <path d="M8 54 C14 34, 28 18, 54 10" stroke="#3F3F46" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M22 33 C17 24, 21 15, 29 18 C27 25, 24 29, 22 33 Z" stroke="#3F3F46" strokeWidth="1.2" />
                <path d="M34 22 C35 13, 44 10, 48 16 C42 20, 38 22, 34 22 Z" stroke="#3F3F46" strokeWidth="1.2" />
              </svg>
            </>
          )}

          {modoSoloQrActivo ? (
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
                    border: "1px dashed #847D74",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    color: "#57524C",
                    fontWeight: 700,
                  }}
                >
                  QR
                </div>
              )}
              <span style={{ fontSize: "0.55rem", color: "#57524C", fontWeight: 600 }}>
                Solo QR (mensaje en web)
              </span>
            </div>
          ) : (
            <>
              {/* IMÁGENES (HASTA 3, CON SOPORTE 100% DEL ESPACIO) */}
              {norm.imagenes.map((im) => {
                const estaActiva = seleccion.tipo === "imagen" && seleccion.id === im.id;
                const anchoPct = Math.max(8, Math.min(100, (im.anchoMm / wMm) * 100));
                return (
                  <div
                    key={im.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeleccion({ tipo: "imagen", id: im.id });
                    }}
                    onPointerDown={(e) => iniciarArrastre("imagen", im.id, e)}
                    onPointerMove={moverArrastre}
                    onPointerUp={terminarArrastre}
                    onPointerCancel={terminarArrastre}
                    title={
                      soloLectura
                        ? undefined
                        : im.cubrirTarjeta
                          ? "Imagen de fondo 100% (toca para ajustar opacidad o quitar)"
                          : "Arrastra para mover esta imagen"
                    }
                    style={
                      im.cubrirTarjeta
                        ? {
                            position: "absolute",
                            inset: 0,
                            zIndex: 1,
                            cursor: soloLectura ? "default" : "pointer",
                            border: !soloLectura && estaActiva ? "2px dashed #2F4737" : "none",
                            boxSizing: "border-box",
                          }
                        : {
                            position: "absolute",
                            left: `${im.xPct}%`,
                            top: `${im.yPct}%`,
                            transform: `translate(-50%, -50%) rotate(${im.rotacionDeg || 0}deg)`,
                            width: `${anchoPct}%`,
                            cursor: soloLectura
                              ? "default"
                              : arrastrando?.id === im.id
                                ? "grabbing"
                                : "grab",
                            border:
                              !soloLectura && estaActiva
                                ? "1.5px dashed #2F4737"
                                : !soloLectura
                                  ? "1px dashed rgba(132, 125, 116, 0.35)"
                                  : "none",
                            borderRadius: "4px",
                            zIndex: 2,
                            boxSizing: "border-box",
                          }
                    }
                  >
                    <img
                      src={im.url}
                      alt="Imagen tarjeta"
                      draggable={false}
                      style={{
                        width: "100%",
                        height: im.cubrirTarjeta ? "100%" : "auto",
                        display: "block",
                        objectFit: im.cubrirTarjeta ? "cover" : "contain",
                        opacity: im.opacidad ?? 1,
                        transform:
                          im.cubrirTarjeta && (im.rotacionDeg || 0) !== 0
                            ? `rotate(${im.rotacionDeg}deg)`
                            : undefined,
                        filter: im.escalaGrises ? "grayscale(100%)" : "none",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                );
              })}

              {/* BLOQUES DE TEXTO (MENSAJE + FIRMA + EXTRAS) */}
              {norm.bloquesTexto.map((blk) => {
                if (blk.rol === "firma" && !firmaVisible) return null;
                const contenidoBase =
                  blk.rol === "mensaje"
                    ? mensaje ||
                      (esCondolencias
                        ? "Expresamos nuestras más sentidas condolencias."
                        : "Escribe el mensaje de dedicatoria...")
                    : blk.rol === "firma"
                      ? firma.trim()
                      : blk.texto || "Texto adicional";
                const contenido =
                  blk.rol === "mensaje"
                    ? ajustarTextoParaDoblezDiptico(
                        contenidoBase,
                        esCondolencias,
                        blk.yPct,
                        blk.tamanoPt || 18,
                        blk.anchoPct || 84
                      )
                    : contenidoBase;

                const estaActivo = seleccion.tipo === "texto" && seleccion.id === blk.id;
                const editable = puedeEditarBloqueTexto(blk);
                const estaEditandoInline = editable && editandoTextoId === blk.id;
                const fontSizeCss = `${Math.max(8, (blk.tamanoPt || 18) * 0.66)}pt`;
                return (
                  <div
                    key={blk.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeleccion({ tipo: "texto", id: blk.id });
                      if (editandoTextoId && editandoTextoId !== blk.id) {
                        setEditandoTextoId(null);
                      }
                    }}
                    onDoubleClick={(e) => {
                      if (!editable) return;
                      e.stopPropagation();
                      setSeleccion({ tipo: "texto", id: blk.id });
                      setEditandoTextoId(blk.id);
                    }}
                    onPointerDown={(e) => {
                      if (estaEditandoInline) {
                        e.stopPropagation();
                        return;
                      }
                      iniciarArrastre("texto", blk.id, e);
                    }}
                    onPointerMove={estaEditandoInline ? undefined : moverArrastre}
                    onPointerUp={estaEditandoInline ? undefined : terminarArrastre}
                    onPointerCancel={estaEditandoInline ? undefined : terminarArrastre}
                    title={
                      soloLectura
                        ? undefined
                        : editable
                          ? "Arrastra para mover o haz doble clic para editar el texto aquí"
                          : "Arrastra para mover este cuadro de texto"
                    }
                    style={{
                      position: "absolute",
                      left: `${blk.xPct}%`,
                      top: `${blk.yPct}%`,
                      transform: "translate(-50%, -50%)",
                      width: `${blk.anchoPct}%`,
                      fontFamily: resolverFontFamilyCss(blk.fuente, esCondolencias),
                      fontSize: fontSizeCss,
                      fontWeight: blk.negrita ? 700 : 400,
                      fontStyle: blk.italica ? "italic" : "normal",
                      textAlign: blk.alineacion || "center",
                      lineHeight: 1.35,
                      color: blk.colorHex || "#18181B",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      cursor: soloLectura
                        ? "default"
                        : estaEditandoInline
                          ? "text"
                          : arrastrando?.id === blk.id
                            ? "grabbing"
                            : "grab",
                      border: estaEditandoInline
                        ? "2px solid #2F4737"
                        : !soloLectura && estaActivo
                          ? "1.5px dashed #221E1B"
                          : !soloLectura
                            ? "1px dashed rgba(132, 125, 116, 0.42)"
                            : "none",
                      backgroundColor: estaEditandoInline ? "rgba(255, 255, 255, 0.92)" : "transparent",
                      borderRadius: "4px",
                      padding: "3px 5px",
                      boxSizing: "border-box",
                      zIndex: estaEditandoInline ? 9 : 6,
                    }}
                  >
                    {estaEditandoInline ? (
                      <textarea
                        autoFocus
                        rows={blk.rol === "mensaje" ? Math.max(2, Math.min(7, obtenerValorEditableBloque(blk).split(/\r?\n/).length + 1)) : 1}
                        value={obtenerValorEditableBloque(blk)}
                        onChange={(e) => handleCambiarValorBloque(blk, e.target.value)}
                        onBlur={() => setEditandoTextoId(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" || (blk.rol !== "mensaje" && e.key === "Enter")) {
                            e.preventDefault();
                            setEditandoTextoId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        aria-label="Editar texto directamente en la tarjeta"
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          padding: 0,
                          margin: 0,
                          fontFamily: "inherit",
                          fontSize: "inherit",
                          fontWeight: "inherit",
                          fontStyle: "inherit",
                          textAlign: blk.alineacion || "center",
                          lineHeight: 1.35,
                          color: "inherit",
                          resize: "none",
                          boxSizing: "border-box",
                          display: "block",
                        }}
                      />
                    ) : (
                      <>
                        {contenido}
                        {estaActivo && editable && (
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditandoTextoId(blk.id);
                            }}
                            title="Escribir texto directamente en la tarjeta"
                            aria-label="Editar texto"
                            style={{
                              position: "absolute",
                              top: "-20px",
                              right: "-2px",
                              padding: "2px 7px",
                              borderRadius: "999px",
                              border: "none",
                              backgroundColor: "#221E1B",
                              color: "#FFFFFF",
                              fontFamily: "'Inter', sans-serif",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              fontStyle: "normal",
                              lineHeight: 1.4,
                              letterSpacing: "0.02em",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                            }}
                          >
                            <PenLine size={9} />
                            <span>Editar</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* QR COMPACTO EN ESQUINA INFERIOR DERECHA (SOLO SI MODO = MENSAJE + QR DIGITAL) */}
              {!esCondolencias && !modoSoloQrActivo && incluirQrEnEsquina && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: "3.5%",
                    bottom: "2.4%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1px",
                    backgroundColor: "rgba(255, 255, 255, 0.92)",
                    padding: "2px",
                    borderRadius: "4px",
                    border: "1px solid rgba(132, 125, 116, 0.25)",
                    pointerEvents: "none",
                    zIndex: 7,
                  }}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Tarjeta Digital"
                      style={{ width: "30px", height: "30px", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.48rem",
                        fontWeight: 700,
                        color: "#57524C",
                        border: "1px dashed #B5AEA4",
                      }}
                    >
                      QR
                    </div>
                  )}
                  <span style={{ fontSize: "0.38rem", color: "#57524C", fontWeight: 700 }}>
                    Digital
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {!soloLectura && !modoSoloQrActivo && (
          <span
            className="eco-disenador-tip-movil"
            style={{
              fontSize: "0.68rem",
              color: "#847D74",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Move size={11} />
            Arrastra cada texto o imagen para moverlo, cambiar fuente o ampliarlo al 100%.
          </span>
        )}
      </div>
    </div>
  );
}
