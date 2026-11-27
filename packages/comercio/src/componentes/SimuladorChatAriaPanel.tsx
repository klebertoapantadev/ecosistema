"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Clock,
  FlaskConical,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { simularTurnoChatAriaAction } from "../acciones-omnicanal";
import { extraerSegmentosMultimediaMensaje } from "../omnicanal";
import { IconoVectorCanal } from "./IconoCanalOmnicanal";

type CanalSimulador = "whatsapp" | "facebook" | "instagram" | "web";
type IntencionSimulador = "GENERAL" | "CONDOLENCIAS" | "EVENTOS" | "ENTREGA_INMEDIATA";

interface MensajeSimulado {
  id: string;
  rol: "cliente" | "aria" | "error";
  texto: string;
  creadoEn: string;
  latenciaMs?: number;
  agenteNombre?: string;
  escaloHumano?: boolean;
  contextosInyectados?: string[];
}

const CANALES_SIMULACION: Array<{ id: CanalSimulador; etiqueta: string }> = [
  { id: "whatsapp", etiqueta: "WhatsApp" },
  { id: "facebook", etiqueta: "Facebook" },
  { id: "instagram", etiqueta: "Instagram" },
  { id: "web", etiqueta: "Chat Web" },
];

const PRUEBAS_RAPIDAS: Array<{
  etiqueta: string;
  mensaje: string;
  intencion?: IntencionSimulador;
}> = [
  { etiqueta: "Precio rosas", mensaje: "Hola, ¿qué precio tienen los ramos de rosas?" },
  {
    etiqueta: "Entrega inmediata",
    mensaje: "Hola, ¿qué arreglos tienen listos para entregar hoy mismo en 1 o 2 horas?",
    intencion: "ENTREGA_INMEDIATA",
  },
  {
    etiqueta: "Condolencias",
    mensaje: "Buenas tardes, necesito una corona de condolencias para hoy en la tarde.",
    intencion: "CONDOLENCIAS",
  },
  {
    etiqueta: "Cotizar evento",
    mensaje: "Hola, quisiera información sobre decoración floral para un matrimonio en Quito.",
    intencion: "EVENTOS",
  },
  {
    etiqueta: "Costo envío",
    mensaje: "¿Cuánto cuesta el envío a la Carolina en Quito? https://www.google.com/maps?q=-0.1807,-78.4847",
  },
];

