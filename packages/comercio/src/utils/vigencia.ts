export type TipoVigenciaTemporal = "SIEMPRE" | "RANGO_FECHAS" | "ESTACIONAL_ANUAL";

export interface DetalleVigenciaTemporal {
  vigencia_tipo?: TipoVigenciaTemporal;
  fecha_inicio?: string; // "YYYY-MM-DD" o "MM-DD"
  fecha_fin?: string; // "YYYY-MM-DD" o "MM-DD"
  mensaje_fuera_temporada?: string;
  etiqueta_temporada?: string; // ej: "San Valentín", "Día de la Madre", "Navidad"
}

export interface ResultadoEvaluacionVigencia {
  estaVigente: boolean;
  tipoVigencia: TipoVigenciaTemporal;
  tipo: TipoVigenciaTemporal; // alias
  vigenciaTipo: TipoVigenciaTemporal; // alias
  esEstacional: boolean;
  etiquetaBadge: string;
  etiqueta: string; // alias
  colorBadge: "verde" | "amarillo" | "azul" | "gris" | "rojo";
  mensajeDetalle: string;
  mensaje: string; // alias
}

const MESES_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

/**
 * Formatea una fecha o cadena MM-DD a texto legible en español (ej: "10 Feb")
 */
export function formatearFechaCorta(str?: string): string {
  if (!str) return "";
  const partes = str.split("-");
  if (partes.length === 2) {
    // MM-DD
    const mesStr = partes[0] ?? "1";
    const diaStr = partes[1] ?? "1";
    const mesIdx = parseInt(mesStr, 10) - 1;
    const dia = parseInt(diaStr, 10);
    return `${dia} ${MESES_ES[mesIdx] || mesStr}`;
  }
  if (partes.length === 3) {
    // YYYY-MM-DD
    const anioStr = partes[0] ?? "";
    const mesStr = partes[1] ?? "1";
    const diaStr = partes[2] ?? "1";
    const mesIdx = parseInt(mesStr, 10) - 1;
    const dia = parseInt(diaStr, 10);
    return `${dia} ${MESES_ES[mesIdx] || mesStr} ${anioStr}`;
  }
  return str;
}

/**
 * Evalúa si un producto se encuentra actualmente dentro de su ventana de vigencia temporal
 */
