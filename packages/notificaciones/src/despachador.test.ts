import { describe, it, expect, afterEach } from "vitest";
import { autorizacionCronValida } from "./despachador";

/**
 * El despachador es el único endpoint del ecosistema que provoca envíos masivos
 * a los afiliados sin que haya una sesión detrás. Su única puerta es esta
 * comparación, así que se prueba aparte.
 */

const original = process.env.CRON_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("autorizacionCronValida", () => {
  it("rechaza cuando no hay secreto configurado, aunque manden cabecera", () => {
    delete process.env.CRON_SECRET;
    expect(autorizacionCronValida("Bearer loquesea")).toBe(false);
  });

  it("rechaza una cabecera ausente", () => {
    process.env.CRON_SECRET = "s3cr3to";
    expect(autorizacionCronValida(null)).toBe(false);
  });

  it("acepta el secreto correcto", () => {
    process.env.CRON_SECRET = "s3cr3to";
    expect(autorizacionCronValida("Bearer s3cr3to")).toBe(true);
  });

  it("rechaza el secreto equivocado de la misma longitud", () => {
    process.env.CRON_SECRET = "s3cr3to";
    expect(autorizacionCronValida("Bearer s3cr3tX")).toBe(false);
  });

  it("rechaza un prefijo correcto pero incompleto", () => {
    process.env.CRON_SECRET = "s3cr3to";
    expect(autorizacionCronValida("Bearer s3cr3t")).toBe(false);
  });

  it("exige el esquema Bearer, no el secreto suelto", () => {
    process.env.CRON_SECRET = "s3cr3to";
    expect(autorizacionCronValida("s3cr3to")).toBe(false);
  });

  it("no acepta el secreto vacío como comodín", () => {
    process.env.CRON_SECRET = "";
    expect(autorizacionCronValida("Bearer ")).toBe(false);
  });
});
