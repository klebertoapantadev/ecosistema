"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  Users,
  Briefcase,
  FileCheck2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Send,
  Loader2,
  Phone,
  TrendingDown,
  AlertCircle
} from "lucide-react";
import { validarCorreoEstructurado } from "@eco/primitivas";

export default function PaginaContactoEmpresas() {
  const [empresa, setEmpresa] = useState("");
  const [ruc, setRuc] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [cargo, setCargo] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [empleados, setEmpleados] = useState("11 a 50 colaboradores");
  const [interes, setInteres] = useState("Plan de Beneficios Legales para Empleados");
  const [mensaje, setMensaje] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(true);

  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [sugerenciaCorreo, setSugerenciaCorreo] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [enviadoExitoso, setEnviadoExitoso] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validarEmailEnTiempoReal = (valor: string) => {
    setCorreo(valor);
    if (!valor.trim()) {
      setErrorCorreo(null);
      setSugerenciaCorreo(null);
      return;
    }
    const res = validarCorreoEstructurado(valor);
    if (!res.esValido) {
      setErrorCorreo(res.error || "Formato de correo no válido.");
      setSugerenciaCorreo(res.sugerencia || null);
    } else {
      setErrorCorreo(null);
      setSugerenciaCorreo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!empresa.trim() || !nombreContacto.trim() || !correo.trim() || !telefono.trim()) {
      setErrorMsg("Por favor complete los campos obligatorios marcados con (*).");
      return;
    }

    // Validación estricta de correo electrónico
    const valCorreo = validarCorreoEstructurado(correo);
    if (!valCorreo.esValido) {
      setErrorMsg(valCorreo.error || "El correo electrónico ingresado no tiene un formato válido.");
      setErrorCorreo(valCorreo.error || null);
      setSugerenciaCorreo(valCorreo.sugerencia || null);
      return;
    }

    if (!aceptaTerminos) {
      setErrorMsg("Debe autorizar el tratamiento de datos para continuar.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/empresas/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: empresa.trim(),
          ruc: ruc.trim() || null,
          nombreContacto: nombreContacto.trim(),
          cargo: cargo.trim() || null,
          correo: correo.trim().toLowerCase(),
          telefono: telefono.trim(),
          empleados,
          interes,
          mensaje: mensaje.trim() || null
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Ocurrió un error al enviar la solicitud.");
      }

      setEnviadoExitoso(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la solicitud.";
      setErrorMsg(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#090d16", color: "#f8fafc", fontFamily: "var(--fuente-sans, sans-serif)" }}>
      {/* Barra Superior de Navegación */}
      <header
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "rgba(9, 13, 22, 0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <img src="/assets/tranqi-white.svg" alt="tranqi" style={{ height: "30px", width: "auto" }} />
            <span
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: "rgba(254, 227, 0, 0.15)",
                color: "#FEE300",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid rgba(254, 227, 0, 0.3)"
              }}
            >
              Empresas B2B
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/#planes"
              style={{
                fontSize: "0.88rem",
                color: "#94a3b8",
                textDecoration: "none",
                fontWeight: 600,
                transition: "color 0.2s"
              }}
            >
              Ver Planes
            </Link>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.88rem",
                color: "#ffffff",
                background: "rgba(255, 255, 255, 0.08)",
                padding: "8px 16px",
                borderRadius: "999px",
                textDecoration: "none",
                fontWeight: 700,
                border: "1px solid rgba(255, 255, 255, 0.12)"
              }}
            >
              <ArrowLeft size={16} /> Volver a Inicio
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Cabecera Principal */}
        <div style={{ textAlign: "center", maxWidth: "840px", margin: "0 auto 50px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "linear-gradient(135deg, rgba(80, 0, 186, 0.3), rgba(254, 227, 0, 0.1))",
              border: "1px solid rgba(254, 227, 0, 0.35)",
              color: "#FEE300",
              fontSize: "0.78rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "6px 14px",
              borderRadius: "999px",
              marginBottom: "16px"
            }}
          >
            <Sparkles size={14} /> Solución Corporativa Integral & B2B2C
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              color: "#ffffff",
              margin: "0 0 16px 0"
            }}
          >
            Protección Legal Continua para tu <span style={{ color: "#FEE300" }}>Empresa</span> y tu{" "}
            <span style={{ color: "#a855f7" }}>Nómina</span>
          </h1>

          <p style={{ fontSize: "1.12rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
            Optimiza los costos legales de tu empresa, blinda tus contratos y entrega un paquete de bienestar jurídico de
            alto impacto para tus colaboradores. Solicita asesoría y un especialista se comunicará hoy mismo.
          </p>
        </div>

        {/* Cuadrícula: Beneficios a la izquierda | Formulario a la derecha */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "36px",
            alignItems: "start"
          }}
        >
          {/* COLUMNA IZQUIERDA: Beneficios y Funciones para Empresas */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "24px",
              padding: "36px 32px",
              backdropFilter: "blur(10px)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <div
                style={{
                  background: "#5000BA",
                  color: "#FEE300",
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                <Building2 size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.28rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
                  Beneficios Corporativos Tranqi
                </h2>
                <p style={{ fontSize: "0.84rem", color: "#94a3b8", margin: "2px 0 0 0" }}>
                  Diseñados para gerencia, talento humano y equipos legales
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Beneficio 1 */}
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    background: "rgba(80, 0, 186, 0.2)",
                    color: "#a855f7",
                    padding: "8px",
                    borderRadius: "10px",
                    flexShrink: 0
                  }}
                >
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px 0", color: "#f8fafc" }}>
                    Abogado Empresarial Dedicado
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Asignación de un especialista corporativo para absolver consultas laborales, contractuales,
                    tributarias y societarias de tu organización sin demoras.
                  </p>
                </div>
              </div>

              {/* Beneficio 2 */}
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    padding: "8px",
                    borderRadius: "10px",
                    flexShrink: 0
                  }}
                >
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px 0", color: "#f8fafc" }}>
                    Bienestar Legal para tus Empleados (B2B2C)
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Consultas legales sin costo y descuentos preferenciales para toda tu nómina de colaboradores y sus
                    familias, fortaleciendo el clima laboral.
                  </p>
                </div>
              </div>

              {/* Beneficio 3 */}
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    background: "rgba(254, 227, 0, 0.15)",
                    color: "#FEE300",
                    padding: "8px",
                    borderRadius: "10px",
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px 0", color: "#f8fafc" }}>
                    Portal Empresa con Roles RBAC
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Consola corporativa para Administrador, Talento Humano y Auditor Legal, con reportes de uso en
                    tiempo real y estricta garantía de confidencialidad y secreto profesional.
                  </p>
                </div>
              </div>

              {/* Beneficio 4 */}
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "#38bdf8",
                    padding: "8px",
                    borderRadius: "10px",
                    flexShrink: 0
                  }}
                >
                  <FileCheck2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px 0", color: "#f8fafc" }}>
                    Revisión y Blindaje Contractual Preventivo
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Elaboración, auditoría y firma de contratos comerciales, convenios laborales, acuerdos de
                    confidencialidad (NDA) y cumplimiento normativo.
                  </p>
                </div>
              </div>

              {/* Beneficio 5 */}
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    background: "rgba(244, 63, 94, 0.15)",
                    color: "#fb7185",
                    padding: "8px",
                    borderRadius: "10px",
                    flexShrink: 0
                  }}
                >
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px 0", color: "#f8fafc" }}>
                    Tarifas Escalables desde $10.35 / Colaborador
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Planes por tramos adaptados al número de empleados de tu empresa, reduciendo drásticamente el costo
                    comparado con firmas jurídicas tradicionales.
                  </p>
                </div>
              </div>
            </div>

            {/* Banner de Contacto Directo */}
            <div
              style={{
                marginTop: "32px",
                padding: "18px 20px",
                background: "linear-gradient(135deg, rgba(80, 0, 186, 0.25), rgba(254, 227, 0, 0.08))",
                borderRadius: "14px",
                border: "1px solid rgba(80, 0, 186, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "14px"
              }}
            >
              <div
                style={{
                  background: "#5000BA",
                  borderRadius: "50%",
                  width: "38px",
                  height: "38px",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  color: "#ffffff"
                }}
              >
                <Phone size={18} />
              </div>
              <div style={{ fontSize: "0.86rem" }}>
                <span style={{ color: "#ffffff", fontWeight: 700, display: "block" }}>
                  ¿Necesitas atención inmediata?
                </span>
                <span style={{ color: "#cbd5e1" }}>
                  Escríbenos a{" "}
                  <a
                    href="mailto:admin.operaciones@tranqi24.com"
                    style={{ color: "#FEE300", fontWeight: 700, textDecoration: "underline" }}
                  >
                    admin.operaciones@tranqi24.com
                  </a>
                </span>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Formulario de Contacto Corporativo */}
          <div
            style={{
              backgroundColor: "#111827",
              border: "1.5px solid rgba(254, 227, 0, 0.3)",
              borderRadius: "24px",
              padding: "36px 32px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)"
            }}
          >
            {enviadoExitoso ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 20px"
                  }}
                >
                  <CheckCircle2 size={42} />
                </div>
                <h3 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", marginBottom: "12px" }}>
                  ¡Solicitud Recibida con Éxito!
                </h3>
                <p style={{ fontSize: "0.98rem", color: "#cbd5e1", lineHeight: 1.6, maxWidth: "440px", margin: "0 auto 24px" }}>
                  Hemos recibido los datos de <strong>{empresa}</strong> y enviamos un correo de confirmación a{" "}
                  <strong>{correo}</strong>.
                </p>
                <div
                  style={{
                    backgroundColor: "#1f2937",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "28px",
                    fontSize: "0.88rem",
                    color: "#94a3b8"
                  }}
                >
                  Un asesor de Operaciones de Tranqi te contactará vía telefónica o correo electrónico en menos de 24
                  horas laborales.
                </div>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEnviadoExitoso(false);
                      setEmpresa("");
                      setRuc("");
                      setNombreContacto("");
                      setCargo("");
                      setCorreo("");
                      setTelefono("");
                      setMensaje("");
                    }}
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "#ffffff",
                      border: "none",
                      padding: "12px 20px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Enviar otra consulta
                  </button>
                  <Link
                    href="/"
                    style={{
                      background: "#5000BA",
                      color: "#ffffff",
                      padding: "12px 24px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    Ir al Inicio
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#ffffff", margin: "0 0 6px 0" }}>
                    Solicitar Asesoría Corporativa
                  </h2>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", margin: 0 }}>
                    Ingresa los datos de tu empresa para diseñar una propuesta personalizada.
                  </p>
                </div>

                {errorMsg && (
                  <div
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid #ef4444",
                      color: "#fca5a5",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      fontSize: "0.86rem",
                      marginBottom: "20px"
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: "grid", gap: "16px" }}>
                  {/* Empresa y RUC */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Empresa / Razón Social *
                      </label>
                      <input
                        type="text"
                        required
                        value={empresa}
                        onChange={(e) => setEmpresa(e.target.value)}
                        placeholder="Ej. Corporación Andina S.A."
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        RUC (Ecuador)
                      </label>
                      <input
                        type="text"
                        maxLength={13}
                        value={ruc}
                        onChange={(e) => setRuc(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="1790000000001"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Contacto y Cargo */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Nombre del Contacto *
                      </label>
                      <input
                        type="text"
                        required
                        value={nombreContacto}
                        onChange={(e) => setNombreContacto(e.target.value)}
                        placeholder="Nombre y Apellidos"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Cargo / Rol
                      </label>
                      <input
                        type="text"
                        value={cargo}
                        onChange={(e) => setCargo(e.target.value)}
                        placeholder="Ej. Gerente de RRHH"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Correo y Teléfono */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Correo Corporativo *
                      </label>
                      <input
                        type="email"
                        required
                        value={correo}
                        onChange={(e) => validarEmailEnTiempoReal(e.target.value)}
                        onBlur={() => validarEmailEnTiempoReal(correo)}
                        placeholder="contacto@empresa.com"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: errorCorreo ? "1.5px solid #ef4444" : "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                      {errorCorreo && (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "0.78rem",
                            color: "#f87171",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <AlertCircle size={13} style={{ flexShrink: 0 }} />
                            <span>{errorCorreo}</span>
                          </div>
                          {sugerenciaCorreo && (
                            <div style={{ marginTop: "2px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCorreo(sugerenciaCorreo);
                                  validarEmailEnTiempoReal(sugerenciaCorreo);
                                }}
                                style={{
                                  background: "rgba(254, 227, 0, 0.15)",
                                  color: "#FEE300",
                                  border: "1px solid rgba(254, 227, 0, 0.4)",
                                  borderRadius: "6px",
                                  padding: "3px 8px",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  fontWeight: 700
                                }}
                              >
                                Corregir a {sugerenciaCorreo}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Teléfono / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        placeholder="099 123 4567"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.9rem",
                          outline: "none"
                        }}
                      />
                    </div>
                  </div>

                  {/* Tamaño de nómina e Interés */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Nómina / Colaboradores
                      </label>
                      <select
                        value={empleados}
                        onChange={(e) => setEmpleados(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.88rem",
                          outline: "none"
                        }}
                      >
                        <option value="1 a 10 colaboradores">1 a 10 colaboradores</option>
                        <option value="11 a 50 colaboradores">11 a 50 colaboradores</option>
                        <option value="51 a 200 colaboradores">51 a 200 colaboradores</option>
                        <option value="Más de 200 colaboradores">Más de 200 colaboradores</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                        Interés Principal
                      </label>
                      <select
                        value={interes}
                        onChange={(e) => setInteres(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          backgroundColor: "#1f2937",
                          border: "1px solid #374151",
                          color: "#ffffff",
                          fontSize: "0.88rem",
                          outline: "none"
                        }}
                      >
                        <option value="Plan de Beneficios Legales para Empleados">Beneficios para Empleados (B2B2C)</option>
                        <option value="Asesoría Legal Continua y Contratos">Asesoría Continua y Contratos</option>
                        <option value="Reestructuración Laboral y Compliance">Compliance y Asesoría Laboral</option>
                        <option value="Defensa Procesal y Cobranzas">Defensa Judicial y Cobranzas</option>
                        <option value="Otro requerimiento personalizado">Otro requerimiento a medida</option>
                      </select>
                    </div>
                  </div>

                  {/* Mensaje opcional */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#cbd5e1", marginBottom: "6px" }}>
                      Mensaje o requerimiento específico (opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder="Cuéntanos brevemente sobre las necesidades legales de tu empresa o qué esperan resolver..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        color: "#ffffff",
                        fontSize: "0.9rem",
                        outline: "none",
                        resize: "vertical"
                      }}
                    />
                  </div>

                  {/* Checkbox LOPDP */}
                  <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", marginTop: "4px" }}>
                    <input
                      type="checkbox"
                      checked={aceptaTerminos}
                      onChange={(e) => setAceptaTerminos(e.target.checked)}
                      style={{ marginTop: "3px", accentColor: "#FEE300" }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4 }}>
                      Autorizo a Tranqi el tratamiento de mis datos de contacto para recibir información personalizada y
                      la propuesta corporativa conforme a la LOPDP.
                    </span>
                  </label>

                  {/* Botón Enviar */}
                  <button
                    type="submit"
                    disabled={enviando}
                    style={{
                      width: "100%",
                      padding: "14px 20px",
                      borderRadius: "12px",
                      backgroundColor: "#FEE300",
                      color: "#000000",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      border: "none",
                      cursor: enviando ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      marginTop: "8px",
                      boxShadow: "0 4px 15px rgba(254, 227, 0, 0.3)",
                      transition: "transform 0.15s, opacity 0.15s",
                      opacity: enviando ? 0.75 : 1
                    }}
                  >
                    {enviando ? (
                      <>
                        <Loader2 size={18} className="anim-spin" /> Enviando solicitud...
                      </>
                    ) : (
                      <>
                        <Send size={18} /> Solicitar Asesoría Personalizada
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
