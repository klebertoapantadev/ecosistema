"use server";

import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { revalidatePath } from "next/cache";

export interface CategoriaCatalogo {
  ctg_id: string;
  ctg_negocio: string;
  ctg_nombre: string;
  ctg_slug: string;
  ctg_descripcion: string | null;
  ctg_tipo: string;
  ctg_orden: number;
  ctg_activo: boolean;
}

export interface ProductoCatalogo {
  pro_id: string;
  pro_negocio: string;
  pro_nombre: string;
  pro_slug: string;
  pro_descripcion: string | null;
  pro_tipo: "FISICO" | "SERVICIO" | "SUSCRIPCION" | "DIGITAL";
  pro_destacado: boolean;
  pro_categoria_principal_id: string | null;
  pro_detalle_producto: any;
  categoria?: {
    ctg_id: string;
    ctg_nombre: string;
    ctg_slug: string;
  } | null;
  variantes: VarianteCatalogo[];
}

export interface VarianteCatalogo {
  var_id: string;
  var_producto_id: string;
  var_sku: string;
  var_nombre: string;
  var_precio: number; // Base imponible
  var_precio_comparacion?: number | null;
  var_codigo_impuesto_sri: string;
  var_tarifa_iva_porcentaje: number;
  var_tipo_oferta: string;
  var_frecuencia_recurrencia?: string | null;
  var_activo: boolean;
  var_detalle_variante: any;
  // Calculados
  monto_iva: number;
  precio_total: number;
}

export interface ConfiguracionPasarela {
  psc_id?: string;
  psc_negocio: string;
  psc_pasarela: string;
  psc_nombre_visible: string;
  psc_ambiente: "PRUEBAS" | "PRODUCCION";
  psc_activo: boolean;
  storeId: string;
  modoSimulado: boolean;
  token?: string;
  comisionPorcentaje: number;
  detalle?: any;
}

export interface TransaccionPagoCRM {
  pag_id: string;
  pag_secuencial: number;
  pag_negocio: string;
  pag_pasarela: string;
  pag_identificador_cliente: string;
  pag_transaccion_pasarela_id: string | null;
  pag_autorizacion_codigo: string | null;
  pag_estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADO" | "REVERSADO";
  pag_monto_total: number;
  pag_monto_sin_iva: number;
  pag_monto_con_iva: number;
  pag_monto_iva: number;
  pag_moneda: string;
  pag_titular_email: string | null;
  pag_titular_identificacion: string | null;
  pag_tarjeta_tipo: string | null;
  pag_tarjeta_marca: string | null;
  pag_tarjeta_ultimos_digitos: string | null;
  pag_confirmado_en: string | null;
  pag_creado_en: string;
  pag_detalle_transaccion: any;
}

// ==============================================================================
// 1. SEMILLAS Y ALMACÉN DE CATÁLOGO PRECONFIGURADO
// ==============================================================================

const CATEGORIAS_SEMILLA_TRANQI: CategoriaCatalogo[] = [
  {
    ctg_id: "cat-tranqi-001",
    ctg_negocio: "tranqi",
    ctg_nombre: "Servicios Legales y Patrocinio",
    ctg_slug: "servicios-legales-patrocinio",
    ctg_descripcion: "Servicios jurídicos puntuales, honorarios profesionales y defensa judicial.",
    ctg_tipo: "FORMATO",
    ctg_orden: 1,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tranqi-002",
    ctg_negocio: "tranqi",
    ctg_nombre: "Planes de Protección Jurídica",
    ctg_slug: "planes-proteccion-juridica",
    ctg_descripcion: "Suscripciones y planes corporativos o familiares de asesoría legal continua.",
    ctg_tipo: "COLECCION",
    ctg_orden: 2,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tranqi-003",
    ctg_negocio: "tranqi",
    ctg_nombre: "Dictámenes y Revisión Contractual",
    ctg_slug: "dictamenes-revision-contractual",
    ctg_descripcion: "Revisión exprés de contratos, minutas y análisis legal preventivo.",
    ctg_tipo: "FORMATO",
    ctg_orden: 3,
    ctg_activo: true,
  },
];

