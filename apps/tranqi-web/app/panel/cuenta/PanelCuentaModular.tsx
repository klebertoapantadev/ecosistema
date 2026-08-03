"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Star, X, CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
import { FormularioPerfil } from "@eco/identidad/componentes/FormularioPerfil";
import { HistorialAccesos } from "@eco/identidad/componentes/HistorialAccesos";
import { EliminarCuenta } from "@eco/identidad/componentes/EliminarCuenta";
import { cerrarSesionYRedirigir } from "../acciones";
import { SelectorRolActivo } from "../SelectorRolActivo";

export interface PerfilUsuario {
  usu_id?: string;
  usu_nombres?: string | null;
  apellidos?: string | null;
  usu_apellidos?: string | null;
  usu_correo?: string | null;
  usu_whatsapp?: string | null;
  usu_autorizacion_whatsapp?: boolean | null;
  usu_superadmin_plataforma?: boolean | null;
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
  puedeConmutar?: boolean;
}

export interface WidgetDef {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties; className?: string; strokeWidth?: number }>;
  colorIcono: string;
  categoria: string;
  esPeligro?: boolean;
}

const WIDGETS_BASE: WidgetDef[] = [
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
    id: "rol_activo",
    titulo: "Conmutador de Rol (Ver como)",
    subtitulo: "Vista previa del portal como Cliente, Abogado o Administrador",
    icono: ShieldCheck,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Gobernanza"
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

export function PanelCuentaModular({ perfil, historial, puedeConmutar = true }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null); // null = ver galería de accesos del panel Mi cuenta

  const widgetsDisponibles = puedeConmutar
    ? WIDGETS_BASE
    : WIDGETS_BASE.filter(w => w.id !== "rol_activo");

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
      nuevos = favoritos.filter((f) => f !== id);
    } else {
      nuevos = [...favoritos, id];
    }
    setFavoritos(nuevos);
    try {
      localStorage.setItem("tranqi_favoritos_cuenta", JSON.stringify(nuevos));
    } catch {
      // Ignore
    }
  };

  // Reorganizar widgets poniendo los favoritos primero
  const widgetsOrdenados = [...widgetsDisponibles].sort((a, b) => {
    const esFavA = favoritos.includes(a.id);
    const esFavB = favoritos.includes(b.id);
    if (esFavA && !esFavB) return -1;
    if (!esFavA && esFavB) return 1;
    return 0;
  });

  const widgetActualDef = widgetsDisponibles.find((w) => w.id === widgetActivo);

  // VISTA 2: SI HAY UN WIDGET SELECCIONADO (VISTA A PANTALLA COMPLETA CON BOTÓN X DE CIERRE)
  if (widgetActivo && widgetActualDef) {
    const IconoComponente = widgetActualDef.icono;
    return (
      <div style={{ width: "100%", animation: "fadeIn 0.2s ease" }}>
        <section
          style={{
            background: "var(--blanco, #ffffff)",
            border: "1px solid var(--panel-linea, #E4E4E4)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
          }}
        >
          {/* Header del Widget con Título, Icono, Subtítulo y Botón Cierre X */}
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
              paddingBottom: "16px",
              marginBottom: "20px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: widgetActualDef.esPeligro ? "rgba(176, 0, 32, 0.1)" : "var(--panel-linea-suave, #FAFAF9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: widgetActualDef.esPeligro ? "#B00020" : widgetActualDef.colorIcono,
                  border: "1px solid var(--panel-linea, #E4E4E4)"
                }}
              >
                <IconoComponente size={22} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--negro, #111111)", margin: 0 }}>
                    {widgetActualDef.titulo}
                  </h2>
                  {favoritos.includes(widgetActivo) && (
                    <span className="pildora-estado" style={{ background: "var(--amarillo)", color: "var(--negro)", fontSize: "0.65rem" }}>
                      ⭐ Favorito
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                  {widgetActualDef.subtitulo}
                </span>
              </div>
            </div>

            {/* Botón Circular de Cerrar (X) en la esquina superior derecha */}
            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              title="Cerrar widget y volver a Mi cuenta"
              style={{
                background: "var(--blanco, #ffffff)",
                border: "1.5px solid var(--panel-linea, #E4E4E4)",
                color: "var(--negro, #111111)",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                flexShrink: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                transition: "all 0.15s ease"
              }}
            >
              <X size={18} />
            </button>
          </header>

          {/* Cuerpo a 100% de Ancho */}
          <div style={{ padding: "20px 16px", width: "100%" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--panel-gris, #737373)" }}>
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
              <div style={{ maxWidth: "560px", margin: "0 auto" }}>
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

            {/* WIDGET 4: CONMUTADOR DE ROL (VER COMO) */}
            {widgetActivo === "rol_activo" && (
              <div style={{ maxWidth: "680px", margin: "0 auto", textAlign: "center" }}>
                <div style={{ background: "var(--panel-linea-suave, #FAFAF9)", padding: "20px", borderRadius: "12px", border: "1px solid var(--panel-linea, #E4E4E4)", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--negro, #111111)", marginBottom: "8px" }}>
                    Conmutador de Vista de Rol (Ver como)
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--panel-gris, #737373)", margin: 0 }}>
                    Selecciona el rol con el que deseas previsualizar la plataforma en tiempo real. Esta opción te permite experimentar el portal con la perspectiva visual de un Cliente, Socio Abogado o Administrador.
                  </p>
                </div>

                <div style={{ display: "inline-flex", justifyContent: "center", padding: "16px 24px", background: "#ffffff", borderRadius: "999px", border: "1px solid var(--panel-linea, #E4E4E4)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <SelectorRolActivo />
                </div>
              </div>
            )}

            {/* WIDGET 5: BAJA DE CUENTA (PLT-012) */}
            {widgetActivo === "peligro" && (
              <div style={{ maxWidth: "640px", margin: "0 auto" }}>
                <EliminarCuenta />
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // VISTA 1: PANEL GENERAL "MI CUENTA" (Hero Card + Grid .accesos-cliente idéntico al Inicio)
  return (
    <div style={{ width: "100%" }}>
      {/* Header Hero Card del Panel */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Gobernanza de Identidad & Perfil</div>
            <div className="tarjeta-proteccion-plan">
              Mi Cuenta — <i>Identidad Unificada (tranqi)</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Acceso individualizado a widgets, gestión de perfil, historial de accesos y seguridad de la cuenta.
            </div>
          </div>
          <span className="badge-rol">
            <User style={{ width: 14, height: 14, marginRight: 4 }} /> Identidad Activa
          </span>
        </div>
      </section>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Accesos & Widgets de Cuenta
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
            ⭐ {favoritos.length} {favoritos.length === 1 ? "Marcado como Favorito" : "Marcados como Favorito"}
          </span>
        </div>

        {/* Rejilla Idéntica al Panel de Inicio (.accesos-cliente: 2 por fila) */}
        <div className="accesos-cliente">
          {widgetsOrdenados.map((w) => {
            const IconoComponente = w.icono;
            const esFav = favoritos.includes(w.id);

            return (
              <div
                key={w.id}
                onClick={() => setWidgetActivo(w.id)}
                className="tarjeta-acceso"
                style={{
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  cursor: "pointer",
                  position: "relative"
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
                    padding: "3px",
                    color: esFav ? "#D97706" : "var(--panel-gris, #737373)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Star size={16} fill={esFav ? "#FEE300" : "none"} stroke={esFav ? "#D97706" : "currentColor"} />
                </button>

                <div className="tarjeta-acceso-icono" style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconoComponente size={20} color={w.esPeligro ? "#B00020" : undefined} />
                </div>

                <div style={{ minWidth: 0, marginTop: "6px" }}>
                  {esFav && (
                    <span
                      style={{
                        fontSize: "0.58rem",
                        fontWeight: 800,
                        color: "#92400E",
                        background: "var(--amarillo, #FEE300)",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        display: "inline-block",
                        marginBottom: "4px",
                        letterSpacing: "0.04em"
                      }}
                    >
                      FAVORITO
                    </span>
                  )}

                  <strong style={{ display: "block", color: w.esPeligro ? "#B00020" : undefined, lineHeight: 1.25 }}>
                    {w.titulo}
                  </strong>
                </div>

                <p style={{ margin: "4px 0 0 0" }}>{w.subtitulo}</p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "auto",
                    paddingTop: "10px",
                    fontSize: "0.76rem",
                    color: w.esPeligro ? "#B00020" : "var(--violeta, #5000BA)",
                    fontWeight: 700
                  }}
                >
                  <span>Abrir widget</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
