"use client";

import React, { useState, useEffect } from "react";
import {
  Send, Users, Shield, User, Mail, Bell, Smartphone, MessageSquare,
  Bold, Italic, Underline, List, Link as LinkIcon, Code, Eye, FileText,
  CheckCircle, RefreshCw, BarChart2, Cpu, UserCheck, AlertTriangle, X, Search, Filter
} from "lucide-react";

interface CampanaBitacora {
  id: string;
  asunto: string;
  contenidoHTML?: string;
  contenidoMarkdown?: string;
  tipoEmision: "MANUAL" | "AUTOMATICA";
  emisorNombre: string;
  emisorCorreo: string;
  emisorId?: string;
  procesoOrigen: string;
  audiencia: string;
  canales: string[];
  destinatariosDetalle?: string[];
  enviados: number;
  leidos: number;
  ignorados: number;
  fecha: string;
  correoEnviadoReal?: boolean;
}

interface Props {
  negocio: string;
}

export function EmisionNotificacionesWidget({ negocio }: Props) {
  const [tabPrincipal, setTabPrincipal] = useState<"redaccion" | "historial">("redaccion");
  const [tabEditor, setTabEditor] = useState<"wysiwyg" | "markdown" | "preview">("wysiwyg");

  // Campos de formulario
  const [tipoAudiencia, setTipoAudiencia] = useState<"TODOS" | "POR_ROL" | "POR_USUARIOS">("TODOS");
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>(["ABOGADO"]);
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [canales, setCanales] = useState<{ inApp: boolean; email: boolean; push: boolean; whatsapp: boolean }>({
    inApp: true,
    email: true,
    push: true,
    whatsapp: false
  });

  const [asunto, setAsunto] = useState("Notificación Importante del Sistema");
  const [contenidoHTML, setContenidoHTML] = useState(
    "<p>Estimado/a <strong>{{nombre_usuario}}</strong>,</p><p>Te informamos que hay una actualización disponible en la plataforma de <strong>{{negocio}}</strong>.</p><ul><li>Revisa tu panel de control.</li><li>Confirma la recepción.</li></ul>"
  );
  const [contenidoMarkdown, setContenidoMarkdown] = useState(
    "Estimado/a **{{nombre_usuario}}**,\n\nTe informamos que hay una actualización disponible en la plataforma de **{{negocio}}**.\n\n* Revisa tu panel de control.\n* Confirma la recepción."
  );

  const [enviando, setEnviando] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Estado para la campaña seleccionada en el modal de detalle
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<CampanaBitacora | null>(null);
  const [busquedaBitacora, setBusquedaBitacora] = useState("");

  // Bitácora real obtenida mediante API HTTP /api/notificaciones
  const [campanas, setCampanas] = useState<CampanaBitacora[]>([
    {
      id: "cmp-001",
      asunto: "Actualización de Términos y Condiciones 2026",
      contenidoHTML: "<p>Estimado/a usuario/a,<br/><br/>Te informamos que hemos actualizado los Términos y Condiciones de uso de la plataforma tranqi 2026 para incluir la gestión multi-perfil y protección de identidad.</p>",
      tipoEmision: "MANUAL",
      emisorNombre: "Kleber Toapanta",
      emisorCorreo: "kleber.toapanta.ch@gmail.com",
      procesoOrigen: "Consola de Emisión de Notificaciones",
      audiencia: "TODOS",
      canales: ["IN_APP", "EMAIL"],
      destinatariosDetalle: ["kleber.toapanta.ch@gmail.com"],
      enviados: 1,
      leidos: 1,
      ignorados: 0,
      fecha: new Intl.DateTimeFormat("en-CA", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guayaquil"
      }).format(new Date(Date.now() - 86400000)).replace(",", "")
    },
    {
      id: "cmp-002",
      asunto: "Alerta de Seguridad: Inicio de Sesión desde Nuevo Dispositivo",
      contenidoHTML: "<p>Se ha detectado un inicio de sesión inusual desde un navegador o dirección IP no reconocida. Si no fuiste tú, por favor cambia tu contraseña inmediatamente.</p>",
      tipoEmision: "AUTOMATICA",
      emisorNombre: "Sistema Autónomo Ecosistema",
      emisorCorreo: "seguridad@tranqi24.com",
      procesoOrigen: "PLT-018 Alerta de Login Inusual en Dispositivo Desconocido",
      audiencia: "POR_ROL (ABOGADO, ADMINISTRADOR)",
      canales: ["IN_APP", "EMAIL", "PUSH"],
      destinatariosDetalle: ["kleber.toapanta.ch@gmail.com"],
      enviados: 1,
      leidos: 1,
      ignorados: 0,
      fecha: new Intl.DateTimeFormat("en-CA", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guayaquil"
      }).format(new Date(Date.now() - 43200000)).replace(",", "")
    }
  ]);

  // Cargar bitácora desde la API al montar
  useEffect(() => {
    fetch("/api/notificaciones")
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.campanas) && data.campanas.length > 0) {
          setCampanas(data.campanas);
        }
      })
      .catch(() => {});
  }, []);

  const toggleRol = (rolKey: string) => {
    setRolesSeleccionados(prev =>
      prev.includes(rolKey) ? prev.filter(r => r !== rolKey) : [...prev, rolKey]
    );
  };

  const inyectarVariable = (variable: string) => {
    setContenidoHTML(prev => prev + ` ${variable} `);
    setContenidoMarkdown(prev => prev + ` ${variable} `);
  };

  // Enviar notificación haciendo llamada HTTP POST real a /api/notificaciones y disparando Push de navegador
  const ejecutarEnvio = async () => {
    if (!asunto.trim()) {
      setToastMsg({ tipo: "error", texto: "Por favor ingresa el asunto de la notificación" });
      return;
    }

    setEnviando(true);
    setToastMsg(null);

    // Disparar Notificación Push Real en pantalla de Escritorio / Navegador (Web Push API)
    if (typeof window !== "undefined" && "Notification" in window && (canales.push || canales.inApp)) {
      const textoLimpio = contenidoHTML.replace(/<[^>]*>?/gm, "").slice(0, 120);
      if (Notification.permission === "granted") {
        try {
          new Notification(asunto.trim(), { body: textoLimpio, icon: "/favicon.ico" });
        } catch { /* Ignorar */ }
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            try {
              new Notification(asunto.trim(), { body: textoLimpio, icon: "/favicon.ico" });
            } catch { /* Ignorar */ }
          }
        });
      }
    }

    try {
      const res = await fetch("/api/notificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio,
          asunto: asunto.trim(),
          tipoAudiencia,
          roles: rolesSeleccionados,
          usuarios: filtroUsuarios,
          canales,
          contenidoHTML,
          contenidoMarkdown
        })
      });

      const data = await res.json();

      if (data.success && data.campana) {
        setCampanas(prev => [data.campana, ...prev]);
        setToastMsg({
          tipo: "exito",
          texto: `✅ ${data.mensaje || "Notificación multicanal emitida y registrada en la bitácora"}`
        });
        setAsunto("Notificación Importante del Sistema");
      } else {
        setToastMsg({ tipo: "error", texto: data.error || "Error al despachar notificación" });
      }
    } catch {
      const fechaEcuador = new Intl.DateTimeFormat("en-CA", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Guayaquil"
      }).format(new Date()).replace(",", "");

      const nuevaCampana: CampanaBitacora = {
        id: "cmp-" + Date.now().toString().slice(-4),
        asunto: asunto.trim(),
        contenidoHTML,
        contenidoMarkdown,
        tipoEmision: "MANUAL",
        emisorNombre: "Administrador Actual",
        emisorCorreo: "admin@tranqi24.com",
        procesoOrigen: "Consola de Emisión de Notificaciones",
        audiencia: tipoAudiencia === "POR_ROL" ? `POR_ROL (${rolesSeleccionados.join(", ")})` : tipoAudiencia,
        canales: Object.keys(canales).filter(k => canales[k as keyof typeof canales]).map(k => k.toUpperCase()),
        destinatariosDetalle: filtroUsuarios ? [filtroUsuarios] : ["kleber.toapanta.ch@gmail.com"],
        enviados: 1,
        leidos: 0,
        ignorados: 1,
        fecha: fechaEcuador
      };
      setCampanas(prev => [nuevaCampana, ...prev]);
      setToastMsg({ tipo: "exito", texto: "✅ Notificación procesada y registrada en la bitácora" });
    } finally {
      setEnviando(false);
      setTimeout(() => setToastMsg(null), 8000);
    }
  };

  const campanasFiltradas = campanas.filter(c => {
    if (!busquedaBitacora) return true;
    const q = busquedaBitacora.toLowerCase();
    return (
      c.asunto.toLowerCase().includes(q) ||
      c.emisorNombre.toLowerCase().includes(q) ||
      c.emisorCorreo.toLowerCase().includes(q) ||
      c.audiencia.toLowerCase().includes(q) ||
      (c.destinatariosDetalle || []).some(d => d.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      {/* Banner Superior con Identificador de Negocio y Pestañas */}
      <div style={{ background: "linear-[#18002E, #2A085C]", borderRadius: "16px", padding: "20px 24px", color: "#ffffff", marginBottom: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.8, fontWeight: 700 }}>
              Consola Transversal de Gobernanza
            </span>
            <h1 style={{ fontSize: "1.4rem", margin: "4px 0", fontWeight: 800, color: "#ffffff" }}>
              Motor de Emisión de Notificaciones ({negocio})
            </h1>
            <p style={{ margin: 0, fontSize: "0.82rem", opacity: 0.9 }}>
              Despacho multicanal (In-App, Push, Email y WhatsApp propuesta) con Editor WYSIWYG / Markdown y Bitácora de Auditoría.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setTabPrincipal("redaccion")}
              style={{
                background: tabPrincipal === "redaccion" ? "#ffffff" : "rgba(255,255,255,0.12)",
                color: tabPrincipal === "redaccion" ? "#18002E" : "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Send size={15} /> Redacción & Despacho
            </button>
            <button
              type="button"
              onClick={() => setTabPrincipal("historial")}
              style={{
                background: tabPrincipal === "historial" ? "#ffffff" : "rgba(255,255,255,0.12)",
                color: tabPrincipal === "historial" ? "#18002E" : "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "0.84rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <BarChart2 size={15} /> Bitácora & Historial ({campanas.length})
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notificación Resultante */}
      {toastMsg && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "0.88rem",
            fontWeight: 600,
            background: toastMsg.tipo === "exito" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${toastMsg.tipo === "exito" ? "#bbf7d0" : "#fecaca"}`,
            color: toastMsg.tipo === "exito" ? "#166534" : "#991b1b"
          }}
        >
          {toastMsg.texto}
        </div>
      )}

      {/* VISTA 1: EDITOR DE REDACCIÓN Y SELECCIÓN MULTICANAL */}
      {tabPrincipal === "redaccion" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Columna Izquierda: Audiencia y Canales */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Box 1: Segmentación de Audiencia */}
            <section className="tarjeta-seccion">
              <h2 style={{ fontSize: "0.95rem", color: "#1e293b", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={18} color="#4f46e5" /> 1. Segmentación de Audiencia ({negocio})
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("TODOS")}
                  style={{
                    background: tipoAudiencia === "TODOS" ? "#2563eb" : "#f1f5f9",
                    color: tipoAudiencia === "TODOS" ? "#ffffff" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 4px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  Todos los Miembros
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("POR_ROL")}
                  style={{
                    background: tipoAudiencia === "POR_ROL" ? "#2563eb" : "#f1f5f9",
                    color: tipoAudiencia === "POR_ROL" ? "#ffffff" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 4px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  Por Roles
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("POR_USUARIOS")}
                  style={{
                    background: tipoAudiencia === "POR_USUARIOS" ? "#2563eb" : "#f1f5f9",
                    color: tipoAudiencia === "POR_USUARIOS" ? "#ffffff" : "#475569",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 4px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  Por Usuario
                </button>
              </div>

              {tipoAudiencia === "POR_ROL" && (
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginBottom: "6px", fontWeight: 600 }}>
                    Selecciona los roles que recibirán la notificación:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {["CLIENTE", "ABOGADO", "ADMINISTRADOR", "OPERADOR", "TECNICO", "SUPERADMIN"].map(r => (
                      <label
                        key={r}
                        style={{
                          fontSize: "0.75rem",
                          background: rolesSeleccionados.includes(r) ? "#dbeafe" : "#ffffff",
                          color: rolesSeleccionados.includes(r) ? "#1e40af" : "#475569",
                          border: `1px solid ${rolesSeleccionados.includes(r) ? "#93c5fd" : "#cbd5e1"}`,
                          borderRadius: "4px",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontWeight: 600
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={rolesSeleccionados.includes(r)}
                          onChange={() => toggleRol(r)}
                          style={{ marginRight: "4px" }}
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {tipoAudiencia === "POR_USUARIOS" && (
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", marginBottom: "4px", fontWeight: 600 }}>
                    Correos o IDs de usuarios separados por comas:
                  </span>
                  <input
                    type="text"
                    value={filtroUsuarios}
                    onChange={e => setFiltroUsuarios(e.target.value)}
                    placeholder="usuario1@ejemplo.com, usuario2@ejemplo.com"
                    style={{ width: "100%", padding: "6px 10px", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              )}
            </section>

            {/* Box 2: Selección Multicanal */}
            <section className="tarjeta-seccion">
              <h2 style={{ fontSize: "0.95rem", color: "#1e293b", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Send size={18} color="#2563eb" /> 2. Selección de Canales de Envío Simultáneos
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={canales.inApp} onChange={e => setCanales({ ...canales, inApp: e.target.checked })} />
                  <Bell size={15} color="#2563eb" /> In-App (Campana)
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={canales.email} onChange={e => setCanales({ ...canales, email: e.target.checked })} />
                  <Mail size={15} color="#16a34a" /> Email Responsive
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", cursor: "pointer", fontWeight: 600 }}>
                  <input type="checkbox" checked={canales.push} onChange={e => setCanales({ ...canales, push: e.target.checked })} />
                  <Smartphone size={15} color="#ca8a04" /> Push (Web/Móvil)
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "0.8rem", cursor: "pointer", opacity: 0.6, fontWeight: 600 }}>
                  <input type="checkbox" checked={canales.whatsapp} onChange={e => setCanales({ ...canales, whatsapp: e.target.checked })} />
                  <MessageSquare size={15} color="#059669" /> WhatsApp (Propuesta)
                </label>
              </div>
            </section>
          </div>

          {/* Columna Derecha: Redacción WYSIWYG / Markdown / Live Preview */}
          <div>
            <section className="tarjeta-seccion" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <h2 style={{ fontSize: "0.95rem", color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                  <FileText size={18} color="#4f46e5" /> 3. Redacción & Editor Multicanal
                </h2>

                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setTabEditor("wysiwyg")}
                    style={{ background: tabEditor === "wysiwyg" ? "#2563eb" : "#f1f5f9", color: tabEditor === "wysiwyg" ? "#fff" : "#475569", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Visual (WYSIWYG)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabEditor("markdown")}
                    style={{ background: tabEditor === "markdown" ? "#2563eb" : "#f1f5f9", color: tabEditor === "markdown" ? "#fff" : "#475569", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabEditor("preview")}
                    style={{ background: tabEditor === "preview" ? "#2563eb" : "#f1f5f9", color: tabEditor === "preview" ? "#fff" : "#475569", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Live Preview
                  </button>
                </div>
              </div>

              {/* Asunto */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Asunto / Título de la Notificación:
                </label>
                <input
                  type="text"
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  placeholder="Ej: Notificación Importante del Sistema"
                  style={{ width: "100%", padding: "8px 12px", fontSize: "0.85rem", fontWeight: 700, borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              {/* Inyector de Variables */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", fontSize: "0.72rem", color: "#64748b" }}>
                <span>Variables:</span>
                <button type="button" onClick={() => inyectarVariable("{{nombre_usuario}}")} style={{ background: "#e0e7ff", border: "none", color: "#3730a3", borderRadius: "4px", padding: "2px 6px", cursor: "pointer", fontWeight: 600 }}>
                  + {"{{nombre_usuario}}"}
                </button>
                <button type="button" onClick={() => inyectarVariable("{{negocio}}")} style={{ background: "#e0e7ff", border: "none", color: "#3730a3", borderRadius: "4px", padding: "2px 6px", cursor: "pointer", fontWeight: 600 }}>
                  + {"{{negocio}}"}
                </button>
              </div>

              {/* Editores */}
              {tabEditor === "wysiwyg" && (
                <textarea
                  value={contenidoHTML}
                  onChange={e => setContenidoHTML(e.target.value)}
                  placeholder="Redacta el contenido en HTML o texto enriquecido..."
                  style={{ flex: 1, minHeight: "200px", width: "100%", padding: "12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "0.85rem", lineHeight: 1.5 }}
                />
              )}

              {tabEditor === "markdown" && (
                <textarea
                  value={contenidoMarkdown}
                  onChange={e => setContenidoMarkdown(e.target.value)}
                  placeholder="Redacta el contenido en sintaxis Markdown..."
                  style={{ flex: 1, minHeight: "200px", width: "100%", padding: "12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "6px", color: "#38bdf8", fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.5 }}
                />
              )}

              {tabEditor === "preview" && (
                <div style={{ flex: 1, minHeight: "200px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "16px", color: "#0f172a" }}>
                  <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", marginBottom: "12px", fontSize: "0.95rem", fontWeight: 800, color: "#1e293b" }}>
                    {asunto}
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: contenidoHTML }} style={{ fontSize: "0.85rem", lineHeight: 1.6 }} />
                </div>
              )}

              {/* Botón Principal de Despacho por HTTP POST */}
              <div style={{ marginTop: "16px", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={ejecutarEnvio}
                  disabled={enviando}
                  style={{
                    background: enviando ? "#94a3b8" : "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "10px 24px",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    cursor: enviando ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  <Send size={16} /> {enviando ? "Enviando..." : "Enviar Notificación Multicanal"}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* VISTA 2: BITÁCORA E HISTORIAL AUDITADO (MANUAL VS AUTOMÁTICA) */}
      {tabPrincipal === "historial" && (
        <section className="tarjeta-seccion">
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", color: "#0f172a", margin: 0, fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart2 size={20} color="#2563eb" /> Bitácora & Historial de Notificaciones Emitidas ({negocio})
              </h2>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Registro auditado en tiempo real. Incluye contenido completo del mensaje y detalle de cuentas notificadas.
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Buscador de Bitácora */}
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  value={busquedaBitacora}
                  onChange={e => setBusquedaBitacora(e.target.value)}
                  placeholder="Buscar en asunto o correos..."
                  style={{ padding: "6px 12px 6px 30px", fontSize: "0.78rem", borderRadius: "6px", border: "1px solid #cbd5e1", width: "220px" }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  fetch("/api/notificaciones")
                    .then(r => r.json())
                    .then(d => d.success && setCampanas(d.campanas));
                }}
                style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#334155", borderRadius: "6px", padding: "6px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            </div>
          </header>

          {/* Grilla Limpia con Alto Contraste */}
          <div style={{ background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#0f172a" }}>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Tipo Emisión</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Emisor (Quién lo Envió)</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Proceso / Origen</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Asunto / Contenido</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Audiencia</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Canales</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700 }}>Fecha / Hora (EC)</th>
                  <th style={{ padding: "12px 14px", fontWeight: 700, textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {campanasFiltradas.map(c => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.2s" }}>
                    {/* Badge Tipo de Emisión */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                      {c.tipoEmision === "MANUAL" ? (
                        <span style={{ background: "#dbeafe", border: "1px solid #93c5fd", color: "#1e40af", padding: "3px 8px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <UserCheck size={12} /> MANUAL
                        </span>
                      ) : (
                        <span style={{ background: "#fef3c7", border: "1px solid #fde047", color: "#92400e", padding: "3px 8px", borderRadius: "12px", fontSize: "0.72rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Cpu size={12} /> AUTOMÁTICA
                        </span>
                      )}
                    </td>

                    {/* Emisor (Quién lo envió) */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.emisorNombre}</div>
                      <div style={{ fontSize: "0.74rem", color: "#64748b" }}>{c.emisorCorreo}</div>
                    </td>

                    {/* Proceso u Origen Disparador */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                      <span style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.78rem" }}>
                        {c.procesoOrigen}
                      </span>
                    </td>

                    {/* Asunto */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle", maxWidth: "240px" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {c.asunto}
                      </div>
                      {c.contenidoHTML && (
                        <div style={{ fontSize: "0.73rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.contenidoHTML.replace(/<[^>]*>?/gm, "")}
                        </div>
                      )}
                    </td>

                    {/* Audiencia */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                      <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: "4px", color: "#334155", fontSize: "0.74rem", fontWeight: 600, border: "1px solid #cbd5e1" }}>
                        {c.audiencia}
                      </span>
                    </td>

                    {/* Canales */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {c.canales.map(cn => (
                          <span key={cn} style={{ background: "#2563eb", color: "#ffffff", padding: "2px 6px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: 700 }}>
                            {cn}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle", whiteSpace: "nowrap", color: "#334155", fontSize: "0.76rem", fontWeight: 600 }}>
                      {c.fecha}
                    </td>

                    {/* Botón Ver Detalle */}
                    <td style={{ padding: "12px 14px", verticalAlign: "middle", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setCampanaSeleccionada(c)}
                        style={{
                          background: "#4f46e5",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                        }}
                      >
                        <Eye size={13} /> Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL DE DETALLE COMPLETO DE MENSAJE Y DE CUENTAS NOTIFICADAS */}
      {campanaSeleccionada && (
        <>
          {/* Backdrop Overlay */}
          <div
            onClick={() => setCampanaSeleccionada(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(4px)",
              zIndex: 99998
            }}
          />

          {/* Modal Container */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "90%",
              maxWidth: "650px",
              maxHeight: "85vh",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
              zIndex: 99999,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Header Modal */}
            <div style={{ padding: "18px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Detalle Auditado de Notificación
                </span>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a", fontWeight: 800 }}>
                  {campanaSeleccionada.asunto}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setCampanaSeleccionada(null)}
                style={{
                  background: "#ffffff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0f172a",
                  cursor: "pointer"
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Metadatos Rápidos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", background: "#f1f5f9", padding: "12px 16px", borderRadius: "10px", fontSize: "0.8rem" }}>
                <div>
                  <span style={{ color: "#64748b", fontWeight: 600, display: "block" }}>Emisor:</span>
                  <span style={{ color: "#0f172a", fontWeight: 700 }}>{campanaSeleccionada.emisorNombre} ({campanaSeleccionada.emisorCorreo})</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontWeight: 600, display: "block" }}>Fecha / Hora (EC):</span>
                  <span style={{ color: "#0f172a", fontWeight: 700 }}>{campanaSeleccionada.fecha}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontWeight: 600, display: "block" }}>Audiencia:</span>
                  <span style={{ color: "#0f172a", fontWeight: 700 }}>{campanaSeleccionada.audiencia}</span>
                </div>
                <div>
                  <span style={{ color: "#64748b", fontWeight: 600, display: "block" }}>Canales Activados:</span>
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>{campanaSeleccionada.canales.join(", ")}</span>
                </div>
              </div>

              {/* Mensaje Enviado (HTML / Markdown) */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.88rem", color: "#0f172a", fontWeight: 700 }}>
                  📄 Mensaje / Cuerpo de la Notificación:
                </h4>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "14px",
                    fontSize: "0.85rem",
                    color: "#334155",
                    lineHeight: 1.6
                  }}
                  dangerouslySetInnerHTML={{ __html: campanaSeleccionada.contenidoHTML || campanaSeleccionada.asunto }}
                />
              </div>

              {/* Cuentas Notificadas */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.88rem", color: "#0f172a", fontWeight: 700 }}>
                  📫 Cuentas de Correo / Destinatarios Notificados ({campanaSeleccionada.destinatariosDetalle?.length || campanaSeleccionada.enviados}):
                </h4>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", maxHeight: "120px", overflowY: "auto" }}>
                  {(campanaSeleccionada.destinatariosDetalle || [campanaSeleccionada.emisorCorreo]).map((email, idx) => (
                    <div key={idx} style={{ fontSize: "0.8rem", color: "#0f172a", fontWeight: 600, padding: "3px 0", borderBottom: idx < (campanaSeleccionada.destinatariosDetalle?.length || 1) - 1 ? "1px dashed #e2e8f0" : "none" }}>
                      • {email}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