function crearIdSesionSimulador(): string {
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}_${aleatorio}`;
}

export interface PropsSimuladorChatAriaPanel {
  negocio: string;
  compacto?: boolean;
}

/**
 * Simulador interactivo multi-turno de Mía (ARIA).
 * Permite probar preguntas y respuestas reales con contexto de producción
 * (Entrega Inmediata, GPS, enlaces tienda, atribución de anuncios) y reiniciar
 * la sesión de memoria en 1 clic sin crear chats reales ni escribir a clientes.
 */
export function SimuladorChatAriaPanel({
  negocio,
  compacto = false,
}: PropsSimuladorChatAriaPanel) {
  const negNorm = negocio.trim().toLowerCase();
  const [canal, setCanal] = useState<CanalSimulador>("whatsapp");
  const [intencion, setIntencion] = useState<IntencionSimulador>("GENERAL");
  const [usarAgenteWhatsapp, setUsarAgenteWhatsapp] = useState<boolean>(true);
  const [nombreSimulado, setNombreSimulado] = useState<string>("Cliente Prueba");
  const [sesionId, setSesionId] = useState<string>(() => crearIdSesionSimulador());
  const [mensajes, setMensajes] = useState<MensajeSimulado[]>([]);
  const [entradaTexto, setEntradaTexto] = useState<string>("");
  const [enviando, setEnviando] = useState<boolean>(false);
  const [origenActual, setOrigenActual] = useState<string>(
    negNorm === "tinkay" ? "https://www.tinkay.net" : ""
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigenActual(window.location.origin.replace(/\/+$/, ""));
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, enviando]);

  function reiniciarSimulacion(nuevoCanal?: CanalSimulador, nuevaIntencion?: IntencionSimulador) {
    setSesionId(crearIdSesionSimulador());
    setMensajes([]);
    setEntradaTexto("");
    if (nuevoCanal) setCanal(nuevoCanal);
    if (nuevaIntencion) setIntencion(nuevaIntencion);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  async function enviarMensajeSimulado(textoForzado?: string, intencionForzada?: IntencionSimulador) {
    const texto = (textoForzado ?? entradaTexto).trim();
    if (!texto || enviando) return;

    const intencionUsar = intencionForzada ?? intencion;
    if (intencionForzada) setIntencion(intencionForzada);

    const ahoraIso = new Date().toISOString();
    const idCliente = `sim-u-${Date.now()}`;
    setMensajes((prev) => [...prev, { id: idCliente, rol: "cliente", texto, creadoEn: ahoraIso }]);
    if (!textoForzado) setEntradaTexto("");
    setEnviando(true);

    const res = await simularTurnoChatAriaAction({
      negocio: negNorm,
      sesionId,
      canal,
      mensaje: texto,
      nombreSimulado,
      intencionAnuncio: intencionUsar,
      usarAgenteWhatsapp,
      origenTiendaUrl: origenActual || undefined,
    });

    setEnviando(false);

    if (!res.ok) {
      setMensajes((prev) => [
        ...prev,
        {
          id: `sim-err-${Date.now()}`,
          rol: "error",
          texto: res.error,
          creadoEn: new Date().toISOString(),
        },
      ]);
      return;
    }

    setMensajes((prev) => [
      ...prev,
      {
        id: `sim-ia-${Date.now()}`,
        rol: "aria",
        texto: res.respuesta,
        creadoEn: new Date().toISOString(),
        latenciaMs: res.latenciaMs,
        agenteNombre: res.agenteNombre,
        escaloHumano: res.escaloHumano,
        contextosInyectados: res.contextosInyectados,
      },
    ]);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  return (
    <div
      style={{
        background: "var(--cf-ffffff, #FFFFFF)",
        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 4px 18px rgba(31, 28, 25, 0.05)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          padding: compacto ? "14px 16px" : "16px 20px",
          borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
          background: "var(--cf-faf8f5, #FAF8F5)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "var(--cf-f2f6f3, #F2F6F3)",
              border: "1px solid var(--cb-ceddd3, #CEDDD3)",
              color: "var(--ct-2f4737, #2F4737)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FlaskConical size={19} />
          </div>
          <div>
            <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Simulador de Chat IA ARIA (Pruebas sin clientes reales)
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--ct-847d74, #847D74)", marginTop: "2px" }}>
              Conversa varios turnos con Mía usando el catálogo real, entregas inmediatas y cotización GPS. Pulsa <strong>Reiniciar</strong> para probar desde cero.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--ct-57524c, #57524C)",
              background: "var(--cf-f4f2ee, #F4F2EE)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "999px",
              padding: "4px 10px",
              fontFamily: "monospace",
            }}
          >
            Sesión #{sesionId.slice(-6)}
          </span>
          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => reiniciarSimulacion()}
            disabled={enviando}
            title="Reiniciar conversación simulada desde cero con memoria nueva"
            aria-label="Reiniciar Chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "9px",
              border: "1px solid #2F4737",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-2f4737, #2F4737)",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: enviando ? "not-allowed" : "pointer",
              opacity: enviando ? 0.6 : 1,
            }}
          >
            <RotateCcw size={14} />
            <span className="btn-texto-responsive">Reiniciar Chat</span>
          </button>
        </div>
      </div>

      {/* Barra de parámetros de simulación */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--cb-efece6, #EFECE6)",
          background: "var(--cf-ffffff, #FFFFFF)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Selector de canal */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}>Canal:</span>
          {CANALES_SIMULACION.map((c) => {
            const activo = canal === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => reiniciarSimulacion(c.id)}
                disabled={enviando}
                title={`Simular conversación en ${c.etiqueta} (inicia sesión limpia)`}
                aria-label={`Simular ${c.etiqueta}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: activo ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                  background: activo ? "#1F1C19" : "var(--cf-f8f7f4, #F8F7F4)",
                  color: activo ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <IconoVectorCanal canal={c.id} size={13} />
                <span>{c.etiqueta}</span>
              </button>
            );
          })}
        </div>

        {/* Selector de anuncio simulado */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor={`sim-intencion-${negNorm}`}
            style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}
          >
            Origen anuncio:
          </label>
          <select
            id={`sim-intencion-${negNorm}`}
            value={intencion}
            onChange={(e) => setIntencion(e.target.value as IntencionSimulador)}
            disabled={enviando}
            style={{
              padding: "5px 9px",
              borderRadius: "8px",
              border: "1px solid var(--cb-d9d4cb, #D9D4CB)",
              background: "var(--cf-ffffff, #FFFFFF)",
              fontSize: "0.78rem",
              color: "var(--ct-1f1c19, #1F1C19)",
              fontFamily: "inherit",
            }}
          >
            <option value="GENERAL">Orgánico (sin anuncio)</option>
            <option value="ENTREGA_INMEDIATA">Anuncio Entrega Inmediata</option>
            <option value="CONDOLENCIAS">Anuncio Condolencias</option>
            <option value="EVENTOS">Anuncio Eventos / Bodas</option>
          </select>
        </div>

        {/* Nombre simulado */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            htmlFor={`sim-nombre-${negNorm}`}
            style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}
          >
            Cliente:
          </label>
          <input
            id={`sim-nombre-${negNorm}`}
            type="text"
            value={nombreSimulado}
            onChange={(e) => setNombreSimulado(e.target.value)}
            disabled={enviando}
            style={{
              width: "125px",
              padding: "5px 8px",
              borderRadius: "8px",
              border: "1px solid var(--cb-d9d4cb, #D9D4CB)",
              fontSize: "0.78rem",
              color: "var(--ct-1f1c19, #1F1C19)",
              fontFamily: "inherit",
            }}
          />
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.75rem",
            color: "var(--ct-57524c, #57524C)",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          <input
            type="checkbox"
            checked={usarAgenteWhatsapp}
            onChange={(e) => setUsarAgenteWhatsapp(e.target.checked)}
            disabled={enviando || canal === "web"}
          />
          <span>Usar agente WhatsApp/Redes si existe</span>
        </label>
      </div>

      {/* Escenarios rápidos en 1 clic */}
      <div
        style={{
          padding: "9px 16px",
          borderBottom: "1px solid var(--cb-efece6, #EFECE6)",
          background: "var(--cf-fcfbf9, #FCFBF9)",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "var(--ct-847d74, #847D74)" }}>
          Pruebas rápidas:
        </span>
        {PRUEBAS_RAPIDAS.map((p) => (
          <button
            key={p.etiqueta}
            type="button"
            disabled={enviando}
            onClick={() => void enviarMensajeSimulado(p.mensaje, p.intencion)}
            title={`Probar: ${p.mensaje}`}
            aria-label={`Probar ${p.etiqueta}`}
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              border: "1px solid var(--cb-e2ddd3, #E2DDD3)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-3a3530, #3A3530)",
              fontSize: "0.74rem",
              fontWeight: 600,
              cursor: enviando ? "not-allowed" : "pointer",
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* Área de conversación */}
      <div
        ref={scrollRef}
        style={{
          height: compacto ? "340px" : "440px",
          overflowY: "auto",
          padding: "16px",
          background: "var(--cf-f5f3ee, #F5F3EE)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {mensajes.length === 0 && (
          <div
            style={{
              margin: "auto",
              maxWidth: "460px",
              textAlign: "center",
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px dashed var(--cb-d6d0c4, #D6D0C4)",
              borderRadius: "12px",
              padding: "20px 18px",
              color: "var(--ct-57524c, #57524C)",
            }}
          >
            <Sparkles size={22} style={{ color: "var(--ct-2f4737, #2F4737)", marginBottom: "8px" }} />
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
              Sandbox listo para probar a Mía (ARIA)
            </div>
            <div style={{ fontSize: "0.79rem", color: "var(--ct-847d74, #847D74)", marginTop: "6px", lineHeight: 1.5 }}>
              Escribe cualquier pregunta abajo o elige una prueba rápida. La memoria de conversación se mantiene turno a turno hasta que pulses <strong>Reiniciar Chat</strong>.
            </div>
          </div>
        )}

        {mensajes.map((m) => {
          const esCliente = m.rol === "cliente";
          const esError = m.rol === "error";
          const segmentos =
            m.rol === "aria" ? extraerSegmentosMultimediaMensaje(m.texto) : [];

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: esCliente ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "82%",
                  padding: "11px 14px",
                  borderRadius: esCliente ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: esError ? "var(--cf-fef2f2, #FEF2F2)" : esCliente ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                  color: esError ? "var(--ct-991b1b, #991B1B)" : esCliente ? "#FFFFFF" : "var(--ct-1f1c19, #1F1C19)",
                  border: esError
                    ? "1px solid var(--cb-fecaca, #FECACA)"
                    : esCliente
                      ? "none"
                      : "1px solid var(--cb-e6e2da, #E6E2DA)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    fontSize: "0.71rem",
                    fontWeight: 700,
                    opacity: esCliente ? 0.85 : 1,
                    color: esError ? "var(--ct-991b1b, #991B1B)" : esCliente ? "#E6E2DA" : "var(--ct-2f4737, #2F4737)",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    {esCliente ? (
                      <User size={12} />
                    ) : esError ? (
                      <AlertTriangle size={12} />
                    ) : (
                      <Bot size={12} />
                    )}
                    {esCliente
                      ? `${nombreSimulado} (${canal})`
                      : esError
                        ? "Error al consultar ARIA"
                        : m.agenteNombre || "Mía · ARIA"}
                  </span>
                  {typeof m.latenciaMs === "number" && m.latenciaMs > 0 && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        color: "var(--ct-847d74, #847D74)",
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={11} />
                      {(m.latenciaMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>

                {m.rol === "aria" ? (
                  <div
                    style={{
                      fontSize: "0.86rem",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {segmentos.map((seg, idx) => {
                      if (seg.tipo === "imagen") {
                        return (
                          <a
                            key={idx}
                            href={seg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-block", maxWidth: "240px" }}
                          >
                            <img
                              src={seg.url}
                              alt={seg.alt || "Imagen sugerida por ARIA"}
                              style={{
                                width: "100%",
                                maxHeight: "240px",
                                objectFit: "cover",
                                borderRadius: "10px",
                                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                display: "block",
                              }}
                            />
                          </a>
                        );
                      }
                      if (seg.tipo === "documento") {
                        return (
                          <a
                            key={idx}
                            href={seg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "var(--ct-1b6b46, #1B6B46)",
                              textDecoration: "underline",
                              fontWeight: 600,
                            }}
                          >
                            📎 {seg.nombre}
                          </a>
                        );
                      }
                      if (seg.tipo === "audio") {
                        return (
                          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <audio controls src={seg.url} style={{ maxWidth: "240px" }} />
                            {seg.transcripcion && (
                              <span style={{ fontSize: "0.78rem", color: "var(--ct-57524c, #57524C)" }}>{seg.transcripcion}</span>
                            )}
                          </div>
                        );
                      }
                      return <span key={idx}>{seg.texto}</span>;
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "0.86rem",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.texto}
                  </div>
                )}

                {m.escaloHumano && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--ct-8a2e2e, #8A2E2E)",
                      background: "var(--cf-faf2f2, #FAF2F2)",
                      border: "1px solid var(--cb-e5caca, #E5CACA)",
                      borderRadius: "7px",
                      padding: "4px 8px",
                    }}
                  >
                    ⚠️ ARIA solicitó escalar esta conversación a una asesora humana.
                  </div>
                )}

                {m.contextosInyectados && m.contextosInyectados.length > 0 && (
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "2px" }}>
                    {m.contextosInyectados.map((ctx) => (
                      <span
                        key={ctx}
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 7px",
                          borderRadius: "999px",
                          background: "var(--cf-f4f2ee, #F4F2EE)",
                          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                          color: "var(--ct-57524c, #57524C)",
                        }}
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {enviando && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "14px",
                background: "var(--cf-ffffff, #FFFFFF)",
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                color: "var(--ct-57524c, #57524C)",
                fontSize: "0.82rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              <span>Mía (ARIA) está escribiendo respuesta simulada…</span>
            </div>
          </div>
        )}
      </div>

      {/* Compositor de prueba */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviarMensajeSimulado();
        }}
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--cb-e6e2da, #E6E2DA)",
          background: "var(--cf-ffffff, #FFFFFF)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
        }}
      >
        <textarea
          ref={inputRef}
          value={entradaTexto}
          onChange={(e) => setEntradaTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviarMensajeSimulado();
            }
          }}
          disabled={enviando}
          rows={2}
          placeholder="Escribe como si fueras un cliente (Enter envía, Shift+Enter salto de línea)…"
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: "10px",
            border: "1px solid var(--cb-d9d4cb, #D9D4CB)",
            fontSize: "0.86rem",
            color: "var(--ct-1f1c19, #1F1C19)",
            fontFamily: "inherit",
            resize: "none",
          }}
        />
        <button
          type="submit"
          className="btn-responsive-accion"
          disabled={enviando || !entradaTexto.trim()}
          title="Enviar mensaje de prueba a ARIA"
          aria-label="Enviar Prueba"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 16px",
            borderRadius: "10px",
            border: "none",
            background: "#2F4737",
            color: "#FFFFFF",
            fontSize: "0.84rem",
            fontWeight: 700,
            cursor: enviando || !entradaTexto.trim() ? "not-allowed" : "pointer",
            opacity: enviando || !entradaTexto.trim() ? 0.6 : 1,
            minHeight: "42px",
          }}
        >
          <Send size={15} />
          <span className="btn-texto-responsive">Enviar</span>
        </button>
      </form>
    </div>
  );
}
