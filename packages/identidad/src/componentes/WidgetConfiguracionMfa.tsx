"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, KeyRound, Mail, RefreshCw, Copy, Check, QrCode, Smartphone, AlertCircle, ArrowLeft, Lock } from "lucide-react";
import { solicitarCodigoRescateMfa, verificarYResetearMfa, activarNuevoMfaTotp, obtenerEstadoMfa } from "../acciones";

interface Props {
  negocio?: string;
  correoUsuario?: string;
  onExitoAccion?: () => void;
}

export function WidgetConfiguracionMfa({ negocio = "tranqi", correoUsuario = "", onExitoAccion }: Props) {
  const [modo, setModo] = useState<"estado" | "configurar" | "resetear">("estado");
  const [mfaActivo, setMfaActivo] = useState(false);
  const [correo, setCorreo] = useState(correoUsuario);

  // Estados para Configuración / Re-enrolamiento QR
  const [secretKey, setSecretKey] = useState("");
  const [codigoTotp, setCodigoTotp] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Estados para Reseteo vía OTP de Correo
  const [pasoReset, setPasoReset] = useState<"solicitar" | "validar">("solicitar");
  const [codigoCorreo, setCodigoCorreo] = useState("");
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [procesandoReset, setProcesandoReset] = useState(false);
  const [cargandoActivar, setCargandoActivar] = useState(false);

  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Cargar estado real de MFA al iniciar
  useEffect(() => {
    async function cargarEstado() {
      const res = await obtenerEstadoMfa();
      if (res.ok && res.data) {
        setMfaActivo(res.data.mfaActivo);
        if (res.data.correo) setCorreo(res.data.correo);
        if (res.data.secretKey) setSecretKey(res.data.secretKey);
      }
    }
    cargarEstado();
  }, []);

  const handleCopiarSecret = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(secretKey);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  // Enviar código de rescate al correo de registro
  const handleSolicitarCodigoCorreo = async () => {
    setEnviandoCorreo(true);
    setMensaje(null);

    const res = await solicitarCodigoRescateMfa(negocio);
    setEnviandoCorreo(false);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    setPasoReset("validar");
    setMensaje({ tipo: "exito", texto: res.data.mensaje || "Código de seguridad enviado a tu correo." });
  };

  // Validar código OTP del correo y resetear MFA
  const handleValidarCodigoCorreo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoCorreo.trim() || codigoCorreo.trim().length < 6) {
      setMensaje({ tipo: "error", texto: "Ingresa el código de 6 dígitos que enviamos a tu correo." });
      return;
    }

    setProcesandoReset(true);
    setMensaje(null);

    const res = await verificarYResetearMfa(codigoCorreo);
    setProcesandoReset(false);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    setMfaActivo(false);
    setSecretKey(res.data.nuevoSecret);
    setModo("configurar"); // Transición automática al código QR
    setMensaje({
      tipo: "exito",
      texto: "🔓 MFA anterior desvinculado con éxito. Escanea el nuevo código QR para vincular tu nueva app.",
    });
  };

  // Confirmar y Activar la nueva App Autenticadora
  const handleActivarTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoTotp.trim() || codigoTotp.trim().length < 6) {
      setMensaje({ tipo: "error", texto: "Ingresa el código de 6 dígitos generado por tu app autenticadora." });
      return;
    }

    setCargandoActivar(true);
    setMensaje(null);

    const res = await activarNuevoMfaTotp(secretKey, codigoTotp);
    setCargandoActivar(false);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    setMfaActivo(true);
    setModo("estado");
    setMensaje({ tipo: "exito", texto: "✅ ¡Autenticador MFA activado y configurado correctamente!" });
    if (onExitoAccion) onExitoAccion();
  };

  // URL de código QR público de Google Charts / QR Server como fallback estético nativo
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(negocio.toUpperCase())}:${encodeURIComponent(correo || "usuario@tranqi24.com")}?secret=${secretKey}&issuer=${encodeURIComponent(negocio.toUpperCase())}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`;

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "14px",
        border: "1px solid var(--panel-linea, #E4E4E4)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Mensaje de Respuesta */}
      {mensaje && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            background: mensaje.tipo === "exito" ? "rgba(5, 135, 110, 0.12)" : "rgba(176, 0, 32, 0.12)",
            border: mensaje.tipo === "exito" ? "1px solid var(--esmeralda, #05876e)" : "1px solid #B00020",
            color: mensaje.tipo === "exito" ? "var(--esmeralda, #05876e)" : "#B00020",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* VISTA 1: ESTADO PRINCIPAL DE MFA */}
      {modo === "estado" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px",
              background: mfaActivo ? "rgba(5, 135, 110, 0.08)" : "rgba(80, 0, 186, 0.06)",
              borderRadius: "12px",
              border: mfaActivo ? "1px solid var(--esmeralda, #05876e)" : "1px solid var(--violeta, #5000BA)",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: mfaActivo ? "var(--esmeralda, #05876e)" : "var(--violeta, #5000BA)",
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mfaActivo ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "0.94rem", fontWeight: 800, color: "var(--negro, #111111)" }}>
                  {mfaActivo ? "Autenticador MFA Activo" : "Autenticador MFA No Configurado"}
                </h4>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--panel-gris, #737373)" }}>
                  {mfaActivo
                    ? "Tu cuenta está protegida con código TOTP de 6 dígitos."
                    : "Configura tu app autenticadora (Google Auth, Authy, 1Password)."}
                </p>
              </div>
            </div>

            <span
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                fontSize: "0.76rem",
                fontWeight: 800,
                background: mfaActivo ? "var(--esmeralda, #05876e)" : "#E4E4E4",
                color: mfaActivo ? "#FFF" : "#444",
              }}
            >
              {mfaActivo ? "MFA ACTIVADO ✅" : "INACTIVO 🔒"}
            </span>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setModo("configurar")}
              className="btn-primario btn-responsive-accion"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.86rem",
                padding: "10px 16px",
              }}
            >
              <QrCode size={16} />
              <span className="btn-texto-responsive">
                {mfaActivo ? "Reconfigurar App Autenticadora" : "Configurar MFA / Escanear QR"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModo("resetear");
                setPasoReset("solicitar");
              }}
              className="btn-mini btn-responsive-accion"
              style={{
                background: "rgba(176, 0, 32, 0.08)",
                border: "1px solid rgba(176, 0, 32, 0.3)",
                color: "#B00020",
                fontWeight: 700,
                gap: "6px",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 14px",
              }}
            >
              <RefreshCw size={15} />
              <span className="btn-texto-responsive">¿Perdiste tu App? Resetear vía Correo</span>
            </button>
          </div>
        </div>
      )}

      {/* VISTA 2: CONFIGURAR / ESCANEAR QR */}
      {modo === "configurar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--negro, #111111)", display: "flex", alignItems: "center", gap: "8px" }}>
              <QrCode size={18} color="var(--violeta, #5000BA)" /> Configurar App Autenticadora (TOTP)
            </h4>
            <button
              type="button"
              onClick={() => setModo("estado")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--panel-gris, #737373)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}
            >
              <ArrowLeft size={14} /> Volver
            </button>
          </div>

          <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--panel-gris, #737373)", lineHeight: 1.45 }}>
            Paso 1: Abre tu aplicación autenticadora favorita (Google Authenticator, Authy, Microsoft Authenticator o 1Password) en tu celular y escanea este código QR:
          </p>

          {/* Tarjeta de Código QR y Clave Manual */}
          <div style={{ display: "flex", gap: "20px", alignItems: "center", background: "#F9F9FB", padding: "16px", borderRadius: "12px", border: "1px solid #E6E6E6", flexWrap: "wrap" }}>
            <div style={{ background: "#FFFFFF", padding: "8px", borderRadius: "10px", border: "1px solid #DDD", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrImageUrl} alt="Código QR MFA" style={{ width: "140px", height: "140px", display: "block" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "200px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--negro, #111111)" }}>
                ¿No puedes escanear el código QR?
              </span>
              <span style={{ fontSize: "0.76rem", color: "var(--panel-gris, #737373)" }}>
                Ingresa esta Clave Secreta en tu aplicación:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <code style={{ background: "#EEE", padding: "6px 10px", borderRadius: "6px", fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.1em", color: "#111" }}>
                  {secretKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopiarSecret}
                  className="btn-mini btn-responsive-accion"
                  style={{ background: "#FFF", border: "1px solid #CCC", color: copiado ? "#05876e" : "#333", fontWeight: 700, gap: "4px", display: "inline-flex", alignItems: "center" }}
                  title="Copiar Clave Secreta"
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                  <span className="btn-texto-responsive">{copiado ? "¡Copiada!" : "Copiar"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Formulario de Confirmación TOTP */}
          <form onSubmit={handleActivarTotp} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 700, color: "var(--negro, #111111)" }}>
              Paso 2: Ingresa el código de 6 dígitos generado por la app para confirmar la vinculación:
              <input
                type="text"
                maxLength={6}
                value={codigoTotp}
                onChange={(e) => setCodigoTotp(e.target.value.replace(/\D/g, ""))}
                placeholder="Ej: 482910 (o 123456 en prueba)"
                style={{
                  width: "100%",
                  height: "42px",
                  fontSize: "1.1rem",
                  letterSpacing: "0.2em",
                  textAlign: "center",
                  fontWeight: 800,
                  marginTop: "6px",
                  borderRadius: "8px",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <button
              type="submit"
              disabled={cargandoActivar}
              className="btn-primario"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", height: "42px", fontWeight: 700 }}
            >
              <KeyRound size={16} />
              {cargandoActivar ? "Confirmando..." : "Confirmar & Activar MFA"}
            </button>
          </form>
        </div>
      )}

      {/* VISTA 3: RESETEO ESTÁNDAR VÍA CORREO REGISTRADO */}
      {modo === "resetear" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "var(--negro, #111111)", display: "flex", alignItems: "center", gap: "8px" }}>
              <RefreshCw size={18} color="#B00020" /> Proceso Estándar de Reseteo por Correo
            </h4>
            <button
              type="button"
              onClick={() => setModo("estado")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--panel-gris, #737373)", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", fontWeight: 700 }}
            >
              <ArrowLeft size={14} /> Volver
            </button>
          </div>

          <div style={{ background: "rgba(176, 0, 32, 0.05)", border: "1px solid rgba(176, 0, 32, 0.2)", borderRadius: "10px", padding: "14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <AlertCircle size={20} color="#B00020" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ fontSize: "0.82rem", color: "#333", lineHeight: 1.45 }}>
              Si cambiaste de teléfono o perdiste tu app autenticadora, enviaremos un <strong>Código de Rescate de 6 dígitos</strong> a tu correo de registro principal (<strong>{correo || "tu correo registrado"}</strong>) para validar tu identidad y desvincular el MFA anterior.
            </div>
          </div>

          {pasoReset === "solicitar" ? (
            <button
              type="button"
              disabled={enviandoCorreo}
              onClick={handleSolicitarCodigoCorreo}
              className="btn-primario"
              style={{
                background: "#B00020",
                color: "#FFFFFF",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                height: "44px",
                fontWeight: 700,
              }}
            >
              <Mail size={16} />
              {enviandoCorreo ? "Enviando código al correo..." : "Enviar Código de Seguridad al Correo"}
            </button>
          ) : (
            <form onSubmit={handleValidarCodigoCorreo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 700, color: "var(--negro, #111111)" }}>
                Ingresa el código de 6 dígitos que enviamos a tu correo electrónico ({correo}):
                <input
                  type="text"
                  maxLength={6}
                  value={codigoCorreo}
                  onChange={(e) => setCodigoCorreo(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ej: 849201 (o 123456 en prueba)"
                  style={{
                    width: "100%",
                    height: "42px",
                    fontSize: "1.1rem",
                    letterSpacing: "0.2em",
                    textAlign: "center",
                    fontWeight: 800,
                    marginTop: "6px",
                    borderRadius: "8px",
                    border: "1px solid var(--panel-linea, #E4E4E4)",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  disabled={procesandoReset}
                  className="btn-primario"
                  style={{
                    flex: 1,
                    background: "var(--esmeralda, #05876e)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    height: "42px",
                    fontWeight: 700,
                  }}
                >
                  <ShieldCheck size={16} />
                  {procesandoReset ? "Validando..." : "Verificar y Desvincular App Previa"}
                </button>

                <button
                  type="button"
                  onClick={handleSolicitarCodigoCorreo}
                  className="btn-mini"
                  style={{ background: "#F5F5F5", border: "1px solid #DDD", color: "#444", fontWeight: 700 }}
                >
                  Reenviar Código
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
