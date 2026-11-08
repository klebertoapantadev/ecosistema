// Port de los casos de Domo.Firma.Sri.Tests/GeneradorXmlTests.cs adaptados al árbol Elemento.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { calcularTotales } from "../totales.ts";
import { generarXmlComprobante } from "../xml-comprobante.ts";
import { canonico, documento, type Elemento } from "../xml.ts";
import { factura, linea, notaCredito } from "./ayudas.ts";
import { erroresXsd } from "./xsd.ts";

function buscarElemento(raiz: Elemento, ruta: string): Elemento | undefined {
  const partes = ruta.split("/").filter(Boolean);
  if (partes.length === 0 || raiz.nombre !== partes[0]) return undefined;
  let actual: Elemento = raiz;
  for (let i = 1; i < partes.length; i++) {
    const siguiente = actual.hijos.find(
      (h): h is Elemento => typeof h !== "string" && h.nombre === partes[i],
    );
    if (!siguiente) return undefined;
    actual = siguiente;
  }
  return actual;
}

function buscarElementos(raiz: Elemento, ruta: string): Elemento[] {
  const partes = ruta.split("/").filter(Boolean);
  if (partes.length === 0 || raiz.nombre !== partes[0]) return [];
  let actuales: Elemento[] = [raiz];
  for (let i = 1; i < partes.length; i++) {
    const nombre = partes[i];
    const siguientes: Elemento[] = [];
    for (const act of actuales) {
      for (const h of act.hijos) {
        if (typeof h !== "string" && h.nombre === nombre) {
          siguientes.push(h);
        }
      }
    }
    actuales = siguientes;
  }
  return actuales;
}

function valorTexto(raiz: Elemento, ruta: string): string | undefined {
  const el = buscarElemento(raiz, ruta);
  if (!el) return undefined;
  return el.hijos.filter((h): h is string => typeof h === "string").join("");
}

Deno.test("xml-domo: factura 15 % es válida contra XSD y tiene los valores clave", async () => {
  const detalles = [linea({ orden: 1, cantidad: "2", precioUnitario: "12.50", descuento: "0.00", codigoIva: "4" })];
  const totales = calcularTotales(detalles);
  const c = factura({
    numero: 1,
    fechaEmision: "2026-01-15",
    detalles,
    pagos: [{ formaPago: "01", total: totales.importeTotal, plazo: null, unidadTiempo: null }],
  });

  const raiz = generarXmlComprobante(c, totales);
  assertEquals(await erroresXsd(documento(raiz), "01"), []);
  assertEquals(raiz.nombre, "factura");
  assertEquals(raiz.atributos.id, "comprobante");
  assertEquals(raiz.atributos.version, "1.1.0");
  assertEquals(valorTexto(raiz, "/factura/infoTributaria/ambiente"), "1");
  assertEquals(valorTexto(raiz, "/factura/infoTributaria/tipoEmision"), "1");
  assertEquals(valorTexto(raiz, "/factura/infoTributaria/codDoc"), "01");
  assertEquals(valorTexto(raiz, "/factura/infoTributaria/claveAcceso"), c.claveAcceso);
  assertEquals(valorTexto(raiz, "/factura/infoTributaria/secuencial"), "000000001");
  assertEquals(valorTexto(raiz, "/factura/infoFactura/fechaEmision"), "15/01/2026");
  assertEquals(valorTexto(raiz, "/factura/infoFactura/moneda"), "DOLAR");
  assertEquals(valorTexto(raiz, "/factura/infoFactura/importeTotal"), totales.importeTotal);
  assertEquals(valorTexto(raiz, "/factura/infoFactura/totalSinImpuestos"), totales.totalSinImpuestos);
  assertEquals(valorTexto(raiz, "/factura/infoFactura/totalConImpuestos/totalImpuesto/tarifa"), "15");
});

Deno.test("xml-domo: factura 0 %", async () => {
  const detalles = [linea({ orden: 1, cantidad: "1", precioUnitario: "35", descuento: "0.00", codigoIva: "0" })];
  const totales = calcularTotales(detalles);
  const c = factura({
    detalles,
    pagos: [{ formaPago: "01", total: totales.importeTotal, plazo: null, unidadTiempo: null }],
  });

  const raiz = generarXmlComprobante(c, totales);
  assertEquals(await erroresXsd(documento(raiz), "01"), []);
  assertEquals(valorTexto(raiz, "/factura/infoFactura/totalConImpuestos/totalImpuesto/tarifa"), "0");
  assertEquals(valorTexto(raiz, "/factura/infoFactura/totalConImpuestos/totalImpuesto/valor"), "0.00");
});

