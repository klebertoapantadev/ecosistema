import { describe, expect, it } from "vitest";
import { fechaRenovacionSuscripcion, frecuenciaDerecho, periodoDerecho } from "./periodoDerecho";

const compra = { sub_creado_en: "2026-11-07T17:47:58Z", sub_frecuencia: "MENSUAL" };

describe("periodoDerecho", () => {
  it("un derecho ANUAL cuenta desde el aniversario de la compra", () => {
    const anual = { periodo: "ANUAL" };
    expect(periodoDerecho(compra, anual, new Date("2026-11-07T20:00:00Z"))).toBe("2026-11-07");
    expect(periodoDerecho(compra, anual, new Date("2027-03-15T12:00:00Z"))).toBe("2026-11-07");
    expect(periodoDerecho(compra, anual, new Date("2027-11-06T23:59:00Z"))).toBe("2026-11-07");
    expect(periodoDerecho(compra, anual, new Date("2027-11-07T00:00:00Z"))).toBe("2027-11-07");
  });

  it("sin periodo en el derecho manda la frecuencia de la suscripción", () => {
    expect(frecuenciaDerecho(compra, {})).toBe("MENSUAL");
    expect(periodoDerecho(compra, {}, new Date("2027-03-15T12:00:00Z"))).toBe("2027-03-01");
    expect(periodoDerecho({ ...compra, sub_frecuencia: "ANUAL" }, null, new Date("2027-03-15T12:00:00Z"))).toBe("2026-11-07");
  });

  it("una compra del 29 de febrero renueva el 28 en años no bisiestos", () => {
    const bisiesto = { sub_creado_en: "2028-02-29T10:00:00Z", sub_frecuencia: "ANUAL" };
    expect(periodoDerecho(bisiesto, null, new Date("2029-02-28T10:00:00Z"))).toBe("2029-02-28");
    expect(periodoDerecho(bisiesto, null, new Date("2029-02-27T10:00:00Z"))).toBe("2028-02-29");
  });

  it("sin fecha de compra cae al mes calendario", () => {
    expect(periodoDerecho({ sub_frecuencia: "ANUAL" }, null, new Date("2027-03-15T12:00:00Z"))).toBe("2027-03-01");
  });
});

describe("fechaRenovacionSuscripcion", () => {
  it("usa el próximo cobro si existe", () => {
    const r = fechaRenovacionSuscripcion({ ...compra, sub_proximo_cobro_en: "2027-11-07T17:47:58Z" });
    expect(r.toISOString().slice(0, 10)).toBe("2027-11-07");
  });

  it("ANUAL: el siguiente aniversario", () => {
    const r = fechaRenovacionSuscripcion({ ...compra, sub_frecuencia: "ANUAL" }, new Date("2027-03-15T12:00:00Z"));
    expect(r.toISOString().slice(0, 10)).toBe("2027-11-07");
  });

  it("ANUAL: el mismo día del aniversario ya cuenta el año siguiente", () => {
    const r = fechaRenovacionSuscripcion({ ...compra, sub_frecuencia: "ANUAL" }, new Date("2027-11-07T00:00:00Z"));
    expect(r.toISOString().slice(0, 10)).toBe("2028-11-07");
  });

  it("ANUAL: una compra del 29-feb renueva el 28-feb del año no bisiesto", () => {
    const r = fechaRenovacionSuscripcion({ sub_creado_en: "2028-02-29T10:00:00Z", sub_frecuencia: "ANUAL" }, new Date("2028-06-01T10:00:00Z"));
    expect(r.toISOString().slice(0, 10)).toBe("2029-02-28");
  });

  it("la fecha calculada no cambia de día al mostrarla en Ecuador", () => {
    const r = fechaRenovacionSuscripcion({ ...compra, sub_frecuencia: "ANUAL" }, new Date("2027-03-15T12:00:00Z"));
    expect(r.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", day: "numeric" })).toBe("7");
  });

  it("cadena vacía en el derecho cae a la frecuencia de la suscripción", () => {
    expect(frecuenciaDerecho({ sub_frecuencia: "ANUAL" }, { periodo: " " })).toBe("ANUAL");
  });

  it("MENSUAL: el mismo día del mes siguiente, ajustado a meses cortos", () => {
    const r = fechaRenovacionSuscripcion(compra, new Date("2026-11-14T12:00:00Z"));
    expect(r.toISOString().slice(0, 10)).toBe("2026-12-07");
    const fin = { sub_creado_en: "2026-01-31T10:00:00Z", sub_frecuencia: "MENSUAL" };
    expect(fechaRenovacionSuscripcion(fin, new Date("2026-02-10T10:00:00Z")).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});
