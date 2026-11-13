import { detectarTipoNegocio } from "./negocio";

export interface DetalleTipoOferta {
  es_renta?: boolean;
  etiqueta_corta?: string;
  icono?: string;
  periodo_defecto?: string;
  incluye_retiro_defecto?: boolean;
  nota_condiciones_defecto?: string;
}

export interface TipoOfertaComercial {
  tof_id: string;
  tof_negocio: string;
  tof_codigo: string;
  tof_nombre: string;
  tof_descripcion?: string | null;
  tof_orden: number;
  tof_es_sistema?: boolean;
  tof_activo: boolean;
  tof_detalle_tipo_oferta?: DetalleTipoOferta;
  productos_conteo?: number;
  en_uso?: boolean;
  productos_ejemplo?: string[];
}

export interface ConfiguracionRentaProducto {
  periodo: string;
  deposito_garantia_usd: number;
  incluye_retiro: boolean;
  nota_condiciones: string;
}

export const PERIODOS_RENTA_SUGERIDOS = [
  "Por evento (24h)",
  "Por día (24h)",
  "Fin de semana (48h)",
  "Por jornada (8h)",
] as const;

export const CONDICIONES_RENTA_POR_DEFECTO: ConfiguracionRentaProducto = {
  periodo: "Por evento (24h)",
  deposito_garantia_usd: 0,
  incluye_retiro: true,
  nota_condiciones:
    "Mobiliario en calidad de renta para el evento. Coordinamos entrega y retiro al finalizar.",
};

export function normalizarCodigoTipoOferta(texto: string): string {
  const sinTildes = String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const limpio = sinTildes
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
  return limpio || "OFERTA_CUSTOM";
}

export function obtenerTiposOfertaPorDefecto(negocio: string): TipoOfertaComercial[] {
  const negNorm = String(negocio || "tinkay").trim().toLowerCase();
  const { esFloristeria, esMantenimiento } = detectarTipoNegocio(negNorm);

  if (esFloristeria) {
    return [
      {
        tof_id: `preset-${negNorm}-fisico`,
        tof_negocio: negNorm,
        tof_codigo: "FISICO",
        tof_nombre: "Producto Físico / Entrega Floral a Domicilio",
        tof_descripcion: "Arreglos florales, cajas y detalles entregados en propiedad al destinatario.",
        tof_orden: 1,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: {
          es_renta: false,
          etiqueta_corta: "Entrega Floral",
          icono: "🌸",
        },
      },
      {
        tof_id: `preset-${negNorm}-servicio`,
        tof_negocio: negNorm,
        tof_codigo: "SERVICIO",
        tof_nombre: "Servicio de Decoración / Eventos",
        tof_descripcion: "Montaje floral, ambientación y decoración profesional para eventos.",
        tof_orden: 2,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: {
          es_renta: false,
          etiqueta_corta: "Servicio Eventos",
          icono: "✨",
        },
      },
      {
        tof_id: `preset-${negNorm}-renta`,
        tof_negocio: negNorm,
        tof_codigo: "RENTA",
        tof_nombre: "Renta de Mobiliario / Alquiler para Eventos",
        tof_descripcion:
          "Alquiler temporal de pedestales, arcos, backings, bases y mobiliario para eventos con retiro posterior.",
        tof_orden: 3,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: {
          es_renta: true,
          etiqueta_corta: "🪑 En Renta",
          icono: "🪑",
          periodo_defecto: "Por evento (24h)",
          incluye_retiro_defecto: true,
          nota_condiciones_defecto: CONDICIONES_RENTA_POR_DEFECTO.nota_condiciones,
        },
      },
      {
        tof_id: `preset-${negNorm}-suscripcion`,
        tof_negocio: negNorm,
        tof_codigo: "SUSCRIPCION",
        tof_nombre: "Suscripción Floral (Semanal / Mensual)",
        tof_descripcion: "Plan recurrente de entregas florales periódicas.",
        tof_orden: 4,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: {
          es_renta: false,
          etiqueta_corta: "Suscripción",
          icono: "🔄",
        },
      },
      {
        tof_id: `preset-${negNorm}-digital`,
        tof_negocio: negNorm,
        tof_codigo: "DIGITAL",
        tof_nombre: "Tarjeta Dedicatoria Digital / Gift Card",
        tof_descripcion: "Tarjeta digital o certificado de regalo electrónico.",
        tof_orden: 5,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: {
          es_renta: false,
          etiqueta_corta: "Digital",
          icono: "💌",
        },
      },
    ];
  }

  if (esMantenimiento) {
    return [
      {
        tof_id: `preset-${negNorm}-servicio`,
        tof_negocio: negNorm,
        tof_codigo: "SERVICIO",
        tof_nombre: "Servicio Técnico / Reparación",
        tof_descripcion: "Intervención técnica profesional a domicilio.",
        tof_orden: 1,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Servicio Técnico", icono: "🛠️" },
      },
      {
        tof_id: `preset-${negNorm}-fisico`,
        tof_negocio: negNorm,
        tof_codigo: "FISICO",
        tof_nombre: "Producto Físico / Repuesto",
        tof_descripcion: "Suministro o repuesto físico.",
        tof_orden: 2,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Repuesto", icono: "📦" },
      },
      {
        tof_id: `preset-${negNorm}-renta`,
        tof_negocio: negNorm,
        tof_codigo: "RENTA",
        tof_nombre: "Alquiler de Herramienta / Equipo",
        tof_descripcion: "Renta temporal de equipamiento técnico con devolución.",
        tof_orden: 3,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: {
          es_renta: true,
          etiqueta_corta: "🪑 En Renta",
          icono: "🧰",
          periodo_defecto: "Por día (24h)",
          incluye_retiro_defecto: false,
        },
      },
      {
        tof_id: `preset-${negNorm}-suscripcion`,
        tof_negocio: negNorm,
        tof_codigo: "SUSCRIPCION",
        tof_nombre: "Suscripción / Plan Periódico",
        tof_descripcion: "Plan preventivo periódico.",
        tof_orden: 4,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Plan", icono: "🛡️" },
      },
      {
        tof_id: `preset-${negNorm}-digital`,
        tof_negocio: negNorm,
        tof_codigo: "DIGITAL",
        tof_nombre: "Producto Digital / Informe Técnico",
        tof_descripcion: "Informe o guía digital.",
        tof_orden: 5,
        tof_es_sistema: true,
        tof_activo: true,
        tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Digital", icono: "📄" },
      },
    ];
  }

  return [
    {
      tof_id: `preset-${negNorm}-servicio`,
      tof_negocio: negNorm,
      tof_codigo: "SERVICIO",
      tof_nombre: "Servicio / Trámite Puntual",
      tof_descripcion: "Patrocinio, consulta o trámite específico.",
      tof_orden: 1,
      tof_es_sistema: true,
      tof_activo: true,
      tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Servicio Legal", icono: "⚖️" },
    },
    {
      tof_id: `preset-${negNorm}-suscripcion`,
      tof_negocio: negNorm,
      tof_codigo: "SUSCRIPCION",
      tof_nombre: "Suscripción / Plan Periódico",
      tof_descripcion: "Cobertura jurídica recurrente.",
      tof_orden: 2,
      tof_es_sistema: true,
      tof_activo: true,
      tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Plan Legal", icono: "🛡️" },
    },
    {
      tof_id: `preset-${negNorm}-fisico`,
      tof_negocio: negNorm,
      tof_codigo: "FISICO",
      tof_nombre: "Físico / Entrega Notarial",
      tof_descripcion: "Gestión con entrega física de documentos.",
      tof_orden: 3,
      tof_es_sistema: true,
      tof_activo: true,
      tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Entrega Física", icono: "🏛️" },
    },
    {
      tof_id: `preset-${negNorm}-digital`,
      tof_negocio: negNorm,
      tof_codigo: "DIGITAL",
      tof_nombre: "Producto Digital / Formato",
      tof_descripcion: "Minuta, formato o dictamen digital.",
      tof_orden: 4,
      tof_es_sistema: true,
      tof_activo: true,
      tof_detalle_tipo_oferta: { es_renta: false, etiqueta_corta: "Digital", icono: "📄" },
    },
  ];
}

