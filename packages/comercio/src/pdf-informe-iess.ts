import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { DatosProveedorInformeIess, RegistroEntregaEvidencia } from "./operaciones-taller";

export interface OpcionesGenerarPdfInformeIess {
  numeroInforme: string;
  fechaInforme: string;
  fechaInicio: string;
  fechaFin: string;
  datosProveedor: DatosProveedorInformeIess;
  entregas: RegistroEntregaEvidencia[];
  facturaGlobal?: string | null;
  documentosAdjuntosGlobal?: string | null;
  incluirPortadaResumen?: boolean;
}

function limpiarWinAnsi(texto?: string | null): string {
  if (!texto) return "";
  return String(texto)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();
}

function formatearFechaCortaEc(isoODate?: string | null, incluirHora = false): string {
  if (!isoODate) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoODate)) {
    const [y, m, d] = isoODate.split("-");
    return `${Number(d)}/${Number(m)}/${y}`;
  }
  const f = new Date(isoODate);
  if (Number.isNaN(f.getTime())) return limpiarWinAnsi(isoODate);
  const base = f.toLocaleDateString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  if (!incluirHora) return limpiarWinAnsi(base);
  const hora = f.toLocaleTimeString("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
  });
  return limpiarWinAnsi(`${base} (${hora})`);
}

