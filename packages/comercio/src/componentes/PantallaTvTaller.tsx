"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  ArrowLeftRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Gift,
  Layers,
  ListMusic,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Music,
  Pause,
  Play,
  QrCode,
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
  type FavoritoYoutubeTv,
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

  // Overrides locales rápidos en la TV (sin tener que abrir el celular)
  const [modoLocal, setModoLocal] = useState<ModoPantallaTv | null>(null);
  const [ladoLocal, setLadoLocal] = useState<PosicionLateralTv | null>(null);
  const [densidadLocal, setDensidadLocal] = useState<DensidadLayoutTv | null>(null);
  const [mostrarListosLocal, setMostrarListosLocal] = useState<boolean | null>(null);
  const [sonidoLocal, setSonidoLocal] = useState<boolean | null>(null);
  const [youtubeUrlLocal, setYoutubeUrlLocal] = useState<string | null>(null);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);

  // Buscador, Cola ("A continuación"), Sugerencias y Favoritos de YouTube en la TV
  const [abiertoBuscadorYt, setAbiertoBuscadorYt] = useState<boolean>(false);
  const [tabModalYt, setTabModalYt] = useState<"buscar" | "favoritos" | "cola">("buscar");
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
  const modoActivo: ModoPantallaTv = modoLocal ?? cfg.modoActivo;
  const posicionLateral: PosicionLateralTv = ladoLocal ?? cfg.posicionLateral;
  const densidadConfig: DensidadLayoutTv = densidadLocal ?? cfg.densidadLayout;
  const mostrarFranjaListos: boolean = mostrarListosLocal ?? cfg.mostrarFranjaListos;
  const sonidoAlertas: boolean = sonidoLocal ?? cfg.sonidoAlertas;
  const youtubeUrlActual =
    youtubeUrlLocal ??
    (modoActivo === "EVENTOS" ? cfg.youtubeUrlEventosAudio : cfg.youtubeUrlTaller);

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
      setYoutubeUrlLocal(limpia);
      setErrorReproductorYt(false);
      if (cerrarModal) setAbiertoBuscadorYt(false);
      // Persistir en configuración del negocio si el usuario tiene sesión autenticada
      if (tablero.modoAcceso === "AUTENTICADO") {
        void guardarConfigTvTallerAction({
          negocio: negNorm,
          config:
            modoActivo === "EVENTOS"
              ? { youtubeUrlEventosAudio: limpia }
              : { youtubeUrlTaller: limpia },
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
        const volOriginal = cfg.volumenYoutube || 75;
        try {
          player?.setVolume?.(16);
        } catch {
          // Ignorar
        }
        reproducirCampanaTv(urgente);
        if (duckTimerRef.current) clearTimeout(duckTimerRef.current);
        duckTimerRef.current = setTimeout(() => {
          try {
            player?.setVolume?.(volOriginal);
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
          void recargarTablero(true);
        }
      )
      .on("broadcast", { event: "nuevo_pedido_taller" }, () => {
        void recargarTablero(true);
      })
      .subscribe((status) => {
        setConectado(status === "SUBSCRIBED");
      });

    const intervalo = setInterval(() => {
      void recargarTablero(true);
    }, 45000);

    return () => {
      clearInterval(intervalo);
      void supabase.removeChannel(canal);
    };
  }, [negNorm, recargarTablero]);

  // YouTube IFrame API loader & controller
  useEffect(() => {
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
  }, [cfg.volumenYoutube, siguienteCancionYt, youtubeUrlActual]);

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

      // Modal de confirmación "Marcar Listo" con control remoto
      if (ordenConfirmandoListo) {
        if (e.key === "Escape") {
          e.preventDefault();
          setOrdenConfirmandoListo(null);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setBotonConfirmFoco((b) => (b === "SI" ? "NO" : "SI"));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (botonConfirmFoco === "SI") {
            void avanzarEstadoDesdeTv(ordenConfirmandoListo, "LISTO_ENTREGA");
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
      } else if (e.key === "Enter" && tablero.puedeInteractuar) {
        e.preventDefault();
        const seleccionada = pendientesPagina[indiceFoco];
        if (!seleccionada) return;
        if (seleccionada.estadoTaller === "ENVIADO_TALLER") {
          void avanzarEstadoDesdeTv(seleccionada, "EN_PREPARACION");
        } else if (seleccionada.estadoTaller === "EN_PREPARACION") {
          setBotonConfirmFoco("SI");
          setOrdenConfirmandoListo(seleccionada);
        }
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
          background: "#0B1120",
          color: "#F8FAFC",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          gap: "14px",
        }}
      >
        <Monitor size={48} color="#38BDF8" />
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Pantalla TV Taller — {nombreNegocio}</h1>
        <p style={{ margin: 0, color: "#FCA5A5", maxWidth: "520px", fontSize: "1rem" }}>
          {errorAcceso}
        </p>
        <a
          href="/panel/taller"
          style={{
            padding: "10px 18px",
            borderRadius: "10px",
            background: colorMarca,
            color: "#FFFFFF",
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
        background: "#070B14",
        color: "#F8FAFC",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
            border: "2px solid rgba(255,255,255,0.45)",
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

      {/* Barra Superior Compacta (Reloj + Estado + HUD ocultable) */}
      <div
        style={{
          height: "46px",
          padding: "0 16px",
          background: "rgba(15, 23, 42, 0.95)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
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
              padding: "3px 10px",
              borderRadius: "999px",
              background: modoActivo === "EVENTOS" ? "#BE185D" : colorMarca,
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            {nombreNegocio.toUpperCase()}
          </span>
          <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#E2E8F0" }}>
            {modoActivo === "EVENTOS" ? "✨ Showroom de Eventos" : "🌸 Taller en Vivo"}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.74rem",
              fontWeight: 700,
              color: conectado ? "#34D399" : "#F87171",
            }}
          >
            {conectado ? <Wifi size={14} /> : <WifiOff size={14} />}
            {conectado ? "EN VIVO" : "RECONECTANDO"}
          </span>
        </div>

        {/* Controles rápidos (siempre visibles al mover mouse o en modo eventos) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            opacity: hudVisible ? 1 : 0.25,
            transition: "opacity 0.3s ease",
          }}
        >
          {colaYt.length > 1 && (
            <>
              <button
                type="button"
                onClick={anteriorCancionYt}
                title="Canción anterior en la cola"
                style={hudBtnStyle("#1E293B")}
              >
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                onClick={() => siguienteCancionYt(false)}
                title="Siguiente canción en la cola"
                style={hudBtnStyle("#1E293B")}
              >
                <SkipForward size={14} />
              </button>
            </>
          )}

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
            style={hudBtnStyle(esActualFavorito ? "#B45309" : "#1E293B")}
          >
            <Star size={14} fill={esActualFavorito ? "#FDE047" : "none"} color={esActualFavorito ? "#FDE047" : "#F8FAFC"} />
          </button>

          <button
            type="button"
            onClick={() => {
              setTabModalYt("buscar");
              setAbiertoBuscadorYt(true);
              setErrorYtBusqueda(null);
            }}
            title="Buscar en YouTube, ver Mis Favoritos, Cola o pegar URL"
            style={hudBtnStyle("#DC2626")}
          >
            <Search size={14} />
            YouTube / Música
          </button>

          <button
            type="button"
            onClick={() => setModoLocal(modoActivo === "TALLER" ? "EVENTOS" : "TALLER")}
            title="Cambiar entre Modo Taller y Modo Showroom Eventos"
            style={hudBtnStyle(modoActivo === "EVENTOS" ? "#BE185D" : "#1E293B")}
          >
            {modoActivo === "TALLER" ? <Sparkles size={14} /> : <Monitor size={14} />}
            {modoActivo === "TALLER" ? "Eventos" : "Taller"}
          </button>

          {modoActivo === "TALLER" && (
            <>
              <button
                type="button"
                onClick={() =>
                  setLadoLocal(posicionLateral === "derecha" ? "izquierda" : "derecha")
                }
                title="Cambiar columna de pedidos Izquierda / Derecha"
                style={hudBtnStyle("#1E293B")}
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
                title="Cambiar espacio YouTube / Pedidos"
                style={hudBtnStyle("#1E293B")}
              >
                <Layers size={14} />
                {densidadConfig === "AUTO"
                  ? `Auto (${densidadEfectiva})`
                  : densidadConfig === "SOLO_AUDIO"
                    ? "Solo Audio"
                    : densidadConfig}
              </button>

              <button
                type="button"
                onClick={() => setMostrarListosLocal(!mostrarFranjaListos)}
                title="Mostrar u ocultar franja inferior de pedidos listos"
                style={hudBtnStyle("#1E293B")}
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
            style={hudBtnStyle("#1E293B")}
          >
            {sonidoAlertas ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            type="button"
            onClick={() => void recargarTablero(true)}
            title="Actualizar ahora"
            style={hudBtnStyle("#1E293B")}
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            onClick={() => void togglePantallaCompleta()}
            title="Pantalla completa"
            style={hudBtnStyle("#1E293B")}
          >
            {enPantallaCompleta ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <div
            style={{
              marginLeft: "8px",
              paddingLeft: "10px",
              borderLeft: "1px solid rgba(148,163,184,0.25)",
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "0.74rem", color: "#94A3B8", textTransform: "capitalize" }}>
              {formatearFechaEcuadorLarga(reloj)}
            </span>
            <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#F8FAFC" }}>
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
        {/* REPRODUCTOR YOUTUBE (Siempre montado para no cortar la música al cambiar densidad/modo) */}
        <div
          style={
            esSoloAudio
              ? {
                  height: "46px",
                  padding: "0 16px",
                  background: "#0F172A",
                  borderBottom: "1px solid rgba(148,163,184,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexShrink: 0,
                }
              : {
                  width: `${100 - anchoLateralPct}%`,
                  height: "100%",
                  background: "#000000",
                  position: "relative",
                  flexShrink: 0,
                }
          }
        >
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
                <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#FECACA" }}>
                  Este video no está disponible para reproducir aquí.
                </span>
                <button
                  type="button"
                  onClick={() => setAbiertoBuscadorYt(true)}
                  style={{
                    padding: "7px 13px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <Search size={14} /> Buscar otro video
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================
            VISTA A: MODO TALLER (COLA DE PEDIDOS PENDIENTES PRIORIZADOS)
           ============================================================ */}
        {modoActivo === "TALLER" && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              background: "#0B1220",
              borderLeft:
                !esSoloAudio && posicionLateral === "derecha"
                  ? "2px solid rgba(56, 189, 248, 0.25)"
                  : undefined,
              borderRight:
                !esSoloAudio && posicionLateral === "izquierda"
                  ? "2px solid rgba(56, 189, 248, 0.25)"
                  : undefined,
              display: "flex",
              flexDirection: "column",
              padding: "12px",
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
                <Flame size={20} color="#F59E0B" />
                <span style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "0.02em" }}>
                  PENDIENTES TALLER ({pendientes.length})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {totalPaginas > 1 && (
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      background: "rgba(56,189,248,0.18)",
                      color: "#7DD3FC",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                    }}
                  >
                    Pág. {paginaPendientes + 1} / {totalPaginas}
                  </span>
                )}
                {tablero.puedeInteractuar && (
                  <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>
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
                  color: "#64748B",
                  border: "1px dashed rgba(148,163,184,0.2)",
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
                        if (!tablero.puedeInteractuar) return;
                        if (orden.estadoTaller === "ENVIADO_TALLER") {
                          void avanzarEstadoDesdeTv(orden, "EN_PREPARACION");
                        } else if (orden.estadoTaller === "EN_PREPARACION") {
                          setBotonConfirmFoco("SI");
                          setOrdenConfirmandoListo(orden);
                        }
                      }}
                      style={{
                        padding: densidadEfectiva === "SOLO_AUDIO" ? "11px 12px" : "13px 14px",
                        borderRadius: "14px",
                        background: esExequiales
                          ? "linear-gradient(145deg, #2E1065, #1E1B4B)"
                          : enPrep
                            ? "linear-gradient(145deg, #0F2942, #111827)"
                            : "linear-gradient(145deg, #1E293B, #0F172A)",
                        border: enfocado
                          ? "3px solid #38BDF8"
                          : esExequiales
                            ? "2px solid #A855F7"
                            : enPrep
                              ? "2px solid #F59E0B"
                              : "1.5px solid rgba(148,163,184,0.28)",
                        boxShadow: enfocado
                          ? "0 0 22px rgba(56, 189, 248, 0.38)"
                          : "0 6px 16px rgba(0, 0, 0, 0.35)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "7px",
                        cursor: tablero.puedeInteractuar ? "pointer" : "default",
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
                                  border: "1px solid rgba(255,255,255,0.6)",
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
                          borderTop: "1px solid rgba(148,163,184,0.16)",
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
                borderBottom: "1px solid rgba(148,163,184,0.16)",
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
                    border: "1px solid rgba(255,255,255,0.16)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      color: "#F472B6",
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
                      background: "#FFFFFF",
                      color: "#0F172A",
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
                  color: "#94A3B8",
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

      {/* Franja Inferior: Pedidos Listos Entrega (Hoy) — solo en Modo Taller cuando está visible */}
      {modoActivo === "TALLER" && mostrarFranjaListos && (
        <div
          style={{
            height: densidadEfectiva === "SOLO_AUDIO" ? "64px" : "96px",
            padding: "8px 16px",
            background: "#0F172A",
            borderTop: "2px solid rgba(16, 185, 129, 0.35)",
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
              borderRight: "1px solid rgba(148,163,184,0.2)",
              paddingRight: "12px",
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                color: "#34D399",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <CheckCircle2 size={16} /> LISTOS HOY (
              {tablero.ordenes.filter((o) => o.estadoTaller === "LISTO_ENTREGA").length})
            </span>
            <span style={{ fontSize: "0.74rem", color: "#94A3B8", fontWeight: 600 }}>
              ✓✓ {totalEntregadosHoy} entregados hoy
            </span>
          </div>

          {listosVisibles.length === 0 ? (
            <span style={{ fontSize: "0.84rem", color: "#64748B" }}>
              Los arreglos marcados como Listos aparecerán aquí y se actualizarán al entregarse.
            </span>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {listosVisibles.map((o) => {
                const entregado = o.estadoTaller === "ENTREGADO";
                return (
                  <div
                    key={o.id}
                    style={{
                      minWidth: "215px",
                      maxWidth: "260px",
                      padding: "8px 12px",
                      borderRadius: "11px",
                      background: entregado
                        ? "rgba(30, 41, 59, 0.7)"
                        : "linear-gradient(135deg, rgba(6, 95, 70, 0.88), rgba(15, 118, 110, 0.88))",
                      border: entregado
                        ? "1px solid rgba(148, 163, 184, 0.25)"
                        : "1.5px solid #34D399",
                      opacity: entregado ? 0.72 : 1,
                      flexShrink: 0,
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
              border: "1.5px solid rgba(148, 163, 184, 0.3)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(148,163,184,0.2)",
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
                  <div style={{ fontSize: "0.76rem", color: "#94A3B8" }}>
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
                borderBottom: "1px solid rgba(148,163,184,0.2)",
                display: "flex",
                gap: "8px",
                background: "#0B1120",
              }}
            >
              {(
                [
                  { id: "buscar", label: "🔍 Buscar / URL" },
                  { id: "favoritos", label: `⭐ Mis Favoritos (${favoritosLocales.length})` },
                  { id: "cola", label: `📋 Cola / Sugerencias (${colaYt.length})` },
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
                    color: tabModalYt === t.id ? "#FFFFFF" : "#94A3B8",
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
              {tabModalYt === "favoritos" ? (
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
                    <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", border: "1px dashed #334155", borderRadius: "12px" }}>
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
                            <div style={{ fontSize: "0.74rem", color: "#94A3B8" }}>
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
                    <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8", border: "1px dashed #334155", borderRadius: "12px" }}>
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
                          <span style={{ fontWeight: 800, color: idx === indiceColaYt ? "#38BDF8" : "#94A3B8", minWidth: "24px" }}>
                            {idx === indiceColaYt ? "▶" : `#${idx + 1}`}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.84rem", color: "#F8FAFC" }}>{vid.titulo}</div>
                            <div style={{ fontSize: "0.73rem", color: "#94A3B8" }}>{vid.canal} {vid.duracion ? `· ${vid.duracion}` : ""}</div>
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
                      border: "1px solid rgba(148,163,184,0.28)",
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
                <div style={{ padding: "28px", textAlign: "center", color: "#94A3B8" }}>
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
                        border: "1px solid rgba(148,163,184,0.25)",
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
                      <div style={{ fontSize: "0.72rem", color: "#94A3B8" }}>{vid.canal}</div>
                      </button>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", paddingTop: "4px", borderTop: "1px solid rgba(148,163,184,0.16)" }}>
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

      {/* Modal de Confirmación rápida para Control Remoto TV ("¿Marcar LISTO?") */}
      {ordenConfirmandoListo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 130,
            background: "rgba(2, 6, 23, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              padding: "28px",
              borderRadius: "20px",
              background: "#0F172A",
              border: "2px solid #38BDF8",
              boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <CheckCircle2 size={46} color="#10B981" style={{ margin: "0 auto" }} />
            <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>
              ¿Marcar pedido como LISTO?
            </h2>
            <p style={{ margin: 0, fontSize: "1.05rem", color: "#CBD5E1" }}>
              <strong>{ordenConfirmandoListo.codigo}</strong> —{" "}
              {ordenConfirmandoListo.productoResumen}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => void avanzarEstadoDesdeTv(ordenConfirmandoListo, "LISTO_ENTREGA")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "12px",
                  border: botonConfirmFoco === "SI" ? "3px solid #FFFFFF" : "1px solid #10B981",
                  background: "#059669",
                  color: "#FFFFFF",
                  fontSize: "1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Check size={18} /> SÍ, LISTO PARA ENTREGA
              </button>
              <button
                type="button"
                onClick={() => setOrdenConfirmandoListo(null)}
                style={{
                  padding: "12px 20px",
                  borderRadius: "12px",
                  border: botonConfirmFoco === "NO" ? "3px solid #FFFFFF" : "1px solid #475569",
                  background: "#1E293B",
                  color: "#E2E8F0",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
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
    borderRadius: "7px",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    background: bg,
    color: "#F8FAFC",
    fontSize: "0.74rem",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function pillShowroomStyle(activo: boolean): React.CSSProperties {
  return {
    padding: "6px 13px",
    borderRadius: "999px",
    border: activo ? "1.5px solid #F472B6" : "1px solid rgba(148,163,184,0.28)",
    background: activo ? "rgba(190, 24, 93, 0.35)" : "rgba(30, 41, 59, 0.8)",
    color: activo ? "#FCE7F3" : "#CBD5E1",
    fontSize: "0.8rem",
    fontWeight: 700,
    cursor: "pointer",
  };
}
