"use client";

import { useState } from "react";
import { LogOut, Loader2, X } from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase/cliente";

interface BotonCerrarSesionProps {
  variante?: "nav" | "tarjeta";
  className?: string;
}

export function BotonCerrarSesion({ variante = "nav", className = "" }: BotonCerrarSesionProps) {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [cargando, setCargando] = useState(false);

  const ejecutarSalida = async () => {
    try {
      setCargando(true);
      const supabase = crearClienteNavegador();
      await supabase.auth.signOut();
      window.location.href = "/ingresar";
    } catch {
      window.location.href = "/ingresar";
    }
  };

  return (
    <>
      {variante === "tarjeta" ? (
        <button
          type="button"
          onClick={() => setMostrarModal(true)}
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
            background: "rgba(220, 38, 38, 0.18)",
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
      ) : (
        <button
          type="button"
          onClick={() => setMostrarModal(true)}
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
            marginTop: "8px"
          }}
        >
          {cargando ? <Loader2 className="animate-spin icono-nav" size={18} /> : <LogOut className="icono-nav" size={18} color="#FCA5A5" />}
          <span className="etiqueta-nav" style={{ color: "#FCA5A5" }}>{cargando ? "Saliendo..." : "Cerrar sesión"}</span>
        </button>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CIERRE DE SESIÓN */}
      {mostrarModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "24px", maxWidth: "420px", width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "rgba(220, 38, 38, 0.12)", color: "#DC2626", borderRadius: "50%", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <LogOut size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#111111" }}>Cerrar Sesión</h3>
                  <span style={{ fontSize: "0.76rem", color: "#737373" }}>Confirmación de salida</span>
                </div>
              </div>
              <button type="button" onClick={() => setMostrarModal(false)} disabled={cargando} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#737373", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "0.86rem", color: "#555555", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              ¿Estás seguro de que deseas cerrar tu sesión activa? Tendrás que volver a ingresar tus credenciales para acceder nuevamente al sistema.
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setMostrarModal(false)}
                disabled={cargando}
                style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #E4E4E4", background: "#ffffff", color: "#111111", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={ejecutarSalida}
                disabled={cargando}
                style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: "#DC2626", color: "#ffffff", fontWeight: 800, fontSize: "0.82rem", cursor: cargando ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(220, 38, 38, 0.3)" }}
              >
                {cargando ? <Loader2 className="animate-spin" size={14} /> : <LogOut size={14} />}
                <span>{cargando ? "Saliendo..." : "Sí, Cerrar Sesión"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
