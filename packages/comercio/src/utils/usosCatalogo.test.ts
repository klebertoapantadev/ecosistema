import { describe, expect, it } from "vitest";
import { productoCatalogoCoincideBusqueda } from "./usosCatalogo";
import type { CategoriaCatalogo, ProductoCatalogo } from "../acciones";

const CATEGORIAS_PRUEBA: CategoriaCatalogo[] = [
  {
    ctg_id: "cat-condol-uuid",
    ctg_slug: "cat-ocas-condol",
    ctg_nombre: "Condolencias & Funerarios",
    ctg_descripcion: "Acompañamiento solemne y respetuoso.",
  },
  {
    ctg_id: "cat-box-uuid",
    ctg_slug: "box-florales",
    ctg_nombre: "Box Florales",
    ctg_descripcion: "Cajas rígidas con espuma hidratada.",
  },
];

const PRODUCTO_CORONA: ProductoCatalogo = {
  pro_id: "prod-corona",
  pro_negocio: "tinkay",
  pro_slug: "corona",
  pro_nombre: "Corona",
  pro_descripcion: "Imponente corona floral en trípode de madera.",
  pro_tipo: "FISICO",
  pro_activo: true,
  pro_destacado: false,
  pro_categoria_principal_id: "cat-condol-uuid",
  pro_detalle_producto: {
    usos: ["🕊️_condolencias"],
    beneficios: ['Incluye Tarjeta "Nota de Pesar" personalizada.', "Cinta fúnebre."],
    etiquetas: [],
  },
  variantes: [
    {
      var_id: "v1",
      var_sku: "TIN-CORONA-XL",
      var_nombre: "Corona XL (Solo Rosas)",
      var_precio: 120,
      var_tarifa_iva_porcentaje: 15,
      var_activo: true,
      var_detalle_variante: {
        beneficios_custom: ["Corona y Botón de rosas blancas."],
      },
    },
  ],
};

const PRODUCTO_BOX: ProductoCatalogo = {
  pro_id: "prod-box",
  pro_negocio: "tinkay",
  pro_slug: "box-florales",
  pro_nombre: "Box Florales",
  pro_descripcion: "Arreglos redondos en cajas cilíndricas.",
  pro_tipo: "FISICO",
  pro_activo: true,
  pro_destacado: true,
  pro_categoria_principal_id: "cat-box-uuid",
  pro_detalle_producto: {
    usos: ["aniversario", "cumpleanos", "amor_romance"],
    etiquetas: [],
  },
  variantes: [
    {
      var_id: "vb1",
      var_sku: "TIN-VAR-7",
      var_nombre: "Box Floral (M) + Orquídea",
      var_precio: 60,
      var_tarifa_iva_porcentaje: 0,
      var_activo: true,
      var_detalle_variante: {},
    },
  ],
};

describe("productoCatalogoCoincideBusqueda", () => {
  it("encuentra productos por usos con emojis, categoría y beneficios sin etiquetas explícitas", () => {
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_CORONA, "condole", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_CORONA, "condolencias", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_CORONA, "funerarios", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_CORONA, "nota de pesar", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_CORONA, "corona rosas blancas", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_BOX, "condole", CATEGORIAS_PRUEBA)).toBe(false);
  });

  it("encuentra productos por usos expandidos y variantes sin tildes", () => {
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_BOX, "cumpleaños", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_BOX, "orquidea", CATEGORIAS_PRUEBA)).toBe(true);
    expect(productoCatalogoCoincideBusqueda(PRODUCTO_BOX, "romance", CATEGORIAS_PRUEBA)).toBe(true);
  });
});

