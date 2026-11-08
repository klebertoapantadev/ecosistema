// Construcción del XML autorizado que envuelve el comprobante firmado en CDATA.
// Port de Domo.Firma.Sri/GeneradorXmlAutorizado.cs.

import type { AutorizacionSri } from "./comprobante.ts";

function escaparTextoXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#xD;");
}

/**
 * Formatea una fecha/hora ISO 8601 devuelta por el SRI ("2026-01-15T10:30:00-05:00")
 * al formato "dd/MM/yyyy HH:mm:ss".
 */
export function formatearFechaHoraSri(fechaIso: string | null | undefined): string {
  if (!fechaIso) return "";
  const texto = fechaIso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(texto);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
  }
  return texto;
}

/**
 * Envuelve el contenido en una sección CDATA dividiendo de forma segura cualquier
 * secuencia `]]>` interna en `]]]]><![CDATA[>`.
 */
function envolverCdata(contenido: string): string {
  const seguro = contenido.replace(/\]\]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${seguro}]]>`;
}

/**
 * Genera el documento XML `<autorizacion>` con declaración UTF-8 y el comprobante
 * firmado protegido dentro de `<comprobante><![CDATA[...]]></comprobante>`.
 */
export function generarXmlAutorizado(
  a: AutorizacionSri,
  xmlFirmado: string = a.comprobanteXml ?? "",
): string {
  const estado = escaparTextoXml(a.estado ?? "");
  const numero = escaparTextoXml(a.numeroAutorizacion ?? "");
  const fecha = escaparTextoXml(formatearFechaHoraSri(a.fechaAutorizacion));
  const ambiente = escaparTextoXml(a.ambiente ?? "");
  const cdata = envolverCdata(xmlFirmado ?? a.comprobanteXml ?? "");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<autorizacion>" +
    `<estado>${estado}</estado>` +
    `<numeroAutorizacion>${numero}</numeroAutorizacion>` +
    `<fechaAutorizacion>${fecha}</fechaAutorizacion>` +
    `<ambiente>${ambiente}</ambiente>` +
    `<comprobante>${cdata}</comprobante>` +
    "</autorizacion>"
  );
}
