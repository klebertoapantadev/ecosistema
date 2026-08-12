"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, ShieldCheck, Eye, LayoutGrid, CheckCircle2, UserCheck, Phone, Mail, Filter, Trash2, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { obtenerDirectorioUsuariosPublicoAction, eliminarUsuarioSuperAdminAction, resetearSistemaSuperAdminAction, reactivarUsuarioSuperAdminAction } from "../acciones";

interface Props {
  negocio?: string;
}

interface UsuarioDirectorio {
  usuario_id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  whatsapp: string;
  rol: string;
  estado?: string;
  creado_en?: string;
}

interface PerfilConsultaDef {
  clave: string;
  nombre: string;
  nivel: number;
  descripcion: string;
  paneles: string[];
  widgets: Record<string, string[]>;
}

const MATRIZ_PERFILES_CONSULTA: PerfilConsultaDef[] = [
  {
    clave: "CLIENTE",
    nombre: "Cliente (Jerarquía Base)",
    nivel: 1,
    descripcion: "Perfil base de usuario. Acceso a paneles de Inicio, Mi Cuenta y Preferencias de Notificaciones.",
    paneles: ["Inicio", "Mi cuenta"],
    widgets: {
      "Inicio": ["Gestor de Accesos Rápidos & Favoritos"],
      "Mi cuenta": ["Perfil & Datos de Contacto", "Datos de Facturación", "Seguridad MFA"]
    }
  },
  {
    clave: "OPERADOR",
    nombre: "Operador / Auxiliar",
    nivel: 30,
    descripcion: "Operación diaria, soporte, atención a usuarios y notificaciones multicanal.",
    paneles: ["Inicio", "Mi cuenta", "Administrar", "Herramientas", "Seguridad"],
    widgets: {
      "Inicio": ["Gestor de Accesos Rápidos & Favoritos"],
      "Mi cuenta": ["Selector 'Ver Como'", "Perfil & Datos de Contacto"],
      "Administrar": ["Aprobación de Socios Abogados"],
      "Herramientas": ["Emisión de Notificaciones Multicanal"],
      "Seguridad": ["Auditoría por Triggers BDD", "Solicitudes de Socios"]
    }
  },
  {
    clave: "ABOGADO",
    nombre: "Socio Abogado / Profesional",
    nivel: 50,
    descripcion: "Abogados acreditados en el sistema legal Tranqui. Perfil profesional y causas.",
    paneles: ["Inicio", "Mi cuenta"],
    widgets: {
      "Inicio": ["Gestor de Accesos Rápidos & Favoritos"],
      "Mi cuenta": ["Perfil Profesional de Abogado (MFA)", "Perfil & Datos de Contacto"]
    }
  },
  {
    clave: "ADMINISTRADOR",
    nombre: "Administrador del Negocio",
    nivel: 80,
    descripcion: "Gestión operativa, asignación de perfiles, notificaciones y auditoría PostgreSQL.",
    paneles: ["Inicio", "Mi cuenta", "Configuración", "Administrar"],
    widgets: {
      "Inicio": ["Gestor de Accesos Rápidos & Favoritos"],
      "Mi cuenta": ["Perfil & Datos de Contacto", "Datos de Facturación", "Seguridad MFA"],
      "Configuración": ["Configuración del Negocio", "Servidor SMTP", "Gestión de Usuarios & Membresías", "Notificaciones"],
      "Administrar": ["Gestión de Usuarios", "Aprobación de Socios", "Solicitudes de Socios", "Notificaciones", "Auditoría"]
    }
  },
  {
    clave: "SUPERADMIN",
    nombre: "SuperAdmin de Plataforma",
    nivel: 100,
    descripcion: "Control total multi-tenant, auditoría PostgreSQL inmutable y arquitectura global.",
    paneles: ["Inicio", "Mi cuenta", "Configuración", "Administrar"],
    widgets: {
      "Inicio": ["Todos los módulos asignados"],
      "Mi cuenta": ["Todos los módulos de identidad"],
      "Configuración": ["Todos los módulos de gobernanza"],
      "Administrar": ["Todos los módulos de administración"]
    }
  }
];

