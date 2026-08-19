"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UploadCloud,
  Printer,
  CheckCircle,
  AlertCircle,
  Loader,
  Download,
  MessageSquare,
  Send,
  ShieldCheck,
  HelpCircle,
  KeyRound,
  FileCheck2,
  Lock,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase";
import {
  registrarDocumentoSocio,
  enviarObservacionesContratoAction,
} from "../acciones";
import { ModalFirmaDigitalPdf } from "./ModalFirmaDigitalPdf";
import type { InfoCertificado } from "../servicios/servicioFirmaDigital";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  solicitud: any;
}

export function GestionContratoPostulante({ solicitud }: Props) {
  const router = useRouter();
  const [seccionActiva, setSeccionActiva] = useState<"FIRMAR" | "OBSERVACIONES">("FIRMAR");
  const [modalFirmaAbierto, setModalFirmaAbierto] = useState(false);
  const [tipoFirma, setTipoFirma] = useState<"DIGITAL_P12" | "MANUAL_PDF">("DIGITAL_P12");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Estados para Observaciones
  const [textoObservacion, setTextoObservacion] = useState("");
  const [enviandoObs, setEnviandoObs] = useState(false);

  const documentos = solicitud.trq_documento_socio || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contratoFirmado = documentos.find((d: any) => d.dcs_tipo === "contrato_socio");

  const urlPdfOriginal = `/api/solicitud-socio/contrato/pdf?solicitudId=${solicitud.ssc_id}`;

  // Manejo de Finalización de Firma Electrónica (.p12)
  async function handleFirmaDigitalCompletada(pdfBytes: Uint8Array, nombreArchivo: string, infoCert: InfoCertificado) {
    try {
      setCargando(true);
      setError(null);
      setExito(null);

      const supabase = crearClienteNavegador();
      const uuid = crypto.randomUUID();
      const path = `${solicitud.ssc_id}/contrato_firmado_digital-${uuid}-${nombreArchivo}`;

      // Convertir Uint8Array a Blob
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

      const { error: uploadError } = await supabase.storage
        .from("socios-documentos")
        .upload(path, blob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const comentario = `Contrato firmado digitalmente por ${infoCert.nombreTitular} (${infoCert.entidadEmisora}) el ${new Date().toLocaleString("es-EC")}`;

      const res = await registrarDocumentoSocio(
        solicitud.ssc_id,
        "contrato_socio",
        path,
        nombreArchivo,
        comentario
      );

      if (!res.ok) throw new Error(res.error);

      setModalFirmaAbierto(false);
      setExito("🎉 ¡Contrato firmado digitalmente y enviado con éxito! El equipo de tranqi verificará y contra-firmará el documento para la activación definitiva.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar el contrato firmado");
    } finally {
      setCargando(false);
    }
  }

  // Manejo de Carga de Contrato Firmado Manual (Solo PDF)
  async function handleFileChangePDF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    const esPdf = file.type === "application/pdf" || ext.endsWith(".pdf");

    if (!esPdf) {
      setError("Para la aprobación definitiva solo se admite formato PDF (.pdf).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("El archivo supera el tamaño máximo permitido de 15 MB.");
      return;
    }

    try {
      setExito(null);
      setError(null);
      setCargando(true);

      const supabase = crearClienteNavegador();
      const uuid = crypto.randomUUID();
      const path = `${solicitud.ssc_id}/contrato_socio_firmado-${uuid}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage
        .from("socios-documentos")
        .upload(path, file);

      if (uploadError) throw new Error(uploadError.message);

      const res = await registrarDocumentoSocio(
        solicitud.ssc_id,
        "contrato_socio",
        path,
        file.name,
        "Contrato firmado manualmente / escaneado para aprobación definitiva (PDF)"
      );

      if (!res.ok) throw new Error(res.error);

      setExito("¡Contrato firmado (PDF) cargado exitosamente! El equipo de operaciones verificará el documento para la contra-firma y activación formal.");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error al subir el contrato.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }

  // Manejo de Envío de Observaciones (Sin Aceptar)
  async function handleEnviarObservaciones(e: React.FormEvent) {
    e.preventDefault();
    if (!textoObservacion.trim() || textoObservacion.trim().length < 5) {
      setError("Por favor escribe tus observaciones detalladas (mínimo 5 caracteres).");
      return;
    }

    try {
      setEnviandoObs(true);
      setError(null);
      setExito(null);

      const res = await enviarObservacionesContratoAction(solicitud.ssc_id, textoObservacion.trim());

      if (!res.ok) {
        throw new Error(res.error);
      }

      setExito("💬 ¡Tus observaciones han sido enviadas al equipo de operaciones de tranqi! Un operador revisará tu solicitud y emitirá una nueva versión ajustada.");
      setTextoObservacion("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar observaciones");
    } finally {
      setEnviandoObs(false);
    }
  }

  return (
    <div style={{ marginTop: "24px", animation: "fadeIn 0.2s ease" }}>
      {/* Encabezado Principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
          <FileText size={22} color="#05876E" /> Contrato de Sociedad de Abogados
        </h3>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <a
            href={urlPdfOriginal}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#05876E",
              color: "#FFF",
              textDecoration: "none",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 700,
              boxShadow: "0 2px 4px rgba(5,135,110,0.2)",
            }}
          >
            <Download size={14} /> Ver / Descargar PDF Oficial
          </a>

          <a
            href={`/panel/solicitud-socio/contrato/imprimir?solicitudId=${solicitud.ssc_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#F3F4F6",
              color: "#374151",
              border: "1px solid #D1D5DB",
              textDecoration: "none",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <Printer size={14} /> Imprimir
          </a>
        </div>
      </div>

      {contratoFirmado && (
        <div style={{ background: "#ECFDF5", border: "1.5px solid #10B981", borderRadius: "12px", padding: "18px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <CheckCircle size={24} color="#05876E" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ flexGrow: 1 }}>
              <h4 style={{ margin: "0 0 4px 0", color: "#065F46", fontWeight: 800, fontSize: "0.98rem" }}>
                ¡Contrato firmado registrado correctamente!
              </h4>
              <p style={{ margin: "0 0 10px 0", color: "#047857", fontSize: "0.86rem", lineHeight: 1.5 }}>
                Archivo: <strong>"{contratoFirmado.dcs_nombre_archivo || "Contrato_Tranqi_Firmado.pdf"}"</strong>.
                El equipo legal de tranqi está revisando el documento para efectuar la contra-firma institucional y activar tus credenciales.
              </p>
              <a
                href={`/api/solicitud-socio/contrato/firmado?solicitudId=${solicitud.ssc_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#05876E",
                  color: "#FFF",
                  textDecoration: "none",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                <Download size={14} /> Ver / Descargar Contrato Firmado (PDF)
              </a>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #F87171", borderRadius: "10px", padding: "12px", color: "#B91C1C", fontSize: "0.86rem", marginBottom: "16px", display: "flex", gap: "8px" }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>{error}</span>
        </div>
      )}

      {exito && (
        <div style={{ background: "#F0FDF4", border: "1px solid #4ADE80", borderRadius: "10px", padding: "12px", color: "#15803D", fontSize: "0.86rem", marginBottom: "16px", display: "flex", gap: "8px" }}>
          <CheckCircle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>{exito}</span>
        </div>
      )}

      {/* Selector de Acciones del Solicitante */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setSeccionActiva("FIRMAR")}
          style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: "12px",
            border: `2px solid ${seccionActiva === "FIRMAR" ? "#05876E" : "#E5E7EB"}`,
            background: seccionActiva === "FIRMAR" ? "#F0FDF4" : "#FFFFFF",
            color: seccionActiva === "FIRMAR" ? "#065F46" : "#4B5563",
            fontWeight: 800,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: seccionActiva === "FIRMAR" ? "0 4px 12px rgba(5, 135, 110, 0.15)" : "none",
          }}
        >
          <FileCheck2 size={20} color={seccionActiva === "FIRMAR" ? "#05876E" : "#9CA3AF"} />
          Opción 1: Aceptar y Firmar Contrato
        </button>

        <button
          type="button"
          onClick={() => setSeccionActiva("OBSERVACIONES")}
          style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: "12px",
            border: `2px solid ${seccionActiva === "OBSERVACIONES" ? "#D97706" : "#E5E7EB"}`,
            background: seccionActiva === "OBSERVACIONES" ? "#FFFBEB" : "#FFFFFF",
            color: seccionActiva === "OBSERVACIONES" ? "#92400E" : "#4B5563",
            fontWeight: 800,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: seccionActiva === "OBSERVACIONES" ? "0 4px 12px rgba(217, 119, 6, 0.15)" : "none",
          }}
        >
          <MessageSquare size={20} color={seccionActiva === "OBSERVACIONES" ? "#D97706" : "#9CA3AF"} />
          Opción 2: Enviar Comentarios / Observaciones
        </button>
      </div>

      {/* SECCIÓN 1: ACEPTAR Y FIRMAR */}
      {seccionActiva === "FIRMAR" && (
        <div style={{ background: "#FFFFFF", border: "1.5px solid #E5E7EB", borderRadius: "14px", padding: "20px" }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => setTipoFirma("DIGITAL_P12")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: tipoFirma === "DIGITAL_P12" ? "#05876E" : "#F3F4F6",
                color: tipoFirma === "DIGITAL_P12" ? "#FFFFFF" : "#4B5563",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <KeyRound size={14} />
              Firma Electrónica (.p12) con QR Oficial
            </button>

            <button
              type="button"
              onClick={() => setTipoFirma("MANUAL_PDF")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: tipoFirma === "MANUAL_PDF" ? "#05876E" : "#F3F4F6",
                color: tipoFirma === "MANUAL_PDF" ? "#FFFFFF" : "#4B5563",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <UploadCloud size={14} />
              Cargar PDF Firmado y Escaneado
            </button>
          </div>

          {tipoFirma === "DIGITAL_P12" ? (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "18px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "12px" }}>
                <ShieldCheck size={24} color="#05876E" />
                <div>
                  <h4 style={{ margin: "0 0 4px 0", color: "#1E293B", fontWeight: 800, fontSize: "0.95rem" }}>
                    Firma Electrónica PAdES con Estampa de QR Oficial
                  </h4>
                  <p style={{ margin: 0, color: "#64748B", fontSize: "0.82rem", lineHeight: 1.45 }}>
                    Firma directamente desde tu navegador utilizando tu archivo de firma electrónica (.p12 / .pfx) emitido por Security Data, Banco Central del Ecuador, Consejo de la Judicatura o ANFAC.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setModalFirmaAbierto(true)}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #05876E 0%, #047857 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: 800,
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(5, 135, 110, 0.25)",
                  }}
                >
                  <KeyRound size={18} />
                  Abrir Asistente de Firma Electrónica (.p12)
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "18px" }}>
              <h4 style={{ margin: "0 0 6px 0", color: "#1E293B", fontWeight: 800, fontSize: "0.95rem" }}>
                Subir PDF Firmado Manuscrito / Escaneado
              </h4>
              <p style={{ margin: "0 0 12px 0", color: "#64748B", fontSize: "0.82rem" }}>
                Descarga el contrato oficial en PDF, imprímelo, fírmalo manualmente, escanéalo y súbelo aquí en formato PDF.
              </p>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px",
                  border: "2px dashed #CBD5E1",
                  borderRadius: "10px",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <UploadCloud size={32} color="#05876E" />
                <span style={{ marginTop: "8px", fontSize: "0.88rem", fontWeight: 700, color: "#1E293B" }}>
                  Haz clic para seleccionar el archivo PDF firmado
                </span>
                <span style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "2px" }}>
                  Máximo 15 MB · Solo archivos .pdf
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChangePDF}
                  style={{ display: "none" }}
                  disabled={cargando}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: ENVIAR OBSERVACIONES */}
      {seccionActiva === "OBSERVACIONES" && (
        <form onSubmit={handleEnviarObservaciones} style={{ background: "#FFFFFF", border: "1.5px solid #FCD34D", borderRadius: "14px", padding: "20px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "14px" }}>
            <MessageSquare size={24} color="#D97706" />
            <div>
              <h4 style={{ margin: "0 0 4px 0", color: "#92400E", fontWeight: 800, fontSize: "0.98rem" }}>
                Observaciones y Comentarios al Contrato
              </h4>
              <p style={{ margin: 0, color: "#78350F", fontSize: "0.82rem" }}>
                Si requieres ajustar alguna cláusula, porcentaje u obligación antes de firmar, describe tus motivos aquí. Se notificará de inmediato al operador de tranqi para que ajuste el contrato.
              </p>
            </div>
          </div>

          <textarea
            value={textoObservacion}
            onChange={(e) => setTextoObservacion(e.target.value)}
            rows={5}
            placeholder="Ejemplo: Solicito revisar la cláusula quinta referente al porcentaje de retención en casos corporativos..."
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.88rem",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "14px",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={enviandoObs}
              style={{
                padding: "12px 22px",
                background: "#D97706",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "0.88rem",
                cursor: enviandoObs ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(217, 119, 6, 0.2)",
              }}
            >
              {enviandoObs ? (
                <>
                  <Loader size={16} className="animate-spin" /> Enviando observaciones...
                </>
              ) : (
                <>
                  <Send size={16} /> Enviar Observaciones al Operador
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Modal de Firma Digital Zero-Custody */}
      <ModalFirmaDigitalPdf
        abierto={modalFirmaAbierto}
        onCerrar={() => setModalFirmaAbierto(false)}
        urlPdfOriginal={urlPdfOriginal}
        solicitudId={solicitud.ssc_id}
        rolFirmante="ABOGADO_POSTULANTE"
        onFirmaCompletada={handleFirmaDigitalCompletada}
      />
    </div>
  );
}
