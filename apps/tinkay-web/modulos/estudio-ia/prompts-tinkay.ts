// ============================================================================
// Prompts oficiales de Tinkay Flores y Eventos para el Generador IA
// (Estudio + Taller en 3:4) portados desde tinkay-batch.mjs y SKILL.md.
// Módulo puro de servidor — sin dependencias de cliente ni de red.
// ============================================================================

export type ModoEstudioIa = "estudio" | "taller";
export type TipoSoporteIa = "mesa" | "piso" | "pedestal";
export type GeometriaIa = "auto" | "con_frente" | "recto";

export interface OpcionesEstudioIa {
  tipoSoporte: TipoSoporteIa;
  coreano: boolean;
  geometria: GeometriaIa;
  incluirTarjeta: boolean;
}

export type ClaveReferenciaIa =
  | "fondoTaller"
  | "fondoTallerAlto"
  | "fondoTallerPedestal"
  | "tarjeta"
  | "logo";

export interface DefinicionReferenciaIa {
  clave: ClaveReferenciaIa;
  archivo: string;
  etiquetaPrompt: string;
}

export const REFERENCIAS_IA_OFICIALES: Record<ClaveReferenciaIa, DefinicionReferenciaIa> = {
  fondoTaller: {
    clave: "fondoTaller",
    archivo: "fondo-taller.jpg",
    etiquetaPrompt: "FONDO TALLER",
  },
  fondoTallerAlto: {
    clave: "fondoTallerAlto",
    archivo: "fondo-taller-alto.jpg",
    etiquetaPrompt: "FONDO TALLER ALTO",
  },
  fondoTallerPedestal: {
    clave: "fondoTallerPedestal",
    archivo: "fondo-taller-pedestal.jpg",
    etiquetaPrompt: "FONDO TALLER PEDESTAL",
  },
  tarjeta: {
    clave: "tarjeta",
    archivo: "tarjeta-dedicatoria.jpg",
    etiquetaPrompt: "TARJETA",
  },
  logo: {
    clave: "logo",
    archivo: "logo-tinkay.jpg",
    etiquetaPrompt: "LOGO",
  },
};

export function obtenerReferenciasParaModo(
  modo: ModoEstudioIa,
  opciones: OpcionesEstudioIa
): DefinicionReferenciaIa[] {
  const lista: DefinicionReferenciaIa[] = [];

  if (modo === "taller") {
    if (opciones.tipoSoporte === "piso") {
      lista.push(REFERENCIAS_IA_OFICIALES.fondoTallerAlto);
    } else if (opciones.tipoSoporte === "pedestal") {
      lista.push(REFERENCIAS_IA_OFICIALES.fondoTallerPedestal);
    } else {
      lista.push(REFERENCIAS_IA_OFICIALES.fondoTaller);
    }
  }

  if (opciones.incluirTarjeta) {
    lista.push(REFERENCIAS_IA_OFICIALES.tarjeta);
  }

  lista.push(REFERENCIAS_IA_OFICIALES.logo);
  return lista;
}

export function construirReglasComunes(opciones: OpcionesEstudioIa): string {
  let textoGeometria: string;
  if (opciones.geometria === "con_frente") {
    textoGeometria =
      "MODIFICADOR con frente: fuerza vista frontal escalonada, flores en abanico mirando a la cámara.";
  } else if (opciones.geometria === "recto") {
    textoGeometria =
      "MODIFICADOR sin frente / recto: copa simétrica radial 360°, domo nivelado hacia arriba, SIN inclinación hacia la cámara.";
  } else {
    textoGeometria =
      "Respeta la geometría de la copa de la FOTO DEL PRODUCTO: si es recta/radial 360° (copa esférica nivelada hacia arriba) PROHIBIDO inclinarla hacia la cámara; si es con frente 180°, flores en abanico escalonado mirando al frente.";
  }

  const textoBase = opciones.coreano
    ? "BOUQUET ESTILO COREANO: base cónica plástica interna oculta por el papel; el ramo permanece estrictamente PARADO, erguido y vertical por sí mismo sobre su base plana (sin florero)."
    : "Respeta el tipo de base de la foto del producto (box, esfera/cilindro de cristal con piedras o hidrogel, bouquet tradicional con tallos visibles, trípode de pedestal o el formato exacto que tenga).";

  const lineas: string[] = [
    'Actúa como fotógrafo publicitario y director de arte para "Tinkay Flores y Eventos". Genera UNA fotografía publicitaria fotorrealista de alta gama.',
    "",
    "REGLA SUPREMA – AISLAMIENTO TOTAL DEL PRODUCTO: La imagen etiquetada como FOTO DEL PRODUCTO es la ÚNICA fuente de flores, especies, colores, cantidad visible, follajes, contenedor, piedras/hidrogel, chocolates, envoltura y accesorios. Las demás imágenes de referencia son SOLO para fondo, tarjeta o logo. NUNCA copies flores de ellas.",
    "",
    "LIMPIEZA: Elimina por completo cualquier marca de agua, texto sobrepuesto, fondo desordenado de tienda o mesa ajena de la foto original.",
    "",
    "ESCALA REALISTA: Cada rosa ~5 cm. Conserva proporciones fieles del arreglo.",
    "",
    `BASE: ${textoBase}`,
    `GEOMETRÍA: ${textoGeometria}`,
  ];

  if (opciones.incluirTarjeta) {
    lineas.push(
      "",
      "TARJETA: Si el arreglo ya trae una tarjeta, estandarízala o consérvala sin duplicar. Si no tiene, inserta UNA SOLA tarjeta oficial Tinkay (~8x5 cm, cartulina marfil texturizada) en un clip de estrella dorado integrado entre las flores. El logo 'Tinkay' (tipografía sólida de la referencia LOGO) con el subtítulo pequeño 'FLORES Y EVENTOS' debe ir centrado, discreto y delicado, ocupando únicamente ~40% a 45% del ancho de la tarjeta (con amplios márgenes limpios de cartulina marfil a los lados, arriba y abajo — nunca grande ni pegado a los bordes, exactamente con la escala pequeña y sutil de la referencia TARJETA)."
    );
  }

  lineas.push(
    "",
    "SALIDA: Una sola fotografía publicitaria fotorrealista vertical 3:4 a pantalla completa, sin textos sobrepuestos, marcas de agua ni collage."
  );

  return lineas.join("\n");
}

