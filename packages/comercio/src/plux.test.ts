import { describe, expect, it } from "vitest";
import { centavosATexto, datosPaybox, montosPaybox, respuestaExitosa } from "./plux";

describe("centavosATexto", () => {
  it("formatea con dos decimales", () => {
    expect(centavosATexto(2300)).toBe("23.00");
    expect(centavosATexto(5)).toBe("0.05");
    expect(centavosATexto(1150)).toBe("11.50");
  });

  it("rechaza montos que no son centavos enteros", () => {
    expect(() => centavosATexto(23.5)).toThrow();
  });
});

describe("montosPaybox", () => {
  it("un producto con IVA va entero a Base12, con el IVA incluido", () => {
    expect(montosPaybox({ base_centavos: 2000, iva_centavos: 300 })).toEqual({
      PayboxBase0: "0.00",
      PayboxBase12: "23.00",
    });
  });

  it("un producto sin IVA va a Base0", () => {
    expect(montosPaybox({ base_centavos: 2000, iva_centavos: 0 })).toEqual({
      PayboxBase0: "20.00",
      PayboxBase12: "0.00",
    });
  });
});

describe("datosPaybox", () => {
  const preparado = {
    identificador: "TRQ-PLX-ABC123DEF456",
    ambiente: "PRUEBAS" as const,
    remail: "comercio@ejemplo.com",
    nombre_comercio: "Tranqi",
    descripcion: "Plan Esencial - Mensual",
    base_centavos: 2000,
    iva_centavos: 300,
    total_centavos: 2300,
  };
  const pagador = {
    nombre: "Ana Pérez",
    identificacion: "1712345675",
    email: "ana@ejemplo.com",
    telefono: "0999999999",
    direccion: "Quito",
  };

  it("usa el sandbox en PRUEBAS y lleva el identificador en extras", () => {
    const d = datosPaybox(preparado, pagador);
    expect(d.PayboxEnvironment).toBe("sandbox");
    expect(d.PayboxProduction).toBe(false);
    expect(d.PayboxExtras).toBe("TRQ-PLX-ABC123DEF456");
    expect(d.PayboxBase12).toBe("23.00");
  });

  it("usa producción en PRODUCCION", () => {
    const d = datosPaybox({ ...preparado, ambiente: "PRODUCCION" }, pagador);
    expect(d.PayboxEnvironment).toBe("prod");
    expect(d.PayboxProduction).toBe(true);
  });
});

describe("respuestaExitosa", () => {
  it("acepta succeeded y la errata succeded de la guía", () => {
    expect(respuestaExitosa({ status: "succeeded" })).toBe(true);
    expect(respuestaExitosa({ status: "succeded" })).toBe(true);
  });

  it("el cierre del modal no es un éxito", () => {
    expect(respuestaExitosa({ status: "failed", description: "Paybox cerrado" })).toBe(false);
    expect(respuestaExitosa(null)).toBe(false);
  });
});
