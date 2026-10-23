"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  TrendingUp,
  Award,
  Wallet,
  BookOpen,
  Users2,
  CreditCard,
  Send,
  Loader2,
  AlertCircle
} from "lucide-react";
import { validarCorreoEstructurado } from "@eco/primitivas";

export default function PaginaRedAbogados() {
  // Estado para formulario de contacto directo de la sección final
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [areaPractica, setAreaPractica] = useState("Derecho Civil & Procesal");
  const [mensaje, setMensaje] = useState("");
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [sugerenciaCorreo, setSugerenciaCorreo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const validarEmail = (val: string) => {
    setCorreo(val);
    if (!val.trim()) {
      setErrorCorreo(null);
      setSugerenciaCorreo(null);
      return;
    }
    const res = validarCorreoEstructurado(val);
    if (!res.esValido) {
      setErrorCorreo(res.error || "Formato de correo no válido.");
      setSugerenciaCorreo(res.sugerencia || null);
    } else {
      setErrorCorreo(null);
      setSugerenciaCorreo(null);
    }
  };

  const handleEnviarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);

    if (!nombre.trim() || !correo.trim() || !telefono.trim()) {
      setErrorForm("Por favor completa tu nombre, correo y teléfono.");
      return;
    }

    const val = validarCorreoEstructurado(correo);
    if (!val.esValido) {
      setErrorForm(val.error || "El correo electrónico no es válido.");
      setErrorCorreo(val.error || null);
      setSugerenciaCorreo(val.sugerencia || null);
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/empresas/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: "Abogado Independiente / Estudio Jurídico",
          nombreContacto: nombre.trim(),
          cargo: "Abogado(a) Postulante",
          correo: correo.trim().toLowerCase(),
          telefono: telefono.trim(),
          interes: `Red de Abogados — Especialidad: ${areaPractica}`,
          mensaje: mensaje.trim() || "Deseo recibir información para sumarme a la Red Nacional de Abogados Tranqi."
        })
      });

      if (!res.ok) {
        throw new Error("No se pudo enviar la consulta. Intenta nuevamente.");
      }

      setEnviado(true);
    } catch (err: unknown) {
      setErrorForm(err instanceof Error ? err.message : "Error al procesar el envío.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0e17", color: "#f8fafc", fontFamily: "var(--fuente-sans, sans-serif)", overflowX: "hidden" }}>
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* NAVEGACIÓN SUPERIOR */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "rgba(10, 14, 23, 0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          {/* Logo y Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center" }}>
              <img src="/assets/tranqi-white.svg" alt="tranqi" style={{ height: "30px", width: "auto" }} />
            </Link>
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
              Red Nacional
            </span>
          </div>

          {/* Menú de Navegación somostranqi */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "28px"
            }}
            className="menu-desktop"
          >
            <a href="#beneficios" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              Beneficios
            </a>
            <a href="#comofunciona" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              Cómo Funciona
            </a>
            <a href="#app" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              App
            </a>
            <a href="#unete" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
              Únete a la red
            </a>
          </nav>

          {/* Acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.85rem",
                color: "#94a3b8",
                textDecoration: "none",
                fontWeight: 600
              }}
            >
              <ArrowLeft size={15} /> Volver
            </Link>
            <a
              href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#FEE300",
                color: "#000000",
                fontSize: "0.85rem",
                fontWeight: 800,
                padding: "8px 18px",
                borderRadius: "999px",
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(254, 227, 0, 0.25)"
              }}
            >
              Quiero Unirme
            </a>
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 1: HERO (Tu práctica legal...) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          minHeight: "75vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px 100px",
          backgroundImage: "linear-gradient(rgba(10, 14, 23, 0.82), rgba(10, 14, 23, 0.94)), url('/assets/abogados/chico1b.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 10 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(129, 57, 255, 0.2)",
              border: "1px solid rgba(129, 57, 255, 0.4)",
              color: "#c7c7f4",
              fontSize: "0.82rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "6px 16px",
              borderRadius: "999px",
              marginBottom: "20px"
            }}
          >
            <ShieldCheck size={16} color="#FEE300" /> Red Nacional de Abogados
          </div>

          <h1
            style={{
              fontSize: "clamp(2.3rem, 5vw, 3.6rem)",
              fontWeight: 900,
              lineHeight: 1.15,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              marginBottom: "22px"
            }}
          >
            Tu práctica legal con <span style={{ color: "#FEE300" }}>más casos</span>, más ingresos y <span style={{ color: "#a5ff5b" }}>más respaldo</span>.
          </h1>

          <p
            style={{
              fontSize: "clamp(1.05rem, 2vw, 1.25rem)",
              lineHeight: 1.6,
              color: "#cbd5e1",
              maxWidth: "740px",
              margin: "0 auto 36px"
            }}
          >
            Únete a la red de abogados de Tranqi y conecta con clientes reales que necesitan tu ayuda, mientras accedes a beneficios exclusivos, capacitación y una cuenta digital pensada para tu profesión.
          </p>

          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#FEE300",
                color: "#000000",
                fontSize: "1rem",
                fontWeight: 800,
                padding: "14px 32px",
                borderRadius: "999px",
                textDecoration: "none",
                boxShadow: "0 6px 20px rgba(254, 227, 0, 0.35)",
                transition: "transform 0.2s"
              }}
            >
              Quiero Unirme <ArrowRight size={18} />
            </a>

            <a
              href="#beneficios"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                fontSize: "1rem",
                fontWeight: 700,
                padding: "14px 28px",
                borderRadius: "999px",
                textDecoration: "none",
                border: "1px solid rgba(255, 255, 255, 0.2)"
              }}
            >
              Por qué unirte
            </a>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 2: BENEFICIOS (#beneficios) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="beneficios"
        style={{
          padding: "100px 24px",
          maxWidth: "1280px",
          margin: "0 auto"
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 60px" }}>
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#a5ff5b",
              display: "block",
              marginBottom: "10px"
            }}
          >
            Por qué unirte
          </span>
          <h2
            style={{
              fontSize: "clamp(2rem, 3.5vw, 2.8rem)",
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.2,
              marginBottom: "16px"
            }}
          >
            Todo lo que ganas al ser Socio Tranqi.
          </h2>
          <p style={{ fontSize: "1.1rem", color: "#94a3b8", lineHeight: 1.6 }}>
            Formar parte de la Red Nacional de Abogados significa acceso directo a clientes, herramientas y un ecosistema que crece contigo.
          </p>
        </div>

        {/* Grid de 8 Beneficios */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px"
          }}
        >
          {/* 1 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(129, 57, 255, 0.15)",
                color: "#c7c7f4",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Briefcase size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Nuevas oportunidades laborales
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Acceso permanente a solicitudes de patrocinio, consultas y trámites legales asignados de acuerdo con tus áreas de práctica.
            </p>
          </div>

          {/* 2 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(165, 255, 91, 0.15)",
                color: "#a5ff5b",
                display: "grid",
                placeItems: "center"
              }}
            >
              <TrendingUp size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Nuevas fuentes de ingresos
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Multiplica tus ingresos profesionales y rentabiliza tus horas disponibles sin invertir en publicidad ni captación comercial.
            </p>
          </div>

          {/* 3 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(254, 227, 0, 0.15)",
                color: "#FEE300",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Award size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Beneficios exclusivos
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Condiciones preferenciales en servicios del ecosistema, asesoría contable, herramientas digitales y convenios corporativos.
            </p>
          </div>

          {/* 4 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(129, 57, 255, 0.15)",
                color: "#c7c7f4",
                display: "grid",
                placeItems: "center"
              }}
            >
              <BookOpen size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Capacitación constante
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Actualización legal permanente con juristas expertos en reformas legislativas, jurisprudencia y litigio estratégico en el Ecuador.
            </p>
          </div>

          {/* 5 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(254, 227, 0, 0.15)",
                color: "#FEE300",
                display: "grid",
                placeItems: "center"
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Certificaciones
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Insignia oficial de Abogado Verificado ante los clientes de Tranqi, respaldando tu probidad, matrícula y trayectoria profesional.
            </p>
          </div>

          {/* 6 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(165, 255, 91, 0.15)",
                color: "#a5ff5b",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Users2 size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Red de derivación de clientes
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Derivación inteligente de usuarios particulares y empresas que requieren atención legal inmediata en tu provincia o cantón.
            </p>
          </div>

          {/* 7 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(129, 57, 255, 0.15)",
                color: "#c7c7f4",
                display: "grid",
                placeItems: "center"
              }}
            >
              <Wallet size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Cuenta digital propia
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Panel de gestión para cobro puntual de honorarios, control de liquidaciones y trazabilidad de ingresos con total transparencia.
            </p>
          </div>

          {/* 8 */}
          <div
            style={{
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "18px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(254, 227, 0, 0.15)",
                color: "#FEE300",
                display: "grid",
                placeItems: "center"
              }}
            >
              <CreditCard size={24} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Programas de crédito y desarrollo
            </h3>
            <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
              Acceso a financiamiento jurídico para tus clientes y facilidades de financiamiento para modernizar tu propio despacho profesional.
            </p>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 3: CÓMO FUNCIONA (#comofunciona) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="comofunciona"
        style={{
          padding: "100px 24px",
          backgroundColor: "#0d131f",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 60px" }}>
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#FEE300",
                display: "block",
                marginBottom: "10px"
              }}
            >
              Cómo funciona
            </span>
            <h2
              style={{
                fontSize: "clamp(2rem, 3.5vw, 2.8rem)",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.2,
                marginBottom: "16px"
              }}
            >
              Empieza a recibir casos en tres pasos.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "32px"
            }}
          >
            {/* Paso 1 */}
            <div
              style={{
                backgroundColor: "#111827",
                borderRadius: "20px",
                padding: "36px 30px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                position: "relative"
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#5000BA",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "24px"
                }}
              >
                <img src="/assets/abogados/paso1.png" alt="Paso 1" style={{ width: "28px", height: "auto" }} />
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FEE300", textTransform: "uppercase" }}>
                Paso 01
              </span>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", margin: "8px 0 12px" }}>
                Regístrate
              </h3>
              <p style={{ fontSize: "0.96rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Completa el formulario con tu información profesional y área de práctica. Solo toma unos minutos.
              </p>
            </div>

            {/* Paso 2 */}
            <div
              style={{
                backgroundColor: "#111827",
                borderRadius: "20px",
                padding: "36px 30px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                position: "relative"
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#5000BA",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "24px"
                }}
              >
                <img src="/assets/abogados/paso2.png" alt="Paso 2" style={{ width: "28px", height: "auto" }} />
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FEE300", textTransform: "uppercase" }}>
                Paso 02
              </span>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", margin: "8px 0 12px" }}>
                Verificación
              </h3>
              <p style={{ fontSize: "0.96rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Nuestro equipo valida tu perfil, matrícula del Foro y título universitario para activarte en la Red Nacional de Abogados.
              </p>
            </div>

            {/* Paso 3 */}
            <div
              style={{
                backgroundColor: "#111827",
                borderRadius: "20px",
                padding: "36px 30px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                position: "relative"
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#5000BA",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "24px"
                }}
              >
                <img src="/assets/abogados/paso3.png" alt="Paso 3" style={{ width: "28px", height: "auto" }} />
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FEE300", textTransform: "uppercase" }}>
                Paso 03
              </span>
              <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#ffffff", margin: "8px 0 12px" }}>
                Recibe casos y beneficios
              </h3>
              <p style={{ fontSize: "0.96rem", color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Accede a la app, gestiona tus citas presenciales o virtuales, cobra tus honorarios y crece con Tranqi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 4: MANIFIESTO */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "90px 24px",
          background: "linear-gradient(135deg, #5000BA 0%, #1e0944 100%)",
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <p
            style={{
              fontSize: "clamp(1.5rem, 3.2vw, 2.3rem)",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.35,
              marginBottom: "24px"
            }}
          >
            “Sé el abogado que la gente busca cuando más lo necesita — y que Tranqi lleve hasta ti a quien lo necesita.”
          </p>
          <p
            style={{
              fontSize: "1.1rem",
              color: "#FEE300",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: 0
            }}
          >
            Democratizar la justicia para que los derechos sean de todos.
          </p>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 5: APP MÓVIL (#app) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="app"
        style={{
          padding: "100px 24px",
          maxWidth: "1280px",
          margin: "0 auto"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "50px",
            alignItems: "center"
          }}
        >
          {/* Texto Izquierda */}
          <div>
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#a5ff5b",
                display: "block",
                marginBottom: "10px"
              }}
            >
              Cómo funciona
            </span>
            <h2
              style={{
                fontSize: "clamp(2rem, 3.5vw, 2.8rem)",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.2,
                marginBottom: "18px"
              }}
            >
              Gestiona tu práctica legal desde el celular.
            </h2>
            <p style={{ fontSize: "1.15rem", color: "#cbd5e1", lineHeight: 1.6, marginBottom: "32px" }}>
              La misma app que usan tus clientes, <span style={{ color: "#FEE300", fontWeight: 700 }}>ahora trabajando para ti</span>.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "16px" }}>
              {[
                "Agenda citas presenciales y virtuales",
                "Recibe casos derivados de la Red Nacional",
                "Cobra tus honorarios de forma segura",
                "Accede a programas de crédito y desarrollo",
                "Da seguimiento a cada trámite en curso"
              ].map((item, idx) => (
                <li key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "1.02rem", color: "#f1f5f9" }}>
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(165, 255, 91, 0.15)",
                      color: "#a5ff5b",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Imagen Mockup Derecha */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-block",
                padding: "20px",
                background: "radial-gradient(circle, rgba(129, 57, 255, 0.25) 0%, rgba(10, 14, 23, 0) 70%)",
                borderRadius: "32px"
              }}
            >
              <img
                src="/assets/abogados/fonoapp.webp"
                alt="App móvil Tranqi para abogados"
                style={{
                  maxWidth: "100%",
                  maxHeight: "520px",
                  height: "auto",
                  filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))"
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 6: LÁMINA FINAL DE ACTIVACIÓN (#unete, Screenshot 3) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="unete"
        style={{
          padding: "60px 24px 100px",
          maxWidth: "1280px",
          margin: "0 auto"
        }}
      >
        {/* Contenedor Verde Esmeralda (Screenshot 3) */}
        <div
          style={{
            backgroundColor: "#085e54",
            borderRadius: "28px",
            overflow: "hidden",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            alignItems: "stretch"
          }}
        >
          {/* Columna Izquierda: Información de activación y checklist */}
          <div
            style={{
              padding: "48px 40px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              zIndex: 10
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#a5ff5b",
                  marginBottom: "12px"
                }}
              >
                Convocatoria Abierta
              </div>

              <h2
                style={{
                  fontSize: "clamp(2rem, 3.6vw, 2.7rem)",
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                  marginBottom: "16px"
                }}
              >
                Forma parte de la Red Nacional de Abogados Tranqi.
              </h2>

              <p
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "#f8fafc",
                  marginBottom: "8px"
                }}
              >
                Lo legal para todos, empieza contigo.
              </p>

              <p
                style={{
                  fontSize: "0.95rem",
                  color: "rgba(255, 255, 255, 0.85)",
                  lineHeight: 1.5,
                  marginBottom: "28px"
                }}
              >
                Déjanos tus datos y un asesor de Tranqi se pondrá en contacto para activar tu perfil.
              </p>

              {/* Checklist exactamente como Screenshot 3 */}
              <div style={{ display: "grid", gap: "14px", marginBottom: "36px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.98rem", fontWeight: 600, color: "#ffffff" }}>
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      border: "2px solid #ffffff",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff"
                    }}
                  >
                    ✓
                  </div>
                  <span>Da seguimiento a cada trámite en curso</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.98rem", fontWeight: 600, color: "#ffffff" }}>
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      border: "2px solid #ffffff",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff"
                    }}
                  >
                    ✓
                  </div>
                  <span>Activación en pocos días</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.98rem", fontWeight: 600, color: "#ffffff" }}>
                  <div
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "6px",
                      border: "2px solid #ffffff",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff"
                    }}
                  >
                    ✓
                  </div>
                  <span>Soporte durante todo el proceso</span>
                </div>
              </div>
            </div>

            {/* BOTÓN OBLIGATORIO DE REGISTRO COMO ABOGADO (el existente) */}
            <div style={{ paddingTop: "16px", borderTop: "1px solid rgba(255, 255, 255, 0.15)" }}>
              <p style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.8)", marginBottom: "12px", fontWeight: 500 }}>
                ¿Listo para iniciar tu registro profesional de inmediato?
              </p>
              <a
                href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  width: "100%",
                  maxWidth: "380px",
                  backgroundColor: "#FEE300",
                  color: "#000000",
                  fontSize: "1.05rem",
                  fontWeight: 900,
                  padding: "16px 28px",
                  borderRadius: "14px",
                  textDecoration: "none",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                  textAlign: "center"
                }}
              >
                Quiero ser parte de la red <ArrowRight size={20} />
              </a>
            </div>
          </div>

          {/* Columna Derecha: Foto de la Abogada y Formulario de Contacto Rápido */}
          <div
            style={{
              position: "relative",
              minHeight: "440px",
              backgroundImage: "url('/assets/abogados/chica1c.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center right",
              display: "flex",
              alignItems: "flex-end"
            }}
          >
            {/* Gradiente de integración sobre la imagen */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(8, 94, 84, 0.95) 0%, rgba(8, 94, 84, 0.3) 50%, transparent 100%)"
              }}
            />

            {/* Formulario Rápido para Abogados que desean ser contactados */}
            <div
              style={{
                position: "relative",
                zIndex: 10,
                width: "100%",
                padding: "28px",
                backgroundColor: "rgba(10, 14, 23, 0.88)",
                backdropFilter: "blur(12px)",
                borderTop: "1px solid rgba(255, 255, 255, 0.15)"
              }}
            >
              {enviado ? (
                <div style={{ textAlign: "center", padding: "20px 10px" }}>
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(165, 255, 91, 0.2)",
                      color: "#a5ff5b",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 12px"
                    }}
                  >
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ffffff", margin: "0 0 6px" }}>
                    ¡Datos recibidos con éxito!
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: "0 0 16px" }}>
                    Un asesor de Tranqi se comunicará contigo al teléfono o correo indicado para guiarte en el proceso de activación.
                  </p>
                  <a
                    href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
                    style={{
                      display: "inline-block",
                      backgroundColor: "#FEE300",
                      color: "#000000",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      padding: "8px 18px",
                      borderRadius: "999px",
                      textDecoration: "none"
                    }}
                  >
                    Avanzar con mi registro ahora
                  </a>
                </div>
              ) : (
                <form onSubmit={handleEnviarConsulta}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                    <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#FEE300", textTransform: "uppercase" }}>
                      ¿Prefieres que un asesor te contacte?
                    </span>
                  </div>

                  {errorForm && (
                    <div
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "8px",
                        color: "#f87171",
                        fontSize: "0.8rem",
                        marginBottom: "12px"
                      }}
                    >
                      {errorForm}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Tu Nombre Completo *"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(31, 41, 55, 0.9)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />

                    <div>
                      <input
                        type="email"
                        required
                        value={correo}
                        onChange={(e) => validarEmail(e.target.value)}
                        onBlur={() => validarEmail(correo)}
                        placeholder="tu.correo@ejemplo.com *"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(31, 41, 55, 0.9)",
                          border: errorCorreo ? "1.5px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#ffffff",
                          fontSize: "0.85rem",
                          outline: "none"
                        }}
                      />
                      {errorCorreo && (
                        <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "#f87171" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <AlertCircle size={12} style={{ flexShrink: 0 }} />
                            <span>{errorCorreo}</span>
                          </div>
                          {sugerenciaCorreo && (
                            <button
                              type="button"
                              onClick={() => {
                                setCorreo(sugerenciaCorreo);
                                validarEmail(sugerenciaCorreo);
                              }}
                              style={{
                                display: "block",
                                marginTop: "2px",
                                background: "rgba(254, 227, 0, 0.2)",
                                color: "#FEE300",
                                border: "none",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                fontWeight: 700
                              }}
                            >
                              Corregir a {sugerenciaCorreo}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <input
                      type="tel"
                      required
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Teléfono / WhatsApp *"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(31, 41, 55, 0.9)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />

                    <select
                      value={areaPractica}
                      onChange={(e) => setAreaPractica(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(31, 41, 55, 0.9)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "0.82rem",
                        outline: "none"
                      }}
                    >
                      <option value="Derecho Civil & Procesal">Civil & Procesal</option>
                      <option value="Derecho Laboral">Laboral</option>
                      <option value="Derecho Penal">Penal</option>
                      <option value="Derecho Societario">Societario / Corporativo</option>
                      <option value="Derecho de Familia">Familia & Niñez</option>
                      <option value="Otra Especialidad">Otra Especialidad</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <input
                      type="text"
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder="Mensaje o consulta específica (opcional)"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(31, 41, 55, 0.9)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#ffffff",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enviando}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#ffffff",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      cursor: enviando ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    {enviando ? (
                      <>
                        <Loader2 size={16} className="anim-girar" /> Enviando datos...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Solicitar Contacto de un Asesor
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* PIE DE PÁGINA */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "40px 24px",
          backgroundColor: "#070a10",
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <img src="/assets/tranqi-white.svg" alt="tranqi" style={{ height: "26px", width: "auto" }} />
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center", fontSize: "0.85rem", color: "#94a3b8" }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              Inicio
            </Link>
            <Link href="/#planes" style={{ color: "inherit", textDecoration: "none" }}>
              Planes
            </Link>
            <Link href="/empresas/contacto" style={{ color: "inherit", textDecoration: "none" }}>
              Planes Corporativos
            </Link>
            <Link href="/vacantes" style={{ color: "inherit", textDecoration: "none" }}>
              Bolsa de Empleo
            </Link>
            <Link href="/terminos" style={{ color: "inherit", textDecoration: "none" }}>
              Términos y Privacidad
            </Link>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
            © 2026 Tranqi. Todos los derechos reservados. Red Nacional de Abogados.
          </p>
        </div>
      </footer>
    </div>
  );
}
