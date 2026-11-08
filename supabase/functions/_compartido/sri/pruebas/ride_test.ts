import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { codificarCode128, generarRide } from "../ride.ts";
import { calcularTotales } from "../totales.ts";
import { escenarios } from "./ayudas.ts";

const autorizacion = {
  estado: "AUTORIZADO",
  numeroAutorizacion: "1111202401099338176200110020010000003961234567815",
  fechaAutorizacion: "2024-11-11T10:15:30-05:00",
  ambiente: "PRUEBAS",
  comprobanteXml: null,
  mensajes: [],
};

for (const [nombre, c] of Object.entries(escenarios())) {
  Deno.test(`ride: ${nombre} genera un PDF legible`, async () => {
    const bytes = await generarRide(c, calcularTotales(c.detalles), autorizacion, null);
    assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    const pdf = await PDFDocument.load(bytes);
    assert(pdf.getPageCount() >= 1);
  });
}

Deno.test("ride: muchas líneas pasan a una segunda página", async () => {
  const base = escenarios()["factura IVA 15 %"];
  const detalles = Array.from({ length: 60 }, (_, i) => ({ ...base.detalles[0], orden: i + 1 }));
  const bytes = await generarRide({ ...base, detalles }, calcularTotales(detalles), autorizacion, null);
  assert((await PDFDocument.load(bytes)).getPageCount() >= 2);
});

Deno.test("ride: el pie con mucha información adicional y pagos salta de página", async () => {
  const base = escenarios()["factura IVA 15 %"];
  const c = {
    ...base,
    infoAdicional: Array.from({ length: 14 }, (_, i) => ({ nombre: `Campo ${i + 1}`, valor: "texto largo ".repeat(25) })),
    pagos: Array.from({ length: 10 }, () => ({ formaPago: "20", total: "1.15", plazo: null, unidadTiempo: null })),
  };
  const bytes = await generarRide(c, calcularTotales(c.detalles), autorizacion, null);
  assert((await PDFDocument.load(bytes)).getPageCount() >= 2);
});

Deno.test("ride: Code 128 de un vector conocido", () => {
  // '12345': inicio C (105), 12, 34, cambio a B (100), '5' (21), control (105+12+68+300+84)%103 = 48, parada (106).
  const barras = codificarCode128("12345");
  assertEquals(barras.length, 11 * 6 + 13);
});
