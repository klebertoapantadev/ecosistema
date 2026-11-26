/**
 * Motor multinegocio de Composición / Receta (BOM) por Producto Master o Variante (`PLT-009`).
 *
 * Permite modelar de forma genérica los componentes que integran un producto o servicio
 * en cualquier negocio del ecosistema (Tinkay, Margaritas, FastFix Home, Tranqi):
 * - En floristerías: rosas (con colores 1..N), girasoles, orquídeas, gerberas, lirios
 *   o componentes personalizados.
 * - En otros negocios: repuestos, materiales, horas técnicas o entregables.
 *
 * Reglas clave:
 * - Solo los componentes con `cantidad > 0` y `visibleCliente !== false` se muestran en la
 *   descripción pública (ej. "Aprox. 50 rosas, aprox. 18 girasoles").
 * - Si ningún componente es mayor a 0, no se genera texto alguno.
 * - Permite herencia desde Producto Master hacia Variantes/Tamaños con sobrescritura opcional.
 */

export interface DefinicionComponenteReceta {
  clave: string;
  codigoInsumo: string;
  etiquetaSingular: string;
  etiquetaPlural: string;
  etiquetaAdmin: string;
  unidadMedida: string;
  emoji?: string;
  permiteColores?: boolean;
  aproximadoPorDefecto: boolean;
}

export interface ItemComposicionReceta {
  /** Clave canónica del componente (ej. "rosas", "girasoles", "orquideas", "gerberas", "lirios" o personalizada) */
  clave: string;
  etiquetaSingular: string;
  etiquetaPlural: string;
  /** Cantidad en receta (0 = no incluido; > 0 = incluido) */
  cantidad: number;
  /** Si es true, se presenta al cliente como "aprox. N <componente>" */
  aproximado: boolean;
  /** Para componentes con color elegible (ej. rosas: 1..N colores) */
  maxColores?: number;
  /** Si es false, el insumo queda solo para Taller/Costos y no aparece en la descripción al cliente */
  visibleCliente: boolean;
  unidadMedida?: string;
  codigoInsumo?: string;
}

export interface ResumenFloresReceta {
  /** true cuando al menos un componente de la receta tiene cantidad > 0 */
  tieneReceta: boolean;
  rosas: number;
  maxColoresRosas: number;
  girasoles: number;
  orquideas: number;
  gerberas: number;
  lirios: number;
  otrosComponentes: ItemComposicionReceta[];
  incluyeRosas: boolean;
  incluyeGirasoles: boolean;
  incluyeOrquideas: boolean;
  incluyeGerberas: boolean;
  incluyeLirios: boolean;
}

export const COMPONENTES_RECETA_FLORISTERIA: readonly DefinicionComponenteReceta[] = [
  {
    clave: "rosas",
    codigoInsumo: "REC_ROSA",
    etiquetaSingular: "rosa",
    etiquetaPlural: "rosas",
    etiquetaAdmin: "Rosas",
    unidadMedida: "TALLO",
    emoji: "🌹",
    permiteColores: true,
    aproximadoPorDefecto: true,
  },
  {
    clave: "girasoles",
    codigoInsumo: "REC_GIRASOL",
    etiquetaSingular: "girasol",
    etiquetaPlural: "girasoles",
    etiquetaAdmin: "Girasoles",
    unidadMedida: "TALLO",
    emoji: "🌻",
    aproximadoPorDefecto: true,
  },
  {
    clave: "orquideas",
    codigoInsumo: "REC_ORQUIDEA",
    etiquetaSingular: "orquídea",
    etiquetaPlural: "orquídeas",
    etiquetaAdmin: "Orquídeas",
    unidadMedida: "UNIDAD",
    emoji: "🌺",
    permiteColores: true,
    aproximadoPorDefecto: true,
  },
  {
    clave: "gerberas",
    codigoInsumo: "REC_GERBERA",
    etiquetaSingular: "gerbera",
    etiquetaPlural: "gerberas",
    etiquetaAdmin: "Gerberas",
    unidadMedida: "TALLO",
    emoji: "🌼",
    aproximadoPorDefecto: true,
  },
  {
    clave: "lirios",
    codigoInsumo: "REC_LIRIO",
    etiquetaSingular: "lirio",
    etiquetaPlural: "lirios",
    etiquetaAdmin: "Lirios",
    unidadMedida: "TALLO",
    emoji: "⚜️",
    aproximadoPorDefecto: true,
  },
] as const;