export function esCodigoOfertaRenta(
  codigoTipo?: string | null,
  detalleProducto?: any,
  catalogoTipos?: TipoOfertaComercial[]
): boolean {
  if (detalleProducto?.es_renta === true) return true;
  const cod = String(codigoTipo || "").trim().toUpperCase();
  if (!cod) return false;
  if (cod === "RENTA" || cod.startsWith("RENTA_") || cod.includes("ALQUILER") || cod.includes("RENTA")) {
    return true;
  }
  if (Array.isArray(catalogoTipos)) {
    const match = catalogoTipos.find((t) => t.tof_codigo.toUpperCase() === cod);
    if (match?.tof_detalle_tipo_oferta?.es_renta === true) return true;
  }
  return false;
}

export function obtenerEtiquetaCortaTipoOferta(
  codigoTipo?: string | null,
  detalleProducto?: any,
  catalogoTipos?: TipoOfertaComercial[]
): string {
  if (typeof detalleProducto?.tipo_oferta_etiqueta === "string" && detalleProducto.tipo_oferta_etiqueta.trim()) {
    return detalleProducto.tipo_oferta_etiqueta.trim();
  }
  const cod = String(codigoTipo || "").trim().toUpperCase();
  if (Array.isArray(catalogoTipos)) {
    const match = catalogoTipos.find((t) => t.tof_codigo.toUpperCase() === cod);
    if (match?.tof_detalle_tipo_oferta?.etiqueta_corta) {
      return match.tof_detalle_tipo_oferta.etiqueta_corta;
    }
    if (match?.tof_nombre) return match.tof_nombre;
  }
  if (esCodigoOfertaRenta(cod, detalleProducto, catalogoTipos)) {
    return "🪑 En Renta";
  }
  return cod || "Producto";
}