async function cargarImagenParaPdf(
  pdfDoc: PDFDocument,
  fuente?: string | null
): Promise<PDFImage | null> {
  if (!fuente || !fuente.trim()) return null;
  try {
    let bytes: Uint8Array;
    let mime = "";

    if (fuente.startsWith("data:image/")) {
      const coma = fuente.indexOf(",");
      if (coma < 0) return null;
      const meta = fuente.slice(5, coma).toLowerCase();
      mime = meta.split(";")[0] || "";
      const b64 = fuente.slice(coma + 1);
      if (typeof Buffer !== "undefined") {
        bytes = new Uint8Array(Buffer.from(b64, "base64"));
      } else {
        const bin = atob(b64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      }
    } else {
      const res = await fetch(fuente);
      if (!res.ok) return null;
      mime = (res.headers.get("content-type") || "").toLowerCase();
      const ab = await res.arrayBuffer();
      bytes = new Uint8Array(ab);
    }

    if (mime.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
      return await pdfDoc.embedPng(bytes);
    }
    return await pdfDoc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function dibujarFilaCampo(
  page: PDFPage,
  etiqueta: string,
  valor: string,
  y: number,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  xLabel = 65,
  xValor = 230
): number {
  const tam = 10.5;
  page.drawText(limpiarWinAnsi(etiqueta), {
    x: xLabel,
    y,
    size: tam,
    font: fontRegular,
    color: rgb(0.08, 0.08, 0.08),
  });

  const textoValor = limpiarWinAnsi(valor) || "-";
  const maxWidth = 535 - xValor;
  const palabras = textoValor.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";

  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (fontRegular.widthOfTextAtSize(prueba, tam) <= maxWidth) {
      actual = prueba;
    } else {
      if (actual) lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);

  let cursorY = y;
  for (let i = 0; i < lineas.length; i++) {
    page.drawText(lineas[i] || "", {
      x: xValor,
      y: cursorY,
      size: tam,
      font: i === 0 ? fontRegular : fontRegular,
      color: rgb(0.05, 0.05, 0.05),
    });
    if (i < lineas.length - 1) {
      cursorY -= 14;
    }
  }

  // Evitar advertencia de parámetro sin uso si se desea resaltar en el futuro
  void fontBold;
  return cursorY - 20;
}

/**
 * Genera en memoria (Uint8Array) el PDF oficial "INFORME DE SERVICIO PROVEEDORES"
 * replicando las 5 secciones del formato requerido por Exequiales del IESS,
 * con numeración del informe, carátula resumen opcional y 1 hoja oficial por entrega.
 */
export async function generarPdfInformeQuincenalIess(
  opciones: OpcionesGenerarPdfInformeIess
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const anchoPagina = 595.28; // A4
  const altoPagina = 841.89;
  const prov = opciones.datosProveedor;
  const tituloDoc = limpiarWinAnsi(prov.tituloInforme || "INFORME DE SERVICIO PROVEEDORES");

  // 1. Carátula Resumen Quincenal (cuando se incluye y hay entregas)
  if (opciones.incluirPortadaResumen && opciones.entregas.length > 0) {
    const portada = pdfDoc.addPage([anchoPagina, altoPagina]);
    let py = altoPagina - 60;

    portada.drawText(tituloDoc, {
      x: (anchoPagina - fontBold.widthOfTextAtSize(tituloDoc, 13)) / 2,
      y: py,
      size: 13,
      font: fontBold,
      color: rgb(0.05, 0.05, 0.05),
    });
    py -= 20;

    const subResumen = limpiarWinAnsi(
      `RESUMEN QUINCENAL DE ENTREGAS GEORREFERENCIADAS - INFORME N. ${opciones.numeroInforme}`
    );
    portada.drawText(subResumen, {
      x: (anchoPagina - fontBold.widthOfTextAtSize(subResumen, 10)) / 2,
      y: py,
      size: 10,
      font: fontBold,
      color: rgb(0.25, 0.35, 0.28),
    });
    py -= 30;

    portada.drawRectangle({
      x: 55,
      y: py - 88,
      width: anchoPagina - 110,
      height: 96,
      color: rgb(0.97, 0.98, 0.97),
      borderColor: rgb(0.82, 0.85, 0.83),
      borderWidth: 1,
    });

    py -= 16;
    portada.drawText(
      limpiarWinAnsi(`Proveedor: ${prov.razonSocial} (${prov.nombreProveedor}) - RUC: ${prov.ruc}`),
      { x: 68, y: py, size: 9.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) }
    );
    py -= 16;
    portada.drawText(
      limpiarWinAnsi(
        `Periodo Evaluado: Del ${formatearFechaCortaEc(opciones.fechaInicio)} al ${formatearFechaCortaEc(opciones.fechaFin)}`
      ),
      { x: 68, y: py, size: 9.5, font: fontRegular, color: rgb(0.15, 0.15, 0.15) }
    );
    py -= 16;
    portada.drawText(
      limpiarWinAnsi(
        `Fecha de Emision del Informe: ${formatearFechaCortaEc(opciones.fechaInforme)}   |   Total Servicios Entregados: ${opciones.entregas.length}`
      ),
      { x: 68, y: py, size: 9.5, font: fontRegular, color: rgb(0.15, 0.15, 0.15) }
    );
    py -= 16;
    portada.drawText(
      limpiarWinAnsi(
        `Contacto: ${prov.personaContacto} (${prov.telefono} / ${prov.correoElectronico})`
      ),
      { x: 68, y: py, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) }
    );
    py -= 36;

    // Encabezado de tabla resumen
    portada.drawRectangle({
      x: 55,
      y: py - 6,
      width: anchoPagina - 110,
      height: 20,
      color: rgb(0.18, 0.27, 0.21),
    });
    portada.drawText("#", { x: 62, y: py, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
    portada.drawText("Fecha / Hora", {
      x: 84,
      y: py,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    portada.drawText("Fallecido / Servicio", {
      x: 175,
      y: py,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    portada.drawText("Ubicacion / Funeraria", {
      x: 345,
      y: py,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    portada.drawText("Entregado por", {
      x: 465,
      y: py,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    py -= 20;

    for (let idx = 0; idx < opciones.entregas.length; idx++) {
      if (py < 95) break;
      const e = opciones.entregas[idx]!;
      portada.drawText(String(idx + 1), { x: 62, y: py, size: 8, font: fontRegular });
      portada.drawText(formatearFechaCortaEc(e.fechaServicio, true).slice(0, 18), {
        x: 84,
        y: py,
        size: 8,
        font: fontRegular,
      });
      portada.drawText(limpiarWinAnsi(e.fallecidoDestinatario).slice(0, 32), {
        x: 175,
        y: py,
        size: 8,
        font: fontBold,
      });
      portada.drawText(limpiarWinAnsi(e.ubicacionNombre).slice(0, 22), {
        x: 345,
        y: py,
        size: 8,
        font: fontRegular,
      });
      portada.drawText(limpiarWinAnsi(e.entregadorNombre).slice(0, 15), {
        x: 465,
        y: py,
        size: 8,
        font: fontRegular,
      });
      portada.drawLine({
        start: { x: 55, y: py - 4 },
        end: { x: anchoPagina - 55, y: py - 4 },
        thickness: 0.4,
        color: rgb(0.88, 0.9, 0.89),
      });
      py -= 15;
    }

    portada.drawLine({
      start: { x: 65, y: 78 },
      end: { x: 225, y: 78 },
      thickness: 0.8,
      color: rgb(0.2, 0.2, 0.2),
    });
    portada.drawText("Firma del Proveedor", { x: 65, y: 64, size: 10, font: fontRegular });

    portada.drawLine({
      start: { x: 355, y: 78 },
      end: { x: 515, y: 78 },
      thickness: 0.8,
      color: rgb(0.2, 0.2, 0.2),
    });
    portada.drawText("Firma del responsable", { x: 355, y: 64, size: 10, font: fontRegular });
  }

  // 2. Fichas Oficiales Individuales (1 página por entrega, idéntica al formato requerido)
  for (let idx = 0; idx < opciones.entregas.length; idx++) {
    const entrega = opciones.entregas[idx]!;
    const page = pdfDoc.addPage([anchoPagina, altoPagina]);
    let y = altoPagina - 48;

    // Marca superior discreta de numeración de informe y folio
    const metaSup = limpiarWinAnsi(
      `Informe: ${opciones.numeroInforme}  |  Emision: ${formatearFechaCortaEc(opciones.fechaInforme)}  |  Servicio ${idx + 1} de ${opciones.entregas.length}`
    );
    page.drawText(metaSup, {
      x: anchoPagina - 65 - fontRegular.widthOfTextAtSize(metaSup, 7.8),
      y: altoPagina - 28,
      size: 7.8,
      font: fontRegular,
      color: rgb(0.45, 0.45, 0.45),
    });

    // Título principal centrado
    const wTitulo = fontBold.widthOfTextAtSize(tituloDoc, 11.5);
    page.drawText(tituloDoc, {
      x: (anchoPagina - wTitulo) / 2,
      y,
      size: 11.5,
      font: fontBold,
      color: rgb(0.03, 0.03, 0.03),
    });
    y -= 24;

    // 1. Información General del Proveedor
    page.drawText("1.    Informacion General del Proveedor", {
      x: 65,
      y,
      size: 10.5,
      font: fontBold,
    });
    y -= 20;

    y = dibujarFilaCampo(page, "Nombre del Proveedor:", prov.nombreProveedor, y, fontRegular, fontBold);
    y = dibujarFilaCampo(page, "Razon Social:", prov.razonSocial, y, fontRegular, fontBold);
    y = dibujarFilaCampo(page, "RUC:", prov.ruc, y, fontRegular, fontBold);
    y = dibujarFilaCampo(page, "Direccion:", prov.direccion, y, fontRegular, fontBold);
    y = dibujarFilaCampo(page, "Telefono:", prov.telefono, y, fontRegular, fontBold);
    y = dibujarFilaCampo(page, "Correo Electronico:", prov.correoElectronico, y, fontRegular, fontBold);
    y = dibujarFilaCampo(page, "Persona de Contacto:", prov.personaContacto, y, fontRegular, fontBold);

    y -= 4;

    // 2. Información del Servicio Brindado
    page.drawText("2.    Informacion del Servicio Brindado", {
      x: 65,
      y,
      size: 10.5,
      font: fontBold,
    });
    y -= 20;

    y = dibujarFilaCampo(
      page,
      "Nombre del Fallecido:",
      entrega.fallecidoDestinatario,
      y,
      fontRegular,
      fontBold
    );
    y = dibujarFilaCampo(
      page,
      "Fecha del Servicio:",
      formatearFechaCortaEc(entrega.fechaServicio, true),
      y,
      fontRegular,
      fontBold
    );
    y = dibujarFilaCampo(
      page,
      "Descripcion del Servicio:",
      entrega.descripcionServicio,
      y,
      fontRegular,
      fontBold
    );
    const ubicacionConSala = [entrega.salaServicio, entrega.ubicacionNombre || entrega.direccionGps]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(" — ");

    y = dibujarFilaCampo(
      page,
      "Ubicacion del Servicio:",
      ubicacionConSala || "-",
      y,
      fontRegular,
      fontBold
    );
    y = dibujarFilaCampo(
      page,
      "Coordinador del Servicio:",
      entrega.coordinadorNombre || "-",
      y,
      fontRegular,
      fontBold
    );
    y = dibujarFilaCampo(
      page,
      "Equipo y Recursos Utilizados:",
      entrega.recursosUtilizados || prov.recursosDefecto || "Flores, follaje, bases y oasis",
      y,
      fontRegular,
      fontBold
    );

    y -= 4;

    // 3. Documentación y Evidencia del Servicio
    page.drawText("3.    Documentacion y Evidencia del Servicio", {
      x: 65,
      y,
      size: 10.5,
      font: fontBold,
    });
    y -= 18;

    const refFactura =
      entrega.facturaReferencia || opciones.facturaGlobal || "";
    page.drawText(
      limpiarWinAnsi(
        `Factura o Comprobante de Pago:${refFactura ? `   ${refFactura}` : ""}`
      ),
      { x: 65, y, size: 10.5, font: fontRegular }
    );
    y -= 18;

    page.drawText("Fotografias:", { x: 65, y, size: 10.5, font: fontRegular });
    y -= 10;

    // Bloque de imágenes lado a lado (Foto del arreglo + Mapa GPS)
    const altoCajaFotos = 152;
    const baseFotosY = y - altoCajaFotos;

    const [imgFoto, imgMapa] = await Promise.all([
      cargarImagenParaPdf(pdfDoc, entrega.fotoUrl),
      cargarImagenParaPdf(pdfDoc, entrega.mapaUrl),
    ]);

    if (imgFoto) {
      const dims = imgFoto.scaleToFit(245, altoCajaFotos);
      page.drawImage(imgFoto, {
        x: 115 + (245 - dims.width) / 2,
        y: baseFotosY + (altoCajaFotos - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    } else {
      page.drawRectangle({
        x: 115,
        y: baseFotosY,
        width: 245,
        height: altoCajaFotos,
        color: rgb(0.95, 0.96, 0.95),
        borderColor: rgb(0.8, 0.82, 0.8),
        borderWidth: 0.8,
      });
      page.drawText("Sin fotografia adjunta", {
        x: 185,
        y: baseFotosY + altoCajaFotos / 2,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    if (imgMapa) {
      const dimsM = imgMapa.scaleToFit(120, altoCajaFotos);
      page.drawImage(imgMapa, {
        x: 368,
        y: baseFotosY + (altoCajaFotos - dimsM.height) / 2,
        width: dimsM.width,
        height: dimsM.height,
      });
    } else if (entrega.latitud != null && entrega.longitud != null) {
      // Tarjeta visual de respaldo GPS cuando se genera sin imagen estática de mapa
      page.drawRectangle({
        x: 368,
        y: baseFotosY,
        width: 125,
        height: altoCajaFotos,
        color: rgb(0.11, 0.2, 0.27),
        borderColor: rgb(0.2, 0.35, 0.45),
        borderWidth: 1,
      });
      page.drawText("GEORREFERENCIA GPS", {
        x: 378,
        y: baseFotosY + altoCajaFotos - 24,
        size: 8.2,
        font: fontBold,
        color: rgb(0.55, 0.92, 0.75),
      });
      page.drawText(`Lat: ${Number(entrega.latitud).toFixed(6)}`, {
        x: 378,
        y: baseFotosY + altoCajaFotos - 48,
        size: 8.5,
        font: fontRegular,
        color: rgb(1, 1, 1),
      });
      page.drawText(`Lng: ${Number(entrega.longitud).toFixed(6)}`, {
        x: 378,
        y: baseFotosY + altoCajaFotos - 64,
        size: 8.5,
        font: fontRegular,
        color: rgb(1, 1, 1),
      });
      if (entrega.precisionMetros) {
        page.drawText(`Precision: +/-${Math.round(Number(entrega.precisionMetros))} m`, {
          x: 378,
          y: baseFotosY + altoCajaFotos - 82,
          size: 7.8,
          font: fontRegular,
          color: rgb(0.8, 0.86, 0.92),
        });
      }
      page.drawText(limpiarWinAnsi(`Entrega: ${entrega.entregadorNombre}`).slice(0, 22), {
        x: 378,
        y: baseFotosY + 24,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.85, 0.9, 0.95),
      });
    }

    y = baseFotosY - 18;

    const textoGpsLinea =
      entrega.latitud != null && entrega.longitud != null
        ? `Lat ${Number(entrega.latitud).toFixed(6)}, Lng ${Number(entrega.longitud).toFixed(6)} - Entregado por: ${entrega.entregadorNombre} (maps.google.com/?q=${Number(entrega.latitud).toFixed(6)},${Number(entrega.longitud).toFixed(6)})`
        : entrega.direccionGps || `Registrado por: ${entrega.entregadorNombre}`;

    page.drawText("Ubicacion en tiempo real con GPS (en caso de transportistas):", {
      x: 65,
      y,
      size: 10,
      font: fontRegular,
    });
    y -= 14;
    page.drawText(limpiarWinAnsi(textoGpsLinea).slice(0, 96), {
      x: 65,
      y,
      size: 8.8,
      font: fontRegular,
      color: rgb(0.15, 0.28, 0.45),
    });
    y -= 20;

    // 4. Documentos Adjuntos
    const docsAdj = entrega.documentosAdjuntos || opciones.documentosAdjuntosGlobal || "";
    page.drawText(
      limpiarWinAnsi(`4.    Documentos Adjuntos:${docsAdj ? `   ${docsAdj}` : ""}`),
      {
        x: 65,
        y,
        size: 10.5,
        font: fontBold,
      }
    );
    y -= 20;

    // 5. Firmas de Recepción
    page.drawText("5.    Firmas de Recepcion", {
      x: 65,
      y,
      size: 10.5,
      font: fontBold,
    });

    const yFirma = Math.max(46, y - 56);
    page.drawLine({
      start: { x: 65, y: yFirma + 14 },
      end: { x: 215, y: yFirma + 14 },
      thickness: 0.7,
      color: rgb(0.25, 0.25, 0.25),
    });
    page.drawText("Firma del Proveedor", {
      x: 65,
      y: yFirma,
      size: 10,
      font: fontRegular,
    });

    page.drawLine({
      start: { x: 355, y: yFirma + 14 },
      end: { x: 505, y: yFirma + 14 },
      thickness: 0.7,
      color: rgb(0.25, 0.25, 0.25),
    });
    page.drawText("Firma del responsable", {
      x: 355,
      y: yFirma,
      size: 10,
      font: fontRegular,
    });
  }

  return await pdfDoc.save();
}
