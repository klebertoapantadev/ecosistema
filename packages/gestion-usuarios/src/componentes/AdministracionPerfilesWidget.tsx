"use client";

import React, { useState } from "react";
import {
  ShieldCheck, Shield, Users, UserCheck, Settings,
  Lock, CheckCircle2, ChevronDown, ChevronUp, Search, Info, Sliders
} from "lucide-react";

export interface PerfilDef {
  clave: string;
  nombre: string;
  nivel: number;
  ambito: "Empresa" | "Plataforma";
  asignador: string;
  descripcion: string;
  widgetsAsignados: string[];
  activo: boolean;
  esSuperAdmin?: boolean;
}

const PERFILES_ESTANDAR: PerfilDef[] = [
  {
    clave: "CLIENTE",
    nombre: "Cliente (Jerarquía Base)",
    nivel: 1,
    ambito: "Empresa",
    asignador: "Asignación automática por sistema al registrarse",
    descripcion: "Perfil de nivel base asignado obligatoriamente a todo usuario registrado. Acceso a consulta de trámites, pagos y perfil personal.",
    widgetsAsignados: ["Mi Cuenta", "Preferencias de Notificaciones", "Ver Como"],
    activo: true
  },
  {
    clave: "OPERADOR",
    nombre: "Operador / Auxiliar",
    nivel: 30,
    ambito: "Empresa",
    asignador: "Administrador del Negocio o SuperAdmin",
    descripcion: "Perfil operativo para atención al cliente, seguimiento administrativo de solicitudes y gestión de tickets.",
    widgetsAsignados: ["Mi Cuenta", "Revisión de Trámites", "Atención al Cliente", "Preferencias de Notificaciones"],
    activo: true
  },
  {
    clave: "ABOGADO",
    nombre: "Socio Abogado / Profesional",
    nivel: 50,
    ambito: "Empresa",
    asignador: "Administrador del Negocio tras verificación de credenciales",
    descripcion: "Perfil profesional para la atención legal de causas judicializadas, carga de expedientes y dictamen de asesorías.",
    widgetsAsignados: ["Mi Cuenta", "Expedientes Judiciales", "Consola de Causas", "Preferencias de Notificaciones", "Ver Como"],
    activo: true
  },
  {
    clave: "ADMINISTRADOR",
    nombre: "Administrador del Negocio",
    nivel: 80,
    ambito: "Empresa",
    asignador: "SuperAdmin o Administrador existente (Techo ≤ 80)",
    descripcion: "Gestión centralizada del negocio: asignación de roles a miembros, parámetros de marca, servidor SMTP saliente y auditoría.",
    widgetsAsignados: ["Configuración del Negocio", "Servidor SMTP", "Gestión de Usuarios", "Aprobación de Socios", "Historial de Accesos", "Preferencias de Notificaciones"],
    activo: true
  },
  {
    clave: "SUPERADMIN",
    nombre: "SuperAdmin de Plataforma",
    nivel: 100,
    ambito: "Plataforma",
    asignador: "Bootstrap de plataforma (Gobernanza global)",
    descripcion: "Gobernanza exclusiva multitenant de la plataforma. Configuración de la matriz de perfiles, Vault de credenciales y telemetría de auditoría BDD.",
    widgetsAsignados: ["Gobernanza de Perfiles", "Auditoría por Triggers", "Consola Telemetría", "Gestión de Vault", "Todas las capacidades"],
    activo: true,
    esSuperAdmin: true
  }
];

interface Props {
  esAdmin: boolean;
  negocio: string;
}

