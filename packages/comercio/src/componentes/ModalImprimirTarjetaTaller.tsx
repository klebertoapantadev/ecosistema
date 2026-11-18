"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
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
  Sliders,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type { OrdenTrabajoTaller } from "../operaciones-taller";
import {
  buscarLyricsCancionAction,
  guardarEdicionPedidoYTarjetaAction,
  registrarImpresionTarjetaAction,
  subirAudioTarjetaAction,
} from "../acciones-operaciones-taller";

export interface PropsModalImprimirTarjetaTaller {
  abierto: boolean;
  onCerrar: () => void;
  orden: OrdenTrabajoTaller | null;
  negocio: string;
  onActualizarOrden?: (ordenActualizada: Partial<OrdenTrabajoTaller> & { id: string }) => void;
}

type FormatoTarjeta = "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
type EstiloFuente = "cursiva" | "formal" | "serif";

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
): string[] {
  const parrafos = texto.split(/\r?\n/);
  const lineasFinales: string[] = [];

  for (const parrafo of parrafos) {
    const limpio = parrafo.trim();
    if (!limpio) {
      lineasFinales.push("");
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
        lineasFinales.push(actual);
        actual = palabra;
      }
    }
    if (actual) lineasFinales.push(actual);
  }
  return lineasFinales;
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

  const [fuente, setFuente] = useState<EstiloFuente>(esCondolencias ? "serif" : "cursiva");
  const [mensajeEditable, setMensajeEditable] = useState<string>(orden?.dedicatoria || "");
  const [paraEditable, setParaEditable] = useState<string>(orden?.destinatarioFallecido || "");
  const [deEditable, setDeEditable] = useState<string>(orden?.clienteSolicita || "");
  const [confidencialSoloQr, setConfidencialSoloQr] = useState<boolean>(
    Boolean(orden?.tarjetaConfidencial ?? orden?.tarjetaMetadata?.confidencial_solo_qr)
  );
  const [musicaUrlEditable, setMusicaUrlEditable] = useState<string>(orden?.tarjetaMusicaUrl || "");
  const [musicaTituloEditable, setMusicaTituloEditable] = useState<string>(
    orden?.tarjetaMusicaTitulo || ""
  );
  const [lyricsEditables, setLyricsEditables] = useState<Array<{ tiempo?: number; texto: string }>>(
    Array.isArray(orden?.tarjetaLyrics) ? orden.tarjetaLyrics : []
  );

  const [tamanoFuentePt, setTamanoFuentePt] = useState<number>(() => {
    const len = (orden?.dedicatoria || "").length;
    if (len < 60) return 22;
    if (len < 140) return 18;
    if (len < 240) return 15;
    return 12;
  });

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
  const [incluirQr, setIncluirQr] = useState<boolean>(true);
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
  const [avisoOk, setAvisoOk] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [metaLocal, setMetaLocal] = useState<Record<string, any>>(orden?.tarjetaMetadata || {});
  const inputAudioRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!orden) return;
    setFormato(formatoInicial);
    if (formatoInicial === "CONDOLENCIAS_PLANA") {
      setAnchoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.anchoMm);
      setAltoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.altoMm);
      setFuente("serif");
    } else {
      setAnchoMm(MEDIDAS_DEDICATORIA_VERTICAL.anchoMm);
      setAltoMm(MEDIDAS_DEDICATORIA_VERTICAL.altoMm);
      setFuente("cursiva");
    }
    setMensajeEditable(orden.dedicatoria || "");
    setParaEditable(orden.destinatarioFallecido || "");
    setDeEditable(orden.clienteSolicita || "");
    setConfidencialSoloQr(
      Boolean(orden.tarjetaConfidencial ?? orden.tarjetaMetadata?.confidencial_solo_qr)
    );
    setMusicaUrlEditable(orden.tarjetaMusicaUrl || "");
    setMusicaTituloEditable(orden.tarjetaMusicaTitulo || "");
    setLyricsEditables(Array.isArray(orden.tarjetaLyrics) ? orden.tarjetaLyrics : []);
    setTokenVistaActual(orden.tarjetaToken || orden.proformaId || orden.id);
    setTokenEdicionActual(orden.tarjetaTokenEdicion || "");
    setMetaLocal(orden.tarjetaMetadata || {});
    const len = (orden.dedicatoria || "").length;
    setTamanoFuentePt(len < 60 ? 22 : len < 140 ? 18 : len < 240 ? 15 : 12);
  }, [orden, formatoInicial]);

  // La tarjeta impresa SOLO contiene en el QR la URL de la tarjeta digital de visualización
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
      width: 220,
      margin: 1,
      color: {
        dark: "#18181B",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch((err: unknown) => console.error("Error generando QR", err));
  }, [tokenVistaActual, tokenEdicionActual, orden]);

  const fontStyleCss = useMemo(() => {
    if (fuente === "cursiva") {
      return "'Dancing Script', 'Brush Script MT', 'Great Vibes', 'Allura', cursive";
    }
    if (fuente === "serif") {
      return "'Playfair Display', Georgia, 'Times New Roman', serif";
    }
    return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }, [fuente]);

  if (!abierto || !orden) return null;

  const conteoImpresiones = Number(metaLocal?.impresiones ?? 0);
  const ultimoImpresoPor = metaLocal?.ultimo_impreso_por || null;
  const fueEditadaPorCliente = Boolean(metaLocal?.editado_por_cliente);
  const fueEditadaPorStaff = Boolean(metaLocal?.editado_por_staff);
  const vistasCliente = Number(metaLocal?.vistas_cliente ?? 0);
  const historial = Array.isArray(metaLocal?.historial_cambios) ? metaLocal.historial_cambios : [];
  const mostrarQrEfectivo = confidencialSoloQr || incluirQr;

  const cambiarFormatoTarjeta = (nuevo: FormatoTarjeta) => {
    setFormato(nuevo);
    if (nuevo === "CONDOLENCIAS_PLANA") {
      setAnchoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.anchoMm);
      setAltoMm(MEDIDAS_CONDOLENCIAS_HORIZONTAL.altoMm);
      setFuente("serif");
    } else {
      setAnchoMm(MEDIDAS_DEDICATORIA_VERTICAL.anchoMm);
      setAltoMm(MEDIDAS_DEDICATORIA_VERTICAL.altoMm);
      setFuente("cursiva");
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
      tarjetaConfidencial: confidencialSoloQr,
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
        tarjetaConfidencial: confidencialSoloQr,
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

      const fontEnum =
        fuente === "cursiva"
          ? StandardFonts.TimesRomanItalic
          : fuente === "serif"
            ? StandardFonts.TimesRoman
            : StandardFonts.Helvetica;
      const pdfFont = await pdfDoc.embedFont(fontEnum);

      if (confidencialSoloQr) {
        // MODO CONFIDENCIAL: SOLO IMPRIME EL QR (CON LA URL DE LA TARJETA DIGITAL)
        if (qrDataUrl) {
          const base64Qr = qrDataUrl.split(",")[1];
          if (base64Qr) {
            const qrBytes = Uint8Array.from(atob(base64Qr), (c) => c.charCodeAt(0));
            const qrImg = await pdfDoc.embedPng(qrBytes);
            const qrDim = (esCondolencias ? 26 : 28) * MM_TO_PT;
            const qrX = (pageW - qrDim) / 2 + offsetX * MM_TO_PT;
            // En Dedicatoria vertical (113x168 mm), centramos el QR en la mitad inferior (debajo del doblez de 84 mm)
            const qrY = esCondolencias
              ? (pageH - qrDim) / 2 - offsetY * MM_TO_PT
              : pageH * 0.25 - qrDim / 2 - offsetY * MM_TO_PT;
            page.drawImage(qrImg, { x: qrX, y: qrY, width: qrDim, height: qrDim });
          }
        }
      } else {
        const textoBase = limpiarCaracteresWinAnsi(
          mensajeEditable.trim() ||
            (esCondolencias
              ? "Expresamos nuestras mas sentidas condolencias."
              : "Con todo nuestro carino.")
        );

        // Márgenes respetando orientación:
        // Condolencias (168x113 mm horizontal): protege esquinas diagonales (22 mm laterales)
        // Dedicatoria (113x168 mm vertical): margen lateral de 11 mm
        const margenX = (esCondolencias ? 22 : 11) * MM_TO_PT;
        const areaW = pageW - margenX * 2;

        const sizePt = Math.max(9, Math.min(30, tamanoFuentePt));
        const interlineado = sizePt * 1.38;
        const lineas = envolverLineasPdf(textoBase, pdfFont, sizePt, areaW);
        const altoBloque = lineas.length * interlineado;
        let cursorY =
          pageH / 2 + altoBloque / 2 - sizePt * 0.8 + (mostrarQrEfectivo ? 5 * MM_TO_PT : 0);

        for (const lin of lineas) {
          if (lin) {
            const wLin = pdfFont.widthOfTextAtSize(lin, sizePt);
            const xCentrado = margenX + Math.max(0, (areaW - wLin) / 2);
            page.drawText(lin, {
              x: xCentrado + offsetX * MM_TO_PT,
              y: cursorY - offsetY * MM_TO_PT,
              size: sizePt,
              font: pdfFont,
              color: rgb(0.09, 0.09, 0.11),
            });
          }
          cursorY -= interlineado;
        }

        if (mostrarQrEfectivo && qrDataUrl) {
          const base64Qr = qrDataUrl.split(",")[1];
          if (base64Qr) {
            const qrBytes = Uint8Array.from(atob(base64Qr), (c) => c.charCodeAt(0));
            const qrImg = await pdfDoc.embedPng(qrBytes);
            const qrDim = (esCondolencias ? 17 : 18) * MM_TO_PT;
            // En Condolencias la esquina inferior derecha tiene hojas preimpresas, por eso va abajo a la izquierda
            const qrX = esCondolencias
              ? 10 * MM_TO_PT + offsetX * MM_TO_PT
              : pageW - qrDim - 8 * MM_TO_PT + offsetX * MM_TO_PT;
            const qrY = 7 * MM_TO_PT - offsetY * MM_TO_PT;
            page.drawImage(qrImg, { x: qrX, y: qrY, width: qrDim, height: qrDim });
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
          confidencial_solo_qr: confidencialSoloQr,
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
            tarjetaConfidencial: confidencialSoloQr,
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
        {confidencialSoloQr ? (
          // MODO CONFIDENCIAL / DISCRECIÓN: SOLO IMPRIME EL QR DE LA TARJETA DIGITAL
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: esCondolencias ? "center" : "flex-end",
              paddingBottom: esCondolencias ? "0mm" : "28mm",
              boxSizing: "border-box",
            }}
          >
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Tarjeta Digital"
                style={{
                  width: esCondolencias ? "26mm" : "28mm",
                  height: esCondolencias ? "26mm" : "28mm",
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        ) : esCondolencias ? (
          // CONDOLENCIAS HORIZONTAL (168 × 113 mm) — RESPETA ESQUINAS SUPERIOR-IZQUIERDA E INFERIOR-DERECHA
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "15mm 22mm 14mm 22mm",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              boxSizing: "border-box",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                fontFamily: fontStyleCss,
                fontSize: `${tamanoFuentePt}pt`,
                lineHeight: 1.38,
                color: "#18181B",
                whiteSpace: "pre-wrap",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              {mensajeEditable || "Expresamos nuestras más sentidas condolencias."}
            </div>

            {mostrarQrEfectivo && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Tarjeta Digital"
                style={{
                  position: "absolute",
                  bottom: "7mm",
                  left: "10mm",
                  width: "17mm",
                  height: "17mm",
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        ) : (
          // DEDICATORIA VERTICAL (113 × 168 mm) — CARA INTERNA COMPLETA (SE DOBLA A LA MITAD A 84 mm)
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: mostrarQrEfectivo ? "14mm 11mm 26mm 11mm" : "14mm 11mm 14mm 11mm",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              boxSizing: "border-box",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                fontFamily: fontStyleCss,
                fontSize: `${tamanoFuentePt}pt`,
                lineHeight: 1.38,
                color: "#18181B",
                whiteSpace: "pre-wrap",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              {mensajeEditable || "Con todo mi cariño"}
            </div>

            {mostrarQrEfectivo && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Tarjeta Digital"
                style={{
                  position: "absolute",
                  bottom: "7mm",
                  right: "8mm",
                  width: "18mm",
                  height: "18mm",
                  objectFit: "contain",
                }}
              />
            )}
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
            maxWidth: "980px",
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
                  {esCondolencias
                    ? "Horizontal 16,8 × 11,3 cm"
                    : "Vertical 11,3 × 16,8 cm"}
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.76rem", color: "#64748B" }}>
                La tarjeta impresa solo codifica en el QR la URL de visualización digital.
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

          {/* CUERPO: 2 COLUMNAS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "18px",
              padding: "16px 20px",
              overflowY: "auto",
            }}
          >
            {/* COLUMNA IZQUIERDA: SIMULADOR DE CARTULINA EN PROPORCIÓN REAL + AUDITORÍA + 2 ENLACES */}
            <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                  Zona de impresión ({anchoMm} × {altoMm} mm)
                </span>
                {confidencialSoloQr && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "#0369A1",
                      background: "#E0F2FE",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 700,
                    }}
                  >
                    🔒 Confidencial: Solo QR
                  </span>
                )}
              </div>

              {/* CONTENEDOR DE VISTA PREVIA CON ORIENTACIÓN REAL (VERTICAL vs HORIZONTAL) */}
              <div
                style={{
                  background: "#F1F5F9",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "290px",
                }}
              >
                <div
                  style={{
                    width: esCondolencias ? "100%" : "225px",
                    maxWidth: esCondolencias ? "360px" : "225px",
                    aspectRatio: esCondolencias ? "168 / 113" : "113 / 168",
                    backgroundColor: "#F6F4EE",
                    border: "1.5px solid #CBD5E1",
                    borderRadius: "6px",
                    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.12)",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent:
                      confidencialSoloQr && !esCondolencias ? "flex-end" : "center",
                    padding:
                      confidencialSoloQr && !esCondolencias
                        ? "16px 16px 38px 16px"
                        : esCondolencias
                          ? "24px 34px"
                          : mostrarQrEfectivo
                            ? "20px 16px 42px 16px"
                            : "20px 16px",
                    boxSizing: "border-box",
                    textAlign: "center",
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
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          right: "6px",
                          top: "-13px",
                          fontSize: "0.56rem",
                          color: "#94A3B8",
                          background: "rgba(246, 244, 238, 0.85)",
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

                  {confidencialSoloQr ? (
                    qrDataUrl && (
                      <img
                        src={qrDataUrl}
                        alt="QR Confidencial"
                        style={{
                          width: "64px",
                          height: "64px",
                          background: "#FFFFFF",
                          padding: "3px",
                          borderRadius: "4px",
                        }}
                      />
                    )
                  ) : (
                    <>
                      <div
                        style={{
                          fontFamily: fontStyleCss,
                          fontSize: `${Math.max(10, tamanoFuentePt * 0.68)}pt`,
                          lineHeight: 1.36,
                          color: "#18181B",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          maxHeight: "90%",
                          overflowY: "auto",
                          zIndex: 1,
                        }}
                      >
                        {mensajeEditable ||
                          (esCondolencias
                            ? "Expresamos nuestras más sentidas condolencias."
                            : "Escribe el mensaje de dedicatoria...")}
                      </div>

                      {mostrarQrEfectivo && qrDataUrl && (
                        <img
                          src={qrDataUrl}
                          alt="QR Tarjeta Digital"
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            ...(esCondolencias ? { left: "12px" } : { right: "10px" }),
                            width: "36px",
                            height: "36px",
                            background: "#FFFFFF",
                            padding: "2px",
                            borderRadius: "3px",
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

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

              {/* LOS 2 ENLACES SEPARADOS: 1) EDICIÓN Y 2) SOLO VISUALIZACIÓN DIGITAL (QR) */}
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
                    <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#0F766E", marginBottom: "3px" }}>
                      ✏️ Enlace para Editar Tarjeta (Cliente / Ventas):
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
                            `Hola ${deEditable || orden.clienteSolicita} 🌸, aquí puedes revisar o editar el mensaje de tu tarjeta del pedido ${orden.codigo} antes de que pase a impresión: ${urlEdicionTarjeta}`
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

                {urlSoloVistaDigital && (
                  <div>
                    <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#0369A1", marginBottom: "3px" }}>
                      👁️ Tarjeta Digital Solo Lectura (URL impresa en el QR):
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

            {/* COLUMNA DERECHA: DISTINCIÓN DEDICATORIA VS CONDOLENCIAS, CONFIDENCIALIDAD, MENSAJE Y MÚSICA */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* 1. TIPO DE TARJETA Y ORIENTACIÓN */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
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
                      11,3 × 16,8 cm · Se dobla + Música
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
                      16,8 × 11,3 cm · Plana (sin música)
                    </span>
                  </button>
                </div>
              </div>

              {/* 2. PARA Y DE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "3px" }}>
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
                  <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "3px" }}>
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

              {/* 3. MENSAJE */}
              <div>
                <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "3px" }}>
                  Mensaje de la tarjeta:
                </label>
                <textarea
                  rows={4}
                  value={mensajeEditable}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMensajeEditable(val);
                    const len = val.length;
                    setTamanoFuentePt(len < 60 ? 22 : len < 140 ? 18 : len < 240 ? 15 : 12);
                  }}
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

              {/* 4. CONFIDENCIALIDAD / DISCRECIÓN (SOLO QR IMPRESO) */}
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: confidencialSoloQr ? "#F0F9FF" : "#F8FAFC",
                  border: confidencialSoloQr ? "1.5px solid #0284C7" : "1px solid #E2E8F0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={confidencialSoloQr}
                  onChange={(e) => setConfidencialSoloQr(e.target.checked)}
                  style={{ marginTop: "2px", cursor: "pointer" }}
                />
                <div>
                  <strong style={{ display: "block", fontSize: "0.76rem", color: "#0F172A" }}>
                    <Lock size={12} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                    Confidencialidad / Discreción (imprimir solo el QR)
                  </strong>
                  <span style={{ fontSize: "0.69rem", color: "#64748B" }}>
                    Oculta el texto en la cartulina física e imprime únicamente el QR hacia la tarjeta digital.
                  </span>
                </div>
              </label>

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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#334155" }}>
                      🎵 Canción de fondo (YouTube o MP3):
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

              {/* TIPOGRAFÍA Y CALIBRACIÓN */}
              {!confidencialSoloQr && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  {[
                    { id: "cursiva", label: "Cursiva" },
                    { id: "serif", label: "Serif" },
                    { id: "formal", label: "Formal" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFuente(f.id as EstiloFuente)}
                      style={{
                        padding: "4px 9px",
                        borderRadius: "6px",
                        border: fuente === f.id ? "2px solid #0284C7" : "1px solid #CBD5E1",
                        background: fuente === f.id ? "#F0F9FF" : "#FFFFFF",
                        color: fuente === f.id ? "#0369A1" : "#475569",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                  <input
                    type="range"
                    min="10"
                    max="30"
                    value={tamanoFuentePt}
                    onChange={(e) => setTamanoFuentePt(Number(e.target.value))}
                    style={{ flex: 1, minWidth: "70px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#1E293B" }}>
                    {tamanoFuentePt}pt
                  </span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {!confidencialSoloQr ? (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={incluirQr}
                      onChange={(e) => setIncluirQr(e.target.checked)}
                    />
                    <span>Incluir QR junto al mensaje</span>
                  </label>
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "#0369A1", fontWeight: 600 }}>
                    QR centrado activo
                  </span>
                )}

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
                  <span>{mostrarCalibrador ? "Ocultar ajuste fino" : "Ajuste fino mm"}</span>
                </button>
              </div>

              {mostrarCalibrador && (
                <div
                  style={{
                    padding: "8px 10px",
                    background: "#F1F5F9",
                    borderRadius: "8px",
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "6px",
                    fontSize: "0.7rem",
                  }}
                >
                  <div>
                    <label style={{ display: "block", color: "#475569" }}>Ancho mm</label>
                    <input
                      type="number"
                      value={anchoMm}
                      onChange={(e) => setAnchoMm(Number(e.target.value))}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#475569" }}>Alto mm</label>
                    <input
                      type="number"
                      value={altoMm}
                      onChange={(e) => setAltoMm(Number(e.target.value))}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#475569" }}>Offset X</label>
                    <input
                      type="number"
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value))}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#475569" }}>Offset Y</label>
                    <input
                      type="number"
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value))}
                      style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: "7px 10px", borderRadius: "7px", background: "#FEE2E2", color: "#991B1B", fontSize: "0.74rem", fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}
              {avisoOk && (
                <div style={{ padding: "7px 10px", borderRadius: "7px", background: "#DCFCE7", color: "#166534", fontSize: "0.74rem", fontWeight: 600 }}>
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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={guardando}
              onClick={() => void persistirCambiosTarjeta(false)}
              title="Guardar cambios de la tarjeta"
              aria-label="Guardar Tarjeta"
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #059669",
                background: "#ECFDF5",
                color: "#065F46",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {guardando ? <Loader2 size={15} /> : <Save size={15} />}
              <span>Guardar Tarjeta</span>
            </button>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={descargandoPdf}
                onClick={() => void handleDescargarPdf()}
                title="Descargar PDF con medidas reales (16,8 x 11,3 cm)"
                aria-label="Descargar PDF"
                style={{
                  padding: "8px 14px",
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
                {descargandoPdf ? <Loader2 size={15} /> : <Download size={15} />}
                <span>Descargar PDF</span>
              </button>

              <button
                type="button"
                disabled={imprimiendo}
                onClick={() => void handleLanzarImpresion()}
                title="Imprimir tarjeta directo en Canon G3110"
                aria-label="Imprimir Tarjeta"
                style={{
                  padding: "8px 18px",
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
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                }}
              >
                <Printer size={15} />
                <span>{conteoImpresiones > 0 ? "Reimprimir" : "Imprimir Tarjeta"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
