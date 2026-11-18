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

function limpiarCaracteresWinAnsi(texto: string): string {
  // pdf-lib StandardFonts usa WinAnsi (soporta tildes y ñ, reemplazamos emojis fuera de rango)
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
  const esMargaritas = negNorm.includes("margarita");
  const nombreMarca = esMargaritas ? "Margaritas Floristería" : "Tinkay Flores y Eventos";

  const formatoInicial: FormatoTarjeta = useMemo(() => {
    if (!orden) return "DIPTICO";
    if (orden.tarjetaTipo) return orden.tarjetaTipo;
    const txt = `${orden.productoResumen} ${orden.origenTipo}`.toLowerCase();
    if (txt.includes("condolen") || txt.includes("funebr") || txt.includes("exequial")) {
      return "CONDOLENCIAS_PLANA";
    }
    return "DIPTICO";
  }, [orden]);

  const [formato, setFormato] = useState<FormatoTarjeta>(formatoInicial);
  const [fuente, setFuente] = useState<EstiloFuente>(
    formatoInicial === "CONDOLENCIAS_PLANA" ? "serif" : "cursiva"
  );
  const [mensajeEditable, setMensajeEditable] = useState<string>(orden?.dedicatoria || "");
  const [paraEditable, setParaEditable] = useState<string>(orden?.destinatarioFallecido || "");
  const [deEditable, setDeEditable] = useState<string>(orden?.clienteSolicita || "");
  const [musicaUrlEditable, setMusicaUrlEditable] = useState<string>(orden?.tarjetaMusicaUrl || "");
  const [musicaTituloEditable, setMusicaTituloEditable] = useState<string>(
    orden?.tarjetaMusicaTitulo || ""
  );
  const [lyricsEditables, setLyricsEditables] = useState<Array<{ tiempo?: number; texto: string }>>(
    Array.isArray(orden?.tarjetaLyrics) ? orden.tarjetaLyrics : []
  );

  const [tamanoFuentePt, setTamanoFuentePt] = useState<number>(() => {
    const len = (orden?.dedicatoria || "").length;
    if (len < 60) return 21;
    if (len < 140) return 17;
    if (len < 240) return 14;
    return 12;
  });

  // Calibración en milímetros para cartulina en bandeja trasera Canon G3110
  const [anchoMm, setAnchoMm] = useState<number>(148);
  const [altoMm, setAltoMm] = useState<number>(105);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [incluirQr, setIncluirQr] = useState<boolean>(true);
  const [mostrarCalibrador, setMostrarCalibrador] = useState<boolean>(false);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);

  const [tokenActual, setTokenActual] = useState<string>(
    orden?.tarjetaToken || orden?.proformaId || orden?.id || ""
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [urlPublicaTarjeta, setUrlPublicaTarjeta] = useState<string>("");
  const [copiadoUrl, setCopiadoUrl] = useState<boolean>(false);
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
    setMensajeEditable(orden.dedicatoria || "");
    setParaEditable(orden.destinatarioFallecido || "");
    setDeEditable(orden.clienteSolicita || "");
    setMusicaUrlEditable(orden.tarjetaMusicaUrl || "");
    setMusicaTituloEditable(orden.tarjetaMusicaTitulo || "");
    setLyricsEditables(Array.isArray(orden.tarjetaLyrics) ? orden.tarjetaLyrics : []);
    setTokenActual(orden.tarjetaToken || orden.proformaId || orden.id);
    setMetaLocal(orden.tarjetaMetadata || {});
    const len = (orden.dedicatoria || "").length;
    setTamanoFuentePt(len < 60 ? 21 : len < 140 ? 17 : len < 240 ? 14 : 12);
  }, [orden, formatoInicial]);

  useEffect(() => {
    if (typeof window === "undefined" || !orden) return;
    const tok = tokenActual || orden.tarjetaToken || orden.id;
    const url = `${window.location.protocol}//${window.location.host}/dedicatoria/${tok}`;
    setUrlPublicaTarjeta(url);

    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: {
        dark: "#1E293B",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch((err: unknown) => console.error("Error generando QR", err));
  }, [tokenActual, orden]);

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

  const handleCopiarEnlace = () => {
    if (!urlPublicaTarjeta) return;
    void navigator.clipboard.writeText(urlPublicaTarjeta);
    setCopiadoUrl(true);
    setTimeout(() => setCopiadoUrl(false), 2200);
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
      setAvisoOk("🎵 Audio MP3 subido. Pulsa Guardar Tarjeta para vincularlo.");
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

    let lyricsAGuardar = lyricsEditables;
    if (
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
        if (!musicaTituloEditable.trim() && autoLrc.tituloDetectado) {
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
      tarjetaMusicaUrl: musicaUrlEditable.trim() || null,
      tarjetaMusicaTitulo: musicaTituloEditable.trim() || null,
      tarjetaLyrics: lyricsAGuardar,
    });

    if (!silencioso) setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error || "No se pudo guardar la tarjeta.");
      return false;
    }

    const nuevoTok = res.tarjetaToken || tokenActual;
    const nuevaMeta = res.tarjetaMetadata || metaLocal;
    setTokenActual(nuevoTok);
    setMetaLocal(nuevaMeta);

    if (onActualizarOrden) {
      onActualizarOrden({
        id: orden.id,
        dedicatoria: mensajeEditable.trim(),
        destinatarioFallecido: paraEditable.trim(),
        clienteSolicita: deEditable.trim() || orden.clienteSolicita,
        tarjetaTipo: formato,
        tarjetaToken: nuevoTok,
        tarjetaMusicaUrl: musicaUrlEditable.trim() || null,
        tarjetaMusicaTitulo: musicaTituloEditable.trim() || null,
        tarjetaLyrics: lyricsAGuardar,
        tarjetaMetadata: nuevaMeta,
      });
    }

    if (!silencioso) {
      setAvisoOk("✅ Tarjeta guardada y sincronizada con el pedido.");
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
      const pageH = Math.max(50, altoMm) * MM_TO_PT;

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([pageW, pageH]);

      const fontEnum =
        fuente === "cursiva"
          ? StandardFonts.TimesRomanItalic
          : fuente === "serif"
            ? StandardFonts.TimesRoman
            : StandardFonts.Helvetica;
      const pdfFont = await pdfDoc.embedFont(fontEnum);
      const pdfFontSmall = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const textoBase = limpiarCaracteresWinAnsi(
        mensajeEditable.trim() ||
          (formato === "CONDOLENCIAS_PLANA"
            ? "Expresamos nuestras mas sentidas condolencias."
            : "Con todo nuestro carino.")
      );

      const areaX = formato === "DIPTICO" ? pageW / 2 + 7 * MM_TO_PT : 10 * MM_TO_PT;
      const areaW =
        formato === "DIPTICO" ? pageW / 2 - 15 * MM_TO_PT : pageW - 22 * MM_TO_PT;

      const sizePt = Math.max(9, Math.min(30, tamanoFuentePt));
      const interlineado = sizePt * 1.35;
      const lineas = envolverLineasPdf(textoBase, pdfFont, sizePt, areaW);
      const altoBloque = lineas.length * interlineado;
      let cursorY = pageH / 2 + altoBloque / 2 - sizePt * 0.8 + (incluirQr ? 4 * MM_TO_PT : 0);

      for (const lin of lineas) {
        if (lin) {
          const wLin = pdfFont.widthOfTextAtSize(lin, sizePt);
          const xCentrado = areaX + Math.max(0, (areaW - wLin) / 2);
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

      if (incluirQr && qrDataUrl) {
        const base64Qr = qrDataUrl.split(",")[1];
        if (base64Qr) {
          const qrBytes = Uint8Array.from(atob(base64Qr), (c) => c.charCodeAt(0));
          const qrImg = await pdfDoc.embedPng(qrBytes);
          const qrDim = 17 * MM_TO_PT;
          const qrX = pageW - qrDim - 5 * MM_TO_PT + offsetX * MM_TO_PT;
          const qrY = 4 * MM_TO_PT - offsetY * MM_TO_PT;
          page.drawImage(qrImg, { x: qrX, y: qrY, width: qrDim, height: qrDim });

          const leyenda = "Escanea tu melodia";
          const wLey = pdfFontSmall.widthOfTextAtSize(leyenda, 6.2);
          page.drawText(leyenda, {
            x: qrX - wLey - 4,
            y: qrY + qrDim / 2 - 2,
            size: 6.2,
            font: pdfFontSmall,
            color: rgb(0.39, 0.45, 0.54),
          });
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Tarjeta-${orden.codigo || "Pedido"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setAvisoOk("⬇️ PDF descargado con medidas exactas listo para imprimir.");
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

      {/* LIENZO MILIMÉTRICO DE IMPRESIÓN DIRECTA EN CANON G3110 */}
      <div className="area-impresion-tarjeta">
        {formato === "DIPTICO" ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              boxSizing: "border-box",
            }}
          >
            <div style={{ width: "100%", height: "100%" }} />
            <div
              style={{
                width: "100%",
                height: "100%",
                padding: "8mm 9mm 6mm 7mm",
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
                  lineHeight: 1.35,
                  color: "#18181B",
                  whiteSpace: "pre-wrap",
                  maxWidth: "96%",
                  wordBreak: "break-word",
                }}
              >
                {mensajeEditable || "Con todo mi cariño"}
              </div>

              {incluirQr && qrDataUrl && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "4mm",
                    right: "5mm",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(255,255,255,0.9)",
                    padding: "2px 4px",
                    borderRadius: "4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "6pt",
                      color: "#64748B",
                      textAlign: "right",
                      lineHeight: 1.1,
                      maxWidth: "50px",
                    }}
                  >
                    Escanea y escucha 🎵
                  </span>
                  <img
                    src={qrDataUrl}
                    alt="QR Tarjeta Digital"
                    style={{ width: "18mm", height: "18mm", objectFit: "contain" }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "9mm 12mm 7mm 10mm",
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
                lineHeight: 1.35,
                color: "#18181B",
                whiteSpace: "pre-wrap",
                maxWidth: "88%",
                wordBreak: "break-word",
                marginTop: "2mm",
              }}
            >
              {mensajeEditable || "Expresamos nuestras más sentidas condolencias."}
            </div>

            {incluirQr && qrDataUrl && (
              <div
                style={{
                  position: "absolute",
                  bottom: "4mm",
                  right: "6mm",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "6pt",
                    color: "#64748B",
                    textAlign: "right",
                    lineHeight: 1.1,
                    maxWidth: "55px",
                  }}
                >
                  Mensaje y melodía 🎵
                </span>
                <img
                  src={qrDataUrl}
                  alt="QR Tarjeta Digital"
                  style={{ width: "17mm", height: "17mm", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL INTERACTIVO DE EDICIÓN, DESCARGA PDF E IMPRESIÓN */}
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
            maxWidth: "960px",
            maxHeight: "93vh",
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
              padding: "14px 20px",
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
                <span style={{ fontSize: "1.15rem" }}>💌</span>
                <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Tarjeta Dedicatoria Vinculada al Pedido {orden.codigo}
                </h2>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "#DCFCE7",
                    color: "#166534",
                  }}
                >
                  Relación 1:1 con Pedido
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#64748B" }}>
                Edita el mensaje o melodía, descarga el PDF exacto o imprime directo en la Canon G3110.
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

          {/* CUERPO: 2 COLUMNAS ADAPTATIVAS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "18px",
              padding: "18px 20px",
              overflowY: "auto",
            }}
          >
            {/* COLUMNA IZQUIERDA: VISTA PREVIA EN VIVO + TRAZABILIDAD + LINK CLIENTE */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>
                  Vista previa real sobre la cartulina ({anchoMm}×{altoMm} mm)
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "#0369A1",
                    background: "#E0F2FE",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 700,
                  }}
                >
                  {formato === "DIPTICO" ? "Díptico Plegable" : "Condolencias Plana"}
                </span>
              </div>

              <div
                style={{
                  aspectRatio: "1.41 / 1",
                  backgroundColor: "#FFFDF9",
                  border: "2px dashed #CBD5E1",
                  borderRadius: "10px",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.06)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                {formato === "DIPTICO" ? (
                  <>
                    <div
                      style={{
                        flex: 1,
                        borderRight: "1px dashed #CBD5E1",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "14px",
                        background: "#FAF7F2",
                        opacity: 0.72,
                        textAlign: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.66rem", color: "#94A3B8", marginBottom: "4px" }}>
                        (Portada exterior preimpresa)
                      </span>
                      <strong style={{ fontSize: "0.82rem", color: "#64748B", letterSpacing: "0.8px" }}>
                        {nombreMarca}
                      </strong>
                      <span style={{ fontSize: "0.63rem", color: "#94A3B8", marginTop: "4px" }}>
                        No recibe tinta · Se dobla hacia afuera
                      </span>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: fontStyleCss,
                          fontSize: `${tamanoFuentePt * 0.85}pt`,
                          lineHeight: 1.35,
                          color: "#1E293B",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          maxHeight: "82%",
                          overflowY: "auto",
                        }}
                      >
                        {mensajeEditable || "Escribe el mensaje a la derecha..."}
                      </div>

                      {incluirQr && qrDataUrl && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "7px",
                            right: "7px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "rgba(255,255,255,0.95)",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          }}
                        >
                          <span style={{ fontSize: "0.52rem", color: "#64748B", textAlign: "right", lineHeight: 1 }}>
                            Escanea 🎵
                          </span>
                          <img src={qrDataUrl} alt="QR" style={{ width: "34px", height: "34px" }} />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      padding: "18px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "10px",
                        fontSize: "0.66rem",
                        color: "#94A3B8",
                        background: "#F1F5F9",
                        padding: "3px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      🌿 [Arte Preimpreso Esquina]
                    </div>

                    <div
                      style={{
                        fontFamily: fontStyleCss,
                        fontSize: `${tamanoFuentePt * 0.85}pt`,
                        lineHeight: 1.35,
                        color: "#1E293B",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxWidth: "88%",
                      }}
                    >
                      {mensajeEditable || "Expresamos nuestras más sentidas condolencias."}
                    </div>

                    {incluirQr && qrDataUrl && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "10px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "rgba(255,255,255,0.95)",
                          padding: "2px 4px",
                          borderRadius: "4px",
                        }}
                      >
                        <span style={{ fontSize: "0.52rem", color: "#64748B", textAlign: "right", lineHeight: 1 }}>
                          Melodía 🎵
                        </span>
                        <img src={qrDataUrl} alt="QR" style={{ width: "32px", height: "32px" }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TRAZABILIDAD DE AUDITORÍA */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#334155" }}>Control de estado y auditoría:</strong>
                  <button
                    type="button"
                    onClick={() => setMostrarHistorial(!mostrarHistorial)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#0284C7",
                      cursor: "pointer",
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <History size={12} /> {mostrarHistorial ? "Ocultar" : `Historial (${historial.length})`}
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
                        ? `✏️ Editada por ${metaLocal?.ultimo_editor_nombre || "Staff"}`
                        : "🤖 Generada automática"}
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
                    👀 {vistasCliente > 0 ? `Vista ${vistasCliente}x` : "No abierta aún"}
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
                      : "Pendiente imprimir"}
                  </span>
                </div>

                {mostrarHistorial && (
                  <div
                    style={{
                      marginTop: "4px",
                      paddingTop: "6px",
                      borderTop: "1px dashed #CBD5E1",
                      maxHeight: "95px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    {historial.length === 0 ? (
                      <span style={{ color: "#94A3B8" }}>Sin ediciones posteriores a la creación.</span>
                    ) : (
                      historial.map((h: any, i: number) => (
                        <div key={i} style={{ fontSize: "0.71rem", color: "#334155" }}>
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

              {/* ENLACE PÚBLICO Y ENVÍO AL CLIENTE */}
              {urlPublicaTarjeta && (
                <div
                  style={{
                    background: "#F0F9FF",
                    border: "1px solid #BAE6FD",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0369A1" }}>
                    🔗 Link para que el cliente vea o edite su tarjeta digital (QR):
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      readOnly
                      value={urlPublicaTarjeta}
                      style={{
                        flex: 1,
                        minWidth: "160px",
                        padding: "6px 8px",
                        fontSize: "0.72rem",
                        color: "#334155",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopiarEnlace}
                      title="Copiar enlace de la tarjeta"
                      aria-label="Copiar Link"
                      style={{
                        padding: "6px 10px",
                        background: copiadoUrl ? "#16A34A" : "#0284C7",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {copiadoUrl ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiadoUrl ? "Copiado" : "Copiar"}</span>
                    </button>
                    <a
                      href={urlPublicaTarjeta}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir tarjeta digital en nueva pestaña"
                      aria-label="Ver Digital"
                      style={{
                        padding: "6px 9px",
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        color: "#0F172A",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>Abrir</span>
                    </a>
                    {orden.clienteTelefono && (
                      <a
                        href={`https://wa.me/${orden.clienteTelefono.replace(/\D+/g, "")}?text=${encodeURIComponent(
                          `Hola ${deEditable || orden.clienteSolicita} 🌸, aquí tienes el enlace de tu tarjeta dedicatoria del pedido ${orden.codigo}. Puedes revisarla, ajustar el mensaje o agregarle una canción antes de que pase a impresión en nuestro taller: ${urlPublicaTarjeta}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar enlace al comprador por WhatsApp"
                        aria-label="Enviar WhatsApp"
                        style={{
                          padding: "6px 9px",
                          background: "#16A34A",
                          color: "#FFFFFF",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <MessageCircle size={12} />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: EDICIÓN DE TEXTO, MÚSICA YOUTUBE/MP3, FORMATO Y MEDIDAS */}
            <div style={{ display: "flex", flexDirection: "column", gap: "11px" }}>
              {/* DESTINATARIO Y REMITENTE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "3px" }}>
                    Para (Destinatario):
                  </label>
                  <input
                    type="text"
                    value={paraEditable}
                    onChange={(e) => setParaEditable(e.target.value)}
                    placeholder="Quien recibe"
                    style={{
                      width: "100%",
                      padding: "7px 9px",
                      borderRadius: "7px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "3px" }}>
                    De parte de (Firma):
                  </label>
                  <input
                    type="text"
                    value={deEditable}
                    onChange={(e) => setDeEditable(e.target.value)}
                    placeholder="Quien envía"
                    style={{
                      width: "100%",
                      padding: "7px 9px",
                      borderRadius: "7px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* MENSAJE EDITABLE */}
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: "4px" }}>
                  Mensaje impreso y digital de la tarjeta:
                </label>
                <textarea
                  rows={4}
                  value={mensajeEditable}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMensajeEditable(val);
                    const len = val.length;
                    setTamanoFuentePt(len < 60 ? 21 : len < 140 ? 17 : len < 240 ? 14 : 12);
                  }}
                  placeholder="Escribe aquí la dedicatoria o mensaje de condolencias..."
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "8px",
                    border: "1px solid #94A3B8",
                    fontSize: "0.84rem",
                    lineHeight: 1.4,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* MÚSICA YOUTUBE O MP3 + LYRICS */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "9px",
                  padding: "9px 11px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "7px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#334155" }}>
                    🎵 Melodía de fondo (Link YouTube o MP3):
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      disabled={subiendoMp3}
                      onClick={() => inputAudioRef.current?.click()}
                      title="Subir archivo MP3 o audio desde tu dispositivo"
                      aria-label="Subir MP3"
                      style={{
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        color: "#0F172A",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.71rem",
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
                      title="Buscar y sincronizar automáticamente la letra de la canción"
                      aria-label="Cargar Letra"
                      style={{
                        border: "1px solid #BAE6FD",
                        background: "#E0F2FE",
                        color: "#0369A1",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.71rem",
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
                  placeholder="https://www.youtube.com/watch?v=... o URL de MP3"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.78rem",
                    background: "#FFFFFF",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="text"
                  value={musicaTituloEditable}
                  onChange={(e) => setMusicaTituloEditable(e.target.value)}
                  placeholder="Artista - Canción (ej: Fonseca - Te Mando Flores)"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.78rem",
                    background: "#FFFFFF",
                    boxSizing: "border-box",
                  }}
                />
                {lyricsEditables.length > 0 && (
                  <span style={{ fontSize: "0.7rem", color: "#15803D", fontWeight: 600 }}>
                    ✓ {lyricsEditables.length} líneas de letra listas para deslizarse en la tarjeta digital.
                  </span>
                )}
              </div>

              {/* FORMATO DE CARTULINA Y TIPOGRAFÍA */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setFormato("DIPTICO")}
                  style={{
                    padding: "7px 9px",
                    borderRadius: "8px",
                    border: formato === "DIPTICO" ? "2px solid #0284C7" : "1px solid #CBD5E1",
                    background: formato === "DIPTICO" ? "#F0F9FF" : "#FFFFFF",
                    color: formato === "DIPTICO" ? "#0369A1" : "#475569",
                    fontWeight: 700,
                    fontSize: "0.76rem",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  📖 Díptico Tinkay
                  <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#64748B" }}>
                    Se dobla a la mitad (oculta adentro)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormato("CONDOLENCIAS_PLANA")}
                  style={{
                    padding: "7px 9px",
                    borderRadius: "8px",
                    border: formato === "CONDOLENCIAS_PLANA" ? "2px solid #0284C7" : "1px solid #CBD5E1",
                    background: formato === "CONDOLENCIAS_PLANA" ? "#F0F9FF" : "#FFFFFF",
                    color: formato === "CONDOLENCIAS_PLANA" ? "#0369A1" : "#475569",
                    fontWeight: 700,
                    fontSize: "0.76rem",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  🕊️ Condolencias Plana
                  <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#64748B" }}>
                    No se dobla (diseño preimpreso)
                  </span>
                </button>
              </div>

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
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: fuente === f.id ? "2px solid #0284C7" : "1px solid #CBD5E1",
                      background: fuente === f.id ? "#F0F9FF" : "#FFFFFF",
                      color: fuente === f.id ? "#0369A1" : "#475569",
                      fontWeight: 700,
                      fontSize: "0.73rem",
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
                  style={{ flex: 1, minWidth: "80px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1E293B" }}>
                  {tamanoFuentePt}pt
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={incluirQr}
                    onChange={(e) => setIncluirQr(e.target.checked)}
                  />
                  <span>Imprimir QR en la tarjeta</span>
                </label>

                <button
                  type="button"
                  onClick={() => setMostrarCalibrador(!mostrarCalibrador)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#0369A1",
                    fontSize: "0.73rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                >
                  <Sliders size={12} />
                  <span>{mostrarCalibrador ? "Ocultar medidas" : "Medidas Canon G3110"}</span>
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
                    fontSize: "0.71rem",
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
                <div style={{ padding: "7px 10px", borderRadius: "7px", background: "#FEE2E2", color: "#991B1B", fontSize: "0.75rem", fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}
              {avisoOk && (
                <div style={{ padding: "7px 10px", borderRadius: "7px", background: "#DCFCE7", color: "#166534", fontSize: "0.75rem", fontWeight: 600 }}>
                  {avisoOk}
                </div>
              )}
            </div>
          </div>

          {/* PIE DE ACCIONES: GUARDAR, DESCARGAR PDF E IMPRIMIR */}
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
              title="Guardar cambios de dedicatoria, formato y música en el pedido"
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
                title="Descargar PDF con medidas exactas listo para imprimir en cualquier momento"
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
                title="Guardar y enviar directo a la impresora Canon G3110"
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
