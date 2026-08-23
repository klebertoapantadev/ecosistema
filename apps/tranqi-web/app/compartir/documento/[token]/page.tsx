/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from "react";
import {
  Shield, Flame, Clock, Download, XCircle, FileText, KeyRound
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PaginaDocumentoCompartidoTTL() {
  const params = useParams();
  const token = params?.token as string;

  const [cargando, setCargando] = useState<boolean>(true);
  const [infoEnlace, setInfoEnlace] = useState<any | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [pin, setPin] = useState<string>("");
  const [errorPin, setErrorPin] = useState<string | null>(null);
  const [validandoPin, setValidandoPin] = useState<boolean>(false);
  const [documentoDescargado, setDocumentoDescargado] = useState<any | null>(null);
  const [tiempoRestanteSegundos, setTiempoRestanteSegundos] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;

    const cargarInfo = async () => {
      try {
        setCargando(true);
        const res = await fetch(`/api/billetera/publico/${token}`);
        const json = await res.json();

        if (json.ok) {
          setInfoEnlace(json.data);
          setTiempoRestanteSegundos(Math.floor(json.data.tiempo_restante_ms / 1000));
          // Si no requiere PIN y no es de una sola vista, podemos cargar directamente
          if (!json.data.requiere_pin && !json.data.una_sola_vista) {
            obtenerContenidoDocumento();
          }
        } else {
          setErrorEstado(json.error || "El enlace no es válido o ha expirado.");
        }
      } catch (e: any) {
        setErrorEstado("Error de conexión al verificar el documento.");
      } finally {
        setCargando(false);
      }
    };

    cargarInfo();
  }, [token]);

  // Contador regresivo
  useEffect(() => {
    if (tiempoRestanteSegundos === null || tiempoRestanteSegundos <= 0) return;

    const interval = setInterval(() => {
      setTiempoRestanteSegundos((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setErrorEstado("El tiempo de vigencia de este enlace ha expirado.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tiempoRestanteSegundos]);

  const formatearTiempo = (segundos: number) => {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`;
  };

  const obtenerContenidoDocumento = async () => {
    try {
      setValidandoPin(true);
      setErrorPin(null);

      const res = await fetch(`/api/billetera/publico/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() || undefined })
      });
      const json = await res.json();

      if (json.ok) {
        setDocumentoDescargado(json.data);
      } else {
        setErrorPin(json.error || "PIN incorrecto o enlace no válido");
      }
    } catch (e: any) {
      setErrorPin("Error al obtener el documento");
    } finally {
      setValidandoPin(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
    >
      {/* BRANDING CABECERA */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#ffffff",
            padding: "8px 16px",
            borderRadius: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            marginBottom: "8px"
          }}
        >
          <Shield size={18} color="#5000BA" />
          <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
            tranqi • Bóveda Segura de Documentos
          </span>
        </div>
      </div>

      {/* TARJETA PRINCIPAL */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "24px",
          width: "100%",
          maxWidth: "680px",
          padding: "32px",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.08)",
          border: "1px solid #E2E8F0"
        }}
      >
        {cargando ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#5000BA", marginBottom: "8px" }}>
              Verificando Enlace Seguro...
            </div>
            <p style={{ fontSize: "0.85rem", color: "#64748B", margin: 0 }}>
              Comprobando vigencia criptográfica y permisos de acceso.
            </p>
          </div>
        ) : errorEstado ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <div style={{ background: "#FEF2F2", width: "56px", height: "56px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <XCircle size={32} color="#DC2626" />
            </div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#1E293B", margin: "0 0 8px 0" }}>
              Enlace no Disponible
            </h2>
            <p style={{ fontSize: "0.88rem", color: "#64748B", margin: "0 0 24px 0", lineHeight: 1.5 }}>
              {errorEstado}
            </p>
            <Link
              href="/"
              style={{
                background: "#5000BA",
                color: "#ffffff",
                padding: "10px 20px",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none"
              }}
            >
              Ir a Tranqi
            </Link>
          </div>
        ) : (
          <div>
            {/* BADGES SUPERIORES */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", background: "#EEF2FF", color: "#4F46E5", padding: "4px 12px", borderRadius: "14px" }}>
                DOCUMENTO COMPARTIDO • {infoEnlace.categoria}
              </span>

              {tiempoRestanteSegundos !== null && tiempoRestanteSegundos > 0 && (
                <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "4px 12px", borderRadius: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={14} /> Expira en: {formatearTiempo(tiempoRestanteSegundos)}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0F172A", margin: "0 0 6px 0" }}>
              {infoEnlace.titulo}
            </h1>
            <p style={{ fontSize: "0.86rem", color: "#64748B", margin: "0 0 20px 0" }}>
              Archivo: <strong>{infoEnlace.archivo_nombre}</strong>
            </p>

            {/* ADVERTENCIA ONE-TIME VIEW */}
            {infoEnlace.una_sola_vista && !documentoDescargado && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "14px",
                  padding: "14px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px"
                }}
              >
                <Flame size={20} color="#DC2626" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#991B1B" }}>
                    Enlace de Una Sola Vista ("Burn on Read")
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#7F1D1D" }}>
                    Este documento se revocará permanentemente una vez que lo abras o descargues. Asegúrate de guardar tu copia local de inmediato.
                  </div>
                </div>
              </div>
            )}

            {/* FORMULARIO DE PIN O BOTÓN DE DESCARGA */}
            {!documentoDescargado ? (
              <div style={{ background: "#F8FAFC", borderRadius: "16px", padding: "20px", border: "1px solid #E2E8F0" }}>
                {infoEnlace.requiere_pin ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <KeyRound size={18} color="#4F46E5" />
                      <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#1E293B", margin: 0 }}>
                        Documento Protegido por PIN
                      </h3>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#64748B", margin: "0 0 14px 0" }}>
                      El emisor configuró una clave PIN de seguridad para acceder a este archivo.
                    </p>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <input
                        type="password"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Ingresa el PIN"
                        style={{
                          flex: "1 1 180px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.9rem",
                          letterSpacing: "3px"
                        }}
                      />
                      <button
                        type="button"
                        onClick={obtenerContenidoDocumento}
                        disabled={validandoPin || !pin.trim()}
                        style={{
                          background: "#4F46E5",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "10px",
                          padding: "10px 22px",
                          fontSize: "0.88rem",
                          fontWeight: 800,
                          cursor: "pointer"
                        }}
                      >
                        {validandoPin ? "Verificando..." : "Desbloquear Documento"}
                      </button>
                    </div>

                    {errorPin && (
                      <div style={{ color: "#DC2626", fontSize: "0.8rem", fontWeight: 700, marginTop: "8px" }}>
                        ⚠️ {errorPin}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "14px" }}>
                      Presiona el botón para abrir y descargar tu copia segura.
                    </p>
                    <button
                      type="button"
                      onClick={obtenerContenidoDocumento}
                      disabled={validandoPin}
                      style={{
                        background: "#5000BA",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "12px",
                        padding: "12px 28px",
                        fontSize: "0.92rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 6px 16px rgba(80, 0, 186, 0.25)"
                      }}
                    >
                      {validandoPin ? "Cargando..." : "Acceder al Documento"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* DOCUMENTO DESBLOQUEADO */
              <div>
                {documentoDescargado.fue_destruido && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "10px 14px", color: "#991B1B", fontSize: "0.8rem", fontWeight: 700, marginBottom: "16px" }}>
                    🔥 Este enlace ya ha sido revocado ("Burn on Read"). Guarda tu archivo ahora.
                  </div>
                )}

                {/* PREVISUALIZADOR */}
                <div style={{ background: "#F1F5F9", borderRadius: "14px", overflow: "hidden", marginBottom: "20px", minHeight: "320px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {documentoDescargado.archivo_base64 ? (
                    documentoDescargado.archivo_mimetype?.includes("image") ? (
                      <img
                        src={documentoDescargado.archivo_base64}
                        alt={documentoDescargado.titulo}
                        style={{ maxWidth: "100%", maxHeight: "450px", objectFit: "contain" }}
                      />
                    ) : (
                      <iframe
                        src={documentoDescargado.archivo_base64}
                        style={{ width: "100%", height: "450px", border: "none" }}
                        title={documentoDescargado.titulo}
                      />
                    )
                  ) : (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                      <FileText size={40} color="#94A3B8" style={{ margin: "0 auto 8px auto" }} />
                      <div>Documento listo para descarga</div>
                    </div>
                  )}
                </div>

                {/* METADATOS TÉCNICOS */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "#F8FAFC", padding: "14px", borderRadius: "12px", fontSize: "0.82rem", marginBottom: "20px" }}>
                  {documentoDescargado.titular_nombre && (
                    <div><strong>Titular:</strong> {documentoDescargado.titular_nombre}</div>
                  )}
                  {documentoDescargado.titular_identificacion && (
                    <div><strong>Identificación:</strong> {documentoDescargado.titular_identificacion}</div>
                  )}
                  {documentoDescargado.entidad_emisora && (
                    <div><strong>Entidad Emisora:</strong> {documentoDescargado.entidad_emisora}</div>
                  )}
                  {documentoDescargado.fecha_caducidad && (
                    <div><strong>Fecha Caducidad:</strong> {new Date(documentoDescargado.fecha_caducidad).toLocaleDateString()}</div>
                  )}
                </div>

                {/* BOTÓN DESCARGA */}
                {documentoDescargado.archivo_base64 && (
                  <a
                    href={documentoDescargado.archivo_base64}
                    download={documentoDescargado.archivo_nombre || "documento.pdf"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: "#05876E",
                      color: "#ffffff",
                      borderRadius: "12px",
                      padding: "14px",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      textDecoration: "none",
                      boxShadow: "0 6px 16px rgba(5, 135, 110, 0.25)"
                    }}
                  >
                    <Download size={18} /> Descargar Archivo ({documentoDescargado.archivo_nombre})
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: "20px", fontSize: "0.75rem", color: "#94A3B8" }}>
        Custodiado bajo el protocolo Zero-Custody de Tranqi • LOPDP &amp; Ley de Comercio Electrónico
      </div>
    </div>
  );
}
