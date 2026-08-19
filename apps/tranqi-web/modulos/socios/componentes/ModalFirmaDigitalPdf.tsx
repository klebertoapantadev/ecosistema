"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Download,
  Send,
  Move,
  RotateCcw,
  Sparkles,
  FileText,
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

type PasoModal = "1_VALIDAR_CERTIFICADO" | "2_UBICAR_FIRMA" | "3_REVISAR_Y_ENVIAR";

export function ModalFirmaDigitalPdf({
  abierto,
  onCerrar,
  urlPdfOriginal,
  solicitudId,
  rolFirmante,
  nombreSujetoEsperado,
  onFirmaCompletada,
}: ModalFirmaDigitalPdfProps) {
  const [pasoActual, setPasoActual] = useState<PasoModal>("1_VALIDAR_CERTIFICADO");

  // Estado del Certificado .p12
  const [archivoP12, setArchivoP12] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [procesandoP12, setProcesandoP12] = useState(false);
  const [infoCert, setInfoCert] = useState<InfoCertificado | null>(null);
  const [errorCert, setErrorCert] = useState<string | null>(null);

  // Estado del PDF original
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [pdfBytesOriginal, setPdfBytesOriginal] = useState<ArrayBuffer | null>(null);
  const [urlPrevisualizacionOriginal, setUrlPrevisualizacionOriginal] = useState<string | null>(null);

  // Posición interactiva de la firma (porcentajes 0 - 100 dentro del contenedor)
  const esTranqi = rolFirmante === "TRANQI_PLATAFORMA";
  // Default: Abogado a la derecha (60%, 75%), Tranqi a la izquierda (10%, 75%)
  const [posicionXPorcentaje, setPosicionXPorcentaje] = useState(esTranqi ? 10 : 58);
  const [posicionYPorcentaje, setPosicionYPorcentaje] = useState(74);
  const [arrastrando, setArrastrando] = useState(false);
  const contenedorVisorRef = useRef<HTMLDivElement | null>(null);

  // Estado de la firma ejecutada
  const [firmando, setFirmando] = useState(false);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);
  const [pdfFirmadoBytes, setPdfFirmadoBytes] = useState<Uint8Array | null>(null);
  const [nombreArchivoFirmado, setNombreArchivoFirmado] = useState<string>("");
  const [urlPrevisualizacionFirmado, setUrlPrevisualizacionFirmado] = useState<string | null>(null);
  const [enviandoConfirmacion, setEnviandoConfirmacion] = useState(false);

  // Cargar PDF original en memoria al abrir
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
        setUrlPrevisualizacionOriginal(urlBlob);
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
      if (urlPrevisualizacionOriginal) {
        URL.revokeObjectURL(urlPrevisualizacionOriginal);
      }
      if (urlPrevisualizacionFirmado) {
        URL.revokeObjectURL(urlPrevisualizacionFirmado);
      }
    };
  }, [abierto, urlPdfOriginal]);

  // Validar Certificado P12
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
      setPasoActual("2_UBICAR_FIRMA");
    } catch (err: unknown) {
      setErrorCert(err instanceof Error ? err.message : "Error al procesar el archivo");
      setInfoCert(null);
    } finally {
      setProcesandoP12(false);
    }
  }

  // Manejador de clic en el visor para posicionar la firma
  function handleClicVisor(e: React.MouseEvent<HTMLDivElement>) {
    if (!contenedorVisorRef.current || pasoActual !== "2_UBICAR_FIRMA") return;
    const rect = contenedorVisorRef.current.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * 100;
    const yRel = ((e.clientY - rect.top) / rect.height) * 100;

    // Limitar entre 5% y 80% para mantener visible la estampa
    const posXLimitada = Math.max(5, Math.min(65, xRel - 15));
    const posYLimitada = Math.max(5, Math.min(85, yRel - 5));

    setPosicionXPorcentaje(posXLimitada);
    setPosicionYPorcentaje(posYLimitada);
  }

  // Estampar firma con las coordenadas seleccionadas
  async function handleEstamparFirma() {
    if (!pdfBytesOriginal || !infoCert) return;

    try {
      setFirmando(true);
      setErrorFirma(null);

      // Convertir porcentajes (0-100) a puntos PDF (A4 estándar: 595.28 x 841.89)
      const pdfWidth = 595.28;
      const pdfHeight = 841.89;
      
      const xPdf = (posicionXPorcentaje / 100) * pdfWidth;
      // En PDF (0,0) es la esquina inferior izquierda
      const yPdf = ((100 - posicionYPorcentaje - 12) / 100) * pdfHeight;

      const resEstampa = await estamparFirmaDigitalEnPdf({
        pdfBytes: pdfBytesOriginal,
        infoCertificado: infoCert,
        rolFirmante,
        razonFirma: esTranqi
          ? "Aprobación y Formalización Institucional de Socio Abogado"
          : "Suscripción y Aceptación de Contrato de Sociedad de Abogados",
        posicion: {
          x: xPdf,
          y: yPdf,
        },
      });

      if (!resEstampa.ok) {
        throw new Error(resEstampa.error);
      }

      setPdfFirmadoBytes(resEstampa.pdfFirmado);
      setNombreArchivoFirmado(resEstampa.nombreArchivo);

      // Crear URL para preview del PDF ya firmado
      const blobFirmado = new Blob([resEstampa.pdfFirmado as unknown as BlobPart], { type: "application/pdf" });
      const urlFirmado = URL.createObjectURL(blobFirmado);
      setUrlPrevisualizacionFirmado(urlFirmado);

      // Pasar al paso 3: Revisar, descargar y enviar
      setPasoActual("3_REVISAR_Y_ENVIAR");
    } catch (err: unknown) {
      setErrorFirma(err instanceof Error ? err.message : "Error al estampar la firma electrónica");
    } finally {
      setFirmando(false);
    }
  }

  // Descargar el PDF firmado en la máquina del usuario
  function handleDescargarPdfFirmado() {
    if (!pdfFirmadoBytes) return;
    const blob = new Blob([pdfFirmadoBytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivoFirmado || "Contrato_Firmado_Digitalmente.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Confirmar y continuar el flujo de aprobación
  async function handleConfirmarYEnviar() {
    if (!pdfFirmadoBytes || !infoCert) return;
    try {
      setEnviandoConfirmacion(true);
      setErrorFirma(null);

      await onFirmaCompletada(pdfFirmadoBytes, nombreArchivoFirmado, infoCert);

      // Limpiar memoria volátil
      setPassword("");
      setArchivoP12(null);
    } catch (err: unknown) {
      setErrorFirma(err instanceof Error ? err.message : "Error al confirmar el contrato");
      setEnviandoConfirmacion(false);
    }
  }

  if (!abierto) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.78)",
        backdropFilter: "blur(8px)",
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
          borderRadius: "20px",
          width: "100%",
          maxWidth: "1150px",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}
      >
        {/* Encabezado Modal */}
        <div
          style={{
            padding: "18px 26px",
            background: esTranqi
              ? "linear-gradient(135deg, #3B0086 0%, #5000BA 100%)"
              : "linear-gradient(135deg, #047857 0%, #05876E 100%)",
            color: "#FFFFFF",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                padding: "8px",
                borderRadius: "12px",
                display: "flex",
              }}
            >
              <FileCheck size={24} color="#FFF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                {esTranqi
                  ? "Contra-Firma Digital Institucional · tranqi"
                  : "Firma Electrónica Digital del Contrato de Sociedad"}
              </h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "0.82rem", opacity: 0.9 }}>
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
              width: "36px",
              height: "36px",
              color: "#FFF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s ease",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Pasos de Navegación */}
        <div
          style={{
            display: "flex",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            padding: "10px 24px",
            gap: "16px",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: pasoActual === "1_VALIDAR_CERTIFICADO" ? (esTranqi ? "#5000BA" : "#047857") : "#64748B",
            }}
          >
            <span
              style={{
                background: pasoActual === "1_VALIDAR_CERTIFICADO" ? (esTranqi ? "#5000BA" : "#047857") : "#CBD5E1",
                color: "#FFF",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
              }}
            >
              1
            </span>
            Validar Certificado (.p12)
          </div>

          <div style={{ color: "#CBD5E1" }}>➔</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: pasoActual === "2_UBICAR_FIRMA" ? (esTranqi ? "#5000BA" : "#047857") : "#64748B",
            }}
          >
            <span
              style={{
                background: pasoActual === "2_UBICAR_FIRMA" ? (esTranqi ? "#5000BA" : "#047857") : "#CBD5E1",
                color: "#FFF",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
              }}
            >
              2
            </span>
            Ubicar y Posicionar Firma
          </div>

          <div style={{ color: "#CBD5E1" }}>➔</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: pasoActual === "3_REVISAR_Y_ENVIAR" ? (esTranqi ? "#5000BA" : "#047857") : "#64748B",
            }}
          >
            <span
              style={{
                background: pasoActual === "3_REVISAR_Y_ENVIAR" ? (esTranqi ? "#5000BA" : "#047857") : "#CBD5E1",
                color: "#FFF",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
              }}
            >
              3
            </span>
            Revisar, Descargar y Enviar
          </div>
        </div>

        {/* Aviso de Seguridad Zero-Custody */}
        <div
          style={{
            padding: "8px 24px",
            background: "#F0FDF4",
            borderBottom: "1px solid #DCFCE7",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.8rem",
            color: "#166534",
          }}
        >
          <ShieldCheck size={16} color="#16A34A" />
          <span>
            <strong>Privacidad Zero-Custody:</strong> Tu certificado .p12 y su clave privada se procesan exclusivamente en la memoria volátil de este navegador. <strong>Nunca se transmiten ni guardan en ningún servidor.</strong>
          </span>
        </div>

        {/* Cuerpo del Modal con layout dividido */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Columna Izquierda: Panel de Control del Asistente */}
          <div
            style={{
              padding: "24px",
              borderRight: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              background: "#FFFFFF",
              overflowY: "auto",
            }}
          >
            {/* PASO 1: Formulario de carga de certificado */}
            {pasoActual === "1_VALIDAR_CERTIFICADO" && (
              <form onSubmit={handleValidarP12} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "1rem", fontWeight: 700, color: "#1E293B" }}>
                    1. Cargar Archivo de Firma (.p12 / .pfx)
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
                    Selecciona tu certificado emitido por Security Data, Banco Central, Judicatura, ANFAC, etc.
                  </p>
                </div>

                <div>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      border: "2px dashed #CBD5E1",
                      borderRadius: "12px",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "border-color 0.2s ease",
                    }}
                  >
                    <KeyRound size={28} color={esTranqi ? "#5000BA" : "#047857"} style={{ marginBottom: "8px" }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                      {archivoP12 ? archivoP12.name : "Examinar archivo .p12 o .pfx"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "4px" }}>
                      Haga clic para seleccionar desde su dispositivo
                    </span>
                    <input
                      type="file"
                      accept=".p12,.pfx"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setArchivoP12(e.target.files[0]);
                          setErrorCert(null);
                        }
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Contraseña de la Firma Electrónica
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresa tu clave privada"
                      required
                      style={{
                        width: "100%",
                        padding: "10px 40px 10px 12px",
                        fontSize: "0.9rem",
                        border: "1.5px solid #CBD5E1",
                        borderRadius: "10px",
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
                        cursor: "pointer",
                        color: "#64748B",
                        display: "flex",
                      }}
                    >
                      {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {errorCert && (
                  <div
                    style={{
                      padding: "12px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "10px",
                      color: "#991B1B",
                      fontSize: "0.8rem",
                      display: "flex",
                      gap: "8px",
                    }}
                  >
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>{errorCert}</div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={procesandoP12 || !archivoP12 || !password}
                  style={{
                    padding: "12px",
                    background: esTranqi
                      ? "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)"
                      : "linear-gradient(135deg, #047857 0%, #065F46 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    cursor: procesandoP12 || !archivoP12 || !password ? "not-allowed" : "pointer",
                    opacity: procesandoP12 || !archivoP12 || !password ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {procesandoP12 ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Validando Criptografía...
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      Verificar Certificado y Continuar
                    </>
                  )}
                </button>
              </form>
            )}

            {/* PASO 2: Controles de Ubicación de la Firma */}
            {pasoActual === "2_UBICAR_FIRMA" && infoCert && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Tarjeta de Certificado Validado */}
                <div
                  style={{
                    padding: "14px",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#16A34A", marginBottom: "8px" }}>
                    <CheckCircle2 size={18} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 800 }}>Certificado Válido y Listo</span>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "#1E293B", lineHeight: 1.4 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                      <UserCheck size={14} color="#047857" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <span><strong>Titular:</strong> {infoCert.nombreTitular}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "4px" }}>
                      <Building size={14} color="#047857" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <span><strong>Emisor:</strong> {infoCert.entidadEmisora}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} color="#047857" />
                      <span><strong>Válido hasta:</strong> {new Date(infoCert.validoHasta).toLocaleDateString("es-EC")}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setInfoCert(null);
                      setPasoActual("1_VALIDAR_CERTIFICADO");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#047857",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "6px 0 0 0",
                      textDecoration: "underline",
                      display: "block",
                    }}
                  >
                    ← Cambiar archivo de firma
                  </button>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.95rem", fontWeight: 700, color: "#1E293B" }}>
                    2. Posiciona tu Firma en el Documento
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
                    Haz clic o arrastra el recuadro verde sobre el visor de la derecha para ubicar la estampa en el lugar deseado.
                  </p>
                </div>

                {/* Botones de Posición Rápida */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                    Posiciones Rápidas Recomendadas:
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setPosicionXPorcentaje(58);
                      setPosicionYPorcentaje(74);
                    }}
                    style={{
                      padding: "8px 12px",
                      background: posicionXPorcentaje > 50 ? "#DCFCE7" : "#F1F5F9",
                      border: `1.5px solid ${posicionXPorcentaje > 50 ? "#22C55E" : "#CBD5E1"}`,
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: posicionXPorcentaje > 50 ? "#166534" : "#475569",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>📌 Columna Derecha (Firma del Abogado)</span>
                    {posicionXPorcentaje > 50 && <CheckCircle2 size={14} color="#16A34A" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPosicionXPorcentaje(8);
                      setPosicionYPorcentaje(74);
                    }}
                    style={{
                      padding: "8px 12px",
                      background: posicionXPorcentaje <= 50 ? "#EDE9FE" : "#F1F5F9",
                      border: `1.5px solid ${posicionXPorcentaje <= 50 ? "#8B5CF6" : "#CBD5E1"}`,
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: posicionXPorcentaje <= 50 ? "#5B21B6" : "#475569",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>📌 Columna Izquierda (Firma Tranqi)</span>
                    {posicionXPorcentaje <= 50 && <CheckCircle2 size={14} color="#7C3AED" />}
                  </button>
                </div>

                {errorFirma && (
                  <div
                    style={{
                      padding: "10px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "8px",
                      color: "#991B1B",
                      fontSize: "0.8rem",
                    }}
                  >
                    {errorFirma}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEstamparFirma}
                  disabled={firmando}
                  style={{
                    marginTop: "auto",
                    padding: "14px",
                    background: esTranqi
                      ? "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)"
                      : "linear-gradient(135deg, #047857 0%, #065F46 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    cursor: firmando ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    boxShadow: "0 4px 12px rgba(4, 120, 87, 0.25)",
                  }}
                >
                  {firmando ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Estampando Firma en PDF...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Estampar Firma en este Lugar
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PASO 3: Revisar, Descargar y Enviar */}
            {pasoActual === "3_REVISAR_Y_ENVIAR" && infoCert && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    padding: "16px",
                    background: "#F0FDF4",
                    border: "1.5px solid #86EFAC",
                    borderRadius: "14px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "#DCFCE7",
                      color: "#16A34A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 10px auto",
                    }}
                  >
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 800, color: "#166534" }}>
                    ¡Documento Firmado con Éxito!
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#15803D" }}>
                    La firma digital y el sello de integridad han sido estampados correctamente en el contrato.
                  </p>
                </div>

                {/* Acciones del Paso 3 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleDescargarPdfFirmado}
                    style={{
                      padding: "12px 14px",
                      background: "#F8FAFC",
                      border: "1.5px solid #CBD5E1",
                      borderRadius: "10px",
                      color: "#1E293B",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "background 0.2s ease",
                    }}
                  >
                    <Download size={18} color="#047857" />
                    Descargar Copia Firmada (PDF)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasoActual("2_UBICAR_FIRMA");
                      setUrlPrevisualizacionFirmado(null);
                    }}
                    style={{
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      color: "#64748B",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <RotateCcw size={14} />
                    Reubicar o Cambiar Posición de Firma
                  </button>
                </div>

                {errorFirma && (
                  <div
                    style={{
                      padding: "10px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "8px",
                      color: "#991B1B",
                      fontSize: "0.8rem",
                    }}
                  >
                    {errorFirma}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConfirmarYEnviar}
                  disabled={enviandoConfirmacion}
                  style={{
                    marginTop: "auto",
                    padding: "14px",
                    background: esTranqi
                      ? "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)"
                      : "linear-gradient(135deg, #047857 0%, #065F46 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    cursor: enviandoConfirmacion ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    boxShadow: "0 4px 14px rgba(4, 120, 87, 0.35)",
                  }}
                >
                  {enviandoConfirmacion ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Procesando Acreditación...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      {esTranqi
                        ? "Contra-Firmar y Activar Socio"
                        : "Confirmar y Enviar a Tranqi"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Columna Derecha: Visor Interactivo de Documento con Caja de Firma Flotante */}
          <div
            style={{
              background: "#334155",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Barra superior del visor */}
            <div
              style={{
                padding: "8px 16px",
                background: "#1E293B",
                color: "#94A3B8",
                fontSize: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #475569",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <FileText size={14} color="#38BDF8" />
                {pasoActual === "3_REVISAR_Y_ENVIAR"
                  ? "Vista Previa: Contrato Firmado Digitalmente"
                  : "Visor del Contrato (Página de Suscripción)"}
              </span>

              {pasoActual === "2_UBICAR_FIRMA" && (
                <span
                  style={{
                    background: "#047857",
                    color: "#FFF",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Move size={12} />
                  Haz clic sobre el documento para mover la firma
                </span>
              )}
            </div>

            {/* Contenedor del PDF */}
            <div
              ref={contenedorVisorRef}
              onClick={handleClicVisor}
              style={{
                flex: 1,
                position: "relative",
                overflowY: "auto",
                display: "flex",
                justifyContent: "center",
                padding: "20px",
                background: "#475569",
                cursor: pasoActual === "2_UBICAR_FIRMA" ? "crosshair" : "default",
              }}
            >
              {cargandoPdf ? (
                <div style={{ color: "#FFF", display: "flex", alignItems: "center", gap: "10px", margin: "auto" }}>
                  <Loader2 size={24} className="animate-spin" />
                  Cargando contrato...
                </div>
              ) : (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "700px",
                    minHeight: "850px",
                    background: "#FFFFFF",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  {/* Iframe del PDF (firmado en paso 3 o original en paso 1 y 2) */}
                  <iframe
                    src={
                      pasoActual === "3_REVISAR_Y_ENVIAR" && urlPrevisualizacionFirmado
                        ? `${urlPrevisualizacionFirmado}#toolbar=0&navpanes=0&scrollbar=1`
                        : urlPrevisualizacionOriginal
                        ? `${urlPrevisualizacionOriginal}#toolbar=0&navpanes=0&scrollbar=1`
                        : ""
                    }
                    title="Visor Contrato"
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      minHeight: "850px",
                      pointerEvents: pasoActual === "2_UBICAR_FIRMA" ? "none" : "auto",
                    }}
                  />

                  {/* ESTAMPA FLOTANTE INTERACTIVA EN PASO 2 */}
                  {pasoActual === "2_UBICAR_FIRMA" && infoCert && (
                    <div
                      style={{
                        position: "absolute",
                        top: `${posicionYPorcentaje}%`,
                        left: `${posicionXPorcentaje}%`,
                        width: "230px",
                        height: "85px",
                        background: esTranqi ? "rgba(245, 243, 255, 0.95)" : "rgba(236, 253, 245, 0.95)",
                        border: `2px dashed ${esTranqi ? "#5000BA" : "#047857"}`,
                        borderRadius: "6px",
                        padding: "6px 8px",
                        boxSizing: "border-box",
                        boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        cursor: "grab",
                        userSelect: "none",
                        zIndex: 50,
                        animation: "pulse 2s infinite",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          color: esTranqi ? "#5000BA" : "#047857",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>{esTranqi ? "FIRMA DIGITAL · TRANQI LEGAL" : "FIRMA ELECTRÓNICA AVANZADA"}</span>
                        <Move size={10} />
                      </div>

                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          color: "#0F172A",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {infoCert.nombreTitular}
                      </div>

                      <div style={{ fontSize: "0.55rem", color: "#475569", lineHeight: 1.1 }}>
                        <div>Emisor: {infoCert.entidadEmisora.substring(0, 28)}...</div>
                        <div>Fecha: {new Date().toLocaleDateString("es-EC")} (ECT)</div>
                      </div>

                      <div
                        style={{
                          fontSize: "0.5rem",
                          color: "#64748B",
                          borderTop: "1px solid rgba(0,0,0,0.08)",
                          paddingTop: "2px",
                        }}
                      >
                        Ley Comercio Electrónico EC · Zero-Custody
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