const PRODUCTOS_SEMILLA_TRANQI: ProductoCatalogo[] = [
  {
    pro_id: "prod-tranqi-hon-001",
    pro_negocio: "tranqi",
    pro_nombre: "Honorarios Profesionales Jurídicos",
    pro_slug: "honorarios-profesionales-juridicos",
    pro_descripcion:
      "Contratación y liquidación de honorarios para patrocinio legal, consultas especializadas y representación en causas judiciales o extrajudiciales.",
    pro_tipo: "SERVICIO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-tranqi-001",
    pro_detalle_producto: {
      ambito: "Litigio y Asesoría Legal",
      incluye_dictamen: true,
      modalidad_pago: "Botón Payphone / Tarjeta / Diferido",
      icono: "Scale",
    },
    categoria: {
      ctg_id: "cat-tranqi-001",
      ctg_nombre: "Servicios Legales y Patrocinio",
      ctg_slug: "servicios-legales-patrocinio",
    },
    variantes: [
      {
        var_id: "var-tranqi-hon-1",
        var_producto_id: "prod-tranqi-hon-001",
        var_sku: "TRQ-HON-CONSULTA",
        var_nombre: "Consulta Legal Especializada (1 Hora Presencial o Virtual)",
        var_precio: 45.0,
        var_precio_comparacion: 60.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { duracion: "60 minutos", informe: "Sumario digital" },
        monto_iva: 6.75,
        precio_total: 51.75,
      },
      {
        var_id: "var-tranqi-hon-2",
        var_producto_id: "prod-tranqi-hon-001",
        var_sku: "TRQ-HON-PATROCINIO",
        var_nombre: "Contestación de Demanda o Minuta Legal Compleja",
        var_precio: 150.0,
        var_precio_comparacion: 200.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { entrega: "48 a 72 horas", incluye_firma_abogado: true },
        monto_iva: 22.5,
        precio_total: 172.5,
      },
      {
        var_id: "var-tranqi-hon-3",
        var_producto_id: "prod-tranqi-hon-001",
        var_sku: "TRQ-HON-JUICIO",
        var_nombre: "Patrocinio y Representación en Juicio / Trámite Judicial",
        var_precio: 350.0,
        var_precio_comparacion: 450.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { alcance: "Instancia completa o etapa procesal", seguimiento: "En tiempo real" },
        monto_iva: 52.5,
        precio_total: 402.5,
      },
    ],
  },
  {
    pro_id: "prod-tranqi-pln-002",
    pro_negocio: "tranqi",
    pro_nombre: "Plan Anual de Protección Legal Familiar",
    pro_slug: "plan-proteccion-legal-familiar",
    pro_descripcion:
      "Cobertura jurídica integral durante 365 días: consultas ilimitadas con abogados acreditados, revisión de contratos y descuentos preferenciales.",
    pro_tipo: "SUSCRIPCION",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-tranqi-002",
    pro_detalle_producto: {
      frecuencia: "ANUAL",
      beneficiarios: "Hasta 4 miembros familiares",
      icono: "ShieldCheck",
    },
    categoria: {
      ctg_id: "cat-tranqi-002",
      ctg_nombre: "Planes de Protección Jurídica",
      ctg_slug: "planes-proteccion-juridica",
    },
    variantes: [
      {
        var_id: "var-tranqi-pln-1",
        var_producto_id: "prod-tranqi-pln-002",
        var_sku: "TRQ-PLN-ANUAL-FAM",
        var_nombre: "Membresía Anual Familiar (Hasta 4 Personas)",
        var_precio: 240.0,
        var_precio_comparacion: 300.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "PROMOCION",
        var_frecuencia_recurrencia: "ANUAL",
        var_activo: true,
        var_detalle_variante: { cuotas: "Diferido hasta 12 meses con Payphone" },
        monto_iva: 36.0,
        precio_total: 276.0,
      },
      {
        var_id: "var-tranqi-pln-2",
        var_producto_id: "prod-tranqi-pln-002",
        var_sku: "TRQ-PLN-MENSUAL-FAM",
        var_nombre: "Membresía Mensual Familiar",
        var_precio: 25.0,
        var_precio_comparacion: null,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: { renovacion: "Automática" },
        monto_iva: 3.75,
        precio_total: 28.75,
      },
    ],
  },
  {
    pro_id: "prod-tranqi-ser-003",
    pro_negocio: "tranqi",
    pro_nombre: "Revisión y Dictamen Legal Express de Contratos",
    pro_slug: "revision-dictamen-legal-express",
    pro_descripcion:
      "Análisis exhaustivo de minutas, contratos de arrendamiento, compraventa o laborales con dictamen emitido por abogado titular en menos de 24 horas.",
    pro_tipo: "SERVICIO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tranqi-003",
    pro_detalle_producto: {
      tiempo_entrega: "24 horas hábiles",
      formato_entrega: "PDF con firma electrónica y observaciones de riesgo",
      icono: "FileCheck",
    },
    categoria: {
      ctg_id: "cat-tranqi-003",
      ctg_nombre: "Dictámenes y Revisión Contractual",
      ctg_slug: "dictamenes-revision-contractual",
    },
    variantes: [
      {
        var_id: "var-tranqi-ser-1",
        var_producto_id: "prod-tranqi-ser-003",
        var_sku: "TRQ-SER-DICTAMEN",
        var_nombre: "Dictamen Express en Menos de 24 Horas",
        var_precio: 65.0,
        var_precio_comparacion: 85.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "LANZAMIENTO",
        var_activo: true,
        var_detalle_variante: { paginas_max: "Hasta 15 fojas" },
        monto_iva: 9.75,
        precio_total: 74.75,
      },
    ],
  },
];

// Almacén en memoria para productos y categorías creados dinámicamente durante la sesión
const storeCustomCategorias: Map<string, CategoriaCatalogo[]> = new Map();
const storeCustomProductos: Map<string, ProductoCatalogo[]> = new Map();

