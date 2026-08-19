import { PDFDocument, rgb, StandardFonts, PDFFont } from "pdf-lib";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { obtenerSolicitudDetalle, obtenerUltimaVersionContratoSocio } from "../../../../../modulos/socios/consultas";

async function generarPdfContrato({
  tituloContrato,
  contenidoContrato,
  nombreCompleto,
  cedula,
}: {
  tituloContrato: string;
  contenidoContrato: string;
  nombreCompleto: string;
  cedula: string;
}): Promise<Uint8Array> {
  const textoInterpolado = contenidoContrato
    .replace(/\{\{nombre_completo\}\}/g, nombreCompleto)
    .replace(/\{\{cedula\}\}/g, cedula);

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
  currentPage.drawRectangle({
    x: margin,
    y: currentY - 8,
    width: contentWidth,
    height: 4,
    color: rgb(0.31, 0, 0.73), // Púrpura Tranqi #5000BA
  });
  currentY -= 20;

  currentPage.drawText("tranqi® Legal Network · República del Ecuador", {
    x: margin,
    y: currentY,
    size: 8,
    font: fontBold,
    color: rgb(0.31, 0, 0.73),
  });

  currentPage.drawText("Plataforma Tecnológica de Servicios Jurídicos", {
    x: pageWidth - margin - 180,
    y: currentY,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });
  currentY -= 24;

  // Título del Contrato
  const tituloLineas = wrapText(tituloContrato.toUpperCase(), contentWidth, 11, fontBold);
  for (const line of tituloLineas) {
    checkPageBreak(20);
    const textWidth = fontBold.widthOfTextAtSize(line, 11);
    currentPage.drawText(line, {
      x: (pageWidth - textWidth) / 2,
      y: currentY,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= 15;
  }
  currentY -= 10;

  // Procesar párrafos de Markdown
  const lineas = textoInterpolado.split("\n");
  for (const rawLine of lineas) {
    const linea = rawLine.trim();

    if (!linea) {
      currentY -= 7;
      checkPageBreak(15);
      continue;
    }

    if (linea.startsWith("# ")) {
      checkPageBreak(30);
      currentY -= 10;
      const cleanTitle = linea.replace(/^#\s+/, "");
      currentPage.drawText(cleanTitle, {
        x: margin,
        y: currentY,
        size: 11,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      currentY -= 16;
    } else if (linea.startsWith("## ")) {
      checkPageBreak(25);
      currentY -= 8;
      const cleanTitle = linea.replace(/^##\s+/, "");
      currentPage.drawText(cleanTitle, {
        x: margin,
        y: currentY,
        size: 10,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15),
      });
      currentY -= 14;
    } else if (linea.startsWith("### ") || linea.startsWith("#### ")) {
      checkPageBreak(20);
      currentY -= 6;
      const cleanTitle = linea.replace(/^###+\s+/, "");
      currentPage.drawText(cleanTitle, {
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
  currentY -= 40;

  const colWidth = (contentWidth - 40) / 2;
  const col1X = margin;
  const col2X = margin + colWidth + 40;

  // Línea 1: Tranqi
  currentPage.drawLine({
    start: { x: col1X, y: currentY },
    end: { x: col1X + colWidth, y: currentY },
    thickness: 1,
    color: rgb(0.6, 0.6, 0.6),
  });

  // Línea 2: Socio Abogado
  currentPage.drawLine({
    start: { x: col2X, y: currentY },
    end: { x: col2X + colWidth, y: currentY },
    thickness: 1,
    color: rgb(0.6, 0.6, 0.6),
  });

  currentY -= 12;

  currentPage.drawText("tranqi® Legal Network", {
    x: col1X,
    y: currentY,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  currentPage.drawText(nombreCompleto, {
    x: col2X,
    y: currentY,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  currentY -= 10;

  currentPage.drawText("Por la Plataforma y Directorio", {
    x: col1X,
    y: currentY,
    size: 7.5,
    font: fontItalic,
    color: rgb(0.4, 0.4, 0.4),
  });

  currentPage.drawText(`Socio Abogado Postulante — C.I.: ${cedula}`, {
    x: col2X,
    y: currentY,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Numeración de páginas
  const totalPaginas = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPaginas; i++) {
    const p = pages[i];
    if (p) {
      p.drawText(`Página ${i + 1} de ${totalPaginas}`, {
        x: (pageWidth - 60) / 2,
        y: 25,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  }

  return await pdfDoc.save();
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

    // Verificar permisos
    const esPropietario = solicitud.ssc_usuario_id === perfil.usu_id;
    const esSuperAdmin = Boolean(perfil.usu_superadmin_plataforma);
    const perfilesUsu = await obtenerPerfiles("TRANQ");
    const esStaff =
      esSuperAdmin ||
      perfilesUsu.includes("ADMINISTRADOR") ||
      perfilesUsu.includes("SUPERADMIN") ||
      perfilesUsu.includes("OPERADOR");

    if (!esPropietario && !esStaff) {
      return new Response("Acceso denegado a este documento", { status: 403 });
    }

    // Obtener la última versión activa para esta solicitud
    const ultVersion = await obtenerUltimaVersionContratoSocio(solicitudId);
    const tituloContrato = ultVersion.titulo || "CONTRATO DE PRESTACIÓN DE SERVICIOS Y ASOCIACIÓN LEGAL";
    const contenidoContrato = ultVersion.contenido || "";

    const nombreCompleto = [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo || "—";
    const cedula = solicitud.ssc_cedula || "—";

    const pdfBytes = await generarPdfContrato({
      tituloContrato,
      contenidoContrato,
      nombreCompleto,
      cedula,
    });

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Contrato_Tranqi_${solicitud.ssc_cedula || "Socio"}.pdf"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al generar el PDF del contrato";
    return new Response(msg, { status: 500 });
  }
}

/**
 * POST /api/solicitud-socio/contrato/pdf
 * Permite previsualizar en tiempo real un borrador de Markdown editado por el operador antes de guardarlo.
 */
export async function POST(request: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) {
      return new Response("No autorizado: sesión no iniciada", { status: 401 });
    }

    const body = await request.json();
    const { solicitudId, titulo, contenidoMd } = body;

    if (!solicitudId || !contenidoMd) {
      return new Response("Datos incompletos para previsualización", { status: 400 });
    }

    const detalle = await obtenerSolicitudDetalle(solicitudId);
    if (!detalle || !detalle.solicitud) {
      return new Response("Solicitud no encontrada", { status: 404 });
    }

    const { solicitud, usuario } = detalle;
    const nombreCompleto = [usuario?.usu_nombres, usuario?.usu_apellidos].filter(Boolean).join(" ") || usuario?.usu_correo || "—";
    const cedula = solicitud.ssc_cedula || "—";

    const pdfBytes = await generarPdfContrato({
      tituloContrato: titulo || "CONTRATO DE PRESTACIÓN DE SERVICIOS Y ASOCIACIÓN LEGAL",
      contenidoContrato: contenidoMd,
      nombreCompleto,
      cedula,
    });

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al generar borrador PDF";
    return new Response(msg, { status: 500 });
  }
}