export function ConsultaUsuariosPerfilesWidget({ negocio = "TRANQ" }: Props) {
  const [tabActiva, setTabActiva] = useState<"usuarios" | "matriz">("usuarios");
  const [usuarios, setUsuarios] = useState<UsuarioDirectorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("TODOS");
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("OPERADOR");
  const [procesandoAccion, setProcesandoAccion] = useState<string | null>(null);

  useEffect(() => {
    async function cargarDirectorio() {
      try {
        setCargando(true);
        const res = await obtenerDirectorioUsuariosPublicoAction(negocio);
        if (res.ok && res.data) {
          setUsuarios(res.data);
        }
      } catch (err) {
        console.error("Error al cargar directorio de usuarios:", err);
      } finally {
        setCargando(false);
      }
    }
    cargarDirectorio();
  }, [negocio]);

  async function handleReactivarUsuario(uId: string, nombreCorr: string) {
    try {
      setProcesandoAccion(uId);
      const res = await reactivarUsuarioSuperAdminAction(uId);
      if (res.ok) {
        setUsuarios(prev => prev.map(u => u.usuario_id === uId ? { ...u, estado: "ACTIVO" } : u));
        alert(`✅ La cuenta "${nombreCorr}" ha sido reactivada correctamente.`);
      } else {
        alert(`❌ Error al reactivar: ${res.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error al reactivar usuario: ${err?.message}`);
    } finally {
      setProcesandoAccion(null);
    }
  }

  async function handleEliminarUsuario(uId: string, nombreCorr: string) {
    if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR FÍSICAMENTE a "${nombreCorr}"?\n\nEsta acción borrará de forma permanente los registros en BDD y la autenticación de Supabase Auth (auth.users).`)) {
      return;
    }
    try {
      setProcesandoAccion(uId);
      const res = await eliminarUsuarioSuperAdminAction(uId);
      if (res.ok) {
        setUsuarios(prev => prev.filter(u => u.usuario_id !== uId));
        alert(`✅ La cuenta "${nombreCorr}" ha sido eliminada físicamente por completo.`);
      } else {
        alert(`❌ Error al eliminar: ${res.error || "No se pudo eliminar el usuario"}`);
      }
    } catch (err: any) {
      alert(`❌ Error al procesar eliminación: ${err?.message}`);
    } finally {
      setProcesandoAccion(null);
    }
  }

  async function handleResetearSistema() {
    const confirmacionText = prompt(`⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\nEsta acción eliminará TODOS los usuarios de prueba, perfiles y solicitudes configuradas en la base de datos (conservando únicamente la cuenta SuperAdmin).\n\nPara confirmar, escribe "CONFIRMAR RESET":`);
    if (confirmacionText !== "CONFIRMAR RESET") {
      alert("Operación cancelada.");
      return;
    }
    try {
      setProcesandoAccion("reset_all");
      const res = await resetearSistemaSuperAdminAction(negocio);
      if (res.ok) {
        alert(`💥 El sistema para el negocio "${negocio}" ha sido reseteado. Se han eliminado todas sus cuentas y perfiles de prueba preservando los demás negocios.`);
        window.location.reload();
      } else {
        alert(`❌ Error al resetear el sistema: ${res.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error al resetear el sistema: ${err?.message}`);
    } finally {
      setProcesandoAccion(null);
    }
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const coincideTexto = u.nombres.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                          u.apellidos.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                          u.correo.toLowerCase().includes(filtroTexto.toLowerCase());
    const coincideRol = filtroRol === "TODOS" || u.rol.toUpperCase() === filtroRol.toUpperCase();
    return coincideTexto && coincideRol;
  });

  const perfilObjConsulta = MATRIZ_PERFILES_CONSULTA.find(p => p.clave === perfilSeleccionado) || MATRIZ_PERFILES_CONSULTA[1]!;

  return (
    <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #E4E4E4", padding: "24px", width: "100%" }}>
      {/* CABECERA WIDGET CONSULTA */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", borderBottom: "1px solid #F3F4F6", paddingBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#F3E8FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={22} color="var(--violeta, #5000BA)" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "#111" }}>
              👥 Consulta de Usuarios, Membresías & Matriz de Roles
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#666", margin: 0 }}>
              Directorio de usuarios activos, perfiles asignados y matriz de permisos (Solo Lectura).
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleResetearSistema}
            disabled={procesandoAccion !== null}
            style={{
              fontSize: "0.76rem",
              fontWeight: 800,
              color: "#DC2626",
              background: "#FEF2F2",
              padding: "7px 14px",
              borderRadius: "20px",
              border: "1px solid #FCA5A5",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(220,38,38,0.1)"
            }}
            title="Borrar todos los usuarios de prueba, perfiles y solicitudes para iniciar desde cero"
          >
            <RotateCcw size={14} /> Resetear Sistema (Prueba desde Cero)
          </button>
          <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#05876E", background: "#ECFDF5", padding: "6px 12px", borderRadius: "20px", border: "1px solid #A7F3D0", display: "flex", alignItems: "center", gap: "6px" }}>
            <Eye size={14} /> Modo Consulta Libre
          </span>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid #E4E4E4" }}>
        <button
          type="button"
          onClick={() => setTabActiva("usuarios")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: tabActiva === "usuarios" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            fontWeight: tabActiva === "usuarios" ? 800 : 600,
            color: tabActiva === "usuarios" ? "var(--violeta, #5000BA)" : "#666",
            cursor: "pointer",
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <UserCheck size={18} /> Directorio de Usuarios ({usuarios.length})
        </button>

        <button
          type="button"
          onClick={() => setTabActiva("matriz")}
          style={{
            padding: "10px 18px",
            border: "none",
            borderBottom: tabActiva === "matriz" ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
            background: "transparent",
            fontWeight: tabActiva === "matriz" ? 800 : 600,
            color: tabActiva === "matriz" ? "var(--violeta, #5000BA)" : "#666",
            cursor: "pointer",
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <ShieldCheck size={18} /> Matriz de Perfiles & Permisos
        </button>
      </div>

      {/* TAB 1: DIRECTORIO DE USUARIOS */}
      {tabActiva === "usuarios" && (
        <div>
          {/* BARRA DE BÚSQUEDA Y FILTRO */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
              <Search size={18} color="#9CA3AF" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Buscar por nombre, apellido o correo..."
                value={filtroTexto}
                onChange={e => setFiltroTexto(e.target.value)}
                style={{ width: "100%", padding: "9px 12px 9px 38px", borderRadius: "8px", border: "1px solid #E4E4E4", fontSize: "0.85rem" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={16} color="#666" />
              <select
                value={filtroRol}
                onChange={e => setFiltroRol(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #E4E4E4", fontSize: "0.85rem", fontWeight: 700, background: "#ffffff" }}
              >
                <option value="TODOS">Todos los Roles</option>
                <option value="CLIENTE">Cliente</option>
                <option value="OPERADOR">Operador</option>
                <option value="ABOGADO">Abogado</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="SUPERADMIN">SuperAdmin</option>
              </select>
            </div>
          </div>

          {/* TABLA DE DIRECTORIO */}
          {cargando ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#666" }}>
              Cargando directorio de usuarios...
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#666", background: "#F9FAFB", borderRadius: "8px" }}>
              No se encontraron usuarios registrados con el criterio de búsqueda.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <thead>
                  <tr style={{ background: "#F7F6FA", borderBottom: "1.5px solid #E4E4E4" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", color: "#4B5563", fontWeight: 700 }}>Usuario / Nombres</th>
                    <th style={{ textAlign: "left", padding: "10px 14px", color: "#4B5563", fontWeight: 700 }}>Correo Electrónico</th>
                    <th style={{ textAlign: "left", padding: "10px 14px", color: "#4B5563", fontWeight: 700 }}>Contacto</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", color: "#4B5563", fontWeight: 700 }}>Rol Asignado</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", color: "#4B5563", fontWeight: 700 }}>Estado</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", color: "#DC2626", fontWeight: 700 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => (
                    <tr key={u.usuario_id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#111" }}>
                        {[u.nombres, u.apellidos].filter(Boolean).join(" ")}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#4B5563", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Mail size={14} color="#9CA3AF" /> {u.correo}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#4B5563" }}>
                        {u.whatsapp ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#05876E", fontWeight: 700 }}>
                            <Phone size={14} /> {u.whatsapp}
                          </span>
                        ) : (
                          <span style={{ color: "#9CA3AF" }}>No registrado</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 800, padding: "4px 10px", borderRadius: "12px", background: u.rol === "SUPERADMIN" ? "#FEF3C7" : u.rol === "ADMINISTRADOR" ? "#EDE9FE" : "#F3F4F6", color: u.rol === "SUPERADMIN" ? "#D97706" : u.rol === "ADMINISTRADOR" ? "#5000BA" : "#374151" }}>
                          {u.rol}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        {u.estado === "ELIMINADO" || u.estado === "INACTIVO" || u.estado === "BAJA" ? (
                          <span style={{ color: "#DC2626", fontWeight: 800, fontSize: "0.76rem", display: "inline-flex", alignItems: "center", gap: "4px", background: "#FEF2F2", padding: "3px 8px", borderRadius: "8px", border: "1px solid #FCA5A5" }}>
                            <AlertTriangle size={13} /> Eliminado Lógicamente (Baja LOPDP)
                          </span>
                        ) : (
                          <span style={{ color: "#05876E", fontWeight: 800, fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={14} /> Activo
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        {u.rol !== "SUPERADMIN" && u.correo !== "kleber.toapanta.ch@gmail.com" ? (
                          <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                            {(u.estado === "ELIMINADO" || u.estado === "INACTIVO" || u.estado === "BAJA") && (
                              <button
                                type="button"
                                onClick={() => handleReactivarUsuario(u.usuario_id, u.correo || u.nombres)}
                                disabled={procesandoAccion === u.usuario_id}
                                style={{
                                  background: "#ECFDF5",
                                  border: "1px solid #6EE7B7",
                                  color: "#047857",
                                  borderRadius: "8px",
                                  padding: "5px 10px",
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                                title="Reactivar la cuenta del usuario"
                              >
                                <RefreshCw size={13} /> Reactivar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEliminarUsuario(u.usuario_id, u.correo || u.nombres)}
                              disabled={procesandoAccion === u.usuario_id}
                              style={{
                                background: "#FEF2F2",
                                border: "1px solid #FCA5A5",
                                color: "#DC2626",
                                borderRadius: "8px",
                                padding: "5px 10px",
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              title="Borrado físico definitivo en BDD y auth.users"
                            >
                              <Trash2 size={13} /> {procesandoAccion === u.usuario_id ? "Borrando..." : "Borrar Físicamente"}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#9CA3AF", fontWeight: 700 }}>Protegido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MATRIZ DE PERFILES Y PERMISOS (SOLO LECTURA) */}
      {tabActiva === "matriz" && perfilObjConsulta && (
        <div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", overflowX: "auto", paddingBottom: "8px" }}>
            {MATRIZ_PERFILES_CONSULTA.map(p => (
              <button
                key={p.clave}
                type="button"
                onClick={() => setPerfilSeleccionado(p.clave)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: perfilSeleccionado === p.clave ? "2px solid var(--violeta, #5000BA)" : "1px solid #E4E4E4",
                  background: perfilSeleccionado === p.clave ? "#F3E8FF" : "#ffffff",
                  color: perfilSeleccionado === p.clave ? "var(--violeta, #5000BA)" : "#374151",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer"
                }}
              >
                {p.nombre} (Nivel {p.nivel})
              </button>
            ))}
          </div>

          {/* DETALLES DEL PERFIL SELECCIONADO */}
          <div style={{ background: "#F7F6FA", borderRadius: "12px", padding: "20px", border: "1px solid #E4E4E4" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#111", margin: "0 0 6px 0" }}>
              {perfilObjConsulta.nombre} — Clave: {perfilObjConsulta.clave}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 16px 0" }}>
              {perfilObjConsulta.descripcion}
            </p>

            <h4 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#374151", marginBottom: "10px" }}>
              PANELES & WIDGETS ASIGNADOS EN LA MATRIZ:
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.entries(perfilObjConsulta.widgets).map(([panelNombre, listaWidgets]) => (
                <div key={panelNombre} style={{ background: "#ffffff", borderRadius: "8px", padding: "14px", border: "1px solid #E4E4E4" }}>
                  <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "var(--violeta, #5000BA)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <LayoutGrid size={16} /> Panel {panelNombre}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {listaWidgets.map((wName: string, idx: number) => (
                      <span key={idx} style={{ fontSize: "0.78rem", fontWeight: 700, background: "#F3F4F6", color: "#374151", padding: "4px 10px", borderRadius: "6px", border: "1px solid #E5E7EB" }}>
                        ✓ {wName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
