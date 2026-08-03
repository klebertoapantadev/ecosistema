"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Star, X, CheckCircle2, ChevronRight, Maximize2 } from "lucide-react";
import { FormularioPerfil } from "@eco/identidad/componentes/FormularioPerfil";
import { HistorialAccesos } from "@eco/identidad/componentes/HistorialAccesos";
import { EliminarCuenta } from "@eco/identidad/componentes/EliminarCuenta";
import { cerrarSesionYRedirigir } from "../acciones";

export interface PerfilUsuario {
  usu_id?: string;
  usu_nombres?: string | null;
  apellidos?: string | null;
  usu_apellidos?: string | null;
  usu_correo?: string | null;
  usu_whatsapp?: string | null;
  usu_autorizacion_whatsapp?: boolean | null;
}

export interface FilaAcceso {
  acc_id: string;
  acc_ip: string | null;
  acc_user_agent: string | null;
  acc_creado_en: string;
  acc_negocio?: string | null;
}

interface Props {
  perfil: PerfilUsuario | null;
  historial: FilaAcceso[];
}

export interface WidgetDef {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  colorIcono: string;
  categoria: string;
  esPeligro?: boolean;
}

const WIDGETS_DISPONIBLES: WidgetDef[] = [
  {
    id: "perfil",
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado y WhatsApp",
    icono: User,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Datos Personales"
  },
  {
    id: "historial",
    titulo: "Historial de Accesos (PLT-018)",
    subtitulo: "Seguridad de inicio de sesión, IP y dispositivos",
    icono: History,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Auditoría"
  },
  {
    id: "sesion",
    titulo: "Sesión & Claves de Seguridad",
    subtitulo: "Gestión de sesión activa y cierre de sesión",
    icono: KeyRound,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Seguridad"
  },
  {
    id: "peligro",
    titulo: "Baja de Cuenta (PLT-012)",
    subtitulo: "Eliminación permanente conforme a Ley LOPDP",
    icono: ShieldAlert,
    colorIcono: "#B00020",
    categoria: "Zona de Peligro",
    esPeligro: true
  }
];