const MAPA_FLORISTERIA_POR_CLAVE = new Map<string, DefinicionComponenteReceta>(
  COMPONENTES_RECETA_FLORISTERIA.map((c) => [c.clave, c])
);

function normalizarClaveReceta(raw: unknown): string {
  const limpio = String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!limpio) return "";
  if (limpio === "rosa" || limpio === "rosas") return "rosas";
  if (limpio === "girasol" || limpio === "girasoles") return "girasoles";
  if (limpio === "orquidea" || limpio === "orquideas" || limpio === "cymbidium") return "orquideas";
  if (limpio === "gerbera" || limpio === "gerberas") return "gerberas";
  if (limpio === "lirio" || limpio === "lirios" || limpio === "lilium" || limpio === "liliums") {
    return "lirios";
  }
  return limpio;
}

/**
 * Normaliza una lista cruda de ítems de receta/composición (desde JSONB de Master o Variante).
 * Conserva únicamente ítems con cantidad > 0, sin duplicados por clave.
 */
export function normalizarComposicionReceta(raw: unknown): ItemComposicionReceta[] {
  if (!Array.isArray(raw)) return [];
  const mapa = new Map<string, ItemComposicionReceta>();

  for (const entrada of raw) {
    if (!entrada || typeof entrada !== "object") continue;
    const r = entrada as Record<string, unknown>;
    const clave = normalizarClaveReceta(r.clave ?? r.key ?? r.etiquetaPlural ?? r.etiqueta);
    if (!clave) continue;

    const cantRaw = Number(r.cantidad ?? 0);
    const cantidad =
      Number.isFinite(cantRaw) && cantRaw > 0
        ? Math.min(9999, Math.round(cantRaw * 100) / 100)
        : 0;
    if (cantidad <= 0) continue;

    const defBase = MAPA_FLORISTERIA_POR_CLAVE.get(clave);
    const etiquetaPlural =
      String(r.etiquetaPlural ?? r.etiqueta_plural ?? r.etiqueta ?? "").trim() ||
      defBase?.etiquetaPlural ||
      clave.replace(/_/g, " ");
    const etiquetaSingular =
      String(r.etiquetaSingular ?? r.etiqueta_singular ?? "").trim() ||
      defBase?.etiquetaSingular ||
      (etiquetaPlural.endsWith("s") && etiquetaPlural.length > 2
        ? etiquetaPlural.slice(0, -1)
        : etiquetaPlural);

    const aproximado =
      typeof r.aproximado === "boolean"
        ? r.aproximado
        : defBase?.aproximadoPorDefecto ?? true;
    const visibleCliente =
      typeof r.visibleCliente === "boolean"
        ? r.visibleCliente
        : typeof r.visible_cliente === "boolean"
          ? r.visible_cliente
          : true;

    const maxColRaw = Number(r.maxColores ?? r.max_colores ?? 0);
    const maxColores =
      clave === "rosas"
        ? Math.max(1, Math.min(12, Math.round(Number.isFinite(maxColRaw) && maxColRaw > 0 ? maxColRaw : 1)))
        : Number.isFinite(maxColRaw) && maxColRaw > 0
          ? Math.max(1, Math.min(12, Math.round(maxColRaw)))
          : undefined;

    mapa.set(clave, {
      clave,
      etiquetaSingular,
      etiquetaPlural,
      cantidad,
      aproximado,
      ...(maxColores !== undefined ? { maxColores } : {}),
      visibleCliente,
      unidadMedida:
        String(r.unidadMedida ?? r.unidad_medida ?? "").trim() ||
        defBase?.unidadMedida ||
        "UNIDAD",
      codigoInsumo:
        String(r.codigoInsumo ?? r.codigo_insumo ?? "").trim() ||
        defBase?.codigoInsumo ||
        `REC_${clave.toUpperCase()}`,
    });
  }

  // Ordenar primero los componentes estándar de floristería en su orden natural, luego personalizados
  const ordenBase = new Map<string, number>(
    COMPONENTES_RECETA_FLORISTERIA.map((c, idx) => [c.clave, idx])
  );
  return Array.from(mapa.values()).sort((a, b) => {
    const oa = ordenBase.get(a.clave) ?? 100;
    const ob = ordenBase.get(b.clave) ?? 100;
    if (oa !== ob) return oa - ob;
    return a.etiquetaPlural.localeCompare(b.etiquetaPlural, "es");
  });
}

