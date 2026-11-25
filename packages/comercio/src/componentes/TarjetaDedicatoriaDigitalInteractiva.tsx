"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { DisenoVisualTarjeta } from "../operaciones-taller";
import {
  ajustarTextoParaDoblezDiptico,
  asegurarFuentesGoogleTarjetaCargadas,
  esFirmaVisibleValida,
  normalizarDisenoTarjeta,
  resolverFontFamilyCss,
  type DisenoVisualNormalizado,
} from "./LienzoDisenadorTarjeta";

export interface PropsTarjetaDedicatoriaDigitalInteractiva {
  datosIniciales: {
    ordenId: string;
    codigo: string;
    negocio: string;
    destinatario: string;
    remitente: string;
    dedicatoria: string;
    tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
    confidencial?: boolean;
    diseno?: DisenoVisualTarjeta;
    musicaUrl?: string | null;
    musicaTitulo?: string | null;
    lyrics?: Array<{ tiempo?: number; texto: string }>;
    fechaEntrega?: string;
    estadoTaller?: string;
    bloqueadoEdicion?: boolean;
    vistas?: number;
  };
  token: string;
  /** Cuando es true, se renderiza embebida dentro del editor/wizard sin forzar minHeight 100vh */
  modoEmbebido?: boolean;
  /** Contenido de acción opcional debajo de la tarjeta (ej. botón "Editar tarjeta" en /tarjeta-editar) */
  accionesInferiores?: React.ReactNode;
}

// Textura sutil de fibra de cartulina reciclada/kraft similar a la tarjeta física real de Tinkay
const TEXTURA_PAPEL_KRAFT_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.095'/%3E%3C/svg%3E")`;

function extraerYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  return match && match[1] ? match[1] : null;
}

function esDestinatarioVisibleValido(valor?: string | null): boolean {
  const limpio = (valor || "").trim();
  if (!limpio) return false;
  const low = limpio.toLowerCase();
  return low !== "pendiente" && low !== "para ti" && low !== "cliente" && low !== "destinatario";
}

