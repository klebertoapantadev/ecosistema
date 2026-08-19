import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
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
    let tituloContrato = "CONTRATO DE SOCIEDAD Y PRESTACIÓN DE SERVICIOS LEGALES";
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

    // Generar documento PDF con pdf-lib
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89; // A4
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    function checkPageBreak(neededHeight: number) {
      if (currentY - neededHeight < margin + 60) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
    }

    // Encabezado institucional
    currentPage.drawText("tranqi® Legaltech Platform · Red de Soluciones Jurídicas", {
      x: margin,
      y: currentY,
      size: 8,
      font: fontBold,
      color: rgb(0.31, 0, 0.73),
    });
    currentY -= 14;

    currentPage.drawLine({
      start: { x: margin, y: currentY },
      end: { x: pageWidth - margin, y: currentY },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    currentY -= 20;

    // Título Principal
    const titleLines = wrapText(tituloContrato.toUpperCase(), contentWidth, 13, fontBold);
    for (const tl of titleLines) {
      checkPageBreak(20);
      const textW = fontBold.widthOfTextAtSize(tl, 13);
      currentPage.drawText(tl, {
        x: margin + (contentWidth - textW) / 2,
        y: currentY,
        size: 13,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      currentY -= 18;
    }
    currentY -= 10;

    // Parsear líneas de Markdown
    const lineas = textoInterpolado.split("\n");

    for (const rawLinea of lineas) {
      const linea = rawLinea.trim();
      if (!linea) {
        currentY -= 8;
        continue;
      }

      if (linea.startsWith("# ")) {
        const text = linea.replace(/^#\s+/, "");
        checkPageBreak(30);
        currentY -= 8;
        currentPage.drawText(text, {
          x: margin,
          y: currentY,
          size: 11,
          font: fontBold,
          color: rgb(0.31, 0, 0.73),
        });
        currentY -= 16;
      } else if (linea.startsWith("## ")) {
        const text = linea.replace(/^##\s+/, "");
        checkPageBreak(25);
        currentY -= 6;
        currentPage.drawText(text, {
          x: margin,
          y: currentY,
          size: 10,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.15),
        });
        currentY -= 14;
      } else if (linea.startsWith("### ")) {
        const text = linea.replace(/^###\s+/, "");
        checkPageBreak(20);
        currentPage.drawText(text, {
          x: margin,
          y: currentY,
          size: 9,
          font: fontBold,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= 12;
      } else {
        const isBullet = linea.startsWith("- ") || linea.startsWith("* ") || /^\d+\.\s+/.test(linea);
        const cleanText = linea.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").replace(/\*\*/g, "");
        const indent = isBullet ? 14 : 0;
        const availableWidth = contentWidth - indent;

        const wrapped = wrapText(cleanText, availableWidth, 8.5, fontRegular);
        for (let i = 0; i < wrapped.length; i++) {
          const lineaTexto = wrapped[i];
          if (!lineaTexto) continue;
          checkPageBreak(12);
          if (isBullet && i === 0) {
            currentPage.drawText("•", {
              x: margin + 4,
              y: currentY,
              size: 8.5,
              font: fontBold,
              color: rgb(0.31, 0, 0.73),
            });
          }
          currentPage.drawText(lineaTexto, {
            x: margin + indent,
            y: currentY,
            size: 8.5,
            font: fontRegular,
            color: rgb(0.2, 0.2, 0.2),
          });
          currentY -= 11.5;
        }
        currentY -= 3;
      }
    }

    // Sección final de firmas
    checkPageBreak(120);
    currentY -= 20;

    currentPage.drawText("SUSCRIPCIÓN Y ACEPTACIÓN BILATERAL:", {
      x: margin,
      y: currentY,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= 25;

    // Líneas de firma vacías por si se imprime en papel
    const colWidth = (contentWidth - 40) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 40;

    // Columna Tranqi
    currentPage.drawLine({
      start: { x: col1X + 10, y: currentY - 30 },
      end: { x: col1X + colWidth - 10, y: currentY - 30 },
      thickness: 0.8,
      color: rgb(0.4, 0.4, 0.4),
    });
    currentPage.drawText("tranqi® Legal Network", {
      x: col1X + 20,
      y: currentY - 42,
      size: 8.5,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    currentPage.drawText("Por la Plataforma y Directorio", {
      x: col1X + 20,
      y: currentY - 52,
      size: 7.5,
      font: fontItalic,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Columna Abogado
    currentPage.drawLine({
      start: { x: col2X + 10, y: currentY - 30 },
      end: { x: col2X + colWidth - 10, y: currentY - 30 },
      thickness: 0.8,
      color: rgb(0.4, 0.4, 0.4),
    });
    currentPage.drawText(nombreCompleto, {
      x: col2X + 20,
      y: currentY - 42,
      size: 8.5,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    currentPage.drawText(`Socio Abogado Postulante — C.I.: ${cedula}`, {
      x: col2X + 20,
      y: currentY - 52,
      size: 7.5,
      font: fontItalic,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Contrato_Tranqi_${cedula}.pdf"`,
      },
    });
  } catch (error: unknown) {
    const mensajeError = error instanceof Error ? error.message : "Error al generar el PDF del contrato";
    return new Response(mensajeError, { status: 500 });
  }
}

function wrapText(text: string, maxWidth: number, fontSize: number, font: PDFFont): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
