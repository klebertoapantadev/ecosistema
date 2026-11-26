"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Edit3,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  eliminarLineaWhatsappOmnicanalAction,
  guardarLineaWhatsappOmnicanalAction,
  listarLineasWhatsappOmnicanalAction,
} from "../acciones-omnicanal";
import {
  COLORES_LINEAS_WHATSAPP,
  type LineaWhatsappConfig,
  type PoliticaPersonalesLinea,
  type RolLineaWhatsapp,
  type VisibilidadConversacion,
} from "../contactos-omnicanal";

export interface GestorLineasWhatsappPanelProps {
  negocio: string;
  compacto?: boolean;
  onLineasActualizadas?: (lineas: LineaWhatsappConfig[]) => void;
}

interface MiembroEquipoSimple {
  usuarioId: string;
  nombre: string;
  correo: string;
  rol: string;
}

interface FormLineaEstado {
  lineaId: string | null;
  codigo: string;
  nombre: string;
  rolLinea: RolLineaWhatsapp;
  numeroE164: string;
  titularUsuarioId: string;
  esPrincipal: boolean;
  habilitado: boolean;
  iaDesconocidosActiva: boolean;
  iaClientesActiva: boolean;
  politicaPersonales: PoliticaPersonalesLinea;
  visibilidadClientes: VisibilidadConversacion;
  colorBadge: string;
  agenteIaId: string;
  ycloudApiKey: string;
  ycloudWebhookSecret: string;
}

function crearFormularioPreset(rol: RolLineaWhatsapp): FormLineaEstado {
  const info = COLORES_LINEAS_WHATSAPP[rol];
  const esVentas = rol === "VENTAS";
  return {
    lineaId: null,
    codigo: rol.toLowerCase(),
    nombre:
      rol === "VENTAS"
        ? "WhatsApp Ventas"
        : rol === "DUENO"
          ? "Celular Dueño"
          : rol === "ADMINISTRADORA"
            ? "Celular Administradora"
            : rol === "OPERADOR"
              ? "Celular Operador"
              : `WhatsApp ${info.etiqueta}`,
    rolLinea: rol,
    numeroE164: "+593",
    titularUsuarioId: "",
    esPrincipal: false,
    habilitado: true,
    // Decisión 3.2: Ventas en Automática por defecto; Dueño/Admin/Operador en Manual para desconocidos
    iaDesconocidosActiva: esVentas,
    iaClientesActiva: true,
    // Decisión 3.1: IGNORAR_TOTAL por defecto (solo se ve en el celular)
    politicaPersonales: "IGNORAR_TOTAL",
    visibilidadClientes: "EQUIPO_VENTAS",
    colorBadge: info.color,
    agenteIaId: "",
    ycloudApiKey: "",
    ycloudWebhookSecret: "",
  };
}

const ETIQUETA_POLITICA_PERSONAL: Record<PoliticaPersonalesLinea, string> = {
  IGNORAR_TOTAL: "Ignorar Total (solo celular)",
  OCULTO_ADMIN: "Oculto a Ventas (solo Admin)",
  SOLO_TITULAR: "Privado (solo titular)",
};

const ETIQUETA_VISIBILIDAD_CLIENTES: Record<VisibilidadConversacion, string> = {
  EQUIPO_VENTAS: "Visible a Ventas y Admin",
  SOLO_ADMIN: "Solo Administradores",
  SOLO_TITULAR: "Solo Titular",
};

