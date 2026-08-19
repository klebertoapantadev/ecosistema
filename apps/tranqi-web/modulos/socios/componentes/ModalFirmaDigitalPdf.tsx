"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileCheck,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Building,
  Calendar,
  UserCheck,
} from "lucide-react";
import {
  parsearCertificadoP12,
  estamparFirmaDigitalEnPdf,
  type InfoCertificado,
} from "../servicios/servicioFirmaDigital";

interface ModalFirmaDigitalPdfProps {
  abierto: boolean;
  onCerrar: () => void;
  urlPdfOriginal: string;
  solicitudId: string;
  rolFirmante: "ABOGADO_POSTULANTE" | "TRANQI_PLATAFORMA";
  nombreSujetoEsperado?: string;
  onFirmaCompletada: (pdfBytes: Uint8Array, nombreArchivo: string, info: InfoCertificado) => Promise<void> | void;
}

export function ModalFirmaDigitalPdf({
  abierto,
  onCerrar,
  urlPdfOriginal,
  solicitudId,
  rolFirmante,
  nombreSujetoEsperado,
  onFirmaCompletada,
}: ModalFirmaDigitalPdfProps) {
  const [archivoP12, setArchivoP12] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [procesandoP12, setProcesandoP12] = useState(false);
  const [infoCert, setInfoCert] = useState<InfoCertificado | null>(null);
  const [errorCert, setErrorCert] = useState<string | null>(null);

  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [pdfBytesOriginal, setPdfBytesOriginal] = useState<ArrayBuffer | null>(null);
  const [urlPrevisualizacion, setUrlPrevisualizacion] = useState<string | null>(null);

  const [firmando, setFirmando] = useState(false);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);
  const [firmaExitosa, setFirmaExitosa] = useState(false);

  const esTranqi = rolFirmante === "TRANQI_PLATAFORMA";

  // Cargar PDF original en ArrayBuffer y crear preview
  useEffect(() => {
    if (!abierto || !urlPdfOriginal) return;

    let cancelado = false;
    async function cargarPdf() {
      try {
        setCargandoPdf(true);
        setErrorFirma(null);
        const res = await fetch(urlPdfOriginal);
        if (!res.ok) throw new Error(`No se pudo cargar el PDF del contrato (${res.status})`);
        const buffer = await res.arrayBuffer();
        if (cancelado) return;
        setPdfBytesOriginal(buffer);

        const blob = new Blob([buffer], { type: "application/pdf" });
        const urlBlob = URL.createObjectURL(blob);
        setUrlPrevisualizacion(urlBlob);
      } catch (err: unknown) {
        if (!cancelado) {
          setErrorFirma(err instanceof Error ? err.message : "Error al descargar el contrato");
        }
      } finally {
        if (!cancelado) setCargandoPdf(false);
      }
    }

    cargarPdf();

    return () => {
      cancelado = true;
      if (urlPrevisualizacion) {
        URL.revokeObjectURL(urlPrevisualizacion);
      }
    };
  }, [abierto, urlPdfOriginal]);

  // Validar P12 cuando el usuario carga el archivo e ingresa su contraseña
  async function handleValidarP12(e: React.FormEvent) {
    e.preventDefault();
    if (!archivoP12) {
      setErrorCert("Por favor selecciona tu archivo de firma electrónica (.p12 o .pfx).");
      return;
    }
    if (!password) {
      setErrorCert("Ingresa la contraseña de tu firma electrónica.");
      return;
    }

    try {
      setProcesandoP12(true);
      setErrorCert(null);
      const buffer = await archivoP12.arrayBuffer();
      const res = parsearCertificadoP12(buffer, password);

      if (!res.ok) {
        setErrorCert(res.error);
        setInfoCert(null);
        return;
      }

      setInfoCert(res.info);
    } catch (err: unknown) {
      setErrorCert(err instanceof Error ? err.message : "Error al procesar el archivo");
      setInfoCert(null);
    } finally {
      setProcesandoP12(false);
    }
  }

  // Ejecutar firma y estampar en el PDF
  async function handleEjecutarFirma() {
    if (!pdfBytesOriginal || !infoCert) return;

    try {
      setFirmando(true);
      setErrorFirma(null);

      const resEstampa = await estamparFirmaDigitalEnPdf({
        pdfBytes: pdfBytesOriginal,
        infoCertificado: infoCert,
        rolFirmante,
        razonFirma: esTranqi
          ? "Aprobación y Formalización Institucional de Socio Abogado"
          : "Suscripción y Aceptación de Contrato de Sociedad de Abogados",
      });

      if (!resEstampa.ok) {
        throw new Error(resEstampa.error);
      }

      setFirmaExitosa(true);

      // Callback final
      await onFirmaCompletada(resEstampa.pdfFirmado, resEstampa.nombreArchivo, infoCert);

      // Limpiar memoria
      setPassword("");
      setArchivoP12(null);
    } catch (err: unknown) {
      setErrorFirma(err instanceof Error ? err.message : "Error al estampar la firma electrónica");
    } finally {
      setFirmando(false);
    }
  }

  if (!abierto) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "1050px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Encabezado Modal */}
        <div
          style={{
            padding: "18px 24px",
            background: esTranqi
              ? "linear-gradient(135deg, #3B0086 0%, #5000BA 100%)"
              : "linear-gradient(135deg, #047857 0%, #05876E 100%)",
            color: "#FFFFFF",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                padding: "8px",
                borderRadius: "10px",
                display: "flex",
              }}
            >
              <FileCheck size={22} color="#FFF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
                {esTranqi
                  ? "Contra-Firma Digital Institucional · tranqi"
                  : "Firma Electrónica Digital del Contrato de Sociedad"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                Estándar PAdES / Zero-Custody · Ley de Comercio Electrónico del Ecuador
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: "34px",
              height: "34px",
              color: "#FFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Alerta de Criptografía Zero-Custody */}
        <div
          style={{
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.8rem",
            color: "#475569",
          }}
        >
          <ShieldCheck size={16} color="#059669" />
          <span>
            <strong>Privacidad y Seguridad Zero-Custody:</strong> Tu certificado <code>.p12</code> y su contraseña son
            procesados en la memoria volátil de este navegador. <strong>Nunca se envían ni almacenan en ningún servidor</strong>.
          </span>
        </div>

        {/* Cuerpo Modal en 2 Columnas: Formulario de Firma y Visor de PDF */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 400px) 1fr",
            flexGrow: 1,
            overflow: "hidden",
            minHeight: "480px",
          }}
        >
          {/* Columna Izquierda: Carga de Certificado y Validación */}
          <div
            style={{
              padding: "20px",
              borderRight: "1px solid #E2E8F0",
              overflowY: "auto",
              background: "#FAFAFA",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {!infoCert ? (
              <form onSubmit={handleValidarP12} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#1E293B",
                      marginBottom: "6px",
                    }}
                  >
                    1. Archivo de Firma Electrónica (.p12 / .pfx)
                  </label>
                  <input
                    type="file"
                    accept=".p12,.pfx"
                    onChange={(e) => {
                      setArchivoP12(e.target.files?.[0] || null);
                      setErrorCert(null);
                    }}
                    style={{
                      width: "100%",
                      fontSize: "0.82rem",
                      padding: "8px",
                      background: "#FFFFFF",
                      border: "1px dashed #94A3B8",
                      borderRadius: "8px",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  />
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.74rem", color: "#64748B" }}>
                    Compatible con Security Data, Banco Central, Consejo de la Judicatura, ANFAC, Uanataca, etc.
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#1E293B",
                      marginBottom: "6px",
                    }}
                  >
                    2. Contraseña del Certificado
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digita la clave de tu archivo .p12"
                      style={{
                        width: "100%",
                        padding: "10px 38px 10px 12px",
                        fontSize: "0.88rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        background: "#FFFFFF",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748B",
                        cursor: "pointer",
                      }}
                    >
                      {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {errorCert && (
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      color: "#991B1B",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                    }}
                  >
                    <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span>{errorCert}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={procesandoP12 || !archivoP12 || !password}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    background: esTranqi ? "#5000BA" : "#05876E",
                    color: "#FFFFFF",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: procesandoP12 || !archivoP12 || !password ? "not-allowed" : "pointer",
                    opacity: procesandoP12 || !archivoP12 || !password ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  }}
                >
                  {procesandoP12 ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Verificando certificado...
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} /> Validar Firma Electrónica
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Tarjeta de Certificado Validado */
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    background: "#ECFDF5",
                    border: "1.5px solid #10B981",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <CheckCircle2 size={20} color="#059669" />
                    <strong style={{ fontSize: "0.9rem", color: "#065F46" }}>
                      Firma Electrónica Válida y Lista
                    </strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem", color: "#1F2937" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <UserCheck size={14} color="#059669" />
                      <span><strong>Titular:</strong> {infoCert.nombreTitular}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Building size={14} color="#64748B" />
                      <span><strong>Emisor:</strong> {infoCert.entidadEmisora}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} color="#64748B" />
                      <span>
                        <strong>Vigencia:</strong> hasta {new Date(infoCert.validoHasta).toLocaleDateString("es-EC")}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setInfoCert(null);
                      setPassword("");
                    }}
                    style={{
                      marginTop: "12px",
                      background: "transparent",
                      border: "none",
                      color: "#059669",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ← Cambiar archivo de firma
                  </button>
                </div>

                {/* Estampa Preview */}
                <div
                  style={{
                    background: esTranqi ? "rgba(80, 0, 186, 0.05)" : "rgba(5, 135, 110, 0.05)",
                    border: `1.5px dashed ${esTranqi ? "#5000BA" : "#05876E"}`,
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "0.78rem",
                  }}
                >
                  <strong style={{ color: esTranqi ? "#5000BA" : "#05876E", display: "block", marginBottom: "4px" }}>
                    {esTranqi ? "Sello Institucional Tranqi" : "Sello de Firma del Abogado"}:
                  </strong>
                  <p style={{ margin: 0, color: "#334155" }}>
                    Se estampará en la sección de firmas del contrato con sello de tiempo oficial y hash criptográfico.
                  </p>
                </div>

                {errorFirma && (
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      color: "#991B1B",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                    }}
                  >
                    {errorFirma}
                  </div>
                )}

                {/* Botón de Firma Definitiva */}
                <button
                  type="button"
                  onClick={handleEjecutarFirma}
                  disabled={firmando || firmaExitosa}
                  style={{
                    marginTop: "8px",
                    padding: "12px 18px",
                    borderRadius: "10px",
                    background: esTranqi ? "#5000BA" : "#05876E",
                    color: "#FFFFFF",
                    fontSize: "0.92rem",
                    fontWeight: 800,
                    border: "none",
                    cursor: firmando || firmaExitosa ? "not-allowed" : "pointer",
                    opacity: firmando || firmaExitosa ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {firmando ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Estampando firma y sellando PDF...
                    </>
                  ) : firmaExitosa ? (
                    <>
                      <CheckCircle2 size={18} /> ¡Documento Firmado con Éxito!
                    </>
                  ) : (
                    <>
                      <FileCheck size={18} /> {esTranqi ? "Firmar y Activar Socio" : "Firmar Contrato y Enviar"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Columna Derecha: Visor de PDF */}
          <div
            style={{
              padding: "12px",
              background: "#E2E8F0",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {cargandoPdf ? (
              <div
                style={{
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748B",
                  gap: "10px",
                }}
              >
                <Loader2 size={28} className="animate-spin" color={esTranqi ? "#5000BA" : "#05876E"} />
                <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Cargando contrato pre-llenado...</span>
              </div>
            ) : urlPrevisualizacion ? (
              <iframe
                src={`${urlPrevisualizacion}#toolbar=0&navpanes=0`}
                title="Vista previa del Contrato"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "8px",
                  background: "#FFFFFF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              />
            ) : (
              <div
                style={{
                  flexGrow: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94A3B8",
                  fontSize: "0.85rem",
                }}
              >
                No se pudo cargar la vista previa del contrato
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
