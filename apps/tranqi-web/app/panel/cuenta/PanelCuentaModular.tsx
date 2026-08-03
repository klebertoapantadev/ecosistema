"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Star, ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";
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
  const [widgetActivo, setWidgetActivo] = useState<string | null>("perfil");

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
            const esSeleccionado = widgetActivo === w.id;

            return (
              <div
                key={w.id}
                onClick={() => setWidgetActivo(w.id)}
                className="tarjeta-acceso"
                style={{
                  border: esSeleccionado
                    ? "2px solid var(--violeta, #5000BA)"
                    : esFav
                    ? "2px solid var(--amarillo, #FEE300)"
                    : "1px solid var(--panel-linea, #E4E4E4)",
                  background: "var(--blanco, #ffffff)",
                  borderRadius: "16px",
                  padding: "18px",
                  position: "relative",
                  boxShadow: esSeleccionado ? "0 4px 14px rgba(80, 0, 186, 0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
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
                    color: esSeleccionado ? "var(--violeta, #5000BA)" : "var(--panel-gris, #737373)",
                    fontWeight: 700
                  }}
                >
                  <span>{esSeleccionado ? "● Abierto en pantalla" : "Clic para ver widget"}</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* VISTA EN DETALLE DEL WIDGET ENFOCADO (Tarjeta de Sección idéntica al Inicio) */}
      {widgetActivo && (
        <section className="tarjeta-seccion" style={{ background: "var(--blanco, #ffffff)", borderRadius: "16px", overflow: "hidden" }}>
          {/* Header del Widget enfocado */}
          <header style={{ padding: "16px 20px", background: "#FAFAF9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, color: "var(--negro, #111111)", margin: 0 }}>
                Widget Enfocado: {WIDGETS_DISPONIBLES.find(w => w.id === widgetActivo)?.titulo}
              </h2>
              {favoritos.includes(widgetActivo) && (
                <span className="pildora-estado" style={{ background: "var(--amarillo)", color: "var(--negro)", fontSize: "0.68rem" }}>
                  ⭐ Favorito Pinned
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              className="btn-mini"
              style={{
                background: "var(--panel-linea-suave, #F1F1F1)",
                color: "var(--negro, #111111)",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                padding: "6px 14px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ArrowLeft size={14} /> Ocultar detalle
            </button>
          </header>

          {/* Cuerpo Físico del Widget Activo */}
          <div style={{ padding: "24px" }}>
            {/* WIDGET 1: PERFIL & DATOS */}
            {widgetActivo === "perfil" && (
              <div>
                <FormularioPerfil
                  inicial={{
                    nombres: perfil?.usu_nombres || "",
                    apellidos: perfil?.usu_apellidos || "",
                    correo: perfil?.usu_correo || "",
                    whatsapp: perfil?.usu_whatsapp || "",
                    autorizaWhatsapp: Boolean(perfil?.usu_autorizacion_whatsapp)
                  }}
                />
              </div>
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
        </section>
      )}
    </div>
  );
}
