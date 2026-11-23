/**
 * Configuración y selección de personalización floral por producto para floristerías (Tinkay / Margaritas).
 *
 * Permite configurar por arreglo:
 * - Cantidad máxima de colores de rosas disponibles: 1 color (por defecto), 2 colores o N colores.
 * - Combinaciones de flores permitidas: Solo Rosas, Solo Girasoles, Girasoles y Rosas.
 * - Orquídeas opcionales o incluidas desde 0 hasta N (configurable por producto).
 * - Color Base / Papel Decorativo con las 3 opciones exclusivas:
 *   1) Colores Claros (Blanco / Beige)
 *   2) Colores Oscuros (Negro / Gris)
 *   3) Rosa (Rosado / Lila)
 * - Campo de indicaciones adicionales del cliente.
 */

export type ModoFlorPersonalizacion =
  | "solo_rosas"
  | "solo_girasoles"
  | "girasoles_y_rosas"
  | "solo_orquideas";

export type ColorBasePapelId = "claros" | "oscuros" | "rosa";

export interface OpcionColorBasePapel {
  id: ColorBasePapelId;
  etiqueta: string;
  detalle: string;
  coloresMuestra: [string, string];
}

export const OPCIONES_COLOR_BASE_PAPEL: readonly OpcionColorBasePapel[] = [
  {
    id: "claros",
    etiqueta: "Colores Claros",
    detalle: "Blanco / Beige",
    coloresMuestra: ["#FFFFFF", "#E6D7C3"],
  },
  {
    id: "oscuros",
    etiqueta: "Colores Oscuros",
    detalle: "Negro / Gris",
    coloresMuestra: ["#1C1917", "#6B7280"],
  },
  {
    id: "rosa",
    etiqueta: "Rosa",
    detalle: "Rosado / Lila",
    coloresMuestra: ["#F472B6", "#C084FC"],
  },
] as const;

export interface OpcionColorRosaPersonalizacion {
  clave: string;
  etiqueta: string;
  colorHex: string;
  bordeHex?: string;
}

export const COLORES_ROSAS_PERSONALIZACION: readonly OpcionColorRosaPersonalizacion[] = [
  { clave: "rojo", etiqueta: "Rojo", colorHex: "#DC2626" },
  { clave: "blanco", etiqueta: "Blanco / Crema", colorHex: "#FAF8F5", bordeHex: "#CBD5E1" },
  { clave: "rosado", etiqueta: "Rosado", colorHex: "#F472B6" },
  { clave: "fucsia", etiqueta: "Fucsia", colorHex: "#DB2777" },
  { clave: "amarillo", etiqueta: "Amarillo", colorHex: "#EAB308" },
  { clave: "durazno", etiqueta: "Durazno", colorHex: "#FB923C" },
  { clave: "naranja", etiqueta: "Naranja", colorHex: "#EA580C" },
  { clave: "lavanda", etiqueta: "Lila / Lavanda", colorHex: "#A855F7" },
  { clave: "azul", etiqueta: "Azul / Tinturado", colorHex: "#2563EB" },
  { clave: "verde", etiqueta: "Verde", colorHex: "#16A34A" },
  { clave: "multicolor", etiqueta: "Surtido / Mix", colorHex: "#EC4899" },
] as const;

export interface ConfiguracionPersonalizacionFloral {
  habilitada: boolean;
  /** Cantidad máxima de colores de rosas que el cliente puede elegir (por defecto 1). */
  maxColoresRosas: number;
  /** Lista opcional de claves de color permitidas; vacío = todos los colores disponibles. */
  coloresRosasDisponibles: string[];
  permiteSoloRosas: boolean;
  permiteSoloGirasoles: boolean;
  permiteGirasolesYRosas: boolean;
  /** Cantidad mínima de orquídeas (0 = opcional). */
  orquideasMin: number;
  /** Cantidad máxima de orquídeas (0 = no aplica / no disponible). */
  orquideasMax: number;
  /** Mostrar selección de Color Base / Papel Decorativo (Claros / Oscuros / Rosa). */
  mostrarColorBase: boolean;
  /** Subconjunto de las 3 alternativas permitidas (por defecto las 3). */
  coloresBaseDisponibles: ColorBasePapelId[];
  /** Permitir campo libre de indicaciones adicionales del comprador. */
  permitirIndicacionesAdicionales: boolean;
}

