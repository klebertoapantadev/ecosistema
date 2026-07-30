"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verificarOtpRegistro, reenviarOtpRegistro } from "../acciones";

// Verifica el OTP de 6 digitos enviado al registrarse (ver registrarUsuario()
// en acciones.ts) -- mismo patron de UI que VerificacionMFA.tsx (input +
// boton + error), pero este es de una sola vez, no un factor persistente.
export function VerificacionCorreo({ correo, nombres }: { correo: string; nombres?: string | null }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  async function verificar() {
    setEnviando(true);
    setError(null);
    setAviso(null);
    const resultado = await verificarOtpRegistro(codigo);
    setEnviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    if (!resultado.data) {
      setError("Código incorrecto o vencido. Puedes pedir uno nuevo.");
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  async function reenviar() {
    setReenviando(true);
    setError(null);
    setAviso(null);
    const resultado = await reenviarOtpRegistro(correo, nombres);
    setReenviando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setCodigo("");
    setAviso("Te enviamos un código nuevo.");
  }

  return (
    <div className="tarjeta-mfa">
      <p>
        Escribe el código de 6 dígitos que enviamos a <strong>{correo}</strong>.
      </p>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        maxLength={6}
        inputMode="numeric"
        placeholder="000000"
      />
      <button type="button" className="btn btn-primario" onClick={verificar} disabled={enviando || codigo.length !== 6}>
        {enviando ? "Verificando…" : "Verificar"}
      </button>
      <button type="button" className="btn-mini" onClick={reenviar} disabled={reenviando}>
        {reenviando ? "Enviando…" : "Reenviar código"}
      </button>
      {aviso && <p className="mensaje-ok">{aviso}</p>}
      {error && <p className="error-auth">{error}</p>}
    </div>
  );
}
