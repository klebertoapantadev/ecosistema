import { describe, expect, it } from "vitest";
import {
  calcularPrecioPorVolumen,
  describirEscalaVolumen,
  normalizarComponentesCombo,
  normalizarEscalasVolumen,
} from "./combosVolumen";

describe("combosVolumen - escalas por cantidad y sets de eventos", () => {
  it("aplica precio fijo cuando supera la cantidad mínima (ej. Cartel $70 -> 2+ uds a $60)", () => {
    const escalas = normalizarEscalasVolumen([
      { min_cantidad: 2, tipo: "PRECIO_FIJO", valor: 60 },
    ]);

    const uno = calcularPrecioPorVolumen({
      pvpUnitarioNominal: 70,
      tarifaIvaPorcentaje: 0,
      cantidad: 1,
      escalas,
    });
    expect(uno.tieneDescuentoVolumen).toBe(false);
    expect(uno.pvpUnitarioFinal).toBe(70);
    expect(uno.subtotalLineaFinal).toBe(70);

    const dos = calcularPrecioPorVolumen({
      pvpUnitarioNominal: 70,
      tarifaIvaPorcentaje: 0,
      cantidad: 2,
      escalas,
    });
    expect(dos.tieneDescuentoVolumen).toBe(true);
    expect(dos.pvpUnitarioFinal).toBe(60);
    expect(dos.subtotalLineaNominal).toBe(140);
    expect(dos.subtotalLineaFinal).toBe(120);
    expect(dos.ahorroTotalLinea).toBe(20);
  });

  it("aplica descuento porcentual (ej. Cartel $70 -> 2+ uds con 10% OFF = $63 c/u)", () => {
    const res = calcularPrecioPorVolumen({
      pvpUnitarioNominal: 70,
      tarifaIvaPorcentaje: 0,
      cantidad: 3,
      escalas: [{ min_cantidad: 2, tipo: "DESCUENTO_PORCENTAJE", valor: 10 }],
    });

    expect(res.tieneDescuentoVolumen).toBe(true);
    expect(res.pvpUnitarioFinal).toBe(63);
    expect(res.subtotalLineaFinal).toBe(189);
    expect(res.porcentajeDescuento).toBe(10);
  });

  it("aplica descuento en monto fijo por unidad y recalcula base imponible con IVA 15%", () => {
    const res = calcularPrecioPorVolumen({
      pvpUnitarioNominal: 115,
      tarifaIvaPorcentaje: 15,
      cantidad: 4,
      escalas: [{ min_cantidad: 3, tipo: "DESCUENTO_MONTO", valor: 11.5 }],
    });

    expect(res.pvpUnitarioFinal).toBe(103.5);
    expect(res.baseImponibleUnitariaFinal).toBe(90);
    expect(res.subtotalLineaFinal).toBe(414);
  });

  it("normaliza componentes de un Set de Bienvenida (Aro $150 + 2 Carteles $70)", () => {
    const comps = normalizarComponentesCombo([
      { producto_id: "prod-aro", variante_sku: "TNK-ARO-STD", cantidad_base: 1, orden: 1 },
      { producto_id: "prod-cartel", variante_sku: "TNK-CARTEL-STD", cantidad_base: 2, orden: 2 },
    ]);

    expect(comps).toHaveLength(2);
    expect(comps[0]?.cantidad_base).toBe(1);
    expect(comps[1]?.cantidad_base).toBe(2);
    expect(
      describirEscalaVolumen({ min_cantidad: 2, tipo: "PRECIO_FIJO", valor: 60 }, 70)
    ).toBe("2+ uds a $60.00 c/u");
  });
});

