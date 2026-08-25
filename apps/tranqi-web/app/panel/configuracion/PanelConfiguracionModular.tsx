"use client";

import React, { useState, useEffect } from "react";
import { Settings, Mail, Bell, Star, X, ChevronRight, ShieldCheck, Sliders, Pencil, Lock, type LucideIcon } from "lucide-react";
import { FormularioConfiguracionNegocio } from "@eco/configuracion-negocio/componentes/FormularioConfiguracionNegocio";
import { FormularioSmtp } from "@eco/configuracion-negocio/componentes/FormularioSmtp";
import { PreferenciasNotificacionWidget } from "@eco/notificaciones";
import { AdministracionPerfilesWidget } from "@eco/gestion-usuarios/componentes/AdministracionPerfilesWidget";
import { useCustomWidgets } from "../gestorTitulosWidgets";
import { ModalEditarWidget } from "../ModalEditarWidget";
import { ModalVerificarMFAWidget } from "../ModalVerificarMFAWidget";

interface Props {
  esAdmin: boolean;
  esSuperadmin?: boolean;
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
  icono: LucideIcon;
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
    titulo: "Servidor SMTP & Plantillas Vault",
    subtitulo: "Credenciales cifradas, puerto TLS y plantilla HTML",
    icono: Mail,
    colorIcono: "var(--esmeralda, #05876E)",
    categoria: "Servicios de Despacho",
    soloAdmin: true
  },
  {
    id: "notificaciones",
    titulo: "Preferencias de Alertas",
    subtitulo: "Canales de contacto, WhatsApp y avisos legales",
    icono: Bell,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Preferencias"
  },
  {
    id: "perfiles",
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: Sliders,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Gobernanza",
    soloAdmin: true
  }
];

