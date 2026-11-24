import type {
  CategoriaCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from "../acciones";
import {
  CANALES_CATALOGO_OFICIALES,
  CANALES_POR_DEFECTO,
  type CanalVisibilidad,
} from "../canales";
import {
  inferirTipoEnvoltorioPorColeccion,
  normalizarConfiguracionPersonalizacionFloral,
  obtenerColoresPorDefectoEnvoltorio,
  obtenerEtiquetaTipoEnvoltorio,
  resolverPersonalizacionFloralEfectiva,
  type ColorBasePapelId,
  type ConfiguracionPersonalizacionFloral,
  type TipoEnvoltorioFloral,
} from "./personalizacionFloral";
import { normalizarComponentesCombo, normalizarEscalasVolumen } from "./combosVolumen";
import { esCodigoOfertaRenta, normalizarConfiguracionRenta } from "./tiposOferta";

export interface BorradorConfiguracionProducto {
  pro_id?: string;
  pro_slug?: string;
  negocio?: string;
  nombre: string;
  categoriaNombre?: string;
  tipo: string;
  tipoOfertaEtiqueta?: string | null;
  activo: boolean;
  destacado: boolean;
  tarifaIvaPredeterminada: number;
  descripcion: string;
  beneficios: string[];
  requisitos?: string[];
  tiempoEntrega?: string;
  canalesVisibilidad?: string[];
  usos?: string[];
  etiquetas?: string[];
  vigenciaTipo?: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  etiquetaTemporada?: string | null;
  mensajeFueraTemporada?: string | null;
  logistica?: {
    delivery_incluido?: boolean;
    modalidad_transporte?: string;
    etiqueta_transporte?: string;
    cobertura_texto?: string;
    recargo_transporte_usd?: number;
  } | null;
  personalizacionFloral?: ConfiguracionPersonalizacionFloral | null;
  imagenUrl?: string | null;
  galeriaUrls?: string[];
  albumFotosUrl?: string | null;
  videoUrl?: string | null;
  esCombo?: boolean;
  comboComponentes?: Array<{ nombre: string; cantidad: number; sku?: string }>;
  esRenta?: boolean;
  rentaResumen?: string | null;
  variantes: Array<{
    var_id?: string;
    var_sku: string;
    var_nombre: string;
    var_precio: number;
    var_precio_comparacion?: number | null;
    var_tarifa_iva_porcentaje: number;
    var_activo: boolean;
    tipo_envoltorio?: TipoEnvoltorioFloral | null;
    portada_url?: string | null;
    escalas_volumen?: Array<{
      cantidad_minima: number;
      tipo: string;
      valor: number;
    }>;
  }>;
}

export interface VarianteImportadaMasiva {
  var_id?: string;
  var_sku?: string;
  var_nombre?: string;
  var_precio?: number;
  var_precio_comparacion?: number | null;
  var_tarifa_iva_porcentaje?: number;
  var_activo?: boolean;
  tipo_envoltorio?: TipoEnvoltorioFloral;
  portada_url?: string | null;
  album_url?: string | null;
  tiempo_entrega?: string | null;
  galeria_urls?: string[];
}

export interface ProductoImportadoMasivo {
  origenIndice: number;
  pro_id?: string;
  slug?: string;
  nombre?: string;
  categoria?: string;
  tipo?: string;
  activo?: boolean;
  destacado?: boolean;
  tarifa_iva?: number;
  descripcion?: string;
  beneficios?: string[];
  requisitos?: string[];
  tiempo_entrega?: string;
  canales?: CanalVisibilidad[];
  usos?: string[];
  etiquetas?: string[];
  vigencia_tipo?: "SIEMPRE" | "RANGO_FECHAS" | "ESTACIONAL_ANUAL";
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  etiqueta_temporada?: string | null;
  delivery_incluido?: boolean;
  modalidad_transporte?: string;
  etiqueta_transporte?: string;
  cobertura_texto?: string;
  recargo_transporte_usd?: number;
  floral_habilitada?: boolean;
  floral_max_colores_rosas?: number;
  floral_colores_rosas?: string[];
  floral_solo_rosas?: boolean;
  floral_solo_girasoles?: boolean;
  floral_girasoles_y_rosas?: boolean;
  floral_orquideas_min?: number;
  floral_orquideas_max?: number;
  floral_tipo_envoltorio?: TipoEnvoltorioFloral;
  floral_colores_envoltorio?: ColorBasePapelId[];
  floral_indicaciones?: boolean;
  imagen_url?: string | null;
  album_fotos_url?: string | null;
  video_url?: string | null;
  galeria_urls?: string[];
  precio_principal_base?: number;
  precio_principal_comparacion?: number | null;
  sku_principal?: string;
  variantes?: VarianteImportadaMasiva[];
}

export interface ResultadoParseoCatalogoMasivo {
  formato: "markdown" | "excel";
  productos: ProductoImportadoMasivo[];
  advertencias: string[];
}

export interface CambioCampoCatalogo {
  campo: string;
  etiqueta: string;
  antes: string;
  despues: string;
}

export interface PatchVarianteMasiva {
  var_id?: string;
  var_sku: string;
  var_nombre: string;
  var_precio: number;
  var_precio_comparacion?: number | null;
  var_tarifa_iva_porcentaje: number;
  var_codigo_impuesto_sri: string;
  var_activo: boolean;
  var_detalle_variante: Record<string, unknown>;
}

export interface PatchProductoMasivo {
  pro_id: string;
  nombre: string;
  descripcion: string;
  categoriaId?: string;
  tipo: string;
  destacado: boolean;
  pro_activo: boolean;
  tarifaIvaPredeterminada: number;
  beneficios: string[];
  requisitos: string[];
  tiempoEntrega: string;
  usos: string[];
  etiquetas: string[];
  canales_visibilidad: CanalVisibilidad[];
  vigencia_tipo: "SIEMPRE" | "RANGO_FECHAS" | "ESTACIONAL_ANUAL";
  fecha_inicio?: string;
  fecha_fin?: string;
  etiqueta_temporada?: string;
  logistica: {
    delivery_incluido: boolean;
    modalidad_transporte: string;
    etiqueta_transporte: string;
    cobertura_texto: string;
    recargo_transporte_usd?: number;
  };
  personalizacionFloral?: Partial<ConfiguracionPersonalizacionFloral> | null;
  imagenUrl?: string;
  albumFotosUrl?: string;
  videoUrl?: string;
  galeriaUrls?: string[];
  variantes: PatchVarianteMasiva[];
}

export interface ItemPlanActualizacionMasiva {
  clave: string;
  pro_id: string | null;
  nombreActual: string;
  nombreImportado: string;
  estado: "CON_CAMBIOS" | "SIN_CAMBIOS" | "NO_ENCONTRADO" | "ERROR";
  cambios: CambioCampoCatalogo[];
  advertencias: string[];
  patch?: PatchProductoMasivo;
}

export interface PlanActualizacionMasiva {
  totalLeidos: number;
  totalConCambios: number;
  totalSinCambios: number;
  totalNoEncontrados: number;
  totalErrores: number;
  advertenciasGlobales: string[];
  items: ItemPlanActualizacionMasiva[];
}

const CANALES_VALIDOS = new Set<string>(
  CANALES_CATALOGO_OFICIALES.map((c) => c.clave)
);

function normalizarClave(texto: string): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarTextoComparacion(texto: string): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parsearBooleanoFlexible(valor: unknown): boolean | undefined {
  if (typeof valor === "boolean") return valor;
  const s = normalizarTextoComparacion(String(valor ?? ""));
  if (!s) return undefined;
  if (["si", "true", "1", "yes", "activo", "habilitado", "x"].includes(s)) return true;
  if (["no", "false", "0", "inactivo", "deshabilitado"].includes(s)) return false;
  return undefined;
}

function parsearNumeroFlexible(valor: unknown): number | undefined {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : undefined;
  }
  const limpio = String(valor ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/usd/gi, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!limpio) return undefined;
  const num = Number(limpio);
  return Number.isFinite(num) ? num : undefined;
}

