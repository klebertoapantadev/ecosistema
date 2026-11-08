// Generador del árbol XML canónico para Factura (1.1.0) y Nota de Crédito (1.1.0).
// Port fiel de Domo.Firma.Sri/GeneradorXml.cs usando el árbol de xml.ts.

import { CODIGO_IMPUESTO_IVA, leyendaRimpe } from "./catalogos.ts";
import type { CampoAdicional, Comprobante, Totales } from "./comprobante.ts";
import { formatearCantidadPrecio, formatearImporte, formatearTarifa } from "./decimal.ts";
import { el, type Elemento, texto } from "./xml.ts";

function esCaracterXml10Valido(cp: number): boolean {
  return (
    cp === 0x09 ||
    cp === 0x0a ||
    cp === 0x0d ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/**
 * Normaliza un texto según las restricciones de los XSD del SRI:
 * - descarta caracteres inválidos en XML 1.0 y sustitutos UTF-16 huérfanos;
 * - convierte CR, LF y TAB en espacios, colapsa espacios múltiples y recorta extremos;
 * - trunca por puntos de código Unicode para no partir pares sustitutos (emojis).
 */
export function normalizarTexto(valor: string | null | undefined, longitudMaxima: number): string {
  if (!valor) return "";

  let limpio = "";
  for (const ch of valor) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && esCaracterXml10Valido(cp)) {
      limpio += ch;
    }
  }

  const sinSaltos = limpio
    .replace(/\r\n/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();

  const puntos = Array.from(sinSaltos);
  if (puntos.length > longitudMaxima) {
    return puntos.slice(0, longitudMaxima).join("");
  }
  return sinSaltos;
}

function textoSiNoVacio(
  nombre: string,
  valor: string | null | undefined,
  longitudMaxima: number,
): Elemento | null {
  if (!valor || valor.trim() === "") return null;
  const formateado = normalizarTexto(valor, longitudMaxima);
  if (!formateado) return null;
  return texto(nombre, formateado);
}

/** Convierte fecha civil AAAA-MM-DD al formato dd/MM/yyyy exigido por el XSD del SRI. */
export function formatearFechaSri(fecha: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha.trim())) {
    return fecha.trim();
  }
  throw new Error(`Fecha con formato inválido (se esperaba AAAA-MM-DD): "${fecha}"`);
}

function construirInfoTributaria(c: Comprobante): Elemento {
  const agenteSinCeros = c.emisor.agenteRetencion?.replace(/^0+/, "") ?? null;
  const rimpe = leyendaRimpe(c.emisor.regimen);

  return el(
    "infoTributaria",
    {},
    texto("ambiente", String(c.ambiente)),
    texto("tipoEmision", "1"),
    texto("razonSocial", normalizarTexto(c.emisor.razonSocial, 300)),
    textoSiNoVacio("nombreComercial", c.emisor.nombreComercial, 300),
    texto("ruc", c.emisor.ruc),
    texto("claveAcceso", c.claveAcceso),
    texto("codDoc", c.tipo),
    texto("estab", c.establecimiento.codigo),
    texto("ptoEmi", c.puntoEmision),
    texto("secuencial", String(c.numero).padStart(9, "0")),
    texto("dirMatriz", normalizarTexto(c.emisor.direccionMatriz, 300)),
    textoSiNoVacio("agenteRetencion", agenteSinCeros, 8),
    rimpe ? texto("contribuyenteRimpe", rimpe) : null,
  );
}

