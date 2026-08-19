"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, KeyRound, CheckCircle2, ShieldCheck, Download, AlertTriangle, Loader2 } from "lucide-react";
import { confirmarContratoSocio } from "../acciones";
import { ModalFirmaDigitalPdf } from "./ModalFirmaDigitalPdf";
import { crearClienteNavegador } from "@eco/supabase";
import type { InfoCertificado } from "../servicios/servicioFirmaDigital";

export function BotonConfirmarContrato({
  solicitudId,
  urlContratoPostulante,
}: {
  solicitudId: string;
  urlContratoPostulante?: string | null;
}) {
  const router = useRouter();
  const [modalFirmaTranqiAbierto, setModalFirmaTranqiAbierto] = useState(false);
  const [comentario, setComentario] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // URL del PDF del postulante para contra-firmar
  const urlParaFirmar = urlContratoPostulante || `/api/solicitud-socio/contrato/pdf?solicitudId=${solicitudId}`;

  // Manejo de Contra-Firma Digital completada por Tranqi
  async function handleContraFirmaCompletada(pdfBytes: Uint8Array, nombreArchivo: string, infoCert: InfoCertificado) {
    try {
      setConfirmando(true);
      setError(null);
      setExito(null);

      const supabase = crearClienteNavegador();
      const uuid = crypto.randomUUID();
      const pathBiFirmado = `${solicitudId}/contrato_bifirmado_tranqi-${uuid}-${nombreArchivo}`;

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });

      const { error: uploadError } = await supabase.storage
        .from("socios-documentos")
        .upload(pathBiFirmado, blob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      const comentarioFinal = comentario
        ? `${comentario} | Contra-firmado digitalmente por tranqi (${infoCert.nombreTitular} - ${infoCert.entidadEmisora})`
        : `Contra-firmado digitalmente por tranqi (${infoCert.nombreTitular} - ${infoCert.entidadEmisora}) el ${new Date().toLocaleString("es-EC")}`;

      const resultado = await confirmarContratoSocio(solicitudId, comentarioFinal, pathBiFirmado);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setModalFirmaTranqiAbierto(false);
      setExito("🎉 ¡Contrato contra-firmado digitalmente por tranqi! La cuenta de Socio Abogado ha sido formalmente activada.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la contra-firma");
    } finally {
      setConfirmando(false);
    }
  }

  // Confirmación administrativa de respaldo (por si se firmó por protocolo externo)
  async function handleConfirmarDirecto() {
    setError(null);
    setConfirmando(true);
    const resultado = await confirmarContratoSocio(solicitudId, comentario || undefined);
    setConfirmando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setExito("Contrato validado y cuenta de Socio Abogado activada.");
    router.refresh();
  }

  return (
    <div style={{ marginTop: "16px", background: "#F8FAFC", border: "1.5px solid #CBD5E1", borderRadius: "14px", padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <ShieldCheck size={24} color="#5000BA" />
        <div>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#1E293B" }}>
            Fase 3: Verificación y Contra-Firma Institucional tranqi
          </h3>
          <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "#64748B" }}>
            El postulante ha cargado su contrato firmado. Revisa el documento y realiza la contra-firma digital de tranqi para formalizar e integrar su activación.
          </p>
        </div>
      </div>

      <div style={{ margin: "16px 0" }}>
        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
          Nota u observaciones de activación (opcional):
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Ej: Aprobación formal gerencia / Verificación de firma digital conforme..."
            rows={2}
            style={{
              display: "block",
              width: "100%",
              marginTop: "4px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.85rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </label>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", padding: "10px 14px", borderRadius: "8px", fontSize: "0.84rem", fontWeight: 600, marginBottom: "12px" }}>
          {error}
        </div>
      )}

      {exito && (
        <div style={{ background: "#ECFDF5", border: "1px solid #10B981", color: "#065F46", padding: "10px 14px", borderRadius: "8px", fontSize: "0.84rem", fontWeight: 600, marginBottom: "12px" }}>
          {exito}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Botón Principal: Contra-Firma Digital Tranqi (.p12) */}
        <button
          type="button"
          onClick={() => setModalFirmaTranqiAbierto(true)}
          disabled={confirmando}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "11px 22px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #5000BA 0%, #3B0086 100%)",
            color: "#FFFFFF",
            fontSize: "0.88rem",
            fontWeight: 800,
            border: "none",
            cursor: confirmando ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(80, 0, 186, 0.3)",
            transition: "all 0.2s ease",
          }}
        >
          {confirmando ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Procesando activación...
            </>
          ) : (
            <>
              <KeyRound size={16} /> Contrafirmar Contrato
            </>
          )}
        </button>

        {/* Opción Secundaria: Confirmación Administrativa Directa */}
        <button
          type="button"
          onClick={handleConfirmarDirecto}
          disabled={confirmando}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 16px",
            borderRadius: "8px",
            background: "#FFFFFF",
            color: "#05876E",
            fontSize: "0.82rem",
            fontWeight: 700,
            border: "1.5px solid #05876E",
            cursor: confirmando ? "wait" : "pointer",
          }}
        >
          <CheckCircle2 size={15} /> Confirmación Administrativa de Respaldo
        </button>
      </div>

      {/* Modal de Firma Digital Institucional Tranqi */}
      <ModalFirmaDigitalPdf
        abierto={modalFirmaTranqiAbierto}
        onCerrar={() => setModalFirmaTranqiAbierto(false)}
        urlPdfOriginal={urlParaFirmar}
        solicitudId={solicitudId}
        rolFirmante="TRANQI_PLATAFORMA"
        onFirmaCompletada={handleContraFirmaCompletada}
      />
    </div>
  );
}
