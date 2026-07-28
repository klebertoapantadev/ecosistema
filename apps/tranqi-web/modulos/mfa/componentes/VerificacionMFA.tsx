"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@eco/supabase";

// Inscripcion + verificacion de TOTP via la API nativa de Supabase Auth
// (auth.mfa.*) -- no hay criptografia propia aqui, solo wiring de UI.
// Al verificar con exito, la sesion queda en aal2 y router.refresh() hace
// que el layout que gatea (/panel/socios) vuelva a evaluar y deje pasar.
export function VerificacionMFA({ necesitaInscripcion }: { necesitaInscripcion: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function iniciarInscripcion() {
    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setEnviando(false);
    if (error || !data) {
      setError(error?.message ?? "No se pudo iniciar la inscripción");
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function verificarCodigo(idFactor: string) {
    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { data: challenge, error: errorChallenge } = await supabase.auth.mfa.challenge({ factorId: idFactor });
    if (errorChallenge || !challenge) {
      setEnviando(false);
      setError(errorChallenge?.message ?? "No se pudo iniciar la verificación");
      return;
    }
    const { error: errorVerify } = await supabase.auth.mfa.verify({
      factorId: idFactor,
      challengeId: challenge.id,
      code: codigo,
    });
    setEnviando(false);
    if (errorVerify) {
      setError(errorVerify.message);
      return;
    }
    router.refresh();
  }

  async function verificarFactorExistente() {
    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { data: factores } = await supabase.auth.mfa.listFactors();
    const factor = factores?.totp?.find((f) => f.status === "verified");
    if (!factor) {
      setEnviando(false);
      setError("No se encontró un factor configurado — contacta a plataforma.");
      return;
    }
    await verificarCodigo(factor.id);
  }

  if (necesitaInscripcion) {
    return (
      <div className="tarjeta-mfa">
        {!qr ? (
          <>
            <p>No tienes un segundo factor configurado todavía. Necesitas una app de autenticación (Google Authenticator, Authy, 1Password, etc).</p>
            <button type="button" className="btn btn-primario" onClick={iniciarInscripcion} disabled={enviando}>
              {enviando ? "Generando…" : "Configurar autenticación"}
            </button>
          </>
        ) : (
          <>
            <p>Escanea este código con tu app de autenticación y escribe el código de 6 dígitos que te muestre.</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI de Supabase, no una imagen del proyecto */}
            <img src={qr} alt="Código QR de configuración de autenticación en dos pasos" className="qr-mfa" />
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
            />
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => factorId && verificarCodigo(factorId)}
              disabled={enviando || codigo.length !== 6}
            >
              {enviando ? "Verificando…" : "Verificar y activar"}
            </button>
          </>
        )}
        {error && <p className="error-auth">{error}</p>}
      </div>
    );
  }

  return (
    <div className="tarjeta-mfa">
      <p>Escribe el código de 6 dígitos de tu app de autenticación para continuar.</p>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        maxLength={6}
        inputMode="numeric"
        placeholder="000000"
      />
      <button type="button" className="btn btn-primario" onClick={verificarFactorExistente} disabled={enviando || codigo.length !== 6}>
        {enviando ? "Verificando…" : "Verificar"}
      </button>
      {error && <p className="error-auth">{error}</p>}
    </div>
  );
}
