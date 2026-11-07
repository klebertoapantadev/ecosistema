import { describe, expect, it } from "vitest";
import { cedulaValida, errorCampo, normalizarTipoIdentificacion, pasaporteValido, rucValido } from "./validacion";

const opciones = { tipoIdentificacion: "cedula" as const, direccionObligatoria: false };

describe("cedulaValida", () => {
  it("acepta cédulas con dígito verificador correcto", () => {
    expect(cedulaValida("1710034065")).toBe(true);
    expect(cedulaValida("0926687856")).toBe(true);
  });

  it("rechaza dígito verificador, provincia o longitud incorrectos", () => {
    expect(cedulaValida("1710034066")).toBe(false);
    expect(cedulaValida("2510034065")).toBe(false);
    expect(cedulaValida("171003406")).toBe(false);
    expect(cedulaValida("17100340651")).toBe(false);
    expect(cedulaValida("17A0034065")).toBe(false);
  });

  it("rechaza tercer dígito de sociedad", () => {
    expect(cedulaValida("1790034065")).toBe(false);
  });
});

describe("rucValido", () => {
  it("acepta RUC de persona natural si la cédula base es válida", () => {
    expect(rucValido("1710034065001")).toBe(true);
    expect(rucValido("1710034066001")).toBe(false);
  });

  it("acepta RUC de sociedades y entidades públicas por forma", () => {
    expect(rucValido("1790012345001")).toBe(true);
    expect(rucValido("1760001550001")).toBe(true);
  });

  it("rechaza establecimiento 000, tercer dígito 7-8 y longitudes incorrectas", () => {
    expect(rucValido("1790012345000")).toBe(false);
    expect(rucValido("1770012345001")).toBe(false);
    expect(rucValido("179001234500")).toBe(false);
  });
});

describe("pasaporteValido", () => {
  it("acepta alfanuméricos de 5 a 20 caracteres", () => {
    expect(pasaporteValido("AB12345")).toBe(true);
    expect(pasaporteValido("AB 12")).toBe(false);
    expect(pasaporteValido("A1")).toBe(false);
  });
});

describe("errorCampo", () => {
  it("valida la identificación según el tipo elegido", () => {
    expect(errorCampo("identificacion", "1710034065", opciones)).toBeNull();
    expect(errorCampo("identificacion", "1710034065", { ...opciones, tipoIdentificacion: "ruc" })).not.toBeNull();
    expect(errorCampo("identificacion", "", opciones)).not.toBeNull();
  });

  it("solo exige la dirección cuando la pasarela la pide", () => {
    expect(errorCampo("direccion", "", opciones)).toBeNull();
    expect(errorCampo("direccion", "", { ...opciones, direccionObligatoria: true })).not.toBeNull();
    expect(errorCampo("direccion", "Av. Amazonas N34", { ...opciones, direccionObligatoria: true })).toBeNull();
  });

  it("valida correo y teléfono", () => {
    expect(errorCampo("email", "andrea@ejemplo.com", opciones)).toBeNull();
    expect(errorCampo("email", "andrea@ejemplo", opciones)).not.toBeNull();
    expect(errorCampo("telefono", "0991234567", opciones)).toBeNull();
    expect(errorCampo("telefono", "+593 99 123 4567", opciones)).toBeNull();
    expect(errorCampo("telefono", "12", opciones)).not.toBeNull();
  });
});

describe("normalizarTipoIdentificacion", () => {
  it("cae a cédula ante valores desconocidos", () => {
    expect(normalizarTipoIdentificacion("ruc")).toBe("ruc");
    expect(normalizarTipoIdentificacion("otro")).toBe("cedula");
    expect(normalizarTipoIdentificacion(undefined)).toBe("cedula");
  });
});
