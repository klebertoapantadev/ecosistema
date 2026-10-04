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
  ubicacion?: "LANDING_BANNER" | "PANEL_INICIO" | "TODOS";
  audiencia?: "TODOS" | "ABOGADOS" | "CLIENTES" | "EMPRESAS";
}

export function BannerInformativoSuperior({
  negocio = "tranqi",
  ubicacion = "PANEL_INICIO",
  audiencia = "TODOS",
}: Props) {
  const [campanas, setCampanas] = useState<CampanaInformativa[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`eco_campanas_informativas_${negocio}`);
      const rawDel = localStorage.getItem(`eco_campanas_eliminadas_${negocio}`);
      const eliminados = rawDel ? new Set(JSON.parse(rawDel)) : new Set();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (c: any) =>
              c.inf_activo !== false &&
              !eliminados.has(c.inf_id) &&
              !eliminados.has(c.inf_slug) &&
              (!c.inf_titulo || !eliminados.has(c.inf_titulo))
          );
        }
      }
    } catch {}
    return [];
  });
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [cerrado, setCerrado] = useState(false);

  // Comprobar preferencia de usuario en SessionStorage (solo para la sesión actual)
  useEffect(() => {
    try {
      // Limpiar clave obsoleta permanente si existía en localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem(`eco_ocultar_banner_${negocio}`);
        const oc = sessionStorage.getItem(`eco_ocultar_banner_sesion_${negocio}`);
        if (oc === "true") {
          setCerrado(true);
        }
      }
    } catch {
      // ignore
    }
  }, [negocio]);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        let eliminados = new Set<string>();
        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`eco_campanas_eliminadas_${negocio}`);
            if (raw) eliminados = new Set(JSON.parse(raw));
          } catch {}
        }

        const data = await obtenerCampanasInformativasAction({
          negocio,
          ubicacion: ubicacion === "TODOS" ? undefined : ubicacion,
          audiencia: audiencia === "TODOS" ? undefined : (audiencia as any),
          incluirInactivos: false,
        });

        if (!cancelado && Array.isArray(data) && data.length > 0) {
          const limpios = data.filter(
            (c) =>
              !eliminados.has(c.inf_id) &&
              !eliminados.has(c.inf_slug) &&
              (!c.inf_titulo || !eliminados.has(c.inf_titulo))
          );
          if (limpios.length > 0) {
            setCampanas(limpios);
            if (typeof window !== "undefined") {
              localStorage.setItem(`eco_campanas_informativas_${negocio}`, JSON.stringify(limpios));
            }
          }
        }
      } catch (err) {
        // Silencioso para no romper landing o panel
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [negocio, ubicacion, audiencia]);

  // Rotación automática si hay más de 1
  useEffect(() => {
    if (campanas.length <= 1) return;
    const intervalo = setInterval(() => {
      setIndiceActivo((prev) => (prev + 1) % campanas.length);
    }, 6000);
    return () => clearInterval(intervalo);
  }, [campanas.length]);

  const handleCerrar = (porSesion: boolean = true) => {
    setCerrado(true);
    if (porSesion && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(`eco_ocultar_banner_sesion_${negocio}`, "true");
      } catch {
        // ignore
      }
    }
  };

  if (cerrado || campanas.length === 0) return null;

  const actual = campanas[indiceActivo] || campanas[0];
  if (!actual) return null;

  const esAlerta = actual.inf_tipo === "ALERTA_REGULATORIA";
  const esConvenio = actual.inf_tipo === "BENEFICIO_CONVENIO";
  const det = actual.inf_detalle || {};
  const colorTag = det.color_tag;

  const bgStyle = colorTag
    ? `linear-gradient(90deg, ${colorTag} 0%, #0F172A 100%)`
    : esAlerta
    ? "linear-gradient(90deg, #991B1B 0%, #DC2626 50%, #B91C1C 100%)"
    : esConvenio
    ? "linear-gradient(90deg, #312E81 0%, #4338CA 50%, #3730A3 100%)"
    : "linear-gradient(90deg, #0F172A 0%, #1E293B 50%, #0369A1 100%)";

  const etiquetaCategoria = det.categoria || (esAlerta ? "Alerta" : esConvenio ? "Convenio" : "Aviso");

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
            background: colorTag ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.2)",
            border: colorTag ? "1px solid rgba(255,255,255,0.4)" : "none",
            padding: "2px 9px",
            borderRadius: "12px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {esAlerta ? <AlertTriangle size={12} /> : esConvenio ? <Award size={12} /> : <Megaphone size={12} />}
          {etiquetaCategoria}
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
              color: colorTag || (esAlerta ? "#991B1B" : "#312E81"),
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
        onClick={() => handleCerrar(true)}
        title="Ocultar aviso informativo"
        aria-label="Cerrar y no volver a mostrar este aviso"
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
