// Cliente SOAP de los web services offline del SRI (ficha técnica v2.34 p. 17).
// Sin librería SOAP: dos sobres fijos y un parser por nombre local (los
// prefijos de la respuesta cambian según el servidor).
//
// Errores de red, HTTP 5xx o respuestas sin sobre se señalan con SriNoDisponible:
// el comprobante se queda en la cola y se reintenta con backoff. Un DEVUELTA o
// NO AUTORIZADO son respuestas válidas, no excepciones.

import type {
  Ambiente,
  AutorizacionSri,
  MensajeSri,
  RespuestaAutorizacion,
  RespuestaRecepcion,
} from "./comprobante.ts";
import { encodeBase64 } from "jsr:@std/encoding@1.0.10/base64";

export const URL_SRI: Record<Ambiente, string> = {
  1: "https://celcer.sri.gob.ec",
  2: "https://cel.sri.gob.ec",
};

const RUTA_RECEPCION = "/comprobantes-electronicos-ws/RecepcionComprobantesOffline";
const RUTA_AUTORIZACION = "/comprobantes-electronicos-ws/AutorizacionComprobantesOffline";

export class SriNoDisponible extends Error {}

/** Mensajes del SRI que significan "ya lo tengo": se pasa a consultar la autorización. */
export const MENSAJES_YA_RECIBIDO = new Set([
  "43", // CLAVE ACCESO REGISTRADA
  "70", // CLAVE DE ACCESO EN PROCESAMIENTO
]);

async function llamar(url: string, sobre: string, timeoutMs: number): Promise<string> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "" },
      body: sobre,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new SriNoDisponible(`SRI no disponible: ${e instanceof Error ? e.message : String(e)}`);
  }
  const cuerpo = await respuesta.text();
  if (respuesta.status >= 500 && !/<(?:\w+:)?Envelope[\s>]/.test(cuerpo)) {
    throw new SriNoDisponible(`SRI respondió HTTP ${respuesta.status}`);
  }
  if (/<(?:\w+:)?Fault[\s>]/.test(cuerpo)) {
    throw new SriNoDisponible(`SOAP Fault: ${texto(cuerpo, "faultstring") ?? "sin detalle"}`);
  }
  if (!respuesta.ok) {
    throw new SriNoDisponible(`SRI respondió HTTP ${respuesta.status}`);
  }
  return cuerpo;
}

export async function enviarRecepcion(
  ambiente: Ambiente,
  xmlFirmado: string,
  timeoutMs = 30_000,
): Promise<RespuestaRecepcion> {
  const sobre = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:ec="http://ec.gob.sri.ws.recepcion"><soapenv:Header/><soapenv:Body><ec:validarComprobante>' +
    `<xml>${encodeBase64(new TextEncoder().encode(xmlFirmado))}</xml>` +
    "</ec:validarComprobante></soapenv:Body></soapenv:Envelope>";
  return parsearRecepcion(await llamar(URL_SRI[ambiente] + RUTA_RECEPCION, sobre, timeoutMs));
}

export async function consultarAutorizacion(
  ambiente: Ambiente,
  claveAcceso: string,
  timeoutMs = 30_000,
): Promise<RespuestaAutorizacion> {
  if (!/^\d{49}$/.test(claveAcceso)) throw new Error("Clave de acceso inválida");
  const sobre = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:ec="http://ec.gob.sri.ws.autorizacion"><soapenv:Header/><soapenv:Body><ec:autorizacionComprobante>' +
    `<claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>` +
    "</ec:autorizacionComprobante></soapenv:Body></soapenv:Envelope>";
  return parsearAutorizacion(await llamar(URL_SRI[ambiente] + RUTA_AUTORIZACION, sobre, timeoutMs));
}

// ── Parser por nombre local ─────────────────────────────────────────────────

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function contenidoTexto(crudo: string): string {
  const cdata = crudo.match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/);
  return cdata ? cdata[1] : desescapar(crudo);
}

function patron(nombre: string, flags = ""): RegExp {
  return new RegExp(`<(?:[\\w.-]+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${nombre}>`, flags);
}

function texto(xml: string, nombre: string): string | null {
  const m = xml.match(patron(nombre));
  return m ? contenidoTexto(m[1]).trim() : null;
}

// <mensaje> contiene otro <mensaje> (el texto): se reconoce la secuencia completa
// identificador, mensaje, informacionAdicional (opcional), tipo.
function mensajes(xml: string): MensajeSri[] {
  const p = (n: string) => `<(?:[\\w.-]+:)?${n}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${n}>`;
  const re = new RegExp(
    `${p("identificador")}\\s*${p("mensaje")}\\s*(?:${p("informacionAdicional")}\\s*)?${p("tipo")}`,
    "g",
  );
  return [...xml.matchAll(re)].map((m) => ({
    identificador: contenidoTexto(m[1]).trim(),
    mensaje: contenidoTexto(m[2]).trim(),
    informacionAdicional: m[3] === undefined ? null : contenidoTexto(m[3]).trim() || null,
    tipo: contenidoTexto(m[4]).trim(),
  }));
}

export function parsearRecepcion(xml: string): RespuestaRecepcion {
  const respuesta = xml.match(patron("RespuestaRecepcionComprobante"));
  if (!respuesta) throw new SriNoDisponible("Respuesta de recepción sin RespuestaRecepcionComprobante");
  const estado = texto(respuesta[1].replace(patron("comprobantes", "g"), ""), "estado");
  if (!estado) throw new SriNoDisponible("Respuesta de recepción sin estado");
  return { estado, mensajes: mensajes(respuesta[1]) };
}

export function parsearAutorizacion(xml: string): RespuestaAutorizacion {
  const respuesta = xml.match(patron("RespuestaAutorizacionComprobante"));
  if (!respuesta) throw new SriNoDisponible("Respuesta de autorización sin RespuestaAutorizacionComprobante");
  const autorizaciones: AutorizacionSri[] = [];
  for (const m of respuesta[1].matchAll(patron("autorizacion", "g"))) {
    const bloque = m[1];
    // El comprobante es XML incrustado: se separa antes de buscar el resto de campos.
    const comprobante = bloque.match(patron("comprobante"));
    const resto = comprobante ? bloque.replace(comprobante[0], "") : bloque;
    autorizaciones.push({
      estado: texto(resto, "estado") ?? "",
      numeroAutorizacion: texto(resto, "numeroAutorizacion"),
      fechaAutorizacion: texto(resto, "fechaAutorizacion"),
      ambiente: texto(resto, "ambiente"),
      comprobanteXml: comprobante ? contenidoTexto(comprobante[1]).trim() || null : null,
      mensajes: mensajes(resto),
    });
  }
  return { autorizaciones };
}

/**
 * De varias autorizaciones (un comprobante reenviado), la que manda: si hay
 * una AUTORIZADO, esa; si no, la más reciente.
 */
export function autorizacionVigente(r: RespuestaAutorizacion): AutorizacionSri | null {
  if (r.autorizaciones.length === 0) return null;
  return r.autorizaciones.find((a) => a.estado === "AUTORIZADO") ??
    [...r.autorizaciones].sort((a, b) =>
      Date.parse(b.fechaAutorizacion ?? "") - Date.parse(a.fechaAutorizacion ?? "")
    )[0];
}
