/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";

import React, { useState, useEffect } from "react";
import {
  Shield, Flame, Clock, Download, XCircle, FileText, KeyRound, CheckCircle2, Layers
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
  const [indiceArchivoActivo, setIndiceArchivoActivo] = useState<number>(0);

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
          // Si NO requiere PIN y NO es de una sola vista, podemos cargar directamente
          if (!json.data.requiere_pin && !json.data.una_sola_vista) {
            ejecutarDescargaDocumento("");
          }
        } else {
          setErrorEstado(json.error || "El enlace no es válido o ha expirado.");
        }
      } catch {
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

  const ejecutarDescargaDocumento = async (pinAEnviar?: string) => {
    try {
      setValidandoPin(true);
      setErrorPin(null);

      const valorPin = pinAEnviar !== undefined ? pinAEnviar : pin;

      const res = await fetch(`/api/billetera/publico/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: valorPin.trim() || undefined })
      });
      const json = await res.json();

      if (json.ok) {
        setDocumentoDescargado(json.data);
        setIndiceArchivoActivo(0);
      } else {
        setErrorPin(json.error || "PIN incorrecto o enlace no válido");
      }
    } catch {
      setErrorPin("Error al obtener el documento");
    } finally {
      setValidandoPin(false);
    }
  };

  const archivosDescargados = documentoDescargado?.archivos || (documentoDescargado ? [{
    id: "p1",
    nombre: documentoDescargado.archivo_nombre || "documento.pdf",
    mimetype: documentoDescargado.archivo_mimetype || "application/pdf",
    tamano: documentoDescargado.archivo_tamano || 0,
    base64: documentoDescargado.archivo_base64,
    url: documentoDescargado.archivo_url
  }] : []);

  const archivoActivo = archivosDescargados[indiceArchivoActivo] || archivosDescargados[0] || null;

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
          maxWidth: "760px",
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", background: "#EEF2FF", color: "#4F46E5", padding: "4px 12px", borderRadius: "14px" }}>
                  DOCUMENTO COMPARTIDO • {infoEnlace.categoria}
                </span>
                {infoEnlace.archivos_conteo > 1 && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, background: "#F3E8FF", color: "#6B21A8", padding: "4px 10px", borderRadius: "14px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Layers size={12} /> {infoEnlace.archivos_conteo} partes / archivos
                  </span>
                )}
              </div>

              {tiempoRestanteSegundos !== null && tiempoRestanteSegundos > 0 && (
                <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#D97706", background: "#FFFBEB", padding: "4px 12px", borderRadius: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={14} /> Expira en: {formatearTiempo(tiempoRestanteSegundos)}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0F172A", margin: "0 0 6px 0" }}>
              {infoEnlace.titulo}
            </h1>

            {/* RESUMEN DE ARCHIVOS PREVIO AL DESBLOQUEO */}
            {!documentoDescargado && (
              <div style={{ marginBottom: "20px" }}>
                {infoEnlace.archivos_resumen && infoEnlace.archivos_resumen.length > 1 ? (
                  <div style={{ background: "#F8FAFC", padding: "12px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#475569", marginBottom: "6px" }}>
                      📁 Archivos adjuntos en este documento ({infoEnlace.archivos_resumen.length}):
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.82rem", color: "#64748B" }}>
                      {infoEnlace.archivos_resumen.map((a: any, i: number) => (
                        <li key={a.id || i} style={{ marginBottom: "2px" }}>
                          <strong>{a.nombre}</strong> {a.tamano > 0 ? `(${(a.tamano / 1024).toFixed(0)} KB)` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.86rem", color: "#64748B", margin: 0 }}>
                    Archivo: <strong>{infoEnlace.archivo_nombre}</strong>
                  </p>
                )}
              </div>
            )}

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
                    Este documento se revocará permanentemente una vez que lo abras o descargues. Asegúrate de guardar tus archivos de inmediato.
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
                      El emisor configuró un código PIN de seguridad para acceder a este archivo.
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        ejecutarDescargaDocumento();
                      }}
                      style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
                    >
                      <input
                        type="password"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Ingresa el PIN"
                        autoFocus
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
                        type="submit"
                        disabled={validandoPin || !pin.trim()}
                        style={{
                          background: "#4F46E5",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "10px",
                          padding: "10px 22px",
                          fontSize: "0.88rem",
                          fontWeight: 800,
                          cursor: validandoPin || !pin.trim() ? "not-allowed" : "pointer"
                        }}
                      >
                        {validandoPin ? "Verificando..." : "Desbloquear Documento"}
                      </button>
                    </form>

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
                      onClick={() => ejecutarDescargaDocumento()}
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
              /* DOCUMENTO DESBLOQUEADO (MULTI-ARCHIVO) */
              <div>
                {documentoDescargado.fue_destruido && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "10px 14px", color: "#991B1B", fontSize: "0.8rem", fontWeight: 700, marginBottom: "16px" }}>
                    🔥 Este enlace ya ha sido revocado ("Burn on Read"). Guarda tus archivos locales de inmediato.
                  </div>
                )}

                {/* SELECTOR DE PARTES / ARCHIVOS */}
                {archivosDescargados.length > 1 && (
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#475569", marginBottom: "8px" }}>
                      Selecciona la parte del documento a previsualizar:
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {archivosDescargados.map((a: any, idx: number) => {
                        const esActivo = idx === indiceArchivoActivo;
                        const esImg = (a.mimetype || "").includes("image") || ["png", "jpg", "jpeg", "webp"].some(ext => (a.nombre || "").toLowerCase().endsWith(ext));
                        return (
                          <button
                            key={a.id || idx}
                            type="button"
                            onClick={() => setIndiceArchivoActivo(idx)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "10px",
                              border: esActivo ? "2px solid #5000BA" : "1px solid #CBD5E1",
                              background: esActivo ? "#F3E8FF" : "#F8FAFC",
                              color: esActivo ? "#5000BA" : "#334155",
                              fontWeight: 800,
                              fontSize: "0.82rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              cursor: "pointer"
                            }}
                          >
                            <span>{esImg ? "🖼️" : "📄"}</span>
                            <span>Parte {idx + 1}: {a.nombre}</span>
                            {esActivo && <CheckCircle2 size={14} color="#5000BA" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PREVISUALIZADOR DEL ARCHIVO ACTIVO */}
                <div style={{ background: "#F1F5F9", borderRadius: "14px", overflow: "hidden", marginBottom: "20px", minHeight: "360px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E2E8F0" }}>
                  {archivoActivo?.base64 || archivoActivo?.url ? (
                    (archivoActivo.mimetype?.includes("image") || ["png", "jpg", "jpeg", "webp"].some(ext => (archivoActivo.nombre || "").toLowerCase().endsWith(ext))) ? (
                      <img
                        src={archivoActivo.base64 || archivoActivo.url}
                        alt={archivoActivo.nombre || "Documento"}
                        style={{ maxWidth: "100%", maxHeight: "500px", objectFit: "contain", padding: "12px" }}
                      />
                    ) : (
                      <iframe
                        src={archivoActivo.base64 || archivoActivo.url}
                        style={{ width: "100%", height: "500px", border: "none" }}
                        title={archivoActivo.nombre || "Documento PDF"}
                      />
                    )
                  ) : (
                    <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                      <FileText size={40} color="#94A3B8" style={{ margin: "0 auto 8px auto" }} />
                      <div style={{ fontWeight: 700 }}>{archivoActivo?.nombre || "Documento"}</div>
                      <div style={{ fontSize: "0.8rem", color: "#94A3B8" }}>Listo para descarga segura</div>
                    </div>
                  )}
                </div>

                {/* METADATOS TÉCNICOS Y DINÁMICOS */}
                <div style={{ background: "#F8FAFC", padding: "16px", borderRadius: "14px", fontSize: "0.82rem", marginBottom: "20px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontWeight: 800, color: "#1E293B", marginBottom: "10px", fontSize: "0.85rem" }}>
                    📋 Información del Documento:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                    {documentoDescargado.titular_nombre && (
                      <div><strong style={{ color: "#64748B" }}>Titular:</strong> <span style={{ fontWeight: 700, color: "#1E293B" }}>{documentoDescargado.titular_nombre}</span></div>
                    )}
                    {documentoDescargado.titular_identificacion && (
                      <div><strong style={{ color: "#64748B" }}>Identificación:</strong> <span style={{ fontWeight: 700, color: "#1E293B" }}>{documentoDescargado.titular_identificacion}</span></div>
                    )}
                    {documentoDescargado.entidad_emisora && (
                      <div><strong style={{ color: "#64748B" }}>Emisor:</strong> <span style={{ fontWeight: 700, color: "#1E293B" }}>{documentoDescargado.entidad_emisora}</span></div>
                    )}
                    {documentoDescargado.fecha_caducidad && (
                      <div><strong style={{ color: "#64748B" }}>Fecha Caducidad:</strong> <span style={{ fontWeight: 700, color: "#1E293B" }}>{new Date(documentoDescargado.fecha_caducidad).toLocaleDateString()}</span></div>
                    )}
                    {Array.isArray(documentoDescargado.metadatos_dinamicos) && documentoDescargado.metadatos_dinamicos.map((m: any, idx: number) => (
                      <div key={m.id || idx}>
                        <strong style={{ color: "#64748B" }}>{m.clave}:</strong> <span style={{ fontWeight: 700, color: "#1E293B" }}>{m.valor}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BOTONES DE DESCARGA (ACTUAL + TODAS LAS PARTES) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {archivoActivo?.base64 && (
                    <a
                      href={archivoActivo.base64}
                      download={archivoActivo.nombre || "documento.pdf"}
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
                      <Download size={18} /> Descargar Parte Actual ({archivoActivo.nombre})
                    </a>
                  )}

                  {/* DESCARGA INDIVIDUAL DE LAS DEMÁS PARTES */}
                  {archivosDescargados.length > 1 && (
                    <div style={{ background: "#F1F5F9", padding: "12px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#475569", marginBottom: "8px" }}>
                        Descargar partes individuales:
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {archivosDescargados.map((a: any, i: number) => a.base64 && (
                          <a
                            key={a.id || i}
                            href={a.base64}
                            download={a.nombre || `parte-${i + 1}.pdf`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              background: "#ffffff",
                              border: "1px solid #CBD5E1",
                              color: "#334155",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              textDecoration: "none"
                            }}
                          >
                            <Download size={14} /> Parte {i + 1}: {a.nombre}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
