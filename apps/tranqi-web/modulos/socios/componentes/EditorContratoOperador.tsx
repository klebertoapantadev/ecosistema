"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileEdit,
  Eye,
  Download,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  MessageSquare,
  User,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { guardarYEnviarVersionContratoAction } from "../acciones";
import type { VersionContratoSocio } from "../consultas";

interface EditorContratoOperadorProps {
  solicitudId: string;
  nombrePostulante: string;
  cedulaPostulante: string;
  versionInicial: number;
  tituloInicial: string;
  contenidoInicial: string;
  historialVersiones: VersionContratoSocio[];
  inicialmenteColapsado?: boolean;
}

export function EditorContratoOperador({
  solicitudId,
  nombrePostulante,
  cedulaPostulante,
  versionInicial,
  tituloInicial,
  contenidoInicial,
  historialVersiones,
  inicialmenteColapsado = false,
}: EditorContratoOperadorProps) {
  const router = useRouter();
  const [panelAbierto, setPanelAbierto] = useState(!inicialmenteColapsado);
  const [modo, setModo] = useState<"EDITAR" | "PREVIEW">("EDITAR");
  const [titulo, setTitulo] = useState(tituloInicial);
  const [contenidoMd, setContenidoMd] = useState(contenidoInicial);
  const [comentarioOperador, setComentarioOperador] = useState("");

  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [urlPdfPreview, setUrlPdfPreview] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Siguiente número de versión que se generará
  const siguienteVersion = historialVersiones.length > 0
    ? Math.max(...historialVersiones.map((v) => v.vcs_numero_version)) + 1
    : 1;

  // Generar preview en PDF al cambiar a modo PREVIEW
  async function handleGenerarPreviewPdf() {
    try {
      setCargandoPreview(true);
      setError(null);
      const res = await fetch("/api/solicitud-socio/contrato/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          solicitudId,
          titulo,
          contenidoMd,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error al generar borrador PDF (${res.status})`);
      }

      const buffer = await res.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/pdf" });
      if (urlPdfPreview) URL.revokeObjectURL(urlPdfPreview);
      const urlBlob = URL.createObjectURL(blob);
      setUrlPdfPreview(urlBlob);
      setModo("PREVIEW");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al generar vista previa");
    } finally {
      setCargandoPreview(false);
    }
  }

  // Descargar borrador PDF en la máquina
  function handleDescargarBorrador() {
    if (!urlPdfPreview) return;
    const a = document.createElement("a");
    a.href = urlPdfPreview;
    a.download = `Borrador_Contrato_v${siguienteVersion}_${cedulaPostulante}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Guardar y emitir contrato vN
  async function handleEmitirContrato() {
    if (!contenidoMd.trim()) {
      setError("El contenido del contrato no puede estar vacío.");
      return;
    }

    if (inicialmenteColapsado && !comentarioOperador.trim()) {
      setError("Por favor ingresa un comentario o justificación para el postulante antes de reenviar.");
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      setExito(null);

      const res = await guardarYEnviarVersionContratoAction(
        solicitudId,
        titulo,
        contenidoMd,
        comentarioOperador
      );

      if (!res.ok) {
        throw new Error(res.error);
      }

      setExito(`🎉 ¡Contrato Versión ${res.data.numeroVersion} emitido y enviado al postulante exitosamente!`);
      setComentarioOperador("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al emitir contrato");
    } finally {
      setGuardando(false);
    }
  }

  // Cargar una versión anterior en el editor
  function handleCargarVersionAnterior(v: VersionContratoSocio) {
    setTitulo(v.vcs_titulo);
    setContenidoMd(v.vcs_contenido_md);
    setModo("EDITAR");
    setExito(`Se cargó el texto de la Versión ${v.vcs_numero_version} en el editor.`);
  }

  if (!panelAbierto) {
    return (
      <div
        style={{
          background: "#F8FAFC",
          border: "1.5px solid #E2E8F0",
          borderRadius: "14px",
          padding: "16px 20px",
          marginTop: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "#EDE9FE", padding: "8px", borderRadius: "8px", color: "#6D28D9" }}>
            <FileEdit size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#1E293B" }}>
              Reenviar Contrato con Modificaciones
            </h4>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "#64748B" }}>
              Si requieres ajustar cláusulas tras la firma del postulante, abre el editor para emitir la <strong>Versión {siguienteVersion}</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelAbierto(true)}
          style={{
            padding: "8px 16px",
            background: "#FFFFFF",
            color: "#5000BA",
            border: "1.5px solid #5000BA",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "0.82rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <FileEdit size={14} />
          Editar y Reenviar Contrato
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1.5px solid #E2E8F0",
        borderRadius: "16px",
        padding: "22px 26px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
        marginTop: "20px",
      }}
    >
      {/* Encabezado del Editor */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid #F1F5F9", paddingBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "#EDE9FE", padding: "10px", borderRadius: "10px", color: "#6D28D9" }}>
            <FileEdit size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#1E293B" }}>
              Personalización y Emisión del Contrato (Markdown .MD)
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#64748B" }}>
              Edita las cláusulas específicas para <strong>{nombrePostulante}</strong>, previsualiza el PDF en tiempo real y emite la <strong>Versión {siguienteVersion}</strong> para firma.
            </p>
          </div>
        </div>

        {/* Pestañas de modo */}
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "3px", gap: "4px" }}>
          <button
            type="button"
            onClick={() => setModo("EDITAR")}
            style={{
              padding: "6px 14px",
              background: modo === "EDITAR" ? "#FFFFFF" : "transparent",
              color: modo === "EDITAR" ? "#5000BA" : "#64748B",
              fontWeight: 700,
              fontSize: "0.82rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow: modo === "EDITAR" ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            ✏️ Editor Markdown
          </button>

          <button
            type="button"
            onClick={handleGenerarPreviewPdf}
            disabled={cargandoPreview}
            style={{
              padding: "6px 14px",
              background: modo === "PREVIEW" ? "#FFFFFF" : "transparent",
              color: modo === "PREVIEW" ? "#5000BA" : "#64748B",
              fontWeight: 700,
              fontSize: "0.82rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              boxShadow: modo === "PREVIEW" ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {cargandoPreview ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            👁️ Vista Previa PDF
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", color: "#991B1B", fontSize: "0.82rem", marginBottom: "14px", display: "flex", gap: "8px" }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>{error}</div>
        </div>
      )}

      {exito && (
        <div style={{ padding: "10px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", color: "#166534", fontSize: "0.82rem", marginBottom: "14px", display: "flex", gap: "8px" }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>{exito}</div>
        </div>
      )}

      {/* Vista de Edición */}
      {modo === "EDITAR" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Título Oficial del Contrato:
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.88rem",
                fontWeight: 600,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                Cláusulas del Contrato (Markdown .MD):
              </label>
              <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                Variables disponibles: <code>{"{{nombre_completo}}"}</code>, <code>{"{{cedula}}"}</code>
              </span>
            </div>
            <textarea
              value={contenidoMd}
              onChange={(e) => setContenidoMd(e.target.value)}
              rows={14}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                lineHeight: 1.45,
                outline: "none",
                boxSizing: "border-box",
                background: "#FAFAFA",
              }}
            />
          </div>
        </div>
      )}

      {/* Vista Previa PDF */}
      {modo === "PREVIEW" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>
              Borrador Vectorial generado para: <strong>{nombrePostulante}</strong>
            </span>
            <button
              type="button"
              onClick={handleDescargarBorrador}
              style={{
                padding: "6px 12px",
                background: "#F1F5F9",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                color: "#1E293B",
                fontWeight: 700,
                fontSize: "0.78rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Download size={14} color="#047857" />
              Descargar Borrador en PDF
            </button>
          </div>

          <div style={{ width: "100%", height: "550px", borderRadius: "10px", overflow: "hidden", border: "1px solid #CBD5E1", background: "#334155" }}>
            {urlPdfPreview ? (
              <iframe
                src={`${urlPdfPreview}#toolbar=0&navpanes=0`}
                title="Preview Contrato"
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            ) : (
              <div style={{ color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                Cargando vista previa...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel de Emisión y Comentarios del Operador */}
      <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
          Nota o Justificación de la Versión {siguienteVersion} (se notificará al solicitante):
        </label>
        <input
          type="text"
          value={comentarioOperador}
          onChange={(e) => setComentarioOperador(e.target.value)}
          placeholder="Ej: Se ajustó el porcentaje de comisión al 15% conforme a lo conversado..."
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #CBD5E1",
            fontSize: "0.85rem",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "12px",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Botón de ver historial */}
          <button
            type="button"
            onClick={() => setMostrarHistorial(!mostrarHistorial)}
            style={{
              background: "none",
              border: "none",
              color: "#5000BA",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 0",
            }}
          >
            <History size={16} />
            Historial de Versiones ({historialVersiones.length})
            {mostrarHistorial ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {inicialmenteColapsado && (
              <button
                type="button"
                onClick={() => setPanelAbierto(false)}
                style={{
                  padding: "10px 14px",
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "1px solid #CBD5E1",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Ocultar Editor
              </button>
            )}

            {/* Botón de Enviar a Firma / Reenviar */}
            <button
              type="button"
              onClick={handleEmitirContrato}
              disabled={guardando}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "0.88rem",
                cursor: guardando ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(80, 0, 186, 0.25)",
              }}
            >
              {guardando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Emitiendo Versión {siguienteVersion}...
                </>
              ) : (
                <>
                  <Send size={16} />
                  {inicialmenteColapsado
                    ? `Aceptar y Reenviar Contrato v${siguienteVersion} al Solicitante`
                    : `Aceptar y Enviar Contrato v${siguienteVersion} a Firma`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Historial Desplegable de Versiones y Observaciones */}
      {mostrarHistorial && (
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #E2E8F0" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.88rem", fontWeight: 800, color: "#1E293B" }}>
            Línea de Tiempo y Negociación de Cláusulas
          </h4>

          {historialVersiones.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
              Aún no se han emitido versiones personalizadas para esta solicitud. Se utilizará la plantilla institucional como v1.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {historialVersiones.map((v) => {
                const esObservacion = v.vcs_tipo_evento === "OBSERVACION_SOLICITANTE";
                return (
                  <div
                    key={v.vcs_id}
                    style={{
                      padding: "10px 14px",
                      background: esObservacion ? "#FEF3C7" : "#F8FAFC",
                      border: `1px solid ${esObservacion ? "#FCD34D" : "#E2E8F0"}`,
                      borderRadius: "10px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 800, color: esObservacion ? "#92400E" : "#1E293B" }}>
                        {esObservacion ? "💬 Observación del Solicitante" : `Versión ${v.vcs_numero_version} (${v.vcs_rol_creador})`}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                        {new Date(v.vcs_creado_en).toLocaleString("es-EC")}
                      </span>
                    </div>

                    {v.vcs_comentarios && (
                      <p style={{ margin: "4px 0", color: "#334155", fontStyle: "italic" }}>
                        "{v.vcs_comentarios}"
                      </p>
                    )}

                    {!esObservacion && (
                      <div style={{ marginTop: "6px", display: "flex", gap: "10px" }}>
                        <button
                          type="button"
                          onClick={() => handleCargarVersionAnterior(v)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#5000BA",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            padding: 0,
                            textDecoration: "underline",
                          }}
                        >
                          Cargar texto en editor
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
