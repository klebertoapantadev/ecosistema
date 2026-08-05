"use client";

import React, { useState } from "react";
import { ShieldCheck, UserCog, Users, ClipboardList, Bell, Shield, ChevronRight, Star, Lock } from "lucide-react";
import Link from "next/link";

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

  const toggleFavorito = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (favoritos.includes(id)) {
      setFavoritos(favoritos.filter(item => item !== id));
    } else {
      setFavoritos([...favoritos, id]);
    }
  };

  const modulosOrdenados = [...MODULOS_ADMIN].sort((a, b) => {
    const aFav = favoritos.includes(a.id);
    const bFav = favoritos.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

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
              <Link
                key={m.id}
                href={m.ruta}
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
                  <span>Ingresar a módulo</span>
                  <ChevronRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
