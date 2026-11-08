// Port de Domo.Firma.Sri.Tests/GeneradorXmlAutorizadoTests.cs.
import { assert, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import type { AutorizacionSri } from "../comprobante.ts";
import { generarXmlAutorizado } from "../xml-autorizado.ts";

Deno.test("xml-autorizado: envuelve el comprobante firmado en CDATA con los datos de autorización", () => {
  const xmlFirmado = '<factura id="comprobante" version="1.1.0">contenido &amp; <etiqueta/></factura>';
  const autorizacion: AutorizacionSri = {
    estado: "AUTORIZADO",
    numeroAutorizacion: "1234567890",
    fechaAutorizacion: "2026-01-15T10:30:00-05:00",
    ambiente: "PRUEBAS",
    comprobanteXml: xmlFirmado,
    mensajes: [],
  };

  const xml = generarXmlAutorizado(autorizacion, xmlFirmado);

  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assertStringIncludes(xml, "<estado>AUTORIZADO</estado>");
  assertStringIncludes(xml, "<numeroAutorizacion>1234567890</numeroAutorizacion>");
  assertStringIncludes(xml, "<fechaAutorizacion>15/01/2026 10:30:00</fechaAutorizacion>");
  assertStringIncludes(xml, "<ambiente>PRUEBAS</ambiente>");
  assertStringIncludes(xml, `<comprobante><![CDATA[${xmlFirmado}]]></comprobante>`);
});

Deno.test("xml-autorizado: ecoa estados distintos de autorizado aunque falten datos", () => {
  const autorizacion: AutorizacionSri = {
    estado: "NO AUTORIZADO",
    numeroAutorizacion: null,
    fechaAutorizacion: null,
    ambiente: "PRUEBAS",
    comprobanteXml: null,
    mensajes: [{ identificador: "43", mensaje: "Comprobante ya registrado", informacionAdicional: null, tipo: "ERROR" }],
  };

  const xml = generarXmlAutorizado(autorizacion, "");
  assertStringIncludes(xml, "<estado>NO AUTORIZADO</estado>");
  assertStringIncludes(xml, "<numeroAutorizacion></numeroAutorizacion>");
  assertStringIncludes(xml, "<fechaAutorizacion></fechaAutorizacion>");
  assertStringIncludes(xml, "<comprobante><![CDATA[]]></comprobante>");
});

Deno.test("xml-autorizado: divide de forma segura cualquier secuencia ]]> dentro del CDATA", () => {
  const xmlConCierre = "<factura>texto con ]]> embebido</factura>";
  const autorizacion: AutorizacionSri = {
    estado: "AUTORIZADO",
    numeroAutorizacion: "123",
    fechaAutorizacion: "2026-01-15T10:30:00-05:00",
    ambiente: "PRUEBAS",
    comprobanteXml: xmlConCierre,
    mensajes: [],
  };

  const xml = generarXmlAutorizado(autorizacion, xmlConCierre);
  assertStringIncludes(xml, "<comprobante><![CDATA[<factura>texto con ]]]]><![CDATA[> embebido</factura>]]></comprobante>");
});
