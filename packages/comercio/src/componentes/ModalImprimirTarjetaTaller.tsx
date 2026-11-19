"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  History,
  Loader2,
  Lock,
  MessageCircle,
  Printer,
  Save,
  Share2,
  Sliders,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { ClaveFuenteTarjeta, DisenoVisualTarjeta, OrdenTrabajoTaller } from "../operaciones-taller";
import {
  buscarLyricsCancionAction,
  guardarEdicionPedidoYTarjetaAction,
  registrarImpresionTarjetaAction,
  subirAudioTarjetaAction,
} from "../acciones-operaciones-taller";
import {
  esFirmaVisibleValida,
  LienzoDisenadorTarjeta,
  normalizarClaveFuenteTarjeta,
  normalizarDisenoTarjeta,
  renderizarTarjetaEnCanvasPng,
  resolverFontFamilyCss,
} from "./LienzoDisenadorTarjeta";

export interface PropsModalImprimirTarjetaTaller {
  abierto: boolean;
  onCerrar: () => void;
  orden: OrdenTrabajoTaller | null;
  negocio: string;
  onActualizarOrden?: (ordenActualizada: Partial<OrdenTrabajoTaller> & { id: string }) => void;
}

type FormatoTarjeta = "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";

// Medidas reales medidas con regla: 16,8 x 11,3 cm (168 x 113 mm)
const MEDIDAS_DEDICATORIA_VERTICAL = { anchoMm: 113, altoMm: 168 };
const MEDIDAS_CONDOLENCIAS_HORIZONTAL = { anchoMm: 168, altoMm: 113 };

function limpiarCaracteresWinAnsi(texto: string): string {
  return texto
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-");
}

function envolverLineasPdf(
  texto: string,
  font: any,
  fontSize: number,
  maxWidthPt: number
): Array<{ texto: string; finParrafo: boolean }> {
  const parrafos = texto.split(/\r?\n/);
  const lineasFinales: Array<{ texto: string; finParrafo: boolean }> = [];

  for (const parrafo of parrafos) {
    const limpio = parrafo.trim();
    if (!limpio) {
      lineasFinales.push({ texto: "", finParrafo: true });
      continue;
    }
    const palabras = limpio.split(/\s+/);
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      const ancho = font.widthOfTextAtSize(prueba, fontSize);
      if (ancho <= maxWidthPt || !actual) {
        actual = prueba;
      } else {
        lineasFinales.push({ texto: actual, finParrafo: false });
        actual = palabra;
      }
    }
    if (actual) lineasFinales.push({ texto: actual, finParrafo: true });
  }
  return lineasFinales;
}

function seleccionarFuentePdf(
  fuente: ClaveFuenteTarjeta | string | undefined,
  negrita: boolean,
  italica: boolean
) {
  const clave = normalizarClaveFuenteTarjeta(fuente);
  if (clave === "moderna") {
    if (negrita && italica) return StandardFonts.HelveticaBoldOblique;
    if (negrita) return StandardFonts.HelveticaBold;
    if (italica) return StandardFonts.HelveticaOblique;
    return StandardFonts.Helvetica;
  }
  if (clave === "cursiva" || clave === "caligrafia" || clave === "manuscrita") {
    return negrita ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanItalic;
  }
  if (negrita && italica) return StandardFonts.TimesRomanBoldItalic;
  if (negrita) return StandardFonts.TimesRomanBold;
  if (italica) return StandardFonts.TimesRomanItalic;
  return StandardFonts.TimesRoman;
}

