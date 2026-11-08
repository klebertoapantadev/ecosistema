// Port de Domo.Firma.Sri.Tests/ValidadorIdentificacionTests.cs.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1.0.13";
import type { TipoIdentificacion } from "../comprobante.ts";
import { cedulaValida, validarIdentificacion } from "../identificacion.ts";

Deno.test("identificacion: valida cédulas ecuatorianas (provincia, tercer dígito y módulo 10)", () => {
  const casos: [string, boolean][] = [
    ["1710034065", true],
    ["0926687856", true],
    ["1713175071", true],
    ["2400123457", true], // provincia 24
    ["3001234560", true], // provincia 30 (cédula otorgada en el exterior)
    ["1710034066", false], // dígito verificador alterado (el real es 5)
    ["0010034065", false], // provincia 00 inválida
    ["2510034065", false], // provincia 25 inválida (no existe, y no es 30)
    ["1760034065", false], // tercer dígito 6: no es persona natural, no vale como cédula
    ["171003406", false], // 9 dígitos
    ["17100340655", false], // 11 dígitos
    ["171003406A", false], // no numérico
    ["", false],
  ];

  for (const [id, esperado] of casos) {
    assertEquals(cedulaValida(id), esperado, `cedulaValida("${id}")`);
    const res = validarIdentificacion("05", id);
    assertEquals(res.valida, esperado, `validarIdentificacion("05", "${id}")`);
    assertEquals(res.motivo === null, esperado);
  }
});

Deno.test("identificacion: valida RUC de persona natural, sociedad y entidad pública", () => {
  const casos: [string, boolean][] = [
    ["1710034065001", true], // RUC de persona natural: cédula válida + 001
    ["1710034066001", false], // cédula con DV incorrecto + 001
    ["1790012345001", true], // sociedad (tercer dígito 9): solo formato, sin DV
    ["1760001550001", true], // entidad pública (tercer dígito 6): solo formato, sin DV
    ["179001234500", false], // 12 dígitos
    ["17900123450012", false], // 14 dígitos
    ["1790012345002", false], // no termina en 001
    ["179001234500A", false], // no numérico
  ];

  for (const [id, esperado] of casos) {
    const res = validarIdentificacion("04", id);
    assertEquals(res.valida, esperado, `validarIdentificacion("04", "${id}")`);
    assertEquals(res.motivo === null, esperado);
  }
});

Deno.test("identificacion: valida consumidor final", () => {
  const casos: [string, boolean][] = [
    ["9999999999999", true],
    ["9999999999998", false],
    ["999999999999", false], // 12 nueves
    ["1710034065", false], // una cédula real no vale como consumidor final
  ];

  for (const [id, esperado] of casos) {
    const res = validarIdentificacion("07", id);
    assertEquals(res.valida, esperado, `validarIdentificacion("07", "${id}")`);
  }
});

Deno.test("identificacion: valida pasaporte e identificación del exterior (1..20 caracteres)", () => {
  const casos: [TipoIdentificacion, string, boolean][] = [
    ["06", "AB1234567", true],
    ["06", "X", true],
    ["06", "", false],
    ["06", "123456789012345678901", false], // 21 caracteres
    ["08", "ABCDEFGHIJKLMNOPQRST", true], // 20 caracteres, límite superior
    ["08", "ABCDEFGHIJKLMNOPQRSTU", false], // 21 caracteres
    ["08", "", false],
  ];

  for (const [tipo, id, esperado] of casos) {
    const res = validarIdentificacion(tipo, id);
    assertEquals(res.valida, esperado, `validarIdentificacion("${tipo}", "${id}")`);
  }
});

Deno.test("identificacion: rechaza tipos de identificación desconocidos", () => {
  for (const tipo of ["00", "99", ""] as unknown as TipoIdentificacion[]) {
    const res = validarIdentificacion(tipo, "1710034065");
    assertFalse(res.valida);
    assert(res.motivo !== null);
  }
});
