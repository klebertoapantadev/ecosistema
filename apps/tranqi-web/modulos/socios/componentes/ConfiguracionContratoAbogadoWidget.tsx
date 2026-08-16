"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileText, Save, Eye, Edit, AlertCircle, RefreshCw } from "lucide-react";
import { obtenerPlantillaContrato, guardarPlantillaContrato } from "../acciones";
import { BarraVariablesDinamicas } from "@eco/identidad/componentes/BarraVariablesDinamicas";

export function ConfiguracionContratoAbogadoWidget() {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"editar" | "vista_previa">("editar");
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const res = await obtenerPlantillaContrato();
        if (res.ok) {
          setTitulo(res.data.pct_titulo);
          setContenido(res.data.pct_contenido);
        } else {
          setMensaje({ tipo: "error", texto: res.error || "No se pudo cargar la plantilla." });
        }
      } catch (err) {
        console.error(err);
        setMensaje({ tipo: "error", texto: "Error al comunicar con el servidor." });
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  async function handleGuardar() {
    setMensaje(null);
    if (!titulo.trim() || !contenido.trim()) {
      setMensaje({ tipo: "error", texto: "El título y el contenido son campos obligatorios." });
      return;
    }
    try {
      setGuardando(true);
      const res = await guardarPlantillaContrato(titulo, contenido);
      if (res.ok) {
        setMensaje({ tipo: "exito", texto: "¡Plantilla de contrato guardada exitosamente!" });
      } else {
        setMensaje({ tipo: "error", texto: res.error });
      }
    } catch (err) {
      console.error(err);
      setMensaje({ tipo: "error", texto: "Error al intentar guardar en el servidor." });
    } finally {
      setGuardando(false);
    }
  }

  const insertarVariable = (variable: string) => {
    const textoAInsertar = `{{${variable}}}`;
    if (textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const nuevoTexto = contenido.substring(0, start) + textoAInsertar + contenido.substring(end);
      setContenido(nuevoTexto);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + textoAInsertar.length, start + textoAInsertar.length);
      }, 50);
    } else {
      setContenido((prev) => prev + ` ${textoAInsertar} `);
    }
  };

  // Mapear tags para la vista previa
  function obtenerContenidoPrevisualizado() {
    let html = contenido;
    // Escapar caracteres básicos
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Reemplazar los placeholders estándar con estilos llamativos
    html = html
      .replace(/\{\{nombre_completo\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[DRA. CAROLINA COLCHA]</strong>')
      .replace(/\{\{cedula\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[1715489623]</strong>')
      .replace(/\{\{correo\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[abogada.carolina@gmail.com]</strong>')
      .replace(/\{\{telefono\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[0998765432]</strong>')
      .replace(/\{\{whatsapp\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[+593 998765432]</strong>')
      .replace(/\{\{negocio\}\}/g, '<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[TRANQI]</strong>')
      .replace(/\{\{fecha_actual\}\}/g, `<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[${new Date().toLocaleDateString("es-EC")}]</strong>`)
      .replace(/\{\{ciudad\}\}/g, '<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Quito, D.M.]</strong>')
      .replace(/\{\{matricula_profesional\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[17-2020-89]</strong>')
      .replace(/\{\{universidad\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Universidad Central del Ecuador]</strong>')
      .replace(/\{\{titulo_profesional\}\}/g, '<strong style="color: #05876E; background: rgba(5,135,110,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Abogada de los Tribunales de la República]</strong>')
      .replace(/\{\{representante_legal\}\}/g, '<strong style="color: #5000BA; background: rgba(80,0,186,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[Dr. Kleber Toapanta]</strong>')
      .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '<strong style="color: #6B21A8; background: rgba(107,33,168,0.08); padding: 2px 6px; border-radius: 4px; font-weight: 800;">[$1]</strong>');

    // Parseo básico de Markdown
    // Títulos H1 (# )
    html = html.replace(/^# (.*?)$/gm, '<h1 style="font-size: 1.5rem; color: #111; border-bottom: 2px solid #EEE; padding-bottom: 8px; margin-top: 24px; margin-bottom: 12px; font-weight: 800;">$1</h1>');
    // Títulos H2 (## )
    html = html.replace(/^## (.*?)$/gm, '<h2 style="font-size: 1.2rem; color: #333; margin-top: 20px; margin-bottom: 10px; font-weight: 700;">$1</h2>');
    // Títulos H3 (### )
    html = html.replace(/^### (.*?)$/gm, '<h3 style="font-size: 1.05rem; color: #444; margin-top: 16px; margin-bottom: 8px; font-weight: 700;">$1</h3>');
    // Negrita (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Cursiva (*text*)
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Listas ordenadas (1. 2. 3.)
    html = html.replace(/^\d+\.\s+(.*?)$/gm, '<li style="margin-left: 20px; margin-bottom: 6px; font-size: 0.92rem; line-height: 1.5;">$1</li>');
    // Saltos de línea dobles como párrafos
    html = html.split("\n\n").map(p => {
      if (p.trim().startsWith("<h") || p.trim().startsWith("<li")) return p;
      return `<p style="margin-bottom: 14px; font-size: 0.92rem; line-height: 1.6; color: #374151;">${p}</p>`;
    }).join("");

    return html;
  }

  if (cargando) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
        <RefreshCw className="animate-spin" style={{ margin: "0 auto 10px" }} />
        Cargando plantilla de contrato activa...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
      {/* Botones de Vista */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setVista("editar")}
            style={{
              padding: "8px 16px",
              background: vista === "editar" ? "#5000BA" : "#FFF",
              color: vista === "editar" ? "#FFF" : "#374151",
              border: "1px solid " + (vista === "editar" ? "#5000BA" : "#D1D5DB"),
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Edit size={16} /> Editar Formato
          </button>
          <button
            type="button"
            onClick={() => setVista("vista_previa")}
            style={{
              padding: "8px 16px",
              background: vista === "vista_previa" ? "#5000BA" : "#FFF",
              color: vista === "vista_previa" ? "#FFF" : "#374151",
              border: "1px solid " + (vista === "vista_previa" ? "#5000BA" : "#D1D5DB"),
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Eye size={16} /> Vista Previa
          </button>
        </div>

        {vista === "editar" && (
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            style={{
              padding: "8px 18px",
              background: "#05876E",
              color: "#FFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(5,135,110,0.15)",
            }}
          >
            <Save size={16} /> {guardando ? "Guardando..." : "Guardar Plantilla"}
          </button>
        )}
      </div>

      {mensaje && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: mensaje.tipo === "exito" ? "#ECFDF5" : "#FEF2F2",
            border: "1px solid " + (mensaje.tipo === "exito" ? "#10B981" : "#EF4444"),
            color: mensaje.tipo === "exito" ? "#065F46" : "#991B1B",
            fontSize: "0.88rem",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          {mensaje.texto}
        </div>
      )}

      {vista === "editar" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 800, color: "#111", marginBottom: "6px" }}>
              Título del Contrato
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="ej. Contrato de Prestación de Servicios de Socio Abogado"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "0.9rem",
                borderRadius: "8px",
                border: "1px solid #D1D5DB",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 800, color: "#111", marginBottom: "8px" }}>
              Contenido de la Plantilla (Formato Markdown)
            </label>

            {/* Barra de Variables Dinámicas */}
            <div style={{ marginBottom: "12px" }}>
              <BarraVariablesDinamicas onInsertarVariable={insertarVariable} negocio="tranqi" />
            </div>

            <textarea
              ref={textareaRef}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder="Redacta el contrato en formato Markdown aquí..."
              style={{
                width: "100%",
                height: "400px",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid #D1D5DB",
                outline: "none",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#FFF",
            padding: "30px 40px",
            borderRadius: "12px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ textAlign: "center", borderBottom: "2px solid #E5E7EB", paddingBottom: "16px", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#111827", margin: 0 }}>
              {titulo || "Sin Título Específico"}
            </h2>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "4px", display: "block" }}>
              Vista previa del documento dinámico
            </span>
          </div>

          <div
            className="contrato-vista-previa"
            dangerouslySetInnerHTML={{ __html: obtenerContenidoPrevisualizado() }}
          />
        </div>
      )}
    </div>
  );
}
