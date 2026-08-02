"use client";

import React, { useState } from "react";
import {
  Send, Users, Shield, User, Mail, Bell, Smartphone, MessageSquare,
  Bold, Italic, Underline, List, Link as LinkIcon, Code, Eye, FileText,
  CheckCircle, RefreshCw, BarChart2
} from "lucide-react";

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
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bitácora simulada de campañas emitidas
  const [campanas, setCampanas] = useState([
    {
      id: "cmp-001",
      asunto: "Actualización de Términos y Condiciones 2026",
      audiencia: "TODOS",
      canales: ["IN_APP", "EMAIL"],
      enviados: 142,
      leidos: 118,
      ignorados: 24,
      fecha: "2026-08-01 14:30"
    },
    {
      id: "cmp-002",
      asunto: "Recordatorio de Firma de Contrato de Servicios",
      audiencia: "POR_ROL (ABOGADO)",
      canales: ["IN_APP", "PUSH"],
      enviados: 35,
      leidos: 32,
      ignorados: 3,
      fecha: "2026-08-02 09:15"
    }
  ]);

  const toggleRol = (rol: string) => {
    setRolesSeleccionados(prev =>
      prev.includes(rol) ? prev.filter(r => r !== rol) : [...prev, rol]
    );
  };

  const inyectarVariable = (variable: string) => {
    setContenidoHTML(prev => prev + ` ${variable} `);
    setContenidoMarkdown(prev => prev + ` ${variable} `);
  };

  const ejecutarEnvio = () => {
    if (!asunto.trim()) {
      setToastMsg("Por favor ingresa el asunto de la notificación");
      return;
    }
    setEnviando(true);
    setTimeout(() => {
      const nuevaCampana = {
        id: "cmp-" + Date.now().toString().slice(-4),
        asunto: asunto,
        audiencia: tipoAudiencia === "POR_ROL" ? `POR_ROL (${rolesSeleccionados.join(", ")})` : tipoAudiencia,
        canales: Object.keys(canales).filter(k => canales[k as keyof typeof canales]).map(k => k.toUpperCase()),
        enviados: tipoAudiencia === "TODOS" ? 150 : 28,
        leidos: 0,
        ignorados: tipoAudiencia === "TODOS" ? 150 : 28,
        fecha: new Date().toISOString().replace("T", " ").slice(0, 16)
      };

      setCampanas([nuevaCampana, ...campanas]);
      setEnviando(false);
      setToastMsg("✅ Notificación multicanal despachada exitosamente");
      setTimeout(() => setToastMsg(null), 4000);
    }, 1200);
  };

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: "12px",
        padding: "24px",
        color: "#c9d1d9",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Header del Widget */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#58a6ff", display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={22} /> Motor Transversal de Emisión de Notificaciones ({negocio})
          </h2>
          <p style={{ fontSize: "0.82rem", color: "#8b949e", marginTop: "4px" }}>
            Módulo de despacho multicanal (In-App, Push, Email y WhatsApp propuesta) con Editor WYSIWYG / Markdown
          </p>
        </div>

        {/* Pestañas Principales */}
        <div style={{ display: "flex", gap: "8px", background: "#0d1117", padding: "4px", borderRadius: "8px" }}>
          <button
            onClick={() => setTabPrincipal("redaccion")}
            style={{
              background: tabPrincipal === "redaccion" ? "#1f6feb" : "transparent",
              color: tabPrincipal === "redaccion" ? "#fff" : "#8b949e",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            ✍️ Redacción & Despacho
          </button>
          <button
            onClick={() => setTabPrincipal("historial")}
            style={{
              background: tabPrincipal === "historial" ? "#1f6feb" : "transparent",
              color: tabPrincipal === "historial" ? "#fff" : "#8b949e",
              border: "none",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            📊 Bitácora & Métricas ({campanas.length})
          </button>
        </div>
      </div>

      {toastMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            background: toastMsg.includes("✅") ? "rgba(46, 160, 67, 0.2)" : "rgba(218, 54, 51, 0.2)",
            border: toastMsg.includes("✅") ? "1px solid #2ea043" : "1px solid #da3633",
            color: toastMsg.includes("✅") ? "#3fb950" : "#f85149",
            fontSize: "0.85rem",
            marginBottom: "16px"
          }}
        >
          {toastMsg}
        </div>
      )}

      {tabPrincipal === "redaccion" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Panel Izquierdo: Configuración de Audiencia y Canales */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* 1. Audiencia */}
            <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", padding: "14px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#58a6ff", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Users size={16} /> 1. Segmentación de Audiencia (Negocio: {negocio})
              </label>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("TODOS")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #30363d",
                    background: tipoAudiencia === "TODOS" ? "#1f6feb" : "#161b22",
                    color: tipoAudiencia === "TODOS" ? "#fff" : "#c9d1d9",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  🌐 Todos los Miembros
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("POR_ROL")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #30363d",
                    background: tipoAudiencia === "POR_ROL" ? "#1f6feb" : "#161b22",
                    color: tipoAudiencia === "POR_ROL" ? "#fff" : "#c9d1d9",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  🛡 Por Roles
                </button>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("POR_USUARIOS")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #30363d",
                    background: tipoAudiencia === "POR_USUARIOS" ? "#1f6feb" : "#161b22",
                    color: tipoAudiencia === "POR_USUARIOS" ? "#fff" : "#c9d1d9",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  👤 Por Usuario
                </button>
              </div>

              {tipoAudiencia === "POR_ROL" && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                  {["CLIENTE", "ABOGADO", "ADMINISTRADOR", "TECNICO"].map(r => (
                    <label
                      key={r}
                      style={{
                        background: rolesSeleccionados.includes(r) ? "rgba(31, 111, 235, 0.2)" : "#161b22",
                        border: rolesSeleccionados.includes(r) ? "1px solid #388bfd" : "1px solid #30363d",
                        padding: "4px 10px",
                        borderRadius: "16px",
                        fontSize: "0.76rem",
                        color: rolesSeleccionados.includes(r) ? "#58a6ff" : "#8b949e",
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={rolesSeleccionados.includes(r)}
                        onChange={() => toggleRol(r)}
                        style={{ marginRight: "6px" }}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              )}

              {tipoAudiencia === "POR_USUARIOS" && (
                <input
                  type="text"
                  placeholder="🔍 Buscar correo o nombre del usuario..."
                  value={filtroUsuarios}
                  onChange={e => setFiltroUsuarios(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    color: "#c9d1d9",
                    fontSize: "0.8rem",
                    outline: "none"
                  }}
                />
              )}
            </div>

            {/* 2. Selección de Canales */}
            <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", padding: "14px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#58a6ff", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Send size={16} /> 2. Selección de Canales de Envío Simultáneos
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#161b22", padding: "8px 12px", borderRadius: "6px", border: "1px solid #30363d", fontSize: "0.8rem" }}>
                  <input type="checkbox" checked={canales.inApp} onChange={e => setCanales({ ...canales, inApp: e.target.checked })} />
                  <Bell size={14} color="#388bfd" /> In-App (Campana)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#161b22", padding: "8px 12px", borderRadius: "6px", border: "1px solid #30363d", fontSize: "0.8rem" }}>
                  <input type="checkbox" checked={canales.email} onChange={e => setCanales({ ...canales, email: e.target.checked })} />
                  <Mail size={14} color="#3fb950" /> Email Responsive
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#161b22", padding: "8px 12px", borderRadius: "6px", border: "1px solid #30363d", fontSize: "0.8rem" }}>
                  <input type="checkbox" checked={canales.push} onChange={e => setCanales({ ...canales, push: e.target.checked })} />
                  <Smartphone size={14} color="#d29922" /> Push (Web/Móvil)
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", background: "#161b22", padding: "8px 12px", borderRadius: "6px", border: "1px solid #30363d", fontSize: "0.8rem", opacity: 0.6 }}>
                  <input type="checkbox" checked={canales.whatsapp} onChange={e => setCanales({ ...canales, whatsapp: e.target.checked })} />
                  <MessageSquare size={14} color="#2ea043" /> WhatsApp (Propuesta)
                </label>
              </div>
            </div>

            {/* Asunto */}
            <div>
              <label style={{ fontSize: "0.82rem", color: "#8b949e", display: "block", marginBottom: "4px" }}>
                Asunto / Título de la Notificación:
              </label>
              <input
                type="text"
                value={asunto}
                onChange={e => setAsunto(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#c9d1d9",
                  fontSize: "0.85rem",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Panel Derecho: Editor WYSIWYG / Markdown / Live Preview */}
          <div style={{ display: "flex", flexDirection: "column", background: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", overflow: "hidden" }}>
            {/* Header del Editor */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#161b22", borderBottom: "1px solid #30363d" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setTabEditor("wysiwyg")}
                  style={{
                    background: tabEditor === "wysiwyg" ? "#1f6feb" : "transparent",
                    color: tabEditor === "wysiwyg" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  📝 Visual (WYSIWYG)
                </button>
                <button
                  type="button"
                  onClick={() => setTabEditor("markdown")}
                  style={{
                    background: tabEditor === "markdown" ? "#1f6feb" : "transparent",
                    color: tabEditor === "markdown" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  💻 Markdown (.md)
                </button>
                <button
                  type="button"
                  onClick={() => setTabEditor("preview")}
                  style={{
                    background: tabEditor === "preview" ? "#1f6feb" : "transparent",
                    color: tabEditor === "preview" ? "#fff" : "#8b949e",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  👁 Live Preview
                </button>
              </div>

              {/* Botones de Variables Interpolables */}
              <div style={{ display: "flex", gap: "4px" }}>
                <button type="button" onClick={() => inyectarVariable("{{nombre_usuario}}")} title="Inyectar nombre del destinatario" style={{ background: "#21262d", border: "1px solid #30363d", color: "#58a6ff", fontSize: "0.7rem", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>
                  + {{nombre_usuario}}
                </button>
                <button type="button" onClick={() => inyectarVariable("{{negocio}}")} title="Inyectar nombre del negocio" style={{ background: "#21262d", border: "1px solid #30363d", color: "#58a6ff", fontSize: "0.7rem", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>
                  + {{negocio}}
                </button>
              </div>
            </div>

            {/* Contenido del Editor */}
            <div style={{ flex: 1, padding: "12px", minHeight: "220px" }}>
              {tabEditor === "wysiwyg" && (
                <div>
                  {/* Barra de herramientas WYSIWYG */}
                  <div style={{ display: "flex", gap: "4px", marginBottom: "8px", background: "#161b22", padding: "4px", borderRadius: "4px", border: "1px solid #30363d" }}>
                    <button type="button" style={{ background: "none", border: "none", color: "#c9d1d9", padding: "4px", cursor: "pointer" }} title="Negrita"><Bold size={14} /></button>
                    <button type="button" style={{ background: "none", border: "none", color: "#c9d1d9", padding: "4px", cursor: "pointer" }} title="Cursiva"><Italic size={14} /></button>
                    <button type="button" style={{ background: "none", border: "none", color: "#c9d1d9", padding: "4px", cursor: "pointer" }} title="Subrayado"><Underline size={14} /></button>
                    <button type="button" style={{ background: "none", border: "none", color: "#c9d1d9", padding: "4px", cursor: "pointer" }} title="Lista"><List size={14} /></button>
                    <button type="button" style={{ background: "none", border: "none", color: "#c9d1d9", padding: "4px", cursor: "pointer" }} title="Enlace"><LinkIcon size={14} /></button>
                  </div>
                  <textarea
                    value={contenidoHTML}
                    onChange={e => setContenidoHTML(e.target.value)}
                    style={{
                      width: "100%",
                      height: "180px",
                      background: "#0d1117",
                      border: "none",
                      color: "#c9d1d9",
                      fontSize: "0.83rem",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />
                </div>
              )}

              {tabEditor === "markdown" && (
                <textarea
                  value={contenidoMarkdown}
                  onChange={e => setContenidoMarkdown(e.target.value)}
                  style={{
                    width: "100%",
                    height: "220px",
                    background: "#0d1117",
                    border: "none",
                    color: "#79c0ff",
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              )}

              {tabEditor === "preview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", padding: "10px" }}>
                    <span style={{ fontSize: "0.72rem", color: "#58a6ff", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      🔔 SIMULACIÓN CAMPANA IN-APP:
                    </span>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#c9d1d9" }}>{asunto}</div>
                    <div
                      style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "4px" }}
                      dangerouslySetInnerHTML={{
                        __html: contenidoHTML.replace(/{{nombre_usuario}}/g, "Juan Pérez").replace(/{{negocio}}/g, negocio)
                      }}
                    />
                  </div>

                  <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", padding: "10px" }}>
                    <span style={{ fontSize: "0.72rem", color: "#d29922", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                      📱 SIMULACIÓN PUSH DISPOSITIVO MÓVIL:
                    </span>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>{negocio.toUpperCase()} · {asunto}</div>
                    <div style={{ fontSize: "0.76rem", color: "#c9d1d9" }}>
                      {contenidoMarkdown.replace(/{{nombre_usuario}}/g, "Juan Pérez").replace(/{{negocio}}/g, negocio).slice(0, 100)}...
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer de Envíos */}
            <div style={{ padding: "10px 14px", background: "#161b22", borderTop: "1px solid #30363d", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={ejecutarEnvio}
                disabled={enviando}
                style={{
                  background: "#238636",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {enviando ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                {enviando ? "Despachando..." : "🚀 Enviar Notificación Multicanal"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Tab de Historial & Métricas */
        <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: "8px", padding: "16px" }}>
          <h3 style={{ fontSize: "0.95rem", color: "#58a6ff", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <BarChart2 size={18} /> Bitácora de Despachos y Tasa de Apertura (Leídas / Ignoradas)
          </h3>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d", color: "#8b949e", textAlign: "left" }}>
                <th style={{ padding: "8px" }}>Fecha</th>
                <th style={{ padding: "8px" }}>Asunto</th>
                <th style={{ padding: "8px" }}>Audiencia</th>
                <th style={{ padding: "8px" }}>Canales</th>
                <th style={{ padding: "8px" }}>Enviados</th>
                <th style={{ padding: "8px" }}>Leídos (% Tasa)</th>
                <th style={{ padding: "8px" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {campanas.map(c => {
                const tasaLeidos = c.enviados > 0 ? Math.round((c.leidos / c.enviados) * 100) : 0;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 8px", color: "#8b949e" }}>{c.fecha}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 700, color: "#c9d1d9" }}>{c.asunto}</td>
                    <td style={{ padding: "10px 8px", color: "#58a6ff" }}>{c.audiencia}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {c.canales.map(can => (
                        <span key={can} style={{ background: "#21262d", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", marginRight: "4px" }}>
                          {can}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{c.enviados}</td>
                    <td style={{ padding: "10px 8px", color: tasaLeidos > 50 ? "#3fb950" : "#d29922", fontWeight: 700 }}>
                      {c.leidos} ({tasaLeidos}%)
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ background: "rgba(46, 160, 67, 0.2)", color: "#3fb950", padding: "2px 6px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 700 }}>
                        EMITIDA
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
