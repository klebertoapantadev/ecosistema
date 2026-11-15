// Generador de PDF A4 para Proformas de Eventos + Envío de Correo con Adjuntos PDF
// (Original + Actualización de Asesor). Usa `pdf-lib` puro sin dependencias nativas.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { ProformaEventoPublica } from "./acciones-logistica";

/**
 * Normaliza texto para la codificación WinAnsi de las fuentes estándar de `pdf-lib`,
 * conservando tildes y eñes del español y sustituyendo emojis o guiones largos fuera de rango.
 */
export function textoSeguroPdf(entrada: string | number | null | undefined): string {
  const base = String(entrada ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // WinAnsi soporta ASCII imprimible (32-126) y Latin-1 suplementario (160-255: áéíóúñÑ¿¡°·)
  let salida = "";
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      salida += base[i];
    }
  }
  return salida.replace(/\s+/g, " ").trim();
}

function envolverLineas(
  texto: string,
  fuente: PDFFont,
  tamano: number,
  anchoMax: number
): string[] {
  const limpio = textoSeguroPdf(texto);
  if (!limpio) return [""];
  const palabras = limpio.split(" ");
  const lineas: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(candidato, tamano) <= anchoMax) {
      actual = candidato;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : [limpio];
}

function formatearFechaCorta(iso: string | undefined): string {
  if (!iso) return "Por confirmar";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return textoSeguroPdf(iso);
  return d.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function sumarDiasFecha(iso: string | undefined, dias: number): string {
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime())) return `${dias} dias`;
  base.setDate(base.getDate() + dias);
  return base.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export async function generarPdfProformaBytes(
  proforma: ProformaEventoPublica,
  opciones?: { urlPublica?: string }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const anchoPagina = 595.28; // A4 puntos
  const altoPagina = 841.89;
  const margenX = 42;
  const anchoUtil = anchoPagina - margenX * 2;

  const colorBosque = rgb(0.176, 0.278, 0.204); // #2D4734 Tinkay
  const colorDorado = rgb(0.706, 0.525, 0.235);
  const colorTexto = rgb(0.11, 0.12, 0.14);
  const colorGris = rgb(0.38, 0.42, 0.46);
  const colorBorde = rgb(0.86, 0.88, 0.86);
  const colorFondoSuave = rgb(0.965, 0.975, 0.965);

  let pagina: PDFPage = doc.addPage([anchoPagina, altoPagina]);
  let y = altoPagina - 42;

  const nombreMarca =
    proforma.negocio === "tinkay"
      ? "TINKAY FLORISTERIA & EVENTOS"
      : `${proforma.negocio.toUpperCase()} COMERCIO`;

  const versionNum = proforma.versionNumero ?? 1;
  const etiquetaVersion = textoSeguroPdf(
    proforma.etiquetaVersion ||
      (proforma.esOriginal !== false && versionNum === 1
        ? "Version 1 - Original (Autoservicio)"
        : `Variacion V${versionNum} - Propuesta Actualizada`)
  );

  // Encabezado superior botánico
  pagina.drawRectangle({
    x: 0,
    y: altoPagina - 96,
    width: anchoPagina,
    height: 96,
    color: colorBosque,
  });

  pagina.drawText(textoSeguroPdf(nombreMarca), {
    x: margenX,
    y: altoPagina - 42,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  pagina.drawText("PROFORMA DE EVENTOS Y DECORACION BOTANICA", {
    x: margenX,
    y: altoPagina - 60,
    size: 9.5,
    font: fontReg,
    color: rgb(0.88, 0.93, 0.88),
  });

  pagina.drawText(etiquetaVersion, {
    x: margenX,
    y: altoPagina - 77,
    size: 9,
    font: fontBold,
    color: rgb(0.99, 0.91, 0.62),
  });

  const codigoTexto = textoSeguroPdf(proforma.codigoProforma);
  const anchoCodigo = fontBold.widthOfTextAtSize(codigoTexto, 14);
  pagina.drawText(codigoTexto, {
    x: anchoPagina - margenX - anchoCodigo,
    y: altoPagina - 44,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const emisionTxt = `Emision: ${formatearFechaCorta(proforma.creadoEn)}`;
  const vigenciaTxt = `Valida hasta: ${sumarDiasFecha(proforma.creadoEn, proforma.vigenciaDias || 15)}`;
  pagina.drawText(textoSeguroPdf(emisionTxt), {
    x: anchoPagina - margenX - fontReg.widthOfTextAtSize(textoSeguroPdf(emisionTxt), 8.5),
    y: altoPagina - 62,
    size: 8.5,
    font: fontReg,
    color: rgb(0.9, 0.94, 0.9),
  });
  pagina.drawText(textoSeguroPdf(vigenciaTxt), {
    x: anchoPagina - margenX - fontReg.widthOfTextAtSize(textoSeguroPdf(vigenciaTxt), 8.5),
    y: altoPagina - 76,
    size: 8.5,
    font: fontReg,
    color: rgb(0.99, 0.91, 0.62),
  });

  y = altoPagina - 118;

  // Bloque Cliente y Evento (2 columnas)
  const altoCajaInfo = 104;
  pagina.drawRectangle({
    x: margenX,
    y: y - altoCajaInfo,
    width: anchoUtil,
    height: altoCajaInfo,
    color: colorFondoSuave,
    borderColor: colorBorde,
    borderWidth: 0.8,
  });

  const colIzqX = margenX + 12;
  const colDerX = margenX + anchoUtil / 2 + 8;
  let yIzq = y - 18;
  let yDer = y - 18;

  pagina.drawText("DATOS DEL CLIENTE", {
    x: colIzqX,
    y: yIzq,
    size: 8.5,
    font: fontBold,
    color: colorBosque,
  });
  yIzq -= 15;
  pagina.drawText(textoSeguroPdf(`Cliente: ${proforma.comprador.nombreCompleto}`).slice(0, 52), {
    x: colIzqX,
    y: yIzq,
    size: 9,
    font: fontBold,
    color: colorTexto,
  });
  yIzq -= 13;
  pagina.drawText(
    textoSeguroPdf(`CI / RUC: ${proforma.comprador.identificacion || "Consumidor"}`),
    { x: colIzqX, y: yIzq, size: 8.5, font: fontReg, color: colorGris }
  );
  yIzq -= 13;
  pagina.drawText(textoSeguroPdf(`Correo: ${proforma.comprador.correo}`).slice(0, 54), {
    x: colIzqX,
    y: yIzq,
    size: 8.5,
    font: fontReg,
    color: colorGris,
  });
  yIzq -= 13;
  pagina.drawText(
    textoSeguroPdf(
      `WhatsApp: ${proforma.comprador.whatsapp || "No indicado (enviado por correo)"}`
    ),
    {
      x: colIzqX,
      y: yIzq,
      size: 8.5,
      font: fontReg,
      color: colorGris,
    }
  );

  pagina.drawText("DETALLES DEL EVENTO", {
    x: colDerX,
    y: yDer,
    size: 8.5,
    font: fontBold,
    color: colorBosque,
  });
  yDer -= 15;
  pagina.drawText(
    textoSeguroPdf(
      `Evento: ${proforma.evento.tipoEvento}${
        proforma.evento.invitadosEstimados ? ` (${proforma.evento.invitadosEstimados} inv.)` : ""
      }`
    ).slice(0, 50),
    { x: colDerX, y: yDer, size: 9, font: fontBold, color: colorTexto }
  );
  yDer -= 13;
  pagina.drawText(
    textoSeguroPdf(
      `Fecha: ${proforma.evento.fechaEvento || "Por definir"}${
        proforma.evento.horaEvento ? ` - ${proforma.evento.horaEvento}` : ""
      }`
    ),
    { x: colDerX, y: yDer, size: 8.5, font: fontReg, color: colorGris }
  );
  yDer -= 13;
  const locacionCorta = proforma.ubicacion.retiroEnLocal
    ? "Retiro en Tienda Tinkay (Quito)"
    : proforma.ubicacion.direccion || "Locacion por confirmar";
  pagina.drawText(textoSeguroPdf(`Locacion: ${locacionCorta}`).slice(0, 50), {
    x: colDerX,
    y: yDer,
    size: 8.5,
    font: fontReg,
    color: colorGris,
  });
  if (proforma.evento.paletaColores) {
    yDer -= 13;
    pagina.drawText(textoSeguroPdf(`Paleta: ${proforma.evento.paletaColores}`).slice(0, 50), {
      x: colDerX,
      y: yDer,
      size: 8.5,
      font: fontReg,
      color: colorGris,
    });
  }

  y -= altoCajaInfo + 14;

  // Nota del asesor (si es actualización o incluye observaciones comerciales)
  if (proforma.notaAsesor) {
    const lineasNota = envolverLineas(proforma.notaAsesor, fontReg, 8.8, anchoUtil - 24).slice(0, 3);
    const altoNota = 24 + lineasNota.length * 12;
    pagina.drawRectangle({
      x: margenX,
      y: y - altoNota,
      width: anchoUtil,
      height: altoNota,
      color: rgb(0.995, 0.975, 0.92),
      borderColor: colorDorado,
      borderWidth: 0.8,
    });
    pagina.drawText(
      textoSeguroPdf(
        `NOTA DEL ASESOR DE EVENTOS${proforma.asesorNombre ? ` (${proforma.asesorNombre})` : ""}:`
      ),
      {
        x: margenX + 12,
        y: y - 14,
        size: 8.5,
        font: fontBold,
        color: colorDorado,
      }
    );
    let yN = y - 27;
    for (const ln of lineasNota) {
      pagina.drawText(ln, {
        x: margenX + 12,
        y: yN,
        size: 8.8,
        font: fontReg,
        color: colorTexto,
      });
      yN -= 12;
    }
    y -= altoNota + 14;
  }

  // Cabecera Tabla de Ítems
  const dibujarCabeceraTabla = (pag: PDFPage, posY: number): number => {
    pag.drawRectangle({
      x: margenX,
      y: posY - 22,
      width: anchoUtil,
      height: 22,
      color: colorBosque,
    });
    pag.drawText("CANT.", { x: margenX + 8, y: posY - 14, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
    pag.drawText("DESCRIPCION DEL ARREGLO / SERVICIO", {
      x: margenX + 52,
      y: posY - 14,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    pag.drawText("IVA", { x: margenX + 336, y: posY - 14, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
    pag.drawText("P. UNIT.", {
      x: margenX + 382,
      y: posY - 14,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    pag.drawText("SUBTOTAL", {
      x: margenX + 448,
      y: posY - 14,
      size: 8.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    return posY - 22;
  };

  y = dibujarCabeceraTabla(pagina, y);

  for (let idx = 0; idx < proforma.items.length; idx++) {
    const it = proforma.items[idx]!;
    const lineasDesc = envolverLineas(it.descripcion, fontReg, 9, 272).slice(0, 3);
    const altoFila = Math.max(22, lineasDesc.length * 12 + 10);

    if (y - altoFila < 175) {
      pagina = doc.addPage([anchoPagina, altoPagina]);
      y = dibujarCabeceraTabla(pagina, altoPagina - 48);
    }

    if (idx % 2 === 1) {
      pagina.drawRectangle({
        x: margenX,
        y: y - altoFila,
        width: anchoUtil,
        height: altoFila,
        color: rgb(0.98, 0.985, 0.98),
      });
    }

    pagina.drawLine({
      start: { x: margenX, y: y - altoFila },
      end: { x: margenX + anchoUtil, y: y - altoFila },
      thickness: 0.5,
      color: colorBorde,
    });

    pagina.drawText(String(it.cantidad), {
      x: margenX + 12,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: colorTexto,
    });

    let yDesc = y - 14;
    for (const l of lineasDesc) {
      pagina.drawText(l, {
        x: margenX + 52,
        y: yDesc,
        size: 8.8,
        font: fontReg,
        color: colorTexto,
      });
      yDesc -= 12;
    }

    const etqIva = it.impuesto.includes("15") ? "15%" : "0%";
    pagina.drawText(etqIva, {
      x: margenX + 338,
      y: y - 15,
      size: 8.5,
      font: fontReg,
      color: colorGris,
    });

    pagina.drawText(`$${it.precioUnitario.toFixed(2)}`, {
      x: margenX + 382,
      y: y - 15,
      size: 8.8,
      font: fontReg,
      color: colorTexto,
    });

    pagina.drawText(`$${it.totalLinea.toFixed(2)}`, {
      x: margenX + 448,
      y: y - 15,
      size: 9,
      font: fontBold,
      color: colorTexto,
    });

    y -= altoFila;
  }

  if (y < 210) {
    pagina = doc.addPage([anchoPagina, altoPagina]);
    y = altoPagina - 54;
  }

  y -= 16;

  // Bloque Totales SRI + Reserva 70%
  const xResumen = margenX + 275;
  const anchoResumen = anchoUtil - 275;

  const dibujarFilaTotal = (etiqueta: string, valor: string, destacado = false) => {
    pagina.drawText(textoSeguroPdf(etiqueta), {
      x: xResumen,
      y,
      size: destacado ? 10.5 : 9,
      font: destacado ? fontBold : fontReg,
      color: destacado ? colorBosque : colorGris,
    });
    const valSeguro = textoSeguroPdf(valor);
    const anchoVal = (destacado ? fontBold : fontReg).widthOfTextAtSize(
      valSeguro,
      destacado ? 11 : 9
    );
    pagina.drawText(valSeguro, {
      x: xResumen + anchoResumen - anchoVal,
      y,
      size: destacado ? 11 : 9,
      font: destacado ? fontBold : fontReg,
      color: destacado ? colorBosque : colorTexto,
    });
    y -= destacado ? 18 : 14;
  };

  dibujarFilaTotal("Subtotal Tarifa 0% (Flores naturales):", `$${proforma.baseIva0.toFixed(2)}`);
  if (proforma.baseIvaGravada > 0) {
    dibujarFilaTotal("Subtotal Gravado 15%:", `$${proforma.baseIvaGravada.toFixed(2)}`);
  }
  if (proforma.descuento > 0) {
    dibujarFilaTotal("Descuento comercial / volumen:", `-$${proforma.descuento.toFixed(2)}`);
  }
  dibujarFilaTotal(
    "Logistica / Transporte Evento:",
    proforma.flete === 0 ? "Incluido ($0.00)" : `$${proforma.flete.toFixed(2)}`
  );
  dibujarFilaTotal("IVA (15%):", `$${proforma.iva.toFixed(2)}`);

  pagina.drawLine({
    start: { x: xResumen, y: y + 6 },
    end: { x: xResumen + anchoResumen, y: y + 6 },
    thickness: 1,
    color: colorBosque,
  });
  y -= 6;

  dibujarFilaTotal("TOTAL PROFORMA (USD):", `$${proforma.total.toFixed(2)}`, true);
  dibujarFilaTotal(
    "Abono sugerido Reserva de Fecha (70%):",
    `$${proforma.montoReserva70Usd.toFixed(2)}`
  );

  // Notas del cliente e instrucciones de reserva en columna izquierda inferior
  const yPie = 92;
  pagina.drawLine({
    start: { x: margenX, y: yPie + 18 },
    end: { x: margenX + anchoUtil, y: yPie + 18 },
    thickness: 0.6,
    color: colorBorde,
  });

  pagina.drawText(
    "CONDICIONES DE RESERVA: Puedes congelar la fecha de tu evento abonando el 70% con tarjeta (PLUX) o transferencia, o realizar el pago del 100%.",
    {
      x: margenX,
      y: yPie + 4,
      size: 7.8,
      font: fontReg,
      color: colorGris,
    }
  );

  if (opciones?.urlPublica) {
    pagina.drawText(textoSeguroPdf(`Revisa tus variaciones y paga en linea: ${opciones.urlPublica}`), {
      x: margenX,
      y: yPie - 10,
      size: 8,
      font: fontBold,
      color: colorBosque,
    });
  }

  return await doc.save();
}

function uint8ABase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function escaparHtmlCorreo(texto: string): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Envía al correo del cliente su proforma en PDF:
 * - Si es autoservicio inicial (`V1`), adjunta el PDF de la proforma original.
 * - Si es actualización del asesor (`V2+`), adjunta TANTO el PDF de la Proforma Original (`V1`)
 *   COMO el PDF de la Proforma Actualizada (`V2+`), junto con el enlace para comparar variaciones,
 *   descartar las no aceptadas y pagar la elegida.
 */
export async function enviarCorreoProformaEvento(params: {
  proformaActual: ProformaEventoPublica;
  proformaOriginal?: ProformaEventoPublica | null;
  urlBaseApp?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { proformaActual, proformaOriginal } = params;
  const correoDestino = (proformaActual.comprador.correo || "").trim();
  if (!correoDestino.includes("@")) {
    return { ok: false, error: "El cliente no tiene un correo electrónico válido." };
  }

  const baseApp = (
    params.urlBaseApp ||
    process.env.NEXT_PUBLIC_TINKAY_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://tinkay-web.vercel.app"
  ).replace(/\/$/, "");

  const urlInteractiva = `${baseApp}/proforma/${proformaActual.tokenAprobacion}`;
  const urlPdfActual = `${baseApp}/api/proforma/${proformaActual.tokenAprobacion}/pdf`;
  const esActualizacion = Boolean(
    proformaOriginal && proformaOriginal.id !== proformaActual.id
  );

  try {
    const pdfActualBytes = await generarPdfProformaBytes(proformaActual, {
      urlPublica: urlInteractiva,
    });

    const adjuntos: Array<{
      filename: string;
      content: string;
      contentType: string;
      encoding: "base64";
    }> = [];

    if (esActualizacion && proformaOriginal) {
      const urlOriginal = `${baseApp}/proforma/${proformaOriginal.tokenAprobacion}`;
      const pdfOriginalBytes = await generarPdfProformaBytes(proformaOriginal, {
        urlPublica: urlOriginal,
      });
      adjuntos.push({
        filename: `Proforma_Original_${proformaOriginal.codigoProforma}.pdf`,
        content: uint8ABase64(pdfOriginalBytes),
        contentType: "application/pdf",
        encoding: "base64",
      });
    }

    adjuntos.push({
      filename: esActualizacion
        ? `Proforma_Actualizada_${proformaActual.codigoProforma}.pdf`
        : `Proforma_${proformaActual.codigoProforma}.pdf`,
      content: uint8ABase64(pdfActualBytes),
      contentType: "application/pdf",
      encoding: "base64",
    });

    const asunto = esActualizacion
      ? `Tinkay Eventos — Actualización de Proforma ${proformaActual.codigoProforma} (Original + Nueva Variación en PDF)`
      : `Tinkay Eventos — Tu Proforma ${proformaActual.codigoProforma} en PDF`;

    const bloqueComparativo =
      esActualizacion && proformaOriginal
        ? `
      <div style="margin:18px 0;padding:16px;border-radius:12px;background:#F8FAF8;border:1px solid #DCE4DC;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2D4734;text-transform:uppercase;">
          Comparativa de Variaciones Adjuntas en PDF
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1F2937;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;">
              <strong>1. Proforma Original (${escaparHtmlCorreo(proformaOriginal.codigoProforma)}):</strong>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #E5E7EB;text-align:right;">
              $${proformaOriginal.total.toFixed(2)} USD
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <strong>2. Propuesta Actualizada (${escaparHtmlCorreo(proformaActual.codigoProforma)}):</strong>
              <br/><span style="font-size:12px;color:#4B5563;">${escaparHtmlCorreo(
                proformaActual.etiquetaVersion || `Variación V${proformaActual.versionNumero ?? 2}`
              )}</span>
            </td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#2D4734;">
              $${proformaActual.total.toFixed(2)} USD
            </td>
          </tr>
        </table>
      </div>`
        : "";

    const bloqueNotaAsesor = proformaActual.notaAsesor
      ? `
      <div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#FFFBEB;border:1px solid #FCD34D;color:#78350F;font-size:14px;">
        <strong>Nota de tu asesor de eventos:</strong><br/>
        ${escaparHtmlCorreo(proformaActual.notaAsesor)}
      </div>`
      : "";

    const linksDescargaHtml =
      esActualizacion && proformaOriginal
        ? `
      <p style="margin:16px 0 6px;font-size:13px;color:#4B5563;">
        Además de los archivos PDF adjuntos en este correo, puedes descargarlos directamente aquí:
      </p>
      <p style="margin:0 0 18px;font-size:13px;">
        <a href="${baseApp}/api/proforma/${proformaOriginal.tokenAprobacion}/pdf" style="color:#2D4734;font-weight:700;margin-right:16px;">Descargar PDF Original (${escaparHtmlCorreo(proformaOriginal.codigoProforma)})</a>
        <a href="${urlPdfActual}" style="color:#2D4734;font-weight:700;">Descargar PDF Actualizado (${escaparHtmlCorreo(proformaActual.codigoProforma)})</a>
      </p>`
        : `
      <p style="margin:14px 0;font-size:13px;">
        <a href="${urlPdfActual}" style="color:#2D4734;font-weight:700;">Descargar copia en PDF (${escaparHtmlCorreo(proformaActual.codigoProforma)})</a>
      </p>`;

    const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#1F2937;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;">
      <div style="background:#2D4734;color:#FFFFFF;padding:20px 24px;border-radius:12px;margin-bottom:20px;">
        <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#FDE68A;">
          Tinkay Floristería &amp; Eventos
        </p>
        <h2 style="margin:6px 0 0;font-size:20px;font-weight:700;">
          ${
            esActualizacion
              ? `Actualizamos tu Proforma (${escaparHtmlCorreo(proformaActual.codigoProforma)})`
              : `Tu Proforma de Evento (${escaparHtmlCorreo(proformaActual.codigoProforma)})`
          }
        </h2>
      </div>

      <p style="font-size:15px;line-height:1.6;">
        Hola <strong>${escaparHtmlCorreo(proformaActual.comprador.nombreCompleto)}</strong>,
      </p>
      <p style="font-size:14px;line-height:1.6;color:#374151;">
        ${
          esActualizacion
            ? "Hemos preparado una nueva variación de tu proforma para tu evento. Adjuntamos en este correo tanto el PDF de tu proforma original como el PDF con la nueva propuesta actualizada para que puedas revisarlos con total transparencia."
            : "Adjuntamos en formato PDF el detalle de tu proforma elaborada en línea para tu evento."
        }
      </p>

      ${bloqueNotaAsesor}
      ${bloqueComparativo}

      <div style="margin:18px 0;padding:16px;border-radius:12px;background:#F9FAFB;border:1px solid #E5E7EB;font-size:14px;">
        <p style="margin:0 0 6px;"><strong>Evento:</strong> ${escaparHtmlCorreo(proformaActual.evento.tipoEvento)} (${escaparHtmlCorreo(proformaActual.evento.fechaEvento || "Por confirmar")})</p>
        <p style="margin:0 0 6px;"><strong>Total de esta propuesta:</strong> $${proformaActual.total.toFixed(2)} USD</p>
        <p style="margin:0;"><strong>Reserva de fecha sugerida (70%):</strong> $${proformaActual.montoReserva70Usd.toFixed(2)} USD</p>
      </div>

      <p style="font-size:13.5px;line-height:1.6;color:#4B5563;">
        Desde tu enlace personal puedes <strong>comparar todas las variaciones</strong>, elegir cuál deseas pagar (70% de reserva o 100% total con tarjeta PLUX o transferencia) y <strong>eliminar las variaciones no aceptadas o todas</strong> antes de confirmar tu pedido:
      </p>

      <div style="margin:22px 0;text-align:center;">
        <a href="${urlInteractiva}" style="display:inline-block;background:#2D4734;color:#FFFFFF;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:700;font-size:14px;">
          Ver Variaciones y Elegir en Línea
        </a>
      </div>

      ${linksDescargaHtml}

      <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0;" />
      <p style="margin:0;font-size:12px;color:#6B7280;text-align:center;">
        Tinkay Floristería &amp; Eventos · Quito, Ecuador · WhatsApp Tienda: <a href="https://wa.me/593992922343" style="color:#2D4734;font-weight:700;text-decoration:none;">+593 99 292 2343</a>
      </p>
    </div>`;

    const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
    let res = await enviarCorreo({
      negocio: proformaActual.negocio,
      para: correoDestino,
      asunto,
      html,
      adjuntos,
    });

    // Si el negocio aún no tiene su fila SMTP propia en Vault, reutilizar temporalmente el transporte de tranqi
    if (!res.ok && proformaActual.negocio !== "tranqi") {
      res = await enviarCorreo({
        negocio: "tranqi",
        para: correoDestino,
        asunto,
        html,
        adjuntos,
      });
    }

    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (err: any) {
    return { ok: false, error: err?.message || "No se pudo generar o enviar el PDF por correo." };
  }
}
