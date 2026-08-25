"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, ShieldCheck, Eye, RefreshCw, RotateCcw, Filter, UserCheck } from "lucide-react";
import { ModalNotificacionPush } from "../../../notificaciones/src/ModalNotificacionPush";
import { obtenerDatosGestionUsuariosAction, resetearSistemaSuperAdminAction } from "../acciones";
import { FilaUsuario } from "./FilaUsuario";
import type { UsuarioConMembresia, PerfilAsignable } from "../consultas";

interface Props {
  negocio?: string;
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
  const [usuarios, setUsuarios] = useState<UsuarioConMembresia[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilAsignable[]>([]);
  const [nivelMaximoGestor, setNivelMaximoGestor] = useState<number>(100);
  const [cargando, setCargando] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroRol, setFiltroRol] = useState<string>("TODOS");
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("OPERADOR");
  const [procesandoAccion, setProcesandoAccion] = useState<string | null>(null);
  const [modalPush, setModalPush] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    tipo?: "exito" | "error" | "info" | "advertencia" | "push";
    alAceptar?: () => void;
    alCancelar?: () => void;
    mostrarConfirmacion?: boolean;
  }>({
    abierto: false,
    titulo: "",
    mensaje: "",
    tipo: "exito",
  });

  const cargarDirectorio = async (q: string = "") => {
    try {
      setCargando(true);
      const res = await obtenerDatosGestionUsuariosAction(q, negocio);
      if (res.ok && res.data) {
        setUsuarios(res.data.usuarios);
        setPerfiles(res.data.perfiles);
        setNivelMaximoGestor(res.data.nivelMaximoGestor);
      }
    } catch (err) {
      console.error("Error al cargar directorio de usuarios:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDirectorio();
  }, [negocio]);

  async function handleResetearSistema() {
    setModalPush({
      abierto: true,
      tipo: "advertencia",
      titulo: "Resetear Sistema",
      mensaje: `Esta acción eliminará TODOS los usuarios de prueba, perfiles y solicitudes configuradas en la base de datos (conservando únicamente la cuenta SuperAdmin). ¿Deseas continuar?`,
      mostrarConfirmacion: true,
      alAceptar: async () => {
        setModalPush((prev) => ({ ...prev, abierto: false }));
        try {
          setProcesandoAccion("reset_all");
          const res = await resetearSistemaSuperAdminAction(negocio);
          if (res.ok) {
            setModalPush({
              abierto: true,
              tipo: "push",
              titulo: "Sistema reseteado",
              mensaje: `El sistema para el negocio "${negocio}" ha sido reseteado.`,
              alAceptar: () => window.location.reload(),
            });
          } else {
            setModalPush({
              abierto: true,
              tipo: "error",
              titulo: "Error al resetear",
              mensaje: res.error || "No se pudo resetear el sistema",
            });
          }
        } catch (err: any) {
          setModalPush({
            abierto: true,
            tipo: "error",
            titulo: "Error al resetear",
            mensaje: err?.message || "Ocurrió un error inesperado",
          });
        } finally {
          setProcesandoAccion(null);
        }
      },
      alCancelar: () => {
        setModalPush((prev) => ({ ...prev, abierto: false }));
      },
    });
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const nombreCompleto = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ").toLowerCase();
    const correo = u.usu_correo.toLowerCase();
    const texto = filtroTexto.toLowerCase();

    const coincideTexto = !texto || nombreCompleto.includes(texto) || correo.includes(texto);
    const coincideRol = filtroRol === "TODOS" || u.perfiles.some((p) => p.toUpperCase() === filtroRol.toUpperCase());
    return coincideTexto && coincideRol;
  });

  const perfilObjConsulta = MATRIZ_PERFILES_CONSULTA.find((p) => p.clave === perfilSeleccionado) || MATRIZ_PERFILES_CONSULTA[1]!;

  return (
    <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #E4E4E4", padding: "24px", width: "100%" }}>
      {/* CABECERA WIDGET UNIFICADO GESTIÓN DE USUARIOS */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", borderBottom: "1px solid #F3F4F6", paddingBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "var(--violeta-suave, #F3E8FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={24} color="var(--violeta, #5000BA)" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "#111111" }}>
              Gestión de Usuarios, Membresías & Asignación de Roles
            </h2>
            <p style={{ fontSize: "0.84rem", color: "#666666", margin: "2px 0 0 0" }}>
              Directorio unificado de miembros, asignación/revocación de perfiles en tiempo real y eliminación.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => cargarDirectorio(filtroTexto)}
            style={{
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              color: "#334155",
              padding: "7px 14px",
              borderRadius: "20px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            type="button"
            onClick={handleResetearSistema}
            disabled={procesandoAccion !== null}
            style={{
              fontSize: "0.78rem",
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
              boxShadow: "0 1px 2px rgba(220,38,38,0.1)",
            }}
            title="Borrar todos los usuarios de prueba, perfiles y solicitudes para iniciar desde cero"
          >
            <RotateCcw size={14} /> Resetear Sistema (Prueba desde Cero)
          </button>
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
            gap: "8px",
          }}
        >
          <UserCheck size={18} /> Directorio & Asignación de Roles ({usuarios.length})
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
            gap: "8px",
          }}
        >
          <ShieldCheck size={18} /> Matriz de Perfiles & Permisos
        </button>
      </div>

      {/* TAB 1: DIRECTORIO INTERACTIVO DE USUARIOS */}
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
                onChange={(e) => setFiltroTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") cargarDirectorio(filtroTexto);
                }}
                style={{ width: "100%", padding: "9px 12px 9px 38px", borderRadius: "8px", border: "1px solid #E4E4E4", fontSize: "0.85rem" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Filter size={16} color="#666" />
              <select
                value={filtroRol}
                onChange={(e) => setFiltroRol(e.target.value)}
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

          {/* TABLA NATIVA UNIFICADA DE USUARIOS */}
          {cargando ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#666" }}>
              Cargando directorio de usuarios y perfiles...
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#666", background: "#F9FAFB", borderRadius: "8px" }}>
              No se encontraron usuarios registrados con el criterio de búsqueda.
            </div>
          ) : (
            <div className="tabla-panel-envoltura">
              <table className="tabla-panel" style={{ width: "100%", fontSize: "0.84rem" }}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Perfiles (Asignación de Roles)</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u) => (
                    <FilaUsuario
                      key={u.usu_id}
                      usuario={u}
                      negocio={negocio}
                      perfiles={perfiles}
                      nivelMaximoGestor={nivelMaximoGestor}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MATRIZ DE PERFILES & PERMISOS */}
      {tabActiva === "matriz" && (
        <div>
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 8px 0", color: "var(--violeta, #5000BA)" }}>
              Matriz de Jerarquía de Permisos & Gobernanza BDD (1–100)
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#4B5563", margin: 0, lineHeight: 1.5 }}>
              Selecciona un perfil para consultar sus capacidades operativas, techo de nivel jerárquico y widgets accesibles en cada panel del ecosistema.
            </p>
          </div>

          {/* Selector de Perfil */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            {MATRIZ_PERFILES_CONSULTA.map((p) => (
              <button
                key={p.clave}
                type="button"
                onClick={() => setPerfilSeleccionado(p.clave)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: perfilSeleccionado === p.clave ? "1.5px solid var(--violeta, #5000BA)" : "1px solid #E4E4E4",
                  background: perfilSeleccionado === p.clave ? "var(--violeta-suave, #F3E8FF)" : "#ffffff",
                  color: perfilSeleccionado === p.clave ? "var(--violeta, #5000BA)" : "#374151",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                {p.nombre} (Nivel {p.nivel})
              </button>
            ))}
          </div>

          {/* Detalle del Perfil Seleccionado */}
          <div style={{ background: "#ffffff", border: "1px solid #E4E4E4", borderRadius: "12px", padding: "20px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#111", fontSize: "1.05rem" }}>
              {perfilObjConsulta.nombre} — <span style={{ color: "var(--violeta, #5000BA)" }}>Nivel Jerárquico {perfilObjConsulta.nivel}</span>
            </h4>
            <p style={{ fontSize: "0.85rem", color: "#4B5563", margin: "0 0 16px 0" }}>
              {perfilObjConsulta.descripcion}
            </p>

            <h5 style={{ fontSize: "0.85rem", fontWeight: 800, margin: "16px 0 8px 0", color: "#111" }}>
              Paneles Accesibles:
            </h5>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              {perfilObjConsulta.paneles.map((pan) => (
                <span key={pan} style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", color: "#3730A3", padding: "4px 12px", borderRadius: "12px", fontWeight: 700, fontSize: "0.78rem" }}>
                  {pan}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Notificación Push Resultante */}
      <ModalNotificacionPush
        abierto={modalPush.abierto}
        tipo={modalPush.tipo}
        titulo={modalPush.titulo}
        mensaje={modalPush.mensaje}
        mostrarConfirmacion={modalPush.mostrarConfirmacion}
        alAceptar={modalPush.alAceptar || (() => setModalPush((prev) => ({ ...prev, abierto: false })))}
        alCancelar={modalPush.alCancelar || (() => setModalPush((prev) => ({ ...prev, abierto: false })))}
      />
    </div>
  );
}
