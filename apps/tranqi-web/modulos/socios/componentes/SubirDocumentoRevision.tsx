"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subirDocumentoSocioAction } from "../acciones";

const TIPOS_ACEPTADOS =
  "application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text";
const TAMANO_MAXIMO_MB = 15;

// El admin adjunta su propio respaldo de la revision (ej. captura de la
// consulta en SENESCYT), siempre con un comentario que explique que es --
// a diferencia de los documentos del solicitante, este no se autodescribe.
export function SubirDocumentoRevision({ solicitudId }: { solicitudId: string }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo) {
      setError("Selecciona un archivo");
      return;
    }
    if (!comentario.trim()) {
      setError("Explica qué respalda este documento");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setError(`Supera ${TAMANO_MAXIMO_MB}MB`);
      return;
    }
    setEnviando(true);
    const formData = new FormData();
    formData.append("solicitudId", solicitudId);
    formData.append("tipo", "respaldo_revision");
    formData.append("archivo", archivo);
    formData.append("comentario", comentario);
    formData.append("concepto", "revision");

    const resultado = await subirDocumentoSocioAction(formData);
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setArchivo(null);
    setComentario("");
    router.refresh();
  }

  return (
    <form className="form-panel subir-documento-revision" onSubmit={onSubmit}>
      <label>
        Adjuntar documento de respaldo (opcional)
        <input type="file" accept={TIPOS_ACEPTADOS} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
      </label>
      <label>
        ¿Qué respalda este documento?
        <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ej: captura de verificación en SENESCYT" />
      </label>
      {error && <p className="error-auth">{error}</p>}
      <button type="submit" className="btn-mini" disabled={enviando}>
        {enviando ? "Subiendo…" : "Adjuntar"}
      </button>
    </form>
  );
}