Deno.test("xml-domo: factura mixta 15 % y 0 % genera dos grupos ordenados", async () => {
  const detalles = [
    linea({ orden: 1, cantidad: "2", precioUnitario: "12.50", descuento: "0.00", codigoIva: "4" }),
    linea({ orden: 2, cantidad: "1", precioUnitario: "40", descuento: "0.00", codigoIva: "0" }),
  ];
  const totales = calcularTotales(detalles);
  const c = factura({
    detalles,
    pagos: [{ formaPago: "01", total: totales.importeTotal, plazo: null, unidadTiempo: null }],
  });

  const raiz = generarXmlComprobante(c, totales);
  assertEquals(await erroresXsd(documento(raiz), "01"), []);

  const tarifas = buscarElementos(raiz, "/factura/infoFactura/totalConImpuestos/totalImpuesto/tarifa")
    .map((e) => e.hijos.join(""));
  assertEquals(tarifas, ["0", "15"]);

  const detallesXml = buscarElementos(raiz, "/factura/detalles/detalle");
  assertEquals(detallesXml.length, 2);
});

Deno.test("xml-domo: factura RIMPE emprendedor y negocio popular incluyen su leyenda", async () => {
  const base = factura();
  const emprendedor = factura({
    emisor: { ...base.emisor, regimen: "RIMPE_EMPRENDEDOR", obligadoContabilidad: false },
  });
  const popular = factura({
    emisor: { ...base.emisor, regimen: "RIMPE_NEGOCIO_POPULAR", obligadoContabilidad: false },
  });

  const raizEmp = generarXmlComprobante(emprendedor, calcularTotales(emprendedor.detalles));
  assertEquals(await erroresXsd(documento(raizEmp), "01"), []);
  assertEquals(valorTexto(raizEmp, "/factura/infoTributaria/contribuyenteRimpe"), "CONTRIBUYENTE RÉGIMEN RIMPE");
  assertEquals(valorTexto(raizEmp, "/factura/infoFactura/obligadoContabilidad"), "NO");

  const raizPop = generarXmlComprobante(popular, calcularTotales(popular.detalles));
  assertEquals(await erroresXsd(documento(raizPop), "01"), []);
  assertEquals(
    valorTexto(raizPop, "/factura/infoTributaria/contribuyenteRimpe"),
    "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
  );
});

Deno.test("xml-domo: nota de crédito RIMPE negocio popular incluye la leyenda exacta", async () => {
  const base = notaCredito();
  const nc = notaCredito({
    emisor: { ...base.emisor, regimen: "RIMPE_NEGOCIO_POPULAR", obligadoContabilidad: false },
    motivo: "Devolución parcial",
  });
  const raiz = generarXmlComprobante(nc, calcularTotales(nc.detalles));
  assertEquals(await erroresXsd(documento(raiz), "04"), []);
  assertEquals(
    valorTexto(raiz, "/notaCredito/infoTributaria/contribuyenteRimpe"),
    "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE",
  );
});

Deno.test("xml-domo: factura sin infoAdicional ni correo omite el elemento; con correo lo agrega", async () => {
  const base = factura();
  const sinInfo = factura({
    comprador: { ...base.comprador, correo: null },
    infoAdicional: [],
  });
  const raizSin = generarXmlComprobante(sinInfo, calcularTotales(sinInfo.detalles));
  assertEquals(await erroresXsd(documento(raizSin), "01"), []);
  assertEquals(buscarElemento(raizSin, "/factura/infoAdicional"), undefined);

  const conCorreo = factura({
    comprador: { ...base.comprador, correo: "cliente@example.com" },
    infoAdicional: [{ nombre: "Teléfono", valor: "0999999999" }],
  });
  const raizCon = generarXmlComprobante(conCorreo, calcularTotales(conCorreo.detalles));
  assertEquals(await erroresXsd(documento(raizCon), "01"), []);
  const campos = buscarElementos(raizCon, "/factura/infoAdicional/campoAdicional");
  assertEquals(campos.length, 2);
  assertEquals(campos[0].atributos.nombre, "Teléfono");
  assertEquals(campos[1].atributos.nombre, "Email");
  assertEquals(campos[1].hijos.join(""), "cliente@example.com");
});

Deno.test("xml-domo: cantidades con hasta 6 decimales no se recortan y enteros usan 2 decimales", async () => {
  const detalles = [linea({ orden: 1, cantidad: "0.333333", precioUnitario: "3", descuento: "0.00", codigoIva: "4" })];
  const totales = calcularTotales(detalles);
  const c = factura({
    detalles,
    pagos: [{ formaPago: "01", total: totales.importeTotal, plazo: null, unidadTiempo: null }],
  });

  const raiz = generarXmlComprobante(c, totales);
  assertEquals(await erroresXsd(documento(raiz), "01"), []);
  assertEquals(valorTexto(raiz, "/factura/detalles/detalle/cantidad"), "0.333333");
  assertEquals(valorTexto(raiz, "/factura/detalles/detalle/precioUnitario"), "3.00");
});