export function GestorLineasWhatsappPanel({
  negocio,
  compacto = false,
  onLineasActualizadas,
}: GestorLineasWhatsappPanelProps) {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const cacheKey = `eco_lineas_wa_${negNorm}`;

  const [lineas, setLineas] = useState<LineaWhatsappConfig[]>([]);
  const [equipo, setEquipo] = useState<MiembroEquipoSimple[]>([]);
  const [esAdmin, setEsAdmin] = useState<boolean>(true);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [formAbierto, setFormAbierto] = useState<boolean>(false);
  const [mostrarAvanzado, setMostrarAvanzado] = useState<boolean>(false);
  const [form, setForm] = useState<FormLineaEstado>(() => crearFormularioPreset("DUENO"));

  const cargarLineas = useCallback(async () => {
    setCargando(true);
    const res = await listarLineasWhatsappOmnicanalAction(negNorm);
    setCargando(false);
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setEsAdmin(res.esAdmin);
    setLineas(res.lineas);
    setEquipo(res.equipo);
    onLineasActualizadas?.(res.lineas);
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(res.lineas));
    } catch {
      // Ignorar cuota localStorage
    }
  }, [cacheKey, negNorm, onLineasActualizadas]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLineas(parsed as LineaWhatsappConfig[]);
      }
    } catch {
      // Ignorar
    }
    void cargarLineas();
  }, [cacheKey, cargarLineas]);

  const abrirEdicion = (linea: LineaWhatsappConfig) => {
    setMensaje(null);
    setMostrarAvanzado(false);
    setForm({
      lineaId: linea.id,
      codigo: linea.codigo,
      nombre: linea.nombre,
      rolLinea: linea.rolLinea,
      numeroE164: linea.numeroE164,
      titularUsuarioId: linea.titularUsuarioId || "",
      esPrincipal: linea.esPrincipal,
      habilitado: linea.habilitado,
      iaDesconocidosActiva: linea.iaDesconocidosActiva,
      iaClientesActiva: linea.iaClientesActiva,
      politicaPersonales: linea.politicaPersonales,
      visibilidadClientes: linea.visibilidadClientes,
      colorBadge: linea.colorBadge || COLORES_LINEAS_WHATSAPP[linea.rolLinea]?.color || "#16A34A",
      agenteIaId: linea.agenteIaId || "",
      ycloudApiKey: "",
      ycloudWebhookSecret: "",
    });
    setFormAbierto(true);
  };

  const abrirNuevoPreset = (rol: RolLineaWhatsapp) => {
    setMensaje(null);
    setMostrarAvanzado(false);
    setForm(crearFormularioPreset(rol));
    setFormAbierto(true);
  };

  const handleGuardarLinea = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    setGuardando(true);
    const res = await guardarLineaWhatsappOmnicanalAction({
      negocio: negNorm,
      lineaId: form.lineaId,
      codigo: form.codigo,
      nombre: form.nombre,
      rolLinea: form.rolLinea,
      numeroE164: form.numeroE164,
      titularUsuarioId: form.titularUsuarioId || null,
      esPrincipal: form.esPrincipal,
      habilitado: form.habilitado,
      iaDesconocidosActiva: form.iaDesconocidosActiva,
      iaClientesActiva: form.iaClientesActiva,
      politicaPersonales: form.politicaPersonales,
      visibilidadClientes: form.visibilidadClientes,
      colorBadge: form.colorBadge,
      agenteIaId: form.agenteIaId || null,
      ycloudApiKey: form.ycloudApiKey || null,
      ycloudWebhookSecret: form.ycloudWebhookSecret || null,
    });
    setGuardando(false);

    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }

    setFormAbierto(false);
    setMensaje({
      tipo: "ok",
      texto: `Línea «${form.nombre}» (${res.numeroE164}) guardada correctamente.`,
    });
    await cargarLineas();
  };

  const handleToggleRapido = async (
    linea: LineaWhatsappConfig,
    campo: "iaDesconocidosActiva" | "iaClientesActiva"
  ) => {
    setMensaje(null);
    const nuevoValor = !linea[campo];
    const res = await guardarLineaWhatsappOmnicanalAction({
      negocio: negNorm,
      lineaId: linea.id,
      codigo: linea.codigo,
      nombre: linea.nombre,
      rolLinea: linea.rolLinea,
      numeroE164: linea.numeroE164,
      titularUsuarioId: linea.titularUsuarioId || null,
      esPrincipal: linea.esPrincipal,
      habilitado: linea.habilitado,
      iaDesconocidosActiva:
        campo === "iaDesconocidosActiva" ? nuevoValor : linea.iaDesconocidosActiva,
      iaClientesActiva: campo === "iaClientesActiva" ? nuevoValor : linea.iaClientesActiva,
      politicaPersonales: linea.politicaPersonales,
      visibilidadClientes: linea.visibilidadClientes,
      colorBadge: linea.colorBadge,
      agenteIaId: linea.agenteIaId || null,
    });
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    await cargarLineas();
  };

  const handleEliminar = async (linea: LineaWhatsappConfig) => {
    setMensaje(null);
    setEliminandoId(linea.id);
    const res = await eliminarLineaWhatsappOmnicanalAction(negNorm, linea.id);
    setEliminandoId(null);
    if (!res.ok) {
      setMensaje({ tipo: "error", texto: res.error });
      return;
    }
    setMensaje({ tipo: "ok", texto: `Línea «${linea.nombre}» desactivada.` });
    await cargarLineas();
  };

  return (
    <section
      style={{
        background: "#FFFFFF",
        border: "1px solid #E6E2DA",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    >
      {/* Cabecera */}
      <div
        style={{
          padding: compacto ? "14px 16px" : "18px 20px",
          borderBottom: "1px solid #EFECE6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          background: "#FCFBF9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "10px",
              background: "#EEF4FF",
              border: "1px solid #C7DAFE",
              color: "#1D4ED8",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Smartphone size={19} />
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1F1C19" }}>
              Teléfonos WhatsApp Conectados (Multi-Línea Coexistencia)
            </div>
            <div style={{ fontSize: "0.8rem", color: "#7B746B", marginTop: "2px" }}>
              Conecta Ventas, Dueño, Administradora y Operador. Define por cada celular si responde Automática o Manual y protege contactos personales.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link
            href="/panel/contactos"
            title="Abrir herramienta de extracción, Join/Merge y listas personales"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "9px",
              border: "1px solid #D5CFC4",
              background: "#FFFFFF",
              color: "#2E2A26",
              fontSize: "0.8rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Users size={14} />
            <span>Contactos y Listas</span>
          </Link>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => void cargarLineas()}
            disabled={cargando}
            title="Recargar líneas WhatsApp"
            aria-label="Recargar líneas"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 11px",
              borderRadius: "9px",
              border: "1px solid #D5CFC4",
              background: "#F8F7F4",
              color: "#3A3530",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            <span className="btn-texto-responsive">Actualizar</span>
          </button>

          {esAdmin && (
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => abrirNuevoPreset("DUENO")}
              title="Registrar nuevo teléfono WhatsApp"
              aria-label="Nuevo Teléfono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 13px",
                borderRadius: "9px",
                border: "1px solid #1F1C19",
                background: "#1F1C19",
                color: "#FFFFFF",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              <span className="btn-texto-responsive">Agregar Celular</span>
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div
        style={{
          padding: compacto ? "14px 16px" : "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Presets rápidos de 1 clic */}
        {esAdmin && !formAbierto && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#F8F7F4",
              border: "1px solid #EAE6DE",
            }}
          >
            <span style={{ fontSize: "0.77rem", fontWeight: 600, color: "#57524C" }}>
              Plantillas rápidas:
            </span>
            {(["VENTAS", "DUENO", "ADMINISTRADORA", "OPERADOR"] as RolLineaWhatsapp[]).map((rol) => {
              const info = COLORES_LINEAS_WHATSAPP[rol];
              return (
                <button
                  key={rol}
                  type="button"
                  onClick={() => abrirNuevoPreset(rol)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    border: `1px solid ${info.color}44`,
                    background: "#FFFFFF",
                    color: info.color,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span>{info.icono}</span>
                  <span>+ {info.etiqueta}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Aviso informativo de coexistencia */}
        <div
          style={{
            padding: "10px 13px",
            borderRadius: "10px",
            background: "#F2F6F3",
            border: "1px solid #CEDDD3",
            fontSize: "0.78rem",
            color: "#22422E",
            lineHeight: 1.5,
          }}
        >
          <strong>Cómo funcionan varios celulares sin perder WhatsApp:</strong> enlaza cada teléfono en tu cuenta de{" "}
          <strong>YCloud → WhatsApp Coexistence</strong> usando la app oficial <strong>WhatsApp Business</strong> y la{" "}
          <strong>misma URL de Webhook</strong>. Los contactos en la lista <code>PERSONAL</code> con modo{" "}
          <strong>Ignorar Total</strong> nunca se guardan en la app (quedan 100% privados en el celular) y jamás reciben mensajes de IA.
        </div>

        {mensaje && (
          <div
            style={{
              padding: "10px 13px",
              borderRadius: "9px",
              border: mensaje.tipo === "ok" ? "1px solid #BBF7D0" : "1px solid #FECACA",
              background: mensaje.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
              color: mensaje.tipo === "ok" ? "#166534" : "#991B1B",
              fontSize: "0.82rem",
              fontWeight: 600,
            }}
          >
            {mensaje.texto}
          </div>
        )}

        {/* Formulario crear/editar línea */}
        {formAbierto && esAdmin && (
          <form
            onSubmit={handleGuardarLinea}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #D5CFC4",
              background: "#FCFBF9",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "0.9rem", color: "#1F1C19" }}>
                {form.lineaId ? `Editar línea · ${form.nombre}` : "Registrar teléfono WhatsApp"}
              </strong>
              <button
                type="button"
                onClick={() => setFormAbierto(false)}
                aria-label="Cerrar formulario"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6E6861",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "12px",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Nombre visible del teléfono
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej. Celular Dueño"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.85rem",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Número WhatsApp (E.164)
                <input
                  required
                  value={form.numeroE164}
                  onChange={(e) => setForm((f) => ({ ...f, numeroE164: e.target.value }))}
                  placeholder="+593999727844"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.85rem",
                    fontFamily: "monospace",
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Rol operativo de la línea
                <select
                  value={form.rolLinea}
                  onChange={(e) => {
                    const rol = e.target.value as RolLineaWhatsapp;
                    setForm((f) => ({
                      ...f,
                      rolLinea: rol,
                      colorBadge: COLORES_LINEAS_WHATSAPP[rol]?.color || f.colorBadge,
                    }));
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="VENTAS">🛍️ Ventas</option>
                  <option value="DUENO">👔 Dueño</option>
                  <option value="ADMINISTRADORA">🛡️ Administradora</option>
                  <option value="OPERADOR">⚙️ Operador</option>
                  <option value="SOPORTE">🎧 Soporte</option>
                  <option value="OTRO">📱 Otro</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Titular de este celular (usuario)
                <select
                  value={form.titularUsuarioId}
                  onChange={(e) => setForm((f) => ({ ...f, titularUsuarioId: e.target.value }))}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="">Sin titular asignado</option>
                  {equipo.map((m) => (
                    <option key={m.usuarioId} value={m.usuarioId}>
                      {m.nombre} ({m.rol})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Reglas de IA por teléfono (Decisión 3.2) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "10px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "9px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: form.iaDesconocidosActiva ? "1px solid #BBF7D0" : "1px solid #E5D7BC",
                  background: form.iaDesconocidosActiva ? "#F0FDF4" : "#FAF6EE",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.iaDesconocidosActiva}
                  onChange={(e) => setForm((f) => ({ ...f, iaDesconocidosActiva: e.target.checked }))}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1F1C19" }}>
                    Desconocidos: {form.iaDesconocidosActiva ? "Automática (IA)" : "Manual por defecto"}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#6E6861", marginTop: "2px" }}>
                    Activado = ARIA responde a números desconocidos. Desactivado = entra en Manual (ideal para celular personal del Dueño).
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "9px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: form.iaClientesActiva ? "1px solid #BBF7D0" : "1px solid #E5D7BC",
                  background: form.iaClientesActiva ? "#F0FDF4" : "#FAF6EE",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.iaClientesActiva}
                  onChange={(e) => setForm((f) => ({ ...f, iaClientesActiva: e.target.checked }))}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1F1C19" }}>
                    Clientes conocidos: {form.iaClientesActiva ? "Automática (IA)" : "Manual por defecto"}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#6E6861", marginTop: "2px" }}>
                    Aplica a contactos clasificados como CLIENTE (siempre puedes alternar Manual/Auto en cada chat individual).
                  </div>
                </div>
              </label>
            </div>

            {/* Privacidad y visibilidad (Decisión 3.1) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Contactos en lista PERSONAL
                <select
                  value={form.politicaPersonales}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      politicaPersonales: e.target.value as PoliticaPersonalesLinea,
                    }))
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.84rem",
                  }}
                >
                  <option value="IGNORAR_TOTAL">🔒 Ignorar Total (solo se ve en el celular)</option>
                  <option value="OCULTO_ADMIN">🛡️ Manual · Oculto a Ventas (solo Admin)</option>
                  <option value="SOLO_TITULAR">👤 Manual · Solo visible para el Titular</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem", fontWeight: 600, color: "#3A3530" }}>
                Visibilidad de clientes que escriben a este celular
                <select
                  value={form.visibilidadClientes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      visibilidadClientes: e.target.value as VisibilidadConversacion,
                    }))
                  }
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                    fontSize: "0.84rem",
                  }}
                >
                  <option value="EQUIPO_VENTAS">💬 Visible para Ventas y Admin</option>
                  <option value="SOLO_ADMIN">🛡️ Solo Administradores (oculto a Ventas)</option>
                  <option value="SOLO_TITULAR">👤 Solo Titular de la línea</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "0.8rem", fontWeight: 600, color: "#3A3530", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.habilitado}
                  onChange={(e) => setForm((f) => ({ ...f, habilitado: e.target.checked }))}
                />
                Línea activa
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "0.8rem", fontWeight: 600, color: "#3A3530", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.esPrincipal}
                  onChange={(e) => setForm((f) => ({ ...f, esPrincipal: e.target.checked }))}
                />
                Línea principal del negocio
              </label>
              <button
                type="button"
                onClick={() => setMostrarAvanzado((v) => !v)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1D4ED8",
                  fontSize: "0.77rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {mostrarAvanzado ? "Ocultar credenciales propias" : "+ API Key / Agente propio (opcional)"}
              </button>
            </div>

            {mostrarAvanzado && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "9px",
                  background: "#FFFFFF",
                  border: "1px solid #E6E2DA",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#57524C" }}>
                  Código interno de ruta
                  <input
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                    placeholder="dueno"
                    style={{ padding: "7px 9px", borderRadius: "7px", border: "1px solid #D5CFC4", fontFamily: "monospace", fontSize: "0.82rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#57524C" }}>
                  Agente ARIA específico (vacío = hereda)
                  <input
                    value={form.agenteIaId}
                    onChange={(e) => setForm((f) => ({ ...f, agenteIaId: e.target.value }))}
                    placeholder="UUID opcional"
                    style={{ padding: "7px 9px", borderRadius: "7px", border: "1px solid #D5CFC4", fontFamily: "monospace", fontSize: "0.82rem" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem", fontWeight: 600, color: "#57524C" }}>
                  YCloud API Key propia (vacío = comparte cuenta)
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.ycloudApiKey}
                    onChange={(e) => setForm((f) => ({ ...f, ycloudApiKey: e.target.value }))}
                    placeholder="Hereda API Key principal si queda vacío"
                    style={{ padding: "7px 9px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.82rem" }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setFormAbierto(false)}
                style={{
                  padding: "7px 13px",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#3A3530",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: "1px solid #2F4737",
                  background: "#2F4737",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: guardando ? 0.65 : 1,
                }}
              >
                <Save size={14} />
                <span>{guardando ? "Guardando…" : "Guardar Línea"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Listado de líneas registradas */}
        {cargando && lineas.length === 0 ? (
          <div style={{ fontSize: "0.82rem", color: "#847D74", padding: "12px 0" }}>
            Cargando teléfonos WhatsApp configurados…
          </div>
        ) : lineas.length === 0 ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "10px",
              border: "1px dashed #D5CFC4",
              background: "#FAF9F6",
              fontSize: "0.82rem",
              color: "#6E6861",
            }}
          >
            Aún no hay líneas WhatsApp registradas en la tabla multi-línea. Pulsa <strong>Agregar Celular</strong> para dar de alta Ventas, Dueño, Administradora u Operador.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
              gap: "12px",
            }}
          >
            {lineas.map((linea) => {
              const info = COLORES_LINEAS_WHATSAPP[linea.rolLinea] || COLORES_LINEAS_WHATSAPP.OTRO;
              const badgeColor = linea.colorBadge || info.color;
              return (
                <div
                  key={linea.id}
                  style={{
                    border: "1px solid #E6E2DA",
                    borderRadius: "12px",
                    padding: "13px 14px",
                    background: linea.habilitado ? "#FFFFFF" : "#F8F7F4",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    opacity: linea.habilitado ? 1 : 0.72,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            background: `${badgeColor}18`,
                            color: badgeColor,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                          }}
                        >
                          {info.icono} {info.etiqueta}
                        </span>
                        {linea.esPrincipal && (
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: "999px",
                              background: "#DCFCE7",
                              color: "#166534",
                              fontSize: "0.69rem",
                              fontWeight: 700,
                            }}
                          >
                            Principal
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#1F1C19", marginTop: "5px" }}>
                        {linea.nombre}
                      </div>
                      <div style={{ fontSize: "0.79rem", fontFamily: "monospace", color: "#57524C" }}>
                        {linea.numeroE164}
                      </div>
                      {linea.titularNombre && (
                        <div style={{ fontSize: "0.74rem", color: "#7B746B", marginTop: "2px" }}>
                          Titular: <strong>{linea.titularNombre}</strong>
                        </div>
                      )}
                    </div>

                    {esAdmin && (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => abrirEdicion(linea)}
                          title="Editar teléfono"
                          aria-label="Editar teléfono"
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "7px",
                            border: "1px solid #E6E2DA",
                            background: "#FFFFFF",
                            color: "#3A3530",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        {!linea.esPrincipal && (
                          <button
                            type="button"
                            onClick={() => void handleEliminar(linea)}
                            disabled={eliminandoId === linea.id}
                            title="Desactivar línea"
                            aria-label="Desactivar línea"
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "7px",
                              border: "1px solid #FECACA",
                              background: "#FEF2F2",
                              color: "#B91C1C",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Controles rápidos de modo por teléfono (Decisión 3.2) */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", fontSize: "0.77rem" }}>
                      <span style={{ color: "#57524C", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Bot size={13} /> Desconocidos:
                      </span>
                      <button
                        type="button"
                        disabled={!esAdmin}
                        onClick={() => void handleToggleRapido(linea, "iaDesconocidosActiva")}
                        title="Alternar modo Automático o Manual para números desconocidos en este teléfono"
                        style={{
                          padding: "3px 9px",
                          borderRadius: "999px",
                          border: linea.iaDesconocidosActiva
                            ? "1px solid #86EFAC"
                            : "1px solid #E5D7BC",
                          background: linea.iaDesconocidosActiva ? "#DCFCE7" : "#FAF6EE",
                          color: linea.iaDesconocidosActiva ? "#166534" : "#745622",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: esAdmin ? "pointer" : "default",
                        }}
                      >
                        {linea.iaDesconocidosActiva ? "⚡ Automática (IA)" : "✋ Manual"}
                      </button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", fontSize: "0.77rem" }}>
                      <span style={{ color: "#57524C", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <CheckCircle2 size={13} /> Clientes conocidos:
                      </span>
                      <button
                        type="button"
                        disabled={!esAdmin}
                        onClick={() => void handleToggleRapido(linea, "iaClientesActiva")}
                        title="Alternar modo Automático o Manual para contactos clasificados como Cliente"
                        style={{
                          padding: "3px 9px",
                          borderRadius: "999px",
                          border: linea.iaClientesActiva
                            ? "1px solid #86EFAC"
                            : "1px solid #E5D7BC",
                          background: linea.iaClientesActiva ? "#DCFCE7" : "#FAF6EE",
                          color: linea.iaClientesActiva ? "#166534" : "#745622",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: esAdmin ? "pointer" : "default",
                        }}
                      >
                        {linea.iaClientesActiva ? "⚡ Automática (IA)" : "✋ Manual"}
                      </button>
                    </div>
                  </div>

                  {/* Resumen de privacidad y contactos */}
                  <div
                    style={{
                      paddingTop: "8px",
                      borderTop: "1px solid #F1EFEA",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      fontSize: "0.74rem",
                      color: "#6E6861",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <EyeOff size={12} />
                      <span>
                        Personales: <strong>{ETIQUETA_POLITICA_PERSONAL[linea.politicaPersonales]}</strong>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Shield size={12} />
                      <span>
                        Clientes: <strong>{ETIQUETA_VISIBILIDAD_CLIENTES[linea.visibilidadClientes]}</strong>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                      <span>
                        Contactos aportados: <strong>{linea.totalContactosAportados ?? 0}</strong> ({linea.totalPersonalesAportados ?? 0} personales)
                      </span>
                      {linea.tieneApiKeyPropia && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#166534", fontWeight: 600 }}>
                          <KeyRound size={11} /> Key propia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
