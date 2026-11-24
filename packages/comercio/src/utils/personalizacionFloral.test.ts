import { describe, expect, it } from "vitest";
import {
  OPCIONES_COLOR_BASE,
  OPCIONES_COLOR_PAPEL,
  crearConfiguracionPersonalizacionFloralPorDefecto,
  describirConfiguracionPersonalizacionCliente,
  inferirTipoEnvoltorioPorColeccion,
  inferirTipoEnvoltorioPorNombre,
  normalizarConfiguracionPersonalizacionFloral,
  obtenerModosFlorDisponibles,
  obtenerOpcionesColorEnvoltorio,
  resolverPersonalizacionFloralEfectiva,
  resumirConfiguracionPersonalizacionAdmin,
  validarSeleccionPersonalizacionFloral,
} from "./personalizacionFloral";

describe("personalizacionFloral", () => {
  it("infiere envoltorio por colección: Para Florero/Estilo Coreano -> Papel, BOX -> Base, resto -> No aplica", () => {
    expect(
      inferirTipoEnvoltorioPorColeccion({ categoriaNombre: "Para Florero", categoriaSlug: "cat-floreros" })
    ).toBe("papel_envoltorio");
    expect(
      inferirTipoEnvoltorioPorColeccion({ categoriaNombre: "Estilo Coreano", categoriaSlug: "cat-coreanos" })
    ).toBe("papel_envoltorio");
    expect(
      inferirTipoEnvoltorioPorColeccion({ categoriaNombre: "Box Florales", categoriaSlug: "box-florales" })
    ).toBe("base");
    expect(inferirTipoEnvoltorioPorColeccion({ categoriaNombre: "BOX" })).toBe("base");
    expect(
      inferirTipoEnvoltorioPorColeccion({ categoriaNombre: "Condolencias", categoriaSlug: "cat-condolencias" })
    ).toBe("no_aplica");
    expect(
      inferirTipoEnvoltorioPorColeccion({ categoriaNombre: "Corazones de Rosas" })
    ).toBe("no_aplica");
    expect(inferirTipoEnvoltorioPorNombre("Ramo Especial Aniversario")).toBe("no_aplica");
  });

  it("usa colores específicos por tipo de envoltorio (Papel: Claros/Oscuros/Tonos Pastel; Base: Blanco/Negro/Rosado)", () => {
    const defPapel = crearConfiguracionPersonalizacionFloralPorDefecto(true, "papel_envoltorio");
    expect(defPapel.mostrarColorBase).toBe(true);
    expect(defPapel.coloresBaseDisponibles).toEqual(["claros", "oscuros", "rosa"]);
    expect(OPCIONES_COLOR_PAPEL.map((o) => o.etiqueta)).toEqual([
      "Colores Claros",
      "Colores Oscuros",
      "Tonos Pastel",
    ]);

    const defBase = crearConfiguracionPersonalizacionFloralPorDefecto(true, "base");
    expect(defBase.mostrarColorBase).toBe(true);
    expect(defBase.coloresBaseDisponibles).toEqual(["blanco", "negro", "rosado"]);
    expect(OPCIONES_COLOR_BASE.map((o) => o.etiqueta)).toEqual(["Blanco", "Negro", "Rosado"]);

    const defNoAplica = crearConfiguracionPersonalizacionFloralPorDefecto(true, "no_aplica");
    expect(defNoAplica.mostrarColorBase).toBe(false);
    expect(defNoAplica.coloresBaseDisponibles).toEqual([]);
    expect(obtenerOpcionesColorEnvoltorio("no_aplica")).toEqual([]);
  });

  it("permite combinar girasoles y 1 color de rosas con Papel (Claros/Oscuros/Tonos Pastel) e indicaciones", () => {
    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 1,
      permiteSoloRosas: true,
      permiteSoloGirasoles: true,
      permiteGirasolesYRosas: true,
      tipoEnvoltorio: "papel_envoltorio",
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
      expect(res.seleccionFinal.resumenTexto).toContain("Papel: Colores Claros (Blanco / Beige)");
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
      tipoEnvoltorio: "papel_envoltorio",
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
      expect(okRes.seleccionFinal.resumenTexto).toContain("Papel: Colores Oscuros (Negro / Gris)");
    }

    const failColores = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo", "Rosado", "Amarillo"],
      cantidadOrquideas: 2,
      colorBasePapel: "rosa",
    });
    expect(failColores.ok).toBe(false);
  });

  it("permite solo girasoles sin exigir colores de rosas y etiqueta Papel como Tonos Pastel", () => {
    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 1,
      permiteSoloRosas: true,
      permiteSoloGirasoles: true,
      orquideasMax: 3,
      tipoEnvoltorio: "papel_envoltorio",
    });

    const sinPapel = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_girasoles",
      coloresRosas: [],
      cantidadOrquideas: 0,
      colorBasePapel: null,
    });
    expect(sinPapel.ok).toBe(false);

    const conPapel = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_girasoles",
      coloresRosas: [],
      cantidadOrquideas: 0,
      colorBasePapel: "rosa",
    });
    expect(conPapel.ok).toBe(true);
    if (conPapel.ok) {
      expect(conPapel.seleccionFinal.coloresRosas).toEqual([]);
      expect(conPapel.seleccionFinal.resumenTexto).toContain("Solo Girasoles");
      expect(conPapel.seleccionFinal.resumenTexto).toContain("Papel: Tonos Pastel (Rosado / Lila)");
    }

    expect(describirConfiguracionPersonalizacionCliente(cfg)).toContain(
      "Colores y decoración según la ocasión"
    );
    expect(describirConfiguracionPersonalizacionCliente(cfg)).toContain("Girasoles");
    expect(describirConfiguracionPersonalizacionCliente(cfg)).toContain("hasta 3 orquídeas");
  });

  it('permite elegir "Mismos colores de la foto" sin obligar a seleccionar colores manuales', () => {
    const cfg = crearConfiguracionPersonalizacionFloralPorDefecto(true, "papel_envoltorio");
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

    const resConFoto = validarSeleccionPersonalizacionFloral(cfg, {
      mismosColoresFoto: true,
      fotoReferenciaUrl: "https://cdn.tinkay.com/bouquet-foto-2.jpg",
      fotoReferenciaIndice: 2,
      fotoReferenciaTotal: 3,
      modoFlores: "solo_girasoles",
      coloresRosas: [],
      cantidadOrquideas: 0,
      colorBasePapel: null,
    });
    expect(resConFoto.ok).toBe(true);
    if (resConFoto.ok) {
      expect(resConFoto.seleccionFinal.fotoReferenciaUrl).toBe(
        "https://cdn.tinkay.com/bouquet-foto-2.jpg"
      );
      expect(resConFoto.seleccionFinal.fotoReferenciaIndice).toBe(2);
      expect(resConFoto.seleccionFinal.fotoReferenciaTotal).toBe(3);
      expect(resConFoto.seleccionFinal.resumenTexto).toBe(
        "Mismos colores de la foto (Foto 2 de 3)"
      );
    }
  });

  it("resuelve configuración heredada de Master vs personalizada por variante/tamaño", () => {
    const master = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 1,
      permiteSoloRosas: true,
      orquideasMax: 0,
      tipoEnvoltorio: "base",
    });

    const boxM = resolverPersonalizacionFloralEfectiva({
      configMaster: master,
      modoVariante: "heredar",
      configVariante: { maxColoresRosas: 3 },
    });
    expect(boxM.maxColoresRosas).toBe(1);
    expect(boxM.tipoEnvoltorio).toBe("base");
    expect(boxM.coloresBaseDisponibles).toEqual(["blanco", "negro", "rosado"]);

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
    expect(boxLConOrquideas.orquideasMax).toBe(5);
    expect(resumirConfiguracionPersonalizacionAdmin(boxLConOrquideas)).toContain("hasta 3 colores");
    expect(resumirConfiguracionPersonalizacionAdmin(boxLConOrquideas)).toContain("1–5 orquídeas");
  });

  it("valida Base únicamente con Blanco, Negro y Rosado y omite envoltorio cuando es No aplica", () => {
    const cfgBase = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      tipoEnvoltorio: "base",
    });
    expect(cfgBase.coloresBaseDisponibles).toEqual(["blanco", "negro", "rosado"]);

    const resBase = validarSeleccionPersonalizacionFloral(cfgBase, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo"],
      cantidadOrquideas: 0,
      colorBasePapel: "negro",
    });
    expect(resBase.ok).toBe(true);
    if (resBase.ok) {
      expect(resBase.seleccionFinal.tipoEnvoltorio).toBe("base");
      expect(resBase.seleccionFinal.colorBasePapel).toBe("negro");
      expect(resBase.seleccionFinal.resumenTexto).toContain("Base: Negro");
    }

    const cfgNoAplica = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      tipoEnvoltorio: "no_aplica",
    });
    expect(cfgNoAplica.mostrarColorBase).toBe(false);
    expect(resumirConfiguracionPersonalizacionAdmin(cfgNoAplica)).toContain("No aplica");

    const resNoAplica = validarSeleccionPersonalizacionFloral(cfgNoAplica, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Rojo"],
      cantidadOrquideas: 0,
      colorBasePapel: null,
    });
    expect(resNoAplica.ok).toBe(true);
    if (resNoAplica.ok) {
      expect(resNoAplica.seleccionFinal.tipoEnvoltorio).toBeNull();
      expect(resNoAplica.seleccionFinal.colorBasePapel).toBeNull();
      expect(resNoAplica.seleccionFinal.resumenTexto).toBe("Rosas (Rojo)");
    }
  });
});
