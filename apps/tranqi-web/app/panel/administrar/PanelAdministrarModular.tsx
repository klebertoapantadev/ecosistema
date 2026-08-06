"use client";

import React, { useState, useEffect } from "react";
import { UserCog, Users, ClipboardList, Bell, Shield, ChevronRight, Star, Lock, X } from "lucide-react";
import Link from "next/link";
import { AdministracionPerfilesWidget } from "@eco/gestion-usuarios/componentes/AdministracionPerfilesWidget";
import { EmisionNotificacionesWidget } from "@eco/notificaciones";

interface Props {
  negocio: string;
}

export interface ModuloAdminDef {
  id: string;
  titulo: string;
  subtitulo: string;
  ruta: string;
  icono: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties; className?: string; strokeWidth?: number }>;
  colorIcono: string;
  categoria: string;
}

const MODULOS_ADMIN: ModuloAdminDef[] = [
  {
    id: "gestion_usuarios",
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    ruta: "/panel/usuarios",
    icono: UserCog,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Usuarios & Permisos"
  },
  {
    id: "socios",
    titulo: "Aprobación de Socios Abogados",
    subtitulo: "Validación de matrículas, acreditación y verificación de abogados",
    ruta: "/panel/socios",
    icono: Users,
    colorIcono: "#05876E",
    categoria: "Operación Legal"
  },
  {
    id: "solicitud_socio",
    titulo: "Solicitudes de Socios",
    subtitulo: "Procesamiento de postulaciones y formularios de postulación socio",
    ruta: "/panel/solicitud-socio",
    icono: ClipboardList,
    colorIcono: "#05876E",
    categoria: "Operación Legal"
  },
  {
    id: "emision_notificaciones",
    titulo: "Emisión de Notificaciones Multicanal",
    subtitulo: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp)",
    ruta: "/panel/emision-notificaciones",
    icono: Bell,
    colorIcono: "#D97706",
    categoria: "Comunicación"
  },
  {
    id: "auditoria",
    titulo: "Auditoría BDD & Telemetría",
    subtitulo: "Consulta de registros inmutables PostgreSQL y telemetría de APIs",
    ruta: "/panel/auditoria",
    icono: Shield,
    colorIcono: "#111827",
    categoria: "Seguridad & Auditoría"
  }
];