function construirInfoFactura(c: Comprobante, t: Totales): Elemento {
  const totalConImpuestos = el(
    "totalConImpuestos",
    {},
    ...t.grupos.map((g) =>
      el(
        "totalImpuesto",
        {},
        texto("codigo", CODIGO_IMPUESTO_IVA),
        texto("codigoPorcentaje", g.codigoPorcentaje),
        texto("baseImponible", formatearImporte(g.base)),
        texto("tarifa", formatearTarifa(g.tarifa)),
        texto("valor", formatearImporte(g.valor)),
      )
    ),
  );

  const pagos = c.pagos && c.pagos.length > 0
    ? el(
      "pagos",
      {},
      ...c.pagos.map((p) =>
        el(
          "pago",
          {},
          texto("formaPago", p.formaPago),
          texto("total", formatearImporte(p.total)),
          p.plazo !== null && p.plazo !== undefined
            ? texto("plazo", plazoValido(p.plazo))
            : null,
          textoSiNoVacio("unidadTiempo", p.unidadTiempo, 10),
        )
      ),
    )
    : null;

  return el(
    "infoFactura",
    {},
    texto("fechaEmision", formatearFechaSri(c.fechaEmision)),
    textoSiNoVacio("dirEstablecimiento", c.establecimiento.direccion, 300),
    textoSiNoVacio("contribuyenteEspecial", c.emisor.contribuyenteEspecial, 13),
    texto("obligadoContabilidad", c.emisor.obligadoContabilidad ? "SI" : "NO"),
    texto("tipoIdentificacionComprador", c.comprador.tipoIdentificacion),
    texto("razonSocialComprador", normalizarTexto(c.comprador.razonSocial, 300)),
    texto("identificacionComprador", normalizarTexto(c.comprador.identificacion, 20)),
    textoSiNoVacio("direccionComprador", c.comprador.direccion, 300),
    texto("totalSinImpuestos", formatearImporte(t.totalSinImpuestos)),
    texto("totalDescuento", formatearImporte(t.totalDescuento)),
    totalConImpuestos,
    texto("propina", "0.00"),
    texto("importeTotal", formatearImporte(t.importeTotal)),
    texto("moneda", "DOLAR"),
    pagos,
  );
}

function construirInfoNotaCredito(c: Comprobante, t: Totales): Elemento {
  if (!c.modifica) {
    throw new Error("La nota de crédito requiere la información del documento modificado (modifica).");
  }

  const totalConImpuestos = el(
    "totalConImpuestos",
    {},
    ...t.grupos.map((g) =>
      el(
        "totalImpuesto",
        {},
        texto("codigo", CODIGO_IMPUESTO_IVA),
        texto("codigoPorcentaje", g.codigoPorcentaje),
        texto("baseImponible", formatearImporte(g.base)),
        texto("valor", formatearImporte(g.valor)),
      )
    ),
  );

  return el(
    "infoNotaCredito",
    {},
    texto("fechaEmision", formatearFechaSri(c.fechaEmision)),
    textoSiNoVacio("dirEstablecimiento", c.establecimiento.direccion, 300),
    texto("tipoIdentificacionComprador", c.comprador.tipoIdentificacion),
    texto("razonSocialComprador", normalizarTexto(c.comprador.razonSocial, 300)),
    texto("identificacionComprador", normalizarTexto(c.comprador.identificacion, 20)),
    textoSiNoVacio("contribuyenteEspecial", c.emisor.contribuyenteEspecial, 13),
    texto("obligadoContabilidad", c.emisor.obligadoContabilidad ? "SI" : "NO"),
    texto("codDocModificado", c.modifica.codDoc),
    texto("numDocModificado", c.modifica.numero),
    texto("fechaEmisionDocSustento", formatearFechaSri(c.modifica.fechaEmision)),
    texto("totalSinImpuestos", formatearImporte(t.totalSinImpuestos)),
    texto("valorModificacion", formatearImporte(t.importeTotal)),
    texto("moneda", "DOLAR"),
    totalConImpuestos,
    texto("motivo", normalizarTexto(c.motivo ?? "", 300)),
  );
}

