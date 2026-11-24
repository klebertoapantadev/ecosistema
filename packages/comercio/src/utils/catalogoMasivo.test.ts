import { describe, expect, it } from "vitest";
import type { CategoriaCatalogo, ProductoCatalogo } from "../acciones";
import {
  calcularPlanActualizacionMasiva,
  construirHojasExcelCatalogo,
  exportarCatalogoAMarkdown,
  formatearConfiguracionProductoTexto,
  parsearCatalogoDesdeHojasExcel,
  parsearCatalogoDesdeMarkdown,
} from "./catalogoMasivo";

const CATEGORIAS_MOCK: CategoriaCatalogo[] = [
  {
    ctg_id: "cat-coreano",
    ctg_negocio: "tinkay",
    ctg_nombre: "Estilo Coreano",
    ctg_slug: "estilo-coreano",
    ctg_descripcion: "Ramos en papel coreano",
    ctg_tipo: "FISICO",
    ctg_orden: 1,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-box",
    ctg_negocio: "tinkay",
    ctg_nombre: "Box Florales",
    ctg_slug: "box-florales",
    ctg_descripcion: "Cajas de lujo",
    ctg_tipo: "FISICO",
    ctg_orden: 2,
    ctg_activo: true,
  },
];

const PRODUCTO_MOCK: ProductoCatalogo = {
  pro_id: "11111111-1111-4111-8111-111111111111",
  pro_negocio: "tinkay",
  pro_nombre: "Bouquet de Girasoles",
  pro_slug: "bouquet-de-girasoles",
  pro_descripcion:
    "Regala luz, alegría y distinción con nuestro bouquet de girasoles frescos.",
  pro_tipo: "FISICO",
  pro_destacado: false,
  pro_activo: true,
  pro_categoria_principal_id: "cat-coreano",
  canales_visibilidad: ["ECOMMERCE_WEB", "CHATBOT_WHATSAPP"],
  categoria: {
    ctg_id: "cat-coreano",
    ctg_nombre: "Estilo Coreano",
    ctg_slug: "estilo-coreano",
  },
  pro_detalle_producto: {
    tarifa_iva_predeterminada: 0,
    tiempo_entrega: "🌸 Pide hoy, recibe hoy (Mismo Día)",
    beneficios: [
      "Envoltura en papel coreano",
      "Lazo decorativo en cinta",
      "Porta-tarjeta dorado con tarjeta dedicatoria (impresa y/o digital)",
    ],
    requisitos: [],
    usos: ["Cumpleaños", "Amistad"],
    etiquetas: ["girasoles", "amarillo"],
    vigencia_tipo: "SIEMPRE",
    logistica: {
      delivery_incluido: true,
      modalidad_transporte: "INCLUIDO_GRATIS",
      etiqueta_transporte: "🌸 Envío Gratis en Centro-Norte de Quito",
      cobertura_texto: "Centro-Norte de Quito",
      recargo_transporte_usd: 0,
    },
    personalizacion_floral: {
      habilitada: true,
      maxColoresRosas: 1,
      coloresRosasDisponibles: ["amarillo"],
      permiteSoloRosas: false,
      permiteSoloGirasoles: true,
      permiteGirasolesYRosas: true,
      orquideasMin: 0,
      orquideasMax: 0,
      mostrarColorBase: true,
      tipoEnvoltorio: "papel_envoltorio",
      coloresBaseDisponibles: ["claros", "oscuros", "rosa"],
      permitirIndicacionesAdicionales: true,
    },
    imagen_url: "https://cdn.tinkay.com/girasoles.jpg",
    galeria_urls: [],
  },
  variantes: [
    {
      var_id: "22222222-2222-4222-8222-222222222222",
      var_producto_id: "11111111-1111-4111-8111-111111111111",
      var_sku: "TNK-GIR-06",
      var_nombre: "Estándar (6 girasoles)",
      var_precio: 25,
      var_precio_comparacion: null,
      var_codigo_impuesto_sri: "IVA_0",
      var_tarifa_iva_porcentaje: 0,
      var_tipo_oferta: "REGULAR",
      var_activo: true,
      var_detalle_variante: { orden: 1 },
      monto_iva: 0,
      precio_total: 25,
    },
    {
      var_id: "33333333-3333-4333-8333-333333333333",
      var_producto_id: "11111111-1111-4111-8111-111111111111",
      var_sku: "TNK-GIR-12",
      var_nombre: "Grande (12 girasoles)",
      var_precio: 42,
      var_precio_comparacion: 48,
      var_codigo_impuesto_sri: "IVA_0",
      var_tarifa_iva_porcentaje: 0,
      var_tipo_oferta: "REGULAR",
      var_activo: true,
      var_detalle_variante: { orden: 2 },
      monto_iva: 0,
      precio_total: 42,
    },
  ],
};

