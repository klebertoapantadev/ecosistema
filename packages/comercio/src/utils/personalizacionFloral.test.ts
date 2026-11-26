import { describe, expect, it } from "vitest";
import {
  COLORES_ROSAS_PERSONALIZACION,
  OPCIONES_COLOR_BASE,
  OPCIONES_COLOR_PAPEL,
  calcularDescuentoColorOferta,
  crearConfiguracionPersonalizacionFloralPorDefecto,
  describirConfiguracionPersonalizacionCliente,
  evaluarVigenciaInventarioRosas,
  inferirTipoEnvoltorioPorColeccion,
  inferirTipoEnvoltorioPorNombre,
  normalizarConfiguracionPersonalizacionFloral,
  obtenerColoresRosasConInventario,
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

  it('elimina "Surtido / Mix" (multicolor) de la paleta, normalización y validación, y mapea alias heredado "azul" -> "tinturado"', () => {
    expect(COLORES_ROSAS_PERSONALIZACION.some((c) => c.clave === "multicolor")).toBe(false);
    expect(
      COLORES_ROSAS_PERSONALIZACION.some((c) => c.etiqueta.toLowerCase().includes("surtido"))
    ).toBe(false);

    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      coloresRosasDisponibles: ["rojo", "multicolor", "azul", "verde"],
    });
    expect(cfg.coloresRosasDisponibles).toEqual(["rojo", "tinturado", "verde"]);

    const resExcluido = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Surtido / Mix"],
      cantidadOrquideas: 0,
      colorBasePapel: null,
    });
    expect(resExcluido.ok).toBe(false);
  });

  it('carga disponibilidad desde inventario, ordena disponibles primero y marca "bajo confirmación" en colores sin stock', () => {
    const cfg = crearConfiguracionPersonalizacionFloralPorDefecto(true, "papel_envoltorio");
    const colores = obtenerColoresRosasConInventario(cfg, {
      tieneInventarioRegistrado: true,
      fechaUltimoCorte: "2026-11-19T16:56:43.109162+00:00",
      coloresEnStock: ["rojo", "blanco", "rosado", "durazno", "amarillo", "orquidea_blanco"],
      coloresCatalogo: [
        "amarillo",
        "blanco",
        "durazno",
        "fucsia",
        "lavanda",
        "naranja",
        "novedad",
        "rojo",
        "rosado",
        "tinturado",
        "verde",
      ],
      categoriasColores: {},
    });

    // Ninguna clave de orquídea ni multicolor aparece como color de rosa
    expect(colores.some((c) => c.clave.includes("orquidea"))).toBe(false);
    expect(colores.some((c) => c.clave === "multicolor")).toBe(false);

    const enStock = colores.filter((c) => c.disponibleEnInventario);
    const bajoConf = colores.filter((c) => c.bajoConfirmacion);
    expect(enStock.map((c) => c.clave)).toEqual(["rojo", "blanco", "rosado", "amarillo", "durazno"]);
    expect(bajoConf.map((c) => c.clave)).toContain("verde");
    expect(bajoConf.map((c) => c.clave)).toContain("tinturado");
    expect(bajoConf.map((c) => c.clave)).toContain("novedad");

    // Todos los disponibles aparecen antes de los de bajo confirmación
    expect(colores.slice(0, enStock.length).every((c) => c.disponibleEnInventario)).toBe(true);
    expect(colores.slice(enStock.length).every((c) => c.bajoConfirmacion)).toBe(true);

    const validacionVerde = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Verde"],
      coloresBajoConfirmacion: ["Verde"],
      cantidadOrquideas: 0,
      colorBasePapel: "claros",
    });
    expect(validacionVerde.ok).toBe(true);
    if (validacionVerde.ok) {
      expect(validacionVerde.seleccionFinal.requiereConfirmacionColor).toBe(true);
      expect(validacionVerde.seleccionFinal.coloresBajoConfirmacion).toEqual(["Verde"]);
      expect(validacionVerde.seleccionFinal.resumenTexto).toContain(
        "Bajo confirmación con tienda (Verde)"
      );
    }

    // Sin inventario registrado todavía: no marca colores como bajo confirmación
    const sinInv = obtenerColoresRosasConInventario(cfg, {
      tieneInventarioRegistrado: false,
      coloresEnStock: [],
    });
    expect(sinInv.every((c) => c.disponibleEnInventario && !c.bajoConfirmacion)).toBe(true);
  });

  it("aplica descuento configurable (10% por defecto) al seleccionar colores en oferta del inventario", () => {
    const cfg = normalizarConfiguracionPersonalizacionFloral({
      habilitada: true,
      maxColoresRosas: 2,
      tipoEnvoltorio: "papel_envoltorio",
    });
    const colores = obtenerColoresRosasConInventario(cfg, {
      tieneInventarioRegistrado: true,
      coloresEnStock: ["rojo", "amarillo", "durazno"],
      ofertaColoresActiva: true,
      porcentajeDescuentoOferta: 10,
      coloresEnOferta: ["amarillo", "durazno", "verde"], // verde no está en stock, no debe marcarse en oferta
    });

    const amarillo = colores.find((c) => c.clave === "amarillo");
    const verde = colores.find((c) => c.clave === "verde");
    expect(amarillo?.enOferta).toBe(true);
    expect(amarillo?.porcentajeDescuentoOferta).toBe(10);
    expect(verde?.enOferta).toBe(false);
    expect(verde?.bajoConfirmacion).toBe(true);
    // Los colores en oferta aparecen primero
    expect(colores[0]?.enOferta).toBe(true);

    // 1) Selecciona color en oferta -> aplica 10% sobre $80 => $72
    const descOk = calcularDescuentoColorOferta({
      pvpUnitarioBase: 80,
      tarifaIvaPorcentaje: 0,
      cantidad: 1,
      coloresElegidos: ["Amarillo"],
      coloresConInventario: colores,
    });
    expect(descOk.aplicaDescuento).toBe(true);
    expect(descOk.porcentajeDescuento).toBe(10);
    expect(descOk.pvpUnitarioFinal).toBe(72);
    expect(descOk.ahorroTotalLinea).toBe(8);

    // 2) Selecciona 2 colores y ambos están en oferta -> aplica descuento
    const descDosOferta = calcularDescuentoColorOferta({
      pvpUnitarioBase: 50,
      tarifaIvaPorcentaje: 15,
      cantidad: 2,
      coloresElegidos: ["Amarillo", "Durazno"],
      coloresConInventario: colores,
    });
    expect(descDosOferta.aplicaDescuento).toBe(true);
    expect(descDosOferta.pvpUnitarioFinal).toBe(45);
    expect(descDosOferta.subtotalLineaFinal).toBe(90);
    expect(descDosOferta.baseImponibleUnitariaFinal).toBe(39.13);

    // 3) Combina un color en oferta con un color regular -> no aplica descuento, marca mezcla
    const descMezcla = calcularDescuentoColorOferta({
      pvpUnitarioBase: 80,
      coloresElegidos: ["Amarillo", "Rojo"],
      coloresConInventario: colores,
    });
    expect(descMezcla.aplicaDescuento).toBe(false);
    expect(descMezcla.tieneMezclaConColorRegular).toBe(true);

    // 4) "Mismos colores de la foto" -> no aplica descuento de color en oferta
    const descFoto = calcularDescuentoColorOferta({
      pvpUnitarioBase: 80,
      mismosColoresFoto: true,
      coloresElegidos: ["Amarillo"],
      coloresConInventario: colores,
    });
    expect(descFoto.aplicaDescuento).toBe(false);

    // 5) Validación incluye oferta en resumenTexto
    const valOferta = validarSeleccionPersonalizacionFloral(cfg, {
      modoFlores: "solo_rosas",
      coloresRosas: ["Amarillo"],
      coloresEnOferta: ["Amarillo"],
      descuentoColorOfertaPct: 10,
      cantidadOrquideas: 0,
      colorBasePapel: "claros",
    });
    expect(valOferta.ok).toBe(true);
    if (valOferta.ok) {
      expect(valOferta.seleccionFinal.descuentoColorOfertaPct).toBe(10);
      expect(valOferta.seleccionFinal.resumenTexto).toContain("Oferta color -10%");
    }
  });

  it("evalúa vigencia del inventario de rosas con límite de 15 horas", () => {
    const ahora = new Date("2026-11-26T12:00:00.000Z");
    const reciente = evaluarVigenciaInventarioRosas("2026-11-26T00:00:00.000Z", 15, ahora);
    expect(reciente.requiereAlerta).toBe(false);
    expect(reciente.horasDesdeUltimoCorte).toBe(12);

    const vencido = evaluarVigenciaInventarioRosas("2026-11-25T20:00:00.000Z", 15, ahora);
    expect(vencido.requiereAlerta).toBe(true);
    expect(vencido.horasDesdeUltimoCorte).toBe(16);

    const sinCorte = evaluarVigenciaInventarioRosas(null, 15, ahora);
    expect(sinCorte.requiereAlerta).toBe(true);
    expect(sinCorte.horasDesdeUltimoCorte).toBeNull();
  });
});
