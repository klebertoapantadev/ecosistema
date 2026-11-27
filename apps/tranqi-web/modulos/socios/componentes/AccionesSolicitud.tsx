"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { decidirSolicitudSocio } from "../acciones";

export function AccionesSolicitud({ solicitudId, estadoActual }: { solicitudId: string; estadoActual?: string }) {
  const router = useRouter();
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState<"aceptada" | "rechazada" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  async function decidir(decision: "aceptada" | "rechazada") {
    if (decision === "rechazada" && !comentario.trim()) {
      setError("Por favor describe las observaciones o el motivo del rechazo para que el postulante pueda corregirlos.");
      return;
    }
    setError(null);
    setExito(null);
    setEnviando(decision);
    const resultado = await decidirSolicitudSocio({ solicitudId, decision, comentario: comentario.trim() || undefined });
    setEnviando(null);
    if (!resultado.ok) {
      setError(resultado.error || "No se pudo procesar la decisión.");
      return;
    }
    setExito(decision === "aceptada" ? "Solicitud Aprobada con éxito. Se notificó al postulante." : "Solicitud marcada con observaciones. Se notificó al postulante.");
    setComentario("");
    setTimeout(() => {
      router.refresh();
    }, 600);
  }

  return (
    <div style={{ background: "var(--cf-ffffff, #FFFFFF)", padding: "20px", borderRadius: "12px", border: "1.5px solid var(--linea)", marginTop: "16px" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "1.05rem", color: "var(--texto)" }}>
        Emitir Decisión de Acreditación {estadoActual && estadoActual === "rechazada" ? "(Re-evaluación)" : ""}
      </h3>
      <p style={{ margin: "0 0 14px 0", fontSize: "0.84rem", color: "var(--texto-suave)" }}>
        Selecciona la resolución formal para este expediente. Si rechazas o solicitas corrección, agrega una observación clara para el postulante.
      </p>

      {error && (
        <div style={{ background: "var(--error-diluido)", border: "1px solid #F87171", color: "var(--error)", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "0.85rem", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {exito && (
        <div style={{ background: "var(--exito-diluido)", border: "1px solid var(--exito)", color: "var(--exito-texto)", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "0.85rem", fontWeight: 600 }}>
          {exito}
        </div>
      )}

      <label style={{ display: "block", marginBottom: "14px" }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", color: "var(--texto-2)", marginBottom: "6px" }}>
          Observación / Comentario Institucional (Obligatorio si se rechaza):
        </span>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Ej: Inconsistencia en matrícula del Foro de Abogados / Documento de título borroso / Faltan certificados..."
          rows={3}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid var(--linea-fuerte)",
            fontSize: "0.88rem",
            color: "var(--texto)",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => decidir("aceptada")}
          disabled={enviando !== null}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            background: "#0E6648",
            color: "#FFFFFF",
            border: "none",
            fontSize: "0.9rem",
            fontWeight: 800,
            cursor: enviando ? "wait" : "pointer",
            boxShadow: "0 2px 6px rgba(14, 102, 72, 0.25)",
            transition: "all 0.2s ease",
          }}
        >
          {enviando === "aceptada" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          <span>{enviando === "aceptada" ? "Aprobando…" : "Aprobar Solicitud"}</span>
        </button>

        <button
          type="button"
          onClick={() => decidir("rechazada")}
          disabled={enviando !== null}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            background: "var(--error)",
            color: "#FFFFFF",
            border: "none",
            fontSize: "0.9rem",
            fontWeight: 800,
            cursor: enviando ? "wait" : "pointer",
            boxShadow: "0 2px 6px color-mix(in srgb, var(--error) 25%, transparent)",
            transition: "all 0.2s ease",
          }}
        >
          {enviando === "rechazada" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
          <span>{enviando === "rechazada" ? "Rechazando…" : "Rechazar con Observaciones"}</span>
        </button>
      </div>
    </div>
  );
}
