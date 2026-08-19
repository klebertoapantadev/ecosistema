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
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  QrCode,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
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
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null);

  // Estado del PDF original y paginación
  const [cargandoPdf, setCargandoPdf] = useState(false);
  const [pdfBytesOriginal, setPdfBytesOriginal] = useState<ArrayBuffer | null>(null);
  const [urlPrevisualizacionOriginal, setUrlPrevisualizacionOriginal] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);

  // Posición interactiva de la firma (porcentajes 0 - 100 dentro del visor de la página)
  const esTranqi = rolFirmante === "TRANQI_PLATAFORMA";
  // Default: Abogado a la derecha (56%, 74%), Tranqi a la izquierda (10%, 74%)
  const [posicionXPorcentaje, setPosicionXPorcentaje] = useState(esTranqi ? 10 : 56);
  const [posicionYPorcentaje, setPosicionYPorcentaje] = useState(74);
  const [arrastrandoFirma, setArrastrandoFirma] = useState(false);
  const offsetArrastre = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  // Estado de la firma ejecutada
  const [firmando, setFirmando] = useState(false);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);
  const [pdfFirmadoBytes, setPdfFirmadoBytes] = useState<Uint8Array | null>(null);
  const [nombreArchivoFirmado, setNombreArchivoFirmado] = useState<string>("");
  const [urlPrevisualizacionFirmado, setUrlPrevisualizacionFirmado] = useState<string | null>(null);
  const [enviandoConfirmacion, setEnviandoConfirmacion] = useState(false);

  // Cargar PDF original y calcular número total de páginas
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

        // Contar páginas con pdf-lib
        const pdfDoc = await PDFDocument.load(buffer);
        const numPags = pdfDoc.getPageCount();
        setTotalPaginas(numPags);
        // Por defecto colocamos la vista en la última página (página de firmas)
        setPaginaActual(numPags);

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

      // Generar preview del código QR para la estampa visual
      const textoQr = [
        `FIRMADO DIGITALMENTE POR: ${res.info.nombreTitular}`,
        `FECHA: ${new Date().toLocaleString("es-EC")} (ECT)`,
        `EMISOR: ${res.info.entidadEmisora}`,
        `SERIE: ${res.info.numeroSerie}`,
        `PLATAFORMA: tranqi (ECUADOR)`,
      ].join("\n");

      const qrUrl = await QRCode.toDataURL(textoQr, {
        margin: 1,
        width: 120,
        errorCorrectionLevel: "M",
        color: {
          dark: esTranqi ? "#3B0086" : "#047857",
          light: "#FFFFFF",
        },
      });
      setQrPreviewDataUrl(qrUrl);

      // Al validar, asegurar que esté en la última página (firmas)
      setPaginaActual(totalPaginas);
      setPasoActual("2_UBICAR_FIRMA");
    } catch (err: unknown) {
      setErrorCert(err instanceof Error ? err.message : "Error al procesar el archivo");
      setInfoCert(null);
    } finally {
      setProcesandoP12(false);
    }
  }

  // Ref del contenedor del PDF para calculo proporcional 1:1
  const contenedorPdfRef = useRef<HTMLDivElement | null>(null);

  // Handlers para arrastrar la estampa de firma con el mouse o touch
  function handleInicioArrastre(clientX: number, clientY: number) {
    setArrastrandoFirma(true);
    offsetArrastre.current = {
      startX: clientX,
      startY: clientY,
      initPosX: posicionXPorcentaje,
      initPosY: posicionYPorcentaje,
    };
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!arrastrandoFirma) return;
      const rect = contenedorPdfRef.current?.getBoundingClientRect();
      const containerW = rect?.width || 600;
      const containerH = rect?.height || (containerW * (841.89 / 595.28));

      const deltaX = e.clientX - offsetArrastre.current.startX;
      const deltaY = e.clientY - offsetArrastre.current.startY;

      // Convertir delta pixels a porcentaje relativo exacto
      const deltaXPorc = (deltaX / containerW) * 100;
      const deltaYPorc = (deltaY / containerH) * 100;

      // Limites de la estampa dentro de la pagina (ancho: ~38.6%, alto: ~8.6%)
      const maxLeft = 100 - (230 / 595.28) * 100; // ~61.3%
      const maxTop = 100 - (72 / 841.89) * 100;  // ~91.4%

      const nuevaX = Math.max(2, Math.min(maxLeft, offsetArrastre.current.initPosX + deltaXPorc));
      const nuevaY = Math.max(2, Math.min(maxTop, offsetArrastre.current.initPosY + deltaYPorc));

      setPosicionXPorcentaje(Number(nuevaX.toFixed(1)));
      setPosicionYPorcentaje(Number(nuevaY.toFixed(1)));
    }

    function handleMouseUp() {
      if (arrastrandoFirma) {
        setArrastrandoFirma(false);
      }
    }

    if (arrastrandoFirma) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [arrastrandoFirma]);

  // Estampar firma en las coordenadas seleccionadas (proyección matemática 1:1)
  async function handleEstamparFirma() {
    if (!pdfBytesOriginal || !infoCert) return;

    try {
      setFirmando(true);
      setErrorFirma(null);

      // Puntos PDF estándar A4: 595.28 x 841.89 pt
      const pdfWidth = 595.28;
      const pdfHeight = 841.89;
      const boxHeight = 72;
      
      // X: desde el borde izquierdo
      const xPdf = (posicionXPorcentaje / 100) * pdfWidth;
      
      // Y: en DOM posicionYPorcentaje representa la distancia desde el borde SUPERIOR de la página.
      // En PDF-lib el origen (0,0) es la esquina INFERIOR izquierda y el rectángulo se dibuja hacia arriba con boxHeight.
      // Por tanto, la base del rectángulo en PDF es exactamente:
      const yPdf = pdfHeight - ((posicionYPorcentaje / 100) * pdfHeight) - boxHeight;

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
          paginaIndex: paginaActual - 1,
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
        background: "rgba(15, 23, 42, 0.82)",
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
          maxWidth: "1200px",
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
            padding: "16px 24px",
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
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
                {esTranqi
                  ? "Contra-Firma Digital Institucional · tranqi"
                  : "Firma Electrónica Digital del Contrato de Sociedad"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                Estándar PAdES / QR Oficial · Ley de Comercio Electrónico del Ecuador
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
            padding: "8px 24px",
            gap: "16px",
            fontSize: "0.82rem",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: pasoActual === "1_VALIDAR_CERTIFICADO" ? (esTranqi ? "#5000BA" : "#047857") : "#64748B",
            }}
          >
            <span
              style={{
                background: pasoActual === "1_VALIDAR_CERTIFICADO" ? (esTranqi ? "#5000BA" : "#047857") : "#CBD5E1",
                color: "#FFF",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
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
              gap: "6px",
              color: pasoActual === "2_UBICAR_FIRMA" ? (esTranqi ? "#5000BA" : "#047857") : "#64748B",
            }}
          >
            <span
              style={{
                background: pasoActual === "2_UBICAR_FIRMA" ? (esTranqi ? "#5000BA" : "#047857") : "#CBD5E1",
                color: "#FFF",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
              }}
            >
              2
            </span>
            Ubicar Firma con QR en Documento
          </div>

          <div style={{ color: "#CBD5E1" }}>➔</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: pasoActual === "3_REVISAR_Y_ENVIAR" ? (esTranqi ? "#5000BA" : "#047857") : "#64748B",
            }}
          >
            <span
              style={{
                background: pasoActual === "3_REVISAR_Y_ENVIAR" ? (esTranqi ? "#5000BA" : "#047857") : "#CBD5E1",
                color: "#FFF",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
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
            padding: "6px 24px",
            background: "#F0FDF4",
            borderBottom: "1px solid #DCFCE7",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.78rem",
            color: "#166534",
          }}
        >
          <ShieldCheck size={15} color="#16A34A" />
          <span>
            <strong>Privacidad Zero-Custody:</strong> Tu certificado .p12 y contraseña se procesan exclusivamente en la memoria de tu dispositivo. <strong>Nunca se envían a ningún servidor.</strong>
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
              padding: "20px",
              borderRight: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              background: "#FFFFFF",
              overflowY: "auto",
            }}
          >
            {/* PASO 1: Formulario de carga de certificado */}
            {pasoActual === "1_VALIDAR_CERTIFICADO" && (
              <form onSubmit={handleValidarP12} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: 700, color: "#1E293B" }}>
                    1. Cargar Archivo de Firma (.p12 / .pfx)
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748B" }}>
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
                      padding: "18px 14px",
                      border: "2px dashed #CBD5E1",
                      borderRadius: "12px",
                      background: "#F8FAFC",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "border-color 0.2s ease",
                    }}
                  >
                    <KeyRound size={26} color={esTranqi ? "#5000BA" : "#047857"} style={{ marginBottom: "6px" }} />
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                      {archivoP12 ? archivoP12.name : "Examinar archivo .p12 o .pfx"}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "3px" }}>
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
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
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
                        fontSize: "0.88rem",
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
                      {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {errorCert && (
                  <div
                    style={{
                      padding: "10px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "10px",
                      color: "#991B1B",
                      fontSize: "0.78rem",
                      display: "flex",
                      gap: "6px",
                    }}
                  >
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
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
                    fontSize: "0.88rem",
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
                      <Loader2 size={16} className="animate-spin" />
                      Validando Criptografía...
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      Verificar Certificado y Continuar
                    </>
                  )}
                </button>
              </form>
            )}

            {/* PASO 2: Controles de Ubicación de la Firma */}
            {pasoActual === "2_UBICAR_FIRMA" && infoCert && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Tarjeta de Certificado Validado con QR */}
                <div
                  style={{
                    padding: "12px",
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16A34A", marginBottom: "6px" }}>
                    <CheckCircle2 size={16} />
                    <span style={{ fontSize: "0.82rem", fontWeight: 800 }}>Certificado Válido con QR Oficial</span>
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "#1E293B", lineHeight: 1.35 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "3px" }}>
                      <UserCheck size={13} color="#047857" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <span><strong>Titular:</strong> {infoCert.nombreTitular}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "3px" }}>
                      <Building size={13} color="#047857" style={{ flexShrink: 0, marginTop: "2px" }} />
                      <span><strong>Emisor:</strong> {infoCert.entidadEmisora}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={13} color="#047857" />
                      <span><strong>Vigencia:</strong> hasta {new Date(infoCert.validoHasta).toLocaleDateString("es-EC")}</span>
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
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 0 0 0",
                      textDecoration: "underline",
                      display: "block",
                    }}
                  >
                    ← Cambiar archivo de firma
                  </button>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "0.9rem", fontWeight: 700, color: "#1E293B" }}>
                    2. Posiciona tu Sello QR en la Página {paginaActual}
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                    Arrastra el recuadro con el QR directamente en el visor o usa las opciones rápidas.
                  </p>
                </div>

                {/* Botones de Posición Rápida */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaginaActual(totalPaginas);
                      setPosicionXPorcentaje(56);
                      setPosicionYPorcentaje(74);
                    }}
                    style={{
                      padding: "8px 10px",
                      background: posicionXPorcentaje > 50 ? "#DCFCE7" : "#F8FAFC",
                      border: `1.5px solid ${posicionXPorcentaje > 50 ? "#22C55E" : "#CBD5E1"}`,
                      borderRadius: "8px",
                      fontSize: "0.78rem",
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
                    {posicionXPorcentaje > 50 && <Check size={14} color="#16A34A" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaginaActual(totalPaginas);
                      setPosicionXPorcentaje(10);
                      setPosicionYPorcentaje(74);
                    }}
                    style={{
                      padding: "8px 10px",
                      background: posicionXPorcentaje <= 50 ? "#EDE9FE" : "#F8FAFC",
                      border: `1.5px solid ${posicionXPorcentaje <= 50 ? "#8B5CF6" : "#CBD5E1"}`,
                      borderRadius: "8px",
                      fontSize: "0.78rem",
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
                    {posicionXPorcentaje <= 50 && <Check size={14} color="#7C3AED" />}
                  </button>
                </div>

                {/* Micro-ajustes de posición */}
                <div
                  style={{
                    padding: "10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", marginBottom: "6px" }}>
                    Ajuste de posición ({posicionXPorcentaje}%, {posicionYPorcentaje}%):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setPosicionYPorcentaje((y) => Math.max(5, y - 4))}
                      style={{
                        padding: "6px",
                        background: "#FFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <ArrowUp size={12} /> Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosicionYPorcentaje((y) => Math.min(85, y + 4))}
                      style={{
                        padding: "6px",
                        background: "#FFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <ArrowDown size={12} /> Bajar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosicionXPorcentaje((x) => Math.max(5, x - 4))}
                      style={{
                        padding: "6px",
                        background: "#FFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <ArrowLeft size={12} /> Izquierda
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosicionXPorcentaje((x) => Math.min(65, x + 4))}
                      style={{
                        padding: "6px",
                        background: "#FFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                    >
                      <ArrowRight size={12} /> Derecha
                    </button>
                  </div>
                </div>

                {errorFirma && (
                  <div
                    style={{
                      padding: "8px 10px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "8px",
                      color: "#991B1B",
                      fontSize: "0.75rem",
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
                    padding: "12px",
                    background: esTranqi
                      ? "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)"
                      : "linear-gradient(135deg, #047857 0%, #065F46 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: firmando ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(4, 120, 87, 0.25)",
                  }}
                >
                  {firmando ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Estampando Firma con QR en PDF...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Estampar Firma con QR
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PASO 3: Revisar, Descargar y Enviar */}
            {pasoActual === "3_REVISAR_Y_ENVIAR" && infoCert && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    padding: "14px",
                    background: "#F0FDF4",
                    border: "1.5px solid #86EFAC",
                    borderRadius: "12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "50%",
                      background: "#DCFCE7",
                      color: "#16A34A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 8px auto",
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "0.95rem", fontWeight: 800, color: "#166534" }}>
                    ¡Documento Firmado con Sello QR!
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#15803D" }}>
                    La firma digital y el código QR de verificación han sido estampados en el contrato.
                  </p>
                </div>

                {/* Acciones del Paso 3 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleDescargarPdfFirmado}
                    style={{
                      padding: "10px 12px",
                      background: "#F8FAFC",
                      border: "1.5px solid #CBD5E1",
                      borderRadius: "8px",
                      color: "#1E293B",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "background 0.2s ease",
                    }}
                  >
                    <Download size={16} color="#047857" />
                    Descargar Copia Firmada (PDF)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPasoActual("2_UBICAR_FIRMA");
                      setUrlPrevisualizacionFirmado(null);
                    }}
                    style={{
                      padding: "6px 10px",
                      background: "none",
                      border: "none",
                      color: "#64748B",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <RotateCcw size={13} />
                    Reubicar o Cambiar Posición de Firma
                  </button>
                </div>

                {errorFirma && (
                  <div
                    style={{
                      padding: "8px 10px",
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      borderRadius: "8px",
                      color: "#991B1B",
                      fontSize: "0.75rem",
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
                    padding: "12px",
                    background: esTranqi
                      ? "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)"
                      : "linear-gradient(135deg, #047857 0%, #065F46 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: enviandoConfirmacion ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(4, 120, 87, 0.35)",
                  }}
                >
                  {enviandoConfirmacion ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Procesando Acreditación...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      {esTranqi
                        ? "Contra-Firmar y Activar Socio"
                        : "Confirmar y Enviar a Tranqi"}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Columna Derecha: Visor Interactivo del Documento con Controles de Paginación */}
          <div
            style={{
              background: "#334155",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Barra superior de navegación y paginación */}
            <div
              style={{
                padding: "8px 16px",
                background: "#1E293B",
                color: "#E2E8F0",
                fontSize: "0.8rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #475569",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={15} color="#38BDF8" />
                <span style={{ fontWeight: 600 }}>
                  {pasoActual === "3_REVISAR_Y_ENVIAR"
                    ? "Vista Previa: Contrato Firmado con Sello QR"
                    : `Contrato de Sociedad (${totalPaginas} páginas)`}
                </span>
              </div>

              {/* Controles de Paginación */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual <= 1}
                  style={{
                    background: paginaActual <= 1 ? "#334155" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    color: paginaActual <= 1 ? "#64748B" : "#FFF",
                    padding: "4px 8px",
                    cursor: paginaActual <= 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>

                <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#F8FAFC" }}>
                  Página {paginaActual} de {totalPaginas}
                </span>

                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual >= totalPaginas}
                  style={{
                    background: paginaActual >= totalPaginas ? "#334155" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    color: paginaActual >= totalPaginas ? "#64748B" : "#FFF",
                    padding: "4px 8px",
                    cursor: paginaActual >= totalPaginas ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Siguiente <ChevronRight size={14} />
                </button>

                {paginaActual !== totalPaginas && (
                  <button
                    type="button"
                    onClick={() => setPaginaActual(totalPaginas)}
                    style={{
                      background: "#047857",
                      border: "none",
                      borderRadius: "6px",
                      color: "#FFF",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      marginLeft: "6px",
                    }}
                  >
                    🏁 Ir a Firmas (Pág. {totalPaginas})
                  </button>
                )}
              </div>
            </div>

            {/* Contenedor del PDF con desplazamiento nativo completamente habilitado */}
            <div
              style={{
                flex: 1,
                position: "relative",
                overflowY: "auto",
                display: "flex",
                justifyContent: "center",
                padding: "16px",
                background: "#475569",
              }}
            >
              {cargandoPdf ? (
                <div style={{ color: "#FFF", display: "flex", alignItems: "center", gap: "10px", margin: "auto" }}>
                  <Loader2 size={24} className="animate-spin" />
                  Cargando contrato...
                </div>
              ) : (
                <div
                  ref={contenedorPdfRef}
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "600px",
                    aspectRatio: "595.28 / 841.89",
                    background: "#FFFFFF",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  {/* Iframe del PDF con soporte nativo de scroll y navegación por página */}
                  <iframe
                    key={`pdf-page-${paginaActual}-${pasoActual}`}
                    src={
                      pasoActual === "3_REVISAR_Y_ENVIAR" && urlPrevisualizacionFirmado
                        ? `${urlPrevisualizacionFirmado}#page=${paginaActual}&view=FitH&toolbar=0&navpanes=0`
                        : urlPrevisualizacionOriginal
                        ? `${urlPrevisualizacionOriginal}#page=${paginaActual}&view=FitH&toolbar=0&navpanes=0`
                        : ""
                    }
                    title="Visor Contrato"
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                    }}
                  />

                  {/* ESTAMPA FLOTANTE INTERACTIVA CON CÓDIGO QR EN PASO 2 (PROYECCIÓN 1:1) */}
                  {pasoActual === "2_UBICAR_FIRMA" && infoCert && (
                    <div
                      onMouseDown={(e) => handleInicioArrastre(e.clientX, e.clientY)}
                      onTouchStart={(e) => {
                        if (e.touches[0]) {
                          handleInicioArrastre(e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: `${posicionYPorcentaje}%`,
                        left: `${posicionXPorcentaje}%`,
                        width: `${((230 / 595.28) * 100).toFixed(2)}%`,
                        height: `${((72 / 841.89) * 100).toFixed(2)}%`,
                        minWidth: "180px",
                        minHeight: "56px",
                        background: "rgba(255, 255, 255, 0.98)",
                        border: `1.5px solid ${esTranqi ? "#5000BA" : "#047857"}`,
                        borderRadius: "4px",
                        padding: "4px 6px",
                        boxSizing: "border-box",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: arrastrandoFirma ? "grabbing" : "grab",
                        userSelect: "none",
                        zIndex: 50,
                        transition: arrastrandoFirma ? "none" : "all 0.15s ease-out",
                      }}
                    >
                      {/* Código QR Izquierdo */}
                      <div
                        style={{
                          width: "56px",
                          height: "56px",
                          flexShrink: 0,
                          background: "#F8FAFC",
                          borderRadius: "3px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        {qrPreviewDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={qrPreviewDataUrl}
                            alt="QR Firma"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <QrCode size={36} color={esTranqi ? "#5000BA" : "#047857"} />
                        )}
                      </div>

                      {/* Separador vertical */}
                      <div style={{ width: "1px", height: "56px", background: "#E2E8F0" }} />

                      {/* Textos Oficiales Derechos */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          height: "58px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.58rem",
                            fontWeight: 800,
                            color: esTranqi ? "#5000BA" : "#047857",
                            lineHeight: 1,
                            textTransform: "uppercase",
                          }}
                        >
                          {esTranqi ? "FIRMADO POR TRANQI" : "FIRMADO DIGITALMENTE POR:"}
                        </div>

                        <div
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            color: "#0F172A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.1,
                          }}
                        >
                          {infoCert.nombreTitular}
                        </div>

                        <div style={{ fontSize: "0.52rem", color: "#334155", lineHeight: 1 }}>
                          FECHA: {new Date().toLocaleDateString("es-EC")} (ECT)
                        </div>

                        <div
                          style={{
                            fontSize: "0.48rem",
                            color: "#64748B",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                          }}
                        >
                          EMISOR: {infoCert.entidadEmisora.substring(0, 24)}...
                        </div>

                        <div
                          style={{
                            fontSize: "0.44rem",
                            color: "#047857",
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          LEY COMERCIO ELECTRÓNICO (EC)
                        </div>
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