function parsearListaTexto(valor: unknown, separadorPipe = false): string[] {
  if (Array.isArray(valor)) {
    return valor.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(valor ?? "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "(ninguno)" || raw.toLowerCase() === "(vacío)") {
    return [];
  }
  const regex = separadorPipe ? /[\r\n|;]+/ : /[\r\n,|;]+/;
  return raw
    .split(regex)
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function parsearTipoEnvoltorioFlexible(valor: unknown): TipoEnvoltorioFloral | undefined {
  const s = normalizarTextoComparacion(String(valor ?? ""));
  if (!s) return undefined;
  if (s === "base" || s.includes("box")) return "base";
  if (s === "papel_envoltorio" || s === "papel" || s.includes("papel")) return "papel_envoltorio";
  if (s === "no_aplica" || s === "no aplica" || s === "ninguno" || s === "n/a") return "no_aplica";
  return undefined;
}

function parsearCanalesFlexible(valor: unknown): CanalVisibilidad[] {
  const tokens = parsearListaTexto(valor);
  const res: CanalVisibilidad[] = [];
  for (const t of tokens) {
    const up = t.toUpperCase().trim();
    if (CANALES_VALIDOS.has(up)) {
      res.push(up as CanalVisibilidad);
      continue;
    }
    const norm = normalizarClave(t);
    if (norm.includes("ecommerce") || norm.includes("tienda") || norm === "web") {
      res.push("ECOMMERCE_WEB");
    } else if (norm.includes("app_cliente") || norm === "app") {
      res.push("APP_CLIENTES");
    } else if (norm.includes("chatbot_web") || norm.includes("aria_web")) {
      res.push("CHATBOT_WEB");
    } else if (norm.includes("chatbot_app")) {
      res.push("CHATBOT_APP");
    } else if (norm.includes("whatsapp")) {
      res.push("CHATBOT_WHATSAPP");
    } else if (norm.includes("mcp") || norm.includes("b2b") || norm.includes("api") || norm.includes("otros")) {
      res.push("OTROS_API");
    }
  }
  return Array.from(new Set(res));
}

function escaparCeldaMd(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function desescaparCeldaMd(valor: string): string {
  return valor.replace(/\\\|/g, "|").trim();
}

function limpiarValorMd(valor: string): string {
  const limpio = valor.trim();
  if (limpio.startsWith("`") && limpio.endsWith("`") && limpio.length >= 2) {
    return limpio.slice(1, -1).trim();
  }
  return limpio;
}

function obtenerDetalleProducto(p: ProductoCatalogo): Record<string, any> {
  return (p.pro_detalle_producto && typeof p.pro_detalle_producto === "object"
    ? p.pro_detalle_producto
    : {}) as Record<string, any>;
}

function obtenerPersonalizacionProducto(
  p: ProductoCatalogo,
  esFloristeria: boolean
): ConfiguracionPersonalizacionFloral | null {
  const det = obtenerDetalleProducto(p);
  if (!esFloristeria && !det.personalizacion_floral) return null;
  const tipoEnvDef = esFloristeria
    ? inferirTipoEnvoltorioPorColeccion({
        categoriaNombre: p.categoria?.ctg_nombre,
        categoriaSlug: p.categoria?.ctg_slug,
        productoNombre: p.pro_nombre,
        productoSlug: p.pro_slug,
      })
    : "no_aplica";
  return normalizarConfiguracionPersonalizacionFloral(det.personalizacion_floral, {
    habilitadaPorDefecto: esFloristeria,
    tipoEnvoltorioPorDefecto: tipoEnvDef,
  });
}

function construirBorradorDesdeProducto(
  p: ProductoCatalogo,
  opciones?: { negocio?: string }
): BorradorConfiguracionProducto {
  const det = obtenerDetalleProducto(p);
  const neg = (opciones?.negocio || p.pro_negocio || "tinkay").toLowerCase();
  const esFloristeria = neg.includes("tinkay") || neg.includes("margarita");

  const canales =
    Array.isArray(p.canales_visibilidad) && p.canales_visibilidad.length > 0
      ? p.canales_visibilidad
      : Array.isArray(det.canales_visibilidad)
        ? det.canales_visibilidad
        : [...CANALES_POR_DEFECTO];

  const pers = obtenerPersonalizacionProducto(p, esFloristeria);
  const tarifaIvaMaster =
    det.tarifa_iva_predeterminada !== undefined && det.tarifa_iva_predeterminada !== null
      ? Number(det.tarifa_iva_predeterminada)
      : p.variantes?.[0]?.var_tarifa_iva_porcentaje ?? (esFloristeria ? 0 : 15);

  const esCombo = Boolean(det.es_combo);
  const comboComp = esCombo ? normalizarComponentesCombo(det.combo_componentes) : [];
  const esRenta = esCodigoOfertaRenta(p.pro_tipo, det);
  const rentaCfg = esRenta ? normalizarConfiguracionRenta(det.renta_config) : null;

  return {
    pro_id: p.pro_id,
    pro_slug: p.pro_slug,
    negocio: neg,
    nombre: p.pro_nombre,
    categoriaNombre: p.categoria?.ctg_nombre || "Sin categoría",
    tipo: p.pro_tipo || "FISICO",
    tipoOfertaEtiqueta: det.tipo_oferta_etiqueta || null,
    activo: p.pro_activo !== false && det.pro_activo !== false,
    destacado: Boolean(p.pro_destacado),
    tarifaIvaPredeterminada: tarifaIvaMaster,
    descripcion: p.pro_descripcion || "",
    beneficios: Array.isArray(det.beneficios) ? det.beneficios.filter(Boolean) : [],
    requisitos: Array.isArray(det.requisitos) ? det.requisitos.filter(Boolean) : [],
    tiempoEntrega: det.tiempo_entrega || "",
    canalesVisibilidad: canales,
    usos: Array.isArray(det.usos)
      ? det.usos.filter(Boolean)
      : Array.isArray(det.ocasiones)
        ? det.ocasiones.filter(Boolean)
        : [],
    etiquetas: Array.isArray(det.etiquetas) ? det.etiquetas.filter(Boolean) : [],
    vigenciaTipo: det.vigencia_tipo || "SIEMPRE",
    fechaInicio: det.fecha_inicio || null,
    fechaFin: det.fecha_fin || null,
    etiquetaTemporada: det.etiqueta_temporada || null,
    mensajeFueraTemporada: det.mensaje_fuera_temporada || null,
    logistica: det.logistica || null,
    personalizacionFloral: pers,
    imagenUrl: det.imagen_url || null,
    galeriaUrls: Array.isArray(det.galeria_urls) ? det.galeria_urls.filter(Boolean) : [],
    albumFotosUrl: det.album_fotos_url || null,
    videoUrl: det.video_url || null,
    esCombo,
    comboComponentes: comboComp.map((c) => ({
      nombre: c.producto_nombre || c.producto_slug || c.producto_id,
      cantidad: c.cantidad_base,
      sku: c.variante_sku,
    })),
    esRenta,
    rentaResumen: rentaCfg
      ? `Periodo: ${rentaCfg.periodo} · Retiro incluido: ${rentaCfg.incluye_retiro ? "Sí" : "No"} · Garantía: $${Number(rentaCfg.deposito_garantia_usd || 0).toFixed(2)}`
      : null,
    variantes: (p.variantes || []).map((v) => {
      const vdet = (v.var_detalle_variante || {}) as Record<string, any>;
      const persVar = esFloristeria
        ? resolverPersonalizacionFloralEfectiva({
            configMaster: pers,
            configVariante: vdet.personalizacion_floral,
            modoVariante: vdet.personalizacion_floral_modo,
            habilitadaPorDefecto: esFloristeria,
            tipoEnvoltorioPorDefecto: pers?.tipoEnvoltorio,
          })
        : null;
      const escalas = normalizarEscalasVolumen(vdet.escalas_volumen);
      return {
        var_id: v.var_id,
        var_sku: v.var_sku || "",
        var_nombre: v.var_nombre || p.pro_nombre,
        var_precio: Number(v.var_precio || 0),
        var_precio_comparacion:
          v.var_precio_comparacion != null && Number(v.var_precio_comparacion) > 0
            ? Number(v.var_precio_comparacion)
            : null,
        var_tarifa_iva_porcentaje: Number(v.var_tarifa_iva_porcentaje ?? tarifaIvaMaster),
        var_activo: v.var_activo !== false,
        tipo_envoltorio: persVar?.tipoEnvoltorio ?? null,
        portada_url: vdet.portada_url || vdet.imagen_url || null,
        escalas_volumen: escalas.map((e) => ({
          cantidad_minima: e.min_cantidad,
          tipo: e.tipo,
          valor: e.valor,
        })),
      };
    }),
  };
}

/**
 * Formatea toda la configuración de un producto (o borrador en vivo del asistente)
 * en texto estructurado / Markdown limpio, listo para copiar y pegar en IA, WhatsApp o documentación.
 */
export function formatearConfiguracionProductoTexto(
  entrada: ProductoCatalogo | BorradorConfiguracionProducto,
  opciones?: { negocio?: string }
): string {
  const b: BorradorConfiguracionProducto =
    "pro_nombre" in entrada
      ? construirBorradorDesdeProducto(entrada, opciones)
      : entrada;

  const lineas: string[] = [];
  lineas.push(`# Configuración de Producto: ${b.nombre || "(Sin nombre)"}`);
  lineas.push("");
  lineas.push("## 1. Identificación y Estado");
  if (b.pro_id) lineas.push(`- **ID:** \`${b.pro_id}\``);
  if (b.pro_slug) lineas.push(`- **Slug:** \`${b.pro_slug}\``);
  if (b.negocio) lineas.push(`- **Negocio:** ${b.negocio}`);
  lineas.push(`- **Colección / Categoría:** ${b.categoriaNombre || "Sin categoría"}`);
  lineas.push(
    `- **Tipo de Oferta:** ${b.tipo}${b.tipoOfertaEtiqueta ? ` (${b.tipoOfertaEtiqueta})` : ""}`
  );
  lineas.push(`- **Estado:** ${b.activo ? "ACTIVO" : "INACTIVO"}`);
  lineas.push(`- **Destacado:** ${b.destacado ? "SÍ" : "NO"}`);
  lineas.push(`- **Tarifa IVA predeterminada:** ${b.tarifaIvaPredeterminada}%`);
  if (b.canalesVisibilidad && b.canalesVisibilidad.length > 0) {
    lineas.push(`- **Canales de Visibilidad:** ${b.canalesVisibilidad.join(", ")}`);
  }

  lineas.push("");
  lineas.push("## 2. Precios y Variantes / Tamaños");
  if (b.variantes.length === 0) {
    lineas.push("- Sin variantes configuradas");
  } else {
    for (const v of b.variantes) {
      const iva = Number(v.var_tarifa_iva_porcentaje || 0);
      const base = Number(v.var_precio || 0);
      const total = Number((base * (1 + iva / 100)).toFixed(2));
      const partes = [
        `**${v.var_nombre || "Estándar"}**`,
        v.var_sku ? `SKU: \`${v.var_sku}\`` : null,
        `PVP: $${total.toFixed(2)} (Base $${base.toFixed(2)} · IVA ${iva}%)`,
        v.var_precio_comparacion
          ? `Antes: $${Number(v.var_precio_comparacion).toFixed(2)}`
          : null,
        v.tipo_envoltorio ? `Envoltorio: ${obtenerEtiquetaTipoEnvoltorio(v.tipo_envoltorio)}` : null,
        v.var_activo === false ? "[INACTIVA]" : null,
      ].filter(Boolean);
      lineas.push(`- ${partes.join(" | ")}`);
      if (v.escalas_volumen && v.escalas_volumen.length > 0) {
        const txtEsc = v.escalas_volumen
          .map((e) => {
            if (e.tipo === "DESCUENTO_PORCENTAJE") return `≥${e.cantidad_minima} u. → -${e.valor}%`;
            if (e.tipo === "DESCUENTO_MONTO") return `≥${e.cantidad_minima} u. → -$${Number(e.valor).toFixed(2)}`;
            return `≥${e.cantidad_minima} u. → $${Number(e.valor).toFixed(2)}`;
          })
          .join(", ");
        lineas.push(`  - Escalas por volumen: ${txtEsc}`);
      }
    }
  }

  lineas.push("");
  lineas.push("## 3. Descripción y Beneficios");
  lineas.push("**Descripción:**");
  lineas.push(b.descripcion?.trim() || "(Sin descripción)");
  lineas.push("");
  lineas.push("**Beneficios / ¿Qué incluye?:**");
  if (b.beneficios.length > 0) {
    for (const ben of b.beneficios) {
      lineas.push(`- ${ben}`);
    }
  } else {
    lineas.push("- (Sin beneficios configurados)");
  }

  if (b.requisitos && b.requisitos.length > 0) {
    lineas.push("");
    lineas.push("**Requisitos / Condiciones:**");
    for (const req of b.requisitos) {
      lineas.push(`- ${req}`);
    }
  }

  if (b.personalizacionFloral) {
    const pf = b.personalizacionFloral;
    const modos: string[] = [];
    if (pf.permiteSoloRosas) modos.push("Solo Rosas");
    if (pf.permiteSoloGirasoles) modos.push("Solo Girasoles");
    if (pf.permiteGirasolesYRosas) modos.push("Girasoles y Rosas");

    lineas.push("");
    lineas.push("## 4. Colores y Flores (Personalización)");
    lineas.push(`- **Personalización habilitada:** ${pf.habilitada ? "SÍ" : "NO"}`);
    lineas.push(`- **Combinaciones de flores:** ${modos.length > 0 ? modos.join(", ") : "Ninguna"}`);
    lineas.push(`- **Máx. colores de rosas:** ${pf.maxColoresRosas}`);
    lineas.push(
      `- **Colores de rosas permitidos:** ${
        pf.coloresRosasDisponibles.length > 0
          ? pf.coloresRosasDisponibles.join(", ")
          : "Todos los colores"
      }`
    );
    lineas.push(
      `- **Orquídeas (min - max):** ${pf.orquideasMin} - ${pf.orquideasMax}`
    );
    lineas.push(
      `- **Tipo de envoltorio:** ${obtenerEtiquetaTipoEnvoltorio(pf.tipoEnvoltorio)} (\`${pf.tipoEnvoltorio}\`)`
    );
    if (pf.tipoEnvoltorio !== "no_aplica") {
      lineas.push(
        `- **Colores de envoltorio:** ${pf.coloresBaseDisponibles.join(", ") || "Por defecto"}`
      );
    }
    lineas.push(
      `- **Permitir indicaciones adicionales:** ${pf.permitirIndicacionesAdicionales ? "SÍ" : "NO"}`
    );
  }

  lineas.push("");
  lineas.push("## 5. Entrega, Logística y Clasificación");
  lineas.push(`- **Promesa / Tiempo de entrega:** ${b.tiempoEntrega || "(No definido)"}`);
  if (b.logistica) {
    lineas.push(
      `- **Delivery incluido:** ${b.logistica.delivery_incluido ? "SÍ" : "NO"}`
    );
    if (b.logistica.modalidad_transporte) {
      lineas.push(`- **Modalidad transporte:** ${b.logistica.modalidad_transporte}`);
    }
    if (b.logistica.etiqueta_transporte) {
      lineas.push(`- **Etiqueta transporte:** ${b.logistica.etiqueta_transporte}`);
    }
    if (b.logistica.cobertura_texto) {
      lineas.push(`- **Cobertura:** ${b.logistica.cobertura_texto}`);
    }
    if (Number(b.logistica.recargo_transporte_usd || 0) > 0) {
      lineas.push(
        `- **Recargo transporte:** $${Number(b.logistica.recargo_transporte_usd).toFixed(2)} USD`
      );
    }
  }
  lineas.push(
    `- **Ocasiones / Usos:** ${b.usos && b.usos.length > 0 ? b.usos.join(", ") : "(Ninguno)"}`
  );
  lineas.push(
    `- **Etiquetas (Tags):** ${b.etiquetas && b.etiquetas.length > 0 ? b.etiquetas.join(", ") : "(Ninguna)"}`
  );
  lineas.push(
    `- **Vigencia:** ${b.vigenciaTipo || "SIEMPRE"}${
      b.fechaInicio || b.fechaFin ? ` (${b.fechaInicio || "?"} a ${b.fechaFin || "?"})` : ""
    }${b.etiquetaTemporada ? ` · ${b.etiquetaTemporada}` : ""}`
  );

  if (b.esCombo && b.comboComponentes && b.comboComponentes.length > 0) {
    lineas.push("");
    lineas.push("## 6. Componentes de Set / Combo");
    for (const c of b.comboComponentes) {
      lineas.push(`- ${c.cantidad}x ${c.nombre}${c.sku ? ` (\`${c.sku}\`)` : ""}`);
    }
  }

  if (b.esRenta && b.rentaResumen) {
    lineas.push("");
    lineas.push("## Condiciones de Renta / Alquiler");
    lineas.push(`- ${b.rentaResumen}`);
  }

  lineas.push("");
  lineas.push("## Multimedia");
  lineas.push(`- **Portada:** ${b.imagenUrl || "(Sin portada)"}`);
  if (b.albumFotosUrl) lineas.push(`- **Álbum de fotos:** ${b.albumFotosUrl}`);
  if (b.videoUrl) lineas.push(`- **Video:** ${b.videoUrl}`);
  if (b.galeriaUrls && b.galeriaUrls.length > 0) {
    lineas.push(`- **Galería (${b.galeriaUrls.length}):** ${b.galeriaUrls.join(", ")}`);
  }

  return lineas.join("\n");
}

/**
 * Exporta el catálogo completo a un documento Markdown estructurado y apto para
 * análisis masivo con IA + edición + re-importación automática (round-trip).
 */
export function exportarCatalogoAMarkdown(
  productos: ProductoCatalogo[],
  categorias: CategoriaCatalogo[],
  opciones: { negocio: string; fechaIso?: string }
): string {
  const fecha = opciones.fechaIso || new Date().toISOString().slice(0, 19).replace("T", " ");
  const neg = opciones.negocio.toLowerCase();
  const esFloristeria = neg.includes("tinkay") || neg.includes("margarita");

  const lineas: string[] = [
    `# Catálogo Comercial — ${opciones.negocio.toUpperCase()}`,
    "",
    `> Exportado el ${fecha} · Total productos: **${productos.length}**`,
    "> **Guía para análisis y actualización masiva (IA / Manual):**",
    "> 1. **No modifiques** `pro_id` ni `var_id` (identifican cada registro en la base de datos).",
    "> 2. Puedes editar nombres, categorías, descripciones, beneficios, etiquetas, usos, tiempos de entrega, personalización floral, precios y estados (`SI` / `NO`).",
    "> 3. Guarda este archivo `.md` (o copia el resultado de tu IA) y cárgalo en **Catálogo → Exportar / Masivo → Importar Masivo**.",
    "",
    `**Categorías / Colecciones disponibles:** ${
      categorias.length > 0 ? categorias.map((c) => c.ctg_nombre).join(" | ") : "(Ninguna)"
    }`,
    `**Canales válidos:** ${CANALES_CATALOGO_OFICIALES.map((c) => c.clave).join(", ")}`,
    "",
  ];

  for (const p of productos) {
    const b = construirBorradorDesdeProducto(p, { negocio: neg });
    const pf = b.personalizacionFloral;
    const log = b.logistica || {};

    lineas.push("---");
    lineas.push(`## PRODUCTO: ${b.nombre}`);
    lineas.push(`- **pro_id:** \`${b.pro_id || ""}\``);
    lineas.push(`- **slug:** \`${b.pro_slug || ""}\``);
    lineas.push(`- **nombre:** ${b.nombre}`);
    lineas.push(`- **categoria:** ${b.categoriaNombre || ""}`);
    lineas.push(`- **tipo:** ${b.tipo}`);
    lineas.push(`- **activo:** ${b.activo ? "SI" : "NO"}`);
    lineas.push(`- **destacado:** ${b.destacado ? "SI" : "NO"}`);
    lineas.push(`- **tarifa_iva:** ${b.tarifaIvaPredeterminada}`);
    lineas.push(`- **tiempo_entrega:** ${b.tiempoEntrega || ""}`);
    lineas.push(`- **canales:** ${(b.canalesVisibilidad || []).join(", ")}`);
    lineas.push(`- **usos:** ${(b.usos || []).join(", ")}`);
    lineas.push(`- **etiquetas:** ${(b.etiquetas || []).join(", ")}`);
    lineas.push(`- **vigencia_tipo:** ${b.vigenciaTipo || "SIEMPRE"}`);
    lineas.push(`- **fecha_inicio:** ${b.fechaInicio || ""}`);
    lineas.push(`- **fecha_fin:** ${b.fechaFin || ""}`);
    lineas.push(`- **etiqueta_temporada:** ${b.etiquetaTemporada || ""}`);
    lineas.push(`- **delivery_incluido:** ${log.delivery_incluido ? "SI" : "NO"}`);
    lineas.push(`- **modalidad_transporte:** ${log.modalidad_transporte || ""}`);
    lineas.push(`- **etiqueta_transporte:** ${log.etiqueta_transporte || ""}`);
    lineas.push(`- **cobertura_texto:** ${log.cobertura_texto || ""}`);
    lineas.push(`- **recargo_transporte_usd:** ${Number(log.recargo_transporte_usd || 0)}`);

    if (esFloristeria || pf) {
      lineas.push(`- **floral_habilitada:** ${pf?.habilitada ? "SI" : "NO"}`);
      lineas.push(`- **floral_max_colores_rosas:** ${pf?.maxColoresRosas ?? 1}`);
      lineas.push(
        `- **floral_colores_rosas:** ${(pf?.coloresRosasDisponibles || []).join(", ")}`
      );
      lineas.push(`- **floral_solo_rosas:** ${pf?.permiteSoloRosas ? "SI" : "NO"}`);
      lineas.push(`- **floral_solo_girasoles:** ${pf?.permiteSoloGirasoles ? "SI" : "NO"}`);
      lineas.push(`- **floral_girasoles_y_rosas:** ${pf?.permiteGirasolesYRosas ? "SI" : "NO"}`);
      lineas.push(`- **floral_orquideas_min:** ${pf?.orquideasMin ?? 0}`);
      lineas.push(`- **floral_orquideas_max:** ${pf?.orquideasMax ?? 0}`);
      lineas.push(`- **floral_tipo_envoltorio:** ${pf?.tipoEnvoltorio ?? "no_aplica"}`);
      lineas.push(
        `- **floral_colores_envoltorio:** ${(pf?.coloresBaseDisponibles || []).join(", ")}`
      );
      lineas.push(
        `- **floral_indicaciones:** ${pf?.permitirIndicacionesAdicionales !== false ? "SI" : "NO"}`
      );
    }

    lineas.push(`- **imagen_url:** ${b.imagenUrl || ""}`);
    lineas.push(`- **album_fotos_url:** ${b.albumFotosUrl || ""}`);
    lineas.push(`- **video_url:** ${b.videoUrl || ""}`);
    lineas.push(`- **galeria_urls:** ${(b.galeriaUrls || []).join(", ")}`);
    lineas.push("");

    lineas.push("### Descripción");
    lineas.push(b.descripcion?.trim() || "");
    lineas.push("");

    lineas.push("### Beneficios");
    if (b.beneficios.length > 0) {
      for (const ben of b.beneficios) {
        lineas.push(`- ${ben}`);
      }
    }
    lineas.push("");

    lineas.push("### Requisitos");
    if (b.requisitos && b.requisitos.length > 0) {
      for (const req of b.requisitos) {
        lineas.push(`- ${req}`);
      }
    }
    lineas.push("");

    lineas.push("### Variantes");
    lineas.push(
      "| var_id | sku | nombre | precio_base | precio_comparacion | iva_pct | activo | envoltorio | portada_url |"
    );
    lineas.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const v of b.variantes) {
      lineas.push(
        `| ${escaparCeldaMd(v.var_id || "")} | ${escaparCeldaMd(v.var_sku)} | ${escaparCeldaMd(
          v.var_nombre
        )} | ${Number(v.var_precio || 0).toFixed(2)} | ${
          v.var_precio_comparacion != null ? Number(v.var_precio_comparacion).toFixed(2) : ""
        } | ${Number(v.var_tarifa_iva_porcentaje || 0)} | ${v.var_activo ? "SI" : "NO"} | ${escaparCeldaMd(
          v.tipo_envoltorio || ""
        )} | ${escaparCeldaMd(v.portada_url || "")} |`
      );
    }
    lineas.push("");
  }

  return lineas.join("\n");
}

/**
 * Construye el libro de Excel unificado (`Catalogo` + `Guia_IA`) para análisis y edición masiva:
 * cada producto aparece como una fila `MASTER` seguida inmediatamente de una fila `VARIANTE`
 * por cada tamaño/opción para comparar fácilmente sus precios, SKU, fotos y envoltorio lado a lado.
 */
export function construirHojasExcelCatalogo(
  productos: ProductoCatalogo[],
  categorias: CategoriaCatalogo[],
  opciones: { negocio: string }
): Array<{ nombre: string; filas: Record<string, unknown>[]; anchosColumnas?: number[] }> {
  const neg = opciones.negocio.toLowerCase();
  const esFloristeria = neg.includes("tinkay") || neg.includes("margarita");
  const filasCatalogo: Record<string, unknown>[] = [];

  for (const p of productos) {
    const b = construirBorradorDesdeProducto(p, { negocio: neg });
    const pf = b.personalizacionFloral;
    const log = b.logistica || {};

    // 1. Fila MASTER del producto
    filasCatalogo.push({
      nivel_fila: "MASTER",
      pro_id: b.pro_id || "",
      var_id: "",
      slug: b.pro_slug || "",
      sku: "",
      nombre: b.nombre,
      categoria: b.categoriaNombre || "",
      tipo: b.tipo,
      activo: b.activo ? "SI" : "NO",
      destacado: b.destacado ? "SI" : "NO",
      tarifa_iva: b.tarifaIvaPredeterminada,
      precio_base: "",
      precio_comparacion: "",
      descripcion: b.descripcion,
      beneficios: b.beneficios.join(" | "),
      requisitos: (b.requisitos || []).join(" | "),
      tiempo_entrega: b.tiempoEntrega || "",
      usos: (b.usos || []).join(", "),
      etiquetas: (b.etiquetas || []).join(", "),
      canales: (b.canalesVisibilidad || []).join(", "),
      vigencia_tipo: b.vigenciaTipo || "SIEMPRE",
      fecha_inicio: b.fechaInicio || "",
      fecha_fin: b.fechaFin || "",
      etiqueta_temporada: b.etiquetaTemporada || "",
      delivery_incluido: log.delivery_incluido ? "SI" : "NO",
      modalidad_transporte: log.modalidad_transporte || "",
      etiqueta_transporte: log.etiqueta_transporte || "",
      cobertura_texto: log.cobertura_texto || "",
      recargo_transporte_usd: Number(log.recargo_transporte_usd || 0),
      floral_habilitada: pf ? (pf.habilitada ? "SI" : "NO") : "",
      floral_max_colores_rosas: pf ? pf.maxColoresRosas : "",
      floral_colores_rosas: pf ? pf.coloresRosasDisponibles.join(", ") : "",
      floral_solo_rosas: pf ? (pf.permiteSoloRosas ? "SI" : "NO") : "",
      floral_solo_girasoles: pf ? (pf.permiteSoloGirasoles ? "SI" : "NO") : "",
      floral_girasoles_y_rosas: pf ? (pf.permiteGirasolesYRosas ? "SI" : "NO") : "",
      floral_orquideas_min: pf ? pf.orquideasMin : "",
      floral_orquideas_max: pf ? pf.orquideasMax : "",
      floral_tipo_envoltorio: pf ? pf.tipoEnvoltorio : "",
      floral_colores_envoltorio: pf ? pf.coloresBaseDisponibles.join(", ") : "",
      floral_indicaciones: pf ? (pf.permitirIndicacionesAdicionales ? "SI" : "NO") : "",
      imagen_url: b.imagenUrl || "",
      album_fotos_url: b.albumFotosUrl || "",
      video_url: b.videoUrl || "",
      galeria_urls: (b.galeriaUrls || []).join(", "),
    });

    // 2. Una fila VARIANTE por cada variante/tamaño justo debajo del MASTER
    const variantesRaw = Array.isArray(p.variantes) ? p.variantes : [];
    for (let i = 0; i < b.variantes.length; i += 1) {
      const v = b.variantes[i]!;
      const vRaw = variantesRaw[i];
      const vdet = (vRaw?.var_detalle_variante && typeof vRaw.var_detalle_variante === "object"
        ? vRaw.var_detalle_variante
        : {}) as Record<string, any>;
      const persVar = esFloristeria
        ? resolverPersonalizacionFloralEfectiva({
            configMaster: pf,
            configVariante: vdet.personalizacion_floral,
            modoVariante: vdet.personalizacion_floral_modo,
            habilitadaPorDefecto: esFloristeria,
            tipoEnvoltorioPorDefecto: pf?.tipoEnvoltorio,
          })
        : null;
      const galVar = Array.isArray(vdet.galeria_urls) ? vdet.galeria_urls.filter(Boolean) : [];
      const benVar =
        (vdet.beneficios_modo === "reemplazar" || vdet.beneficios_modo === "anexar") &&
        Array.isArray(vdet.beneficios_custom)
          ? vdet.beneficios_custom.filter(Boolean).join(" | ")
          : "";
      const usosVar =
        vdet.usos_modo === "personalizado" && Array.isArray(vdet.usos)
          ? vdet.usos.filter(Boolean).join(", ")
          : "";

      filasCatalogo.push({
        nivel_fila: "VARIANTE",
        pro_id: b.pro_id || "",
        var_id: v.var_id || "",
        slug: b.pro_slug || "",
        sku: v.var_sku,
        nombre: v.var_nombre,
        categoria: b.categoriaNombre || "",
        tipo: "",
        activo: v.var_activo ? "SI" : "NO",
        destacado: "",
        tarifa_iva: v.var_tarifa_iva_porcentaje,
        precio_base: Number(v.var_precio.toFixed(2)),
        precio_comparacion:
          v.var_precio_comparacion != null ? Number(v.var_precio_comparacion.toFixed(2)) : "",
        descripcion: "",
        beneficios: benVar,
        requisitos: "",
        tiempo_entrega: vdet.tiempo_entrega ? String(vdet.tiempo_entrega) : "",
        usos: usosVar,
        etiquetas: "",
        canales: "",
        vigencia_tipo: "",
        fecha_inicio: "",
        fecha_fin: "",
        etiqueta_temporada: "",
        delivery_incluido: "",
        modalidad_transporte: "",
        etiqueta_transporte: "",
        cobertura_texto: "",
        recargo_transporte_usd: "",
        floral_habilitada: "",
        floral_max_colores_rosas: persVar ? persVar.maxColoresRosas : "",
        floral_colores_rosas: "",
        floral_solo_rosas: "",
        floral_solo_girasoles: "",
        floral_girasoles_y_rosas: "",
        floral_orquideas_min: "",
        floral_orquideas_max: "",
        floral_tipo_envoltorio: v.tipo_envoltorio || "",
        floral_colores_envoltorio: persVar ? persVar.coloresBaseDisponibles.join(", ") : "",
        floral_indicaciones: "",
        imagen_url: v.portada_url || "",
        album_fotos_url: vdet.album_url ? String(vdet.album_url) : "",
        video_url: "",
        galeria_urls: galVar.join(", "),
      });
    }
  }

  const filasGuia: Record<string, unknown>[] = [
    {
      Seccion: "Estructura (nivel_fila)",
      Instruccion:
        "Cada producto tiene una fila `MASTER` (datos generales del producto) seguida inmediatamente de una fila `VARIANTE` por cada tamaño/opción para compararlos lado a lado.",
    },
    {
      Seccion: "Identificación",
      Instruccion:
        "No borres ni alteres las columnas `nivel_fila`, `pro_id` ni `var_id`. Sirven para emparejar cada producto Master y sus variantes al re-importar.",
    },
    {
      Seccion: "Filas MASTER",
      Instruccion:
        "Edita nombre, categoria, descripcion, beneficios (separados por ` | ` o salto de línea), tiempo_entrega, usos, etiquetas, canales, logística, multimedia y personalización floral.",
    },
    {
      Seccion: "Filas VARIANTE",
      Instruccion:
        "Edita `nombre` (tamaño), `sku`, `precio_base`, `precio_comparacion`, `tarifa_iva` (0 o 15), `activo` (`SI`/`NO`), `floral_tipo_envoltorio` (`base` | `papel_envoltorio` | `no_aplica`), `tiempo_entrega` (vacío = hereda del Master), `imagen_url` (portada variante) y `album_fotos_url`.",
    },
    {
      Seccion: "Categorías válidas",
      Instruccion: categorias.map((c) => c.ctg_nombre).join(" | ") || "(Sin categorías)",
    },
    {
      Seccion: "Canales válidos",
      Instruccion: CANALES_CATALOGO_OFICIALES.map((c) => c.clave).join(", "),
    },
  ];

  return [
    {
      nombre: "Catalogo",
      filas: filasCatalogo,
      anchosColumnas: [
        11, 36, 36, 24, 18, 30, 22, 11, 8, 10, 10, 13, 15, 48, 46, 28, 28, 26, 26, 32, 14, 12, 12,
        18, 12, 18, 28, 24, 12, 10, 10, 22, 10, 10, 10, 10, 10, 16, 20, 10, 36, 28, 28, 36,
      ],
    },
    {
      nombre: "Guia_IA",
      filas: filasGuia,
      anchosColumnas: [24, 98],
    },
  ];
}

function asignarCampoProductoImportado(
  target: ProductoImportadoMasivo,
  claveRaw: string,
  valorRaw: unknown
): void {
  const k = normalizarClave(claveRaw);
  const str = typeof valorRaw === "string" ? limpiarValorMd(valorRaw) : String(valorRaw ?? "").trim();

  switch (k) {
    case "pro_id":
    case "id":
    case "producto_id":
      if (str) target.pro_id = str;
      break;
    case "slug":
    case "pro_slug":
      if (str) target.slug = str;
      break;
    case "nombre":
    case "pro_nombre":
    case "producto":
    case "titulo":
      if (str) target.nombre = str;
      break;
    case "categoria":
    case "coleccion":
    case "categoria_nombre":
    case "coleccion_categoria":
      if (str) target.categoria = str;
      break;
    case "tipo":
    case "pro_tipo":
    case "tipo_oferta":
      if (str) target.tipo = str.toUpperCase();
      break;
    case "activo":
    case "pro_activo":
    case "estado": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.activo = b;
      break;
    }
    case "destacado":
    case "pro_destacado": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.destacado = b;
      break;
    }
    case "tarifa_iva":
    case "iva":
    case "iva_pct":
    case "tarifa_iva_predeterminada": {
      const n = parsearNumeroFlexible(valorRaw);
      if (n !== undefined) target.tarifa_iva = n > 0 ? 15 : 0;
      break;
    }
    case "descripcion":
    case "pro_descripcion":
    case "descripcion_detallada":
      target.descripcion = str;
      break;
    case "beneficios":
    case "que_incluye":
      target.beneficios = parsearListaTexto(valorRaw, true);
      break;
    case "requisitos":
    case "condiciones":
      target.requisitos = parsearListaTexto(valorRaw, true);
      break;
    case "tiempo_entrega":
    case "promesa_entrega":
      target.tiempo_entrega = str;
      break;
    case "canales":
    case "canales_visibilidad":
      target.canales = parsearCanalesFlexible(valorRaw);
      break;
    case "usos":
    case "ocasiones":
    case "ocasiones_usos":
      target.usos = parsearListaTexto(valorRaw);
      break;
    case "etiquetas":
    case "tags":
      target.etiquetas = parsearListaTexto(valorRaw);
      break;
    case "vigencia_tipo":
    case "vigencia": {
      const up = str.toUpperCase();
      if (up === "SIEMPRE" || up === "RANGO_FECHAS" || up === "ESTACIONAL_ANUAL") {
        target.vigencia_tipo = up;
      }
      break;
    }
    case "fecha_inicio":
      target.fecha_inicio = str || null;
      break;
    case "fecha_fin":
      target.fecha_fin = str || null;
      break;
    case "etiqueta_temporada":
      target.etiqueta_temporada = str || null;
      break;
    case "delivery_incluido": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.delivery_incluido = b;
      break;
    }
    case "modalidad_transporte":
      if (str) target.modalidad_transporte = str;
      break;
    case "etiqueta_transporte":
      target.etiqueta_transporte = str;
      break;
    case "cobertura_texto":
    case "cobertura":
      target.cobertura_texto = str;
      break;
    case "recargo_transporte_usd": {
      const n = parsearNumeroFlexible(valorRaw);
      if (n !== undefined && n >= 0) target.recargo_transporte_usd = n;
      break;
    }
    case "floral_habilitada": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.floral_habilitada = b;
      break;
    }
    case "floral_max_colores_rosas": {
      const n = parsearNumeroFlexible(valorRaw);
      if (n !== undefined) target.floral_max_colores_rosas = Math.max(0, Math.min(12, Math.round(n)));
      break;
    }
    case "floral_colores_rosas":
      target.floral_colores_rosas = parsearListaTexto(valorRaw).map((c) => c.toLowerCase());
      break;
    case "floral_solo_rosas": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.floral_solo_rosas = b;
      break;
    }
    case "floral_solo_girasoles": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.floral_solo_girasoles = b;
      break;
    }
    case "floral_girasoles_y_rosas": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.floral_girasoles_y_rosas = b;
      break;
    }
    case "floral_orquideas_min": {
      const n = parsearNumeroFlexible(valorRaw);
      if (n !== undefined) target.floral_orquideas_min = Math.max(0, Math.min(50, Math.round(n)));
      break;
    }
    case "floral_orquideas_max": {
      const n = parsearNumeroFlexible(valorRaw);
      if (n !== undefined) target.floral_orquideas_max = Math.max(0, Math.min(50, Math.round(n)));
      break;
    }
    case "floral_tipo_envoltorio":
    case "tipo_envoltorio": {
      const t = parsearTipoEnvoltorioFlexible(valorRaw);
      if (t) target.floral_tipo_envoltorio = t;
      break;
    }
    case "floral_colores_envoltorio": {
      const lista = parsearListaTexto(valorRaw).map((c) => c.toLowerCase()) as ColorBasePapelId[];
      target.floral_colores_envoltorio = lista;
      break;
    }
    case "floral_indicaciones": {
      const b = parsearBooleanoFlexible(valorRaw);
      if (b !== undefined) target.floral_indicaciones = b;
      break;
    }
    case "imagen_url":
    case "portada":
    case "portada_url":
      target.imagen_url = str || null;
      break;
    case "album_fotos_url":
      target.album_fotos_url = str || null;
      break;
    case "video_url":
      target.video_url = str || null;
      break;
    case "galeria_urls":
      target.galeria_urls = parsearListaTexto(valorRaw);
      break;
    case "precio_principal_base":
    case "precio_base":
    case "precio": {
      const n = parsearNumeroFlexible(valorRaw);
      if (n !== undefined && n > 0) target.precio_principal_base = Number(n.toFixed(4));
      break;
    }
    case "precio_principal_comparacion":
    case "precio_comparacion":
    case "precio_antes": {
      if (!str) {
        target.precio_principal_comparacion = null;
      } else {
        const n = parsearNumeroFlexible(valorRaw);
        if (n !== undefined) target.precio_principal_comparacion = n > 0 ? Number(n.toFixed(4)) : null;
      }
      break;
    }
    case "sku_principal":
    case "sku":
      if (str) target.sku_principal = str;
      break;
    default:
      break;
  }
}

