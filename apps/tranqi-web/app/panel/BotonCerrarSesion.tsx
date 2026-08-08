"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase/cliente";

interface BotonCerrarSesionProps {
  variante?: "nav" | "tarjeta";
  className?: string;
}

export function BotonCerrarSesion({ variante = "nav", className = "" }: BotonCerrarSesionProps) {
  const [cargando, setCargando] = useState(false);

  const handleCerrarSesion = async () => {
    try {
      setCargando(true);
      const supabase = crearClienteNavegador();
      await supabase.auth.signOut();
      window.location.href = "/ingresar";
    } catch {
      window.location.href = "/ingresar";
    }
  };

  if (variante === "tarjeta") {
    return (
      <button
        type="button"
        onClick={handleCerrarSesion}
        disabled={cargando}
        title="Cerrar sesión de forma segura"
        style={{
          marginTop: "6px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.25)",
          background: "rgba(220, 38, 38, 0.2)",
          color: "#ffffff",
          fontSize: "0.76rem",
          fontWeight: 800,
          cursor: cargando ? "wait" : "pointer",
          width: "fit-content",
          transition: "all 0.2s ease"
        }}
      >
        {cargando ? <Loader2 className="animate-spin" size={13} /> : <LogOut size={13} color="#FCA5A5" />}
        <span>{cargando ? "Saliendo..." : "Cerrar sesión"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCerrarSesion}
      disabled={cargando}
      title="Cerrar sesión y salir del sistema"
      className={`btn-cerrar-sesion-nav ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        borderRadius: "8px",
        background: "transparent",
        border: "none",
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: "0.86rem",
        fontWeight: 700,
        cursor: cargando ? "wait" : "pointer",
        textAlign: "left",
        transition: "all 0.15s ease",
        marginTop: "4px"
      }}
    >
      {cargando ? <Loader2 className="animate-spin icono-nav" size={18} /> : <LogOut className="icono-nav" size={18} color="#FCA5A5" />}
      <span className="etiqueta-nav" style={{ color: "#FCA5A5" }}>{cargando ? "Saliendo..." : "Cerrar sesión"}</span>
    </button>
  );
}
