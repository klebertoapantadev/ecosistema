"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@eco/supabase";
import { ShieldCheck, Smartphone, RefreshCw, KeyRound, AlertCircle } from "lucide-react";

// Inscripcion + verificacion de TOTP via la API nativa de Supabase Auth
// (auth.mfa.*). Al verificar con exito, la sesion queda en aal2 y router.refresh()
// hace que el layout que gatea (/panel/socios o /panel/auditoria) deje pasar.
export function VerificacionMFA({ necesitaInscripcion: propNecesitaInscripcion }: { necesitaInscripcion: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tieneFactorVerificado, setTieneFactorVerificado] = useState(false);
  const [comprobando, setComprobando] = useState(true);

  // Verificar si el usuario ya tiene un factor TOTP activo en Supabase
  const comprobarFactores = useCallback(async () => {
    try {
      setComprobando(true);
      const supabase = crearClienteNavegador();
      const { data: factores, error: errFactores } = await supabase.auth.mfa.listFactors();
      if (!errFactores && factores?.totp && factores.totp.length > 0) {
        const verificado = factores.totp.find((f) => f.status === "verified");
        if (verificado) {
          setFactorId(verificado.id);
          setTieneFactorVerificado(true);
        }
      }
    } catch {
      // Continuar con prop
    } finally {
      setComprobando(false);
    }
  }, []);

  useEffect(() => {
    comprobarFactores();
  }, [comprobarFactores]);

  async function iniciarInscripcion() {
    setEnviando(true);
    setError(null);
    try {
      const supabase = crearClienteNavegador();

      // 1. Limpiar cualquier factor no verificado o conflictivo anterior
      const { data: factores } = await supabase.auth.mfa.listFactors();
      if (factores?.totp && factores.totp.length > 0) {
        for (const f of factores.totp) {
          if ((f.status as string) !== "verified") {
            try {
              await supabase.auth.mfa.unenroll({ factorId: f.id });
            } catch {
              /* Ignorar si ya fue removido */
            }
          }
        }
      }

      // 2. Iniciar inscripción de un nuevo factor TOTP con nombre único
      const nombreAmigable = `tranqi_${Math.floor(Date.now() / 1000)}`;
      let resEnroll = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: nombreAmigable,
      });

      // 3. Si falla por factor ya existente o límite, limpiar todos los factores previos y reintentar
      if (resEnroll.error && (resEnroll.error.message.includes("already exists") || resEnroll.error.message.includes("factor"))) {
        const { data: todosFactores } = await supabase.auth.mfa.listFactors();
        if (todosFactores?.totp) {
          for (const f of todosFactores.totp) {
            try {
              await supabase.auth.mfa.unenroll({ factorId: f.id });
            } catch {
              /* Continuar */
            }
          }
        }
        resEnroll = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `tranqi_auth`,
        });
      }

      if (resEnroll.error || !resEnroll.data) {
        setError(resEnroll.error?.message ?? "No se pudo iniciar la inscripción de autenticador");
        return;
      }

      setFactorId(resEnroll.data.id);
      setQr(resEnroll.data.totp.qr_code);
      setSecretKey(resEnroll.data.totp.secret);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado al generar código QR");
    } finally {
      setEnviando(false);
    }
  }

  async function verificarCodigo(idFactor: string) {
    setEnviando(true);
    setError(null);
    try {
      const supabase = crearClienteNavegador();
      const { data: challenge, error: errorChallenge } = await supabase.auth.mfa.challenge({ factorId: idFactor });
      if (errorChallenge || !challenge) {
        setError(errorChallenge?.message ?? "No se pudo iniciar el desafío de verificación");
        return;
      }
      const { error: errorVerify } = await supabase.auth.mfa.verify({
        factorId: idFactor,
        challengeId: challenge.id,
        code: codigo.trim(),
      });
      if (errorVerify) {
        setError(errorVerify.message || "Código incorrecto. Comprueba el reloj de tu dispositivo.");
        return;
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al validar código");
    } finally {
      setEnviando(false);
    }
  }

  async function verificarFactorExistente() {
    setEnviando(true);
    setError(null);
    try {
      const supabase = crearClienteNavegador();
      let targetId = factorId;
      if (!targetId) {
        const { data: factores } = await supabase.auth.mfa.listFactors();
        const factor = factores?.totp?.find((f) => f.status === "verified");
        if (factor) {
          targetId = factor.id;
          setFactorId(factor.id);
        }
      }

      if (!targetId) {
        setError("No se encontró un factor activo configurado. Por favor haz clic en reconfigurar.");
        return;
      }

      await verificarCodigo(targetId);
    } finally {
      setEnviando(false);
    }
  }

  if (comprobando) {
    return (
      <div className="tarjeta-mfa" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "28px" }}>
        <RefreshCw size={20} className="animate-spin text-muted" />
        <span style={{ fontSize: "0.9rem", color: "#666" }}>Comprobando configuración de seguridad...</span>
      </div>
    );
  }

  const requiereInscripcion = !tieneFactorVerificado && (propNecesitaInscripcion || !factorId);

  if (requiereInscripcion) {
    return (
      <div className="tarjeta-mfa" style={{ maxWidth: "480px", margin: "0 auto", padding: "24px", background: "#ffffff", borderRadius: "16px", border: "1px solid #E4E4E4", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
        {!qr ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
              <Smartphone size={26} color="var(--violeta, #5000BA)" />
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111", marginBottom: "8px" }}>
              Segundo Factor Requerido
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#666", lineHeight: 1.5, marginBottom: "20px" }}>
              Para acceder a este módulo operativo, vincula una app de autenticación (Google Authenticator, Authy o Microsoft Authenticator).
            </p>
            <button
              type="button"
              className="btn btn-primario"
              onClick={iniciarInscripcion}
              disabled={enviando}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              {enviando ? <RefreshCw size={18} className="animate-spin" /> : <KeyRound size={18} />}
              {enviando ? "Generando autenticador..." : "Configurar autenticación"}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#111", marginBottom: "6px" }}>
              Escanea el Código QR
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "16px" }}>
              Abre tu app autenticadora, escanea el QR e ingresa el código de 6 dígitos que aparezca:
            </p>

            <div style={{ padding: "12px", background: "#F9FAFB", borderRadius: "12px", display: "inline-block", border: "1px solid #E5E7EB", marginBottom: "14px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR MFA" style={{ width: "180px", height: "180px", display: "block" }} />
            </div>

            {secretKey && (
              <div style={{ marginBottom: "16px", fontSize: "0.78rem", color: "#666" }}>
                <span>O ingresa esta clave manualmente: </span>
                <code style={{ fontWeight: 800, color: "var(--violeta, #5000BA)", wordBreak: "break-all" }}>{secretKey}</code>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                inputMode="numeric"
                placeholder="000000"
                style={{
                  textAlign: "center",
                  fontSize: "1.5rem",
                  letterSpacing: "8px",
                  fontWeight: 800,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "2px solid #5000BA",
                  outline: "none"
                }}
              />
              <button
                type="button"
                className="btn btn-primario"
                onClick={() => factorId && verificarCodigo(factorId)}
                disabled={enviando || codigo.length !== 6}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", fontWeight: 700 }}
              >
                {enviando ? "Verificando..." : "Verificar y Activar"}
              </button>
            </div>
          </div>
        )}
        {error && (
          <div style={{ marginTop: "14px", padding: "10px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tarjeta-mfa" style={{ maxWidth: "440px", margin: "0 auto", padding: "24px", background: "#ffffff", borderRadius: "16px", border: "1px solid #E4E4E4", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", textAlign: "center" }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px auto" }}>
        <ShieldCheck size={28} color="var(--violeta, #5000BA)" />
      </div>
      <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111", marginBottom: "6px" }}>
        Ingresa tu Código de 6 Dígitos
      </h3>
      <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "18px" }}>
        Ingresa el código temporal de tu app de autenticación para desbloquear la sesión:
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          maxLength={6}
          inputMode="numeric"
          placeholder="000000"
          autoFocus
          style={{
            textAlign: "center",
            fontSize: "1.6rem",
            letterSpacing: "8px",
            fontWeight: 800,
            padding: "10px",
            borderRadius: "10px",
            border: "2px solid #5000BA",
            outline: "none"
          }}
        />
        <button
          type="button"
          className="btn btn-primario"
          onClick={verificarFactorExistente}
          disabled={enviando || codigo.length !== 6}
          style={{ width: "100%", padding: "12px", borderRadius: "10px", fontWeight: 700 }}
        >
          {enviando ? "Verificando..." : "Desbloquear Acceso"}
        </button>

        <button
          type="button"
          onClick={iniciarInscripcion}
          disabled={enviando}
          style={{ background: "transparent", border: "none", color: "var(--violeta, #5000BA)", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
        >
          ¿Reconfigurar o cambiar app autenticadora?
        </button>
      </div>

      {error && (
        <div style={{ marginTop: "14px", padding: "10px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "8px", textAlign: "left" }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
