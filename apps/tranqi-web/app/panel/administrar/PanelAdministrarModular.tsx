"use client";

import React, { useState, useEffect } from "react";
import { UserCog, Users, ClipboardList, Bell, Shield, ChevronRight, Star, Lock, X, Eye } from "lucide-react";
import Link from "next/link";
import { crearClienteNavegador } from "@eco/supabase";
import { AdministracionPerfilesWidget } from "@eco/gestion-usuarios/componentes/AdministracionPerfilesWidget";
import { EmisionNotificacionesWidget } from "@eco/notificaciones";
import { TablaAuditoria } from "../auditoria/TablaAuditoria";
import type { RegistroAuditoria } from "@eco/auditoria";

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

// Componente Widget Nativo para Aprobación de Socios Abogados (Sin iframe)
function SociosWidget() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const supabase = crearClienteNavegador();
        const { data: sData } = await supabase
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .select("*")
          .order("ssc_creado_en", { ascending: false });

        if (sData && sData.length > 0) {
          const userIds = [...new Set(sData.map(s => s.ssc_usuario_id))];
          const { data: uData } = await supabase
            .schema("comun_seguridad")
            .from("seg_usuario")
            .select("usu_id, usu_nombres, usu_apellidos, usu_correo")
            .in("usu_id", userIds);

          const uMap = new Map((uData || []).map(u => [u.usu_id, u]));
          const combinadas = sData.map(s => ({
            ...s,
            usuario: uMap.get(s.ssc_usuario_id) || null
          }));
          setSolicitudes(combinadas);
        } else {
          setSolicitudes([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const ETIQUETA_ESTADO: Record<string, string> = {
    enviada: "Pendiente aprobación",
    en_revision: "En revisión",
    aceptada: "Aprobado",
    rechazada: "Rechazado",
  };

  if (cargando) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--panel-gris, #737373)" }}>
        Cargando solicitudes de socios abogados...
      </div>
    );
  }

  if (solicitudes.length === 0) {
    return (
      <div className="estado-vacio" style={{ padding: "40px 20px", textAlign: "center" }}>
        <Users style={{ width: 40, height: 40, color: "#9CA3AF", margin: "0 auto 12px", display: "block" }} />
        <p style={{ margin: 0, fontWeight: 600, color: "#6B7280" }}>Todavía no hay solicitudes de socios abogados.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div className="tabla-panel-envoltura">
        <table className="tabla-panel">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Correo Electrónico</th>
              <th>Fecha Envío</th>
              <th>Estado Acreditación</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.ssc_id}>
                <td>{[s.usuario?.usu_nombres, s.usuario?.usu_apellidos].filter(Boolean).join(" ") || "—"}</td>
                <td>{s.usuario?.usu_correo || "—"}</td>
                <td>{new Date(s.ssc_enviada_en || s.ssc_creado_en).toLocaleDateString("es-EC")}</td>
                <td>
                  <span className={`chip-estado-solicitud chip-${s.ssc_estado}`}>
                    {ETIQUETA_ESTADO[s.ssc_estado] || s.ssc_estado}
                  </span>
                </td>
                <td>
                  <Link href={`/panel/socios/${s.ssc_id}`} className="btn-mini" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Eye size={14} /> Evaluar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Componente Widget Nativo para Solicitudes de Socio (Sin iframe)
function SolicitudSocioWidget() {
  return (
    <div style={{ padding: "24px", textAlign: "center", background: "#FAFAFA", borderRadius: "12px", border: "1px solid #E5E5E5" }}>
      <ClipboardList style={{ width: 42, height: 42, color: "#05876E", margin: "0 auto 12px", display: "block" }} />
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px 0" }}>Formulario de Solicitud de Socio Abogado</h3>
      <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "0.88rem", maxWidth: "540px", marginInline: "auto" }}>
        Únete a la red de abogados de tranqi. Completa tus datos de acreditación SENESCYT y foro de abogados para revisión.
      </p>
      <Link href="/panel/solicitud-socio" className="btn btn-primario" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
        <ClipboardList size={16} /> Ir al Formulario de Postulación
      </Link>
    </div>
  );
}

// Componente Widget Nativo para Auditoría BDD (Sin iframe)
function VisorAuditoriaWidget() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const supabase = crearClienteNavegador();
        const { data } = await supabase
          .schema("comun_auditoria")
          .from("aud_registro")
          .select("*")
          .order("aud_creado_en", { ascending: false })
          .limit(100);

        if (data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adaptados: RegistroAuditoria[] = data.map((r: any) => ({
            reg_id: r.aud_id,
            reg_esquema: r.aud_esquema || "tranqui_legal",
            reg_tabla: r.aud_tabla || r.aud_tabla_nombre || "trq_solicitud_socio",
            reg_operacion: r.aud_operacion || "UPDATE",
            reg_datos_anteriores: r.aud_datos_anteriores || null,
            reg_datos_nuevos: r.aud_datos_nuevos || null,
            reg_creado_en: r.aud_creado_en,
            actor_nombres: r.aud_actor_nombres || null,
            actor_apellidos: r.aud_actor_apellidos || null,
            actor_correo: r.aud_actor_correo || null,
          }));
          setRegistros(adaptados);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  if (cargando) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--panel-gris, #737373)" }}>
        Cargando registros de auditoría inmutable...
      </div>
    );
  }

  return <TablaAuditoria registros={registros} />;
}

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

  // VISTA 2: PANEL DEDICADO DEL MÓDULO ENFOCADO (Con botón circular 'X' en la esquina superior derecha, SIN iframe)
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

          {/* Cuerpo del Módulo Activo - NATIVO SIN IFRAME */}
          <div style={{ padding: "20px 16px", width: "100%" }}>
            {/* 1. GESTIÓN DE USUARIOS */}
            {widgetActivo === "gestion_usuarios" && (
              <div style={{ width: "100%" }}>
                <AdministracionPerfilesWidget esAdmin={true} negocio={negocio} />
              </div>
            )}

            {/* 2. APROBACIÓN DE SOCIOS ABOGADOS */}
            {widgetActivo === "socios" && (
              <SociosWidget />
            )}

            {/* 3. SOLICITUDES DE SOCIOS */}
            {widgetActivo === "solicitud_socio" && (
              <SolicitudSocioWidget />
            )}

            {/* 4. EMISIÓN DE NOTIFICACIONES */}
            {widgetActivo === "emision_notificaciones" && (
              <div style={{ maxWidth: "960px", margin: "0 auto" }}>
                <EmisionNotificacionesWidget negocio={negocio} />
              </div>
            )}

            {/* 5. AUDITORÍA BDD & TELEMETRÍA */}
            {widgetActivo === "auditoria" && (
              <VisorAuditoriaWidget />
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
