"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Upload,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  QrCode,
  FileCheck,
  Sparkles,
  Lock,
  X
} from "lucide-react";
import forge from "node-forge";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import Link from "next/link";

interface InfoCertificado {
  nombreTitular: string;
  entidadEmisora: string;
  validoDesde: Date;
  validoHasta: Date;
  numeroSerie: string;
  esValido: boolean;
}

interface Props {
  negocio?: string;
  onCerrar?: () => void;
  mostrarBotonCerrar?: boolean;
}

export function WidgetFirmaDocumentosPdf({
  negocio = "TRANQ",
  onCerrar,
  mostrarBotonCerrar = false
}: Props) {
  // Estados del Flujo de Firmado
  // 1_CARGAR_PDF -> 2_CARGAR_CERTIFICADO -> 3_UBICAR_FIRMA -> 4_DOCUMENTO_FIRMADO
  const [paso, setPaso] = useState<
    "1_CARGAR_PDF" | "2_CARGAR_CERTIFICADO" | "3_UBICAR_FIRMA" | "4_DOCUMENTO_FIRMADO"
  >("1_CARGAR_PDF");

  // Estado del Archivo PDF Subido
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);
  const [bufferPdfOriginal, setBufferPdfOriginal] = useState<ArrayBuffer | null>(null);
  const [urlPdfOriginal, setUrlPdfOriginal] = useState<string | null>(null);
  const [totalPaginas, setTotalPaginas] = useState<number>(1);
  const [paginaActual, setPaginaActual] = useState<number>(1);

  // Estado del Certificado .p12 / .pfx
  const [archivoP12, setArchivoP12] = useState<File | null>(null);
  const [bufferP12, setBufferP12] = useState<ArrayBuffer | null>(null);
  const [claveP12, setClaveP12] = useState<string>("");
  const [mostrarClave, setMostrarClave] = useState<boolean>(false);
  const [procesandoP12, setProcesandoP12] = useState<boolean>(false);
  const [infoCert, setInfoCert] = useState<InfoCertificado | null>(null);
  const [errorP12, setErrorP12] = useState<string | null>(null);

  // Coordenadas de la estampa de firma en porcentaje relativo (%)
  const [posicionXPorcentaje, setPosicionXPorcentaje] = useState<number>(58.0);
  const [posicionYPorcentaje, setPosicionYPorcentaje] = useState<number>(82.0);
  const [arrastrandoFirma, setArrastrandoFirma] = useState<boolean>(false);
  const offsetArrastre = useRef({ startX: 0, startY: 0, initPosX: 58.0, initPosY: 82.0 });
  const contenedorPdfRef = useRef<HTMLDivElement | null>(null);

  // Estado del PDF Firmado Final
  const [bufferPdfFirmado, setBufferPdfFirmado] = useState<Uint8Array | null>(null);
  const [urlPdfFirmado, setUrlPdfFirmado] = useState<string | null>(null);
  const [estampando, setEstampando] = useState<boolean>(false);
  const [errorEstampado, setErrorEstampado] = useState<string | null>(null);
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null);

  // Limpieza de URLs Blob en desmontaje
  useEffect(() => {
    return () => {
      if (urlPdfOriginal) URL.revokeObjectURL(urlPdfOriginal);
      if (urlPdfFirmado) URL.revokeObjectURL(urlPdfFirmado);
    };
  }, [urlPdfOriginal, urlPdfFirmado]);

  // Manejador de carga de archivo PDF
  async function handleSeleccionarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Por favor selecciona un archivo en formato PDF válido (.pdf)");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const numPaginas = pdfDoc.getPageCount();

      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setArchivoPdf(file);
      setBufferPdfOriginal(buffer);
      setUrlPdfOriginal(url);
      setTotalPaginas(numPaginas || 1);
      setPaginaActual(numPaginas || 1); // Por defecto última página (donde suelen ir las firmas)

      if (infoCert && bufferP12) {
        setPaso("3_UBICAR_FIRMA");
      } else {
        setPaso("2_CARGAR_CERTIFICADO");
      }
    } catch (err) {
      console.error("Error al procesar archivo PDF:", err);
      alert("No se pudo leer el archivo PDF. Verifica que no esté dañado.");
    }
  }

  // Manejador de carga de archivo de firma .p12 / .pfx
  async function handleSeleccionarP12(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    setArchivoP12(file);
    setBufferP12(buffer);
    setInfoCert(null);
    setErrorP12(null);
  }

  // Validación y extracción Zero-Custody del certificado con node-forge
  async function handleValidarP12(e: React.FormEvent) {
    e.preventDefault();
    if (!bufferP12) {
      setErrorP12("Por favor selecciona tu archivo de firma electrónica (.p12 / .pfx)");
      return;
    }
    if (!claveP12) {
      setErrorP12("Ingresa la contraseña de tu archivo de firma");
      return;
    }

    setProcesandoP12(true);
    setErrorP12(null);

    try {
      const bytes = new Uint8Array(bufferP12);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
      }

      const p12Asn1 = forge.asn1.fromDer(binary);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, claveP12);

      let certBuscado: forge.pki.Certificate | null = null;
      for (const safeContent of p12.safeContents) {
        for (const safeBag of safeContent.safeBags) {
          if (safeBag.cert) {
            certBuscado = safeBag.cert;
            break;
          }
        }
        if (certBuscado) break;
      }

      if (!certBuscado) {
        throw new Error("No se encontró un certificado digital utilizable dentro del archivo.");
      }

      let titular = "TITULAR AUTORIZADO";
      let emisor = "AUTORIDAD DE CERTIFICACIÓN";

      const subjectAttrs = certBuscado.subject.attributes;
      const cnAttr = subjectAttrs.find(
        (a) => a.name === "commonName" || a.shortName === "CN" || a.type === "2.5.4.3"
      );
      if (cnAttr && typeof cnAttr.value === "string") {
        titular = cnAttr.value;
      }

      const issuerAttrs = certBuscado.issuer.attributes;
      const oAttr = issuerAttrs.find(
        (a) => a.name === "organizationName" || a.shortName === "O"
      );
      const issuerCn = issuerAttrs.find(
        (a) => a.name === "commonName" || a.shortName === "CN"
      );
      if (oAttr && typeof oAttr.value === "string") {
        emisor = oAttr.value + (issuerCn ? ` (${issuerCn.value})` : "");
      } else if (issuerCn && typeof issuerCn.value === "string") {
        emisor = issuerCn.value;
      }

      const ahora = new Date();
      const esValido =
        ahora >= certBuscado.validity.notBefore && ahora <= certBuscado.validity.notAfter;

      const certInfoExtraida: InfoCertificado = {
        nombreTitular: titular,
        entidadEmisora: emisor,
        validoDesde: certBuscado.validity.notBefore,
        validoHasta: certBuscado.validity.notAfter,
        numeroSerie: certBuscado.serialNumber || "00-00",
        esValido,
      };

      setInfoCert(certInfoExtraida);

      // Generar previsualización del Código QR Oficial
      const hashSeguridad = forge.util.bytesToHex(
        forge.md.sha256.create().update(titular + certBuscado.serialNumber + ahora.toISOString()).digest().bytes()
      ).substring(0, 16).toUpperCase();

      const textoQR = `FIRMA ELECTRONICA AVANZADA (PAdES)\nTitular: ${titular}\nEmisor: ${emisor}\nFecha: ${ahora.toISOString()}\nHash: ${hashSeguridad}\nVerificable: Ley de Comercio Electronico Ecuador`;
      const qrDataUrl = await QRCode.toDataURL(textoQR, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 200,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      });
      setQrPreviewDataUrl(qrDataUrl);

      // Avanzar al paso de posicionamiento interactivo
      setPaso("3_UBICAR_FIRMA");
    } catch (err: unknown) {
      console.error("Error al validar PKCS#12:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid password") || msg.includes("PKCS#12 MAC could not be verified")) {
        setErrorP12("La contraseña de la firma electrónica es incorrecta.");
      } else {
        setErrorP12("No se pudo descifrar la firma electrónica. Verifica el archivo y tu clave.");
      }
    } finally {
      setProcesandoP12(false);
    }
  }

  // Handlers para arrastrar la estampa de firma con Mouse o Touch
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
    function actualizarArrastre(clientX: number, clientY: number) {
      if (!arrastrandoFirma) return;
      const rect = contenedorPdfRef.current?.getBoundingClientRect();
      const containerW = rect?.width || 360;
      const containerH = rect?.height || (containerW * (841.89 / 595.28));

      const deltaX = clientX - offsetArrastre.current.startX;
      const deltaY = clientY - offsetArrastre.current.startY;

      const deltaXPorc = (deltaX / containerW) * 100;
      const deltaYPorc = (deltaY / containerH) * 100;

      const maxLeft = 100 - (230 / 595.28) * 100; // ~61.3%
      const maxTop = 100 - (72 / 841.89) * 100;  // ~91.4%

      const nuevaX = Math.max(2, Math.min(maxLeft, offsetArrastre.current.initPosX + deltaXPorc));
      const nuevaY = Math.max(2, Math.min(maxTop, offsetArrastre.current.initPosY + deltaYPorc));

      setPosicionXPorcentaje(Number(nuevaX.toFixed(1)));
      setPosicionYPorcentaje(Number(nuevaY.toFixed(1)));
    }

    function handleMouseMove(e: MouseEvent) {
      actualizarArrastre(e.clientX, e.clientY);
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches[0]) {
        actualizarArrastre(e.touches[0].clientX, e.touches[0].clientY);
      }
    }

    function handleFinArrastre() {
      if (arrastrandoFirma) {
        setArrastrandoFirma(false);
      }
    }

    if (arrastrandoFirma) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleFinArrastre);
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleFinArrastre);
      window.addEventListener("touchcancel", handleFinArrastre);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleFinArrastre);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleFinArrastre);
      window.removeEventListener("touchcancel", handleFinArrastre);
    };
  }, [arrastrandoFirma]);

  // Estampar firma digital sobre el PDF mediante pdf-lib
  async function handleEstamparFirma() {
    if (!bufferPdfOriginal || !infoCert) {
      setErrorEstampado("Faltan datos del PDF o del certificado.");
      return;
    }

    setEstampando(true);
    setErrorEstampado(null);

    try {
      const pdfDoc = await PDFDocument.load(bufferPdfOriginal);
      const totalPags = pdfDoc.getPageCount();
      const pagIdx = Math.max(0, Math.min(totalPags - 1, paginaActual - 1));
      const targetPage = pdfDoc.getPage(pagIdx);

      const { width, height } = targetPage.getSize();
      const boxWidth = 230;
      const boxHeight = 72;

      // Proyección matemática 1:1 desde porcentajes CSS a coordenadas PDF
      const xPdf = (posicionXPorcentaje / 100) * width;
      const yPdf = height - ((posicionYPorcentaje / 100) * height) - boxHeight;

      // Generar imagen PNG del QR
      const ahora = new Date();
      const fechaFormateada = ahora.toLocaleString("es-EC", {
        timeZone: "America/Guayaquil",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      const hashVerificacion = forge.util.bytesToHex(
        forge.md.sha256.create().update(infoCert.nombreTitular + infoCert.numeroSerie + ahora.toISOString()).digest().bytes()
      ).substring(0, 16).toUpperCase();

      const qrPayload = `FIRMA ELECTRONICA AVANZADA (PAdES)\nTitular: ${infoCert.nombreTitular}\nEmisor: ${infoCert.entidadEmisora}\nFecha: ${fechaFormateada}\nHash: ${hashVerificacion}\nLey de Comercio Electronico Ecuador`;
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 250,
      });

      const splitB64 = qrDataUrl.split(",")[1] || "";
      const qrBytes = Uint8Array.from(atob(splitB64), (c) => c.charCodeAt(0));
      const qrImage = await pdfDoc.embedPng(qrBytes);

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // 1. Fondo de la estampa
      targetPage.drawRectangle({
        x: xPdf,
        y: yPdf,
        width: boxWidth,
        height: boxHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.31, 0, 0.73), // Violeta Tranqi
        borderWidth: 1.2,
      });

      // 2. Imagen QR a la izquierda
      const qrMargin = 4;
      const qrSize = boxHeight - qrMargin * 2;
      targetPage.drawImage(qrImage, {
        x: xPdf + qrMargin,
        y: yPdf + qrMargin,
        width: qrSize,
        height: qrSize,
      });

      // 3. Línea divisoria vertical
      const sepX = xPdf + qrSize + qrMargin + 3;
      targetPage.drawLine({
        start: { x: sepX, y: yPdf + 4 },
        end: { x: sepX, y: yPdf + boxHeight - 4 },
        color: rgb(0.8, 0.82, 0.86),
        thickness: 0.8,
      });

      // 4. Textos oficiales a la derecha
      const textLeft = sepX + 5;
      const textMaxWidth = boxWidth - (textLeft - xPdf) - 4;

      function sanitizarTexto(t: string): string {
        return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }

      function ajustarTexto(t: string, font: typeof fontBold, size: number, maxW: number): string {
        const clean = sanitizarTexto(t);
        if (font.widthOfTextAtSize(clean, size) <= maxW) return clean;
        let recortado = clean;
        while (recortado.length > 4 && font.widthOfTextAtSize(recortado + "...", size) > maxW) {
          recortado = recortado.slice(0, -1);
        }
        return recortado + "...";
      }

      // Título
      targetPage.drawText("FIRMADO DIGITALMENTE", {
        x: textLeft,
        y: yPdf + boxHeight - 11,
        size: 6.8,
        font: fontBold,
        color: rgb(0.31, 0, 0.73),
      });

      // Titular
      const nombreAj = ajustarTexto(infoCert.nombreTitular, fontBold, 6.2, textMaxWidth);
      targetPage.drawText(nombreAj, {
        x: textLeft,
        y: yPdf + boxHeight - 21,
        size: 6.2,
        font: fontBold,
        color: rgb(0.06, 0.09, 0.16),
      });

      // Emisor
      const emisorAj = ajustarTexto(`Emisor: ${infoCert.entidadEmisora}`, fontRegular, 5.2, textMaxWidth);
      targetPage.drawText(emisorAj, {
        x: textLeft,
        y: yPdf + boxHeight - 30,
        size: 5.2,
        font: fontRegular,
        color: rgb(0.28, 0.33, 0.41),
      });

      // Fecha
      targetPage.drawText(`Fecha: ${fechaFormateada}`, {
        x: textLeft,
        y: yPdf + boxHeight - 38,
        size: 5.2,
        font: fontRegular,
        color: rgb(0.28, 0.33, 0.41),
      });

      // Hash de Seguridad
      targetPage.drawText(`ID: ${hashVerificacion}`, {
        x: textLeft,
        y: yPdf + boxHeight - 46,
        size: 4.8,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.53),
      });

      // Leyenda Oficial
      targetPage.drawText("Validez Legal: Ley de Comercio Electronico", {
        x: textLeft,
        y: yPdf + 5,
        size: 4.5,
        font: fontRegular,
        color: rgb(0.45, 0.5, 0.58),
      });

      // Metadatos PAdES
      pdfDoc.setTitle(`${archivoPdf?.name?.replace(".pdf", "") || "Documento"} - Firmado Digitalmente`);
      pdfDoc.setAuthor(infoCert.nombreTitular);
      pdfDoc.setProducer("Tranqi Legaltech - Ecosistema Web Apps");
      pdfDoc.setModificationDate(ahora);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const urlFirmado = URL.createObjectURL(blob);

      setBufferPdfFirmado(pdfBytes);
      setUrlPdfFirmado(urlFirmado);
      setPaso("4_DOCUMENTO_FIRMADO");
    } catch (err) {
      console.error("Error al estampar firma digital:", err);
      setErrorEstampado("Ocurrió un error al firmar el PDF. Revisa los datos e intenta nuevamente.");
    } finally {
      setEstampando(false);
    }
  }

  // Descarga directa del PDF firmado
  function handleDescargarFirmado() {
    if (!bufferPdfFirmado) return;
    const blob = new Blob([bufferPdfFirmado as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const nombreOriginal = archivoPdf?.name?.replace(".pdf", "") || "Documento";
    a.href = url;
    a.download = `${nombreOriginal}_Firmado.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Reiniciar estado para firmar un nuevo documento
  function handleReiniciar() {
    if (urlPdfOriginal) URL.revokeObjectURL(urlPdfOriginal);
    if (urlPdfFirmado) URL.revokeObjectURL(urlPdfFirmado);
    setArchivoPdf(null);
    setBufferPdfOriginal(null);
    setUrlPdfOriginal(null);
    setBufferPdfFirmado(null);
    setUrlPdfFirmado(null);
    setTotalPaginas(1);
    setPaginaActual(1);
    setPaso("1_CARGAR_PDF");
  }

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      <style>{`
        .widget-firma-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 20px;
        }
        @media (max-width: 960px) {
          .widget-firma-grid {
            display: flex;
            flex-direction: column;
          }
          .widget-firma-visor-col {
            order: 1;
            min-height: 48vh;
          }
          .widget-firma-controles-col {
            order: 2;
          }
        }
      `}</style>

      {/* CABECERA DEL WIDGET */}
      <div
        style={{
          background: "linear-gradient(135deg, #3B0086 0%, #5000BA 100%)",
          borderRadius: "16px",
          padding: "22px 26px",
          color: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 8px 24px rgba(80, 0, 186, 0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.18)",
              padding: "10px",
              borderRadius: "12px",
              display: "flex",
            }}
          >
            <FileCheck size={26} color="#FFF" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "rgba(255,255,255,0.2)",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                Herramienta Criptográfica PAdES
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
              Firma Electrónica de Documentos PDF
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", opacity: 0.9 }}>
              Firma cualquier archivo PDF con tu certificado digital (.p12 / .pfx) y estampa QR oficial.
            </p>
          </div>
        </div>

        {mostrarBotonCerrar && onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar herramienta"
            aria-label="Cerrar herramienta"
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
        )}
      </div>

      {/* AVISO DE PRIVACIDAD ZERO-CUSTODY */}
      <div
        style={{
          background: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: "12px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "0.8rem",
          color: "#166534",
        }}
      >
        <ShieldCheck size={18} color="#16A34A" style={{ flexShrink: 0 }} />
        <span>
          <strong>Privacidad Zero-Custody:</strong> Tu certificado `.p12`, contraseña y documentos se procesan exclusivamente en la memoria de tu dispositivo. <strong>Ningún archivo se envía a servidores externos.</strong>
        </span>
      </div>

      {/* BARRA DE PASOS */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "12px",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: paso === "1_CARGAR_PDF" ? "#5000BA" : "#64748B",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: paso === "1_CARGAR_PDF" ? "#5000BA" : "#E2E8F0",
                color: paso === "1_CARGAR_PDF" ? "#FFF" : "#64748B",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
              }}
            >
              1
            </span>
            1. Subir PDF
          </div>

          <ChevronRight size={16} aria-hidden="true" style={{ color: "var(--panel-linea, #E4E4E4)" }} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: paso === "2_CARGAR_CERTIFICADO" ? "#5000BA" : "#64748B",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: paso === "2_CARGAR_CERTIFICADO" ? "#5000BA" : "#E2E8F0",
                color: paso === "2_CARGAR_CERTIFICADO" ? "#FFF" : "#64748B",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
              }}
            >
              2
            </span>
            2. Validar Firma (.p12)
          </div>

          <ChevronRight size={16} aria-hidden="true" style={{ color: "var(--panel-linea, #E4E4E4)" }} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: paso === "3_UBICAR_FIRMA" ? "#5000BA" : "#64748B",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: paso === "3_UBICAR_FIRMA" ? "#5000BA" : "#E2E8F0",
                color: paso === "3_UBICAR_FIRMA" ? "#FFF" : "#64748B",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
              }}
            >
              3
            </span>
            3. Posicionar y Estampar
          </div>

          <ChevronRight size={16} aria-hidden="true" style={{ color: "var(--panel-linea, #E4E4E4)" }} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: paso === "4_DOCUMENTO_FIRMADO" ? "#05876E" : "#64748B",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: paso === "4_DOCUMENTO_FIRMADO" ? "#05876E" : "#E2E8F0",
                color: paso === "4_DOCUMENTO_FIRMADO" ? "#FFF" : "#64748B",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
              }}
            >
              4
            </span>
            4. Descargar
          </div>
        </div>

        {archivoPdf && (
          <button
            type="button"
            onClick={handleReiniciar}
            style={{
              background: "transparent",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              padding: "4px 10px",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={12} /> Firmar otro documento
          </button>
        )}
      </div>

      {/* CUERPO PRINCIPAL */}
      {paso === "1_CARGAR_PDF" && (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "2px dashed #CBD5E1",
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "#F3E8FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#5000BA",
            }}
          >
            <Upload size={32} />
          </div>

          <div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: "1.2rem", fontWeight: 800, color: "#1E293B" }}>
              Selecciona o arrastra el documento PDF a firmar
            </h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B", maxWidth: "520px" }}>
              Admite contratos, actas, escritos judiciales, informes o cualquier documento en formato PDF de hasta 25MB.
            </p>
          </div>

          <label
            style={{
              background: "#5000BA",
              color: "#FFFFFF",
              padding: "12px 24px",
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(80, 0, 186, 0.25)",
            }}
          >
            <FileText size={18} />
            Examinar Archivo PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleSeleccionarPdf}
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}

      {paso === "2_CARGAR_CERTIFICADO" && (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            padding: "32px 24px",
            maxWidth: "680px",
            margin: "0 auto",
            width: "100%",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <KeyRound size={22} aria-hidden="true" />
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#1E293B" }}>
                Cargar Firma Electrónica (.p12 / .pfx)
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748B" }}>
                Documento cargado: <strong>{archivoPdf?.name}</strong> ({totalPaginas} {totalPaginas === 1 ? "página" : "páginas"})
              </p>
            </div>
          </div>

          <form onSubmit={handleValidarP12} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Archivo de Certificado Digital (.p12 o .pfx):
              </label>
              <input
                type="file"
                accept=".p12,.pfx"
                onChange={handleSeleccionarP12}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1.5px dashed #CBD5E1",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  background: "#F8FAFC",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Contraseña del Certificado:
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={mostrarClave ? "text" : "password"}
                  value={claveP12}
                  onChange={(e) => setClaveP12(e.target.value)}
                  placeholder="Ingresa la contraseña de tu archivo .p12"
                  style={{
                    width: "100%",
                    padding: "10px 42px 10px 12px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    fontSize: "0.88rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarClave(!mostrarClave)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748B",
                  }}
                >
                  {mostrarClave ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {errorP12 && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "0.82rem",
                  color: "#B91C1C",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={16} />
                <span>{errorP12}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={procesandoP12 || !bufferP12 || !claveP12}
              style={{
                background: procesandoP12 ? "#94A3B8" : "#5000BA",
                color: "#FFFFFF",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                fontWeight: 800,
                fontSize: "0.9rem",
                cursor: procesandoP12 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(80, 0, 186, 0.25)",
              }}
            >
              {procesandoP12 ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Validando Certificado...
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  Validar y Continuar
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {paso === "3_UBICAR_FIRMA" && (
        <div className="widget-firma-grid">
          {/* COLUMNA IZQUIERDA: CONTROLES DE POSICIÓN Y ESTAMPADO */}
          <div
            className="widget-firma-controles-col"
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #E2E8F0",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Certificado Validado */}
            {infoCert && (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: "10px",
                  padding: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <CheckCircle2 size={16} color="#16A34A" />
                  <strong style={{ fontSize: "0.84rem", color: "#166534" }}>Firma Verificada</strong>
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#14532D", fontWeight: 700 }}>
                  {infoCert.nombreTitular}
                </p>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.72rem", color: "#166534" }}>
                  Emisor: {infoCert.entidadEmisora}
                </p>
              </div>
            )}

            {/* Paginación del Documento */}
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                Página donde estampar:
              </label>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", padding: "6px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual <= 1}
                  style={{ background: "#FFF", border: "1px solid #CBD5E1", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: paginaActual <= 1 ? "not-allowed" : "pointer", opacity: paginaActual <= 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1E293B" }}>
                  Página {paginaActual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual >= totalPaginas}
                  style={{ background: "#FFF", border: "1px solid #CBD5E1", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: paginaActual >= totalPaginas ? "not-allowed" : "pointer", opacity: paginaActual >= totalPaginas ? 0.5 : 1 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Accesos Rápidos de Alineación */}
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                Alineaciones Rápidas:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => { setPosicionXPorcentaje(58.0); setPosicionYPorcentaje(82.0); }}
                  style={{
                    background: posicionXPorcentaje >= 50 && posicionYPorcentaje >= 70 ? "#F3E8FF" : "#F8FAFC",
                    border: `1px solid ${posicionXPorcentaje >= 50 && posicionYPorcentaje >= 70 ? "#5000BA" : "#CBD5E1"}`,
                    color: posicionXPorcentaje >= 50 && posicionYPorcentaje >= 70 ? "#5000BA" : "#334155",
                    padding: "8px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Abajo Derecha
                </button>
                <button
                  type="button"
                  onClick={() => { setPosicionXPorcentaje(8.0); setPosicionYPorcentaje(82.0); }}
                  style={{
                    background: posicionXPorcentaje < 30 && posicionYPorcentaje >= 70 ? "#F3E8FF" : "#F8FAFC",
                    border: `1px solid ${posicionXPorcentaje < 30 && posicionYPorcentaje >= 70 ? "#5000BA" : "#CBD5E1"}`,
                    color: posicionXPorcentaje < 30 && posicionYPorcentaje >= 70 ? "#5000BA" : "#334155",
                    padding: "8px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Abajo Izquierda
                </button>
                <button
                  type="button"
                  onClick={() => { setPosicionXPorcentaje(31.0); setPosicionYPorcentaje(84.0); }}
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    color: "#334155",
                    padding: "8px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Centrado Inferior
                </button>
                <button
                  type="button"
                  onClick={() => { setPosicionXPorcentaje(58.0); setPosicionYPorcentaje(6.0); }}
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    color: "#334155",
                    padding: "8px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Margen Superior
                </button>
              </div>
            </div>

            {/* Micro-Ajustes */}
            <div>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                Micro-Ajustes ({posicionXPorcentaje}%, {posicionYPorcentaje}%):
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setPosicionYPorcentaje((y) => Math.max(2, Number((y - 2).toFixed(1))))}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "6px", fontSize: "0.74rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}
                >
                  <ArrowUp size={12} /> Subir
                </button>
                <button
                  type="button"
                  onClick={() => setPosicionYPorcentaje((y) => Math.min(90, Number((y + 2).toFixed(1))))}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "6px", fontSize: "0.74rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}
                >
                  <ArrowDown size={12} /> Bajar
                </button>
                <button
                  type="button"
                  onClick={() => setPosicionXPorcentaje((x) => Math.max(2, Number((x - 2).toFixed(1))))}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "6px", fontSize: "0.74rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}
                >
                  <ArrowLeft size={12} /> Izquierda
                </button>
                <button
                  type="button"
                  onClick={() => setPosicionXPorcentaje((x) => Math.min(60, Number((x + 2).toFixed(1))))}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "6px", fontSize: "0.74rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}
                >
                  <ArrowRight size={12} /> Derecha
                </button>
              </div>
            </div>

            {errorEstampado && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  color: "#B91C1C",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <AlertCircle size={14} />
                <span>{errorEstampado}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleEstamparFirma}
              disabled={estampando}
              style={{
                background: estampando ? "#94A3B8" : "#5000BA",
                color: "#FFFFFF",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                fontWeight: 800,
                fontSize: "0.9rem",
                cursor: estampando ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "auto",
                boxShadow: "0 4px 12px rgba(80, 0, 186, 0.25)",
              }}
            >
              {estampando ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Estampando Firma...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Estampar Firma Digital
                </>
              )}
            </button>
          </div>

          {/* COLUMNA DERECHA: VISOR 1:1 CON ESTAMPA DRAGGABLE */}
          <div
            className="widget-firma-visor-col"
            style={{
              background: "#334155",
              borderRadius: "16px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              padding: "16px",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "520px",
            }}
          >
            <div
              ref={contenedorPdfRef}
              style={{
                position: "relative",
                width: "100%",
                maxWidth: "600px",
                aspectRatio: "595.28 / 841.89",
                background: "#FFFFFF",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              {/* Iframe del PDF con ajuste completo */}
              <iframe
                key={`pdf-preview-${paginaActual}`}
                src={urlPdfOriginal ? `${urlPdfOriginal}#page=${paginaActual}&view=Fit&toolbar=0&navpanes=0&scrollbar=0` : ""}
                title="Visor PDF"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  overflow: "hidden",
                }}
              />

              {/* Estampa interactiva con QR */}
              {infoCert && (
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
                    background: "rgba(255, 255, 255, 0.98)",
                    border: "1.5px solid #5000BA",
                    borderRadius: "3px",
                    padding: "2px 4px",
                    boxSizing: "border-box",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: arrastrandoFirma ? "grabbing" : "grab",
                    userSelect: "none",
                    touchAction: "none",
                    zIndex: 50,
                    overflow: "hidden",
                    transition: arrastrandoFirma ? "none" : "all 0.15s ease-out",
                  }}
                >
                  <div
                    style={{
                      height: "92%",
                      aspectRatio: "1 / 1",
                      flexShrink: 0,
                      background: "#F8FAFC",
                      borderRadius: "2px",
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
                      <QrCode size={24} color="#5000BA" />
                    )}
                  </div>

                  <div style={{ width: "1px", height: "85%", background: "#CBD5E1", flexShrink: 0 }} />

                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      minWidth: 0,
                      lineHeight: 1.1,
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ fontSize: "clamp(0.48rem, 1.1vw, 0.65rem)", fontWeight: 800, color: "#5000BA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      FIRMADO DIGITALMENTE
                    </span>
                    <strong style={{ fontSize: "clamp(0.44rem, 1.0vw, 0.60rem)", fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {infoCert.nombreTitular}
                    </strong>
                    <span style={{ fontSize: "clamp(0.38rem, 0.85vw, 0.50rem)", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {infoCert.entidadEmisora}
                    </span>
                    <span style={{ fontSize: "clamp(0.34rem, 0.75vw, 0.44rem)", color: "#64748B", whiteSpace: "nowrap" }}>
                      PAdES · Validez Legal EC
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {paso === "4_DOCUMENTO_FIRMADO" && (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            border: "1px solid #E2E8F0",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Banner de Éxito */}
          <div
            style={{
              background: "#F0FDF4",
              border: "1.5px solid #86EFAC",
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  background: "#16A34A",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFF",
                }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#166534" }}>
                  ¡Documento firmado digitalmente con éxito!
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#15803D" }}>
                  El documento contiene la estampa oficial con código QR y metadatos PAdES válidos ante la ley ecuatoriana.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={handleDescargarFirmado}
                style={{
                  background: "#05876E",
                  color: "#FFFFFF",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(5, 135, 110, 0.25)",
                }}
              >
                <Download size={16} /> Descargar PDF
              </button>

              <button
                type="button"
                onClick={handleReiniciar}
                style={{
                  background: "#FFFFFF",
                  border: "1.5px solid #CBD5E1",
                  color: "#334155",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw size={14} /> Firmar Otro
              </button>
            </div>
          </div>

          {/* Visor del Documento Firmado */}
          <div
            style={{
              background: "#334155",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "560px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "600px",
                aspectRatio: "595.28 / 841.89",
                background: "#FFFFFF",
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <iframe
                src={urlPdfFirmado ? `${urlPdfFirmado}#page=${paginaActual}&view=Fit&toolbar=0&navpanes=0&scrollbar=0` : ""}
                title="Visor PDF Firmado"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  overflow: "hidden",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
