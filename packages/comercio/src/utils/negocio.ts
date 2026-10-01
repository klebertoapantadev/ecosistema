export type TipoNegocioCatalogo = "FLORISTERIA" | "LEGAL" | "MANTENIMIENTO";

export interface InfoNegocioCatalogo {
  esFloristeria: boolean;
  esLegal: boolean;
  esMantenimiento: boolean;
  tipoNegocio: TipoNegocioCatalogo;
  identificadorNormalizado: string;
}

export function detectarTipoNegocio(negocio?: string): InfoNegocioCatalogo {
  const norm = (negocio || "tranqi").toLowerCase().trim();

  const esFloristeria =
    norm.startsWith("tinkay") ||
    norm.startsWith("tnk") ||
    norm.startsWith("margarita") ||
    norm.startsWith("mrg") ||
    norm === "floristeria";

  const esLegal =
    norm.startsWith("tranq") ||
    norm.startsWith("trq") ||
    norm.startsWith("legal") ||
    norm === "tranqi24" ||
    norm === "abogados";

  const esMantenimiento =
    norm.startsWith("fastfix") ||
    norm.startsWith("ffh") ||
    norm.startsWith("fix") ||
    norm === "hogar" ||
    norm === "mantenimiento";

  const tipoFinal: TipoNegocioCatalogo = esFloristeria
    ? "FLORISTERIA"
    : esLegal
    ? "LEGAL"
    : "MANTENIMIENTO";

  return {
    esFloristeria: tipoFinal === "FLORISTERIA",
    esLegal: tipoFinal === "LEGAL",
    esMantenimiento: tipoFinal === "MANTENIMIENTO",
    tipoNegocio: tipoFinal,
    identificadorNormalizado: esFloristeria
      ? norm.startsWith("mrg") || norm.startsWith("margarita")
        ? "margaritas"
        : "tinkay"
      : esLegal
      ? "tranqi"
      : "fastfix",
  };
}

export function normalizarIdentificadorNegocio(negocio?: string): { principal: string; variantes: string[] } {
  const norm = (negocio || "tranqi").toLowerCase().trim();
  const upper = (negocio || "TRANQ").toUpperCase().trim();

  if (norm.startsWith("tranq") || norm.startsWith("legal")) {
    return { principal: "tranqi", variantes: ["tranqi", "TRANQ", "TRANQI", "legal", "LEGAL", "tranqui"] };
  }
  if (norm.startsWith("tinkay") || norm.startsWith("tnk")) {
    return { principal: "tinkay", variantes: ["tinkay", "TNK", "TINKAY"] };
  }
  if (norm.startsWith("fastfix") || norm.startsWith("ffh")) {
    return { principal: "fastfix", variantes: ["fastfix", "FFH", "FASTFIX"] };
  }
  if (norm.startsWith("margaritas") || norm.startsWith("mrg")) {
    return { principal: "margaritas", variantes: ["margaritas", "MRG", "MARGARITAS"] };
  }

  return { principal: norm, variantes: [norm, upper] };
}

export const IMAGEN_FALLBACK_LEGAL =
  "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1200&auto=format&fit=crop";

export const IMAGEN_FALLBACK_FLORISTERIA =
  "https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=800&auto=format&fit=crop&q=80";

export const IMAGEN_FALLBACK_MANTENIMIENTO =
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80";

export function obtenerImagenFallbackNegocio(negocio?: string): string {
  const { tipoNegocio } = detectarTipoNegocio(negocio);
  if (tipoNegocio === "FLORISTERIA") return IMAGEN_FALLBACK_FLORISTERIA;
  if (tipoNegocio === "MANTENIMIENTO") return IMAGEN_FALLBACK_MANTENIMIENTO;
  return IMAGEN_FALLBACK_LEGAL;
}


