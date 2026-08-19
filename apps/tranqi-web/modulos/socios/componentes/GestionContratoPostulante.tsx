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
} from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase";
import { registrarDocumentoSocio, enviarPropuestaModificacionContratoAction } from "../acciones";
import { ModalFirmaDigitalPdf } from "./ModalFirmaDigitalPdf";
import type { InfoCertificado } from "../servicios/servicioFirmaDigital";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  solicitud: any;
}

export function GestionContratoPostulante({ solicitud }: Props) {
  const router = useRouter();
  const [pestanaActiva, setPestanaActiva] = useState<"DIGITAL_P12" | "MANUAL_PDF" | "PROPUESTA_WORD">("DIGITAL_P12");
  const [modalFirmaAbierto, setModalFirmaAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Estados para Propuesta Word
  const [archivoWord, setArchivoWord] = useState<File | null>(null);
  const [comentarioWord, setComentarioWord] = useState("");

  const documentos = solicitud.trq_documento_socio || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contratoFirmado = documentos.find((d: any) => d.dcs_tipo === "contrato_socio");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propuestasWord = documentos.filter((d: any) => d.dcs_comentario?.includes("[PROPUESTA_MODIFICACION_CONTRATO]"));

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
      setError("Para la aprobación y firma definitiva solo se admite formato PDF (.pdf). Si deseas proponer cambios en Word, usa la pestaña 'Propuesta de Modificación'.");
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

  // Manejo de Envío de Propuesta de Modificación (Word .docx con Comentario Obligatorio)
  async function handleEnviarPropuestaWord(e: React.FormEvent) {
    e.preventDefault();
    if (!archivoWord) {
      setError("Por favor selecciona un archivo en formato Word (.docx o .doc).");
      return;
    }
    if (!comentarioWord.trim() || comentarioWord.trim().length < 5) {
      setError("El campo de explicación / motivo de las modificaciones propuestas es obligatorio (mínimo 5 caracteres).");
      return;
    }

    try {
      setExito(null);
      setError(null);
      setCargando(true);

      const supabase = crearClienteNavegador();
      const uuid = crypto.randomUUID();
      const path = `${solicitud.ssc_id}/propuesta_contrato-${uuid}-${archivoWord.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const { error: uploadError } = await supabase.storage
        .from("socios-documentos")
        .upload(path, archivoWord);

      if (uploadError) throw new Error(uploadError.message);

      const res = await enviarPropuestaModificacionContratoAction({
        solicitudId: solicitud.ssc_id,
        path,
        nombreArchivo: archivoWord.name,
        comentario: comentarioWord.trim(),
      });

      if (!res.ok) throw new Error(res.error);

      setExito("¡Propuesta de modificación y comentarios enviados al equipo legal! Un operador revisará tus observaciones y emitirá comentarios en el historial.");
      setArchivoWord(null);
      setComentarioWord("");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al enviar la propuesta.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ marginTop: "24px", animation: "fadeIn 0.2s ease" }}>
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
            <Download size={14} /> Descargar PDF Pre-llenado
          </a>

          <a
            href={`/api/solicitud-socio/contrato/descargar?solicitudId=${solicitud.ssc_id}`}
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
            <Download size={14} /> Descargar Word (.docx)
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

      {/* Selector de Pestañas: 1. Firma Digital (.p12) vs 2. Firma Manual (PDF) vs 3. Propuesta Word */}
      <div style={{ display: "flex", borderBottom: "2px solid #E5E7EB", marginBottom: "20px", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => { setPestanaActiva("DIGITAL_P12"); setError(null); }}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: pestanaActiva === "DIGITAL_P12" ? "3px solid #05876E" : "3px solid transparent",
            color: pestanaActiva === "DIGITAL_P12" ? "#05876E" : "#6B7280",
            fontWeight: pestanaActiva === "DIGITAL_P12" ? 800 : 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "-2px"
          }}
        >
          <ShieldCheck size={18} /> 1. Firmar Digitalmente en Línea (.p12)
        </button>

        <button
          type="button"
          onClick={() => { setPestanaActiva("MANUAL_PDF"); setError(null); }}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: pestanaActiva === "MANUAL_PDF" ? "3px solid #05876E" : "3px solid transparent",
            color: pestanaActiva === "MANUAL_PDF" ? "#05876E" : "#6B7280",
            fontWeight: pestanaActiva === "MANUAL_PDF" ? 800 : 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "-2px"
          }}
        >
          <UploadCloud size={18} /> 2. Firma Manual / Escaneo Físico (PDF)
        </button>

        <button
          type="button"
          onClick={() => { setPestanaActiva("PROPUESTA_WORD"); setError(null); }}
          style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: pestanaActiva === "PROPUESTA_WORD" ? "3px solid #5000BA" : "3px solid transparent",
            color: pestanaActiva === "PROPUESTA_WORD" ? "#5000BA" : "#6B7280",
            fontWeight: pestanaActiva === "PROPUESTA_WORD" ? 800 : 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "-2px"
          }}
        >
          <MessageSquare size={18} /> 3. Propuesta de Modificación (Word)
        </button>
      </div>

      {/* PESTAÑA 1: Firma Digital Electrónica (.p12) en el Navegador */}
      {pestanaActiva === "DIGITAL_P12" && (
        <div
          style={{
            background: "linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)",
            border: "2px solid #10B981",
            borderRadius: "14px",
            padding: "24px",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ background: "#05876E", color: "#FFF", padding: "8px", borderRadius: "10px", display: "flex" }}>
              <KeyRound size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#065F46" }}>
                Firma Electrónica Directa en Pantalla (Recomendado)
              </h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#047857" }}>
                Firma tu contrato de sociedad en segundos con tu archivo <code>.p12</code> o <code>.pfx</code>.
              </p>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #D1FAE5", borderRadius: "10px", padding: "16px", margin: "16px 0" }}>
            <h5 style={{ margin: "0 0 8px 0", fontSize: "0.86rem", fontWeight: 800, color: "#111827" }}>
              ¿Qué necesitas para firmar digitalmente?
            </h5>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.82rem", color: "#374151", lineHeight: 1.6 }}>
              <li>Tener tu archivo de firma electrónica (<code>.p12</code> o <code>.pfx</code>) en este dispositivo.</li>
              <li>Conocer la contraseña de tu certificado.</li>
              <li>
                <strong>Cero Custodia (Zero-Custody):</strong> Tu clave y firma se procesan exclusivamente en este navegador. Nunca se guardan ni viajan a nuestros servidores.
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setModalFirmaAbierto(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#05876E",
              color: "#FFFFFF",
              borderRadius: "10px",
              padding: "12px 24px",
              fontSize: "0.92rem",
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(5, 135, 110, 0.25)",
              transition: "transform 0.15s ease",
            }}
          >
            <FileCheck2 size={18} /> Iniciar Firma Electrónica (.p12)
          </button>
        </div>
      )}

      {/* PESTAÑA 2: Carga de Contrato Firmado Manualmente (Solo PDF) */}
      {pestanaActiva === "MANUAL_PDF" && (
        <div style={{
          border: "2px dashed " + (cargando ? "#D1D5DB" : contratoFirmado ? "#10B981" : "#05876E"),
          borderRadius: "14px",
          padding: "26px",
          textAlign: "center",
          background: cargando ? "#F9FAFB" : "#F0FDF4",
        }}>
          {cargando ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <Loader className="animate-spin" size={32} color="#05876E" />
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#065F46" }}>Registrando contrato firmado...</span>
            </div>
          ) : (
            <div>
              <UploadCloud size={38} color="#05876E" style={{ margin: "0 auto 8px" }} />
              <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", fontWeight: 800, color: "#065F46" }}>
                {contratoFirmado ? "Reemplazar Contrato Firmado (PDF)" : "Cargar Contrato Firmado Físico / Externo (PDF)"}
              </h4>
              <p style={{ margin: "0 0 16px 0", fontSize: "0.82rem", color: "#047857", maxWidth: "550px", marginInline: "auto", lineHeight: 1.45 }}>
                Descarga el PDF o Word, fírmalo manuscrita o con tu software externo (ej. FirmaEC), escanéalo y sube el archivo resultante en formato <strong>PDF</strong>.
              </p>
              <label style={{
                display: "inline-block",
                background: "#05876E",
                color: "#FFFFFF",
                borderRadius: "8px",
                padding: "8px 18px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(5,135,110,0.25)",
              }}>
                Seleccionar Archivo PDF Firmado
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChangePDF}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: Envío de Propuesta de Modificación en Word con Comentario Obligatorio */}
      {pestanaActiva === "PROPUESTA_WORD" && (
        <form onSubmit={handleEnviarPropuestaWord} style={{
          background: "#FAF5FF",
          border: "1.5px solid #D8B4FE",
          borderRadius: "14px",
          padding: "24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", color: "#5000BA" }}>
            <HelpCircle size={20} />
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
              Enviar Observaciones o Propuesta de Cambios a las Cláusulas
            </h4>
          </div>
          <p style={{ fontSize: "0.82rem", color: "#6B21A8", marginTop: 0, marginBottom: "16px", lineHeight: 1.45 }}>
            Si deseas proponer modificaciones al contrato de servicios, adjunta el documento en Word (<code>.docx</code> o <code>.doc</code>) con control de cambios o comentarios e ingresa obligatoriamente el motivo para revisión del equipo legal.
          </p>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
              1. Documento Word con Propuesta de Cambios (.docx / .doc) <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="file"
              accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const ext = f.name.toLowerCase();
                  if (!ext.endsWith(".docx") && !ext.endsWith(".doc")) {
                    setError("En esta sección solo se admiten archivos en formato Word (.docx, .doc).");
                    setArchivoWord(null);
                  } else {
                    setError(null);
                    setArchivoWord(f);
                  }
                }
              }}
              style={{
                width: "100%",
                padding: "8px",
                background: "#FFF",
                border: "1px solid #D1D5DB",
                borderRadius: "6px",
                fontSize: "0.82rem",
              }}
            />
            {archivoWord && (
              <span style={{ fontSize: "0.78rem", color: "#5000BA", fontWeight: 700, marginTop: "4px", display: "inline-block" }}>
                ✓ Archivo seleccionado: {archivoWord.name} ({(archivoWord.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#374151", marginBottom: "6px" }}>
              2. Explicación / Motivo de las modificaciones propuestas <span style={{ color: "#DC2626" }}>* (Obligatorio)</span>
            </label>
            <textarea
              required
              rows={4}
              value={comentarioWord}
              onChange={(e) => setComentarioWord(e.target.value)}
              placeholder="Explica detalladamente qué cláusulas deseas ajustar, observaciones o motivos..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1.5px solid #D1D5DB",
                fontSize: "0.85rem",
                fontFamily: "inherit",
                lineHeight: 1.45,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <button
            type="submit"
            disabled={cargando || !archivoWord || !comentarioWord.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#5000BA",
              color: "#FFF",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "0.88rem",
              fontWeight: 800,
              cursor: (cargando || !archivoWord || !comentarioWord.trim()) ? "not-allowed" : "pointer",
              opacity: (cargando || !archivoWord || !comentarioWord.trim()) ? 0.6 : 1,
              boxShadow: "0 2px 6px rgba(80,0,186,0.2)",
            }}
          >
            {cargando ? <Loader className="animate-spin" size={16} /> : <Send size={16} />}
            Enviar Propuesta de Contrato a Revisión Legal
          </button>
        </form>
      )}

      {/* Historial de Propuestas Previas */}
      {propuestasWord.length > 0 && (
        <div style={{ marginTop: "20px", padding: "16px", background: "#F9FAFB", borderRadius: "10px", border: "1px solid #E5E7EB" }}>
          <h5 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", fontWeight: 800, color: "#374151" }}>
            Historial de Versiones y Propuestas de Contrato Enviadas:
          </h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {propuestasWord.map((p: any, idx: number) => (
              <div key={p.dcs_id || idx} style={{ padding: "10px 12px", background: "#FFF", borderRadius: "6px", border: "1px solid #E5E7EB", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 700, color: "#5000BA" }}>
                    📝 Versión {idx + 1}: {p.dcs_nombre_archivo}
                  </span>
                  <span style={{ fontSize: "0.74rem", color: "#9CA3AF" }}>
                    {new Date(p.dcs_creado_en).toLocaleString("es-EC")}
                  </span>
                </div>
                <p style={{ margin: "4px 0", color: "#4B5563" }}>
                  {p.dcs_comentario?.replace("[PROPUESTA_MODIFICACION_CONTRATO]", "").trim()}
                </p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "#05876E", fontWeight: 700, textDecoration: "none", fontSize: "0.78rem" }}>
                    Descargar Archivo Adjunto →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#FEF2F2",
          border: "1px solid #EF4444",
          borderRadius: "8px",
          padding: "10px 14px",
          color: "#991B1B",
          fontSize: "0.82rem",
          marginTop: "14px",
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {exito && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#ECFDF5",
          border: "1px solid #10B981",
          borderRadius: "8px",
          padding: "10px 14px",
          color: "#065F46",
          fontSize: "0.82rem",
          marginTop: "14px",
        }}>
          <CheckCircle size={16} />
          {exito}
        </div>
      )}

      {/* Modal de Firma Electrónica (.p12) Zero-Custody */}
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
