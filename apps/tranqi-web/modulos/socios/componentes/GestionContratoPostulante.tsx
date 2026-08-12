"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, UploadCloud, Printer, CheckCircle, AlertCircle, Loader, Download } from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase";
import { registrarDocumentoSocio } from "../acciones";

interface Props {
  solicitud: any;
}

export function GestionContratoPostulante({ solicitud }: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const documentos = solicitud.trq_documento_socio || [];
  const contratoFirmado = documentos.find((d: any) => d.dcs_tipo === "contrato_socio");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Únicamente se permiten archivos en formato PDF.");
      return;
    }

    // Validar tamaño (máximo 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setError("El archivo supera el tamaño máximo permitido de 15 MB.");
      return;
    }

    try {
      setExito(false);
      setError(null);
      setCargando(true);

      const supabase = crearClienteNavegador();
      const uuid = crypto.randomUUID();
      const path = `${solicitud.ssc_id}/contrato_socio-${uuid}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      // 1. Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("socios-documentos")
        .upload(path, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // 2. Registrar en la base de datos
      const res = await registrarDocumentoSocio(
        solicitud.ssc_id,
        "contrato_socio",
        path,
        file.name,
        "Contrato firmado de socio abogado"
      );

      if (!res.ok) {
        throw new Error(res.error);
      }

      setExito(true);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al subir el contrato.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ marginTop: "24px", animation: "fadeIn 0.2s ease" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 16px 0" }}>
        <FileText size={20} color="#5000BA" /> Contrato de Sociedad de Abogados
      </h3>

      {contratoFirmado ? (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <CheckCircle size={24} color="#10B981" style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: "0 0 6px 0", color: "#065F46", fontWeight: 700, fontSize: "0.95rem" }}>
                ¡Contrato firmado cargado exitosamente!
              </h4>
              <p style={{ margin: "0 0 12px 0", color: "#047857", fontSize: "0.85rem", lineHeight: 1.5 }}>
                Tu contrato ha sido registrado y está listo para verificación por parte del equipo de operaciones de tranqi.
              </p>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <a
                  href={contratoFirmado.url}
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
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}
                >
                  <Download size={14} /> Ver Contrato Cargado
                </a>

                <a
                  href={`/panel/solicitud-socio/contrato/imprimir?solicitudId=${solicitud.ssc_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#FFF",
                    color: "#374151",
                    border: "1px solid #D1D5DB",
                    textDecoration: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                  }}
                >
                  <Printer size={14} /> Re-imprimir Plantilla
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
          <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "#4B5563", lineHeight: 1.5 }}>
            Para activar completamente tu acreditación profesional y empezar a recibir asesorías de clientes, debes descargar tu contrato generado, firmarlo y subirlo de vuelta en formato <strong>PDF</strong>.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            <div style={{ fontSize: "0.85rem", color: "#374151" }}>
              <strong>Pasos para formalizar:</strong>
              <ol style={{ paddingLeft: "20px", margin: "6px 0" }}>
                <li style={{ marginBottom: "4px" }}>Descarga e imprime el contrato (puedes guardarlo como PDF para firma digital).</li>
                <li style={{ marginBottom: "4px" }}>Firma de forma manuscrita o digital en la última página del documento.</li>
                <li style={{ marginBottom: "4px" }}>Sube el archivo escaneado o firmado digitalmente en el panel de abajo (formato PDF).</li>
              </ol>
            </div>

            <div>
              <a
                href={`/panel/solicitud-socio/contrato/imprimir?solicitudId=${solicitud.ssc_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#5000BA",
                  color: "#FFF",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  boxShadow: "0 2px 4px rgba(80,0,186,0.15)",
                }}
              >
                <Printer size={16} /> Descargar / Imprimir Contrato
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Dropzone para Subir Contrato */}
      <div style={{
        border: "2px dashed " + (cargando ? "#D1D5DB" : contratoFirmado ? "#10B981" : "#5000BA"),
        borderRadius: "12px",
        padding: "24px",
        textAlign: "center",
        background: cargando ? "#F9FAFB" : contratoFirmado ? "#F0FDF4" : "#F5F3FF",
        position: "relative",
      }}>
        {cargando ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <Loader className="animate-spin" size={32} color="#5000BA" />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#4B5563" }}>Subiendo y registrando contrato...</span>
          </div>
        ) : (
          <div>
            <UploadCloud size={36} color={contratoFirmado ? "#10B981" : "#5000BA"} style={{ margin: "0 auto 8px" }} />
            <h4 style={{ margin: "0 0 4px 0", fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
              {contratoFirmado ? "Reemplazar Contrato Firmado" : "Subir Contrato Firmado (PDF)"}
            </h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.78rem", color: "#6B7280" }}>
              Sube el contrato firmado digitalmente o escaneado. Solo se admite formato PDF. Máx. 15MB.
            </p>
            <label style={{
              display: "inline-block",
              background: "#FFF",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#374151",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}>
              Seleccionar Archivo PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}
      </div>

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
          marginTop: "12px",
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
          marginTop: "12px",
        }}>
          <CheckCircle size={16} />
          ¡Contrato subido exitosamente!
        </div>
      )}
    </div>
  );
}
