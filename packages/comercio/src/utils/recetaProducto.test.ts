import { describe, expect, it } from "vitest";
import {
  COMPONENTES_RECETA_FLORISTERIA,
  formatearDescripcionComposicion,
  normalizarComposicionReceta,
  obtenerResumenFloresReceta,
  resolverComposicionRecetaEfectiva,
} from "./recetaProducto";

describe("recetaProducto (composición / receta multinegocio)", () => {
  it("formatea la descripción solo con componentes > 0 ('Aprox. 50 rosas, aprox. 18 girasoles')", () => {
    const receta = normalizarComposicionReceta([
      { clave: "rosas", cantidad: 50, aproximado: true, maxColores: 2, visibleCliente: true },
      { clave: "girasoles", cantidad: 18, aproximado: true, visibleCliente: true },
      { clave: "orquideas", cantidad: 0, aproximado: true, visibleCliente: true },
      { clave: "gerberas", cantidad: 0, aproximado: true, visibleCliente: true },
      { clave: "lirios", cantidad: 0, aproximado: true, visibleCliente: true },
    ]);

    expect(receta).toHaveLength(2);
    expect(formatearDescripcionComposicion(receta)).toBe("Aprox. 50 rosas, aprox. 18 girasoles");

    const resumen = obtenerResumenFloresReceta(receta);
    expect(resumen.tieneReceta).toBe(true);
    expect(resumen.incluyeRosas).toBe(true);
    expect(resumen.rosas).toBe(50);
    expect(resumen.maxColoresRosas).toBe(2);
    expect(resumen.incluyeGirasoles).toBe(true);
    expect(resumen.girasoles).toBe(18);
    expect(resumen.incluyeOrquideas).toBe(false);
    expect(resumen.incluyeGerberas).toBe(false);
    expect(resumen.incluyeLirios).toBe(false);
  });

  it("omite descripción cuando todos los componentes son 0 u ocultos al cliente", () => {
    expect(
      formatearDescripcionComposicion(
        normalizarComposicionReceta([
          { clave: "rosas", cantidad: 0 },
          { clave: "girasoles", cantidad: 0 },
        ])
      )
    ).toBe("");

    const conInsumoInterno = normalizarComposicionReceta([
      { clave: "gerberas", cantidad: 12, aproximado: true, visibleCliente: true },
      { clave: "lirios", cantidad: 6, aproximado: true, visibleCliente: true },
      {
        clave: "espuma_oasis",
        etiquetaSingular: "bloque oasis",
        etiquetaPlural: "bloques oasis",
        cantidad: 2,
        aproximado: false,
        visibleCliente: false,
      },
    ]);

    expect(formatearDescripcionComposicion(conInsumoInterno)).toBe(
      "Aprox. 12 gerberas, aprox. 6 lirios"
    );
    expect(formatearDescripcionComposicion(conInsumoInterno, { incluirOcultos: true })).toContain(
      "2 bloques oasis"
    );
  });

  it("soporta singular/plural, herencia Master -> Variante y las 5 flores estándar de floristería", () => {
    expect(COMPONENTES_RECETA_FLORISTERIA.map((c) => c.clave)).toEqual([
      "rosas",
      "girasoles",
      "orquideas",
      "gerberas",
      "lirios",
    ]);

    const master = [{ clave: "rosas", cantidad: 24, aproximado: true, maxColores: 1 }];
    const varPersonalizada = [
      { clave: "girasoles", cantidad: 1, aproximado: false },
      { clave: "orquideas", cantidad: 3, aproximado: false },
    ];

    const heredada = resolverComposicionRecetaEfectiva({
      recetaMaster: master,
      recetaVariante: varPersonalizada,
      modoVariante: "heredar",
    });
    expect(formatearDescripcionComposicion(heredada)).toBe("Aprox. 24 rosas");

    const propia = resolverComposicionRecetaEfectiva({
      recetaMaster: master,
      recetaVariante: varPersonalizada,
      modoVariante: "personalizado",
    });
    expect(formatearDescripcionComposicion(propia)).toBe("1 girasol, 3 orquídeas");
    expect(obtenerResumenFloresReceta(propia).incluyeRosas).toBe(false);
  });
});
