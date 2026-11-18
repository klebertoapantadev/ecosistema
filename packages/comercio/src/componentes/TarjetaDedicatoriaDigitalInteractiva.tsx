"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Edit3,
  Check,
  Share2,
  Sparkles,
  Lock,
  ChevronDown,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { editarTarjetaClienteAction } from "../acciones-operaciones-taller";

export interface PropsTarjetaDedicatoriaDigitalInteractiva {
  datosIniciales: {
    ordenId: string;
    codigo: string;
    negocio: string;
    destinatario: string;
    remitente: string;
    dedicatoria: string;
    tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
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

// Extraer ID de YouTube de cualquier formato habitual
function extraerYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  return match && match[1] ? match[1] : null;
}

export function TarjetaDedicatoriaDigitalInteractiva({
  datosIniciales,
  token,
}: PropsTarjetaDedicatoriaDigitalInteractiva) {
  const [datos, setDatos] = useState(datosIniciales);
  const [abierta, setAbierta] = useState<boolean>(false);
  const [reproduciendo, setReproduciendo] = useState<boolean>(false);
  const [silenciado, setSilenciado] = useState<boolean>(false);
  const [tiempoActual, setTiempoActual] = useState<number>(0);

  // Modo edición del cliente
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);
  const [dedicatoriaEditada, setDedicatoriaEditada] = useState<string>(datos.dedicatoria);
  const [musicaUrlEditada, setMusicaUrlEditada] = useState<string>(datos.musicaUrl || "");
  const [musicaTituloEditada, setMusicaTituloEditada] = useState<string>(datos.musicaTitulo || "");
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);
  const [mensajeExitoEdicion, setMensajeExitoEdicion] = useState<string | null>(null);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  const contenedorLyricsRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const negNorm = datos.negocio.trim().toLowerCase();
  const esMargaritas = negNorm.includes("margarita");
  const nombreMarca = esMargaritas ? "Margaritas Floristería" : "Tinkay Flores y Eventos";
  const youtubeId = useMemo(() => extraerYouTubeId(datos.musicaUrl), [datos.musicaUrl]);

  // Cargar API de YouTube IFrame para control de volumen sutil y tiempo
  useEffect(() => {
    if (!youtubeId || typeof window === "undefined") return;

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
              // Volumen sutil por defecto (25%)
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
      } catch (err) {
        console.warn("No se pudo instanciar YouTube Player", err);
      }
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
  }, [youtubeId]);

  // Rastrear el tiempo de reproducción para sincronizar lyrics
  useEffect(() => {
    if (!reproduciendo) return;
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        try {
          const t = playerRef.current.getCurrentTime();
          setTiempoActual(t);
        } catch {}
      } else {
        setTiempoActual((prev) => prev + 0.5);
      }
    }, 450);
    return () => clearInterval(interval);
  }, [reproduciendo]);

  // Scroll automático de la letra
  const lyricsList = Array.isArray(datos.lyrics) ? datos.lyrics : [];
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

  const handleAbrirDedicatoria = () => {
    setAbierta(true);
    if (playerRef.current?.playVideo) {
      try {
        playerRef.current.playVideo();
        playerRef.current.setVolume(25);
        setReproduciendo(true);
      } catch (err) {
        console.warn("Autoplay bloqueado por el navegador", err);
      }
    }
  };

  const handleToggleReproduccion = () => {
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

  const handleGuardarCambiosCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dedicatoriaEditada.trim()) {
      setErrorEdicion("Escribe un mensaje para tu tarjeta.");
      return;
    }

    setGuardandoEdicion(true);
    setErrorEdicion(null);
    setMensajeExitoEdicion(null);

    const res = await editarTarjetaClienteAction({
      token,
      dedicatoria: dedicatoriaEditada.trim(),
      musicaUrl: musicaUrlEditada.trim() || null,
      musicaTitulo: musicaTituloEditada.trim() || null,
    });

    setGuardandoEdicion(false);
    if (!res.ok) {
      setErrorEdicion(res.error || "No se pudo guardar la dedicatoria.");
      return;
    }

    setDatos((prev) => ({
      ...prev,
      dedicatoria: dedicatoriaEditada.trim(),
      musicaUrl: musicaUrlEditada.trim() || null,
      musicaTitulo: musicaTituloEditada.trim() || null,
    }));
    setMensajeExitoEdicion("✅ Dedicatoria actualizada con éxito.");
    setTimeout(() => {
      setModoEdicion(false);
      setMensajeExitoEdicion(null);
    }, 1800);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0F172A",
        backgroundImage: "radial-gradient(ellipse at top, #1E293B, #0F172A 70%)",
        color: "#FFFFFF",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Elemento oculto de YouTube Player para reproducir audio en segundo plano */}
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

      {/* BARRA SUPERIOR DE AUTOSERVICIO DEL CLIENTE */}
      <div
        style={{
          position: "fixed",
          top: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(30, 41, 59, 0.85)",
          backdropFilter: "blur(8px)",
          padding: "6px 14px",
          borderRadius: "999px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          fontSize: "0.78rem",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
        }}
      >
        <span style={{ color: "#E2E8F0" }}>{nombreMarca}</span>
        <span style={{ color: "rgba(255,255,255,0.3)" }}>•</span>

        {datos.bloqueadoEdicion ? (
          <span style={{ color: "#94A3B8", display: "flex", alignItems: "center", gap: "4px" }}>
            <Lock size={12} /> Impresa en Taller
          </span>
        ) : (
          <button
            onClick={() => setModoEdicion(!modoEdicion)}
            style={{
              border: "none",
              background: "transparent",
              color: "#38BDF8",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: 0,
            }}
          >
            <Edit3 size={12} /> {modoEdicion ? "Cerrar edición" : "Personalizar mi dedicatoria"}
          </button>
        )}
      </div>

      {/* MODAL DE EDICIÓN PARA EL COMPRADOR */}
      {modoEdicion && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            backdropFilter: "blur(6px)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setModoEdicion(false)}
        >
          <div
            style={{
              backgroundColor: "#1E293B",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "16px",
              maxWidth: "500px",
              width: "100%",
              padding: "20px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", fontWeight: 700, color: "#F8FAFC" }}>
              ✏️ Personaliza tu Dedicatoria y Canción
            </h3>
            <p style={{ margin: "0 0 14px 0", fontSize: "0.8rem", color: "#94A3B8" }}>
              Puedes ajustar el mensaje y la melodía mientras el taller no haya comenzado la impresión física.
            </p>

            <form onSubmit={handleGuardarCambiosCliente} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "4px" }}>
                  Mensaje de la Tarjeta:
                </label>
                <textarea
                  rows={4}
                  value={dedicatoriaEditada}
                  onChange={(e) => setDedicatoriaEditada(e.target.value)}
                  placeholder="Escribe tu mensaje emotivo..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "8px",
                    backgroundColor: "#0F172A",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "4px" }}>
                  Enlace de YouTube (Música de fondo):
                </label>
                <input
                  type="text"
                  value={musicaUrlEditada}
                  onChange={(e) => setMusicaUrlEditada(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: "#0F172A",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#CBD5E1", marginBottom: "4px" }}>
                  Nombre de la Canción (opcional):
                </label>
                <input
                  type="text"
                  value={musicaTituloEditada}
                  onChange={(e) => setMusicaTituloEditada(e.target.value)}
                  placeholder="Ej: Ed Sheeran - Perfect"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: "#0F172A",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#FFFFFF",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {errorEdicion && (
                <div style={{ padding: "8px", borderRadius: "6px", backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#FCA5A5", fontSize: "0.75rem" }}>
                  {errorEdicion}
                </div>
              )}

              {mensajeExitoEdicion && (
                <div style={{ padding: "8px", borderRadius: "6px", backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#86EFAC", fontSize: "0.75rem" }}>
                  {mensajeExitoEdicion}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button
                  type="button"
                  onClick={() => setModoEdicion(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    background: "transparent",
                    color: "#CBD5E1",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0284C7",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {guardandoEdicion ? "Guardando..." : "Guardar Dedicatoria"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL DE LA EXPERIENCIA */}
      {!abierta ? (
        // PANTALLA INICIAL: SOBRE O PORTADA CERRADA
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            animation: "fadeIn 0.6s ease-out",
          }}
        >
          {/* TARJETA CERRADA INTERACTIVA */}
          <div
            onClick={handleAbrirDedicatoria}
            style={{
              width: "100%",
              aspectRatio: "1.4 / 1",
              backgroundColor: "#FFFDF9",
              borderRadius: "16px",
              boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255,255,255,0.8)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              cursor: "pointer",
              transition: "transform 0.25s ease, box-shadow 0.25s ease",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FDE68A, #D97706)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "12px",
                boxShadow: "0 4px 10px rgba(217, 119, 6, 0.3)",
              }}
            >
              <Heart size={24} color="#FFFFFF" fill="#FFFFFF" />
            </div>

            <span style={{ fontSize: "0.8rem", color: "#94A3B8", letterSpacing: "1.5px", textTransform: "uppercase" }}>
              Tienes un detalle especial
            </span>
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "#1E293B",
                margin: "4px 0 2px 0",
              }}
            >
              Para: {datos.destinatario}
            </h2>
            <span style={{ fontSize: "0.85rem", color: "#64748B" }}>
              De parte de: <strong>{datos.remitente}</strong>
            </span>

            <div
              style={{
                marginTop: "16px",
                padding: "6px 14px",
                borderRadius: "999px",
                backgroundColor: "#F1F5F9",
                color: "#0369A1",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <Sparkles size={13} /> Toca para abrir tu dedicatoria
            </div>
          </div>

          <button
            onClick={handleAbrirDedicatoria}
            style={{
              padding: "14px 28px",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(135deg, #0284C7, #0369A1)",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(2, 132, 199, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>💌 Abrir Dedicatoria y Escuchar Música</span>
          </button>
        </div>
      ) : (
        // PANTALLA DE TARJETA ABIERTA CON DEDICATORIA, MÚSICA Y LYRICS
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "36px",
            animation: "fadeIn 0.7s ease-out",
          }}
        >
          {/* TARJETA INTERNA ABIERTA */}
          <div
            style={{
              backgroundColor: "#FFFDF9",
              borderRadius: "18px",
              padding: "32px 24px 24px 24px",
              color: "#1E293B",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#94A3B8", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px" }}>
              {nombreMarca}
            </div>

            <h1
              style={{
                fontFamily: "'Dancing Script', 'Brush Script MT', 'Great Vibes', cursive",
                fontSize: "2.1rem",
                lineHeight: 1.25,
                color: "#0F172A",
                margin: "12px 0 20px 0",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {datos.dedicatoria}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.85rem",
                color: "#64748B",
                borderTop: "1px dashed #E2E8F0",
                paddingTop: "14px",
                width: "80%",
              }}
            >
              <span>Con cariño para</span> <strong>{datos.destinatario}</strong>
            </div>

            {/* CONTROL DE MÚSICA SUTIL */}
            {youtubeId && (
              <div
                style={{
                  marginTop: "18px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: "#F1F5F9",
                  padding: "6px 12px",
                  borderRadius: "999px",
                }}
              >
                <button
                  onClick={handleToggleReproduccion}
                  style={{
                    border: "none",
                    background: "#0284C7",
                    color: "#FFFFFF",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                  title={reproduciendo ? "Pausar música" : "Reanudar música"}
                >
                  {reproduciendo ? <Pause size={14} /> : <Play size={14} />}
                </button>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1E293B", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    🎵 {datos.musicaTitulo || "Melodía de dedicatoria"}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "#64748B" }}>
                    {reproduciendo ? "Reproduciendo al 25% de volumen" : "Pausado"}
                  </span>
                </div>

                <button
                  onClick={handleToggleSilencio}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#64748B",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                  title={silenciado ? "Reactivar sonido" : "Silenciar"}
                >
                  {silenciado ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              </div>
            )}
          </div>

          {/* VISOR DESLIZANTE DE LETRA (LYRICS) */}
          {lyricsList.length > 0 && (
            <div
              style={{
                backgroundColor: "rgba(30, 41, 59, 0.7)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Letra de la Canción
                </span>
                <span style={{ fontSize: "0.7rem", color: "#38BDF8" }}>
                  {lineaActivaIndex >= 0 ? `Línea ${lineaActivaIndex + 1} de ${lyricsList.length}` : "🎵"}
                </span>
              </div>

              <div
                ref={contenedorLyricsRef}
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  padding: "10px 0",
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
                        fontSize: esActiva ? "1.05rem" : "0.85rem",
                        fontWeight: esActiva ? 700 : 400,
                        color: esActiva ? "#FDE047" : "rgba(255, 255, 255, 0.4)",
                        transition: "all 0.3s ease",
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

          {/* BOTÓN DE INTERACCIÓN: AGRADECER POR WHATSAPP */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", marginTop: "8px" }}>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `¡Hola ${datos.remitente}! Acabo de recibir tus flores y escuchar la dedicatoria en ${urlPublicaOTexto(token)}. ¡Muchísimas gracias, me encantó el detalle! 🥰`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "12px",
                backgroundColor: "#22C55E",
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: "0.9rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 10px 20px rgba(34, 197, 94, 0.3)",
              }}
            >
              <MessageCircle size={18} />
              <span>Dar las gracias a {datos.remitente} por WhatsApp</span>
            </a>

            <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
              Flores entregadas con amor por <strong>{nombreMarca}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function urlPublicaOTexto(token: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/dedicatoria/${token}`;
  }
  return `la tarjeta digital`;
}