export function normalizarConfiguracionRenta(raw?: any): ConfiguracionRentaProducto {
  if (!raw || typeof raw !== "object") {
    return { ...CONDICIONES_RENTA_POR_DEFECTO };
  }
  const dep = Number(raw.deposito_garantia_usd ?? raw.depositoGarantiaUsd ?? 0);
  return {
    periodo:
      typeof raw.periodo === "string" && raw.periodo.trim()
        ? raw.periodo.trim()
        : CONDICIONES_RENTA_POR_DEFECTO.periodo,
    deposito_garantia_usd: Number.isFinite(dep) && dep > 0 ? Number(dep.toFixed(2)) : 0,
    incluye_retiro:
      raw.incluye_retiro !== undefined
        ? Boolean(raw.incluye_retiro)
        : raw.incluyeRetiro !== undefined
        ? Boolean(raw.incluyeRetiro)
        : true,
    nota_condiciones:
      typeof raw.nota_condiciones === "string"
        ? raw.nota_condiciones.trim()
        : typeof raw.notaCondiciones === "string"
        ? raw.notaCondiciones.trim()
        : CONDICIONES_RENTA_POR_DEFECTO.nota_condiciones,
  };
}

/**
 * Combina la lista de tipos de oferta provenientes de BDD con los presets base
 * (respetando el conjunto de códigos explícitamente eliminados por el administrador).
 */
export function fusionarTiposOfertaConPresets(
  negocio: string,
  remotos: TipoOfertaComercial[],
  codigosEliminados: string[] = []
): TipoOfertaComercial[] {
  const negNorm = String(negocio || "tinkay").trim().toLowerCase();
  const eliminadosSet = new Set(codigosEliminados.map((c) => String(c).trim().toUpperCase()));
  const presets = obtenerTiposOfertaPorDefecto(negNorm);
  const porCodigo = new Map<string, TipoOfertaComercial>();

  for (const p of presets) {
    const cod = p.tof_codigo.toUpperCase();
    if (!eliminadosSet.has(cod)) {
      porCodigo.set(cod, { ...p });
    }
  }

  for (const r of remotos || []) {
    if (!r || !r.tof_codigo) continue;
    const cod = String(r.tof_codigo).trim().toUpperCase();
    if (r.tof_activo === false || eliminadosSet.has(cod)) {
      porCodigo.delete(cod);
      continue;
    }
    const basePreset = porCodigo.get(cod);
    porCodigo.set(cod, {
      ...basePreset,
      ...r,
      tof_codigo: cod,
      tof_detalle_tipo_oferta: {
        ...(basePreset?.tof_detalle_tipo_oferta || {}),
        ...(r.tof_detalle_tipo_oferta || {}),
      },
    });
  }

  return Array.from(porCodigo.values()).sort(
    (a, b) => (a.tof_orden ?? 99) - (b.tof_orden ?? 99) || a.tof_nombre.localeCompare(b.tof_nombre)
  );
}

// --- Caché Híbrido LocalStorage (Resiliencia Cliente-Servidor) ---

const KEY_CACHE_TIPOS_OFERTA = (negocio: string) =>
  `eco_tipos_oferta_cache_${String(negocio || "tinkay").toLowerCase()}`;
const KEY_ELIMINADOS_TIPOS_OFERTA = (negocio: string) =>
  `eco_tipos_oferta_eliminados_${String(negocio || "tinkay").toLowerCase()}`;

export function leerTiposOfertaEliminadosLocal(negocio: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_ELIMINADOS_TIPOS_OFERTA(negocio));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x).toUpperCase().trim()) : [];
  } catch {
    return [];
  }
}

export function guardarTiposOfertaEliminadosLocal(negocio: string, codigos: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const unicos = Array.from(new Set(codigos.map((x) => String(x).toUpperCase().trim()).filter(Boolean)));
    localStorage.setItem(KEY_ELIMINADOS_TIPOS_OFERTA(negocio), JSON.stringify(unicos));
  } catch {}
}

export function leerTiposOfertaCacheLocal(negocio: string): TipoOfertaComercial[] {
  const eliminados = leerTiposOfertaEliminadosLocal(negocio);
  if (typeof window === "undefined") {
    return fusionarTiposOfertaConPresets(negocio, [], eliminados);
  }
  try {
    const raw = localStorage.getItem(KEY_CACHE_TIPOS_OFERTA(negocio));
    if (!raw) return fusionarTiposOfertaConPresets(negocio, [], eliminados);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fusionarTiposOfertaConPresets(negocio, [], eliminados);
    return fusionarTiposOfertaConPresets(negocio, parsed, eliminados);
  } catch {
    return fusionarTiposOfertaConPresets(negocio, [], eliminados);
  }
}

export function guardarTiposOfertaCacheLocal(negocio: string, lista: TipoOfertaComercial[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_CACHE_TIPOS_OFERTA(negocio), JSON.stringify(lista));
  } catch {}
}