function construirDetalles(c: Comprobante, t: Totales): Elemento {
  const esFactura = c.tipo === "01";

  const nodosDetalle = c.detalles.map((linea) => {
    const coincidencias = t.lineas.filter((l) => l.orden === linea.orden);
    if (coincidencias.length !== 1) {
      throw new Error(`No se encontró un total único para la línea con orden ${linea.orden}.`);
    }
    const totalesLinea = coincidencias[0];

    const detallesAdicionales = linea.detallesAdicionales && linea.detallesAdicionales.length > 0
      ? el(
        "detallesAdicionales",
        {},
        ...limitar(linea.detallesAdicionales, 3, `detallesAdicionales de la línea ${linea.orden}`).map((ad) =>
          el("detAdicional", {
            nombre: normalizarTexto(ad.nombre, 300),
            valor: normalizarTexto(ad.valor, 300),
          })
        ),
      )
      : null;

    const impuestos = el(
      "impuestos",
      {},
      el(
        "impuesto",
        {},
        texto("codigo", CODIGO_IMPUESTO_IVA),
        texto("codigoPorcentaje", linea.codigoIva),
        texto("tarifa", formatearTarifa(totalesLinea.tarifa.porcentaje)),
        texto("baseImponible", formatearImporte(totalesLinea.base)),
        texto("valor", formatearImporte(totalesLinea.valorIva)),
      ),
    );

    return el(
      "detalle",
      {},
      esFactura
        ? texto("codigoPrincipal", normalizarTexto(linea.codigo, 25))
        : texto("codigoInterno", normalizarTexto(linea.codigo, 25)),
      esFactura
        ? textoSiNoVacio("codigoAuxiliar", linea.codigoAuxiliar, 25)
        : textoSiNoVacio("codigoAdicional", linea.codigoAuxiliar, 25),
      texto("descripcion", normalizarTexto(linea.descripcion, 300)),
      texto("cantidad", formatearCantidadPrecio(linea.cantidad)),
      texto("precioUnitario", formatearCantidadPrecio(linea.precioUnitario)),
      texto("descuento", formatearImporte(linea.descuento)),
      texto("precioTotalSinImpuesto", formatearImporte(totalesLinea.base)),
      detallesAdicionales,
      impuestos,
    );
  });

  return el("detalles", {}, ...nodosDetalle);
}

// El XSD admite como máximo 3 detallesAdicionales por línea y 15 campos
// adicionales. Pasarse es un error de datos: truncar haría que el RIDE y el XML
// autorizado dijeran cosas distintas.
function limitar<T>(lista: T[], maximo: number, nombre: string): T[] {
  if (lista.length > maximo) throw new Error(`${nombre}: como máximo ${maximo} (hay ${lista.length})`);
  return lista;
}

/** Campos adicionales tal como van al XML (y al RIDE): con el correo del comprador si falta. */
export function camposInfoAdicional(c: Comprobante): CampoAdicional[] {
  const lista: CampoAdicional[] = [...(c.infoAdicional ?? [])];
  const correo = normalizarTexto(c.comprador.correo, 300);
  if (
    correo &&
    !lista.some((campo) => /^(email|correo|correo electr[oó]nico)$/i.test(campo.nombre.trim()))
  ) {
    lista.push({ nombre: "Email", valor: correo });
  }
  return limitar(
    lista
      .map((campo) => ({
        nombre: normalizarTexto(campo.nombre, 300),
        valor: normalizarTexto(campo.valor, 300),
      }))
      .filter((campo) => campo.nombre.length > 0 && campo.valor.length > 0),
    15,
    "infoAdicional",
  );
}

function plazoValido(plazo: number): string {
  if (!Number.isInteger(plazo) || plazo < 0) throw new Error(`Plazo de pago inválido: ${plazo}`);
  return String(plazo);
}

function construirInfoAdicional(c: Comprobante): Elemento | null {
  const normalizados = camposInfoAdicional(c);

  if (normalizados.length === 0) return null;

  return el(
    "infoAdicional",
    {},
    ...normalizados.map((campo) => el("campoAdicional", { nombre: campo.nombre }, campo.valor)),
  );
}

/**
 * Construye el elemento raíz del comprobante (`factura` o `notaCredito` v1.1.0)
 * listo para serializar con `canonico()` o `documento()`.
 */
export function generarXmlComprobante(c: Comprobante, t: Totales): Elemento {
  const infoTributaria = construirInfoTributaria(c);
  const detalles = construirDetalles(c, t);
  const infoAdicional = construirInfoAdicional(c);

  if (c.tipo === "01") {
    return el(
      "factura",
      { id: "comprobante", version: "1.1.0" },
      infoTributaria,
      construirInfoFactura(c, t),
      detalles,
      infoAdicional,
    );
  }

  if (c.tipo === "04") {
    return el(
      "notaCredito",
      { id: "comprobante", version: "1.1.0" },
      infoTributaria,
      construirInfoNotaCredito(c, t),
      detalles,
      infoAdicional,
    );
  }

  throw new Error(`Tipo de comprobante no soportado: "${c.tipo as string}"`);
}
