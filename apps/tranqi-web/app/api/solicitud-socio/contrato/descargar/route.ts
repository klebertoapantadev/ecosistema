import { obtenerPerfilActual } from "@eco/identidad";
import { obtenerSolicitudDetalle } from "../../../../../modulos/socios/consultas";
import { obtenerPlantillaContrato } from "../../../../../modulos/socios/acciones";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const solicitudId = searchParams.get("solicitudId");
    if (!solicitudId) {
      return new Response("ID de solicitud no especificado", { status: 400 });
    }

    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return new Response("No autorizado: sesión no iniciada", { status: 401 });
    }

    const detalle = await obtenerSolicitudDetalle(solicitudId);
    if (!detalle || !detalle.solicitud) {
      return new Response("Solicitud no encontrada", { status: 404 });
    }

    const { solicitud, usuario } = detalle;

    const resTemplate = await obtenerPlantillaContrato();
    let tituloContrato = "CONTRATO DE SOCIEDAD Y PRESTACIÓN DE SERVICIOS";
    let contenidoContrato = "";
    if (resTemplate.ok && resTemplate.data) {
      tituloContrato = resTemplate.data.pct_titulo;
      contenidoContrato = resTemplate.data.pct_contenido;
    }

    const nombreCompleto = [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo || "—";
    const cedula = solicitud.ssc_cedula || "—";

    const textoInterpolado = contenidoContrato
      .replace(/\{\{nombre_completo\}\}/g, nombreCompleto)
      .replace(/\{\{cedula\}\}/g, cedula);

    // Conversión de Markdown a HTML simple
    function markdownToHtml(text: string) {
      let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
      html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
      html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
      html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
      html = html.replace(/^\d+\.\s+(.*?)$/gm, '<li>$1</li>');

      html = html.split("\n\n").map(p => {
        if (p.trim().startsWith("<h") || p.trim().startsWith("<li")) return p;
        return `<p>${p}</p>`;
      }).join("");

      return html;
    }

    const htmlContrato = markdownToHtml(textoInterpolado);

    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
      <meta charset="utf-8">
      <title>${tituloContrato}</title>
      <!--[if gte mso 9]><xml>
       <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
       </w:WordDocument>
      </xml><![endif]-->
      <style>
      p { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; text-align: justify; margin-bottom: 12pt; }
      h1 { font-family: 'Times New Roman', Times, serif; font-size: 16pt; font-weight: bold; text-align: center; margin-top: 24px; margin-bottom: 18px; text-transform: uppercase; }
      h2 { font-family: 'Times New Roman', Times, serif; font-size: 13pt; font-weight: bold; margin-top: 18px; margin-bottom: 8px; }
      li { font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin-bottom: 6pt; }
      </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 30px;">
          <h1>${tituloContrato}</h1>
          <hr style="border: none; border-top: 2px solid #000; margin: 12px 0 24px;" />
        </div>
        <div>
          ${htmlContrato}
        </div>
        <br/><br/><br/>
        <table style="width: 100%; border: none;">
          <tr>
            <td style="width: 50%; text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 12pt;">
              <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 8px;"></div>
              <strong>tranqi</strong><br/>
              <span style="font-size: 10pt; color: #555;">Por la plataforma</span>
            </td>
            <td style="width: 50%; text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 12pt;">
              <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 8px;"></div>
              <strong>${nombreCompleto}</strong><br/>
              <span style="font-size: 10pt; color: #555;">Socio Abogado Postulante</span>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return new Response(docContent, {
      headers: {
        "Content-Type": "application/vnd.ms-word",
        "Content-Disposition": `attachment; filename="Contrato_Tranqi.docx"`,
      },
    });
  } catch (error: unknown) {
    const mensajeError = error instanceof Error ? error.message : "Error al generar el contrato";
    return new Response(mensajeError, { status: 500 });
  }
}