export interface SeleccionPersonalizacionFloral {
  /** Si el cliente elige mantener exactamente los mismos colores y papel mostrados en la foto */
  mismosColoresFoto?: boolean;
  modoFlores: ModoFlorPersonalizacion;
  coloresRosas: string[];
  cantidadOrquideas: number;
  colorBasePapel?: ColorBasePapelId | null;
  colorBasePapelEtiqueta?: string;
  indicacionesAdicionales?: string;
  resumenTexto: string;
}

export function crearConfiguracionPersonalizacionFloralPorDefecto(
  habilitada = true
): ConfiguracionPersonalizacionFloral {
  return {
    habilitada,
    maxColoresRosas: 1,
    coloresRosasDisponibles: [],
    permiteSoloRosas: true,
    permiteSoloGirasoles: false,
    permiteGirasolesYRosas: false,
    orquideasMin: 0,
    orquideasMax: 0,
    mostrarColorBase: true,
    coloresBaseDisponibles: ["claros", "oscuros", "rosa"],
    permitirIndicacionesAdicionales: true,
  };
}

function esColorBasePapelValido(v: unknown): v is ColorBasePapelId {
  return v === "claros" || v === "oscuros" || v === "rosa";
}

function normalizarEnteroRango(valor: unknown, defecto: number, min: number, max: number): number {
  const num = Number(valor);
  if (!Number.isFinite(num)) return defecto;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function normalizarConfiguracionPersonalizacionFloral(
  raw: unknown,
  opciones?: { habilitadaPorDefecto?: boolean }
): ConfiguracionPersonalizacionFloral {
  const habilitadaDef = opciones?.habilitadaPorDefecto ?? true;
  const base = crearConfiguracionPersonalizacionFloralPorDefecto(habilitadaDef);
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const r = raw as Record<string, unknown>;
  const habilitada = typeof r.habilitada === "boolean" ? r.habilitada : habilitadaDef;
  const maxColoresRosas = normalizarEnteroRango(
    r.maxColoresRosas ?? r.max_colores_rosas,
    base.maxColoresRosas,
    0,
    12
  );

  const coloresRaw = Array.isArray(r.coloresRosasDisponibles ?? r.colores_rosas_disponibles)
    ? ((r.coloresRosasDisponibles ?? r.colores_rosas_disponibles) as unknown[])
    : [];
  const clavesValidas = new Set(COLORES_ROSAS_PERSONALIZACION.map((c) => c.clave));
  const coloresRosasDisponibles = Array.from(
    new Set(
      coloresRaw
        .map((c) => String(c || "").trim().toLowerCase())
        .filter((c) => clavesValidas.has(c))
    )
  );

  const permiteSoloRosasRaw = r.permiteSoloRosas ?? r.permite_solo_rosas;
  const permiteSoloGirasolesRaw = r.permiteSoloGirasoles ?? r.permite_solo_girasoles;
  const permiteGirasolesYRosasRaw = r.permiteGirasolesYRosas ?? r.permite_girasoles_y_rosas;

  const permiteSoloRosas =
    typeof permiteSoloRosasRaw === "boolean" ? permiteSoloRosasRaw : base.permiteSoloRosas;
  const permiteSoloGirasoles =
    typeof permiteSoloGirasolesRaw === "boolean"
      ? permiteSoloGirasolesRaw
      : base.permiteSoloGirasoles;
  const permiteGirasolesYRosas =
    typeof permiteGirasolesYRosasRaw === "boolean"
      ? permiteGirasolesYRosasRaw
      : base.permiteGirasolesYRosas;

  const orquideasMin = normalizarEnteroRango(r.orquideasMin ?? r.orquideas_min, 0, 0, 50);
  const orquideasMaxRaw = normalizarEnteroRango(r.orquideasMax ?? r.orquideas_max, 0, 0, 50);
  const orquideasMax = Math.max(orquideasMin, orquideasMaxRaw);

  const mostrarColorBaseRaw = r.mostrarColorBase ?? r.mostrar_color_base;
  const mostrarColorBase =
    typeof mostrarColorBaseRaw === "boolean" ? mostrarColorBaseRaw : base.mostrarColorBase;

  const baseRaw = Array.isArray(r.coloresBaseDisponibles ?? r.colores_base_disponibles)
    ? ((r.coloresBaseDisponibles ?? r.colores_base_disponibles) as unknown[])
    : [];
  const baseFiltrados = Array.from(new Set(baseRaw.filter(esColorBasePapelValido)));
  const coloresBaseDisponibles: ColorBasePapelId[] =
    baseFiltrados.length > 0 ? baseFiltrados : ["claros", "oscuros", "rosa"];

  const permitirIndicacionesRaw =
    r.permitirIndicacionesAdicionales ?? r.permitir_indicaciones_adicionales;
  const permitirIndicacionesAdicionales =
    typeof permitirIndicacionesRaw === "boolean" ? permitirIndicacionesRaw : true;

  // Garantizar que si el producto está habilitado exista al menos una modalidad de flor válida
  const tieneAlgunaModalidad =
    permiteSoloRosas || permiteSoloGirasoles || permiteGirasolesYRosas || orquideasMax > 0;

  return {
    habilitada,
    maxColoresRosas,
    coloresRosasDisponibles,
    permiteSoloRosas: tieneAlgunaModalidad ? permiteSoloRosas : true,
    permiteSoloGirasoles,
    permiteGirasolesYRosas,
    orquideasMin,
    orquideasMax,
    mostrarColorBase,
    coloresBaseDisponibles,
    permitirIndicacionesAdicionales,
  };
}

export interface ModoFlorOpcion {
  id: ModoFlorPersonalizacion;
  etiqueta: string;
  descripcion: string;
}

export function obtenerModosFlorDisponibles(
  config: ConfiguracionPersonalizacionFloral
): ModoFlorOpcion[] {
  const modos: ModoFlorOpcion[] = [];
  if (config.permiteSoloRosas) {
    modos.push({
      id: "solo_rosas",
      etiqueta: "Solo Rosas",
      descripcion:
        config.maxColoresRosas === 1
          ? "1 color de rosas a elección"
          : `Hasta ${config.maxColoresRosas} colores de rosas`,
    });
  }
  if (config.permiteSoloGirasoles) {
    modos.push({
      id: "solo_girasoles",
      etiqueta: "Solo Girasoles",
      descripcion: "Elaborado con girasoles frescos",
    });
  }
  if (config.permiteGirasolesYRosas) {
    modos.push({
      id: "girasoles_y_rosas",
      etiqueta: "Girasoles y Rosas",
      descripcion:
        config.maxColoresRosas <= 1
          ? "Combina girasoles + 1 color de rosas"
          : `Combina girasoles + hasta ${config.maxColoresRosas} colores de rosas`,
    });
  }
  if (modos.length === 0 && config.orquideasMax > 0) {
    modos.push({
      id: "solo_orquideas",
      etiqueta: "Orquídeas",
      descripcion: `De ${config.orquideasMin} a ${config.orquideasMax} orquídeas`,
    });
  }
  if (modos.length === 0) {
    modos.push({
      id: "solo_rosas",
      etiqueta: "Solo Rosas",
      descripcion: "Color de rosas a tu elección",
    });
  }
  return modos;
}

export function modoRequiereColoresRosas(
  modo: ModoFlorPersonalizacion,
  config: ConfiguracionPersonalizacionFloral
): boolean {
  if (config.maxColoresRosas <= 0) return false;
  return modo === "solo_rosas" || modo === "girasoles_y_rosas";
}

export function obtenerColoresRosasHabilitados(
  config: ConfiguracionPersonalizacionFloral
): readonly OpcionColorRosaPersonalizacion[] {
  if (!config.coloresRosasDisponibles || config.coloresRosasDisponibles.length === 0) {
    return COLORES_ROSAS_PERSONALIZACION;
  }
  const set = new Set(config.coloresRosasDisponibles);
  const filtrados = COLORES_ROSAS_PERSONALIZACION.filter((c) => set.has(c.clave));
  return filtrados.length > 0 ? filtrados : COLORES_ROSAS_PERSONALIZACION;
}

export function obtenerEtiquetaColorBasePapel(id?: ColorBasePapelId | null): string {
  if (!id) return "";
  const op = OPCIONES_COLOR_BASE_PAPEL.find((o) => o.id === id);
  return op ? `${op.etiqueta} (${op.detalle})` : "";
}

export function obtenerEtiquetaModoFlor(modo: ModoFlorPersonalizacion): string {
  switch (modo) {
    case "solo_girasoles":
      return "Solo Girasoles";
    case "girasoles_y_rosas":
      return "Girasoles y Rosas";
    case "solo_orquideas":
      return "Orquídeas";
    case "solo_rosas":
    default:
      return "Solo Rosas";
  }
}

export function formatearResumenPersonalizacionFloral(
  seleccion: Omit<SeleccionPersonalizacionFloral, "resumenTexto">
): string {
  const partes: string[] = [];

  if (seleccion.mismosColoresFoto) {
    partes.push("Mismos colores de la foto");
    const orq = Math.max(0, Math.round(Number(seleccion.cantidadOrquideas || 0)));
    if (orq > 0) {
      partes.push(`+ ${orq} ${orq === 1 ? "orquídea" : "orquídeas"}`);
    }
    const notas = seleccion.indicacionesAdicionales?.trim();
    if (notas) {
      partes.push(`Nota: ${notas}`);
    }
    return partes.join(" · ");
  }

  const coloresLimpios = (seleccion.coloresRosas || [])
    .map((c) => String(c || "").trim())
    .filter(Boolean);

  if (seleccion.modoFlores === "solo_girasoles") {
    partes.push("Solo Girasoles");
  } else if (seleccion.modoFlores === "girasoles_y_rosas") {
    partes.push(
      coloresLimpios.length > 0
        ? `Girasoles y Rosas (${coloresLimpios.join(", ")})`
        : "Girasoles y Rosas"
    );
  } else if (seleccion.modoFlores === "solo_orquideas") {
    partes.push("Orquídeas");
  } else {
    partes.push(coloresLimpios.length > 0 ? `Rosas (${coloresLimpios.join(", ")})` : "Rosas");
  }

  const orq = Math.max(0, Math.round(Number(seleccion.cantidadOrquideas || 0)));
  if (orq > 0) {
    partes.push(`+ ${orq} ${orq === 1 ? "orquídea" : "orquídeas"}`);
  }

  const etiquetaBase =
    seleccion.colorBasePapelEtiqueta?.trim() ||
    obtenerEtiquetaColorBasePapel(seleccion.colorBasePapel);
  if (etiquetaBase) {
    partes.push(`Base/Papel: ${etiquetaBase}`);
  }

  const notas = seleccion.indicacionesAdicionales?.trim();
  if (notas) {
    partes.push(`Nota: ${notas}`);
  }

  return partes.join(" · ");
}

export function validarSeleccionPersonalizacionFloral(
  config: ConfiguracionPersonalizacionFloral,
  seleccion: Omit<SeleccionPersonalizacionFloral, "resumenTexto">
): { ok: true; seleccionFinal: SeleccionPersonalizacionFloral } | { ok: false; error: string } {
  const modosDisponibles = obtenerModosFlorDisponibles(config);
  const modoValido = modosDisponibles.some((m) => m.id === seleccion.modoFlores)
    ? seleccion.modoFlores
    : modosDisponibles[0]!.id;

  const cantidadOrquideas =
    config.orquideasMax > 0
      ? Math.max(
          config.orquideasMin,
          Math.min(config.orquideasMax, Math.round(Number(seleccion.cantidadOrquideas || 0)))
        )
      : 0;

  const indicacionesAdicionales = config.permitirIndicacionesAdicionales
    ? (seleccion.indicacionesAdicionales || "").trim().slice(0, 500)
    : "";

  if (seleccion.mismosColoresFoto) {
    const baseFoto: Omit<SeleccionPersonalizacionFloral, "resumenTexto"> = {
      mismosColoresFoto: true,
      modoFlores: modoValido,
      coloresRosas: [],
      cantidadOrquideas,
      colorBasePapel: null,
      colorBasePapelEtiqueta: undefined,
      indicacionesAdicionales: indicacionesAdicionales || undefined,
    };
    return {
      ok: true,
      seleccionFinal: {
        ...baseFoto,
        resumenTexto: formatearResumenPersonalizacionFloral(baseFoto),
      },
    };
  }

  const requiereRosas = modoRequiereColoresRosas(modoValido, config);
  const coloresLimpios = requiereRosas
    ? Array.from(
        new Set(
          (seleccion.coloresRosas || [])
            .map((c) => String(c || "").trim())
            .filter(Boolean)
        )
      )
    : [];

  if (requiereRosas && coloresLimpios.length === 0) {
    return {
      ok: false,
      error:
        config.maxColoresRosas === 1
          ? 'Selecciona el color de rosas o elige "Mismos colores de la foto".'
          : `Selecciona al menos 1 color de rosas (máximo ${config.maxColoresRosas}) o elige "Mismos colores de la foto".`,
    };
  }

  if (requiereRosas && coloresLimpios.length > config.maxColoresRosas) {
    return {
      ok: false,
      error: `Este arreglo permite máximo ${config.maxColoresRosas} ${
        config.maxColoresRosas === 1 ? "color" : "colores"
      } de rosas.`,
    };
  }

  let colorBasePapel: ColorBasePapelId | null = null;
  let colorBasePapelEtiqueta = "";

  if (config.mostrarColorBase) {
    const elegida = seleccion.colorBasePapel;
    if (!elegida || !config.coloresBaseDisponibles.includes(elegida)) {
      return {
        ok: false,
        error: "Selecciona el Color Base / papel decorativo (Claros, Oscuros o Rosa).",
      };
    }
    colorBasePapel = elegida;
    colorBasePapelEtiqueta = obtenerEtiquetaColorBasePapel(elegida);
  }

  const baseSel: Omit<SeleccionPersonalizacionFloral, "resumenTexto"> = {
    mismosColoresFoto: false,
    modoFlores: modoValido,
    coloresRosas: coloresLimpios,
    cantidadOrquideas,
    colorBasePapel,
    colorBasePapelEtiqueta: colorBasePapelEtiqueta || undefined,
    indicacionesAdicionales: indicacionesAdicionales || undefined,
  };

  return {
    ok: true,
    seleccionFinal: {
      ...baseSel,
      resumenTexto: formatearResumenPersonalizacionFloral(baseSel),
    },
  };
}

export type ModoPersonalizacionFloralVariante = "heredar" | "personalizado";

/**
 * Resuelve la configuración efectiva de personalización floral combinando la configuración
 * global del producto Master con un posible ajuste específico por variante/tamaño.
 *
 * - Si la variante tiene `modoVariante === "personalizado"` (o configuración propia explícita
 *   sin modo `"heredar"`), prevalece la configuración de la variante.
 * - En caso contrario, hereda la configuración global del producto Master.
 */
export function resolverPersonalizacionFloralEfectiva(params: {
  configMaster?: unknown;
  configVariante?: unknown;
  modoVariante?: unknown;
  habilitadaPorDefecto?: boolean;
}): ConfiguracionPersonalizacionFloral {
  const habilitadaDef = params.habilitadaPorDefecto ?? true;
  const masterNorm = normalizarConfiguracionPersonalizacionFloral(params.configMaster, {
    habilitadaPorDefecto: habilitadaDef,
  });

  const modoRaw = String(params.modoVariante || "").trim().toLowerCase();
  const tieneObjVariante = Boolean(params.configVariante && typeof params.configVariante === "object");

  if (modoRaw === "personalizado" && tieneObjVariante) {
    return normalizarConfiguracionPersonalizacionFloral(params.configVariante, {
      habilitadaPorDefecto: masterNorm.habilitada,
    });
  }

  return masterNorm;
}

export function resumirConfiguracionPersonalizacionAdmin(
  config?: ConfiguracionPersonalizacionFloral | null
): string {
  if (!config || !config.habilitada) {
    return "Desactivada en tienda";
  }
  const partes: string[] = [];
  const modos: string[] = [];
  if (config.permiteSoloRosas) modos.push("Rosas");
  if (config.permiteSoloGirasoles) modos.push("Girasoles");
  if (config.permiteGirasolesYRosas) modos.push("Girasoles + Rosas");
  if (modos.length > 0) {
    partes.push(modos.join(" / "));
  }
  if (config.permiteSoloRosas || config.permiteGirasolesYRosas) {
    partes.push(
      config.maxColoresRosas === 1
        ? "1 color"
        : `hasta ${config.maxColoresRosas} colores`
    );
  }
  if (config.orquideasMax > 0) {
    partes.push(`${config.orquideasMin}–${config.orquideasMax} orquídeas`);
  }
  if (config.mostrarColorBase) {
    partes.push("Base/Papel");
  }
  return partes.join(" · ") || "Activa";
}

export function describirConfiguracionPersonalizacionCliente(
  config?: ConfiguracionPersonalizacionFloral | null
): string {
  if (!config || !config.habilitada) return "";
  const extras: string[] = [];
  if (config.permiteSoloGirasoles || config.permiteGirasolesYRosas) {
    extras.push("Girasoles");
  }
  if (config.orquideasMax > 0) {
    extras.push(
      config.orquideasMin > 0
        ? `${config.orquideasMin}–${config.orquideasMax} orquídeas`
        : `hasta ${config.orquideasMax} orquídeas`
    );
  }
  if (config.maxColoresRosas > 1 && (config.permiteSoloRosas || config.permiteGirasolesYRosas)) {
    extras.push(`hasta ${config.maxColoresRosas} colores`);
  }
  if (extras.length === 0) {
    return "Elaborado en los colores de tu preferencia";
  }
  return `Colores a tu elección · ${extras.join(" · ")}`;
}
