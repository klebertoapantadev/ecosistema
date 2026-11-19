"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Loader2,
  Maximize2,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";
import type {
  BloqueTextoTarjeta,
  ClaveFuenteTarjeta,
  DisenoVisualTarjeta,
  ImagenDisenoTarjeta,
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
  bloquesTexto: BloqueTextoTarjeta[];
  imagenes: ImagenDisenoTarjeta[];
  /** Campos legados sincronizados con la 1ra imagen */
  imagenUrl: string | null;
  imagenXPct: number;
  imagenYPct: number;
  imagenAnchoMm: number;
  escalaGrisesImagen: boolean;
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
  const textoXPct = typeof diseno?.textoXPct === "number" ? diseno.textoXPct : 50;
  const textoYPct = typeof diseno?.textoYPct === "number" ? diseno.textoYPct : 50;
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
          : 86,
    anchoPct:
      typeof bloqueFirmaEntrada?.anchoPct === "number"
        ? bloqueFirmaEntrada.anchoPct
        : esCondolencias
          ? 74
          : 82,
  };

  const primeraImg = imagenes[0] ?? null;

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
        texto =
          params.mensaje.trim() ||
          (params.esCondolencias
            ? "Expresamos nuestras más sentidas condolencias."
            : "Con todo mi cariño");
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
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.96);
  });
}

