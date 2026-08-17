import React from "react";
import { notFound } from "next/navigation";
import { obtenerPerfilActual } from "@eco/identidad";
import { obtenerSolicitudDetalle } from "../../../../../modulos/socios/consultas";
import { obtenerPlantillaContrato } from "../../../../../modulos/socios/acciones";
import { BotonImpresionAutomatica } from "./BotonImpresionAutomatica";

interface Props {
  searchParams: Promise<{ solicitudId?: string }>;
}

export default async function PaginaImprimirContrato({ searchParams }: Props) {
  const { solicitudId } = await searchParams;
  if (!solicitudId) return notFound();

  const perfil = await obtenerPerfilActual();
  if (!perfil) return notFound();

  const detalle = await obtenerSolicitudDetalle(solicitudId);
  if (!detalle || !detalle.solicitud) return notFound();

  const { solicitud, usuario } = detalle;

  // Obtener plantilla activa
  const resTemplate = await obtenerPlantillaContrato();
  let tituloContrato = "Contrato de Prestación de Servicios de Socio Abogado";
  let contenidoContrato = "";
  if (resTemplate.ok && resTemplate.data) {
    tituloContrato = resTemplate.data.pct_titulo;
    contenidoContrato = resTemplate.data.pct_contenido;
  }

  const nombreCompleto = [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo || "—";
  const cedula = solicitud.ssc_cedula || "—";

  // Reemplazar placeholders dinámicos
  const textoInterpolado = contenidoContrato
    .replace(/\{\{nombre_completo\}\}/g, nombreCompleto)
    .replace(/\{\{cedula\}\}/g, cedula);

  // Conversión simple a HTML
  function markdownToHtml(text: string) {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Reemplazos de encabezados y marcas Markdown
    html = html.replace(/^# (.*?)$/gm, '<h1 style="font-size: 1.6rem; text-align: center; margin-top: 24px; margin-bottom: 16px; font-weight: 800; color: #111;">$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h2 style="font-size: 1.25rem; margin-top: 20px; margin-bottom: 10px; font-weight: 700; color: #222;">$1</h2>');
    html = html.replace(/^### (.*?)$/gm, '<h3 style="font-size: 1.08rem; margin-top: 16px; margin-bottom: 8px; font-weight: 700; color: #333;">$1</h3>');
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/^\d+\.\s+(.*?)$/gm, '<li style="margin-left: 24px; margin-bottom: 8px; font-size: 0.95rem; line-height: 1.5; color: #374151;">$1</li>');

    // Procesar bloques de párrafo
    html = html.split("\n\n").map(p => {
      if (p.trim().startsWith("<h") || p.trim().startsWith("<li")) return p;
      return `<p style="margin-bottom: 14px; font-size: 0.95rem; line-height: 1.6; text-align: justify; color: #374151;">${p}</p>`;
    }).join("");

    return html;
  }

  const htmlContrato = markdownToHtml(textoInterpolado);

  return (
    <div style={{ background: "#FFF", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Botones de impresión y ayuda (ocultos en papel) */}
      <BotonImpresionAutomatica />

      {/* Hoja física del contrato */}
      <main style={{
        flexGrow: 1,
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 50px",
        fontFamily: "'Times New Roman', Times, serif",
      }}>
        {/* Encabezado legal */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, textTransform: "uppercase", margin: "0 0 4px 0", color: "#000" }}>
            {tituloContrato}
          </h2>
          <hr style={{ border: "none", borderTop: "2px solid #000", margin: "12px 0 24px" }} />
        </div>

        {/* Cuerpo del Contrato */}
        <div
          style={{ wordBreak: "break-word" }}
          dangerouslySetInnerHTML={{ __html: htmlContrato }}
        />

        {/* Firmas al final */}
        <div style={{ marginTop: "80px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", pageBreakInside: "avoid" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", width: "80%", margin: "0 auto 8px" }}></div>
            <strong style={{ display: "block", fontSize: "0.9rem" }}>tranqi</strong>
            <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>Por la plataforma</span>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #000", width: "80%", margin: "0 auto 8px" }}></div>
            <strong style={{ display: "block", fontSize: "0.9rem" }}>{nombreCompleto}</strong>
            <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>Socio Abogado Postulante</span>
          </div>
        </div>
      </main>

      {/* Estilos CSS Inline para Impresión */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #FFF !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          main {
            padding: 20px 0 !important;
            box-shadow: none !important;
            max-width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}
