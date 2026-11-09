"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Clock, Coins, ArrowLeft, ShoppingBag, Calendar, CheckCircle2 } from "lucide-react";

export interface WidgetProximamenteProps {
  titulo?: string;
  subtitulo?: string;
  moduloClave?: string;
}

export function WidgetProximamente({
  titulo = "Financiamiento & Cuotas para tu Caso",
  subtitulo = "Estamos trabajando en ello. Próximamente estará disponible esta funcionalidad para que puedas diferir y financiar tus trámites y patrocinios legales en cuotas flexibles.",
  moduloClave = "financiamiento",
}: WidgetProximamenteProps) {
  const esFinanciamiento = moduloClave === "financiamiento";

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "20px",
        border: "1px solid #E4E4E4",
        padding: "36px 28px",
        boxShadow: "0 10px 30px rgba(80, 0, 186, 0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        maxWidth: "720px",
        margin: "0 auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Banda decorativa superior */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: "linear-gradient(90deg, var(--violeta, #5000BA) 0%, #05876E 50%, #F59E0B 100%)",
        }}
      />

      {/* Ícono principal */}
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
          border: "1.5px solid #DDD6FE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "18px",
          boxShadow: "0 6px 16px rgba(80, 0, 186, 0.12)",
        }}
      >
        {esFinanciamiento ? (
          <Coins size={34} color="var(--violeta, #5000BA)" strokeWidth={1.8} />
        ) : (
          <Sparkles size={34} color="var(--violeta, #5000BA)" strokeWidth={1.8} />
        )}
      </div>

      {/* Píldora de estado */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          color: "#B45309",
          padding: "5px 14px",
          borderRadius: "999px",
          fontSize: "0.74rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "14px",
        }}
      >
        <Clock size={13} color="#D97706" />
        <span>Próximamente Disponible</span>
      </div>

      {/* Título principal */}
      <h2
        style={{
          fontSize: "1.45rem",
          fontWeight: 900,
          color: "#111827",
          margin: "0 0 8px 0",
          letterSpacing: "-0.02em",
        }}
      >
        Estamos trabajando en ello
      </h2>

      <h3
        style={{
          fontSize: "1rem",
          fontWeight: 800,
          color: "var(--violeta, #5000BA)",
          margin: "0 0 12px 0",
        }}
      >
        {titulo}
      </h3>

      {/* Mensaje descriptivo */}
      <p
        style={{
          fontSize: "0.92rem",
          color: "#4B5563",
          lineHeight: 1.6,
          maxWidth: "560px",
          margin: "0 0 24px 0",
        }}
      >
        {subtitulo}
      </p>

      {/* Puntos informativos de lo que incluirá */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
          width: "100%",
          marginBottom: "28px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={18} color="#05876E" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ display: "block", fontSize: "0.82rem", color: "#1E293B", marginBottom: "2px" }}>
              {esFinanciamiento ? "Cuotas Flexibles" : "Experiencia Integrada"}
            </strong>
            <span style={{ fontSize: "0.76rem", color: "#64748B", lineHeight: 1.4, display: "block" }}>
              {esFinanciamiento
                ? "Planes de pago adaptados a cada etapa de tu proceso legal."
                : "Acceso directo desde tu panel sin trámites adicionales."}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={18} color="var(--violeta, #5000BA)" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ display: "block", fontSize: "0.82rem", color: "#1E293B", marginBottom: "2px" }}>
              {esFinanciamiento ? "Simulador en Línea" : "100% Digital y Seguro"}
            </strong>
            <span style={{ fontSize: "0.76rem", color: "#64748B", lineHeight: 1.4, display: "block" }}>
              {esFinanciamiento
                ? "Calcula tus cuotas con total transparencia antes de contratar."
                : "Protegido con los estándares de seguridad y privacidad de Tranqi."}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={18} color="#D97706" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ display: "block", fontSize: "0.82rem", color: "#1E293B", marginBottom: "2px" }}>
              {esFinanciamiento ? "Aprobación Ágil" : "Aviso de Lanzamiento"}
            </strong>
            <span style={{ fontSize: "0.76rem", color: "#64748B", lineHeight: 1.4, display: "block" }}>
              {esFinanciamiento
                ? "Evaluación rápida asistida para que tu defensa legal no se detenga."
                : "Te notificaremos apenas la funcionalidad quede habilitada."}
            </span>
          </div>
        </div>
      </div>

      {/* Botones de acción concisos */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/panel"
          className="btn-responsive-accion"
          title="Volver al menú de inicio del panel"
          aria-label="Volver al menú de inicio del panel"
          style={{
            background: "#F8FAFC",
            border: "1px solid #CBD5E1",
            color: "#334155",
            padding: "10px 18px",
            borderRadius: "12px",
            fontSize: "0.85rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ArrowLeft size={16} />
          <span className="btn-texto-responsive">Volver al Inicio</span>
        </Link>

        <Link
          href="/panel/catalogo-productos"
          className="btn-responsive-accion"
          title="Explorar planes y servicios disponibles"
          aria-label="Explorar planes y servicios disponibles"
          style={{
            background: "var(--violeta, #5000BA)",
            border: "1px solid var(--violeta, #5000BA)",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "12px",
            fontSize: "0.85rem",
            fontWeight: 800,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(80, 0, 186, 0.2)",
          }}
        >
          <ShoppingBag size={16} />
          <span className="btn-texto-responsive">Ver Planes</span>
        </Link>

        <Link
          href="/panel/agendar"
          className="btn-responsive-accion"
          title="Agendar una cita con un abogado especialista"
          aria-label="Agendar una cita con un abogado especialista"
          style={{
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            padding: "10px 18px",
            borderRadius: "12px",
            fontSize: "0.85rem",
            fontWeight: 800,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Calendar size={16} />
          <span className="btn-texto-responsive">Agendar Cita</span>
        </Link>
      </div>
    </div>
  );
}
