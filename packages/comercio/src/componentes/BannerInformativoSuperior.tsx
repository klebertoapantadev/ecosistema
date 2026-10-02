"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  AlertTriangle,
  Award,
  Building2,
  ChevronRight,
  X,
  ExternalLink,
} from "lucide-react";
import {
  CampanaInformativa,
  obtenerCampanasInformativasAction,
} from "../acciones-informativos";

interface Props {
  negocio?: string;
  ubicacion?: "LANDING_BANNER" | "PANEL_INICIO";
}

export function BannerInformativoSuperior({
  negocio = "tranqi",
  ubicacion = "LANDING_BANNER",
}: Props) {
  const [campanas, setCampanas] = useState<CampanaInformativa[]>([]);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        const data = await obtenerCampanasInformativasAction({
          negocio,
          ubicacion,
          incluirInactivos: false,
        });
        if (!cancelado && data.length > 0) {
          setCampanas(data);
        }
      } catch (err) {
        // Silencioso para no romper landing
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [negocio, ubicacion]);

  // Rotación automática si hay más de 1
  useEffect(() => {
    if (campanas.length <= 1) return;
    const intervalo = setInterval(() => {
      setIndiceActivo((prev) => (prev + 1) % campanas.length);
    }, 6000);
    return () => clearInterval(intervalo);
  }, [campanas.length]);

  if (cerrado || campanas.length === 0) return null;

  const actual = campanas[indiceActivo] || campanas[0];
  if (!actual) return null;

  const esAlerta = actual.inf_tipo === "ALERTA_REGULATORIA";
  const esConvenio = actual.inf_tipo === "BENEFICIO_CONVENIO";
  const det = actual.inf_detalle || {};

  const bgStyle = esAlerta
    ? "linear-gradient(90deg, #991B1B 0%, #DC2626 50%, #B91C1C 100%)"
    : esConvenio
    ? "linear-gradient(90deg, #312E81 0%, #4338CA 50%, #3730A3 100%)"
    : "linear-gradient(90deg, #0F172A 0%, #1E293B 50%, #0369A1 100%)";

  return (
    <div
      style={{
        width: "100%",
        background: bgStyle,
        color: "#FFFFFF",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "0.78rem",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 50,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          maxWidth: "92%",
          margin: "0 auto",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(255,255,255,0.2)",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {esAlerta ? <AlertTriangle size={12} /> : esConvenio ? <Award size={12} /> : <Megaphone size={12} />}
          {esAlerta ? "Alerta" : esConvenio ? "Convenio" : "Aviso"}
        </div>

        <span style={{ fontWeight: 800 }}>{actual.inf_titulo}:</span>
        <span style={{ opacity: 0.9 }}>{actual.inf_subtitulo || actual.inf_contenido_md || ""}</span>

        {det.cta_texto && det.cta_url && (
          <a
            href={det.cta_url}
            target={det.cta_url.startsWith("http") ? "_blank" : "_self"}
            rel="noreferrer"
            style={{
              background: "#FFFFFF",
              color: esAlerta ? "#991B1B" : "#312E81",
              padding: "3px 10px",
              borderRadius: "12px",
              fontSize: "0.72rem",
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              marginLeft: "6px",
            }}
          >
            {det.cta_texto} <ChevronRight size={12} />
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCerrado(true)}
        title="Cerrar aviso"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.8)",
          cursor: "pointer",
          padding: "2px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
