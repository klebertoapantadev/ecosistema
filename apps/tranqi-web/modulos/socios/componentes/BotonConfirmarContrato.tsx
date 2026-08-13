"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarContratoSocio } from "../acciones";

export function BotonConfirmarContrato({ solicitudId }: { solicitudId: string }) {
  const router = useRouter();
  const [comentario, setComentario] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmar() {
    setError(null);
    setConfirmando(true);
    const resultado = await confirmarContratoSocio(solicitudId, comentario || undefined);
    setConfirmando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ marginTop: "12px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "18px 22px" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: 700, color: "#111827" }}>
        Validar y Activar Cuenta de Socio Abogado
      </h3>
      <p style={{ margin: "0 0 14px 0", fontSize: "0.82rem", color: "#4B5563", lineHeight: 1.5 }}>
        El postulante ha cargado su contrato firmado. Revisa el documento adjunto y, si está conforme, confirma la recepción para asignarle el rol de <strong>Abogado</strong> y notificarle la activación de su cuenta.
      </p>
      
      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
        Nota u observaciones (opcional)
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Escribe alguna observación o comentario interno..."
          rows={2}
          style={{
            display: "block",
            width: "100%",
            marginTop: "4px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #D1D5DB",
            fontSize: "0.85rem",
            outline: "none"
          }}
        />
      </label>

      {error && <p style={{ fontSize: "0.8rem", color: "#DC2626", margin: "10px 0 0 0", fontWeight: 600 }}>{error}</p>}
      
      <button
        type="button"
        onClick={handleConfirmar}
        disabled={confirmando}
        style={{
          marginTop: "12px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "10px 18px",
          borderRadius: "8px",
          background: "#05876E",
          color: "#FFFFFF",
          fontSize: "0.85rem",
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          transition: "background 0.2s"
        }}
      >
        {confirmando ? "Activando cuenta..." : "✔️ Confirmar Contrato y Activar Abogado"}
      </button>
    </div>
  );
}