// Helper para generar slug simple
function generarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ==============================================================================
// 2. ACCIONES DE CONSULTA
// ==============================================================================

/**
 * Obtiene todas las categorías disponibles para el negocio
 */
export async function obtenerCategoriasAction(negocio = "tranqi"): Promise<CategoriaCatalogo[]> {
  const supabase: any = await crearClienteServidor();

  let categoriasDb: any[] = [];
  try {
    // Intentar primero con schema comun_comercio
    const { data: catCom, error: errCom } = await supabase
      .schema("comun_comercio")
      .from("com_categoria")
      .select("*")
      .eq("ctg_negocio", negocio)
      .eq("ctg_activo", true)
      .order("ctg_orden", { ascending: true });

    if (!errCom && catCom && catCom.length > 0) {
      categoriasDb = catCom;
    } else {
      // Intentar en public si hay vistas
      const { data: catPub, error: errPub } = await supabase
        .from("com_categoria")
        .select("*")
        .eq("ctg_negocio", negocio)
        .eq("ctg_activo", true)
        .order("ctg_orden", { ascending: true });

      if (!errPub && catPub && catPub.length > 0) {
        categoriasDb = catPub;
      }
    }
  } catch {
    // Fallback silencioso
  }

  const base = categoriasDb.length > 0 ? categoriasDb : (negocio === "tranqi" ? CATEGORIAS_SEMILLA_TRANQI : []);
  const customs = storeCustomCategorias.get(negocio) || [];

  // Mezclar evitando duplicados por ctg_id o ctg_slug
  const resultado: CategoriaCatalogo[] = [...base];
  customs.forEach((c) => {
    if (!resultado.some((r) => r.ctg_id === c.ctg_id || r.ctg_slug === c.ctg_slug)) {
      resultado.push(c);
    }
  });

  return resultado;
}

/**
 * Obtiene el catálogo de productos y variantes activas agrupadas con cálculo impositivo ecuatoriano (IVA 15%)
 */
export async function obtenerCatalogoProductosAction(negocio = "tranqi"): Promise<ProductoCatalogo[]> {
  const supabase: any = await crearClienteServidor();

  let prodsDb: any[] = [];
  let varsDb: any[] = [];

  try {
    // 1. Intentar consultar en comun_comercio
    const { data: pCom, error: errPCom } = await supabase
      .schema("comun_comercio")
      .from("com_producto")
      .select(`
        pro_id,
        pro_negocio,
        pro_nombre,
        pro_slug,
        pro_descripcion,
        pro_tipo,
        pro_destacado,
        pro_categoria_principal_id,
        pro_detalle_producto,
        categoria:com_categoria(ctg_id, ctg_nombre, ctg_slug)
      `)
      .eq("pro_negocio", negocio)
      .eq("pro_activo", true)
      .order("pro_destacado", { ascending: false });

    if (!errPCom && pCom && pCom.length > 0) {
      prodsDb = pCom;
      const { data: vCom } = await supabase
        .schema("comun_comercio")
        .from("com_variante")
        .select("*")
        .eq("var_negocio", negocio)
        .eq("var_activo", true)
        .order("var_precio", { ascending: true });
      varsDb = vCom || [];
    } else {
      // 2. Intentar en public (vistas o réplicas)
      const { data: pPub, error: errPPub } = await supabase
        .from("com_producto")
        .select(`
          pro_id,
          pro_negocio,
          pro_nombre,
          pro_slug,
          pro_descripcion,
          pro_tipo,
          pro_destacado,
          pro_categoria_principal_id,
          pro_detalle_producto,
          categoria:com_categoria(ctg_id, ctg_nombre, ctg_slug)
        `)
        .eq("pro_negocio", negocio)
        .eq("pro_activo", true)
        .order("pro_destacado", { ascending: false });

      if (!errPPub && pPub && pPub.length > 0) {
        prodsDb = pPub;
        const { data: vPub } = await supabase
          .from("com_variante")
          .select("*")
          .eq("var_negocio", negocio)
          .eq("var_activo", true)
          .order("var_precio", { ascending: true });
        varsDb = vPub || [];
      }
    }
  } catch {
    // Fallback silencioso a semillas
  }

  let listaFinal: ProductoCatalogo[] = [];

  if (prodsDb.length > 0) {
    const mapaVariantes = (varsDb || []).reduce((acc: Record<string, VarianteCatalogo[]>, v: any) => {
      const base = Number(v.var_precio) || 0;
      const tarifaIva = Number(v.var_tarifa_iva_porcentaje) || 15;
      const iva = Number(((base * tarifaIva) / 100).toFixed(4));
      const total = Number((base + iva).toFixed(2));

      const item: VarianteCatalogo = {
        var_id: v.var_id,
        var_producto_id: v.var_producto_id,
        var_sku: v.var_sku,
        var_nombre: v.var_nombre,
        var_precio: base,
        var_precio_comparacion: v.var_precio_comparacion ? Number(v.var_precio_comparacion) : null,
        var_codigo_impuesto_sri: v.var_codigo_impuesto_sri || "IVA_15",
        var_tarifa_iva_porcentaje: tarifaIva,
        var_tipo_oferta: v.var_tipo_oferta,
        var_frecuencia_recurrencia: v.var_frecuencia_recurrencia,
        var_activo: v.var_activo,
        var_detalle_variante: v.var_detalle_variante || {},
        monto_iva: iva,
        precio_total: total,
      };

      const prodId = v.var_producto_id;
      if (!acc[prodId]) {
        acc[prodId] = [];
      }
      acc[prodId]?.push(item);
      return acc;
    }, {});

    listaFinal = prodsDb.map((p: any) => ({
      pro_id: p.pro_id,
      pro_negocio: p.pro_negocio,
      pro_nombre: p.pro_nombre,
      pro_slug: p.pro_slug,
      pro_descripcion: p.pro_descripcion,
      pro_tipo: p.pro_tipo,
      pro_destacado: p.pro_destacado,
      pro_categoria_principal_id: p.pro_categoria_principal_id,
      pro_detalle_producto: p.pro_detalle_producto || {},
      categoria: p.categoria || null,
      variantes: mapaVariantes[p.pro_id] || [],
    }));
  } else {
    // Si no hay productos en la BD, cargamos las semillas preconfiguradas
    listaFinal = negocio === "tranqi" ? [...PRODUCTOS_SEMILLA_TRANQI] : [];
  }

  // Incorporar productos creados dinámicamente en memoria
  const customs = storeCustomProductos.get(negocio) || [];
  customs.forEach((p) => {
    if (!listaFinal.some((item) => item.pro_id === p.pro_id || item.pro_slug === p.pro_slug)) {
      listaFinal.unshift(p);
    }
  });

  return listaFinal;
}

