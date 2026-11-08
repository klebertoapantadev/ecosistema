// Generador del RIDE (Representación Impresa del Comprobante Electrónico) en PDF A4.
// Port de Domo.Firma.Sri/GeneradorRide.cs usando npm:pdf-lib@1.17.1.

import {
  degrees,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "npm:pdf-lib@1.17.1";
import { FORMAS_PAGO, leyendaRimpe } from "./catalogos.ts";
import {
  type AutorizacionSri,
  type CampoAdicional,
  type Comprobante,
  numeroVisible,
  type TotalGrupo,
  type Totales,
} from "./comprobante.ts";
import { comparar, formatearCantidadPrecio, formatearImporte, formatearTarifa } from "./decimal.ts";
import { formatearFechaHoraSri } from "./xml-autorizado.ts";
import { camposInfoAdicional as camposInfoAdicionalXml, formatearFechaSri } from "./xml-comprobante.ts";

const ANCHO_A4 = 595.28;
const ALTO_A4 = 841.89;
const MARGEN = 28;
const ANCHO_UTIL = ANCHO_A4 - MARGEN * 2;
const LIMITE_INFERIOR = 48;

const COLOR_TEXTO = rgb(0.13, 0.13, 0.13);
const COLOR_GRIS = rgb(0.45, 0.45, 0.45);
const COLOR_BORDE = rgb(0.74, 0.74, 0.74);
const COLOR_FONDO = rgb(0.96, 0.96, 0.96);
const COLOR_MARCA_AGUA = rgb(0.88, 0.88, 0.88);
const COLOR_NEGRO = rgb(0, 0, 0);

// Patrones de anchos de barras y espacios de Code 128 (ISO/IEC 15417), símbolos 0..106.
const PATRONES_CODE128: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

/**
 * Codifica una cadena en módulos (true = barra negra, false = espacio) de Code 128.
 * Para cadenas numéricas de >= 2 dígitos arranca en Code C (pares de dígitos) y, si
 * la longitud es impar (como los 49 dígitos de la clave de acceso), conmuta a Code B
 * para el último dígito.
 */
export function codificarCode128(texto: string): boolean[] {
  const simbolos: number[] = [];

  if (/^\d{2,}$/.test(texto)) {
    simbolos.push(105); // Start Code C
    let i = 0;
    while (i + 1 < texto.length) {
      simbolos.push(Number(texto.slice(i, i + 2)));
      i += 2;
    }
    if (i < texto.length) {
      simbolos.push(100); // Code B
      simbolos.push(texto.charCodeAt(i) - 32);
    }
  } else {
    simbolos.push(104); // Start Code B
    for (let i = 0; i < texto.length; i++) {
      const code = texto.charCodeAt(i);
      simbolos.push(code >= 32 && code <= 127 ? code - 32 : 31); // '?' si está fuera de ASCII
    }
  }

  let suma = simbolos[0];
  for (let i = 1; i < simbolos.length; i++) {
    suma += i * simbolos[i];
  }
  simbolos.push(suma % 103);
  simbolos.push(106); // Stop

  const modulos: boolean[] = [];
  for (const s of simbolos) {
    const patron = PATRONES_CODE128[s];
    for (let i = 0; i < patron.length; i++) {
      const ancho = Number(patron[i]);
      const esBarra = i % 2 === 0;
      for (let m = 0; m < ancho; m++) {
        modulos.push(esBarra);
      }
    }
  }
  return modulos;
}

function dibujarCodigoBarras(
  pagina: PDFPage,
  claveAcceso: string,
  x: number,
  y: number,
  ancho: number,
  alto: number,
): void {
  const modulos = codificarCode128(claveAcceso);
  if (modulos.length === 0) return;

  const anchoModulo = ancho / modulos.length;
  let idx = 0;
  while (idx < modulos.length) {
    if (modulos[idx]) {
      const inicio = idx;
      while (idx < modulos.length && modulos[idx]) {
        idx++;
      }
      pagina.drawRectangle({
        x: x + inicio * anchoModulo,
        y,
        width: (idx - inicio) * anchoModulo,
        height: alto,
        color: COLOR_NEGRO,
      });
    } else {
      idx++;
    }
  }
}

/**
 * Reemplaza caracteres que la fuente estándar (WinAnsi) no pueda codificar por '?'
 * en lugar de lanzar excepción, preservando acentos, eñes y símbolos latinos.
 */
function sanitizarWinAnsi(texto: string, fuente: PDFFont): string {
  const sinControles = texto.replace(/[\r\n\t]+/g, " ");
  try {
    fuente.encodeText(sinControles);
    return sinControles;
  } catch {
    let seguro = "";
    for (const ch of sinControles) {
      try {
        fuente.encodeText(ch);
        seguro += ch;
      } catch {
        seguro += "?";
      }
    }
    return seguro;
  }
}

function partirEnLineas(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  const limpio = sanitizarWinAnsi(texto, fuente);
  if (!limpio) return [""];
  if (fuente.widthOfTextAtSize(limpio, tamano) <= anchoMax) {
    return [limpio];
  }

  const palabras = limpio.split(" ");
  const lineas: string[] = [];
  let actual = "";

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(candidato, tamano) <= anchoMax) {
      actual = candidato;
    } else {
      if (actual) {
        lineas.push(actual);
        actual = "";
      }
      // Si una sola palabra supera el ancho de la columna, partir carácter a carácter.
      if (fuente.widthOfTextAtSize(palabra, tamano) > anchoMax) {
        let fragmento = "";
        for (const ch of palabra) {
          if (fuente.widthOfTextAtSize(fragmento + ch, tamano) <= anchoMax) {
            fragmento += ch;
          } else {
            if (fragmento) lineas.push(fragmento);
            fragmento = ch;
          }
        }
        actual = fragmento;
      } else {
        actual = palabra;
      }
    }
  }
  if (actual) {
    lineas.push(actual);
  }
  return lineas.length > 0 ? lineas : [""];
}