function dividirFilaTablaMd(linea: string): string[] {
  const sinBordes = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
  const celdas: string[] = [];
  let actual = "";
  for (let i = 0; i < sinBordes.length; i += 1) {
    const ch = sinBordes[i];
    if (ch === "\\" && sinBordes[i + 1] === "|") {
      actual += "|";
      i += 1;
    } else if (ch === "|") {
      celdas.push(desescaparCeldaMd(actual));
      actual = "";
    } else {
      actual += ch;
    }
  }
  celdas.push(desescaparCeldaMd(actual));
  return celdas;
}

/**
 * Parsea un documento Markdown exportado (y opcionalmente editado por una IA o manualmente)
 * en registros estructurados de productos y variantes.
 */
export function parsearCatalogoDesdeMarkdown(
  contenidoMd: string
): ResultadoParseoCatalogoMasivo {
  const advertencias: string[] = [];
  const productos: ProductoImportadoMasivo[] = [];
  const lineas = String(contenidoMd || "").split(/\r?\n/);

  let actual: ProductoImportadoMasivo | null = null;
  let seccion: "meta" | "descripcion" | "beneficios" | "requisitos" | "variantes" = "meta";
  let bufferDescripcion: string[] = [];
  let tablaHeaders: string[] | null = null;

  const cerrarProductoActual = () => {
    if (!actual) return;
    if (bufferDescripcion.length > 0 || actual.descripcion !== undefined) {
      const descUnida = bufferDescripcion.join("\n").trim();
      if (descUnida || actual.descripcion === undefined) {
        actual.descripcion = descUnida;
      }
    }
    if (actual.pro_id || actual.slug || actual.nombre) {
      productos.push(actual);
    }
    actual = null;
    seccion = "meta";
    bufferDescripcion = [];
    tablaHeaders = null;
  };

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i] ?? "";
    const trimmed = linea.trim();

    // Inicio de bloque de producto (`## PRODUCTO: ...` o cualquier `## ...` que no sea metadato)
    const matchH2 = trimmed.match(/^##\s+(?:PRODUCTO\s*:\s*)?(.+)$/i);
    if (matchH2) {
      const tituloH2 = (matchH2[1] || "").trim();
      if (/^(PRODUCTO\s*:)/i.test(trimmed.slice(3)) || !/^\d+\.\s+/.test(tituloH2)) {
        cerrarProductoActual();
        actual = {
          origenIndice: productos.length + 1,
          nombre: tituloH2 || undefined,
        };
        seccion = "meta";
        continue;
      }
    }

    if (!actual) continue;

    // Subsecciones `### ...`
    const matchH3 = trimmed.match(/^###\s+(.+)$/);
    if (matchH3) {
      const secNorm = normalizarTextoComparacion(matchH3[1] || "");
      tablaHeaders = null;
      if (secNorm.startsWith("descrip")) {
        seccion = "descripcion";
        bufferDescripcion = [];
      } else if (secNorm.startsWith("beneficio") || secNorm.includes("incluye")) {
        seccion = "beneficios";
        actual.beneficios = [];
      } else if (secNorm.startsWith("requisito") || secNorm.startsWith("condicion")) {
        seccion = "requisitos";
        actual.requisitos = [];
      } else if (secNorm.startsWith("variante") || secNorm.startsWith("tamano")) {
        seccion = "variantes";
        actual.variantes = [];
      } else {
        seccion = "meta";
      }
      continue;
    }

    if (trimmed === "---") {
      continue;
    }

    if (seccion === "meta") {
      // Acepta `- **clave:** valor`, `- clave: valor` o `**clave:** valor`
      const matchKv = trimmed.match(/^(?:[-*•]\s*)?(?:\*\*)?([a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ\s/]+?)(?:\*\*)?\s*:\s*(?:\*\*)?(.*)$/);
      if (matchKv) {
        const clave = matchKv[1] || "";
        const valor = matchKv[2] || "";
        asignarCampoProductoImportado(actual, clave, valor);
      }
      continue;
    }

    if (seccion === "descripcion") {
      bufferDescripcion.push(linea);
      continue;
    }

    if (seccion === "beneficios") {
      if (!trimmed) continue;
      const item = trimmed.replace(/^[-*•]\s*/, "").trim();
      if (item && item.toLowerCase() !== "(sin beneficios)") {
        actual.beneficios = actual.beneficios ?? [];
        actual.beneficios.push(item);
      }
      continue;
    }

    if (seccion === "requisitos") {
      if (!trimmed) continue;
      const item = trimmed.replace(/^[-*•]\s*/, "").trim();
      if (item && item.toLowerCase() !== "(vacío si no tiene)" && item.toLowerCase() !== "(ninguno)") {
        actual.requisitos = actual.requisitos ?? [];
        actual.requisitos.push(item);
      }
      continue;
    }

    if (seccion === "variantes") {
      if (!trimmed.startsWith("|")) continue;
      const celdas = dividirFilaTablaMd(trimmed);
      if (celdas.every((c) => /^:?-+:?$/.test(c.replace(/\s+/g, "")))) {
        continue; // línea separadora | --- | --- |
      }
      if (!tablaHeaders) {
        tablaHeaders = celdas.map((h) => normalizarClave(h));
        continue;
      }

      const varItem: VarianteImportadaMasiva = {};
      tablaHeaders.forEach((h, idx) => {
        const val = limpiarValorMd(celdas[idx] ?? "");
        switch (h) {
          case "var_id":
          case "id":
            if (val) varItem.var_id = val;
            break;
          case "sku":
          case "var_sku":
            if (val) varItem.var_sku = val;
            break;
          case "nombre":
          case "var_nombre":
          case "tamano":
            if (val) varItem.var_nombre = val;
            break;
          case "precio_base":
          case "precio":
          case "var_precio": {
            const n = parsearNumeroFlexible(val);
            if (n !== undefined && n > 0) varItem.var_precio = Number(n.toFixed(4));
            break;
          }
          case "precio_comparacion":
          case "var_precio_comparacion":
          case "antes": {
            if (!val) {
              varItem.var_precio_comparacion = null;
            } else {
              const n = parsearNumeroFlexible(val);
              if (n !== undefined) {
                varItem.var_precio_comparacion = n > 0 ? Number(n.toFixed(4)) : null;
              }
            }
            break;
          }
          case "iva_pct":
          case "iva":
          case "var_tarifa_iva_porcentaje": {
            const n = parsearNumeroFlexible(val);
            if (n !== undefined) varItem.var_tarifa_iva_porcentaje = n > 0 ? 15 : 0;
            break;
          }
          case "activo":
          case "var_activo": {
            const b = parsearBooleanoFlexible(val);
            if (b !== undefined) varItem.var_activo = b;
            break;
          }
          case "envoltorio":
          case "var_tipo_envoltorio":
          case "tipo_envoltorio": {
            const t = parsearTipoEnvoltorioFlexible(val);
            if (t) varItem.tipo_envoltorio = t;
            break;
          }
          case "portada_url":
          case "var_portada_url":
            varItem.portada_url = val || null;
            break;
          default:
            break;
        }
      });

      if (varItem.var_id || varItem.var_sku || varItem.var_nombre) {
        actual.variantes = actual.variantes ?? [];
        actual.variantes.push(varItem);
      }
    }
  }

  cerrarProductoActual();

  if (productos.length === 0) {
    advertencias.push(
      "No se detectaron bloques `## PRODUCTO: ...` en el Markdown. Verifica que el archivo conserve los encabezados del formato exportado."
    );
  }

  return {
    formato: "markdown",
    productos,
    advertencias,
  };
}

