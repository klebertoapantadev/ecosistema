"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Play, Pause, Volume2, VolumeX, Sparkles } from "lucide-react";
import type { DisenoVisualTarjeta } from "../operaciones-taller";
import {
  asegurarFuentesGoogleTarjetaCargadas,
  esFirmaVisibleValida,
  normalizarDisenoTarjeta,
  resolverFontFamilyCss,
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

function extraerYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  return match && match[1] ? match[1] : null;
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

  // Si no tiene canción (o es condolencias), mostrar la tarjeta abierta directamente
  const [abierta, setAbierta] = useState<boolean>(!tieneCancion);
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

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: esCondolencias ? "#18181B" : "#0F172A",
        backgroundImage: esCondolencias
          ? "radial-gradient(ellipse at top, #27272A, #18181B 75%)"
          : "radial-gradient(ellipse at top, #1E293B, #0F172A 75%)",
        color: "#FFFFFF",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
      }}
    >
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

      {!abierta ? (
        // PORTADA CERRADA (SOLO CUANDO HAY CANCIÓN PARA DESBLOQUEAR AUDIO MÓVIL EN 1 TOQUE)
        <div
          style={{
            maxWidth: "380px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <div
            onClick={handleAbrirTarjeta}
            style={{
              width: "100%",
              aspectRatio: "16.8 / 11.3",
              backgroundColor: "#F6F3EC",
              borderRadius: "14px",
              boxShadow: "0 22px 45px -12px rgba(0, 0, 0, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FDE68A, #D97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "10px",
              }}
            >
              <Heart size={22} color="#FFFFFF" fill="#FFFFFF" />
            </div>

            <span
              style={{
                fontSize: "0.74rem",
                color: "#78716C",
                letterSpacing: "1.6px",
                textTransform: "uppercase",
              }}
            >
              {nombreMarca}
            </span>
            {datosIniciales.destinatario && datosIniciales.destinatario !== "Pendiente" && (
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#1C1917",
                  margin: "6px 0 2px 0",
                }}
              >
                {datosIniciales.destinatario}
              </h2>
            )}

            <div
              style={{
                marginTop: "14px",
                padding: "7px 16px",
                borderRadius: "999px",
                backgroundColor: "#E7E5E4",
                color: "#292524",
                fontSize: "0.76rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Sparkles size={13} /> Toca para abrir tu tarjeta
            </div>
          </div>
        </div>
      ) : (
        // VISTA PURA DE LA TARJETA DIGITAL + CANCIÓN (SI APLICA) + LYRIC ABAJO
        <div
          style={{
            maxWidth: esCondolencias ? "560px" : "400px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* LA TARJETA FÍSICA EN PROPORCIÓN REAL (16.8x11.3 HORIZONTAL O 11.3x16.8 VERTICAL) */}
          <div
            style={{
              width: "100%",
              minHeight: esCondolencias ? "310px" : "460px",
              aspectRatio: esCondolencias ? "16.8 / 11.3" : "11.3 / 16.8",
              backgroundColor: "#F6F4EE",
              borderRadius: "14px",
              padding: esCondolencias ? "36px 40px" : "38px 28px 28px 28px",
              color: "#1C1917",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.65)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              position: "relative",
              boxSizing: "border-box",
              overflow: "hidden",
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
                    fontSize: "1.8rem",
                    opacity: 0.32,
                    filter: "grayscale(100%)",
                    pointerEvents: "none",
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
                    fontSize: "1.8rem",
                    opacity: 0.32,
                    filter: "grayscale(100%)",
                    transform: "rotate(180deg)",
                    pointerEvents: "none",
                  }}
                >
                  🌿
                </div>
              </>
            )}

            {/* IMÁGENES (HASTA 3, CON SOPORTE FONDO 100%) */}
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
                    filter: im.escalaGrises ? "grayscale(100%)" : "none",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
              ) : (
                <img
                  key={im.id}
                  src={im.url}
                  alt="Imagen de la tarjeta"
                  style={{
                    position: "relative",
                    zIndex: 2,
                    maxWidth: `${Math.max(20, Math.min(94, (im.anchoMm / (esCondolencias ? 168 : 113)) * 100))}%`,
                    maxHeight: "150px",
                    objectFit: "contain",
                    marginBottom: "10px",
                    opacity: im.opacidad ?? 1,
                    transform: im.rotacionDeg ? `rotate(${im.rotacionDeg}deg)` : undefined,
                    filter: im.escalaGrises ? "grayscale(100%)" : "none",
                  }}
                />
              )
            )}

            {/* BLOQUES DE TEXTO (MENSAJE + EXTRAS + FIRMA CON SUS FUENTES CURADAS) */}
            {disenoNorm.bloquesTexto.map((blk) => {
              if (blk.rol === "firma") {
                if (!disenoNorm.mostrarFirma || !esFirmaVisibleValida(datosIniciales.remitente)) {
                  return null;
                }
                return (
                  <div
                    key={blk.id}
                    style={{
                      position: "relative",
                      zIndex: 3,
                      marginTop: "14px",
                      paddingTop: "8px",
                      borderTop: "1px dashed rgba(120, 113, 108, 0.3)",
                      fontFamily: resolverFontFamilyCss(blk.fuente, esCondolencias),
                      fontSize: `${Math.max(13, (blk.tamanoPt || 15) * 0.95)}px`,
                      fontWeight: blk.negrita ? 700 : 400,
                      fontStyle: blk.italica ? "italic" : "normal",
                      textAlign: blk.alineacion || "right",
                      color: blk.colorHex || "#44403C",
                      width: `${blk.anchoPct}%`,
                      maxWidth: "94%",
                    }}
                  >
                    {datosIniciales.remitente}
                  </div>
                );
              }
              const contenido =
                blk.rol === "mensaje"
                  ? datosIniciales.dedicatoria ||
                    (esCondolencias
                      ? "Expresamos nuestras más sentidas condolencias."
                      : "Con todo mi cariño.")
                  : (blk.texto || "").trim();
              if (!contenido) return null;

              return (
                <div
                  key={blk.id}
                  style={{
                    position: "relative",
                    zIndex: 3,
                    fontFamily: resolverFontFamilyCss(blk.fuente, esCondolencias),
                    fontSize:
                      blk.rol === "mensaje"
                        ? esCondolencias
                          ? "1.35rem"
                          : "1.85rem"
                        : `${Math.max(13, (blk.tamanoPt || 15) * 0.95)}px`,
                    fontWeight: blk.negrita ? 700 : 400,
                    fontStyle: blk.italica ? "italic" : "normal",
                    textAlign: blk.alineacion || "center",
                    lineHeight: 1.4,
                    color: blk.colorHex || "#18181B",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    width: `${blk.anchoPct}%`,
                    maxWidth: "94%",
                    marginTop: blk.rol === "extra" ? "6px" : 0,
                  }}
                >
                  {contenido}
                </div>
              );
            })}

            {/* CONTROL SUTIL DE AUDIO SOLO EN DEDICATORIA CON CANCIÓN */}
            {tieneCancion && (
              <div
                style={{
                  marginTop: "20px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "rgba(28, 25, 23, 0.06)",
                  padding: "5px 12px",
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
                    background: "#1C1917",
                    color: "#FFFFFF",
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
                    fontWeight: 600,
                    color: "#292524",
                    maxWidth: "180px",
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
                    color: "#57534E",
                    cursor: "pointer",
                    padding: "2px",
                  }}
                >
                  {silenciado ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              </div>
            )}
          </div>

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

          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.5px" }}>
            {nombreMarca}
          </span>
        </div>
      )}
    </div>
  );
}
