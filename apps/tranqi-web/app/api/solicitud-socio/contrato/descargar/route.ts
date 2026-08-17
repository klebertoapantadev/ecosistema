import { obtenerPerfilActual } from "@eco/identidad";
import { obtenerSolicitudDetalle } from "../../../../../modulos/socios/consultas";
import { obtenerPlantillaContrato } from "../../../../../modulos/socios/acciones";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

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

    // Convertir líneas de Markdown a párrafos estructurados de OpenXML docx
    const lineas = textoInterpolado.split("\n");
    const docParagraphs: Paragraph[] = [];

    // Título Principal
    docParagraphs.push(
      new Paragraph({
        text: tituloContrato.toUpperCase(),
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
      })
    );

    function parseInlineFormatting(rawText: string): TextRun[] {
      const runs: TextRun[] = [];
      const parts = rawText.split(/(\*\*.*?\*\*)/g);

      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          runs.push(
            new TextRun({
              text: part.slice(2, -2),
              bold: true,
              font: "Calibri",
              size: 22,
            })
          );
        } else if (part.length > 0) {
          runs.push(
            new TextRun({
              text: part,
              font: "Calibri",
              size: 22,
            })
          );
        }
      }
      return runs;
    }

    for (const linea of lineas) {
      const trimmed = linea.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("# ")) {
        docParagraphs.push(
          new Paragraph({
            text: trimmed.replace(/^#\s+/, ""),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 200 },
          })
        );
      } else if (trimmed.startsWith("## ")) {
        docParagraphs.push(
          new Paragraph({
            text: trimmed.replace(/^##\s+/, ""),
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 140 },
          })
        );
      } else if (trimmed.startsWith("### ")) {
        docParagraphs.push(
          new Paragraph({
            text: trimmed.replace(/^###\s+/, ""),
            heading: HeadingLevel.HEADING_3,
            alignment: AlignmentType.LEFT,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        docParagraphs.push(
          new Paragraph({
            children: parseInlineFormatting(trimmed.replace(/^[-*]\s+/, "")),
            bullet: { level: 0 },
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 120, line: 320 },
          })
        );
      } else if (/^\d+\.\s+/.test(trimmed)) {
        docParagraphs.push(
          new Paragraph({
            children: parseInlineFormatting(trimmed.replace(/^\d+\.\s+/, "")),
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 120, line: 320 },
          })
        );
      } else {
        docParagraphs.push(
          new Paragraph({
            children: parseInlineFormatting(trimmed),
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 180, line: 340 },
          })
        );
      }
    }

    // Espaciado antes de las firmas
    docParagraphs.push(new Paragraph({ spacing: { before: 500, after: 200 } }));

    // Tabla de Firmas (2 columnas sin bordes)
    const tablaFirmas = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  text: "____________________________________",
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: "tranqi® Legal Network", bold: true, size: 22 })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: "Por la Plataforma y Consejo Directivo", size: 18, color: "666666" })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  text: "____________________________________",
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 100 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: nombreCompleto, bold: true, size: 22 })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: `Socio Abogado Postulante — C.I.: ${cedula}`, size: 18, color: "666666" })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 pulgada
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [...docParagraphs, tablaFirmas],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Contrato_Tranqi_${cedula}.docx"`,
      },
    });
  } catch (error: unknown) {
    const mensajeError = error instanceof Error ? error.message : "Error al generar el contrato";
    return new Response(mensajeError, { status: 500 });
  }
}