describe("catalogoMasivo — copiar config, exportar/importar MD y Excel", () => {
  it("formatea en texto completo toda la configuración de un producto individual", () => {
    const txt = formatearConfiguracionProductoTexto(PRODUCTO_MOCK, { negocio: "tinkay" });
    expect(txt).toContain("# Configuración de Producto: Bouquet de Girasoles");
    expect(txt).toContain("Estilo Coreano");
    expect(txt).toContain("Estándar (6 girasoles)");
    expect(txt).toContain("TNK-GIR-06");
    expect(txt).toContain("Envoltura en papel coreano");
    expect(txt).toContain("Solo Girasoles, Girasoles y Rosas");
    expect(txt).toContain("Papel (`papel_envoltorio`)");
    expect(txt).toContain("Centro-Norte de Quito");
  });

  it("hace round-trip limpio en Markdown sin falsos cambios y detecta cambios editados por IA", () => {
    const mdOriginal = exportarCatalogoAMarkdown([PRODUCTO_MOCK], CATEGORIAS_MOCK, {
      negocio: "tinkay",
      fechaIso: "2026-11-24 08:00:00",
    });

    // Sin ediciones: 0 cambios
    const parseSinCambios = parsearCatalogoDesdeMarkdown(mdOriginal);
    expect(parseSinCambios.productos).toHaveLength(1);
    const planSinCambios = calcularPlanActualizacionMasiva(
      [PRODUCTO_MOCK],
      CATEGORIAS_MOCK,
      parseSinCambios,
      { negocio: "tinkay" }
    );
    expect(planSinCambios.totalConCambios).toBe(0);
    expect(planSinCambios.totalSinCambios).toBe(1);

    // Con ediciones típicas de IA (precio, categoría, descripción, beneficios, destacado, envoltorio)
    const mdEditado = mdOriginal
      .replace("- **categoria:** Estilo Coreano", "- **categoria:** Box Florales")
      .replace("- **destacado:** NO", "- **destacado:** SI")
      .replace("- **floral_tipo_envoltorio:** papel_envoltorio", "- **floral_tipo_envoltorio:** base")
      .replace(
        "Regala luz, alegría y distinción con nuestro bouquet de girasoles frescos.",
        "Ilumina su día con nuestro bouquet premium de girasoles ecuatorianos."
      )
      .replace(
        "- Lazo decorativo en cinta",
        "- Lazo decorativo en cinta satinada\n- Alimento floral de cortesía"
      )
      .replace("| 25.00 |", "| 28.50 |");

    const parseEditado = parsearCatalogoDesdeMarkdown(mdEditado);
    const planEditado = calcularPlanActualizacionMasiva(
      [PRODUCTO_MOCK],
      CATEGORIAS_MOCK,
      parseEditado,
      { negocio: "tinkay" }
    );

    expect(planEditado.totalConCambios).toBe(1);
    const item = planEditado.items[0]!;
    expect(item.estado).toBe("CON_CAMBIOS");
    expect(item.patch?.categoriaId).toBe("cat-box");
    expect(item.patch?.destacado).toBe(true);
    expect(item.patch?.descripcion).toContain("girasoles ecuatorianos");
    expect(item.patch?.beneficios).toContain("Alimento floral de cortesía");
    expect(item.patch?.personalizacionFloral?.tipoEnvoltorio).toBe("base");
    expect(item.patch?.variantes[0]?.var_precio).toBe(28.5);
    expect(item.patch?.variantes[1]?.var_precio).toBe(42);
  });

  it("hace round-trip limpio en hojas de Excel y aplica ediciones de Productos + Variantes", () => {
    const hojas = construirHojasExcelCatalogo([PRODUCTO_MOCK], CATEGORIAS_MOCK, {
      negocio: "tinkay",
    });
    expect(hojas.map((h) => h.nombre)).toEqual(["Productos", "Variantes", "Guia_IA"]);

    const dictOriginal: Record<string, Record<string, unknown>[]> = {};
    for (const h of hojas) dictOriginal[h.nombre] = h.filas.map((f) => ({ ...f }));

    const parseOrig = parsearCatalogoDesdeHojasExcel(dictOriginal);
    const planOrig = calcularPlanActualizacionMasiva(
      [PRODUCTO_MOCK],
      CATEGORIAS_MOCK,
      parseOrig,
      { negocio: "tinkay" }
    );
    expect(planOrig.totalConCambios).toBe(0);

    // Simular edición en Excel: cambiar etiquetas en Productos y precio de variante Grande en Variantes
    dictOriginal.Productos![0]!.etiquetas = "girasoles, verano, regalo";
    dictOriginal.Productos![0]!.activo = "NO";
    dictOriginal.Variantes![1]!.var_precio = "45.00";

    const parseEdit = parsearCatalogoDesdeHojasExcel(dictOriginal);
    const planEdit = calcularPlanActualizacionMasiva(
      [PRODUCTO_MOCK],
      CATEGORIAS_MOCK,
      parseEdit,
      { negocio: "tinkay" }
    );

    expect(planEdit.totalConCambios).toBe(1);
    const patch = planEdit.items[0]!.patch!;
    expect(patch.pro_activo).toBe(false);
    expect(patch.etiquetas).toEqual(["girasoles", "verano", "regalo"]);
    expect(patch.variantes[0]!.var_precio).toBe(25);
    expect(patch.variantes[1]!.var_precio).toBe(45);
  });

  it("reporta productos inexistentes sin romper el resto del lote", () => {
    const md = `
## PRODUCTO: Producto Fantasma
- **pro_id:** \`00000000-0000-0000-0000-000000000000\`
- **nombre:** Producto Fantasma
`;
    const parsed = parsearCatalogoDesdeMarkdown(md);
    const plan = calcularPlanActualizacionMasiva([PRODUCTO_MOCK], CATEGORIAS_MOCK, parsed, {
      negocio: "tinkay",
    });
    expect(plan.totalNoEncontrados).toBe(1);
    expect(plan.totalConCambios).toBe(0);
    expect(plan.items[0]?.estado).toBe("NO_ENCONTRADO");
  });
});
