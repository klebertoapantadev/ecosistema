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
    colorIcono: "#1f6feb",
    categoria: "Datos Personales"
  },
  {
    id: "historial",
    titulo: "Historial de Accesos (PLT-018)",
    subtitulo: "Seguridad de inicio de sesión, IP y dispositivos",
    icono: History,
    colorIcono: "#58a6ff",
    categoria: "Auditoría"
  },
  {
    id: "sesion",
    titulo: "Sesión & Claves de Seguridad",
    subtitulo: "Gestión de sesión activa y cierre de sesión",
    icono: KeyRound,
    colorIcono: "#388bfd",
    categoria: "Seguridad"
  },
  {
    id: "peligro",
    titulo: "Baja de Cuenta (PLT-012)",
    subtitulo: "Eliminación permanente conforme a Ley LOPDP",
    icono: ShieldAlert,
    colorIcono: "#ef4444",
    categoria: "Zona de Peligro",
    esPeligro: true
  }
];

export function PanelCuentaModular({ perfil, historial }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>("perfil"); // Por defecto Perfil abierto o lista

  // Cargar favoritos de localStorage
  useEffect(() => {
    try {
      const guardados = localStorage.getItem("tranqi_favoritos_cuenta");
      if (guardados) {
        setFavoritos(JSON.parse(guardados));
      } else {
        setFavoritos(["perfil"]); // Perfil favorito por defecto
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
    } catch { /* Ignorar en ambientes restringidos */ }
  };

  // Ordenar tarjetas: los favoritos primero
  const widgetsOrdenados = [...WIDGETS_DISPONIBLES].sort((a, b) => {
    const aFav = favoritos.includes(a.id);
    const bFav = favoritos.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  return (
    <div style={{ width: "100%", color: "#c9d1d9" }}>
      {/* BARRA SUPERIOR DE ACCESOS / SECTION CARDS GRID */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            Accesos & Widgets de Cuenta
          </h3>
          <span style={{ fontSize: "0.78rem", color: "#8b949e" }}>
            ⭐ {favoritos.length} Marcados como Favorito
          </span>
        </div>

        {/* Rejilla Modular de Tarjetas de Acceso */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px"
          }}
        >
          {widgetsOrdenados.map(w => {
            const IconoComponente = w.icono;
            const esFav = favoritos.includes(w.id);
            const esSeleccionado = widgetActivo === w.id;

            return (
              <div
                key={w.id}
                onClick={() => setWidgetActivo(w.id)}
                style={{
                  background: esSeleccionado ? "#161b22" : "#0d1117",
                  border: esSeleccionado
                    ? "2px solid #58a6ff"
                    : esFav
                    ? "1px solid #d29922"
                    : "1px solid #30363d",
                  borderRadius: "8px",
                  padding: "14px",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.2s ease-in-out",
                  boxShadow: esSeleccionado ? "0 4px 12px rgba(88, 166, 255, 0.15)" : "none"
                }}
              >
                {/* Botón de Estrella Favorito */}
                <button
                  type="button"
                  title={esFav ? "Quitar de favoritos" : "Marcar como favorito"}
                  onClick={e => toggleFavorito(e, w.id)}
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    color: esFav ? "#e3b341" : "#484f58",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Star size={18} fill={esFav ? "#e3b341" : "none"} />
                </button>

                {/* Contenido de la Tarjeta */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div
                    style={{
                      background: w.esPeligro ? "rgba(239, 68, 68, 0.12)" : "rgba(31, 111, 235, 0.12)",
                      padding: "8px",
                      borderRadius: "6px",
                      display: "flex"
                    }}
                  >
                    <IconoComponente size={20} color={w.colorIcono} />
                  </div>
                  <div>
                    {esFav && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          color: "#d29922",
                          background: "rgba(210, 153, 34, 0.12)",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          display: "inline-block",
                          marginBottom: "2px"
                        }}
                      >
                        FAVORITO
                      </span>
                    )}
                    <div style={{ fontWeight: 700, fontSize: "0.86rem", color: w.esPeligro ? "#f87171" : "#c9d1d9" }}>
                      {w.titulo}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.75rem", color: "#8b949e", lineHeight: 1.35 }}>
                  {w.subtitulo}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "10px",
                    paddingTop: "8px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                    fontSize: "0.72rem",
                    color: esSeleccionado ? "#58a6ff" : "#8b949e",
                    fontWeight: 600
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

      {/* VISTA EN DETALLE DEL WIDGET SELECCIONADO */}
      {widgetActivo && (
        <div style={{ marginTop: "24px" }}>
          {/* Header del Widget enfocado */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#161b22",
              padding: "12px 16px",
              borderRadius: "8px 8px 0 0",
              border: "1px solid #30363d",
              borderBottom: "none"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#58a6ff" }}>
                Widget Enfocado: {WIDGETS_DISPONIBLES.find(w => w.id === widgetActivo)?.titulo}
              </span>
              {favoritos.includes(widgetActivo) && (
                <span style={{ fontSize: "0.7rem", background: "rgba(210, 153, 34, 0.15)", color: "#e3b341", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                  ⭐ Favorito Pinned
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              style={{
                background: "#21262d",
                border: "1px solid #30363d",
                color: "#c9d1d9",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <ArrowLeft size={14} /> Ocultar detalle
            </button>
          </div>

          {/* Contenedor Físico del Widget Activo */}
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: "0 0 8px 8px",
              padding: "20px"
            }}
          >
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <span style={{ fontSize: "0.82rem", color: "#8b949e" }}>
                    Registros de seguridad e inicio de sesión unificados en el ecosistema (PLT-018):
                  </span>
                  <span className="chip-registrado" style={{ background: "#1f6feb", color: "#fff", fontWeight: 700 }}>
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
              <div style={{ maxWidth: "480px", margin: "0 auto" }}>
                <div style={{ background: "#161b22", padding: "16px", borderRadius: "8px", border: "1px solid #30363d", marginBottom: "16px" }}>
                  <div style={{ fontSize: "0.78rem", color: "#8b949e" }}>Cuenta / Correo Autenticado:</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#c9d1d9", marginTop: "4px" }}>
                    {perfil?.usu_correo}
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#3fb950", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={16} /> Sesión activa en Vercel & Supabase Vault
                  </div>
                </div>

                <form action={cerrarSesionYRedirigir}>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: "rgba(248, 81, 73, 0.15)",
                      border: "1px solid #f85149",
                      color: "#f85149",
                      borderRadius: "6px",
                      padding: "12px",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
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
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
                <EliminarCuenta />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
