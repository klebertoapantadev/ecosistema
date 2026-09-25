"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, ShieldCheck, RefreshCw, RotateCcw, Filter, UserCheck, Share2, CheckCircle2, Trash2 } from "lucide-react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { ModalNotificacionPush } from "../../../notificaciones/src/ModalNotificacionPush";
import {
  obtenerDatosGestionUsuariosAction,
  resetearSistemaSuperAdminAction,
  asignarPerfil,
  quitarPerfil,
  eliminarUsuarioSuperAdminAction
} from "../acciones";
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

function CeldaPerfilesInteractiva({
  usuario,
  negocio,
  perfiles,
  nivelMaximoGestor,
  onActualizarPerfiles
}: {
  usuario: UsuarioConMembresia;
  negocio: string;
  perfiles: PerfilAsignable[];
  nivelMaximoGestor: number;
  onActualizarPerfiles?: (usuarioId: string, nuevosPerfiles: string[]) => void;
}) {
  const [asignados, setAsignados] = useState<string[]>(usuario.perfiles);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Sincronizar perfiles si el padre actualiza datos
  useEffect(() => {
    setAsignados(usuario.perfiles);
  }, [usuario.perfiles]);

  async function alternar(clave: string, marcado: boolean) {
    const estadoPrevio = [...asignados];
    const nuevosPerfiles = marcado
      ? Array.from(new Set([...asignados, clave]))
      : asignados.filter((c) => c !== clave);

    // 1. Actualización optimista inmediata en estado local y padre
    setAsignados(nuevosPerfiles);
    onActualizarPerfiles?.(usuario.usu_id, nuevosPerfiles);
    setOcupado(clave);
    setMensaje(null);

    try {
      const resultado = marcado
        ? await asignarPerfil(usuario.usu_id, clave, negocio)
        : await quitarPerfil(usuario.usu_id, clave, negocio);

      if (!resultado.ok) {
        // Rollback al estado previo si falla la acción
        setAsignados(estadoPrevio);
        onActualizarPerfiles?.(usuario.usu_id, estadoPrevio);
        setMensaje(resultado.error ?? "Error al procesar la solicitud");
      }
    } catch (err: any) {
      setAsignados(estadoPrevio);
      onActualizarPerfiles?.(usuario.usu_id, estadoPrevio);
      setMensaje(err?.message || "Error al procesar la solicitud");
    } finally {
      setOcupado(null);
    }
  }

  const puedeAsignarRoles = nivelMaximoGestor >= 80;

  return (
    <div>
      <div className="perfiles-usuario" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {perfiles.map((p) => {
          const tiene = asignados.includes(p.clave);
          const fueraDeAlcance = !puedeAsignarRoles || p.nivel > nivelMaximoGestor;
          const esBase = p.clave === "CLIENTE";
          const esAbogado = p.clave === "ABOGADO";
          const estaCargandoEste = ocupado === p.clave;

          return (
            <label
              key={p.clave}
              className={`perfil-casilla${tiene ? " perfil-casilla-activa" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                background: tiene ? "#F3E8FF" : "#F8FAFC",
                border: tiene ? "1px solid #D8B4FE" : "1px solid #E2E8F0",
                fontSize: "0.76rem",
                cursor: fueraDeAlcance || (esBase && tiene) || esAbogado || ocupado !== null ? "default" : "pointer",
                opacity: fueraDeAlcance ? 0.55 : estaCargandoEste ? 0.7 : 1,
                transition: "all 0.15s ease"
              }}
              title={
                !puedeAsignarRoles
                  ? "Solo administradores pueden asignar o revocar perfiles (Solo Lectura)"
                  : fueraDeAlcance
                    ? `Requiere jerarquía ${p.nivel} o superior`
                    : esBase
                      ? "Perfil base, no se puede retirar"
                      : esAbogado
                        ? "Se asigna automáticamente al confirmar el contrato de socio firmado"
                        : `Nivel ${p.nivel}`
              }
            >
              <input
                type="checkbox"
                checked={tiene}
                disabled={!puedeAsignarRoles || ocupado !== null || fueraDeAlcance || (esBase && tiene) || esAbogado}
                onChange={(e) => alternar(p.clave, e.target.checked)}
              />
              <span style={{ fontWeight: tiene ? 700 : 500, color: tiene ? "#5000BA" : "#475569" }}>
                {p.nombre}
              </span>
              <span className="perfil-nivel" style={{ fontSize: "0.68rem", color: "#94A3B8" }}>{p.nivel}</span>
            </label>
          );
        })}
      </div>
      {mensaje && <p className="error-auth mensaje-fila" style={{ color: "#DC2626", fontSize: "0.75rem", margin: "4px 0 0 0" }}>{mensaje}</p>}
    </div>
  );
}

function CeldaAccionUsuario({ usuario, puedeEliminar = false }: { usuario: UsuarioConMembresia; puedeEliminar?: boolean }) {
  const [eliminando, setEliminando] = useState(false);
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

  if (!puedeEliminar) {
    return <span style={{ fontSize: "0.74rem", color: "#94A3B8", fontWeight: 600 }}>Solo Lectura</span>;
  }

  async function handleEliminar() {
    setModalPush({
      abierto: true,
      tipo: "advertencia",
      titulo: "Eliminar Cuenta de Usuario",
      mensaje: `¿Estás seguro de ELIMINAR la cuenta de "${usuario.usu_correo}"?\n\nSe borrarán todas sus solicitudes, perfiles y datos.`,
      mostrarConfirmacion: true,
      alAceptar: async () => {
        setModalPush((prev) => ({ ...prev, abierto: false }));
        setEliminando(true);
        const res = await eliminarUsuarioSuperAdminAction(usuario.usu_id);
        if (res.ok) {
          setModalPush({
            abierto: true,
            tipo: "exito",
            titulo: "Usuario Eliminado",
            mensaje: "El usuario ha sido eliminado exitosamente del sistema.",
            alAceptar: () => window.location.reload(),
          });
        } else {
          setModalPush({
            abierto: true,
            tipo: "error",
            titulo: "Error al Eliminar",
            mensaje: res.error || "No se pudo eliminar el usuario",
          });
          setEliminando(false);
        }
      },
      alCancelar: () => {
        setModalPush((prev) => ({ ...prev, abierto: false }));
      },
    });
  }

  if (usuario.usu_correo === "kleber.toapanta.ch@gmail.com") {
    return <span style={{ fontSize: "0.72rem", color: "#9CA3AF", fontWeight: 700 }}>Protegido</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleEliminar}
        disabled={eliminando}
        className="btn-responsive-accion"
        title={`Eliminar usuario ${usuario.usu_correo}`}
        aria-label={`Eliminar usuario ${usuario.usu_correo}`}
        style={{
          background: "#FEF2F2",
          border: "1px solid #FCA5A5",
          color: "#DC2626",
          borderRadius: "8px",
          padding: "6px 10px",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px"
        }}
      >
        <Trash2 size={14} />
        <span className="btn-texto-responsive">{eliminando ? "..." : "Eliminar"}</span>
      </button>

      <ModalNotificacionPush
        abierto={modalPush.abierto}
        tipo={modalPush.tipo}
        titulo={modalPush.titulo}
        mensaje={modalPush.mensaje}
        mostrarConfirmacion={modalPush.mostrarConfirmacion}
        alAceptar={modalPush.alAceptar || (() => setModalPush((prev) => ({ ...prev, abierto: false })))}
        alCancelar={modalPush.alCancelar || (() => setModalPush((prev) => ({ ...prev, abierto: false })))}
      />
    </>
  );
}

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
  const [copiadoConsulta, setCopiadoConsulta] = useState(false);
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

  // 1. Cargar parámetros iniciales desde la URL (Deep Linking & Compartir)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab");
      const urlQ = params.get("q") || params.get("busqueda");
      const urlRol = params.get("rol");
      const urlPerfil = params.get("perfil");

      if (urlTab === "usuarios" || urlTab === "matriz") {
        setTabActiva(urlTab);
      }
      if (urlQ) {
        setFiltroTexto(urlQ);
      }
      if (urlRol) {
        setFiltroRol(urlRol);
      }
      if (urlPerfil) {
        setPerfilSeleccionado(urlPerfil);
      }
    }
  }, []);

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

  // Compartir parámetros de consulta mediante URL
  const handleCompartirConsulta = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (tabActiva) url.searchParams.set("tab", tabActiva);
    if (filtroTexto.trim()) {
      url.searchParams.set("q", filtroTexto.trim());
    } else {
      url.searchParams.delete("q");
      url.searchParams.delete("busqueda");
    }
    if (filtroRol && filtroRol !== "TODOS") {
      url.searchParams.set("rol", filtroRol);
    } else {
      url.searchParams.delete("rol");
    }
    if (perfilSeleccionado && tabActiva === "matriz") {
      url.searchParams.set("perfil", perfilSeleccionado);
    } else {
      url.searchParams.delete("perfil");
    }

    // Actualizar historial del navegador sin recargar
    window.history.replaceState({}, "", url.toString());

    // Copiar al portapapeles
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopiadoConsulta(true);
        setTimeout(() => setCopiadoConsulta(false), 2500);
      }).catch(() => {
        prompt("Copia este enlace para compartir la consulta:", url.toString());
      });
    } else {
      prompt("Copia este enlace para compartir la consulta:", url.toString());
    }
  };

  async function handleResetearSistema() {
    setModalPush({
      abierto: true,
      tipo: "advertencia",
      titulo: `Reset del Sistema (${negocio.toUpperCase()})`,
      mensaje: `Esta acción purgará únicamente los usuarios de prueba, sus datos operativos y los perfiles asignados en ${negocio.toUpperCase()} (conservando la cuenta SuperAdmin y todas las configuraciones del negocio, SMTP, términos, catálogos comerciales y perfiles maestros, sin afectar a otros negocios). ¿Deseas continuar?`,
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
              titulo: "Reset Completado",
              mensaje: `Se han purgado los usuarios de prueba y sus datos operativos en "${negocio.toUpperCase()}". Todas las configuraciones han sido preservadas.`,
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

  const columnasUsuarios: ColumnaDataGrid<UsuarioConMembresia>[] = [
    {
      id: "nombre",
      encabezado: "Nombre Completo",
      valor: (u) => [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || "—",
      ordenable: true,
    },
    {
      id: "correo",
      encabezado: "Correo Electrónico",
      valor: (u) => u.usu_correo || "—",
      ordenable: true,
    },
    {
      id: "estado",
      encabezado: "Estado",
      valor: (u) => u.mem_estado || "ACTIVO",
      ordenable: true,
      render: (u) => (
        <span style={{
          background: u.mem_estado === "ACTIVO" ? "#ECFDF5" : "#FEF3C7",
          color: u.mem_estado === "ACTIVO" ? "#047857" : "#B45309",
          border: `1px solid ${u.mem_estado === "ACTIVO" ? "#A7F3D0" : "#FDE68A"}`,
          borderRadius: "999px",
          padding: "2px 10px",
          fontSize: "0.75rem",
          fontWeight: 700
        }}>
          {u.mem_estado || "ACTIVO"}
        </span>
      )
    },
    {
      id: "perfiles",
      encabezado: "Perfiles (Asignación de Roles)",
      valor: (u) => u.perfiles.join(", ") || "Cliente",
      ordenable: false,
      render: (u) => (
        <CeldaPerfilesInteractiva
          usuario={u}
          negocio={negocio}
          perfiles={perfiles}
          nivelMaximoGestor={nivelMaximoGestor}
          onActualizarPerfiles={(usuarioId, nuevosPerfiles) => {
            setUsuarios((prev) =>
              prev.map((item) => (item.usu_id === usuarioId ? { ...item, perfiles: nuevosPerfiles } : item))
            );
          }}
        />
      )
    },
    {
      id: "accion",
      encabezado: "Acción",
      valor: (u) => nivelMaximoGestor < 80 ? "Solo Lectura" : u.usu_correo === "kleber.toapanta.ch@gmail.com" ? "Protegido" : "Eliminar",
      ordenable: false,
      render: (u) => (
        <CeldaAccionUsuario usuario={u} puedeEliminar={nivelMaximoGestor >= 80} />
      )
    }
  ];

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
          {/* Botón Compartir Parámetros de Consulta (URL) */}
          <button
            type="button"
            onClick={handleCompartirConsulta}
            className="btn-responsive-accion"
            style={{
              background: copiadoConsulta ? "#ECFDF5" : "#F8FAFC",
              border: copiadoConsulta ? "1px solid #10B981" : "1px solid #CBD5E1",
              color: copiadoConsulta ? "#047857" : "#334155",
              padding: "7px 14px",
              borderRadius: "20px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
            }}
            title="Copiar enlace con los parámetros actuales de consulta"
            aria-label="Compartir parámetros de consulta"
          >
            {copiadoConsulta ? <CheckCircle2 size={14} color="#10B981" /> : <Share2 size={14} />}
            <span className="btn-texto-responsive">{copiadoConsulta ? "¡Copiado!" : "Compartir"}</span>
          </button>

          <button
            type="button"
            onClick={() => cargarDirectorio(filtroTexto)}
            className="btn-responsive-accion"
            style={{
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              color: "#334155",
              padding: "7px 14px",
              borderRadius: "20px",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Actualizar directorio"
            aria-label="Actualizar directorio"
          >
            <RefreshCw size={14} />
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
          <button
            type="button"
            onClick={handleResetearSistema}
            disabled={procesandoAccion !== null}
            className="btn-responsive-accion"
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#DC2626",
              background: "#FEF2F2",
              padding: "7px 14px",
              borderRadius: "20px",
              border: "1px solid #FCA5A5",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(220,38,38,0.1)",
            }}
            title="Resetear usuarios de prueba y datos operativos (Solo SuperAdmin)"
            aria-label="Resetear usuarios de prueba y datos operativos"
          >
            <RotateCcw size={14} />
            <span className="btn-texto-responsive">Reset Pruebas</span>
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

      {/* TAB 1: DIRECTORIO INTERACTIVO DE USUARIOS CON DATAGRID ESTANDARIZADO */}
      {tabActiva === "usuarios" && (
        <div>
          {cargando ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
              Cargando directorio de usuarios y perfiles...
            </div>
          ) : (
            <DataGrid
              columnas={columnasUsuarios}
              filas={usuarios}
              idFila={(u) => u.usu_id}
              nombreExportacion={`usuarios-${negocio.toLowerCase()}`}
            />
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