export function construirPromptModo(modo: ModoEstudioIa, opciones: OpcionesEstudioIa): string {
  if (modo === "estudio") {
    if (opciones.tipoSoporte === "piso") {
      return "MODO ESTUDIO DE PRODUCTO (DE PISO / TRÍPODE): CERO PERSONAS, SIN PEANA DE MESA. Toma vertical de cuerpo entero desde el piso hasta la cúspide floral. El trípode real del arreglo (carrizo cilíndrico para XL o madera sólida rectangular para XXL) apoya directamente sobre el piso pulcro de estudio con sombra de contacto natural. Fondo infinito gris claro neutro, iluminación suave envolvente de catálogo.";
    }

    if (opciones.tipoSoporte === "pedestal") {
      return "MODO ESTUDIO DE PRODUCTO (PEDESTAL): CERO PERSONAS. Aísla el arreglo floral sobre fondo infinito neutro de estudio comercial limpio, apoyado en su soporte real de Tinkay (PROHIBIDO inventar columnas griegas o ficticias). Iluminación envolvente de catálogo.";
    }

    const extraCoreano = opciones.coreano
      ? " En bouquet estilo coreano, el ramo asienta vertical y erguido en el centro de la peana y las flores rebasan sus bordes."
      : "";
    return `MODO ESTUDIO DE PRODUCTO (MESA): CERO PERSONAS. El arreglo descansa centrado sobre una peana circular de madera pulida con bisel metálico dorado de 30 cm de diámetro (si incluye caja de chocolates u otro extra junto al arreglo, ambos descansan armónicamente sobre la peana). En ramos grandes (50-100 rosas) la peana es visiblemente más angosta que la copa.${extraCoreano} 3 a 4 pétalos caídos delicadamente sobre la madera de la peana. Fondo infinito de estudio gris claro neutro y minimalista, iluminación suave envolvente de softbox con sombras delicadas y reflejos limpios.`;
  }

  // Modo 2: taller
  if (opciones.tipoSoporte === "piso") {
    return "MODO TALLER OFICIAL TINKAY (DE PISO): Usa estrictamente el entorno de FONDO TALLER ALTO (pared de madera clara, letrero neón cálido 'Tinkay', estanterías laterales y piso de cemento gris pulido MATE). CERO MESAS, CERO PERSONAS, CERO REFLEJOS INVERTIDOS del texto 'Tinkay' en el suelo. El trípode apoya directamente en el suelo. PRIORIDAD FLORAL ABSOLUTA: la cresta floral superior nunca debe recortarse ni aplanarse para mostrar el letrero; si el arreglo es alto, las flores quedan naturalmente por delante cubriendo parcialmente las letras del neón.";
  }

  if (opciones.tipoSoporte === "pedestal") {
    return "MODO TALLER OFICIAL TINKAY (PEDESTAL): Monta el arreglo directamente sobre el pedestal oficial de Tinkay visible en FONDO TALLER PEDESTAL frente a la pared de madera clara y el letrero neón cálido 'Tinkay'. PROHIBIDO inventar columnas ficticias. CERO PERSONAS, sin reflejos invertidos del texto en el suelo.";
  }

  const extraCoreanoTaller = opciones.coreano
    ? " En bouquet estilo coreano, se asienta erguido y de pie directamente sobre la mesa."
    : "";
  return `MODO TALLER OFICIAL TINKAY (MESA): Fotomontaje fotorrealista usando la referencia FONDO TALLER. La pared de madera natural clara y el letrero neón cálido encendido 'Tinkay' (con lazo sobre la 'T' y detalle floral sobre 'a/y' en acrílico transparente) deben ser IDÉNTICOS a la referencia en escala, tipografía, proporción y posición. PROHIBIDO redibujar, deformar o agrandar el letrero. El arreglo reposa directamente centrado sobre la mesa rústica de madera del taller (SIN peana dorada).${extraCoreanoTaller} CERO PERSONAS.`;
}

export function construirPromptCompletoEstudioIa(
  modo: ModoEstudioIa,
  opciones: OpcionesEstudioIa
): string {
  return `${construirReglasComunes(opciones)}\n\n${construirPromptModo(modo, opciones)}`;
}