export function PanelAdministrarModular({ negocio }: Props) {
  const [favoritos, setFavoritos] = useState<string[]>(["gestion_usuarios", "socios"]);
  const [widgetActivo, setWidgetActivo] = useState<string | null>(null);

  // Leer modulo inicial desde localStorage o URL
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const modQuery = urlParams.get("modulo") || urlParams.get("w");
      if (modQuery && MODULOS_ADMIN.some(m => m.id === modQuery)) {
        setWidgetActivo(modQuery);
      }

      const guardados = localStorage.getItem("tranqi_favoritos_administrar");
      if (guardados) {
        setFavoritos(JSON.parse(guardados));
      }
    } catch { /* Ignorar */ }
  }, []);

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
      localStorage.setItem("tranqi_favoritos_administrar", JSON.stringify(nuevos));
    } catch { /* Ignorar */ }
  };

  const modulosOrdenados = [...MODULOS_ADMIN].sort((a, b) => {
    const aFav = favoritos.includes(a.id);
    const bFav = favoritos.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const moduloActualDef = MODULOS_ADMIN.find(m => m.id === widgetActivo);

  // VISTA 2: PANEL DEDICADO DEL MÓDULO ENFOCADO (Con botón circular 'X' en la esquina superior derecha)
  if (widgetActivo && moduloActualDef) {
    return (
      <div style={{ width: "100%", animation: "fadeIn 0.15s ease" }}>
        <section className="tarjeta-seccion" style={{ background: "var(--blanco, #ffffff)", borderRadius: "16px", overflow: "hidden", width: "100%", border: "1px solid var(--panel-linea, #E4E4E4)" }}>
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
                {React.createElement(moduloActualDef.icono, { size: 20, color: moduloActualDef.colorIcono })}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--negro, #111111)", margin: 0 }}>
                    {moduloActualDef.titulo}
                  </h2>
                  {favoritos.includes(widgetActivo) && (
                    <span className="pildora-estado" style={{ background: "var(--amarillo)", color: "var(--negro)", fontSize: "0.65rem" }}>
                      ⭐ Destacado
                    </span>
                  )}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                  {moduloActualDef.subtitulo}
                </span>
              </div>
            </div>

            {/* Botón Circular de Cerrar (X) */}
            <button
              type="button"
              onClick={() => setWidgetActivo(null)}
              title="Cerrar módulo y volver a Administrar"
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

          {/* Cuerpo del Módulo Activo */}
          <div style={{ padding: "20px 16px", width: "100%" }}>
            {/* 1. GESTIÓN DE USUARIOS */}
            {widgetActivo === "gestion_usuarios" && (
              <div style={{ width: "100%" }}>
                <AdministracionPerfilesWidget esAdmin={true} negocio={negocio} />
              </div>
            )}

            {/* 2. APROBACIÓN DE SOCIOS ABOGADOS */}
            {widgetActivo === "socios" && (
              <div style={{ width: "100%", padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "#666" }}>
                    Validación de credenciales SENESCYT y matrículas del Foro de Abogados para ingreso a la red.
                  </p>
                  <Link href="/panel/socios" className="btn-mini" style={{ textDecoration: "none", fontSize: "0.78rem" }}>
                    Ver Tabla Completa
                  </Link>
                </div>
                <div style={{ background: "#FAFAFA", padding: "16px", borderRadius: "10px", border: "1px solid #E5E5E5" }}>
                  <iframe src="/panel/socios" style={{ width: "100%", height: "540px", border: "none", borderRadius: "8px" }} title="Aprobación de Socios" />
                </div>
              </div>
            )}

            {/* 3. SOLICITUDES DE SOCIOS */}
            {widgetActivo === "solicitud_socio" && (
              <div style={{ width: "100%", padding: "10px 0" }}>
                <div style={{ background: "#FAFAFA", padding: "16px", borderRadius: "10px", border: "1px solid #E5E5E5" }}>
                  <iframe src="/panel/solicitud-socio" style={{ width: "100%", height: "540px", border: "none", borderRadius: "8px" }} title="Solicitudes de Socios" />
                </div>
              </div>
            )}

            {/* 4. EMISIÓN DE NOTIFICACIONES */}
            {widgetActivo === "emision_notificaciones" && (
              <div style={{ maxWidth: "960px", margin: "0 auto" }}>
                <EmisionNotificacionesWidget negocio={negocio} />
              </div>
            )}

            {/* 5. AUDITORÍA BDD & TELEMETRÍA */}
            {widgetActivo === "auditoria" && (
              <div style={{ width: "100%", padding: "10px 0" }}>
                <div style={{ background: "#FAFAFA", padding: "16px", borderRadius: "10px", border: "1px solid #E5E5E5" }}>
                  <iframe src="/panel/auditoria" style={{ width: "100%", height: "560px", border: "none", borderRadius: "8px" }} title="Auditoría BDD" />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // VISTA 1: REJILLA PRINCIPAL DE MÓDULOS "ADMINISTRAR"
  return (
    <div style={{ width: "100%" }}>
      {/* Header Hero Card con indicador de MFA Requerido (PLT-002) */}
      <section className="tarjeta-proteccion tarjeta-admin" style={{ marginBottom: "20px" }}>
        <div className="tarjeta-proteccion-fila">
          <div>
            <div className="eyebrow-cliente">Consola de Gestión Operativa & Control</div>
            <div className="tarjeta-proteccion-plan">
              Administrar — <i>Módulos de Gestión ({negocio})</i>
            </div>
            <div className="tarjeta-proteccion-meta">
              Gestión centralizada de usuarios, aprobación de socios profesionales, solicitudes, despacho de notificaciones y auditoría BDD.
            </div>
          </div>
          <span className="badge-rol" style={{ background: "rgba(220, 38, 38, 0.25)", color: "#FEE2E2", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
            <Lock style={{ width: 14, height: 14, marginRight: 4 }} />
            MFA Protegido (TOTP)
          </span>
        </div>
      </section>

      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            Módulos de Administración Asignados
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
            ⭐ {favoritos.length} Destacados
          </span>
        </div>

        {/* Rejilla de Módulos */}
        <div className="accesos-cliente">
          {modulosOrdenados.map(m => {
            const IconoComponente = m.icono;
            const esFav = favoritos.includes(m.id);

            return (
              <div
                key={m.id}
                onClick={() => setWidgetActivo(m.id)}
                className="tarjeta-acceso"
                style={{
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  cursor: "pointer",
                  position: "relative",
                  textDecoration: "none",
                  color: "inherit"
                }}
              >
                {/* Botón de Estrella Favorito */}
                <button
                  type="button"
                  title={esFav ? "Quitar de destacados" : "Marcar como destacado"}
                  onClick={e => toggleFavorito(e, m.id)}
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
                  <IconoComponente size={20} color={m.colorIcono} />
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
                      DESTACADO
                    </span>
                  )}
                  <strong style={{ display: "block", lineHeight: 1.25, fontSize: "0.95rem" }}>
                    {m.titulo}
                  </strong>
                </div>

                <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem" }}>{m.subtitulo}</p>

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
                  <span>Abrir módulo</span>
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