async function incrustarLogo(doc: PDFDocument, logo: Uint8Array | null): Promise<PDFImage | null> {
  if (!logo || logo.length < 4) return null;
  // Magic bytes PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    logo.length >= 8 &&
    logo[0] === 0x89 &&
    logo[1] === 0x50 &&
    logo[2] === 0x4e &&
    logo[3] === 0x47
  ) {
    return await doc.embedPng(logo);
  }
  // Magic bytes JPEG: FF D8 FF
  if (logo[0] === 0xff && logo[1] === 0xd8 && logo[2] === 0xff) {
    return await doc.embedJpg(logo);
  }
  return null;
}

function nuevaPagina(doc: PDFDocument, c: Comprobante, fuenteBold: PDFFont): PDFPage {
  const pagina = doc.addPage([ANCHO_A4, ALTO_A4]);
  if (c.ambiente === 1) {
    const marca = sanitizarWinAnsi("SIN VALIDEZ TRIBUTARIA - AMBIENTE DE PRUEBAS", fuenteBold);
    pagina.drawText(marca, {
      x: 85,
      y: 260,
      size: 22,
      font: fuenteBold,
      color: COLOR_MARCA_AGUA,
      rotate: degrees(35),
    });
  }
  return pagina;
}

function etiquetaSubtotal(grupo: TotalGrupo): string {
  if (grupo.codigoPorcentaje === "6") return "SUBTOTAL NO OBJETO DE IVA";
  if (grupo.codigoPorcentaje === "7") return "SUBTOTAL EXENTO DE IVA";
  if (comparar(grupo.tarifa, "0") > 0) return `SUBTOTAL ${formatearTarifa(grupo.tarifa)} %`;
  return "SUBTOTAL 0 %";
}

function textoCodDoc(codDoc: string): string {
  if (codDoc === "01") return "FACTURA";
  if (codDoc === "04") return "NOTA DE CRÉDITO";
  return codDoc;
}

/**
 * Genera el PDF del RIDE con el encabezado del emisor y autorización, código de barras
 * Code 128 de la clave de acceso, datos del comprador, tabla de detalles paginada,
 * formas de pago, información adicional y desglose de totales.
 */
