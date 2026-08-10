"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search, X, UserCog, UserCheck, Settings, Mail, Bell, Shield, ShieldCheck,
  CircleUser, ChevronRight, Sliders, Briefcase
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCustomWidgets } from "./gestorTitulosWidgets";

export interface ModuloInfoDef {
  clave: string;
  nombre: string;
  detalle: string;
  ruta: string;
  categoria: string;
  minNivel: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icono: any;
  colorIcono?: string;
}

const CATALOGO_MODULOS: ModuloInfoDef[] = [
  {
    clave: "mi_cuenta",
    nombre: "Datos Personales & Perfil",
    detalle: "Edición de perfil, correo, WhatsApp y avatar de usuario",
    ruta: "/panel/cuenta",
    categoria: "Identidad",
    minNivel: 1,
    icono: CircleUser,
    colorIcono: "var(--violeta, #5000BA)"
  },
  {
    clave: "ver_como",
    nombre: "Selector 'Ver Como' (Conmutador de Rol)",
    detalle: "Alterna la perspectiva activa entre Cliente, Socio y Administrador",
    ruta: "/panel/cuenta",
    categoria: "Identidad",
    minNivel: 1,
    icono: Sliders,
    colorIcono: "var(--violeta, #5000BA)"
  },
  {
    clave: "historial_accesos",
    nombre: "Historial de Accesos & Sesiones",
    detalle: "Bitácora de inicios de sesión, navegadores y direcciones IP",
    ruta: "/panel/cuenta",
    categoria: "Seguridad",
    minNivel: 1,
    icono: ShieldCheck,
    colorIcono: "#111827"
  },
  {
    clave: "notificaciones",
    nombre: "Preferencias de Alertas & Notificaciones",
    detalle: "Canales de recepción Email, Push, WhatsApp y silenciado temporal",
    ruta: "/panel/configuracion",
    categoria: "Comunicación",
    minNivel: 1,
    icono: Bell,
    colorIcono: "#D97706"
  },
  {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios & Membresías",
    detalle: "Administración de miembros, asignación de perfiles y techo jerárquico",
    ruta: "/panel/usuarios",
    categoria: "Administración",
    minNivel: 80,
    icono: UserCog,
    colorIcono: "var(--violeta, #5000BA)"
  },
  {
    clave: "socios",
    nombre: "Aprobación de Socios Abogados",
    detalle: "Validación de matrículas, acreditación y verificación de abogados",
    ruta: "/panel/socios",
    categoria: "Operación Legal",
    minNivel: 50,
    icono: UserCheck,
    colorIcono: "#05876E"
  },
  {
    clave: "solicitud_socio",
    nombre: "Solicitudes de Socios & Postulaciones",
    detalle: "Procesamiento de postulaciones y formularios de nuevos socios",
    ruta: "/panel/solicitud-socio",
    categoria: "Operación Legal",
    minNivel: 50,
    icono: Briefcase,
    colorIcono: "#05876E"
  },
  {
    clave: "panel_administrar",
    nombre: "Administrar (Consola de Gestión Operativa)",
    ruta: "/panel/administrar",
    detalle: "Consola de gestión protegida con MFA para usuarios, socios y notificaciones",
    categoria: "Administración",
    minNivel: 80,
    icono: Shield,
    colorIcono: "#DC2626"
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración del Negocio",
    detalle: "Identidad legal, WhatsApp, redes sociales, marca y locales",
    ruta: "/panel/configuracion",
    categoria: "Configuración",
    minNivel: 80,
    icono: Settings,
    colorIcono: "var(--violeta, #5000BA)"
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo SMTP",
    detalle: "Servidor saliente, credenciales Vault y prueba de correo",
    ruta: "/panel/configuracion",
    categoria: "Infraestructura",
    minNivel: 80,
    icono: Mail,
    colorIcono: "var(--violeta, #5000BA)"
  },
  {
    clave: "perfiles",
    nombre: "Administración de Perfiles & Permisos",
    detalle: "Catálogo de perfiles, jerarquía (1–100) y matriz de gobernanza",
    ruta: "/panel/configuracion",
    categoria: "Gobernanza",
    minNivel: 80,
    icono: Sliders,
    colorIcono: "var(--violeta, #5000BA)"
  },
  {
    clave: "emision_notificaciones",
    nombre: "Emisión de Notificaciones Multicanal",
    detalle: "Despacho masivo multicanal por WYSIWYG HTML / Markdown",
    ruta: "/panel/emision-notificaciones",
    categoria: "Comunicación",
    minNivel: 80,
    icono: Bell,
    colorIcono: "#D97706"
  },
  {
    clave: "auditoria",
    nombre: "Auditoría BDD & Telemetría",
    detalle: "Consulta de registros inmutables PostgreSQL y telemetría de APIs",
    ruta: "/panel/auditoria",
    categoria: "Seguridad & Auditoría",
    minNivel: 80,
    icono: ShieldCheck,
    colorIcono: "#111827"
  }
];

interface Props {
  nivelUsuario: number;
  esSuperadmin?: boolean;
}

