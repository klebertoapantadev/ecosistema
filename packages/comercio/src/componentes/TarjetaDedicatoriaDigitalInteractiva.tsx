"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Sparkles, RotateCcw } from "lucide-react";
import type { DisenoVisualTarjeta } from "../operaciones-taller";
import {
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
        backgroundColor: "#E8E3D9",
        backgroundImage: `${TEXTURA_PAPEL_KRAFT_SVG}, radial-gradient(ellipse at center, rgba(255,255,255,0.34), rgba(180,170,154,0.14) 100%)`,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Decoración botánica sutil en esquinas diagonales solo para Condolencias Horizontal */}
      {esCondolencias && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "10px",
              left: "12px",
              fontSize: "1.9rem",
              opacity: 0.34,
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
              bottom: "10px",
              right: "12px",
              fontSize: "1.9rem",
              opacity: 0.34,
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
        const contenido =
          blk.rol === "mensaje"
            ? dedicatoria ||
              (esCondolencias
                ? "Expresamos nuestras más sentidas condolencias."
                : "Con todo mi cariño.")
            : blk.rol === "firma"
              ? remitente.trim()
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

  // En Dedicatoria (díptico real), siempre inicia doblada para disfrutar la apertura en 3D;
  // en Condolencias (tarjeta plana sin doblez), se muestra abierta directamente.
  const [abierta, setAbierta] = useState<boolean>(esCondolencias);
  const [reproduciendo, setReproduciendo] = useState<boolean>(false);
  const [silenciado, setSilenciado] = useState<boolean>(false);
  const [tiempoActual, setTiempoActual] = useState<number>(0);

  const contenedorLyricsRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const audioHtmlRef = useRef<HTMLAudioElement | null>(null);

  const negNorm = datosIniciales.negocio.trim().toLowerCase();
  const esMargaritas = negNorm.includes("margarita");
  const nombreMarca = esMargaritas ? "Margaritas Floristería" : "Tinkay Flores y Eventos";

  useEffect(() => {
    if (!youtubeId || esCondolencias || typeof window === "undefined") return;

    const inicializarPlayer = () => {
      if (!(window as any).YT || !(window as any).YT.Player) return;
      try {
        playerRef.current = new (window as any).YT.Player("youtube-player-iframe", {
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
              event.target.setVolume(25);
            },
            onStateChange: (event: any) => {
              if (event.data === (window as any).YT.PlayerState.PLAYING) {
                setReproduciendo(true);
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
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [youtubeId, esCondolencias]);

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
    setAbierta(true);
    if (!tieneCancion) return;
    if (esAudioDirecto && audioHtmlRef.current) {
      audioHtmlRef.current.volume = 0.25;
      audioHtmlRef.current
        .play()
        .then(() => setReproduciendo(true))
        .catch(() => {});
      return;
    }
    if (playerRef.current?.playVideo) {
      try {
        playerRef.current.playVideo();
        playerRef.current.setVolume(25);
        setReproduciendo(true);
      } catch {}
    }
  };

  const handleDoblarTarjeta = () => {
    setAbierta(false);
  };

  const handleToggleReproduccion = () => {
    if (esAudioDirecto && audioHtmlRef.current) {
      if (reproduciendo) {
        audioHtmlRef.current.pause();
        setReproduciendo(false);
      } else {
        void audioHtmlRef.current.play();
        setReproduciendo(true);
      }
      return;
    }
    if (!playerRef.current) return;
    if (reproduciendo) {
      playerRef.current.pauseVideo();
      setReproduciendo(false);
    } else {
      playerRef.current.playVideo();
      setReproduciendo(true);
    }
  };

  const handleToggleSilencio = () => {
    if (esAudioDirecto && audioHtmlRef.current) {
      audioHtmlRef.current.muted = !silenciado;
      setSilenciado(!silenciado);
      return;
    }
    if (!playerRef.current) return;
    if (silenciado) {
      playerRef.current.unMute();
      playerRef.current.setVolume(25);
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
        minHeight: "100vh",
        backgroundColor: esCondolencias ? "#18181B" : "#0F172A",
        backgroundImage: esCondolencias
          ? "radial-gradient(ellipse at top, #27272A, #18181B 75%)"
          : "radial-gradient(ellipse at top, #1E293B, #0F172A 78%)",
        color: "#FFFFFF",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
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
          `,
        }}
      />

      {tieneCancion && youtubeId && (
        <div
          id="youtube-player-iframe"
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
              borderRadius: "8px",
              boxShadow: "0 25px 55px -12px rgba(0, 0, 0, 0.7)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.18)",
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
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.5px" }}>
            {nombreMarca}
          </span>
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
                Cerrada se desplaza -24% hacia arriba para que la portada (mitad inferior) quede centrada;
                al abrirse se desliza suavemente a 0% mostrando ambas caras desplegadas */}
            <div
              onClick={!abierta ? handleAbrirTarjeta : undefined}
              role={!abierta ? "button" : undefined}
              tabIndex={!abierta ? 0 : undefined}
              aria-label={!abierta ? "Toca para abrir tu tarjeta" : undefined}
              onKeyDown={(e) => {
                if (!abierta && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleAbrirTarjeta();
                }
              }}
              style={{
                width: "100%",
                aspectRatio: "113 / 168",
                position: "relative",
                transformStyle: "preserve-3d",
                transform: abierta ? "translateY(0%)" : "translateY(-23%)",
                transition: "transform 1.05s cubic-bezier(0.22, 1, 0.36, 1)",
                cursor: abierta ? "default" : "pointer",
              }}
            >
              {/* 1. CARA INFERIOR INTERNA FIJA (MITAD INFERIOR 50%..100% DEL DISEÑO) */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "50%",
                  height: "50%",
                  overflow: "hidden",
                  borderBottomLeftRadius: "8px",
                  borderBottomRightRadius: "8px",
                  borderTopLeftRadius: abierta ? "0px" : "6px",
                  borderTopRightRadius: abierta ? "0px" : "6px",
                  boxShadow: abierta
                    ? "0 28px 55px -12px rgba(0, 0, 0, 0.65)"
                    : "0 2px 0 #BDB6A8, 0 4px 0 #A8A092, 0 26px 52px -10px rgba(0, 0, 0, 0.72)",
                  transition: "box-shadow 0.8s ease",
                  zIndex: 1,
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
                    transition: "opacity 0.9s ease",
                    pointerEvents: "none",
                    zIndex: 8,
                  }}
                />
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
                  transition: "transform 1.08s cubic-bezier(0.22, 1, 0.36, 1)",
                  zIndex: 3,
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
                        rotateX(180deg) compensa el -180deg de la solapa cerrada para quedar 100% al derecho */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: "rotateX(180deg)",
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
                          width: "160%",
                          maxWidth: "none",
                          height: "auto",
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
                        marginTop: "6px",
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "0.95rem",
                        fontStyle: "italic",
                        color: "#44403C",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Para: <strong style={{ fontStyle: "normal", color: "#1C1917" }}>{datosIniciales.destinatario}</strong>
                    </div>
                  )}

                  {/* Invitación sutil en la parte inferior de la portada real */}
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
                      animation: "ecoPulsoSuaveTarjeta 2.4s ease-in-out infinite",
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
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              opacity: abierta ? 1 : 0,
              transform: abierta ? "translateY(0px)" : "translateY(10px)",
              pointerEvents: abierta ? "auto" : "none",
              transition: "opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s",
            }}
          >
            {/* CONTROL SUTIL DE AUDIO SOLO EN DEDICATORIA CON CANCIÓN */}
            {tieneCancion && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  backdropFilter: "blur(8px)",
                  padding: "6px 14px",
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
                    background: "#F8FAFC",
                    color: "#0F172A",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {reproduciendo ? <Pause size={13} /> : <Play size={13} />}
                </button>

                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#F1F5F9",
                    maxWidth: "195px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  🎵 {datosIniciales.musicaTitulo || "Melodía"}
                </span>

                <button
                  type="button"
                  onClick={handleToggleSilencio}
                  title={silenciado ? "Activar sonido" : "Silenciar"}
                  aria-label={silenciado ? "Activar sonido" : "Silenciar"}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#CBD5E1",
                    cursor: "pointer",
                    padding: "2px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {silenciado ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              </div>
            )}

            {/* PARTE INFERIOR: LYRIC DESLIZÁNDOSE (SOLO DEDICATORIA CON LETRA) */}
            {tieneCancion && lyricsList.length > 0 && (
              <div
                style={{
                  width: "100%",
                  backgroundColor: "rgba(30, 41, 59, 0.65)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  ref={contenedorLyricsRef}
                  style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "6px 0",
                    scrollBehavior: "smooth",
                  }}
                >
                  {lyricsList.map((linea, idx) => {
                    const esActiva = idx === lineaActivaIndex;
                    return (
                      <p
                        key={idx}
                        style={{
                          margin: 0,
                          fontSize: esActiva ? "0.98rem" : "0.82rem",
                          fontWeight: esActiva ? 700 : 400,
                          color: esActiva ? "#FDE047" : "rgba(255, 255, 255, 0.42)",
                          transition: "all 0.28s ease",
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
        </div>
      )}
    </div>
  );
}