export function PanelCuentaModular({ perfil, historial }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null); // Inicialmente cerrado para ver el panel general

  // Cargar favoritos de localStorage
  useEffect(() => {
    try {
      const guardados = localStorage.getItem("tranqi_favoritos_cuenta");
      if (guardados) {
        setFavoritos(JSON.parse(guardados));
      } else {
        setFavoritos(["perfil"]);
      }
    } catch {
      setFavoritos(["perfil"]);
    }
  }, []);

  // Manejar tecla ESC para cerrar el widget maximizado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && widgetActivo) {
        setWidgetActivo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [widgetActivo]);

  // Alternar estado de favorito
  const toggleFavorito = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let nuevos: string[];
    if (favoritos.includes(id)) {
      nuevos = favoritos.filter(item => item !== id);
    } else {
      nuevos = [...favoritos, id];
    }
    setFavoritos(nuevos);
    try {
      localStorage.setItem("tranqi_favoritos_cuenta", JSON.stringify(nuevos));
    } catch { /* Ignorar */ }
  };

  // Ordenar tarjetas: favoritos primero
  const widgetsOrdenados = [...WIDGETS_DISPONIBLES].sort((a, b) => {
    const aFav = favoritos.includes(a.id);
    const bFav = favoritos.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const widgetActualDef = WIDGETS_DISPONIBLES.find(w => w.id === widgetActivo);

  return (
    <div style={{ width: "100%" }}>
      {/* ACCESOS & WIDGETS DE CUENTA (Grid de Tarjetas Limpias) */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Accesos & Widgets de Cuenta
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
            ⭐ {favoritos.length} Marcados como Favorito
          </span>
        </div>

        {/* Rejilla de Cards idéntica al Inicio (.accesos-cliente) */}
        <div className="accesos-cliente" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          {widgetsOrdenados.map(w => {
            const IconoComponente = w.icono;
            const esFav = favoritos.includes(w.id);

            return (
              <div
                key={w.id}
                onClick={() => setWidgetActivo(w.id)}
                className="tarjeta-acceso"
                style={{
                  border: esFav
                    ? "2px solid var(--amarillo, #FEE300)"
                    : "1px solid var(--panel-linea, #E4E4E4)",
                  background: "var(--blanco, #ffffff)",
                  borderRadius: "16px",
                  padding: "18px",
                  position: "relative",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  transition: "all 0.18s ease"
                }}
              >
                {/* Botón de Estrella Favorito */}
                <button
                  type="button"
                  title={esFav ? "Quitar de favoritos" : "Marcar como favorito"}
                  onClick={e => toggleFavorito(e, w.id)}
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    color: esFav ? "#D97706" : "var(--panel-gris, #737373)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Star size={18} fill={esFav ? "#FEE300" : "none"} stroke={esFav ? "#D97706" : "currentColor"} />
                </button>

                {/* Encabezado e Icono de Tarjeta */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <div className="tarjeta-acceso-icono" style={{ margin: 0 }}>
                    <IconoComponente size={20} color={w.esPeligro ? "#B00020" : undefined} />
                  </div>
                  <div>
                    {esFav && (
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 800,
                          color: "#92400E",
                          background: "var(--amarillo, #FEE300)",
                          padding: "2px 7px",
                          borderRadius: "999px",
                          display: "inline-block",
                          marginBottom: "3px",
                          letterSpacing: "0.04em"
                        }}
                      >
                        FAVORITO
                      </span>
                    )}
                    <strong style={{ display: "block", color: w.esPeligro ? "#B00020" : "var(--negro, #111111)", fontSize: "0.94rem" }}>
                      {w.titulo}
                    </strong>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
                  {w.subtitulo}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "12px",
                    paddingTop: "10px",
                    borderTop: "1px solid var(--panel-linea-suave, #F1F1F1)",
                    fontSize: "0.76rem",
                    color: "var(--violeta, #5000BA)",
                    fontWeight: 700
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Maximize2 size={13} /> Abrir Widget Maximizado
                  </span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WIDGET MAXIMIZADO PANTALLA COMPLETA (Modal Fullscreen Canvas con Botón de Cerrar) */}
      {widgetActivo && widgetActualDef && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(17, 17, 17, 0.48)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "24px",
            animation: "fadeIn 0.2s ease"
          }}
          onClick={() => setWidgetActivo(null)} // Cerrar al hacer clic en el backdrop
        >
          <div
            onClick={e => e.stopPropagation()} // Prevenir que el clic dentro cierre el modal
            style={{
              width: "100%",
              maxWidth: "860px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "var(--blanco, #ffffff)",
              borderRadius: "20px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Cabecera del Modal Maximizado */}
            <header
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--panel-papel, #F7F6FA)",
                borderRadius: "20px 20px 0 0"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    background: "var(--blanco, #ffffff)",
                    border: "1px solid var(--panel-linea, #E4E4E4)",
                    display: "flex"
                  }}
                >
                  {React.createElement(widgetActualDef.icono, { size: 22, color: widgetActualDef.colorIcono })}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--negro, #111111)", margin: 0 }}>
                      {widgetActualDef.titulo}
                    </h2>
                    {favoritos.includes(widgetActivo) && (
                      <span className="pildora-estado" style={{ background: "var(--amarillo)", color: "var(--negro)", fontSize: "0.68rem" }}>
                        ⭐ Favorito
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>
                    {widgetActualDef.subtitulo}
                  </span>
                </div>
              </div>

              {/* Botón de Cerrar (X / Esc) */}
              <button
                type="button"
                onClick={() => setWidgetActivo(null)}
                title="Cerrar Widget y volver a Mi cuenta (Esc)"
                style={{
                  background: "var(--blanco, #ffffff)",
                  border: "1.5px solid var(--panel-linea, #E4E4E4)",
                  color: "var(--negro, #111111)",
                  borderRadius: "50%",
                  width: "38px",
                  height: "38px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  transition: "all 0.15s ease"
                }}
              >
                <X size={20} />
              </button>
            </header>

            {/* Cuerpo Maximizado del Widget */}
            <div style={{ padding: "28px" }}>
              {/* WIDGET 1: PERFIL & DATOS */}
              {widgetActivo === "perfil" && (
                <FormularioPerfil
                  inicial={{
                    nombres: perfil?.usu_nombres || "",
                    apellidos: perfil?.usu_apellidos || "",
                    correo: perfil?.usu_correo || "",
                    whatsapp: perfil?.usu_whatsapp || "",
                    autorizaWhatsapp: Boolean(perfil?.usu_autorizacion_whatsapp)
                  }}
                />
              )}

              {/* WIDGET 2: HISTORIAL DE ACCESOS (PLT-018) */}
              {widgetActivo === "historial" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ fontSize: "0.88rem", color: "var(--panel-gris, #737373)" }}>
                      Registros de seguridad e inicio de sesión unificados en el ecosistema (PLT-018):
                    </span>
                    <span className="pildora-estado">
                      {historial.length} Accesos Registrados
                    </span>
                  </div>

                  {historial.length === 0 ? (
                    <div className="vacio-seccion">
                      <b>Sin historial previo de accesos</b>
                      <span>Los registros de inicio de sesión e IP aparecerán reflejados aquí.</span>
                    </div>
                  ) : (
                    <HistorialAccesos historial={historial} />
                  )}
                </div>
              )}

              {/* WIDGET 3: SESIÓN & SEGURIDAD */}
              {widgetActivo === "sesion" && (
                <div style={{ maxWidth: "520px", margin: "0 auto" }}>
                  <div style={{ background: "var(--panel-linea-suave, #FAFAF9)", padding: "18px", borderRadius: "12px", border: "1px solid var(--panel-linea, #E4E4E4)", marginBottom: "20px" }}>
                    <div style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)" }}>Cuenta / Correo Autenticado:</div>
                    <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--negro, #111111)", marginTop: "4px" }}>
                      {perfil?.usu_correo}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--esmeralda, #05876e)", marginTop: "8px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={16} /> Sesión activa y autenticada en Vercel & Supabase Vault
                    </div>
                  </div>

                  <form action={cerrarSesionYRedirigir}>
                    <button
                      type="submit"
                      className="btn-mini"
                      style={{
                        width: "100%",
                        background: "rgba(176, 0, 32, 0.12)",
                        border: "1px solid #B00020",
                        color: "#B00020",
                        padding: "14px",
                        fontSize: "0.92rem",
                        fontWeight: 800,
                        justifyContent: "center",
                        gap: "8px"
                      }}
                    >
                      Cerrar Sesión Segura en esta Aplicación
                    </button>
                  </form>
                </div>
              )}

              {/* WIDGET 4: BAJA DE CUENTA (PLT-012) */}
              {widgetActivo === "peligro" && (
                <div style={{ maxWidth: "600px", margin: "0 auto" }}>
                  <EliminarCuenta />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