export function obtenerItemsActivosReceta(
  receta?: readonly ItemComposicionReceta[] | null
): ItemComposicionReceta[] {
  if (!Array.isArray(receta)) return [];
  return receta.filter((it) => Number(it.cantidad) > 0);
}

export function tieneRecetaConfigurada(
  receta?: readonly ItemComposicionReceta[] | null
): boolean {
  return obtenerItemsActivosReceta(receta).length > 0;
}

export function obtenerResumenFloresReceta(
  receta?: readonly ItemComposicionReceta[] | null
): ResumenFloresReceta {
  const activos = obtenerItemsActivosReceta(receta);
  let rosas = 0;
  let maxColoresRosas = 0;
  let girasoles = 0;
  let orquideas = 0;
  let gerberas = 0;
  let lirios = 0;
  const otrosComponentes: ItemComposicionReceta[] = [];

  for (const it of activos) {
    const cant = Math.max(0, Number(it.cantidad) || 0);
    if (cant <= 0) continue;
    switch (it.clave) {
      case "rosas":
        rosas += cant;
        maxColoresRosas = Math.max(1, Math.min(12, Math.round(Number(it.maxColores || 1))));
        break;
      case "girasoles":
        girasoles += cant;
        break;
      case "orquideas":
        orquideas += cant;
        break;
      case "gerberas":
        gerberas += cant;
        break;
      case "lirios":
        lirios += cant;
        break;
      default:
        otrosComponentes.push(it);
        break;
    }
  }

  return {
    tieneReceta: activos.length > 0,
    rosas,
    maxColoresRosas: rosas > 0 ? Math.max(1, maxColoresRosas) : 0,
    girasoles,
    orquideas,
    gerberas,
    lirios,
    otrosComponentes,
    incluyeRosas: rosas > 0,
    incluyeGirasoles: girasoles > 0,
    incluyeOrquideas: orquideas > 0,
    incluyeGerberas: gerberas > 0,
    incluyeLirios: lirios > 0,
  };
}

/**
 * Formatea la composición visible al cliente omitiendo por completo cualquier ítem con cantidad = 0.
 * Ejemplos:
 * - rosas: 50 (aprox), girasoles: 18 (aprox) -> "Aprox. 50 rosas, aprox. 18 girasoles"
 * - orquideas: 3 (no aprox) -> "3 orquídeas"
 * - todos en 0 -> ""
 */
export function formatearDescripcionComposicion(
  receta?: readonly ItemComposicionReceta[] | null,
  opciones?: { capitalizar?: boolean; incluirOcultos?: boolean }
): string {
  const activos = obtenerItemsActivosReceta(receta).filter(
    (it) => opciones?.incluirOcultos || it.visibleCliente !== false
  );
  if (activos.length === 0) return "";

  const partes = activos.map((it) => {
    const cant = Number(it.cantidad);
    const etiqueta = cant === 1 ? it.etiquetaSingular : it.etiquetaPlural;
    const cantTxt = Number.isInteger(cant) ? String(cant) : String(cant);
    return it.aproximado ? `aprox. ${cantTxt} ${etiqueta}` : `${cantTxt} ${etiqueta}`;
  });

  const texto = partes.join(", ");
  if (opciones?.capitalizar === false || !texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Resuelve la composición efectiva para una variante aplicando herencia desde Master
 * cuando el modo de la variante es "heredar" o no tiene composición propia.
 */
export function resolverComposicionRecetaEfectiva(params: {
  recetaMaster?: unknown;
  recetaVariante?: unknown;
  modoVariante?: unknown;
}): ItemComposicionReceta[] {
  const modoRaw = String(params.modoVariante || "").trim().toLowerCase();
  if (modoRaw === "personalizado" && Array.isArray(params.recetaVariante)) {
    return normalizarComposicionReceta(params.recetaVariante);
  }
  return normalizarComposicionReceta(params.recetaMaster);
}
