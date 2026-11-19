"use client";

import React, { useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  Loader2,
  Lock,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import type { DisenoVisualTarjeta } from "../operaciones-taller";
import {
  buscarLyricsCancionAction,
  editarTarjetaClienteAction,
  subirAudioTarjetaAction,
} from "../acciones-operaciones-taller";
import {
  LienzoDisenadorTarjeta,
  normalizarDisenoTarjeta,
} from "./LienzoDisenadorTarjeta";

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

export function EditorTarjetaPublicoCliente({
  datosIniciales,
  tokenEdicion,
}: PropsEditorTarjetaPublicoCliente) {
  const esCondolencias = datosIniciales.tipo === "CONDOLENCIAS_PLANA";
  const negNorm = datosIniciales.negocio.trim().toLowerCase();
  const nombreMarca = negNorm.includes("margarita")
    ? "Margaritas Floristería"
    : "Tinkay Flores y Eventos";

  const [para, setPara] = useState<string>(datosIniciales.destinatario || "");
  const [de, setDe] = useState<string>(datosIniciales.remitente || "");
  const [mensaje, setMensaje] = useState<string>(datosIniciales.dedicatoria || "");
  const [confidencial, setConfidencial] = useState<boolean>(
    esCondolencias ? false : Boolean(datosIniciales.confidencial)
  );
  const [diseno, setDiseno] = useState<DisenoVisualTarjeta>(() =>
    normalizarDisenoTarjeta(
      datosIniciales.diseno,
      esCondolencias,
      datosIniciales.dedicatoria || ""
    )
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

  const [subiendoMp3, setSubiendoMp3] = useState<boolean>(false);
  const [buscandoLyrics, setBuscandoLyrics] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [exitoMsg, setExitoMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputAudioRef = useRef<HTMLInputElement | null>(null);
  const soloQrEfectivo = !esCondolencias && confidencial;

  const handleSubirAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("El archivo MP3 no debe superar los 15 MB.");
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
      setExitoMsg("🎵 Audio cargado. Pulsa Guardar Tarjeta para aplicarlo.");
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
      setErrorMsg(res.error || "No se encontró letra automática.");
      return;
    }
    if (res.tituloDetectado && !musicaTitulo.trim()) {
      setMusicaTitulo(res.tituloDetectado);
    }
    if (res.lyrics) {
      setLyrics(res.lyrics);
      setExitoMsg(`✨ Letra sincronizada cargada (${res.lyrics.length} líneas).`);
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) {
      setErrorMsg("Escribe el mensaje para tu tarjeta.");
      return;
    }
    setGuardando(true);
    setErrorMsg(null);
    setExitoMsg(null);

    let lyricsFinales = esCondolencias ? [] : lyrics;
    let tituloFinal = esCondolencias ? null : musicaTitulo.trim() || null;
    if (
      !esCondolencias &&
      musicaUrl.trim() &&
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
        if (!tituloFinal && autoLrc.tituloDetectado) {
          tituloFinal = autoLrc.tituloDetectado;
          setMusicaTitulo(autoLrc.tituloDetectado);
        }
      }
    }

    const disenoFinal = normalizarDisenoTarjeta(diseno, esCondolencias, mensaje.trim());

    const res = await editarTarjetaClienteAction({
      token: tokenEdicion,
      dedicatoria: mensaje.trim(),
      para: para.trim(),
      de: de.trim(),
      confidencial: soloQrEfectivo,
      diseno: disenoFinal,
      musicaUrl: esCondolencias ? null : musicaUrl.trim() || null,
      musicaTitulo: tituloFinal,
      lyrics: lyricsFinales,
    });

    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error || "No se pudieron guardar los cambios.");
      return;
    }
    setExitoMsg("✅ Tu tarjeta y diseño fueron guardados y quedaron listos para nuestro taller.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0F172A",
        backgroundImage: "radial-gradient(ellipse at top, #1E293B, #0F172A 75%)",
        color: "#FFFFFF",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 14px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
          backgroundColor: "#FFFFFF",
          color: "#0F172A",
          borderRadius: "18px",
          padding: "22px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* ENCABEZADO */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "10px",
            flexWrap: "wrap",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "12px",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#0369A1",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              {nombreMarca} · Pedido {datosIniciales.codigo}
            </span>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "4px 0 2px 0", color: "#0F172A" }}>
              {esCondolencias ? "🕊️ Diseñar Tarjeta de Condolencias" : "💌 Diseñar Tarjeta de Dedicatoria"}
            </h1>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748B" }}>
              {esCondolencias
                ? "Formato horizontal (16,8 × 11,3 cm). Puedes mover el texto, alinear/justificar y agregar un logo o imagen."
                : "Formato vertical plegable (11,3 × 16,8 cm). Personaliza el mensaje, diseño, imagen o modo Solo QR."}
            </p>
          </div>

          {!esCondolencias && (
            <a
              href={`/dedicatoria/${datosIniciales.tokenVista}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver cómo visualizará el destinatario la tarjeta digital"
              aria-label="Ver Tarjeta Digital"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#0F172A",
                textDecoration: "none",
                fontSize: "0.76rem",
                fontWeight: 700,
              }}
            >
              <span>Ver Digital</span>
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {datosIniciales.bloqueadoEdicion ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              backgroundColor: "#FEF3C7",
              border: "1px solid #FDE68A",
              color: "#92400E",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
              <Lock size={16} />
              <span>Tarjeta impresa en taller</span>
            </div>
            <p style={{ margin: 0 }}>
              Tu tarjeta ya fue impresa para acompañar el arreglo floral y no admite más modificaciones.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleGuardar}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "18px",
              alignItems: "start",
            }}
          >
            {/* COLUMNA IZQUIERDA: DISEÑADOR GRÁFICO WYSIWYG */}
            <LienzoDisenadorTarjeta
              negocio={negNorm}
              esCondolencias={esCondolencias}
              soloQr={soloQrEfectivo}
              mensaje={mensaje}
              diseno={diseno}
              onCambiarDiseno={setDiseno}
              onError={(msg) => setErrorMsg(msg)}
            />

            {/* COLUMNA DERECHA: DATOS, MODO MENSAJE VS QR, Y MÚSICA (SOLO DEDICATORIA) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* MODO DE IMPRESIÓN EXCLUSIVO PARA DEDICATORIA (MENSAJE O QR, NUNCA AMBOS) */}
              {!esCondolencias && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    ¿Cómo deseas imprimir tu tarjeta física?
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setConfidencial(false)}
                      style={{
                        padding: "9px 10px",
                        borderRadius: "8px",
                        border: !soloQrEfectivo ? "2px solid #0F766E" : "1px solid #CBD5E1",
                        background: !soloQrEfectivo ? "#F0FDFA" : "#FFFFFF",
                        color: !soloQrEfectivo ? "#0F766E" : "#475569",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      📝 Imprimir Mensaje
                      <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#64748B" }}>
                        Texto + imagen (sin QR)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfidencial(true)}
                      style={{
                        padding: "9px 10px",
                        borderRadius: "8px",
                        border: soloQrEfectivo ? "2px solid #0284C7" : "1px solid #CBD5E1",
                        background: soloQrEfectivo ? "#F0F9FF" : "#FFFFFF",
                        color: soloQrEfectivo ? "#0369A1" : "#475569",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Lock size={11} style={{ verticalAlign: "middle", marginRight: "3px" }} />
                      Imprimir Solo QR
                      <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 400, color: "#64748B" }}>
                        Confidencial · Se abre en web
                      </span>
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    {esCondolencias ? "En memoria / Destinatario:" : "Para (Destinatario):"}
                  </label>
                  <input
                    type="text"
                    value={para}
                    onChange={(e) => setPara(e.target.value)}
                    placeholder="Quien recibe"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.84rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      color: "#334155",
                      marginBottom: "4px",
                    }}
                  >
                    De parte de (Firma):
                  </label>
                  <input
                    type="text"
                    value={de}
                    onChange={(e) => setDe(e.target.value)}
                    placeholder="Quien envía"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.84rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: "4px",
                  }}
                >
                  Mensaje de tu tarjeta:
                </label>
                <textarea
                  rows={5}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder={
                    esCondolencias
                      ? "Escribe el mensaje de condolencias..."
                      : "Escribe tu dedicatoria..."
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #94A3B8",
                    fontSize: "0.88rem",
                    lineHeight: 1.45,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* MÚSICA Y LETRA SOLO PARA DEDICATORIA */}
              {!esCondolencias && (
                <div
                  style={{
                    padding: "11px",
                    borderRadius: "10px",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontSize: "0.78rem", color: "#1E293B" }}>
                      🎵 Canción de fondo (YouTube o MP3):
                    </strong>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        disabled={subiendoMp3}
                        onClick={() => inputAudioRef.current?.click()}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#0F172A",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {subiendoMp3 ? <Loader2 size={12} /> : <Upload size={12} />}
                        <span>{subiendoMp3 ? "Subiendo..." : "Subir MP3"}</span>
                      </button>
                      <input
                        ref={inputAudioRef}
                        type="file"
                        accept="audio/*,.mp3,.m4a,.wav,.ogg"
                        onChange={handleSubirAudio}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        disabled={buscandoLyrics}
                        onClick={() => void handleBuscarLetra()}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "6px",
                          border: "1px solid #BAE6FD",
                          background: "#E0F2FE",
                          color: "#0369A1",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {buscandoLyrics ? <Loader2 size={12} /> : <Sparkles size={12} />}
                        <span>{buscandoLyrics ? "Buscando..." : "Cargar Letra"}</span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={musicaUrl}
                    onChange={(e) => setMusicaUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "7px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      fontSize: "0.79rem",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="text"
                    value={musicaTitulo}
                    onChange={(e) => setMusicaTitulo(e.target.value)}
                    placeholder="Artista - Canción (ej: Ed Sheeran - Perfect)"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "7px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      fontSize: "0.79rem",
                      boxSizing: "border-box",
                    }}
                  />
                  {lyrics.length > 0 && (
                    <span style={{ fontSize: "0.71rem", color: "#15803D", fontWeight: 600 }}>
                      <Check size={12} style={{ verticalAlign: "middle" }} /> {lyrics.length} líneas
                      de letra listas para deslizarse al reproducirse la canción.
                    </span>
                  )}
                </div>
              )}

              {errorMsg && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    background: "#FEE2E2",
                    color: "#991B1B",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  {errorMsg}
                </div>
              )}
              {exitoMsg && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    background: "#DCFCE7",
                    color: "#166534",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  {exitoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={guardando}
                style={{
                  padding: "12px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                }}
              >
                {guardando ? <Loader2 size={16} /> : <Save size={16} />}
                <span>{guardando ? "Guardando..." : "Guardar Tarjeta"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