// ==============================================================================
// 3. ACCIONES DE CREACIÓN DE CATEGORÍAS Y PRODUCTOS
// ==============================================================================

/**
 * Crea una nueva categoría comercial
 */
export async function crearCategoriaAction(datos: {
  nombre: string;
  slug?: string;
  descripcion?: string;
  tipo?: string;
  orden?: number;
  negocio?: string;
}): Promise<{ ok: boolean; categoria?: CategoriaCatalogo; error?: string }> {
  try {
    const negocio = datos.negocio || "tranqi";
    const nombre = datos.nombre.trim();
    if (!nombre) {
      return { ok: false, error: "El nombre de la categoría es obligatorio." };
    }

    const slug = datos.slug?.trim() || generarSlug(nombre);
    const catId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const nuevaCat: CategoriaCatalogo = {
      ctg_id: catId,
      ctg_negocio: negocio,
      ctg_nombre: nombre,
      ctg_slug: slug,
      ctg_descripcion: datos.descripcion?.trim() || null,
      ctg_tipo: datos.tipo || "FORMATO",
      ctg_orden: datos.orden || 10,
      ctg_activo: true,
    };

    // 1. Intentar persistir en Supabase
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_categoria")
          .upsert(
            {
              ctg_negocio: negocio,
              ctg_nombre: nombre,
              ctg_slug: slug,
              ctg_descripcion: datos.descripcion?.trim() || null,
              ctg_tipo: datos.tipo || "FORMATO",
              ctg_orden: datos.orden || 10,
              ctg_activo: true,
            },
            { onConflict: "ctg_negocio, ctg_slug" }
          );
      } catch {
        try {
          await clienteActivo.from("com_categoria").upsert(
            {
              ctg_negocio: negocio,
              ctg_nombre: nombre,
              ctg_slug: slug,
              ctg_descripcion: datos.descripcion?.trim() || null,
              ctg_tipo: datos.tipo || "FORMATO",
              ctg_orden: datos.orden || 10,
              ctg_activo: true,
            },
            { onConflict: "ctg_negocio, ctg_slug" }
          );
        } catch {
          // Guardar en memoria
        }
      }
    }

    // 2. Guardar en almacén local
    const actuales = storeCustomCategorias.get(negocio) || [];
    actuales.push(nuevaCat);
    storeCustomCategorias.set(negocio, actuales);

    revalidatePath("/panel/catalogo-productos");
    return { ok: true, categoria: nuevaCat };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al crear la categoría." };
  }
}

/**
 * Crea un nuevo producto u honorario profesional con su variante de cobro
 */
