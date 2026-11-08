import { assert, assertEquals, assertStringIncludes, assertThrows } from "jsr:@std/assert@1.0.13";
import { calcularTotales } from "../totales.ts";
import { generarXmlComprobante } from "../xml-comprobante.ts";
import { canonico, documento } from "../xml.ts";
import { escenarios, factura, linea } from "./ayudas.ts";
import { erroresXsd } from "./xsd.ts";

for (const [nombre, c] of Object.entries(escenarios())) {
  Deno.test(`xml: ${nombre} valida contra el XSD oficial`, async () => {
    const raiz = generarXmlComprobante(c, calcularTotales(c.detalles));
    assertEquals(raiz.atributos.id, "comprobante");
    assertEquals(raiz.atributos.version, "1.1.0");
    assertEquals(raiz.nombre, c.tipo === "01" ? "factura" : "notaCredito");
    assertEquals(await erroresXsd(documento(raiz), c.tipo), []);
  });
}

Deno.test("xml: forma y orden de los datos clave", () => {
  const c = factura();
  const xml = canonico(generarXmlComprobante(c, calcularTotales(c.detalles)));
  assertStringIncludes(xml, "<ambiente>1</ambiente><tipoEmision>1</tipoEmision>");
  assertStringIncludes(xml, `<claveAcceso>${c.claveAcceso}</claveAcceso><codDoc>01</codDoc>`);
  assertStringIncludes(xml, "<estab>002</estab><ptoEmi>001</ptoEmi><secuencial>000000396</secuencial>");
  assertStringIncludes(xml, "<fechaEmision>11/11/2024</fechaEmision>");
  assertStringIncludes(xml, "<obligadoContabilidad>SI</obligadoContabilidad>");
  assertStringIncludes(xml, "<totalSinImpuestos>10.00</totalSinImpuestos>");
  assertStringIncludes(xml, "<importeTotal>11.50</importeTotal><moneda>DOLAR</moneda>");
  assertStringIncludes(xml, "<razonSocialComprador>María José Pérez Ñáñez</razonSocialComprador>");
  // Escape de texto y campo adicional con su atributo nombre.
  assertStringIncludes(xml, '<campoAdicional nombre="Plan">Amparo Familiar &lt;mensual&gt;</campoAdicional>');
  // Sin forma corta de elementos vacíos ni declaración en la forma canónica.
  assert(!xml.includes("/>"));
  assert(!xml.startsWith("<?xml"));
});

Deno.test("xml: leyenda RIMPE solo con régimen RIMPE", () => {
  const general = factura();
  const rimpe = factura({ emisor: { ...general.emisor, regimen: "RIMPE_NEGOCIO_POPULAR" } });
  const xmlGeneral = canonico(generarXmlComprobante(general, calcularTotales(general.detalles)));
  const xmlRimpe = canonico(generarXmlComprobante(rimpe, calcularTotales(rimpe.detalles)));
  assert(!xmlGeneral.includes("contribuyenteRimpe"));
  assertStringIncludes(
    xmlRimpe,
    "<contribuyenteRimpe>CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</contribuyenteRimpe>",
  );
});

Deno.test("xml: textos con saltos de línea y demasiado largos se normalizan", async () => {
  const c = factura({
    detalles: [linea({ orden: 1, descripcion: "Primera línea\r\nsegunda línea  " + "x".repeat(400) })],
  });
  const raiz = generarXmlComprobante(c, calcularTotales(c.detalles));
  const xml = canonico(raiz);
  assert(!xml.includes("\n") && !xml.includes("&#xD;"));
  assertEquals(await erroresXsd(documento(raiz), "01"), []);
});

Deno.test("xml: más de 15 campos adicionales es un error, no se truncan", () => {
  const c = factura({ infoAdicional: Array.from({ length: 15 }, (_, i) => ({ nombre: `C${i}`, valor: "v" })) });
  // 15 propios + el correo del comprador = 16.
  assertThrows(() => generarXmlComprobante(c, calcularTotales(c.detalles)), Error, "infoAdicional");
});