function ContenidoInteriorTarjeta({
  esCondolencias,
  disenoNorm,
  dedicatoria,
  remitente,
  escalaFuente,
}: {
  esCondolencias: boolean;
  disenoNorm: DisenoVisualNormalizado;
  dedicatoria: string;
  remitente: string;
  escalaFuente: number;
}) {
  const wMm = esCondolencias ? 168 : 113;
  const firmaVisible = disenoNorm.mostrarFirma && esFirmaVisibleValida(remitente);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: esCondolencias ? "#F7F6F2" : "#E8E3D9",
        backgroundImage: esCondolencias
          ? `${TEXTURA_PAPEL_KRAFT_SVG}, linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(228,226,220,0.22) 100%)`
          : `${TEXTURA_PAPEL_KRAFT_SVG}, radial-gradient(ellipse at center, rgba(255,255,255,0.34), rgba(180,170,154,0.14) 100%)`,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Diseño sobrio y solemne exclusivo para Condolencias: doble filete fino y detalle lineal monocromático */}
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
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "6.4%",
              border: "1px solid rgba(63, 63, 70, 0.09)",
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
              top: "7.5%",
              left: "5.5%",
              width: "44px",
              height: "44px",
              opacity: 0.26,
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <path
              d="M8 54 C14 34, 28 18, 54 10"
              stroke="#3F3F46"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M22 33 C17 24, 21 15, 29 18 C27 25, 24 29, 22 33 Z"
              stroke="#3F3F46"
              strokeWidth="1.1"
            />
            <path
              d="M34 22 C35 13, 44 10, 48 16 C42 20, 38 22, 34 22 Z"
              stroke="#3F3F46"
              strokeWidth="1.1"
            />
            <path
              d="M15 44 C22 41, 29 44, 28 51 C21 50, 17 47, 15 44 Z"
              stroke="#3F3F46"
              strokeWidth="1.1"
            />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            fill="none"
            style={{
              position: "absolute",
              bottom: "7.5%",
              right: "5.5%",
              width: "44px",
              height: "44px",
              opacity: 0.26,
              transform: "rotate(180deg)",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <path
              d="M8 54 C14 34, 28 18, 54 10"
              stroke="#3F3F46"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M22 33 C17 24, 21 15, 29 18 C27 25, 24 29, 22 33 Z"
              stroke="#3F3F46"
              strokeWidth="1.1"
            />
            <path
              d="M34 22 C35 13, 44 10, 48 16 C42 20, 38 22, 34 22 Z"
              stroke="#3F3F46"
              strokeWidth="1.1"
            />
            <path
              d="M15 44 C22 41, 29 44, 28 51 C21 50, 17 47, 15 44 Z"
              stroke="#3F3F46"
              strokeWidth="1.1"
            />
          </svg>
        </>
      )}

      {/* IMÁGENES DISEÑADAS (HASTA 3, CON SOPORTE FONDO 100%, ROTACIÓN Y TRANSPARENCIA) */}
      {disenoNorm.imagenes.map((im) =>
        im.cubrirTarjeta ? (
          <img
            key={im.id}
            src={im.url}
            alt="Fondo de la tarjeta"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: im.opacidad ?? 1,
              transform: im.rotacionDeg ? `rotate(${im.rotacionDeg}deg)` : undefined,
              filter: im.escalaGrises ? "grayscale(100%)" : "none",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        ) : (
          <img
            key={im.id}
            src={im.url}
            alt="Imagen de la tarjeta"
            style={{
              position: "absolute",
              left: `${im.xPct}%`,
              top: `${im.yPct}%`,
              transform: `translate(-50%, -50%) rotate(${im.rotacionDeg || 0}deg)`,
              width: `${Math.max(8, Math.min(100, (im.anchoMm / wMm) * 100))}%`,
              height: "auto",
              objectFit: "contain",
              opacity: im.opacidad ?? 1,
              filter: im.escalaGrises ? "grayscale(100%)" : "none",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )
      )}

      {/* BLOQUES DE TEXTO DISEÑADOS (MENSAJE + FIRMA + EXTRAS EN SUS COORDENADAS EXACTAS) */}
      {disenoNorm.bloquesTexto.map((blk) => {
        if (blk.rol === "firma" && !firmaVisible) return null;
        const contenidoBase =
          blk.rol === "mensaje"
            ? dedicatoria ||
              (esCondolencias
                ? "Expresamos nuestras más sentidas condolencias."
                : "Con todo mi cariño.")
            : blk.rol === "firma"
              ? remitente.trim()
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
              fontSize: `${Math.max(10, (blk.tamanoPt || 18) * escalaFuente)}px`,
              fontWeight: blk.negrita ? 700 : 400,
              fontStyle: blk.italica ? "italic" : "normal",
              textAlign: blk.alineacion || "center",
              lineHeight: 1.36,
              color: blk.colorHex || "#18181B",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              zIndex: 6,
            }}
          >
            {contenido}
          </div>
        );
      })}
    </div>
  );
}

