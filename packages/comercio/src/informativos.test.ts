import { describe, expect, it } from "vitest";
import {
  filtrarCampanasPorNegocioYCriterios,
  normalizarNegocioCampana,
  obtenerSemillasCampanasPorNegocio,
  perteneceCampanaANegocio,
  type CampanaInformativa,
} from "./utils/informativos";

describe("Aislamiento Multi-Negocio de Campañas Informativas y Promociones", () => {
  it("normaliza variantes de códigos de los 4 negocios del ecosistema sin mezclarlos", () => {
    expect(normalizarNegocioCampana("tinkay")).toBe("tinkay");
    expect(normalizarNegocioCampana("TNK")).toBe("tinkay");
    expect(normalizarNegocioCampana("margaritas")).toBe("margaritas");
    expect(normalizarNegocioCampana("MRG")).toBe("margaritas");
    expect(normalizarNegocioCampana("fastfix")).toBe("fastfix");
    expect(normalizarNegocioCampana("FFH")).toBe("fastfix");
    expect(normalizarNegocioCampana("tranqi")).toBe("tranqi");
    expect(normalizarNegocioCampana("TRQ")).toBe("tranqi");
  });

  it("jamás entrega semillas legales o tributarias de Tranqi a Tinkay, Margaritas o FastFix", () => {
    expect(obtenerSemillasCampanasPorNegocio("tinkay")).toEqual([]);
    expect(obtenerSemillasCampanasPorNegocio("TNK")).toEqual([]);
    expect(obtenerSemillasCampanasPorNegocio("margaritas")).toEqual([]);
    expect(obtenerSemillasCampanasPorNegocio("fastfix")).toEqual([]);

    const semillasTranqi = obtenerSemillasCampanasPorNegocio("tranqi");
    expect(semillasTranqi.length).toBeGreaterThan(0);
    expect(semillasTranqi.every((c) => c.inf_negocio === "tranqi")).toBe(true);
  });

  it("perteneceCampanaANegocio bloquea campañas de otro negocio aunque usen alias", () => {
    const campanaTranqi = { inf_negocio: "tranqi" };
    const campanaTinkay = { inf_negocio: "TNK" };

    expect(perteneceCampanaANegocio(campanaTranqi, "tinkay")).toBe(false);
    expect(perteneceCampanaANegocio(campanaTranqi, "margaritas")).toBe(false);
    expect(perteneceCampanaANegocio(campanaTranqi, "fastfix")).toBe(false);
    expect(perteneceCampanaANegocio(campanaTranqi, "tranqi")).toBe(true);
    expect(perteneceCampanaANegocio(campanaTranqi, "TRQ")).toBe(true);

    expect(perteneceCampanaANegocio(campanaTinkay, "tinkay")).toBe(true);
    expect(perteneceCampanaANegocio(campanaTinkay, "tranqi")).toBe(false);
    expect(perteneceCampanaANegocio(null, "tinkay")).toBe(false);
    expect(perteneceCampanaANegocio({ inf_negocio: "" }, "tinkay")).toBe(false);
  });

  it("filtrarCampanasPorNegocioYCriterios descarta al 100% informativos legales de Tranqi al consultar Tinkay", () => {
    const campanaPromoTinkay: CampanaInformativa = {
      inf_id: "inf-tnk-promo-rosas",
      inf_negocio: "tinkay",
      inf_titulo: "15% OFF en Cajas de Rosas de Temporada",
      inf_slug: "15-off-cajas-rosas-temporada",
      inf_subtitulo: "Exclusivo para clientes registrados de Tinkay.",
      inf_contenido_md: null,
      inf_tipo: "BENEFICIO_CONVENIO",
      inf_audiencia: ["CLIENTES"],
      inf_ubicaciones: ["PANEL_BENEFICIOS", "PANEL_INICIO"],
      inf_fecha_inicio: "2026-11-01T00:00:00Z",
      inf_fecha_fin: "2026-12-31T23:59:59Z",
      inf_activo: true,
      inf_prioridad: "ALTA",
      inf_detalle: {
        porcentaje_descuento: "15% OFF",
        cta_texto: "Ver Cajas",
        cta_url: "/#catalogo",
      },
    };

    const mezclaContaminada: CampanaInformativa[] = [
      ...obtenerSemillasCampanasPorNegocio("tranqi"),
      campanaPromoTinkay,
    ];

    const visiblesEnTinkay = filtrarCampanasPorNegocioYCriterios({
      campanas: mezclaContaminada,
      negocio: "tinkay",
      audiencia: "CLIENTES",
      ahoraIso: "2026-11-17T18:00:00Z",
    });

    expect(visiblesEnTinkay).toHaveLength(1);
    expect(visiblesEnTinkay[0]?.inf_id).toBe("inf-tnk-promo-rosas");
    expect(visiblesEnTinkay.some((c) => c.inf_negocio !== "tinkay")).toBe(false);

    const visiblesEnMargaritas = filtrarCampanasPorNegocioYCriterios({
      campanas: mezclaContaminada,
      negocio: "margaritas",
      audiencia: "CLIENTES",
      ahoraIso: "2026-11-17T18:00:00Z",
    });

    expect(visiblesEnMargaritas).toEqual([]);
  });

  it("respeta filtros de vigencia temporal, ubicación y registros eliminados en sesión", () => {
    const semillasTranqi = obtenerSemillasCampanasPorNegocio("tranqi");
    const eliminados = new Set<string>(["noticia-001"]);

    const resultado = filtrarCampanasPorNegocioYCriterios({
      campanas: semillasTranqi,
      negocio: "tranqi",
      audiencia: "CLIENTES",
      ubicacion: "LANDING_BANNER",
      eliminados,
      ahoraIso: "2026-11-17T18:00:00Z",
    });

    // noticia-001 fue eliminada y inf-trq-alerta-ant venció el 2026-10-31
    expect(resultado.some((c) => c.inf_id === "noticia-001")).toBe(false);
    expect(resultado.some((c) => c.inf_id === "inf-trq-alerta-ant")).toBe(false);
    expect(resultado.every((c) => c.inf_negocio === "tranqi")).toBe(true);
    expect(resultado.every((c) => c.inf_ubicaciones.includes("LANDING_BANNER"))).toBe(true);
  });
});