export async function crearProductoAction(datos: {
  nombre: string;
  slug?: string;
  descripcion: string;
  categoriaId?: string;
  tipo: "FISICO" | "SERVICIO" | "SUSCRIPCION" | "DIGITAL";
  destacado?: boolean;
  precioBase: number;
  tarifaIva?: number; // 15 o 0
  sku?: string;
  icono?: "Scale" | "ShieldCheck" | "FileCheck" | "CreditCard";
  modalidadPago?: string;
  negocio?: string;
}): Promise<{ ok: boolean; producto?: ProductoCatalogo; error?: string }> {
  try {
    const negocio = datos.negocio || "tranqi";
    const nombre = datos.nombre.trim();
    if (!nombre) {
      return { ok: false, error: "El nombre del producto u honorario es obligatorio." };
    }
    if (datos.precioBase <= 0) {
      return { ok: false, error: "El precio base debe ser mayor a cero." };
    }

    const slug = datos.slug?.trim() || generarSlug(nombre);
    const prodId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const varId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const sku = datos.sku?.trim() || `TRQ-${generarSlug(nombre).toUpperCase().substring(0, 10)}`;

    const tarifaIva = datos.tarifaIva ?? 15;
    const base = Number(datos.precioBase.toFixed(2));
    const montoIva = Number(((base * tarifaIva) / 100).toFixed(2));
    const total = Number((base + montoIva).toFixed(2));

    // Obtener categoría asociada
    const cats = await obtenerCategoriasAction(negocio);
    const cat = cats.find((c) => c.ctg_id === datos.categoriaId) || cats[0] || null;

    const nuevaVariante: VarianteCatalogo = {
      var_id: varId,
      var_producto_id: prodId,
      var_sku: sku,
      var_nombre: `${nombre} (Tarifa Estándar)`,
      var_precio: base,
      var_precio_comparacion: null,
      var_codigo_impuesto_sri: tarifaIva > 0 ? "IVA_15" : "IVA_0",
      var_tarifa_iva_porcentaje: tarifaIva,
      var_tipo_oferta: "REGULAR",
      var_frecuencia_recurrencia: datos.tipo === "SUSCRIPCION" ? "MENSUAL" : null,
      var_activo: true,
      var_detalle_variante: {
        tipo_honorario: datos.tipo,
        modalidad_pago: datos.modalidadPago || "Payphone / Tarjetas / Transferencia",
      },
      monto_iva: montoIva,
      precio_total: total,
    };

    const nuevoProducto: ProductoCatalogo = {
      pro_id: prodId,
      pro_negocio: negocio,
      pro_nombre: nombre,
      pro_slug: slug,
      pro_descripcion: datos.descripcion.trim(),
      pro_tipo: datos.tipo,
      pro_destacado: Boolean(datos.destacado),
      pro_categoria_principal_id: cat?.ctg_id || null,
      pro_detalle_producto: {
        icono: datos.icono || "Scale",
        modalidad_pago: datos.modalidadPago || "Botón Payphone / Tarjeta / Saldo",
        creado_desde_panel: true,
      },
      categoria: cat
        ? {
            ctg_id: cat.ctg_id,
            ctg_nombre: cat.ctg_nombre,
            ctg_slug: cat.ctg_slug,
          }
        : null,
      variantes: [nuevaVariante],
    };

    // 1. Intentar persistir en Supabase
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_producto")
          .upsert(
            {
              pro_negocio: negocio,
              pro_nombre: nombre,
              pro_slug: slug,
              pro_descripcion: datos.descripcion.trim(),
              pro_tipo: datos.tipo,
              pro_destacado: Boolean(datos.destacado),
              pro_categoria_principal_id: cat?.ctg_id || null,
              pro_activo: true,
              pro_detalle_producto: nuevoProducto.pro_detalle_producto,
            },
            { onConflict: "pro_negocio, pro_slug" }
          );

        await clienteActivo
          .schema("comun_comercio")
          .from("com_variante")
          .upsert(
            {
              var_negocio: negocio,
              var_sku: sku,
              var_nombre: nuevaVariante.var_nombre,
              var_precio: base,
              var_codigo_impuesto_sri: nuevaVariante.var_codigo_impuesto_sri,
              var_tarifa_iva_porcentaje: tarifaIva,
              var_tipo_oferta: "REGULAR",
              var_activo: true,
              var_detalle_variante: nuevaVariante.var_detalle_variante,
            },
            { onConflict: "var_negocio, var_sku" }
          );
      } catch {
        // Fallback en public
        try {
          await clienteActivo.from("com_producto").upsert(
            {
              pro_negocio: negocio,
              pro_nombre: nombre,
              pro_slug: slug,
              pro_descripcion: datos.descripcion.trim(),
              pro_tipo: datos.tipo,
              pro_destacado: Boolean(datos.destacado),
              pro_categoria_principal_id: cat?.ctg_id || null,
              pro_activo: true,
              pro_detalle_producto: nuevoProducto.pro_detalle_producto,
            },
            { onConflict: "pro_negocio, pro_slug" }
          );
        } catch {
          // Guardar en memoria
        }
      }
    }

    // 2. Guardar en almacén local de memoria
    const actuales = storeCustomProductos.get(negocio) || [];
    actuales.unshift(nuevoProducto);
    storeCustomProductos.set(negocio, actuales);

    revalidatePath("/panel/catalogo-productos");
    return { ok: true, producto: nuevoProducto };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al registrar el producto." };
  }
}

/**
 * Restaura o recarga las semillas de ejemplo en el catálogo activo
 */