export function TarjetaDedicatoriaDigitalInteractiva({
  datosIniciales,
  modoEmbebido = false,
  accionesInferiores,
}: PropsTarjetaDedicatoriaDigitalInteractiva) {
  useEffect(() => {
    asegurarFuentesGoogleTarjetaCargadas();
  }, []);

  const esCondolencias = datosIniciales.tipo === "CONDOLENCIAS_PLANA";
  const disenoNorm = useMemo(
    () =>
      normalizarDisenoTarjeta(
        datosIniciales.diseno,
        esCondolencias,
        datosIniciales.dedicatoria || ""
      ),
    [datosIniciales.diseno, esCondolencias, datosIniciales.dedicatoria]
  );
  const musicaActivaUrl = esCondolencias ? null : datosIniciales.musicaUrl || null;
  const youtubeId = useMemo(() => extraerYouTubeId(musicaActivaUrl), [musicaActivaUrl]);
  const esAudioDirecto = Boolean(musicaActivaUrl && !youtubeId);
  const tieneCancion = Boolean(!esCondolencias && (youtubeId || esAudioDirecto));

  // En Dedicatoria (díptico real), inicia doblada con un giro ceremonial de entrada (-360° -> 0°)
  // antes de pedir clic para abrir; en Condolencias (tarjeta plana sin doblez), se muestra abierta directamente.
  const [abierta, setAbierta] = useState<boolean>(esCondolencias);
  const [anguloY, setAnguloY] = useState<number>(esCondolencias ? 0 : -360);
  const [entradaGirando, setEntradaGirando] = useState<boolean>(!esCondolencias);
  const [entradaCompleta, setEntradaCompleta] = useState<boolean>(esCondolencias);
  const [arrastrando360, setArrastrando360] = useState<boolean>(false);
  const [reproduciendo, setReproduciendo] = useState<boolean>(false);
  const [silenciado, setSilenciado] = useState<boolean>(false);
  const [tiempoActual, setTiempoActual] = useState<number>(0);

  const rawYtId = useId();
  const ytContainerId = `yt-tarjeta-${rawYtId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const contenedorLyricsRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerListoRef = useRef<boolean>(false);
  const pendienteReproducirRef = useRef<boolean>(false);
  const audioHtmlRef = useRef<HTMLAudioElement | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartAngleRef = useRef<number>(0);
  const arrastroRecienteRef = useRef<boolean>(false);

  const negNorm = datosIniciales.negocio.trim().toLowerCase();
  const esMargaritas = negNorm.includes("margarita");
  const nombreMarca = esMargaritas ? "Margaritas Floristería" : "Tinkay Flores y Eventos";
  const anguloNorm = ((anguloY % 360) + 360) % 360;
  const mostrandoReverso = !abierta && anguloNorm > 90 && anguloNorm < 270;

  // Efecto de entrada girando automáticamente al abrir el enlace antes de pedir clic para abrir
  useEffect(() => {
    if (esCondolencias) return;
    const tInicio = setTimeout(() => {
      setAnguloY(0);
    }, 120);
    const tFin = setTimeout(() => {
      setEntradaGirando(false);
      setEntradaCompleta(true);
    }, 3150);
    return () => {
      clearTimeout(tInicio);
      clearTimeout(tFin);
    };
  }, [esCondolencias]);

  useEffect(() => {
    if (!youtubeId || esCondolencias || typeof window === "undefined") return;
    playerListoRef.current = false;

    const inicializarPlayer = () => {
      if (!(window as any).YT || !(window as any).YT.Player) return;
      const el = document.getElementById(ytContainerId);
      if (!el) return;
      try {
        playerRef.current = new (window as any).YT.Player(ytContainerId, {
          videoId: youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            loop: 1,
            playlist: youtubeId,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              playerListoRef.current = true;
              event.target.setVolume(15);
              if (pendienteReproducirRef.current) {
                try {
                  event.target.unMute();
                  event.target.setVolume(15);
                  event.target.playVideo();
                  setReproduciendo(true);
                } catch {}
              }
            },
            onStateChange: (event: any) => {
              if (event.data === (window as any).YT.PlayerState.PLAYING) {
                setReproduciendo(true);
                try {
                  event.target.setVolume(15);
                } catch {}
              } else if (
                event.data === (window as any).YT.PlayerState.PAUSED ||
                event.data === (window as any).YT.PlayerState.ENDED
              ) {
                setReproduciendo(false);
              }
            },
          },
        });
      } catch {}
    };

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = inicializarPlayer;
    } else {
      inicializarPlayer();
    }

    return () => {
      playerListoRef.current = false;
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [youtubeId, esCondolencias, ytContainerId]);

  useEffect(() => {
    if (!reproduciendo) return;
    const interval = setInterval(() => {
      if (esAudioDirecto && audioHtmlRef.current) {
        setTiempoActual(audioHtmlRef.current.currentTime);
      } else if (playerRef.current?.getCurrentTime) {
        try {
          setTiempoActual(playerRef.current.getCurrentTime());
        } catch {}
      } else {
        setTiempoActual((prev) => prev + 0.45);
      }
    }, 450);
    return () => clearInterval(interval);
  }, [reproduciendo, esAudioDirecto]);

  const lyricsList = useMemo(
    () => (!esCondolencias && Array.isArray(datosIniciales.lyrics) ? datosIniciales.lyrics : []),
    [esCondolencias, datosIniciales.lyrics]
  );

  const lineaActivaIndex = useMemo(() => {
    if (lyricsList.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyricsList.length; i++) {
      const it = lyricsList[i];
      if (it && typeof it.tiempo === "number" && tiempoActual >= it.tiempo) {
        idx = i;
      }
    }
    return idx;
  }, [lyricsList, tiempoActual]);

  useEffect(() => {
    if (lineaActivaIndex >= 0 && contenedorLyricsRef.current) {
      const elemento = contenedorLyricsRef.current.children[lineaActivaIndex] as HTMLElement;
      if (elemento) {
        elemento.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [lineaActivaIndex]);

  const handleAbrirTarjeta = () => {
    if (abierta) return;
    setEntradaGirando(false);
    setEntradaCompleta(true);
    setAnguloY((prev) => Math.round(prev / 360) * 360);
    setAbierta(true);
    if (!tieneCancion) return;
    pendienteReproducirRef.current = true;

    if (esAudioDirecto && audioHtmlRef.current) {
      audioHtmlRef.current.muted = false;
      audioHtmlRef.current.volume = 0.15;
      audioHtmlRef.current
        .play()
        .then(() => {
          setSilenciado(false);
          setReproduciendo(true);
        })
        .catch(() => {});
      return;
    }
    if (playerRef.current?.playVideo && playerListoRef.current) {
      try {
        playerRef.current.unMute();
        playerRef.current.setVolume(15);
        playerRef.current.playVideo();
        setSilenciado(false);
        setReproduciendo(true);
      } catch {}
    }
  };

  const handleDoblarTarjeta = () => {
    setEntradaGirando(false);
    setEntradaCompleta(true);
    setAnguloY((prev) => Math.round(prev / 360) * 360);
    setAbierta(false);
  };

  const handlePointerDownTarjeta = (e: React.PointerEvent<HTMLDivElement>) => {
    if (abierta || esCondolencias) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setEntradaGirando(false);
    setEntradaCompleta(true);
    dragStartXRef.current = e.clientX;
    dragStartAngleRef.current = anguloY;
    arrastroRecienteRef.current = false;
  };

  const handlePointerMoveTarjeta = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null || abierta) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 8) {
      arrastroRecienteRef.current = true;
      setArrastrando360(true);
      setAnguloY(dragStartAngleRef.current + dx * 0.72);
    }
  };

  const handlePointerEndTarjeta = () => {
    if (dragStartXRef.current === null) return;
    dragStartXRef.current = null;
    if (arrastroRecienteRef.current) {
      setArrastrando360(false);
      // Ajustar suavemente hacia la cara más cercana (portada 0° o reverso 180°)
      setAnguloY((prev) => Math.round(prev / 180) * 180);
      setTimeout(() => {
        arrastroRecienteRef.current = false;
      }, 120);
    }
  };

  const handleToggleReproduccion = () => {
    if (esAudioDirecto && audioHtmlRef.current) {
      if (reproduciendo) {
        pendienteReproducirRef.current = false;
        audioHtmlRef.current.pause();
        setReproduciendo(false);
      } else {
        pendienteReproducirRef.current = true;
        audioHtmlRef.current.volume = 0.15;
        void audioHtmlRef.current.play();
        setReproduciendo(true);
      }
      return;
    }
    if (!playerRef.current) return;
    if (reproduciendo) {
      pendienteReproducirRef.current = false;
      playerRef.current.pauseVideo();
      setReproduciendo(false);
    } else {
      pendienteReproducirRef.current = true;
      playerRef.current.setVolume(15);
      playerRef.current.playVideo();
      setReproduciendo(true);
    }
  };

  const handleToggleSilencio = () => {
    if (esAudioDirecto && audioHtmlRef.current) {
      audioHtmlRef.current.muted = !silenciado;
      if (silenciado) audioHtmlRef.current.volume = 0.15;
      setSilenciado(!silenciado);
      return;
    }
    if (!playerRef.current) return;
    if (silenciado) {
      playerRef.current.unMute();
      playerRef.current.setVolume(15);
      setSilenciado(false);
    } else {
      playerRef.current.mute();
      setSilenciado(true);
    }
  };

  const mostrarDestinatario = esDestinatarioVisibleValido(datosIniciales.destinatario);

  return (
    <div
      style={{
        minHeight: modoEmbebido ? "auto" : "100vh",
        width: "100%",
        backgroundColor: modoEmbebido
          ? "transparent"
          : esCondolencias
            ? "#141416"
            : "#0F172A",
        backgroundImage: modoEmbebido
          ? "none"
          : esCondolencias
            ? "radial-gradient(ellipse at top, #1F1F23, #141416 76%)"
            : "radial-gradient(ellipse at top, #1E293B, #0F172A 78%)",
        color: "#FFFFFF",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: modoEmbebido ? "12px 8px" : "24px 16px",
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes ecoPulsoSuaveTarjeta {
              0%, 100% { opacity: 0.78; transform: translateY(0px); }
              50% { opacity: 1; transform: translateY(-2px); }
            }
            .eco-lyrics-sobrio::-webkit-scrollbar {
              display: none;
            }
          `,
        }}
      />

      {tieneCancion && youtubeId && (
        <div
          id={ytContainerId}
          style={{
            position: "fixed",
            bottom: "-9999px",
            left: "-9999px",
            width: "1px",
            height: "1px",
            opacity: 0.01,
            pointerEvents: "none",
          }}
        />
      )}

      {tieneCancion && esAudioDirecto && musicaActivaUrl && (
        <audio
          ref={audioHtmlRef}
          src={musicaActivaUrl}
          loop
          preload="auto"
          onPlay={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          style={{ display: "none" }}
        />
      )}

      {esCondolencias ? (
        /* TARJETA PLANA DE CONDOLENCIAS (HORIZONTAL 16,8 × 11,3 cm, SIN DOBLEZ) */
        <div
          style={{
            maxWidth: "560px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "168 / 113",
              borderRadius: "6px",
              boxShadow: "0 24px 52px -14px rgba(0, 0, 0, 0.78)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <ContenidoInteriorTarjeta
              esCondolencias={true}
              disenoNorm={disenoNorm}
              dedicatoria={datosIniciales.dedicatoria}
              remitente={datosIniciales.remitente}
              escalaFuente={1.18}
            />
          </div>
          <span
            style={{
              fontSize: "0.68rem",
              color: "rgba(228, 228, 231, 0.42)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {nombreMarca}
          </span>
          {accionesInferiores && (
            <div style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "4px" }}>
              {accionesInferiores}
            </div>
          )}
        </div>
      ) : (
        /* DÍPTICO REAL INTERACTIVO 3D (VERTICAL 11,3 × 16,8 cm QUE SE DOBLA POR LA MITAD 8,4 cm) */
        <div
          style={{
            width: "100%",
            maxWidth: "390px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* Escenario con perspectiva 3D real */}
          <div
            style={{
              width: "100%",
              maxWidth: "366px",
              perspective: "1600px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {/* Contenedor de tarjeta completa 113 × 168 mm:
                Cerrada se desplaza -23% hacia arriba y soporta giro interactivo 360° (rotateY)
                para admirar portada y parte posterior; al abrirse se alinea al frente y despliega ambas caras */}
            <div
              onClick={() => {
                if (!abierta && !mostrandoReverso && !arrastroRecienteRef.current) {
                  handleAbrirTarjeta();
                }
              }}
              onPointerDown={handlePointerDownTarjeta}
              onPointerMove={handlePointerMoveTarjeta}
              onPointerUp={handlePointerEndTarjeta}
              onPointerCancel={handlePointerEndTarjeta}
              onPointerLeave={handlePointerEndTarjeta}
              role={!abierta && !mostrandoReverso ? "button" : undefined}
              tabIndex={!abierta && !mostrandoReverso ? 0 : undefined}
              aria-label={!abierta && !mostrandoReverso ? "Toca para abrir tu tarjeta" : undefined}
              onKeyDown={(e) => {
                if (!abierta && !mostrandoReverso && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleAbrirTarjeta();
                }
              }}
              style={{
                width: "100%",
                aspectRatio: "113 / 168",
                position: "relative",
                transformStyle: "preserve-3d",
                transform: abierta
                  ? "translateY(0%) rotateY(0deg)"
                  : `translateY(-23%) rotateY(${anguloY}deg)`,
                transition: arrastrando360
                  ? "none"
                  : entradaGirando
                    ? "transform 3.1s cubic-bezier(0.22, 0.85, 0.3, 1)"
                    : "transform 1.75s cubic-bezier(0.25, 0.9, 0.3, 1)",
                cursor: abierta ? "default" : arrastrando360 ? "grabbing" : "pointer",
                touchAction: abierta ? "auto" : "pan-y",
                userSelect: "none",
              }}
            >
              {/* 1. MITAD INFERIOR FIJA (SIN overflow:hidden PARA PRESERVAR 3D DE CARA INTERNA 1A Y REVERSO 1B) */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: "50%",
                  transformStyle: "preserve-3d",
                  zIndex: mostrandoReverso ? 4 : 1,
                }}
              >
                {/* 1A. CARA INTERNA INFERIOR (MITAD INFERIOR 50%..100% DEL DISEÑO) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    borderBottomLeftRadius: "8px",
                    borderBottomRightRadius: "8px",
                    borderTopLeftRadius: abierta ? "0px" : "6px",
                    borderTopRightRadius: abierta ? "0px" : "6px",
                    boxShadow: abierta
                      ? "0 28px 55px -12px rgba(0, 0, 0, 0.65)"
                      : "0 2px 0 #BDB6A8, 0 4px 0 #A8A092, 0 26px 52px -10px rgba(0, 0, 0, 0.72)",
                    transition: "box-shadow 1.45s ease",
                  }}
                >
                  {/* Proyección de la mitad inferior del lienzo completo (200% alto desplazado -100%) */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: "-100%",
                      height: "200%",
                    }}
                  >
                    <ContenidoInteriorTarjeta
                      esCondolencias={false}
                      disenoNorm={disenoNorm}
                      dedicatoria={datosIniciales.dedicatoria}
                      remitente={datosIniciales.remitente}
                      escalaFuente={1.08}
                    />
                  </div>

                  {/* Sombra realista del doblez central horizontal (8,4 cm) */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "22px",
                      background:
                        "linear-gradient(to bottom, rgba(41, 37, 36, 0.14), rgba(41, 37, 36, 0.03) 45%, transparent)",
                      opacity: abierta ? 0.55 : 1,
                      transition: "opacity 1.5s ease",
                      pointerEvents: "none",
                      zIndex: 8,
                    }}
                  />
                </div>

                {/* 1B. PARTE POSTERIOR / REVERSO REAL DE LA TARJETA (CLIC REDIRECCIONA A NUESTRA PÁGINA) */}
                <a
                  href="/"
                  target={modoEmbebido ? "_blank" : undefined}
                  rel={modoEmbebido ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (arrastroRecienteRef.current) {
                      e.preventDefault();
                    }
                  }}
                  title={`Visitar ${nombreMarca}`}
                  aria-label={`Visitar página web de ${nombreMarca}`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: "rotateY(180deg) translateZ(2px)",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    pointerEvents: mostrandoReverso ? "auto" : "none",
                    backgroundColor: "#DFD9CE",
                    backgroundImage: `${TEXTURA_PAPEL_KRAFT_SVG}, linear-gradient(155deg, rgba(255,255,255,0.28) 0%, rgba(168,158,142,0.18) 100%)`,
                    borderRadius: "8px",
                    border: "1px solid rgba(168, 160, 146, 0.68)",
                    boxShadow: "0 24px 50px -12px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255,255,255,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    padding: "20px 24px",
                    boxSizing: "border-box",
                    textDecoration: "none",
                    color: "#292524",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  {/* Parte posterior minimalista: únicamente nuestro logo y www.tinkay.net debajo */}
                  {!esMargaritas ? (
                    <div
                      style={{
                        width: "66%",
                        maxWidth: "208px",
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
                          width: "100%",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          height: "auto",
                          objectFit: "contain",
                          mixBlendMode: "multiply",
                          filter: "contrast(1.36) brightness(1.04)",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#292524" }}>
                      <div
                        style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: "1.75rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                      >
                        Margaritas
                      </div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          letterSpacing: "0.26em",
                          textTransform: "uppercase",
                          color: "#57534E",
                          marginTop: "3px",
                        }}
                      >
                        FLORISTERÍA
                      </div>
                    </div>
                  )}

                  <span
                    style={{
                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontSize: "0.82rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      color: "#44403C",
                    }}
                  >
                    {esMargaritas ? "www.margaritasfloristeria.com" : "www.tinkay.net"}
                  </span>
                </a>
              </div>

              {/* 2. SOLAPA SUPERIOR ARTICULADA EN 3D (BISAGRA EN EL DOBLEZ CENTRAL 8,4 cm)
                     - Cerrada: rotateX(-180deg) -> cae hacia abajo cubriendo la mitad inferior y muestra la PORTADA REAL DE TINKAY
                     - Abierta: rotateX(0deg)    -> se eleva 180° y muestra la mitad superior interna unida sin cortes */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: "50%",
                  transformOrigin: "50% 100%",
                  transformStyle: "preserve-3d",
                  transform: abierta ? "rotateX(0deg)" : "rotateX(-180deg)",
                  transition: "transform 1.8s cubic-bezier(0.25, 0.9, 0.3, 1)",
                  pointerEvents: mostrandoReverso ? "none" : "auto",
                  zIndex: mostrandoReverso ? 1 : 3,
                }}
              >
                {/* 2A. CARA INTERNA SUPERIOR (VISIBLE AL ABRIR EL DÍPTICO) */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    overflow: "hidden",
                    opacity: mostrandoReverso && !abierta ? 0 : 1,
                    borderTopLeftRadius: "8px",
                    borderTopRightRadius: "8px",
                    boxShadow: abierta
                      ? "0 -4px 25px rgba(0, 0, 0, 0.25)"
                      : "none",
                  }}
                >
                  {/* Proyección de la mitad superior del lienzo completo (200% alto desde top: 0) */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      height: "200%",
                    }}
                  >
                    <ContenidoInteriorTarjeta
                      esCondolencias={false}
                      disenoNorm={disenoNorm}
                      dedicatoria={datosIniciales.dedicatoria}
                      remitente={datosIniciales.remitente}
                      escalaFuente={1.08}
                    />
                  </div>

                  {/* Sombra sutil del pliegue en el borde inferior de la mitad superior */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "14px",
                      background:
                        "linear-gradient(to top, rgba(41, 37, 36, 0.1), transparent)",
                      pointerEvents: "none",
                      zIndex: 8,
                    }}
                  />
                </div>

                {/* 2B. PORTADA EXTERIOR REAL (VISIBLE CUANDO EL DÍPTICO ESTÁ CERRADO)
                        rotateX(180deg) translateZ(2px) compensa el -180deg de la solapa y la sitúa delante de 1A */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: "rotateX(180deg) translateZ(2px)",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    backgroundColor: "#DFD9CE",
                    backgroundImage: `${TEXTURA_PAPEL_KRAFT_SVG}, linear-gradient(155deg, rgba(255,255,255,0.28) 0%, rgba(168,158,142,0.16) 100%)`,
                    borderRadius: "8px",
                    border: "1px solid rgba(168, 160, 146, 0.65)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "20px 24px 16px 24px",
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  {/* Línea de doblez superior (borde real donde se dobla la cartulina física) */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "10px",
                      background:
                        "linear-gradient(to bottom, rgba(87, 83, 78, 0.16), transparent)",
                      pointerEvents: "none",
                    }}
                  />

                  {/* LOGO REAL DE TINKAY IMPRESO SOBRE CARTULINA KRAFT (mix-blend-mode: multiply) */}
                  {!esMargaritas ? (
                    <div
                      style={{
                        width: "76%",
                        maxWidth: "240px",
                        aspectRatio: "16 / 8.8",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <img
                        src="/img/logo/tinkay-logo.jpg"
                        alt="Tinkay Flores y Eventos"
                        draggable={false}
                        style={{
                          width: "100%",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          height: "auto",
                          objectFit: "contain",
                          mixBlendMode: "multiply",
                          filter: "contrast(1.38) brightness(1.05)",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#292524" }}>
                      <div
                        style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: "2rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          lineHeight: 1.1,
                        }}
                      >
                        Margaritas
                      </div>
                      <div
                        style={{
                          fontSize: "0.66rem",
                          letterSpacing: "0.28em",
                          textTransform: "uppercase",
                          marginTop: "6px",
                          color: "#57534E",
                          fontWeight: 600,
                        }}
                      >
                        FLORISTERÍA
                      </div>
                    </div>
                  )}

                  {mostrarDestinatario && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "0.94rem",
                        fontStyle: "italic",
                        color: "#44403C",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Para:{" "}
                      <strong style={{ fontStyle: "normal", color: "#1C1917" }}>
                        {datosIniciales.destinatario}
                      </strong>
                    </div>
                  )}

                  {disenoNorm.remitentePortada.trim() && (
                    <div
                      style={{
                        marginTop: "2px",
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "0.8rem",
                        fontStyle: "italic",
                        color: "#57534E",
                        letterSpacing: "0.02em",
                      }}
                    >
                      De: {disenoNorm.remitentePortada.trim()}
                    </div>
                  )}

                  {/* Invitación sutil en la parte inferior de la portada real (aparece tras el giro de entrada) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "13px",
                      padding: "5px 14px",
                      borderRadius: "999px",
                      backgroundColor: "rgba(28, 25, 23, 0.08)",
                      border: "1px solid rgba(68, 64, 60, 0.16)",
                      color: "#292524",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      opacity: entradaCompleta ? 1 : 0,
                      transform: entradaCompleta ? "translateY(0px)" : "translateY(6px)",
                      transition: "opacity 0.7s ease, transform 0.7s ease",
                      animation: entradaCompleta
                        ? "ecoPulsoSuaveTarjeta 2.4s ease-in-out infinite"
                        : "none",
                    }}
                  >
                    <Sparkles size={12} />
                    <span>Toca para abrir tu tarjeta</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CONTROLES POST-APERTURA: AUDIO SUTIL + LYRICS + DOBLAR TARJETA */}
          <div
            style={{
              width: "100%",
              maxWidth: "366px",
              maxHeight: abierta ? "340px" : "0px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              opacity: abierta ? 1 : 0,
              transform: abierta ? "translateY(0px)" : "translateY(10px)",
              pointerEvents: abierta ? "auto" : "none",
              transition:
                "max-height 1.35s cubic-bezier(0.25, 0.9, 0.3, 1), opacity 0.9s ease 0.65s, transform 0.9s ease 0.65s",
            }}
          >
            {/* CONTROL SUTIL DE AUDIO SOLO EN DEDICATORIA CON CANCIÓN */}
            {tieneCancion && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "rgba(245, 239, 230, 0.07)",
                  border: "1px solid rgba(245, 239, 230, 0.14)",
                  backdropFilter: "blur(8px)",
                  padding: "5px 13px 5px 6px",
                  borderRadius: "999px",
                }}
              >
                <button
                  type="button"
                  onClick={handleToggleReproduccion}
                  title={reproduciendo ? "Pausar melodía" : "Reproducir melodía"}
                  aria-label={reproduciendo ? "Pausar" : "Reproducir"}
                  style={{
                    border: "none",
                    background: "rgba(245, 239, 230, 0.9)",
                    color: "#0F172A",
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {reproduciendo ? <Pause size={12} /> : <Play size={12} />}
                </button>

                <span
                  style={{
                    fontSize: "0.73rem",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    color: "rgba(245, 239, 230, 0.84)",
                    maxWidth: "200px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {datosIniciales.musicaTitulo || "Melodía de fondo"}
                </span>

                <button
                  type="button"
                  onClick={handleToggleSilencio}
                  title={silenciado ? "Activar sonido (15%)" : "Silenciar"}
                  aria-label={silenciado ? "Activar sonido" : "Silenciar"}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "rgba(245, 239, 230, 0.65)",
                    cursor: "pointer",
                    padding: "2px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {silenciado ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
            )}

            {/* PARTE INFERIOR: LYRIC EDITORIAL SOBRIO Y ELEGANTE (SIN CAJA PESADA NI SCROLLBAR) */}
            {tieneCancion && lyricsList.length > 0 && (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 6px 2px 6px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: "64px",
                    height: "1px",
                    background:
                      "linear-gradient(to right, transparent, rgba(226, 217, 202, 0.4), transparent)",
                  }}
                />
                <div
                  ref={contenedorLyricsRef}
                  className="eco-lyrics-sobrio"
                  style={{
                    width: "100%",
                    maxHeight: "126px",
                    overflowY: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "9px",
                    padding: "24px 8px",
                    boxSizing: "border-box",
                    scrollBehavior: "smooth",
                    maskImage:
                      "linear-gradient(to bottom, transparent 0%, #000000 24%, #000000 76%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, transparent 0%, #000000 24%, #000000 76%, transparent 100%)",
                  }}
                >
                  {lyricsList.map((linea, idx) => {
                    const indiceEfectivo =
                      lineaActivaIndex >= 0 ? lineaActivaIndex : reproduciendo ? 0 : -1;
                    const esActiva = idx === indiceEfectivo;
                    const distancia =
                      indiceEfectivo >= 0 ? Math.abs(idx - indiceEfectivo) : 2;
                    return (
                      <p
                        key={idx}
                        style={{
                          margin: 0,
                          fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
                          fontStyle: esActiva ? "italic" : "normal",
                          fontSize: esActiva ? "1.02rem" : "0.84rem",
                          fontWeight: esActiva ? 500 : 400,
                          letterSpacing: esActiva ? "0.015em" : "0.01em",
                          lineHeight: 1.45,
                          color: esActiva
                            ? "#F5EFE6"
                            : distancia === 1
                              ? "rgba(245, 239, 230, 0.45)"
                              : "rgba(245, 239, 230, 0.22)",
                          textShadow: esActiva
                            ? "0 1px 14px rgba(245, 239, 230, 0.22)"
                            : "none",
                          transform: esActiva ? "scale(1.02)" : "scale(1)",
                          transition: "all 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
                          textAlign: "center",
                        }}
                      >
                        {linea.texto}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pie discreto con opción para volver a doblar la tarjeta */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={handleDoblarTarjeta}
                title="Cerrar y volver a doblar el díptico"
                aria-label="Doblar tarjeta"
                style={{
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.7)",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <RotateCcw size={11} />
                <span>Doblar tarjeta</span>
              </button>
              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.5px" }}>
                {nombreMarca}
              </span>
            </div>
          </div>

          {accionesInferiores && (
            <div
              style={{
                width: "100%",
                maxWidth: "380px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                marginTop: abierta ? "4px" : "-72px",
                position: "relative",
                zIndex: 5,
                transition: "margin-top 1.65s cubic-bezier(0.25, 0.9, 0.3, 1)",
              }}
            >
              {accionesInferiores}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