export function ModalImprimirTarjetaTaller({
  abierto,
  onCerrar,
  orden,
  negocio,
  onActualizarOrden,
}: PropsModalImprimirTarjetaTaller) {
  const negNorm = negocio.trim().toLowerCase();

  const formatoInicial: FormatoTarjeta = useMemo(() => {
    if (!orden) return "DIPTICO";
    if (orden.tarjetaTipo === "CONDOLENCIAS_PLANA") return "CONDOLENCIAS_PLANA";
    const txt = `${orden.productoResumen} ${orden.origenTipo} ${orden.clasificacionPedido || ""}`.toLowerCase();
    if (txt.includes("condolen") || txt.includes("funebr") || txt.includes("exequial")) {
      return "CONDOLENCIAS_PLANA";
    }
    return "DIPTICO";
  }, [orden]);

  const [formato, setFormato] = useState<FormatoTarjeta>(formatoInicial);
  const esCondolencias = formato === "CONDOLENCIAS_PLANA";

  const [mensajeEditable, setMensajeEditable] = useState<string>(orden?.dedicatoria || "");
  const [paraEditable, setParaEditable] = useState<string>(orden?.destinatarioFallecido || "");
  const [deEditable, setDeEditable] = useState<string>(orden?.clienteSolicita || "");
  const [confidencialSoloQr, setConfidencialSoloQr] = useState<boolean>(
    formatoInicial === "CONDOLENCIAS_PLANA"
      ? false
      : Boolean(orden?.tarjetaConfidencial ?? orden?.tarjetaMetadata?.confidencial_solo_qr)
  );
  const [diseno, setDiseno] = useState<DisenoVisualTarjeta>(() =>
    normalizarDisenoTarjeta(
      orden?.tarjetaDiseno ?? orden?.tarjetaMetadata?.diseno,
      formatoInicial === "CONDOLENCIAS_PLANA",
      orden?.dedicatoria || ""
    )
  );
  const [musicaUrlEditable, setMusicaUrlEditable] = useState<string>(orden?.tarjetaMusicaUrl || "");
  const [musicaTituloEditable, setMusicaTituloEditable] = useState<string>(
    orden?.tarjetaMusicaTitulo || ""
  );
  const [lyricsEditables, setLyricsEditables] = useState<Array<{ tiempo?: number; texto: string }>>(
    Array.isArray(orden?.tarjetaLyrics) ? orden.tarjetaLyrics : []
  );

  // Medidas reales: Dedicatoria Vertical (113x168 mm) | Condolencias Horizontal (168x113 mm)
  const [anchoMm, setAnchoMm] = useState<number>(
    formatoInicial === "CONDOLENCIAS_PLANA"
      ? MEDIDAS_CONDOLENCIAS_HORIZONTAL.anchoMm
      : MEDIDAS_DEDICATORIA_VERTICAL.anchoMm
  );
  const [altoMm, setAltoMm] = useState<number>(
    formatoInicial === "CONDOLENCIAS_PLANA"
      ? MEDIDAS_CONDOLENCIAS_HORIZONTAL.altoMm
      : MEDIDAS_DEDICATORIA_VERTICAL.altoMm
  );
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [mostrarCalibrador, setMostrarCalibrador] = useState<boolean>(false);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);

  const [tokenVistaActual, setTokenVistaActual] = useState<string>(
    orden?.tarjetaToken || orden?.proformaId || orden?.id || ""
  );
  const [tokenEdicionActual, setTokenEdicionActual] = useState<string>(
    orden?.tarjetaTokenEdicion || ""
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [urlSoloVistaDigital, setUrlSoloVistaDigital] = useState<string>("");
  const [urlEdicionTarjeta, setUrlEdicionTarjeta] = useState<string>("");
  const [copiadoVista, setCopiadoVista] = useState<boolean>(false);
  const [copiadoEdicion, setCopiadoEdicion] = useState<boolean>(false);

  const [guardando, setGuardando] = useState<boolean>(false);
  const [buscandoLyrics, setBuscandoLyrics] = useState<boolean>(false);
  const [subiendoMp3, setSubiendoMp3] = useState<boolean>(false);
  const [imprimiendo, setImprimiendo] = useState<boolean>(false);
  const [descargandoPdf, setDescargandoPdf] = useState<boolean>(false);
  const [compartiendoDiseno, setCompartiendoDiseno] = useState<boolean>(false);
  const [avisoOk, setAvisoOk] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [metaLocal, setMetaLocal] = useState<Record<string, any>>(orden?.tarjetaMetadata || {});
  const inputAudioRef = useRef<HTMLInputElement | null>(null);
  const ultimoOrdenIdInicializadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!abierto || !orden) {
      ultimoOrdenIdInicializadoRef.current = null;
      return;
    }
    // Solo reinicializar estado del diseñador cuando se abre un pedido diferente,
    // evitando perder cambios o diseño guardado ante re-renders del componente padre.
    if (ultimoOrdenIdInicializadoRef.current === orden.id) {
      return;
    }
    ultimoOrdenIdInicializadoRef.current = orden.id;

    const esCondolInit = formatoInicial === "CONDOLENCIAS_PLANA";
    setFormato(formatoInicial);
    if (esCondolInit) {
      setAnchoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.anchoMm);
      setAltoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.altoMm);
    } else {
      setAnchoMm(MEDIDAS_DEDICATORIA_VERTICAL.anchoMm);
      setAltoMm(MEDIDAS_DEDICATORIA_VERTICAL.altoMm);
    }
    setMensajeEditable(orden.dedicatoria || "");
    setParaEditable(orden.destinatarioFallecido || "");
    setDeEditable(orden.clienteSolicita || "");
    setConfidencialSoloQr(
      esCondolInit
        ? false
        : Boolean(orden.tarjetaConfidencial ?? orden.tarjetaMetadata?.confidencial_solo_qr)
    );
    setDiseno(
      normalizarDisenoTarjeta(
        orden.tarjetaDiseno ?? orden.tarjetaMetadata?.diseno,
        esCondolInit,
        orden.dedicatoria || ""
      )
    );
    setMusicaUrlEditable(esCondolInit ? "" : orden.tarjetaMusicaUrl || "");
    setMusicaTituloEditable(esCondolInit ? "" : orden.tarjetaMusicaTitulo || "");
    setLyricsEditables(!esCondolInit && Array.isArray(orden.tarjetaLyrics) ? orden.tarjetaLyrics : []);
    setTokenVistaActual(orden.tarjetaToken || orden.proformaId || orden.id);
    setTokenEdicionActual(orden.tarjetaTokenEdicion || "");
    setMetaLocal(orden.tarjetaMetadata || {});
    setAvisoOk(null);
    setErrorMsg(null);
  }, [abierto, orden, formatoInicial]);

  useEffect(() => {
    if (typeof window === "undefined" || !orden) return;
    const tokVista = tokenVistaActual || orden.tarjetaToken || orden.id;
    const origen = `${window.location.protocol}//${window.location.host}`;
    const urlVista = `${origen}/dedicatoria/${tokVista}`;
    setUrlSoloVistaDigital(urlVista);

    if (tokenEdicionActual) {
      setUrlEdicionTarjeta(`${origen}/tarjeta-editar/${tokenEdicionActual}`);
    } else {
      setUrlEdicionTarjeta("");
    }

    QRCode.toDataURL(urlVista, {
      width: 240,
      margin: 1,
      color: {
        dark: "#18181B",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch((err: unknown) => console.error("Error generando QR", err));
  }, [tokenVistaActual, tokenEdicionActual, orden]);

  if (!abierto || !orden) return null;

  const disenoNorm = normalizarDisenoTarjeta(diseno, esCondolencias, mensajeEditable);
  const soloQrEfectivo = !esCondolencias && confidencialSoloQr;

  const conteoImpresiones = Number(metaLocal?.impresiones ?? 0);
  const ultimoImpresoPor = metaLocal?.ultimo_impreso_por || null;
  const fueEditadaPorCliente = Boolean(metaLocal?.editado_por_cliente);
  const fueEditadaPorStaff = Boolean(metaLocal?.editado_por_staff);
  const vistasCliente = Number(metaLocal?.vistas_cliente ?? 0);
  const historial = Array.isArray(metaLocal?.historial_cambios) ? metaLocal.historial_cambios : [];

  const cambiarFormatoTarjeta = (nuevo: FormatoTarjeta) => {
    setFormato(nuevo);
    if (nuevo === "CONDOLENCIAS_PLANA") {
      setAnchoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.anchoMm);
      setAltoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.altoMm);
      setConfidencialSoloQr(false);
      setDiseno((prev) => ({
        ...normalizarDisenoTarjeta(prev, true, mensajeEditable),
        fuente: "serif",
        textoAnchoPct: 74,
      }));
    } else {
      setAnchoMm(MEDIDAS_DEDICATORIA_VERTICAL.anchoMm);
      setAltoMm(MEDIDAS_DEDICATORIA_VERTICAL.altoMm);
      setDiseno((prev) => ({
        ...normalizarDisenoTarjeta(prev, false, mensajeEditable),
        fuente: "cursiva",
        textoAnchoPct: 82,
      }));
    }
  };

  const handleCopiar = (url: string, tipo: "vista" | "edicion") => {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    if (tipo === "vista") {
      setCopiadoVista(true);
      setTimeout(() => setCopiadoVista(false), 2000);
    } else {
      setCopiadoEdicion(true);
      setTimeout(() => setCopiadoEdicion(false), 2000);
    }
  };

  const handleSubirMp3 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("El archivo MP3 supera el máximo de 15 MB.");
      return;
    }
    setSubiendoMp3(true);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await subirAudioTarjetaAction({
        negocio: negNorm,
        dataUrl: String(reader.result || ""),
        nombreArchivo: file.name,
      });
      setSubiendoMp3(false);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setMusicaUrlEditable(res.publicUrl);
      if (!musicaTituloEditable.trim()) {
        setMusicaTituloEditable(res.nombreLimpio);
      }
      setAvisoOk("🎵 Audio MP3 subido. Pulsa Guardar Tarjeta para aplicarlo.");
    };
    reader.onerror = () => {
      setSubiendoMp3(false);
      setErrorMsg("No se pudo leer el archivo MP3.");
    };
    reader.readAsDataURL(file);
  };

  const handleBuscarLetra = async () => {
    setBuscandoLyrics(true);
    setErrorMsg(null);
    setAvisoOk(null);
    const res = await buscarLyricsCancionAction({
      musicaUrl: musicaUrlEditable,
      musicaTitulo: musicaTituloEditable,
    });
    setBuscandoLyrics(false);
    if (!res.ok) {
      setErrorMsg(res.error || "No se encontró letra para esta canción.");
      return;
    }
    if (res.tituloDetectado && !musicaTituloEditable.trim()) {
      setMusicaTituloEditable(res.tituloDetectado);
    }
    if (res.lyrics) {
      setLyricsEditables(res.lyrics);
      setAvisoOk(
        `✨ Letra cargada (${res.lyrics.length} líneas${res.sincronizado ? " sincronizadas" : ""}).`
      );
    }
  };

  const persistirCambiosTarjeta = async (silencioso = false): Promise<boolean> => {
    if (!silencioso) setGuardando(true);
    setErrorMsg(null);
    if (!silencioso) setAvisoOk(null);

    let lyricsAGuardar = esCondolencias ? [] : lyricsEditables;
    let tituloAGuardar = esCondolencias ? null : musicaTituloEditable.trim() || null;

    if (
      !esCondolencias &&
      musicaUrlEditable.trim() &&
      musicaUrlEditable.trim() !== (orden.tarjetaMusicaUrl || "") &&
      lyricsAGuardar.length === 0
    ) {
      const autoLrc = await buscarLyricsCancionAction({
        musicaUrl: musicaUrlEditable.trim(),
        musicaTitulo: musicaTituloEditable.trim(),
      });
      if (autoLrc.ok && autoLrc.lyrics) {
        lyricsAGuardar = autoLrc.lyrics;
        setLyricsEditables(autoLrc.lyrics);
        if (!tituloAGuardar && autoLrc.tituloDetectado) {
          tituloAGuardar = autoLrc.tituloDetectado;
          setMusicaTituloEditable(autoLrc.tituloDetectado);
        }
      }
    }

    const res = await guardarEdicionPedidoYTarjetaAction({
      negocio: negNorm,
      pedidoId: orden.proformaId || orden.id,
      ordenTallerId: orden.id,
      entregaId: orden.entregaId ?? null,
      compradorNombre: deEditable.trim() || orden.clienteSolicita,
      destinatarioNombre: paraEditable.trim(),
      dedicatoria: mensajeEditable.trim(),
      tarjetaTipo: formato,
      tarjetaConfidencial: soloQrEfectivo,
      tarjetaDiseno: disenoNorm,
      tarjetaMusicaUrl: esCondolencias ? null : musicaUrlEditable.trim() || null,
      tarjetaMusicaTitulo: tituloAGuardar,
      tarjetaLyrics: lyricsAGuardar,
    });

    if (!silencioso) setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error || "No se pudo guardar la tarjeta.");
      return false;
    }

    const nuevoTokVista = res.tarjetaToken || tokenVistaActual;
    const nuevoTokEdicion = res.tarjetaTokenEdicion || tokenEdicionActual;
    const nuevaMeta = res.tarjetaMetadata || metaLocal;
    setTokenVistaActual(nuevoTokVista);
    if (nuevoTokEdicion) setTokenEdicionActual(nuevoTokEdicion);
    setMetaLocal(nuevaMeta);

    if (onActualizarOrden) {
      onActualizarOrden({
        id: orden.id,
        dedicatoria: mensajeEditable.trim(),
        destinatarioFallecido: paraEditable.trim(),
        clienteSolicita: deEditable.trim() || orden.clienteSolicita,
        tarjetaTipo: formato,
        tarjetaConfidencial: soloQrEfectivo,
        tarjetaDiseno: disenoNorm,
        tarjetaToken: nuevoTokVista,
        tarjetaTokenEdicion: nuevoTokEdicion,
        tarjetaMusicaUrl: esCondolencias ? null : musicaUrlEditable.trim() || null,
        tarjetaMusicaTitulo: tituloAGuardar,
        tarjetaLyrics: lyricsAGuardar,
        tarjetaMetadata: nuevaMeta,
      });
    }

    if (!silencioso) {
      setAvisoOk("✅ Tarjeta guardada correctamente.");
    }
    return true;
  };

  const handleDescargarPdf = async () => {
    setDescargandoPdf(true);
    setErrorMsg(null);
    try {
      await persistirCambiosTarjeta(true);

      const MM_TO_PT = 2.83464567;
      const pageW = Math.max(60, anchoMm) * MM_TO_PT;
      const pageH = Math.max(60, altoMm) * MM_TO_PT;

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([pageW, pageH]);

      if (soloQrEfectivo) {
        // DEDICATORIA SOLO QR: ÚNICAMENTE QR CENTRADO EN LA MITAD INFERIOR (SIN MENSAJE NI IMAGEN)
        if (qrDataUrl) {
          const base64Qr = qrDataUrl.split(",")[1];
          if (base64Qr) {
            const qrBytes = Uint8Array.from(atob(base64Qr), (c) => c.charCodeAt(0));
            const qrImg = await pdfDoc.embedPng(qrBytes);
            const qrDim = 28 * MM_TO_PT;
            const qrX = (pageW - qrDim) / 2 + offsetX * MM_TO_PT;
            const qrY = pageH * 0.25 - qrDim / 2 - offsetY * MM_TO_PT;
            page.drawImage(qrImg, { x: qrX, y: qrY, width: qrDim, height: qrDim });
          }
        }
      } else {
        // MODO MENSAJE (+ HASTA 3 IMÁGENES + MÚLTIPLES CUADROS DE TEXTO Y FIRMA) — SIN QR
        const imgsOrdenadas = [
          ...disenoNorm.imagenes.filter((im) => im.cubrirTarjeta),
          ...disenoNorm.imagenes.filter((im) => !im.cubrirTarjeta),
        ];

        for (const im of imgsOrdenadas) {
          try {
            const respImg = await fetch(im.url);
            const arrBuf = await respImg.arrayBuffer();
            const bytesImg = new Uint8Array(arrBuf);
            const esPng =
              bytesImg.length >= 4 &&
              bytesImg[0] === 0x89 &&
              bytesImg[1] === 0x50 &&
              bytesImg[2] === 0x4e &&
              bytesImg[3] === 0x47;
            const pdfImg = esPng
              ? await pdfDoc.embedPng(bytesImg)
              : await pdfDoc.embedJpg(bytesImg);
            const opacidadImg = typeof im.opacidad === "number" ? im.opacidad : 1;

            const rotDeg = im.rotacionDeg || 0;
            // En pdf-lib la rotación gira en sentido antihorario alrededor de (x, y) (esquina inferior izquierda).
            // Para rotar exactamente alrededor del centro (cx, cy):
            const dibujarRotada = (cx: number, cy: number, w: number, h: number) => {
              const rad = (-rotDeg * Math.PI) / 180;
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);
              const x = cx - (w / 2) * cos + (h / 2) * sin;
              const y = cy - (w / 2) * sin - (h / 2) * cos;
              page.drawImage(pdfImg, {
                x,
                y,
                width: w,
                height: h,
                opacity: opacidadImg,
                ...(rotDeg !== 0 ? { rotate: degrees(-rotDeg) } : {}),
              });
            };

            if (im.cubrirTarjeta) {
              const ratioPage = pageW / pageH;
              const ratioImg = pdfImg.width / Math.max(1, pdfImg.height);
              let drawW = pageW;
              let drawH = pageH;
              if (ratioImg > ratioPage) {
                drawH = pageH;
                drawW = pageH * ratioImg;
              } else {
                drawW = pageW;
                drawH = pageW / ratioImg;
              }
              dibujarRotada(
                pageW / 2 + offsetX * MM_TO_PT,
                pageH / 2 - offsetY * MM_TO_PT,
                drawW,
                drawH
              );
            } else {
              const imgW = Math.min(pageW, im.anchoMm * MM_TO_PT);
              const imgH = imgW * (pdfImg.height / Math.max(1, pdfImg.width));
              const cx = (im.xPct / 100) * pageW + offsetX * MM_TO_PT;
              const cy = pageH - (im.yPct / 100) * pageH - offsetY * MM_TO_PT;
              dibujarRotada(cx, cy, imgW, imgH);
            }
          } catch {
            // Continuar si una imagen remota no pudo incrustarse
          }
        }

        const fuentesCache = new Map<string, any>();
        const obtenerPdfFont = async (
          f: ClaveFuenteTarjeta | undefined,
          neg: boolean,
          ita: boolean
        ) => {
          const enumF = seleccionarFuentePdf(f, neg, ita);
          if (!fuentesCache.has(enumF)) {
            fuentesCache.set(enumF, await pdfDoc.embedFont(enumF));
          }
          return fuentesCache.get(enumF);
        };

        for (const blk of disenoNorm.bloquesTexto) {
          let textoRaw = "";
          if (blk.rol === "mensaje") {
            textoRaw =
              mensajeEditable.trim() ||
              (esCondolencias
                ? "Expresamos nuestras mas sentidas condolencias."
                : "Con todo nuestro carino.");
          } else if (blk.rol === "firma") {
            if (!disenoNorm.mostrarFirma || !esFirmaVisibleValida(deEditable)) continue;
            textoRaw = deEditable.trim();
          } else {
            textoRaw = (blk.texto || "").trim();
            if (!textoRaw) continue;
          }

          const textoBase = limpiarCaracteresWinAnsi(textoRaw);
          const fontBlk = await obtenerPdfFont(blk.fuente, Boolean(blk.negrita), Boolean(blk.italica));
          const boxW = (blk.anchoPct / 100) * pageW;
          const boxCenterX = (blk.xPct / 100) * pageW + offsetX * MM_TO_PT;
          const boxLeft = boxCenterX - boxW / 2;

          const sizePt = Math.max(9, Math.min(38, blk.tamanoPt || 18));
          const interlineado = sizePt * 1.36;
          const lineas = envolverLineasPdf(textoBase, fontBlk, sizePt, boxW);
          const altoBloque = lineas.length * interlineado;
          const boxCenterY = pageH - (blk.yPct / 100) * pageH - offsetY * MM_TO_PT;
          let cursorY = boxCenterY + altoBloque / 2 - sizePt * 0.82;
          const alin = blk.alineacion || "center";

          for (const item of lineas) {
            const lin = item.texto;
            if (lin) {
              const wLin = fontBlk.widthOfTextAtSize(lin, sizePt);
              if (alin === "justify" && !item.finParrafo) {
                const palabras = lin.split(/\s+/).filter(Boolean);
                if (palabras.length > 1) {
                  const anchoPalabras = palabras.reduce(
                    (acc, p) => acc + fontBlk.widthOfTextAtSize(p, sizePt),
                    0
                  );
                  const espacioExtra = Math.max(0, (boxW - anchoPalabras) / (palabras.length - 1));
                  let xPal = boxLeft;
                  for (const pal of palabras) {
                    page.drawText(pal, {
                      x: xPal,
                      y: cursorY,
                      size: sizePt,
                      font: fontBlk,
                      color: rgb(0.09, 0.09, 0.11),
                    });
                    xPal += fontBlk.widthOfTextAtSize(pal, sizePt) + espacioExtra;
                  }
                } else {
                  page.drawText(lin, {
                    x: boxLeft,
                    y: cursorY,
                    size: sizePt,
                    font: fontBlk,
                    color: rgb(0.09, 0.09, 0.11),
                  });
                }
              } else {
                const xLinea =
                  alin === "left" || alin === "justify"
                    ? boxLeft
                    : alin === "right"
                      ? boxLeft + Math.max(0, boxW - wLin)
                      : boxLeft + Math.max(0, (boxW - wLin) / 2);
                page.drawText(lin, {
                  x: xLinea,
                  y: cursorY,
                  size: sizePt,
                  font: fontBlk,
                  color: rgb(0.09, 0.09, 0.11),
                });
              }
            }
            cursorY -= interlineado;
          }
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Tarjeta-${esCondolencias ? "Condolencias" : "Dedicatoria"}-${orden.codigo || "Pedido"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setAvisoOk(`⬇️ PDF descargado (${anchoMm}×${altoMm} mm).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error generando PDF de la tarjeta.");
    } finally {
      setDescargandoPdf(false);
    }
  };

  const handleCompartirDiseno = async () => {
    setCompartiendoDiseno(true);
    setErrorMsg(null);
    try {
      await persistirCambiosTarjeta(true);
      const blob = await renderizarTarjetaEnCanvasPng({
        esCondolencias,
        soloQr: soloQrEfectivo,
        mensaje: mensajeEditable,
        firma: deEditable,
        diseno: disenoNorm,
        qrDataUrl,
        anchoMm,
        altoMm,
      });
      if (!blob) {
        setErrorMsg("No se pudo generar la imagen del diseño final.");
        return;
      }
      const nombreArchivo = `Tarjeta-${esCondolencias ? "Condolencias" : "Dedicatoria"}-${orden.codigo || "Pedido"}.png`;
      const archivo = new File([blob], nombreArchivo, { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [archivo] })
      ) {
        await navigator.share({
          title: `Diseño de Tarjeta — ${orden.codigo}`,
          text: `Diseño final de la tarjeta para el pedido ${orden.codigo}`,
          files: [archivo],
        });
        setAvisoOk("✅ Diseño compartido correctamente.");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setAvisoOk("🖼️ Imagen PNG del diseño final descargada lista para compartir por WhatsApp.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setErrorMsg(err instanceof Error ? err.message : "No se pudo compartir el diseño.");
      }
    } finally {
      setCompartiendoDiseno(false);
    }
  };

  const handleLanzarImpresion = async () => {
    setImprimiendo(true);
    setErrorMsg(null);
    try {
      await persistirCambiosTarjeta(true);
      const res = await registrarImpresionTarjetaAction({
        ordenId: orden.proformaId || orden.id,
        tipo: formato,
      });

      if (res.ok && typeof res.impresiones === "number") {
        const nuevaMeta = {
          ...metaLocal,
          confidencial_solo_qr: soloQrEfectivo,
          diseno: disenoNorm,
          impresiones: res.impresiones,
          ultimo_impreso_por: res.ultimoImpresoPor || "Taller",
          ultima_impresion_en: new Date().toISOString(),
        };
        setMetaLocal(nuevaMeta);
        if (onActualizarOrden) {
          onActualizarOrden({
            id: orden.id,
            dedicatoria: mensajeEditable.trim(),
            tarjetaTipo: formato,
            tarjetaConfidencial: soloQrEfectivo,
            tarjetaDiseno: disenoNorm,
            tarjetaMetadata: nuevaMeta,
          });
        }
      }

      window.print();
    } catch {
      window.print();
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media screen {
          .area-impresion-tarjeta {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .area-impresion-tarjeta, .area-impresion-tarjeta * {
            visibility: visible !important;
          }
          .area-impresion-tarjeta {
            position: fixed !important;
            left: ${offsetX}mm !important;
            top: ${offsetY}mm !important;
            width: ${anchoMm}mm !important;
            height: ${altoMm}mm !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: hidden !important;
          }
          @page {
            size: ${anchoMm}mm ${altoMm}mm;
            margin: 0mm;
          }
        }
      `,
        }}
      />

      {/* ZONA DE IMPRESIÓN FÍSICA CALIBRADA (113x168 mm VERTICAL ó 168x113 mm HORIZONTAL) */}
      <div className="area-impresion-tarjeta">
        {soloQrEfectivo ? (
          // DEDICATORIA MODO SOLO QR (SIN MENSAJE NI IMAGEN EN CARTULINA)
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Tarjeta Digital"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "75%",
                  transform: "translate(-50%, -50%)",
                  width: "28mm",
                  height: "28mm",
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        ) : (
          // MODO MENSAJE + HASTA 3 IMÁGENES + MÚLTIPLES TEXTOS Y FIRMA (SIN QR EN ABSOLUTO)
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              boxSizing: "border-box",
            }}
          >
            {disenoNorm.imagenes.map((im) =>
              im.cubrirTarjeta ? (
                <img
                  key={im.id}
                  src={im.url}
                  alt="Fondo tarjeta"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: im.opacidad ?? 1,
                    transform: im.rotacionDeg ? `rotate(${im.rotacionDeg}deg)` : undefined,
                    filter: im.escalaGrises ? "grayscale(100%)" : "none",
                    zIndex: 1,
                  }}
                />
              ) : (
                <img
                  key={im.id}
                  src={im.url}
                  alt="Imagen tarjeta"
                  style={{
                    position: "absolute",
                    left: `${im.xPct}%`,
                    top: `${im.yPct}%`,
                    transform: `translate(-50%, -50%) rotate(${im.rotacionDeg || 0}deg)`,
                    width: `${Math.min(anchoMm, im.anchoMm)}mm`,
                    height: "auto",
                    objectFit: "contain",
                    opacity: im.opacidad ?? 1,
                    filter: im.escalaGrises ? "grayscale(100%)" : "none",
                    zIndex: 2,
                  }}
                />
              )
            )}

            {disenoNorm.bloquesTexto.map((blk) => {
              if (blk.rol === "firma" && (!disenoNorm.mostrarFirma || !esFirmaVisibleValida(deEditable))) {
                return null;
              }
              const contenido =
                blk.rol === "mensaje"
                  ? mensajeEditable ||
                    (esCondolencias
                      ? "Expresamos nuestras más sentidas condolencias."
                      : "Con todo mi cariño")
                  : blk.rol === "firma"
                    ? deEditable.trim()
                    : (blk.texto || "").trim();
              if (!contenido) return null;

              return (
                <div
                  key={blk.id}
                  style={{
                    position: "absolute",
                    left: `${blk.xPct}%`,
                    top: `${blk.yPct}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${blk.anchoPct}%`,
                    fontFamily: resolverFontFamilyCss(blk.fuente, esCondolencias),
                    fontSize: `${blk.tamanoPt || 18}pt`,
                    fontWeight: blk.negrita ? 700 : 400,
                    fontStyle: blk.italica ? "italic" : "normal",
                    textAlign: blk.alineacion || "center",
                    lineHeight: 1.38,
                    color: blk.colorHex || "#18181B",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    zIndex: 5,
                  }}
                >
                  {contenido}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL INTERACTIVO */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        onClick={onCerrar}
      >
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "1040px",
            maxHeight: "94vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ENCABEZADO */}
          <div
            style={{
              padding: "13px 20px",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
              gap: "10px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "1.15rem" }}>{esCondolencias ? "🕊️" : "💌"}</span>
                <h2 style={{ fontSize: "1.03rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  {esCondolencias ? "Tarjeta de Condolencias" : "Tarjeta de Dedicatoria"} — {orden.codigo}
                </h2>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: esCondolencias ? "#F3E8FF" : "#DCFCE7",
                    color: esCondolencias ? "#6B21A8" : "#166534",
                  }}
                >
                  {esCondolencias ? "Horizontal 16,8 × 11,3 cm" : "Vertical 11,3 × 16,8 cm"}
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                {esCondolencias
                  ? "Diseñador visual para impresión en cartulina horizontal (sin QR ni música)."
                  : "Elige imprimir el mensaje (+ imagen opcional) o únicamente el QR para la tarjeta digital."}
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              title="Cerrar ventana"
              aria-label="Cerrar"
              style={{
                border: "none",
                background: "#F1F5F9",
                cursor: "pointer",
                color: "#475569",
                padding: "6px",
                borderRadius: "8px",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ALERTA PROMINENTE SI EL CLIENTE MODIFICÓ LA TARJETA */}
          {fueEditadaPorCliente && (
            <div
              style={{
                padding: "10px 20px",
                background: "#FEF3C7",
                borderBottom: "1px solid #F59E0B",
                color: "#92400E",
                display: "flex",
                alignItems: "center",
                gap: "9px",
                fontSize: "0.78rem",
              }}
            >
              <AlertTriangle size={17} style={{ flexShrink: 0, color: "#D97706" }} />
              <div>
                <strong>¡Atención! Tarjeta modificada por el cliente</strong>
                {metaLocal?.ultima_edicion_cliente_en
                  ? ` (${new Date(metaLocal.ultima_edicion_cliente_en).toLocaleString("es-EC")})`
                  : ""}
                : revisa el diseño final antes de imprimir y evita realizar cambios sin confirmar con el cliente.
              </div>
            </div>
          )}

          {/* CUERPO: 2 COLUMNAS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "18px",
              padding: "16px 20px",
              overflowY: "auto",
            }}
          >
            {/* COLUMNA IZQUIERDA: DISEÑADOR VISUAL INTERACTIVO + TRAZABILIDAD + ENLACES */}
            <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                  Diseñador de tarjeta ({anchoMm} × {altoMm} mm)
                </span>
                <span
                  style={{
                    fontSize: "0.69rem",
                    color: soloQrEfectivo ? "#0369A1" : "#166534",
                    background: soloQrEfectivo ? "#E0F2FE" : "#DCFCE7",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 700,
                  }}
                >
                  {soloQrEfectivo ? "📱 Solo QR (Sin texto)" : "📝 Mensaje Impreso (Sin QR)"}
                </span>
              </div>

              <LienzoDisenadorTarjeta
                negocio={negNorm}
                esCondolencias={esCondolencias}
                soloQr={soloQrEfectivo}
                mensaje={mensajeEditable}
                firma={deEditable}
                diseno={disenoNorm}
                onCambiarDiseno={setDiseno}
                qrDataUrl={qrDataUrl}
                anchoMm={anchoMm}
                altoMm={altoMm}
                onError={(msg) => setErrorMsg(msg)}
              />

              {/* TRAZABILIDAD */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "9px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                  fontSize: "0.74rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#334155" }}>Estado y trazabilidad:</strong>
                  <button
                    type="button"
                    onClick={() => setMostrarHistorial(!mostrarHistorial)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#0284C7",
                      cursor: "pointer",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <History size={12} />
                    <span>{mostrarHistorial ? "Ocultar" : `Historial (${historial.length})`}</span>
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  <span
                    style={{
                      background: fueEditadaPorCliente
                        ? "#DCFCE7"
                        : fueEditadaPorStaff
                          ? "#DBEAFE"
                          : "#F1F5F9",
                      color: fueEditadaPorCliente
                        ? "#166534"
                        : fueEditadaPorStaff
                          ? "#1E40AF"
                          : "#475569",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    {fueEditadaPorCliente
                      ? "✨ Editada por Cliente"
                      : fueEditadaPorStaff
                        ? `✏️ Editada (${metaLocal?.ultimo_editor_nombre || "Staff"})`
                        : "🤖 Creada automática"}
                  </span>
                  {!esCondolencias && (
                    <span
                      style={{
                        background: vistasCliente > 0 ? "#E0F2FE" : "#F1F5F9",
                        color: vistasCliente > 0 ? "#0369A1" : "#475569",
                        padding: "2px 7px",
                        borderRadius: "6px",
                        fontWeight: 600,
                      }}
                    >
                      👀 {vistasCliente > 0 ? `Vista ${vistasCliente}x` : "Sin abrir"}
                    </span>
                  )}
                  <span
                    style={{
                      background: conteoImpresiones > 0 ? "#FEF3C7" : "#F1F5F9",
                      color: conteoImpresiones > 0 ? "#92400E" : "#475569",
                      padding: "2px 7px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    🖨️{" "}
                    {conteoImpresiones > 0
                      ? `Impresa ${conteoImpresiones}x (${ultimoImpresoPor || "Taller"})`
                      : "No impresa"}
                  </span>
                </div>

                {mostrarHistorial && (
                  <div
                    style={{
                      marginTop: "4px",
                      paddingTop: "5px",
                      borderTop: "1px dashed #CBD5E1",
                      maxHeight: "80px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    {historial.length === 0 ? (
                      <span style={{ color: "#94A3B8" }}>Sin ediciones posteriores.</span>
                    ) : (
                      historial.map((h: any, i: number) => (
                        <div key={i} style={{ fontSize: "0.7rem", color: "#334155" }}>
                          • <strong>{h.autor || "Usuario"}</strong> ({h.rol || "STAFF"}):{" "}
                          <span style={{ color: "#64748B" }}>
                            {h.fecha ? new Date(h.fecha).toLocaleString("es-EC") : ""}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* ENLACES: EDICIÓN SIEMPRE DISPONIBLE (SIN LOGIN); VISTA DIGITAL QR SOLO EN DEDICATORIA */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                  borderRadius: "10px",
                  padding: "9px 11px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {urlEdicionTarjeta && (
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#0F766E",
                        marginBottom: "3px",
                      }}
                    >
                      ✏️ Enlace para Editar Tarjeta (Cliente / Diseñador — sin login):
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        readOnly
                        value={urlEdicionTarjeta}
                        style={{
                          flex: 1,
                          minWidth: "140px",
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          color: "#334155",
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          borderRadius: "6px",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopiar(urlEdicionTarjeta, "edicion")}
                        title="Copiar enlace de edición para el comprador"
                        aria-label="Copiar Enlace Edición"
                        style={{
                          padding: "5px 9px",
                          background: copiadoEdicion ? "#16A34A" : "#0F766E",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {copiadoEdicion ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiadoEdicion ? "Copiado" : "Copiar"}</span>
                      </button>
                      {orden.clienteTelefono && (
                        <a
                          href={`https://wa.me/${orden.clienteTelefono.replace(/\D+/g, "")}?text=${encodeURIComponent(
                            `Hola ${deEditable || orden.clienteSolicita} 🌸, aquí puedes revisar o diseñar el mensaje de tu tarjeta del pedido ${orden.codigo} antes de impresión: ${urlEdicionTarjeta}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar enlace de edición por WhatsApp al comprador"
                          aria-label="WhatsApp Edición"
                          style={{
                            padding: "5px 8px",
                            background: "#16A34A",
                            color: "#FFFFFF",
                            borderRadius: "6px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {!esCondolencias && urlSoloVistaDigital && (
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "#0369A1",
                        marginBottom: "3px",
                      }}
                    >
                      👁️ Tarjeta Digital Solo Lectura (URL del QR — sin login):
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                      <input
                        type="text"
                        readOnly
                        value={urlSoloVistaDigital}
                        style={{
                          flex: 1,
                          minWidth: "140px",
                          padding: "5px 7px",
                          fontSize: "0.7rem",
                          color: "#334155",
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          borderRadius: "6px",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopiar(urlSoloVistaDigital, "vista")}
                        title="Copiar enlace de visualización de la tarjeta digital"
                        aria-label="Copiar Enlace Digital"
                        style={{
                          padding: "5px 9px",
                          background: copiadoVista ? "#16A34A" : "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {copiadoVista ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiadoVista ? "Copiado" : "Copiar"}</span>
                      </button>
                      <a
                        href={urlSoloVistaDigital}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir vista digital de solo lectura"
                        aria-label="Ver Digital"
                        style={{
                          padding: "5px 8px",
                          background: "#FFFFFF",
                          border: "1px solid #CBD5E1",
                          color: "#0F172A",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <ExternalLink size={11} />
                        <span>Ver</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA DERECHA: TIPO, MODO DE IMPRESIÓN (MENSAJE O QR), TEXTO, MÚSICA Y CALIBRACIÓN */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* 1. TIPO DE TARJETA Y ORIENTACIÓN */}
              <div>
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#334155",
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Tipo de pedido y orientación física:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => cambiarFormatoTarjeta("DIPTICO")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: !esCondolencias ? "2px solid #0284C7" : "1px solid #CBD5E1",
                      background: !esCondolencias ? "#F0F9FF" : "#FFFFFF",
                      color: !esCondolencias ? "#0369A1" : "#475569",
                      fontWeight: 700,
                      fontSize: "0.77rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    💌 Dedicatoria (Vertical)
                    <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#64748B" }}>
                      11,3 × 16,8 cm · Se dobla
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cambiarFormatoTarjeta("CONDOLENCIAS_PLANA")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: esCondolencias ? "2px solid #7C3AED" : "1px solid #CBD5E1",
                      background: esCondolencias ? "#F5F3FF" : "#FFFFFF",
                      color: esCondolencias ? "#5B21B6" : "#475569",
                      fontWeight: 700,
                      fontSize: "0.77rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    🕊️ Condolencias (Horizontal)
                    <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#64748B" }}>
                      16,8 × 11,3 cm · Sin QR ni música
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. MODO DE IMPRESIÓN MUTUAMENTE EXCLUYENTE (SOLO DEDICATORIA: MENSAJE O QR, NUNCA AMBOS) */}
              {!esCondolencias && (
                <div>
                  <label
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#334155",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    ¿Qué se imprime en la cartulina? (Mutuamente excluyente):
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setConfidencialSoloQr(false)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: !soloQrEfectivo ? "2px solid #0F766E" : "1px solid #CBD5E1",
                        background: !soloQrEfectivo ? "#F0FDFA" : "#FFFFFF",
                        color: !soloQrEfectivo ? "#0F766E" : "#475569",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      📝 Imprimir Mensaje
                      <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 400, color: "#64748B" }}>
                        Texto + imagen opcional (sin QR)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfidencialSoloQr(true)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: soloQrEfectivo ? "2px solid #0284C7" : "1px solid #CBD5E1",
                        background: soloQrEfectivo ? "#F0F9FF" : "#FFFFFF",
                        color: soloQrEfectivo ? "#0369A1" : "#475569",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Lock size={11} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                      Imprimir Solo QR
                      <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 400, color: "#64748B" }}>
                        Confidencial · Mensaje y música en web
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. PARA Y DE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      color: "#334155",
                      display: "block",
                      marginBottom: "3px",
                    }}
                  >
                    {esCondolencias ? "En memoria / Destinatario:" : "Para (Destinatario):"}
                  </label>
                  <input
                    type="text"
                    value={paraEditable}
                    onChange={(e) => setParaEditable(e.target.value)}
                    placeholder="Quien recibe"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "7px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.79rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      color: "#334155",
                      display: "block",
                      marginBottom: "3px",
                    }}
                  >
                    De parte de (Firma):
                  </label>
                  <input
                    type="text"
                    value={deEditable}
                    onChange={(e) => setDeEditable(e.target.value)}
                    placeholder="Quien envía"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "7px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.79rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* 4. MENSAJE */}
              <div>
                <label
                  style={{
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    color: "#0F172A",
                    display: "block",
                    marginBottom: "3px",
                  }}
                >
                  Mensaje de la tarjeta:
                </label>
                <textarea
                  rows={4}
                  value={mensajeEditable}
                  onChange={(e) => setMensajeEditable(e.target.value)}
                  placeholder={
                    esCondolencias
                      ? "Escribe el mensaje de condolencias..."
                      : "Escribe el mensaje de dedicatoria..."
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #94A3B8",
                    fontSize: "0.83rem",
                    lineHeight: 1.4,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* 5. MÚSICA Y LYRIC: EXCLUSIVO PARA DEDICATORIA */}
              {!esCondolencias && (
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "9px",
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#334155" }}>
                      🎵 Canción de fondo (YouTube o MP3 — para tarjeta digital):
                    </span>
                    <div style={{ display: "flex", gap: "5px" }}>
                      <button
                        type="button"
                        disabled={subiendoMp3}
                        onClick={() => inputAudioRef.current?.click()}
                        title="Subir archivo MP3"
                        aria-label="Subir MP3"
                        style={{
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#0F172A",
                          padding: "3px 7px",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {subiendoMp3 ? <Loader2 size={11} /> : <Upload size={11} />}
                        <span>{subiendoMp3 ? "Subiendo..." : "Subir MP3"}</span>
                      </button>
                      <input
                        ref={inputAudioRef}
                        type="file"
                        accept="audio/*,.mp3,.m4a,.wav,.ogg"
                        onChange={handleSubirMp3}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        disabled={buscandoLyrics}
                        onClick={() => void handleBuscarLetra()}
                        title="Generar letra sincronizada"
                        aria-label="Cargar Letra"
                        style={{
                          border: "1px solid #BAE6FD",
                          background: "#E0F2FE",
                          color: "#0369A1",
                          padding: "3px 7px",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {buscandoLyrics ? <Loader2 size={11} /> : <Sparkles size={11} />}
                        <span>{buscandoLyrics ? "Buscando..." : "Cargar Letra"}</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={musicaUrlEditable}
                    onChange={(e) => setMusicaUrlEditable(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... o URL MP3"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="text"
                    value={musicaTituloEditable}
                    onChange={(e) => setMusicaTituloEditable(e.target.value)}
                    placeholder="Artista - Canción (para el lyric inferior)"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  />
                  {lyricsEditables.length > 0 && (
                    <span style={{ fontSize: "0.69rem", color: "#15803D", fontWeight: 600 }}>
                      ✓ {lyricsEditables.length} líneas de lyric listas para deslizarse abajo.
                    </span>
                  )}
                </div>
              )}

              {/* CALIBRACIÓN FINA DE IMPRESORA CANON G3110 */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setMostrarCalibrador(!mostrarCalibrador)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#0369A1",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                >
                  <Sliders size={12} />
                  <span>{mostrarCalibrador ? "Ocultar ajuste fino" : "Ajuste fino Canon G3110 (mm)"}</span>
                </button>
              </div>

              {mostrarCalibrador && (
                <div
                  style={{
                    background: "#F8FAFC",
                    padding: "9px 11px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                  }}
                >
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#475569", display: "block" }}>
                      Ancho (mm)
                    </label>
                    <input
                      type="number"
                      value={anchoMm}
                      onChange={(e) => setAnchoMm(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        borderRadius: "5px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.76rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#475569", display: "block" }}>
                      Alto (mm)
                    </label>
                    <input
                      type="number"
                      value={altoMm}
                      onChange={(e) => setAltoMm(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        borderRadius: "5px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.76rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#475569", display: "block" }}>
                      Desfase X (mm)
                    </label>
                    <input
                      type="number"
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        borderRadius: "5px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.76rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.68rem", color: "#475569", display: "block" }}>
                      Desfase Y (mm)
                    </label>
                    <input
                      type="number"
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "4px 6px",
                        borderRadius: "5px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.76rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "#FEE2E2",
                    color: "#991B1B",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {errorMsg}
                </div>
              )}
              {avisoOk && (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "#DCFCE7",
                    color: "#166534",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {avisoOk}
                </div>
              )}
            </div>
          </div>

          {/* PIE DE ACCIONES */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={guardando}
              onClick={() => void persistirCambiosTarjeta(false)}
              title="Guardar cambios y diseño de la tarjeta"
              aria-label="Guardar Tarjeta"
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: "1px solid #0F766E",
                background: "#F0FDFA",
                color: "#0F766E",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {guardando ? <Loader2 size={14} /> : <Save size={14} />}
              <span>{guardando ? "Guardando..." : "Guardar Tarjeta"}</span>
            </button>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={compartiendoDiseno}
                onClick={() => void handleCompartirDiseno()}
                title="Guardar y compartir imagen PNG del diseño final (WhatsApp / Descarga)"
                aria-label="Compartir Diseño"
                style={{
                  padding: "9px 13px",
                  borderRadius: "8px",
                  border: "1px solid #16A34A",
                  background: "#F0FDF4",
                  color: "#15803D",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {compartiendoDiseno ? <Loader2 size={14} /> : <Share2 size={14} />}
                <span>{compartiendoDiseno ? "Preparando..." : "Compartir"}</span>
              </button>

              <button
                type="button"
                disabled={descargandoPdf}
                onClick={() => void handleDescargarPdf()}
                title="Descargar tarjeta en PDF calibrada a medida exacta"
                aria-label="Descargar PDF"
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {descargandoPdf ? <Loader2 size={14} /> : <Download size={14} />}
                <span>{descargandoPdf ? "Generando..." : "Descargar PDF"}</span>
              </button>

              <button
                type="button"
                disabled={imprimiendo}
                onClick={() => void handleLanzarImpresion()}
                title="Mandar a imprimir directamente en Canon PIXMA G3110"
                aria-label="Imprimir Tarjeta"
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 10px rgba(2, 132, 199, 0.25)",
                }}
              >
                {imprimiendo ? <Loader2 size={14} /> : <Printer size={14} />}
                <span>{imprimiendo ? "Preparando..." : "Imprimir Tarjeta"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