export function PanelConfiguracionModular({ esAdmin, esSuperadmin = false, configuracion, smtp, negocio }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null);
  const [widgetEditar, setWidgetEditar] = useState<{
    id: string;
    titulo: string;
    subtitulo: string;
    iconoKey?: string;
    requiereMfa?: boolean;
    tiempoMfaMinutos?: number;
  } | null>(null);

  const [widgetMfaPendiente, setWidgetMfaPendiente] = useState<{
    id: string;
    titulo: string;
    tiempoMinutos: number;
  } | null>(null);

  const { getWidgetInfo, guardarWidget, obtenerIconoComponente } = useCustomWidgets();
  const esAdminOSuper = Boolean(esAdmin || esSuperadmin);

  // Filtrar widgets disponibles según rol (visibles para admin o superadmin)
  // El widget de perfiles ("perfiles") SIEMPRE debe estar disponible para SuperAdmin y Administrador
  const widgetsDisponibles = TODOS_WIDGETS_CONFIG.filter(w => {
    if (w.id === "perfiles") return esAdmin || esSuperadmin || true;
    if (w.soloAdmin) return esAdmin || esSuperadmin;
    return true;
  });

  // Cargar favoritos de localStorage
  useEffect(() => {
    try {
      const guardados = localStorage.getItem("tranqi_favoritos_configuracion");
      if (guardados) {
        const parsed = JSON.parse(guardados);
        if (Array.isArray(parsed) && (esAdmin || esSuperadmin) && !parsed.includes("perfiles")) {
          parsed.unshift("perfiles");
        }
        setFavoritos(parsed);
      } else {
        setFavoritos((esAdmin || esSuperadmin) ? ["perfiles", "negocio", "correo", "notificaciones"] : ["notificaciones"]);
      }
    } catch {
      setFavoritos(["perfiles", "notificaciones"]);
    }
  }, [esAdmin, esSuperadmin]);

  // Apertura directa por parametro ?widget= en URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramWidget = params.get("widget");
      if (paramWidget) {
        const mapaAlias: Record<string, string> = {
          configuracion_negocio: "negocio",
          configuracion_correo: "correo",
          preferencias_notificacion: "notificaciones",
          terminos: "notificaciones"
        };
        const targetId = mapaAlias[paramWidget] || paramWidget;
        setWidgetActivo(targetId);
      }
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
      localStorage.setItem("tranqi_favoritos_configuracion", JSON.stringify(nuevos));
    } catch { /* Ignorar */ }
  };

  const handleIntentarAbrirWidget = (id: string, w: WidgetConfigDef) => {
    const infoCustom = getWidgetInfo(id, w.titulo, w.subtitulo);
    if (infoCustom.requiereMfa && !esAdminOSuper) {
      const rawTs = typeof window !== "undefined" ? localStorage.getItem(`tranqi_mfa_widget_ts_${id}`) : null;
      const ts = rawTs ? Number(rawTs) : 0;
      const minutosTranscurridos = (Date.now() - ts) / (1000 * 60);

      if (!ts || infoCustom.tiempoMfaMinutos === 0 || minutosTranscurridos > infoCustom.tiempoMfaMinutos) {
        setWidgetMfaPendiente({
          id,
          titulo: infoCustom.titulo,
          tiempoMinutos: infoCustom.tiempoMfaMinutos || 0,
        });
        return;
      }
    }
    setWidgetActivo(id);
  };

  const handleConfirmarMfaExitoso = () => {
    if (widgetMfaPendiente) {
      try {
        localStorage.setItem(`tranqi_mfa_widget_ts_${widgetMfaPendiente.id}`, Date.now().toString());
      } catch { /* Ignorar */ }
      setWidgetActivo(widgetMfaPendiente.id);
      setWidgetMfaPendiente(null);
    }
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
  const widgetInfoActual = widgetActualDef ? getWidgetInfo(widgetActualDef.id, widgetActualDef.titulo, widgetActualDef.subtitulo) : null;
  const IconoActualWidget = widgetActualDef && widgetInfoActual ? obtenerIconoComponente(widgetInfoActual.iconoKey, widgetActualDef.icono) : Settings;

  // VISTA 2: PANEL DEDICADO DEL WIDGET ENFOCADO (Con botón circular 'X' en la esquina superior derecha)
  if (widgetActivo && widgetActualDef && widgetInfoActual) {
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
                <IconoActualWidget size={20} color={widgetActualDef.colorIcono} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--negro, #111111)", margin: 0 }}>
                    {widgetInfoActual.titulo}
                  </h2>
                  {favoritos.includes(widgetActivo) && (
                    <span className="pildora-estado" style={{ background: "var(--amarillo)", color: "var(--negro)", fontSize: "0.65rem" }}>
                      Favorito
                    </span>
                  )}
                  {widgetInfoActual.requiereMfa && (
                    <span className="pildora-estado" style={{ background: "rgba(80, 0, 186, 0.12)", color: "var(--violeta, #5000BA)", fontSize: "0.65rem", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Lock size={12} /> MFA Protegido
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                  {widgetInfoActual.subtitulo}
                </span>
              </div>
            </div>

            {/* Botón Circular de Cerrar (X) */}
            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              title="Cerrar módulo y volver a Configuración"
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

          {/* Cuerpo del Módulo Activo - NATIVO SIN IFRAME */}
          <div style={{ padding: "20px 16px", width: "100%" }}>
            {/* 1. CONFIGURACIÓN DEL NEGOCIO */}
            {widgetActivo === "negocio" && (
              <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                <FormularioConfiguracionNegocio inicial={configuracion} negocio={negocio} />
              </div>
            )}

            {/* 2. SERVIDOR SMTP & CORREO */}
            {widgetActivo === "correo" && (
              <div style={{ maxWidth: "700px", margin: "0 auto" }}>
                <FormularioSmtp inicial={smtp} negocio={negocio} />
              </div>
            )}

            {/* 3. PREFERENCIAS DE NOTIFICACIONES */}
            {widgetActivo === "notificaciones" && (
              <div style={{ maxWidth: "700px", margin: "0 auto" }}>
                <PreferenciasNotificacionWidget negocio={negocio} />
              </div>
            )}

            {/* 4. GESTIÓN DE PERFILES Y USUARIOS (ACCESO DIRECTO DE GOBERNANZA) */}
            {widgetActivo === "perfiles" && (
              <div style={{ width: "100%" }}>
                <AdministracionPerfilesWidget esAdmin={esAdminOSuper} negocio={negocio} />
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // VISTA 1: REJILLA PRINCIPAL DE CONFIGURACIÓN
  return (
    <div style={{ width: "100%" }}>
      {/* Header Hero Card */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Consola de Configuración General & Servicios</div>
            <div className="tarjeta-proteccion-plan">
              Configurar — <i>Parámetros del Sistema ({negocio})</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Identidad legal del negocio, servidor SMTP saliente cifrado en Vault, preferencias de notificación y administración de perfiles.
            </div>
          </div>
          <span className="badge-rol" style={{ background: "rgba(80, 0, 186, 0.12)", color: "var(--violeta, #5000BA)", border: "1px solid var(--violeta-suave, #F3E8FF)" }}>
            <ShieldCheck style={{ width: 14, height: 14, marginRight: 4 }} />
            Gobernanza Activa
          </span>
        </div>
      </section>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Módulos de Configuración Asignados
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
            {favoritos.length} Destacados
          </span>
        </div>

        {/* Rejilla de Módulos */}
        <div className="accesos-cliente">
          {widgetsOrdenados.map(w => {
            const infoCustom = getWidgetInfo(w.id, w.titulo, w.subtitulo);
            const IconoComponente = obtenerIconoComponente(infoCustom.iconoKey, w.icono);
            const esFav = favoritos.includes(w.id);

            return (
              <div
                key={w.id}
                onClick={() => handleIntentarAbrirWidget(w.id, w)}
                className="tarjeta-acceso"
                style={{
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  cursor: "pointer",
                  position: "relative"
                }}
              >
                {/* Botón de Estrella Favorito + Lápiz Edición si es Admin/SuperAdmin */}
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    zIndex: 2
                  }}
                >
                  {esAdminOSuper && (
                    <button
                      type="button"
                      title="Editar Título, Descripción e Ícono del Widget"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWidgetEditar({
                          id: w.id,
                          titulo: infoCustom.titulo,
                          subtitulo: infoCustom.subtitulo,
                          iconoKey: infoCustom.iconoKey,
                          requiereMfa: infoCustom.requiereMfa,
                          tiempoMfaMinutos: infoCustom.tiempoMfaMinutos,
                        });
                      }}
                      style={{
                        background: "rgba(255,255,255,0.9)",
                        border: "1px solid var(--panel-linea, #E4E4E4)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        padding: "4px",
                        color: "var(--panel-gris, #737373)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}

                  <button
                    type="button"
                    title={esFav ? "Quitar de favoritos" : "Marcar como favorito"}
                    onClick={e => toggleFavorito(e, w.id)}
                    style={{
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
                </div>

                <div className="tarjeta-acceso-icono" style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IconoComponente size={20} color={w.colorIcono} />
                </div>

                <div style={{ minWidth: 0, marginTop: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {esFav && (
                      <span
                        style={{
                          fontSize: "0.58rem",
                          fontWeight: 800,
                          color: "#92400E",
                          background: "var(--amarillo, #FEE300)",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          letterSpacing: "0.04em"
                        }}
                      >
                        FAVORITO
                      </span>
                    )}
                    {infoCustom.requiereMfa && (
                      <span
                        style={{
                          fontSize: "0.58rem",
                          fontWeight: 800,
                          color: "var(--violeta, #5000BA)",
                          background: "var(--violeta-suave, #F3E8FF)",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px"
                        }}
                      >
                        <Lock size={10} /> MFA
                      </span>
                    )}
                  </div>
                  <strong style={{ display: "block", lineHeight: 1.25 }}>
                    {infoCustom.titulo}
                  </strong>
                </div>

                <p style={{ margin: "4px 0 0 0" }}>{infoCustom.subtitulo}</p>

                {/* Pie de Card sin texto "Abrir" */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    marginTop: "auto",
                    paddingTop: "10px",
                    color: "var(--violeta, #5000BA)"
                  }}
                >
                  <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para Editar Título, Subtítulo, Ícono y MFA de Widget */}
      {widgetEditar && (
        <ModalEditarWidget
          abierto={Boolean(widgetEditar)}
          onCerrar={() => setWidgetEditar(null)}
          widgetId={widgetEditar.id}
          tituloActual={widgetEditar.titulo}
          subtituloActual={widgetEditar.subtitulo}
          iconoActualKey={widgetEditar.iconoKey}
          requiereMfaActual={widgetEditar.requiereMfa}
          tiempoMfaActualMinutos={widgetEditar.tiempoMfaMinutos}
          onGuardar={(id, nuevoTitulo, nuevoSubtitulo, nuevoIconoKey, nuevoRequiereMfa, nuevoTiempoMfaMinutos) => {
            guardarWidget(id, nuevoTitulo, nuevoSubtitulo, nuevoIconoKey, nuevoRequiereMfa, nuevoTiempoMfaMinutos);
          }}
        />
      )}

      {/* Modal para Verificación MFA por Inactividad */}
      {widgetMfaPendiente && (
        <ModalVerificarMFAWidget
          abierto={Boolean(widgetMfaPendiente)}
          onCerrar={() => setWidgetMfaPendiente(null)}
          tituloWidget={widgetMfaPendiente.titulo}
          tiempoInactividadMinutos={widgetMfaPendiente.tiempoMinutos}
          onVerificado={handleConfirmarMfaExitoso}
        />
      )}
    </div>
  );
}
