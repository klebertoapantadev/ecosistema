import { describe, expect, it } from "vitest";
import { estadoVigencia } from "./vigencia";

const AHORA = new Date("2026-09-22T12:00:00Z");

describe("estadoVigencia", () => {
  it("sin fecha de caducidad no vence nunca", () => {
    expect(estadoVigencia(null, true, 3, AHORA)).toEqual({ estado: "sin_caducidad", diasParaVencer: null });
  });

  it("una fecha pasada es vencido, aunque la alerta esté apagada", () => {
    expect(estadoVigencia("2026-09-01T12:00:00Z", false, 3, AHORA).estado).toBe("vencido");
  });

  it("dentro de la ventana configurada es por vencer", () => {
    // 6 días, ventana de 3 meses (90 días)
    expect(estadoVigencia("2026-09-28T12:00:00Z", true, 3, AHORA)).toEqual({ estado: "por_vencer", diasParaVencer: 6 });
  });

  it("fuera de la ventana es vigente", () => {
    // 100 días con ventana de 1 mes (30 días)
    expect(estadoVigencia("2026-12-31T12:00:00Z", true, 1, AHORA).estado).toBe("vigente");
  });

  it("con la alerta desactivada, lo que aún no venció es vigente", () => {
    expect(estadoVigencia("2026-09-28T12:00:00Z", false, 3, AHORA).estado).toBe("vigente");
  });

  it("sin meses configurados usa 3 (90 días), como la API de la billetera", () => {
    expect(estadoVigencia("2026-12-15T12:00:00Z", null, null, AHORA).estado).toBe("por_vencer");
    expect(estadoVigencia("2026-12-31T12:00:00Z", null, null, AHORA).estado).toBe("vigente");
  });
});