export async function restaurarCatalogoEjemploAction(negocio = "tranqi"): Promise<{ ok: boolean; total: number }> {
  if (negocio === "tranqi") {
    storeCustomCategorias.set(negocio, [...CATEGORIAS_SEMILLA_TRANQI]);
    storeCustomProductos.set(negocio, [...PRODUCTOS_SEMILLA_TRANQI]);
  }
  revalidatePath("/panel/catalogo-productos");
  return { ok: true, total: PRODUCTOS_SEMILLA_TRANQI.length };
}

// ==============================================================================
// 4. CONFIGURACIÓN DE PASARELA PAYPHONE
// ==============================================================================

/**
 * Obtiene la configuración de Payphone para el tenant actual
 */
export async function obtenerConfiguracionPasarelaAction(
  negocio = "tranqi",
  pasarela = "PAYPHONE"
): Promise<ConfiguracionPasarela> {
  const supabase: any = await crearClienteServidor();

  let data: any = null;
  try {
    const { data: dCom } = await supabase
      .schema("comun_comercio")
      .from("com_pasarela_configuracion")
      .select("*")
      .eq("psc_negocio", negocio)
      .eq("psc_pasarela", pasarela)
      .maybeSingle();
    data = dCom;

    if (!data) {
      const { data: dPub } = await supabase
        .from("com_pasarela_configuracion")
        .select("*")
        .eq("psc_negocio", negocio)
        .eq("psc_pasarela", pasarela)
        .maybeSingle();
      data = dPub;
    }
  } catch {
    // Modo simulado por defecto
  }

  if (!data) {
    return {
      psc_negocio: negocio,
      psc_pasarela: pasarela,
      psc_nombre_visible: "Payphone (Tarjetas y Saldo)",
      psc_ambiente: "PRUEBAS",
      psc_activo: true,
      storeId: "STORE-DEMO-TRANQI-001",
      modoSimulado: true,
      comisionPorcentaje: 6.0,
    };
  }

  const pub = data.psc_credenciales_publicas || {};
  const priv = data.psc_credenciales_privadas || {};

  return {
    psc_id: data.psc_id,
    psc_negocio: data.psc_negocio,
    psc_pasarela: data.psc_pasarela,
    psc_nombre_visible: data.psc_nombre_visible,
    psc_ambiente: data.psc_ambiente || "PRUEBAS",
    psc_activo: data.psc_activo ?? true,
    storeId: pub.storeId || "STORE-DEMO-TRANQI-001",
    modoSimulado: pub.modoSimulado ?? priv.modoSimulado ?? true,
    token: priv.token || "",
    comisionPorcentaje: Number(data.psc_comision_porcentaje) || 6.0,
    detalle: data.psc_detalle_pasarela || {},
  };
}

/**
 * Guarda o actualiza la configuración de la pasarela Payphone
 */
