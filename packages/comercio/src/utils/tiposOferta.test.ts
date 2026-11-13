import { describe, expect, it } from "vitest";
import {
  esCodigoOfertaRenta,
  fusionarTiposOfertaConPresets,
  normalizarCodigoTipoOferta,
  normalizarConfiguracionRenta,
  obtenerTiposOfertaPorDefecto,
} from "./tiposOferta";

describe("tiposOferta — Renta de Mobiliario y Catálogo Administrable", () => {
  it("incluye por defecto RENTA para floristerías (Tinkay / Margaritas)", () => {
    const lista = obtenerTiposOfertaPorDefecto("tinkay");
    const codigos = lista.map((t) => t.tof_codigo);
    expect(codigos).toContain("FISICO");
    expect(codigos).toContain("SERVICIO");
    expect(codigos).toContain("RENTA");
    const renta = lista.find((t) => t.tof_codigo === "RENTA");
    expect(renta?.tof_nombre).toContain("Renta de Mobiliario");
    expect(renta?.tof_detalle_tipo_oferta?.es_renta).toBe(true);
  });

  it("detecta códigos y ofertas personalizadas marcadas como renta", () => {
    expect(esCodigoOfertaRenta("RENTA")).toBe(true);
    expect(esCodigoOfertaRenta("RENTA_ARCO_VIP")).toBe(true);
    expect(esCodigoOfertaRenta("ALQUILER_SILLAS")).toBe(true);
    expect(esCodigoOfertaRenta("FISICO")).toBe(false);
    expect(esCodigoOfertaRenta("CUSTOM", { es_renta: true })).toBe(true);
  });

  it("fusiona tipos personalizados de BDD y respeta eliminaciones explícitas", () => {
    const fusion = fusionarTiposOfertaConPresets(
      "tinkay",
      [
        {
          tof_id: "uuid-custom",
          tof_negocio: "tinkay",
          tof_codigo: "RENTA_VIP_48H",
          tof_nombre: "Renta Mobiliario Fin de Semana (48h)",
          tof_orden: 6,
          tof_activo: true,
          tof_detalle_tipo_oferta: { es_renta: true, etiqueta_corta: "🪑 Renta 48h" },
        },
      ],
      ["DIGITAL"]
    );

    expect(fusion.some((t) => t.tof_codigo === "RENTA")).toBe(true);
    expect(fusion.some((t) => t.tof_codigo === "RENTA_VIP_48H")).toBe(true);
    expect(fusion.some((t) => t.tof_codigo === "DIGITAL")).toBe(false);
  });

  it("normaliza códigos y configuración de condiciones de renta", () => {
    expect(normalizarCodigoTipoOferta("Renta de Mobiliario & Bases")).toBe("RENTA_DE_MOBILIARIO_BASES");
    const cfg = normalizarConfiguracionRenta({ periodo: "Fin de semana (48h)", deposito_garantia_usd: 25 });
    expect(cfg.periodo).toBe("Fin de semana (48h)");
    expect(cfg.deposito_garantia_usd).toBe(25);
    expect(cfg.incluye_retiro).toBe(true);
  });
});