export function AdministracionPerfilesWidget({ esAdmin, negocio }: Props) {
  const [perfilDetalle, setPerfilDetalle] = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [filtroNivel, setFiltroNivel] = useState<string>("TODOS");

  const perfilesFiltrados = PERFILES_ESTANDAR.filter(p => {
    const coincideTexto = p.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                          p.clave.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                          p.descripcion.toLowerCase().includes(filtroTexto.toLowerCase());
    
    if (filtroNivel === "TODOS") return coincideTexto;
    if (filtroNivel === "BASE") return coincideTexto && p.nivel === 1;
    if (filtroNivel === "OPERATIVO") return coincideTexto && p.nivel >= 30 && p.nivel <= 50;
    if (filtroNivel === "ADMINISTRATIVO") return coincideTexto && p.nivel >= 80;
    return coincideTexto;
  });

  return (
    <div style={{ width: "100%", color: "var(--negro, #111111)" }}>
      {/* Banner Informativo de Gobernanza de Perfiles (PLT-003) */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(80, 0, 186, 0.05) 0%, rgba(10, 43, 34, 0.05) 100%)",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          borderRadius: "14px",
          padding: "18px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px"
        }}
      >
        <div
          style={{
            background: "var(--violeta, #5000BA)",
            color: "#ffffff",
            padding: "10px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <Sliders size={22} />
        </div>
        <div>
          <h3 style={{ fontSize: "1.02rem", fontWeight: 800, margin: "0 0 4px 0", color: "var(--negro, #111111)" }}>
            Gobernanza de Perfiles & Jerarquía de Roles
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--panel-gris, #737373)", margin: 0, lineHeight: 1.5 }}>
            El ecosistema utiliza una escala de jerarquía de roles estandarizada de <strong>1 a 100</strong> aislada por negocio ({negocio}).
            Los Administradores únicamente pueden asignar perfiles de jerarquía igual o inferior a su propio nivel.
          </p>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtro de Jerarquía */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
          <input
            type="text"
            placeholder="Buscar perfil o clave..."
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 36px",
              borderRadius: "8px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              fontSize: "0.85rem",
              background: "#ffffff"
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { id: "TODOS", etiqueta: "Todos (1–100)" },
            { id: "BASE", etiqueta: "Base (Nivel 1)" },
            { id: "OPERATIVO", etiqueta: "Operativo (30–50)" },
            { id: "ADMINISTRATIVO", etiqueta: "Gestión (80–100)" }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroNivel(f.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                border: "1px solid",
                borderColor: filtroNivel === f.id ? "var(--violeta, #5000BA)" : "var(--panel-linea, #E4E4E4)",
                background: filtroNivel === f.id ? "var(--violeta, #5000BA)" : "#ffffff",
                color: filtroNivel === f.id ? "#ffffff" : "var(--negro, #111111)",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / DataGrid de Perfiles */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {perfilesFiltrados.map(p => {
          const desplegado = perfilDetalle === p.clave;

          return (
            <div
              key={p.clave}
              style={{
                border: "1px solid var(--panel-linea, #E4E4E4)",
                borderRadius: "12px",
                background: "#ffffff",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
              }}
            >
              <div
                onClick={() => setPerfilDetalle(desplegado ? null : p.clave)}
                style={{
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  background: desplegado ? "var(--panel-papel, #F7F6FA)" : "#ffffff",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background: p.esSuperAdmin ? "rgba(45, 27, 105, 0.1)" : "var(--panel-linea-suave, #FAFAF9)",
                      color: p.esSuperAdmin ? "#2D1B69" : "var(--violeta, #5000BA)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--panel-linea, #E4E4E4)",
                      flexShrink: 0
                    }}
                  >
                    {p.esSuperAdmin ? <ShieldCheck size={20} /> : p.nivel >= 80 ? <Shield size={20} /> : p.nivel >= 50 ? <UserCheck size={20} /> : <Users size={20} />}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--negro, #111111)" }}>
                        {p.nombre}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: p.nivel === 100 ? "#2D1B69" : p.nivel >= 80 ? "#0A2B22" : p.nivel >= 50 ? "#05594A" : "var(--panel-linea-suave, #FAFAF9)",
                          color: p.nivel >= 50 ? "#ffffff" : "var(--negro, #111111)",
                          letterSpacing: "0.04em"
                        }}
                      >
                        Nivel {p.nivel}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          border: "1px solid var(--panel-linea, #E4E4E4)",
                          background: "#ffffff",
                          color: "var(--panel-gris, #737373)"
                        }}
                      >
                        Ámbito {p.ambito}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", marginTop: "2px", display: "block" }}>
                      {p.asignador}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: p.activo ? "#05876e" : "#B00020",
                      background: p.activo ? "rgba(5, 135, 110, 0.1)" : "rgba(176, 0, 32, 0.1)",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <CheckCircle2 size={12} /> {p.activo ? "Activo en Catálogo" : "Inactivo"}
                  </span>
                  {desplegado ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Detalle Desplegable del Perfil & Matriz de Widgets */}
              {desplegado && (
                <div
                  style={{
                    padding: "16px 20px",
                    borderTop: "1px solid var(--panel-linea, #E4E4E4)",
                    background: "#ffffff"
                  }}
                >
                  <p style={{ fontSize: "0.85rem", color: "var(--negro, #111111)", marginBottom: "14px", lineHeight: 1.5 }}>
                    {p.descripcion}
                  </p>

                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      Capacidades & Widgets Otorgados en el Panel:
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {p.widgetsAsignados.map(w => (
                        <span
                          key={w}
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: "var(--panel-papel, #F7F6FA)",
                            border: "1px solid var(--panel-linea, #E4E4E4)",
                            color: "var(--negro, #111111)",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <CheckCircle2 size={13} color="var(--esmeralda, #05876e)" />
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: "var(--panel-gris, #737373)",
                      background: "var(--panel-linea-suave, #FAFAF9)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Info size={15} color="var(--violeta, #5000BA)" />
                    <span>
                      Regla <strong>PLT-003 §1</strong>: La modificación de permisos de esta matriz está reservada exclusivamente al <strong>SUPERADMIN</strong> de la plataforma.
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
