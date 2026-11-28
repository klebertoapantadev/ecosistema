import type { TramiteCatalogo, TramiteDetectado } from "./esquema";

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Si la persona pide hablar con alguien o describe un conflicto, no es un trámite:
 * va a una cita aunque mencione una notaría o una escritura.
 */
const PIDE_ABOGADO =
  /abogad|asesor|consult|demand|juicio|denunci|audiencia|despid|estaf|herencia|herede|testament|divorci|pension|custodia/;

/**
 * Frases que apuntan a una opción concreta del catálogo (por su `concepto_derecho`)
 * o a un trámite (por el slug del producto). El orden importa: gana la primera.
 */
const REGLAS: Array<{ patron: RegExp; concepto?: string; slug?: string }> = [
  { patron: /declaracion(es)? juramentada|juramentad/, concepto: "DECLARACION_JURAMENTADA" },
  { patron: /union de hecho/, concepto: "UNION_DE_HECHO" },
  { patron: /poder general/, concepto: "PODER_GENERAL" },
  { patron: /\bpoder(es)?\b|apoderad/, concepto: "PODER_ESPECIAL" },
  { patron: /reconoc\w* (de )?(la |las |mi |mis )?firmas?|autentica\w* (de )?(la |mi )?firma/, concepto: "RECONOCIMIENTO_FIRMA" },
  { patron: /materializ/, concepto: "MATERIALIZACION_DIGITAL" },
  { patron: /protocoliz|minuta|estatuto/, concepto: "PROTOCOLIZACION" },
  {
    patron:
      /salida del pais|permiso de salida|autorizacion de (salida|viaje)|(viaj\w*|salir)\b.*\b(hij[oa]s?|menor(es)?|nin[oa]s?)\b|\b(hij[oa]s?|menor(es)?|nin[oa]s?)\b.*\b(viaj\w*|salir)/,
    slug: "permiso-salida",
  },
  { patron: /notari|(sacar|copia|obtener|pedir|retirar)\w* (de )?(la |una |mi |las )?escrituras?/, slug: "notarizacion" },
];

/** La opción por defecto de un trámite: la genérica (sin concepto) o la primera del catálogo. */
function opcionPorDefecto(tramite: TramiteCatalogo): string | null {
  const generica = tramite.opciones.find((o) => !o.concepto);
  return (generica ?? tramite.opciones[0])?.variante.var_id ?? null;
}

/**
 * Decide si lo que contó el cliente es un trámite del catálogo y cuál.
 * Devuelve null si no lo es (entonces sigue el camino de la cita con ARIA).
 */
export function detectarTramite(relato: string, tramites: TramiteCatalogo[]): TramiteDetectado | null {
  const texto = normalizarTexto(relato);
  if (!texto || tramites.length === 0 || PIDE_ABOGADO.test(texto)) return null;

  for (const regla of REGLAS) {
    if (!regla.patron.test(texto)) continue;
    if (regla.concepto) {
      for (const tramite of tramites) {
        const opcion = tramite.opciones.find((o) => o.concepto === regla.concepto);
        if (opcion) return { tramite, opcionId: opcion.variante.var_id };
      }
    }
    if (regla.slug) {
      const tramite = tramites.find((t) => t.slug === regla.slug);
      const opcionId = tramite ? opcionPorDefecto(tramite) : null;
      if (tramite && opcionId) return { tramite, opcionId };
    }
  }

  // Último recurso: las etiquetas que el catálogo ya tiene para cada trámite.
  for (const tramite of tramites) {
    const coincide = tramite.etiquetas
      .map(normalizarTexto)
      .some((e) => e.length >= 5 && texto.includes(e));
    const opcionId = coincide ? opcionPorDefecto(tramite) : null;
    if (opcionId) return { tramite, opcionId };
  }
  return null;
}
