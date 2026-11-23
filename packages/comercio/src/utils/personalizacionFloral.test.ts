import { describe, expect, it } from "vitest";
import {
  OPCIONES_COLOR_BASE_PAPEL,
  crearConfiguracionPersonalizacionFloralPorDefecto,
  describirConfiguracionPersonalizacionCliente,
  inferirTipoEnvoltorioPorNombre,
  normalizarConfiguracionPersonalizacionFloral,
  obtenerModosFlorDisponibles,
  resolverPersonalizacionFloralEfectiva,
  resumirConfiguracionPersonalizacionAdmin,
  validarSeleccionPersonalizacionFloral,
} from "./personalizacionFloral";

describe("personalizacionFloral", () => {
  it("usa 1 color de rosas y las 3 opciones exclusivas de color base/papel por defecto", () => {
    const def = crearConfiguracionPersonalizacionFloralPorDefecto();
    expect(def.habilitada).toBe(true);
    expect(def.maxColoresRosas).toBe(1);
    expect(def.permiteSoloRosas).toBe(true);
    expect(def.permiteSoloGirasoles).toBe(false);
    expect(def.permiteGirasolesYRosas).toBe(false);
    expect(def.orquideasMin).toBe(0);
    expect(def.orquideasMax).toBe(0);
    expect(def.mostrarColorBase).toBe(true);
    expect(def.coloresBaseDisponibles).toEqual(["claros", "oscuros", "rosa"]);
    expect(OPCIONES_COLOR_BASE_PAPEL.map((o) => o.id)).toEqual(["claros", "oscuros", "rosa"]);
  });

  it("permite combinar girasoles y 1 color de rosas con indicaciones adicionales", () => {
    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 1,
      permiteSoloRosas: true,
      permiteSoloGirasoles: true,
      permiteGirasolesYRosas: true,
      orquideasMin: 0,
      orquideasMax: 0,
    });

    expect(obtenerModosFlorDisponibles(cfg).map((m) => m.id)).toEqual([
      "solo_rosas",
      "solo_girasoles",
      "girasoles_y_rosas",
    ]);

    const res = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "girasoles_y_rosas",
      coloresRosas: ["Rojo"],
      cantidadOrquideas: 0,
      colorBasePapel: "claros",
      indicacionesAdicionales: "Girasoles con 1 rosa roja al centro",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.seleccionFinal.resumenTexto).toContain("Girasoles y Rosas (Rojo)");
      expect(res.seleccionFinal.resumenTexto).toContain("Colores Claros (Blanco / Beige)");
      expect(res.seleccionFinal.resumenTexto).toContain("Girasoles con 1 rosa roja al centro");
    }
  });

  it("permite 2 colores de rosas y 5 orquídeas y rechaza exceder el límite de colores", () => {
    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 2,
      permiteSoloRosas: true,
      orquideasMin: 0,
      orquideasMax: 5,
    });

    const okRes = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo", "Blanco / Crema"],
      cantidadOrquideas: 5,
      colorBasePapel: "oscuros",
    });

    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.seleccionFinal.cantidadOrquideas).toBe(5);
      expect(okRes.seleccionFinal.resumenTexto).toContain("Rosas (Rojo, Blanco / Crema)");
      expect(okRes.seleccionFinal.resumenTexto).toContain("+ 5 orquídeas");
      expect(okRes.seleccionFinal.resumenTexto).toContain("Colores Oscuros (Negro / Gris)");
    }

    const failColores = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo", "Rosado", "Amarillo"],
      cantidadOrquideas: 2,
      colorBasePapel: "rosa",
    });
    expect(failColores.ok).toBe(false);
  });

  it("permite solo girasoles sin exigir colores de rosas pero sí color base/papel", () => {
    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 1,
      permiteSoloRosas: true,
      permiteSoloGirasoles: true,
      orquideasMax: 3,
    });

    const sinBase = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_girasoles",
      coloresRosas: [],
      cantidadOrquideas: 0,
      colorBasePapel: null,
    });
    expect(sinBase.ok).toBe(false);

    const conBase = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_girasoles",
      coloresRosas: [],
      cantidadOrquideas: 0,
      colorBasePapel: "rosa",
    });
    expect(conBase.ok).toBe(true);
    if (conBase.ok) {
      expect(conBase.seleccionFinal.coloresRosas).toEqual([]);
      expect(conBase.seleccionFinal.resumenTexto).toContain("Solo Girasoles");
      expect(conBase.seleccionFinal.resumenTexto).toContain("Rosa (Rosado / Lila)");
    }

    expect(describirConfiguracionPersonalizacionCliente(cfg)).toContain("Girasoles");
    expect(describirConfiguracionPersonalizacionCliente(cfg)).toContain("hasta 3 orquídeas");
  });

  it('permite elegir "Mismos colores de la foto" sin obligar a seleccionar colores manuales', () => {
    const cfg = crearConfiguracionPersonalizacionFloralPorDefecto(true);
    const res = validarSeleccionPersonalizacionFloral(cfg, {
      mismosColoresFoto: true,
      modoFlores: "solo_rosas",
      coloresRosas: [],
      cantidadOrquideas: 0,
      colorBasePapel: null,
      indicacionesAdicionales: "Con lazo dorado si es posible",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.seleccionFinal.mismosColoresFoto).toBe(true);
      expect(res.seleccionFinal.resumenTexto).toBe(
        "Mismos colores de la foto · Nota: Con lazo dorado si es posible"
      );
    }
  });

  it("resuelve configuración heredada de Master vs personalizada por variante/tamaño", () => {
    const master = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 1,
      permiteSoloRosas: true,
      orquideasMax: 0,
    });

    const boxM = resolverPersonalizacionFloralEfectiva({
      configMaster: master,
      modoVariante: "heredar",
      configVariante: { maxColoresRosas: 3 },
    });
    expect(boxM.maxColoresRosas).toBe(1);
    expect(boxM.orquideasMax).toBe(0);

    const boxLConOrquideas = resolverPersonalizacionFloralEfectiva({
      configMaster: master,
      modoVariante: "personalizado",
      configVariante: {
        habilitada: true,
        maxColoresRosas: 3,
        permiteSoloRosas: true,
        permiteGirasolesYRosas: true,
        orquideasMin: 1,
        orquideasMax: 5,
      },
    });
    expect(boxLConOrquideas.maxColoresRosas).toBe(3);
    expect(boxLConOrquideas.permiteGirasolesYRosas).toBe(true);
    expect(boxLConOrquideas.orquideasMin).toBe(1);
    expect(boxLConOrquideas.orquideasMax).toBe(5);
    expect(resumirConfiguracionPersonalizacionAdmin(boxLConOrquideas)).toContain("hasta 3 colores");
    expect(resumirConfiguracionPersonalizacionAdmin(boxLConOrquideas)).toContain("1–5 orquídeas");
  });

  it("permite configurar tipo de envoltorio Base, Papel Envoltorio o Ambos (cliente elige)", () => {
    expect(inferirTipoEnvoltorioPorNombre("Box corazon", "Box Florales")).toBe("base");
    expect(inferirTipoEnvoltorioPorNombre("Bouquet Estilo Coreano", "Estilo Coreano")).toBe(
      "papel_envoltorio"
    );

    const cfgBase = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      tipoEnvoltorio: "base",
    });
    const resBase = validarSeleccionPersonalizacionFloral(cfgBase, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo"],
      cantidadOrquideas: 0,
      colorBasePapel: "claros",
    });
    expect(resBase.ok).toBe(true);
    if (resBase.ok) {
      expect(resBase.seleccionFinal.tipoEnvoltorio).toBe("base");
      expect(resBase.seleccionFinal.resumenTexto).toContain("Base: Colores Claros (Blanco / Beige)");
    }

    const cfgPapel = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      tipoEnvoltorio: "papel_envoltorio",
    });
    const resPapel = validarSeleccionPersonalizacionFloral(cfgPapel, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rosado"],
      cantidadOrquideas: 0,
      colorBasePapel: "rosa",
    });
    expect(resPapel.ok).toBe(true);
    if (resPapel.ok) {
      expect(resPapel.seleccionFinal.tipoEnvoltorio).toBe("papel_envoltorio");
      expect(resPapel.seleccionFinal.resumenTexto).toContain(
        "Papel Envoltorio: Rosa (Rosado / Lila)"
      );
    }

    const cfgAmbos = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      tipoEnvoltorio: "ambos",
    });
    const sinElegirTipo = validarSeleccionPersonalizacionFloral(cfgAmbos, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo"],
      cantidadOrquideas: 0,
      colorBasePapel: "oscuros",
    });
    expect(sinElegirTipo.ok).toBe(false);

    const eligiendoBase = validarSeleccionPersonalizacionFloral(cfgAmbos, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo"],
      cantidadOrquideas: 0,
      tipoEnvoltorio: "base",
      colorBasePapel: "oscuros",
    });
    expect(eligiendoBase.ok).toBe(true);
    if (eligiendoBase.ok) {
      expect(eligiendoBase.seleccionFinal.resumenTexto).toContain(
        "Base: Colores Oscuros (Negro / Gris)"
      );
    }
  });
});