export function BuscadorModulosGlobal({ nivelUsuario, esSuperadmin = false }: Props) {
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { getWidgetInfo, obtenerIconoComponente } = useCustomWidgets();

  // Mapear catálogo con títulos e íconos personalizados en tiempo real
  const modulosConCustom = CATALOGO_MODULOS.map(m => {
    const info = getWidgetInfo(m.clave, m.nombre, m.detalle);
    const IconoAdaptado = obtenerIconoComponente(info.iconoKey, m.icono);
    return {
      ...m,
      nombre: info.titulo,
      detalle: info.subtitulo,
      icono: IconoAdaptado
    };
  });

  // Filtrar catálogo estrictamente según permisos de usuario
  const modulosPermitidos = modulosConCustom.filter(m => esSuperadmin || m.minNivel <= nivelUsuario);

  // Filtrar según texto ingresado
  const resultados = consulta.trim()
    ? modulosPermitidos.filter(m =>
        m.nombre.toLowerCase().includes(consulta.toLowerCase()) ||
        m.detalle.toLowerCase().includes(consulta.toLowerCase()) ||
        m.categoria.toLowerCase().includes(consulta.toLowerCase()) ||
        m.clave.toLowerCase().includes(consulta.toLowerCase())
      )
    : [];

  // Atajo de teclado (Ctrl + K / Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setAbierto(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cerrar popover si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Control con teclado (flechas y enter)
  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSeleccionado(prev => (prev + 1) % (resultados.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSeleccionado(prev => (prev - 1 + resultados.length) % (resultados.length || 1));
    } else if (e.key === "Enter" && resultados.length > 0) {
      e.preventDefault();
      const seleccionado = resultados[indiceSeleccionado] || resultados[0];
      if (seleccionado) {
        irAModulo(seleccionado.ruta);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const irAModulo = (ruta: string) => {
    setAbierto(false);
    setConsulta("");
    router.push(ruta);
  };

  return (
    <div ref={contenedorRef} className="busqueda-panel-global" style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#ffffff",
          border: abierto ? "1.5px solid var(--violeta, #5000BA)" : "1px solid var(--panel-linea, #E4E4E4)",
          boxShadow: abierto ? "0 4px 14px rgba(80,0,186,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
          borderRadius: "10px",
          padding: "8px 12px",
          transition: "all 0.2s ease"
        }}
      >
        <Search size={16} style={{ color: "var(--panel-gris, #737373)", marginRight: "8px", flexShrink: 0 }} />

        <input
          ref={inputRef}
          type="text"
          value={consulta}
          onChange={e => {
            setConsulta(e.target.value);
            setAbierto(true);
            setIndiceSeleccionado(0);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={handleKeyDownInput}
          placeholder="Buscar módulos con permiso (ej. Usuarios, Socios, SMTP)..."
          aria-label="Buscar módulos con permisos"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            color: "#111111"
          }}
        />

        {consulta ? (
          <button
            type="button"
            onClick={() => { setConsulta(""); setAbierto(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--panel-gris, #737373)", padding: "2px", display: "flex" }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--panel-gris, #737373)", background: "var(--panel-papel, #F7F6FA)", border: "1px solid var(--panel-linea, #E4E4E4)", borderRadius: "4px", padding: "1px 5px", flexShrink: 0 }}>
            Ctrl K
          </kbd>
        )}
      </div>

      {/* POPOVER DE RESULTADOS FILTRADOS STRICTAMENTE POR PERMISOS */}
      {abierto && consulta.trim().length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid var(--panel-linea, #E4E4E4)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 100,
            overflow: "hidden",
            maxHeight: "360px",
            overflowY: "auto"
          }}
        >
          <div style={{ padding: "8px 12px", background: "var(--panel-papel, #F7F6FA)", borderBottom: "1px solid var(--panel-linea, #E4E4E4)", fontSize: "0.72rem", fontWeight: 800, color: "var(--panel-gris, #737373)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Módulos Autorizados ({resultados.length})
          </div>

          {resultados.length > 0 ? (
            resultados.map((m, idx) => {
              const Icono = m.icono;
              const activo = idx === indiceSeleccionado;

              return (
                <div
                  key={m.clave}
                  onClick={() => irAModulo(m.ruta)}
                  onMouseEnter={() => setIndiceSeleccionado(idx)}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    background: activo ? "var(--panel-linea-suave, #F5F3FF)" : "#ffffff",
                    borderLeft: activo ? "3px solid var(--violeta, #5000BA)" : "3px solid transparent",
                    transition: "all 0.1s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "8px", background: "var(--panel-papel, #F7F6FA)", flexShrink: 0 }}>
                    <Icono size={16} color={m.colorIcono || "var(--violeta, #5000BA)"} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#111111", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{m.nombre}</span>
                      <span style={{ fontSize: "0.64rem", fontWeight: 800, background: "var(--panel-papel, #E5E7EB)", color: "var(--panel-gris, #4B5563)", padding: "1px 6px", borderRadius: "999px" }}>
                        {m.categoria}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--panel-gris, #737373)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.detalle}
                    </div>
                  </div>

                  <ChevronRight size={14} style={{ color: "var(--panel-gris, #737373)" }} />
                </div>
              );
            })
          ) : (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--panel-gris, #737373)", fontSize: "0.82rem" }}>
              No se encontraron módulos autorizados para &quot;{consulta}&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