function extraerVarianteDesdeFilaExcel(fila: Record<string, unknown>): {
  proIdRef: string;
  slugRef: string;
  prodNombreRef: string;
  variante: VarianteImportadaMasiva;
} {
  let proIdRef = "";
  let slugRef = "";
  let prodNombreRef = "";
  const vItem: VarianteImportadaMasiva = {};

  for (const [col, val] of Object.entries(fila)) {
    const k = normalizarClave(col);
    const s = String(val ?? "").trim();
    switch (k) {
      case "pro_id":
      case "producto_id":
        proIdRef = s;
        break;
      case "slug":
      case "pro_slug":
        slugRef = s;
        break;
      case "producto_nombre":
        prodNombreRef = s;
        break;
      case "var_id":
      case "id":
        if (s) vItem.var_id = s;
        break;
      case "var_sku":
      case "sku":
        if (s) vItem.var_sku = s;
        break;
      case "var_nombre":
      case "nombre":
      case "tamano":
        if (s) vItem.var_nombre = s;
        break;
      case "var_precio":
      case "precio":
      case "precio_base": {
        const n = parsearNumeroFlexible(val);
        if (n !== undefined && n > 0) vItem.var_precio = Number(n.toFixed(4));
        break;
      }
      case "var_precio_comparacion":
      case "precio_comparacion":
      case "antes": {
        if (!s) {
          vItem.var_precio_comparacion = null;
        } else {
          const n = parsearNumeroFlexible(val);
          if (n !== undefined) {
            vItem.var_precio_comparacion = n > 0 ? Number(n.toFixed(4)) : null;
          }
        }
        break;
      }
      case "var_tarifa_iva_porcentaje":
      case "tarifa_iva":
      case "iva_pct":
      case "iva": {
        const n = parsearNumeroFlexible(val);
        if (n !== undefined) vItem.var_tarifa_iva_porcentaje = n > 0 ? 15 : 0;
        break;
      }
      case "var_activo":
      case "activo": {
        const b = parsearBooleanoFlexible(val);
        if (b !== undefined) vItem.var_activo = b;
        break;
      }
      case "var_tipo_envoltorio":
      case "floral_tipo_envoltorio":
      case "tipo_envoltorio":
      case "envoltorio": {
        const t = parsearTipoEnvoltorioFlexible(val);
        if (t) vItem.tipo_envoltorio = t;
        break;
      }
      case "var_portada_url":
      case "portada_url":
      case "imagen_url":
        vItem.portada_url = s || null;
        break;
      case "album_fotos_url":
      case "album_url":
        vItem.album_url = s || null;
        break;
      case "tiempo_entrega":
      case "promesa_entrega":
        vItem.tiempo_entrega = s || null;
        break;
      case "galeria_urls":
        vItem.galeria_urls = parsearListaTexto(val);
        break;
      default:
        break;
    }
  }

  return { proIdRef, slugRef, prodNombreRef, variante: vItem };
}

