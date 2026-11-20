"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  AlignLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Info,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Music,
  Palette,
  Pencil,
  PenTool,
  QrCode,
  Save,
  Sparkles,
  Trash2,
  Upload,
  User,
  VolumeX,
  Wand2,
} from "lucide-react";
import type { DisenoVisualTarjeta, ModoImpresionTarjeta } from "../operaciones-taller";
import {
  asistirMensajeTarjetaIaAction,
  buscarLyricsCancionAction,
  editarTarjetaClienteAction,
  subirAudioTarjetaAction,
  type OpcionMensajeTarjetaIa,
} from "../acciones-operaciones-taller";
import {
  esMensajeCortoParaMitadInferior,
  LienzoDisenadorTarjeta,
  normalizarDisenoTarjeta,
} from "./LienzoDisenadorTarjeta";
import { TarjetaDedicatoriaDigitalInteractiva } from "./TarjetaDedicatoriaDigitalInteractiva";

export interface PropsEditorTarjetaPublicoCliente {
  datosIniciales: {
    ordenId: string;
    codigo: string;
    negocio: string;
    tokenVista: string;
    destinatario: string;
    remitente: string;
    dedicatoria: string;
    tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
    confidencial: boolean;
    diseno?: DisenoVisualTarjeta;
    musicaUrl?: string | null;
    musicaTitulo?: string | null;
    lyrics?: Array<{ tiempo?: number; texto: string }>;
    fechaEntrega?: string;
    bloqueadoEdicion: boolean;
  };
  tokenEdicion: string;
}

type PasoId =
  | "para"
  | "mensaje"
  | "firma"
  | "diseno"
  | "audio"
  | "letra"
  | "visualizar"
  | "imprimir";

interface DefinicionPaso {
  id: PasoId;
  etiqueta: string;
  opcional?: boolean;
}

const OCASIONES_IA = [
  "Cumpleaños",
  "Amor / Pareja",
  "Aniversario",
  "Agradecimiento",
  "Amistad",
  "Perdón",
  "Familia / Mamá",
  "Felicitación",
];

function sugerirEmojisPorMensaje(texto: string, ocasion?: string): string[] {
  const src = `${texto} ${ocasion || ""}`.toLowerCase();
  const out: string[] = [];
  const add = (...list: string[]) => {
    for (const item of list) {
      if (!out.includes(item) && out.length < 7) out.push(item);
    }
  };
  if (/cumple|años|anos|feliz d[ií]a|velita/.test(src)) add("🎂", "🎉", "💐", "✨", "🥂", "❤️");
  if (/amor|enamor|te amo|te quiero|coraz[oó]n|vida|pareja|novi|espos/.test(src)) add("❤️", "🌹", "✨", "🥰", "💕", "💐");
  if (/aniversario|bodas|juntos/.test(src)) add("🥂", "❤️", "🌹", "✨", "💍", "💕");
  if (/gracia|agradec|apoyo|gratitud/.test(src)) add("🙏", "💐", "✨", "🤍", "🌸", "💛");
  if (/perd[oó]n|disculp|reconcili|lo siento/.test(src)) add("🤍", "🌹", "✨", "🙏", "❤️");
  if (/amig|amistad/.test(src)) add("🌸", "✨", "🥂", "💛", "🤗", "💐");
  if (/mam[aá]|pap[aá]|familia/.test(src)) add("💐", "❤️", "🌸", "✨", "🤗", "🤍");
  if (/felicita|logro|gradu|[eé]xito/.test(src)) add("🎉", "🥂", "✨", "🌟", "💐");
  add("💐", "✨", "❤️", "🌹", "🌸", "🤍");
  return out.slice(0, 7);
}

const FRASES_CONDOLENCIAS = [
  "Acompañamos su dolor con profundo respeto y solidaridad en este momento difícil.",
  "Que el recuerdo de su vida y su cariño permanezcan siempre en sus corazones.",
  "Nuestras más sinceras condolencias para toda la familia. Paz en su descanso.",
];

function textoALyrics(
  texto: string,
  previas: Array<{ tiempo?: number; texto: string }>
): Array<{ tiempo?: number; texto: string }> {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lineas.length === 0) return [];
  const conservarTiempos = previas.length === lineas.length;
  return lineas.map((linea, idx) => ({
    tiempo:
      conservarTiempos && typeof previas[idx]?.tiempo === "number"
        ? previas[idx]!.tiempo
        : Number((4 + idx * 4.2).toFixed(1)),
    texto: linea,
  }));
}

