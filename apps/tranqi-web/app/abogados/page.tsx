"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Send,
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { validarCorreoEstructurado } from "@eco/primitivas";

export default function PaginaRedAbogados() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
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

    if (!nombre.trim() || !correo.trim()) {
      setErrorForm("Por favor completa tu nombre y correo electrónico.");
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
          empresa: "Abogado(a) Independiente",
          nombreContacto: nombre.trim(),
          cargo: "Postulante Red Nacional",
          correo: correo.trim().toLowerCase(),
          telefono: telefono.trim() || "No especificado",
          interes: "Red Nacional de Abogados (somostranqi)",
          mensaje: mensaje.trim() || "Solicitud de contacto e información de activación en la Red Nacional de Abogados."
        })
      });

      if (!res.ok) {
        throw new Error("No se pudo enviar el formulario. Intenta nuevamente.");
      }

      setEnviado(true);
    } catch (err: unknown) {
      setErrorForm(err instanceof Error ? err.message : "Error al procesar el envío.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#333333", fontFamily: "var(--fuente-sans, 'Poppins', 'Inter', sans-serif)", overflowX: "hidden" }}>
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* NAVEGACIÓN SUPERIOR (Fondo Blanco, idéntica al original) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 10px rgba(0, 0, 0, 0.06)",
          borderBottom: "1px solid #f0f0f0"
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          {/* Logo Tranqi original */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center" }}>
              <img
                src="/assets/abogados/tranqi_logo.png"
                alt="Tranqi"
                style={{ height: "42px", width: "auto" }}
              />
            </Link>
          </div>

          {/* Menú de Navegación somostranqi */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px"
            }}
          >
            <a
              href="#beneficios"
              style={{
                color: "#5100bb",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: 600,
                transition: "opacity 0.2s"
              }}
            >
              Beneficios
            </a>
            <a
              href="#comofunciona"
              style={{
                color: "#5100bb",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: 600,
                transition: "opacity 0.2s"
              }}
            >
              Como Funciona
            </a>
            <a
              href="#app"
              style={{
                color: "#5100bb",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: 600,
                transition: "opacity 0.2s"
              }}
            >
              App
            </a>
            <a
              href="#formulario"
              style={{
                color: "#5100bb",
                textDecoration: "none",
                fontSize: "0.95rem",
                fontWeight: 600,
                transition: "opacity 0.2s"
              }}
            >
              Únete a la red
            </a>
          </nav>

          {/* Acciones */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "0.88rem",
                color: "#666666",
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
                backgroundColor: "#fee400",
                color: "#5100bb",
                fontSize: "0.85rem",
                fontWeight: 800,
                padding: "9px 22px",
                borderRadius: "999px",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                boxShadow: "0 2px 8px rgba(254, 228, 0, 0.4)"
              }}
            >
              Quiero Unirme
            </a>
          </div>
        </div>
      </header>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 0: HERO (Foto con iluminación natural como imagen 2) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          minHeight: "86vh",
          display: "flex",
          alignItems: "center",
          backgroundImage: "linear-gradient(to right, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0.28) 42%, rgba(0, 0, 0, 0) 65%), url('/assets/abogados/chico1b.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center right",
          padding: "70px 24px"
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            width: "100%",
            display: "flex",
            alignItems: "center"
          }}
        >
          {/* Columna Izquierda con texto blanco alineado a la izquierda */}
          <div style={{ maxWidth: "640px" }}>
            <div style={{ marginBottom: "18px" }}>
              <span
                style={{
                  display: "inline-block",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  borderBottom: "2px solid #fee400",
                  paddingBottom: "4px"
                }}
              >
                RED NACIONAL DE ABOGADOS
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(2.4rem, 4.6vw, 3.8rem)",
                fontWeight: 800,
                lineHeight: 1.14,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                margin: "0 0 24px 0",
                textShadow: "0 2px 14px rgba(0, 0, 0, 0.3)"
              }}
            >
              Tu práctica legal con más casos, más ingresos y más respaldo.
            </h1>

            <p
              style={{
                fontSize: "clamp(1.05rem, 1.8vw, 1.15rem)",
                lineHeight: 1.65,
                color: "#ffffff",
                margin: "0 0 36px 0",
                maxWidth: "580px",
                textShadow: "0 1px 8px rgba(0, 0, 0, 0.4)"
              }}
            >
              Únete a la red de abogados de Tranqi y conecta con clientes reales que necesitan tu ayuda, mientras accedes a beneficios exclusivos, capacitación y una cuenta digital pensada para tu profesión.
            </p>

            <div>
              <a
                href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
                style={{
                  display: "inline-block",
                  backgroundColor: "#fee400",
                  color: "#000000",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "14px 34px",
                  borderRadius: "999px",
                  textDecoration: "none",
                  boxShadow: "0 4px 18px rgba(0, 0, 0, 0.25)",
                  transition: "transform 0.15s ease"
                }}
              >
                QUIERO UNIRME
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 1: BENEFICIOS (Morado #5100bb con patrón de marca) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="beneficios"
        style={{
          backgroundColor: "#5100bb",
          backgroundImage: "url('/assets/abogados/patronmarca3.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "top right",
          padding: "90px 24px 100px",
          color: "#ffffff"
        }}
      >
        <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
          <div style={{ marginBottom: "50px" }}>
            <span
              style={{
                display: "inline-block",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderBottom: "2px solid #fee400",
                paddingBottom: "4px",
                marginBottom: "14px"
              }}
            >
              Por qué unirte
            </span>
            <h2
              style={{
                fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
                fontWeight: 800,
                lineHeight: 1.18,
                margin: "12px 0 16px 0",
                color: "#ffffff"
              }}
            >
              Todo lo que ganas al ser Socio Tranqi.
            </h2>
            <p
              style={{
                fontSize: "1.15rem",
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.9)",
                maxWidth: "800px",
                margin: 0
              }}
            >
              Formar parte de la Red Nacional de Abogados significa acceso directo a clientes, herramientas y un ecosistema que crece contigo.
            </p>
          </div>

          {/* 8 Beneficios en 2 columnas con checks blancos */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              columnGap: "60px",
              rowGap: "26px"
            }}
          >
            {[
              "Nuevas oportunidades laborales",
              "Beneficios exclusivos",
              "Certificaciones",
              "Cuenta digital propia",
              "Nuevas fuentes de ingresos",
              "Capacitación constante",
              "Red de derivación de clientes",
              "Programas de crédito y desarrollo"
            ].map((beneficio, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px"
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    color: "#5100bb",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0
                  }}
                >
                  <Check size={20} strokeWidth={3} />
                </div>
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "#ffffff",
                    margin: 0
                  }}
                >
                  {beneficio}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 2: CÓMO FUNCIONA (Fondo Blanco #ffffff) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="comofunciona"
        style={{
          backgroundColor: "#ffffff",
          padding: "90px 24px",
          color: "#333333"
        }}
      >
        <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
          <div style={{ marginBottom: "60px" }}>
            <span
              style={{
                display: "inline-block",
                color: "#5100bb",
                fontSize: "0.85rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderBottom: "2px solid #fee400",
                paddingBottom: "4px",
                marginBottom: "14px"
              }}
            >
              Cómo funciona
            </span>
            <h2
              style={{
                fontSize: "clamp(2.1rem, 3.8vw, 3rem)",
                fontWeight: 800,
                color: "#1e1e2f",
                margin: "12px 0 0 0"
              }}
            >
              Empieza a recibir casos en tres pasos.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "40px"
            }}
          >
            {/* Paso 1 */}
            <div>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#5100bb",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "20px"
                }}
              >
                <img
                  src="/assets/abogados/paso1.png"
                  alt="Regístrate"
                  style={{ width: "26px", height: "auto" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#1e1e2f",
                  margin: "0 0 10px 0"
                }}
              >
                Regístrate
              </h3>
              <p
                style={{
                  fontSize: "0.98rem",
                  lineHeight: 1.6,
                  color: "#666666",
                  margin: 0
                }}
              >
                Completa el formulario con tu información profesional y área de práctica.
              </p>
            </div>

            {/* Paso 2 */}
            <div>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#5100bb",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "20px"
                }}
              >
                <img
                  src="/assets/abogados/paso2.png"
                  alt="Verificación"
                  style={{ width: "26px", height: "auto" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#1e1e2f",
                  margin: "0 0 10px 0"
                }}
              >
                Verificación
              </h3>
              <p
                style={{
                  fontSize: "0.98rem",
                  lineHeight: 1.6,
                  color: "#666666",
                  margin: 0
                }}
              >
                Nuestro equipo valida tu perfil y te activa dentro de la Red Nacional de Abogados.
              </p>
            </div>

            {/* Paso 3 */}
            <div>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#5100bb",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "20px"
                }}
              >
                <img
                  src="/assets/abogados/paso3.png"
                  alt="Recibe casos y beneficios"
                  style={{ width: "26px", height: "auto" }}
                />
              </div>
              <h3
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#1e1e2f",
                  margin: "0 0 10px 0"
                }}
              >
                Recibe casos y beneficios
              </h3>
              <p
                style={{
                  fontSize: "0.98rem",
                  lineHeight: 1.6,
                  color: "#666666",
                  margin: 0
                }}
              >
                Accede a la app, gestiona tus citas, cobra tus honorarios y crece con Tranqi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 3: MANIFIESTO (Fondo Claro con tipografía morada) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        style={{
          backgroundColor: "#f9fafb",
          borderTop: "1px solid #eeeeee",
          borderBottom: "1px solid #eeeeee",
          padding: "80px 24px",
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 2.8vw, 2.2rem)",
              fontWeight: 700,
              color: "#333333",
              lineHeight: 1.4,
              margin: "0 0 20px 0"
            }}
          >
            Sé el abogado que la gente busca cuando más lo necesita — y que Tranqi lleve hasta ti a quien lo necesita.
          </h2>
          <h4
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#5100bb",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: 0
            }}
          >
            Democratizar la justicia para que los derechos sean de todos.
          </h4>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 4: APP (Fondo Blanco #ffffff con fonoapp.webp) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="app"
        style={{
          backgroundColor: "#ffffff",
          padding: "90px 24px",
          color: "#333333"
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "50px",
            alignItems: "center"
          }}
        >
          {/* Izquierda: Textos y Lista */}
          <div>
            <span
              style={{
                display: "inline-block",
                color: "#5100bb",
                fontSize: "0.85rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderBottom: "2px solid #fee400",
                paddingBottom: "4px",
                marginBottom: "14px"
              }}
            >
              Cómo funciona
            </span>
            <h2
              style={{
                fontSize: "clamp(2.1rem, 3.8vw, 2.9rem)",
                fontWeight: 800,
                color: "#1e1e2f",
                lineHeight: 1.18,
                margin: "10px 0 16px 0"
              }}
            >
              Gestiona tu práctica legal desde el celular.
            </h2>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 600,
                color: "#5100bb",
                margin: "0 0 28px 0"
              }}
            >
              La misma app que usan tus clientes, ahora trabajando para ti.
            </h3>

            <div style={{ display: "grid", gap: "16px" }}>
              {[
                "Agenda citas presenciales y virtuales",
                "Recibe casos derivados de la Red Nacional",
                "Cobra tus honorarios de forma segura",
                "Accede a programas de crédito y desarrollo",
                "Da seguimiento a cada trámite en curso"
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(81, 0, 187, 0.1)",
                      color: "#5100bb",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: "1.05rem", color: "#444444", fontWeight: 500 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Derecha: Mockup del Celular */}
          <div style={{ textAlign: "center" }}>
            <img
              src="/assets/abogados/fonoapp.webp"
              alt="Tranqi App Móvil"
              style={{
                maxWidth: "100%",
                maxHeight: "540px",
                height: "auto",
                objectFit: "contain"
              }}
            />
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 5: FORMULARIO Y REGISTRO (Screenshot 3 verde esmeralda) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <section
        id="formulario"
        style={{
          padding: "50px 24px 90px",
          backgroundColor: "#ffffff"
        }}
      >
        <div
          style={{
            maxWidth: "1180px",
            margin: "0 auto",
            backgroundColor: "#085e54",
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 18px 45px rgba(8, 94, 84, 0.25)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            color: "#ffffff"
          }}
        >
          {/* Columna Izquierda: Información de activación y botón de registro obligatorio */}
          <div
            style={{
              padding: "48px 40px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "clamp(1.9rem, 3.5vw, 2.6rem)",
                  fontWeight: 800,
                  color: "#ffffff",
                  lineHeight: 1.18,
                  margin: "0 0 16px 0"
                }}
              >
                Forma parte de la Red Nacional de Abogados Tranqi.
              </h2>

              <h4
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 8px 0"
                }}
              >
                Lo legal para todos, empieza contigo.
              </h4>

              <p
                style={{
                  fontSize: "0.95rem",
                  color: "rgba(255, 255, 255, 0.9)",
                  margin: "0 0 32px 0",
                  lineHeight: 1.5
                }}
              >
                Déjanos tus datos y un asesor de Tranqi se pondrá en contacto para activar tu perfil.
              </p>

              {/* Checklist idéntico a Screenshot 3 */}
              <div style={{ display: "grid", gap: "14px", marginBottom: "36px" }}>
                {[
                  "Da seguimiento a cada trámite en curso",
                  "Activación en pocos días",
                  "Soporte durante todo el proceso"
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "1rem", fontWeight: 600 }}>
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "5px",
                        border: "2px solid #ffffff",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0
                      }}
                    >
                      <Check size={15} strokeWidth={3} />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BOTÓN OBLIGATORIO DE REGISTRO COMO ABOGADO (el existente) */}
            <div style={{ paddingTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.2)" }}>
              <a
                href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  width: "100%",
                  backgroundColor: "#fee400",
                  color: "#000000",
                  fontSize: "1rem",
                  fontWeight: 800,
                  padding: "15px 28px",
                  borderRadius: "12px",
                  textDecoration: "none",
                  textAlign: "center",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)"
                }}
              >
                Quiero ser parte de la red <ArrowRight size={18} />
              </a>
            </div>
          </div>

          {/* Columna Derecha: Foto de la abogada con formulario original */}
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
            {/* Gradiente sutil inferior */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(8, 94, 84, 0.95) 0%, rgba(8, 94, 84, 0.25) 50%, transparent 100%)"
              }}
            />

            {/* Formulario de Contacto integrado */}
            <div
              style={{
                position: "relative",
                zIndex: 10,
                width: "100%",
                padding: "24px 30px",
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(8px)",
                color: "#333333"
              }}
            >
              {enviado ? (
                <div style={{ textAlign: "center", padding: "16px 10px" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      backgroundColor: "#085e54",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 10px"
                    }}
                  >
                    <Check size={22} strokeWidth={3} />
                  </div>
                  <h4 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 6px 0", color: "#085e54" }}>
                    ¡Información Enviada!
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "#666666", margin: "0 0 14px 0" }}>
                    Un asesor de Tranqi se comunicará contigo para asistirte en la activación.
                  </p>
                  <a
                    href="/registro?intencion=abogado&destino=/panel/solicitud-socio"
                    style={{
                      display: "inline-block",
                      backgroundColor: "#fee400",
                      color: "#000000",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      padding: "8px 20px",
                      borderRadius: "999px",
                      textDecoration: "none"
                    }}
                  >
                    Completar Registro Ahora
                  </a>
                </div>
              ) : (
                <form onSubmit={handleEnviarConsulta}>
                  <div style={{ marginBottom: "10px" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#085e54", textTransform: "uppercase" }}>
                      O solicita que un asesor te contacte:
                    </span>
                  </div>

                  {errorForm && (
                    <div
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#fee2e2",
                        border: "1px solid #f87171",
                        borderRadius: "6px",
                        color: "#b91c1c",
                        fontSize: "0.78rem",
                        marginBottom: "10px"
                      }}
                    >
                      {errorForm}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Name"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #cccccc",
                        color: "#333333",
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
                        placeholder="Email Address"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          backgroundColor: "#ffffff",
                          border: errorCorreo ? "1.5px solid #ef4444" : "1px solid #cccccc",
                          color: "#333333",
                          fontSize: "0.85rem",
                          outline: "none"
                        }}
                      />
                      {errorCorreo && (
                        <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "#dc2626" }}>
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
                                background: "#fef3c7",
                                color: "#92400e",
                                border: "1px solid #f59e0b",
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

                  <div style={{ marginBottom: "8px" }}>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Teléfono / WhatsApp"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #cccccc",
                        color: "#333333",
                        fontSize: "0.85rem",
                        outline: "none"
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <textarea
                      rows={2}
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder="Message"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #cccccc",
                        color: "#333333",
                        fontSize: "0.85rem",
                        outline: "none",
                        resize: "none"
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enviando}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: "6px",
                      backgroundColor: "#5100bb",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "0.9rem",
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
                        <Loader2 size={16} className="anim-girar" /> Enviando...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Enviar
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
      {/* PIE DE PÁGINA (somostranqi original) */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          borderTop: "1px solid #eeeeee",
          padding: "30px 24px",
          backgroundColor: "#ffffff",
          textAlign: "center"
        }}
      >
        <div style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", justifyContent: "center", fontSize: "0.85rem", color: "#666666" }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              Inicio
            </Link>
            <Link href="/#planes" style={{ color: "inherit", textDecoration: "none" }}>
              Planes
            </Link>
            <Link href="/empresas/contacto" style={{ color: "inherit", textDecoration: "none" }}>
              Empresas
            </Link>
            <Link href="/vacantes" style={{ color: "inherit", textDecoration: "none" }}>
              Bolsa de Empleo
            </Link>
            <Link href="/terminos" style={{ color: "inherit", textDecoration: "none" }}>
              Términos
            </Link>
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#999999" }}>
            © 2026 Tranqi. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