export async function guardarConfiguracionPasarelaAction(datos: {
  negocio?: string;
  storeId: string;
  token?: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  modoSimulado: boolean;
  activo: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const negocio = datos.negocio || "tranqi";
  const admin: any = crearClienteAdmin();
  const supabase: any = await crearClienteServidor();
  const clienteActivo = admin || supabase;

  const pub = {
    storeId: datos.storeId.trim(),
    modoSimulado: datos.modoSimulado,
    moneda: "USD",
    pais: "EC",
  };

  const privPayload: Record<string, any> = {
    modoSimulado: datos.modoSimulado,
  };
  if (datos.token && datos.token.trim().length > 0) {
    privPayload.token = datos.token.trim();
  }

  if (clienteActivo) {
    try {
      await clienteActivo
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .upsert(
          {
            psc_negocio: negocio,
            psc_pasarela: "PAYPHONE",
            psc_nombre_visible: "Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)",
            psc_ambiente: datos.ambiente,
            psc_activo: datos.activo,
            psc_credenciales_publicas: pub,
            psc_credenciales_privadas: privPayload,
            psc_actualizado_en: new Date().toISOString(),
          },
          { onConflict: "psc_negocio, psc_pasarela" }
        );
    } catch {
      try {
        await clienteActivo.from("com_pasarela_configuracion").upsert(
          {
            psc_negocio: negocio,
            psc_pasarela: "PAYPHONE",
            psc_nombre_visible: "Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)",
            psc_ambiente: datos.ambiente,
            psc_activo: datos.activo,
            psc_credenciales_publicas: pub,
            psc_credenciales_privadas: privPayload,
            psc_actualizado_en: new Date().toISOString(),
          },
          { onConflict: "psc_negocio, psc_pasarela" }
        );
      } catch (err: any) {
        console.error("Error al guardar pasarela:", err);
      }
    }
  }

  revalidatePath("/panel");
  return { ok: true };
}

// ==============================================================================
// 5. PROCESAMIENTO DE PAGO: PREPARE Y CONFIRM (CON MODO SIMULADO)
// ==============================================================================

/**
 * Fase 1: Prepara la transacción de pago con Payphone (API /api/button/Prepare) o inicia simulación
 */
export async function prepararPagoPayphoneAction(datos: {
  negocio?: string;
  varianteId: string;
  nombreServicio: string;
  montoBase: number;
  montoIva: number;
  montoTotal: number;
  pagador: {
    nombres: string;
    apellidos: string;
    identificacion: string;
    email: string;
    telefono: string;
  };
  esSimulado?: boolean;
}) {
  const negocio = datos.negocio || "tranqi";
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const clienteDb = admin || supabase;

  const cfg = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
  const usarSimulacion = datos.esSimulado ?? cfg.modoSimulado;

  // Generar Client Transaction ID único
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const clientTransactionId = `TRQ-TX-${Date.now()}-${randomSuffix}`;

  // Obtener usuario autenticado si existe
  let clienteId = null;
  try {
    const { data: authUser } = await supabase.auth.getUser();
    clienteId = authUser?.user?.id || null;
  } catch {
    // Sin sesión
  }

  // Montos en centavos para cumplir normativa Payphone (entero x 100)
  const amountTotalCentavos = Math.round(datos.montoTotal * 100);
  const amountWithTaxCentavos = Math.round(datos.montoBase * 100);
  const taxCentavos = Math.round(datos.montoIva * 100);

  // 1. Si está en MODO SIMULADO:
  if (usarSimulacion) {
    const paymentIdSimulado = `SIM-PAY-${Date.now()}-${randomSuffix}`;

    // Registrar en com_transaccion_pago como PENDIENTE
    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .insert({
            pag_negocio: negocio,
            pag_cliente_id: clienteId,
            pag_pasarela: "PAYPHONE",
            pag_identificador_cliente: clientTransactionId,
            pag_transaccion_pasarela_id: paymentIdSimulado,
            pag_estado: "PENDIENTE",
            pag_monto_total: datos.montoTotal,
            pag_monto_sin_iva: 0,
            pag_monto_con_iva: datos.montoBase,
            pag_monto_iva: datos.montoIva,
            pag_moneda: "USD",
            pag_titular_email: datos.pagador.email,
            pag_titular_identificacion: datos.pagador.identificacion,
            pag_titular_telefono: datos.pagador.telefono,
            pag_detalle_transaccion: {
              modo_simulado: true,
              nombre_servicio: datos.nombreServicio,
              variante_id: datos.varianteId,
              fecha_preparacion: new Date().toISOString(),
              pagador: datos.pagador,
            },
          });
      } catch {
        // Fallback silencioso si la tabla no está creada
      }
    }

    return {
      ok: true,
      esSimulado: true,
      paymentId: paymentIdSimulado,
      clientTransactionId,
      payWithPayPhone: null,
      payWithCard: null,
      mensaje: "Transacción preparada con éxito en Modo Simulado (Sandbox).",
    };
  }

  // 2. Si está en MODO REAL (llamada oficial a Payphone Prepare API)
  const token = cfg.token;
  if (!token) {
    return {
      ok: false,
      error: "No se encuentra configurado el Token Bearer de Payphone para transacciones en vivo.",
    };
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://tranqi24.com";
    const bodyPayphone = {
      amount: amountTotalCentavos,
      amountWithoutTax: 0,
      amountWithTax: amountWithTaxCentavos,
      tax: taxCentavos,
      service: 0,
      tip: 0,
      clientTransactionId: clientTransactionId,
      reference: `Honorarios: ${datos.nombreServicio}`,
      storeId: cfg.storeId,
      currency: "USD",
      responseUrl: `${origin}/panel/pagos/confirmacion`,
      cancellationUrl: `${origin}/panel/pagos/cancelacion`,
      timeZone: -5,
      order: {
        billTo: {
          firstName: datos.pagador.nombres,
          lastName: datos.pagador.apellidos,
          email: datos.pagador.email,
          phoneNumber: datos.pagador.telefono.startsWith("+") ? datos.pagador.telefono : `+593${datos.pagador.telefono}`,
          customerId: datos.pagador.identificacion,
          country: "EC",
        },
        lineItems: [
          {
            name: datos.nombreServicio,
            quantity: 1,
            unitPrice: amountTotalCentavos,
          },
        ],
      },
    };

    const res = await fetch("https://pay.payphonetodoesposible.com/api/button/Prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayphone),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Payphone Prepare API error (${res.status}): ${errText}`,
      };
    }

    const payphoneData = await res.json();
    // payphoneData contiene: { paymentId, payWithPayPhone, payWithCard }

    // Registrar en com_transaccion_pago como PENDIENTE
    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .insert({
            pag_negocio: negocio,
            pag_cliente_id: clienteId,
            pag_pasarela: "PAYPHONE",
            pag_identificador_cliente: clientTransactionId,
            pag_transaccion_pasarela_id: String(payphoneData.paymentId),
            pag_estado: "PENDIENTE",
            pag_monto_total: datos.montoTotal,
            pag_monto_sin_iva: 0,
            pag_monto_con_iva: datos.montoBase,
            pag_monto_iva: datos.montoIva,
            pag_moneda: "USD",
            pag_titular_email: datos.pagador.email,
            pag_titular_identificacion: datos.pagador.identificacion,
            pag_titular_telefono: datos.pagador.telefono,
            pag_detalle_transaccion: {
              modo_simulado: false,
              nombre_servicio: datos.nombreServicio,
              variante_id: datos.varianteId,
              payphone_prepare: payphoneData,
            },
          });
      } catch {
        // Fallback silencioso
      }
    }

    return {
      ok: true,
      esSimulado: false,
      paymentId: payphoneData.paymentId,
      clientTransactionId,
      payWithPayPhone: payphoneData.payWithPayPhone,
      payWithCard: payphoneData.payWithCard,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: `Error de conexión con Payphone: ${error?.message || "Error de red"}`,
    };
  }
}

