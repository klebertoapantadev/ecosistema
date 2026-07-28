"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decidirSolicitud } from "../acciones";

export function AccionesSolicitud({ solicitudId }: { solicitudId: string }) {
  const router = useRouter();
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState<"aceptada" | "rechazada" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decidir(decision: "aceptada" | "rechazada") {
    if (decision === "rechazada" && !comentario.trim()) {
      setError("Agrega un comentario explicando el motivo del rechazo.");
      return;
    }
    setError(null);
    setEnviando(decision);
    const resultado = await decidirSolicitud(solicitudId, decision, comentario || undefined);
    setEnviando(null);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="acciones-solicitud">
      <label>
        Comentario (obligatorio si rechazas)
        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} />
      </label>
      {error && <p className="error-auth">{error}</p>}
      <div className="acciones-solicitud-botones">
        <button type="button" className="btn-mini" onClick={() => decidir("aceptada")} disabled={enviando !== null}>
          {enviando === "aceptada" ? "Aceptando…" : "Aceptar"}
        </button>
        <button type="button" className="btn-peligro" onClick={() => decidir("rechazada")} disabled={enviando !== null}>
          {enviando === "rechazada" ? "Rechazando…" : "Rechazar"}
        </button>
      </div>
    </div>
  );
}
