import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import { calcularTotales } from "../totales.ts";
import { linea } from "./ayudas.ts";

// Oráculo compartido con DOMO (19 casos, incluidos repartos de centavos
// positivos, negativos y en dos grupos). Algoritmo: IMPLEMENTACION.md §4 de DOMO.
interface Caso {
  nombre: string;
  lineas: { cantidad: string; precio_unitario: string; descuento: string; iva_codigo_porcentaje: string }[];
  esperado: {
    lineas: { base: string; valor_iva: string }[];
    grupos: { codigo_porcentaje: string; tarifa: string; base: string; valor: string }[];
    total_sin_impuestos: string;
    total_descuento: string;
    total_iva: string;
    importe_total: string;
  };
}

const oraculo: { casos: Caso[] } = JSON.parse(
  await Deno.readTextFile(new URL("./datos/casos-totales.json", import.meta.url)),
);

for (const caso of oraculo.casos) {
  Deno.test(`totales: ${caso.nombre}`, () => {
    const t = calcularTotales(
      caso.lineas.map((l, i) =>
        linea({
          orden: i + 1,
          cantidad: l.cantidad,
          precioUnitario: l.precio_unitario,
          descuento: l.descuento,
          codigoIva: l.iva_codigo_porcentaje,
        })
      ),
    );
    assertEquals(t.lineas.map((l) => ({ base: l.base, valor_iva: l.valorIva })), caso.esperado.lineas);
    assertEquals(
      t.grupos.map((g) => ({ codigo_porcentaje: g.codigoPorcentaje, tarifa: g.tarifa, base: g.base, valor: g.valor })),
      caso.esperado.grupos,
    );
    assertEquals(t.totalSinImpuestos, caso.esperado.total_sin_impuestos);
    assertEquals(t.totalDescuento, caso.esperado.total_descuento);
    assertEquals(t.totalIva, caso.esperado.total_iva);
    assertEquals(t.importeTotal, caso.esperado.importe_total);
  });
}

Deno.test("totales: base negativa es un error", () => {
  assertThrows(() => calcularTotales([linea({ orden: 1, precioUnitario: "1.00", descuento: "2.00" })]));
});

Deno.test("totales: código de IVA desconocido es un error", () => {
  assertThrows(() => calcularTotales([linea({ orden: 1, codigoIva: "99" })]));
});

Deno.test("totales: sin flotantes (0.1 + 0.2)", () => {
  const t = calcularTotales([
    linea({ orden: 1, precioUnitario: "0.1", codigoIva: "0" }),
    linea({ orden: 2, precioUnitario: "0.2", codigoIva: "0" }),
  ]);
  assertEquals(t.totalSinImpuestos, "0.30");
  assertEquals(t.importeTotal, "0.30");
});