export async function generarRide(
  c: Comprobante,
  t: Totales,
  a: AutorizacionSri,
  logo: Uint8Array | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const imagenLogo = await incrustarLogo(doc, logo);

  let pagina = nuevaPagina(doc, c, fuenteBold);
  let cursorY = ALTO_A4 - MARGEN;

  const dibujarTexto = (
    p: PDFPage,
    texto: string,
    x: number,
    y: number,
    opciones: { tamano?: number; bold?: boolean; color?: ReturnType<typeof rgb>; alinear?: "izq" | "der" | "centro"; ancho?: number } = {},
  ) => {
    const f = opciones.bold ? fuenteBold : fuente;
    const tamano = opciones.tamano ?? 8;
    const seguro = sanitizarWinAnsi(texto, f);
    let posX = x;
    if (opciones.ancho !== undefined && opciones.alinear && opciones.alinear !== "izq") {
      const anchoTexto = f.widthOfTextAtSize(seguro, tamano);
      if (opciones.alinear === "der") {
        posX = x + opciones.ancho - anchoTexto;
      } else if (opciones.alinear === "centro") {
        posX = x + (opciones.ancho - anchoTexto) / 2;
      }
    }
    p.drawText(seguro, {
      x: posX,
      y,
      size: tamano,
      font: f,
      color: opciones.color ?? COLOR_TEXTO,
    });
  };

  // --- 1. ENCABEZADO (Columna izquierda: Emisor 60% | Columna derecha: Autorización 40%) ---
  const anchoEmisor = ANCHO_UTIL * 0.58;
  const xInfo = MARGEN + anchoEmisor + 8;
  const anchoInfo = ANCHO_UTIL - anchoEmisor - 8;

  let yEmisor = cursorY;
  if (imagenLogo) {
    const escala = Math.min(150 / imagenLogo.width, 45 / imagenLogo.height, 1);
    const wLogo = imagenLogo.width * escala;
    const hLogo = imagenLogo.height * escala;
    pagina.drawImage(imagenLogo, {
      x: MARGEN,
      y: yEmisor - hLogo,
      width: wLogo,
      height: hLogo,
    });
    yEmisor -= hLogo + 6;
  }

  for (const l of partirEnLineas(c.emisor.razonSocial, fuenteBold, 11, anchoEmisor)) {
    yEmisor -= 13;
    dibujarTexto(pagina, l, MARGEN, yEmisor, { tamano: 11, bold: true });
  }

  if (c.emisor.nombreComercial && c.emisor.nombreComercial.trim() !== "" && c.emisor.nombreComercial !== c.emisor.razonSocial) {
    for (const l of partirEnLineas(c.emisor.nombreComercial, fuente, 9, anchoEmisor)) {
      yEmisor -= 11;
      dibujarTexto(pagina, l, MARGEN, yEmisor, { tamano: 9 });
    }
  }

  yEmisor -= 4;
  const lineasEmisor: { texto: string; bold?: boolean }[] = [
    { texto: `Dirección matriz: ${c.emisor.direccionMatriz}` },
    { texto: `Dirección establecimiento: ${c.establecimiento.direccion}` },
  ];
  if (c.emisor.contribuyenteEspecial && c.emisor.contribuyenteEspecial.trim() !== "") {
    lineasEmisor.push({ texto: `Contribuyente especial Nº ${c.emisor.contribuyenteEspecial}` });
  }
  lineasEmisor.push({ texto: `Obligado a llevar contabilidad: ${c.emisor.obligadoContabilidad ? "SI" : "NO"}` });

  const rimpe = leyendaRimpe(c.emisor.regimen);
  if (rimpe) {
    lineasEmisor.push({ texto: rimpe, bold: true });
  }
  if (c.emisor.agenteRetencion && c.emisor.agenteRetencion.trim() !== "") {
    lineasEmisor.push({ texto: `Agente de retención resolución Nº ${c.emisor.agenteRetencion}` });
  }

  for (const item of lineasEmisor) {
    const f = item.bold ? fuenteBold : fuente;
    for (const l of partirEnLineas(item.texto, f, 8, anchoEmisor)) {
      yEmisor -= 11;
      dibujarTexto(pagina, l, MARGEN, yEmisor, { tamano: 8, bold: item.bold });
    }
  }

  // Recuadro derecho de información tributaria y clave de acceso
  const padInfo = 6;
  const anchoInternoInfo = anchoInfo - padInfo * 2;
  let yInfo = cursorY - padInfo;

  yInfo -= 10;
  dibujarTexto(pagina, `RUC: ${c.emisor.ruc}`, xInfo + padInfo, yInfo, { tamano: 8, bold: true });

  yInfo -= 15;
  const tituloDoc = c.tipo === "04" ? "NOTA DE CRÉDITO" : "FACTURA";
  dibujarTexto(pagina, tituloDoc, xInfo + padInfo, yInfo, {
    tamano: 11,
    bold: true,
    alinear: "centro",
    ancho: anchoInternoInfo,
  });

  yInfo -= 11;
  dibujarTexto(pagina, `No. ${numeroVisible(c)}`, xInfo + padInfo, yInfo, {
    tamano: 8,
    alinear: "centro",
    ancho: anchoInternoInfo,
  });

  yInfo -= 6;
  pagina.drawLine({
    start: { x: xInfo + padInfo, y: yInfo },
    end: { x: xInfo + anchoInfo - padInfo, y: yInfo },
    thickness: 0.7,
    color: COLOR_BORDE,
  });

  yInfo -= 11;
  dibujarTexto(pagina, "NÚMERO DE AUTORIZACIÓN", xInfo + padInfo, yInfo, { tamano: 7.5, bold: true });
  for (const l of partirEnLineas(a.numeroAutorizacion ?? "", fuente, 7, anchoInternoInfo)) {
    yInfo -= 9;
    dibujarTexto(pagina, l, xInfo + padInfo, yInfo, { tamano: 7 });
  }

  yInfo -= 11;
  dibujarTexto(pagina, "FECHA Y HORA DE AUTORIZACIÓN", xInfo + padInfo, yInfo, { tamano: 7.5, bold: true });
  yInfo -= 9;
  dibujarTexto(pagina, formatearFechaHoraSri(a.fechaAutorizacion), xInfo + padInfo, yInfo, { tamano: 7.5 });

  yInfo -= 11;
  const textoAmbiente = a.ambiente ?? (c.ambiente === 1 ? "PRUEBAS" : "PRODUCCIÓN");
  dibujarTexto(pagina, `AMBIENTE: ${textoAmbiente}`, xInfo + padInfo, yInfo, { tamano: 7.5, bold: true });
  yInfo -= 10;
  dibujarTexto(pagina, "EMISIÓN: NORMAL", xInfo + padInfo, yInfo, { tamano: 7.5 });

  yInfo -= 12;
  dibujarTexto(pagina, "CLAVE DE ACCESO", xInfo + padInfo, yInfo, { tamano: 7.5, bold: true });

  yInfo -= 30;
  dibujarCodigoBarras(pagina, c.claveAcceso, xInfo + padInfo, yInfo, anchoInternoInfo, 26);

  yInfo -= 9;
  dibujarTexto(pagina, c.claveAcceso, xInfo + padInfo, yInfo, {
    tamano: 6.5,
    alinear: "centro",
    ancho: anchoInternoInfo,
  });

  const altoRecuadroInfo = cursorY - (yInfo - padInfo);
  pagina.drawRectangle({
    x: xInfo,
    y: yInfo - padInfo,
    width: anchoInfo,
    height: altoRecuadroInfo,
    borderColor: COLOR_BORDE,
    borderWidth: 1,
  });

  cursorY = Math.min(yEmisor, yInfo - padInfo) - 10;

  // --- 2. BLOQUE DEL COMPRADOR ---
  const padComprador = 6;
  const anchoInternoComprador = ANCHO_UTIL - padComprador * 2;
  const lineasComprador: string[] = [
    `Razón social / Nombres y apellidos: ${c.comprador.razonSocial}`,
    `Identificación: ${c.comprador.identificacion}`,
    `Fecha de emisión: ${formatearFechaSri(c.fechaEmision)}`,
  ];
  if (c.comprador.direccion && c.comprador.direccion.trim() !== "") {
    lineasComprador.push(`Dirección: ${c.comprador.direccion}`);
  }
  if (c.tipo === "04" && c.modifica) {
    lineasComprador.push(
      `Comprobante que modifica: ${textoCodDoc(c.modifica.codDoc)} No. ${c.modifica.numero}`,
    );
    lineasComprador.push(`Fecha de emisión (comprobante a modificar): ${formatearFechaSri(c.modifica.fechaEmision)}`);
    lineasComprador.push(`Motivo: ${c.motivo ?? ""}`);
  }

  const lineasCompradorEnvueltas: string[] = [];
  for (const l of lineasComprador) {
    lineasCompradorEnvueltas.push(...partirEnLineas(l, fuente, 8, anchoInternoComprador));
  }

  const altoComprador = lineasCompradorEnvueltas.length * 11 + padComprador * 2;
  pagina.drawRectangle({
    x: MARGEN,
    y: cursorY - altoComprador,
    width: ANCHO_UTIL,
    height: altoComprador,
    borderColor: COLOR_BORDE,
    borderWidth: 1,
  });

  let yComp = cursorY - padComprador;
  for (const l of lineasCompradorEnvueltas) {
    yComp -= 11;
    dibujarTexto(pagina, l, MARGEN + padComprador, yComp, { tamano: 8 });
  }

  cursorY -= altoComprador + 10;

  // --- 3. TABLA DE DETALLES CON PAGINACIÓN ---
  // Proporciones de columnas: 2 : 1 : 4 : 2 : 2 : 2 (suma = 13)
  const pesos = [2, 1, 4, 2, 2, 2];
  const sumaPesos = 13;
  const anchosCol = pesos.map((p) => (ANCHO_UTIL * p) / sumaPesos);
  const xCols: number[] = [];
  let acumX = MARGEN;
  for (const w of anchosCol) {
    xCols.push(acumX);
    acumX += w;
  }

  const encabezados = ["Cod. Principal", "Cant.", "Descripción", "P. Unitario", "Descuento", "Precio Total"];
  const altoEncabezado = 16;

  const dibujarEncabezadoTabla = (p: PDFPage, yTop: number): number => {
    const yBase = yTop - altoEncabezado;
    p.drawRectangle({
      x: MARGEN,
      y: yBase,
      width: ANCHO_UTIL,
      height: altoEncabezado,
      color: COLOR_FONDO,
      borderColor: COLOR_BORDE,
      borderWidth: 0.5,
    });
    for (let i = 0; i < encabezados.length; i++) {
      dibujarTexto(p, encabezados[i], xCols[i] + 3, yBase + 5, {
        tamano: 7.5,
        bold: true,
        alinear: i === 1 || i >= 3 ? "der" : "izq",
        ancho: anchosCol[i] - 6,
      });
    }
    return yBase;
  };

  cursorY = dibujarEncabezadoTabla(pagina, cursorY);

  for (const linea of c.detalles) {
    const totalLinea = t.lineas.find((l) => l.orden === linea.orden);
    if (!totalLinea) {
      throw new Error(`Falta el total calculado para la línea ${linea.orden}.`);
    }

    const codLineas = partirEnLineas(linea.codigo, fuente, 7.5, anchosCol[0] - 6);
    const descLineas = partirEnLineas(linea.descripcion, fuente, 7.5, anchosCol[2] - 6);
    const numFilasTexto = Math.max(codLineas.length, descLineas.length, 1);
    const altoFila = numFilasTexto * 10 + 6;

    if (cursorY - altoFila < LIMITE_INFERIOR) {
      pagina = nuevaPagina(doc, c, fuenteBold);
      cursorY = ALTO_A4 - MARGEN;
      cursorY = dibujarEncabezadoTabla(pagina, cursorY);
    }

    const yBaseFila = cursorY - altoFila;

    for (let idx = 0; idx < codLineas.length; idx++) {
      dibujarTexto(pagina, codLineas[idx], xCols[0] + 3, cursorY - 10 - idx * 10, { tamano: 7.5 });
    }
    dibujarTexto(pagina, formatearCantidadPrecio(linea.cantidad), xCols[1] + 3, cursorY - 10, {
      tamano: 7.5,
      alinear: "der",
      ancho: anchosCol[1] - 6,
    });
    for (let idx = 0; idx < descLineas.length; idx++) {
      dibujarTexto(pagina, descLineas[idx], xCols[2] + 3, cursorY - 10 - idx * 10, { tamano: 7.5 });
    }
    dibujarTexto(pagina, formatearCantidadPrecio(linea.precioUnitario), xCols[3] + 3, cursorY - 10, {
      tamano: 7.5,
      alinear: "der",
      ancho: anchosCol[3] - 6,
    });
    dibujarTexto(pagina, formatearImporte(linea.descuento), xCols[4] + 3, cursorY - 10, {
      tamano: 7.5,
      alinear: "der",
      ancho: anchosCol[4] - 6,
    });
    dibujarTexto(pagina, formatearImporte(totalLinea.base), xCols[5] + 3, cursorY - 10, {
      tamano: 7.5,
      alinear: "der",
      ancho: anchosCol[5] - 6,
    });

    pagina.drawLine({
      start: { x: MARGEN, y: yBaseFila },
      end: { x: MARGEN + ANCHO_UTIL, y: yBaseFila },
      thickness: 0.5,
      color: COLOR_BORDE,
    });

    cursorY = yBaseFila;
  }

  // --- 4. PIE: INFORMACIÓN ADICIONAL + FORMAS DE PAGO (IZQ) Y TOTALES (DER) ---
  const filasTotales: { etiqueta: string; valor: string; destacar: boolean }[] = [];
  for (const grupo of t.grupos) {
    filasTotales.push({
      etiqueta: etiquetaSubtotal(grupo),
      valor: formatearImporte(grupo.base),
      destacar: false,
    });
  }
  filasTotales.push({
    etiqueta: "SUBTOTAL SIN IMPUESTOS",
    valor: formatearImporte(t.totalSinImpuestos),
    destacar: false,
  });
  filasTotales.push({
    etiqueta: "TOTAL DESCUENTO",
    valor: formatearImporte(t.totalDescuento),
    destacar: false,
  });
  for (const grupo of t.grupos) {
    if (comparar(grupo.tarifa, "0") > 0) {
      filasTotales.push({
        etiqueta: `IVA ${formatearTarifa(grupo.tarifa)} %`,
        valor: formatearImporte(grupo.valor),
        destacar: false,
      });
    }
  }
  filasTotales.push({ etiqueta: "PROPINA", valor: "0.00", destacar: false });
  filasTotales.push({
    etiqueta: "VALOR TOTAL",
    valor: formatearImporte(t.importeTotal),
    destacar: true,
  });

  // La misma lista que el XML: el RIDE no puede mostrar campos que el XML autorizado no tiene.
  const camposInfoAdicional = camposInfoAdicionalXml(c);

  // Los totales (altura fija) caben en la página actual; la columna izquierda
  // (información adicional y pagos) salta de página línea a línea si no cabe.
  const altoTotales = filasTotales.length * 13 + 10;

  if (cursorY - 12 - altoTotales < LIMITE_INFERIOR) {
    pagina = nuevaPagina(doc, c, fuenteBold);
    cursorY = ALTO_A4 - MARGEN;
  } else {
    cursorY -= 12;
  }

  let yDer = cursorY;
  for (const fila of filasTotales) {
    yDer -= 12;
    dibujarTexto(pagina, fila.etiqueta, xInfo, yDer, {
      tamano: 8,
      bold: fila.destacar,
    });
    dibujarTexto(pagina, fila.valor, xInfo + anchoInfo - 65, yDer, {
      tamano: 8,
      bold: fila.destacar,
      alinear: "der",
      ancho: 65,
    });
  }

  let yIzq = cursorY;
  const anchoIzq = anchoEmisor;
  let paginaIzq = pagina;
  const bajarIzq = (alto: number) => {
    if (yIzq - alto < LIMITE_INFERIOR) {
      paginaIzq = nuevaPagina(doc, c, fuenteBold);
      yIzq = ALTO_A4 - MARGEN;
    }
    yIzq -= alto;
  };

  if (camposInfoAdicional.length > 0) {
    bajarIzq(10);
    dibujarTexto(paginaIzq, "Información adicional", MARGEN, yIzq, { tamano: 8, bold: true });
    for (const campo of camposInfoAdicional) {
      for (const l of partirEnLineas(`${campo.nombre}: ${campo.valor}`, fuente, 7.5, anchoIzq)) {
        bajarIzq(10);
        dibujarTexto(paginaIzq, l, MARGEN, yIzq, { tamano: 7.5 });
      }
    }
    yIzq -= 8;
  }

  if (c.pagos.length > 0) {
    bajarIzq(10);
    dibujarTexto(paginaIzq, "Forma de pago", MARGEN, yIzq, { tamano: 8, bold: true });
    for (const pago of c.pagos) {
      const descPago = FORMAS_PAGO[pago.formaPago] ?? pago.formaPago;
      const lineasPago = partirEnLineas(descPago, fuente, 7.5, anchoIzq - 65);
      for (let i = 0; i < lineasPago.length; i++) {
        bajarIzq(10);
        dibujarTexto(paginaIzq, lineasPago[i], MARGEN, yIzq, { tamano: 7.5 });
        if (i === 0) {
          dibujarTexto(paginaIzq, formatearImporte(pago.total), MARGEN + anchoIzq - 60, yIzq, {
            tamano: 7.5,
            alinear: "der",
            ancho: 60,
          });
        }
      }
    }
  }

  // --- 5. NUMERACIÓN DE PÁGINAS ---
  const paginas = doc.getPages();
  const totalPaginas = paginas.length;
  for (let i = 0; i < totalPaginas; i++) {
    dibujarTexto(paginas[i], `Página ${i + 1} de ${totalPaginas}`, MARGEN, 20, {
      tamano: 7,
      color: COLOR_GRIS,
      alinear: "centro",
      ancho: ANCHO_UTIL,
    });
  }

  return await doc.save();
}
