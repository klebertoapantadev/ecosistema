"use client";

import React, { useState, useEffect } from "react";
import { Settings, Mail, Bell, Star, X, ChevronRight, ShieldCheck } from "lucide-react";
import { FormularioConfiguracionNegocio } from "@eco/configuracion-negocio/componentes/FormularioConfiguracionNegocio";
import { FormularioSmtp } from "@eco/configuracion-negocio/componentes/FormularioSmtp";
import { PreferenciasNotificacionWidget } from "@eco/notificaciones";

interface Props {
  esAdmin: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configuracion: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  smtp: any | null;
  negocio: string;
}

export interface WidgetConfigDef {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties; className?: string; strokeWidth?: number }>;
  colorIcono: string;
  categoria: string;
  soloAdmin?: boolean;
}

const TODOS_WIDGETS_CONFIG: WidgetConfigDef[] = [
  {
    id: "negocio",
    titulo: "Configuración del Negocio",
    subtitulo: "Identidad legal, términos, locales, WhatsApp y redes sociales",
    icono: Settings,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Parámetros del Negocio",
    soloAdmin: true
  },
  {
    id: "correo",
    titulo: "Servidor de Correo SMTP (PLT-008)",
    subtitulo: "Servidor saliente, credenciales Vault y pruebas de envío email",
    icono: Mail,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Infraestructura & Correo",
    soloAdmin: true
  },
  {
    id: "notificaciones",
    titulo: "Preferencias de Alertas & Notificaciones (PLT-013)",
    subtitulo: "Frecuencia, canales de recepción Email, WhatsApp y Desktop Push",
    icono: Bell,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Comunicación & Alertas",
    soloAdmin: false
  }
];

export function PanelConfiguracionModular({ esAdmin, configuracion, smtp, negocio }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null);

  // Filtrar widgets disponibles según rol
  const widgetsDisponibles = TODOS_WIDGETS_CONFIG.filter(w => !w.soloAdmin || esAdmin);

  // Cargar favoritos de localStorage
  useEffect(() => {
    try {
      const guardados = localStorage.getItem("tranqi_favoritos_configuracion");
      if (guardados) {
        setFavoritos(JSON.parse(guardados));
      } else {
        setFavoritos([widgetsDisponibles[0]?.id || "notificaciones"]);
      }
    } catch {
      setFavoritos(["notificaciones"]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      localStorage.setItem("tranqi_favoritos_configuracion", JSON.stringify(nuevos));
    } catch { /* Ignorar */ }
  };

  // Ordenar tarjetas: favoritos primero
  const widgetsOrdenados = [...widgetsDisponibles].sort((a, b) => {
    const aFav = favoritos.includes(a.id);
    const bFav = favoritos.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const widgetActualDef = widgetsDisponibles.find(w => w.id === widgetActivo);

  // VISTA 2: PANEL DEDICADO DEL WIDGET ENFOCADO (Con botón circular 'X' en la esquina superior derecha)
  if (widgetActivo && widgetActualDef) {
    return (
      <div style={{ width: "100%", animation: "fadeIn 0.15s ease" }}>
        <section className="tarjeta-seccion" style={{ background: "var(--blanco, #ffffff)", borderRadius: "16px", overflow: "hidden", width: "100%" }}>
          <header
            style={{
              padding: "16px 20px",
              background: "var(--panel-papel, #F7F6FA)",
              borderBottom: "1px solid var(--panel-linea, #E4E4E4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  background: "var(--blanco, #ffffff)",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  display: "flex"
                }}
              >
                {React.createElement(widgetActualDef.icono, { size: 20, color: widgetActualDef.colorIcono })}
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

            {/* Botón Circular de Cerrar (X) */}
            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              title="Cerrar widget y volver a Configuración"
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

          {/* Cuerpo del Widget Activo */}
          <div style={{ padding: "20px 16px", width: "100%" }}>
            {/* WIDGET 1: CONFIGURACIÓN DEL NEGOCIO */}
            {widgetActivo === "negocio" && (
              <div>
                <FormularioConfiguracionNegocio inicial={configuracion} negocio={negocio} />
              </div>
            )}

            {/* WIDGET 2: SERVIDOR DE CORREO SMTP (PLT-008) */}
            {widgetActivo === "correo" && (
              <div style={{ maxWidth: "640px", margin: "0 auto" }}>
                <p className="texto-apoyo" style={{ marginBottom: "16px" }}>
                  Desde aquí sale el correo de este negocio: códigos de verificación y enlaces para restablecer la contraseña.
                  Mientras no lo actives, esos correos no se envían.
                </p>
                <FormularioSmtp inicial={smtp} negocio={negocio} />
              </div>
            )}

            {/* WIDGET 3: PREFERENCIAS DE NOTIFICACIONES & ALERTAS (PLT-013) */}
            {widgetActivo === "notificaciones" && (
              <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <PreferenciasNotificacionWidget negocio={negocio} />
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // VISTA 1: PANEL GENERAL DE CONFIGURACIÓN (Hero Card + Rejilla .accesos-cliente idéntica a Mi Cuenta y Inicio)
  return (
    <div style={{ width: "100%" }}>
      {/* Header Hero Card del Panel de Configuración */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Gobernanza de Configuración & Preferencias</div>
            <div className="tarjeta-proteccion-plan">
              Configuración — <i>{esAdmin ? "Consola de Administración" : "Preferencias de Usuario"} ({negocio})</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              {esAdmin
                ? "Gestión centralizada de parámetros del negocio, servidores de correo saliente SMTP y alertas integradas."
                : "Gestión de canales y preferencias para recibir notificaciones legales, avisos y alertas de la plataforma."}
            </div>
          </div>
          <span className="badge-rol">
            <ShieldCheck style={{ width: 14, height: 14, marginRight: 4 }} />
            {esAdmin ? "Administrador Activo" : "Preferencias Rol"}
          </span>
        </div>
      </section>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Accesos & Widgets de Configuración
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
            ⭐ {favoritos.length} Marcados como Favorito
          </span>
        </div>

        {/* Rejilla de Cards idéntica al Inicio y Mi Cuenta (.accesos-cliente) */}
        <div className="accesos-cliente">
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
                  <IconoComponente size={20} color={w.colorIcono} />
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
                  <strong style={{ display: "block", lineHeight: 1.25 }}>
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
                    color: "var(--violeta, #5000BA)",
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
