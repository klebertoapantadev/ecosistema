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
  FileText,
  History,
  Loader2,
  Lock,
  MessageCircle,
  Palette,
  Printer,
  QrCode,
  Save,
  Share2,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import type {
  ClaveFuenteTarjeta,
  DisenoVisualTarjeta,
  ModoImpresionTarjeta,
  OrdenTrabajoTaller,
} from "../operaciones-taller";
import {
  buscarLyricsCancionAction,
  guardarEdicionPedidoYTarjetaAction,
  registrarImpresionTarjetaAction,
  subirAudioTarjetaAction,
} from "../acciones-operaciones-taller";
import {
  ajustarTextoParaDoblezDiptico,
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

function formatearFechaSegura(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const fecha = new Date(String(valor));
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [modoDigitalAvanzado, setModoDigitalAvanzado] = useState<boolean>(() => {
    if (formatoInicial === "CONDOLENCIAS_PLANA") return false;
    const dInit = orden?.tarjetaDiseno ?? orden?.tarjetaMetadata?.diseno;
    return Boolean(
      orden?.tarjetaMusicaUrl?.trim() ||
        orden?.tarjetaConfidencial ||
        orden?.tarjetaMetadata?.confidencial_solo_qr ||
        dInit?.modoImpresion === "SOLO_QR" ||
        dInit?.modoImpresion === "MENSAJE_Y_QR" ||
        dInit?.remitentePortada?.trim()
    );
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
  const [esMovil, setEsMovil] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [tabMovil, setTabMovil] = useState<"diseno" | "texto" | "ajustes">("diseno");
  const [alertaClienteAbierta, setAlertaClienteAbierta] = useState<boolean>(false);
  const inputAudioRef = useRef<HTMLInputElement | null>(null);
  const ultimoOrdenIdInicializadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const actualizar = () => setEsMovil(mql.matches);
    actualizar();
    mql.addEventListener("change", actualizar);
    return () => mql.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    if (!abierto || typeof window === "undefined") return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

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
    const disenoInitRaw = orden.tarjetaDiseno ?? orden.tarjetaMetadata?.diseno;
    const confidInit = esCondolInit
      ? false
      : Boolean(orden.tarjetaConfidencial ?? orden.tarjetaMetadata?.confidencial_solo_qr);
    setConfidencialSoloQr(confidInit);
    setDiseno(
      normalizarDisenoTarjeta(
        disenoInitRaw,
        esCondolInit,
        orden.dedicatoria || ""
      )
    );
    setMusicaUrlEditable(esCondolInit ? "" : orden.tarjetaMusicaUrl || "");
    setMusicaTituloEditable(esCondolInit ? "" : orden.tarjetaMusicaTitulo || "");
    setLyricsEditables(!esCondolInit && Array.isArray(orden.tarjetaLyrics) ? orden.tarjetaLyrics : []);
    setModoDigitalAvanzado(
      !esCondolInit &&
        Boolean(
          orden.tarjetaMusicaUrl?.trim() ||
            confidInit ||
            disenoInitRaw?.modoImpresion === "SOLO_QR" ||
            disenoInitRaw?.modoImpresion === "MENSAJE_Y_QR" ||
            disenoInitRaw?.remitentePortada?.trim()
        )
    );
    setTokenVistaActual(orden.tarjetaToken || orden.proformaId || orden.id);
    setTokenEdicionActual(orden.tarjetaTokenEdicion || "");
    setMetaLocal(orden.tarjetaMetadata || {});
    setAvisoOk(null);
    setErrorMsg(null);
    setTabMovil("diseno");
    setAlertaClienteAbierta(false);
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
        dark: "#221E1B",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch((err: unknown) => console.error("Error generando QR", err));
  }, [tokenVistaActual, tokenEdicionActual, orden]);

  if (!abierto || !orden) return null;

  const disenoNorm = normalizarDisenoTarjeta(diseno, esCondolencias, mensajeEditable);
  const modoImpresionEfectivo: ModoImpresionTarjeta =
    esCondolencias || !modoDigitalAvanzado
      ? "SOLO_MENSAJE"
      : confidencialSoloQr
        ? "SOLO_QR"
        : disenoNorm.modoImpresion === "MENSAJE_Y_QR"
          ? "MENSAJE_Y_QR"
          : "SOLO_MENSAJE";
  const soloQrEfectivo = modoImpresionEfectivo === "SOLO_QR";
  const incluirQrEnEsquina = !esCondolencias && modoImpresionEfectivo === "MENSAJE_Y_QR";

  const seleccionarModoImpresion = (nuevoModo: ModoImpresionTarjeta) => {
    setConfidencialSoloQr(nuevoModo === "SOLO_QR");
    setDiseno((prev) => ({
      ...normalizarDisenoTarjeta(prev, esCondolencias, mensajeEditable),
      modoImpresion: nuevoModo,
    }));
  };

  const cambiarNivelTarjeta = (avanzada: boolean) => {
    setModoDigitalAvanzado(avanzada);
    if (!avanzada) {
      setConfidencialSoloQr(false);
      setDiseno((prev) => ({
        ...normalizarDisenoTarjeta(prev, esCondolencias, mensajeEditable),
        modoImpresion: "SOLO_MENSAJE",
      }));
    } else if (modoImpresionEfectivo === "SOLO_MENSAJE") {
      seleccionarModoImpresion("MENSAJE_Y_QR");
    }
  };

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
      setModoDigitalAvanzado(false);
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

    const usaDigital = !esCondolencias && modoDigitalAvanzado;
    let lyricsAGuardar = usaDigital ? lyricsEditables : [];
    let tituloAGuardar = usaDigital ? musicaTituloEditable.trim() || null : null;

    if (
      usaDigital &&
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
      tarjetaDiseno: { ...disenoNorm, modoImpresion: modoImpresionEfectivo },
      tarjetaMusicaUrl: usaDigital ? musicaUrlEditable.trim() || null : null,
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
            const rawMsg =
              mensajeEditable.trim() ||
              (esCondolencias
                ? "Expresamos nuestras mas sentidas condolencias."
                : "Con todo nuestro carino.");
            textoRaw = ajustarTextoParaDoblezDiptico(
              rawMsg,
              esCondolencias,
              blk.yPct,
              blk.tamanoPt || 18,
              blk.anchoPct || 84
            );
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

        // Si es modo Mensaje + QR digital, estampar QR compacto en esquina inferior derecha
        if (incluirQrEnEsquina && qrDataUrl) {
          const base64Qr = qrDataUrl.split(",")[1];
          if (base64Qr) {
            const qrBytes = Uint8Array.from(atob(base64Qr), (c) => c.charCodeAt(0));
            const qrImg = await pdfDoc.embedPng(qrBytes);
            const qrDim = 16 * MM_TO_PT;
            const margenPt = 4 * MM_TO_PT;
            const qrX = pageW - qrDim - margenPt + offsetX * MM_TO_PT;
            const qrY = margenPt - offsetY * MM_TO_PT;
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
              const contenidoBase =
                blk.rol === "mensaje"
                  ? mensajeEditable ||
                    (esCondolencias
                      ? "Expresamos nuestras más sentidas condolencias."
                      : "Con todo mi cariño")
                  : blk.rol === "firma"
                    ? deEditable.trim()
                    : (blk.texto || "").trim();
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
                    color: blk.colorHex || "#221E1B",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    zIndex: 5,
                  }}
                >
                  {contenido}
                </div>
              );
            })}

            {incluirQrEnEsquina && qrDataUrl && (
              <div
                style={{
                  position: "absolute",
                  right: "4mm",
                  bottom: "4mm",
                  backgroundColor: "#FFFFFF",
                  padding: "1mm",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 7,
                }}
              >
                <img
                  src={qrDataUrl}
                  alt="QR Tarjeta Digital"
                  style={{ width: "16mm", height: "16mm", display: "block" }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL INTERACTIVO */}
      <style>{`
        .eco-modal-tarjeta-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(24, 21, 18, 0.62);
          backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px;
          font-family: system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
        }
        .eco-modal-tarjeta-panel {
          background-color: #FFFFFF;
          border-radius: 16px;
          width: 100%;
          max-width: 1040px;
          max-height: 94dvh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(24, 21, 18, 0.28);
          overflow: hidden;
          border: 1px solid #E6E2DA;
        }
        .eco-modal-tarjeta-cuerpo {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr));
          gap: 18px;
          padding: 16px 20px;
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
          min-height: 0;
        }
        .eco-modal-tarjeta-tabs-movil {
          display: none;
        }
        .eco-modal-tarjeta-footer {
          padding: 12px 20px;
          border-top: 1px solid #E6E2DA;
          background: #F8F7F4;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .eco-modal-tarjeta-footer-der {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .eco-modal-tarjeta-calibracion {
          background: #F8F7F4;
          padding: 9px 11px;
          border-radius: 8px;
          border: 1px solid #E6E2DA;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 767px) {
          .eco-modal-tarjeta-backdrop {
            padding: 0;
            align-items: flex-end;
          }
          .eco-modal-tarjeta-panel {
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            border: none;
          }
          .eco-modal-tarjeta-ocultar-movil {
            display: none !important;
          }
          .eco-modal-tarjeta-tabs-movil {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            padding: 7px 12px;
            background: #F8F7F4;
            border-bottom: 1px solid #E6E2DA;
            flex-shrink: 0;
          }
          .eco-modal-tarjeta-cuerpo {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 10px 12px 14px;
          }
          .eco-modal-tarjeta-footer {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
          }
          .eco-modal-tarjeta-footer-der {
            display: contents;
          }
          .eco-modal-tarjeta-footer-btn {
            width: 100% !important;
            min-height: 44px !important;
            padding: 0 !important;
            justify-content: center !important;
          }
          .eco-modal-tarjeta-txt-btn {
            display: none !important;
          }
          .eco-modal-tarjeta-btn-ico-movil {
            min-width: 36px !important;
            min-height: 36px !important;
            padding: 0 8px !important;
            justify-content: center !important;
          }
          .eco-modal-tarjeta-calibracion {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="eco-modal-tarjeta-backdrop" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${esCondolencias ? "Tarjeta de Condolencias" : "Tarjeta de Dedicatoria"} ${orden.codigo}`}
          className="eco-modal-tarjeta-panel"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ENCABEZADO */}
          <div
            style={{
              padding: esMovil ? "8px 12px" : "13px 20px",
              borderBottom: "1px solid #E6E2DA",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8F7F4",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: esMovil ? "nowrap" : "wrap" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "7px",
                    background: esCondolencias ? "#EFECE6" : "#F2F6F3",
                    color: esCondolencias ? "#3A3530" : "#2F4737",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {soloQrEfectivo ? <QrCode size={14} /> : <FileText size={14} />}
                </span>
                <h2
                  style={{
                    fontSize: esMovil ? "0.9rem" : "1.03rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    margin: 0,
                    whiteSpace: esMovil ? "nowrap" : "normal",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {esMovil
                    ? orden.codigo
                    : `${esCondolencias ? "Tarjeta de Condolencias" : "Tarjeta de Dedicatoria"} — ${orden.codigo}`}
                </h2>
                <span
                  className="eco-modal-tarjeta-ocultar-movil"
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: esCondolencias ? "#F4F2EE" : "#F2F6F3",
                    color: esCondolencias ? "#3A3530" : "#2B4A36",
                  }}
                >
                  {esCondolencias ? "Horizontal 16,8 × 11,3 cm" : "Vertical 11,3 × 16,8 cm"}
                </span>
              </div>
              <p
                className="eco-modal-tarjeta-ocultar-movil"
                style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#847D74" }}
              >
                {esCondolencias
                  ? "Diseñador visual para impresión en cartulina horizontal (sin QR ni música)."
                  : "Elige imprimir el mensaje (+ imagen opcional) o únicamente el QR para la tarjeta digital."}
              </p>
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              {/* En móvil: indicador compacto solo ícono si el cliente editó la tarjeta (toca para ver detalle) */}
              {esMovil && fueEditadaPorCliente && (
                <button
                  type="button"
                  onClick={() => setAlertaClienteAbierta((v) => !v)}
                  title={(() => {
                    const f = formatearFechaSegura(metaLocal?.ultima_edicion_cliente_en);
                    return `Editada por el cliente${f ? ` (${f})` : ""}. Toca para ver aviso.`;
                  })()}
                  aria-label="Aviso: tarjeta modificada por el cliente"
                  aria-expanded={alertaClienteAbierta}
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "8px",
                    border: "1px solid #C8A56A",
                    background: alertaClienteAbierta ? "#F4E8D1" : "#FAF6EE",
                    color: "#8F6A2E",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <AlertTriangle size={16} />
                </button>
              )}

              <button
                type="button"
                onClick={onCerrar}
                title="Cerrar ventana"
                aria-label="Cerrar"
                style={{
                  border: "1px solid #E6E2DA",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  color: "#57524C",
                  width: esMovil ? "34px" : "32px",
                  height: esMovil ? "34px" : "32px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* ALERTA SI EL CLIENTE MODIFICÓ LA TARJETA (siempre visible en desktop; colapsable por ícono en móvil) */}
          {fueEditadaPorCliente && (!esMovil || alertaClienteAbierta) && (
            <div
              style={{
                padding: esMovil ? "7px 12px" : "9px 20px",
                background: "#FAF6EE",
                borderBottom: "1px solid #D9C39A",
                color: "#745622",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: esMovil ? "0.73rem" : "0.77rem",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0, color: "#8F6A2E" }} />
              <div style={{ lineHeight: 1.35 }}>
                <strong>Editada por el cliente</strong>
                {(() => {
                  const f = formatearFechaSegura(metaLocal?.ultima_edicion_cliente_en);
                  return f ? ` (${f})` : "";
                })()}
                {esMovil
                  ? ": revisa antes de imprimir."
                  : ": revisa el diseño final antes de imprimir y evita realizar cambios sin confirmar con el cliente."}
              </div>
            </div>
          )}

          {/* BARRA DE PESTAÑAS SOLO ÍCONOS EN MÓVIL (Diseño | Texto | Ajustes y Enlaces) */}
          <div className="eco-modal-tarjeta-tabs-movil" role="tablist" aria-label="Secciones del editor de tarjeta">
            {(
              [
                { id: "diseno", icon: Palette, label: "Diseño visual de tarjeta" },
                { id: "texto", icon: FileText, label: "Texto, destinatario y música" },
                { id: "ajustes", icon: SlidersHorizontal, label: "Formato, enlaces y calibración" },
              ] as const
            ).map(({ id, icon: Icon, label }) => {
              const activa = tabMovil === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  title={label}
                  aria-label={label}
                  onClick={() => setTabMovil(id)}
                  style={{
                    minHeight: "38px",
                    borderRadius: "9px",
                    border: activa ? "1.5px solid #221E1B" : "1px solid #E6E2DA",
                    background: activa ? "#221E1B" : "#FFFFFF",
                    color: activa ? "#FFFFFF" : "#57524C",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  <Icon size={17} />
                  {id === "texto" && !mensajeEditable.trim() && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: "7px",
                        right: "calc(50% - 14px)",
                        width: "6px",
                        height: "6px",
                        borderRadius: "999px",
                        background: activa ? "#FAF6EE" : "#8F6A2E",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* CUERPO: 2 COLUMNAS EN DESKTOP / VISTA POR PESTAÑA LIMPIA EN MÓVIL */}
          <div className="eco-modal-tarjeta-cuerpo">
            {/* COLUMNA IZQUIERDA (Desktop: todo | Móvil: Lienzo en tab "diseno", Trazabilidad+Enlaces en tab "ajustes") */}
            {(!esMovil || tabMovil === "diseno" || tabMovil === "ajustes") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "11px", minWidth: 0 }}>
                {(!esMovil || tabMovil === "diseno") && (
                  <>
                    <div
                      className="eco-modal-tarjeta-ocultar-movil"
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}
                    >
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#57524C" }}>
                        Diseñador de tarjeta ({anchoMm} × {altoMm} mm)
                      </span>
                      <span
                        style={{
                          fontSize: "0.69rem",
                          color: soloQrEfectivo ? "#3A3530" : "#2B4A36",
                          background: soloQrEfectivo ? "#EFECE6" : "#F2F6F3",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontWeight: 700,
                        }}
                      >
                        {soloQrEfectivo
                          ? "Solo QR (Sin texto)"
                          : incluirQrEnEsquina
                            ? "Mensaje + QR Digital"
                            : "Mensaje Impreso (Sin QR)"}
                      </span>
                    </div>

                    <LienzoDisenadorTarjeta
                      negocio={negNorm}
                      esCondolencias={esCondolencias}
                      soloQr={soloQrEfectivo}
                      incluirQrEnEsquina={incluirQrEnEsquina}
                      mensaje={mensajeEditable}
                      firma={deEditable}
                      onCambiarMensaje={setMensajeEditable}
                      onCambiarFirma={setDeEditable}
                      diseno={disenoNorm}
                      onCambiarDiseno={setDiseno}
                      qrDataUrl={qrDataUrl}
                      anchoMm={anchoMm}
                      altoMm={altoMm}
                      onError={(msg) => setErrorMsg(msg)}
                    />
                  </>
                )}

                {(!esMovil || tabMovil === "ajustes") && (
                  <>
                    {/* TRAZABILIDAD */}
                    <div
                      style={{
                        background: "#F8F7F4",
                        border: "1px solid #E6E2DA",
                        borderRadius: "10px",
                        padding: "9px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        fontSize: "0.74rem",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ color: "#57524C" }}>Estado y trazabilidad</strong>
                        <button
                          type="button"
                          onClick={() => setMostrarHistorial(!mostrarHistorial)}
                          title={mostrarHistorial ? "Ocultar historial" : `Ver historial (${historial.length})`}
                          aria-label={mostrarHistorial ? "Ocultar historial" : `Historial (${historial.length})`}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#221E1B",
                            cursor: "pointer",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <History size={13} />
                          <span>{mostrarHistorial ? "Ocultar" : `(${historial.length})`}</span>
                        </button>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        <span
                          style={{
                            background: fueEditadaPorCliente
                              ? "#F2F6F3"
                              : fueEditadaPorStaff
                                ? "#EFECE6"
                                : "#F4F2EE",
                            color: fueEditadaPorCliente
                              ? "#2B4A36"
                              : fueEditadaPorStaff
                                ? "#3A3530"
                                : "#57524C",
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          {fueEditadaPorCliente
                            ? "Editada cliente"
                            : fueEditadaPorStaff
                              ? `Editada (${metaLocal?.ultimo_editor_nombre || "Staff"})`
                              : "Automática"}
                        </span>
                        {!esCondolencias && (
                          <span
                            style={{
                              background: vistasCliente > 0 ? "#EFECE6" : "#F4F2EE",
                              color: vistasCliente > 0 ? "#3A3530" : "#57524C",
                              padding: "2px 7px",
                              borderRadius: "6px",
                              fontWeight: 600,
                            }}
                          >
                            {vistasCliente > 0 ? `Vista ${vistasCliente}x` : "Sin abrir"}
                          </span>
                        )}
                        <span
                          style={{
                            background: conteoImpresiones > 0 ? "#FAF6EE" : "#F4F2EE",
                            color: conteoImpresiones > 0 ? "#745622" : "#57524C",
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
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
                            borderTop: "1px dashed #D5CFC4",
                            maxHeight: "88px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                          }}
                        >
                          {historial.length === 0 ? (
                            <span style={{ color: "#847D74" }}>Sin ediciones posteriores.</span>
                          ) : (
                            historial.map((h: any, i: number) => {
                              const fechaFmt = formatearFechaSegura(h.fecha);
                              return (
                                <div key={i} style={{ fontSize: "0.7rem", color: "#57524C" }}>
                                  • <strong>{h.autor || "Usuario"}</strong> ({h.rol || "STAFF"})
                                  {fechaFmt ? (
                                    <span style={{ color: "#847D74" }}> · {fechaFmt}</span>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    {/* ENLACES: EDICIÓN SIEMPRE DISPONIBLE (SIN LOGIN); VISTA DIGITAL QR SOLO EN DEDICATORIA */}
                    <div
                      style={{
                        background: "#F8F7F4",
                        border: "1px solid #E6E2DA",
                        borderRadius: "10px",
                        padding: "9px 11px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        minWidth: 0,
                      }}
                    >
                      {urlEdicionTarjeta && (
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#2F4737",
                              marginBottom: "4px",
                            }}
                          >
                            {esMovil
                              ? "Enlace edición (cliente)"
                              : "Enlace para Editar Tarjeta (Cliente / Diseñador — sin login):"}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <input
                              type="text"
                              readOnly
                              value={urlEdicionTarjeta}
                              aria-label="Enlace para editar tarjeta"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: "6px 8px",
                                fontSize: "0.72rem",
                                color: "#57524C",
                                background: "#FFFFFF",
                                border: "1px solid #D5CFC4",
                                borderRadius: "7px",
                              }}
                            />
                            <button
                              type="button"
                              className="eco-modal-tarjeta-btn-ico-movil"
                              onClick={() => handleCopiar(urlEdicionTarjeta, "edicion")}
                              title="Copiar enlace de edición para el comprador"
                              aria-label="Copiar enlace de edición"
                              style={{
                                padding: "6px 10px",
                                background: "#2F4737",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                            >
                              {copiadoEdicion ? <Check size={14} /> : <Copy size={14} />}
                              <span className="eco-modal-tarjeta-txt-btn">
                                {copiadoEdicion ? "Copiado" : "Copiar"}
                              </span>
                            </button>
                            {orden.clienteTelefono && (
                              <a
                                className="eco-modal-tarjeta-btn-ico-movil"
                                href={`https://wa.me/${orden.clienteTelefono.replace(/\D+/g, "")}?text=${encodeURIComponent(
                                  `Hola ${deEditable || orden.clienteSolicita} 🌸, aquí puedes revisar o diseñar el mensaje de tu tarjeta del pedido ${orden.codigo} antes de impresión: ${urlEdicionTarjeta}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Enviar enlace de edición por WhatsApp al comprador"
                                aria-label="Enviar enlace por WhatsApp"
                                style={{
                                  padding: "6px 9px",
                                  background: "#2F4737",
                                  color: "#FFFFFF",
                                  borderRadius: "7px",
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  flexShrink: 0,
                                }}
                              >
                                <MessageCircle size={14} />
                                <span className="eco-modal-tarjeta-txt-btn">WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {!esCondolencias && modoDigitalAvanzado && urlSoloVistaDigital && (
                        <div style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#3A3530",
                              marginBottom: "4px",
                            }}
                          >
                            {esMovil
                              ? "Tarjeta digital (QR)"
                              : "Tarjeta Digital Solo Lectura (URL del QR — sin login):"}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                            <input
                              type="text"
                              readOnly
                              value={urlSoloVistaDigital}
                              aria-label="URL de tarjeta digital"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: "6px 8px",
                                fontSize: "0.72rem",
                                color: "#57524C",
                                background: "#FFFFFF",
                                border: "1px solid #D5CFC4",
                                borderRadius: "7px",
                              }}
                            />
                            <button
                              type="button"
                              className="eco-modal-tarjeta-btn-ico-movil"
                              onClick={() => handleCopiar(urlSoloVistaDigital, "vista")}
                              title="Copiar enlace de visualización de la tarjeta digital"
                              aria-label="Copiar enlace digital"
                              style={{
                                padding: "6px 10px",
                                background: copiadoVista ? "#2F4737" : "#221E1B",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                            >
                              {copiadoVista ? <Check size={14} /> : <Copy size={14} />}
                              <span className="eco-modal-tarjeta-txt-btn">
                                {copiadoVista ? "Copiado" : "Copiar"}
                              </span>
                            </button>
                            <a
                              className="eco-modal-tarjeta-btn-ico-movil"
                              href={urlSoloVistaDigital}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir vista digital de solo lectura"
                              aria-label="Abrir tarjeta digital"
                              style={{
                                padding: "6px 9px",
                                background: "#FFFFFF",
                                border: "1px solid #D5CFC4",
                                color: "#1F1C19",
                                borderRadius: "7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                flexShrink: 0,
                              }}
                            >
                              <ExternalLink size={14} />
                              <span className="eco-modal-tarjeta-txt-btn">Ver</span>
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* COLUMNA DERECHA (Desktop: todo | Móvil: Texto+Música en tab "texto", Formato+Modo+Calibración en tab "ajustes") */}
            {(!esMovil || tabMovil === "texto" || tabMovil === "ajustes") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
                {(!esMovil || tabMovil === "ajustes") && (
                  <>
                    {/* 1. TIPO DE TARJETA Y ORIENTACIÓN */}
                    <div>
                      <label
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          color: "#57524C",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        {esMovil ? "Formato físico" : "Tipo de pedido y orientación física:"}
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => cambiarFormatoTarjeta("DIPTICO")}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: !esCondolencias ? "2px solid #221E1B" : "1px solid #D5CFC4",
                            background: !esCondolencias ? "#F4F2EE" : "#FFFFFF",
                            color: !esCondolencias ? "#1F1C19" : "#57524C",
                            fontWeight: 700,
                            fontSize: "0.77rem",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          Dedicatoria (Vertical)
                          <span
                            className="eco-modal-tarjeta-ocultar-movil"
                            style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#847D74" }}
                          >
                            11,3 × 16,8 cm · Se dobla
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => cambiarFormatoTarjeta("CONDOLENCIAS_PLANA")}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: esCondolencias ? "2px solid #221E1B" : "1px solid #D5CFC4",
                            background: esCondolencias ? "#F4F2EE" : "#FFFFFF",
                            color: esCondolencias ? "#1F1C19" : "#57524C",
                            fontWeight: 700,
                            fontSize: "0.77rem",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          Condolencias (Horiz.)
                          <span
                            className="eco-modal-tarjeta-ocultar-movil"
                            style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#847D74" }}
                          >
                            16,8 × 11,3 cm · Sin QR ni música
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 1B. MODALIDAD DE TARJETA: BÁSICA (IMPRESA INTERIOR) VS AVANZADA (DIGITAL + AUDIO) */}
                    {!esCondolencias && (
                      <div>
                        <label
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "#57524C",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          Tipo de experiencia
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => cambiarNivelTarjeta(false)}
                            title="Tarjeta simple impresa solo en el interior (sin audio ni QR)"
                            aria-label="Tarjeta básica impresa"
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: !modoDigitalAvanzado ? "2px solid #2F4737" : "1px solid #D5CFC4",
                              background: !modoDigitalAvanzado ? "#F2F6F3" : "#FFFFFF",
                              color: !modoDigitalAvanzado ? "#2F4737" : "#57524C",
                              fontWeight: 700,
                              fontSize: "0.76rem",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            Básica (Impresa)
                            <span
                              className="eco-modal-tarjeta-ocultar-movil"
                              style={{ display: "block", fontSize: "0.64rem", fontWeight: 400, color: "#847D74" }}
                            >
                              Solo interior · Sin audio
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => cambiarNivelTarjeta(true)}
                            title="Habilitar tarjeta digital interactiva con audio, portada y QR"
                            aria-label="Tarjeta avanzada digital"
                            style={{
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: modoDigitalAvanzado ? "2px solid #221E1B" : "1px solid #D5CFC4",
                              background: modoDigitalAvanzado ? "#F4F2EE" : "#FFFFFF",
                              color: modoDigitalAvanzado ? "#1F1C19" : "#57524C",
                              fontWeight: 700,
                              fontSize: "0.76rem",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            Avanzada (Digital)
                            <span
                              className="eco-modal-tarjeta-ocultar-movil"
                              style={{ display: "block", fontSize: "0.64rem", fontWeight: 400, color: "#847D74" }}
                            >
                              Con audio, portada y QR
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. MODO DE IMPRESIÓN (SOLO EN AVANZADA DIGITAL: MENSAJE, SOLO QR O AMBOS) */}
                    {!esCondolencias && modoDigitalAvanzado && (
                      <div>
                        <label
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "#57524C",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          {esMovil ? "Modo de impresión" : "¿Qué se imprime en la cartulina?"}
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => seleccionarModoImpresion("SOLO_MENSAJE")}
                            title="Imprimir solo mensaje y diseño"
                            aria-label="Imprimir solo mensaje"
                            style={{
                              padding: "8px 8px",
                              borderRadius: "8px",
                              border: modoImpresionEfectivo === "SOLO_MENSAJE" ? "2px solid #2F4737" : "1px solid #D5CFC4",
                              background: modoImpresionEfectivo === "SOLO_MENSAJE" ? "#F2F6F3" : "#FFFFFF",
                              color: modoImpresionEfectivo === "SOLO_MENSAJE" ? "#2F4737" : "#57524C",
                              fontWeight: 700,
                              fontSize: "0.73rem",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            Solo Mensaje
                            <span
                              className="eco-modal-tarjeta-ocultar-movil"
                              style={{ display: "block", fontSize: "0.62rem", fontWeight: 400, color: "#847D74" }}
                            >
                              Sin código QR
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => seleccionarModoImpresion("SOLO_QR")}
                            title="Imprimir solo código QR confidencial"
                            aria-label="Imprimir solo QR"
                            style={{
                              padding: "8px 8px",
                              borderRadius: "8px",
                              border: modoImpresionEfectivo === "SOLO_QR" ? "2px solid #221E1B" : "1px solid #D5CFC4",
                              background: modoImpresionEfectivo === "SOLO_QR" ? "#F4F2EE" : "#FFFFFF",
                              color: modoImpresionEfectivo === "SOLO_QR" ? "#1F1C19" : "#57524C",
                              fontWeight: 700,
                              fontSize: "0.73rem",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <Lock size={11} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                            Solo QR
                            <span
                              className="eco-modal-tarjeta-ocultar-movil"
                              style={{ display: "block", fontSize: "0.62rem", fontWeight: 400, color: "#847D74" }}
                            >
                              Confidencial web
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => seleccionarModoImpresion("MENSAJE_Y_QR")}
                            title="Imprimir mensaje y añadir QR discreto para tarjeta digital"
                            aria-label="Imprimir mensaje y QR"
                            style={{
                              padding: "8px 8px",
                              borderRadius: "8px",
                              border: modoImpresionEfectivo === "MENSAJE_Y_QR" ? "2px solid #2F4737" : "1px solid #D5CFC4",
                              background: modoImpresionEfectivo === "MENSAJE_Y_QR" ? "#F2F6F3" : "#FFFFFF",
                              color: modoImpresionEfectivo === "MENSAJE_Y_QR" ? "#2F4737" : "#57524C",
                              fontWeight: 700,
                              fontSize: "0.73rem",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            Mensaje + QR
                            <span
                              className="eco-modal-tarjeta-ocultar-movil"
                              style={{ display: "block", fontSize: "0.62rem", fontWeight: 400, color: "#847D74" }}
                            >
                              Impreso y digital
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {(!esMovil || tabMovil === "texto") && (
                  <>
                    {/* 3. PARA (solo Condolencias o Avanzada Digital) Y FIRMA INTERIOR ("De parte de") */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: esCondolencias || modoDigitalAvanzado ? "1fr 1fr" : "1fr",
                        gap: "8px",
                      }}
                    >
                      {(esCondolencias || modoDigitalAvanzado) && (
                        <div>
                          <label
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              color: "#57524C",
                              display: "block",
                              marginBottom: "3px",
                            }}
                          >
                            {esCondolencias ? "En memoria" : "Para (Portada digital)"}
                          </label>
                          <input
                            type="text"
                            value={paraEditable}
                            onChange={(e) => setParaEditable(e.target.value)}
                            placeholder="Quien recibe"
                            style={{
                              width: "100%",
                              padding: esMovil ? "8px 10px" : "6px 8px",
                              borderRadius: "7px",
                              border: "1px solid #D5CFC4",
                              fontSize: esMovil ? "16px" : "0.79rem",
                              color: "#1F1C19",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      )}
                      <div>
                        <label
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "#57524C",
                            display: "block",
                            marginBottom: "3px",
                          }}
                        >
                          De parte de (Firma interior)
                        </label>
                        <input
                          type="text"
                          value={deEditable}
                          onChange={(e) => setDeEditable(e.target.value)}
                          placeholder="Ej: Att: Kleber"
                          style={{
                            width: "100%",
                            padding: esMovil ? "8px 10px" : "6px 8px",
                            borderRadius: "7px",
                            border: "1px solid #D5CFC4",
                            fontSize: esMovil ? "16px" : "0.79rem",
                            color: "#1F1C19",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>

                    {!esCondolencias && modoDigitalAvanzado && (
                      <div>
                        <label
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "#57524C",
                            display: "block",
                            marginBottom: "3px",
                          }}
                        >
                          Remitente portada (opcional)
                        </label>
                        <input
                          type="text"
                          value={disenoNorm.remitentePortada}
                          onChange={(e) =>
                            setDiseno({
                              ...disenoNorm,
                              remitentePortada: e.target.value,
                            })
                          }
                          placeholder="Ej: El amor de tu vida"
                          style={{
                            width: "100%",
                            padding: esMovil ? "8px 10px" : "6px 8px",
                            borderRadius: "7px",
                            border: "1px solid #D5CFC4",
                            fontSize: esMovil ? "16px" : "0.79rem",
                            color: "#1F1C19",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    )}

                    {/* 4. MENSAJE */}
                    <div>
                      <label
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          color: "#1F1C19",
                          display: "block",
                          marginBottom: "3px",
                        }}
                      >
                        Mensaje de la tarjeta
                      </label>
                      <textarea
                        rows={esMovil ? 5 : 4}
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
                          border: "1px solid #847D74",
                          fontSize: esMovil ? "16px" : "0.83rem",
                          lineHeight: 1.4,
                          color: "#1F1C19",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* 5. MÚSICA Y LYRIC: EXCLUSIVO PARA DEDICATORIA AVANZADA (DIGITAL) */}
                    {!esCondolencias && modoDigitalAvanzado && (
                      <div
                        style={{
                          background: "#F8F7F4",
                          border: "1px solid #E6E2DA",
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
                          }}
                        >
                          <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#57524C" }}>
                            {esMovil ? "Canción (YouTube / MP3)" : "Canción de fondo (YouTube o MP3 — para tarjeta digital):"}
                          </span>
                          <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                            <button
                              type="button"
                              className="eco-modal-tarjeta-btn-ico-movil"
                              disabled={subiendoMp3}
                              onClick={() => inputAudioRef.current?.click()}
                              title="Subir archivo MP3"
                              aria-label="Subir MP3"
                              style={{
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#1F1C19",
                                padding: "4px 8px",
                                borderRadius: "7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              {subiendoMp3 ? <Loader2 size={13} className="eco-spin" /> : <Upload size={13} />}
                              <span className="eco-modal-tarjeta-txt-btn">
                                {subiendoMp3 ? "Subiendo..." : "Subir MP3"}
                              </span>
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
                              className="eco-modal-tarjeta-btn-ico-movil"
                              disabled={buscandoLyrics}
                              onClick={() => void handleBuscarLetra()}
                              title="Generar letra sincronizada"
                              aria-label="Cargar letra"
                              style={{
                                border: "1px solid #DDD8CE",
                                background: "#EFECE6",
                                color: "#3A3530",
                                padding: "4px 8px",
                                borderRadius: "7px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              {buscandoLyrics ? <Loader2 size={13} className="eco-spin" /> : <Sparkles size={13} />}
                              <span className="eco-modal-tarjeta-txt-btn">
                                {buscandoLyrics ? "Buscando..." : "Cargar Letra"}
                              </span>
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
                            padding: esMovil ? "8px 10px" : "6px 8px",
                            borderRadius: "7px",
                            border: "1px solid #D5CFC4",
                            fontSize: esMovil ? "15px" : "0.76rem",
                            background: "#FFFFFF",
                            color: "#1F1C19",
                            boxSizing: "border-box",
                          }}
                        />
                        <input
                          type="text"
                          value={musicaTituloEditable}
                          onChange={(e) => setMusicaTituloEditable(e.target.value)}
                          placeholder="Artista - Canción"
                          style={{
                            width: "100%",
                            padding: esMovil ? "8px 10px" : "6px 8px",
                            borderRadius: "7px",
                            border: "1px solid #D5CFC4",
                            fontSize: esMovil ? "15px" : "0.76rem",
                            background: "#FFFFFF",
                            color: "#1F1C19",
                            boxSizing: "border-box",
                          }}
                        />
                        {lyricsEditables.length > 0 && (
                          <span style={{ fontSize: "0.69rem", color: "#2F4737", fontWeight: 600 }}>
                            ✓ {lyricsEditables.length} líneas de letra listas.
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* CALIBRACIÓN FINA DE IMPRESORA CANON G3110 */}
                {(!esMovil || tabMovil === "ajustes") && (
                  <>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setMostrarCalibrador(!mostrarCalibrador)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#3A3530",
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
                      <div className="eco-modal-tarjeta-calibracion">
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "#57524C", display: "block" }}>
                            Ancho (mm)
                          </label>
                          <input
                            type="number"
                            value={anchoMm}
                            onChange={(e) => setAnchoMm(Number(e.target.value))}
                            style={{
                              width: "100%",
                              padding: "5px 6px",
                              borderRadius: "6px",
                              border: "1px solid #D5CFC4",
                              fontSize: "0.78rem",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "#57524C", display: "block" }}>
                            Alto (mm)
                          </label>
                          <input
                            type="number"
                            value={altoMm}
                            onChange={(e) => setAltoMm(Number(e.target.value))}
                            style={{
                              width: "100%",
                              padding: "5px 6px",
                              borderRadius: "6px",
                              border: "1px solid #D5CFC4",
                              fontSize: "0.78rem",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "#57524C", display: "block" }}>
                            Desfase X (mm)
                          </label>
                          <input
                            type="number"
                            value={offsetX}
                            onChange={(e) => setOffsetX(Number(e.target.value))}
                            style={{
                              width: "100%",
                              padding: "5px 6px",
                              borderRadius: "6px",
                              border: "1px solid #D5CFC4",
                              fontSize: "0.78rem",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.68rem", color: "#57524C", display: "block" }}>
                            Desfase Y (mm)
                          </label>
                          <input
                            type="number"
                            value={offsetY}
                            onChange={(e) => setOffsetY(Number(e.target.value))}
                            style={{
                              width: "100%",
                              padding: "5px 6px",
                              borderRadius: "6px",
                              border: "1px solid #D5CFC4",
                              fontSize: "0.78rem",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* MENSAJES DE ESTADO GLOBALES (siempre visibles desde cualquier pestaña móvil o desktop) */}
          {(errorMsg || avisoOk) && (
            <div
              role="status"
              style={{
                padding: "7px 14px",
                borderTop: "1px solid #E6E2DA",
                background: errorMsg ? "#FAF2F2" : "#F2F6F3",
                color: errorMsg ? "#8A2E2E" : "#2B4A36",
                fontSize: "0.75rem",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {errorMsg || avisoOk}
            </div>
          )}

          {/* PIE DE ACCIONES (Desktop: con etiquetas concisas | Móvil: 1 sola fila de 4 botones solo ícono) */}
          <div className="eco-modal-tarjeta-footer">
            <button
              type="button"
              className="eco-modal-tarjeta-footer-btn"
              disabled={guardando}
              onClick={() => void persistirCambiosTarjeta(false)}
              title="Guardar cambios y diseño de la tarjeta"
              aria-label="Guardar tarjeta"
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: "1px solid #2F4737",
                background: "#F2F6F3",
                color: "#2F4737",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {guardando ? <Loader2 size={17} className="eco-spin" /> : <Save size={17} />}
              <span className="eco-modal-tarjeta-txt-btn">{guardando ? "Guardando..." : "Guardar"}</span>
            </button>

            <div className="eco-modal-tarjeta-footer-der">
              <button
                type="button"
                className="eco-modal-tarjeta-footer-btn"
                disabled={compartiendoDiseno}
                onClick={() => void handleCompartirDiseno()}
                title="Guardar y compartir imagen PNG del diseño final (WhatsApp / Descarga)"
                aria-label="Compartir diseño"
                style={{
                  padding: "9px 13px",
                  borderRadius: "8px",
                  border: "1px solid #2F4737",
                  background: "#F2F6F3",
                  color: "#2F4737",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {compartiendoDiseno ? <Loader2 size={17} className="eco-spin" /> : <Share2 size={17} />}
                <span className="eco-modal-tarjeta-txt-btn">
                  {compartiendoDiseno ? "Preparando..." : "Compartir"}
                </span>
              </button>

              <button
                type="button"
                className="eco-modal-tarjeta-footer-btn"
                disabled={descargandoPdf}
                onClick={() => void handleDescargarPdf()}
                title="Descargar tarjeta en PDF calibrada a medida exacta"
                aria-label="Descargar PDF"
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#1F1C19",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {descargandoPdf ? <Loader2 size={17} className="eco-spin" /> : <Download size={17} />}
                <span className="eco-modal-tarjeta-txt-btn">
                  {descargandoPdf ? "Generando..." : "Descargar PDF"}
                </span>
              </button>

              <button
                type="button"
                className="eco-modal-tarjeta-footer-btn"
                disabled={imprimiendo}
                onClick={() => void handleLanzarImpresion()}
                title="Mandar a imprimir directamente en Canon PIXMA G3110"
                aria-label="Imprimir tarjeta"
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#221E1B",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 10px rgba(34, 30, 27, 0.18)",
                }}
              >
                {imprimiendo ? <Loader2 size={17} className="eco-spin" /> : <Printer size={17} />}
                <span className="eco-modal-tarjeta-txt-btn">
                  {imprimiendo ? "Preparando..." : "Imprimir"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
