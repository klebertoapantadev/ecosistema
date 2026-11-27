"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Gift,
  Layers,
  ListMusic,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Monitor,
  Music,
  Package,
  PanelRight,
  Pause,
  PictureInPicture2,
  Play,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  actualizarEstadoOrdenTvAction,
  buscarEmisorasRadioTvAction,
  buscarVideosYoutubeTvAction,
  extraerImagenesAlbumGoogleFotosAction,
  guardarConfigTvTallerAction,
  obtenerTableroTvTallerAction,
  type ResultadoBusquedaYoutubeTv,
} from "../acciones-operaciones-taller";
import {
  CONFIG_TV_TALLER_DEFECTO,
  extraerYoutubeVideoOPlaylist,
  formatearHorarioEntregaOrden,
  ordenarPedidosPorPrioridadTaller,
  parsearColoresPedido,
  type ConfiguracionTvTaller,
  type DatosTableroTvTaller,
  type DensidadLayoutTv,
  type EmisoraRadioTv,
  type FavoritoYoutubeTv,
  type FuenteMediaTv,
  type ModoPantallaTv,
  type OrdenTvTaller,
  type PosicionLateralTv,
} from "../operaciones-taller";

export interface PropsPantallaTvTaller {
  negocio: string;
  nombreNegocio: string;
  colorMarca?: string;
  tokenKiosco?: string | null;
  datosIniciales?: DatosTableroTvTaller | null;
}

interface SlideShowroomEvento {
  id: string;
  tipo: "PRODUCTO" | "GOOGLE_FOTOS";
  titulo: string;
  subtitulo: string;
  descripcion?: string;
  imagenUrl: string;
  precioDesde?: number;
  qrUrl?: string;
  etiquetaAlbum?: string;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          width?: string | number;
          height?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onError?: (e: { data: number; target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number; target: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  destroy?: () => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  nextVideo?: () => void;
  setVolume?: (vol: number) => void;
  getVolume?: () => number;
  mute?: () => void;
  unMute?: () => void;
  loadVideoById?: (id: string) => void;
  loadPlaylist?: (opts: { list: string; listType: string; index?: number }) => void;
}

function reproducirCampanaTv(urgente = false) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notas = urgente ? [587.33, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99];
    notas.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + idx * 0.14;
      gain.gain.setValueAtTime(0.001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.28, inicio + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.45);
    });
  } catch {
    // El navegador puede requerir una interacción previa para audio WebAudio
  }
}

function formatearHoraEcuador(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toTimeString().slice(0, 5);
  }
}

function formatearFechaEcuadorLarga(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return "";
  }
}

