"use client";

import { useState, useEffect } from "react";
import {
  Building2, Sparkles, CheckCircle2, Gift, Percent, Video,
  Calendar, ShieldCheck, ArrowRight, RefreshCw, ChevronRight
} from "lucide-react";
import {
  obtenerBeneficiosCorporativosUsuarioAction,
  type BeneficiosCorporativosUsuario
} from "../acciones-convenios";

interface Props {
  negocio?: string;
  ocultarSiNoTiene?: boolean;
  variante?: "completa" | "banner_compacto" | "insignia";
  onAgendarClick?: () => void;
}

export function TarjetaBeneficiosCorporativosCliente({
  negocio = "tranqi",
  ocultarSiNoTiene = false,
  variante = "completa",
  onAgendarClick,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [beneficios, setBeneficios] = useState<BeneficiosCorporativosUsuario | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await obtenerBeneficiosCorporativosUsuarioAction(negocio);
        setBeneficios(res);
      } catch (err) {
        console.error("Error al cargar beneficios corporativos:", err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [negocio]);

  if (cargando) {
    return (
      <div style={{ padding: "16px", borderRadius: "14px", background: "#F8FAFC", border: "1px dashed #CBD5E1", display: "flex", alignItems: "center", gap: "10px", color: "#64748B", fontSize: "0.85rem" }}>
        <RefreshCw size={16} className="animate-spin" />
        <span>Verificando membresía corporativa y beneficios B2B...</span>
      </div>
    );
  }

  if (!beneficios || !beneficios.tieneConvenio) {
    if (ocultarSiNoTiene) return null;
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)",
          borderRadius: "14px",
          border: "1px solid #E2E8F0",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#E0F2FE", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284C7" }}>
            <Building2 size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1E293B" }}>
              ¿Perteneces a una empresa aliada?
            </h4>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
              Regístrate o actualiza tu correo con el dominio de tu empresa para desbloquear consultas $0.00 y descuentos automáticos.
            </p>
          </div>
        </div>

        <a
          href="/panel/empresas"
          style={{
            background: "#0284C7",
            color: "#FFFFFF",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Ver Convenios B2B</span>
          <ChevronRight size={14} />
        </a>
      </div>
    );
  }

  // Variante Banner Compacto
  if (variante === "banner_compacto") {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #05876E 0%, #0F172A 100%)",
          color: "#FFFFFF",
          borderRadius: "12px",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          boxShadow: "0 4px 12px rgba(5, 135, 110, 0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Building2 size={12} />
            {beneficios.empresaNombre}
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            🎉 Convenio Activo: <strong>{beneficios.consultasDisponibles} Consultas $0.00</strong> + <strong>{beneficios.descuentoGeneralPct}% Desc.</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onAgendarClick) onAgendarClick();
            else if (typeof window !== "undefined") window.location.href = "/panel/agenda";
          }}
          style={{
            background: "#FFFFFF",
            color: "#05876E",
            border: "none",
            padding: "6px 14px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <Calendar size={13} />
          <span>Usar Consulta Gratuita</span>
        </button>
      </div>
    );
  }

  // Variante Completa
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)",
        border: "1.5px solid #A7F3D0",
        borderRadius: "16px",
        padding: "20px 24px",
        boxShadow: "0 4px 16px rgba(16, 185, 129, 0.08)",
        marginBottom: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Insignia de fondo sutil */}
      <div
        style={{
          position: "absolute",
          top: "-15px",
          right: "-15px",
          width: "110px",
          height: "110px",
          borderRadius: "50%",
          background: "rgba(5, 135, 110, 0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <Gift size={50} color="#05876E" style={{ opacity: 0.25 }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                background: "#05876E",
                color: "#FFFFFF",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: "0 2px 6px rgba(5, 135, 110, 0.25)",
              }}
            >
              <Building2 size={13} />
              Convenio Corporativo: {beneficios.empresaNombre}
            </span>

            <span
              style={{
                background: "#DCFCE7",
                color: "#15803D",
                padding: "3px 9px",
                borderRadius: "12px",
                fontSize: "0.72rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <CheckCircle2 size={12} />
              Auto-afiliación Activa ({beneficios.dominioCorreo || "Dominio Verificado"})
            </span>
          </div>

          <h3 style={{ margin: "4px 0 6px", fontSize: "1.2rem", fontWeight: 800, color: "#0F172A" }}>
            ¡Tu membresía corporativa con {beneficios.empresaNombre} está activa!
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", maxWidth: "650px" }}>
            Como colaborador acreditado de {beneficios.empresaNombre}, disfrutas de beneficios exclusivos y subsidio en asesoría jurídica.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onAgendarClick) onAgendarClick();
            else if (typeof window !== "undefined") window.location.href = "/panel/agenda";
          }}
          style={{
            background: "#05876E",
            color: "#FFFFFF",
            border: "none",
            padding: "10px 18px",
            borderRadius: "10px",
            fontSize: "0.88rem",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(5, 135, 110, 0.25)",
            transition: "all 0.15s ease",
          }}
        >
          <Video size={16} />
          <span>Agendar Consulta Gratuita ($0.00)</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Grid de Beneficios Concretos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginTop: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "14px",
            border: "1px solid #D1FAE5",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#ECFDF5", color: "#05876E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Video size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#05876E" }}>
              {beneficios.consultasDisponibles} de {beneficios.consultasGratisTotal} Citas
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: 600 }}>
              Consultas Telemáticas al 100% ($0.00)
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "12px",
            padding: "14px",
            border: "1px solid #E0E7FF",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Percent size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#4F46E5" }}>
              {beneficios.descuentoGeneralPct}% Descuento
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: 600 }}>
              En todos los servicios legales
            </div>
          </div>
        </div>

        {beneficios.excepcionesPorProducto && beneficios.excepcionesPorProducto.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "14px",
              border: "1px solid #FEF3C7",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#FFFBEB", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#D97706" }}>
                {beneficios.excepcionesPorProducto[0]?.descuento_pct}% Descuento
              </div>
              <div style={{ fontSize: "0.78rem", color: "#64748B", fontWeight: 600 }}>
                {beneficios.excepcionesPorProducto[0]?.producto_nombre}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
