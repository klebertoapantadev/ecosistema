"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  History,
  Music,
  Printer,
  QrCode,
  RotateCcw,
  Sliders,
  Type,
  User,
  X,
  Sparkles,
} from "lucide-react";
import type { OrdenTrabajoTaller } from "../operaciones-taller";
import { registrarImpresionTarjetaAction } from "../acciones-operaciones-taller";

export interface PropsModalImprimirTarjetaTaller {
  abierto: boolean;
  onCerrar: () => void;
  orden: OrdenTrabajoTaller | null;
  negocio: string;
  onActualizarOrden?: (ordenActualizada: Partial<OrdenTrabajoTaller> & { id: string }) => void;
}

type FormatoTarjeta = "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
type EstiloFuente = "cursiva" | "formal" | "serif";

export function ModalImprimirTarjetaTaller({
  abierto,
  onCerrar,
  orden,
  negocio,
  onActualizarOrden,
}: PropsModalImprimirTarjetaTaller) {
  if (!abierto || !orden) return null;

  const negNorm = negocio.trim().toLowerCase();
  const esMargaritas = negNorm.includes("margarita");
  const nombreMarca = esMargaritas ? "Margaritas Floristería" : "Tinkay Flores y Eventos";

  // Formato inicial derivado de la orden o detectado por el resumen
  const formatoInicial: FormatoTarjeta = useMemo(() => {
    if (orden.tarjetaTipo) return orden.tarjetaTipo;
    const txt = `${orden.productoResumen} ${orden.origenTipo}`.toLowerCase();
    if (txt.includes("condolen") || txt.includes("funebr") || txt.includes("exequial")) {
      return "CONDOLENCIAS_PLANA";
    }
    return "DIPTICO";
  }, [orden.tarjetaTipo, orden.productoResumen, orden.origenTipo]);

  const [formato, setFormato] = useState<FormatoTarjeta>(formatoInicial);
  const [fuente, setFuente] = useState<EstiloFuente>("cursiva");
  const [tamanoFuentePt, setTamanoFuentePt] = useState<number>(() => {
    const len = (orden.dedicatoria || "").length;
    if (len < 60) return 22;
    if (len < 140) return 17;
    if (len < 240) return 14;
    return 12;
  });

  // Calibración de medidas para Canon G3110 y cartulina
  // Por defecto: Díptico abierto suele ser ~10.5cm x 15cm (o 10x14cm). Condolencias plana suele ser 10x15cm o 10x10cm.
  const [anchoMm, setAnchoMm] = useState<number>(formato === "DIPTICO" ? 148 : 148);
  const [altoMm, setAltoMm] = useState<number>(formato === "DIPTICO" ? 105 : 105);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [incluirQr, setIncluirQr] = useState<boolean>(true);
  const [mostrarCalibrador, setMostrarCalibrador] = useState<boolean>(false);
  const [mostrarHistorial, setMostrarHistorial] = useState<boolean>(false);

  // QR en Base64
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [urlPublicaTarjeta, setUrlPublicaTarjeta] = useState<string>("");
  const [copiadoUrl, setCopiadoUrl] = useState<boolean>(false);
  const [imprimiendo, setImprimiendo] = useState<boolean>(false);
  const [conteoImpresiones, setConteoImpresiones] = useState<number>(
    orden.tarjetaMetadata?.impresiones || 0
  );
  const [ultimoImpresoPor, setUltimoImpresoPor] = useState<string | null>(
    orden.tarjetaMetadata?.ultimo_impreso_por || null
  );

  // Generar URL pública y QR
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = orden.tarjetaToken || orden.id.slice(0, 12);
    const host = window.location.host;
    const protocol = window.location.protocol;
    const url = `${protocol}//${host}/dedicatoria/${token}`;
    setUrlPublicaTarjeta(url);

    QRCode.toDataURL(url, {
      width: 140,
      margin: 1,
      color: {
        dark: "#1E293B",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl: string) => setQrDataUrl(dataUrl))
      .catch((err: unknown) => console.error("Error generando QR", err));
  }, [orden.tarjetaToken, orden.id]);

  // Metadatos de auditoría
  const meta = orden.tarjetaMetadata || {};
  const fueEditadaPorCliente = Boolean(meta.editado_por_cliente);
  const vistasCliente = meta.vistas_cliente || 0;
  const historial = meta.historial_cambios || [];

  const handleCopiarEnlace = () => {
    if (!urlPublicaTarjeta) return;
    navigator.clipboard.writeText(urlPublicaTarjeta);
    setCopiadoUrl(true);
    setTimeout(() => setCopiadoUrl(false), 2200);
  };

  const handleLanzarImpresion = async () => {
    setImprimiendo(true);
    try {
      // 1. Registrar auditoría en base de datos
      const res = await registrarImpresionTarjetaAction({
        ordenId: orden.id,
        tipo: formato,
      });

      if (res.ok && typeof res.impresiones === "number") {
        setConteoImpresiones(res.impresiones);
        if (res.ultimoImpresoPor) setUltimoImpresoPor(res.ultimoImpresoPor);
        if (onActualizarOrden) {
          onActualizarOrden({
            id: orden.id,
            tarjetaTipo: formato,
            tarjetaMetadata: {
              ...meta,
              impresiones: res.impresiones,
              ultimo_impreso_por: res.ultimoImpresoPor,
              ultima_impresion_en: new Date().toISOString(),
            },
          });
        }
      }

      // 2. Disparar impresión nativa del navegador
      window.print();
    } catch (err) {
      console.error("Error al procesar impresión", err);
      window.print();
    } finally {
      setImprimiendo(false);
    }
  };

  // Familia de fuentes CSS
  const fontStyleCss = useMemo(() => {
    if (fuente === "cursiva") {
      return "'Dancing Script', 'Brush Script MT', 'Great Vibes', 'Allura', cursive";
    }
    if (fuente === "serif") {
      return "'Playfair Display', Georgia, 'Times New Roman', serif";
    }
    return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }, [fuente]);

  return (
    <>
      {/* Estilos CSS @media print inyectados exclusivamente para la impresión */}
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

      {/* ÁREA OCULTA QUE SE IMPRIME CON EXACTITUD MILIMÉTRICA EN LA CANON G3110 */}
      <div className="area-impresion-tarjeta">
        {formato === "DIPTICO" ? (
          // DÍPTICO: la cartulina entra abierta. La mitad izquierda queda vacía (portada externa o reverso),
          // y la mitad derecha recibe el mensaje con el QR para que al doblarse quede 100% oculto hacia adentro.
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              boxSizing: "border-box",
            }}
          >
            {/* Cara izquierda: se deja en blanco para que no manche la portada externa de Tinkay */}
            <div style={{ width: "100%", height: "100%" }} />

            {/* Cara derecha (interior): mensaje y QR */}
            <div
              style={{
                width: "100%",
                height: "100%",
                padding: "8mm 9mm 6mm 7mm",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                boxSizing: "border-box",
                textAlign: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontFamily: fontStyleCss,
                  fontSize: `${tamanoFuentePt}pt`,
                  lineHeight: 1.35,
                  color: "#18181B",
                  whiteSpace: "pre-wrap",
                  maxWidth: "96%",
                  wordBreak: "break-word",
                }}
              >
                {orden.dedicatoria || "Con todo mi cariño"}
              </div>

              {incluirQr && qrDataUrl && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "4mm",
                    right: "5mm",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(255,255,255,0.9)",
                    padding: "2px 4px",
                    borderRadius: "4px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "6pt",
                      color: "#64748B",
                      textAlign: "right",
                      lineHeight: 1.1,
                      maxWidth: "50px",
                    }}
                  >
                    Escanea y escucha 🎵
                  </span>
                  <img
                    src={qrDataUrl}
                    alt="QR Tarjeta Digital"
                    style={{ width: "18mm", height: "18mm", objectFit: "contain" }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          // CONDOLENCIAS PLANA: Tarjeta simple horizontal.
          // Respeta el arte floral preimpreso en la esquina superior derecha.
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "9mm 12mm 7mm 10mm",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              boxSizing: "border-box",
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* Margen de seguridad: espacio superior derecho reservado para la ilustración preimpresa */}
            <div
              style={{
                fontFamily: fontStyleCss,
                fontSize: `${tamanoFuentePt}pt`,
                lineHeight: 1.35,
                color: "#18181B",
                whiteSpace: "pre-wrap",
                maxWidth: "88%",
                wordBreak: "break-word",
                marginTop: "2mm",
              }}
            >
              {orden.dedicatoria || "Expresamos nuestras más sentidas condolencias."}
            </div>

            {incluirQr && qrDataUrl && (
              <div
                style={{
                  position: "absolute",
                  bottom: "4mm",
                  right: "6mm",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "6pt",
                    color: "#64748B",
                    textAlign: "right",
                    lineHeight: 1.1,
                    maxWidth: "55px",
                  }}
                >
                  Mensaje y melodía 🎵
                </span>
                <img
                  src={qrDataUrl}
                  alt="QR Tarjeta Digital"
                  style={{ width: "17mm", height: "17mm", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* DIÁLOGO / MODAL INTERACTIVO DE PANTALLA */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        onClick={onCerrar}
      >
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "880px",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ENCABEZADO */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>🖨️</span>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Impresión de Tarjeta Dedicatoria — {orden.codigo}
                </h2>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748B" }}>
                Para: <strong>{orden.destinatarioFallecido || "Destinatario"}</strong> • Pedido por:{" "}
                {orden.clienteSolicita}
              </p>
            </div>
            <button
              onClick={onCerrar}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#64748B",
                padding: "6px",
                borderRadius: "8px",
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* CUERPO DEL MODAL (2 COLUMNAS: VISTA PREVIA Y CONTROLES) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "20px",
              padding: "20px",
              overflowY: "auto",
            }}
          >
            {/* COLUMNA 1: VISTA PREVIA VISUAL DE LA CARTULINA */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                  Vista previa de la cartulina en bandeja
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#0369A1",
                    background: "#E0F2FE",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                >
                  {formato === "DIPTICO" ? "Díptico Plegable" : "Condolencias Plana"}
                </span>
              </div>

              {/* SIMULADOR DE CARTULINA FÍSICA */}
              <div
                style={{
                  aspectRatio: "1.41 / 1",
                  backgroundColor: "#FFFDF9",
                  border: "2px dashed #CBD5E1",
                  borderRadius: "10px",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.06)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                {formato === "DIPTICO" ? (
                  <>
                    {/* Mitad izquierda: exterior Tinkay */}
                    <div
                      style={{
                        flex: 1,
                        borderRight: "1px dashed #E2E8F0",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                        background: "#FAF7F2",
                        opacity: 0.7,
                      }}
                    >
                      <span style={{ fontSize: "0.7rem", color: "#94A3B8", marginBottom: "4px" }}>
                        (Cara exterior preimpresa)
                      </span>
                      <strong style={{ fontSize: "0.85rem", color: "#64748B", letterSpacing: "1px" }}>
                        {nombreMarca}
                      </strong>
                      <span style={{ fontSize: "0.65rem", color: "#94A3B8", marginTop: "4px" }}>
                        Queda en blanco al imprimir
                      </span>
                    </div>

                    {/* Mitad derecha: texto impreso oculto */}
                    <div
                      style={{
                        flex: 1,
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: fontStyleCss,
                          fontSize: `${tamanoFuentePt * 0.9}pt`,
                          lineHeight: 1.35,
                          color: "#1E293B",
                          wordBreak: "break-word",
                          maxHeight: "85%",
                          overflowY: "hidden",
                        }}
                      >
                        {orden.dedicatoria || "Sin dedicatoria ingresada"}
                      </div>

                      {incluirQr && qrDataUrl && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "rgba(255,255,255,0.95)",
                            padding: "2px 4px",
                            borderRadius: "4px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                          }}
                        >
                          <span style={{ fontSize: "0.55rem", color: "#64748B", textAlign: "right", lineHeight: 1 }}>
                            Escanea 🎵
                          </span>
                          <img src={qrDataUrl} alt="QR" style={{ width: "36px", height: "36px" }} />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // CONDOLENCIAS PLANA
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    {/* Simulación del arte floral en esquina */}
                    <div
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "12px",
                        fontSize: "0.7rem",
                        color: "#94A3B8",
                        background: "#F1F5F9",
                        padding: "3px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      🌿 [Arte Floral Preimpreso]
                    </div>

                    <div
                      style={{
                        fontFamily: fontStyleCss,
                        fontSize: `${tamanoFuentePt * 0.9}pt`,
                        lineHeight: 1.35,
                        color: "#1E293B",
                        wordBreak: "break-word",
                        maxWidth: "88%",
                      }}
                    >
                      {orden.dedicatoria || "Expresamos nuestras más sentidas condolencias."}
                    </div>

                    {incluirQr && qrDataUrl && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "rgba(255,255,255,0.95)",
                          padding: "2px 4px",
                          borderRadius: "4px",
                        }}
                      >
                        <span style={{ fontSize: "0.55rem", color: "#64748B", textAlign: "right", lineHeight: 1 }}>
                          Melodía 🎵
                        </span>
                        <img src={qrDataUrl} alt="QR" style={{ width: "34px", height: "34px" }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BARRA DE TRAZABILIDAD Y ESTADO */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "0.78rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#475569", fontWeight: 600 }}>Trazabilidad de la tarjeta:</span>
                  <button
                    onClick={() => setMostrarHistorial(!mostrarHistorial)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#0284C7",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <History size={13} /> {mostrarHistorial ? "Ocultar historial" : "Ver cambios"}
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <span
                    style={{
                      background: fueEditadaPorCliente ? "#DCFCE7" : "#F1F5F9",
                      color: fueEditadaPorCliente ? "#166534" : "#475569",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 500,
                    }}
                  >
                    {fueEditadaPorCliente ? "✏️ Editada por el cliente" : "🤖 Generada automáticamente"}
                  </span>

                  <span
                    style={{
                      background: vistasCliente > 0 ? "#E0F2FE" : "#F1F5F9",
                      color: vistasCliente > 0 ? "#0369A1" : "#475569",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 500,
                    }}
                  >
                    👀 {vistasCliente > 0 ? `Vista ${vistasCliente} veces` : "No vista por cliente aún"}
                  </span>

                  <span
                    style={{
                      background: conteoImpresiones > 0 ? "#FEF3C7" : "#F1F5F9",
                      color: conteoImpresiones > 0 ? "#92400E" : "#475569",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 500,
                    }}
                  >
                    🖨️ {conteoImpresiones > 0 ? `Impresa ${conteoImpresiones}x (${ultimoImpresoPor || "Taller"})` : "No impresa aún"}
                  </span>
                </div>

                {mostrarHistorial && (
                  <div
                    style={{
                      marginTop: "6px",
                      paddingTop: "6px",
                      borderTop: "1px dashed #CBD5E1",
                      maxHeight: "90px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {historial.length === 0 ? (
                      <span style={{ color: "#94A3B8" }}>No hay registros de edición previa.</span>
                    ) : (
                      historial.map((h, i) => (
                        <div key={i} style={{ fontSize: "0.72rem", color: "#334155" }}>
                          • <strong>{h.autor || "Usuario"}</strong> ({h.rol || "STAFF"}):{" "}
                          <span style={{ color: "#64748B" }}>
                            {h.fecha ? new Date(h.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA 2: CONTROLES DE CONFIGURACIÓN Y CALCE */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* SELECTOR DE FORMATO */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                  1. Formato de Cartulina
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setFormato("DIPTICO");
                      setAnchoMm(148);
                      setAltoMm(105);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: formato === "DIPTICO" ? "2px solid #0284C7" : "1px solid #CBD5E1",
                      background: formato === "DIPTICO" ? "#F0F9FF" : "#FFFFFF",
                      color: formato === "DIPTICO" ? "#0369A1" : "#475569",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    📖 Díptico Tinkay
                    <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 400, color: "#64748B" }}>
                      Se dobla a la mitad
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setFormato("CONDOLENCIAS_PLANA");
                      setAnchoMm(148);
                      setAltoMm(105);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: formato === "CONDOLENCIAS_PLANA" ? "2px solid #0284C7" : "1px solid #CBD5E1",
                      background: formato === "CONDOLENCIAS_PLANA" ? "#F0F9FF" : "#FFFFFF",
                      color: formato === "CONDOLENCIAS_PLANA" ? "#0369A1" : "#475569",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    🕊️ Condolencias
                    <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 400, color: "#64748B" }}>
                      Plana horizontal
                    </span>
                  </button>
                </div>
              </div>

              {/* SELECTOR DE FUENTE Y TAMAÑO */}
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                  2. Tipografía y Tamaño
                </label>
                <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                  {[
                    { id: "cursiva", label: "Cursiva Fina" },
                    { id: "serif", label: "Serif Elegante" },
                    { id: "formal", label: "Sans Formal" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFuente(f.id as EstiloFuente)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: fuente === f.id ? "2px solid #0284C7" : "1px solid #CBD5E1",
                        background: fuente === f.id ? "#F0F9FF" : "#FFFFFF",
                        color: fuente === f.id ? "#0369A1" : "#475569",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Tamaño:</span>
                  <input
                    type="range"
                    min="10"
                    max="32"
                    value={tamanoFuentePt}
                    onChange={(e) => setTamanoFuentePt(Number(e.target.value))}
                    style={{ flex: 1, cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1E293B", minWidth: "36px" }}>
                    {tamanoFuentePt}pt
                  </span>
                </div>
              </div>

              {/* OPCIÓN QR Y MÚSICA DIGITAL */}
              <div
                style={{
                  background: "#F8FAFC",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={incluirQr}
                      onChange={(e) => setIncluirQr(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    Imprimir Código QR de Experiencia Digital
                  </label>
                  <span style={{ fontSize: "0.7rem", color: "#0284C7" }}>🎵 Música + Letra</span>
                </div>

                {urlPublicaTarjeta && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="text"
                      readOnly
                      value={urlPublicaTarjeta}
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        fontSize: "0.72rem",
                        color: "#475569",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                      }}
                    />
                    <button
                      onClick={handleCopiarEnlace}
                      title="Copiar enlace para WhatsApp del cliente"
                      style={{
                        padding: "5px 10px",
                        background: copiadoUrl ? "#22C55E" : "#E2E8F0",
                        color: copiadoUrl ? "#FFFFFF" : "#334155",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {copiadoUrl ? <Check size={12} /> : <Copy size={12} />}
                      {copiadoUrl ? "Copiado" : "Copiar"}
                    </button>
                    <a
                      href={urlPublicaTarjeta}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Probar en pestaña nueva"
                      style={{
                        padding: "5px 8px",
                        background: "#E2E8F0",
                        color: "#334155",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* CALIBRADOR DE MEDIDAS MILIMÉTRICAS (CANON G3110) */}
              <div>
                <button
                  onClick={() => setMostrarCalibrador(!mostrarCalibrador)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#0369A1",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                >
                  <Sliders size={13} /> {mostrarCalibrador ? "Ocultar calibración de medidas" : "Calibrar medidas mm (Canon G3110)"}
                </button>

                {mostrarCalibrador && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "10px",
                      background: "#F1F5F9",
                      borderRadius: "8px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", color: "#475569", marginBottom: "2px" }}>Ancho (mm):</label>
                      <input
                        type="number"
                        value={anchoMm}
                        onChange={(e) => setAnchoMm(Number(e.target.value))}
                        style={{ width: "100%", padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", color: "#475569", marginBottom: "2px" }}>Alto (mm):</label>
                      <input
                        type="number"
                        value={altoMm}
                        onChange={(e) => setAltoMm(Number(e.target.value))}
                        style={{ width: "100%", padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", color: "#475569", marginBottom: "2px" }}>Desplazamiento X (mm):</label>
                      <input
                        type="number"
                        value={offsetX}
                        onChange={(e) => setOffsetX(Number(e.target.value))}
                        style={{ width: "100%", padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", color: "#475569", marginBottom: "2px" }}>Desplazamiento Y (mm):</label>
                      <input
                        type="number"
                        value={offsetY}
                        onChange={(e) => setOffsetY(Number(e.target.value))}
                        style={{ width: "100%", padding: "4px 6px", borderRadius: "4px", border: "1px solid #CBD5E1" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PIE DEL MODAL CON BOTÓN DE IMPRESIÓN DIRECTA */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#F8FAFC",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              💡 Al imprimir en la <strong>Canon G3110</strong>, selecciona tamaño de papel personalizado o A6 en el diálogo.
            </span>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={onCerrar}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>

              <button
                onClick={handleLanzarImpresion}
                disabled={imprimiendo}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0284C7",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(2, 132, 199, 0.3)",
                }}
              >
                <Printer size={16} />
                {conteoImpresiones > 0 ? "Reimprimir Tarjeta" : "Imprimir Tarjeta"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