export function evaluarVigenciaProducto(
  detalle?: any,
  proActivo = true,
  fechaReferencia = new Date()
): ResultadoEvaluacionVigencia {
  if (!proActivo) {
    const msg = "El producto se encuentra desactivado manualmente.";
    return {
      estaVigente: false,
      tipoVigencia: "SIEMPRE",
      tipo: "SIEMPRE",
      vigenciaTipo: "SIEMPRE",
      esEstacional: false,
      etiquetaBadge: "Inactivo",
      etiqueta: "Inactivo",
      colorBadge: "rojo",
      mensajeDetalle: msg,
      mensaje: msg,
    };
  }

  const vigenciaTipo: TipoVigenciaTemporal =
    detalle?.vigencia_tipo || "SIEMPRE";

  if (vigenciaTipo === "SIEMPRE") {
    const msg = "Disponible todo el año.";
    return {
      estaVigente: true,
      tipoVigencia: "SIEMPRE",
      tipo: "SIEMPRE",
      vigenciaTipo: "SIEMPRE",
      esEstacional: false,
      etiquetaBadge: "Disponible",
      etiqueta: "Disponible",
      colorBadge: "verde",
      mensajeDetalle: msg,
      mensaje: msg,
    };
  }

  const inicioStr = detalle?.fecha_inicio?.trim();
  const finStr = detalle?.fecha_fin?.trim();
  const etiquetaTemp = detalle?.etiqueta_temporada?.trim() || "";

  if (vigenciaTipo === "RANGO_FECHAS") {
    if (!inicioStr || !finStr) {
      const msg = "Configurado sin fechas completas.";
      return {
        estaVigente: true,
        tipoVigencia: "RANGO_FECHAS",
        tipo: "RANGO_FECHAS",
        vigenciaTipo: "RANGO_FECHAS",
        esEstacional: true,
        etiquetaBadge: "Vigencia Parcial",
        etiqueta: "Vigencia Parcial",
        colorBadge: "verde",
        mensajeDetalle: msg,
        mensaje: msg,
      };
    }

    const isoStr = fechaReferencia.toISOString();
    const hoyYMD = (isoStr.split("T")[0] ?? ""); // YYYY-MM-DD
    const enRango = Boolean(hoyYMD && hoyYMD >= inicioStr && hoyYMD <= finStr);
    const antes = Boolean(hoyYMD && hoyYMD < inicioStr);
    const textoRango = `${formatearFechaCorta(inicioStr)} - ${formatearFechaCorta(finStr)}`;

    if (enRango) {
      const badge = `Vigente: ${textoRango}`;
      const msg = `Disponible del ${formatearFechaCorta(inicioStr)} al ${formatearFechaCorta(finStr)}.`;
      return {
        estaVigente: true,
        tipoVigencia: "RANGO_FECHAS",
        tipo: "RANGO_FECHAS",
        vigenciaTipo: "RANGO_FECHAS",
        esEstacional: true,
        etiquetaBadge: badge,
        etiqueta: badge,
        colorBadge: "verde",
        mensajeDetalle: msg,
        mensaje: msg,
      };
    }

    if (antes) {
      const badge = `Próximo: ${formatearFechaCorta(inicioStr)}`;
      const msg = `Estará disponible a partir del ${formatearFechaCorta(inicioStr)}.`;
      return {
        estaVigente: false,
        tipoVigencia: "RANGO_FECHAS",
        tipo: "RANGO_FECHAS",
        vigenciaTipo: "RANGO_FECHAS",
        esEstacional: true,
        etiquetaBadge: badge,
        etiqueta: badge,
        colorBadge: "amarillo",
        mensajeDetalle: msg,
        mensaje: msg,
      };
    }

    const badge = `Expiró: ${formatearFechaCorta(finStr)}`;
    const msg = `La vigencia finalizó el ${formatearFechaCorta(finStr)}.`;
    return {
      estaVigente: false,
      tipoVigencia: "RANGO_FECHAS",
      tipo: "RANGO_FECHAS",
      vigenciaTipo: "RANGO_FECHAS",
      esEstacional: true,
      etiquetaBadge: badge,
      etiqueta: badge,
      colorBadge: "gris",
      mensajeDetalle: msg,
      mensaje: msg,
    };
  }

  if (vigenciaTipo === "ESTACIONAL_ANUAL") {
    if (!inicioStr || !finStr) {
      const msg = "Temporada anual.";
      return {
        estaVigente: true,
        tipoVigencia: "ESTACIONAL_ANUAL",
        tipo: "ESTACIONAL_ANUAL",
        vigenciaTipo: "ESTACIONAL_ANUAL",
        esEstacional: true,
        etiquetaBadge: "Estacional",
        etiqueta: "Estacional",
        colorBadge: "verde",
        mensajeDetalle: msg,
        mensaje: msg,
      };
    }

    // Convertir a MM-DD normalizado
    const normMD = (val: string) => {
      const parts = val.split("-");
      if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
      return val;
    };

    const inicioMD = normMD(inicioStr);
    const finMD = normMD(finStr);

    const mesActual = String(fechaReferencia.getMonth() + 1).padStart(2, "0");
    const diaActual = String(fechaReferencia.getDate()).padStart(2, "0");
    const hoyMD = `${mesActual}-${diaActual}`;

    let enTemporada = false;
    if (inicioMD <= finMD) {
      // Rango dentro del mismo año (ej. 02-10 a 02-15)
      enTemporada = hoyMD >= inicioMD && hoyMD <= finMD;
    } else {
      // Rango que cruza fin de año (ej. 12-15 a 01-10)
      enTemporada = hoyMD >= inicioMD || hoyMD <= finMD;
    }

    const textoTemporada = etiquetaTemp
      ? `${etiquetaTemp} (${formatearFechaCorta(inicioMD)} - ${formatearFechaCorta(finMD)})`
      : `${formatearFechaCorta(inicioMD)} - ${formatearFechaCorta(finMD)}`;

    if (enTemporada) {
      const badge = `🌹 En Temporada: ${textoTemporada}`;
      const msg = `Producto estacional activo cada año (${textoTemporada}).`;
      return {
        estaVigente: true,
        tipoVigencia: "ESTACIONAL_ANUAL",
        tipo: "ESTACIONAL_ANUAL",
        vigenciaTipo: "ESTACIONAL_ANUAL",
        esEstacional: true,
        etiquetaBadge: badge,
        etiqueta: badge,
        colorBadge: "verde",
        mensajeDetalle: msg,
        mensaje: msg,
      };
    }

    const badge = `⏳ Fuera de temporada: ${textoTemporada}`;
    const msg = `Disponible únicamente del ${formatearFechaCorta(inicioMD)} al ${formatearFechaCorta(finMD)} de cada año.`;
    return {
      estaVigente: false,
      tipoVigencia: "ESTACIONAL_ANUAL",
      tipo: "ESTACIONAL_ANUAL",
      vigenciaTipo: "ESTACIONAL_ANUAL",
      esEstacional: true,
      etiquetaBadge: badge,
      etiqueta: badge,
      colorBadge: "amarillo",
      mensajeDetalle: msg,
      mensaje: msg,
    };
  }

  const defaultMsg = "Disponible.";
  return {
    estaVigente: true,
    tipoVigencia: "SIEMPRE",
    tipo: "SIEMPRE",
    vigenciaTipo: "SIEMPRE",
    esEstacional: false,
    etiquetaBadge: "Disponible",
    etiqueta: "Disponible",
    colorBadge: "verde",
    mensajeDetalle: defaultMsg,
    mensaje: defaultMsg,
  };
}