/**
 * Fase 2: Confirma la transacción con Payphone (API /api/button/V2/Confirm) o valida respuesta simulada
 */
export async function confirmarPagoPayphoneAction(datos: {
  id: string | number; // paymentId
  clientTxId: string;
  negocio?: string;
  esSimulado?: boolean;
  resultadoSimulacion?: "APROBADO" | "RECHAZADO";
  marcaTarjetaSimulada?: string;
}) {
  const negocio = datos.negocio || "tranqi";
  const admin: any = crearClienteAdmin();
  const supabase: any = await crearClienteServidor();
  const clienteDb = admin || supabase;

  const cfg = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
  const usarSimulacion = datos.esSimulado ?? cfg.modoSimulado;

  // 1. Si es MODO SIMULADO:
  if (usarSimulacion) {
    const aprobado = datos.resultadoSimulacion !== "RECHAZADO";
    const authCode = aprobado ? `AUTH-SIM-${Math.floor(100000 + Math.random() * 900000)}` : null;
    const estadoFinal = aprobado ? "APROBADO" : "RECHAZADO";

    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .update({
            pag_estado: estadoFinal,
            pag_autorizacion_codigo: authCode,
            pag_tarjeta_tipo: "Crédito (Simulado)",
            pag_tarjeta_marca: "Visa / Diners Club",
            pag_tarjeta_ultimos_digitos: "4321",
            pag_confirmado_en: new Date().toISOString(),
            pag_detalle_transaccion: {
              simulacion: true,
              fecha_confirmacion: new Date().toISOString(),
              resultado: estadoFinal,
            },
          })
          .eq("pag_identificador_cliente", datos.clientTxId);
      } catch {
        // Continuar
      }
    }

    return {
      ok: aprobado,
      estado: estadoFinal,
      codigoAutorizacion: authCode,
      mensaje: aprobado
        ? "¡Pago Aprobado con Éxito (Simulación Payphone)!"
        : "Transacción rechazada por el emisor simulado.",
      tarjeta: "Visa •••• 4321",
      fecha: new Date().toISOString(),
    };
  }

  // 2. Si es MODO REAL (Llamada a /api/button/V2/Confirm)
  const token = cfg.token;
  if (!token) {
    return {
      ok: false,
      error: "No se encuentra configurado el Token Bearer de Payphone.",
    };
  }

  try {
    const res = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: Number(datos.id),
        clientTxId: datos.clientTxId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Payphone Confirm API error (${res.status}): ${errText}`,
      };
    }

    const confirmData = await res.json();
    const aprobado = confirmData.transactionStatus === "Approved";
    const estadoFinal = aprobado ? "APROBADO" : "RECHAZADO";

    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .update({
            pag_estado: estadoFinal,
            pag_autorizacion_codigo: confirmData.authorizationCode || null,
            pag_tarjeta_tipo: confirmData.cardType || null,
            pag_tarjeta_marca: confirmData.cardBrand || null,
            pag_tarjeta_ultimos_digitos: confirmData.lastDigits || null,
            pag_confirmado_en: new Date().toISOString(),
            pag_detalle_transaccion: {
              payphone_confirm: confirmData,
            },
          })
          .eq("pag_identificador_cliente", datos.clientTxId);
      } catch {
        // Continuar
      }
    }

    return {
      ok: aprobado,
      estado: estadoFinal,
      codigoAutorizacion: confirmData.authorizationCode,
      mensaje: aprobado ? "¡Pago Confirmado y Aprobado por Payphone!" : confirmData.message || "Pago no aprobado",
      tarjeta: `${confirmData.cardBrand || "Tarjeta"} •••• ${confirmData.lastDigits || ""}`,
      fecha: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      ok: false,
      error: `Error al confirmar transacción: ${error?.message || "Error desconocido"}`,
    };
  }
}

/**
 * Obtiene el historial de transacciones de pago
 */
export async function obtenerHistorialTransaccionesAction(negocio = "tranqi"): Promise<TransaccionPagoCRM[]> {
  const supabase: any = await crearClienteServidor();

  try {
    const { data: dCom } = await supabase
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .select("*")
      .eq("pag_negocio", negocio)
      .order("pag_creado_en", { ascending: false })
      .limit(50);

    if (dCom && dCom.length > 0) return dCom;

    const { data: dPub } = await supabase
      .from("com_transaccion_pago")
      .select("*")
      .eq("pag_negocio", negocio)
      .order("pag_creado_en", { ascending: false })
      .limit(50);

    return dPub || [];
  } catch {
    return [];
  }
}