export interface PropsLienzoDisenadorTarjeta {
  negocio: string;
  esCondolencias: boolean;
  /** En Dedicatoria, true = imprime SOLO QR (sin mensaje ni imagen); false = imprime Mensaje + Imágenes (sin QR). En Condolencias siempre es false. */
  soloQr: boolean;
  mensaje: string;
  /** Texto de la firma ("De parte de"), renderizado como cuadro de texto independiente en la tarjeta */
  firma?: string;
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
  mensaje,
  firma = "",
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
      bloquesTexto: siguiente.bloquesTexto,
      imagenes: siguiente.imagenes,
      imagenUrl: primImg ? primImg.url : null,
      imagenXPct: primImg ? primImg.xPct : 50,
      imagenYPct: primImg ? primImg.yPct : 24,
      imagenAnchoMm: primImg ? primImg.anchoMm : 36,
      escalaGrisesImagen: primImg ? Boolean(primeraImgGrises(primImg)) : false,
    });
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
    const bloquesReset = norm.bloquesTexto.map((b, idx) => {
      if (b.rol === "mensaje") {
        return {
          ...b,
          alineacion: "center" as const,
          xPct: 50,
          yPct: norm.imagenes.some((im) => !im.cubrirTarjeta) ? 60 : 50,
          anchoPct: esCondolencias ? 76 : 84,
        };
      }
      if (b.rol === "firma") {
        return {
          ...b,
          alineacion: "right" as const,
          xPct: 50,
          yPct: esCondolencias ? 84 : 86,
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
          {/* Fila 1: Chips rápidos de elementos (Mensaje, Firma, Extras, Imágenes) + Botones + Imagen y + Texto */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setSeleccion({ tipo: "texto", id: "mensaje" })}
              style={{
                padding: "2px 7px",
                borderRadius: "999px",
                border:
                  seleccion.tipo === "texto" && seleccion.id === "mensaje"
                    ? "1.5px solid #0284C7"
                    : "1px solid #CBD5E1",
                background:
                  seleccion.tipo === "texto" && seleccion.id === "mensaje" ? "#E0F2FE" : "#FFFFFF",
                color:
                  seleccion.tipo === "texto" && seleccion.id === "mensaje" ? "#0369A1" : "#475569",
                fontSize: "0.67rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📝 Mensaje
            </button>

            {firmaVisible && (
              <button
                type="button"
                onClick={() => setSeleccion({ tipo: "texto", id: "firma" })}
                style={{
                  padding: "2px 7px",
                  borderRadius: "999px",
                  border:
                    seleccion.tipo === "texto" && seleccion.id === "firma"
                      ? "1.5px solid #0284C7"
                      : "1px solid #CBD5E1",
                  background:
                    seleccion.tipo === "texto" && seleccion.id === "firma" ? "#E0F2FE" : "#FFFFFF",
                  color:
                    seleccion.tipo === "texto" && seleccion.id === "firma" ? "#0369A1" : "#475569",
                  fontSize: "0.67rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✍️ Firma
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
                    onClick={() => setSeleccion({ tipo: "texto", id: b.id })}
                    style={{
                      padding: "2px 7px",
                      borderRadius: "999px",
                      border: act ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                      background: act ? "#E0F2FE" : "#FFFFFF",
                      color: act ? "#0369A1" : "#475569",
                      fontSize: "0.67rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🔤 Texto {idx + 1}
                  </button>
                );
              })}

            {norm.imagenes.map((im, idx) => {
              const act = seleccion.tipo === "imagen" && seleccion.id === im.id;
              return (
                <button
                  key={im.id}
                  type="button"
                  onClick={() => setSeleccion({ tipo: "imagen", id: im.id })}
                  style={{
                    padding: "2px 7px",
                    borderRadius: "999px",
                    border: act ? "1.5px solid #7C3AED" : "1px solid #CBD5E1",
                    background: act ? "#EDE9FE" : "#FFFFFF",
                    color: act ? "#5B21B6" : "#475569",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🖼️ Img {idx + 1}
                </button>
              );
            })}

            <div style={{ marginLeft: "auto", display: "flex", gap: "5px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={subiendoImg || norm.imagenes.length >= MAX_IMAGENES_TARJETA}
                onClick={() => inputImgRef.current?.click()}
                title="Agregar imagen o logotipo (máximo 3)"
                aria-label="Agregar Imagen"
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: "1px solid #0284C7",
                  background: norm.imagenes.length >= MAX_IMAGENES_TARJETA ? "#F1F5F9" : "#FFFFFF",
                  color: norm.imagenes.length >= MAX_IMAGENES_TARJETA ? "#94A3B8" : "#0369A1",
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  cursor: norm.imagenes.length >= MAX_IMAGENES_TARJETA ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {subiendoImg ? <Loader2 size={11} /> : <ImagePlus size={11} />}
                <span>
                  {subiendoImg
                    ? "Subiendo..."
                    : `+ Imagen (${norm.imagenes.length}/${MAX_IMAGENES_TARJETA})`}
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
                disabled={extrasCount >= MAX_BLOQUES_EXTRA_TEXTO}
                onClick={handleAgregarBloqueTexto}
                title="Agregar cuadro de texto adicional"
                aria-label="Agregar Texto"
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: "1px solid #0F766E",
                  background: extrasCount >= MAX_BLOQUES_EXTRA_TEXTO ? "#F1F5F9" : "#F0FDFA",
                  color: extrasCount >= MAX_BLOQUES_EXTRA_TEXTO ? "#94A3B8" : "#0F766E",
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  cursor: extrasCount >= MAX_BLOQUES_EXTRA_TEXTO ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <Plus size={11} />
                <span>Texto</span>
              </button>

              <button
                type="button"
                onClick={resetearPosiciones}
                title="Restablecer centrado automático"
                aria-label="Centrar"
                style={{
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
          </div>

          {/* CONTROLES CONTEXTUALES: SI HAY UNA IMAGEN SELECCIONADA (ROTACIÓN, TRANSPARENCIA, TAMAÑO 100%, B/N) */}
          {imagenSeleccionada ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                paddingTop: "6px",
                borderTop: "1px dashed #CBD5E1",
              }}
            >
              {/* Fila A: Fondo 100% + Tamaño + B/N + Quitar */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "7px" }}>
                <button
                  type="button"
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
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: imagenSeleccionada.cubrirTarjeta
                      ? "1.5px solid #7C3AED"
                      : "1px solid #CBD5E1",
                    background: imagenSeleccionada.cubrirTarjeta ? "#EDE9FE" : "#FFFFFF",
                    color: imagenSeleccionada.cubrirTarjeta ? "#5B21B6" : "#334155",
                    fontSize: "0.69rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Maximize2 size={11} />
                  <span>Fondo 100%</span>
                </button>

                {!imagenSeleccionada.cubrirTarjeta && (
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "0.69rem",
                      color: "#334155",
                      fontWeight: 600,
                      flex: 1,
                      minWidth: "120px",
                    }}
                  >
                    <span>Tamaño:</span>
                    <input
                      type="range"
                      min="14"
                      max={wMm}
                      value={Math.min(wMm, imagenSeleccionada.anchoMm)}
                      onChange={(e) =>
                        actualizarImagen(imagenSeleccionada.id, { anchoMm: Number(e.target.value) })
                      }
                      style={{ flex: 1, cursor: "pointer" }}
                    />
                    <strong style={{ minWidth: "30px", textAlign: "right" }}>
                      {Math.round((Math.min(wMm, imagenSeleccionada.anchoMm) / wMm) * 100)}%
                    </strong>
                  </label>
                )}

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "0.69rem",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(imagenSeleccionada.escalaGrises)}
                    onChange={(e) =>
                      actualizarImagen(imagenSeleccionada.id, { escalaGrises: e.target.checked })
                    }
                  />
                  <span>B/N</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleEliminarImagen(imagenSeleccionada.id)}
                  title="Quitar esta imagen"
                  aria-label="Quitar Imagen"
                  style={{
                    marginLeft: "auto",
                    padding: "3px 7px",
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
              </div>

              {/* Fila B: Rotación (-180° a +180° + botones rápidos) */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px" }}>
                <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#334155" }}>
                  Rotar:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const actual = imagenSeleccionada.rotacionDeg || 0;
                    const sig = actual - 90 < -180 ? actual + 270 : actual - 90;
                    actualizarImagen(imagenSeleccionada.id, { rotacionDeg: sig });
                  }}
                  title="Girar 90° a la izquierda"
                  aria-label="Rotar -90°"
                  style={{
                    padding: "2px 6px",
                    borderRadius: "5px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                  }}
                >
                  <RotateCcw size={10} />
                  <span>90°</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    actualizarImagen(imagenSeleccionada.id, {
                      rotacionDeg: Math.max(-180, (imagenSeleccionada.rotacionDeg || 0) - 15),
                    })
                  }
                  title="Girar -15°"
                  style={{
                    padding: "2px 5px",
                    borderRadius: "5px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  -15°
                </button>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={imagenSeleccionada.rotacionDeg || 0}
                  onChange={(e) =>
                    actualizarImagen(imagenSeleccionada.id, { rotacionDeg: Number(e.target.value) })
                  }
                  style={{ flex: 1, minWidth: "70px", cursor: "pointer" }}
                />
                <strong style={{ fontSize: "0.69rem", minWidth: "34px", textAlign: "right", color: "#0F172A" }}>
                  {imagenSeleccionada.rotacionDeg || 0}°
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    actualizarImagen(imagenSeleccionada.id, {
                      rotacionDeg: Math.min(180, (imagenSeleccionada.rotacionDeg || 0) + 15),
                    })
                  }
                  title="Girar +15°"
                  style={{
                    padding: "2px 5px",
                    borderRadius: "5px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  +15°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const actual = imagenSeleccionada.rotacionDeg || 0;
                    const sig = actual + 90 > 180 ? actual - 270 : actual + 90;
                    actualizarImagen(imagenSeleccionada.id, { rotacionDeg: sig });
                  }}
                  title="Girar 90° a la derecha"
                  aria-label="Rotar +90°"
                  style={{
                    padding: "2px 6px",
                    borderRadius: "5px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#334155",
                    fontSize: "0.67rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                  }}
                >
                  <RotateCw size={10} />
                  <span>90°</span>
                </button>
                {(imagenSeleccionada.rotacionDeg || 0) !== 0 && (
                  <button
                    type="button"
                    onClick={() => actualizarImagen(imagenSeleccionada.id, { rotacionDeg: 0 })}
                    style={{
                      padding: "2px 5px",
                      borderRadius: "5px",
                      border: "1px solid #BAE6FD",
                      background: "#F0F9FF",
                      color: "#0369A1",
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      cursor: "pointer",
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
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "0.69rem", fontWeight: 700, color: "#334155" }}>
                      Transparencia:
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={transpActual}
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        actualizarImagen(imagenSeleccionada.id, {
                          opacidad: Math.max(0.1, Math.min(1, Number((1 - t / 100).toFixed(2)))),
                        });
                      }}
                      style={{ flex: 1, minWidth: "80px", cursor: "pointer" }}
                    />
                    <strong style={{ fontSize: "0.69rem", minWidth: "30px", textAlign: "right", color: "#0F172A" }}>
                      {transpActual}%
                    </strong>
                    {(
                      [
                        { label: "0%", op: 1 },
                        { label: "40%", op: 0.6 },
                        { label: "70%", op: 0.3 },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => actualizarImagen(imagenSeleccionada.id, { opacidad: p.op })}
                        style={{
                          padding: "2px 6px",
                          borderRadius: "5px",
                          border:
                            Math.abs((imagenSeleccionada.opacidad ?? 1) - p.op) < 0.05
                              ? "1.5px solid #7C3AED"
                              : "1px solid #CBD5E1",
                          background:
                            Math.abs((imagenSeleccionada.opacidad ?? 1) - p.op) < 0.05
                              ? "#EDE9FE"
                              : "#FFFFFF",
                          color:
                            Math.abs((imagenSeleccionada.opacidad ?? 1) - p.op) < 0.05
                              ? "#5B21B6"
                              : "#475569",
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* CONTROLES CONTEXTUALES: SI HAY UN CUADRO DE TEXTO SELECCIONADO */
            <>
              {/* 6 Fuentes curadas con vista previa real */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "4px",
                  alignItems: "center",
                  paddingTop: "5px",
                  borderTop: "1px dashed #CBD5E1",
                }}
              >
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
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: activa ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                        background: activa ? "#E0F2FE" : "#FFFFFF",
                        color: activa ? "#0369A1" : "#334155",
                        fontFamily: f.cssFamily,
                        fontSize:
                          f.id === "cursiva" || f.id === "caligrafia" || f.id === "manuscrita"
                            ? "0.86rem"
                            : "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {f.etiqueta}
                    </button>
                  );
                })}
              </div>

              {/* Alineación + B/I + Tamaño + Ancho */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                {(
                  [
                    { id: "left", icon: AlignLeft, title: "Izquierda" },
                    { id: "center", icon: AlignCenter, title: "Centrar" },
                    { id: "right", icon: AlignRight, title: "Derecha" },
                    { id: "justify", icon: AlignJustify, title: "Justificar" },
                  ] as const
                ).map(({ id, icon: Icon, title }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => actualizarBloque(bloqueSeleccionado.id, { alineacion: id })}
                    title={title}
                    aria-label={title}
                    style={{
                      padding: "4px 6px",
                      borderRadius: "6px",
                      border:
                        (bloqueSeleccionado.alineacion || "center") === id
                          ? "1.5px solid #0284C7"
                          : "1px solid #CBD5E1",
                      background:
                        (bloqueSeleccionado.alineacion || "center") === id ? "#E0F2FE" : "#FFFFFF",
                      color:
                        (bloqueSeleccionado.alineacion || "center") === id ? "#0369A1" : "#334155",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Icon size={12} />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    actualizarBloque(bloqueSeleccionado.id, {
                      negrita: !bloqueSeleccionado.negrita,
                    })
                  }
                  title="Negrita"
                  aria-label="Negrita"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: bloqueSeleccionado.negrita ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                    background: bloqueSeleccionado.negrita ? "#E0F2FE" : "#FFFFFF",
                    color: bloqueSeleccionado.negrita ? "#0369A1" : "#334155",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <Bold size={12} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    actualizarBloque(bloqueSeleccionado.id, {
                      italica: !bloqueSeleccionado.italica,
                    })
                  }
                  title="Itálica"
                  aria-label="Itálica"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: bloqueSeleccionado.italica ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                    background: bloqueSeleccionado.italica ? "#E0F2FE" : "#FFFFFF",
                    color: bloqueSeleccionado.italica ? "#0369A1" : "#334155",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <Italic size={12} />
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.69rem",
                    color: "#334155",
                    fontWeight: 600,
                  }}
                >
                  <span>Pt:</span>
                  <input
                    type="range"
                    min="9"
                    max="38"
                    value={bloqueSeleccionado.tamanoPt || 18}
                    onChange={(e) =>
                      actualizarBloque(bloqueSeleccionado.id, { tamanoPt: Number(e.target.value) })
                    }
                    style={{ flex: 1, minWidth: "45px", cursor: "pointer" }}
                  />
                  <strong style={{ minWidth: "24px", textAlign: "right" }}>
                    {bloqueSeleccionado.tamanoPt || 18}
                  </strong>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.69rem",
                    color: "#334155",
                    fontWeight: 600,
                  }}
                >
                  <span>Ancho:</span>
                  <input
                    type="range"
                    min="30"
                    max="96"
                    value={bloqueSeleccionado.anchoPct}
                    onChange={(e) =>
                      actualizarBloque(bloqueSeleccionado.id, { anchoPct: Number(e.target.value) })
                    }
                    style={{ flex: 1, minWidth: "45px", cursor: "pointer" }}
                  />
                  <strong style={{ minWidth: "30px", textAlign: "right" }}>
                    {bloqueSeleccionado.anchoPct}%
                  </strong>
                </label>
              </div>

              {/* Si el bloque seleccionado es un texto adicional, editar su contenido aquí */}
              {bloqueSeleccionado.rol === "extra" && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={bloqueSeleccionado.texto || ""}
                    onChange={(e) =>
                      actualizarBloque(bloqueSeleccionado.id, { texto: e.target.value })
                    }
                    placeholder="Escribe el texto adicional..."
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid #94A3B8",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleEliminarBloqueExtra(bloqueSeleccionado.id)}
                    title="Eliminar cuadro de texto adicional"
                    aria-label="Quitar Texto"
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      color: "#B91C1C",
                      fontSize: "0.7rem",
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
                </div>
              )}
            </>
          )}

          {/* Toggle de firma en tarjeta */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              paddingTop: "4px",
              borderTop: "1px solid #E2E8F0",
              fontSize: "0.69rem",
              color: "#475569",
            }}
          >
            <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={norm.mostrarFirma}
                onChange={(e) => emitirCambio({ ...norm, mostrarFirma: e.target.checked })}
              />
              <span>Incluir firma (&ldquo;De parte de&rdquo;) en la tarjeta</span>
            </label>
            {norm.imagenes.length > 0 && (
              <span style={{ color: "#64748B" }}>
                Toca cualquier imagen o texto para editarlo
              </span>
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
          onClick={() => setSeleccion({ tipo: "texto", id: "mensaje" })}
          style={{
            width: esCondolencias ? "100%" : "244px",
            maxWidth: esCondolencias ? "400px" : "244px",
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
                zIndex: 5,
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
                  zIndex: 4,
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
                  zIndex: 4,
                }}
              >
                🌿
              </div>
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
                          ? "Imagen de fondo 100% (clic para ajustar opacidad o quitar)"
                          : "Arrastra para mover esta imagen"
                    }
                    style={
                      im.cubrirTarjeta
                        ? {
                            position: "absolute",
                            inset: 0,
                            zIndex: 1,
                            cursor: soloLectura ? "default" : "pointer",
                            border: !soloLectura && estaActiva ? "2px dashed #7C3AED" : "none",
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
                                ? "1.5px dashed #7C3AED"
                                : !soloLectura
                                  ? "1px dashed rgba(148, 163, 184, 0.35)"
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
                const contenido =
                  blk.rol === "mensaje"
                    ? mensaje ||
                      (esCondolencias
                        ? "Expresamos nuestras más sentidas condolencias."
                        : "Escribe el mensaje de dedicatoria...")
                    : blk.rol === "firma"
                      ? firma.trim()
                      : blk.texto || "Texto adicional";

                const estaActivo = seleccion.tipo === "texto" && seleccion.id === blk.id;
                return (
                  <div
                    key={blk.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeleccion({ tipo: "texto", id: blk.id });
                    }}
                    onPointerDown={(e) => iniciarArrastre("texto", blk.id, e)}
                    onPointerMove={moverArrastre}
                    onPointerUp={terminarArrastre}
                    onPointerCancel={terminarArrastre}
                    title={soloLectura ? undefined : "Arrastra para mover este cuadro de texto"}
                    style={{
                      position: "absolute",
                      left: `${blk.xPct}%`,
                      top: `${blk.yPct}%`,
                      transform: "translate(-50%, -50%)",
                      width: `${blk.anchoPct}%`,
                      fontFamily: resolverFontFamilyCss(blk.fuente, esCondolencias),
                      fontSize: `${Math.max(8, (blk.tamanoPt || 18) * 0.66)}pt`,
                      fontWeight: blk.negrita ? 700 : 400,
                      fontStyle: blk.italica ? "italic" : "normal",
                      textAlign: blk.alineacion || "center",
                      lineHeight: 1.35,
                      color: blk.colorHex || "#18181B",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      cursor: soloLectura
                        ? "default"
                        : arrastrando?.id === blk.id
                          ? "grabbing"
                          : "grab",
                      border:
                        !soloLectura && estaActivo
                          ? "1.5px dashed #0284C7"
                          : !soloLectura
                            ? "1px dashed rgba(148, 163, 184, 0.45)"
                            : "none",
                      borderRadius: "4px",
                      padding: "3px 5px",
                      boxSizing: "border-box",
                      zIndex: 6,
                    }}
                  >
                    {contenido}
                  </div>
                );
              })}
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
            Haz clic en cada texto, firma o imagen para moverlo, cambiar fuente o ampliarlo al 100%.
          </span>
        )}
      </div>
    </div>
  );
}
