"use client";

import React, { useState, useEffect } from "react";
import {
  Bell, Search, Filter, RefreshCw, Eye, CheckCircle2, Clock, Trash2,
  User, Check, RotateCcw, X, ShieldAlert
} from "lucide-react";

export interface NotificacionUsuarioAdminItem {
  not_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_correo: string;
  not_negocio: string;
  not_canal: string;
  not_titulo: string;
  not_contenido_html: string;
  not_url_accion?: string | null;
  not_leido_en?: string | null;
  not_pospuesta_hasta?: string | null;
  not_pospuesta_horas?: number | null;
  not_eliminada: boolean;
  not_eliminada_en?: string | null;
  not_creado_en: string;
  not_detalles?: Record<string, unknown>;
  confirmada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
  pospuesta_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string; horas?: number } | null;
  eliminada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
  restaurada_por?: { usuario_id: string; usuario_nombre: string; usuario_correo: string; fecha: string } | null;
}

interface UsuarioOpcion {
  id: string;
  nombre: string;
  correo: string;
}

interface Props {
  negocio?: string;
}

export function MonitoreoNotificacionesUsuariosWidget({ negocio = "TRANQ" }: Props) {
  const [notificaciones, setNotificaciones] = useState<NotificacionUsuarioAdminItem[]>([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<UsuarioOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("TODOS");
  const [filtroEstado, setFiltroEstado] = useState<"TODOS" | "PENDIENTE" | "LEIDA" | "POSPUESTA" | "ELIMINADA">("TODOS");
  const [filtroCanal, setFiltroCanal] = useState("TODOS");
  const [notifSeleccionada, setNotifSeleccionada] = useState<NotificacionUsuarioAdminItem | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState<string | null>(null);

  const cargarDatos = () => {
    setCargando(true);
    const url = filtroUsuario !== "TODOS"
      ? `/api/notificaciones/admin/usuarios?usuario_id=${filtroUsuario}&negocio=${negocio}`
      : `/api/notificaciones/admin/usuarios?negocio=${negocio}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notificaciones)) {
          setNotificaciones(data.notificaciones);
          if (Array.isArray(data.usuariosDisponibles)) {
            setUsuariosDisponibles(data.usuariosDisponibles);
          }
        }
      })
      .catch(err => console.error("Error al cargar notificaciones de usuarios:", err))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarDatos();
  }, [filtroUsuario, negocio]);

  const ahora = Date.now();

  const handleRestaurar = async (notId: string) => {
    try {
      setProcesandoAccion(notId);
      const res = await fetch("/api/notificaciones/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not_id: notId, accion: "restaurar" })
      });
      const data = await res.json();
      if (data.success) {
        setNotificaciones(prev =>
          prev.map(n => (n.not_id === notId ? { ...n, not_eliminada: false, not_eliminada_en: null } : n))
        );
        if (notifSeleccionada?.not_id === notId) {
          setNotifSeleccionada(prev => prev ? { ...prev, not_eliminada: false, not_eliminada_en: null } : null);
        }
      }
    } catch (err) {
      console.error("Error al restaurar notificación:", err);
    } finally {
      setProcesandoAccion(null);
    }
  };

  const handleMarcarLeida = async (notId: string) => {
    try {
      setProcesandoAccion(notId);
      const res = await fetch("/api/notificaciones/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ not_id: notId, accion: "marcar_leida" })
      });
      const data = await res.json();
      if (data.success) {
        const ahoraIso = new Date().toISOString();
        setNotificaciones(prev =>
          prev.map(n => (n.not_id === notId ? { ...n, not_leido_en: ahoraIso } : n))
        );
        if (notifSeleccionada?.not_id === notId) {
          setNotifSeleccionada(prev => prev ? { ...prev, not_leido_en: ahoraIso } : null);
        }
      }
    } catch (err) {
      console.error("Error al marcar como leída:", err);
    } finally {
      setProcesandoAccion(null);
    }
  };

  // Filtrado reactivo en memoria
  const notificacionesFiltradas = notificaciones.filter(n => {
    // 1. Búsqueda de texto
    const q = busqueda.toLowerCase().trim();
    if (q) {
      const coincide =
        n.not_titulo.toLowerCase().includes(q) ||
        n.usuario_nombre.toLowerCase().includes(q) ||
        n.usuario_correo.toLowerCase().includes(q) ||
        n.not_contenido_html.toLowerCase().includes(q);
      if (!coincide) return false;
    }

    // 2. Filtro Canal
    if (filtroCanal !== "TODOS" && n.not_canal !== filtroCanal) {
      return false;
    }

    // 3. Filtro Estado
    const esEliminada = Boolean(n.not_eliminada);
    const pospuestoHasta = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
    const esPospuestaActiva = pospuestoHasta > ahora;
    const esLeida = Boolean(n.not_leido_en);

    if (filtroEstado === "ELIMINADA") return esEliminada;
    if (filtroEstado === "POSPUESTA") return esPospuestaActiva && !esEliminada;
    if (filtroEstado === "LEIDA") return esLeida && !esEliminada;
    if (filtroEstado === "PENDIENTE") return !esLeida && !esEliminada && !esPospuestaActiva;

    return true;
  });

  // Métricas
  const totalNotifs = notificaciones.length;
  const countEliminadas = notificaciones.filter(n => n.not_eliminada).length;
  const countLeidas = notificaciones.filter(n => n.not_leido_en && !n.not_eliminada).length;
  const countPospuestas = notificaciones.filter(n => {
    const posp = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
    return posp > ahora && !n.not_eliminada;
  }).length;
  const countPendientes = notificaciones.filter(n => {
    const posp = n.not_pospuesta_hasta ? new Date(n.not_pospuesta_hasta).getTime() : 0;
    return !n.not_leido_en && !n.not_eliminada && posp <= ahora;
  }).length;

  return (
    <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "24px", width: "100%" }}>
      {/* CABECERA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 900, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: "10px" }}>
            <Bell size={24} color="#1f6feb" /> Monitoreo de Notificaciones por Usuario ({negocio})
          </h2>
          <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "4px 0 0 0" }}>
            Auditoría en tiempo real para Operadores y Administradores. Consulta el estado de confirmación, tiempo de pospuesto y eliminaciones lógicas de cualquier usuario.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDatos}
          style={{
            background: "#f1f5f9",
            border: "1px solid #cbd5e1",
            color: "#334155",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <RefreshCw size={14} className={cargando ? "spin" : ""} /> Actualizar
        </button>
      </div>

      {/* METRICAS RÁPIDAS (KPIs) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <div
          onClick={() => setFiltroEstado("TODOS")}
          style={{
            background: filtroEstado === "TODOS" ? "#f0f9ff" : "#f8fafc",
            border: filtroEstado === "TODOS" ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px 14px",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Total Registros</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", marginTop: "2px" }}>{totalNotifs}</div>
        </div>

        <div
          onClick={() => setFiltroEstado("PENDIENTE")}
          style={{
            background: filtroEstado === "PENDIENTE" ? "#eff6ff" : "#f8fafc",
            border: filtroEstado === "PENDIENTE" ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px 14px",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#2563eb", fontWeight: 800, textTransform: "uppercase" }}>Pendientes</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#1d4ed8", marginTop: "2px" }}>{countPendientes}</div>
        </div>

        <div
          onClick={() => setFiltroEstado("LEIDA")}
          style={{
            background: filtroEstado === "LEIDA" ? "#f0fdf4" : "#f8fafc",
            border: filtroEstado === "LEIDA" ? "1.5px solid #16a34a" : "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px 14px",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#15803d", fontWeight: 800, textTransform: "uppercase" }}>Confirmadas / Leídas</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#15803d", marginTop: "2px" }}>{countLeidas}</div>
        </div>

        <div
          onClick={() => setFiltroEstado("POSPUESTA")}
          style={{
            background: filtroEstado === "POSPUESTA" ? "#fffbeb" : "#f8fafc",
            border: filtroEstado === "POSPUESTA" ? "1.5px solid #d97706" : "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px 14px",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 800, textTransform: "uppercase" }}>Pospuestas</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#b45309", marginTop: "2px" }}>{countPospuestas}</div>
        </div>

        <div
          onClick={() => setFiltroEstado("ELIMINADA")}
          style={{
            background: filtroEstado === "ELIMINADA" ? "#fef2f2" : "#f8fafc",
            border: filtroEstado === "ELIMINADA" ? "1.5px solid #dc2626" : "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px 14px",
            cursor: "pointer"
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "#b91c1c", fontWeight: 800, textTransform: "uppercase" }}>Eliminadas (Lógicas)</span>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#b91c1c", marginTop: "2px" }}>{countEliminadas}</div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px", alignItems: "center" }}>
        {/* Buscador de Texto */}
        <div style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 12px" }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por asunto, destinatario o correo..."
            style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: "0.85rem", color: "#0f172a" }}
          />
        </div>

        {/* Selector de Usuario */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <User size={15} color="#64748b" />
          <select
            value={filtroUsuario}
            onChange={e => setFiltroUsuario(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.84rem", fontWeight: 600, background: "#ffffff", color: "#334155", maxWidth: "220px" }}
          >
            <option value="TODOS">Todos los Usuarios ({usuariosDisponibles.length})</option>
            {usuariosDisponibles.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.correo})
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Estado */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Filter size={15} color="#64748b" />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as "TODOS" | "PENDIENTE" | "LEIDA" | "POSPUESTA" | "ELIMINADA")}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.84rem", fontWeight: 600, background: "#ffffff", color: "#334155" }}
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="LEIDA">Confirmadas (Leídas)</option>
            <option value="POSPUESTA">Pospuestas</option>
            <option value="ELIMINADA">Eliminadas</option>
          </select>
        </div>

        {/* Selector de Canal */}
        <select
          value={filtroCanal}
          onChange={e => setFiltroCanal(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.84rem", fontWeight: 600, background: "#ffffff", color: "#334155" }}
        >
          <option value="TODOS">Todos los Canales</option>
          <option value="IN_APP">In-App</option>
          <option value="PUSH">Push Notification</option>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP_PROPUESTA">WhatsApp</option>
        </select>
      </div>

      {/* TABLA DATAGRID */}
      {cargando ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          Cargando notificaciones auditadas...
        </div>
      ) : notificacionesFiltradas.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
          <Bell style={{ width: 36, height: 36, color: "#94a3b8", margin: "0 auto 8px", display: "block" }} />
          <p style={{ margin: 0, fontWeight: 700, color: "#475569" }}>No se encontraron notificaciones con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="tabla-panel-envoltura" style={{ overflowX: "auto" }}>
          <table className="tabla-panel" style={{ width: "100%", fontSize: "0.84rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Destinatario</th>
                <th style={{ padding: "10px 12px" }}>Asunto / Título</th>
                <th style={{ padding: "10px 12px" }}>Canal</th>
                <th style={{ padding: "10px 12px" }}>Confirmación / Lectura</th>
                <th style={{ padding: "10px 12px" }}>Tiempo Pospuesto</th>
                <th style={{ padding: "10px 12px" }}>Estado Eliminación</th>
                <th style={{ padding: "10px 12px" }}>Fecha Emisión</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notificacionesFiltradas.map(item => {
                const pospuestoHasta = item.not_pospuesta_hasta ? new Date(item.not_pospuesta_hasta).getTime() : 0;
                const esPospuestaActiva = pospuestoHasta > ahora;

                return (
                  <tr key={item.not_id} style={{ borderBottom: "1px solid #f1f5f9", background: item.not_eliminada ? "#fffbfb" : undefined }}>
                    {/* Destinatario */}
                    <td style={{ padding: "12px" }}>
                      <strong style={{ display: "block", color: "#0f172a" }}>{item.usuario_nombre}</strong>
                      <span style={{ fontSize: "0.74rem", color: "#64748b" }}>{item.usuario_correo}</span>
                    </td>

                    {/* Asunto */}
                    <td style={{ padding: "12px", maxWidth: "240px" }}>
                      <strong style={{ display: "block", color: "#1e293b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {item.not_titulo}
                      </strong>
                    </td>

                    {/* Canal */}
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          background: item.not_canal === "IN_APP" ? "#dbeafe" : item.not_canal === "PUSH" ? "#e0f2fe" : "#fef3c7",
                          color: item.not_canal === "IN_APP" ? "#1e40af" : item.not_canal === "PUSH" ? "#0369a1" : "#92400e"
                        }}
                      >
                        {item.not_canal}
                      </span>
                    </td>

                    {/* Confirmación / Lectura */}
                    <td style={{ padding: "12px" }}>
                      {item.not_leido_en ? (
                        <div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#15803d", fontWeight: 700, fontSize: "0.76rem" }}>
                            <CheckCircle2 size={13} /> Confirmada
                          </span>
                          <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b" }}>
                            {new Date(item.not_leido_en).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#2563eb", fontWeight: 700, fontSize: "0.74rem" }}>
                          Pendiente
                        </span>
                      )}
                    </td>

                    {/* Tiempo Pospuesto */}
                    <td style={{ padding: "12px" }}>
                      {esPospuestaActiva ? (
                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "3px 6px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#b45309", fontWeight: 800, fontSize: "0.72rem" }}>
                            <Clock size={12} /> {item.not_pospuesta_horas ? `${item.not_pospuesta_horas}h` : "Pospuesta"}
                          </span>
                          <span style={{ display: "block", fontSize: "0.68rem", color: "#92400e" }}>
                            Hasta: {new Date(item.not_pospuesta_hasta!).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                          </span>
                        </div>
                      ) : item.not_pospuesta_hasta ? (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          Expiró pospuesto
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>—</span>
                      )}
                    </td>

                    {/* Estado Eliminación */}
                    <td style={{ padding: "12px" }}>
                      {item.not_eliminada ? (
                        <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "6px", padding: "3px 6px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#b91c1c", fontWeight: 800, fontSize: "0.72rem" }}>
                            <Trash2 size={12} /> Eliminada
                          </span>
                          <span style={{ display: "block", fontSize: "0.68rem", color: "#991b1b" }}>
                            {item.not_eliminada_en ? new Date(item.not_eliminada_en).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" }) : "Lógica"}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.74rem" }}>
                          Activa
                        </span>
                      )}
                    </td>

                    {/* Fecha Creación */}
                    <td style={{ padding: "12px", fontSize: "0.74rem", color: "#64748b" }}>
                      {new Date(item.not_creado_en).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil" })}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: "12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setNotifSeleccionada(item)}
                          style={{
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            color: "#1d4ed8",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "0.74rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px"
                          }}
                          title="Ver detalle completo"
                        >
                          <Eye size={12} /> Ver
                        </button>

                        {item.not_eliminada && (
                          <button
                            type="button"
                            disabled={procesandoAccion === item.not_id}
                            onClick={() => handleRestaurar(item.not_id)}
                            style={{
                              background: "#f0fdf4",
                              border: "1px solid #bbf7d0",
                              color: "#15803d",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontWeight: 700,
                              fontSize: "0.74rem",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px"
                            }}
                            title="Restaurar para el usuario"
                          >
                            <RotateCcw size={12} /> Restaurar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETALLE DE NOTIFICACIÓN DE USUARIO */}
      {notifSeleccionada && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "18px 20px", background: "#0f172a", color: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Bell size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>
                  Detalle Auditado de Notificación
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNotifSeleccionada(null)}
                style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#ffffff", borderRadius: "8px", padding: "6px", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px", overflowY: "auto", flex: 1, fontSize: "0.85rem" }}>
              {/* Info Destinatario */}
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Destinatario</span>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                  {notifSeleccionada.usuario_nombre}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#475569" }}>{notifSeleccionada.usuario_correo}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "2px" }}>ID: {notifSeleccionada.usuario_id}</div>
              </div>

              {/* Título & Contenido */}
              <div style={{ marginBottom: "14px" }}>
                <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Título / Asunto</span>
                <h4 style={{ margin: "4px 0 8px 0", color: "#0f172a", fontSize: "1rem" }}>{notifSeleccionada.not_titulo}</h4>

                <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Cuerpo HTML Despachado</span>
                <div
                  style={{ marginTop: "4px", padding: "14px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: notifSeleccionada.not_contenido_html }}
                />
              </div>

              {/* Matriz de Estados y Auditoría de Acciones */}
              <div className="rejilla-auto" style={{ "--min": "200px", "--hueco": "10px", background: "var(--panel-linea-suave, #F1F1F1)", padding: "12px", borderRadius: "10px" } as React.CSSProperties}>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>Canal:</span>
                  <strong style={{ display: "block", color: "#1e293b", fontSize: "0.82rem" }}>{notifSeleccionada.not_canal}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>Fecha Emisión:</span>
                  <strong style={{ display: "block", color: "#1e293b", fontSize: "0.82rem" }}>
                    {new Date(notifSeleccionada.not_creado_en).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}
                  </strong>
                </div>

                {/* Confirmación / Aceptación */}
                <div style={{ gridColumn: "1 / -1", background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>Confirmación (Leída / Aceptada):</span>
                  <strong style={{ display: "block", color: notifSeleccionada.not_leido_en ? "#15803d" : "#2563eb", fontSize: "0.82rem", marginTop: "2px" }}>
                    {notifSeleccionada.not_leido_en
                      ? `Confirmada el ${new Date(notifSeleccionada.not_leido_en).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}`
                      : "No confirmada / Pendiente"}
                  </strong>
                  {notifSeleccionada.confirmada_por && (
                    <div style={{ fontSize: "0.74rem", color: "#15803d", marginTop: "4px", background: "#f0fdf4", padding: "4px 8px", borderRadius: "6px" }}>
                      Acción realizada por: <strong>{notifSeleccionada.confirmada_por.usuario_nombre}</strong> ({notifSeleccionada.confirmada_por.usuario_correo || notifSeleccionada.confirmada_por.usuario_id})
                    </div>
                  )}
                </div>

                {/* Pospuesta */}
                <div style={{ gridColumn: "1 / -1", background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>Tiempo Pospuesto:</span>
                  <strong style={{ display: "block", color: notifSeleccionada.not_pospuesta_hasta ? "#b45309" : "#64748b", fontSize: "0.82rem", marginTop: "2px" }}>
                    {notifSeleccionada.not_pospuesta_hasta
                      ? `Pospuesta hasta: ${new Date(notifSeleccionada.not_pospuesta_hasta).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}`
                      : "Sin posponer"}
                  </strong>
                  {notifSeleccionada.pospuesta_por && (
                    <div style={{ fontSize: "0.74rem", color: "#b45309", marginTop: "4px", background: "#fffbeb", padding: "4px 8px", borderRadius: "6px" }}>
                      Pospuesta por: <strong>{notifSeleccionada.pospuesta_por.usuario_nombre}</strong> ({notifSeleccionada.pospuesta_por.usuario_correo || notifSeleccionada.pospuesta_por.usuario_id}) • +{notifSeleccionada.pospuesta_por.horas || notifSeleccionada.not_pospuesta_horas || 3} horas
                    </div>
                  )}
                </div>

                {/* Eliminación Lógica & Restauración */}
                <div style={{ gridColumn: "1 / -1", background: "#ffffff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700 }}>Estado de Eliminación:</span>
                  <strong style={{ display: "block", color: notifSeleccionada.not_eliminada ? "#b91c1c" : "#16a34a", fontSize: "0.82rem", marginTop: "2px" }}>
                    {notifSeleccionada.not_eliminada
                      ? `Eliminada (${notifSeleccionada.not_eliminada_en ? new Date(notifSeleccionada.not_eliminada_en).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "Lógica"})`
                      : "Activa en bandeja"}
                  </strong>
                  {notifSeleccionada.eliminada_por && notifSeleccionada.not_eliminada && (
                    <div style={{ fontSize: "0.74rem", color: "#b91c1c", marginTop: "4px", background: "#fef2f2", padding: "4px 8px", borderRadius: "6px" }}>
                      Eliminada por: <strong>{notifSeleccionada.eliminada_por.usuario_nombre}</strong> ({notifSeleccionada.eliminada_por.usuario_correo || notifSeleccionada.eliminada_por.usuario_id})
                    </div>
                  )}
                  {notifSeleccionada.restaurada_por && !notifSeleccionada.not_eliminada && (
                    <div style={{ fontSize: "0.74rem", color: "#15803d", marginTop: "4px", background: "#f0fdf4", padding: "4px 8px", borderRadius: "6px" }}>
                      Restaurada por: <strong>{notifSeleccionada.restaurada_por.usuario_nombre}</strong> ({notifSeleccionada.restaurada_por.usuario_correo || notifSeleccionada.restaurada_por.usuario_id})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {notifSeleccionada.not_eliminada ? (
                  <button
                    type="button"
                    onClick={() => handleRestaurar(notifSeleccionada.not_id)}
                    style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "6px 12px", borderRadius: "6px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <RotateCcw size={13} /> Restaurar para Usuario
                  </button>
                ) : !notifSeleccionada.not_leido_en ? (
                  <button
                    type="button"
                    onClick={() => handleMarcarLeida(notifSeleccionada.not_id)}
                    style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", padding: "6px 12px", borderRadius: "6px", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Check size={13} /> Marcar como Leída
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setNotifSeleccionada(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#0f172a", color: "#ffffff", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer" }}
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