export function PantallaTvTaller({
  negocio,
  nombreNegocio,
  colorMarca = "#0D9488",
  tokenKiosco = null,
  datosIniciales = null,
}: PropsPantallaTvTaller) {
  const negNorm = negocio.trim().toLowerCase();

  const [tablero, setTablero] = useState<DatosTableroTvTaller>(
    datosIniciales ?? {
      modoAcceso: tokenKiosco ? "KIOSCO" : "AUTENTICADO",
      puedeInteractuar: true,
      hoyYmd: "",
      ordenes: [],
      productosEventos: [],
      configTv: CONFIG_TV_TALLER_DEFECTO,
    }
  );
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);
  const [conectado, setConectado] = useState<boolean>(true);
  const [reloj, setReloj] = useState<Date>(() => new Date());

  // Ventana flotante SIEMPRE ENCIMA (Document Picture-in-Picture en Chrome/Edge) para usar sobre youtube.com real
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);

  // Overrides locales rápidos en la TV (sin tener que abrir el celular)
  const [modoLocal, setModoLocal] = useState<ModoPantallaTv | null>(null);
  const [fuenteMediaLocal, setFuenteMediaLocal] = useState<FuenteMediaTv | null>(null);
  const [modoBarraLateral, setModoBarraLateral] = useState<boolean>(false);
  const [ladoLocal, setLadoLocal] = useState<PosicionLateralTv | null>(null);
  const [densidadLocal, setDensidadLocal] = useState<DensidadLayoutTv | null>(null);
  const [mostrarListosLocal, setMostrarListosLocal] = useState<boolean | null>(null);
  const [sonidoLocal, setSonidoLocal] = useState<boolean | null>(null);
  const [youtubeUrlLocal, setYoutubeUrlLocal] = useState<string | null>(null);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);

  // Radio en Vivo (Ecuador y géneros, 0 bloqueos de disquera)
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const [emisorasRadio, setEmisorasRadio] = useState<EmisoraRadioTv[]>([]);
  const [emisoraActual, setEmisoraActual] = useState<EmisoraRadioTv | null>(
    datosIniciales?.configTv.radioActual ?? null
  );
  const [radioReproduciendo, setRadioReproduciendo] = useState<boolean>(false);
  const [cargandoRadios, setCargandoRadios] = useState<boolean>(false);
  const [consultaRadio, setConsultaRadio] = useState<string>("");
  const [errorRadio, setErrorRadio] = useState<string | null>(null);
  const [radiosFavoritasLocal, setRadiosFavoritasLocal] = useState<EmisoraRadioTv[]>(
    datosIniciales?.configTv.radiosFavoritas ?? []
  );

  // Buscador, Cola ("A continuación"), Sugerencias y Favoritos de YouTube en la TV
  const [abiertoBuscadorYt, setAbiertoBuscadorYt] = useState<boolean>(false);
  const [tabModalYt, setTabModalYt] = useState<"radio" | "buscar" | "favoritos" | "cola">("radio");
  const [consultaYt, setConsultaYt] = useState<string>("");
  const [buscandoYt, setBuscandoYt] = useState<boolean>(false);
  const [errorYtBusqueda, setErrorYtBusqueda] = useState<string | null>(null);
  const [resultadosYt, setResultadosYt] = useState<ResultadoBusquedaYoutubeTv[]>([]);
  const [colaYt, setColaYt] = useState<ResultadoBusquedaYoutubeTv[]>([]);
  const [indiceColaYt, setIndiceColaYt] = useState<number>(-1);
  const [favoritosLocales, setFavoritosLocales] = useState<FavoritoYoutubeTv[]>(
    datosIniciales?.configTv.favoritosYoutube ?? []
  );
  const [avisoSaltoYt, setAvisoSaltoYt] = useState<string | null>(null);
  const [errorReproductorYt, setErrorReproductorYt] = useState<boolean>(false);
  const saltosConsecutivosRef = useRef<number>(0);
  const colaYtRef = useRef<ResultadoBusquedaYoutubeTv[]>([]);
  const indiceColaYtRef = useRef<number>(-1);

  // Navegación D-Pad / Control Remoto TV
  const [indiceFoco, setIndiceFoco] = useState<number>(0);
  const [paginaPendientes, setPaginaPendientes] = useState<number>(0);
  const [ordenConfirmandoListo, setOrdenConfirmandoListo] = useState<OrdenTvTaller | null>(null);
  const [botonConfirmFoco, setBotonConfirmFoco] = useState<"SI" | "NO">("SI");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Banner de alerta al llegar pedido nuevo
  const [alertaNuevoPedido, setAlertaNuevoPedido] = useState<{
    codigo: string;
    resumen: string;
    urgente: boolean;
  } | null>(null);

  // Showroom Eventos: fotos extraídas de álbumes de Google Fotos + carrusel
  const [fotosPorAlbum, setFotosPorAlbum] = useState<Record<string, string[]>>({});
  const [filtroShowroom, setFiltroShowroom] = useState<string>("TODOS");
  const [indiceSlide, setIndiceSlide] = useState<number>(0);
  const [pausadoShowroom, setPausadoShowroom] = useState<boolean>(false);

  // Refs YouTube IFrame API & Audio Ducking
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytUrlCargadaRef = useRef<string>("");
  const idsPreviosRef = useRef<Set<string>>(
    new Set((datosIniciales?.ordenes ?? []).map((o) => o.id))
  );
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preferencias efectivas (local override -> config remota)
  const cfg = tablero.configTv;
  const esOperadorOAdmin = Boolean(tablero.esOperadorOAdmin);
  const modoActivo: ModoPantallaTv = modoLocal ?? cfg.modoActivo;
  const fuenteMediaRaw: FuenteMediaTv = fuenteMediaLocal ?? cfg.fuenteMedia ?? "RADIO";
  // Seguridad UI: el modo INDICADORES solo puede activarse para operadores/administradores
  const fuenteMedia: FuenteMediaTv =
    fuenteMediaRaw === "INDICADORES" && !esOperadorOAdmin ? "RADIO" : fuenteMediaRaw;
  const posicionLateral: PosicionLateralTv = ladoLocal ?? cfg.posicionLateral;
  const densidadConfig: DensidadLayoutTv = densidadLocal ?? cfg.densidadLayout;
  const mostrarFranjaListos: boolean = mostrarListosLocal ?? cfg.mostrarFranjaListos;
  const sonidoAlertas: boolean = sonidoLocal ?? cfg.sonidoAlertas;
  const youtubeUrlActual =
    youtubeUrlLocal ??
    (modoActivo === "EVENTOS" ? cfg.youtubeUrlEventosAudio : cfg.youtubeUrlTaller);

  // Detectar ?modo=lateral en la URL (para ventana acoplable junto a youtube.com)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("modo") === "lateral") {
        setModoBarraLateral(true);
      }
    } catch {
      // Ignorar
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(cfg.radiosFavoritas)) {
      setRadiosFavoritasLocal(cfg.radiosFavoritas);
    }
    if (cfg.radioActual && !emisoraActual) {
      setEmisoraActual(cfg.radioActual);
    }
  }, [cfg.radioActual, cfg.radiosFavoritas, emisoraActual]);

  const cargarEmisorasRadio = useCallback(
    async (filtro: { consulta?: string; pais?: string; genero?: string }, autoReproducirPrimera = false) => {
      setCargandoRadios(true);
      setErrorRadio(null);
      const res = await buscarEmisorasRadioTvAction(filtro);
      setCargandoRadios(false);
      if (!res.ok) {
        setErrorRadio(res.error);
        return;
      }
      setEmisorasRadio(res.emisoras);
      if (autoReproducirPrimera && res.emisoras.length > 0) {
        const primera = res.emisoras[0]!;
        setEmisoraActual(primera);
        setFuenteMediaLocal("RADIO");
        setTimeout(() => {
          const el = radioAudioRef.current;
          if (el) {
            el.src = primera.streamUrl;
            el.volume = Math.max(0, Math.min(1, (cfg.volumenYoutube || 75) / 100));
            void el.play().then(() => setRadioReproduciendo(true)).catch(() => setRadioReproduciendo(false));
          }
        }, 60);
      }
    },
    [cfg.volumenYoutube]
  );

  // Cargar catálogo inicial de emisoras de Ecuador cuando estamos en fuente RADIO
  useEffect(() => {
    if (fuenteMedia === "RADIO" && emisorasRadio.length === 0 && !cargandoRadios && !modoBarraLateral) {
      void cargarEmisorasRadio({ pais: "EC" }, false);
    }
  }, [cargandoRadios, cargarEmisorasRadio, emisorasRadio.length, fuenteMedia, modoBarraLateral]);

  const reproducirEmisoraRadio = useCallback(
    (emisora: EmisoraRadioTv, cerrarModal = true) => {
      setEmisoraActual(emisora);
      setFuenteMediaLocal("RADIO");
      setErrorRadio(null);
      if (cerrarModal) setAbiertoBuscadorYt(false);
      // Pausar YouTube si estaba sonando
      try {
        ytPlayerRef.current?.pauseVideo?.();
      } catch {
        // Ignorar
      }
      setTimeout(() => {
        const el = radioAudioRef.current;
        if (!el) return;
        el.src = emisora.streamUrl;
        el.volume = Math.max(0, Math.min(1, (cfg.volumenYoutube || 75) / 100));
        void el
          .play()
          .then(() => setRadioReproduciendo(true))
          .catch(() => {
            setRadioReproduciendo(false);
            setErrorRadio("Haz clic en Play para iniciar el audio de la emisora.");
          });
      }, 40);

      if (tablero.modoAcceso === "AUTENTICADO") {
        void guardarConfigTvTallerAction({
          negocio: negNorm,
          config: { fuenteMedia: "RADIO", radioActual: emisora },
        });
      }
    },
    [cfg.volumenYoutube, negNorm, tablero.modoAcceso]
  );

  const togglePlayPausaRadio = useCallback(() => {
    const el = radioAudioRef.current;
    if (!el) return;
    if (radioReproduciendo) {
      el.pause();
      setRadioReproduciendo(false);
      return;
    }
    const objetivo = emisoraActual ?? emisorasRadio[0] ?? null;
    if (!objetivo) {
      void cargarEmisorasRadio({ pais: "EC" }, true);
      return;
    }
    if (!el.src || el.src !== objetivo.streamUrl) {
      el.src = objetivo.streamUrl;
    }
    el.volume = Math.max(0, Math.min(1, (cfg.volumenYoutube || 75) / 100));
    void el
      .play()
      .then(() => {
        setEmisoraActual(objetivo);
        setRadioReproduciendo(true);
        setErrorRadio(null);
      })
      .catch(() => {
        setErrorRadio("Esta emisora no respondió. Prueba otra emisora de la lista.");
      });
  }, [cargarEmisorasRadio, cfg.volumenYoutube, emisoraActual, emisorasRadio, radioReproduciendo]);

  const cambiarEmisoraRadio = useCallback(
    (delta: number) => {
      const lista = emisorasRadio.length > 0 ? emisorasRadio : radiosFavoritasLocal;
      if (lista.length === 0) return;
      const idxActual = emisoraActual ? lista.findIndex((e) => e.id === emisoraActual.id) : -1;
      const siguiente = (idxActual + delta + lista.length) % lista.length;
      const elegida = lista[siguiente];
      if (elegida) reproducirEmisoraRadio(elegida, false);
    },
    [emisoraActual, emisorasRadio, radiosFavoritasLocal, reproducirEmisoraRadio]
  );

  const toggleRadioFavorita = useCallback(
    async (emisora: EmisoraRadioTv) => {
      const yaExiste = radiosFavoritasLocal.some((r) => r.streamUrl === emisora.streamUrl);
      const nuevas = yaExiste
        ? radiosFavoritasLocal.filter((r) => r.streamUrl !== emisora.streamUrl)
        : [emisora, ...radiosFavoritasLocal];
      setRadiosFavoritasLocal(nuevas);
      if (tablero.modoAcceso === "AUTENTICADO") {
        await guardarConfigTvTallerAction({
          negocio: negNorm,
          config: { radiosFavoritas: nuevas },
        });
      }
    },
    [negNorm, radiosFavoritasLocal, tablero.modoAcceso]
  );

  const abrirVentanaBarraLateral = useCallback(() => {
    if (typeof window === "undefined") return;
    const base = window.location.pathname;
    const sp = new URLSearchParams(window.location.search);
    sp.set("modo", "lateral");
    const ancho = 420;
    const alto = window.screen?.availHeight || 960;
    const left = Math.max(0, (window.screen?.availWidth || 1440) - ancho);
    const popup = window.open(
      `${base}?${sp.toString()}`,
      "eco_tv_taller_lateral",
      `width=${ancho},height=${alto},left=${left},top=0,resizable=yes,scrollbars=yes`
    );
    if (!popup) {
      setModoBarraLateral(true);
    }
  }, []);

  const toggleFlotarSobreYoutube = useCallback(
    async (abrirYoutubeUrl?: string) => {
      if (typeof window === "undefined") return;
      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
        setPipWindow(null);
        setPipContainer(null);
        return;
      }

      const dpip = (
        window as unknown as {
          documentPictureInPicture?: {
            requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window>;
          };
        }
      ).documentPictureInPicture;

      if (dpip?.requestWindow) {
        try {
          const win = await dpip.requestWindow({ width: 390, height: 820 });
          win.document.title = `Pedidos Taller — ${nombreNegocio}`;
          win.document.body.style.margin = "0";
          win.document.body.style.padding = "0";
          win.document.body.style.background = "#14110F";
          win.document.body.style.color = "#F6F1E8";
          win.document.body.style.fontFamily =
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          const root = win.document.createElement("div");
          root.style.width = "100%";
          root.style.height = "100vh";
          root.style.display = "flex";
          root.style.flexDirection = "column";
          win.document.body.appendChild(root);

          win.addEventListener("pagehide", () => {
            setPipWindow(null);
            setPipContainer(null);
          });

          setPipWindow(win);
          setPipContainer(root);

          if (abrirYoutubeUrl) {
            window.open(abrirYoutubeUrl, "_blank", "noopener,noreferrer");
          }
          return;
        } catch {
          // Si el navegador rechazó Document PiP, usar ventana acoplable
        }
      }

      abrirVentanaBarraLateral();
      if (abrirYoutubeUrl) {
        window.open(abrirYoutubeUrl, "_blank", "noopener,noreferrer");
      }
    },
    [abrirVentanaBarraLateral, nombreNegocio, pipWindow]
  );

  useEffect(() => {
    return () => {
      try {
        if (pipWindow && !pipWindow.closed) pipWindow.close();
      } catch {
        // Ignorar
      }
    };
  }, [pipWindow]);

  useEffect(() => {
    colaYtRef.current = colaYt;
    indiceColaYtRef.current = indiceColaYt;
  }, [colaYt, indiceColaYt]);

  useEffect(() => {
    if (Array.isArray(cfg.favoritosYoutube)) {
      setFavoritosLocales(cfg.favoritosYoutube);
    }
  }, [cfg.favoritosYoutube]);

  const aplicarNuevaUrlYoutube = useCallback(
    async (nuevaUrl: string, cerrarModal = true) => {
      const limpia = nuevaUrl.trim();
      if (!limpia) return;
      // Pausar radio si estaba sonando
      try {
        radioAudioRef.current?.pause();
        setRadioReproduciendo(false);
      } catch {
        // Ignorar
      }
      setFuenteMediaLocal("YOUTUBE");
      setYoutubeUrlLocal(limpia);
      setErrorReproductorYt(false);
      if (cerrarModal) setAbiertoBuscadorYt(false);
      // Persistir en configuración del negocio si el usuario tiene sesión autenticada
      if (tablero.modoAcceso === "AUTENTICADO") {
        void guardarConfigTvTallerAction({
          negocio: negNorm,
          config:
            modoActivo === "EVENTOS"
              ? { fuenteMedia: "YOUTUBE", youtubeUrlEventosAudio: limpia }
              : { fuenteMedia: "YOUTUBE", youtubeUrlTaller: limpia },
        });
      }
    },
    [modoActivo, negNorm, tablero.modoAcceso]
  );

  const reproducirDesdeListaYt = useCallback(
    (lista: ResultadoBusquedaYoutubeTv[], indice: number, cerrarModal = true) => {
      const item = lista[indice];
      if (!item) return;
      saltosConsecutivosRef.current = 0;
      setColaYt(lista);
      setIndiceColaYt(indice);
      colaYtRef.current = lista;
      indiceColaYtRef.current = indice;
      void aplicarNuevaUrlYoutube(item.url, cerrarModal);
    },
    [aplicarNuevaUrlYoutube]
  );

  const siguienteCancionYt = useCallback(
    (porBloqueo = false) => {
      const lista = colaYtRef.current;
      const idxActual = indiceColaYtRef.current;
      if (lista.length > 1 && idxActual >= 0) {
        if (porBloqueo) {
          saltosConsecutivosRef.current += 1;
          if (saltosConsecutivosRef.current >= Math.min(lista.length, 6)) {
            setAvisoSaltoYt(null);
            setErrorReproductorYt(true);
            return;
          }
        } else {
          saltosConsecutivosRef.current = 0;
        }
        const siguienteIdx = (idxActual + 1) % lista.length;
        const nextItem = lista[siguienteIdx];
        if (nextItem) {
          setIndiceColaYt(siguienteIdx);
          indiceColaYtRef.current = siguienteIdx;
          if (porBloqueo) {
            setAvisoSaltoYt(`Disquera bloqueó esa canción → Saltando a: ${nextItem.titulo}`);
            setTimeout(() => setAvisoSaltoYt(null), 4500);
          }
          void aplicarNuevaUrlYoutube(nextItem.url, false);
          return;
        }
      }
      // Fallback: si es una playlist nativa de YouTube, avanzar en el player
      try {
        ytPlayerRef.current?.nextVideo?.();
      } catch {
        // Ignorar
      }
    },
    [aplicarNuevaUrlYoutube]
  );

  const anteriorCancionYt = useCallback(() => {
    const lista = colaYtRef.current;
    const idxActual = indiceColaYtRef.current;
    if (lista.length > 1 && idxActual >= 0) {
      saltosConsecutivosRef.current = 0;
      const prevIdx = (idxActual - 1 + lista.length) % lista.length;
      const prevItem = lista[prevIdx];
      if (prevItem) {
        setIndiceColaYt(prevIdx);
        indiceColaYtRef.current = prevIdx;
        void aplicarNuevaUrlYoutube(prevItem.url, false);
      }
    }
  }, [aplicarNuevaUrlYoutube]);

  const toggleFavoritoYt = useCallback(
    async (item: { titulo: string; url: string; canal?: string; miniaturaUrl?: string }) => {
      const yaExiste = favoritosLocales.some((f) => f.url === item.url);
      const nuevos: FavoritoYoutubeTv[] = yaExiste
        ? favoritosLocales.filter((f) => f.url !== item.url)
        : [
            {
              id: `fav-${Date.now()}`,
              titulo: item.titulo || "Música favorita",
              url: item.url,
              canal: item.canal,
              miniaturaUrl: item.miniaturaUrl,
            },
            ...favoritosLocales,
          ];
      setFavoritosLocales(nuevos);
      if (tablero.modoAcceso === "AUTENTICADO") {
        await guardarConfigTvTallerAction({
          negocio: negNorm,
          config: { favoritosYoutube: nuevos },
        });
      }
    },
    [favoritosLocales, negNorm, tablero.modoAcceso]
  );

  const cancionActualCola =
    indiceColaYt >= 0 && colaYt[indiceColaYt] ? colaYt[indiceColaYt] : null;
  const esActualFavorito = favoritosLocales.some((f) => f.url === youtubeUrlActual);

  const ejecutarBusquedaOUrlYoutube = useCallback(
    async (textoManual?: string) => {
      const texto = String(textoManual ?? consultaYt).trim();
      if (!texto) return;

      // Si pegaron o digitaron una URL de YouTube (o ID de 11 caracteres), reproducir directo
      const parsed = extraerYoutubeVideoOPlaylist(texto);
      if (parsed.videoId || parsed.playlistId) {
        await aplicarNuevaUrlYoutube(texto);
        return;
      }

      // Caso contrario, buscar en YouTube por palabras clave
      setBuscandoYt(true);
      setErrorYtBusqueda(null);
      const res = await buscarVideosYoutubeTvAction(texto);
      setBuscandoYt(false);
      if (!res.ok) {
        setErrorYtBusqueda(res.error);
        setResultadosYt([]);
        return;
      }
      setResultadosYt(res.resultados);
    },
    [aplicarNuevaUrlYoutube, consultaYt]
  );

  // Reloj en vivo cada 15s
  useEffect(() => {
    const t = setInterval(() => setReloj(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Auto-ocultar barra HUD tras 5s sin mover el mouse
  const despertarHud = useCallback(() => {
    setHudVisible(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setHudVisible(false), 5500);
  }, []);

  useEffect(() => {
    despertarHud();
    const onMove = () => despertarHud();
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [despertarHud]);

  // Audio ducking en YouTube + campana + banner al entrar pedido nuevo
  const dispararAlertaNuevoPedido = useCallback(
    (orden: { codigo: string; productoResumen: string; clasificacionPedido?: string; origenTipo?: string }) => {
      const urgente =
        orden.clasificacionPedido === "EXEQUIALES" || orden.origenTipo === "EXEQUIALES_LLAMADA";
      setAlertaNuevoPedido({
        codigo: orden.codigo,
        resumen: orden.productoResumen,
        urgente,
      });

      if (sonidoAlertas) {
        const player = ytPlayerRef.current;
        const radioEl = radioAudioRef.current;
        const volOriginal = cfg.volumenYoutube || 75;
        try {
          player?.setVolume?.(16);
          if (radioEl && !radioEl.paused) radioEl.volume = 0.14;
        } catch {
          // Ignorar
        }
        reproducirCampanaTv(urgente);
        if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
        duckTimerRef.current = setTimeout(() => {
          try {
            player?.setVolume?.(volOriginal);
            if (radioEl) radioEl.volume = Math.max(0, Math.min(1, volOriginal / 100));
          } catch {
            // Ignorar
          }
        }, 5200);
      }

      setTimeout(() => {
        setAlertaNuevoPedido((prev) => (prev?.codigo === orden.codigo ? null : prev));
      }, 7500);
    },
    [cfg.volumenYoutube, sonidoAlertas]
  );

  // Recarga de datos desde servidor
  const recargarTablero = useCallback(
    async (silencioso = true) => {
      const res = await obtenerTableroTvTallerAction(negNorm, tokenKiosco);
      if (!res.ok) {
        setConectado(false);
        if (!silencioso) setErrorAcceso(res.error);
        return;
      }
      setConectado(true);
      setErrorAcceso(null);

      // Detectar pedidos nuevos entrantes a taller para disparar alerta sonora + ducking
      const nuevosPendientes = res.datos.ordenes.filter(
        (o) =>
          (o.estadoTaller === "ENVIADO_TALLER" || o.estadoTaller === "EN_PREPARACION") &&
          !idsPreviosRef.current.has(o.id)
      );
      if (idsPreviosRef.current.size > 0 && nuevosPendientes.length > 0) {
        dispararAlertaNuevoPedido(nuevosPendientes[0]!);
      }
      idsPreviosRef.current = new Set(res.datos.ordenes.map((o) => o.id));

      // Si el remoto actualizó configTv (ej. cambiaron modo o YouTube desde celular), limpiar overrides locales
      setTablero((prev) => {
        if (prev.configTv.actualizadoEn !== res.datos.configTv.actualizadoEn) {
          setModoLocal(null);
          setLadoLocal(null);
          setDensidadLocal(null);
          setMostrarListosLocal(null);
          setYoutubeUrlLocal(null);
        }
        return res.datos;
      });
    },
    [dispararAlertaNuevoPedido, negNorm, tokenKiosco]
  );

  // Carga inicial si no hubo datosIniciales
  useEffect(() => {
    if (!datosIniciales) {
      void recargarTablero(false);
    }
  }, [datosIniciales, recargarTablero]);

  // Suscripción Supabase Realtime (órdenes + config remota + broadcast) + respaldo 45s
  useEffect(() => {
    const supabase = crearClienteNavegador();
    let realtimeActivo = false;
    let ultimoRespaldoMs = Date.now();
    const canal = supabase
      .channel(`tv_taller_live_${negNorm}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "comun_comercio",
          table: "com_orden_taller",
          filter: `ota_negocio=eq.${negNorm}`,
        },
        () => {
          ultimoRespaldoMs = Date.now();
          void recargarTablero(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "comun_configuracion",
          table: "cfg_negocio",
        },
        () => {
          ultimoRespaldoMs = Date.now();
          void recargarTablero(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "comun_agentes",
          table: "agc_conversacion",
        },
        () => {
          if (esOperadorOAdmin) {
            ultimoRespaldoMs = Date.now();
            void recargarTablero(true);
          }
        }
      )
      .on("broadcast", { event: "nuevo_pedido_taller" }, () => {
        ultimoRespaldoMs = Date.now();
        void recargarTablero(true);
      })
      .subscribe((status) => {
        realtimeActivo = status === "SUBSCRIBED";
        setConectado(realtimeActivo);
      });

    // Respaldo adaptativo para TV/kiosco: Realtime entrega cambios al instante;
    // cada 3 min si Realtime está activo, 45 s si se desconecta; pausado si la pestaña está oculta.
    const intervalo = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const intervaloObjetivoMs = realtimeActivo ? 180000 : 45000;
      if (Date.now() - ultimoRespaldoMs >= intervaloObjetivoMs) {
        ultimoRespaldoMs = Date.now();
        void recargarTablero(true);
      }
    }, 45000);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimoRespaldoMs >= 20000) {
        ultimoRespaldoMs = Date.now();
        void recargarTablero(true);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", alCambiarVisibilidad);
    }

    return () => {
      clearInterval(intervalo);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      }
      void supabase.removeChannel(canal);
    };
  }, [esOperadorOAdmin, negNorm, recargarTablero]);

  // YouTube IFrame API loader & controller (solo cuando fuenteMedia === "YOUTUBE" y no está en Barra Lateral)
  useEffect(() => {
    if (modoBarraLateral || fuenteMedia !== "YOUTUBE") {
      try {
        ytPlayerRef.current?.pauseVideo?.();
      } catch {
        // Ignorar
      }
      return;
    }
    if (!youtubeUrlActual) return;
    const { videoId, playlistId } = extraerYoutubeVideoOPlaylist(youtubeUrlActual);
    if (!videoId && !playlistId) return;

    const inicializarPlayer = () => {
      if (!ytContainerRef.current || !window.YT?.Player) return;

      // Si ya existe el player y solo cambió la URL, cargar nuevo video/playlist sin destruir
      if (ytPlayerRef.current && ytUrlCargadaRef.current !== youtubeUrlActual) {
        try {
          if (playlistId && !videoId) {
            ytPlayerRef.current.loadPlaylist?.({ list: playlistId, listType: "playlist", index: 0 });
          } else if (videoId) {
            ytPlayerRef.current.loadVideoById?.(videoId);
          }
          ytPlayerRef.current.setVolume?.(cfg.volumenYoutube);
          ytUrlCargadaRef.current = youtubeUrlActual;
          return;
        } catch {
          // Recrear abajo si falla
        }
      }

      if (ytPlayerRef.current && ytUrlCargadaRef.current === youtubeUrlActual) {
        ytPlayerRef.current.setVolume?.(cfg.volumenYoutube);
        return;
      }

      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        // Ignorar
      }

      const playerVars: Record<string, string | number> = {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
        loop: 1,
      };
      if (playlistId) {
        playerVars.listType = "playlist";
        playerVars.list = playlistId;
      } else if (videoId) {
        playerVars.playlist = videoId;
      }

      ytUrlCargadaRef.current = youtubeUrlActual;
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        width: "100%",
        height: "100%",
        videoId: videoId ?? undefined,
        playerVars,
        events: {
          onReady: (ev) => {
            setErrorReproductorYt(false);
            try {
              ev.target.setVolume?.(cfg.volumenYoutube);
              ev.target.playVideo?.();
            } catch {
              // Autoplay puede esperar interacción
            }
          },
          onStateChange: (ev) => {
            // 1 = PLAYING -> resetear contador de saltos por bloqueo
            if (ev.data === 1) {
              saltosConsecutivosRef.current = 0;
              setErrorReproductorYt(false);
            }
            // 0 = ENDED -> pasar automáticamente a la siguiente canción de la cola
            if (ev.data === 0 && colaYtRef.current.length > 1) {
              siguienteCancionYt(false);
            }
          },
          onError: (ev) => {
            // 100 / 101 / 150 = video no disponible o bloqueado por disquera -> saltar automáticamente
            if (ev.data === 100 || ev.data === 101 || ev.data === 150 || ev.data === 2 || ev.data === 5) {
              if (colaYtRef.current.length > 1) {
                setTimeout(() => siguienteCancionYt(true), 600);
              } else {
                setErrorReproductorYt(true);
                try {
                  ev.target.nextVideo?.();
                } catch {
                  // Ignorar
                }
              }
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      inicializarPlayer();
      return;
    }

    const scriptId = "eco-youtube-iframe-api";
    if (!document.getElementById(scriptId)) {
      const tag = document.createElement("script");
      tag.id = scriptId;
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    const prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCb?.();
      inicializarPlayer();
    };
  }, [cfg.volumenYoutube, fuenteMedia, modoBarraLateral, siguienteCancionYt, youtubeUrlActual]);

  // Ajustar volumen cuando cambia en configuración
  useEffect(() => {
    try {
      ytPlayerRef.current?.setVolume?.(cfg.volumenYoutube);
    } catch {
      // Ignorar
    }
  }, [cfg.volumenYoutube]);

  // Extraer fotos HD de álbumes de Google Fotos cuando estamos en Modo Eventos
  useEffect(() => {
    if (modoActivo !== "EVENTOS" || cfg.albumesGoogleFotos.length === 0) return;
    let cancelado = false;

    const cargarAlbumes = async () => {
      for (const alb of cfg.albumesGoogleFotos) {
        if (fotosPorAlbum[alb.id]) continue;
        const res = await extraerImagenesAlbumGoogleFotosAction(alb.url);
        if (!cancelado && res.ok) {
          setFotosPorAlbum((prev) => ({ ...prev, [alb.id]: res.imagenes }));
        }
      }
    };
    void cargarAlbumes();
    return () => {
      cancelado = true;
    };
  }, [cfg.albumesGoogleFotos, fotosPorAlbum, modoActivo]);

  // Listas derivadas para Modo Taller
  const pendientes = useMemo(
    () =>
      ordenarPedidosPorPrioridadTaller(
        tablero.ordenes.filter(
          (o) => o.estadoTaller === "ENVIADO_TALLER" || o.estadoTaller === "EN_PREPARACION"
        )
      ),
    [tablero.ordenes]
  );

  const { listosVisibles, totalEntregadosHoy } = useMemo(() => {
    const ahoraMs = reloj.getTime();
    const limiteMin = cfg.ocultarEntregadosMinutos;
    const listosActivos = tablero.ordenes.filter((o) => o.estadoTaller === "LISTO_ENTREGA");
    const entregadosHoy = tablero.ordenes.filter((o) => o.estadoTaller === "ENTREGADO");

    const entregadosRecientes = entregadosHoy.filter((o) => {
      if (limiteMin <= 0) return true;
      if (!o.entregadoEn) return false;
      const diffMin = (ahoraMs - new Date(o.entregadoEn).getTime()) / 60000;
      return diffMin <= limiteMin;
    });

    return {
      listosVisibles: [...listosActivos, ...entregadosRecientes],
      totalEntregadosHoy: entregadosHoy.length,
    };
  }, [cfg.ocultarEntregadosMinutos, reloj, tablero.ordenes]);

  // Densidad efectiva (Elástica)
  const densidadEfectiva: "NORMAL" | "PICO" | "SOLO_AUDIO" = useMemo(() => {
    if (densidadConfig !== "AUTO") return densidadConfig;
    if (pendientes.length >= 17) return "SOLO_AUDIO";
    if (pendientes.length >= 7) return "PICO";
    return "NORMAL";
  }, [densidadConfig, pendientes.length]);

  // Paginación automática suave de pendientes en días pico / fechas especiales
  const tarjetasPorPagina =
    densidadEfectiva === "SOLO_AUDIO" ? 12 : densidadEfectiva === "PICO" ? 8 : 5;
  const totalPaginas = Math.max(1, Math.ceil(pendientes.length / tarjetasPorPagina));

  useEffect(() => {
    if (paginaPendientes >= totalPaginas) {
      setPaginaPendientes(0);
    }
  }, [paginaPendientes, totalPaginas]);

  useEffect(() => {
    if (modoActivo !== "TALLER" || totalPaginas <= 1 || ordenConfirmandoListo) return;
    const timer = setInterval(() => {
      setPaginaPendientes((p) => (p + 1) % totalPaginas);
    }, 12000);
    return () => clearInterval(timer);
  }, [modoActivo, ordenConfirmandoListo, totalPaginas]);

  const pendientesPagina = useMemo(() => {
    const inicio = paginaPendientes * tarjetasPorPagina;
    return pendientes.slice(inicio, inicio + tarjetasPorPagina);
  }, [paginaPendientes, pendientes, tarjetasPorPagina]);

  // Acción para avanzar estado de un pedido desde la TV
  const avanzarEstadoDesdeTv = useCallback(
    async (orden: OrdenTvTaller, estadoDestino: "EN_PREPARACION" | "LISTO_ENTREGA") => {
      if (!tablero.puedeInteractuar) return;
      setProcesandoId(orden.id);
      const res = await actualizarEstadoOrdenTvAction({
        negocio: negNorm,
        ordenId: orden.id,
        nuevoEstado: estadoDestino,
        token: tokenKiosco,
      });
      setProcesandoId(null);
      setOrdenConfirmandoListo(null);
      if (res.ok) {
        await recargarTablero(true);
      }
    },
    [negNorm, recargarTablero, tablero.puedeInteractuar, tokenKiosco]
  );

  // Slides del Modo Showroom Eventos (Catálogo + Google Fotos)
  const slidesEventos = useMemo<SlideShowroomEvento[]>(() => {
    const lista: SlideShowroomEvento[] = [];

    if (filtroShowroom === "TODOS" || filtroShowroom === "CATALOGO") {
      for (const p of tablero.productosEventos) {
        if (!p.imagenUrl) continue;
        lista.push({
          id: `prod-${p.productoId}`,
          tipo: "PRODUCTO",
          titulo: p.nombre,
          subtitulo: p.categoriaNombre || "Eventos",
          descripcion: p.descripcion,
          imagenUrl: p.imagenUrl,
          precioDesde: p.precioDesde,
        });
      }
    }

    for (const alb of cfg.albumesGoogleFotos) {
      if (filtroShowroom !== "TODOS" && filtroShowroom !== alb.id) continue;
      const imgs = fotosPorAlbum[alb.id] ?? [];
      imgs.forEach((imgUrl, idx) => {
        lista.push({
          id: `gphoto-${alb.id}-${idx}`,
          tipo: "GOOGLE_FOTOS",
          titulo: alb.titulo,
          subtitulo: `Galería de Eventos · Foto ${idx + 1} de ${imgs.length}`,
          imagenUrl: imgUrl,
          qrUrl: alb.url,
          etiquetaAlbum: alb.titulo,
        });
      });
    }

    return lista;
  }, [cfg.albumesGoogleFotos, filtroShowroom, fotosPorAlbum, tablero.productosEventos]);

  useEffect(() => {
    if (indiceSlide >= slidesEventos.length) setIndiceSlide(0);
  }, [indiceSlide, slidesEventos.length]);

  useEffect(() => {
    if (modoActivo !== "EVENTOS" || pausadoShowroom || slidesEventos.length <= 1) return;
    const ms = Math.max(4, cfg.segundosSlideEventos || 10) * 1000;
    const t = setInterval(() => {
      setIndiceSlide((i) => (i + 1) % slidesEventos.length);
    }, ms);
    return () => clearInterval(t);
  }, [cfg.segundosSlideEventos, modoActivo, pausadoShowroom, slidesEventos.length]);

  // Navegación con Control Remoto de Smart TV (D-Pad: Flechas + OK/Enter + Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // No interceptar teclas mientras el usuario escribe en el buscador/URL de YouTube
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") {
          setAbiertoBuscadorYt(false);
        }
        return;
      }

      if (abiertoBuscadorYt) {
        if (e.key === "Escape") {
          e.preventDefault();
          setAbiertoBuscadorYt(false);
        }
        return;
      }

      if (e.key === "m" || e.key === "M" || e.key === "h" || e.key === "H") {
        despertarHud();
        return;
      }

      if (modoActivo === "EVENTOS") {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setIndiceSlide((i) => (slidesEventos.length > 0 ? (i + 1) % slidesEventos.length : 0));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setIndiceSlide((i) =>
            slidesEventos.length > 0 ? (i - 1 + slidesEventos.length) % slidesEventos.length : 0
          );
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setPausadoShowroom((p) => !p);
        }
        return;
      }

  // Modal de detalle y confirmación "Marcar Listo" con control remoto
      if (ordenConfirmandoListo) {
        if (e.key === "Escape") {
          e.preventDefault();
          setOrdenConfirmandoListo(null);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setBotonConfirmFoco((b) => (b === "SI" ? "NO" : "SI"));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (botonConfirmFoco === "SI" && tablero.puedeInteractuar) {
            if (ordenConfirmandoListo.estadoTaller === "ENVIADO_TALLER") {
              void avanzarEstadoDesdeTv(ordenConfirmandoListo, "EN_PREPARACION");
            } else if (ordenConfirmandoListo.estadoTaller === "EN_PREPARACION") {
              void avanzarEstadoDesdeTv(ordenConfirmandoListo, "LISTO_ENTREGA");
            } else {
              setOrdenConfirmandoListo(null);
            }
          } else {
            setOrdenConfirmandoListo(null);
          }
        }
        return;
      }

      if (pendientesPagina.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setIndiceFoco((i) => (i + 1) % pendientesPagina.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setIndiceFoco((i) => (i - 1 + pendientesPagina.length) % pendientesPagina.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const seleccionada = pendientesPagina[indiceFoco];
        if (!seleccionada) return;
        setBotonConfirmFoco("SI");
        setOrdenConfirmandoListo(seleccionada);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    abiertoBuscadorYt,
    avanzarEstadoDesdeTv,
    botonConfirmFoco,
    despertarHud,
    indiceFoco,
    modoActivo,
    ordenConfirmandoListo,
    pendientesPagina,
    slidesEventos.length,
    tablero.puedeInteractuar,
  ]);

  const togglePantallaCompleta = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setEnPantallaCompleta(true);
      } else {
        await document.exitFullscreen();
        setEnPantallaCompleta(false);
      }
    } catch {
      // Algunos navegadores TV ya corren fullscreen
    }
  };

  if (errorAcceso) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          width: "100vw",
          height: "100vh",
          background: "#14110F",
          color: "#F6F1E8",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          gap: "14px",
        }}
      >
        <Monitor size={46} color="#C8A25A" />
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontFamily: "Georgia, serif" }}>
          Pantalla TV Taller — {nombreNegocio}
        </h1>
        <p style={{ margin: 0, color: "#E5B4AC", maxWidth: "520px", fontSize: "0.98rem" }}>
          {errorAcceso}
        </p>
        <a
          href="/panel/taller"
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            background: "#3D5A45",
            color: "#F6F1E8",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Ir a Consola Taller
        </a>
      </div>
    );
  }

  // Cálculo de anchos elásticos para Modo Taller
  const esSoloAudio = modoActivo === "EVENTOS" || densidadEfectiva === "SOLO_AUDIO";
  const anchoLateralPct = densidadEfectiva === "PICO" ? 50 : 30;
  const colsPendientes =
    densidadEfectiva === "SOLO_AUDIO"
      ? "repeat(auto-fill, minmax(290px, 1fr))"
      : densidadEfectiva === "PICO"
        ? "repeat(2, minmax(0, 1fr))"
        : "1fr";

  const slideActual = slidesEventos[indiceSlide] ?? null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#14110F",
        color: "#F6F1E8",
        fontFamily: "var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Elemento HTML5 Audio para Radio en Vivo (0 bloqueos de disquera, funciona en cualquier Smart TV) */}
      <audio
        ref={radioAudioRef}
        preload="none"
        onPlay={() => setRadioReproduciendo(true)}
        onPause={() => setRadioReproduciendo(false)}
        onError={() => {
          setRadioReproduciendo(false);
          setErrorRadio("Esa emisora no respondió. Prueba otra emisora de la lista.");
        }}
      />

      {/* Banner flotante de Nuevo Pedido (Audio Ducking) */}
      {alertaNuevoPedido && (
        <div
          style={{
            position: "fixed",
            top: "18px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 120,
            padding: "14px 26px",
            borderRadius: "16px",
            background: alertaNuevoPedido.urgente
              ? "linear-gradient(135deg, #DC2626, #991B1B)"
              : "linear-gradient(135deg, #0D9488, #0369A1)",
            color: "#FFFFFF",
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
            border: "2px solid var(--cb-ffffff-a450, rgba(255,255,255,0.45))",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            maxWidth: "85vw",
          }}
        >
          <Bell size={26} />
          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em", opacity: 0.9 }}>
              {alertaNuevoPedido.urgente ? "⚡ PEDIDO URGENTE EN TALLER" : "🌸 NUEVO PEDIDO EN TALLER"}
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>
              {alertaNuevoPedido.codigo} · {alertaNuevoPedido.resumen}
            </div>
          </div>
        </div>
      )}

      {/* Barra Superior Sobria y Cálida (Reloj + Estado + HUD ocultable) */}
      <div
        style={{
          height: "48px",
          padding: "0 18px",
          background: "#1B1714",
          borderBottom: "1px solid var(--cb-d6c3a5-a140, rgba(214, 195, 165, 0.14))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexShrink: 0,
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              padding: "4px 11px",
              borderRadius: "999px",
              background: modoActivo === "EVENTOS" ? "#7D4759" : "#3D5A45",
              color: "#F6F1E8",
              fontSize: "0.75rem",
              fontWeight: 800,
              letterSpacing: "0.06em",
              border: "1px solid var(--cb-d6c3a5-a220, rgba(214, 195, 165, 0.22))",
            }}
          >
            {nombreNegocio.toUpperCase()}
          </span>
          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#D6CEC2" }}>
            {modoActivo === "EVENTOS"
              ? "Showroom de Eventos"
              : fuenteMedia === "INDICADORES"
                ? "Tablero Ejecutivo"
                : "Taller en Vivo"}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: conectado ? "var(--ct-8ab597, #8AB597)" : "var(--ct-d98a7e, #D98A7E)",
            }}
          >
            {conectado ? <Wifi size={13} /> : <WifiOff size={13} />}
            {conectado ? "EN VIVO" : "RECONECTANDO"}
          </span>
        </div>

        {/* Controles rápidos sobrios */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            opacity: hudVisible ? 1 : 0.3,
            transition: "opacity 0.3s ease",
          }}
        >
          {esOperadorOAdmin && modoActivo === "TALLER" && !modoBarraLateral && (
            <button
              type="button"
              onClick={() => {
                const nuevaFuente: FuenteMediaTv =
                  fuenteMedia === "INDICADORES" ? "RADIO" : "INDICADORES";
                setFuenteMediaLocal(nuevaFuente);
                if (nuevaFuente === "INDICADORES") {
                  try {
                    ytPlayerRef.current?.pauseVideo?.();
                  } catch {
                    // Ignorar
                  }
                }
                if (tablero.modoAcceso === "AUTENTICADO") {
                  void guardarConfigTvTallerAction({
                    negocio: negNorm,
                    config: { fuenteMedia: nuevaFuente },
                  });
                }
              }}
              title="Tablero de Indicadores en vivo (solo Operadores y Administradores)"
              style={hudBtnStyle(fuenteMedia === "INDICADORES" ? "#B8923F" : "#26201C")}
            >
              <BarChart3 size={14} />
              Indicadores
            </button>
          )}

          {colaYt.length > 1 && fuenteMedia === "YOUTUBE" && (
            <>
              <button
                type="button"
                onClick={anteriorCancionYt}
                title="Canción anterior en la cola"
                style={hudBtnStyle("#26201C")}
              >
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                onClick={() => siguienteCancionYt(false)}
                title="Siguiente canción en la cola"
                style={hudBtnStyle("#26201C")}
              >
                <SkipForward size={14} />
              </button>
            </>
          )}

          {fuenteMedia === "YOUTUBE" && (
            <button
              type="button"
              onClick={() =>
                void toggleFavoritoYt({
                  titulo: cancionActualCola?.titulo || "Música Taller",
                  url: youtubeUrlActual,
                  canal: cancionActualCola?.canal,
                  miniaturaUrl: cancionActualCola?.miniaturaUrl,
                })
              }
              title={esActualFavorito ? "Quitar de Mis Favoritos" : "Guardar canción actual en Favoritos"}
              style={hudBtnStyle(esActualFavorito ? "#8C6D2E" : "#26201C")}
            >
              <Star size={14} fill={esActualFavorito ? "#E8C97E" : "none"} color={esActualFavorito ? "#E8C97E" : "#E8E0D5"} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setTabModalYt(fuenteMedia === "YOUTUBE" ? "buscar" : "radio");
              setAbiertoBuscadorYt(true);
              setErrorYtBusqueda(null);
            }}
            title="Elegir Radio en Vivo (0 bloqueos), buscar en YouTube o ver Favoritos"
            style={hudBtnStyle(fuenteMedia !== "INDICADORES" ? "#3D5A45" : "#26201C")}
          >
            {fuenteMedia === "YOUTUBE" ? <Search size={14} /> : <Radio size={14} />}
            Música / Radio
          </button>

          <button
            type="button"
            onClick={() => void toggleFlotarSobreYoutube()}
            title="Flotar los pedidos SIEMPRE ENCIMA sobre youtube.com real (Chrome/Edge)"
            style={hudBtnStyle(pipWindow ? "#B8923F" : "#26201C")}
          >
            <PictureInPicture2 size={14} />
            {pipWindow ? "Cerrar Flotante" : "Flotar sobre YouTube"}
          </button>

          <button
            type="button"
            onClick={() => setModoBarraLateral(!modoBarraLateral)}
            title="Modo Barra Lateral: solo pedidos para usar junto a youtube.com oficial en PC/Laptop"
            style={hudBtnStyle(modoBarraLateral ? "#8C6D2E" : "#26201C")}
          >
            <PanelRight size={14} />
            {modoBarraLateral ? "TV Completa" : "Barra Lateral"}
          </button>

          {modoBarraLateral && (
            <button
              type="button"
              onClick={abrirVentanaBarraLateral}
              title="Abrir en ventana angosta acoplable para poner al lado de youtube.com"
              style={hudBtnStyle("#3D5A45")}
            >
              Ventana Acoplable
            </button>
          )}

          <button
            type="button"
            onClick={() => setModoLocal(modoActivo === "TALLER" ? "EVENTOS" : "TALLER")}
            title="Cambiar entre Modo Taller y Modo Showroom Eventos"
            style={hudBtnStyle(modoActivo === "EVENTOS" ? "#7D4759" : "#26201C")}
          >
            {modoActivo === "TALLER" ? <Sparkles size={14} /> : <Monitor size={14} />}
            {modoActivo === "TALLER" ? "Eventos" : "Taller"}
          </button>

          {modoActivo === "TALLER" && !modoBarraLateral && (
            <>
              <button
                type="button"
                onClick={() =>
                  setLadoLocal(posicionLateral === "derecha" ? "izquierda" : "derecha")
                }
                title="Cambiar columna de pedidos Izquierda / Derecha"
                style={hudBtnStyle("#26201C")}
              >
                <ArrowLeftRight size={14} />
                {posicionLateral === "derecha" ? "Der" : "Izq"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const orden: DensidadLayoutTv[] = ["AUTO", "NORMAL", "PICO", "SOLO_AUDIO"];
                  const next = orden[(orden.indexOf(densidadConfig) + 1) % orden.length]!;
                  setDensidadLocal(next);
                }}
                title="Cambiar espacio principal / Pedidos"
                style={hudBtnStyle("#26201C")}
              >
                <Layers size={14} />
                {densidadConfig === "AUTO"
                  ? `Auto (${densidadEfectiva})`
                  : densidadConfig === "SOLO_AUDIO"
                    ? "Compacto"
                    : densidadConfig}
              </button>

              <button
                type="button"
                onClick={() => setMostrarListosLocal(!mostrarFranjaListos)}
                title="Mostrar u ocultar franja inferior de pedidos listos"
                style={hudBtnStyle("#26201C")}
              >
                {mostrarFranjaListos ? <Eye size={14} /> : <EyeOff size={14} />}
                Listos
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setSonidoLocal(!sonidoAlertas)}
            title="Activar o silenciar alertas sonoras"
            style={hudBtnStyle("#26201C")}
          >
            {sonidoAlertas ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            type="button"
            onClick={() => void recargarTablero(true)}
            title="Actualizar ahora"
            style={hudBtnStyle("#26201C")}
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            onClick={() => void togglePantallaCompleta()}
            title="Pantalla completa"
            style={hudBtnStyle("#26201C")}
          >
            {enPantallaCompleta ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <div
            style={{
              marginLeft: "8px",
              paddingLeft: "10px",
              borderLeft: "1px solid var(--cb-d6c3a5-a200, rgba(214, 195, 165, 0.2))",
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "0.74rem", color: "var(--ct-a89d8f, #A89D8F)", textTransform: "capitalize" }}>
              {formatearFechaEcuadorLarga(reloj)}
            </span>
            <span style={{ fontSize: "1.02rem", fontWeight: 800, color: "#F6F1E8" }}>
              {formatearHoraEcuador(reloj)}
            </span>
          </div>
        </div>
      </div>

      {/* Contenedor Principal (YouTube + Contenido Activo) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection:
            modoActivo === "TALLER" && !esSoloAudio
              ? posicionLateral === "izquierda"
                ? "row-reverse"
                : "row"
              : "column",
          position: "relative",
        }}
      >
        {/* ZONA PRINCIPAL: TABLERO DE INDICADORES (Solo Operadores/Admin) | RADIO EN VIVO | YOUTUBE */}
        {!modoBarraLateral && (
        <div
          style={
            esSoloAudio
              ? {
                  height: "46px",
                  padding: "0 16px",
                  background: "#1B1714",
                  borderBottom: "1px solid var(--cb-d6c3a5-a140, rgba(214, 195, 165, 0.14))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexShrink: 0,
                }
              : {
                  width: `${100 - anchoLateralPct}%`,
                  height: "100%",
                  background:
                    fuenteMedia === "YOUTUBE"
                      ? "#000000"
                      : "radial-gradient(circle at 20% 15%, #261F1A 0%, #14110F 72%)",
                  position: "relative",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                }
          }
        >
          {/* VISTA 0: TABLERO EJECUTIVO DE INDICADORES (EXCLUSIVO OPERADORES Y ADMINISTRADORES) */}
          {fuenteMedia === "INDICADORES" && esOperadorOAdmin ? (
            esSoloAudio ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "12px", fontSize: "0.82rem", color: "#E8E0D5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <strong style={{ color: "var(--ct-c8a25a, #C8A25A)" }}>Indicadores Hoy:</strong>
                  <span>Chats: <strong>{tablero.indicadoresTv?.chatsHoy ?? 0}</strong></span>
                  <span>Pend. seguimiento: <strong style={{ color: "#E5988B" }}>{tablero.indicadoresTv?.chatsPendientesSeguimiento ?? 0}</strong></span>
                  <span>Ventas hoy: <strong style={{ color: "var(--ct-8ab597, #8AB597)" }}>${Number(tablero.indicadoresTv?.totalVentasHoyUsd ?? 0).toFixed(2)}</strong></span>
                  <span>Pedidos hoy/sem: <strong>{tablero.indicadoresTv?.pedidosHoy ?? 0} / {tablero.indicadoresTv?.pedidosSemana ?? 0}</strong></span>
                </div>
              </div>
            ) : (() => {
              const ind = tablero.indicadoresTv;
              const serie = ind?.serieSemana ?? [];
              const maxPed = Math.max(1, ...serie.map((s) => s.pedidos));
              const desglose = ind?.desgloseClasificacionHoy ?? {};
              return (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "26px 32px",
                    gap: "20px",
                    overflowY: "auto",
                  }}
                >
                  {/* Cabecera editorial */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "14px" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ct-c8a25a, #C8A25A)" }}>
                        TABLERO EJECUTIVO · OPERADORES Y ADMINISTRADORES
                      </div>
                      <h2 style={{ margin: "4px 0 0 0", fontFamily: "var(--font-fraunces), Georgia, serif", fontSize: "2rem", fontWeight: 600, color: "#F6F1E8" }}>
                        Resumen Operativo — {nombreNegocio}
                      </h2>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "2.35rem", fontWeight: 800, lineHeight: 1, color: "#F6F1E8", fontVariantNumeric: "tabular-nums" }}>
                        {formatearHoraEcuador(reloj)}
                      </div>
                      <div style={{ fontSize: "0.84rem", color: "var(--ct-a89d8f, #A89D8F)", textTransform: "capitalize", marginTop: "3px" }}>
                        {formatearFechaEcuadorLarga(reloj)}
                      </div>
                    </div>
                  </div>

                  {/* 4 Tarjetas KPI Principales */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
                    {/* KPI 1: Chats Hoy */}
                    <div style={kpiCardTvStyle("rgba(214, 195, 165, 0.2)")}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={kpiLabelTvStyle}>Chats Hoy</span>
                        <MessageSquare size={18} color="#C8A25A" />
                      </div>
                      <div style={kpiNumTvStyle("#F6F1E8")}>{ind?.chatsHoy ?? 0}</div>
                      <div style={kpiSubTvStyle}>Conversaciones activas hoy</div>
                    </div>

                    {/* KPI 2: Chats Pendientes de Seguimiento */}
                    <div
                      style={kpiCardTvStyle(
                        (ind?.chatsPendientesSeguimiento ?? 0) > 0
                          ? "rgba(196, 91, 75, 0.55)"
                          : "rgba(214, 195, 165, 0.2)"
                      )}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={kpiLabelTvStyle}>Pend. Seguimiento</span>
                        <Bell size={18} color={(ind?.chatsPendientesSeguimiento ?? 0) > 0 ? "#D97B6C" : "#A89D8F"} />
                      </div>
                      <div style={kpiNumTvStyle((ind?.chatsPendientesSeguimiento ?? 0) > 0 ? "#E5988B" : "#F6F1E8")}>
                        {ind?.chatsPendientesSeguimiento ?? 0}
                      </div>
                      <div style={kpiSubTvStyle}>
                        Escalados: {ind?.chatsEscalados ?? 0} · Sin leer: {ind?.chatsNoLeidos ?? 0}
                      </div>
                    </div>

                    {/* KPI 3: Total Ventas Hoy */}
                    <div style={kpiCardTvStyle("rgba(138, 181, 151, 0.32)")}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={kpiLabelTvStyle}>Ventas Hoy</span>
                        <DollarSign size={18} color="#8AB597" />
                      </div>
                      <div style={kpiNumTvStyle("#9CC4A8")}>
                        ${Number(ind?.totalVentasHoyUsd ?? 0).toFixed(2)}
                      </div>
                      <div style={kpiSubTvStyle}>
                        Semana: ${Number(ind?.totalVentasSemanaUsd ?? 0).toFixed(2)}
                      </div>
                    </div>

                    {/* KPI 4: Pedidos Hoy y Semana */}
                    <div style={kpiCardTvStyle("rgba(200, 162, 90, 0.35)")}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={kpiLabelTvStyle}>Pedidos Hoy / Sem</span>
                        <Package size={18} color="#C8A25A" />
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                        <span style={kpiNumTvStyle("#E8C97E")}>{ind?.pedidosHoy ?? 0}</span>
                        <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--ct-a89d8f, #A89D8F)" }}>
                          / {ind?.pedidosSemana ?? 0} sem
                        </span>
                      </div>
                      <div style={kpiSubTvStyle}>
                        Sin enviar a taller: {ind?.sinEnviarTallerHoy ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Fila inferior: Gráfica semanal + Desglose por tipo de negocio */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: "16px", flex: 1, minHeight: "220px" }}>
                    {/* Gráfica semanal Lun-Dom */}
                    <div
                      style={{
                        padding: "18px 20px",
                        borderRadius: "16px",
                        background: "#1E1916",
                        border: "1px solid var(--cb-d6c3a5-a140, rgba(214, 195, 165, 0.14))",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#E8E0D5", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                          Pedidos de la Semana (Lun – Dom)
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "var(--ct-a89d8f, #A89D8F)" }}>
                          Total: {ind?.pedidosSemana ?? 0} pedidos
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "10px", alignItems: "end", flex: 1, paddingTop: "12px" }}>
                        {serie.map((d) => {
                          const alturaPct = Math.max(10, Math.round((d.pedidos / maxPed) * 100));
                          return (
                            <div
                              key={d.fecha}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                height: "100%",
                                gap: "6px",
                              }}
                            >
                              <span style={{ fontSize: "0.85rem", fontWeight: 800, color: d.esHoy ? "#E8C97E" : "#D6CEC2" }}>
                                {d.pedidos}
                              </span>
                              <div
                                style={{
                                  width: "100%",
                                  maxWidth: "46px",
                                  height: `${alturaPct}%`,
                                  minHeight: "12px",
                                  borderRadius: "8px 8px 3px 3px",
                                  background: d.esHoy
                                    ? "linear-gradient(180deg, #D5B16A 0%, #9E7B39 100%)"
                                    : "rgba(214, 195, 165, 0.22)",
                                  border: d.esHoy ? "1px solid var(--cb-e8c97e, #E8C97E)" : "1px solid var(--cb-d6c3a5-a140, rgba(214, 195, 165, 0.14))",
                                }}
                              />
                              <span style={{ fontSize: "0.76rem", fontWeight: d.esHoy ? 800 : 600, color: d.esHoy ? "#E8C97E" : "var(--ct-a89d8f, #A89D8F)" }}>
                                {d.diaCorto}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Desglose Hoy por Clasificación */}
                    <div
                      style={{
                        padding: "18px 20px",
                        borderRadius: "16px",
                        background: "#1E1916",
                        border: "1px solid var(--cb-d6c3a5-a140, rgba(214, 195, 165, 0.14))",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#E8E0D5", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Pedidos de Hoy por Tipo
                      </span>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {[
                          { k: "CONDOLENCIAS", label: "Condolencias", color: "#A89D8F" },
                          { k: "EVENTOS", label: "Eventos", color: "#C97A94" },
                          { k: "EXEQUIALES", label: "Exequiales", color: "#9E89AD" },
                          { k: "FLORISTERIA_OCASIONES", label: "Pedido", color: "#6F9A7B" },
                        ].map((item) => {
                          const val = Number(desglose[item.k] ?? 0);
                          return (
                            <div
                              key={item.k}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderRadius: "10px",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--cb-d6c3a5-a100, rgba(214, 195, 165, 0.1))",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: item.color }} />
                                <span style={{ fontSize: "0.84rem", color: "#E8E0D5", fontWeight: 600 }}>{item.label}</span>
                              </div>
                              <strong style={{ fontSize: "1rem", color: "#F6F1E8" }}>{val}</strong>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "var(--ct-a89d8f, #A89D8F)", paddingTop: "6px", borderTop: "1px solid var(--cb-d6c3a5-a120, rgba(214,195,165,0.12))" }}>
                        <span>En taller: {pendientes.length}</span>
                        <span>Listos: {tablero.ordenes.filter((o) => o.estadoTaller === "LISTO_ENTREGA").length}</span>
                        <span>Entregados: {totalEntregadosHoy}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : fuenteMedia === "RADIO" ? (
            esSoloAudio ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <Radio size={17} color="#34D399" />
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#E2E8F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {emisoraActual ? `${emisoraActual.nombre}` : "Radio en Vivo Taller"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button type="button" onClick={togglePlayPausaRadio} style={hudBtnStyle("#059669")}>
                    {radioReproduciendo ? <Pause size={13} /> : <Play size={13} />}
                    {radioReproduciendo ? "Pausa" : "Play"}
                  </button>
                  <button type="button" onClick={() => cambiarEmisoraRadio(1)} style={hudBtnStyle("#1E293B")}>
                    <SkipForward size={13} /> Otra emisora
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTabModalYt("radio");
                      setAbiertoBuscadorYt(true);
                    }}
                    style={hudBtnStyle("#1E293B")}
                  >
                    Emisoras
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "28px 34px",
                  gap: "18px",
                  overflowY: "auto",
                }}
              >
                {/* Fila superior: Reloj gigante TV + Resumen operativo del día */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <div style={{ fontSize: "3.8rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em", color: "#F8FAFC" }}>
                      {formatearHoraEcuador(reloj)}
                    </div>
                    <div style={{ fontSize: "1.05rem", color: "var(--ct-94a3b8, #94A3B8)", marginTop: "6px", textTransform: "capitalize", fontWeight: 600 }}>
                      {formatearFechaEcuadorLarga(reloj)} · {nombreNegocio}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(245,158,11,0.14)", border: "1px solid rgba(245,158,11,0.35)", textAlign: "center", minWidth: "96px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#FBBF24" }}>{pendientes.length}</div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#FDE68A" }}>PENDIENTES</div>
                    </div>
                    <div style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.35)", textAlign: "center", minWidth: "96px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#34D399" }}>
                        {tablero.ordenes.filter((o) => o.estadoTaller === "LISTO_ENTREGA").length}
                      </div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#A7F3D0" }}>LISTOS</div>
                    </div>
                    <div style={{ padding: "10px 16px", borderRadius: "12px", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", textAlign: "center", minWidth: "96px" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#38BDF8" }}>{totalEntregadosHoy}</div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#BAE6FD" }}>ENTREGADOS</div>
                    </div>
                  </div>
                </div>

                {/* Tarjeta central de Radio en Vivo */}
                <div
                  style={{
                    padding: "24px 26px",
                    borderRadius: "20px",
                    background: "rgba(15, 23, 42, 0.84)",
                    border: radioReproduciendo ? "2px solid #10B981" : "1.5px solid var(--cb-94a3b8-a280, rgba(148,163,184,0.28))",
                    boxShadow: "0 18px 46px rgba(0,0,0,0.45)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "68px",
                          height: "68px",
                          borderRadius: "16px",
                          background: "linear-gradient(135deg, #059669, #0284C7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          overflow: "hidden",
                        }}
                      >
                        {emisoraActual?.faviconUrl ? (
                          <img
                            src={emisoraActual.faviconUrl}
                            alt={emisoraActual.nombre}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Radio size={34} color="#FFFFFF" />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: radioReproduciendo ? "#34D399" : "var(--ct-94a3b8, #94A3B8)", letterSpacing: "0.08em" }}>
                          {radioReproduciendo ? "● SONANDO EN VIVO · SIN BLOQUEOS" : "📻 RADIO EN VIVO DEL TALLER"}
                        </div>
                        <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#FFFFFF", marginTop: "2px" }}>
                          {emisoraActual?.nombre || "Elige un género o emisora de Ecuador"}
                        </div>
                        <div style={{ fontSize: "0.84rem", color: "var(--ct-94a3b8, #94A3B8)", marginTop: "2px" }}>
                          {emisoraActual
                            ? [emisoraActual.pais, emisoraActual.etiquetas].filter(Boolean).join(" · ")
                            : "Cero bloqueos de LatinAutor · Cero anuncios de YouTube · 24/7"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => cambiarEmisoraRadio(-1)}
                        title="Emisora anterior"
                        style={{ ...hudBtnStyle("#1E293B"), padding: "11px 13px" }}
                      >
                        <SkipBack size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={togglePlayPausaRadio}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "12px",
                          border: "none",
                          background: radioReproduciendo ? "#D97706" : "#059669",
                          color: "#FFFFFF",
                          fontSize: "0.95rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                        }}
                      >
                        {radioReproduciendo ? <Pause size={18} /> : <Play size={18} />}
                        {radioReproduciendo ? "Pausar" : "Escuchar Ahora"}
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarEmisoraRadio(1)}
                        title="Siguiente emisora"
                        style={{ ...hudBtnStyle("#1E293B"), padding: "11px 13px" }}
                      >
                        <SkipForward size={18} />
                      </button>
                      {emisoraActual && (
                        <button
                          type="button"
                          onClick={() => void toggleRadioFavorita(emisoraActual)}
                          title="Guardar emisora favorita"
                          style={{
                            ...hudBtnStyle(
                              radiosFavoritasLocal.some((r) => r.streamUrl === emisoraActual.streamUrl)
                                ? "#B45309"
                                : "#1E293B"
                            ),
                            padding: "11px 13px",
                          }}
                        >
                          <Star
                            size={18}
                            fill={
                              radiosFavoritasLocal.some((r) => r.streamUrl === emisoraActual.streamUrl)
                                ? "#FDE047"
                                : "none"
                            }
                            color={
                              radiosFavoritasLocal.some((r) => r.streamUrl === emisoraActual.streamUrl)
                                ? "#FDE047"
                                : "#F8FAFC"
                            }
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {errorRadio && (
                    <div style={{ fontSize: "0.82rem", color: "#FDE68A", fontWeight: 600 }}>
                      ⚠ {errorRadio}
                    </div>
                  )}

                  {/* Géneros y Ecuador de 1 clic directo en pantalla */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid var(--cb-94a3b8-a160, rgba(148,163,184,0.16))" }}>
                    {(
                      [
                        { label: "🇪🇨 Radios Ecuador", filtro: { pais: "EC" } },
                        { label: "💃 Salsa", filtro: { genero: "salsa" } },
                        { label: "🪘 Cumbia", filtro: { genero: "cumbia" } },
                        { label: "❤️ Baladas / Romántica", filtro: { genero: "romantic" } },
                        { label: "🎵 Pop Latino", filtro: { genero: "latin pop" } },
                        { label: "🎸 Rock Español", filtro: { genero: "rock en espanol" } },
                        { label: "☕ Jazz / Café", filtro: { genero: "jazz" } },
                        { label: "🎹 Piano / Relajante", filtro: { genero: "piano" } },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        disabled={cargandoRadios}
                        onClick={() => void cargarEmisorasRadio(chip.filtro, true)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "999px",
                          border: "1px solid var(--cb-94a3b8-a300, rgba(148,163,184,0.3))",
                          background: "rgba(30, 41, 59, 0.9)",
                          color: "#F8FAFC",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pie de acceso rápido a todas las emisoras, YouTube o Barra Lateral */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTabModalYt("radio");
                        setAbiertoBuscadorYt(true);
                      }}
                      style={{ ...hudBtnStyle("#059669"), padding: "9px 14px", fontSize: "0.82rem" }}
                    >
                      <Radio size={15} /> Ver todas las emisoras ({emisorasRadio.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTabModalYt("buscar");
                        setAbiertoBuscadorYt(true);
                      }}
                      style={{ ...hudBtnStyle("#1E293B"), padding: "9px 14px", fontSize: "0.82rem" }}
                    >
                      <Search size={15} /> Cambiar a YouTube
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={abrirVentanaBarraLateral}
                    style={{ ...hudBtnStyle("#0284C7"), padding: "9px 14px", fontSize: "0.82rem" }}
                  >
                    <PanelRight size={15} /> Usar con YouTube.com oficial (Barra Lateral)
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
          {esSoloAudio && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Music size={17} color="#38BDF8" />
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#E2E8F0" }}>
                {modoActivo === "EVENTOS"
                  ? "Audio Ambiental YouTube (Showroom Eventos)"
                  : `Audio YouTube activo · Alta demanda (${pendientes.length} pedidos en cola)`}
              </span>
              <button
                type="button"
                onClick={() => ytPlayerRef.current?.playVideo?.()}
                style={hudBtnStyle("#1E293B")}
              >
                <Play size={13} /> Play
              </button>
              <button
                type="button"
                onClick={() => ytPlayerRef.current?.pauseVideo?.()}
                style={hudBtnStyle("#1E293B")}
              >
                <Pause size={13} /> Pausa
              </button>
              <button
                type="button"
                onClick={() => ytPlayerRef.current?.nextVideo?.()}
                style={hudBtnStyle("#1E293B")}
              >
                Siguiente
              </button>
            </div>
          )}

          {/* Contenedor real del IFrame YouTube (1px oculto en modo solo audio para mantener audio continuo) */}
          <div
            style={
              esSoloAudio
                ? {
                    width: "180px",
                    height: "36px",
                    overflow: "hidden",
                    borderRadius: "6px",
                    opacity: 0.75,
                  }
                : { width: "100%", height: "100%", position: "relative" }
            }
          >
            <div ref={ytContainerRef} style={{ width: "100%", height: "100%" }} />
            {!esSoloAudio && avisoSaltoYt && (
              <div
                style={{
                  position: "absolute",
                  top: "18px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 16,
                  padding: "9px 16px",
                  borderRadius: "10px",
                  background: "rgba(15, 23, 42, 0.92)",
                  border: "1px solid #38BDF8",
                  color: "#E0F2FE",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.5)",
                }}
              >
                ⏭ {avisoSaltoYt}
              </div>
            )}
            {!esSoloAudio && errorReproductorYt && (
              <div
                style={{
                  position: "absolute",
                  bottom: "24px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 15,
                  padding: "10px 16px",
                  borderRadius: "12px",
                  background: "rgba(15, 23, 42, 0.92)",
                  border: "1.5px solid #F87171",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
                }}
              >
                <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#E5B4AC" }}>
                  La disquera bloqueó este video fuera de youtube.com.
                </span>
                <button
                  type="button"
                  onClick={() => setAbiertoBuscadorYt(true)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#3D5A45",
                    color: "#F6F1E8",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Search size={14} /> Buscar otro
                </button>
                <button
                  type="button"
                  onClick={() => void toggleFlotarSobreYoutube(youtubeUrlActual || "https://www.youtube.com")}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-c8a25a-a450, rgba(200,162,90,0.45))",
                    background: "#B8923F",
                    color: "#14110F",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <PictureInPicture2 size={14} /> Ver en YouTube + Flotar Pedidos
                </button>
              </div>
            )}
          </div>
            </>
          )}
        </div>
        )}

        {/* ============================================================
            VISTA A: MODO TALLER (COLA DE PEDIDOS PENDIENTES PRIORIZADOS)
           ============================================================ */}
        {modoActivo === "TALLER" && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              background: "#181411",
              borderLeft:
                !esSoloAudio && !modoBarraLateral && posicionLateral === "derecha"
                  ? "1px solid var(--cb-d6c3a5-a160, rgba(214, 195, 165, 0.16))"
                  : undefined,
              borderRight:
                !esSoloAudio && !modoBarraLateral && posicionLateral === "izquierda"
                  ? "1px solid var(--cb-d6c3a5-a160, rgba(214, 195, 165, 0.16))"
                  : undefined,
              display: "flex",
              flexDirection: "column",
              padding: "14px",
              gap: "10px",
            }}
          >
            {/* Cabecera de la cola */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Flame size={18} color="#C8A25A" />
                <span style={{ fontSize: "0.94rem", fontWeight: 800, letterSpacing: "0.05em", color: "#F6F1E8" }}>
                  PENDIENTES TALLER ({pendientes.length})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {totalPaginas > 1 && (
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "rgba(200, 162, 90, 0.18)",
                      color: "#E8C97E",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                    }}
                  >
                    Pág. {paginaPendientes + 1} / {totalPaginas}
                  </span>
                )}
                {tablero.puedeInteractuar && (
                  <span style={{ fontSize: "0.7rem", color: "var(--ct-a89d8f, #A89D8F)" }}>
                    Control TV: ▲▼ + OK
                  </span>
                )}
              </div>
            </div>

            {/* Grid de tarjetas de pedidos pendientes */}
            {pendientesPagina.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  color: "var(--ct-64748b, #64748B)",
                  border: "1px dashed var(--cb-94a3b8-a200, rgba(148,163,184,0.2))",
                  borderRadius: "14px",
                }}
              >
                <CheckCircle2 size={44} color="#10B981" />
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#CBD5E1" }}>
                  ¡Todo al día en taller!
                </div>
                <div style={{ fontSize: "0.84rem" }}>
                  Los nuevos pedidos asignados aparecerán aquí automáticamente.
                </div>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: "grid",
                  gridTemplateColumns: colsPendientes,
                  gap: "10px",
                  alignContent: "start",
                  overflowY: "auto",
                }}
              >
                {pendientesPagina.map((orden, idx) => {
                  const numeroOrden = paginaPendientes * tarjetasPorPagina + idx + 1;
                  const esExequiales =
                    orden.clasificacionPedido === "EXEQUIALES" ||
                    orden.origenTipo === "EXEQUIALES_LLAMADA";
                  const enPrep = orden.estadoTaller === "EN_PREPARACION";
                  const enfocado = idx === indiceFoco;
                  const chipsColores = parsearColoresPedido(orden.colores);
                  const horarioTexto = formatearHorarioEntregaOrden({
                    franjaHoraria: orden.franjaHoraria,
                    horaEspecifica: orden.horaEspecifica,
                    esExequiales,
                  });

                  return (
                    <div
                      key={orden.id}
                      onClick={() => {
                        setIndiceFoco(idx);
                        setBotonConfirmFoco("SI");
                        setOrdenConfirmandoListo(orden);
                      }}
                      style={{
                        padding: densidadEfectiva === "SOLO_AUDIO" ? "11px 12px" : "13px 14px",
                        borderRadius: "14px",
                        background: esExequiales
                          ? "linear-gradient(145deg, #2B2127, #1E181C)"
                          : enPrep
                            ? "linear-gradient(145deg, #27211B, #1D1814)"
                            : "linear-gradient(145deg, #231D19, #1A1613)",
                        border: enfocado
                          ? "2px solid var(--cb-c8a25a, #C8A25A)"
                          : esExequiales
                            ? "1.5px solid var(--cb-9e89ad-a450, rgba(158, 137, 173, 0.45))"
                            : enPrep
                              ? "1.5px solid var(--cb-c8a25a-a450, rgba(200, 162, 90, 0.45))"
                              : "1px solid var(--cb-d6c3a5-a180, rgba(214, 195, 165, 0.18))",
                        boxShadow: enfocado
                          ? "0 0 18px rgba(200, 162, 90, 0.25)"
                          : "0 6px 16px rgba(0, 0, 0, 0.3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "7px",
                        cursor: "pointer",
                        opacity: procesandoId === orden.id ? 0.65 : 1,
                      }}
                    >
                      {/* Fila 1: #Orden + Código + Hora */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: "8px",
                              background:
                                numeroOrden === 1
                                  ? "#F59E0B"
                                  : esExequiales
                                    ? "#9333EA"
                                    : "#0284C7",
                              color: numeroOrden === 1 ? "#0F172A" : "#FFFFFF",
                              fontWeight: 900,
                              fontSize: "1.05rem",
                            }}
                          >
                            #{numeroOrden}
                          </span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#CBD5E1" }}>
                            {orden.codigo}
                          </span>
                          {esExequiales && (
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "6px",
                                background: "#DC2626",
                                color: "#FFFFFF",
                                fontSize: "0.7rem",
                                fontWeight: 800,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                            >
                              <Zap size={11} /> URGENTE
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "7px",
                            background: "rgba(15, 23, 42, 0.7)",
                            color: "#FDE68A",
                            fontSize: "0.8rem",
                            fontWeight: 800,
                          }}
                        >
                          <Clock size={13} />
                          {horarioTexto.replace("Hora exacta: ", "")}
                        </span>
                      </div>

                      {/* Fila 2: Tipo de arreglo */}
                      <div
                        style={{
                          fontSize: densidadEfectiva === "SOLO_AUDIO" ? "0.96rem" : "1.08rem",
                          fontWeight: 800,
                          color: "#FFFFFF",
                          lineHeight: 1.25,
                        }}
                      >
                        {orden.productoResumen}
                      </div>

                      {/* Fila 3: Colores (Chips visuales) */}
                      {chipsColores.length > 0 && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {chipsColores.map((chip, cIdx) => (
                            <span
                              key={`${chip.etiqueta}-${cIdx}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "3px 9px",
                                borderRadius: "999px",
                                background: "rgba(15, 23, 42, 0.85)",
                                border: `1px solid ${chip.bordeHex}`,
                                color: "#F8FAFC",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                              }}
                            >
                              <span
                                style={{
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  background: chip.hex,
                                  border: "1px solid var(--cb-ffffff-a600, rgba(255,255,255,0.6))",
                                  display: "inline-block",
                                }}
                              />
                              {chip.etiqueta}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Fila 4: Extras */}
                      {orden.extras && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "#FBCFE8",
                          }}
                        >
                          <Gift size={14} color="#F472B6" />
                          <span>Extras: {orden.extras}</span>
                        </div>
                      )}

                      {/* Fila 5: Notas adicionales para Taller */}
                      {orden.observaciones && (
                        <div
                          style={{
                            padding: "6px 9px",
                            borderRadius: "8px",
                            background: "rgba(245, 158, 11, 0.14)",
                            border: "1px solid rgba(245, 158, 11, 0.4)",
                            color: "#FDE68A",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            lineHeight: 1.3,
                          }}
                        >
                          📝 {orden.observaciones}
                        </div>
                      )}

                      {/* Pie de tarjeta: Estado + Acción rápida */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "2px",
                          paddingTop: "6px",
                          borderTop: "1px solid var(--cb-94a3b8-a160, rgba(148,163,184,0.16))",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            color: enPrep ? "#FBBF24" : "#38BDF8",
                          }}
                        >
                          {enPrep ? "● EN PREPARACIÓN" : "● NUEVO EN TALLER"}
                          {orden.salaServicio ? ` · ${orden.salaServicio}` : ""}
                        </span>

                        {tablero.puedeInteractuar && (
                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: "7px",
                              background: enPrep ? "#059669" : "#0284C7",
                              color: "#FFFFFF",
                              fontSize: "0.73rem",
                              fontWeight: 800,
                            }}
                          >
                            {enPrep ? "OK → Marcar Listo ✓" : "OK → Iniciar"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            VISTA B: MODO SHOWROOM EVENTOS (CATÁLOGO + GOOGLE FOTOS + QR)
           ============================================================ */}
        {modoActivo === "EVENTOS" && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              background: "#090D16",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Selector de álbum / catálogo */}
            <div
              style={{
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                background: "rgba(15, 23, 42, 0.88)",
                borderBottom: "1px solid var(--cb-94a3b8-a160, rgba(148,163,184,0.16))",
                flexWrap: "wrap",
                zIndex: 10,
              }}
            >
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroShowroom("TODOS");
                    setIndiceSlide(0);
                  }}
                  style={pillShowroomStyle(filtroShowroom === "TODOS")}
                >
                  Todo ({slidesEventos.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroShowroom("CATALOGO");
                    setIndiceSlide(0);
                  }}
                  style={pillShowroomStyle(filtroShowroom === "CATALOGO")}
                >
                  Catálogo Eventos ({tablero.productosEventos.length})
                </button>
                {cfg.albumesGoogleFotos.map((alb) => (
                  <button
                    key={alb.id}
                    type="button"
                    onClick={() => {
                      setFiltroShowroom(alb.id);
                      setIndiceSlide(0);
                    }}
                    style={pillShowroomStyle(filtroShowroom === alb.id)}
                  >
                    📷 {alb.titulo}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() =>
                    setIndiceSlide((i) =>
                      slidesEventos.length > 0
                        ? (i - 1 + slidesEventos.length) % slidesEventos.length
                        : 0
                    )
                  }
                  style={hudBtnStyle("#1E293B")}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPausadoShowroom((p) => !p)}
                  style={hudBtnStyle("#1E293B")}
                >
                  {pausadoShowroom ? <Play size={15} /> : <Pause size={15} />}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setIndiceSlide((i) =>
                      slidesEventos.length > 0 ? (i + 1) % slidesEventos.length : 0
                    )
                  }
                  style={hudBtnStyle("#1E293B")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Diapositiva HD */}
            {slideActual ? (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {/* Fondo desenfocado elegante */}
                <img
                  src={slideActual.imagenUrl}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "blur(28px) brightness(0.32)",
                    transform: "scale(1.08)",
                  }}
                />

                {/* Imagen principal nítida */}
                <img
                  src={slideActual.imagenUrl}
                  alt={slideActual.titulo}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    maxWidth: "92%",
                    maxHeight: "88%",
                    objectFit: "contain",
                    borderRadius: "16px",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.65)",
                  }}
                />

                {/* Tarjeta inferior izquierda con título/descripción/precio */}
                <div
                  style={{
                    position: "absolute",
                    left: "28px",
                    bottom: "24px",
                    zIndex: 5,
                    maxWidth: "60%",
                    padding: "16px 22px",
                    borderRadius: "16px",
                    background: "rgba(15, 23, 42, 0.84)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid var(--cb-ffffff-a160, rgba(255,255,255,0.16))",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      color: "var(--ct-f472b6, #F472B6)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {slideActual.subtitulo}
                  </div>
                  <div style={{ fontSize: "1.65rem", fontWeight: 900, marginTop: "3px" }}>
                    {slideActual.titulo}
                  </div>
                  {slideActual.descripcion && (
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "#CBD5E1",
                        marginTop: "6px",
                        lineHeight: 1.4,
                      }}
                    >
                      {slideActual.descripcion.slice(0, 180)}
                    </div>
                  )}
                  {slideActual.tipo === "PRODUCTO" &&
                    cfg.mostrarPreciosEventos &&
                    typeof slideActual.precioDesde === "number" &&
                    slideActual.precioDesde > 0 && (
                      <div
                        style={{
                          marginTop: "8px",
                          display: "inline-block",
                          padding: "4px 12px",
                          borderRadius: "999px",
                          background: "#059669",
                          color: "#FFFFFF",
                          fontWeight: 800,
                          fontSize: "0.95rem",
                        }}
                      >
                        Desde ${slideActual.precioDesde.toFixed(2)}
                      </div>
                    )}
                </div>

                {/* Código QR compartible (cuando es álbum de Google Fotos) */}
                {slideActual.qrUrl && (
                  <div
                    style={{
                      position: "absolute",
                      right: "28px",
                      bottom: "24px",
                      zIndex: 5,
                      padding: "12px",
                      borderRadius: "16px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-0f172a, #0F172A)",
                      boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      width: "164px",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(slideActual.qrUrl)}`}
                      alt="QR Álbum Google Fotos"
                      width={132}
                      height={132}
                      style={{ borderRadius: "8px" }}
                    />
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <QrCode size={13} /> Escanea el álbum
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ct-94a3b8, #94A3B8)",
                  gap: "10px",
                }}
              >
                <Sparkles size={46} color="#F472B6" />
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#F8FAFC" }}>
                  Showroom de Eventos — {nombreNegocio}
                </div>
                <div style={{ fontSize: "0.88rem" }}>
                  Configura álbumes de Google Fotos o activa productos de Eventos desde el Control
                  TV en /panel/taller.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Franja Inferior Sobria: Pedidos Listos Entrega (Hoy) */}
      {modoActivo === "TALLER" && mostrarFranjaListos && (
        <div
          style={{
            height: densidadEfectiva === "SOLO_AUDIO" ? "64px" : "92px",
            padding: "8px 18px",
            background: "#1B1714",
            borderTop: "1px solid var(--cb-d6c3a5-a160, rgba(214, 195, 165, 0.16))",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexShrink: 0,
            overflowX: "auto",
          }}
        >
          <div
            style={{
              minWidth: "175px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              flexShrink: 0,
              borderRight: "1px solid var(--cb-d6c3a5-a160, rgba(214, 195, 165, 0.16))",
              paddingRight: "12px",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 800,
                color: "var(--ct-8ab597, #8AB597)",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                letterSpacing: "0.04em",
              }}
            >
              <CheckCircle2 size={15} /> LISTOS HOY (
              {tablero.ordenes.filter((o) => o.estadoTaller === "LISTO_ENTREGA").length})
            </span>
            <span style={{ fontSize: "0.73rem", color: "var(--ct-a89d8f, #A89D8F)", fontWeight: 600 }}>
              ✓✓ {totalEntregadosHoy} entregados hoy
            </span>
          </div>

          {listosVisibles.length === 0 ? (
            <span style={{ fontSize: "0.84rem", color: "var(--ct-64748b, #64748B)" }}>
              Los arreglos marcados como Listos aparecerán aquí y se actualizarán al entregarse.
            </span>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {listosVisibles.map((o) => {
                const entregado = o.estadoTaller === "ENTREGADO";
                return (
                  <div
                    key={o.id}
                    onClick={() => {
                      setBotonConfirmFoco("NO");
                      setOrdenConfirmandoListo(o);
                    }}
                    title="Clic para ver detalle completo del pedido"
                    style={{
                      minWidth: "215px",
                      maxWidth: "260px",
                      padding: "8px 12px",
                      borderRadius: "11px",
                      background: entregado
                        ? "rgba(30, 41, 59, 0.7)"
                        : "linear-gradient(135deg, rgba(6, 95, 70, 0.88), rgba(15, 118, 110, 0.88))",
                      border: entregado
                        ? "1px solid var(--cb-94a3b8-a250, rgba(148, 163, 184, 0.25))"
                        : "1.5px solid #34D399",
                      opacity: entregado ? 0.72 : 1,
                      flexShrink: 0,
                      cursor: "pointer",
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
                      <strong style={{ fontSize: "0.86rem", color: "#FFFFFF" }}>
                        {o.codigo}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          background: entregado ? "#334155" : "#10B981",
                          color: entregado ? "#CBD5E1" : "#022C22",
                        }}
                      >
                        {entregado ? "✓✓ ENTREGADO" : "✓ LISTO"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "#E2E8F0",
                        marginTop: "3px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {o.productoResumen}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Buscador / URL Directa de YouTube en Pantalla TV */}
      {abiertoBuscadorYt && (
        <div
          onClick={() => setAbiertoBuscadorYt(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 140,
            background: "rgba(2, 6, 23, 0.84)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "860px",
              maxHeight: "88vh",
              borderRadius: "18px",
              background: "#0F172A",
              border: "1.5px solid var(--cb-94a3b8-a300, rgba(148, 163, 184, 0.3))",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--cb-94a3b8-a200, rgba(148,163,184,0.2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <Search size={20} color="#F87171" />
                <div>
                  <div style={{ fontSize: "1.02rem", fontWeight: 800 }}>
                    Buscar en YouTube o Pegar URL / Playlist
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--ct-94a3b8, #94A3B8)" }}>
                    Escribe un artista, género o pega directamente cualquier enlace de YouTube.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAbiertoBuscadorYt(false)}
                aria-label="Cerrar buscador YouTube"
                style={{
                  padding: "7px",
                  borderRadius: "8px",
                  border: "none",
                  background: "rgba(255,255,255,0.1)",
                  color: "#F8FAFC",
                  cursor: "pointer",
                  display: "inline-flex",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                padding: "0 20px",
                borderBottom: "1px solid var(--cb-94a3b8-a200, rgba(148,163,184,0.2))",
                display: "flex",
                gap: "8px",
                background: "#0B1120",
              }}
            >
              {(
                [
                  { id: "radio", label: `📻 Radios en Vivo (${emisorasRadio.length})` },
                  { id: "buscar", label: "🔍 YouTube / URL" },
                  { id: "favoritos", label: `⭐ Favoritos (${favoritosLocales.length + radiosFavoritasLocal.length})` },
                  { id: "cola", label: `📋 Cola YouTube (${colaYt.length})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTabModalYt(t.id)}
                  style={{
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: tabModalYt === t.id ? "2.5px solid #F87171" : "2.5px solid transparent",
                    background: "transparent",
                    color: tabModalYt === t.id ? "#FFFFFF" : "var(--ct-94a3b8, #94A3B8)",
                    fontSize: "0.83rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
              {tabModalYt === "radio" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void cargarEmisorasRadio({ consulta: consultaRadio.trim() || undefined }, false);
                    }}
                    style={{ display: "flex", gap: "8px" }}
                  >
                    <input
                      type="text"
                      value={consultaRadio}
                      onChange={(e) => setConsultaRadio(e.target.value)}
                      placeholder="Buscar emisora por nombre (ej: Canela, La Otra, Disney, FM Mundo, Caracol...)"
                      style={{
                        flex: 1,
                        padding: "11px 14px",
                        borderRadius: "10px",
                        border: "1.5px solid #334155",
                        background: "#020617",
                        color: "#F8FAFC",
                        fontSize: "0.9rem",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={cargandoRadios}
                      style={{
                        padding: "11px 18px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#059669",
                        color: "#FFFFFF",
                        fontSize: "0.86rem",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {cargandoRadios ? "Buscando..." : "Buscar Radio"}
                    </button>
                  </form>

                  <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                    {(
                      [
                        { label: "🇪🇨 Ecuador", filtro: { pais: "EC" } },
                        { label: "🇨🇴 Colombia", filtro: { pais: "CO" } },
                        { label: "💃 Salsa", filtro: { genero: "salsa" } },
                        { label: "🪘 Cumbia", filtro: { genero: "cumbia" } },
                        { label: "❤️ Baladas", filtro: { genero: "romantic" } },
                        { label: "🎵 Pop Latino", filtro: { genero: "latin pop" } },
                        { label: "☕ Jazz / Café", filtro: { genero: "jazz" } },
                        { label: "🎹 Piano", filtro: { genero: "piano" } },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.label}
                        type="button"
                        onClick={() => void cargarEmisorasRadio(g.filtro, false)}
                        style={hudBtnStyle("#1E293B")}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>

                  {errorRadio && (
                    <div style={{ padding: "10px 12px", borderRadius: "9px", background: "rgba(245,158,11,0.16)", color: "#FDE68A", fontSize: "0.83rem" }}>
                      {errorRadio}
                    </div>
                  )}

                  {cargandoRadios ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--ct-94a3b8, #94A3B8)" }}>
                      <Loader2 size={20} /> Cargando emisoras en vivo...
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" }}>
                      {emisorasRadio.map((em) => {
                        const activa = emisoraActual?.streamUrl === em.streamUrl;
                        const esFav = radiosFavoritasLocal.some((r) => r.streamUrl === em.streamUrl);
                        return (
                          <div
                            key={em.id}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "11px",
                              background: activa ? "rgba(5,150,105,0.22)" : "#1E293B",
                              border: activa ? "1.5px solid #10B981" : "1px solid #334155",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                {em.faviconUrl ? (
                                  <img src={em.faviconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <Radio size={18} color="#34D399" />
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#F8FAFC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {em.nombre}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--ct-94a3b8, #94A3B8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {[em.pais, em.etiquetas].filter(Boolean).join(" · ") || "Radio Online"}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => reproducirEmisoraRadio(em, true)}
                                style={hudBtnStyle("#059669")}
                              >
                                <Play size={12} /> Escuchar
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleRadioFavorita(em)}
                                style={hudBtnStyle(esFav ? "#B45309" : "#0F172A")}
                              >
                                <Star size={12} fill={esFav ? "#FDE047" : "none"} color={esFav ? "#FDE047" : "#F8FAFC"} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : tabModalYt === "favoritos" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.84rem", color: "#CBD5E1" }}>
                      Tu lista guardada de música y playlists que sí reproducen en el taller.
                    </span>
                    {favoritosLocales.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const comoCola: ResultadoBusquedaYoutubeTv[] = favoritosLocales.map((f) => {
                            const p = extraerYoutubeVideoOPlaylist(f.url);
                            return {
                              videoId: p.videoId || f.id,
                              titulo: f.titulo,
                              canal: f.canal || "Favorito Taller",
                              duracion: "",
                              miniaturaUrl:
                                f.miniaturaUrl ||
                                (p.videoId ? `https://i.ytimg.com/vi/${p.videoId}/mqdefault.jpg` : ""),
                              url: f.url,
                            };
                          });
                          reproducirDesdeListaYt(comoCola, 0, true);
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "9px",
                          border: "none",
                          background: "#059669",
                          color: "#FFFFFF",
                          fontSize: "0.82rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Play size={14} /> Reproducir todos mis favoritos
                      </button>
                    )}
                  </div>

                  {favoritosLocales.length === 0 ? (
                    <div style={{ padding: "28px", textAlign: "center", color: "var(--ct-94a3b8, #94A3B8)", border: "1px dashed #334155", borderRadius: "12px" }}>
                      Aún no tienes favoritos guardados. Busca música y toca la estrella ⭐ para guardar tus favoritos.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {favoritosLocales.map((fav, idx) => (
                        <div
                          key={fav.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            padding: "9px 12px",
                            borderRadius: "10px",
                            background: "#1E293B",
                            border: fav.url === youtubeUrlActual ? "1.5px solid #38BDF8" : "1px solid #334155",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#F8FAFC" }}>
                              {fav.titulo}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "var(--ct-94a3b8, #94A3B8)" }}>
                              {fav.canal || fav.url}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const comoCola: ResultadoBusquedaYoutubeTv[] = favoritosLocales.map((f) => {
                                  const p = extraerYoutubeVideoOPlaylist(f.url);
                                  return {
                                    videoId: p.videoId || f.id,
                                    titulo: f.titulo,
                                    canal: f.canal || "Favorito",
                                    duracion: "",
                                    miniaturaUrl: f.miniaturaUrl || "",
                                    url: f.url,
                                  };
                                });
                                reproducirDesdeListaYt(comoCola, idx, true);
                              }}
                              style={hudBtnStyle("#0284C7")}
                            >
                              <Play size={13} /> Reproducir
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleFavoritoYt(fav)}
                              title="Quitar de favoritos"
                              style={hudBtnStyle("#7F1D1D")}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : tabModalYt === "cola" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "0.82rem", color: "#CBD5E1" }}>
                    <ListMusic size={15} style={{ verticalAlign: "middle", marginRight: "6px" }} />
                    Si una canción es bloqueada por la disquera, la TV salta automáticamente a la siguiente de esta cola.
                  </div>
                  {colaYt.length === 0 ? (
                    <div style={{ padding: "28px", textAlign: "center", color: "var(--ct-94a3b8, #94A3B8)", border: "1px dashed #334155", borderRadius: "12px" }}>
                      Busca un género o artista en la pestaña &quot;Buscar / URL&quot; para cargar una cola continua de sugerencias.
                    </div>
                  ) : (
                    colaYt.map((vid, idx) => (
                      <div
                        key={`${vid.videoId}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "8px 11px",
                          borderRadius: "10px",
                          background: idx === indiceColaYt ? "rgba(2, 132, 199, 0.25)" : "#1E293B",
                          border: idx === indiceColaYt ? "1.5px solid #38BDF8" : "1px solid #334155",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <span style={{ fontWeight: 800, color: idx === indiceColaYt ? "#38BDF8" : "var(--ct-94a3b8, #94A3B8)", minWidth: "24px" }}>
                            {idx === indiceColaYt ? "▶" : `#${idx + 1}`}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#F8FAFC" }}>{vid.titulo}</div>
                            <div style={{ fontSize: "0.73rem", color: "var(--ct-94a3b8, #94A3B8)" }}>{vid.canal} {vid.duracion ? `· ${vid.duracion}` : ""}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => reproducirDesdeListaYt(colaYt, idx, true)}
                          style={hudBtnStyle("#0284C7")}
                        >
                          Reproducir
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void ejecutarBusquedaOUrlYoutube();
                }}
                style={{ display: "flex", gap: "8px" }}
              >
                <input
                  type="text"
                  autoFocus
                  value={consultaYt}
                  onChange={(e) => setConsultaYt(e.target.value)}
                  placeholder="Ej: música alegre para trabajar, salsa romántica, o https://www.youtube.com/watch?v=..."
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #334155",
                    background: "#020617",
                    color: "#F8FAFC",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={buscandoYt}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: "0.9rem",
                    fontWeight: 800,
                    cursor: buscandoYt ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    flexShrink: 0,
                  }}
                >
                  {buscandoYt ? <Loader2 size={16} /> : <Search size={16} />}
                  {extraerYoutubeVideoOPlaylist(consultaYt).videoId ||
                  extraerYoutubeVideoOPlaylist(consultaYt).playlistId
                    ? "Reproducir URL"
                    : "Buscar"}
                </button>
              </form>

              {/* Sugerencias rápidas de 1 clic (ideales para control remoto TV) */}
              <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                {[
                  "Música alegre para trabajar",
                  "Salsa y cumbia mix",
                  "Baladas en español 80s 90s",
                  "Pop latino éxitos",
                  "Jazz instrumental café",
                  "Música piano elegante bodas",
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setConsultaYt(sug);
                      void ejecutarBusquedaOUrlYoutube(sug);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "999px",
                      border: "1px solid var(--cb-94a3b8-a280, rgba(148,163,184,0.28))",
                      background: "#1E293B",
                      color: "#E2E8F0",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🎵 {sug}
                  </button>
                ))}
              </div>

              {errorYtBusqueda && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "9px",
                    background: "rgba(220, 38, 38, 0.16)",
                    border: "1px solid rgba(248, 113, 113, 0.45)",
                    color: "#FECACA",
                    fontSize: "0.84rem",
                  }}
                >
                  {errorYtBusqueda}
                </div>
              )}

              {buscandoYt ? (
                <div style={{ padding: "28px", textAlign: "center", color: "var(--ct-94a3b8, #94A3B8)" }}>
                  <Loader2 size={22} /> Buscando videos en YouTube...
                </div>
              ) : resultadosYt.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {resultadosYt.map((vid, idx) => {
                    const esFav = favoritosLocales.some((f) => f.url === vid.url);
                    return (
                    <div
                      key={vid.videoId}
                      style={{
                        padding: "8px",
                        borderRadius: "12px",
                        border: "1px solid var(--cb-94a3b8-a250, rgba(148,163,184,0.25))",
                        background: "#1E293B",
                        color: "#F8FAFC",
                        display: "flex",
                        flexDirection: "column",
                        gap: "7px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => reproducirDesdeListaYt(resultadosYt, idx, true)}
                        style={{
                          textAlign: "left",
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "7px",
                        }}
                      >
                      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: "8px", overflow: "hidden", background: "#000" }}>
                        <img
                          src={vid.miniaturaUrl}
                          alt={vid.titulo}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        {vid.duracion && (
                          <span
                            style={{
                              position: "absolute",
                              right: "6px",
                              bottom: "6px",
                              padding: "2px 6px",
                              borderRadius: "5px",
                              background: "rgba(0,0,0,0.82)",
                              color: "#FFFFFF",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                            }}
                          >
                            {vid.duracion}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          lineHeight: 1.25,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {vid.titulo}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--ct-94a3b8, #94A3B8)" }}>{vid.canal}</div>
                      </button>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", paddingTop: "4px", borderTop: "1px solid var(--cb-94a3b8-a160, rgba(148,163,184,0.16))" }}>
                        <button
                          type="button"
                          onClick={() => reproducirDesdeListaYt(resultadosYt, idx, true)}
                          style={hudBtnStyle("#0284C7")}
                        >
                          <Play size={12} /> Reproducir
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleFavoritoYt(vid)}
                          title={esFav ? "Quitar de favoritos" : "Guardar en Mis Favoritos"}
                          style={hudBtnStyle(esFav ? "#B45309" : "#0F172A")}
                        >
                          <Star size={12} fill={esFav ? "#FDE047" : "none"} color={esFav ? "#FDE047" : "#F8FAFC"} />
                          {esFav ? "Guardado" : "Favorito"}
                        </button>
                      </div>
                    </div>
                  );})}
                </div>
              ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Completo del Pedido + Cambio de Estado en Pantalla TV */}
      {ordenConfirmandoListo && (() => {
        const o = ordenConfirmandoListo;
        const esExeq =
          o.clasificacionPedido === "EXEQUIALES" || o.origenTipo === "EXEQUIALES_LLAMADA";
        const chipsColor = parsearColoresPedido(o.colores);
        const horario = formatearHorarioEntregaOrden({
          franjaHoraria: o.franjaHoraria,
          horaEspecifica: o.horaEspecifica,
          esExequiales: esExeq,
        });
        const valorNum = typeof o.totalUsd === "number" ? o.totalUsd : Number(o.totalUsd || 0);
        const itemsDetalle = Array.isArray(o.items) ? o.items : [];
        const estadoLabel =
          o.estadoTaller === "ENVIADO_TALLER"
            ? "NUEVO EN TALLER"
            : o.estadoTaller === "EN_PREPARACION"
              ? "EN PREPARACIÓN"
              : o.estadoTaller === "LISTO_ENTREGA"
                ? "LISTO PARA ENTREGA"
                : "ENTREGADO";

        return (
          <div
            onClick={() => setOrdenConfirmandoListo(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 130,
              background: "rgba(2, 6, 23, 0.84)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "720px",
                maxHeight: "90vh",
                borderRadius: "20px",
                background: "#0F172A",
                border: "2px solid #38BDF8",
                boxShadow: "0 24px 64px rgba(0,0,0,0.75)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Encabezado */}
              <div
                style={{
                  padding: "18px 22px",
                  background: "#1E293B",
                  borderBottom: "1px solid var(--cb-94a3b8-a220, rgba(148,163,184,0.22))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "4px 11px",
                      borderRadius: "8px",
                      background: "#0284C7",
                      color: "#FFFFFF",
                      fontSize: "1rem",
                      fontWeight: 900,
                    }}
                  >
                    {o.codigo}
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      background:
                        o.estadoTaller === "LISTO_ENTREGA" || o.estadoTaller === "ENTREGADO"
                          ? "#059669"
                          : o.estadoTaller === "EN_PREPARACION"
                            ? "#D97706"
                            : "#2563EB",
                      color: "#FFFFFF",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                    }}
                  >
                    {estadoLabel}
                  </span>
                  {o.clasificacionPedido && (
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgba(148,163,184,0.2)",
                        color: "#E2E8F0",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {o.clasificacionPedido.replace("_", " / ")}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {valorNum > 0 && (
                    <span
                      style={{
                        padding: "5px 13px",
                        borderRadius: "10px",
                        background: "rgba(16, 185, 129, 0.2)",
                        border: "1.5px solid #10B981",
                        color: "#34D399",
                        fontSize: "1.1rem",
                        fontWeight: 900,
                      }}
                    >
                      ${valorNum.toFixed(2)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setOrdenConfirmandoListo(null)}
                    aria-label="Cerrar detalle"
                    style={{
                      padding: "7px",
                      borderRadius: "8px",
                      border: "none",
                      background: "rgba(255,255,255,0.1)",
                      color: "#F8FAFC",
                      cursor: "pointer",
                      display: "inline-flex",
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Cuerpo con TODOS los datos del pedido */}
              <div
                style={{
                  padding: "18px 22px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {/* Arreglo principal e ítems */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: "13px",
                    background: "rgba(30, 41, 59, 0.75)",
                    border: "1px solid var(--cb-94a3b8-a200, rgba(148,163,184,0.2))",
                  }}
                >
                  <div style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--ct-94a3b8, #94A3B8)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    🌸 Producto / Arreglo
                  </div>
                  <div style={{ fontSize: "1.22rem", fontWeight: 900, color: "#FFFFFF", marginTop: "4px" }}>
                    {o.productoResumen}
                  </div>
                  {itemsDetalle.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {itemsDetalle.map((it, i) => (
                        <div key={i} style={{ fontSize: "0.86rem", color: "#CBD5E1", display: "flex", justifyContent: "space-between", gap: "8px" }}>
                          <span>• {it.cantidad || 1}x {it.descripcion || "Arreglo"}</span>
                          {typeof it.precioUnitario === "number" && it.precioUnitario > 0 && (
                            <span style={{ color: "#34D399", fontWeight: 700 }}>${Number(it.precioUnitario).toFixed(2)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grid 2 columnas: Fecha/Hora + Valor/Pago */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(30,41,59,0.65)", border: "1px solid var(--cb-94a3b8-a180, rgba(148,163,184,0.18))" }}>
                    <div style={{ fontSize: "0.73rem", fontWeight: 800, color: "var(--ct-94a3b8, #94A3B8)", textTransform: "uppercase" }}>
                      📅 Fecha y Hora de Entrega
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#FDE68A", marginTop: "4px" }}>
                      {o.fechaEntrega} · {horario}
                    </div>
                    {o.fechaElaboracion && o.fechaElaboracion !== o.fechaEntrega && (
                      <div style={{ fontSize: "0.78rem", color: "var(--ct-94a3b8, #94A3B8)", marginTop: "3px" }}>
                        Elaboración programada: {o.fechaElaboracion}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(30,41,59,0.65)", border: "1px solid var(--cb-94a3b8-a180, rgba(148,163,184,0.18))" }}>
                    <div style={{ fontSize: "0.73rem", fontWeight: 800, color: "var(--ct-94a3b8, #94A3B8)", textTransform: "uppercase" }}>
                      💵 Valor y Pago
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#34D399", marginTop: "4px" }}>
                      {valorNum > 0 ? `$${valorNum.toFixed(2)} USD` : "Convenio / Sin monto"}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#CBD5E1", marginTop: "3px" }}>
                      {[o.estadoPago, o.metodoPago].filter(Boolean).join(" · ") || "Registrado"}
                    </div>
                  </div>
                </div>

                {/* Colores y Extras */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(30,41,59,0.65)", border: "1px solid var(--cb-94a3b8-a180, rgba(148,163,184,0.18))" }}>
                    <div style={{ fontSize: "0.73rem", fontWeight: 800, color: "var(--ct-94a3b8, #94A3B8)", textTransform: "uppercase" }}>
                      🎨 Colores a Utilizar
                    </div>
                    {chipsColor.length > 0 ? (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                        {chipsColor.map((chip, idx) => (
                          <span
                            key={`${chip.etiqueta}-${idx}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              background: "#0F172A",
                              border: `1px solid ${chip.bordeHex}`,
                              color: "#F8FAFC",
                              fontSize: "0.84rem",
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: chip.hex, display: "inline-block" }} />
                            {chip.etiqueta}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: "0.86rem", color: "var(--ct-64748b, #64748B)", marginTop: "5px" }}>
                        Sin colores específicos (estándar del arreglo)
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(30,41,59,0.65)", border: "1px solid var(--cb-94a3b8-a180, rgba(148,163,184,0.18))" }}>
                    <div style={{ fontSize: "0.73rem", fontWeight: 800, color: "var(--ct-94a3b8, #94A3B8)", textTransform: "uppercase" }}>
                      🎁 Extras Incluidos
                    </div>
                    <div style={{ fontSize: "0.94rem", fontWeight: 700, color: o.extras ? "#FBCFE8" : "var(--ct-64748b, #64748B)", marginTop: "5px" }}>
                      {o.extras || "Sin extras adicionales"}
                    </div>
                  </div>
                </div>

                {/* Cliente / Destinatario / Entrega */}
                <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(30,41,59,0.65)", border: "1px solid var(--cb-94a3b8-a180, rgba(148,163,184,0.18))", display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ fontSize: "0.73rem", fontWeight: 800, color: "var(--ct-94a3b8, #94A3B8)", textTransform: "uppercase" }}>
                    👤 Entrega y Destinatario
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#E2E8F0", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    {o.clienteSolicita && <span><strong>Solicita:</strong> {o.clienteSolicita}</span>}
                    {o.destinatarioFallecido && (
                      <span><strong>{esExeq ? "Fallecido:" : "Destinatario:"}</strong> {o.destinatarioFallecido}</span>
                    )}
                    {o.salaServicio && <span><strong>Sala:</strong> {o.salaServicio}</span>}
                  </div>
                  {(o.ubicacionEntrega || o.retiroEnLocal) && (
                    <div style={{ fontSize: "0.85rem", color: "#CBD5E1" }}>
                      <strong>Ubicación:</strong>{" "}
                      {o.retiroEnLocal ? "Retiro en Tienda / Local" : o.ubicacionEntrega}
                    </div>
                  )}
                </div>

                {/* Notas y Dedicatoria */}
                {o.observaciones && (
                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.45)", color: "#FDE68A", fontSize: "0.92rem", fontWeight: 600 }}>
                    📝 <strong>Notas para Taller:</strong> {o.observaciones}
                  </div>
                )}

                {o.dedicatoria && (
                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(236, 72, 153, 0.12)", border: "1px solid rgba(244, 114, 182, 0.35)", color: "#FCE7F3", fontSize: "0.88rem" }}>
                    💌 <strong>Dedicatoria:</strong> {o.dedicatoria}
                  </div>
                )}
              </div>

              {/* Pie con acciones rápidas */}
              <div
                style={{
                  padding: "14px 22px",
                  background: "#1E293B",
                  borderTop: "1px solid var(--cb-94a3b8-a220, rgba(148,163,184,0.22))",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOrdenConfirmandoListo(null)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    border: botonConfirmFoco === "NO" ? "2.5px solid var(--cb-ffffff, #FFFFFF)" : "1px solid #475569",
                    background: "#0F172A",
                    color: "#E2E8F0",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cerrar
                </button>

                {tablero.puedeInteractuar && o.estadoTaller === "ENVIADO_TALLER" && (
                  <button
                    type="button"
                    disabled={procesandoId === o.id}
                    onClick={() => void avanzarEstadoDesdeTv(o, "EN_PREPARACION")}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "10px",
                      border: botonConfirmFoco === "SI" ? "2.5px solid var(--cb-ffffff, #FFFFFF)" : "1px solid #38BDF8",
                      background: "#0284C7",
                      color: "#FFFFFF",
                      fontSize: "0.92rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Play size={16} /> Iniciar Preparación
                  </button>
                )}

                {tablero.puedeInteractuar &&
                  (o.estadoTaller === "ENVIADO_TALLER" || o.estadoTaller === "EN_PREPARACION") && (
                    <button
                      type="button"
                      disabled={procesandoId === o.id}
                      onClick={() => void avanzarEstadoDesdeTv(o, "LISTO_ENTREGA")}
                      style={{
                        padding: "10px 22px",
                        borderRadius: "10px",
                        border:
                          botonConfirmFoco === "SI" && o.estadoTaller === "EN_PREPARACION"
                            ? "2.5px solid var(--cb-ffffff, #FFFFFF)"
                            : "1px solid #10B981",
                        background: "#059669",
                        color: "#FFFFFF",
                        fontSize: "0.92rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Check size={17} /> Marcar Listo para Entrega
                    </button>
                  )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Portal: Ventana Flotante SIEMPRE ENCIMA (Document Picture-in-Picture sobre youtube.com real) */}
      {pipContainer &&
        createPortal(
          <div
            style={{
              width: "100%",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              background: "#14110F",
              color: "#F6F1E8",
              overflow: "hidden",
            }}
          >
            {/* Cabecera Flotante */}
            <div
              style={{
                padding: "10px 12px",
                background: "#1C1714",
                borderBottom: "1px solid var(--cb-d6c3a5-a180, rgba(214,195,165,0.18))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#E8C97E" }}>
                  {nombreNegocio.toUpperCase()} · TALLER ({pendientes.length})
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--ct-a89d8f, #A89D8F)" }}>
                  {conectado ? "● En vivo" : "○ Reconectando"} · {formatearHoraEcuador(reloj)}
                </div>
              </div>
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "5px 9px",
                  borderRadius: "7px",
                  background: "#3D5A45",
                  color: "#F6F1E8",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                YouTube <ExternalLink size={11} />
              </a>
            </div>

            {/* Lista en vivo de pedidos pendientes */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {pendientes.length === 0 ? (
                <div style={{ padding: "32px 12px", textAlign: "center", color: "var(--ct-a89d8f, #A89D8F)", fontSize: "0.84rem" }}>
                  ✓ Todo al día en taller. Los pedidos nuevos aparecerán aquí al instante.
                </div>
              ) : (
                pendientes.map((o, idx) => {
                  const chips = parsearColoresPedido(o.colores);
                  const enPrep = o.estadoTaller === "EN_PREPARACION";
                  const esExeq = o.clasificacionPedido === "EXEQUIALES" || o.origenTipo === "EXEQUIALES_LLAMADA";
                  return (
                    <div
                      key={o.id}
                      style={{
                        padding: "10px 11px",
                        borderRadius: "11px",
                        background: "#211B17",
                        border: enPrep ? "1.5px solid var(--cb-c8a25a, #C8A25A)" : "1px solid var(--cb-d6c3a5-a200, rgba(214,195,165,0.2))",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                        <strong style={{ fontSize: "0.84rem", color: "#E8C97E" }}>
                          #{idx + 1} {o.codigo}
                        </strong>
                        <span style={{ fontSize: "0.74rem", color: "#D6CEC2", fontWeight: 700 }}>
                          {formatearHorarioEntregaOrden({
                            franjaHoraria: o.franjaHoraria,
                            horaEspecifica: o.horaEspecifica,
                            esExequiales: esExeq,
                          }).replace("Hora exacta: ", "")}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#FFFFFF" }}>
                        {o.productoResumen}
                      </div>
                      {chips.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {chips.map((c, ci) => (
                            <span
                              key={`${c.etiqueta}-${ci}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: "#14110F",
                                border: `1px solid ${c.bordeHex}`,
                                fontSize: "0.7rem",
                              }}
                            >
                              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: c.hex }} />
                              {c.etiqueta}
                            </span>
                          ))}
                        </div>
                      )}
                      {o.extras && (
                        <div style={{ fontSize: "0.74rem", color: "#E6C7D1" }}>
                          🎁 {o.extras}
                        </div>
                      )}
                      {o.observaciones && (
                        <div style={{ fontSize: "0.74rem", color: "#E8C97E" }}>
                          📝 {o.observaciones}
                        </div>
                      )}
                      {tablero.puedeInteractuar && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          {!enPrep && (
                            <button
                              type="button"
                              onClick={() => void avanzarEstadoDesdeTv(o, "EN_PREPARACION")}
                              style={{
                                flex: 1,
                                padding: "6px 8px",
                                borderRadius: "7px",
                                border: "none",
                                background: "#8C6D2E",
                                color: "#FFFFFF",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Iniciar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void avanzarEstadoDesdeTv(o, "LISTO_ENTREGA")}
                            style={{
                              flex: 1,
                              padding: "6px 8px",
                              borderRadius: "7px",
                              border: "none",
                              background: "#3D5A45",
                              color: "#FFFFFF",
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ✓ Marcar Listo
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Franja inferior Listos / Entregados */}
            <div
              style={{
                padding: "8px 12px",
                background: "#1C1714",
                borderTop: "1px solid var(--cb-d6c3a5-a180, rgba(214,195,165,0.18))",
                fontSize: "0.74rem",
                color: "#8AB597",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>✓ Listos: {tablero.ordenes.filter((o) => o.estadoTaller === "LISTO_ENTREGA").length}</span>
              <span style={{ color: "var(--ct-a89d8f, #A89D8F)" }}>✓✓ Entregados hoy: {totalEntregadosHoy}</span>
            </div>
          </div>,
          pipContainer
        )}
    </div>
  );
}

function hudBtnStyle(bg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 10px",
    borderRadius: "8px",
    border: "1px solid var(--cb-d6c3a5-a220, rgba(214, 195, 165, 0.22))",
    background: bg,
    color: "#F6F1E8",
    fontSize: "0.74rem",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function kpiCardTvStyle(borderColor: string): React.CSSProperties {
  return {
    padding: "16px 18px",
    borderRadius: "15px",
    background: "#1E1916",
    border: `1px solid ${borderColor}`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "8px",
  };
}

const kpiLabelTvStyle: React.CSSProperties = {
  fontSize: "0.74rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ct-a89d8f, #A89D8F)",
};

function kpiNumTvStyle(color: string): React.CSSProperties {
  return {
    fontSize: "2.25rem",
    fontWeight: 800,
    lineHeight: 1.05,
    color,
    fontVariantNumeric: "tabular-nums",
  };
}

const kpiSubTvStyle: React.CSSProperties = {
  fontSize: "0.76rem",
  color: "var(--ct-a89d8f, #A89D8F)",
  fontWeight: 500,
};

function pillShowroomStyle(activo: boolean): React.CSSProperties {
  return {
    padding: "6px 13px",
    borderRadius: "999px",
    border: activo ? "1.5px solid var(--cb-c8a25a, #C8A25A)" : "1px solid var(--cb-d6c3a5-a220, rgba(214,195,165,0.22))",
    background: activo ? "rgba(184, 146, 63, 0.24)" : "rgba(38, 32, 28, 0.85)",
    color: activo ? "#F6F1E8" : "#C9BEB0",
    fontSize: "0.8rem",
    fontWeight: 700,
    cursor: "pointer",
  };
}
