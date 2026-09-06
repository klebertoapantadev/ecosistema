import { describe, expect, it } from "vitest";
import {
  nivelDeConfianza,
  similitudNombres,
  validarCedulaEcuatoriana,
} from "./cedula-ecuador";

describe("validarCedulaEcuatoriana", () => {
  it("acepta una cédula real de Pichincha", () => {
    // 1719103986 es la que usa como ejemplo la propia especificación de TRQ-ABG-005.
    const r = validarCedulaEcuatoriana("1719103986");
    expect(r.valida).toBe(true);
    expect(r.provincia).toBe(17);
  });

  it("acepta con guiones y espacios, que es como la teclea la gente", () => {
    expect(validarCedulaEcuatoriana("171-910-3986").valida).toBe(true);
    expect(validarCedulaEcuatoriana(" 1719103986 ").valida).toBe(true);
  });

  it("rechaza si el dígito verificador no cuadra", () => {
    // Mismo número con el último dígito cambiado.
    const r = validarCedulaEcuatoriana("1719103987");
    expect(r.valida).toBe(false);
    expect(r.motivo).toContain("verificador");
  });

  it("rechaza una provincia inexistente", () => {
    const r = validarCedulaEcuatoriana("9919103986");
    expect(r.valida).toBe(false);
    expect(r.motivo).toContain("provincia");
  });

  it("rechaza un RUC de sociedad (tercer dígito 9)", () => {
    const r = validarCedulaEcuatoriana("1791234567");
    expect(r.valida).toBe(false);
    expect(r.motivo).toContain("persona natural");
  });

  it("rechaza longitudes que no son 10", () => {
    expect(validarCedulaEcuatoriana("17191039").valida).toBe(false);
    expect(validarCedulaEcuatoriana("17191039861").valida).toBe(false);
    expect(validarCedulaEcuatoriana("").valida).toBe(false);
  });

  it("acepta los códigos especiales 30 (consulados) y 50 (refugiados) si el módulo 10 cuadra", () => {
    // Se construye un número válido para provincia 30 calculando su verificador.
    const base = "300123456";
    let suma = 0;
    for (let i = 0; i < 9; i += 1) {
      const d = Number(base[i]);
      if (i % 2 === 0) {
        const doble = d * 2;
        suma += doble > 9 ? doble - 9 : doble;
      } else {
        suma += d;
      }
    }
    const dec = Math.ceil(suma / 10) * 10;
    const verificador = dec - suma === 10 ? 0 : dec - suma;
    expect(validarCedulaEcuatoriana(base + verificador).valida).toBe(true);
  });
});

describe("similitudNombres", () => {
  it("da 1 cuando es la misma persona con el orden cambiado", () => {
    expect(similitudNombres("Carlos Alberto Pérez Mena", "PEREZ MENA CARLOS ALBERTO")).toBe(1);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(similitudNombres("JOSÉ MARÍA ÑÁÑEZ", "jose maria ñañez")).toBe(1);
  });

  it("tolera que falte un segundo nombre", () => {
    // "Carlos Pérez Mena" está entero dentro del nombre completo.
    expect(similitudNombres("Carlos Pérez Mena", "Carlos Alberto Pérez Mena")).toBe(1);
  });

  it("baja cuando el apellido no coincide", () => {
    const s = similitudNombres("Carlos Alberto Pérez Mena", "Carlos Alberto López Mena");
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(0.9);
  });

  it("da 0 con personas distintas", () => {
    expect(similitudNombres("Carlos Pérez", "María Fernanda López")).toBe(0);
  });

  it("no se deja engañar por una palabra repetida", () => {
    // "Carlos Carlos" no debe puntuar como si coincidieran dos palabras
    // distintas contra un único "Carlos" del otro nombre.
    expect(similitudNombres("Carlos Carlos", "Carlos Mena")).toBe(0.5);
  });

  it("devuelve 0 si alguno viene vacío", () => {
    expect(similitudNombres("", "Carlos Pérez")).toBe(0);
    expect(similitudNombres("Carlos Pérez", "   ")).toBe(0);
  });
});

describe("nivelDeConfianza", () => {
  it("aplica los tres tramos del semáforo", () => {
    expect(nivelDeConfianza(1)).toBe("APROBADO");
    expect(nivelDeConfianza(0.9)).toBe("APROBADO");
    expect(nivelDeConfianza(0.89)).toBe("OBSERVACION");
    expect(nivelDeConfianza(0.7)).toBe("OBSERVACION");
    expect(nivelDeConfianza(0.69)).toBe("RECHAZADO");
    expect(nivelDeConfianza(0)).toBe("RECHAZADO");
  });
});
