"use client";

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, KeyRound, Check, Lock, UserCheck, Award, BookOpen, MapPin, Briefcase, QrCode, RefreshCw } from "lucide-react";
import { actualizarPerfilUsuario, verificarCodigoTotpUsuario } from "../acciones";
import { WidgetConfiguracionMfa } from "./WidgetConfiguracionMfa";

export interface DatosPerfilAbogado {
  nombres: string;
  apellidos: string;
  correo: string;
  whatsapp: string;
  autorizaWhatsapp: boolean;
  tituloSenescyt?: string;
  matriculaForo?: string;
  anosExperiencia?: number;
  detalles?: string;
  mfaVerificadoInicial?: boolean;
}

interface Props {
  inicial: DatosPerfilAbogado;
  onGuardarExito?: () => void;
  children?: React.ReactNode;
}

export function FormularioPerfilAbogado({ inicial, onGuardarExito, children }: Props) {
  const [nombres, setNombres] = useState(inicial.nombres || "");
  const [apellidos, setApellidos] = useState(inicial.apellidos || "");
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp || "");
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(inicial.autorizaWhatsapp || false);
  
  const [tituloSenescyt, setTituloSenescyt] = useState(inicial.tituloSenescyt || "Abogado / Licenciado en Jurisprudencia");
  const [matriculaForo, setMatriculaForo] = useState(inicial.matriculaForo || "");
  const [anosExperiencia, setAnosExperiencia] = useState<number>(inicial.anosExperiencia || 5);
  const [detalles, setDetalles] = useState(inicial.detalles || "");

  // Estado de Seguridad MFA (AAL2 / TOTP)
  const [mfaVerificado, setMfaVerificado] = useState(Boolean(inicial.mfaVerificadoInicial));
  const [codigoTotp, setCodigoTotp] = useState("");
  const [errorTotp, setErrorTotp] = useState<string | null>(null);
  const [verificandoTotp, setVerificandoTotp] = useState(false);
  const [mostrarWidgetMfa, setMostrarWidgetMfa] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const verificarCodigoTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorTotp(null);
    if (!codigoTotp.trim() || codigoTotp.trim().length < 6) {
      setErrorTotp("Ingresa un código de autenticación de 6 dígitos válido.");
      return;
    }

    setVerificandoTotp(true);
    const res = await verificarCodigoTotpUsuario(codigoTotp);
    setVerificandoTotp(false);

    if (!res.ok) {
      setErrorTotp(res.error);
      return;
    }

    // Verificación exitosa del TOTP en servidor
    setMfaVerificado(true);
    setMensaje({ tipo: "exito", texto: "🔓 MFA Autenticado correctamente. Acceso concedido a edición de perfil legal." });
    setTimeout(() => setMensaje(null), 3500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaVerificado) {
      setMensaje({ tipo: "error", texto: "Debes validar tu autenticación MFA (TOTP) antes de actualizar tus datos." });
      return;
    }
    if (!nombres.trim() || !apellidos.trim()) {
      setMensaje({ tipo: "error", texto: "Nombres y apellidos son obligatorios." });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const res = await actualizarPerfilUsuario({
      nombres,
      apellidos,
      whatsapp,
      autorizaWhatsapp
    });

    setGuardando(false);
    if (res.ok) {
      setMensaje({ tipo: "exito", texto: "✅ Perfil profesional de abogado actualizado y guardado correctamente." });
      if (onGuardarExito) onGuardarExito();
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudo actualizar el perfil legal." });
    }
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header del Perfil Profesional */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          padding: "16px 20px",
          borderRadius: "12px",
          background: mfaVerificado ? "rgba(5, 135, 110, 0.08)" : "rgba(80, 0, 186, 0.06)",
          border: mfaVerificado ? "1px solid var(--esmeralda, #05876e)" : "1px solid var(--violeta, #5000BA)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: mfaVerificado ? "var(--esmeralda, #05876e)" : "var(--violeta, #5000BA)",
              color: "#FFF",
              display: "grid",
              placeItems: "center"
            }}
          >
            {mfaVerificado ? <ShieldCheck size={20} /> : <Lock size={20} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>Perfil Profesional de Abogado</h3>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
              {mfaVerificado ? "Acceso MFA Seguro Activado (Nivel AAL2)" : "Acceso Protegido por Autenticación Multi-Factor (MFA)"}
            </p>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.78rem",
            fontWeight: 800,
            padding: "5px 12px",
            borderRadius: "999px",
            background: mfaVerificado ? "var(--esmeralda, #05876e)" : "#E4E4E4",
            color: mfaVerificado ? "#FFF" : "#444"
          }}
        >
          {mfaVerificado ? "MFA VERIFICADO ✅" : "MFA REQUERIDO 🔒"}
        </div>
      </div>

      {mensaje && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: mensaje.tipo === "exito" ? "rgba(5, 135, 110, 0.12)" : "rgba(176, 0, 32, 0.12)",
            border: mensaje.tipo === "exito" ? "1px solid var(--esmeralda, #05876e)" : "1px solid #B00020",
            color: mensaje.tipo === "exito" ? "var(--esmeralda, #05876e)" : "#B00020",
            fontSize: "0.86rem",
            fontWeight: 700
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* GATE MFA: Si no ha verificado el código TOTP, exige ingreso de MFA */}
      {!mfaVerificado ? (
        <form onSubmit={verificarCodigoTotp} className="form-panel" style={{ background: "#FDFDFD", padding: "20px", borderRadius: "12px", border: "1px solid #E2E2E2" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
            <ShieldAlert size={24} color="var(--violeta, #5000BA)" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p style={{ margin: "0 0 6px 0", fontWeight: 700, fontSize: "0.92rem", color: "var(--violeta, #5000BA)" }}>
                Verificación MFA de Seguridad Obligatoria (PLT-002)
              </p>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "#555", lineHeight: "1.45" }}>
                Para consultar o actualizar tu información de registro profesional, cédula, matrícula del Foro de Abogados y acreditación SENESCYT, debes confirmar tu código autenticador (TOTP) de 6 dígitos.
              </p>
            </div>
          </div>

          {errorTotp && (
            <div style={{ color: "#B00020", fontSize: "0.82rem", fontWeight: 700, marginBottom: "10px" }}>
              {errorTotp}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: "220px", marginBottom: 0 }}>
              Código Autenticador TOTP (6 dígitos)
              <input
                type="text"
                maxLength={6}
                value={codigoTotp}
                onChange={(e) => setCodigoTotp(e.target.value.replace(/\D/g, ""))}
                placeholder="Ej. 482910"
                style={{ fontSize: "1.1rem", letterSpacing: "0.2em", textAlign: "center", fontWeight: 800 }}
              />
            </label>
            <button
              type="submit"
              className="btn-primario"
              disabled={verificandoTotp}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "44px", opacity: verificandoTotp ? 0.7 : 1 }}
            >
              {verificandoTotp ? <RefreshCw size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {verificandoTotp ? "Verificando TOTP..." : "Verificar & Desbloquear"}
            </button>
          </div>

          <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #E0E0E0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "0.78rem", color: "#777" }}>¿No posees tu app autenticadora o perdiste el acceso?</span>
              <button
                type="button"
                onClick={() => setMostrarWidgetMfa(!mostrarWidgetMfa)}
                style={{ background: "none", border: "none", color: "var(--violeta, #5000BA)", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <QrCode size={14} /> {mostrarWidgetMfa ? "Ocultar Asistente MFA" : "Configurar / Resetear MFA vía Correo"}
              </button>
            </div>

            {/* Despliegue del Widget de Configuración & Reseteo MFA */}
            {mostrarWidgetMfa && (
              <div style={{ marginTop: "8px" }}>
                <WidgetConfiguracionMfa
                  correoUsuario={inicial.correo}
                  onExitoAccion={() => {
                    setMostrarWidgetMfa(false);
                    setMfaVerificado(true);
                  }}
                />
              </div>
            )}
          </div>
        </form>
      ) : children ? (
        <div style={{ width: "100%" }}>{children}</div>
      ) : (
        /* FORMULARIO DE PERFIL ABOGADO (DESBLOQUEADO TRAS MFA) */
        <form onSubmit={handleSubmit} className="form-panel" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Bloque 1: Datos Personales & Contacto */}
          <div style={{ background: "#FAFAFA", padding: "18px", borderRadius: "10px", border: "1px solid #E8E8E8" }}>
            <h4 style={{ margin: "0 0 14px 0", fontSize: "0.92rem", fontWeight: 800, color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={16} color="var(--esmeralda, #05876e)" /> Identidad & Contacto de Registro
            </h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <label>
                Nombres
                <input
                  type="text"
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  required
                  placeholder="Tus nombres"
                />
              </label>

              <label>
                Apellidos
                <input
                  type="text"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  required
                  placeholder="Tus apellidos"
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "12px" }}>
              <label>
                Correo Electrónico (Identidad Registrada)
                <div style={{ position: "relative" }}>
                  <input
                    type="email"
                    value={inicial.correo}
                    disabled
                    style={{ background: "#F0F0F0", cursor: "not-allowed", color: "#666", paddingRight: "36px" }}
                  />
                  <Check size={16} color="var(--esmeralda, #05876e)" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }} />
                </div>
              </label>

              <label>
                Teléfono / WhatsApp Profesional
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ej. +593991234567"
                />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={autorizaWhatsapp}
                onChange={(e) => setAutorizaWhatsapp(e.target.checked)}
              />
              Autorizo recepción de notificaciones de causas y clientes vía WhatsApp
            </label>
          </div>

          {/* Bloque 2: Acreditación Profesional & Registro Legal */}
          <div style={{ background: "#FAFAFA", padding: "18px", borderRadius: "10px", border: "1px solid #E8E8E8" }}>
            <h4 style={{ margin: "0 0 14px 0", fontSize: "0.92rem", fontWeight: 800, color: "#333", display: "flex", alignItems: "center", gap: "8px" }}>
              <Award size={16} color="var(--esmeralda, #05876e)" /> Acreditación SENESCYT & Foro de Abogados
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <label>
                Título Profesional Registrado en SENESCYT
                <input
                  type="text"
                  value={tituloSenescyt}
                  onChange={(e) => setTituloSenescyt(e.target.value)}
                  placeholder="Ej. Abogado de los Tribunales de la República"
                />
              </label>

              <label>
                Matrícula del Foro de Abogados (Consejo de la Judicatura)
                <input
                  type="text"
                  value={matriculaForo}
                  onChange={(e) => setMatriculaForo(e.target.value)}
                  placeholder="Ej. 17-2018-492"
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "12px" }}>
              <label>
                Años de Experiencia Profesional
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={anosExperiencia}
                  onChange={(e) => setAnosExperiencia(parseInt(e.target.value) || 1)}
                />
              </label>
            </div>

            <label style={{ marginTop: "12px", display: "block" }}>
              Resumen Profesional & Especializaciones
              <textarea
                rows={3}
                value={detalles}
                onChange={(e) => setDetalles(e.target.value)}
                placeholder="Describe brevemente tus especialidades (Derecho Civil, Laboral, Penal), tribunal habitual o experiencia..."
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #DDD", fontSize: "0.88rem", fontFamily: "inherit" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="submit"
              disabled={guardando}
              className="btn-primario"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px" }}
            >
              {guardando ? "Guardando..." : "Guardar Cambios de Perfil"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
