"use client";

import React, { useState } from "react";
import {
  Send, Users, Mail, Bell, Smartphone, MessageSquare,
  Bold, Italic, Underline, List, Link as LinkIcon, Code, Eye, FileText,
  CheckCircle, Shield
} from "lucide-react";

interface Props {
  negocio: string;
}

export function EmisionNotificacionesWidget({ negocio }: Props) {
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

  // Alternar selección de rol
  const toggleRol = (rol: string) => {
    if (rolesSeleccionados.includes(rol)) {
      setRolesSeleccionados(rolesSeleccionados.filter(r => r !== rol));
    } else {
      setRolesSeleccionados([...rolesSeleccionados, rol]);
    }
  };

  // Alternar canales de despacho
  const toggleCanal = (canalKey: keyof typeof canales) => {
    setCanales(prev => ({ ...prev, [canalKey]: !prev[canalKey] }));
  };

  // Insertar formato en HTML/Markdown
  const aplicarFormato = (etiquetaHtml: string, sintaxisMd: string) => {
    if (tabEditor === "wysiwyg") {
      setContenidoHTML(prev => prev + `<${etiquetaHtml}>Texto formateado</${etiquetaHtml}>`);
    } else {
      setContenidoMarkdown(prev => prev + `${sintaxisMd}Texto formateado${sintaxisMd}`);
    }
  };

  // Enviar notificación haciendo llamada HTTP POST a /api/notificaciones
  const handleEnviarNotificacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg(null);

    if (!asunto.trim()) {
      setToastMsg({ tipo: "error", texto: "⚠️ El asunto es obligatorio para emitir la notificación." });
      return;
    }

    setEnviando(true);

    try {
      const payload = {
        negocio,
        asunto: asunto.trim(),
        tipoAudiencia,
        roles: rolesSeleccionados,
        usuarios: filtroUsuarios.trim(),
        canales,
        contenidoHTML,
        contenidoMarkdown
      };

      const res = await fetch("/api/notificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Ocurrió un error al despachar la notificación.");
      }

      setToastMsg({
        tipo: "exito",
        texto: `🎉 ${data.mensaje || "Notificación emitida con éxito a los destinatarios."}`
      });

      // Disparar Web Push Notification nativa en el navegador
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(asunto, {
            body: contenidoHTML.replace(/<[^>]*>?/gm, "").slice(0, 100),
            icon: "/favicon.ico"
          });
        } catch {
          /* Ignorar */
        }
      }

      // Reiniciar formulario
      setAsunto("");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al conectar con la API de notificaciones.";
      setToastMsg({ tipo: "error", texto: `❌ ${msg}` });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ background: "#ffffff", borderRadius: "16px", border: "1px solid #E4E4E4", padding: "24px", width: "100%" }}>
      {/* CABECERA HERO MOTOR DE NOTIFICACIONES */}
      <section className="tarjeta-proteccion" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", color: "#ffffff", marginBottom: "20px", padding: "20px", borderRadius: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a5b4fc" }}>
              CONSOLA TRANSVERSAL DE GOBERNANZA
            </span>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "4px 0", color: "#ffffff" }}>
              ✈️ Redacción & Despacho de Notificaciones Multicanal ({negocio})
            </h2>
            <p style={{ fontSize: "0.82rem", color: "#c7d2fe", margin: 0 }}>
              Emisión de notificaciones multicanal (In-App, Push, Email y WhatsApp) con editor WYSIWYG / Markdown.
            </p>
          </div>
          <span style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff", padding: "6px 14px", borderRadius: "20px", fontSize: "0.78rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Shield size={14} /> Emisión Autorizada
          </span>
        </div>
      </section>

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

      {/* EDITOR DE REDACCIÓN Y SELECCIÓN MULTICANAL */}
      <form onSubmit={handleEnviarNotificacion}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Columna Izquierda: Audiencia y Canales */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Segmentación de Audiencia */}
            <section className="tarjeta-seccion" style={{ padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={18} color="#4f46e5" /> 1. Segmentación de Audiencia ({negocio})
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "12px" }}>
                <button
                  type="button"
                  onClick={() => setTipoAudiencia("TODOS")}
                  style={{
                    background: tipoAudiencia === "TODOS" ? "#2563eb" : "#ffffff",
                    color: tipoAudiencia === "TODOS" ? "#ffffff" : "#475569",
                    border: "1px solid #cbd5e1",
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
                    background: tipoAudiencia === "POR_ROL" ? "#2563eb" : "#ffffff",
                    color: tipoAudiencia === "POR_ROL" ? "#ffffff" : "#475569",
                    border: "1px solid #cbd5e1",
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
                    background: tipoAudiencia === "POR_USUARIOS" ? "#2563eb" : "#ffffff",
                    color: tipoAudiencia === "POR_USUARIOS" ? "#ffffff" : "#475569",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "8px 4px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                >
                  Filtro Específico
                </button>
              </div>

              {tipoAudiencia === "POR_ROL" && (
                <div style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                    Selecciona los Roles Destinatarios:
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"].map(r => (
                      <label key={r} style={{ fontSize: "0.74rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer", background: rolesSeleccionados.includes(r) ? "#dbeafe" : "#f1f5f9", padding: "4px 8px", borderRadius: "4px" }}>
                        <input type="checkbox" checked={rolesSeleccionados.includes(r)} onChange={() => toggleRol(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {tipoAudiencia === "POR_USUARIOS" && (
                <div>
                  <input
                    type="text"
                    value={filtroUsuarios}
                    onChange={e => setFiltroUsuarios(e.target.value)}
                    placeholder="Escribe correos o nombres separados por coma..."
                    style={{ width: "100%", padding: "8px 10px", fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              )}
            </section>

            {/* Canales Multicanal */}
            <section className="tarjeta-seccion" style={{ padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#1e293b", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                <Bell size={18} color="#2563eb" /> 2. Canales de Despacho
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" }}>
                  <input type="checkbox" checked={canales.inApp} onChange={() => toggleCanal("inApp")} />
                  <Bell size={16} color="#2563eb" />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>In-App Banner</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" }}>
                  <input type="checkbox" checked={canales.email} onChange={() => toggleCanal("email")} />
                  <Mail size={16} color="#4f46e5" />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>Correo Email</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" }}>
                  <input type="checkbox" checked={canales.push} onChange={() => toggleCanal("push")} />
                  <Smartphone size={16} color="#0284c7" />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>Push Notification</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "#ffffff", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" }}>
                  <input type="checkbox" checked={canales.whatsapp} onChange={() => toggleCanal("whatsapp")} />
                  <MessageSquare size={16} color="#16a34a" />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>WhatsApp</span>
                </label>
              </div>
            </section>
          </div>

          {/* Columna Derecha: Editor WYSIWYG / Markdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <section className="tarjeta-seccion" style={{ padding: "16px", background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                  <FileText size={18} color="#059669" /> 3. Redacción & Editor de Contenido
                </h3>

                {/* Sub-tabs del editor */}
                <div style={{ display: "flex", background: "#f1f5f9", padding: "2px", borderRadius: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setTabEditor("wysiwyg")}
                    style={{
                      background: tabEditor === "wysiwyg" ? "#ffffff" : "transparent",
                      color: tabEditor === "wysiwyg" ? "#059669" : "#64748b",
                      border: "none",
                      padding: "4px 8px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    WYSIWYG / HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabEditor("markdown")}
                    style={{
                      background: tabEditor === "markdown" ? "#ffffff" : "transparent",
                      color: tabEditor === "markdown" ? "#059669" : "#64748b",
                      border: "none",
                      padding: "4px 8px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabEditor("preview")}
                    style={{
                      background: tabEditor === "preview" ? "#ffffff" : "transparent",
                      color: tabEditor === "preview" ? "#059669" : "#64748b",
                      border: "none",
                      padding: "4px 8px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    <Eye size={12} style={{ marginRight: "2px" }} /> Vista Previa
                  </button>
                </div>
              </div>

              {/* Asunto */}
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Asunto de la Notificación *
                </label>
                <input
                  type="text"
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  placeholder="Escribe el asunto o título de la notificación..."
                  style={{ width: "100%", padding: "8px 12px", fontSize: "0.88rem", fontWeight: 700, borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  required
                />
              </div>

              {/* Barra de Formato Rápido */}
              {tabEditor !== "preview" && (
                <div style={{ display: "flex", gap: "4px", background: "#f8fafc", padding: "4px", borderRadius: "6px", marginBottom: "8px", border: "1px solid #e2e8f0" }}>
                  <button type="button" onClick={() => aplicarFormato("strong", "**")} style={{ padding: "4px 8px", border: "none", background: "#ffffff", borderRadius: "4px", cursor: "pointer" }} title="Negrita">
                    <Bold size={14} />
                  </button>
                  <button type="button" onClick={() => aplicarFormato("em", "*")} style={{ padding: "4px 8px", border: "none", background: "#ffffff", borderRadius: "4px", cursor: "pointer" }} title="Cursiva">
                    <Italic size={14} />
                  </button>
                  <button type="button" onClick={() => aplicarFormato("u", "_")} style={{ padding: "4px 8px", border: "none", background: "#ffffff", borderRadius: "4px", cursor: "pointer" }} title="Subrayado">
                    <Underline size={14} />
                  </button>
                  <button type="button" onClick={() => aplicarFormato("li", "- ")} style={{ padding: "4px 8px", border: "none", background: "#ffffff", borderRadius: "4px", cursor: "pointer" }} title="Lista">
                    <List size={14} />
                  </button>
                  <button type="button" onClick={() => aplicarFormato("a", "[Enlace](url)")} style={{ padding: "4px 8px", border: "none", background: "#ffffff", borderRadius: "4px", cursor: "pointer" }} title="Enlace">
                    <LinkIcon size={14} />
                  </button>
                  <button type="button" onClick={() => aplicarFormato("code", "`")} style={{ padding: "4px 8px", border: "none", background: "#ffffff", borderRadius: "4px", cursor: "pointer" }} title="Código">
                    <Code size={14} />
                  </button>
                </div>
              )}

              {/* Área de Texto / Vista Previa */}
              {tabEditor === "wysiwyg" && (
                <textarea
                  value={contenidoHTML}
                  onChange={e => setContenidoHTML(e.target.value)}
                  rows={8}
                  style={{ width: "100%", padding: "10px", fontFamily: "monospace", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              )}

              {tabEditor === "markdown" && (
                <textarea
                  value={contenidoMarkdown}
                  onChange={e => setContenidoMarkdown(e.target.value)}
                  rows={8}
                  style={{ width: "100%", padding: "10px", fontFamily: "monospace", fontSize: "0.82rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              )}

              {tabEditor === "preview" && (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "14px", background: "#f8fafc", minHeight: "160px", fontSize: "0.88rem", lineHeight: 1.6 }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#1e293b" }}>{asunto || "Sin Asunto"}</h4>
                  <div dangerouslySetInnerHTML={{ __html: contenidoHTML }} />
                </div>
              )}

              <div style={{ marginTop: "12px", fontSize: "0.75rem", color: "#64748b" }}>
                💡 Variables interpolables disponibles: <code>{"{{nombre_usuario}}"}</code>, <code>{"{{correo}}"}</code>, <code>{"{{negocio}}"}</code>, <code>{"{{fecha}}"}</code>.
              </div>
            </section>
          </div>
        </div>

        {/* Botón Acción Principal Despachar */}
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={enviando}
            style={{
              padding: "12px 28px",
              background: enviando ? "#94a3b8" : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "0.92rem",
              cursor: enviando ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              transition: "all 0.2s ease"
            }}
          >
            <Send size={18} />
            {enviando ? "Despachando Notificación..." : "Emitir Notificación Multicanal Ahora"}
          </button>
        </div>
      </form>
    </div>
  );
}