/**
 * Parsea hojas de un libro Excel (.xlsx / .xls / .csv) exportado en registros estructurados.
 * Soporta tanto la hoja unificada `Catalogo` (con columna `nivel_fila = MASTER | VARIANTE`)
 * como el formato anterior de 2 hojas (`Productos` + `Variantes`).
 */
export function parsearCatalogoDesdeHojasExcel(
  hojas: Record<string, Record<string, unknown>[]>
): ResultadoParseoCatalogoMasivo {
  const advertencias: string[] = [];
  const nombresHojas = Object.keys(hojas);

  const nombreHojaPrincipal =
    nombresHojas.find((n) => normalizarClave(n).includes("catalogo")) ||
    nombresHojas.find((n) => normalizarClave(n).includes("producto")) ||
    nombresHojas.find(
      (n) => !normalizarClave(n).includes("guia") && !normalizarClave(n).includes("variante")
    ) ||
    nombresHojas[0];

  const nombreHojaVar = nombresHojas.find((n) => normalizarClave(n).includes("variante"));

  const filasPrincipal = nombreHojaPrincipal ? hojas[nombreHojaPrincipal] || [] : [];
  const filasVarSeparadas = nombreHojaVar ? hojas[nombreHojaVar] || [] : [];

  const productos: ProductoImportadoMasivo[] = [];
  const mapaPorProId = new Map<string, ProductoImportadoMasivo>();
  const mapaPorSlug = new Map<string, ProductoImportadoMasivo>();
  const mapaPorNombre = new Map<string, ProductoImportadoMasivo>();

  let ultimoMasterVisto: ProductoImportadoMasivo | null = null;

  filasPrincipal.forEach((fila, idx) => {
    // Detectar si esta fila corresponde al nivel VARIANTE en la hoja unificada
    let nivelRaw = "";
    let tieneVarId = false;
    for (const [col, val] of Object.entries(fila)) {
      const k = normalizarClave(col);
      if (k === "nivel_fila" || k === "nivel" || k === "tipo_fila") {
        nivelRaw = normalizarTextoComparacion(String(val ?? ""));
      } else if (k === "var_id" && String(val ?? "").trim()) {
        tieneVarId = true;
      }
    }

    const esFilaVariante =
      nivelRaw === "variante" ||
      nivelRaw === "var" ||
      nivelRaw === "tamano" ||
      (!nivelRaw && tieneVarId);

    if (esFilaVariante) {
      const { proIdRef, slugRef, prodNombreRef, variante } = extraerVarianteDesdeFilaExcel(fila);
      if (!variante.var_id && !variante.var_sku && !variante.var_nombre) return;

      let padre =
        (proIdRef && mapaPorProId.get(proIdRef)) ||
        (slugRef && mapaPorSlug.get(slugRef.toLowerCase())) ||
        (prodNombreRef && mapaPorNombre.get(normalizarTextoComparacion(prodNombreRef))) ||
        ultimoMasterVisto;

      // Si el usuario solo dejó filas VARIANTE (sin fila MASTER), crear contenedor parcial por pro_id
      if (!padre && (proIdRef || slugRef)) {
        padre = {
          origenIndice: idx + 1,
          pro_id: proIdRef || undefined,
          slug: slugRef || undefined,
          variantes: [],
        };
        productos.push(padre);
        if (padre.pro_id) mapaPorProId.set(padre.pro_id, padre);
        if (padre.slug) mapaPorSlug.set(padre.slug.toLowerCase(), padre);
      }

      if (padre) {
        padre.variantes = padre.variantes ?? [];
        padre.variantes.push(variante);
      }
      return;
    }

    // Fila MASTER (o fila de producto en formato clásico)
    const prod: ProductoImportadoMasivo = { origenIndice: idx + 1 };
    for (const [col, val] of Object.entries(fila)) {
      asignarCampoProductoImportado(prod, col, val);
    }
    if (prod.pro_id || prod.slug || prod.nombre || prod.sku_principal) {
      productos.push(prod);
      ultimoMasterVisto = prod;
      if (prod.pro_id) mapaPorProId.set(prod.pro_id.trim(), prod);
      if (prod.slug) mapaPorSlug.set(prod.slug.trim().toLowerCase(), prod);
      if (prod.nombre) mapaPorNombre.set(normalizarTextoComparacion(prod.nombre), prod);
    }
  });

  // Retrocompatibilidad: adjuntar filas de hoja `Variantes` separada si existe
  filasVarSeparadas.forEach((fila) => {
    const { proIdRef, slugRef, prodNombreRef, variante } = extraerVarianteDesdeFilaExcel(fila);
    const padre =
      (proIdRef && mapaPorProId.get(proIdRef)) ||
      (slugRef && mapaPorSlug.get(slugRef.toLowerCase())) ||
      (prodNombreRef && mapaPorNombre.get(normalizarTextoComparacion(prodNombreRef))) ||
      null;

    if (padre && (variante.var_id || variante.var_sku || variante.var_nombre)) {
      padre.variantes = padre.variantes ?? [];
      padre.variantes.push(variante);
    }
  });

  if (productos.length === 0) {
    advertencias.push(
      "No se encontraron filas válidas de productos en el archivo Excel. Asegúrate de incluir columnas como `pro_id`, `nombre` o `slug`."
    );
  }

  return {
    formato: "excel",
    productos,
    advertencias,
  };
}

function resumirValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vacío)";
  if (typeof v === "boolean") return v ? "SÍ" : "NO";
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "(vacío)";
  const s = String(v).trim();
  return s.length > 90 ? `${s.slice(0, 87)}…` : s;
}

function listasIguales(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, idx) => v.trim() === (b[idx] ?? "").trim());
}

/**
 * Compara los productos importados (desde MD o Excel) contra el catálogo actual y genera
 * un plan seguro de actualización masiva con el diff campo por campo de cada producto.
 */
export function calcularPlanActualizacionMasiva(
  productosActuales: ProductoCatalogo[],
  categoriasActuales: CategoriaCatalogo[],
  parseado: ResultadoParseoCatalogoMasivo,
  opciones: { negocio: string }
): PlanActualizacionMasiva {
  const neg = opciones.negocio.toLowerCase();
  const esFloristeria = neg.includes("tinkay") || neg.includes("margarita");

  const porId = new Map<string, ProductoCatalogo>();
  const porSlug = new Map<string, ProductoCatalogo>();
  const porSku = new Map<string, ProductoCatalogo>();
  const porNombre = new Map<string, ProductoCatalogo>();

  for (const p of productosActuales) {
    porId.set(p.pro_id, p);
    if (p.pro_slug) porSlug.set(p.pro_slug.toLowerCase(), p);
    porNombre.set(normalizarTextoComparacion(p.pro_nombre), p);
    for (const v of p.variantes || []) {
      if (v.var_sku) porSku.set(v.var_sku.trim().toLowerCase(), p);
    }
  }

  const buscarCategoria = (ref: string): CategoriaCatalogo | null => {
    const limpio = ref.trim();
    if (!limpio) return null;
    const norm = normalizarTextoComparacion(limpio);
    return (
      categoriasActuales.find((c) => c.ctg_id === limpio) ||
      categoriasActuales.find((c) => normalizarTextoComparacion(c.ctg_slug) === norm) ||
      categoriasActuales.find((c) => normalizarTextoComparacion(c.ctg_nombre) === norm) ||
      null
    );
  };

  const items: ItemPlanActualizacionMasiva[] = [];
  const vistos = new Set<string>();

  for (const imp of parseado.productos) {
    const prod =
      (imp.pro_id && porId.get(imp.pro_id.trim())) ||
      (imp.slug && porSlug.get(imp.slug.trim().toLowerCase())) ||
      (imp.sku_principal && porSku.get(imp.sku_principal.trim().toLowerCase())) ||
      (imp.nombre && porNombre.get(normalizarTextoComparacion(imp.nombre))) ||
      null;

    if (!prod) {
      items.push({
        clave: `missing-${imp.origenIndice}`,
        pro_id: imp.pro_id || null,
        nombreActual: "(No existe en el catálogo)",
        nombreImportado: imp.nombre || imp.slug || imp.pro_id || `Fila #${imp.origenIndice}`,
        estado: "NO_ENCONTRADO",
        cambios: [],
        advertencias: [
          "No se encontró coincidencia por pro_id, slug, SKU ni nombre. Este registro se omitirá.",
        ],
      });
      continue;
    }

    if (vistos.has(prod.pro_id)) {
      items.push({
        clave: `dup-${prod.pro_id}-${imp.origenIndice}`,
        pro_id: prod.pro_id,
        nombreActual: prod.pro_nombre,
        nombreImportado: imp.nombre || prod.pro_nombre,
        estado: "ERROR",
        cambios: [],
        advertencias: ["Producto repetido en el archivo importado; solo se procesa la primera aparición."],
      });
      continue;
    }
    vistos.add(prod.pro_id);

    const det = obtenerDetalleProducto(prod);
    const cambios: CambioCampoCatalogo[] = [];
    const advertenciasItem: string[] = [];

    // 1. Nombre
    const nombreFinal = imp.nombre?.trim() ? imp.nombre.trim() : prod.pro_nombre;
    if (nombreFinal !== prod.pro_nombre) {
      cambios.push({
        campo: "nombre",
        etiqueta: "Nombre",
        antes: prod.pro_nombre,
        despues: nombreFinal,
      });
    }

    // 2. Categoría
    let categoriaIdFinal = prod.pro_categoria_principal_id || undefined;
    const catActualNombre = prod.categoria?.ctg_nombre || "";
    if (imp.categoria !== undefined && imp.categoria.trim()) {
      const catMatch = buscarCategoria(imp.categoria);
      if (catMatch) {
        if (catMatch.ctg_id !== prod.pro_categoria_principal_id) {
          categoriaIdFinal = catMatch.ctg_id;
          cambios.push({
            campo: "categoria",
            etiqueta: "Categoría / Colección",
            antes: catActualNombre || "(Sin categoría)",
            despues: catMatch.ctg_nombre,
          });
        }
      } else if (normalizarTextoComparacion(imp.categoria) !== normalizarTextoComparacion(catActualNombre)) {
        advertenciasItem.push(
          `Categoría "${imp.categoria}" no existe en el catálogo; se mantendrá "${catActualNombre || "actual"}".`
        );
      }
    }

    // 3. Tipo
    const tipoFinal = imp.tipo?.trim() ? imp.tipo.trim().toUpperCase() : prod.pro_tipo;
    if (tipoFinal !== prod.pro_tipo) {
      cambios.push({
        campo: "tipo",
        etiqueta: "Tipo de Oferta",
        antes: prod.pro_tipo,
        despues: tipoFinal,
      });
    }

    // 4. Activo y Destacado
    const activoActual = prod.pro_activo !== false && det.pro_activo !== false;
    const activoFinal = imp.activo !== undefined ? imp.activo : activoActual;
    if (activoFinal !== activoActual) {
      cambios.push({
        campo: "activo",
        etiqueta: "Estado",
        antes: activoActual ? "ACTIVO" : "INACTIVO",
        despues: activoFinal ? "ACTIVO" : "INACTIVO",
      });
    }

    const destacadoActual = Boolean(prod.pro_destacado);
    const destacadoFinal = imp.destacado !== undefined ? imp.destacado : destacadoActual;
    if (destacadoFinal !== destacadoActual) {
      cambios.push({
        campo: "destacado",
        etiqueta: "Destacado",
        antes: destacadoActual ? "SÍ" : "NO",
        despues: destacadoFinal ? "SÍ" : "NO",
      });
    }

    // 5. Tarifa IVA predeterminada
    const ivaActual =
      det.tarifa_iva_predeterminada !== undefined && det.tarifa_iva_predeterminada !== null
        ? Number(det.tarifa_iva_predeterminada)
        : prod.variantes?.[0]?.var_tarifa_iva_porcentaje ?? (esFloristeria ? 0 : 15);
    const ivaFinal = imp.tarifa_iva !== undefined ? imp.tarifa_iva : ivaActual;
    if (ivaFinal !== ivaActual) {
      cambios.push({
        campo: "tarifa_iva",
        etiqueta: "IVA %",
        antes: `${ivaActual}%`,
        despues: `${ivaFinal}%`,
      });
    }

    // 6. Descripción
    const descActual = (prod.pro_descripcion || "").trim();
    const descFinal = imp.descripcion !== undefined ? imp.descripcion.trim() : descActual;
    if (descFinal !== descActual) {
      cambios.push({
        campo: "descripcion",
        etiqueta: "Descripción",
        antes: resumirValor(descActual),
        despues: resumirValor(descFinal),
      });
    }

    // 7. Beneficios y Requisitos
    const benActual: string[] = Array.isArray(det.beneficios) ? det.beneficios.filter(Boolean) : [];
    const benFinal = imp.beneficios !== undefined ? imp.beneficios : benActual;
    if (!listasIguales(benActual, benFinal)) {
      cambios.push({
        campo: "beneficios",
        etiqueta: "Beneficios / ¿Qué incluye?",
        antes: `${benActual.length} ítem(s)`,
        despues: `${benFinal.length} ítem(s): ${resumirValor(benFinal.join(" | "))}`,
      });
    }

    const reqActual: string[] = Array.isArray(det.requisitos) ? det.requisitos.filter(Boolean) : [];
    const reqFinal = imp.requisitos !== undefined ? imp.requisitos : reqActual;
    if (!listasIguales(reqActual, reqFinal)) {
      cambios.push({
        campo: "requisitos",
        etiqueta: "Requisitos",
        antes: resumirValor(reqActual),
        despues: resumirValor(reqFinal),
      });
    }

    // 8. Tiempo de entrega
    const entregaActual = String(det.tiempo_entrega || "").trim();
    const entregaFinal =
      imp.tiempo_entrega !== undefined ? imp.tiempo_entrega.trim() : entregaActual;
    if (entregaFinal !== entregaActual) {
      cambios.push({
        campo: "tiempo_entrega",
        etiqueta: "Promesa de Entrega",
        antes: resumirValor(entregaActual),
        despues: resumirValor(entregaFinal),
      });
    }

    // 9. Usos, Etiquetas y Canales
    const usosActual: string[] = Array.isArray(det.usos)
      ? det.usos.filter(Boolean)
      : Array.isArray(det.ocasiones)
        ? det.ocasiones.filter(Boolean)
        : [];
    const usosFinal = imp.usos !== undefined ? imp.usos : usosActual;
    if (!listasIguales(usosActual, usosFinal)) {
      cambios.push({
        campo: "usos",
        etiqueta: "Ocasiones / Usos",
        antes: resumirValor(usosActual),
        despues: resumirValor(usosFinal),
      });
    }

    const tagsActual: string[] = Array.isArray(det.etiquetas) ? det.etiquetas.filter(Boolean) : [];
    const tagsFinal = imp.etiquetas !== undefined ? imp.etiquetas : tagsActual;
    if (!listasIguales(tagsActual, tagsFinal)) {
      cambios.push({
        campo: "etiquetas",
        etiqueta: "Etiquetas",
        antes: resumirValor(tagsActual),
        despues: resumirValor(tagsFinal),
      });
    }

    const canalesActual: CanalVisibilidad[] =
      Array.isArray(prod.canales_visibilidad) && prod.canales_visibilidad.length > 0
        ? prod.canales_visibilidad
        : Array.isArray(det.canales_visibilidad)
          ? det.canales_visibilidad
          : [...CANALES_POR_DEFECTO];
    const canalesFinal =
      imp.canales !== undefined && imp.canales.length > 0 ? imp.canales : canalesActual;
    if (!listasIguales([...canalesActual].sort(), [...canalesFinal].sort())) {
      cambios.push({
        campo: "canales",
        etiqueta: "Canales",
        antes: canalesActual.join(", "),
        despues: canalesFinal.join(", "),
      });
    }

    // 10. Vigencia
    const vigActual = (det.vigencia_tipo || "SIEMPRE") as
      | "SIEMPRE"
      | "RANGO_FECHAS"
      | "ESTACIONAL_ANUAL";
    const vigFinal = imp.vigencia_tipo ?? vigActual;
    const fIniActual = String(det.fecha_inicio || "");
    const fIniFinal = imp.fecha_inicio !== undefined ? imp.fecha_inicio || "" : fIniActual;
    const fFinActual = String(det.fecha_fin || "");
    const fFinFinal = imp.fecha_fin !== undefined ? imp.fecha_fin || "" : fFinActual;
    const etqTempActual = String(det.etiqueta_temporada || "");
    const etqTempFinal =
      imp.etiqueta_temporada !== undefined ? imp.etiqueta_temporada || "" : etqTempActual;

    if (
      vigFinal !== vigActual ||
      fIniFinal !== fIniActual ||
      fFinFinal !== fFinActual ||
      etqTempFinal !== etqTempActual
    ) {
      cambios.push({
        campo: "vigencia",
        etiqueta: "Vigencia / Temporada",
        antes: `${vigActual}${fIniActual ? ` (${fIniActual}→${fFinActual})` : ""}`,
        despues: `${vigFinal}${fIniFinal ? ` (${fIniFinal}→${fFinFinal})` : ""}`,
      });
    }

    // 11. Logística
    const logActual = (det.logistica || {}) as Record<string, any>;
    const logFinal = {
      delivery_incluido:
        imp.delivery_incluido !== undefined
          ? imp.delivery_incluido
          : Boolean(logActual.delivery_incluido),
      modalidad_transporte:
        imp.modalidad_transporte !== undefined
          ? imp.modalidad_transporte
          : String(logActual.modalidad_transporte || "INCLUIDO_GRATIS"),
      etiqueta_transporte:
        imp.etiqueta_transporte !== undefined
          ? imp.etiqueta_transporte
          : String(logActual.etiqueta_transporte || ""),
      cobertura_texto:
        imp.cobertura_texto !== undefined
          ? imp.cobertura_texto
          : String(logActual.cobertura_texto || ""),
      recargo_transporte_usd:
        imp.recargo_transporte_usd !== undefined
          ? imp.recargo_transporte_usd
          : Number(logActual.recargo_transporte_usd || 0),
    };
    if (
      logFinal.delivery_incluido !== Boolean(logActual.delivery_incluido) ||
      logFinal.modalidad_transporte !== String(logActual.modalidad_transporte || "INCLUIDO_GRATIS") ||
      logFinal.etiqueta_transporte !== String(logActual.etiqueta_transporte || "") ||
      logFinal.cobertura_texto !== String(logActual.cobertura_texto || "") ||
      logFinal.recargo_transporte_usd !== Number(logActual.recargo_transporte_usd || 0)
    ) {
      cambios.push({
        campo: "logistica",
        etiqueta: "Logística / Envío",
        antes: `${logActual.delivery_incluido ? "Incluido" : "Adicional"} · ${logActual.cobertura_texto || "-"}`,
        despues: `${logFinal.delivery_incluido ? "Incluido" : "Adicional"} · ${logFinal.cobertura_texto || "-"}`,
      });
    }

    // 12. Personalización floral
    const pfActual = obtenerPersonalizacionProducto(prod, esFloristeria);
    let pfFinal: ConfiguracionPersonalizacionFloral | null = pfActual;
    const tieneCamposFloralesImportados =
      imp.floral_habilitada !== undefined ||
      imp.floral_max_colores_rosas !== undefined ||
      imp.floral_colores_rosas !== undefined ||
      imp.floral_solo_rosas !== undefined ||
      imp.floral_solo_girasoles !== undefined ||
      imp.floral_girasoles_y_rosas !== undefined ||
      imp.floral_orquideas_min !== undefined ||
      imp.floral_orquideas_max !== undefined ||
      imp.floral_tipo_envoltorio !== undefined ||
      imp.floral_colores_envoltorio !== undefined ||
      imp.floral_indicaciones !== undefined;

    if (pfActual && tieneCamposFloralesImportados) {
      const nuevoTipoEnv = imp.floral_tipo_envoltorio ?? pfActual.tipoEnvoltorio;
      const nuevosColoresEnv =
        imp.floral_colores_envoltorio !== undefined && imp.floral_colores_envoltorio.length > 0
          ? imp.floral_colores_envoltorio
          : nuevoTipoEnv !== pfActual.tipoEnvoltorio
            ? obtenerColoresPorDefectoEnvoltorio(nuevoTipoEnv)
            : pfActual.coloresBaseDisponibles;

      pfFinal = normalizarConfiguracionPersonalizacionFloral(
        {
          ...pfActual,
          habilitada: imp.floral_habilitada ?? pfActual.habilitada,
          maxColoresRosas: imp.floral_max_colores_rosas ?? pfActual.maxColoresRosas,
          coloresRosasDisponibles:
            imp.floral_colores_rosas !== undefined
              ? imp.floral_colores_rosas
              : pfActual.coloresRosasDisponibles,
          permiteSoloRosas: imp.floral_solo_rosas ?? pfActual.permiteSoloRosas,
          permiteSoloGirasoles: imp.floral_solo_girasoles ?? pfActual.permiteSoloGirasoles,
          permiteGirasolesYRosas:
            imp.floral_girasoles_y_rosas ?? pfActual.permiteGirasolesYRosas,
          orquideasMin: imp.floral_orquideas_min ?? pfActual.orquideasMin,
          orquideasMax: imp.floral_orquideas_max ?? pfActual.orquideasMax,
          tipoEnvoltorio: nuevoTipoEnv,
          mostrarColorBase: nuevoTipoEnv !== "no_aplica",
          coloresBaseDisponibles: nuevosColoresEnv,
          permitirIndicacionesAdicionales:
            imp.floral_indicaciones ?? pfActual.permitirIndicacionesAdicionales,
        },
        { habilitadaPorDefecto: esFloristeria, tipoEnvoltorioPorDefecto: nuevoTipoEnv }
      );

      if (JSON.stringify(pfFinal) !== JSON.stringify(pfActual)) {
        cambios.push({
          campo: "personalizacion_floral",
          etiqueta: "Colores y Flores",
          antes: `Envoltorio: ${obtenerEtiquetaTipoEnvoltorio(pfActual.tipoEnvoltorio)} · Rosas máx ${pfActual.maxColoresRosas}`,
          despues: `Envoltorio: ${obtenerEtiquetaTipoEnvoltorio(pfFinal.tipoEnvoltorio)} · Rosas máx ${pfFinal.maxColoresRosas}`,
        });
      }
    }

    // 13. Multimedia
    const imgActual = String(det.imagen_url || "").trim();
    const imgFinal = imp.imagen_url !== undefined ? (imp.imagen_url || "").trim() : imgActual;
    if (imgFinal !== imgActual) {
      cambios.push({
        campo: "imagen_url",
        etiqueta: "Imagen Portada",
        antes: resumirValor(imgActual),
        despues: resumirValor(imgFinal),
      });
    }

    const albumActual = String(det.album_fotos_url || "").trim();
    const albumFinal =
      imp.album_fotos_url !== undefined ? (imp.album_fotos_url || "").trim() : albumActual;
    if (albumFinal !== albumActual) {
      cambios.push({
        campo: "album_fotos_url",
        etiqueta: "Álbum Fotos",
        antes: resumirValor(albumActual),
        despues: resumirValor(albumFinal),
      });
    }

    const videoActual = String(det.video_url || "").trim();
    const videoFinal = imp.video_url !== undefined ? (imp.video_url || "").trim() : videoActual;
    if (videoFinal !== videoActual) {
      cambios.push({
        campo: "video_url",
        etiqueta: "Video URL",
        antes: resumirValor(videoActual),
        despues: resumirValor(videoFinal),
      });
    }

    const galActual: string[] = Array.isArray(det.galeria_urls) ? det.galeria_urls.filter(Boolean) : [];
    const galFinal = imp.galeria_urls !== undefined ? imp.galeria_urls : galActual;
    if (!listasIguales(galActual, galFinal)) {
      cambios.push({
        campo: "galeria_urls",
        etiqueta: "Galería",
        antes: `${galActual.length} foto(s)`,
        despues: `${galFinal.length} foto(s)`,
      });
    }

    // 14. Variantes (reconciliar tabla Variantes o precio_principal_base de hoja Productos)
    const variantesFinales: PatchVarianteMasiva[] = (prod.variantes || []).map((vOrig, idx) => {
      const vdetOrig = (vOrig.var_detalle_variante && typeof vOrig.var_detalle_variante === "object"
        ? { ...vOrig.var_detalle_variante }
        : {}) as Record<string, any>;

      const vImp =
        imp.variantes?.find((vi) => vi.var_id && vi.var_id === vOrig.var_id) ||
        imp.variantes?.find(
          (vi) =>
            vi.var_sku &&
            vOrig.var_sku &&
            vi.var_sku.trim().toLowerCase() === vOrig.var_sku.trim().toLowerCase()
        ) ||
        imp.variantes?.find(
          (vi) =>
            vi.var_nombre &&
            normalizarTextoComparacion(vi.var_nombre) === normalizarTextoComparacion(vOrig.var_nombre)
        ) ||
        (imp.variantes && imp.variantes.length === prod.variantes.length ? imp.variantes[idx] : undefined);

      const precioDesdePrincipal =
        !vImp && idx === 0 && imp.precio_principal_base !== undefined
          ? imp.precio_principal_base
          : undefined;
      const precioCompDesdePrincipal =
        !vImp && idx === 0 && imp.precio_principal_comparacion !== undefined
          ? imp.precio_principal_comparacion
          : undefined;
      const skuDesdePrincipal =
        !vImp && idx === 0 && imp.sku_principal ? imp.sku_principal : undefined;

      const nuevoSku = vImp?.var_sku?.trim() || skuDesdePrincipal || vOrig.var_sku;
      const nuevoNombre = vImp?.var_nombre?.trim() || vOrig.var_nombre;
      const nuevoPrecio =
        vImp?.var_precio !== undefined
          ? vImp.var_precio
          : precioDesdePrincipal !== undefined
            ? precioDesdePrincipal
            : Number(vOrig.var_precio || 0);
      const nuevoPrecioComp =
        vImp?.var_precio_comparacion !== undefined
          ? vImp.var_precio_comparacion
          : precioCompDesdePrincipal !== undefined
            ? precioCompDesdePrincipal
            : vOrig.var_precio_comparacion ?? null;
      const nuevoIva =
        vImp?.var_tarifa_iva_porcentaje !== undefined
          ? vImp.var_tarifa_iva_porcentaje
          : Number(vOrig.var_tarifa_iva_porcentaje ?? ivaFinal);
      const nuevoActivo = vImp?.var_activo !== undefined ? vImp.var_activo : vOrig.var_activo !== false;

      const etiquetaVar = prod.variantes.length > 1 ? ` [${vOrig.var_nombre}]` : "";

      if (vImp?.portada_url !== undefined) {
        const portOrig = String(vdetOrig.portada_url || vdetOrig.imagen_url || "").trim();
        const portNueva = String(vImp.portada_url || "").trim();
        if (portNueva !== portOrig) {
          vdetOrig.portada_url = portNueva || null;
          cambios.push({
            campo: `variante_portada_${vOrig.var_id}`,
            etiqueta: `Portada${etiquetaVar}`,
            antes: resumirValor(portOrig),
            despues: resumirValor(portNueva),
          });
        }
      }
      if (vImp?.album_url !== undefined) {
        const albOrig = String(vdetOrig.album_url || "").trim();
        const albNuevo = String(vImp.album_url || "").trim();
        if (albNuevo !== albOrig) {
          vdetOrig.album_url = albNuevo || null;
          cambios.push({
            campo: `variante_album_${vOrig.var_id}`,
            etiqueta: `Álbum${etiquetaVar}`,
            antes: resumirValor(albOrig),
            despues: resumirValor(albNuevo),
          });
        }
      }
      if (vImp?.tiempo_entrega !== undefined) {
        const entOrig = String(vdetOrig.tiempo_entrega || "").trim();
        const entNuevo = String(vImp.tiempo_entrega || "").trim();
        if (entNuevo !== entOrig) {
          vdetOrig.tiempo_entrega = entNuevo || null;
          cambios.push({
            campo: `variante_entrega_${vOrig.var_id}`,
            etiqueta: `Entrega${etiquetaVar}`,
            antes: resumirValor(entOrig),
            despues: resumirValor(entNuevo),
          });
        }
      }
      if (vImp?.galeria_urls !== undefined) {
        const galVarOrig: string[] = Array.isArray(vdetOrig.galeria_urls)
          ? vdetOrig.galeria_urls.filter(Boolean)
          : [];
        if (!listasIguales(galVarOrig, vImp.galeria_urls)) {
          vdetOrig.galeria_urls = vImp.galeria_urls;
          cambios.push({
            campo: `variante_galeria_${vOrig.var_id}`,
            etiqueta: `Galería${etiquetaVar}`,
            antes: `${galVarOrig.length} foto(s)`,
            despues: `${vImp.galeria_urls.length} foto(s)`,
          });
        }
      }
      if (vImp?.tipo_envoltorio && esFloristeria) {
        const pfVarActual = resolverPersonalizacionFloralEfectiva({
          configMaster: pfFinal,
          configVariante: vdetOrig.personalizacion_floral,
          modoVariante: vdetOrig.personalizacion_floral_modo,
          habilitadaPorDefecto: esFloristeria,
          tipoEnvoltorioPorDefecto: pfFinal?.tipoEnvoltorio,
        });
        if (vImp.tipo_envoltorio !== pfVarActual.tipoEnvoltorio) {
          vdetOrig.personalizacion_floral_modo = "personalizado";
          vdetOrig.personalizacion_floral = normalizarConfiguracionPersonalizacionFloral(
            {
              ...pfVarActual,
              tipoEnvoltorio: vImp.tipo_envoltorio,
              mostrarColorBase: vImp.tipo_envoltorio !== "no_aplica",
              coloresBaseDisponibles: obtenerColoresPorDefectoEnvoltorio(vImp.tipo_envoltorio),
            },
            { habilitadaPorDefecto: esFloristeria, tipoEnvoltorioPorDefecto: vImp.tipo_envoltorio }
          );
          cambios.push({
            campo: `variante_env_${vOrig.var_id}`,
            etiqueta: `Envoltorio${etiquetaVar}`,
            antes: obtenerEtiquetaTipoEnvoltorio(pfVarActual.tipoEnvoltorio),
            despues: obtenerEtiquetaTipoEnvoltorio(vImp.tipo_envoltorio),
          });
        }
      }

      // Registrar diffs de variante
      if (Math.abs(nuevoPrecio - Number(vOrig.var_precio || 0)) >= 0.005) {
        cambios.push({
          campo: `variante_precio_${vOrig.var_id}`,
          etiqueta: `Precio Base${etiquetaVar}`,
          antes: `$${Number(vOrig.var_precio || 0).toFixed(2)}`,
          despues: `$${nuevoPrecio.toFixed(2)}`,
        });
      }
      const compOrigNum =
        vOrig.var_precio_comparacion != null && Number(vOrig.var_precio_comparacion) > 0
          ? Number(vOrig.var_precio_comparacion)
          : null;
      if (compOrigNum !== nuevoPrecioComp) {
        cambios.push({
          campo: `variante_comp_${vOrig.var_id}`,
          etiqueta: `Precio Antes${etiquetaVar}`,
          antes: compOrigNum != null ? `$${compOrigNum.toFixed(2)}` : "(vacío)",
          despues: nuevoPrecioComp != null ? `$${nuevoPrecioComp.toFixed(2)}` : "(vacío)",
        });
      }
      if (nuevoNombre !== vOrig.var_nombre) {
        cambios.push({
          campo: `variante_nombre_${vOrig.var_id}`,
          etiqueta: `Nombre Variante${etiquetaVar}`,
          antes: vOrig.var_nombre,
          despues: nuevoNombre,
        });
      }
      if (nuevoSku !== vOrig.var_sku) {
        cambios.push({
          campo: `variante_sku_${vOrig.var_id}`,
          etiqueta: `SKU${etiquetaVar}`,
          antes: vOrig.var_sku,
          despues: nuevoSku,
        });
      }
      if (nuevoIva !== Number(vOrig.var_tarifa_iva_porcentaje ?? 0)) {
        cambios.push({
          campo: `variante_iva_${vOrig.var_id}`,
          etiqueta: `IVA Variante${etiquetaVar}`,
          antes: `${Number(vOrig.var_tarifa_iva_porcentaje ?? 0)}%`,
          despues: `${nuevoIva}%`,
        });
      }
      if (nuevoActivo !== (vOrig.var_activo !== false)) {
        cambios.push({
          campo: `variante_activo_${vOrig.var_id}`,
          etiqueta: `Estado Variante${etiquetaVar}`,
          antes: vOrig.var_activo !== false ? "ACTIVA" : "INACTIVA",
          despues: nuevoActivo ? "ACTIVA" : "INACTIVA",
        });
      }

      return {
        var_id: vOrig.var_id,
        var_sku: nuevoSku,
        var_nombre: nuevoNombre,
        var_precio: nuevoPrecio,
        var_precio_comparacion: nuevoPrecioComp,
        var_tarifa_iva_porcentaje: nuevoIva,
        var_codigo_impuesto_sri: nuevoIva > 0 ? "IVA_15" : "IVA_0",
        var_activo: nuevoActivo,
        var_detalle_variante: vdetOrig,
      };
    });

    const patch: PatchProductoMasivo = {
      pro_id: prod.pro_id,
      nombre: nombreFinal,
      descripcion: descFinal,
      categoriaId: categoriaIdFinal,
      tipo: tipoFinal,
      destacado: destacadoFinal,
      pro_activo: activoFinal,
      tarifaIvaPredeterminada: ivaFinal,
      beneficios: benFinal,
      requisitos: reqFinal,
      tiempoEntrega: entregaFinal,
      usos: usosFinal,
      etiquetas: tagsFinal,
      canales_visibilidad: canalesFinal,
      vigencia_tipo: vigFinal,
      fecha_inicio: fIniFinal,
      fecha_fin: fFinFinal,
      etiqueta_temporada: etqTempFinal,
      logistica: logFinal,
      personalizacionFloral: pfFinal,
      imagenUrl: imgFinal,
      albumFotosUrl: albumFinal,
      videoUrl: videoFinal,
      galeriaUrls: galFinal,
      variantes: variantesFinales,
    };

    items.push({
      clave: prod.pro_id,
      pro_id: prod.pro_id,
      nombreActual: prod.pro_nombre,
      nombreImportado: nombreFinal,
      estado: cambios.length > 0 ? "CON_CAMBIOS" : "SIN_CAMBIOS",
      cambios,
      advertencias: advertenciasItem,
      patch: cambios.length > 0 ? patch : undefined,
    });
  }

  return {
    totalLeidos: parseado.productos.length,
    totalConCambios: items.filter((i) => i.estado === "CON_CAMBIOS").length,
    totalSinCambios: items.filter((i) => i.estado === "SIN_CAMBIOS").length,
    totalNoEncontrados: items.filter((i) => i.estado === "NO_ENCONTRADO").length,
    totalErrores: items.filter((i) => i.estado === "ERROR").length,
    advertenciasGlobales: [...parseado.advertencias],
    items,
  };
}
