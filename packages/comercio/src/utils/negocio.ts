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