Deno.test("xml-domo: textos con ampersand, menor que, acentos y saltos de línea se escapan y normalizan", async () => {
  const detalles = [
    linea({
      orden: 1,
      cantidad: "1",
      precioUnitario: "10",
      descuento: "0.00",
      codigoIva: "0",
      descripcion: "Café & té <premium>\ncon leche",
    }),
  ];
  const totales = calcularTotales(detalles);
  const c = factura({
    detalles,
    pagos: [{ formaPago: "01", total: totales.importeTotal, plazo: null, unidadTiempo: null }],
  });

  const raiz = generarXmlComprobante(c, totales);
  const xmlCrudo = canonico(raiz);
  assertStringIncludes(xmlCrudo, "&amp;");
  assertStringIncludes(xmlCrudo, "&lt;");
  assert(!xmlCrudo.includes("\n"));
  assertEquals(valorTexto(raiz, "/factura/detalles/detalle/descripcion"), "Café & té <premium> con leche");
  assertEquals(await erroresXsd(documento(raiz), "01"), []);
});

Deno.test("xml-domo: nota de crédito es válida, tiene valores clave y no emite tarifa en totalImpuesto ni pagos", async () => {
  const detalles = [linea({ orden: 1, cantidad: "1", precioUnitario: "20", descuento: "0.00", codigoIva: "4" })];
  const totales = calcularTotales(detalles);
  const nc = notaCredito({
    detalles,
    modifica: { codDoc: "01", numero: "001-001-000000001", fechaEmision: "2026-01-15" },
    motivo: "Devolución parcial",
  });

  const raiz = generarXmlComprobante(nc, totales);
  assertEquals(await erroresXsd(documento(raiz), "04"), []);
  assertEquals(raiz.nombre, "notaCredito");
  assertEquals(valorTexto(raiz, "/notaCredito/infoTributaria/codDoc"), "04");
  assertEquals(valorTexto(raiz, "/notaCredito/infoNotaCredito/codDocModificado"), "01");
  assertEquals(valorTexto(raiz, "/notaCredito/infoNotaCredito/numDocModificado"), "001-001-000000001");
  assertEquals(valorTexto(raiz, "/notaCredito/infoNotaCredito/fechaEmisionDocSustento"), "15/01/2026");
  assertEquals(valorTexto(raiz, "/notaCredito/infoNotaCredito/valorModificacion"), totales.importeTotal);
  assertEquals(valorTexto(raiz, "/notaCredito/infoNotaCredito/motivo"), "Devolución parcial");
  assertEquals(
    buscarElemento(raiz, "/notaCredito/infoNotaCredito/totalConImpuestos/totalImpuesto/tarifa"),
    undefined,
  );
  assertEquals(buscarElemento(raiz, "/notaCredito/infoNotaCredito/pagos"), undefined);
});

Deno.test("xml-domo: agenteRetencion se emite sin ceros a la izquierda y todo ceros se omite", async () => {
  const base = factura();
  const conAgente = factura({ emisor: { ...base.emisor, agenteRetencion: "0012345" } });
  const raizCon = generarXmlComprobante(conAgente, calcularTotales(conAgente.detalles));
  assertEquals(await erroresXsd(documento(raizCon), "01"), []);
  assertEquals(valorTexto(raizCon, "/factura/infoTributaria/agenteRetencion"), "12345");

  const todoCeros = factura({ emisor: { ...base.emisor, agenteRetencion: "0000000" } });
  const raizCeros = generarXmlComprobante(todoCeros, calcularTotales(todoCeros.detalles));
  assertEquals(await erroresXsd(documento(raizCeros), "01"), []);
  assertEquals(buscarElemento(raizCeros, "/factura/infoTributaria/agenteRetencion"), undefined);
});

Deno.test("xml-domo: caracteres no válidos en XML 1.0 se eliminan y emojis no se parten al truncar", async () => {
  const emoji = "\u{1F600}";
  const codigo = "A".repeat(24) + emoji + "B".repeat(10);
  const detalles = [
    linea({
      orden: 1,
      codigo,
      descripcion: "Producto\u0001 con\uFFFE control",
      cantidad: "1",
      precioUnitario: "10",
      descuento: "0.00",
      codigoIva: "0",
    }),
  ];
  const totales = calcularTotales(detalles);
  const c = factura({
    detalles,
    pagos: [{ formaPago: "01", total: totales.importeTotal, plazo: null, unidadTiempo: null }],
  });

  const raiz = generarXmlComprobante(c, totales);
  assertEquals(await erroresXsd(documento(raiz), "01"), []);
  assertEquals(valorTexto(raiz, "/factura/detalles/detalle/descripcion"), "Producto con control");
  assertEquals(valorTexto(raiz, "/factura/detalles/detalle/codigoPrincipal"), "A".repeat(24) + emoji);
});