export function EditorTarjetaPublicoCliente({
  datosIniciales,
  tokenEdicion,
}: PropsEditorTarjetaPublicoCliente) {
  const esCondolencias = datosIniciales.tipo === "CONDOLENCIAS_PLANA";
  const negNorm = datosIniciales.negocio.trim().toLowerCase();
  const esMargaritas = negNorm.includes("margarita");
  const nombreMarca = esMargaritas
    ? "Margaritas Floristería"
    : "Tinkay Flores y Eventos";

  // Modalidad Básica (Impresa interior sin audio) vs Avanzada (Tarjeta digital interactiva con audio y QR)
  const [modoDigitalAvanzado, setModoDigitalAvanzado] = useState<boolean>(() => {
    if (esCondolencias) return false;
    return Boolean(
      datosIniciales.musicaUrl?.trim() ||
        datosIniciales.confidencial ||
        datosIniciales.diseno?.modoImpresion === "SOLO_QR" ||
        datosIniciales.diseno?.modoImpresion === "MENSAJE_Y_QR" ||
        datosIniciales.diseno?.remitentePortada?.trim()
    );
  });

  const pasos: DefinicionPaso[] = useMemo(() => {
    if (esCondolencias) {
      return [{ id: "mensaje", etiqueta: "Mensaje" }];
    }
    if (!modoDigitalAvanzado) {
      return [
        { id: "mensaje", etiqueta: "Mensaje" },
        { id: "firma", etiqueta: "Firma" },
        { id: "diseno", etiqueta: "Diseño" },
      ];
    }
    return [
      { id: "para", etiqueta: "Para quién" },
      { id: "mensaje", etiqueta: "Mensaje" },
      { id: "firma", etiqueta: "Firma" },
      { id: "diseno", etiqueta: "Diseño" },
      { id: "audio", etiqueta: "Audio", opcional: true },
      { id: "letra", etiqueta: "Letra", opcional: true },
      { id: "visualizar", etiqueta: "Visualizar" },
      { id: "imprimir", etiqueta: "Impresión" },
    ];
  }, [esCondolencias, modoDigitalAvanzado]);

  // Fase inicial: vista 3D real del díptico (igual a /dedicatoria/[token]) con botón para editar
  const [modo, setModo] = useState<"vista" | "wizard">("vista");
  const [pasoIdx, setPasoIdx] = useState<number>(0);

  const [para, setPara] = useState<string>(datosIniciales.destinatario || "");
  const [de, setDe] = useState<string>(datosIniciales.remitente || "");
  const [mensaje, setMensaje] = useState<string>(datosIniciales.dedicatoria || "");
  const [modoImpresion, setModoImpresion] = useState<ModoImpresionTarjeta>(() => {
    if (esCondolencias) return "SOLO_MENSAJE";
    if (datosIniciales.confidencial) return "SOLO_QR";
    if (datosIniciales.diseno?.modoImpresion === "MENSAJE_Y_QR") return "MENSAJE_Y_QR";
    return "SOLO_MENSAJE";
  });
  const [diseno, setDiseno] = useState<DisenoVisualTarjeta>(() =>
    normalizarDisenoTarjeta(
      datosIniciales.diseno,
      esCondolencias,
      datosIniciales.dedicatoria || ""
    )
  );
  const [incluirAudio, setIncluirAudio] = useState<boolean>(
    !esCondolencias && Boolean(datosIniciales.musicaUrl?.trim())
  );
  const [musicaUrl, setMusicaUrl] = useState<string>(
    esCondolencias ? "" : datosIniciales.musicaUrl || ""
  );
  const [musicaTitulo, setMusicaTitulo] = useState<string>(
    esCondolencias ? "" : datosIniciales.musicaTitulo || ""
  );
  const [lyrics, setLyrics] = useState<Array<{ tiempo?: number; texto: string }>>(
    !esCondolencias && Array.isArray(datosIniciales.lyrics) ? datosIniciales.lyrics : []
  );
  const [textoLyricsManual, setTextoLyricsManual] = useState<string>(() =>
    !esCondolencias && Array.isArray(datosIniciales.lyrics)
      ? datosIniciales.lyrics.map((l) => l.texto).join("\n")
      : ""
  );

  // Estado del asistente IA en el Paso 2 (Mensaje)
  const [panelIaAbierto, setPanelIaAbierto] = useState<boolean>(false);
  const [ocasionIa, setOcasionIa] = useState<string>("");
  const [ideaIa, setIdeaIa] = useState<string>("");
  const [cargandoIa, setCargandoIa] = useState<boolean>(false);
  const [corrigiendoIa, setCorrigiendoIa] = useState<boolean>(false);
  const [opcionesIa, setOpcionesIa] = useState<OpcionMensajeTarjetaIa[]>([]);
  const [opcionIaSeleccionada, setOpcionIaSeleccionada] = useState<number | null>(null);
  const [emojisIa, setEmojisIa] = useState<string[]>([]);

  const [subiendoMp3, setSubiendoMp3] = useState<boolean>(false);
  const [buscandoLyrics, setBuscandoLyrics] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [exitoMsg, setExitoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const inputAudioRef = useRef<HTMLInputElement | null>(null);
  const textareaMensajeRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorMensajeRef = useRef<{ start: number; end: number } | null>(null);
  const usuarioMovioDisenoRef = useRef<boolean>(false);
  const soloQrEfectivo = !esCondolencias && modoDigitalAvanzado && modoImpresion === "SOLO_QR";
  const incluirQrEnEsquina =
    !esCondolencias && modoDigitalAvanzado && modoImpresion === "MENSAJE_Y_QR";
  const emojisDisponibles = useMemo(
    () => (emojisIa.length > 0 ? emojisIa : sugerirEmojisPorMensaje(mensaje, ocasionIa)),
    [emojisIa, mensaje, ocasionIa]
  );

  // Generar código QR real en vivo para el visualizador de impresión (Paso 8) y diseñador (Paso 4)
  useEffect(() => {
    if (esCondolencias || !datosIniciales.tokenVista || typeof window === "undefined") return;
    const urlPublica = `${window.location.origin}/dedicatoria/${datosIniciales.tokenVista}`;
    QRCode.toDataURL(urlPublica, {
      width: 240,
      margin: 1,
      color: { dark: "#221E1B", light: "#FFFFFF" },
    })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch(() => {});
  }, [esCondolencias, datosIniciales.tokenVista]);

  const disenoNormalizado = useMemo(
    () => normalizarDisenoTarjeta(diseno, esCondolencias, mensaje),
    [diseno, esCondolencias, mensaje]
  );
  const incluirFirma = disenoNormalizado.mostrarFirma;
  const pasoActual = pasos[pasoIdx] || pasos[0]!;
  const esUltimoPaso = pasoIdx === pasos.length - 1;

  // Datos en vivo para la visualización 3D (tanto en portada inicial como en paso Visualizar)
  const datosVistaEnVivo = useMemo(
    () => ({
      ordenId: datosIniciales.ordenId,
      codigo: datosIniciales.codigo,
      negocio: datosIniciales.negocio,
      destinatario: para.trim(),
      remitente: incluirFirma ? de.trim() : "",
      dedicatoria: mensaje.trim(),
      tipo: datosIniciales.tipo,
      confidencial: soloQrEfectivo,
      diseno: { ...disenoNormalizado, modoImpresion },
      musicaUrl: esCondolencias || !incluirAudio ? null : musicaUrl.trim() || null,
      musicaTitulo: esCondolencias || !incluirAudio ? null : musicaTitulo.trim() || null,
      lyrics: esCondolencias || !incluirAudio ? [] : lyrics,
      fechaEntrega: datosIniciales.fechaEntrega,
      bloqueadoEdicion: datosIniciales.bloqueadoEdicion,
    }),
    [
      datosIniciales,
      para,
      de,
      incluirFirma,
      mensaje,
      soloQrEfectivo,
      modoImpresion,
      disenoNormalizado,
      esCondolencias,
      incluirAudio,
      musicaUrl,
      musicaTitulo,
      lyrics,
    ]
  );

  const marcarCambio = () => {
    setCambiosSinGuardar(true);
    setErrorMsg(null);
  };

  const handleToggleIncluirFirma = (incluir: boolean) => {
    marcarCambio();
    setDiseno((prev) => {
      const norm = normalizarDisenoTarjeta(prev, esCondolencias, mensaje);
      return {
        ...norm,
        mostrarFirma: incluir,
      };
    });
  };

  const handleSubirAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("El archivo de audio no debe superar los 15 MB.");
      return;
    }
    setSubiendoMp3(true);
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await subirAudioTarjetaAction({
        negocio: datosIniciales.negocio,
        dataUrl: String(reader.result || ""),
        nombreArchivo: file.name,
      });
      setSubiendoMp3(false);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setMusicaUrl(res.publicUrl);
      if (!musicaTitulo.trim()) setMusicaTitulo(res.nombreLimpio);
      marcarCambio();
      setExitoMsg("Audio cargado correctamente.");
    };
    reader.onerror = () => {
      setSubiendoMp3(false);
      setErrorMsg("No se pudo leer el archivo seleccionado.");
    };
    reader.readAsDataURL(file);
  };

  const handleBuscarLetra = async () => {
    setBuscandoLyrics(true);
    setErrorMsg(null);
    setExitoMsg(null);
    const res = await buscarLyricsCancionAction({
      musicaUrl,
      musicaTitulo,
    });
    setBuscandoLyrics(false);
    if (!res.ok) {
      setErrorMsg(res.error || "No se encontró letra automática. Puedes escribirla o pegarla abajo.");
      return;
    }
    if (res.tituloDetectado && !musicaTitulo.trim()) {
      setMusicaTitulo(res.tituloDetectado);
    }
    if (res.lyrics && res.lyrics.length > 0) {
      setLyrics(res.lyrics);
      setTextoLyricsManual(res.lyrics.map((l) => l.texto).join("\n"));
      marcarCambio();
      setExitoMsg(`Letra cargada (${res.lyrics.length} líneas).`);
    }
  };

  const handleCambiarTextoLyrics = (valor: string) => {
    setTextoLyricsManual(valor);
    setLyrics((prev) => textoALyrics(valor, prev));
    marcarCambio();
  };

  const ajustarPosicionAutoPorLongitud = (textoActual: string) => {
    if (esCondolencias || usuarioMovioDisenoRef.current) return;
    const esCorto = esMensajeCortoParaMitadInferior(textoActual);
    setDiseno((prev) => {
      const norm = normalizarDisenoTarjeta(prev, false, textoActual);
      const bloquesAjustados = norm.bloquesTexto.map((b) => {
        if (b.rol === "mensaje") {
          return {
            ...b,
            yPct: esCorto || norm.imagenes.some((im) => !im.cubrirTarjeta) ? 68 : 49,
          };
        }
        if (b.rol === "firma") {
          return { ...b, yPct: 85 };
        }
        return b;
      });
      return {
        ...norm,
        textoYPct: esCorto ? 68 : 49,
        bloquesTexto: bloquesAjustados,
      };
    });
  };

  const handleGenerarOpcionesIa = async () => {
    if (!mensaje.trim() && !ocasionIa.trim() && !ideaIa.trim()) {
      setErrorMsg("Elige una ocasión o escribe una breve idea para generar las 2 opciones.");
      return;
    }
    setCargandoIa(true);
    setErrorMsg(null);
    setExitoMsg(null);
    const res = await asistirMensajeTarjetaIaAction({
      modo: "sugerir_opciones",
      mensajeBase: mensaje.trim(),
      ocasion: ocasionIa.trim(),
      destinatario: para.trim(),
      ideaBreve: ideaIa.trim(),
      negocio: datosIniciales.negocio,
    });
    setCargandoIa(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setOpcionesIa(res.opciones);
    setOpcionIaSeleccionada(null);
    if (res.emojisSugeridos.length > 0) setEmojisIa(res.emojisSugeridos);
  };

  const handleCorregirYEstructurarIa = async () => {
    if (mensaje.trim().length < 3) {
      setErrorMsg("Escribe primero tu mensaje para corregirlo y ordenarlo.");
      return;
    }
    setCorrigiendoIa(true);
    setErrorMsg(null);
    setExitoMsg(null);
    const res = await asistirMensajeTarjetaIaAction({
      modo: "corregir_y_estructurar",
      mensajeBase: mensaje.trim(),
      ocasion: ocasionIa.trim(),
      destinatario: para.trim(),
      negocio: datosIniciales.negocio,
    });
    setCorrigiendoIa(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    const mejorado = res.opciones[0]?.texto;
    if (mejorado) {
      setMensaje(mejorado);
      ajustarPosicionAutoPorLongitud(mejorado);
      marcarCambio();
      setExitoMsg("Ortografía corregida y frases organizadas para tu tarjeta.");
    }
    if (res.emojisSugeridos.length > 0) setEmojisIa(res.emojisSugeridos);
  };

  const sincronizarCursorMensaje = (el?: HTMLTextAreaElement | null) => {
    const target = el ?? textareaMensajeRef.current;
    if (!target) return;
    if (typeof target.selectionStart === "number" && typeof target.selectionEnd === "number") {
      cursorMensajeRef.current = {
        start: target.selectionStart,
        end: target.selectionEnd,
      };
    }
  };

  const handleInsertarEmoji = (emoji: string) => {
    const el = textareaMensajeRef.current;
    const estaEnfocado = typeof document !== "undefined" && document.activeElement === el;
    const posStart =
      estaEnfocado && el && typeof el.selectionStart === "number"
        ? el.selectionStart
        : cursorMensajeRef.current?.start ?? mensaje.length;
    const posEnd =
      estaEnfocado && el && typeof el.selectionEnd === "number"
        ? el.selectionEnd
        : cursorMensajeRef.current?.end ?? posStart;

    const inicioSeguro = Math.max(0, Math.min(posStart, mensaje.length));
    const finSeguro = Math.max(inicioSeguro, Math.min(posEnd, mensaje.length));
    const antes = mensaje.slice(0, inicioSeguro);
    const despues = mensaje.slice(finSeguro);
    const nuevoTexto = `${antes}${emoji}${despues}`;
    const nuevaPos = inicioSeguro + emoji.length;

    setMensaje(nuevoTexto);
    cursorMensajeRef.current = { start: nuevaPos, end: nuevaPos };
    marcarCambio();

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const nodo = textareaMensajeRef.current;
        if (nodo) {
          nodo.focus();
          try {
            nodo.setSelectionRange(nuevaPos, nuevaPos);
          } catch {}
        }
      });
    }
  };

  const handleToggleIncluirAudio = (incluir: boolean) => {
    setIncluirAudio(incluir);
    marcarCambio();
    if (!incluir) {
      setMusicaUrl("");
      setMusicaTitulo("");
      setLyrics([]);
      setTextoLyricsManual("");
    }
  };

  const handleCambiarNivelTarjeta = (avanzada: boolean, irAWizard = false) => {
    setErrorMsg(null);
    setExitoMsg(null);
    setModoDigitalAvanzado(avanzada);
    marcarCambio();
    if (!avanzada) {
      setIncluirAudio(false);
      setModoImpresion("SOLO_MENSAJE");
      setDiseno((prev) => ({
        ...normalizarDisenoTarjeta(prev, esCondolencias, mensaje),
        modoImpresion: "SOLO_MENSAJE",
      }));
      setPasoIdx(0);
    } else {
      if (modoImpresion === "SOLO_MENSAJE") {
        setModoImpresion("MENSAJE_Y_QR");
        setDiseno((prev) => ({
          ...normalizarDisenoTarjeta(prev, esCondolencias, mensaje),
          modoImpresion: "MENSAJE_Y_QR",
        }));
      }
      if (irAWizard) {
        setPasoIdx(0);
        setModo("wizard");
      }
    }
  };

  const handleSeleccionarModoImpresion = (nuevoModo: ModoImpresionTarjeta) => {
    setModoImpresion(nuevoModo);
    setDiseno((prev) => ({
      ...normalizarDisenoTarjeta(prev, esCondolencias, mensaje),
      modoImpresion: nuevoModo,
    }));
    marcarCambio();
  };

  const handleSiguientePaso = () => {
    setErrorMsg(null);
    setExitoMsg(null);
    if (pasoActual.id === "mensaje") {
      if (!mensaje.trim()) {
        setErrorMsg("Escribe un mensaje para continuar con tu tarjeta.");
        return;
      }
      ajustarPosicionAutoPorLongitud(mensaje);
    }
    if (pasoActual.id === "audio" && !incluirAudio) {
      const idxVis = pasos.findIndex((p) => p.id === "visualizar");
      if (idxVis >= 0) {
        setPasoIdx(idxVis);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (pasoIdx < pasos.length - 1) {
      setPasoIdx(pasoIdx + 1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePasoAnterior = () => {
    setErrorMsg(null);
    setExitoMsg(null);
    if (pasoActual.id === "visualizar" && !esCondolencias && !incluirAudio) {
      const idxAudio = pasos.findIndex((p) => p.id === "audio");
      if (idxAudio >= 0) {
        setPasoIdx(idxAudio);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (pasoIdx > 0) {
      setPasoIdx(pasoIdx - 1);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleGuardar = async () => {
    if (!mensaje.trim()) {
      setErrorMsg("Escribe el mensaje para tu tarjeta antes de guardar.");
      const idxMsg = pasos.findIndex((p) => p.id === "mensaje");
      if (idxMsg >= 0) setPasoIdx(idxMsg);
      return;
    }
    setGuardando(true);
    setErrorMsg(null);
    setExitoMsg(null);

    const usaAudio =
      !esCondolencias && modoDigitalAvanzado && incluirAudio && Boolean(musicaUrl.trim());
    let lyricsFinales = usaAudio ? lyrics : [];
    let tituloFinal = usaAudio ? musicaTitulo.trim() || null : null;

    if (
      usaAudio &&
      musicaUrl.trim() !== (datosIniciales.musicaUrl || "") &&
      lyricsFinales.length === 0
    ) {
      const autoLrc = await buscarLyricsCancionAction({
        musicaUrl: musicaUrl.trim(),
        musicaTitulo: musicaTitulo.trim(),
      });
      if (autoLrc.ok && autoLrc.lyrics) {
        lyricsFinales = autoLrc.lyrics;
        setLyrics(autoLrc.lyrics);
        setTextoLyricsManual(autoLrc.lyrics.map((l) => l.texto).join("\n"));
        if (!tituloFinal && autoLrc.tituloDetectado) {
          tituloFinal = autoLrc.tituloDetectado;
          setMusicaTitulo(autoLrc.tituloDetectado);
        }
      }
    }

    const modoFinal: ModoImpresionTarjeta =
      esCondolencias || !modoDigitalAvanzado ? "SOLO_MENSAJE" : modoImpresion;
    const disenoFinal: DisenoVisualTarjeta = {
      ...normalizarDisenoTarjeta(diseno, esCondolencias, mensaje.trim()),
      modoImpresion: modoFinal,
    };

    const res = await editarTarjetaClienteAction({
      token: tokenEdicion,
      dedicatoria: mensaje.trim(),
      para: para.trim(),
      de: incluirFirma ? de.trim() : "",
      confidencial: modoFinal === "SOLO_QR",
      diseno: disenoFinal,
      musicaUrl: usaAudio ? musicaUrl.trim() : null,
      musicaTitulo: tituloFinal,
      lyrics: lyricsFinales,
    });

    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error || "No se pudieron guardar los cambios.");
      return;
    }
    setCambiosSinGuardar(false);
    setExitoMsg("Tu tarjeta fue guardada y quedó lista para nuestro taller.");
    setModo("vista");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderIconoPaso = (id: PasoId, tamano: number) => {
    switch (id) {
      case "para":
        return <User size={tamano} />;
      case "mensaje":
        return <MessageSquare size={tamano} />;
      case "firma":
        return <PenTool size={tamano} />;
      case "diseno":
        return <Palette size={tamano} />;
      case "audio":
        return <Music size={tamano} />;
      case "letra":
        return <AlignLeft size={tamano} />;
      case "visualizar":
        return <Eye size={tamano} />;
      case "imprimir":
        return <QrCode size={tamano} />;
    }
  };

  // =========================================================================
  // FASE 1: VISUALIZACIÓN REAL EN DÍPTICO 3D (MISMO EFECTO QUE /dedicatoria)
  // =========================================================================
  // =========================================================================
  // FASE 1A: VISTA INICIAL BÁSICA (TARJETA IMPRESA INTERIOR — SIN PORTADA EXTERIOR NI AUDIO)
  // =========================================================================
  if (modo === "vista" && !esCondolencias && !modoDigitalAvanzado) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "#F6F4F0",
          color: "#1F1C19",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "18px 14px 36px 14px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "540px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Barra superior */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1F1C19" }}>
                Pedido {datosIniciales.codigo}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: "999px",
                  backgroundColor: "#EAE5DC",
                  color: "#57524C",
                }}
              >
                Tarjeta impresa
              </span>
            </div>
            <span style={{ fontSize: "0.74rem", color: "#78716C" }}>{nombreMarca}</span>
          </div>

          {exitoMsg && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "12px",
                backgroundColor: "#EEF4F0",
                border: "1px solid #C8D5CB",
                color: "#2F4737",
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              <Check size={16} />
              <span>{exitoMsg}</span>
            </div>
          )}

          {/* Tarjeta interior tal como se imprimirá */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "18px",
              border: "1px solid #E6E2DA",
              boxShadow: "0 12px 32px rgba(31, 28, 25, 0.05)",
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.22rem",
                  fontWeight: 700,
                  color: "#1F1C19",
                  letterSpacing: "-0.015em",
                }}
              >
                Interior de tu tarjeta impresa
              </h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "#57524C" }}>
                En la tarjeta física imprimimos únicamente la parte interior del díptico.
              </p>
            </div>

            <div style={{ width: "100%" }}>
              <LienzoDisenadorTarjeta
                negocio={negNorm}
                esCondolencias={false}
                soloQr={false}
                incluirQrEnEsquina={false}
                mensaje={mensaje}
                firma={incluirFirma ? de : ""}
                diseno={disenoNormalizado}
                onCambiarDiseno={() => {}}
                soloLectura={true}
              />
            </div>

            {datosIniciales.bloqueadoEdicion ? (
              <div
                style={{
                  padding: "11px 16px",
                  borderRadius: "12px",
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  color: "#92400E",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <Lock size={16} style={{ flexShrink: 0 }} />
                <span>Tarjeta impresa en taller. Ya no admite modificaciones.</span>
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  paddingTop: "4px",
                }}
              >
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setExitoMsg(null);
                      setPasoIdx(0);
                      setModo("wizard");
                    }}
                    title="Editar texto, firma y diseño de tu tarjeta impresa"
                    aria-label="Editar tarjeta"
                    style={{
                      flex: "1 1 170px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      padding: "12px 18px",
                      borderRadius: "12px",
                      border: "none",
                      backgroundColor: "#221E1B",
                      color: "#FFFFFF",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Pencil size={15} />
                    <span>Editar tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setExitoMsg(null);
                      setPasoIdx(2);
                      setModo("wizard");
                    }}
                    title="Ir directo al diseñador visual para ajustar fotos, fuentes y posición"
                    aria-label="Ir al diseñador"
                    style={{
                      flex: "1 1 150px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FAF8F5",
                      color: "#1F1C19",
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Palette size={15} />
                    <span>Ir al diseñador</span>
                  </button>
                </div>

                {/* Opción clara para activar la experiencia Avanzada: Tarjeta Digital + Audio */}
                <button
                  type="button"
                  onClick={() => handleCambiarNivelTarjeta(true, true)}
                  title="Activar tarjeta digital interactiva 3D con música, letra y QR"
                  aria-label="Incluir tarjeta digital con audio"
                  style={{
                    width: "100%",
                    padding: "13px 15px",
                    borderRadius: "12px",
                    border: "1px solid #C8D5CB",
                    backgroundColor: "#EEF4F0",
                    color: "#2F4737",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "9px",
                        backgroundColor: "#2F4737",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Music size={16} />
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.86rem", color: "#1F1C19" }}>
                        Incluir tarjeta digital con audio
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "#57524C" }}>
                        Agrega portada animada 3D, canción de fondo, letra y código QR
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} color="#2F4737" style={{ flexShrink: 0 }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FASE 1B: VISUALIZACIÓN REAL EN DÍPTICO 3D (AVANZADA DIGITAL) O CONDOLENCIAS
  // =========================================================================
  if (modo === "vista") {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: esCondolencias ? "#141416" : "#0F172A",
          backgroundImage: esCondolencias
            ? "radial-gradient(ellipse at top, #1F1F23, #141416 76%)"
            : "radial-gradient(ellipse at top, #1E293B, #0F172A 78%)",
          color: "#FFFFFF",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 14px 28px 14px",
          boxSizing: "border-box",
        }}
      >
        {/* Barra superior discreta */}
        <div
          style={{
            width: "100%",
            maxWidth: "560px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "4px 2px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "0.74rem",
                fontWeight: 600,
                color: esCondolencias ? "rgba(228, 228, 231, 0.72)" : "rgba(245, 239, 230, 0.85)",
                letterSpacing: "0.02em",
              }}
            >
              Pedido {datosIniciales.codigo}
            </span>
            {esCondolencias && (
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  color: "rgba(228, 228, 231, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                Condolencias
              </span>
            )}
            {cambiosSinGuardar && (
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(251, 191, 36, 0.16)",
                  color: "#FDE68A",
                  border: "1px solid rgba(251, 191, 36, 0.3)",
                }}
              >
                Borrador sin guardar
              </span>
            )}
          </div>

          {!esCondolencias && datosIniciales.tokenVista && (
            <a
              href={`/dedicatoria/${datosIniciales.tokenVista}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir enlace público de tu tarjeta"
              aria-label="Abrir enlace público"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 11px",
                borderRadius: "999px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                color: "rgba(245, 239, 230, 0.88)",
                fontSize: "0.73rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <span>Ver pública</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Escenario central: Tarjeta real con apertura 3D en díptico */}
        <div style={{ width: "100%", display: "flex", justifyContent: "center", margin: "auto 0" }}>
          <TarjetaDedicatoriaDigitalInteractiva
            datosIniciales={datosVistaEnVivo}
            token={datosIniciales.tokenVista}
            modoEmbebido={true}
            accionesInferiores={
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {exitoMsg && (
                  <div
                    role="status"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(47, 71, 55, 0.92)",
                      border: "1px solid rgba(134, 239, 172, 0.35)",
                      color: "#ECFDF5",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    <Check size={15} />
                    <span>{exitoMsg}</span>
                  </div>
                )}

                {datosIniciales.bloqueadoEdicion ? (
                  <div
                    style={{
                      padding: "11px 16px",
                      borderRadius: "12px",
                      backgroundColor: "rgba(254, 243, 199, 0.12)",
                      border: "1px solid rgba(253, 230, 138, 0.32)",
                      color: "#FDE68A",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      textAlign: "left",
                      maxWidth: "360px",
                    }}
                  >
                    <Lock size={16} style={{ flexShrink: 0 }} />
                    <span>
                      Tarjeta impresa en taller. Ya no admite modificaciones.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "7px",
                      width: "100%",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setExitoMsg(null);
                        setPasoIdx(0);
                        setModo("wizard");
                      }}
                      title={
                        esCondolencias
                          ? "Editar mensaje de condolencias"
                          : "Personalizar tu tarjeta paso a paso"
                      }
                      aria-label={esCondolencias ? "Editar mensaje" : "Editar tarjeta"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px 26px",
                        borderRadius: "999px",
                        border: esCondolencias
                          ? "1px solid rgba(228, 228, 231, 0.25)"
                          : "1px solid rgba(245, 239, 230, 0.25)",
                        backgroundColor: esCondolencias ? "#F4F3EF" : "#F5EFE6",
                        color: "#1F1C19",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        letterSpacing: "0.01em",
                        cursor: "pointer",
                        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
                      }}
                    >
                      <Pencil size={16} />
                      <span>{esCondolencias ? "Editar mensaje" : "Editar tarjeta"}</span>
                    </button>
                    <span
                      style={{
                        fontSize: "0.73rem",
                        color: esCondolencias
                          ? "rgba(228, 228, 231, 0.52)"
                          : "rgba(245, 239, 230, 0.56)",
                        textAlign: "center",
                      }}
                    >
                      {esCondolencias
                        ? "Puedes ajustar el mensaje antes de la impresión en taller"
                        : "Así luce tu tarjeta digital · Personaliza portada, texto, fotos y música"}
                    </span>
                    {!esCondolencias && modoDigitalAvanzado && (
                      <button
                        type="button"
                        onClick={() => handleCambiarNivelTarjeta(false)}
                        title="Cambiar a tarjeta impresa básica sin audio ni QR"
                        aria-label="Usar impresa básica"
                        style={{
                          marginTop: "2px",
                          background: "transparent",
                          border: "none",
                          color: "rgba(245, 239, 230, 0.62)",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        Cambiar a tarjeta impresa básica (sin audio)
                      </button>
                    )}
                  </div>
                )}
              </div>
            }
          />
        </div>

        <div style={{ height: "8px" }} />
      </div>
    );
  }

  // =========================================================================
  // FASE 2A (CONDOLENCIAS): EDICIÓN SOBRIA Y SERENA — ÚNICAMENTE EL MENSAJE
  // =========================================================================
  if (esCondolencias) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "#F4F3EF",
          color: "#27272A",
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "18px 14px 36px 14px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "660px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Cabecera sobria */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setModo("vista")}
              title="Volver a la vista de la tarjeta"
              aria-label="Ver tarjeta"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 13px",
                borderRadius: "999px",
                border: "1px solid #D4D4D8",
                backgroundColor: "#FFFFFF",
                color: "#27272A",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={15} />
              <span>Ver tarjeta</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#52525B",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  backgroundColor: "#E4E4E7",
                }}
              >
                Condolencias · {datosIniciales.codigo}
              </span>
            </div>
          </div>

          {/* Vista previa sobria en vivo */}
          <div
            style={{
              borderRadius: "14px",
              backgroundColor: "#141416",
              backgroundImage: "radial-gradient(ellipse at top, #1F1F23, #141416 76%)",
              padding: "18px 14px",
              boxSizing: "border-box",
            }}
          >
            <TarjetaDedicatoriaDigitalInteractiva
              datosIniciales={datosVistaEnVivo}
              token={datosIniciales.tokenVista}
              modoEmbebido={true}
            />
          </div>

          {/* Tarjeta única para editar exclusivamente el mensaje */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E4E4E7",
              boxShadow: "0 10px 28px rgba(24, 24, 27, 0.04)",
              padding: "22px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxSizing: "border-box",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.22rem",
                  fontWeight: 600,
                  color: "#18181B",
                  letterSpacing: "-0.01em",
                }}
              >
                Mensaje de condolencias
              </h1>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "0.84rem",
                  color: "#52525B",
                  lineHeight: 1.5,
                }}
              >
                Edita el texto que acompañará el arreglo floral antes de su impresión en taller.
              </p>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label
                  htmlFor="eco-campo-mensaje-condolencias"
                  style={{ fontSize: "0.8rem", fontWeight: 600, color: "#27272A" }}
                >
                  Mensaje
                </label>
                <span style={{ fontSize: "0.74rem", color: "#71717A" }}>
                  {mensaje.length} caracteres
                </span>
              </div>
              <textarea
                id="eco-campo-mensaje-condolencias"
                rows={5}
                value={mensaje}
                onChange={(e) => {
                  setMensaje(e.target.value);
                  marcarCambio();
                }}
                placeholder="Escribe tu mensaje de condolencias..."
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: "10px",
                  border: "1px solid #D4D4D8",
                  backgroundColor: "#FAFAFA",
                  color: "#18181B",
                  fontSize: "16px",
                  lineHeight: 1.55,
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#52525B" }}>
                Frases sobrias sugeridas:
              </span>
              {FRASES_CONDOLENCIAS.map((frase, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setMensaje(frase);
                    marcarCambio();
                  }}
                  title="Usar esta frase en tu tarjeta"
                  style={{
                    textAlign: "left",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #E4E4E7",
                    backgroundColor: "#F9F9F8",
                    color: "#3F3F46",
                    fontSize: "0.8rem",
                    lineHeight: 1.45,
                    cursor: "pointer",
                  }}
                >
                  “{frase}”
                </button>
              ))}
            </div>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  padding: "10px 13px",
                  borderRadius: "8px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#991B1B",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {errorMsg}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                paddingTop: "10px",
                borderTop: "1px solid #ECECE9",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setModo("vista")}
                title="Volver sin guardar"
                aria-label="Cancelar"
                style={{
                  padding: "11px 16px",
                  borderRadius: "9px",
                  border: "1px solid #D4D4D8",
                  backgroundColor: "#FFFFFF",
                  color: "#27272A",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={guardando}
                onClick={() => void handleGuardar()}
                title="Guardar mensaje de condolencias"
                aria-label="Guardar mensaje"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "11px 22px",
                  borderRadius: "9px",
                  border: "none",
                  backgroundColor: "#27272A",
                  color: "#FFFFFF",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  cursor: guardando ? "wait" : "pointer",
                }}
              >
                {guardando ? <Loader2 size={15} /> : <Save size={15} />}
                <span>{guardando ? "Guardando..." : "Guardar mensaje"}</span>
              </button>
            </div>
          </div>

          <div style={{ textAlign: "center", fontSize: "0.72rem", color: "#71717A" }}>
            {nombreMarca}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FASE 2B (DEDICATORIA): WIZARD GUIADO PASO A PASO (UX EDITORIAL CÁLIDO)
  // =========================================================================
  const porcentajeProgreso = Math.round(((pasoIdx + 1) / pasos.length) * 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: "#F6F4F0",
        color: "#1F1C19",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 14px 36px 14px",
        boxSizing: "border-box",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .eco-wizard-steps::-webkit-scrollbar {
              display: none;
            }
          `,
        }}
      />

      {/* Contenedor principal del asistente */}
      <div
        style={{
          width: "100%",
          maxWidth: "740px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Cabecera fija con regreso a vista 3D y progreso */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setModo("vista")}
            title="Volver a la vista 3D de la tarjeta"
            aria-label="Ver tarjeta"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              borderRadius: "999px",
              border: "1px solid #DDD7CD",
              backgroundColor: "#FFFFFF",
              color: "#1F1C19",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={15} />
            <span>Ver tarjeta</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "0.76rem",
                fontWeight: 600,
                color: "#57524C",
              }}
            >
              Paso {pasoIdx + 1} de {pasos.length}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#57524C",
                padding: "3px 9px",
                borderRadius: "999px",
                backgroundColor: "#EAE5DC",
              }}
            >
              {datosIniciales.codigo}
            </span>
          </div>
        </div>

        {/* Conmutador rápido entre Básica (Impresa interior) y Avanzada (Digital + Audio) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            backgroundColor: "#EAE5DC",
            padding: "4px",
            borderRadius: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => handleCambiarNivelTarjeta(false)}
            aria-pressed={!modoDigitalAvanzado}
            title="Tarjeta impresa básica (solo interior, sin audio)"
            style={{
              padding: "8px 10px",
              borderRadius: "9px",
              border: "none",
              backgroundColor: !modoDigitalAvanzado ? "#FFFFFF" : "transparent",
              color: !modoDigitalAvanzado ? "#1F1C19" : "#57524C",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: !modoDigitalAvanzado ? "0 2px 6px rgba(31, 28, 25, 0.08)" : "none",
            }}
          >
            Impresa básica
          </button>
          <button
            type="button"
            onClick={() => handleCambiarNivelTarjeta(true)}
            aria-pressed={modoDigitalAvanzado}
            title="Incluir tarjeta digital interactiva con audio y QR"
            style={{
              padding: "8px 10px",
              borderRadius: "9px",
              border: "none",
              backgroundColor: modoDigitalAvanzado ? "#2F4737" : "transparent",
              color: modoDigitalAvanzado ? "#FFFFFF" : "#57524C",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: modoDigitalAvanzado ? "0 2px 6px rgba(47, 71, 55, 0.2)" : "none",
            }}
          >
            <Music size={13} />
            <span>Digital + Audio</span>
          </button>
        </div>

        {/* Barra de progreso suave */}
        <div
          aria-hidden="true"
          style={{
            width: "100%",
            height: "4px",
            borderRadius: "999px",
            backgroundColor: "#E5E0D6",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${porcentajeProgreso}%`,
              height: "100%",
              backgroundColor: "#2F4737",
              transition: "width 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>

        {/* Navegador de pasos clickable (permite saltar a cualquier paso) */}
        <div
          className="eco-wizard-steps"
          role="tablist"
          aria-label="Pasos de edición"
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingBottom: "2px",
          }}
        >
          {pasos.map((p, idx) => {
            const activo = idx === pasoIdx;
            const completado = idx < pasoIdx;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => {
                  setErrorMsg(null);
                  setExitoMsg(null);
                  setPasoIdx(idx);
                }}
                title={`Ir al paso ${idx + 1}: ${p.etiqueta}`}
                aria-label={`Paso ${idx + 1}: ${p.etiqueta}`}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 12px",
                  borderRadius: "999px",
                  border: activo
                    ? "1px solid #221E1B"
                    : completado
                      ? "1px solid #C8D5CB"
                      : "1px solid #E2DDD4",
                  backgroundColor: activo
                    ? "#221E1B"
                    : completado
                      ? "#EEF4F0"
                      : "#FFFFFF",
                  color: activo ? "#FFFFFF" : completado ? "#2F4737" : "#57524C",
                  fontSize: "0.76rem",
                  fontWeight: activo ? 700 : 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {completado ? (
                  <Check size={13} />
                ) : (
                  renderIconoPaso(p.id, 13)
                )}
                <span>
                  {idx + 1}. {p.etiqueta}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tarjeta del paso activo */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "18px",
            border: "1px solid #E6E2DA",
            boxShadow: "0 12px 32px rgba(31, 28, 25, 0.05)",
            padding: "24px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            boxSizing: "border-box",
          }}
        >
          {/* ===================================================== */}
          {/* PASO 1: PARA QUIÉN                                    */}
          {/* ===================================================== */}
          {pasoActual.id === "para" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {esCondolencias
                    ? "¿En memoria de quién es esta tarjeta?"
                    : "¿Para quién es esta tarjeta?"}
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  {esCondolencias
                    ? "Escribe el nombre de la persona o familia destinataria."
                    : "Este nombre aparecerá en la portada de tu tarjeta antes de abrirla."}
                </p>
              </div>

              <div>
                <label
                  htmlFor="eco-campo-para"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#1F1C19",
                    marginBottom: "6px",
                  }}
                >
                  {esCondolencias ? "En memoria / Familia" : "Para (Destinatario)"}
                </label>
                <input
                  id="eco-campo-para"
                  type="text"
                  value={para}
                  onChange={(e) => {
                    setPara(e.target.value);
                    marcarCambio();
                  }}
                  placeholder={esCondolencias ? "Ej: Familia Rodríguez" : "Ej: María José"}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #CFC8BC",
                    backgroundColor: "#FDFCFB",
                    color: "#1F1C19",
                    fontSize: "16px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Mini vista previa real de portada kraft */}
              {!esCondolencias && modoDigitalAvanzado && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    paddingTop: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "280px",
                      aspectRatio: "113 / 84",
                      borderRadius: "10px",
                      backgroundColor: "#DFD9CE",
                      border: "1px solid #C8C0B2",
                      boxShadow: "0 10px 24px rgba(31, 28, 25, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px",
                      boxSizing: "border-box",
                      textAlign: "center",
                    }}
                  >
                    {!esMargaritas ? (
                      <div
                        style={{
                          width: "72%",
                          maxWidth: "170px",
                          aspectRatio: "16 / 8.8",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <img
                          src="/img/logo/tinkay-logo.jpg"
                          alt="Tinkay Flores y Eventos"
                          draggable={false}
                          style={{
                            width: "160%",
                            maxWidth: "none",
                            height: "auto",
                            mixBlendMode: "multiply",
                            filter: "contrast(1.38) brightness(1.05)",
                          }}
                        />
                      </div>
                    ) : (
                      <span
                        style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: "1.45rem",
                          fontWeight: 700,
                          color: "#292524",
                        }}
                      >
                        Margaritas
                      </span>
                    )}
                    <div
                      style={{
                        marginTop: "6px",
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "0.9rem",
                        fontStyle: "italic",
                        color: "#44403C",
                      }}
                    >
                      Para:{" "}
                      <strong style={{ fontStyle: "normal", color: "#1C1917" }}>
                        {para.trim() || "Tu destinatario"}
                      </strong>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#78716C" }}>
                    Vista previa de la portada
                  </span>
                </div>
              )}
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 2: MENSAJE                                       */}
          {/* ===================================================== */}
          {pasoActual.id === "mensaje" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Escribe tu mensaje
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  Dedica unas palabras sinceras. En el siguiente paso podrás elegir tipografía, fotos y ubicación.
                </p>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    htmlFor="eco-campo-mensaje"
                    style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1F1C19" }}
                  >
                    Texto de la tarjeta
                  </label>
                  <span style={{ fontSize: "0.74rem", color: "#78716C" }}>
                    {mensaje.length} caracteres
                  </span>
                </div>
                <textarea
                  ref={textareaMensajeRef}
                  id="eco-campo-mensaje"
                  rows={6}
                  value={mensaje}
                  onChange={(e) => {
                    setMensaje(e.target.value);
                    sincronizarCursorMensaje(e.currentTarget);
                    marcarCambio();
                  }}
                  onSelect={(e) => sincronizarCursorMensaje(e.currentTarget)}
                  onClick={(e) => sincronizarCursorMensaje(e.currentTarget)}
                  onKeyUp={(e) => sincronizarCursorMensaje(e.currentTarget)}
                  onBlur={(e) => sincronizarCursorMensaje(e.currentTarget)}
                  placeholder={
                    esCondolencias
                      ? "Escribe tu mensaje de condolencias..."
                      : "Escribe aquí tu dedicatoria..."
                  }
                  style={{
                    width: "100%",
                    padding: "13px 14px",
                    borderRadius: "12px",
                    border: "1px solid #CFC8BC",
                    backgroundColor: "#FDFCFB",
                    color: "#1F1C19",
                    fontSize: "16px",
                    lineHeight: 1.55,
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Acciones IA: Ayuda con IA (2 opciones) + Corregir ortografía y saltos de línea */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setPanelIaAbierto((prev) => !prev);
                    setErrorMsg(null);
                  }}
                  title="Pedir ayuda con IA para redactar 2 opciones de mensaje"
                  aria-label="Ayuda con IA"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: panelIaAbierto ? "1px solid #2F4737" : "1px solid #C8D5CB",
                    backgroundColor: panelIaAbierto ? "#2F4737" : "#EEF4F0",
                    color: panelIaAbierto ? "#FFFFFF" : "#2F4737",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={14} />
                  <span>Ayuda con IA</span>
                </button>

                {mensaje.trim().length >= 3 && (
                  <button
                    type="button"
                    disabled={corrigiendoIa}
                    onClick={() => void handleCorregirYEstructurarIa()}
                    title="Corregir ortografía y ordenar en frases con saltos de línea"
                    aria-label="Corregir texto"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "9px 14px",
                      borderRadius: "10px",
                      border: "1px solid #D5CFC4",
                      backgroundColor: "#FAF8F5",
                      color: "#1F1C19",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: corrigiendoIa ? "wait" : "pointer",
                    }}
                  >
                    {corrigiendoIa ? <Loader2 size={14} /> : <Wand2 size={14} />}
                    <span>{corrigiendoIa ? "Ordenando..." : "Corregir texto"}</span>
                  </button>
                )}
              </div>

              {/* Panel interactivo de Ayuda con IA: usa mensaje base o pregunta la ocasión y crea 2 opciones */}
              {panelIaAbierto && (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    backgroundColor: "#FAF8F5",
                    border: "1px solid #DFD9CE",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "0.84rem", color: "#1F1C19" }}>
                      {mensaje.trim()
                        ? "Mejoraremos tu mensaje actual en 2 opciones"
                        : "¿Para qué ocasión necesitas el mensaje?"}
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "#57524C" }}>
                      {mensaje.trim()
                        ? "Puedes elegir también la ocasión o un detalle extra para afinar el tono."
                        : "Selecciona la ocasión y crearemos 2 propuestas listas para tu tarjeta."}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {OCASIONES_IA.map((oc) => {
                      const seleccionada = ocasionIa === oc;
                      return (
                        <button
                          key={oc}
                          type="button"
                          onClick={() => setOcasionIa(seleccionada ? "" : oc)}
                          style={{
                            padding: "6px 11px",
                            borderRadius: "999px",
                            border: seleccionada ? "1px solid #2F4737" : "1px solid #D5CFC4",
                            backgroundColor: seleccionada ? "#2F4737" : "#FFFFFF",
                            color: seleccionada ? "#FFFFFF" : "#3F3A34",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {oc}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={ideaIa}
                    onChange={(e) => setIdeaIa(e.target.value)}
                    placeholder="Detalle opcional (ej: cumplimos 3 años, gracias por estar siempre...)"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FFFFFF",
                      color: "#1F1C19",
                      fontSize: "16px",
                      boxSizing: "border-box",
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={cargandoIa}
                      onClick={() => void handleGenerarOpcionesIa()}
                      title="Generar 2 opciones de dedicatoria con IA"
                      aria-label="Crear opciones"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        padding: "9px 16px",
                        borderRadius: "10px",
                        border: "none",
                        backgroundColor: "#221E1B",
                        color: "#FFFFFF",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: cargandoIa ? "wait" : "pointer",
                      }}
                    >
                      {cargandoIa ? <Loader2 size={14} /> : <Sparkles size={14} />}
                      <span>{cargandoIa ? "Creando opciones..." : "Crear 2 opciones"}</span>
                    </button>
                  </div>

                  {opcionesIa.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "2px" }}>
                      <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#57524C" }}>
                        Elige la opción que más te guste:
                      </span>
                      {opcionesIa.map((op, idx) => {
                        const activa = opcionIaSeleccionada === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setMensaje(op.texto);
                              setOpcionIaSeleccionada(idx);
                              ajustarPosicionAutoPorLongitud(op.texto);
                              marcarCambio();
                            }}
                            style={{
                              textAlign: "left",
                              padding: "12px 14px",
                              borderRadius: "12px",
                              border: activa ? "2px solid #2F4737" : "1px solid #DDD7CD",
                              backgroundColor: activa ? "#EEF4F0" : "#FFFFFF",
                              color: "#1F1C19",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: "5px",
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
                              <strong style={{ fontSize: "0.78rem", color: "#2F4737" }}>
                                Opción {idx + 1} · {op.titulo}
                              </strong>
                              {activa && <Check size={15} color="#2F4737" />}
                            </div>
                            <span
                              style={{
                                fontSize: "0.83rem",
                                lineHeight: 1.5,
                                color: "#292524",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {op.texto}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Emojis sugeridos contextualmente según el mensaje u ocasión */}
              {(mensaje.trim().length > 0 || emojisIa.length > 0) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#57524C" }}>
                    Emojis sugeridos para tu mensaje (toca para agregar):
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {emojisDisponibles.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInsertarEmoji(em)}
                        title={`Insertar ${em} donde está el cursor`}
                        aria-label={`Insertar emoji ${em}`}
                        style={{
                          padding: "6px 11px",
                          borderRadius: "999px",
                          border: "1px solid #E2DDD4",
                          backgroundColor: "#FAF8F5",
                          fontSize: "1rem",
                          lineHeight: 1,
                          cursor: "pointer",
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 3: FIRMA (PREGUNTAR) Y REMITENTE DE PORTADA      */}
          {/* ===================================================== */}
          {pasoActual.id === "firma" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  ¿Deseas firmar tu tarjeta?
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  Elige si quieres que aparezca tu firma al pie del mensaje o mantener el detalle anónimo.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggleIncluirFirma(true)}
                  aria-pressed={incluirFirma}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: incluirFirma ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: incluirFirma ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "0.88rem" }}>Sí, incluir firma</strong>
                    {incluirFirma && <Check size={16} color="#2F4737" />}
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "#57524C" }}>
                    Se muestra al final del mensaje dentro de la tarjeta.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleIncluirFirma(false)}
                  aria-pressed={!incluirFirma}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: !incluirFirma ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: !incluirFirma ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "0.88rem" }}>Sin firma</strong>
                    {!incluirFirma && <Check size={16} color="#2F4737" />}
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "#57524C" }}>
                    Ideal para sorpresas anónimas o mensajes sin remitente.
                  </span>
                </button>
              </div>

              {incluirFirma && (
                <div>
                  <label
                    htmlFor="eco-campo-firma"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#1F1C19",
                      marginBottom: "6px",
                    }}
                  >
                    Firma interior
                  </label>
                  <input
                    id="eco-campo-firma"
                    type="text"
                    value={de}
                    onChange={(e) => {
                      setDe(e.target.value);
                      marcarCambio();
                    }}
                    placeholder="Ej: Att: Kleber"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FDFCFB",
                      color: "#1F1C19",
                      fontSize: "16px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {!esCondolencias && modoDigitalAvanzado && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: "#FAF8F5",
                    border: "1px solid #E6E2DA",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    htmlFor="eco-campo-remitente-portada"
                    style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1F1C19" }}
                  >
                    Remitente en portada digital (opcional)
                  </label>
                  <input
                    id="eco-campo-remitente-portada"
                    type="text"
                    value={disenoNormalizado.remitentePortada || ""}
                    onChange={(e) => {
                      marcarCambio();
                      setDiseno((prev) => ({
                        ...normalizarDisenoTarjeta(prev, esCondolencias, mensaje),
                        remitentePortada: e.target.value,
                      }));
                    }}
                    placeholder="Ej: El amor de tu vida"
                    style={{
                      width: "100%",
                      padding: "11px 13px",
                      borderRadius: "10px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FFFFFF",
                      color: "#1F1C19",
                      fontSize: "16px",
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#57524C", lineHeight: 1.45 }}>
                    Se muestra en la portada antes de abrir la tarjeta digital (por ejemplo: “De: El amor de tu vida”), mientras tu firma aparece al abrirla.
                  </span>
                </div>
              )}
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 4: DISEÑADOR GRÁFICO (IMÁGENES, FUENTES, ROTAR)  */}
          {/* ===================================================== */}
          {pasoActual.id === "diseno" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Diseña tu tarjeta
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  Agrega hasta 3 imágenes, ajusta tamaño, rotación o transparencia, elige la tipografía y arrastra cada elemento a tu gusto.
                </p>
              </div>

              <LienzoDisenadorTarjeta
                negocio={negNorm}
                esCondolencias={esCondolencias}
                soloQr={false}
                incluirQrEnEsquina={incluirQrEnEsquina}
                qrDataUrl={qrDataUrl}
                mensaje={mensaje}
                firma={incluirFirma ? de : ""}
                diseno={diseno}
                onCambiarDiseno={(nuevo) => {
                  usuarioMovioDisenoRef.current = true;
                  setDiseno(nuevo);
                  marcarCambio();
                }}
                onError={(msg) => setErrorMsg(msg)}
              />
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 5: AUDIO (PREGUNTAR PRIMERO SI DESEA INCLUIRLO)  */}
          {/* ===================================================== */}
          {pasoActual.id === "audio" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  ¿Deseas incluir una canción?
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  Al abrir tu tarjeta digital, la melodía comenzará a sonar suavemente al 15% de volumen.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleToggleIncluirAudio(true)}
                  aria-pressed={incluirAudio}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: incluirAudio ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: incluirAudio ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.88rem" }}>
                      <Music size={15} />
                      <span>Sí, incluir audio</span>
                    </span>
                    {incluirAudio && <Check size={16} color="#2F4737" />}
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "#57524C" }}>
                    Pega un enlace de YouTube o sube tu archivo MP3.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleIncluirAudio(false)}
                  aria-pressed={!incluirAudio}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: !incluirAudio ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: !incluirAudio ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "0.88rem" }}>
                      <VolumeX size={15} />
                      <span>Sin audio</span>
                    </span>
                    {!incluirAudio && <Check size={16} color="#2F4737" />}
                  </div>
                  <span style={{ fontSize: "0.76rem", color: "#57524C" }}>
                    Solo mensaje y diseño, sin música de fondo.
                  </span>
                </button>
              </div>

              {incluirAudio && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label
                    htmlFor="eco-campo-musica-url"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#1F1C19",
                      marginBottom: "6px",
                    }}
                  >
                    Enlace de YouTube o audio MP3
                  </label>
                  <input
                    id="eco-campo-musica-url"
                    type="text"
                    value={musicaUrl}
                    onChange={(e) => {
                      setMusicaUrl(e.target.value);
                      marcarCambio();
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FDFCFB",
                      color: "#1F1C19",
                      fontSize: "16px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={subiendoMp3}
                    onClick={() => inputAudioRef.current?.click()}
                    title="Subir archivo MP3 de hasta 15 MB"
                    aria-label="Subir MP3"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FAF8F5",
                      color: "#1F1C19",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: subiendoMp3 ? "wait" : "pointer",
                    }}
                  >
                    {subiendoMp3 ? <Loader2 size={15} /> : <Upload size={15} />}
                    <span>{subiendoMp3 ? "Subiendo..." : "Subir MP3"}</span>
                  </button>
                  <input
                    ref={inputAudioRef}
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.ogg"
                    onChange={handleSubirAudio}
                    style={{ display: "none" }}
                  />

                  {musicaUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setMusicaUrl("");
                        setMusicaTitulo("");
                        setLyrics([]);
                        setTextoLyricsManual("");
                        marcarCambio();
                      }}
                      title="Quitar canción de la tarjeta"
                      aria-label="Quitar audio"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #FECACA",
                        backgroundColor: "#FEF2F2",
                        color: "#991B1B",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Quitar audio</span>
                    </button>
                  )}

                  <span style={{ fontSize: "0.75rem", color: "#78716C" }}>
                    Máximo 15 MB (MP3, M4A, WAV u OGG)
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="eco-campo-musica-titulo"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#1F1C19",
                      marginBottom: "6px",
                    }}
                  >
                    Artista y canción
                  </label>
                  <input
                    id="eco-campo-musica-titulo"
                    type="text"
                    value={musicaTitulo}
                    onChange={(e) => {
                      setMusicaTitulo(e.target.value);
                      marcarCambio();
                    }}
                    placeholder="Ej: Ed Sheeran - Perfect"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FDFCFB",
                      color: "#1F1C19",
                      fontSize: "16px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {musicaUrl.trim() && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      backgroundColor: "#EEF4F0",
                      border: "1px solid #C8D5CB",
                      color: "#2F4737",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    <Check size={15} />
                    <span>Audio listo para tu tarjeta digital.</span>
                  </div>
                )}
              </div>
              )}
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 6: LETRA / LYRIC (OPCIONAL — SOLO DEDICATORIA)   */}
          {/* ===================================================== */}
          {pasoActual.id === "letra" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Letra sincronizada (opcional)
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  Los versos aparecerán con elegancia debajo de tu tarjeta mientras suena la canción.
                </p>
              </div>

              {!musicaUrl.trim() ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    backgroundColor: "#FAF8F5",
                    border: "1px solid #E6E2DA",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#57524C", fontSize: "0.84rem" }}>
                    <Info size={16} />
                    <span>Aún no has agregado una canción. La letra solo se muestra cuando hay audio activo.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const idxAudio = pasos.findIndex((p) => p.id === "audio");
                      if (idxAudio >= 0) setPasoIdx(idxAudio);
                    }}
                    title="Volver al paso de Audio"
                    aria-label="Agregar audio"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "999px",
                      border: "1px solid #CFC8BC",
                      backgroundColor: "#FFFFFF",
                      color: "#1F1C19",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Music size={14} />
                    <span>Agregar audio</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={buscandoLyrics}
                      onClick={() => void handleBuscarLetra()}
                      title="Buscar letra automáticamente"
                      aria-label="Buscar letra"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "7px",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: "1px solid #2F4737",
                        backgroundColor: "#2F4737",
                        color: "#FFFFFF",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        cursor: buscandoLyrics ? "wait" : "pointer",
                      }}
                    >
                      {buscandoLyrics ? <Loader2 size={15} /> : <Sparkles size={15} />}
                      <span>{buscandoLyrics ? "Buscando..." : "Buscar letra"}</span>
                    </button>

                    {lyrics.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLyrics([]);
                          setTextoLyricsManual("");
                          marcarCambio();
                        }}
                        title="Borrar letra cargada"
                        aria-label="Limpiar letra"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #E2DDD4",
                          backgroundColor: "#FFFFFF",
                          color: "#57524C",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Limpiar letra</span>
                      </button>
                    )}

                    {lyrics.length > 0 && (
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#2F4737" }}>
                        {lyrics.length} líneas listas
                      </span>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="eco-campo-lyrics"
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#1F1C19",
                        marginBottom: "6px",
                      }}
                    >
                      Versos de la canción (puedes editar o pegar los tuyos)
                    </label>
                    <textarea
                      id="eco-campo-lyrics"
                      rows={7}
                      value={textoLyricsManual}
                      onChange={(e) => handleCambiarTextoLyrics(e.target.value)}
                      placeholder="Pulsa “Buscar letra” o pega aquí cada verso en una línea..."
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #CFC8BC",
                        backgroundColor: "#FDFCFB",
                        color: "#1F1C19",
                        fontSize: "15px",
                        lineHeight: 1.6,
                        boxSizing: "border-box",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 7: VISUALIZAR EN DÍPTICO 3D REAL                 */}
          {/* ===================================================== */}
          {pasoActual.id === "visualizar" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Así recibirá tu tarjeta
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  {esCondolencias
                    ? "Revisa cada detalle de tu tarjeta de condolencias antes de guardarla para taller."
                    : "Toca la portada para abrir el díptico y probar tu diseño, música y letra tal como la verá quien la reciba."}
                </p>
              </div>

              <div
                style={{
                  borderRadius: "16px",
                  backgroundColor: esCondolencias ? "#18181B" : "#0F172A",
                  backgroundImage: esCondolencias
                    ? "radial-gradient(ellipse at top, #27272A, #18181B 75%)"
                    : "radial-gradient(ellipse at top, #1E293B, #0F172A 78%)",
                  padding: "24px 12px 26px 12px",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <TarjetaDedicatoriaDigitalInteractiva
                  key={`preview-${musicaUrl}-${lyrics.length}`}
                  datosIniciales={datosVistaEnVivo}
                  token={datosIniciales.tokenVista}
                  modoEmbebido={true}
                />
              </div>
            </>
          )}

          {/* ===================================================== */}
          {/* PASO 8: IMPRIMIR MENSAJE, SOLO QR O AMBOS + GUARDAR   */}
          {/* ===================================================== */}
          {pasoActual.id === "imprimir" && (
            <>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: "#1F1C19",
                    letterSpacing: "-0.015em",
                  }}
                >
                  ¿Cómo imprimimos tu tarjeta física?
                </h1>
                <p style={{ margin: "6px 0 0 0", fontSize: "0.86rem", color: "#57524C", lineHeight: 1.5 }}>
                  Elige cómo deseas entregar tu tarjeta junto al arreglo floral.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px",
                }}
              >
                {/* Opción 1: Solo mensaje impreso */}
                <button
                  type="button"
                  onClick={() => handleSeleccionarModoImpresion("SOLO_MENSAJE")}
                  aria-pressed={modoImpresion === "SOLO_MENSAJE"}
                  style={{
                    padding: "16px 14px",
                    borderRadius: "14px",
                    border: modoImpresion === "SOLO_MENSAJE" ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: modoImpresion === "SOLO_MENSAJE" ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        backgroundColor: modoImpresion === "SOLO_MENSAJE" ? "#2F4737" : "#F3EFE8",
                        color: modoImpresion === "SOLO_MENSAJE" ? "#FFFFFF" : "#57524C",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FileText size={17} />
                    </div>
                    {modoImpresion === "SOLO_MENSAJE" && <Check size={17} color="#2F4737" />}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: "0.9rem", marginBottom: "4px" }}>
                      Solo mensaje impreso
                    </strong>
                    <span style={{ fontSize: "0.76rem", color: "#57524C", lineHeight: 1.45, display: "block" }}>
                      Imprimimos tu dedicatoria, firma y diseño en la cartulina física (sin código QR).
                    </span>
                  </div>
                </button>

                {/* Opción 2: Solo QR (Digital) */}
                <button
                  type="button"
                  onClick={() => handleSeleccionarModoImpresion("SOLO_QR")}
                  aria-pressed={modoImpresion === "SOLO_QR"}
                  style={{
                    padding: "16px 14px",
                    borderRadius: "14px",
                    border: modoImpresion === "SOLO_QR" ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: modoImpresion === "SOLO_QR" ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        backgroundColor: modoImpresion === "SOLO_QR" ? "#2F4737" : "#F3EFE8",
                        color: modoImpresion === "SOLO_QR" ? "#FFFFFF" : "#57524C",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <QrCode size={17} />
                    </div>
                    {modoImpresion === "SOLO_QR" && <Check size={17} color="#2F4737" />}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: "0.9rem", marginBottom: "4px" }}>
                      Solo QR (Digital)
                    </strong>
                    <span style={{ fontSize: "0.76rem", color: "#57524C", lineHeight: 1.45, display: "block" }}>
                      Cartulina discreta solo con QR. Al escanearlo se abre el díptico digital con tus fotos y música.
                    </span>
                  </div>
                </button>

                {/* Opción 3: Ambos — Tarjeta impresa + QR para tarjeta digital */}
                <button
                  type="button"
                  onClick={() => handleSeleccionarModoImpresion("MENSAJE_Y_QR")}
                  aria-pressed={modoImpresion === "MENSAJE_Y_QR"}
                  style={{
                    padding: "16px 14px",
                    borderRadius: "14px",
                    border: modoImpresion === "MENSAJE_Y_QR" ? "2px solid #2F4737" : "1px solid #DDD7CD",
                    backgroundColor: modoImpresion === "MENSAJE_Y_QR" ? "#EEF4F0" : "#FFFFFF",
                    color: "#1F1C19",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        backgroundColor: modoImpresion === "MENSAJE_Y_QR" ? "#2F4737" : "#F3EFE8",
                        color: modoImpresion === "MENSAJE_Y_QR" ? "#FFFFFF" : "#57524C",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Layers size={17} />
                    </div>
                    {modoImpresion === "MENSAJE_Y_QR" && <Check size={17} color="#2F4737" />}
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: "0.9rem", marginBottom: "4px" }}>
                      Mensaje + QR digital
                    </strong>
                    <span style={{ fontSize: "0.76rem", color: "#57524C", lineHeight: 1.45, display: "block" }}>
                      Imprimimos tu mensaje en la cartulina e incluimos un QR discreto para abrir la tarjeta digital.
                    </span>
                  </div>
                </button>
              </div>

              {/* Sugerencia inteligente si agregó música pero eligió solo mensaje impreso */}
              {incluirAudio && musicaUrl.trim() && modoImpresion === "SOLO_MENSAJE" && (
                <div
                  style={{
                    padding: "11px 14px",
                    borderRadius: "10px",
                    backgroundColor: "#FAF8F5",
                    border: "1px solid #E2DDD4",
                    color: "#57524C",
                    fontSize: "0.78rem",
                    lineHeight: 1.45,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <Info size={15} style={{ flexShrink: 0, marginTop: "2px", color: "#2F4737" }} />
                  <span>
                    Agregaste una canción a tu tarjeta. Si eliges <strong>Mensaje + QR digital</strong> o <strong>Solo QR</strong>, quien la reciba podrá escanear la cartulina y escucharla.
                  </span>
                </div>
              )}

              {/* Visualizador en vivo de la parte interior tal como se imprimirá en cartulina */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "14px",
                  borderRadius: "14px",
                  backgroundColor: "#FAF8F5",
                  border: "1px solid #E6E2DA",
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
                  <strong style={{ fontSize: "0.82rem", color: "#1F1C19" }}>
                    Así se imprimirá el interior de tu tarjeta
                  </strong>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: "#2F4737",
                      backgroundColor: "#EEF4F0",
                      padding: "3px 9px",
                      borderRadius: "999px",
                    }}
                  >
                    {modoImpresion === "SOLO_QR"
                      ? "Solo QR (Digital)"
                      : modoImpresion === "MENSAJE_Y_QR"
                        ? "Mensaje + QR digital"
                        : "Solo mensaje impreso"}
                  </span>
                </div>

                <LienzoDisenadorTarjeta
                  negocio={negNorm}
                  esCondolencias={esCondolencias}
                  soloQr={soloQrEfectivo}
                  incluirQrEnEsquina={incluirQrEnEsquina}
                  qrDataUrl={qrDataUrl}
                  mensaje={mensaje}
                  firma={incluirFirma ? de : ""}
                  diseno={disenoNormalizado}
                  onCambiarDiseno={() => {}}
                  soloLectura={true}
                />
              </div>
            </>
          )}

          {/* Mensajes de estado dentro del paso */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: "10px 13px",
                borderRadius: "10px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          {exitoMsg && (
            <div
              role="status"
              style={{
                padding: "10px 13px",
                borderRadius: "10px",
                backgroundColor: "#EEF4F0",
                border: "1px solid #C8D5CB",
                color: "#2F4737",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Check size={15} />
              <span>{exitoMsg}</span>
            </div>
          )}

          {/* Barra inferior de navegación del wizard */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              paddingTop: "12px",
              borderTop: "1px solid #EFECE6",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={pasoIdx === 0 ? () => setModo("vista") : handlePasoAnterior}
              title={pasoIdx === 0 ? "Volver a la vista 3D" : "Ir al paso anterior"}
              aria-label={pasoIdx === 0 ? "Volver" : "Anterior"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "11px 16px",
                borderRadius: "10px",
                border: "1px solid #DDD7CD",
                backgroundColor: "#FFFFFF",
                color: "#1F1C19",
                fontSize: "0.84rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={16} />
              <span>{pasoIdx === 0 ? "Volver" : "Anterior"}</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {pasoActual.opcional && !esUltimoPaso && (
                <button
                  type="button"
                  onClick={handleSiguientePaso}
                  title="Omitir este paso opcional"
                  aria-label="Omitir"
                  style={{
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#57524C",
                    fontSize: "0.84rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Omitir
                </button>
              )}

              {esUltimoPaso ? (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void handleGuardar()}
                  title="Guardar tarjeta para taller"
                  aria-label="Guardar tarjeta"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "12px 22px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#2F4737",
                    color: "#FFFFFF",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: guardando ? "wait" : "pointer",
                    boxShadow: "0 6px 18px rgba(47, 71, 55, 0.25)",
                  }}
                >
                  {guardando ? <Loader2 size={16} /> : <Save size={16} />}
                  <span>{guardando ? "Guardando..." : "Guardar tarjeta"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSiguientePaso}
                  title="Continuar al siguiente paso"
                  aria-label="Siguiente"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "11px 20px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: "#221E1B",
                    color: "#FFFFFF",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span>Siguiente</span>
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: "0.73rem", color: "#78716C" }}>
          {nombreMarca} · Puedes editar tu tarjeta hasta que ingrese a impresión en taller
        </div>
      </div>
    </div>
  );
}
